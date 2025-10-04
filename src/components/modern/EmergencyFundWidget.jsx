import { useState } from 'react';
import { PiggyBank, TrendingUp, AlertCircle, Edit2, Check, X } from 'lucide-react';

export default function EmergencyFundWidget({ state, setState, saveBudget }) {
  const [isEditing, setIsEditing] = useState(false);
  const [targetMonths, setTargetMonths] = useState(state?.meta?.emergencyFund?.targetMonths || 6);
  const [currentAmount, setCurrentAmount] = useState(state?.meta?.emergencyFund?.currentAmount || 0);

  const buckets = state?.buckets || {};
  const sum = (arr, key) => (arr || []).reduce((s, x) => s + (Number(x?.[key]) || 0), 0);
  
  const monthlyExpenses = 
    sum(buckets.housing, 'estBudget') +
    sum(buckets.transportation, 'estBudget') +
    sum(buckets.food, 'estBudget') +
    sum(buckets.personal, 'estBudget') +
    sum(buckets.homeOffice, 'estBudget') +
    sum(buckets.banking, 'estBudget') +
    sum(buckets.subscriptions, 'estBudget') +
    sum(buckets.misc, 'estBudget');

  const targetAmount = monthlyExpenses * targetMonths;
  const progressPercentage = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
  const remainingAmount = Math.max(targetAmount - currentAmount, 0);
  const monthsCovered = monthlyExpenses > 0 ? currentAmount / monthlyExpenses : 0;

  const handleSave = () => {
    const updatedState = {
      ...state,
      meta: {
        ...state.meta,
        emergencyFund: {
          targetMonths: Number(targetMonths),
          currentAmount: Number(currentAmount)
        }
      }
    };
    setState(updatedState);
    saveBudget(updatedState, 'Emergency fund updated!');
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTargetMonths(state?.meta?.emergencyFund?.targetMonths || 6);
    setCurrentAmount(state?.meta?.emergencyFund?.currentAmount || 0);
    setIsEditing(false);
  };

  const getStatusColor = () => {
    if (progressPercentage >= 100) return 'text-green-600';
    if (progressPercentage >= 50) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getBarColor = () => {
    if (progressPercentage >= 100) return 'bg-green-500';
    if (progressPercentage >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getStatusMessage = () => {
    if (progressPercentage >= 100) return 'Fully Funded!';
    if (progressPercentage >= 50) return 'Making Progress';
    if (progressPercentage > 0) return 'Getting Started';
    return 'Not Started';
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <PiggyBank className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Emergency Fund</h3>
            <p className="text-sm text-gray-500">{targetMonths}-month safety net</p>
          </div>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Edit Emergency Fund"
          >
            <Edit2 className="w-4 h-4 text-gray-600" />
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="p-2 bg-green-100 hover:bg-green-200 rounded-lg transition-colors"
              title="Save"
            >
              <Check className="w-4 h-4 text-green-600" />
            </button>
            <button
              onClick={handleCancel}
              className="p-2 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
              title="Cancel"
            >
              <X className="w-4 h-4 text-red-600" />
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Current Amount Saved
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                step="0.01"
                min="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Months of Expenses
            </label>
            <input
              type="number"
              value={targetMonths}
              onChange={(e) => setTargetMonths(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min="1"
              max="12"
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-end gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Current Savings</p>
              <p className="text-3xl font-bold text-gray-900">
                ${currentAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="mb-1">
              <p className="text-sm text-gray-500">of</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Target Amount</p>
              <p className="text-xl font-semibold text-gray-700">
                ${targetAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-semibold ${getStatusColor()}`}>
                {getStatusMessage()}
              </span>
              <span className="text-sm font-bold text-gray-900">
                {progressPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${getBarColor()}`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                <p className="text-xs text-blue-600 font-medium">Months Covered</p>
              </div>
              <p className="text-xl font-bold text-blue-900">
                {monthsCovered.toFixed(1)}
              </p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <p className="text-xs text-orange-600 font-medium">Remaining</p>
              </div>
              <p className="text-xl font-bold text-orange-900">
                ${remainingAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-2">
              <span className="font-semibold">Monthly Expenses:</span> ${monthlyExpenses.toFixed(2)}
            </p>
            {progressPercentage < 100 && remainingAmount > 0 && (
              <p className="text-xs text-gray-600">
                <span className="font-semibold">Tip:</span> Save ${(remainingAmount / 12).toFixed(2)}/month to reach your goal in 1 year
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}