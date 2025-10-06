// src/components/modern/SpendingTrendsChart.jsx
import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function SpendingTrendsChart({ state }) {
  const buckets = state?.buckets || {};
  const sum = (arr, key) => (arr || []).reduce((s, x) => s + (Number(x?.[key]) || 0), 0);

  // Generate last 6 months of trend data
  const trendData = useMemo(() => {
    const months = [];
    const today = new Date();
    
    // Get current totals
    const currentIncome = sum(buckets.income, 'actualCost') || sum(buckets.income, 'estBudget');
    const currentExpenses = Object.keys(buckets)
      .filter(k => k !== 'income')
      .reduce((total, key) => total + (sum(buckets[key], 'actualCost') || sum(buckets[key], 'estBudget')), 0);

    // Simulate last 6 months with slight variations
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });
      
      // Add realistic variance (-10% to +10%)
      const variance = 0.9 + (Math.random() * 0.2);
      const income = Math.round(currentIncome * variance);
      const expenses = Math.round(currentExpenses * variance);
      
      months.push({
        month: monthName,
        income,
        expenses,
        net: income - expenses
      });
    }

    // Override last month with actual current data
    months[months.length - 1] = {
      month: today.toLocaleDateString('en-US', { month: 'short' }),
      income: currentIncome,
      expenses: currentExpenses,
      net: currentIncome - currentExpenses
    };

    return months;
  }, [buckets]);

  // Calculate trends
  const trends = useMemo(() => {
    if (trendData.length < 2) return { income: 0, expenses: 0, net: 0 };

    const first = trendData[0];
    const last = trendData[trendData.length - 1];

    return {
      income: last.income - first.income,
      expenses: last.expenses - first.expenses,
      net: last.net - first.net
    };
  }, [trendData]);

  const getTrendIcon = (value) => {
    if (value > 0) return <TrendingUp className="w-4 h-4" />;
    if (value < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = (value, isIncome = false) => {
    if (isIncome) {
      return value > 0 ? 'text-green-600' : value < 0 ? 'text-red-600' : 'text-gray-600';
    }
    return value < 0 ? 'text-green-600' : value > 0 ? 'text-red-600' : 'text-gray-600';
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">6-Month Spending Trends</h3>
        <div className="flex gap-4 text-sm">
          <div className={`flex items-center gap-1 ${getTrendColor(trends.income, true)}`}>
            {getTrendIcon(trends.income)}
            <span className="font-medium">
              Income: {trends.income > 0 ? '+' : ''}${Math.abs(trends.income).toFixed(0)}
            </span>
          </div>
          <div className={`flex items-center gap-1 ${getTrendColor(trends.expenses)}`}>
            {getTrendIcon(trends.expenses)}
            <span className="font-medium">
              Expenses: {trends.expenses > 0 ? '+' : ''}${Math.abs(trends.expenses).toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip 
            formatter={(value) => `$${Number(value).toFixed(2)}`}
            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px' }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="income" 
            stroke="#10B981" 
            strokeWidth={2} 
            name="Income"
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="expenses" 
            stroke="#EF4444" 
            strokeWidth={2} 
            name="Expenses"
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="net" 
            stroke="#3B82F6" 
            strokeWidth={2} 
            name="Net Income"
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-900">
          <strong>Note:</strong> Trend data is simulated based on current budget. Future updates will track actual monthly history.
        </p>
      </div>
    </div>
  );
}