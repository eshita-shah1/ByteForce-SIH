import { GISFileItem, RunLog, ShortfallCoordinates, ShortfallOperationalInputs, ShortfallReportData, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'invalid_credentials' | 'server_error'; message: string };

/** Mirrors backend app/schemas/prospectivity.py's ProspectivityResponse exactly. */
export interface ProspectivityApiResponse {
  success: boolean;
  location: { latitude: number; longitude: number };
  prediction: 'manganese_present' | 'manganese_absent';
  probability: number;
  decision_threshold: number;
  data_source: 'existing_study_area' | 'uploaded_dataset';
  matched_cell_id: string | null;
  match_distance_m: number | null;
  features_used: string[];
}

export type ProspectivityApiResult =
  | { ok: true; data: ProspectivityApiResponse }
  | { ok: false; message: string };

/** Mirrors backend app/schemas/upload.py's UploadCreateResponse exactly. */
export interface UploadCreateApiResponse {
  success: boolean;
  upload_id: string;
  status: string; // "processing" | "validated" | "failed"
}

/** Mirrors backend app/schemas/upload.py's FileValidationResult exactly. */
export interface UploadFileValidationResult {
  filename: string;
  file_type: string;
  readable: boolean;
  detected_crs: string | null;
  bounds: number[] | null;
  errors: string[];
  warnings: string[];
}

/** Mirrors backend app/schemas/upload.py's FeatureCheck exactly. */
export interface UploadFeatureCheck {
  feature: string;
  found: boolean;
  source_file: string | null;
  source_layer: string | null;
  method: string | null;
  note: string | null;
}

/** Mirrors backend app/schemas/upload.py's DatasetValidationResult exactly. */
export interface UploadDatasetValidationResult {
  upload_id: string;
  status: string;
  files: UploadFileValidationResult[];
  feature_checks: UploadFeatureCheck[];
  available_features: string[];
  missing_features: string[];
  covers_selected_point: boolean | null;
  ready_for_prediction: boolean;
  error_message: string | null;
}

/** Mirrors backend app/schemas/upload.py's UploadStatusResponse exactly. */
export interface UploadStatusApiResponse {
  success: boolean;
  upload_id: string;
  status: string;
  detected_crs: string | null;
  bounds: number[] | null;
  available_features: string[];
  missing_features: string[];
  files: string[];
  validation: UploadDatasetValidationResult | null;
}

export type UploadCreateResult =
  | { ok: true; data: UploadCreateApiResponse }
  | { ok: false; message: string };

export type UploadStatusResult =
  | { ok: true; data: UploadStatusApiResponse }
  | { ok: false; message: string };

