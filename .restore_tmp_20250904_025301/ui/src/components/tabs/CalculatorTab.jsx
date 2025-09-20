// src/components/tabs/CalculatorTab.jsx
import React from "react";
import { Plus } from "lucide-react";

export default function CalculatorTab({ newIncomeAmount, setNewIncomeAmount, addIncome }) {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Income Calculator</h3>
        <div className="flex gap-4">
          <input type="number" value={newIncomeAmount} onChange={(e) => setNewIncomeAmount(e.target.value)} placeholder="Enter monthly income" className="flex-1 p-2 border rounded-md" />
          <button onClick={addIncome} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center">
            <Plus className="h-4 w-4 mr-1" /> Add Income
          </button>
        </div>
      </div>
    </div>
  );
}
