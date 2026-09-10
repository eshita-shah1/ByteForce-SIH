import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TopNav } from './components/layout/TopNav';
import { Sidebar } from './components/layout/Sidebar';
import { LoginModal } from './components/layout/LoginModal';
import { LandingView } from './views/LandingView';
import { OverviewView } from './views/OverviewView';
import { ProspectivityView } from './views/ProspectivityView';
import { ShortfallView } from './views/ShortfallView';
import { AccountView } from './views/AccountView';
import { DocumentsView } from './views/DocumentsView';
import { LogsView } from './views/LogsView';
import { ShortfallReportData, ViewMode } from './types';

const MainShell: React.FC = () => {
  const { isLoggedIn, currentView, setCurrentView } = useAuth();
  const [selectedShortfallReport, setSelectedShortfallReport] = useState<ShortfallReportData | undefined>(undefined);
  const [subBreadcrumb, setSubBreadcrumb] = useState<string>('');

  const handleNavigate = (view: ViewMode) => {
    setSubBreadcrumb('');
    setCurrentView(view);
  };

  const handleSelectShortfallReport = (report: ShortfallReportData) => {
    setSelectedShortfallReport(report);
    setSubBreadcrumb('Model Prediction Report');
  };

  // If unauthenticated or viewing landing page
  if (!isLoggedIn || currentView === 'landing') {
    return (
      <div className="min-h-screen bg-slate-surface flex flex-col font-sans">
        <TopNav
          currentView="landing"
          onNavigate={handleNavigate}
        />
        <LandingView />
        <LoginModal />
      </div>
    );
  }

  // Authenticated Shell with Persistent Left Sidebar
  return (
    <div className="min-h-screen bg-[#F7F9F8] flex flex-col font-sans print:min-h-0 print:h-auto print:bg-white print:block">
      <TopNav
        currentView={currentView}
        onNavigate={handleNavigate}
        subBreadcrumb={subBreadcrumb}
      />

      <div className="flex-1 flex overflow-hidden print:overflow-visible print:block">
        {/* Persistent Left Sidebar */}
        <Sidebar
          currentView={currentView}
          onNavigate={handleNavigate}
        />

        {/* Dynamic Workspace Canvas */}
        <main className="flex-1 overflow-y-auto bg-[#F7F9F8] print:overflow-visible print:bg-white print:p-0 print:m-0 print:w-full print:block">
          {currentView === 'overview' && (
            <OverviewView onNavigate={handleNavigate} />
          )}

          {currentView === 'prospectivity' && (
            <ProspectivityView
              onSubBreadcrumbChange={(crumb) => setSubBreadcrumb(crumb)}
            />
          )}

          {currentView === 'shortfall' && (
            <ShortfallView
              key={selectedShortfallReport?.id || 'default-shortfall'}
              initialReport={selectedShortfallReport}
              onSubBreadcrumbChange={(crumb) => setSubBreadcrumb(crumb)}
            />
          )}

          {currentView === 'account' && (
            <AccountView />
          )}

          {currentView === 'documents' && (
            <DocumentsView />
          )}

          {currentView === 'logs' && (
            <LogsView
              onSelectShortfallReport={handleSelectShortfallReport}
              onNavigate={handleNavigate}
            />
          )}
        </main>
      </div>

      <LoginModal />
    </div>
  );
};

export function App() {
  return (
    <AuthProvider>
      <MainShell />
    </AuthProvider>
  );
}

export default App;
