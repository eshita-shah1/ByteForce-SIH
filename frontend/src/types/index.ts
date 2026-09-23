export type ViewMode = 
  | 'landing'
  | 'overview' 
  | 'prospectivity' 
  | 'shortfall' 
  | 'account' 
  | 'documents' 
  | 'logs';

export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: string;
  avatarUrl?: string;
}

export interface GISFileItem {
  id: string;
  name: string;
  format: 'tif' | 'shp' | 'csv' | 'geojson';
  category: string;
  size: string;
  uploadedAt: string;
  status: 'ready' | 'validating' | 'uploading' | 'pending';
  progress?: number;
}

export interface ProspectivityResult {
  latitude: number;
  longitude: number;
  confidence: number;
  grade: 'HIGH' | 'MODERATE' | 'LOW';
  formation: string;
  reasoning: string;
  strataDepth: string;
  anomalyIndex: string;
}

// Matches backend/app/ml/model2/feature_schema.py CATEGORICAL_FEATURES exactly.
export type PitId = 'BAL_DEEP_LEVEL_3' | 'BAL_NORTH_PIT' | 'BAL_SOUTH_PIT' | 'UKWA_EXTENSION';
export type ShiftType = 'Shift_1_Morning' | 'Shift_2_Evening' | 'Shift_3_Night';

// Model 2 v2: pit_id/shift_type identify the site - there is no lat/lng
// concept for this model (see backend/app/ml/model2/feature_schema.py).
export interface ShortfallSiteInfo {
  pitId: PitId;
  shiftType: ShiftType;
}

// Model 2 v3's actual required feature set (backend/app/schemas/shortfall.py
// ShortfallRequest, 2026-09-22). equipmentDowntimeHours/dumperCycleTimeMinutes
// are new in v3 - no live source exists for either, always user input, like
// the rest of the Equipment section. humidity_pct/land_surface_temperature_c
// are also new in v3 but are NOT here - both are live-sourced from Open-Meteo
// (see EnvironmentApiResponse), same as rainfall/soil moisture below.
export interface ShortfallOperationalInputs {
  // Workforce
  workersAvailable: number;
  workersScheduled: number;
  // Equipment
  excavatorsAvailable: number;
  dumpTrucksOperational: number;
  plannedOperatingHours: number;
  equipmentDowntimeHours: number;
  dumperCycleTimeMinutes: number;
  // Tonnage
  targetProductionTonnes: number;
  // Environmental / history (no live-source for these - always user input)
  surfaceWaterPoolingPct: number;
  previousShiftProductionTonnes: number;
  previousDayProductionTonnes: number;
}

export interface ShortfallReportData {
  id: string;
  siteName: string;
  coordinates: { lat: number; lng: number };
  computedAgo: string;
  timestamp: string;
  modelVersion: string;
  expectedShortfallPercent: number;
  riskLevel: 'LOW' | 'MODERATE RISK' | 'HIGH RISK';
  targetProductionTonnes: number;
  predictedOutputTonnes: number;
  expectedGapTonnes: number;
  environmental: {
    weatherTemp: string;
    stormRisk: string;
    lightningRisk: string;
  };
  submittedParameters: {
    targetSite: string;
    targetExtraction: string;
    shiftCrewsActive: string;
    haulageFleet: string;
    geologicalProfile: string;
  };
  contributingFactors: Array<{
    name: string;
    description: string;
    impactPercent: number;
  }>;
  correctiveMeasures: string[];
  // Real SHAP TreeExplainer output for this exact prediction (top features
  // by |shapValue|) - null only if the explainer failed to load server-side;
  // never fabricated. See backend/app/services/model2_service.py.
  modelExplanation: Array<{
    feature: string;
    value: number;
    shapValue: number;
    direction: 'increases_prediction' | 'decreases_prediction';
  }> | null;
}

export interface RunLog {
  id: string;
  modelType: 'Prospectivity' | 'Shortfall';
  title: string;
  targetSite: string;
  timestamp: string;
  status: 'Completed' | 'Pending' | 'Flagged';
  metricHighlight: string;
  reportRef?: ShortfallReportData;
}
