// src/components/ui/Toolbar.jsx
import { useState } from 'react';
import { useBudgetState } from '../../utils/state';
import { Download, Upload, RotateCcw, Calendar, Save, X } from 'lucide-react';

export default function Toolbar() {
  const [showSaveInstructions, setShowSaveInstructions] = useState(false);
  const reloadData = useBudgetState((state) => state.reloadData);
  const exportToJson = useBudgetState((state) => state.exportToJson);
  const importFromJson = useBudgetState((state) => state.importFromJson);
  const asOfDate = useBudgetState((state) => state.meta?.asOfDate || 'N/A');

  const handleReload = async () => {
    if (confirm('Reload data from restore file? This may overwrite current changes.')) {
      await reloadData();
      alert('✅ Data reloaded');
    }
  };

  const handleSave = () => {
    const data = exportToJson();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'budget-data.json';  // Fixed filename for restore
    a.click();
    URL.revokeObjectURL(url);
    setShowSaveInstructions(true);
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
    alert('✅ Export complete');
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        importFromJson(data);
        alert('✅ Import successful');
      } catch (err) {
        alert('❌ Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-3">
        {/* Date Display */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
          <Calendar className="h-4 w-4 text-slate-600" />
          <span className="text-sm font-medium text-slate-700">{asOfDate}</span>
        </div>

        {/* Save Budget (Persist Changes) */}
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          title="Save changes permanently"
        >
          <Save className="h-4 w-4" />
          <span className="text-sm font-medium">Save Budget</span>
        </button>

        {/* Reload Data */}
        <button
          onClick={handleReload}
          className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
          title="Reload data from restore file"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="text-sm font-medium">Reload</span>
        </button>

        {/* Export Backup */}
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          title="Export timestamped backup"
        >
          <Download className="h-4 w-4" />
          <span className="text-sm font-medium">Export</span>
        </button>

        {/* Import */}
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

      {/* Save Instructions Modal */}
      {showSaveInstructions && (
        <div className="absolute top-full mt-2 left-0 w-[500px] bg-white border border-blue-200 rounded-lg shadow-xl z-50 p-4">
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
                <code className="block bg-yellow-100 px-2 py-1 rounded mt-1 font-mono text-xs">
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
  );
}