import React from 'react';
import { 
  LayoutGrid, 
  Compass, 
  TrendingUp, 
  User, 
  FileText, 
  History 
} from 'lucide-react';
import { ViewMode } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentView: ViewMode;
  onNavigate: (view: ViewMode) => void;
}

const T = {
  en: {
    workspaces: 'WORKSPACES',
    overview: 'Overview',
    prospectivity: 'Prospectivity Analysis',
    shortfall: 'Shortfall Prediction',
    settings: 'SETTINGS',
    account: 'Account',
    documentation: 'DOCUMENTATION',
    documents: 'Documents',
    history: 'HISTORY',
    logs: 'Logs',
  },
  hi: {
    workspaces: 'कार्यक्षेत्र',
    overview: 'अवलोकन',
    prospectivity: 'संभावना विश्लेषण',
    shortfall: 'कमी पूर्वानुमान',
    settings: 'सेटिंग्स',
    account: 'खाता',
    documentation: 'दस्तावेज़',
    documents: 'दस्तावेज़',
    history: 'इतिहास',
    logs: 'लॉग्स',
  },
} as const;

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate }) => {
  const { language } = useAuth();
  const t = T[language];

  const navSections = [
    {
      title: t.workspaces,
      items: [
        { id: 'overview' as ViewMode, label: t.overview, icon: LayoutGrid },
        { id: 'prospectivity' as ViewMode, label: t.prospectivity, icon: Compass },
        { id: 'shortfall' as ViewMode, label: t.shortfall, icon: TrendingUp },
      ]
    },
    {
      title: t.settings,
      items: [
        { id: 'account' as ViewMode, label: t.account, icon: User },
      ]
    },
    {
      title: t.documentation,
      items: [
        { id: 'documents' as ViewMode, label: t.documents, icon: FileText },
      ]
    },
    {
      title: t.history,
      items: [
        { id: 'logs' as ViewMode, label: t.logs, icon: History },
      ]
    }
  ];

  return (
    <aside className="w-64 border-r border-slate-200 bg-white min-h-[calc(100vh-4rem)] p-4 flex flex-col justify-between shrink-0 select-none print:hidden">
      <div>
        {navSections.map((section, idx) => (
          <div key={section.title} className={idx === 0 ? '' : 'mt-6'}>
            <div className="px-3 text-[11px] font-bold text-slate-400 tracking-wider mb-1.5 uppercase">
              {section.title}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-medium rounded-lg transition-all text-left ${
                      isActive
                        ? 'bg-brand-mint-bg text-brand-forest font-semibold'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-brand-forest' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};
