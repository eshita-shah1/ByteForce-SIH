# Manganese Mining Intelligence System — Backend

FastAPI backend for two **independent** ML modules over the Balaghat/Bharveli
manganese belt:

- **Module 1 — Manganese Prospectivity**: XGBoost classifier over an existing
  PostGIS-backed 300m study-area grid, or over GIS data the user uploads.
- **Module 2 — Production Shortfall**: XGBoost regressor predicting achievable
  production tonnage from operational inputs (+ live weather data), with a
  rule-based corrective-measures engine.

Module 1 and Module 2 never feed into each other.

## 1. How the actual model schemas were determined

Nothing here was guessed. Every artifact was unpickled and inspected directly
(see the inspection transcript in this conversation); the important findings:

**Model 1** (`models/preprocessor.pkl` + `models/xgboost_manganese_model.pkl`):
- `preprocessor.pkl` is an sklearn `ColumnTransformer` with **111 raw input
  columns** → median-imputed numeric passthrough, most-frequent-imputed
  binary flag (`terrain_available`), and most-frequent-imputed + one-hot
  encoded categoricals (`surface_zone`: 7 categories, `soil_wrb_class_code`:
  3 categories) → **119 columns** into the model.
- `xgboost_manganese_model.pkl` is an `XGBClassifier`
  (`n_estimators=400, max_depth=2, learning_rate=0.02`), `n_features_in_ ==
  119`, `classes_ == [0, 1]`.
- The exact 111 column names/order are in `models/model_config.json`
  (`feature_columns`), which is the same list this repo's own audited
  `ml_feature_manifest.csv` (from the upstream data-engineering pass)
  classified as `KEEP` / valid ML features — i.e. the shipped artifact and
  the upstream feature audit agree.
- Decision threshold: **0.7999999999999998** (not 0.5) — from
  `model_config.json["threshold"]`. `manganese_present` iff
  `predict_proba()[:, 1] >= threshold`.
- Verified end-to-end against real rows from the upstream
  `ml_training_dataset.csv`: **99.3%** match against ground-truth labels
  on real rows (note: this includes rows the model was trained on — it is a
  wiring sanity check, not a held-out accuracy metric).

**Module 2** (`models/MOIL_Module2_Final_Model.pkl` / `moil_production_pipeline.pkl`) — **v2 artifact**:
- The original v1 artifact is preserved at
  `models/backup_v1_shortfall_model/` (not loaded by the app). It was
  replaced because the v1 feature set included several fields with an
  unresolved leakage risk (`operational_shock_flag` alone accounted for
  82.5% of v1's feature importance, with no way to confirm whether it was
  known before or after the shift it was "predicting").
- The v2 artifact is a **bare `sklearn.Pipeline`** (`preprocessor`
  ColumnTransformer + `model` `XGBRegressor`) with no metadata dict — unlike
  v1, it carries no embedded `target`/`model_type` strings. Its target
  column name (`actual_production_tonnes`, same as v1) was confirmed by the
  artifact's author, not read from the pickle.
- **16 raw input columns**: `pit_id` (4 categories), `shift_type` (3
  categories), 12 numeric operational/environmental fields, plus `month`
  and `day_of_week` engineered server-side from a `timestamp` field (same
  convention as v1). `n_features_in_ == 21` after one-hot expansion (4 + 3 + 14).
- v1 → v2 dropped 17 fields with no replacement invented for them:
  `land_surface_temperature_c`, `pit_productivity_factor`,
  `fleet_health_score`, `excavators_scheduled`, `excavator_downtime_hours`,
  `equipment_maintenance_hours`, `dump_trucks_assigned`,
  `dumper_cycle_time_minutes`, `worker_availability_pct`,
  `blasting_scheduled_flag`, `blasting_delay_hours`,
  `muckpile_volume_available`, `blast_fragmentation_index`,
  `haul_road_condition_index`, `rock_hardness_ucs`,
  `stripping_ratio_current`, `ore_grade_expected_pct`,
  `operational_shock_flag`.
- Risk thresholds changed with the artifact swap: `<10%` Normal, `10–<25%`
  Alert, `≥25%` Critical (v1 was `≤5%`/`≤15%`/`>15%`).
- The rule-based corrective-measures engine (`recommendation_service.py`)
  lost 6 of its 8 rules along with the fields they keyed on (excavator
  downtime, dump-truck ratio, haul-road condition, blasting delay,
  muckpile availability, rock hardness) — removed rather than given
  invented replacement thresholds. Two rules survive: heavy rainfall
  (unchanged) and low worker availability (recomputed from
  `workers_available`/`workers_scheduled`, same 90% threshold as v1).
- Verified end-to-end with a full dummy request → real prediction.

Both schemas are centralized in `app/ml/model1/feature_schema.py` and
`app/ml/model2/feature_schema.py` so the API layer, DB schema, and inference
code all use one source of truth.

### Study-area boundary: a discovered conflict, and how it was resolved

