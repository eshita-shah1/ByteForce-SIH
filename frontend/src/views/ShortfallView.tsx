import React, { useState, useEffect } from 'react';
import {
  Compass,
  ArrowRight,
  Clock,
  CloudRain,
  Droplets,
  Thermometer,
  AlertTriangle,
  FileDown,
  RotateCcw,
  Layers,
  RefreshCw
} from 'lucide-react';
import { api, EnvironmentApiResponse } from '../services/api';
import { PitId, ShiftType, ShortfallOperationalInputs, ShortfallReportData, ShortfallSiteInfo } from '../types';
import { useAuth } from '../context/AuthContext';
import { AnimatedNumber } from '../components/core/AnimatedNumber';

// Live Environmental Context bar refresh interval.
const ENVIRONMENT_REFRESH_MS = 5 * 60 * 1000;

const ST = {
  en: {
    initTitle: 'Initialize Shortfall Model',
    initSubtitle: 'To estimate raw extraction limits and operational logistics bottlenecks, identify the pit and shift you are forecasting for.',
    defineCoords: 'Identify Pit & Shift',
    pitLabel: 'PIT',
    shiftLabel: 'SHIFT',
    continueBtn: 'Continue to Operational Inputs',
    pendingTitle: 'Target Core Models Pending',
    pendingDesc: 'Once the pit and shift are selected, the dashboard reveals environmental telemetry streams and live operational variables.',

    // Screen 2
    backBtn: '← Back to Pit & Shift',
    envContext: 'Live Environmental Context',
    currentRainfall: 'CURRENT RAINFALL',
    rainfall72h: 'RAINFALL (72H)',
    soilMoisture: 'SOIL MOISTURE',
    temperature: 'TEMPERATURE',
    surfaceWater: 'SURFACE WATER',
    envSourceLabel: 'Source: Open-Meteo',
    envObservedLabel: 'Observed',
    envLoadingText: 'Loading…',
    envErrorText: 'Environmental data unavailable',
    envRetryText: 'Retry',
    operationalInputs: 'Operational Inputs',
    workforce: 'WORKFORCE',
    workersAvailable: 'Workers Available (persons)',
    workersScheduled: 'Workers Scheduled (persons)',
    equipment: 'EQUIPMENT',
    excavatorsAvailable: 'Excavators Available (units)',
    dumpTrucksOperational: 'Dump Trucks Operational (units)',
    plannedHours: 'Planned Operating Hours (hrs)',
    environmentalHistory: 'ENVIRONMENTAL & PRODUCTION HISTORY',
    surfaceWaterPoolingPct: 'Surface Water Pooling (%)',
    previousShiftProduction: 'Previous Shift Production (tonnes)',
    previousDayProduction: 'Previous Day Production (tonnes)',
    tonnage: 'TONNAGE',
    expectedTonnage: 'Target Production (tonnes/shift)',
    tonnageHelp: 'Enter a value between 500 and 700 tonnes/shift, the model\'s best-behaved operating range.',
    runAssessment: 'Run shortfall assessment',

    // Screen 3 Report
    reportTitle: 'Shortfall Prediction Report',
    location: 'Location',
    target: 'Target',
    computed: 'Computed',
    exportPdf: 'Export PDF',
    recalculate: 'Recalculate',
    shortfallScore: 'SHORTFALL RISK ASSESSMENT',
    shortfallLabel: 'SHORTFALL',
    synthesisDesc: 'Multi-factor telemetry analysis predicts an operational shortfall driven primarily by wet bench conditions, slippery ramp gradients, and haulage transport velocity bottlenecks. Proactive buffer extraction and shift reallocation recommended.',
    targetExtractionLabel: 'EST. TARGET EXTRACTION',
    predictedOutputLabel: 'EST. PREDICTED OUTPUT',
    expectedGapLabel: 'EST. SHORTFALL GAP',
    plannedQuota: 'Planned Shift Quota',
    modeledExtraction: 'Modeled Telemetry Output',
    deficitGap: 'Estimated Production Deficit',
    tonnes: 'tonnes',
    climate: 'CLIMATE',
    hydrology: 'HYDROLOGY',
    logistics: 'LOGISTICS',
    envContextUpper: 'LIVE ENVIRONMENTAL CONTEXT',
    submittedParams: 'Submitted Operational Parameters',
    targetCoordinates: 'Target Coordinates',
    concessionSector: 'Concession Sector',
    targetSite: 'Target Site',
    targetExtraction: 'Target Extraction',
    shiftCrews: 'Shift Crews Active',
    haulageFleet: 'Haulage Fleet',
    blastingScheduled: 'Blasting Scheduled',
    geologicalProfile: 'Geological Profile',
    contributingFactors: 'Key Contributing Shortfall Factors',
    impact: 'impact',
    correctiveMeasures: 'Recommended Corrective Measures',
  },
  hi: {
    initTitle: 'कमी मॉडल प्रारंभ करें',
    initSubtitle: 'कच्ची निष्कर्षण सीमाओं और परिचालन रसद अड़चनों का अनुमान लगाने के लिए वह खदान और शिफ्ट चुनें जिसके लिए आप पूर्वानुमान लगा रहे हैं।',
    defineCoords: 'खदान और शिफ्ट चुनें',
    pitLabel: 'खदान',
    shiftLabel: 'शिफ्ट',
    continueBtn: 'परिचालन इनपुट पर जारी रखें',
    pendingTitle: 'लक्ष्य कोर मॉडल लंबित',
    pendingDesc: 'खदान और शिफ्ट चुने जाने के बाद, डैशबोर्ड पर्यावरणीय टेलीमेट्री स्ट्रीम और लाइव परिचालन चर प्रदर्शित करता है।',

    // Screen 2
    backBtn: '← खदान और शिफ्ट पर वापस जाएं',
    envContext: 'लाइव पर्यावरण संदर्भ',
    currentRainfall: 'वर्तमान वर्षा',
    rainfall72h: 'वर्षा (72 घंटे)',
    soilMoisture: 'मिट्टी की नमी',
    temperature: 'तापमान',
    surfaceWater: 'सतही जल',
    envSourceLabel: 'स्रोत: Open-Meteo',
    envObservedLabel: 'अवलोकन',
    envLoadingText: 'लोड हो रहा है…',
    envErrorText: 'पर्यावरणीय डेटा अनुपलब्ध है',
    envRetryText: 'पुनः प्रयास करें',
    operationalInputs: 'परिचालन इनपुट',
    workforce: 'कार्यबल',
    workersAvailable: 'उपलब्ध श्रमिक (व्यक्ति)',
    workersScheduled: 'निर्धारित श्रमिक (व्यक्ति)',
    equipment: 'उपकरण',
    excavatorsAvailable: 'उपलब्ध उत्खनक (इकाइयां)',
    dumpTrucksOperational: 'परिचालन डंप ट्रक (इकाइयां)',
    plannedHours: 'नियोजित परिचालन घंटे (घंटे)',
    environmentalHistory: 'पर्यावरणीय और उत्पादन इतिहास',
    surfaceWaterPoolingPct: 'सतही जल जमाव (%)',
    previousShiftProduction: 'पिछली शिफ्ट उत्पादन (टन)',
    previousDayProduction: 'पिछले दिन का उत्पादन (टन)',
    tonnage: 'टन भार',
    expectedTonnage: 'लक्षित उत्पादन (टन/शिफ्ट)',
    tonnageHelp: '500 से 700 टन/शिफ्ट के बीच मान दर्ज करें, जो मॉडल के लिए सबसे उपयुक्त परिचालन सीमा है।',
    runAssessment: 'कमी मूल्यांकन चलाएं',

    // Screen 3 Report
    reportTitle: 'कमी पूर्वानुमान रिपोर्ट',
    location: 'स्थान',
    target: 'लक्ष्य',
    computed: 'गणना',
    exportPdf: 'पीडीएफ निर्यात',
    recalculate: 'पुनर्गणना',
    shortfallScore: 'कमी जोखिम मूल्यांकन',
    shortfallLabel: 'कमी',
    synthesisDesc: 'मल्टी-फैक्टर टेलीमेट्री विश्लेषण गीली बेंच स्थितियों, फिसलन भरे रैंप ढलानों और परिवहन वेग अड़चनों के कारण परिचालन कमी की भविष्यवाणी करता है। सक्रिय बफर निष्कर्षण और शिफ्ट पुनर्वितरण की सिफारिश की जाती है।',
    targetExtractionLabel: 'अनुमानित लक्षित निष्कर्षण',
    predictedOutputLabel: 'अनुमानित आउटपुट',
    expectedGapLabel: 'अनुमानित कमी अंतर',
    plannedQuota: 'नियोजित शिफ्ट कोटा',
    modeledExtraction: 'मॉडल किया गया टेलीमेट्री आउटपुट',
    deficitGap: 'अनुमानित उत्पादन घाटा',
    tonnes: 'टन',
    climate: 'जलवायु',
    hydrology: 'जल विज्ञान',
    logistics: 'रसद',
    envContextUpper: 'लाइव पर्यावरण संदर्भ',
    submittedParams: 'प्रस्तुत परिचालन पैरामीटर',
    targetCoordinates: 'लक्ष्य निर्देशांक',
    concessionSector: 'रियायत क्षेत्र',
    targetSite: 'लक्ष्य स्थल',
    targetExtraction: 'लक्षित निष्कर्षण',
    shiftCrews: 'सक्रिय शिफ्ट दल',
    haulageFleet: 'परिवहन बेड़ा',
    blastingScheduled: 'ब्लास्टिंग निर्धारित',
    geologicalProfile: 'भूवैज्ञानिक प्रोफ़ाइल',
    contributingFactors: 'प्रमुख योगदानकर्ता कमी कारक',
    impact: 'प्रभाव',
    correctiveMeasures: 'अनुशंसित सुधारात्मक उपाय',
  },
} as const;

