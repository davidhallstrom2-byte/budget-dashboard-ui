// src/components/BudgetDashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { initializeState, saveToServer } from '../utils/state.js';
import LoadingGate from './common/LoadingGate';
import DashboardTab from './tabs/DashboardTab';
import AnalysisTab from './tabs/AnalysisTab';
import CalculatorTab from './tabs/CalculatorTab';
import TodoTab from './tabs/TodoTab';
import EditorTab from './tabs/EditorTab';	import ArchivedDrawer from './ui/ArchivedDrawer';
import StickyToolbar from './common/StickyToolbar.jsx';
import StatementScanner from './statements/StatementScanner';
import NotificationPanel from './modern/NotificationPanel';
import { Search, X } from 'lucide-react';

const BudgetDashboard = () => {
  const [state, setState] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isArchiveDrawerOpen, setIsArchiveDrawerOpen] = useState(false);
  const [isStatementScannerOpen, setIsStatementScannerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFilename, setExportFilename] = useState('budget-data');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const initialState = await initializeState();
        if (mounted) setState(initialState);
      } catch (err) {
        console.error('Error initializing app:', err);
        if (mounted) {
          setState({
            buckets: {
              income: [], housing: [], transportation: [], food: [],
              personal: [], homeOffice: [], banking: [], subscriptions: [], misc: []
            },
            archived: []
          });
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const tabs = useMemo(() => ([
  { id: 'dashboard', label: 'Dashboard', bgColor: 'bg-blue-100' },
  { id: 'todo',      label: 'To-Do',     bgColor: 'bg-red-100' },
  { id: 'editor',    label: 'Editor',    bgColor: 'bg-orange-100' },
  { id: 'analysis',  label: 'Analysis',  bgColor: 'bg-purple-100' },
  { id: 'calculator',label: 'Calculator',bgColor: 'bg-green-100' }
]), []);

  const activeTabConfig = useMemo(
    () => tabs.find(t => t.id === activeTab),
    [tabs, activeTab]
  );

  const saveBudget = async (customState = null, customMessage = null) => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const result = await saveToServer(customState || state);
      if (customMessage !== false) {
        setSaveStatus(
          result?.success
            ? { type: 'success', message: customMessage || 'Budget saved successfully!' }
            : { type: 'error', message: result?.error || 'Save failed' }
        );
      }
    } catch {
      setSaveStatus({ type: 'error', message: 'Failed to save budget' });
    } finally {
      setIsSaving(false);
      if (customMessage !== false) {
        setTimeout(() => setSaveStatus(null), 3000);
      }
    }
  };

  const handleStatementImport = (budgetItems) => {
    const updatedBuckets = { ...state.buckets };
    
    budgetItems.forEach(({ categoryKey, item }) => {
      if (updatedBuckets[categoryKey]) {
        updatedBuckets[categoryKey] = [...updatedBuckets[categoryKey], item];
      } else {
        updatedBuckets.misc = [...(updatedBuckets.misc || []), item];
      }
    });

    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    saveBudget(updatedState, `Successfully imported ${budgetItems.length} transactions!`);
  };

  const handleRestoreArchived = (id) => {
    const idx = state?.archived?.findIndex(i => i.id === id);
    if (idx === -1 || idx === undefined) return;
    const archivedItem = state.archived[idx];
    const { originalBucket, archivedAt, ...restoredItem } = archivedItem;

    const updatedBuckets = {
      ...state.buckets,
      [originalBucket]: [...(state.buckets[originalBucket] || []), restoredItem]
    };
    const updatedArchived = state.archived.filter((_, i) => i !== idx);
    const updatedState = { ...state, buckets: updatedBuckets, archived: updatedArchived };
    setState(updatedState);
    saveBudget(updatedState, 'Item restored successfully!');
  };

  const handleDeleteArchived = (id) => {
    if (!confirm('Permanently delete this archived item?')) return;
    const updatedArchived = state?.archived?.filter(i => i.id !== id) || [];
    const updatedState = { ...state, archived: updatedArchived };
    setState(updatedState);
    saveBudget(updatedState, 'Archived item deleted permanently!');
  };

