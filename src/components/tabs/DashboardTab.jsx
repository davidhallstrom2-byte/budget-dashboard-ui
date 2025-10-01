// src/components/tabs/DashboardTab.jsx
import React, { useState } from 'react';
import PageContainer from '../common/PageContainer';
import {
  DollarSign, Home, Car, Utensils, User, Monitor, CreditCard, Repeat, Package,
  TrendingUp, TrendingDown, Activity, Printer
} from 'lucide-react';

const categoryIcons = {
  income: <TrendingUp className="h-5 w-5 text-green-600" />,
  housing: <Home className="h-5 w-5 text-blue-600" />,
  transportation: <Car className="h-5 w-5 text-purple-600" />,
  food: <Utensils className="h-5 w-5 text-orange-600" />,
  personal: <User className="h-5 w-5 text-pink-600" />,
  homeOffice: <Monitor className="h-5 w-5 text-indigo-600" />,
  banking: <CreditCard className="h-5 w-5 text-red-600" />,
  subscriptions: <Repeat className="h-5 w-5 text-teal-600" />,
  misc: <Package className="h-5 w-5 text-gray-600" />
};

export default function DashboardTab({ state }) {
  const [expandedCategories, setExpandedCategories] = useState({});
  const toggleCategory = (category) => setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  const handlePrint = () => window.print();

  const sum = (arr, field) => (arr || []).reduce((total, item) => total + (Number(item[field]) || 0), 0);

  const buckets = state?.buckets || {};
  const allCategories = Object.keys(buckets).filter(key => key !== 'income');

  const incomeItems = buckets.income || [];
  const totalIncome = sum(incomeItems, 'estBudget');

  let totalBudgeted = 0;
  let totalActual = 0;
  let totalItems = 0;

  const categoryData = allCategories.map(categoryKey => {
    const items = buckets[categoryKey] || [];
    const budgeted = sum(items, 'estBudget');
    const actual = sum(items, 'actualCost');
    const variance = actual - budgeted;
    totalBudgeted += budgeted;
    totalActual += actual;
    totalItems += items.length;
    return {
      key: categoryKey,
      name: categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1),
      items,
      itemCount: items.length,
      budgeted,
      actual,
      variance,
      percentUsed: budgeted > 0 ? (actual / budgeted) * 100 : 0
    };
  });

  const netIncome = totalIncome - totalBudgeted;
  const budgetVariance = totalBudgeted - totalActual;

  const today = new Date();
  const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const allItems = [];
  Object.keys(buckets).forEach(bucket => (buckets[bucket] || []).forEach(item => allItems.push({ ...item, bucket })));

  const overdueItems = allItems
    .filter(item => item.status !== 'paid' && new Date(item.dueDate) < today)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  const upcomingItems = allItems
    .filter(item => {
      if (item.status === 'paid') return false;
      const dueDate = new Date(item.dueDate);
      return dueDate >= today && dueDate <= sevenDaysFromNow;
    })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 5);

  const getStatusBadge = (item) => {
    if (item.status === 'paid') {
      return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">Paid</span>;
    }
    const diffDays = Math.ceil((new Date(item.dueDate) - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">{Math.abs(diffDays)}d overdue</span>;
    if (diffDays <= 5) return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">Due in {diffDays}d</span>;
    return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-semibold rounded">Pending</span>;
  };

  return (
    <PageContainer>
      {/* Header Bar — inherits page bg */}
      <div className="mb-4 bg-transparent">
        <div className="rounded-b-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <h2 className="text-2xl font-bold text-slate-800">Budget Dashboard</h2>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Monthly Income</p>
              <p className="text-3xl font-bold text-green-600">${totalIncome.toFixed(2)}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Total Expenses</p>
              <p className="text-3xl font-bold text-red-600">${totalActual.toFixed(2)}</p>
            </div>
            <TrendingDown className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Net Income</p>
              <p className={`text-3xl font-bold ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${netIncome >= 0 ? '' : '-'}${Math.abs(netIncome).toFixed(2)}
              </p>
            </div>
            <DollarSign className={`h-8 w-8 ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">Budget Variance</p>
              <p className={`text-3xl font-bold ${budgetVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${budgetVariance >= 0 ? '+' : ''}${budgetVariance.toFixed(2)}
              </p>
            </div>
            <Activity className={`h-8 w-8 ${budgetVariance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </div>
        </div>
      </div>

      {/* Alerts */}
      {(overdueItems.length > 0 || upcomingItems.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {overdueItems.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-900 mb-3">Overdue Items</h3>
              <div className="space-y-2">
                {overdueItems.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <span className="text-red-800 font-medium">{item.category}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-red-600">${(item.actualCost || item.estBudget).toFixed(2)}</span>
                      <span className="text-red-500 text-xs">{new Date(item.dueDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcomingItems.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-yellow-900 mb-3">Upcoming (Next 7 Days)</h3>
              <div className="space-y-2">
                {upcomingItems.map(item => (
                  <div key={item.id} className="flex justify-between items-center text-sm">
                    <span className="text-yellow-800 font-medium">{item.category}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-yellow-600">${(item.actualCost || item.estBudget).toFixed(2)}</span>
                      <span className="text-yellow-500 text-xs">{new Date(item.dueDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Category Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-8">
        <div className="bg-gray-800 text-white px-6 py-4">
          <h3 className="text-lg font-semibold">Category Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Items</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Budgeted</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actual</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Variance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {categoryData.map(category => (
                <React.Fragment key={category.key}>
                  <tr
                    onClick={() => toggleCategory(category.key)}
                    className="bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3 text-left">
                      <div className="flex items-center gap-2">
                        <svg className={`h-5 w-5 text-gray-600 transition-transform ${expandedCategories[category.key] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        {categoryIcons[category.key] || <Package className="h-5 w-5 text-gray-600" />}
                        <span className="font-semibold text-gray-900">{category.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-right text-gray-900 font-medium">{category.itemCount}</td>
                    <td className="px-6 py-3 text-right text-gray-900 font-medium">${category.budgeted.toFixed(2)}</td>
                    <td className="px-6 py-3 text-right text-gray-900 font-medium">${category.actual.toFixed(2)}</td>
                    <td className={`px-6 py-3 text-right font-medium ${category.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {category.variance > 0 ? '+' : ''}${category.variance.toFixed(2)}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${category.percentUsed > 100 ? 'bg-red-500' : category.percentUsed > 80 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(category.percentUsed, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 w-12 text-right">{category.percentUsed.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>

                  {expandedCategories[category.key] && category.items.map(item => (
                    <tr key={item.id} className="bg-gray-50">
                      <td className="px-6 py-2 pl-16 text-sm text-gray-700">{item.category}</td>
                      <td className="px-6 py-2 text-right text-sm text-gray-600">{new Date(item.dueDate).toLocaleDateString()}</td>
                      <td className="px-6 py-2 text-right text-sm text-gray-600">${(item.estBudget || 0).toFixed(2)}</td>
                      <td className="px-6 py-2 text-right text-sm text-gray-600">${(item.actualCost || 0).toFixed(2)}</td>
                      <td className={`px-6 py-2 text-right text-sm ${(item.actualCost - item.estBudget) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {(item.actualCost - item.estBudget) > 0 ? '+' : ''}${(item.actualCost - item.estBudget).toFixed(2)}
                      </td>
                      <td className="px-6 py-2 text-sm">{getStatusBadge(item)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}

              <tr className="bg-gray-200 font-bold">
                <td className="px-6 py-3 text-left text-gray-900">TOTAL</td>
                <td className="px-6 py-3 text-right text-gray-900">{totalItems}</td>
                <td className="px-6 py-3 text-right text-gray-900">${totalBudgeted.toFixed(2)}</td>
                <td className="px-6 py-3 text-right text-gray-900">${totalActual.toFixed(2)}</td>
                <td className={`px-6 py-3 text-right ${(totalActual - totalBudgeted) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {(totalActual - totalBudgeted) > 0 ? '+' : ''}${(totalActual - totalBudgeted).toFixed(2)}
                </td>
                <td className="px-6 py-3" />
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* All Budget Items */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-8">
        <div className="bg-gray-800 text-white px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">All Budget Items</h3>
          <button onClick={handlePrint} className="flex items-center gap-2 px-3 py-1 bg-white text-gray-800 rounded hover:bg-gray-100 transition-colors text-sm">
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Due Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Budgeted</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Actual</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">Variance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {allItems.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      {categoryIcons[item.bucket] || <Package className="h-5 w-5 text-gray-600" />}
                      <span className="text-sm font-medium text-gray-900 capitalize">{item.bucket}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900">{item.category}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{new Date(item.dueDate).toLocaleDateString()}</td>
                  <td className="px-6 py-3 text-sm text-gray-900 text-right">${(item.estBudget || 0).toFixed(2)}</td>
                  <td className="px-6 py-3 text-sm text-gray-900 text-right">${(item.actualCost || 0).toFixed(2)}</td>
                  <td className={`px-6 py-3 text-sm text-right ${(item.actualCost - item.estBudget) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {(item.actualCost - item.estBudget) > 0 ? '+' : ''}${(item.actualCost - item.estBudget).toFixed(2)}
                  </td>
                  <td className="px-6 py-3">{getStatusBadge(item)}</td>
                </tr>
              ))}

              <tr className="bg-gray-200 font-bold">
                <td colSpan="3" className="px-6 py-3 text-left text-gray-900">RUNNING TOTAL</td>
                <td className="px-6 py-3 text-right text-gray-900">${sum(allItems, 'estBudget').toFixed(2)}</td>
                <td className="px-6 py-3 text-right text-gray-900">${sum(allItems, 'actualCost').toFixed(2)}</td>
                <td className={`px-6 py-3 text-right ${(sum(allItems, 'actualCost') - sum(allItems, 'estBudget')) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {(sum(allItems, 'actualCost') - sum(allItems, 'estBudget')) > 0 ? '+' : ''}${(sum(allItems, 'actualCost') - sum(allItems, 'estBudget')).toFixed(2)}
                </td>
                <td className="px-6 py-3 text-gray-900">{allItems.length} items</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Total Budget Items</h4>
          <p className="text-2xl font-bold text-gray-900">{allItems.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Active Categories</h4>
          <p className="text-2xl font-bold text-gray-900">{categoryData.filter(c => c.itemCount > 0).length}</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-sm font-medium text-gray-600 mb-2">Savings Rate</h4>
          <p className="text-2xl font-bold text-gray-900">
            {totalIncome > 0 ? ((netIncome / totalIncome) * 100).toFixed(1) : '0.0'}%
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
