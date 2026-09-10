import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download, FileText, ChevronDown, CheckCircle2, ArrowUpDown } from 'lucide-react';
import { api } from '../services/api';
import { GISFileItem } from '../types';

export const DocumentsView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'latest' | 'oldest' | 'alphabetical'>('latest');
  const [files, setFiles] = useState<GISFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const loadDocuments = async () => {
      setLoading(true);
      try {
        const data = await api.getDocuments();
        setFiles(data);
      } catch {
        setFiles([]);
      } finally {
        setLoading(false);
      }
    };
    loadDocuments();
  }, []);

  const filteredAndSortedFiles = useMemo(() => {
    let result = files.filter(f => 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (sortOption === 'latest') {
      result.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
    } else if (sortOption === 'oldest') {
      result.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
    } else if (sortOption === 'alphabetical') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [files, searchQuery, sortOption]);

  const handleDownload = (file: GISFileItem) => {
    setDownloadingId(file.id);
    setTimeout(() => {
      setDownloadingId(null);
      // Trigger a clean synthetic file download
      const blob = new Blob([`TerraScope GIS Export: ${file.name}\nSize: ${file.size}\nCategory: ${file.category}`], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 600);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-fadeIn">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          GIS Document Repository
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Centralized storage of spatial layers, seismic shapefiles, drill assay logs, and boundary definitions.
        </p>
      </div>

      {/* Search & Sort Controls Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-subtle space-y-4">
        {/* Top Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by filename or category..."
            className="w-full pl-10 pr-4 py-2.5 text-xs rounded-lg border border-slate-200 focus:ring-2 focus:ring-brand-forest focus:outline-none placeholder:text-slate-400"
          />
        </div>

        {/* Filter/Sort Dropdown Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-800">{filteredAndSortedFiles.length}</span>
            <span>documents found</span>
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

      {/* Document List View */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-subtle overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-brand-forest/30 border-t-brand-forest rounded-full animate-spin mx-auto mb-2" />
            <p className="font-medium text-slate-600">Connecting to GIS document repository...</p>
          </div>
        ) : filteredAndSortedFiles.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredAndSortedFiles.map((file) => (
              <div
                key={file.id}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                    <FileText className="w-5 h-5 text-brand-forest" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-slate-900 font-mono">
                        {file.name}
                      </h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 uppercase">
                        {file.format}
                      </span>
                      {file.status === 'ready' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Indexed</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {file.category} · <span className="font-mono">{file.size}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 text-xs shrink-0">
                  <span className="text-slate-400 text-[11px] font-mono">
                    {file.uploadedAt}
                  </span>

                  <button
                    onClick={() => handleDownload(file)}
                    disabled={downloadingId === file.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-brand-forest/60 hover:bg-brand-mint-bg/40 text-brand-forest font-semibold text-xs transition-colors"
                    title="Redownload GIS file"
                  >
                    {downloadingId === file.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-brand-forest/30 border-t-brand-forest rounded-full animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-brand-forest" />
                    )}
                    <span>Redownload</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 text-xs">
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-medium text-slate-600">No documents in repository.</p>
            <p className="mt-1">Spatial GIS documents will appear here when fetched from your backend API service or uploaded.</p>
          </div>
        )}
      </div>
    </div>
  );
};
