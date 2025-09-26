import { useState, useRef } from 'react';
import { useBudgetState } from '../../utils/state';
import { Plus, Trash2, GripVertical, Archive, Upload, Download } from 'lucide-react';

export default function EditorTab() {
  const [activeSection, setActiveSection] = useState('income');
  const sectionRefs = useRef({});
  
  // Subscribe to the entire store
  const store = useBudgetState();
  const buckets = store.buckets || {};
  const addRow = store.addRow;
  const updateRow = store.updateRow;
  const removeRow = store.removeRow;
  const archiveCurrent = store.archiveCurrent;
  const restoreArchive = store.restoreArchive;
  const importFromJson = store.importFromJson;
  const exportToJson = store.exportToJson;

  const sections = [
    { id: 'income', label: 'Income', color: 'bg-green-500' },
    { id: 'housing', label: 'Housing', color: 'bg-blue-500' },
    { id: 'transportation', label: 'Transportation', color: 'bg-purple-500' },
    { id: 'food', label: 'Food', color: 'bg-orange-500' },
    { id: 'personal', label: 'Personal', color: 'bg-pink-500' },
    { id: 'homeOffice', label: 'Home/Office', color: 'bg-indigo-500' },
    { id: 'banking', label: 'Banking', color: 'bg-teal-500' },
    { id: 'misc', label: 'Miscellaneous', color: 'bg-gray-500' }
  ];

  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleAddRow = (sectionId) => {
    addRow(sectionId, {
      category: '',
      estBudget: 0,
      actualCost: 0,
      dueDate: '',
      status: 'pending'
    });
  };

  const handleUpdateRow = (sectionId, rowId, field, value) => {
    updateRow(sectionId, rowId, { [field]: value });
  };

  const handleRemoveRow = (sectionId, rowId) => {
    if (confirm('Delete this row?')) {
      removeRow(sectionId, rowId);
    }
  };

  const handleMarkPaid = (sectionId, rowId, row) => {
    updateRow(sectionId, rowId, { 
      status: row.status === 'paid' ? 'pending' : 'paid',
      actualCost: row.status === 'paid' ? 0 : row.estBudget
    });
  };

  const handleArchive = () => {
    const label = prompt('Archive label:', `Archive ${new Date().toLocaleDateString()}`);
    if (label) {
      archiveCurrent(label);
      alert('Archive saved to localStorage');
    }
  };

  const handleRestore = () => {
    if (confirm('Restore from archive? This will overwrite current data.')) {
      restoreArchive();
      alert('Archive restored');
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
        e.target.value = '';
      } catch (err) {
        alert('Import failed: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      {/* Quick Nav Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className={`
              px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors
              ${activeSection === section.id
                ? `${section.color} text-white`
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }
            `}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Global Actions */}
      <div className="flex gap-2 justify-end flex-wrap">
        <button
          onClick={handleArchive}
          className="flex items-center gap-2 px-3 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors"
        >
          <Archive className="h-4 w-4" />
          Archive
        </button>
        <button
          onClick={handleRestore}
          className="px-3 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors"
        >
          Restore
        </button>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
        <label className="flex items-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors cursor-pointer">
          <Upload className="h-4 w-4" />
          Import
          <input
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </label>
      </div>

      {/* All Sections */}
      <div className="space-y-6">
        {sections.map((section) => {
          const rows = buckets[section.id] || [];
          const sectionTotal = rows.reduce((sum, row) => sum + (row.actualCost || 0), 0);
          const sectionBudget = rows.reduce((sum, row) => sum + (row.estBudget || 0), 0);

          return (
            <div
              key={section.id}
              ref={(el) => (sectionRefs.current[section.id] = el)}
              className="bg-white rounded-lg border border-slate-200 overflow-hidden"
            >
              {/* Section Header */}
              <div className={`${section.color} px-6 py-4 flex items-center justify-between`}>
                <div className="text-white">
                  <h3 className="text-lg font-semibold">{section.label}</h3>
                  <p className="text-sm opacity-90">
                    Budget: ${sectionBudget.toFixed(2)} | Actual: ${sectionTotal.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => handleAddRow(section.id)}
                  className="flex items-center gap-2 px-3 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Row
                </button>
              </div>

              {/* Section Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-8"></th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Est. Budget</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Actual Cost</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Due Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {rows.length > 0 ? (
                      rows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <GripVertical className="h-4 w-4 text-slate-400 cursor-move" />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              value={row.category || ''}
                              onChange={(e) => handleUpdateRow(section.id, row.id, 'category', e.target.value)}
                              className="w-full px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter category"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={row.estBudget || 0}
                              onChange={(e) => handleUpdateRow(section.id, row.id, 'estBudget', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number"
                              value={row.actualCost || 0}
                              onChange={(e) => handleUpdateRow(section.id, row.id, 'actualCost', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="date"
                              value={row.dueDate || ''}
                              onChange={(e) => handleUpdateRow(section.id, row.id, 'dueDate', e.target.value)}
                              className="px-2 py-1 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleMarkPaid(section.id, row.id, row)}
                              className={`
                                px-3 py-1 rounded text-xs font-medium transition-colors
                                ${row.status === 'paid'
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                }
                              `}
                            >
                              {row.status === 'paid' ? 'Paid' : 'Pending'}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => handleRemoveRow(section.id, row.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                          No rows yet. Click "Add Row" to get started.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Section Summary */}
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-3">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-slate-600">Total Rows</p>
                    <p className="text-lg font-bold text-slate-900">{rows.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Budgeted</p>
                    <p className="text-lg font-bold text-blue-600">${sectionBudget.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">Spent</p>
                    <p className={`text-lg font-bold ${sectionTotal > sectionBudget ? 'text-red-600' : 'text-green-600'}`}>
                      ${sectionTotal.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}