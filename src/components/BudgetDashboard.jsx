import { useState } from 'react';
import { useBudgetState } from '../utils/state';
import LoadingGate from './common/LoadingGate';
import ModernBudgetPanel from './modern/ModernBudgetPanel';
import EditorTab from './tabs/EditorTab';
import AnalysisTab from './tabs/AnalysisTab';
import CalculatorTab from './tabs/CalculatorTab';
import { DollarSign, TrendingUp, TrendingDown, Calendar, RotateCcw, Download, Upload } from 'lucide-react';

export default function BudgetDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard');

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
              <div className="flex items-center gap-3">
                {/* Date Display */}
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
                  <Calendar className="h-4 w-4 text-slate-600" />
                  <span className="text-sm font-medium text-slate-700">{asOfDate}</span>
                </div>

                {/* Reload Button */}
                <button
                  onClick={handleReload}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
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
              </div>
            </div>

            {/* Tab Navigation */}
            <nav className="flex -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    py-4 px-6 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
                    }
                  `}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Total Income Card */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Income</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">
                    ${totalIncome.toFixed(2)}
                  </p>
                </div>
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            {/* Total Expenses Card */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600 mt-2">
                    ${totalExpenses.toFixed(2)}
                  </p>
                </div>
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <TrendingDown className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </div>

            {/* Net Income Card */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Net Income</p>
                  <p className={`text-2xl font-bold mt-2 ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${netIncome.toFixed(2)}
                  </p>
                </div>
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${netIncome >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                  <DollarSign className={`h-6 w-6 ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                </div>
              </div>
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
            {activeTab === 'dashboard' && <ModernBudgetPanel />}
            {activeTab === 'analysis' && <AnalysisTab />}
            {activeTab === 'calculator' && <CalculatorTab />}
            {activeTab === 'editor' && <EditorTab />}
          </div>
        </div>
      </div>
    </LoadingGate>
  );
}