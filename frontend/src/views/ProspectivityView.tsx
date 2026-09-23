import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronUp,
  ChevronDown,
  Play,
  CheckCircle2,
  AlertTriangle,
  Upload,
  X,
  ArrowRight,
  FileDown,
  RotateCcw,
  Compass,
  MapPin,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { StudyAreaMap } from '../components/prospectivity/StudyAreaMap';
import { BHARVELI_CENTER, isInsideStudyArea, formatCoordinate, geoJsonToLeafletPositions } from '../utils/geoUtils';
import { useAuth } from '../context/AuthContext';
import { AnimatedNumber } from '../components/core/AnimatedNumber';
import { api, ProspectivityApiResponse, UploadStatusApiResponse } from '../services/api';

const PT = {
  en: {
    title: 'Manganese Prospectivity Analyst',
    subtitle: 'Geostatistical potential mapping & target zone delineation',
    tabExisting: 'Existing Study Area',
    tabUpload: 'Upload GIS Context',
    runModel: 'Run prospectivity model',
    reportTitle: 'Prospectivity Prediction Report',
    exportPdf: 'Export PDF',
    backToMap: 'Back to Map',
    geoContext: 'REGIONAL GEOLOGICAL CONTEXT',
    prospectivityScore: 'PROSPECTIVITY SCORE',
    highProspectivity: 'HIGH PROSPECTIVITY',
    confidence: 'confidence',
    submittedParams: 'Submitted Exploration Parameters',
    contributingFactors: 'Key Contributing Geological Factors',
    contributingFactorsDesc: 'Real SHAP feature contributions from Model 1 for this exact prediction - not a general explanation, specific to the matched location.',
    pushesToward: 'pushes toward manganese present',
    pushesAway: 'pushes away from manganese present',
    explanationUnavailable: 'Model explanation is unavailable for this prediction (the explainer did not produce a result on the server).',
    recommendations: 'Recommended Exploration Program',
    noExplorationMeasures: 'No specific exploration measures were generated from the available validated rules.',
    guidanceTitle: 'Target Sampling Guidance',
    guidanceDesc: 'Click anywhere inside the Bharveli & Balaghat concession polygon on the map or adjust coordinates with the steppers, then run the model to generate a comprehensive prospectivity report.',
    formation: 'Formation',
    estDepth: 'Est. Seam Depth',
    estGrade: 'Est. Ore Grade',
    strippingRatio: 'Stripping Ratio',
    manganesePresent: 'MANGANESE PRESENT',
    manganeseAbsent: 'MANGANESE ABSENT',
    probabilityLabel: 'PROBABILITY',
    thresholdLabel: 'DECISION THRESHOLD',
    matchDistanceLabel: 'MATCH DISTANCE',
    matchedCellLabel: 'MATCHED GRID CELL',
    dataSourceLabel: 'DATA SOURCE',
    featuresUsedLabel: 'MODEL FEATURES USED',
    notAvailable: 'N/A',
    uploadAndValidate: 'Upload & Validate Layers',
    uploading: 'Uploading…',
    checkingValidation: 'Checking validation…',
    selectedNotUploaded: 'Selected — not yet uploaded',
    uploadedLabel: 'Uploaded',
    unreadableLabel: 'Unreadable',
    readyBanner: 'All required Model 1 features are available in your uploaded layers.',
    notReadyBanner: 'Your uploaded layers are missing required features for this prediction.',
    missingFeaturesHeader: 'Missing required features',
    availableFeaturesOf: 'available features found',
    predictLocationTitle: 'Prediction Location',
    predictFromUpload: 'Run prospectivity model on uploaded data',
    predicting: 'Running model…',
  },
  hi: {
    title: 'मैंगनीज संभावना विश्लेषक',
    subtitle: 'भूसांख्यिकीय क्षमता मानचित्रण और लक्ष्य क्षेत्र सीमांकन',
    tabExisting: 'मौजूदा अध्ययन क्षेत्र',
    tabUpload: 'GIS संदर्भ अपलोड करें',
    runModel: 'संभावना मॉडल चलाएं',
    reportTitle: 'संभावना पूर्वानुमान रिपोर्ट',
    exportPdf: 'पीडीएफ निर्यात',
    backToMap: 'मानचित्र पर वापस',
    geoContext: 'क्षेत्रीय भूवैज्ञानिक संदर्भ',
    prospectivityScore: 'संभावना स्कोर',
    highProspectivity: 'उच्च संभावना',
    confidence: 'विश्वसनीयता',
    submittedParams: 'प्रस्तुत अन्वेषण पैरामीटर',
    contributingFactors: 'प्रमुख योगदानकर्ता भूवैज्ञानिक कारक',
    contributingFactorsDesc: 'इस सटीक पूर्वानुमान के लिए मॉडल 1 से वास्तविक SHAP फीचर योगदान - एक सामान्य व्याख्या नहीं, बल्कि मिलान किए गए स्थान के लिए विशिष्ट।',
    pushesToward: 'मैंगनीज उपस्थिति की ओर धकेलता है',
    pushesAway: 'मैंगनीज उपस्थिति से दूर धकेलता है',
    explanationUnavailable: 'इस पूर्वानुमान के लिए मॉडल व्याख्या अनुपलब्ध है (एक्सप्लेनर ने सर्वर पर कोई परिणाम नहीं दिया)।',
    recommendations: 'अनुशंसित अन्वेषण कार्यक्रम',
    noExplorationMeasures: 'उपलब्ध सत्यापित नियमों से कोई विशिष्ट अन्वेषण उपाय उत्पन्न नहीं हुए।',
    guidanceTitle: 'लक्ष्य नमूना मार्गदर्शन',
    guidanceDesc: 'मानचित्र पर भारवेली और बालाघाट रियायत बहुभुज के अंदर कहीं भी क्लिक करें या स्टेपर के साथ निर्देशांक समायोजित करें, फिर व्यापक संभावना रिपोर्ट उत्पन्न करने के लिए मॉडल चलाएं।',
    formation: 'फॉर्मेशन',
    estDepth: 'अनुमानित सीम गहराई',
    estGrade: 'अनुमानित अयस्क ग्रेड',
    strippingRatio: 'स्ट्रिपिंग अनुपात',
    manganesePresent: 'मैंगनीज मौजूद',
    manganeseAbsent: 'मैंगनीज अनुपस्थित',
    probabilityLabel: 'संभाव्यता',
    thresholdLabel: 'निर्णय सीमा',
    matchDistanceLabel: 'मिलान दूरी',
    matchedCellLabel: 'मिलान ग्रिड सेल',
    dataSourceLabel: 'डेटा स्रोत',
    featuresUsedLabel: 'उपयोग की गई मॉडल विशेषताएं',
    notAvailable: 'उपलब्ध नहीं',
    uploadAndValidate: 'अपलोड करें और लेयर सत्यापित करें',
    uploading: 'अपलोड हो रहा है…',
    checkingValidation: 'सत्यापन जांचा जा रहा है…',
    selectedNotUploaded: 'चयनित — अभी तक अपलोड नहीं हुआ',
    uploadedLabel: 'अपलोड हो गया',
    unreadableLabel: 'अपठनीय',
    readyBanner: 'आपकी अपलोड की गई लेयर्स में सभी आवश्यक मॉडल 1 विशेषताएं उपलब्ध हैं।',
    notReadyBanner: 'इस पूर्वानुमान के लिए आपकी अपलोड की गई लेयर्स में आवश्यक विशेषताओं की कमी है।',
    missingFeaturesHeader: 'आवश्यक विशेषताएं गायब हैं',
    availableFeaturesOf: 'उपलब्ध विशेषताएं मिलीं',
    predictLocationTitle: 'पूर्वानुमान स्थान',
    predictFromUpload: 'अपलोड किए गए डेटा पर संभावना मॉडल चलाएं',
    predicting: 'मॉडल चल रहा है…',
  },
} as const;

