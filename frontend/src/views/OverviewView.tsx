import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Compass, TrendingUp, ArrowRight } from 'lucide-react';
import { MiningAnimation } from '../components/overview/MiningAnimation';
import { ViewMode } from '../types';

interface OverviewViewProps {
  onNavigate: (view: ViewMode) => void;
}

const T = {
  en: {
    welcome: 'Welcome back',
    subtitle: 'Select an active modeling workspace below to construct prospectivity maps or query operational shortfall models.',
    card1Title: 'Manganese Prospectivity Analyst',
    card1Badge: 'GIS Spatial Integration Active',
    card1Desc: 'Deploy structured multi-class statistical maps across continental grids. Analyze structural geology, gravimetric anomalies, magnetic features, and stratigraphic markers to pinpoint optimal sampling locations.',
    card1Btn: 'Open Prospectivity Analysis',
    card2Title: 'Mining Shortfall Forecaster',
    card2Badge: 'Telemetry Stream Online',
    card2Desc: 'Forecast material flow constraints and quarry extraction shortfalls. Integrate real-time weather logs, machine strain telemetry, haul road gradients, and shift changes to maintain tight project schedules.',
    card2Btn: 'Open Shortfall Prediction',
  },
  hi: {
    welcome: 'वापसी पर स्वागत है',
    subtitle: 'संभावना मानचित्र बनाने या परिचालन कमी मॉडल पूछने के लिए नीचे एक सक्रिय मॉडलिंग कार्यक्षेत्र चुनें।',
    card1Title: 'मैंगनीज संभावना विश्लेषक',
    card1Badge: 'GIS स्थानिक एकीकरण सक्रिय',
    card1Desc: 'महाद्वीपीय ग्रिड पर संरचित बहु-श्रेणी सांख्यिकीय मानचित्र तैनात करें। इष्टतम नमूना स्थानों का पता लगाने के लिए संरचनात्मक भूविज्ञान, गुरुत्वाकर्षण विसंगतियों और चुंबकीय विशेषताओं का विश्लेषण करें।',
    card1Btn: 'संभावना विश्लेषण खोलें',
    card2Title: 'खनन कमी पूर्वानुमानक',
    card2Badge: 'टेलीमेट्री स्ट्रीम ऑनलाइन',
    card2Desc: 'सामग्री प्रवाह बाधाओं और खनन निष्कर्षण कमियों का पूर्वानुमान करें। परियोजना अनुसूची बनाए रखने के लिए रियल-टाइम मौसम लॉग, मशीन तनाव टेलीमेट्री और हॉल रोड ग्रेडिएंट को एकीकृत करें।',
    card2Btn: 'कमी पूर्वानुमान खोलें',
  },
} as const;

export const OverviewView: React.FC<OverviewViewProps> = ({ onNavigate }) => {
  const { user, language } = useAuth();
  const firstName = user?.name ? user.name.split(' ')[0] : (language === 'hi' ? 'अभियंता' : 'Engineer');
  const t = T[language];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-fadeIn">
      {/* Header section */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          {t.welcome}, {firstName}
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
          {t.subtitle}
        </p>
      </div>

      {/* Main Workspace Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Card 1: Manganese Prospectivity Analyst */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-7 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between h-full">
          <div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-brand-mint-bg flex items-center justify-center shrink-0">
                <Compass className="w-5 h-5 text-brand-forest" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  {t.card1Title}
                </h3>
                <div className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-mint-text">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{t.card1Badge}</span>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
              {t.card1Desc}
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={() => onNavigate('prospectivity')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-brand-forest hover:bg-brand-forest-hover text-white text-xs font-semibold tracking-wide transition-all shadow-sm active:scale-[0.99]"
            >
              <span>{t.card1Btn}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Card 2: Mining Shortfall Forecaster */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 sm:p-7 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between h-full">
          <div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-brand-mint-bg flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-brand-forest" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  {t.card2Title}
                </h3>
                <div className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-mint-text">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{t.card2Badge}</span>
                </div>
              </div>
            </div>
            <p className="mt-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
              {t.card2Desc}
            </p>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <button
              onClick={() => onNavigate('shortfall')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-brand-forest hover:bg-brand-forest-hover text-white text-xs font-semibold tracking-wide transition-all shadow-sm active:scale-[0.99]"
            >
              <span>{t.card2Btn}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mining Animation */}
      <div className="pt-2">
        <MiningAnimation />
      </div>
    </div>
  );
};
