// src/components/tabs/AnalysisTab.jsx
import { useBudgetState } from '../../utils/state';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Target, Activity, DollarSign, Percent } from 'lucide-react';
import FinancialHealthCard from '../modern/FinancialHealthCard';
import HealthRecommendations from '../modern/HealthRecommendations';

export default function AnalysisTab() {
  const rows = useBudgetState((state) => state.rows || []);
  const buckets = useBudgetState((state) => state.buckets || {});
  const computeTotals = useBudgetState((state) => state.computeTotals);
  
  const totals = computeTotals();

  // Calculate category variance analysis (Budget vs Actual)
  const categoryVariance = Object.keys(buckets)
    .filter(key => key !== 'income')
    .map(categoryKey => {
      const items = buckets[categoryKey] || [];
      const budgeted = items.reduce((sum, item) => sum + (item.estBudget || 0), 0);
      const actual = items.reduce((sum, item) => sum + (item.actualCost || 0), 0);
      const variance = budgeted - actual;
      const variancePercent = budgeted > 0 ? ((variance / budgeted) * 100) : 0;
      const utilization = budgeted > 0 ? ((actual / budgeted) * 100) : 0;
      
      const categoryLabels = {
        housing: 'Housing',
        transportation: 'Transportation',
        food: 'Food',
        personal: 'Personal',
        homeOffice: 'Home/Office',
        banking: 'Banking',
        misc: 'Miscellaneous'
      };

      return {
        category: categoryLabels[categoryKey] || categoryKey,
        budgeted,
        actual,
        variance,
        variancePercent,
        utilization,
        status: variance >= 0 ? 'under' : 'over'
      };
    })
    .filter(item => item.budgeted > 0 || item.actual > 0);

  // Spending velocity (burn rate per day)
  const daysInMonth = 30;
  const dailyBurnRate = totals.totalExpenses / daysInMonth;

  // Budget utilization rate
  const budgetUtilization = totals.totalExpenses > 0 && totals.totalIncome > 0 
    ? (totals.totalExpenses / totals.totalIncome) * 100 
    : 0;

  // Top spending categories
  const topSpenders = [...categoryVariance]
    .sort((a, b) => b.actual - a.actual)
    .slice(0, 5);

  // Pie chart data
  const pieData = categoryVariance
    .filter(item => item.actual > 0)
    .map(item => ({
      name: item.category,
      value: item.actual
    }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  // Generate insights
  const insights = [];
  
  if (totals.netIncome < 0) {
    insights.push({
      type: 'critical',
      icon: AlertTriangle,
      title: 'Budget Deficit',
      message: `You're spending $${Math.abs(totals.netIncome).toFixed(2)} more than your income. Immediate action needed.`
    });
  }

  if (budgetUtilization > 100) {
    insights.push({
      type: 'warning',
      icon: TrendingDown,
      title: 'Overspending',
      message: `Budget utilization at ${budgetUtilization.toFixed(1)}%. You're spending beyond your means.`
    });
  } else if (budgetUtilization < 80 && totals.netIncome > 0) {
    insights.push({
      type: 'success',
      icon: CheckCircle,
      title: 'Under Budget',
      message: `Great! You're only using ${budgetUtilization.toFixed(1)}% of your income. Consider increasing savings.`
    });
  }

  categoryVariance.forEach(cat => {
    if (cat.status === 'over' && Math.abs(cat.variance) > 50) {
      insights.push({
        type: 'warning',
        icon: AlertTriangle,
        title: `${cat.category} Over Budget`,
        message: `$${Math.abs(cat.variance).toFixed(2)} over budget (${Math.abs(cat.variancePercent).toFixed(1)}%). Review spending in this category.`
      });
    }
  });

  if (totals.totalIncome === 0) {
    insights.push({
      type: 'critical',
      icon: DollarSign,
      title: 'No Income Recorded',
      message: 'Add your income sources to get accurate budget analysis.'
    });
  }

  return (
    <div className="space-y-6">
      {/* NEW: Enhanced Financial Health Score - Replaces basic score */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FinancialHealthCard totals={totals} buckets={buckets} />
        <HealthRecommendations totals={totals} buckets={buckets} />
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-600 mb-2">
            <Percent className="h-4 w-4" />
            <span className="text-sm font-medium">Budget Utilization</span>
          </div>
          <p className={`text-2xl font-bold ${
            budgetUtilization > 100 ? 'text-red-600' :
            budgetUtilization > 80 ? 'text-orange-600' :
            'text-green-600'
          }`}>
            {budgetUtilization.toFixed(1)}%
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-600 mb-2">
            <Activity className="h-4 w-4" />
            <span className="text-sm font-medium">Daily Burn Rate</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">${dailyBurnRate.toFixed(2)}</p>
          <p className="text-xs text-slate-500">per day</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-600 mb-2">
            <Target className="h-4 w-4" />
            <span className="text-sm font-medium">Categories Tracked</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{categoryVariance.length}</p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-600 mb-2">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm font-medium">Net Position</span>
          </div>
          <p className={`text-2xl font-bold ${totals.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            ${totals.netIncome.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Budget vs Actual Variance Analysis */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Budget vs Actual Variance Analysis</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Category</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Budgeted</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Actual</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Variance</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Variance %</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-600 uppercase">Utilization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {categoryVariance.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900">{item.category}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-700">${item.budgeted.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right text-slate-700">${item.actual.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-sm text-right font-semibold ${
                    item.variance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {item.variance >= 0 ? '+' : ''}{item.variance.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-sm text-right font-semibold ${
                    item.variance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {item.variancePercent >= 0 ? '+' : ''}{item.variancePercent.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      item.status === 'under' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {item.status === 'under' ? 'Under Budget' : 'Over Budget'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={`font-medium ${
                      item.utilization > 100 ? 'text-red-600' :
                      item.utilization > 80 ? 'text-orange-600' :
                      'text-green-600'
                    }`}>
                      {item.utilization.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-300">
              <tr>
                <td className="px-4 py-3 text-sm font-bold text-slate-900">TOTAL</td>
                <td className="px-4 py-3 text-sm text-right font-bold text-slate-900">
                  ${categoryVariance.reduce((sum, item) => sum + item.budgeted, 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-sm text-right font-bold text-slate-900">
                  ${totals.totalExpenses.toFixed(2)}
                </td>
                <td className={`px-4 py-3 text-sm text-right font-bold ${
                  totals.variance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {totals.variance >= 0 ? '+' : ''}{totals.variance?.toFixed(2) || '0.00'}
                </td>
                <td colSpan="3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Spending Categories */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Spending Categories</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topSpenders}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
              <Bar dataKey="actual" fill="#3b82f6" name="Actual Spending" />
              <Bar dataKey="budgeted" fill="#10b981" name="Budgeted" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Distribution */}
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Expense Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insights & Recommendations */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Key Insights</h3>
        <div className="space-y-3">
          {insights.length > 0 ? (
            insights.map((insight, index) => {
              const Icon = insight.icon;
              const colorClasses = {
                critical: 'bg-red-50 border-red-200 text-red-900',
                warning: 'bg-amber-50 border-amber-200 text-amber-900',
                success: 'bg-green-50 border-green-200 text-green-900',
                info: 'bg-blue-50 border-blue-200 text-blue-900'
              };
              
              return (
                <div key={index} className={`flex items-start gap-3 p-4 rounded-lg border ${colorClasses[insight.type]}`}>
                  <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">{insight.title}</h4>
                    <p className="text-sm">{insight.message}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p className="font-medium">Everything looks good!</p>
              <p className="text-sm">Your budget is on track. Keep up the good work!</p>
            </div>
          )}
        </div>
      </div>

      {/* Budget Performance Summary */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Budget Performance Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600 mb-1">Categories Under Budget</p>
            <p className="text-3xl font-bold text-green-600">
              {categoryVariance.filter(cat => cat.status === 'under').length}
            </p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600 mb-1">Categories Over Budget</p>
            <p className="text-3xl font-bold text-red-600">
              {categoryVariance.filter(cat => cat.status === 'over').length}
            </p>
          </div>
          <div className="text-center p-4 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600 mb-1">Overall Variance</p>
            <p className={`text-3xl font-bold ${totals.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.abs(totals.variance || 0).toFixed(2)}
            </p>
            <p className="text-xs text-slate-500">
              {totals.variance >= 0 ? 'Under Budget' : 'Over Budget'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}