const handleMarkPaidFromNotification = (bucket, id) => {
  const item = state.buckets[bucket]?.find(item => item.id === id);
  if (!item) return;

  const previousState = { dueDate: item.dueDate, status: item.status, actualCost: item.actualCost };

  const updatedBuckets = {
    ...state.buckets,
    [bucket]: state.buckets[bucket].map(it =>
      it.id === id ? { ...it, status: 'paid', previousState } : it
    )
  };
  const updatedState = { ...state, buckets: updatedBuckets };
  setState(updatedState);
  saveBudget(updatedState, 'Item marked as paid!');
};

  const handleExportJSON = () => {
    const filename = exportFilename.trim() || 'budget-data';
    const dataStr = JSON.stringify(state, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowExportDialog(false);
    setSaveStatus({ type: 'success', message: `Exported ${filename}.json` });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleImportJSON = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        
        // Validate structure
        if (!imported.buckets || !imported.archived) {
          throw new Error('Invalid budget file format');
        }

        setState(imported);
        saveBudget(imported, 'Budget imported successfully!');
      } catch (error) {
        setSaveStatus({ type: 'error', message: `Import failed: ${error.message}` });
        setTimeout(() => setSaveStatus(null), 3000);
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  if (isLoading) return <LoadingGate />;

  return (
    <div className="min-h-screen bg-gray-50">
      {saveStatus && (
        <div
          className="fixed inset-0 pointer-events-none z-[9999]"
          style={{ isolation: 'isolate' }}
        >
          <div
            className={`absolute top-20 right-4 px-4 py-2 rounded-lg shadow-lg pointer-events-auto ${
              saveStatus.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
            role="status"
            aria-live="polite"
          >
            {saveStatus.message}
          </div>
        </div>
      )}

      <StickyToolbar bgTint={activeTabConfig?.bgColor || ''}>
        <div className="flex justify-between items-center gap-2 h-14">
          {/* Left: Tabs - Scrollable */}
          <div className="flex items-center space-x-1 overflow-x-auto flex-shrink min-w-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-black text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
                aria-pressed={activeTab === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right: Notification Bell + Minimal Action Buttons */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <NotificationPanel
              state={state}
              onMarkPaid={handleMarkPaidFromNotification}
            />

            {/* Search - Hidden on mobile */}
            <div className="relative w-48 hidden lg:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Scan Statement - Icon only */}
            <button
              onClick={() => setIsStatementScannerOpen(true)}
              className="p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
              title="Scan Statement"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>

            {/* Archives - Icon + count */}
            <button
              onClick={() => setIsArchiveDrawerOpen(true)}
              className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-1"
              title="Archives"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <span className="text-xs">({state.archived?.length || 0})</span>
            </button>

            {/* Export JSON */}
            <button
              onClick={() => setShowExportDialog(true)}
              className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              title="Export JSON"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>

            {/* Import JSON */}
            <label className="p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors cursor-pointer" title="Import JSON">
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </label>

            {/* Save Button - Icon only */}
            <button
              onClick={() => saveBudget()}
              disabled={isSaving}
              className={`p-2 rounded-lg transition-colors ${
                isSaving ? 'bg-gray-400 text-white cursor-not-allowed'
                         : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
              title="Save Budget"
            >
              {isSaving ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                          stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </StickyToolbar>

      <div className={`${activeTabConfig?.bgColor || 'bg-white'} min-h-screen`}>
        {activeTab === 'dashboard' && (
          <DashboardTab state={state} setState={setState} saveBudget={saveBudget} searchQuery={searchQuery} />
        )}
        {activeTab === 'analysis' && (
          <AnalysisTab state={state} setState={setState} saveBudget={saveBudget} searchQuery={searchQuery} />
        )}
        {activeTab === 'calculator' && (
          <CalculatorTab state={state} setState={setState} saveBudget={saveBudget} searchQuery={searchQuery} />
        )}
	{activeTab === 'todo' && (
  	<TodoTab />
	)}
        {activeTab === 'editor' && (
          <EditorTab state={state} setState={setState} saveBudget={saveBudget} searchQuery={searchQuery} />
        )}
      </div>

      <ArchivedDrawer
        isOpen={isArchiveDrawerOpen}
        onClose={() => setIsArchiveDrawerOpen(false)}
        archivedItems={state.archived || []}
        onRestore={handleRestoreArchived}
        onDelete={handleDeleteArchived}
      />

      <StatementScanner
        isOpen={isStatementScannerOpen}
        onClose={() => setIsStatementScannerOpen(false)}
        onImport={handleStatementImport}
      />

      {/* Export Dialog */}
      {showExportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 overflow-y-auto px-4 py-6">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl max-h-[calc(100vh-3rem)] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Export Budget</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filename
              </label>
              <input
                type="text"
                value={exportFilename}
                onChange={(e) => setExportFilename(e.target.value)}
                placeholder="budget-data"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">.json will be added automatically</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowExportDialog(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExportJSON}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetDashboard;