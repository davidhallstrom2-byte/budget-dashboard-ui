import { useBudgetState } from '../../utils/state';
import { Download, Upload, RotateCcw, Calendar } from 'lucide-react';

export default function Toolbar() {
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
    <div className="flex items-center gap-3">
      {/* Date Display */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
        <Calendar className="h-4 w-4 text-slate-600" />
        <span className="text-sm font-medium text-slate-700">{asOfDate}</span>
      </div>

      {/* Reload Data */}
      <button
        onClick={handleReload}
        className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        title="Reload data from restore file"
      >
        <RotateCcw className="h-4 w-4" />
        <span className="text-sm font-medium">Reload</span>
      </button>

      {/* Export */}
      <button
        onClick={handleExport}
        className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        title="Export to JSON"
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
  );
}