interface ShortfallViewProps {
  initialReport?: ShortfallReportData;
  onSubBreadcrumbChange?: (crumb: string) => void;
}

// Same fields as ShortfallOperationalInputs, but each starts genuinely empty
// (not a fabricated 0/demo value) until the user types something - a
// controlled <input type="number"> renders '' as blank. Converted back to
// ShortfallOperationalInputs (real numbers only) right before the API call.
type ShortfallFormInputs = { [K in keyof ShortfallOperationalInputs]: number | '' };

const EMPTY_OPERATIONAL_INPUTS: ShortfallFormInputs = {
  workersAvailable: '',
  workersScheduled: '',
  excavatorsAvailable: '',
  dumpTrucksOperational: '',
  plannedOperatingHours: '',
  targetProductionTonnes: '',
  surfaceWaterPoolingPct: '',
  previousShiftProductionTonnes: '',
  previousDayProductionTonnes: '',
};

// '' stays '' (field left empty); anything else is parsed - an invalid/
// unparseable number is also treated as empty rather than silently coerced
// to 0, so clearing a field never reappears as a fake "0".
const parseIntOrEmpty = (raw: string): number | '' => {
  if (raw === '') return '';
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? '' : n;
};

const parseFloatOrEmpty = (raw: string): number | '' => {
  if (raw === '') return '';
  const n = parseFloat(raw);
  return Number.isNaN(n) ? '' : n;
};

// True only once every operational field has a real user-entered number -
// the guard the "Run assessment" submit checks before ever calling the API.
function toOperationalInputs(form: ShortfallFormInputs): ShortfallOperationalInputs | null {
  for (const value of Object.values(form)) {
    if (value === '') return null;
  }
  return form as ShortfallOperationalInputs;
}

// Formats the backend's real observation timestamp for display. The
// backend (weather_service.py) sends an offset-aware ISO-8601 string,
// e.g. "2026-09-11T23:00:00+05:30" - the pit's own local wall-clock time,
// with Open-Meteo's own resolved UTC offset attached so the string is
// unambiguous on its own.
//
// This deliberately does NOT go through `new Date(iso)` +
// `toLocaleTimeString()`: that pair re-expresses the instant in the
// BROWSER's timezone, which only coincidentally matches the pit's "23:00"
// digits when the viewer's browser happens to share the pit's UTC offset
// - a real bug for anyone viewing from a different timezone. The pit's
// own observation hour is instead read directly off the string's local
// time component, so it's correct regardless of the viewer's timezone.
// No IANA zone name (e.g. "Asia/Kolkata") is hardcoded anywhere here -
// the offset always comes from what the backend actually resolved for
// the selected pit.
function formatObservedAt(iso: string): string {
  const match = iso.match(/T(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]}`;

  // Defensive fallback only - not the expected path given the backend
  // contract above. Never silently show nothing.
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export const ShortfallView: React.FC<ShortfallViewProps> = ({ 
  initialReport,
  onSubBreadcrumbChange 
}) => {
  const { language } = useAuth();
  const st = ST[language];
  // Step in workflow: 1 = coordinates, 2 = operational inputs, 3 = report
  const [step, setStep] = useState<'coords' | 'inputs' | 'report'>(initialReport ? 'report' : 'coords');

  // Pit + shift identify the site - this model has no lat/lng concept.
  const [site, setSite] = useState<ShortfallSiteInfo>({
    pitId: 'BAL_NORTH_PIT',
    shiftType: 'Shift_1_Morning',
  });

  // Operational inputs - exactly the fields backend/app/schemas/shortfall.py's
  // ShortfallRequest actually requires (see types/index.ts). Starts genuinely
  // empty - no demo/dummy numbers - the user must enter every value before
  // "Run shortfall assessment" is allowed to submit.
  const [inputs, setInputs] = useState<ShortfallFormInputs>(EMPTY_OPERATIONAL_INPUTS);

  // Live Environmental Context bar (GET /api/environment/{pitId}) - fully
  // separate from the shortfall prediction flow below. No fabricated
  // default: starts empty, only ever populated from a real backend
  // response.
  const [envData, setEnvData] = useState<EnvironmentApiResponse | null>(null);
  const [envLoading, setEnvLoading] = useState<boolean>(true);
  const [envError, setEnvError] = useState<string | null>(null);

  // Single fetch implementation, used by both the auto-fetch/polling effect
  // below and the manual "Refresh" button. `cancelled` guards against a
  // slow in-flight response (e.g. for a since-changed pit) overwriting
  // state after a newer request has already resolved.
  const fetchEnvironment = async (pitId: PitId, cancelledRef?: { current: boolean }) => {
    setEnvLoading(true);
    setEnvError(null);
    const result = await api.getEnvironment(pitId);
    if (cancelledRef?.current) return;
    setEnvLoading(false);
    if (result.ok) {
      setEnvData(result.data);
    } else {
      // Never keep showing the previous pit's readings on failure, and
      // never substitute a fake value - the UI must show "unavailable".
      setEnvData(null);
      setEnvError(result.message);
    }
  };

  // Fetches on entering the Operational Inputs screen, re-fetches whenever
  // the selected pit changes (never displays a stale/wrong pit's data),
  // and polls every 5 minutes while this screen is active. One interval
  // at a time - the cleanup function clears it before any re-run/unmount.
  useEffect(() => {
    if (step !== 'inputs') return;
    const cancelledRef = { current: false };

    fetchEnvironment(site.pitId, cancelledRef);
    const intervalId = setInterval(() => fetchEnvironment(site.pitId, cancelledRef), ENVIRONMENT_REFRESH_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, site.pitId]);

  // No client-side fake report generator: with every required field now
  // genuinely collected, a failed call means something real went wrong -
  // that should surface as an error, not a silently fabricated forecast.
  const [report, setReport] = useState<ShortfallReportData | null>(initialReport ?? null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [runError, setRunError] = useState<string | null>(null);

  const formatCoords = (lat: number, lng: number) => {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
  };

  const handleCoordsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('inputs');
    if (onSubBreadcrumbChange) onSubBreadcrumbChange('Operational Inputs');
  };

  const handleRunAssessment = async (e: React.FormEvent) => {
    e.preventDefault();

    // Backstop behind the inputs' own `required` HTML attributes (which
    // already block the browser from submitting while any is empty): never
    // send a request built from a partially-empty form.
    const operationalInputs = toOperationalInputs(inputs);
    if (!operationalInputs) {
      setRunError('Please fill in all required operational fields before running the assessment.');
      return;
    }

    setIsEvaluating(true);
    setRunError(null);

    const result = await api.runShortfallAssessment(site, operationalInputs);

    setIsEvaluating(false);
    if (result.ok && result.data.report) {
      setReport(result.data.report);
      setStep('report');
      if (onSubBreadcrumbChange) onSubBreadcrumbChange('Model Prediction Report');
    } else {
      setRunError(result.ok ? 'The backend did not return a report for this prediction.' : result.message);
    }
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleRecalculate = () => {
    setStep('inputs');
    if (onSubBreadcrumbChange) onSubBreadcrumbChange('Operational Inputs');
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fadeIn print:p-0 print:max-w-none">
      {/* SCREEN 1: INITIALIZE SHORTFALL MODEL */}
      {step === 'coords' && (
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {st.initTitle}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              {st.initSubtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Left Card: Define Project Coordinates */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-subtle flex flex-col justify-between">
              <form onSubmit={handleCoordsSubmit} className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {st.defineCoords}
                </h3>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {st.pitLabel}
                  </label>
                  <select
                    required
                    value={site.pitId}
                    onChange={(e) => setSite({ ...site, pitId: e.target.value as PitId })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none bg-white"
                  >
                    <option value="BAL_DEEP_LEVEL_3">BAL Deep Level 3</option>
                    <option value="BAL_NORTH_PIT">BAL North Pit</option>
                    <option value="BAL_SOUTH_PIT">BAL South Pit</option>
                    <option value="UKWA_EXTENSION">UKWA Extension</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {st.shiftLabel}
                  </label>
                  <select
                    required
                    value={site.shiftType}
                    onChange={(e) => setSite({ ...site, shiftType: e.target.value as ShiftType })}
                    className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none bg-white"
                  >
                    <option value="Shift_1_Morning">Shift 1 — Morning</option>
                    <option value="Shift_2_Evening">Shift 2 — Evening</option>
                    <option value="Shift_3_Night">Shift 3 — Night</option>
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-lg bg-brand-forest hover:bg-brand-forest-hover text-white text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
                  >
                    <span>{st.continueBtn}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>

            {/* Right Card: Target Core Models Pending */}
            <div className="bg-white rounded-xl border border-slate-200 border-dashed p-8 shadow-subtle flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-brand-mint-bg flex items-center justify-center text-brand-forest mb-4">
                <Compass className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 tracking-tight">
                {st.pendingTitle}
              </h4>
              <p className="mt-2 text-xs text-slate-500 max-w-xs leading-relaxed">
                {st.pendingDesc}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SCREEN 2: OPERATIONAL INPUTS */}
      {step === 'inputs' && (
        <div className="space-y-6">
          {/* Back button */}
          <button
            type="button"
            onClick={() => {
              setStep('coords');
              if (onSubBreadcrumbChange) onSubBreadcrumbChange('New Forecast');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 5-7 7 7 7"/></svg>
            {st.backBtn}
          </button>

          {/* Live Environmental Context Bar - GET /api/environment/{pitId},
              real Open-Meteo data via the same weather_service.py the
              shortfall prediction itself uses. No fabricated fallback: on
              error, every metric shows "unavailable", never a stale or
              invented number. */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-subtle space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    envError ? 'bg-red-500' : envLoading ? 'bg-slate-300' : 'bg-emerald-500 animate-pulse'
                  }`}
                ></span>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {st.envContext}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>
                    {envData ? formatObservedAt(envData.observed_at) : envLoading ? st.envLoadingText : '—'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => fetchEnvironment(site.pitId)}
                  disabled={envLoading}
                  title={st.envRetryText}
                  className="p-1 rounded-md text-slate-400 hover:text-brand-forest hover:bg-brand-mint-bg/50 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${envLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Environmental Metric Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                  <CloudRain className="w-3 h-3 text-brand-forest" />
                  <span>{st.currentRainfall}</span>
                </div>
                <span className="text-base font-bold text-slate-900 font-mono">
                  {envData ? (
                    <><AnimatedNumber value={envData.rainfall_intensity_mm} decimals={1} />mm</>
                  ) : (
                    <span className="text-slate-400 text-xs font-sans">{envLoading ? st.envLoadingText : '—'}</span>
                  )}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                  <Droplets className="w-3 h-3 text-brand-forest" />
                  <span>{st.rainfall72h}</span>
                </div>
                <span className="text-base font-bold text-slate-900 font-mono">
                  {envData ? (
                    <><AnimatedNumber value={envData.cumulative_rainfall_72h} decimals={1} />mm</>
                  ) : (
                    <span className="text-slate-400 text-xs font-sans">{envLoading ? st.envLoadingText : '—'}</span>
                  )}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                  <Layers className="w-3 h-3 text-brand-forest" />
                  <span>{st.soilMoisture}</span>
                </div>
                <span className="text-base font-bold text-slate-900 font-mono">
                  {envData ? (
                    <><AnimatedNumber value={envData.soil_moisture_index} decimals={2} /></>
                  ) : (
                    <span className="text-slate-400 text-xs font-sans">{envLoading ? st.envLoadingText : '—'}</span>
                  )}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                  <Thermometer className="w-3 h-3 text-brand-forest" />
                  <span>{st.temperature}</span>
                </div>
                <span className="text-base font-bold text-slate-900 font-mono">
                  {envData ? (
                    <><AnimatedNumber value={envData.temperature_celsius} decimals={1} />°C</>
                  ) : (
                    <span className="text-slate-400 text-xs font-sans">{envLoading ? st.envLoadingText : '—'}</span>
                  )}
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  <span>{st.surfaceWater}</span>
                </div>
                <span className="text-xs font-bold text-slate-800 leading-tight block">
                  {envData ? envData.surface_water_risk : envLoading ? st.envLoadingText : '—'}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between gap-2">
              {envError ? (
                <span className="text-red-600 flex items-center gap-2">
                  {st.envErrorText}
                  <button
                    type="button"
                    onClick={() => fetchEnvironment(site.pitId)}
                    className="underline hover:text-red-700 cursor-pointer"
                  >
                    {st.envRetryText}
                  </button>
                </span>
              ) : envData ? (
                <span>
                  {st.envSourceLabel} · {st.envObservedLabel} {formatObservedAt(envData.observed_at)}
                </span>
              ) : (
                <span>{st.envLoadingText}</span>
              )}
            </div>
          </div>

          {/* Operational Inputs Form */}
          <div className="bg-white rounded-xl border border-slate-200 p-7 shadow-subtle">
            <form onSubmit={handleRunAssessment} className="space-y-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {st.operationalInputs}
              </h2>

              {/* 1. WORKFORCE SECTION */}
              <div>
                <h3 className="text-xs font-bold text-slate-900 mb-3 tracking-wide">
                  {st.workforce}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {st.workersAvailable}
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={inputs.workersAvailable}
                      onChange={(e) => setInputs({ ...inputs, workersAvailable: parseIntOrEmpty(e.target.value) })}
                      className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {st.workersScheduled}
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={inputs.workersScheduled}
                      onChange={(e) => setInputs({ ...inputs, workersScheduled: parseIntOrEmpty(e.target.value) })}
                      className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 2. EQUIPMENT SECTION */}
              <div>
                <h3 className="text-xs font-bold text-slate-900 mb-3 tracking-wide">
                  {st.equipment}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {st.excavatorsAvailable}
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={inputs.excavatorsAvailable}
                      onChange={(e) => setInputs({ ...inputs, excavatorsAvailable: parseIntOrEmpty(e.target.value) })}
                      className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {st.dumpTrucksOperational}
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={inputs.dumpTrucksOperational}
                      onChange={(e) => setInputs({ ...inputs, dumpTrucksOperational: parseIntOrEmpty(e.target.value) })}
                      className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {st.plannedHours}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      required
                      value={inputs.plannedOperatingHours}
                      onChange={(e) => setInputs({ ...inputs, plannedOperatingHours: parseIntOrEmpty(e.target.value) })}
                      className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">0–24</span>
                  </div>
                </div>
              </div>

              {/* 3. ENVIRONMENTAL & PRODUCTION HISTORY SECTION - no live source
                  for these, so real user inputs (not fabricated defaults) */}
              <div>
                <h3 className="text-xs font-bold text-slate-900 mb-3 tracking-wide">
                  {st.environmentalHistory}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {st.surfaceWaterPoolingPct}
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={100}
                      value={inputs.surfaceWaterPoolingPct}
                      onChange={(e) => setInputs({ ...inputs, surfaceWaterPoolingPct: parseFloatOrEmpty(e.target.value) })}
                      className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {st.previousShiftProduction}
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={200}
                      value={inputs.previousShiftProductionTonnes}
                      onChange={(e) => setInputs({ ...inputs, previousShiftProductionTonnes: parseFloatOrEmpty(e.target.value) })}
                      className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      {st.previousDayProduction}
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={600}
                      value={inputs.previousDayProductionTonnes}
                      onChange={(e) => setInputs({ ...inputs, previousDayProductionTonnes: parseFloatOrEmpty(e.target.value) })}
                      className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 4. TONNAGE SECTION */}
              <div>
                <h3 className="text-xs font-bold text-slate-900 mb-3 tracking-wide">
                  {st.tonnage}
                </h3>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {st.expectedTonnage}
                </label>
                <input
                  type="number"
                  required
                  min={500}
                  max={700}
                  value={inputs.targetProductionTonnes}
                  onChange={(e) => setInputs({ ...inputs, targetProductionTonnes: parseIntOrEmpty(e.target.value) })}
                  className="w-full max-w-xs px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">{st.tonnageHelp}</span>
              </div>

              {runError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
                  <span>{runError}</span>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isEvaluating}
                  className="w-full py-3 px-4 rounded-lg bg-brand-forest hover:bg-brand-forest-hover text-white text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-75 cursor-pointer"
                >
                  {isEvaluating ? (
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>{st.runAssessment}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SCREEN 3: SHORTFALL PREDICTION REPORT */}
      {step === 'report' && report && (
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

          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5 print:pb-2 print:border-slate-300">
            <div>
              <h1 className="text-2xl print:text-xl font-bold tracking-tight text-slate-900">
                {st.reportTitle}
              </h1>
              <p className="mt-1 text-xs text-slate-500">
                {st.location}: <strong className="text-slate-700">{report.siteName}</strong> · {st.target}: ({formatCoords(report.coordinates.lat, report.coordinates.lng)}) · {st.computed} {report.computedAgo || 'Just now'}
              </p>
            </div>

            <div className="flex items-center gap-3 print:hidden">
              <button
                onClick={handleExportPDF}
                className="px-4 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5 text-slate-500" />
                <span>{st.exportPdf}</span>
              </button>

              <button
                onClick={handleRecalculate}
                className="px-4 py-2 rounded-lg bg-brand-forest hover:bg-brand-forest-hover text-white text-xs font-semibold tracking-wide transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{st.recalculate}</span>
              </button>
            </div>
          </div>

          {/* 1. HERO SHORTFALL RISK SCORE CARD (TOP CENTER with massive percentage as main point) */}
          <div className="bg-white rounded-2xl border border-slate-200 print:border-slate-300 p-8 sm:p-10 print:p-4 shadow-subtle flex flex-col items-center text-center relative overflow-hidden break-inside-avoid print:my-1">
            {/* Subtle gradient background accent */}
            <div className="absolute inset-0 bg-gradient-to-b from-rose-50/30 via-white to-white pointer-events-none" />

            <span className="relative z-10 text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
              {st.shortfallScore}
            </span>

            {/* Main Focal Point: Huge Percentage */}
            <div className="relative z-10 flex flex-col items-center my-3 print:my-1">
              <div className="flex items-baseline justify-center gap-3">
                <span className="text-7xl sm:text-8xl md:text-9xl print:text-5xl font-black text-rose-600 tracking-tighter font-mono drop-shadow-xs">
                  <AnimatedNumber value={report.expectedShortfallPercent} springOptions={{ bounce: 0, duration: 2000 }} />%
                </span>
                <span className="text-base sm:text-lg print:text-sm font-bold text-slate-500 uppercase tracking-wider">
                  {st.shortfallLabel}
                </span>
              </div>

              <span className="mt-3 print:mt-1 px-4 py-1.5 print:py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 tracking-wider shadow-xs uppercase">
                {report.riskLevel}
              </span>
            </div>

            {/* Technical Synthesis Description Centered */}
            <p className="relative z-10 max-w-2xl text-xs sm:text-sm print:text-xs text-slate-600 leading-relaxed mt-3 print:mt-1.5">
              {st.synthesisDesc}
            </p>

            {/* 3 Key Metrics Row Centered */}
            <div className="relative z-10 mt-8 pt-6 print:mt-3 print:pt-3 border-t border-slate-100 print:border-slate-200 grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-4 sm:gap-6 print:gap-3 w-full max-w-2xl text-center">
              <div className="p-3.5 print:p-2 rounded-xl bg-slate-50/80 print:bg-slate-50 border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px] font-semibold uppercase tracking-wider">{st.targetExtractionLabel}</span>
                <span className="font-extrabold text-slate-900 font-mono text-base sm:text-lg print:text-sm mt-0.5 block">
                  <AnimatedNumber value={report.targetProductionTonnes} /> {st.tonnes}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{st.plannedQuota}</span>
              </div>
              <div className="p-3.5 print:p-2 rounded-xl bg-slate-50/80 print:bg-slate-50 border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px] font-semibold uppercase tracking-wider">{st.predictedOutputLabel}</span>
                <span className="font-extrabold text-emerald-600 font-mono text-base sm:text-lg print:text-sm mt-0.5 block">
                  <AnimatedNumber value={report.predictedOutputTonnes} /> {st.tonnes}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{st.modeledExtraction}</span>
              </div>
              <div className="p-3.5 print:p-2 rounded-xl bg-slate-50/80 print:bg-slate-50 border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px] font-semibold uppercase tracking-wider">{st.expectedGapLabel}</span>
                <span className="font-extrabold text-rose-600 font-mono text-base sm:text-lg print:text-sm mt-0.5 block">
                  {report.expectedGapTonnes < 0 ? '-' : ''}<AnimatedNumber value={Math.abs(report.expectedGapTonnes)} /> {st.tonnes}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">{st.deficitGap}</span>
              </div>
            </div>
          </div>

          {/* 2. Live Environmental Context (3 cards) */}
          <div className="break-inside-avoid print:mt-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 print:mb-1.5">
              {st.envContextUpper}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-4 print:gap-3">
              {/* Climate */}
              <div className="bg-white p-4 print:p-2.5 rounded-xl border border-slate-200 print:border-slate-300 shadow-subtle break-inside-avoid">
                <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {st.climate}
                </span>
                <h4 className="mt-2 text-xs font-bold text-slate-900">
                  {report.environmental.weatherTemp}
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  {report.environmental.stormRisk}
                </p>
              </div>

              {/* Hydrology */}
              <div className="bg-white p-4 print:p-2.5 rounded-xl border border-slate-200 print:border-slate-300 shadow-subtle break-inside-avoid">
                <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {st.hydrology}
                </span>
                <h4 className="mt-2 text-xs font-bold text-slate-900">
                  {report.environmental.waterTableDepth}
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  {report.environmental.waterTableRisk}
                </p>
              </div>

              {/* Logistics */}
              <div className="bg-white p-4 print:p-2.5 rounded-xl border border-slate-200 print:border-slate-300 shadow-subtle break-inside-avoid">
                <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  {st.logistics}
                </span>
                <h4 className="mt-2 text-xs font-bold text-slate-900">
                  {report.environmental.haulRoadStatus}
                </h4>
                <p className="mt-1 text-xs text-slate-500">
                  {report.environmental.haulRoadSlippage}
                </p>
              </div>
            </div>
          </div>

          {/* 3. Submitted Operational Parameters Card */}
          <div className="bg-white p-6 print:p-3.5 rounded-xl border border-slate-200 print:border-slate-300 shadow-subtle space-y-3 print:space-y-1.5 break-inside-avoid print:mt-2">
            <h3 className="text-xs font-bold text-slate-900 tracking-tight mb-2 print:mb-1">
              {st.submittedParams}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 print:grid-cols-3 gap-4 print:gap-2 text-xs">
              <div className="p-3 print:p-2 bg-slate-50/70 rounded-lg border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px]">{st.targetCoordinates}</span>
                <span className="font-semibold text-slate-800 font-mono text-xs mt-0.5 block">
                  {formatCoords(report.coordinates.lat, report.coordinates.lng)}
                </span>
              </div>
              <div className="p-3 print:p-2 bg-slate-50/70 rounded-lg border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px]">{st.concessionSector}</span>
                <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                  {report.submittedParameters.targetSite}
                </span>
              </div>
              <div className="p-3 print:p-2 bg-slate-50/70 rounded-lg border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px]">{st.targetExtraction}</span>
                <span className="font-semibold text-slate-800 font-mono text-xs mt-0.5 block">
                  {report.submittedParameters.targetExtraction}
                </span>
              </div>
              <div className="p-3 print:p-2 bg-slate-50/70 rounded-lg border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px]">{st.shiftCrews}</span>
                <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                  {report.submittedParameters.shiftCrewsActive}
                </span>
              </div>
              <div className="p-3 print:p-2 bg-slate-50/70 rounded-lg border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px]">{st.haulageFleet}</span>
                <span className="font-semibold text-slate-800 text-xs mt-0.5 block">
                  {report.submittedParameters.haulageFleet}
                </span>
              </div>
              <div className="p-3 print:p-2 bg-slate-50/70 rounded-lg border border-slate-100 print:border-slate-200">
                <span className="text-slate-400 block text-[11px]">{st.blastingScheduled}</span>
                <span className="font-semibold text-slate-800 font-mono text-xs mt-0.5 block">
                  {report.submittedParameters.blastingScheduled}
                </span>
              </div>
            </div>
          </div>

          {/* 4. Key Contributing Shortfall Factors */}
          <div className="bg-white p-6 print:p-3.5 rounded-xl border border-slate-200 print:border-slate-300 shadow-subtle space-y-4 print:space-y-1.5 break-inside-avoid print:mt-2">
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">
              {st.contributingFactors}
            </h3>
            <div className="divide-y divide-slate-100 print:divide-slate-200">
              {report.contributingFactors.map((factor, idx) => (
                <div key={idx} className="py-3.5 print:py-1.5 flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">
                      {factor.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {factor.description}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-amber-600 font-mono shrink-0">
                    <AnimatedNumber value={factor.impactPercent} />% {st.impact}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Recommended Corrective Measures */}
          <div className="bg-white p-6 print:p-3.5 rounded-xl border border-slate-200 print:border-slate-300 shadow-subtle space-y-4 print:space-y-1.5 break-inside-avoid print:mt-2">
            <h3 className="text-xs font-bold text-slate-900 tracking-tight">
              {st.correctiveMeasures}
            </h3>
            <div className="space-y-3 print:space-y-1.5">
              {report.correctiveMeasures.map((measure, idx) => {
                const colonIdx = measure.indexOf(':');
                return (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-brand-mint-bg text-brand-forest flex items-center justify-center text-xs font-bold shrink-0">
                      {idx + 1}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed pt-0.5">
                      {colonIdx !== -1 ? (
                        <>
                          <strong className="text-slate-900">{measure.slice(0, colonIdx + 1)}</strong>
                          {measure.slice(colonIdx + 1)}
                        </>
                      ) : (
                        <strong className="text-slate-900">{measure}</strong>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
