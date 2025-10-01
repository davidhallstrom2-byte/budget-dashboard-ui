import { useState } from 'react';
import { useBudgetState } from '../utils/state';
import LoadingGate from './common/LoadingGate';
import ModernBudgetPanel from './modern/ModernBudgetPanel';
import EditorTab from './tabs/EditorTab';
import AnalysisTab from './tabs/AnalysisTab';
import CalculatorTab from './tabs/CalculatorTab';
import { DollarSign, TrendingUp, TrendingDown, Calendar, RotateCcw, Download, Upload, Save, X } from 'lucide-react';

export default function BudgetDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showSaveInstructions, setShowSaveInstructions] = useState(false);

  // Read from computeTotals()
  const { totalIncome, totalExpenses, netIncome } = useBudgetState((state) => {
    const totals = state.computeTotals();
    return {
      totalIncome: totals.totalIncome || 0,
      totalExpenses: totals.totalExpenses || 0,
      netIncome: totals.netIncome || 0
    };
  });

  // Get store methods for toolbar
  const reloadData = useBudgetState((state) => state.reloadData);
  const exportToJson = useBudgetState((state) => state.exportToJson);
  const importFromJson = useBudgetState((state) => state.importFromJson);
  const asOfDate = useBudgetState((state) => state.meta?.asOfDate || 'N/A');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'analysis', label: 'Analysis' },
    { id: 'calculator', label: 'Calculator' },
    { id: 'editor', label: 'Editor' }
  ];

  const handleSave = () => {
    const data = exportToJson();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget-data.json';
    a.click();
    URL.revokeObjectURL(url);
    setShowSaveInstructions(true);
  };

  const handleReload = async () => {
    if (confirm('Reload data from restore file? This may overwrite current changes.')) {
      await reloadData();
      alert('Data reloaded');
    }
  };

  const handleExport = () => {
    const data = exportToJson();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `budget-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert('Export complete');
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        importFromJson(data);
        alert('Import successful');
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <LoadingGate>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* Sticky Combined Toolbar */}
        <div className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Title Row */}
            <div className="py-4 flex items-center justify-between border-b border-slate-100">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Budget Dashboard</h1>
                <p className="text-sm text-slate-600 mt-1">Period: {asOfDate}</p>
              </div>
              <div className="flex items-center gap-3 relative">
                {/* Date Display */}
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
                  <Calendar className="h-4 w-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">{asOfDate}</span>
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  title="Save changes permanently"
                >
                  <Save className="h-4 w-4" />
                  <span className="text-sm font-medium">Save Budget</span>
                </button>

                {/* Reload Button */}
                <button
                  onClick={handleReload}
                  className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="text-sm font-medium">Reload</span>
                </button>

                {/* Export Button */}
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span className="text-sm font-medium">Export</span>
                </button>

                {/* Import Button */}
                <label className="flex items-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors cursor-pointer">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm font-medium">Import</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>

                {/* Save Instructions Modal */}
                {showSaveInstructions && (
                  <div className="absolute top-full right-0 mt-2 w-[500px] bg-white border border-blue-200 rounded-lg shadow-xl z-50 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-semibold text-gray-900">File Downloaded: budget-data.json</h4>
                      <button
                        onClick={() => setShowSaveInstructions(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X size={18} />
                      </button>
                    </div>
                    
                    <div className="space-y-3 text-sm">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="font-medium text-blue-900 mb-2">To make changes permanent:</p>
                        <ol className="list-decimal list-inside space-y-1.5 text-blue-800">
                          <li>Find <code className="bg-blue-100 px-1 rounded font-mono text-xs">budget-data.json</code> in Downloads</li>
                          <li>Copy to: <code className="bg-blue-100 px-1 rounded font-mono text-xs break-all">C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\public\restore\</code></li>
                          <li>Replace existing file</li>
                          <li>Refresh this page</li>
                        </ol>
                      </div>

                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-yellow-800 text-xs">
                          <strong>Quick PowerShell command:</strong>
                          <code className="block bg-yellow-100 px-2 py-1 rounded mt-1 font-mono text-xs break-all">
                            Copy-Item "$env:USERPROFILE\Downloads\budget-data.json" "C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\public\restore\budget-data.json" -Force
                          </code>
                        </p>
                      </div>

                      <button
                        onClick={() => setShowSaveInstructions(false)}
                        className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                      >
                        Got it!
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tabs Row */}
            <div className="flex items-center gap-1 pt-2 pb-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-2 rounded-t-lg font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-blue-600 border-t border-x border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* KPI Cards */}
          {activeTab !== 'editor' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Total Income */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 mb-1">Total Income</p>
                    <p className="text-3xl font-bold text-green-600">${totalIncome.toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-green-100 rounded-lg">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>

              {/* Total Expenses */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 mb-1">Total Expenses</p>
                    <p className="text-3xl font-bold text-red-600">${totalExpenses.toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-red-100 rounded-lg">
                    <TrendingDown className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </div>

              {/* Net Income */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-600 mb-1">Net Income</p>
                    <p className={`text-3xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${netIncome >= 0 ? '' : '-'}${Math.abs(netIncome).toFixed(2)}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${netIncome >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                    <DollarSign className={`h-6 w-6 ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab Content */}
          {activeTab === 'dashboard' && <ModernBudgetPanel />}
          {activeTab === 'analysis' && <AnalysisTab />}
          {activeTab === 'calculator' && <CalculatorTab />}
          {activeTab === 'editor' && <EditorTab />}
        </div>
      </div>
    </LoadingGate>
  );
}