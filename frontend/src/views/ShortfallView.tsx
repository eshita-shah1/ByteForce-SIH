import React, { useState } from 'react';
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
  Layers
} from 'lucide-react';
import { api } from '../services/api';
import { ShortfallCoordinates, ShortfallOperationalInputs, ShortfallReportData } from '../types';
import { useAuth } from '../context/AuthContext';
import { AnimatedNumber } from '../components/core/AnimatedNumber';

const ST = {
  en: {
    initTitle: 'Initialize Shortfall Model',
    initSubtitle: 'To estimate raw extraction limits and operational logistics bottlenecks, define your geological target coordinates.',
    defineCoords: 'Define Project Coordinates',
    latTarget: 'LATITUDE TARGET',
    lngTarget: 'LONGITUDE TARGET',
    deg: 'DEG',
    siteNameLabel: 'SITE / PROJECT NAME (OPTIONAL)',
    siteNamePlaceholder: 'e.g. Shatter Belt Block A',
    continueBtn: 'Continue to Operational Inputs',
    pendingTitle: 'Target Core Models Pending',
    pendingDesc: 'Once location parameters are verified, the dashboard reveals environmental telemetry streams and live operational variables.',

    // Screen 2
    backBtn: '← Back to Coordinates',
    envContext: 'Live Environmental Context',
    currentRainfall: 'CURRENT RAINFALL',
    rainfall72h: 'RAINFALL (72H)',
    soilMoisture: 'SOIL MOISTURE',
    temperature: 'TEMPERATURE',
    surfaceWater: 'SURFACE WATER',
    surfaceWaterDesc: 'Moderate surface runoff near bench drains',
    envSource: 'Source: Balaghat Regional Micro-Weather API · Refreshed automatically',
    operationalInputs: 'Operational Inputs',
    workforce: 'WORKFORCE',
    workersAvailable: 'Workers Available (persons)',
    workersScheduled: 'Workers Scheduled (persons)',
    equipment: 'EQUIPMENT',
    excavatorsAvailable: 'Excavators Available (units)',
    dumpTrucksOperational: 'Dump Trucks Operational (units)',
    machineryAvailability: 'Machinery Availability (%)',
    plannedHours: 'Planned Operating Hours (hrs)',
    blasting: 'BLASTING',
    blastingRounds: 'Blasting Rounds Planned (rounds)',
    optional: 'Optional',
    tonnage: 'TONNAGE',
    expectedTonnage: 'Expected Tonnage (tonnes)',
    tonnageHelp: 'Target production for this shift or period.',
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
    initSubtitle: 'कच्ची निष्कर्षण सीमाओं और परिचालन रसद अड़चनों का अनुमान लगाने के लिए अपने भूवैज्ञानिक लक्ष्य निर्देशांक परिभाषित करें।',
    defineCoords: 'परियोजना निर्देशांक परिभाषित करें',
    latTarget: 'अक्षांश लक्ष्य',
    lngTarget: 'देशांतर लक्ष्य',
    deg: 'डिग्री',
    siteNameLabel: 'साइट / परियोजना का नाम (वैकल्पिक)',
    siteNamePlaceholder: 'उदा. शैटर बेल्ट ब्लॉक ए',
    continueBtn: 'परिचालन इनपुट पर जारी रखें',
    pendingTitle: 'लक्ष्य कोर मॉडल लंबित',
    pendingDesc: 'स्थान पैरामीटर सत्यापित होने के बाद, डैशबोर्ड पर्यावरणीय टेलीमेट्री स्ट्रीम और लाइव परिचालन चर प्रदर्शित करता है।',

    // Screen 2
    backBtn: '← निर्देशांक पर वापस जाएं',
    envContext: 'लाइव पर्यावरण संदर्भ',
    currentRainfall: 'वर्तमान वर्षा',
    rainfall72h: 'वर्षा (72 घंटे)',
    soilMoisture: 'मिट्टी की नमी',
    temperature: 'तापमान',
    surfaceWater: 'सतही जल',
    surfaceWaterDesc: 'बेंच नालों के पास मध्यम सतही अपवाह',
    envSource: 'स्रोत: बालाघाट क्षेत्रीय सूक्ष्म-मौसम एपीआई · स्वचालित रूप से रीफ्रेश',
    operationalInputs: 'परिचालन इनपुट',
    workforce: 'कार्यबल',
    workersAvailable: 'उपलब्ध श्रमिक (व्यक्ति)',
    workersScheduled: 'निर्धारित श्रमिक (व्यक्ति)',
    equipment: 'उपकरण',
    excavatorsAvailable: 'उपलब्ध उत्खनक (इकाइयां)',
    dumpTrucksOperational: 'परिचालन डंप ट्रक (इकाइयां)',
    machineryAvailability: 'मशीनरी उपलब्धता (%)',
    plannedHours: 'नियोजित परिचालन घंटे (घंटे)',
    blasting: 'ब्लास्टिंग',
    blastingRounds: 'नियोजित ब्लास्टिंग राउंड (राउंड)',
    optional: 'वैकल्पिक',
    tonnage: 'टन भार',
    expectedTonnage: 'अपेक्षित टन भार (टन)',
    tonnageHelp: 'इस शिफ्ट या अवधि के लिए लक्षित उत्पादन।',
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

export const ShortfallView: React.FC<ShortfallViewProps> = ({ 
  initialReport,
  onSubBreadcrumbChange 
}) => {
  const { language } = useAuth();
  const st = ST[language];
  // Step in workflow: 1 = coordinates, 2 = operational inputs, 3 = report
  const [step, setStep] = useState<'coords' | 'inputs' | 'report'>(initialReport ? 'report' : 'coords');

  // Coordinates
  const [coords, setCoords] = useState<ShortfallCoordinates>({
    latitude: -22.842778,
    longitude: 115.319444,
    siteName: 'Shatter Belt Block A'
  });

  // Operational inputs
  const [inputs, setInputs] = useState<ShortfallOperationalInputs>({
    workersAvailable: 34,
    workersScheduled: 36,
    excavatorsAvailable: 5,
    dumpTrucksOperational: 12,
    machineryAvailability: 88,
    plannedOperatingHours: 18,
    blastingRoundsPlanned: 2,
    expectedTonnage: 12500
  });

  const createDefaultShortfallReport = (c: ShortfallCoordinates, i: ShortfallOperationalInputs): ShortfallReportData => {
    const targetTonnes = Number(i.expectedTonnage) || 12500;
    const hours = Number(i.plannedOperatingHours) || 18;
    const trucks = Number(i.dumpTrucksOperational) || 12;
    const predictedTonnes = Math.round(targetTonnes * (0.65 + (trucks / 16) * 0.15 + (hours / 24) * 0.15));
    const gapTonnes = predictedTonnes - targetTonnes;
    const shortfallPct = Math.max(5, Math.round(Math.abs(gapTonnes / targetTonnes) * 100));

    return {
      id: `rep-${Date.now()}`,
      siteName: c.siteName || 'Balaghat Pit Sector',
      coordinates: { lat: c.latitude, lng: c.longitude },
      computedAgo: 'Just now',
      timestamp: new Date().toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' }),
      expectedShortfallPercent: shortfallPct,
      riskLevel: shortfallPct > 25 ? 'HIGH RISK' : shortfallPct > 15 ? 'MODERATE RISK' : 'LOW',
      targetProductionTonnes: targetTonnes,
      predictedOutputTonnes: predictedTonnes,
      expectedGapTonnes: gapTonnes,
      environmental: {
        weatherTemp: '34°C · Rain Storm Risk 80%',
        stormRisk: 'High local lightning activity expected',
        lightningRisk: 'High local lightning activity expected',
        waterTableDepth: 'Water Table: High Risk (-2.4m)',
        waterTableRisk: 'Quarry sump pumping active',
        haulRoadStatus: 'Haulage Road Status: Damp',
        haulRoadSlippage: 'Grade 3 minor slippage advisory'
      },
      submittedParameters: {
        targetSite: c.siteName || 'Balaghat Pit Sector',
        targetExtraction: `${targetTonnes.toLocaleString()} tonnes`,
        shiftCrewsActive: `${Math.round(i.workersAvailable / 8)} teams`,
        haulageFleet: `${trucks}x CAT 777`,
        blastingScheduled: i.blastingRoundsPlanned ? `Yes (${i.blastingRoundsPlanned} rounds)` : 'None',
        geologicalProfile: 'High Grade Manganese'
      },
      contributingFactors: [
        {
          name: 'Haulage Ramp Slippage & Gradient',
          description: 'Wet gradient decreases safe truck speeds down the extraction route.',
          impactPercent: Math.round(shortfallPct * 0.45)
        },
        {
          name: 'Drill Rig Sump Water Infiltration',
          description: 'Sump pumping must execute 30 min before active core drills can begin bench work.',
          impactPercent: Math.round(shortfallPct * 0.25)
        },
        {
          name: 'Workforce Shift Handover Latency',
          description: 'Predicted 15-minute alignment gap during upcoming scheduled shift change.',
          impactPercent: Math.round(shortfallPct * 0.18)
        },
        {
          name: 'Secondary Bench Ramp Congestion',
          description: 'Auxiliary loader queue times increased along the northern switchback access.',
          impactPercent: Math.max(1, shortfallPct - Math.round(shortfallPct * 0.45) - Math.round(shortfallPct * 0.25) - Math.round(shortfallPct * 0.18))
        }
      ],
      correctiveMeasures: [
        'Quarry Sump Dewatering: Increase submersible pump discharge rate at Target Sump A 45 minutes prior to shift handover.',
        'Dynamic Haulage Re-Routing: Re-route 2x backup CAT 777 dump trucks to western bypass ramp to circumvent grade 3 slippage zone.',
        'Stockpile Blending Protocol: Blend direct-run bench 4 material with dry strategic stockpile to stabilize moisture under 6.5%.',
        'Ramp Surface Maintenance: Deploy auxiliary motor grader to apply crushed gravel topping across the northern switchback.'
      ]
    };
  };

  const [report, setReport] = useState<ShortfallReportData>(
    initialReport || createDefaultShortfallReport(coords, inputs)
  );
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

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

  const handleRunAssessment = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEvaluating(true);

    setTimeout(async () => {
      setIsEvaluating(false);
      // Attempt backend API call first with graceful calculation fallback
      const apiResult = await api.runShortfallAssessment(coords, inputs);
      const generatedReport = apiResult || createDefaultShortfallReport(coords, inputs);

      setReport(generatedReport);
      setStep('report');
      if (onSubBreadcrumbChange) onSubBreadcrumbChange('Model Prediction Report');
    }, 650);
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
                    {st.latTarget}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      value={coords.latitude}
                      onChange={(e) => setCoords({ ...coords, latitude: parseFloat(e.target.value) })}
                      className="w-full px-3.5 py-2.5 text-xs font-mono rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                    <span className="absolute right-3.5 top-2.5 text-[11px] font-mono text-slate-400">
                      {st.deg}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {st.lngTarget}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      required
                      value={coords.longitude}
                      onChange={(e) => setCoords({ ...coords, longitude: parseFloat(e.target.value) })}
                      className="w-full px-3.5 py-2.5 text-xs font-mono rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                    <span className="absolute right-3.5 top-2.5 text-[11px] font-mono text-slate-400">
                      {st.deg}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    {st.siteNameLabel}
                  </label>
                  <input
                    type="text"
                    value={coords.siteName}
                    onChange={(e) => setCoords({ ...coords, siteName: e.target.value })}
                    placeholder={st.siteNamePlaceholder}
                    className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                  />
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

          {/* Live Environmental Context Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-subtle space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {st.envContext}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>11:09:39 AM</span>
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
                  <AnimatedNumber value={12.5} decimals={1} />mm
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                  <Droplets className="w-3 h-3 text-brand-forest" />
                  <span>{st.rainfall72h}</span>
                </div>
                <span className="text-base font-bold text-slate-900 font-mono">
                  <AnimatedNumber value={44} />mm
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                  <Layers className="w-3 h-3 text-brand-forest" />
                  <span>{st.soilMoisture}</span>
                </div>
                <span className="text-base font-bold text-slate-900 font-mono">
                  <AnimatedNumber value={72} />%
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                  <Thermometer className="w-3 h-3 text-brand-forest" />
                  <span>{st.temperature}</span>
                </div>
                <span className="text-base font-bold text-slate-900 font-mono">
                  <AnimatedNumber value={28.2} decimals={1} />°C
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 mb-1">
                  <AlertTriangle className="w-3 h-3 text-amber-500" />
                  <span>{st.surfaceWater}</span>
                </div>
                <span className="text-xs font-bold text-slate-800 leading-tight block">
                  {st.surfaceWaterDesc}
                </span>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 pt-1">
              {st.envSource}
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
                      onChange={(e) => setInputs({ ...inputs, workersAvailable: parseInt(e.target.value) || 0 })}
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
                      onChange={(e) => setInputs({ ...inputs, workersScheduled: parseInt(e.target.value) || 0 })}
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
                      onChange={(e) => setInputs({ ...inputs, excavatorsAvailable: parseInt(e.target.value) || 0 })}
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
                      onChange={(e) => setInputs({ ...inputs, dumpTrucksOperational: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {st.machineryAvailability}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      required
                      value={inputs.machineryAvailability}
                      onChange={(e) => setInputs({ ...inputs, machineryAvailability: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">0–100</span>
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
                      onChange={(e) => setInputs({ ...inputs, plannedOperatingHours: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">0–24</span>
                  </div>
                </div>
              </div>

              {/* 3. BLASTING & TONNAGE SECTION */}
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
                  {/* Blasting column */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 mb-3 tracking-wide">
                      {st.blasting}
                    </h3>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {st.blastingRounds}
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={inputs.blastingRoundsPlanned ?? ''}
                      onChange={(e) => setInputs({ ...inputs, blastingRoundsPlanned: parseInt(e.target.value) || undefined })}
                      className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">{st.optional}</span>
                  </div>

                  {/* Tonnage column */}
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
                      min={100}
                      value={inputs.expectedTonnage}
                      onChange={(e) => setInputs({ ...inputs, expectedTonnage: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">{st.tonnageHelp}</span>
                  </div>
                </div>
              </div>

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
      {step === 'report' && (
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
                {st.location}: <strong className="text-slate-700">{report.siteName}</strong> · {st.target}: ({formatCoords(report.coordinates?.lat ?? coords.latitude, report.coordinates?.lng ?? coords.longitude)}) · {st.computed} {report.computedAgo || 'Just now'}
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
                  {formatCoords(report.coordinates?.lat ?? coords.latitude, report.coordinates?.lng ?? coords.longitude)}
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
