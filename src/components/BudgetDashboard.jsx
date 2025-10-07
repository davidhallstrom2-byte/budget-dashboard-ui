// src/components/BudgetDashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { initializeState, saveToServer } from '../utils/state.js';
import LoadingGate from './common/LoadingGate';
import DashboardTab from './tabs/DashboardTab';
import AnalysisTab from './tabs/AnalysisTab';
import CalculatorTab from './tabs/CalculatorTab';
import EditorTab from './tabs/EditorTab';
import ArchivedDrawer from './ui/ArchivedDrawer';
import StickyToolbar from './common/StickyToolbar.jsx';
import StatementScanner from './statements/StatementScanner';
import NotificationPanel from './modern/NotificationPanel';

const BudgetDashboard = () => {
  const [state, setState] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isArchiveDrawerOpen, setIsArchiveDrawerOpen] = useState(false);
  const [isStatementScannerOpen, setIsStatementScannerOpen] = useState(false);

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
    { id: 'analysis',  label: 'Analysis',  bgColor: 'bg-purple-100' },
    { id: 'calculator',label: 'Calculator',bgColor: 'bg-green-100' },
    { id: 'editor',    label: 'Editor',    bgColor: 'bg-orange-100' }
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

    const currentDate = new Date(item.dueDate + 'T00:00:00');
    let newDate;
    
    if (bucket === 'subscriptions') {
      newDate = new Date(currentDate);
      newDate.setFullYear(newDate.getFullYear() + 1);
    } else {
      newDate = new Date(currentDate);
      newDate.setMonth(newDate.getMonth() + 1);
    }

    const previousState = { dueDate: item.dueDate, status: item.status, actualCost: item.actualCost };

    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map(it =>
        it.id === id ? { ...it, status: 'paid', dueDate: newDate.toISOString().split('T')[0], previousState } : it
      )
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    saveBudget(updatedState, 'Item marked as paid!');
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
<div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 h-auto sm:h-14 py-3 sm:py-0">
  <div className="flex items-center space-x-1 flex-1 min-w-0">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
          activeTab === tab.id
            ? 'bg-black text-white'
            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
        }`}
        aria-pressed={activeTab === tab.id}
      >
        {tab.label}
      </button>
    ))}
    
    <NotificationPanel
      state={state}
      onMarkPaid={handleMarkPaidFromNotification}
    />
  </div>

  <div className="flex items-center gap-2 flex-wrap">
    <button
      onClick={() => setIsStatementScannerOpen(true)}
      className="px-3 sm:px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors flex items-center gap-2 text-sm"
      title="Scan Credit Card or Bank Statement"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span className="hidden sm:inline">Scan Statement</span>
    </button>

    <button
      onClick={() => setIsArchiveDrawerOpen(true)}
      className="px-3 sm:px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2 text-sm"
      title="Open Archives"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
      </svg>
      <span className="hidden sm:inline">Archives ({state.archived?.length || 0})</span>
      <span className="sm:hidden">({state.archived?.length || 0})</span>
    </button>

    <button
      onClick={() => saveBudget()}
      disabled={isSaving}
      className={`px-3 sm:px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
        isSaving ? 'bg-gray-400 text-white cursor-not-allowed'
                 : 'bg-blue-500 text-white hover:bg-blue-600'
      }`}
      title="Save Budget"
    >
      {isSaving ? (
        <>
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="hidden sm:inline">Saving...</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          <span className="hidden sm:inline">Save Budget</span>
        </>
      )}
    </button>
  </div>
</div>      </StickyToolbar>

      <div className={`${activeTabConfig?.bgColor || 'bg-white'} min-h-screen`}>
        {activeTab === 'dashboard' && (
          <DashboardTab state={state} setState={setState} saveBudget={saveBudget} />
        )}
        {activeTab === 'analysis' && (
          <AnalysisTab state={state} setState={setState} saveBudget={saveBudget} />
        )}
        {activeTab === 'calculator' && (
          <CalculatorTab state={state} setState={setState} saveBudget={saveBudget} />
        )}
        {activeTab === 'editor' && (
          <EditorTab state={state} setState={setState} saveBudget={saveBudget} />
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
    </div>
  );
};

export default BudgetDashboard;