export const api = {
  /**
   * User authentication endpoint (POST /api/auth/login). Distinguishes
   * invalid credentials (401) from a genuine backend/network failure, so
   * the caller can fail the login in both cases instead of fabricating a
   * user - see AuthContext.login().
   */
  async login(email: string, pass: string): Promise<LoginResult> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
    } catch (err) {
      console.error('Backend auth endpoint unreachable:', err);
      return { ok: false, reason: 'server_error', message: 'Unable to reach the server. Please try again.' };
    }

    if (res.status === 401) {
      return { ok: false, reason: 'invalid_credentials', message: 'Invalid email or password.' };
    }
    if (!res.ok) {
      return { ok: false, reason: 'server_error', message: `Server error (${res.status}). Please try again.` };
    }

    const data = await res.json();
    return { ok: true, user: data.user as User };
  },

  /**
   * Fetch all model execution logs
   */
  async getLogs(): Promise<RunLog[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/logs`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  /**
   * Fetch GIS document inventory
   */
  async getDocuments(): Promise<GISFileItem[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/documents`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  /**
   * Upload a GIS layer / shapefile / assay log via the real backend upload
   * pipeline (POST /api/upload - a multi-file, validate-on-ingest endpoint;
   * there is no separate /api/documents/upload). The backend only returns
   * {upload_id, status} for the whole batch, not a GISFileItem - so the
   * returned item is built from the real values we already have (the
   * File object, the category the caller passed, the real upload_id/status
   * the backend returned), not invented.
   */
  async uploadDocument(file: File, category: string): Promise<GISFileItem | null> {
    try {
      const formData = new FormData();
      formData.append('files', file);
      formData.append('category', category);

      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();

      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      const format: GISFileItem['format'] =
        ext === 'tif' || ext === 'tiff' ? 'tif' : ext === 'shp' ? 'shp' : ext === 'geojson' || ext === 'json' ? 'geojson' : 'csv';
      const status: GISFileItem['status'] = data.status === 'validated' ? 'ready' : data.status === 'failed' ? 'pending' : 'validating';

      return {
        id: data.upload_id,
        name: file.name,
        format,
        category,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        uploadedAt: new Date().toISOString(),
        status,
      };
    } catch (err) {
      console.error('Document upload failed:', err);
      return null;
    }
  },

  /**
   * Run Shortfall Forecaster Model via backend (POST /api/shortfall).
   *
   * IMPORTANT LIMITATION: the backend's ShortfallRequest requires ~30
   * operational fields (pit_id, shift_type, rock_hardness_ucs,
   * ore_grade_expected_pct, previous_shift_production_tonnes, ...); this
   * view only collects 8. Only the fields below have a real value to send -
   * the rest are genuinely not collected anywhere in this UI, so they are
   * left out rather than filled with invented numbers. That means this call
   * will currently fail validation (422) until the form collects the rest,
   * and the caller's existing client-side fallback (createDefaultShortfallReport
   * in ShortfallView) will keep being used - same visible behavior as
   * before, now for an honest, diagnosable reason instead of a wrong URL.
   */
  async runShortfallAssessment(
    // Unused for now: the backend has no lat/lng concept for shortfall runs
    // (it predicts per pit_id, not per coordinate) - kept in the signature
    // since ShortfallView still collects and passes it.
    _coords: ShortfallCoordinates,
    inputs: ShortfallOperationalInputs
  ): Promise<ShortfallReportData | null> {
    try {
      const payload = {
        timestamp: new Date().toISOString(),
        target_production_tonnes: inputs.expectedTonnage,
        planned_operating_hours: inputs.plannedOperatingHours,
        workers_scheduled: inputs.workersScheduled,
        workers_available: inputs.workersAvailable,
        worker_availability_pct: inputs.workersScheduled > 0 ? (inputs.workersAvailable / inputs.workersScheduled) * 100 : 0,
        excavators_available: inputs.excavatorsAvailable,
        dump_trucks_operational: inputs.dumpTrucksOperational,
        blasting_scheduled_flag: inputs.blastingRoundsPlanned ? 1 : 0,
        // Not collected by this UI, no value to send: shift_type, pit_id,
        // surface_water_pooling_pct, pit_productivity_factor,
        // fleet_health_score, excavators_scheduled, excavator_downtime_hours,
        // equipment_maintenance_hours, dump_trucks_assigned,
        // dumper_cycle_time_minutes, blasting_delay_hours,
        // muckpile_volume_available, blast_fragmentation_index,
        // haul_road_condition_index, rock_hardness_ucs,
        // stripping_ratio_current, ore_grade_expected_pct,
        // operational_shock_flag, previous_shift_production_tonnes,
        // previous_day_production_tonnes.
      };

      const res = await fetch(`${API_BASE_URL}/shortfall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Shortfall model assessment failed');
      const data = await res.json();
      return data.report ?? null;
    } catch (err) {
      console.warn('Backend shortfall endpoint unreachable or rejected the request, using client-side calculation fallback:', err);
      return null;
    }
  },

  /**
   * Run Prospectivity Model via backend (POST /api/prospectivity). Wired
   * into ProspectivityView's "Existing Study Area" tab - see that
   * component for how the real response fields are displayed.
   */
  async runProspectivityModel(payload: { latitude: number; longitude: number }): Promise<ProspectivityApiResult> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/prospectivity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Backend prospectivity endpoint unreachable:', err);
      return { ok: false, message: 'Unable to reach the server. Please try again.' };
    }

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, message: body?.message || `Server error (${res.status}). Please try again.` };
    }
    return { ok: true, data: body as ProspectivityApiResponse };
  },

  /**
   * Uploads every given file as ONE batch (POST /api/upload) - the backend
   * requires all files for an upload session in a single multipart request
   * (files: list[UploadFile]), so this must not be called once per file.
   * Separate from uploadDocument() above (which DocumentsView still uses
   * for its single-file-with-a-real-category flow) - that function is
   * untouched.
   */
  async uploadGISDataset(files: File[], category?: string): Promise<UploadCreateResult> {
    let res: Response;
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      if (category) formData.append('category', category);

      res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });
    } catch (err) {
      console.error('Backend upload endpoint unreachable:', err);
      return { ok: false, message: 'Unable to reach the server. Please try again.' };
    }

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, message: body?.message || `Server error (${res.status}). Please try again.` };
    }
    return { ok: true, data: body as UploadCreateApiResponse };
  },

  /**
   * Reads back an upload session's real validation state (GET
   * /api/upload/{upload_id}) - available/missing Model 1 features and
   * whether the dataset is actually ready_for_prediction, straight from
   * the backend. Never guessed client-side.
   */
  async getUploadStatus(uploadId: string): Promise<UploadStatusResult> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/upload/${encodeURIComponent(uploadId)}`);
    } catch (err) {
      console.error('Backend upload-status endpoint unreachable:', err);
      return { ok: false, message: 'Unable to reach the server. Please try again.' };
    }

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, message: body?.message || `Server error (${res.status}). Please try again.` };
    }
    return { ok: true, data: body as UploadStatusApiResponse };
  },

  /**
   * Run Prospectivity Model against a previously uploaded dataset (POST
   * /api/upload/{upload_id}/prospectivity). Same ProspectivityResponse
   * shape as runProspectivityModel() above (data_source is
   * "uploaded_dataset" instead of "existing_study_area", and
   * matched_cell_id/match_distance_m come back null - there's no grid-cell
   * concept for a point sampled directly from uploaded rasters/vectors).
   */
  async runProspectivityModelFromUpload(uploadId: string, payload: { latitude: number; longitude: number }): Promise<ProspectivityApiResult> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/upload/${encodeURIComponent(uploadId)}/prospectivity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Backend upload-prospectivity endpoint unreachable:', err);
      return { ok: false, message: 'Unable to reach the server. Please try again.' };
    }

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, message: body?.message || `Server error (${res.status}). Please try again.` };
    }
    return { ok: true, data: body as ProspectivityApiResponse };
  }
};
