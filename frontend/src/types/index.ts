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

export interface ShortfallOperationalInputs {
  // Workforce
  workersAvailable: number;
  workersScheduled: number;
  // Equipment
  excavatorsAvailable: number;
  dumpTrucksOperational: number;
  machineryAvailability: number;
  plannedOperatingHours: number;
  // Blasting
  blastingRoundsPlanned?: number;
  // Tonnage
  expectedTonnage: number;
}

export interface ShortfallCoordinates {
  latitude: number;
  longitude: number;
  siteName: string;
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
    waterTableDepth: string;
    waterTableRisk: string;
    haulRoadStatus: string;
    haulRoadSlippage: string;
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