`SIH_Mining_Data/study_boundary.geojson` — the GeoJSON explicitly called out
as "the authoritative study-area boundary" — turned out to be the small OSM
**Bharveli mine lease polygon** (~0.5km × 1km), not the ~9km × 8km rectangle
the existing 850-cell prediction grid (`final_prediction_dataset_850cells.csv`)
actually covers. Using the mine-lease polygon as "the study area" would
reject >99% of the grid cells the database actually has data for.

**Resolution implemented**: `GET /api/study-area` serves the **union of each
300m grid cell's own footprint** (derived at import time in
`scripts/import_prospectivity_data.py`), stored as `study_area_boundary`
row `name='grid_footprint'` — i.e. the boundary that matches what's actually
queryable. The small mine-lease polygon is still imported and stored under
`name='mine_lease'` for reference, but is not what point-in-study-area
validation checks against.

### Spatial match tolerance

Point-to-grid-cell lookups for `/api/prospectivity` use `ST_DWithin` with a
**212.13m** tolerance (`300 × √2 ⁄ 2`) — reusing, not inventing, the exact
"same-cell" threshold the upstream project's own spatial joins were already
validated against (see `SAME_CELL_THRESHOLD_M` in the source data
repository's `ml_preprocessing.py`).

## 2. Version compatibility (important)

`preprocessor.pkl` / the Module 2 pipeline were pickled with
**scikit-learn 1.6.1**. Newer scikit-learn (1.7+) removed an internal class
(`sklearn.compose._column_transformer._RemainderColsList`) that the pickled
`ColumnTransformer` state references, which otherwise breaks unpickling with
an `AttributeError`. Two things are done about this:

1. `requirements.txt` pins `scikit-learn==1.6.1` and `xgboost==2.1.4`
   (confirmed by directly loading both artifacts and running a real
   `predict()` call) — install these on **Python 3.11 or 3.12** (scikit-learn
   1.6.1 has no prebuilt wheel for 3.13/3.14 at time of writing).
2. `Model1Service`/`Model2Service` additionally install a small defensive
   compatibility shim (a one-line list-subclass stand-in for
   `_RemainderColsList`) before loading, guarded by `hasattr` so it's a
   no-op when unnecessary — this was empirically verified against real
   scikit-learn 1.7.2/1.9.0 during development and lets the app tolerate an
   accidental sklearn upgrade without silently producing wrong predictions.

Also: current scikit-learn's `SimpleImputer` rejects boolean-dtype input
outright (`terrain_available` is `bool` in the source data). `Model1Service`
casts it to float before calling `preprocessor.transform()` — values are
unchanged (`True`/`False` → `1.0`/`0.0`), only the dtype changes.

**Do not upgrade `scikit-learn`/`xgboost` in requirements.txt without
re-running the load + `predict()` smoke tests** (`tests/test_model1_service.py`,
`tests/test_model2_service.py`).

## 3. Project structure

```
app/
  main.py                 FastAPI app factory, CORS, startup model loading
  api/                    health, study_area, prospectivity, upload, shortfall, admin
  core/                   config, exceptions, logging, admin security
  db/                     SQLAlchemy engine/session, table definitions
  schemas/                Pydantic request/response models
  services/                business logic (GIS, ML inference, uploads, recs, weather)
  ml/model1/, ml/model2/  centralized, artifact-derived feature schemas
  utils/                  CRS transforms, filename/coordinate validation
models/                   the 4 trained artifacts + model_config.json (yours)
data/                     study_boundary.geojson, final_prediction_dataset_850cells.csv
scripts/                  init_db.py, import_prospectivity_data.py
tests/
```

## 4. Local setup

### Prerequisites
- Python **3.11 or 3.12** (see version-compatibility note above)
- PostgreSQL with PostGIS (or use `docker-compose up db`)

### Install
```bash
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env         # then edit DATABASE_URL / ADMIN_PASSWORD
```

### Database setup
```bash
# Option A: Docker
docker-compose up -d db

# Option B: your own PostgreSQL - just make sure the postgis extension can
# be created (scripts/init_db.py does this for you):
python scripts/init_db.py
python scripts/import_prospectivity_data.py
```
`import_prospectivity_data.py` prints a summary like:
```
Imported: 850
Rejected (invalid coordinates): 0
Rejected (duplicate master_cell_id): 0
Study-area boundary stored as 'grid_footprint'.
```

### Run
```bash
uvicorn app.main:app --reload
```
- Swagger UI: http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

### Model files
Already copied into `models/` by this session:
`xgboost_manganese_model.pkl`, `preprocessor.pkl`, `model_config.json`,
`MOIL_Module2_Final_Model.pkl`, `moil_production_pipeline.pkl`.

## 5. Testing
```bash
pytest -q
```
`test_model1_service.py` / `test_model2_service.py` load the **real**
artifacts and run real predictions (no mocking of ML logic) — they
`pytest.skip()` if the artifacts or a working sklearn/xgboost install aren't
present, rather than silently passing. `test_health.py` needs a working
`psycopg` install (DB driver) to import the app.

## 6. API summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | backend/DB/PostGIS/model status |
| GET | `/api/study-area` | authoritative study-area GeoJSON |
| POST | `/api/prospectivity` | Module 1 prediction, existing study area |
| POST | `/api/upload` | upload GIS files (multipart), returns `upload_id` |
| GET | `/api/upload/{id}` | upload/validation status |
| POST | `/api/upload/{id}/validate` | re-run dataset validation |
| POST | `/api/upload/{id}/prospectivity` | Module 1 prediction from uploaded data |
| POST | `/api/shortfall` | Module 2 prediction + corrective measures |
| GET/DELETE | `/api/admin/*` | admin-only (HTTP Basic) system/upload management |

### Example: existing-study-area prospectivity
```json
POST /api/prospectivity
{"latitude": 21.84, "longitude": 80.23}
```
```json
{
  "success": true,
  "location": {"latitude": 21.84, "longitude": 80.23},
  "prediction": "manganese_present",
  "probability": 0.89,
  "decision_threshold": 0.8,
  "data_source": "existing_study_area",
  "matched_cell_id": "MASTER_..",
  "match_distance_m": 12.4,
  "features_used": ["dist_from_mine_m", "..."]
}
```

### Example: shortfall prediction
```json
POST /api/shortfall
{
  "timestamp": "2026-09-08T06:00:00",
  "shift_type": "Shift_1_Morning",
  "pit_id": "BAL_NORTH_PIT",
  "target_production_tonnes": 5000,
  "planned_operating_hours": 8,
  "workers_scheduled": 50,
  "workers_available": 48,
  "excavators_available": 5,
  "dump_trucks_operational": 10,
  "surface_water_pooling_pct": 0,
  "previous_shift_production_tonnes": 4800,
  "previous_day_production_tonnes": 9600
}
```
`rainfall_intensity_mm`, `cumulative_rainfall_72h`, `soil_moisture_index`
are optional — omit them to have the backend fetch live values from
Open-Meteo (no API key needed) for the pit's coordinates; the response's
`feature_sources` field says which fields came from you vs. the weather API.

## 7. Upload workflow (non-existing study area)

Supported: GeoTIFF (`.tif/.tiff`), Shapefile (`.shp` + `.shx/.dbf/.prj`, or a
`.zip` bundle), CSV, GeoJSON. The backend never assumes an uploaded file has
what Model 1 needs — `GET /api/upload/{id}` returns per-feature
found/missing status (`app/services/feature_service.py`), matching by exact
column/band/filename name first, then a small documented synonym list (e.g.
"elevation"/"dem" → `terrain_elevation`), then searching *other* uploaded
files for a compatible column before giving up — never substituting an
unrelated feature. If required features are still missing when you call
`/api/upload/{id}/prospectivity`, the API returns
`MISSING_REQUIRED_FEATURE` rather than a fabricated prediction.

Realistically: Model 1 needs 111 fairly specific features (multi-band
Sentinel-2/SAR imagery, SoilGrids depth layers, DEM-derived terrain indices,
...) that a generic user upload is very unlikely to fully replicate — the
validation response is what makes that gap visible rather than hidden.

## 8. Admin panel

No end-user accounts exist anywhere in this system (RULE 16). All
`/api/admin/*` routes require HTTP Basic auth against `ADMIN_USERNAME` /
`ADMIN_PASSWORD` (env vars, constant-time compared). Leaving
`ADMIN_PASSWORD` empty disables the admin panel (fails closed).

## 9. Render deployment

```bash
render.yaml   # blueprint: web service (Docker) + managed Postgres
```
- Set `ADMIN_PASSWORD` manually in the Render dashboard (never commit it).
- **PostGIS on Render**: Render's managed Postgres supports the `postgis`
  extension on its standard plans — verify current availability for your
  plan/region at deploy time. If unavailable, point `DATABASE_URL` at any
  other PostgreSQL+PostGIS host (Supabase, Neon, Aiven, or your own
  `postgis/postgis` container) — the app only needs a standard
  `postgresql+psycopg://` URL with the `postgis` extension enabled.
- `scikit-learn`/`xgboost`/`rasterio`/`geopandas` all need matching system
  libs; the provided `Dockerfile` (used by `render.yaml`) is the supported
  deployment path rather than Render's native Python buildpack.
- After first deploy: run `scripts/init_db.py` then
  `scripts/import_prospectivity_data.py` against the production
  `DATABASE_URL` (e.g. via a Render one-off job or shell).

## 10. Known limitations / honest caveats

- Model 1's small labeled set (575 real rows, 55 positives) means the 99.3%
  sanity-check figure above is **not** a held-out accuracy estimate — treat
  the upstream project's own train/val/test split metrics as the real
  performance reference, not this backend's smoke test.
- `surface_water_pooling_pct` has no generic public API and is always a
  required user input for Module 2.
- The upload-based feature matcher is a name/synonym matcher, not a
  semantic understanding of arbitrary GIS layers — see §7.
