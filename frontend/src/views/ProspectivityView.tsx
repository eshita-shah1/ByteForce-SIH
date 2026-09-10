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
  Sparkles,
  ArrowRight,
  FileDown,
  RotateCcw,
  Compass,
  MapPin
} from 'lucide-react';
import { StudyAreaMap } from '../components/prospectivity/StudyAreaMap';
import { BHARVELI_CENTER, isInsideStudyArea, formatCoordinate } from '../utils/geoUtils';
import { useAuth } from '../context/AuthContext';
import { AnimatedNumber } from '../components/core/AnimatedNumber';
import { api, ProspectivityApiResponse } from '../services/api';

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
    recommendations: 'Recommended Exploration Program',
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
    recommendations: 'अनुशंसित अन्वेषण कार्यक्रम',
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
  file: {
    name: string;
    size: string;
  } | null;
  uploadStatus: 'idle' | 'uploading' | 'completed';
}

const INITIAL_GIS_SLOTS: GISSlot[] = [
  {
    format: 'tif',
    label: 'GeoTIFF (.tif)',
    category: 'Elevations & Gravimetrics',
    accept: '.tif,.tiff',
    file: { name: 'surface_elevation_v2.tif', size: '42.4 MB' },
    uploadStatus: 'completed',
  },
  {
    format: 'shp',
    label: 'Shapefile (.shp)',
    category: 'Structural Fault Outlines',
    accept: '.shp,.zip',
    file: { name: 'shatter_fault_lines.shp', size: '12.1 MB' },
    uploadStatus: 'completed',
  },
  {
    format: 'csv',
    label: 'CSV (.csv)',
    category: 'Legacy Core Assay Logs',
    accept: '.csv',
    file: { name: 'drill_assays_1994.csv', size: '8.3 MB' },
    uploadStatus: 'uploading',
  },
  {
    format: 'geojson',
    label: 'GeoJSON (.geojson)',
    category: 'Tenement Boundary Block',
    accept: '.geojson,.json',
    file: null,
    uploadStatus: 'idle',
  },
];

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

  // Tab 2 state: 4 persistent slots (GeoTIFF, Shapefile, CSV, GeoJSON)
  const [currentStep, setCurrentStep] = useState<number>(2); // 1: Upload, 2: Validate, 3: Ready, 4: Predict
  const [gisSlots, setGisSlots] = useState<GISSlot[]>(INITIAL_GIS_SLOTS);
  const [customPredictionReady, setCustomPredictionReady] = useState<boolean>(false);

  // Simulate CSV morphing from uploading to completed on load
  useEffect(() => {
    const timer = setTimeout(() => {
      setGisSlots(prev =>
        prev.map(slot =>
          slot.format === 'csv' && slot.uploadStatus === 'uploading'
            ? { ...slot, uploadStatus: 'completed' }
            : slot
        )
      );
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleTabSwitch = (tab: 'existing' | 'upload') => {
    setActiveTab(tab);
    setShowReport(false);
    if (onSubBreadcrumbChange) {
      onSubBreadcrumbChange(tab === 'existing' ? 'Existing Study Area' : 'Upload GIS Context');
    }
  };

  // Map click handler with point-in-polygon validation
  const handleMapClick = (clickedLat: number, clickedLng: number) => {
    const inside = isInsideStudyArea(clickedLat, clickedLng);
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
    if (!isInsideStudyArea(newLat, lng)) {
      setShowOutsideBoundaryModal(true);
    }
  };

  const adjustLng = (delta: number) => {
    const newLng = parseFloat((lng + delta).toFixed(6));
    setLng(newLng);
    if (!isInsideStudyArea(lat, newLng)) {
      setShowOutsideBoundaryModal(true);
    }
  };

  const handleRunModel = async () => {
    if (!isInsideStudyArea(lat, lng)) {
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
      onSubBreadcrumbChange('Existing Study Area');
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  // Remove ONLY the file from the slot, preserving the card slot!
  const handleRemoveSlotFile = (format: 'tif' | 'shp' | 'csv' | 'geojson') => {
    setGisSlots(prev =>
      prev.map(slot =>
        slot.format === format
          ? { ...slot, file: null, uploadStatus: 'idle' }
          : slot
      )
    );
  };

  // Handle file selection / upload into any slot:
  // Starts with loading spinner, then morphs into green tick after completion
  const handleFileSelect = (format: 'tif' | 'shp' | 'csv' | 'geojson', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const fileSize = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      const fileName = file.name;

      // 1. Immediately set uploading state with file details
      setGisSlots(prev =>
        prev.map(slot =>
          slot.format === format
            ? {
                ...slot,
                file: { name: fileName, size: fileSize },
                uploadStatus: 'uploading',
              }
            : slot
        )
      );

      // 2. After 1.2s, morph loading animation to a tick
      setTimeout(() => {
        setGisSlots(prev =>
          prev.map(slot =>
            slot.format === format
              ? { ...slot, uploadStatus: 'completed' }
              : slot
          )
        );
      }, 1200);
    }
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
                Location: <strong className="text-slate-700">Bharveli & Balaghat Concession Sector</strong> · Target: <span className="font-mono text-slate-700">({result.location.latitude.toFixed(6)}° N, {result.location.longitude.toFixed(6)}° E)</span> · Computed Just now
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
                  Bharveli Deep Mine Block
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
                  <StudyAreaMap
                    selectedCoord={{ lat, lng }}
                    onMapClick={handleMapClick}
                  />
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
                            if (!isInsideStudyArea(val, lng)) {
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
                            if (!isInsideStudyArea(lat, val)) {
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
                    disabled={isCalculating}
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
            /* TAB 2: UPLOAD GIS CONTEXT (4 Persistent Slots with loading-to-tick morph animation) */
            <div className="bg-white rounded-xl border border-slate-200 p-7 shadow-subtle space-y-7">
              {/* Header & Step progress trigger */}
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
                  onClick={() => {
                    if (currentStep < 4) setCurrentStep(prev => prev + 1);
                    if (currentStep === 3) setCustomPredictionReady(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-brand-mint-bg text-brand-forest border border-brand-mint-border text-xs font-semibold hover:bg-brand-mint-bg/80 transition-colors self-start sm:self-auto flex items-center gap-2 cursor-pointer"
                >
                  <span>Validating GIS Layers ({currentStep}/4)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 4-Step Horizontal Progress Bar */}
              <div className="flex items-center justify-between max-w-2xl text-xs font-medium text-slate-600">
                {/* Step 1 */}
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-brand-forest text-white flex items-center justify-center text-xs">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-slate-900">Upload files</span>
                </div>
                <div className={`flex-1 h-0.5 mx-3 ${currentStep >= 2 ? 'bg-brand-forest' : 'bg-slate-200'}`} />

                {/* Step 2 */}
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    currentStep >= 2 ? 'bg-brand-forest text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    2
                  </div>
                  <span className={currentStep >= 2 ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                    Validate layers
                  </span>
                </div>
                <div className={`flex-1 h-0.5 mx-3 ${currentStep >= 3 ? 'bg-brand-forest' : 'bg-slate-200'}`} />

                {/* Step 3 */}
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    currentStep >= 3 ? 'bg-brand-forest text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    3
                  </div>
                  <span className={currentStep >= 3 ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                    Dataset ready
                  </span>
                </div>
                <div className={`flex-1 h-0.5 mx-3 ${currentStep >= 4 ? 'bg-brand-forest' : 'bg-slate-200'}`} />

                {/* Step 4 */}
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                    currentStep >= 4 ? 'bg-brand-forest text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    4
                  </div>
                  <span className={currentStep >= 4 ? 'font-semibold text-slate-900' : 'text-slate-400'}>
                    Predict
                  </span>
                </div>
              </div>

              {/* 4 Persistent File Cards: Remove only removes the file, card always remains! */}
              <div className="space-y-3">
                {gisSlots.map((slot) => {
                  const inputId = `upload-slot-${slot.format}`;
                  const hasFile = !!slot.file;

                  return (
                    <div
                      key={slot.format}
                      className={`p-4 rounded-xl border transition-all ${
                        slot.uploadStatus === 'uploading'
                          ? 'border-brand-mint-border bg-brand-mint-bg/20'
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

                          {slot.uploadStatus === 'uploading' ? (
                            <p className="text-xs text-brand-forest font-medium mt-1 animate-pulse">
                              Uploading {slot.file?.name}...
                            </p>
                          ) : hasFile ? (
                            <p className="text-xs text-slate-600 font-mono mt-1 truncate">
                              {slot.file?.name} ({slot.file?.size})
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

                        {/* Action Column: Remove button + Loading spinner morphing to Tick */}
                        <div className="flex items-center gap-3 shrink-0">
                          {hasFile && slot.uploadStatus === 'completed' && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSlotFile(slot.format)}
                              className="text-xs text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                            >
                              remove
                            </button>
                          )}

                          {/* Loading animation that morphs smoothly into a tick */}
                          <AnimatePresence mode="wait">
                            {slot.uploadStatus === 'uploading' ? (
                              <motion.div
                                key="loading-spinner"
                                initial={{ scale: 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.4, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="w-5 h-5 border-2 border-brand-forest/30 border-t-brand-forest rounded-full animate-spin"
                              />
                            ) : slot.uploadStatus === 'completed' ? (
                              <motion.div
                                key="completed-tick"
                                initial={{ scale: 0, rotate: -45, opacity: 0 }}
                                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                              >
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                              </motion.div>
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

              {/* Custom Prediction Results when step 4 completed */}
              {customPredictionReady && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-5 rounded-xl bg-slate-50 border border-brand-mint-border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-brand-forest uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      Custom Concession Prospectivity Generated
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-600 text-white">
                      <AnimatedNumber value={91} />% CONFIDENCE
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Uploaded layers processed through multi-class classifier. Found primary manganese horizon strike extending 4.2 km along SW shear envelope.
                  </p>
                  <button
                    onClick={() => {
                      setShowReport(true);
                      if (onSubBreadcrumbChange) onSubBreadcrumbChange('Model Prediction Report');
                    }}
                    className="mt-3 px-3.5 py-1.5 rounded-lg bg-brand-forest text-white text-xs font-semibold flex items-center gap-2 cursor-pointer hover:bg-brand-forest-hover"
                  >
                    <span>View Detailed Report</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
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
