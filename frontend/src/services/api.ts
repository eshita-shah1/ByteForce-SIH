import { GISFileItem, RunLog, ShortfallCoordinates, ShortfallOperationalInputs, ShortfallReportData, User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export type LoginResult =
  | { ok: true; user: User }
  | { ok: false; reason: 'invalid_credentials' | 'server_error'; message: string };

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
   * Run Prospectivity Model via backend (POST /api/prospectivity).
   *
   * NOTE: nothing in the current UI calls this yet (ProspectivityView's
   * report is a static mockup) - this corrects the route/payload/response
   * contract so it is ready to use, without redesigning that view's report
   * (which shows many fields - Mn grade, seam depth, stripping ratio,
   * contributing geological factors - that the real backend response
   * doesn't provide).
   */
  async runProspectivityModel(payload: { latitude: number; longitude: number }) {
    try {
      const res = await fetch(`${API_BASE_URL}/prospectivity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Prospectivity model failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend prospectivity endpoint unreachable:', err);
      return null;
    }
  }
};
