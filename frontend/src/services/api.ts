import { GISFileItem, RunLog, ShortfallCoordinates, ShortfallOperationalInputs, ShortfallReportData } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const api = {
  /**
   * User authentication endpoint
   */
  async login(email: string, pass: string) {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
      });
      if (!res.ok) throw new Error('Authentication failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend auth endpoint unreachable, operating in offline mode:', err);
      return null;
    }
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
   * Upload a GIS layer / shapefile / assay log
   */
  async uploadDocument(file: File, category: string): Promise<GISFileItem | null> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', category);

      const res = await fetch(`${API_BASE_URL}/documents/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      return await res.json();
    } catch (err) {
      console.error('Document upload failed:', err);
      return null;
    }
  },

  /**
   * Run Shortfall Forecaster Model via backend
   */
  async runShortfallAssessment(
    coords: ShortfallCoordinates, 
    inputs: ShortfallOperationalInputs
  ): Promise<ShortfallReportData | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/shortfall/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coords, inputs }),
      });
      if (!res.ok) throw new Error('Shortfall model assessment failed');
      return await res.json();
    } catch (err) {
      console.warn('Backend shortfall endpoint unreachable, using client-side calculation fallback:', err);
      return null;
    }
  },

  /**
   * Run Prospectivity Model via backend
   */
  async runProspectivityModel(payload: { 
    lat: number; 
    lng: number; 
    layerIds?: string[] 
  }) {
    try {
      const res = await fetch(`${API_BASE_URL}/prospectivity/predict`, {
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
