import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Compass, LogOut, User as UserIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { ViewMode } from '../../types';

interface TopNavProps {
  currentView?: ViewMode;
  onNavigate: (view: ViewMode) => void;
  subBreadcrumb?: string;
}

/* ── Language definitions ────────────────────────────────────────────── */
type Lang = 'en' | 'hi';

const LANG_OPTIONS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'EN' },
  { id: 'hi', label: 'हिं' },
];

/* ── Inline Language Pill Toggle: EN | हिं ────────────────────────────── */
const LanguageToggle: React.FC = () => {
  const { language, setLanguage } = useAuth();

  return (
    <div className="relative flex items-center bg-slate-100 border border-slate-200 rounded-full p-0.5 select-none">
      {/* Sliding pill indicator */}
      <motion.div
        layout
        className="absolute top-0.5 bottom-0.5 bg-brand-forest rounded-full shadow-sm"
        initial={false}
        animate={{
          left: language === 'en' ? '2px' : '50%',
          width: 'calc(50% - 2px)',
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      />

      {LANG_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => setLanguage(opt.id)}
          className={`relative z-10 px-3 py-1 rounded-full text-[11px] font-semibold transition-colors duration-150 ${
            language === opt.id
              ? 'text-white'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

/* ── Logo with needle-tilt on hover ───────────────────────────────────── */
const TerraLogo: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center gap-2.5 font-bold text-slate-900 tracking-tight text-lg hover:opacity-95 transition-opacity"
    >
      <div className="w-9 h-9 rounded-xl bg-brand-forest flex items-center justify-center shadow-sm">
        <motion.div
          animate={{
            rotate: hovered ? -18 : 0,
            scale: hovered ? 1.08 : 1,
          }}
          transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        >
          <Compass className="w-5 h-5 text-brand-mint-light" />
        </motion.div>
      </div>
      <span>TerraScope</span>
    </button>
  );
};

/* ── TopNav ───────────────────────────────────────────────────────────── */
export const TopNav: React.FC<TopNavProps> = ({ currentView, onNavigate, subBreadcrumb }) => {
  const { isLoggedIn, user, openLoginModal, logout, setCurrentView, language } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  /* Always navigate to landing on logo click */
  const handleLogoClick = () => {
    setCurrentView('landing');
  };

  const getBreadcrumbs = () => {
    if (language === 'hi') {
      switch (currentView) {
        case 'overview':
          return 'कंसोल / अवलोकन';
        case 'prospectivity':
          return subBreadcrumb
            ? `संभावना विश्लेषण / ${subBreadcrumb === 'Existing Study Area' ? 'मौजूदा अध्ययन क्षेत्र' : subBreadcrumb === 'Upload GIS Context' ? 'GIS संदर्भ अपलोड करें' : subBreadcrumb === 'Model Prediction Report' ? 'मॉडल पूर्वानुमान रिपोर्ट' : subBreadcrumb}`
            : 'संभावना विश्लेषण / मौजूदा अध्ययन क्षेत्र';
        case 'shortfall':
          return subBreadcrumb
            ? `कमी पूर्वानुमान / ${subBreadcrumb === 'Operational Inputs' ? 'परिचालन इनपुट' : subBreadcrumb === 'Model Prediction Report' ? 'मॉडल पूर्वानुमान रिपोर्ट' : subBreadcrumb === 'New Forecast' ? 'नया पूर्वानुमान' : subBreadcrumb}`
            : 'कमी पूर्वानुमान / नया पूर्वानुमान';
        case 'account':
          return 'सेटिंग्स / खाता';
        case 'documents':
          return 'दस्तावेज़ / दस्तावेज़';
        case 'logs':
          return 'इतिहास / लॉग्स';
        default:
          return 'कंसोल / अवलोकन';
      }
    }

    switch (currentView) {
      case 'overview':      return 'Console / Overview';
      case 'prospectivity': return subBreadcrumb ? `Prospectivity Analysis / ${subBreadcrumb}` : 'Prospectivity Analysis / Existing Study Area';
      case 'shortfall':     return subBreadcrumb ? `Shortfall Prediction / ${subBreadcrumb}` : 'Shortfall Prediction / New Forecast';
      case 'account':       return 'Settings / Account';
      case 'documents':     return 'Documentation / Documents';
      case 'logs':          return 'History / Logs';
      default:              return 'Console / Overview';
    }
  };

  return (
    <header className="h-16 border-b border-slate-border bg-white px-6 flex items-center justify-between sticky top-0 z-30 select-none print:hidden">

      {/* Left: Logo + Breadcrumb */}
      <div className="flex items-center gap-6">
        <TerraLogo onClick={handleLogoClick} />

        {isLoggedIn && currentView !== 'landing' && (
          <div className="hidden sm:flex items-center text-xs text-slate-500 font-medium pl-6 border-l border-slate-200">
            <span className="text-slate-600">{getBreadcrumbs()}</span>
          </div>
        )}
      </div>

      {/* Right: Language toggle + Auth controls */}
      <div className="flex items-center gap-3">

        {/* Language toggle (EN | हिं) — inline pill with slide animation */}
        <LanguageToggle />

        {/* Authenticated user pill or Log-in CTA */}
        {isLoggedIn && user ? (
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2.5 pl-2 pr-1 py-1 rounded-full hover:bg-slate-50 transition-colors"
            >
              <span className="text-xs font-medium text-slate-800 hidden md:inline-block">
                {user.name}
              </span>
              <div className="w-8 h-8 rounded-full bg-brand-forest text-white font-medium text-xs flex items-center justify-center ring-2 ring-brand-mint-bg ring-offset-1">
                {user.initials}
              </div>
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg border border-slate-200 shadow-lg py-2 z-40">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-xs font-semibold text-slate-900">{user.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                  <span className="inline-block mt-1 text-[10px] font-medium bg-brand-mint-bg text-brand-mint-text px-2 py-0.5 rounded">
                    {user.role}
                  </span>
                </div>
                <button
                  onClick={() => { setProfileDropdownOpen(false); onNavigate('account'); }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                  <span>Account Settings</span>
                </button>
                <button
                  onClick={() => { setProfileDropdownOpen(false); logout(); }}
                  className="w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-100"
                >
                  <LogOut className="w-3.5 h-3.5 text-red-500" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={() => openLoginModal('overview')}
            className="px-4 py-2 rounded-md bg-brand-forest hover:bg-brand-forest-hover text-white text-xs font-semibold tracking-wide transition-all shadow-sm active:scale-[0.98]"
          >
            Log in
          </button>
        )}
      </div>
    </header>
  );
};
