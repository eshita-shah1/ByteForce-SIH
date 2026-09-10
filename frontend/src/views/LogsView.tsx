import React, { useState, useEffect, useMemo } from 'react';
import { Search, History, ChevronDown, ArrowUpDown, FileDown, ExternalLink, Compass, TrendingUp, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { RunLog, ShortfallReportData, ViewMode } from '../types';

interface LogsViewProps {
  onSelectShortfallReport: (report: ShortfallReportData) => void;
  onNavigate: (view: ViewMode) => void;
}

export const LogsView: React.FC<LogsViewProps> = ({ 
  onSelectShortfallReport, 
  onNavigate 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'latest' | 'oldest' | 'alphabetical'>('latest');
  const [logs, setLogs] = useState<RunLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      try {
        const data = await api.getLogs();
        setLogs(data);
      } catch {
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, []);

  const filteredAndSortedLogs = useMemo(() => {
    let result = logs.filter(log => 
      log.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.targetSite.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.modelType.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (sortOption === 'latest') {
      result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } else if (sortOption === 'oldest') {
      result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } else if (sortOption === 'alphabetical') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [logs, searchQuery, sortOption]);

  const handleDownloadPDF = (log: RunLog) => {
    if (log.reportRef) {
      onSelectShortfallReport(log.reportRef);
      onNavigate('shortfall');
      setTimeout(() => {
        window.print();
      }, 300);
    }
  };

  const handleViewDetailedResult = (log: RunLog) => {
    if (log.reportRef) {
      onSelectShortfallReport(log.reportRef);
      onNavigate('shortfall');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Model Execution Logs
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Audit trail of past prospectivity simulations and extraction shortfall assessments.
        </p>
      </div>

      {/* Search & Sort Controls Card (Matching Documents Framework) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-subtle space-y-4">
        {/* Top Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search execution logs by site, model, or title..."
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none placeholder:text-slate-400"
          />
        </div>

        {/* Filter/Sort Dropdown Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-800">{filteredAndSortedLogs.length}</span>
            <span>telemetry runs logged</span>
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">Sort by:</span>
            <div className="relative">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
                className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold py-1.5 pl-3 pr-8 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-forest cursor-pointer"
              >
                <option value="latest">Date uploaded: Latest</option>
                <option value="oldest">Date uploaded: Oldest</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Logs List View */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-brand-forest/30 border-t-brand-forest rounded-full animate-spin mx-auto mb-2" />
            <p className="font-medium text-slate-600">Loading model execution logs...</p>
          </div>
        ) : filteredAndSortedLogs.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredAndSortedLogs.map((log) => {
              const isShortfall = log.modelType === 'Shortfall';
              return (
                <div
                  key={log.id}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  {/* Left: Model icon & descriptions */}
                  <div className="flex items-start gap-3.5">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      isShortfall ? 'bg-amber-50 text-amber-700' : 'bg-brand-mint-bg text-brand-forest'
                    }`}>
                      {isShortfall ? (
                        <TrendingUp className="w-5 h-5" />
                      ) : (
                        <Compass className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-900">
                          {log.title}
                        </h4>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isShortfall ? 'bg-amber-100 text-amber-800' : 'bg-brand-mint-bg text-brand-forest'
                        }`}>
                          {log.modelType}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{log.status}</span>
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 mt-1">
                        Location: <span className="font-semibold text-slate-700">{log.targetSite}</span>
                        <span className="mx-2">·</span>
                        <span className="font-mono font-medium text-slate-800">{log.metricHighlight}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center justify-between lg:justify-end gap-5 text-xs shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <span className="text-slate-400 text-[11px] font-mono">
                      {log.timestamp}
                    </span>

                    {/* SPECIAL LOGIC FOR SHORTFALL MODEL LOGS */}
                    {isShortfall && log.reportRef ? (
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => handleViewDetailedResult(log)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-brand-forest/60 hover:bg-slate-50 text-slate-800 font-semibold text-xs transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                          <span>View detailed result</span>
                        </button>

                        <button
                          onClick={() => handleDownloadPDF(log)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-forest hover:bg-brand-forest-hover text-white font-semibold text-xs transition-colors shadow-xs"
                        >
                          <FileDown className="w-3.5 h-3.5 text-brand-mint-light" />
                          <span>Download as PDF</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onNavigate('prospectivity')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-brand-forest/60 hover:bg-slate-50 text-slate-800 font-semibold text-xs transition-colors"
                      >
                        <Compass className="w-3.5 h-3.5 text-brand-forest" />
                        <span>View on map</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs">
            <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-medium text-slate-600">No execution logs recorded.</p>
            <p className="mt-1">Telemetry runs and model prediction logs will appear here once connected to your backend API service.</p>
          </div>
        )}
      </div>
    </div>
  );
};
