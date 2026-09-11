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

// Model 2 v2's actual required feature set (backend/app/schemas/shortfall.py
// ShortfallRequest) - machineryAvailability and blastingRoundsPlanned were
// v1-only fields the new model doesn't use, so they're gone rather than
// kept around unused.
export interface ShortfallOperationalInputs {
  // Workforce
  workersAvailable: number;
  workersScheduled: number;
  // Equipment
  excavatorsAvailable: number;
  dumpTrucksOperational: number;
  plannedOperatingHours: number;
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
    blastingScheduled: string;
    geologicalProfile: string;
  };
  contributingFactors: Array<{
    name: string;
    description: string;
    impactPercent: number;
  }>;
  correctiveMeasures: string[];
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
