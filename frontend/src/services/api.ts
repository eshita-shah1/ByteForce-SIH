import { GISFileItem, RunLog, ShortfallOperationalInputs, ShortfallReportData, ShortfallSiteInfo, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'invalid_credentials' | 'server_error'; message: string };

/** Mirrors backend app/schemas/prospectivity.py's ProspectivityContributor exactly. */
export interface ProspectivityContributor {
  feature: string;
  label: string;
  input_value: number | string | boolean | null;
  shap_value: number;
}

/** Mirrors backend app/schemas/prospectivity_report.py's ProspectivityReportFactor exactly. */
export interface ProspectivityReportFactor {
  feature: string;
  label: string;
  inputValue: number | string | boolean | null;
  shapValue: number;
  direction: 'supporting' | 'limiting';
  explanation: string;
}

/** Mirrors backend app/schemas/prospectivity_report.py's ProspectivityAssessmentSummary exactly. */
export interface ProspectivityAssessmentSummary {
  location: string;
  prospectivity: string;
  predictedClass: string;
  supportingFactors: string;
  limitingFactors: string;
  overallAction: string;
}

/** Mirrors backend app/schemas/prospectivity_report.py's ProspectivityReportData exactly
 * (2026: redesigned technical-assessment report, built from the real prediction/SHAP
 * data above - see app/services/prospectivity_report.py). */
export interface ProspectivityReportData {
  generatedAt: string;
  targetMineral: string;
  prospectivityPercentage: number;
  predictedClassLabel: string;
  narrative: string;
  whyExplanation: string;
  supportingFactors: ProspectivityReportFactor[];
  limitingFactors: ProspectivityReportFactor[];
  explorationPlanIntro: string;
  explorationPlan: string[];
  assessmentSummary: ProspectivityAssessmentSummary;
}

/** Mirrors backend app/schemas/prospectivity.py's ProspectivityResponse exactly
 * (2026: additive Model 1 explainability fields - see model1_service.py). */
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
  // Real SHAP output for this exact prediction - null only if explanation
  // generation failed server-side; never fabricated. Full/raw lists -
  // report.supportingFactors/limitingFactors below are the curated,
  // report-presentation subset of these same two lists.
  positive_contributors: ProspectivityContributor[] | null;
  negative_contributors: ProspectivityContributor[] | null;
  // No validated Model 1 exploration rules exist yet - always [] until some do.
  recommended_exploration_measures: string[];
  // Redesigned report presentation - null only if report-building itself failed.
  report: ProspectivityReportData | null;
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

/** Mirrors backend app/schemas/shortfall_assessment_report.py exactly (snake_case,
 * no camelCase aliasing - unlike ShortfallReportData below, this schema was given
 * an exact key spec to match verbatim). */
export interface ShortfallWhyFactor {
  feature: string;
  label: string;
  value: number;
  shap_contribution: number;
  direction: 'positive' | 'negative';
  explanation: string;
}

export interface ShortfallCorrectiveMeasureItem {
  feature: string;
  label: string;
  value: number;
  shap_contribution: number;
  measure: string;
}

export interface ShortfallAssessmentReport {
  report_type: string;
  production_summary: {
    target_production_tonnes: number;
    predicted_production_tonnes: number;
    shortfall_tonnes: number;
    shortfall_percentage: number;
    risk_level: string;
  };
  why_model_produced_result: {
    title: string;
    factors: ShortfallWhyFactor[];
  };
  recommended_corrective_measures: {
    title: string;
    measures: ShortfallCorrectiveMeasureItem[];
    note: string | null;
  };
}

/** Mirrors backend app/schemas/shortfall.py's ShortfallResponse exactly (v3 model, 2026-09-22). */
export interface ShortfallApiResponse {
  success: boolean;
  pit_id: string;
  shift_type: string;
  target_production_tonnes: number;
  predicted_production_tonnes: number;
  shortfall_tonnes: number;
  shortfall_percentage: number;
  risk: 'Normal' | 'Alert' | 'Critical';
  primary_causes: string[];
  corrective_measures: Array<{ factor: string; severity: string; action: string; reason: string }>;
  feature_sources: Record<string, string>;
  model_version: string;
  shap_explanation: Array<{
    feature: string;
    value: number;
    shap_value: number;
    direction: 'increases_prediction' | 'decreases_prediction';
  }> | null;
  report: ShortfallReportData | null;
  // Detailed "Manganese Production Shortfall Assessment" report - additive,
  // built from this same response's prediction/SHAP data. See
  // backend/app/services/shortfall_assessment_report.py.
  assessment_report: ShortfallAssessmentReport | null;
}

