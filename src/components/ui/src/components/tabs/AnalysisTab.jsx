// src/components/tabs/AnalysisTab.jsx
import React, { useRef, useState } from "react";
import PageContainer from "../common/PageContainer";
import TabPageHeader, { TAB_HEADER_ACTION_CLASS } from "../common/TabPageHeader.jsx";
import FinancialHealthCard from "../modern/FinancialHealthCard";
import HealthRecommendations from "../modern/HealthRecommendations";
import SpendingTrendsChart from "../modern/SpendingTrendsChart";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, DollarSign, BarChart3, Target, CreditCard, PiggyBank, Activity } from 'lucide-react';

export default function AnalysisTab({ state, searchQuery }) {
  const [activeSection, setActiveSection] = useState('overview');
  const overviewRef = useRef(null);
  const spendingRef = useRef(null);
  const categoryRef = useRef(null);
  const trendsRef = useRef(null);
  const detailsRef = useRef(null);

  const scrollToSection = (ref, sectionId) => {
    setActiveSection(sectionId);
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
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
      if (cat.actual > cat.budgeted) insights.push({ type: 'warning', message: `${cat.name} is over budget by $${(cat.actual - cat.budgeted).toFixed(2)}` });
    });
    if (savingsRate < 10) insights.push({ type: 'alert', message: 'Low savings rate, consider reducing discretionary spending' });
    else if (savingsRate > 20) insights.push({ type: 'success', message: 'Great savings rate! You are on track for goals' });
    if (expenseRatio > 90) insights.push({ type: 'alert', message: 'High expense ratio, limited buffer' });
    return insights;
  };

  const insights = getSpendingInsights();

  return (
    <PageContainer surfaceClassName="min-h-screen bg-cyan-50" className="flex flex-col gap-6 bg-cyan-50 pb-6">
      <TabPageHeader
        icon={Activity}
        title="Analysis"
        subtitle="Review financial health, spending patterns, category performance, trends, and detailed budget results."
        theme="cyan"
        className="budget-mobile-header"
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-1.5 xl:gap-2">
            {[
              { id: 'overview', label: 'Health', title: 'Jump to financial health', icon: Activity },
              { id: 'spending', label: 'Spending', title: 'Jump to spending overview', icon: DollarSign },
              { id: 'category', label: 'Categories', title: 'Jump to category breakdown', icon: CreditCard },
              { id: 'trends', label: 'Trends', title: 'Jump to income and expense trends', icon: TrendingUp },
              { id: 'details', label: 'Details', title: 'Jump to detailed analysis', icon: BarChart3 },
            ].map((section) => {
              const refs = { overview: overviewRef, spending: spendingRef, category: categoryRef, trends: trendsRef, details: detailsRef };
              const SectionIcon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => scrollToSection(refs[section.id], section.id)}
                  title={section.title}
                  aria-label={section.title}
                  aria-pressed={isActive}
                  className={`${TAB_HEADER_ACTION_CLASS} !w-full !min-w-0 !px-2 !text-xs ${
                    isActive
                      ? 'border-white/50 bg-white text-cyan-950 shadow-md'
                      : 'border-white/30 bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  <SectionIcon className="h-4 w-4" aria-hidden="true" />
                  <span>{section.label}</span>
                </button>
              );
            })}
          </div>
        }
      />

      <div ref={overviewRef} className="grid grid-cols-1 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-3">
            <h3 className="text-lg font-bold">Financial Health Score</h3>
          </div>
          <div className="bg-white p-6">
            <FinancialHealthCard buckets={buckets} />
          </div>
        </div>
      </div>

      <div ref={spendingRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-3">
            <h3 className="text-lg font-bold">Spending Overview</h3>
          </div>
          <div className="bg-white p-4">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                <p className="text-xs text-blue-600 font-medium">Savings Rate</p>
                <p className="text-2xl font-bold text-blue-900">{savingsRate}%</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
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
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-3">
            <h3 className="text-lg font-bold">Personalized Recommendations</h3>
          </div>
          <div className="bg-white p-4">
            <HealthRecommendations buckets={buckets} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div ref={categoryRef} className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-3">
            <h3 className="text-lg font-bold">Spending by Category</h3>
          </div>
          <div className="bg-white p-6">
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
        </div>

        <SpendingTrendsChart state={state} />

        <div ref={trendsRef} className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-3">
            <h3 className="text-lg font-bold">Income vs Expenses Trend</h3>
          </div>
          <div className="bg-white p-6">
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
        </div>

        <div ref={detailsRef} className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-3">
            <h3 className="text-lg font-bold">Detailed Category Analysis</h3>
          </div>
          <div className="bg-white p-6">
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
      </div>
    </PageContainer>
  );
}