interface ProspectivityViewProps {
  onSubBreadcrumbChange?: (crumb: string) => void;
}

interface GISSlot {
  format: 'tif' | 'shp' | 'csv' | 'geojson';
  label: string;
  category: string;
  accept: string;
  // The real browser File object, or null until the user picks one. There
  // is no "fake uploaded" state - a file only counts as uploaded once the
  // backend (POST /api/upload) has actually confirmed it.
  file: File | null;
}

const INITIAL_GIS_SLOTS: GISSlot[] = [
  { format: 'tif', label: 'GeoTIFF (.tif)', category: 'Elevations & Gravimetrics', accept: '.tif,.tiff', file: null },
  { format: 'shp', label: 'Shapefile (.shp)', category: 'Structural Fault Outlines', accept: '.shp,.zip', file: null },
  { format: 'csv', label: 'CSV (.csv)', category: 'Legacy Core Assay Logs', accept: '.csv', file: null },
  { format: 'geojson', label: 'GeoJSON (.geojson)', category: 'Tenement Boundary Block', accept: '.geojson,.json', file: null },
];

const formatFileSize = (bytes: number): string => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export const ProspectivityView: React.FC<ProspectivityViewProps> = ({ onSubBreadcrumbChange }) => {
  const { language } = useAuth();
  const pt = PT[language];
  const [activeTab, setActiveTab] = useState<'existing' | 'upload'>('existing');

  // View state: map or full prediction report
  const [showReport, setShowReport] = useState<boolean>(false);

  // Tab 1 state
  const [lat, setLat] = useState<number>(BHARVELI_CENTER[0]);
  const [lng, setLng] = useState<number>(BHARVELI_CENTER[1]);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [showOutsideBoundaryModal, setShowOutsideBoundaryModal] = useState<boolean>(false);
  const [result, setResult] = useState<ProspectivityApiResponse | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  // Tab 2 state: 4 persistent slots (GeoTIFF, Shapefile, CSV, GeoJSON), backed
  // by the real POST /api/upload -> GET /api/upload/{id} -> POST
  // /api/upload/{id}/prospectivity pipeline. No step is ever marked done
  // except in direct response to what the backend actually returned.
  const [gisSlots, setGisSlots] = useState<GISSlot[]>(INITIAL_GIS_SLOTS);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSubmitError, setUploadSubmitError] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [statusCheckError, setStatusCheckError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<UploadStatusApiResponse | null>(null);
  // Prediction location for the upload-based flow - separate from Tab 1's
  // lat/lng so Tab 1's boundary-checked map/steppers are untouched. Reuses
  // the same default center as Tab 1 (BHARVELI_CENTER), same visual pattern.
  const [uploadLat, setUploadLat] = useState<number>(BHARVELI_CENTER[0]);
  const [uploadLng, setUploadLng] = useState<number>(BHARVELI_CENTER[1]);
  const [isPredictingUpload, setIsPredictingUpload] = useState<boolean>(false);
  const [uploadPredictError, setUploadPredictError] = useState<string | null>(null);

  // Real study-area boundary (GET /api/study-area) - drives both the map
  // overlay and the "inside boundary" validation on Tab 1. No hardcoded
  // fallback shape: until this loads (or if it fails), Tab 1's map/inputs
  // are gated rather than validated against a guessed boundary.
  const [studyAreaRings, setStudyAreaRings] = useState<[number, number][][][] | null>(null);
  const [studyAreaError, setStudyAreaError] = useState<string | null>(null);
  const [isLoadingStudyArea, setIsLoadingStudyArea] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await api.getStudyArea();
      if (cancelled) return;
      setIsLoadingStudyArea(false);
      if (!response.ok) {
        setStudyAreaError(response.message);
        return;
      }
      const feature = response.data.features[0];
      if (!feature) {
        setStudyAreaError('The server did not return a study-area boundary.');
        return;
      }
      setStudyAreaRings(geoJsonToLeafletPositions(feature.geometry));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Flattened outer rings for the point-in-polygon check (isInsideStudyArea
  // tests membership against each polygon's outer ring only).
  const studyAreaOuterRings: [number, number][][] = (studyAreaRings ?? []).map((polygon) => polygon[0]);

  const handleTabSwitch = (tab: 'existing' | 'upload') => {
    setActiveTab(tab);
    setShowReport(false);
    if (onSubBreadcrumbChange) {
      onSubBreadcrumbChange(tab === 'existing' ? 'Existing Study Area' : 'Upload GIS Context');
    }
  };

  // Map click handler with point-in-polygon validation
  const handleMapClick = (clickedLat: number, clickedLng: number) => {
    const inside = isInsideStudyArea(clickedLat, clickedLng, studyAreaOuterRings);
    setLat(clickedLat);
    setLng(clickedLng);

    if (!inside) {
      setShowOutsideBoundaryModal(true);
    }
  };

  // Stepper handlers
  const adjustLat = (delta: number) => {
    const newLat = parseFloat((lat + delta).toFixed(6));
    setLat(newLat);
    if (!isInsideStudyArea(newLat, lng, studyAreaOuterRings)) {
      setShowOutsideBoundaryModal(true);
    }
  };

  const adjustLng = (delta: number) => {
    const newLng = parseFloat((lng + delta).toFixed(6));
    setLng(newLng);
    if (!isInsideStudyArea(lat, newLng, studyAreaOuterRings)) {
      setShowOutsideBoundaryModal(true);
    }
  };

  const handleRunModel = async () => {
    if (!isInsideStudyArea(lat, lng, studyAreaOuterRings)) {
      setShowOutsideBoundaryModal(true);
      return;
    }
    setIsCalculating(true);
    setRunError(null);

    const response = await api.runProspectivityModel({ latitude: lat, longitude: lng });

    setIsCalculating(false);
    if (response.ok) {
      setResult(response.data);
      setShowReport(true);
      if (onSubBreadcrumbChange) {
        onSubBreadcrumbChange('Model Prediction Report');
      }
    } else {
      setRunError(response.message);
    }
  };

  const handleBackToMap = () => {
    setShowReport(false);
    if (onSubBreadcrumbChange) {
      // The report is shared between both tabs - point the breadcrumb back
      // at whichever tab actually produced it, not always Tab 1's label.
      onSubBreadcrumbChange(activeTab === 'existing' ? 'Existing Study Area' : 'Upload GIS Context');
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  // Any change to the selected files invalidates a previous upload session -
  // the backend has no "add a file to an existing upload" endpoint, so a new
  // batch must be uploaded fresh.
  const invalidateUploadSession = () => {
    setUploadId(null);
    setUploadStatus(null);
    setStatusCheckError(null);
    setUploadSubmitError(null);
  };

  // Remove ONLY the file from the slot, preserving the card slot!
  const handleRemoveSlotFile = (format: 'tif' | 'shp' | 'csv' | 'geojson') => {
    setGisSlots(prev =>
      prev.map(slot => (slot.format === format ? { ...slot, file: null } : slot))
    );
    invalidateUploadSession();
  };

  // Stage a real File object locally. Nothing is uploaded yet - that only
  // happens when handleUploadAndValidate() actually calls the backend.
  const handleFileSelect = (format: 'tif' | 'shp' | 'csv' | 'geojson', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setGisSlots(prev =>
      prev.map(slot => (slot.format === format ? { ...slot, file } : slot))
    );
    invalidateUploadSession();
  };

  // Uploads every staged file together in ONE batch (the backend requires
  // all files for a session in a single POST /api/upload), then reads back
  // the real validation state via GET /api/upload/{id}. Never advances past
  // what the backend actually confirmed.
  const handleUploadAndValidate = async () => {
    const filesToUpload = gisSlots.filter((slot): slot is GISSlot & { file: File } => slot.file !== null);
    if (filesToUpload.length === 0) return;

    setIsUploading(true);
    setUploadSubmitError(null);
    setUploadStatus(null);
    setUploadId(null);

    const category = filesToUpload.map(slot => slot.category).join(', ');
    const uploadResponse = await api.uploadGISDataset(
      filesToUpload.map(slot => slot.file),
      category
    );

    setIsUploading(false);

    if (!uploadResponse.ok) {
      setUploadSubmitError(uploadResponse.message);
      return;
    }

    setUploadId(uploadResponse.data.upload_id);

    setIsCheckingStatus(true);
    setStatusCheckError(null);
    const statusResponse = await api.getUploadStatus(uploadResponse.data.upload_id);
    setIsCheckingStatus(false);

    if (!statusResponse.ok) {
      setStatusCheckError(statusResponse.message);
      return;
    }
    setUploadStatus(statusResponse.data);
  };

  const handlePredictFromUpload = async () => {
    if (!uploadId) return;

    setIsPredictingUpload(true);
    setUploadPredictError(null);

    const response = await api.runProspectivityModelFromUpload(uploadId, {
      latitude: uploadLat,
      longitude: uploadLng,
    });

    setIsPredictingUpload(false);
    if (response.ok) {
      setResult(response.data);
      setShowReport(true);
      if (onSubBreadcrumbChange) {
        onSubBreadcrumbChange('Model Prediction Report');
      }
    } else {
      setUploadPredictError(response.message);
    }
  };

  const hasSelectedFiles = gisSlots.some(slot => slot.file !== null);
  const isReadyForPrediction = uploadStatus?.validation?.ready_for_prediction ?? false;
  const missingFeatures = uploadStatus?.missing_features ?? [];
  const availableFeatures = uploadStatus?.available_features ?? [];

  const slotValidation = (slot: GISSlot) => {
    if (!slot.file || !uploadStatus?.validation) return null;
    return uploadStatus.validation.files.find(f => f.filename === slot.file!.name) ?? null;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fadeIn print:p-0 print:max-w-none">
      {/* If Report View is active, display the full detailed report screen */}
      {showReport && result ? (
        <div id="printable-report" className="space-y-6 print:space-y-3 print:w-full">
          {/* Print-only professional header branding */}
          <div className="hidden print:flex items-center justify-between pb-2 mb-2 border-b border-slate-300">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-brand-forest flex items-center justify-center text-white">
                <Compass className="w-3.5 h-3.5 text-brand-mint-light" />
              </div>
              <span className="font-extrabold text-sm text-slate-900 tracking-tight">TerraScope</span>
              <span className="text-[10px] text-slate-500 font-mono pl-2 border-l border-slate-300">
                Mining Intelligence Platform
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              Official Technical Assessment Report
            </div>
          </div>

          {/* Header & Action Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5 print:pb-2 print:border-slate-300">
            <div>
              <h1 className="text-2xl print:text-xl font-bold tracking-tight text-slate-900">
                {pt.reportTitle}
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                Location: <strong className="text-slate-700">{result.data_source === 'existing_study_area' ? 'Bharveli & Balaghat Concession Sector' : 'Uploaded GIS Dataset'}</strong> · Target: <span className="font-mono text-slate-700">({result.location.latitude.toFixed(6)}° N, {result.location.longitude.toFixed(6)}° E)</span> · Computed Just now
              </p>
            </div>

            <div className="flex items-center gap-3 print:hidden">
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-slate-500" />
                <span>{pt.exportPdf}</span>
              </button>

              <button
                onClick={handleBackToMap}
                className="px-4 py-2 rounded-lg bg-brand-forest hover:bg-brand-forest-hover text-white text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{pt.backToMap}</span>
              </button>
            </div>
          </div>

          {/* 1. HERO PROSPECTIVITY SCORE CARD (TOP CENTER with massive percentage as main point) */}
          <div className="bg-white rounded-2xl border border-slate-200 print:border-slate-300 p-8 sm:p-10 print:p-4 shadow-subtle flex flex-col items-center text-center relative overflow-hidden break-inside-avoid print:my-1">
            {/* Subtle gradient background accent */}
            <div className="absolute inset-0 bg-gradient-to-b from-emerald-50/40 via-white to-white pointer-events-none" />

            <span className="relative z-10 text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
              {pt.prospectivityScore}
            </span>

            {/* Main Focal Point: Huge Percentage */}
            <div className="relative z-10 flex flex-col items-center my-3 print:my-1">
              <div className="flex items-baseline justify-center gap-3">
                <span className="text-7xl sm:text-8xl md:text-9xl print:text-5xl font-black text-brand-forest tracking-tighter font-mono drop-shadow-xs">
                  <AnimatedNumber value={Math.round(result.probability * 100)} springOptions={{ bounce: 0, duration: 2000 }} />%
                </span>
                <span className="text-base sm:text-lg print:text-sm font-bold text-slate-500 uppercase tracking-wider">
                  {pt.confidence}
                </span>
              </div>

              <span className={`mt-3 print:mt-1 px-4 py-1.5 print:py-0.5 rounded-full text-xs font-bold tracking-wider shadow-xs ${
                result.prediction === 'manganese_present'
                  ? 'bg-brand-mint-bg text-brand-mint-text border border-brand-mint-border'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {result.prediction === 'manganese_present' ? pt.manganesePresent : pt.manganeseAbsent}
              </span>
            </div>

            {/* Real backend result, in plain language - no fabricated geological narrative */}
            <p className="relative z-10 max-w-2xl text-xs sm:text-sm print:text-xs text-slate-600 leading-relaxed mt-3 print:mt-1.5">
              Model 1 predicts <strong className="text-slate-800">{result.prediction === 'manganese_present' ? 'manganese present' : 'manganese absent'}</strong> at this location, with a probability of {(result.probability * 100).toFixed(1)}% against a decision threshold of {(result.decision_threshold * 100).toFixed(1)}%.
              {result.matched_cell_id && (
                <> Matched to study-area grid cell <strong className="text-slate-800">{result.matched_cell_id}</strong>{result.match_distance_m != null ? `, ${result.match_distance_m.toFixed(1)}m away` : ''}.</>
              )}
            </p>

            {/* 3 Key Metrics Row Centered - real Model 1 output, not invented ore-grade/depth/stripping figures */}
            <div className="relative z-10 mt-8 pt-6 print:mt-3 print:pt-3 border-t border-slate-100 print:border-slate-200 grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-4 sm:gap-6 print:gap-3 w-full max-w-2xl text-center">
              <div className="p-3.5 print:p-2 rounded-xl bg-slate-50/80 print:bg-slate-50 border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px] font-semibold uppercase tracking-wider">{pt.probabilityLabel}</span>
                <span className="font-extrabold text-slate-900 font-mono text-base sm:text-lg print:text-sm mt-0.5 block">
                  <AnimatedNumber value={result.probability * 100} decimals={1} />%
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Model 1 output</span>
              </div>
              <div className="p-3.5 print:p-2 rounded-xl bg-slate-50/80 print:bg-slate-50 border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px] font-semibold uppercase tracking-wider">{pt.thresholdLabel}</span>
                <span className="font-extrabold text-emerald-600 font-mono text-base sm:text-lg print:text-sm mt-0.5 block">
                  <AnimatedNumber value={result.decision_threshold * 100} decimals={1} />%
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Present/absent cutoff</span>
              </div>
              <div className="p-3.5 print:p-2 rounded-xl bg-slate-50/80 print:bg-slate-50 border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px] font-semibold uppercase tracking-wider">{pt.matchDistanceLabel}</span>
                <span className="font-extrabold text-slate-900 font-mono text-base sm:text-lg print:text-sm mt-0.5 block">
                  {result.match_distance_m != null ? <><AnimatedNumber value={result.match_distance_m} decimals={1} />m</> : pt.notAvailable}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">To nearest grid cell</span>
              </div>
            </div>
          </div>

          {/* 3. Submitted Exploration Parameters Card */}
          <div className="bg-white p-6 print:p-3.5 rounded-xl border border-slate-200 print:border-slate-300 shadow-subtle space-y-3 print:space-y-1.5 break-inside-avoid print:mt-2">
            <h3 className="text-xs font-bold text-slate-900 tracking-tight mb-2 print:mb-1">
              {pt.submittedParams}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-4 print:gap-2 text-xs">
              <div className="p-3 print:p-2 bg-slate-50/70 rounded-lg border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px]">Target Coordinates</span>
                <span className="font-semibold text-slate-800 font-mono text-xs mt-0.5 block">
                  {result.location.latitude.toFixed(6)}° N, {result.location.longitude.toFixed(6)}° E
                </span>
              </div>
              <div className="p-3 print:p-2 bg-slate-50/70 rounded-lg border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px]">Concession Sector</span>
                <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                  {result.data_source === 'existing_study_area' ? 'Bharveli Deep Mine Block' : 'Uploaded GIS Dataset'}
                </span>
              </div>
              <div className="p-3 print:p-2 bg-slate-50/70 rounded-lg border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px]">Target Mineral</span>
                <span className="font-semibold text-slate-800 font-mono text-xs mt-0.5 block">
                  Manganese (Mn / Braunite)
                </span>
              </div>
              <div className="p-3 print:p-2 bg-slate-50/70 rounded-lg border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px]">{pt.matchedCellLabel}</span>
                <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                  {result.matched_cell_id ?? pt.notAvailable}
                </span>
              </div>
              <div className="p-3 print:p-2 bg-slate-50/70 rounded-lg border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px]">{pt.dataSourceLabel}</span>
                <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                  {result.data_source === 'existing_study_area' ? 'Existing study-area grid' : 'Uploaded dataset'}
                </span>
              </div>
              <div className="p-3 print:p-2 bg-slate-50/70 rounded-lg border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px]">{pt.featuresUsedLabel}</span>
                <span className="font-semibold text-slate-800 font-mono text-xs mt-0.5 block">
                  {result.features_used.length}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Key Contributing Geological Factors - real SHAP output for this
              exact prediction (app/services/model1_service.py). Distinct from a
              general "why this model works" explanation: specific to the
              matched location's actual feature values. */}
          <div className="bg-white p-6 print:p-3.5 rounded-xl border border-slate-200 print:border-slate-300 shadow-subtle space-y-4 print:space-y-1.5 break-inside-avoid print:mt-2">
            <div>
              <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                {pt.contributingFactors}
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                {pt.contributingFactorsDesc}
              </p>
            </div>
            {(result.positive_contributors && result.positive_contributors.length > 0) ||
            (result.negative_contributors && result.negative_contributors.length > 0) ? (
              <div className="divide-y divide-slate-100 print:divide-slate-200">
                {[...(result.positive_contributors ?? []), ...(result.negative_contributors ?? [])].map(
                  (factor, idx) => {
                    const increases = factor.shap_value > 0;
                    return (
                      <div key={idx} className="py-3 print:py-1.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                              increases ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                            }`}
                          >
                            {increases ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800">
                              {factor.label.replace(/_/g, ' ')}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {increases ? pt.pushesToward : pt.pushesAway} · value: {String(factor.input_value)}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`text-xs font-bold font-mono shrink-0 ${
                            increases ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          {increases ? '+' : ''}
                          {factor.shap_value.toFixed(3)}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400">{pt.explanationUnavailable}</p>
            )}
          </div>

          {/* 5. Recommended Exploration Program - intentionally empty unless
              validated exploration rules exist (none do yet - see
              model1_service.py's docstring). Never implies SHAP itself is a
              field recommendation. */}
          <div className="bg-white p-6 print:p-3.5 rounded-xl border border-slate-200 print:border-slate-300 shadow-subtle space-y-3 print:space-y-1.5 break-inside-avoid print:mt-2">
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">
              {pt.recommendations}
            </h3>
            {result.recommended_exploration_measures.length > 0 ? (
              <div className="space-y-3 print:space-y-1.5">
                {result.recommended_exploration_measures.map((measure, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-mint-bg text-brand-forest flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed pt-0.5">{measure}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">{pt.noExplorationMeasures}</p>
            )}
          </div>
        </div>
      ) : (
        /* Standard Map & Setup View */
        <>
          {/* 1. Top Ribbon: Pill-shaped toggle with Framer Motion sliding indicator */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-5">
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {pt.title}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {pt.subtitle}
              </p>
            </div>

            {/* Pill-shaped toggle */}
            <div className="relative bg-slate-100 p-1 rounded-full flex items-center border border-slate-200 shadow-inner">
              <button
                onClick={() => handleTabSwitch('existing')}
                className={`relative z-10 px-5 py-2 text-xs font-semibold rounded-full transition-colors ${
                  activeTab === 'existing' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {pt.tabExisting}
              </button>

              <button
                onClick={() => handleTabSwitch('upload')}
                className={`relative z-10 px-5 py-2 text-xs font-semibold rounded-full transition-colors ${
                  activeTab === 'upload' ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {pt.tabUpload}
              </button>

              {/* Sliding Pill Indicator */}
              <motion.div
                layout
                className="absolute top-1 bottom-1 bg-brand-forest rounded-full shadow-sm"
                initial={false}
                animate={{
                  left: activeTab === 'existing' ? '4px' : 'calc(50% + 2px)',
                  width: 'calc(50% - 6px)'
                }}
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              />
            </div>
          </div>

          {/* 2. Tab Content */}
          {activeTab === 'existing' ? (
            /* TAB 1: EXISTING STUDY AREA */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Interactive Leaflet Map */}
              <div className="lg:col-span-8 bg-white p-4 rounded-xl border border-slate-200 shadow-subtle flex flex-col">
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="font-semibold text-slate-800">
                    Study Concession: Bharveli & Balaghat Manganese Belt
                  </span>
                  <span className="text-slate-500 font-mono text-[11px]">
                    Centroid: 21.805992° N, 80.261628° E
                  </span>
                </div>

                <div className="h-[480px] w-full">
                  {isLoadingStudyArea ? (
                    <div className="w-full h-full min-h-[440px] flex flex-col items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500">
                      <div className="w-6 h-6 border-2 border-brand-forest/30 border-t-brand-forest rounded-full animate-spin" />
                      <p>Loading study-area boundary...</p>
                    </div>
                  ) : studyAreaError || !studyAreaRings ? (
                    <div className="w-full h-full min-h-[440px] flex flex-col items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700 p-6 text-center">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <p className="font-semibold">Unable to load the study-area boundary.</p>
                      <p className="text-red-600">{studyAreaError || 'The server returned no boundary data.'}</p>
                    </div>
                  ) : (
                    <StudyAreaMap
                      selectedCoord={{ lat, lng }}
                      onMapClick={handleMapClick}
                      boundaryPositions={studyAreaRings}
                    />
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  <span>Projection: WGS 84 / UTM Zone 44N (EPSG:32644)</span>
                  <span>MOIL Underground Mine Sector · Madhya Pradesh</span>
                </div>
              </div>

              {/* Right Sidebar: Coordinate Steppers & Guidance Action */}
              <div className="lg:col-span-4 space-y-5">
                {/* Coordinate Target Input Card */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-subtle space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Target Coordinates
                  </h3>

                  {/* Latitude Target */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Latitude Target
                    </label>
                    <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-brand-forest">
                      <input
                        type="number"
                        step="0.001"
                        value={formatCoordinate(lat)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            setLat(val);
                            if (!isInsideStudyArea(val, lng, studyAreaOuterRings)) {
                              setShowOutsideBoundaryModal(true);
                            }
                          }
                        }}
                        className="w-full px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none"
                      />
                      <div className="flex flex-col border-l border-slate-200 divide-y divide-slate-200 bg-slate-50">
                        <button
                          onClick={() => adjustLat(0.005)}
                          className="p-1 hover:bg-slate-200 text-slate-600 transition-colors"
                          title="Step up latitude"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => adjustLat(-0.005)}
                          className="p-1 hover:bg-slate-200 text-slate-600 transition-colors"
                          title="Step down latitude"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Longitude Target */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Longitude Target
                    </label>
                    <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-brand-forest">
                      <input
                        type="number"
                        step="0.001"
                        value={formatCoordinate(lng)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (!isNaN(val)) {
                            setLng(val);
                            if (!isInsideStudyArea(lat, val, studyAreaOuterRings)) {
                              setShowOutsideBoundaryModal(true);
                            }
                          }
                        }}
                        className="w-full px-3 py-2 text-xs font-mono text-slate-800 focus:outline-none"
                      />
                      <div className="flex flex-col border-l border-slate-200 divide-y divide-slate-200 bg-slate-50">
                        <button
                          onClick={() => adjustLng(0.005)}
                          className="p-1 hover:bg-slate-200 text-slate-600 transition-colors"
                          title="Step up longitude"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => adjustLng(-0.005)}
                          className="p-1 hover:bg-slate-200 text-slate-600 transition-colors"
                          title="Step down longitude"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={handleRunModel}
                    disabled={isCalculating || isLoadingStudyArea || !studyAreaRings}
                    className="w-full mt-2 py-2.5 px-4 rounded-lg bg-brand-forest hover:bg-brand-forest-hover text-white text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-75 cursor-pointer"
                  >
                    {isCalculating ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>{pt.runModel}</span>
                      </>
                    )}
                  </button>

                  {runError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                      <span>{runError}</span>
                    </div>
                  )}
                </div>

                {/* Target Sampling Guidance Card (Replaces the removed Telemetry Result card) */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-subtle space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                    <Compass className="w-4 h-4 text-brand-forest" />
                    <span>{pt.guidanceTitle}</span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {pt.guidanceDesc}
                  </p>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-emerald-600" />
                      Bharveli Concession
                    </span>
                    <span>EPSG:32644</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: UPLOAD GIS CONTEXT - real POST /api/upload -> GET /api/upload/{id} ->
               POST /api/upload/{id}/prospectivity pipeline. No step here is ever marked
               done except in direct response to what the backend actually returned. */
            <div className="bg-white rounded-xl border border-slate-200 p-7 shadow-subtle space-y-7">
              {/* Header & Upload trigger */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    New GIS Target Definition
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Provide native GIS layers to initialize the multi-class prospectivity intelligence engine.
                  </p>
                </div>

                <button
                  onClick={handleUploadAndValidate}
                  disabled={!hasSelectedFiles || isUploading || isCheckingStatus}
                  className="px-4 py-2 rounded-lg bg-brand-mint-bg text-brand-forest border border-brand-mint-border text-xs font-semibold hover:bg-brand-mint-bg/80 transition-colors self-start sm:self-auto flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading || isCheckingStatus ? (
                    <div className="w-3.5 h-3.5 border-2 border-brand-forest/30 border-t-brand-forest rounded-full animate-spin" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5" />
                  )}
                  <span>{isUploading ? pt.uploading : isCheckingStatus ? pt.checkingValidation : pt.uploadAndValidate}</span>
                </button>
              </div>

              {(uploadSubmitError || statusCheckError) && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                  <span>{uploadSubmitError || statusCheckError}</span>
                </div>
              )}

              {/* 4-Step Horizontal Progress Bar - each node reflects real backend state */}
              <div className="flex items-center justify-between max-w-2xl text-xs font-medium text-slate-600">
                {/* Step 1: files actually uploaded (real upload_id returned) */}
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    uploadId ? 'bg-brand-forest text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {uploadId ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                  </div>
                  <span className={uploadId ? 'font-semibold text-slate-900' : 'text-slate-400'}>Upload files</span>
                </div>
                <div className={`flex-1 h-0.5 mx-3 ${uploadStatus ? 'bg-brand-forest' : 'bg-slate-200'}`} />

                {/* Step 2: real validation response received */}
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    uploadStatus ? 'bg-brand-forest text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {uploadStatus ? <CheckCircle2 className="w-4 h-4" /> : '2'}
                  </div>
                  <span className={uploadStatus ? 'font-semibold text-slate-900' : 'text-slate-400'}>Validate layers</span>
                </div>
                <div className={`flex-1 h-0.5 mx-3 ${uploadStatus ? (isReadyForPrediction ? 'bg-brand-forest' : 'bg-amber-400') : 'bg-slate-200'}`} />

                {/* Step 3: NOT always green - honestly reflects ready_for_prediction */}
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    !uploadStatus ? 'bg-slate-200 text-slate-600' : isReadyForPrediction ? 'bg-brand-forest text-white' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {uploadStatus ? (isReadyForPrediction ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-3.5 h-3.5" />) : '3'}
                  </div>
                  <span className={!uploadStatus ? 'text-slate-400' : isReadyForPrediction ? 'font-semibold text-slate-900' : 'font-semibold text-amber-700'}>
                    Dataset ready
                  </span>
                </div>
                <div className={`flex-1 h-0.5 mx-3 ${result?.data_source === 'uploaded_dataset' ? 'bg-brand-forest' : 'bg-slate-200'}`} />

                {/* Step 4: a real upload-based prediction actually completed */}
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    result?.data_source === 'uploaded_dataset' ? 'bg-brand-forest text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {result?.data_source === 'uploaded_dataset' ? <CheckCircle2 className="w-4 h-4" /> : '4'}
                  </div>
                  <span className={result?.data_source === 'uploaded_dataset' ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                    Predict
                  </span>
                </div>
              </div>

              {/* 4 Persistent File Cards: Remove only removes the file, card always remains! */}
              <div className="space-y-3">
                {gisSlots.map((slot) => {
                  const inputId = `upload-slot-${slot.format}`;
                  const hasFile = slot.file !== null;
                  const isConfirmedUploaded = hasFile && uploadId !== null && uploadStatus !== null;
                  const validation = slotValidation(slot);
                  const isUnreadable = isConfirmedUploaded && validation !== null && !validation.readable;
                  const isBusy = isUploading && hasFile;

                  return (
                    <div
                      key={slot.format}
                      className={`p-4 rounded-xl border transition-all ${
                        isBusy
                          ? 'border-brand-mint-border bg-brand-mint-bg/20'
                          : isUnreadable
                          ? 'border-red-200 bg-red-50/50'
                          : hasFile
                          ? 'border-slate-200 bg-slate-50/50 hover:bg-slate-50'
                          : 'border-2 border-dashed border-slate-300 hover:border-brand-forest/60 bg-white hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              {slot.label}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              · {slot.category}
                            </span>
                          </div>

                          {isBusy ? (
                            <p className="text-xs text-brand-forest font-medium mt-1 animate-pulse">
                              {pt.uploading} {slot.file?.name}
                            </p>
                          ) : isUnreadable ? (
                            <p className="text-xs text-red-600 font-mono mt-1 truncate">
                              {slot.file?.name} — {validation?.errors[0] ?? pt.unreadableLabel}
                            </p>
                          ) : isConfirmedUploaded ? (
                            <p className="text-xs text-slate-600 font-mono mt-1 truncate">
                              {slot.file?.name} ({formatFileSize(slot.file!.size)}) · {pt.uploadedLabel}
                            </p>
                          ) : hasFile ? (
                            <p className="text-xs text-amber-700 font-mono mt-1 truncate">
                              {slot.file?.name} ({formatFileSize(slot.file!.size)}) · {pt.selectedNotUploaded}
                            </p>
                          ) : (
                            <label
                              htmlFor={inputId}
                              className="text-xs text-slate-500 mt-1 block cursor-pointer"
                            >
                              Drag file here or{' '}
                              <span className="font-semibold text-brand-forest underline hover:text-brand-forest-hover">
                                Browse
                              </span>
                            </label>
                          )}
                        </div>

                        {/* Action Column: Remove button + real status indicator */}
                        <div className="flex items-center gap-3 shrink-0">
                          {hasFile && !isBusy && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSlotFile(slot.format)}
                              className="text-xs text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                            >
                              remove
                            </button>
                          )}

                          <AnimatePresence mode="wait">
                            {isBusy ? (
                              <motion.div
                                key="loading-spinner"
                                initial={{ scale: 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.4, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="w-5 h-5 border-2 border-brand-forest/30 border-t-brand-forest rounded-full animate-spin"
                              />
                            ) : isUnreadable ? (
                              <motion.div
                                key="error-icon"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                              >
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                              </motion.div>
                            ) : isConfirmedUploaded ? (
                              <motion.div
                                key="completed-tick"
                                initial={{ scale: 0, rotate: -45, opacity: 0 }}
                                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                              >
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              </motion.div>
                            ) : hasFile ? (
                              <motion.div
                                key="pending-dot"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="w-2.5 h-2.5 rounded-full bg-amber-500"
                                title={pt.selectedNotUploaded}
                              />
                            ) : (
                              <label
                                htmlFor={inputId}
                                className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:border-brand-forest hover:text-brand-forest transition-colors cursor-pointer"
                              >
                                <Upload className="w-4 h-4" />
                              </label>
                            )}
                          </AnimatePresence>

                          <input
                            id={inputId}
                            type="file"
                            accept={slot.accept}
                            onChange={(e) => handleFileSelect(slot.format, e)}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Real validation summary - shown only once the backend has actually responded */}
              {uploadStatus && (
                <div className={`p-4 rounded-xl border ${isReadyForPrediction ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-start gap-2.5">
                    {isReadyForPrediction ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${isReadyForPrediction ? 'text-emerald-800' : 'text-amber-800'}`}>
                        {isReadyForPrediction ? pt.readyBanner : pt.notReadyBanner}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {availableFeatures.length} {pt.availableFeaturesOf} · {missingFeatures.length} missing (of {availableFeatures.length + missingFeatures.length} required)
                      </p>
                      {uploadStatus.validation?.error_message && (
                        <p className="text-[11px] text-red-600 mt-1">{uploadStatus.validation.error_message}</p>
                      )}
                      {!isReadyForPrediction && missingFeatures.length > 0 && (
                        <div className="mt-2">
                          <span className="text-[11px] font-semibold text-slate-600">{pt.missingFeaturesHeader}:</span>
                          <div className="mt-1.5 max-h-32 overflow-y-auto flex flex-wrap gap-1 pr-1">
                            {missingFeatures.map((feature) => (
                              <span
                                key={feature}
                                className="px-1.5 py-0.5 rounded bg-white border border-amber-200 text-[10px] font-mono text-amber-700"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Prediction location + Predict action - only meaningful once we have a real upload_id */}
              {uploadId && uploadStatus && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-subtle space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{pt.predictLocationTitle}</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Latitude</label>
                      <input
                        type="number"
                        step="any"
                        value={uploadLat}
                        onChange={(e) => setUploadLat(parseFloat(e.target.value))}
                        className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Longitude</label>
                      <input
                        type="number"
                        step="any"
                        value={uploadLng}
                        onChange={(e) => setUploadLng(parseFloat(e.target.value))}
                        className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    onClick={handlePredictFromUpload}
                    disabled={!isReadyForPrediction || isPredictingUpload || !Number.isFinite(uploadLat) || !Number.isFinite(uploadLng)}
                    className="w-full py-2.5 px-4 rounded-lg bg-brand-forest hover:bg-brand-forest-hover text-white text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isPredictingUpload ? (
                      <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>{isPredictingUpload ? pt.predicting : pt.predictFromUpload}</span>
                      </>
                    )}
                  </button>

                  {!isReadyForPrediction && (
                    <p className="text-[11px] text-slate-400">
                      Prediction is disabled until your uploaded layers cover every required Model 1 feature - see the missing-features list above.
                    </p>
                  )}

                  {uploadPredictError && (
                    <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                      <span>{uploadPredictError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* POPUP ERROR MODAL (Outside Boundary) */}
      <AnimatePresence>
        {showOutsideBoundaryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="bg-white max-w-md w-full rounded-xl border border-slate-200 shadow-xl p-6 relative"
            >
              <button
                onClick={() => setShowOutsideBoundaryModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 tracking-tight">
                    Boundary Validation Error
                  </h4>
                  <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                    Location is outside the existing study area. To continue, you must upload GIS context.
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400 font-mono">
                    Target: ({lat.toFixed(4)}, {lng.toFixed(4)}) · Concession: Bharveli & Balaghat
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  onClick={() => {
                    setLat(BHARVELI_CENTER[0]);
                    setLng(BHARVELI_CENTER[1]);
                    setShowOutsideBoundaryModal(false);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Reset Coordinates
                </button>
                <button
                  onClick={() => {
                    setShowOutsideBoundaryModal(false);
                    handleTabSwitch('upload');
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-brand-forest hover:bg-brand-forest-hover rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload GIS Context</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