export type ShortfallApiResult =
  | { ok: true; data: ShortfallApiResponse }
  | { ok: false; message: string };

/** Mirrors backend app/schemas/environment.py's EnvironmentResponse exactly.
 * Drives ShortfallView's "Live Environmental Context" bar only - separate
 * from ShortfallApiResponse/the /api/shortfall prediction flow above. */
export interface EnvironmentApiResponse {
  success: boolean;
  pit_id: string;
  latitude: number;
  longitude: number;
  rainfall_intensity_mm: number;
  cumulative_rainfall_72h: number;
  soil_moisture_index: number;
  temperature_celsius: number;
  humidity_pct: number;
  surface_water_risk: string;
  observed_at: string;
  source: string;
}

export type EnvironmentApiResult =
  | { ok: true; data: EnvironmentApiResponse }
  | { ok: false; message: string };

export type UploadStatusResult =
  | { ok: true; data: UploadStatusApiResponse }
  | { ok: false; message: string };

/** Mirrors backend app/api/study_area.py's real GeoJSON response exactly. */
export interface StudyAreaApiResponse {
  success: boolean;
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
    properties: Record<string, unknown>;
  }>;
}

export type StudyAreaApiResult =
  | { ok: true; data: StudyAreaApiResponse }
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
   * Run Shortfall Forecaster Model via backend (POST /api/shortfall) - v3
   * model (2026-09-22). Every field the backend actually requires is now
   * collected by ShortfallView, so this sends the real, complete request
   * (no fields left out, none invented). rainfall_intensity_mm/
   * cumulative_rainfall_72h/soil_moisture_index/humidity_pct/
   * land_surface_temperature_c are intentionally omitted - the backend
   * auto-fetches them from the live weather API when not supplied.
   */
  async runShortfallAssessment(
    site: ShortfallSiteInfo,
    inputs: ShortfallOperationalInputs
  ): Promise<ShortfallApiResult> {
    let res: Response;
    try {
      const payload = {
        timestamp: new Date().toISOString(),
        pit_id: site.pitId,
        shift_type: site.shiftType,
        target_production_tonnes: inputs.targetProductionTonnes,
        planned_operating_hours: inputs.plannedOperatingHours,
        workers_scheduled: inputs.workersScheduled,
        workers_available: inputs.workersAvailable,
        excavators_available: inputs.excavatorsAvailable,
        dump_trucks_operational: inputs.dumpTrucksOperational,
        equipment_downtime_hours: inputs.equipmentDowntimeHours,
        dumper_cycle_time_minutes: inputs.dumperCycleTimeMinutes,
        surface_water_pooling_pct: inputs.surfaceWaterPoolingPct,
        previous_shift_production_tonnes: inputs.previousShiftProductionTonnes,
        previous_day_production_tonnes: inputs.previousDayProductionTonnes,
      };

      res = await fetch(`${API_BASE_URL}/shortfall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Backend shortfall endpoint unreachable:', err);
      return { ok: false, message: 'Unable to reach the server. Please try again.' };
    }

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, message: body?.message || `Server error (${res.status}). Please try again.` };
    }
    return { ok: true, data: body as ShortfallApiResponse };
  },

  /**
   * Fetch live environmental readings for a pit (GET /api/environment/{pitId})
   * - drives ShortfallView's "Live Environmental Context" bar only. Separate
   * from runShortfallAssessment() above: this never affects the prediction,
   * shortfall/risk calculation, or corrective measures - it's a read-only
   * display call backed by the same Open-Meteo integration.
   */
  async getEnvironment(pitId: string): Promise<EnvironmentApiResult> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/environment/${encodeURIComponent(pitId)}`);
    } catch (err) {
      console.error('Backend environment endpoint unreachable:', err);
      return { ok: false, message: 'Unable to reach the server. Please try again.' };
    }

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, message: body?.message || `Server error (${res.status}). Please try again.` };
    }
    return { ok: true, data: body as EnvironmentApiResponse };
  },

  /**
   * Fetch the real study-area boundary (GET /api/study-area) - the actual
   * PostGIS-derived union of the 850-cell grid footprint, not a hand-drawn
   * approximation. Used by ProspectivityView / StudyAreaMap to render the
   * boundary and to validate clicked/entered coordinates.
   */
  async getStudyArea(): Promise<StudyAreaApiResult> {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}/study-area`);
    } catch (err) {
      console.error('Backend study-area endpoint unreachable:', err);
      return { ok: false, message: 'Unable to reach the server. Please try again.' };
    }

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, message: body?.message || `Server error (${res.status}). Please try again.` };
    }
    return { ok: true, data: body as StudyAreaApiResponse };
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
