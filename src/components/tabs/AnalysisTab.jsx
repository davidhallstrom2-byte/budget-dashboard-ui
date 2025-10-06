// src/components/tabs/AnalysisTab.jsx
import React from "react";
import PageContainer from "../common/PageContainer";
import FinancialHealthCard from "../modern/FinancialHealthCard";
import HealthRecommendations from "../modern/HealthRecommendations";
import SpendingTrendsChart from "../modern/SpendingTrendsChart";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle } from 'lucide-react';

export default function AnalysisTab({ state }) {
  const buckets = state?.buckets || {};
  const sum = (arr, key) => (arr || []).reduce((s, x) => s + (Number(x?.[key]) || 0), 0);

  const totalIncome = sum(buckets.income, 'estBudget');
  const categoryKeys = Object.keys(buckets).filter(k => k !== 'income');
  const categoryTotals = {};
  categoryKeys.forEach(k => { categoryTotals[k] = sum(buckets[k], 'estBudget'); });

  const totalExpenses = categoryKeys.reduce((acc, k) => acc + (categoryTotals[k] || 0), 0);
  const netIncome = totalIncome - totalExpenses;

  const categoryData = categoryKeys
    .map((key) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
      budgeted: categoryTotals[key] || 0,
      actual: sum(buckets[key], 'actualCost'),
      percentage: totalExpenses > 0 ? ((categoryTotals[key] || 0) / totalExpenses * 100).toFixed(1) : 0
    }))
    .filter(row => row.budgeted > 0 || row.actual > 0)
    .sort((a, b) => b.budgeted - a.budgeted);

  const COLORS = ['#3B82F6','#EF4444','#F97316','#8B5CF6','#6366F1','#6B7280','#06B6D4','#EAB308','#10B981','#F43F5E'];
  const monthlyTrends = [{ month: 'Current', income: totalIncome, expenses: totalExpenses }];

  const savingsRate = totalIncome > 0 ? ((netIncome / totalIncome) * 100).toFixed(1) : 0;
  const expenseRatio = totalIncome > 0 ? ((totalExpenses / totalIncome) * 100).toFixed(1) : 0;

  const getSpendingInsights = () => {
    const insights = [];
    categoryData.forEach(cat => {
      if (cat.actual > cat.budgeted) insights.push({ type: 'warning', message: `${cat.name} is over budget by ${(cat.actual - cat.budgeted).toFixed(2)}` });
    });
    if (savingsRate < 10) insights.push({ type: 'alert', message: 'Low savings rate, consider reducing discretionary spending' });
    else if (savingsRate > 20) insights.push({ type: 'success', message: 'Great savings rate! You are on track for goals' });
    if (expenseRatio > 90) insights.push({ type: 'alert', message: 'High expense ratio, limited buffer' });
    return insights;
  };

  const insights = getSpendingInsights();

  return (
    <PageContainer className="py-6 space-y-6">
      <div className="bg-gradient-to-r from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl px-6 py-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Budget Analysis</h2>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <FinancialHealthCard buckets={buckets} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900 mb-4">Spending Overview</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-xs text-blue-600 font-medium">Savings Rate</p>
              <p className="text-2xl font-bold text-blue-900">{savingsRate}%</p>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <p className="text-xs text-purple-600 font-medium">Expense Ratio</p>
              <p className="text-2xl font-bold text-purple-900">{expenseRatio}%</p>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-slate-700">Quick Insights</h4>
            {insights.length > 0 ? (
              insights.slice(0, 3).map((insight, idx) => (
                <div key={idx} className={`flex items-start gap-2 p-2 rounded text-sm ${
                  insight.type === 'warning' ? 'bg-yellow-50' :
                  insight.type === 'alert' ? 'bg-red-50' :
                  'bg-green-50'
                }`}>
                  {insight.type === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />}
                  {insight.type === 'alert' && <TrendingDown className="w-4 h-4 text-red-600 mt-0.5" />}
                  {insight.type === 'success' && <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />}
                  <span className={`${insight.type === 'warning' ? 'text-yellow-800' : insight.type === 'alert' ? 'text-red-800' : 'text-green-800'}`}>
                    {insight.message}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600">No insights available</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900 mb-4">Personalized Recommendations</h3>
          <HealthRecommendations buckets={buckets} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Spending by Category</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Budget vs Actual</h4>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="budgeted" fill="#3B82F6" name="Budgeted" />
                  <Bar dataKey="actual" fill="#EF4444" name="Actual" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2">Distribution</h4>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" labelLine={false}
                       label={({ percentage }) => `${percentage}%`} outerRadius={80} dataKey="budgeted">
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <SpendingTrendsChart state={state} />

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Income vs Expenses Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#10B981" strokeWidth={2} name="Income" />
              <Line type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={2} name="Expenses" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Detailed Category Analysis</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Budgeted</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Actual</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Variance</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">% of Total</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-slate-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {categoryData.map((cat) => {
                  const variance = cat.budgeted - cat.actual;
                  const isOverBudget = variance < 0;
                  return (
                    <tr key={cat.name} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{cat.name}</td>
                      <td className="px-4 py-3 text-right text-slate-900">${cat.budgeted.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-slate-900">${cat.actual.toFixed(2)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
                        {isOverBudget ? '-' : ''}${Math.abs(variance).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{cat.percentage}%</td>
                      <td className="px-4 py-3 text-center">
                        {isOverBudget ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <TrendingUp className="w-3 h-3" />
                            Over
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <TrendingDown className="w-3 h-3" />
                            Under
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}