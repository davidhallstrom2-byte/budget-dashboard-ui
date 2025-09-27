import { useState, useRef } from 'react';
import { useBudgetState } from '../../utils/state';
import { Plus, Trash2, GripVertical } from 'lucide-react';

export default function EditorTab() {
  const [activeSection, setActiveSection] = useState('income');
  const sectionRefs = useRef({});

  const store = useBudgetState();
  const addRow = store.addRow;
  const updateRow = store.updateRow;
  const removeRow = store.removeRow;

  const sections = [
    { id: 'income', label: 'Income', color: 'bg-green-500' },
    { id: 'housing', label: 'Housing', color: 'bg-blue-500' },
    { id: 'transportation', label: 'Transportation', color: 'bg-purple-500' },
    { id: 'food', label: 'Food', color: 'bg-orange-500' },
    { id: 'personal', label: 'Personal', color: 'bg-pink-500' },
    { id: 'homeOffice', label: 'Home/Office', color: 'bg-indigo-500' },
    { id: 'banking', label: 'Banking', color: 'bg-yellow-500' },
    { id: 'misc', label: 'Miscellaneous', color: 'bg-gray-500' }
  ];

  const handleAddRow = (section) => {
    addRow(section, {
      category: '',
      estBudget: 0,
      actualCost: 0,
      dueDate: '',
      status: 'pending'
    });
  };

  const handleUpdateRow = (section, id, field, value) => {
    updateRow(section, id, { [field]: value });
  };

  const handleRemoveRow = (section, id) => {
    if (confirm('Delete this row?')) {
      removeRow(section, id);
    }
  };

  const scrollToSection = (sectionId) => {
    setActiveSection(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const getSectionData = (sectionId) => {
    return store.buckets?.[sectionId] || [];
  };

  const getSectionTotals = (sectionId) => {
    const items = getSectionData(sectionId);
    const budgeted = items.reduce((sum, item) => sum + (item.estBudget || 0), 0);
    const actual = items.reduce((sum, item) => sum + (item.actualCost || 0), 0);
    return { budgeted, actual };
  };

  return (
    <div className="space-y-6">
      {/* Section Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex gap-2 flex-wrap">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeSection === section.id
                  ? `${section.color} text-white`
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section Tables */}
      {sections.map((section) => {
        const data = getSectionData(section.id);
        const totals = getSectionTotals(section.id);

        return (
          <div
            key={section.id}
            ref={(el) => (sectionRefs.current[section.id] = el)}
            className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
          >
            {/* Section Header */}
            <div className={`${section.color} text-white px-6 py-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{section.label}</h3>
                  <p className="text-sm opacity-90">
                    Budget: ${totals.budgeted.toFixed(2)} | Actual: ${totals.actual.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => handleAddRow(section.id)}
                  className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-sm font-medium">Add Row</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Est. Budget</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Actual Cost</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Due Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-slate-500">
                        No items. Click "Add Row" to get started.
                      </td>
                    </tr>
                  ) : (
                    data.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <GripVertical className="h-4 w-4 text-slate-400 cursor-move" />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={row.category || ''}
                            onChange={(e) => handleUpdateRow(section.id, row.id, 'category', e.target.value)}
                            className="w-full px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Category name"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={row.estBudget || 0}
                            onChange={(e) => handleUpdateRow(section.id, row.id, 'estBudget', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            step="0.01"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={row.actualCost || 0}
                            onChange={(e) => handleUpdateRow(section.id, row.id, 'actualCost', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            step="0.01"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="date"
                            value={row.dueDate || ''}
                            onChange={(e) => handleUpdateRow(section.id, row.id, 'dueDate', e.target.value)}
                            className="w-36 px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={row.status || 'pending'}
                            onChange={(e) => handleUpdateRow(section.id, row.id, 'status', e.target.value)}
                            className="px-2 py-1 border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleRemoveRow(section.id, row.id)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                            title="Delete row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}