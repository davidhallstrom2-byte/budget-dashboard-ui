// src/components/tabs/EditorTab.jsx
import React from "react";
import { CheckCircle, Plus, ArchiveRestore, Archive } from "lucide-react";

export default function EditorTab({
  importRef, handleImport, handleExport, budgetData, sectionLabel,
  newItemForm, setNewItemForm, showAddForm, setShowAddForm, addNewItem,
  updateName, updateExpense, updateActual, updateDueDate, markAsPaid, toggleArchive, deleteItem,
}) {
  return (
    <div className="space-y-6">
      <input ref={importRef} type="file" accept="application/json" className="hidden" onChange={(e) => handleImport(e.target.files[0])} />
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-blue-900">Quick Add New Item</h3>
          <button onClick={() => setShowAddForm(!showAddForm)} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center">
            <Plus className="h-4 w-4 mr-1" /> {showAddForm ? "Cancel" : "Add New Item"}
          </button>
        </div>
        {showAddForm && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={newItemForm.category} onChange={(e) => setNewItemForm((p) => ({ ...p, category: e.target.value }))} className="w-full p-2 border rounded-md">
                <option value="">Select category</option>
                <option value="income">Income</option>
                <option value="housing">Housing</option>
                <option value="transportation">Transportation</option>
                <option value="food">Food</option>
                <option value="personal">Personal</option>
                <option value="homeOffice">Home Office</option>
                <option value="banking">Banking & Credit</option>
                <option value="misc">Miscellaneous</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
              <input type="text" value={newItemForm.itemName} onChange={(e) => setNewItemForm((p) => ({ ...p, itemName: e.target.value }))} placeholder="e.g., Netflix, Gas, Salary" className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Amount ($)</label>
              <input type="number" value={newItemForm.amount} onChange={(e) => setNewItemForm((p) => ({ ...p, amount: e.target.value }))} placeholder="0.00" step="0.01" className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
              <input type="date" value={newItemForm.dueDate} onChange={(e) => setNewItemForm((p) => ({ ...p, dueDate: e.target.value }))} className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Annual Subscription ($)</label>
              <input type="number" value={newItemForm.annualSub} onChange={(e) => setNewItemForm((p) => ({ ...p, annualSub: e.target.value }))} placeholder="Leave blank if none" step="0.01" className="w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div className="flex items-end">
              <button onClick={addNewItem} className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 mr-1" /> Add Item
              </button>
            </div>
          </div>
        )}
      </div>

      {Object.keys(budgetData).map((k) => (
        <div key={k} className="bg-white p-6 rounded-2xl border shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold capitalize">{sectionLabel(k)}</h3>
            <div className="text-sm text-gray-600">
              Total (excludes archived): <span className="font-semibold">
                ${budgetData[k].filter(i=>!i.archived).reduce((s, i) => s + (i.estBudget || 0), 0).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {budgetData[k].length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No items in this category</p>
                <p className="text-sm">Use the Quick Add section above to add items</p>
              </div>
            )}

            {budgetData[k].map((item, idx) => (
              <div key={idx} className={`p-4 rounded-xl border transition-colors ${ item.archived ? "bg-gray-100 border-dashed opacity-70" : item.bankSource === "Paid" ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200 hover:border-gray-300" }`}>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-center">
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Item Name</label>
                    <input type="text" value={item.category} onChange={(e) => updateName(k, idx, e.target.value)} className="w-full p-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={item.archived}/>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Budget ($)</label>
                    <input type="number" value={item.estBudget} onChange={(e) => updateExpense(k, idx, e.target.value)} className="w-full p-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" step="0.01" disabled={item.archived}/>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Actual ($)</label>
                    <input type="number" value={item.actualSpent} onChange={(e) => updateActual(k, idx, e.target.value)} className="w-full p-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" step="0.01" disabled={item.archived}/>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Due Date</label>
                    <input type="date" value={item.dueDate || ""} onChange={(e) => updateDueDate(k, idx, e.target.value)} className="w-full p-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent" disabled={item.archived}/>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Actions</label>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => markAsPaid(k, idx)} className={`px-3 py-1 rounded text-xs font-medium ${ item.bankSource === "Paid" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700 hover:bg-blue-200" }`} disabled={item.archived}>
                        {item.bankSource === "Paid" ? "âœ“ Paid" : "Mark Paid"}
                      </button>
                      <button onClick={() => toggleArchive(k, idx)} className="px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200" title={item.archived ? "Unarchive" : "Archive"}>
                        {item.archived ? <ArchiveRestore className="inline h-3 w-3 mr-1" /> : <Archive className="inline h-3 w-3 mr-1" /> }
                        {item.archived ? "Unarchive" : "Archive"}
                      </button>
                      <button onClick={() => deleteItem(k, idx)} className="px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
                {item.archived && <p className="mt-2 text-xs text-gray-500">Archived items are hidden from totals and charts.</p>}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <label className="px-4 py-2 bg-gray-100 rounded-md inline-flex items-center gap-2 cursor-pointer">
              <input type="file" accept="application/json" className="hidden" onChange={(e) => handleImport(e.target.files[0])} />
              Import JSON
            </label>
            <button onClick={handleExport} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Export JSON (Ctrl+S)</button>
            <button onClick={() => importRef.current?.click()} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Open Import (Ctrl+I)</button>
          </div>
        </div>
      ))}
    </div>
  );
}


