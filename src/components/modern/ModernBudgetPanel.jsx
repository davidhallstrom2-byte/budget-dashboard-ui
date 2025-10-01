import { useBudgetState } from '../../utils/state';
import { DollarSign, TrendingUp, TrendingDown, Calendar, AlertCircle } from 'lucide-react';

export default function ModernBudgetPanel() {
  // ✅ Read from computeTotals() and rows
  const { totalIncome, totalExpenses, netIncome, totalBudgeted } = useBudgetState((state) => {
    const totals = state.computeTotals();
    return {
      totalIncome: totals.totalIncome || 0,
      totalExpenses: totals.totalExpenses || 0,
      netIncome: totals.netIncome || 0,
      totalBudgeted: totals.totalBudgeted || 0
    };
  });

  const rows = useBudgetState((state) => state.rows || []);
  const asOfDate = useBudgetState((state) => state.meta?.asOfDate || 'N/A');

  // Calculate upcoming payments (due within next 7 days)
  const today = new Date();
  const upcomingPayments = rows.filter(row => {
    if (!row.dueDate || row.status === 'paid') return false;
    const dueDate = new Date(row.dueDate);
    const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 7;
  }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

  // Group expenses by category for breakdown
  const categoryBreakdown = rows
    .filter(row => row.bucket !== 'income')
    .reduce((acc, row) => {
      const category = row.bucket || 'misc';
      if (!acc[category]) {
        acc[category] = { total: 0, count: 0 };
      }
      acc[category].total += row.actualCost || 0;
      acc[category].count += 1;
      return acc;
    }, {});

  const categoryLabels = {
    housing: 'Housing',
    transportation: 'Transportation',
    food: 'Food',
    personal: 'Personal',
    homeOffice: 'Home/Office',
    banking: 'Banking',
    misc: 'Miscellaneous',
    // Add more mappings as needed
    utilities: 'Utilities',
    insurance: 'Insurance',
    healthcare: 'Healthcare',
    entertainment: 'Entertainment',
    debt: 'Debt Payments',
    savings: 'Savings',
    education: 'Education',
    gifts: 'Gifts & Donations',
    travel: 'Travel',
    pets: 'Pet Care',
    clothing: 'Clothing',
    subscriptions: 'Subscriptions'
  };

  // Helper function to get proper category display name
  const getCategoryDisplayName = (row) => {
    // First try the category field if it's not "Other" or empty
    if (row.category && row.category !== 'Other' && row.category !== '') {
      return row.category;
    }
    // Then try the bucket field with label mapping
    if (row.bucket) {
      return categoryLabels[row.bucket] || row.bucket;
    }
    // Finally fall back to category or a default
    return row.category || 'Uncategorized';
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Income */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-green-900">Total Income</h3>
            <TrendingUp className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-green-700">${totalIncome.toFixed(2)}</p>
        </div>

        {/* Total Expenses */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-red-900">Total Expenses</h3>
            <TrendingDown className="h-5 w-5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-700">${totalExpenses.toFixed(2)}</p>
        </div>

        {/* Net Income */}
        <div className={`rounded-lg p-4 border ${netIncome >= 0 ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200' : 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={`text-sm font-medium ${netIncome >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>Net Income</h3>
            <DollarSign className={`h-5 w-5 ${netIncome >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
          </div>
          <p className={`text-2xl font-bold ${netIncome >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
            ${netIncome.toFixed(2)}
          </p>
        </div>

        {/* Due Soon */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-purple-900">Due Soon</h3>
            <Calendar className="h-5 w-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-purple-700">{upcomingPayments.length}</p>
        </div>
      </div>

      {/* Expense Breakdown */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Expense Breakdown</h3>
        {Object.keys(categoryBreakdown).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(categoryBreakdown)
              .sort((a, b) => b[1].total - a[1].total)
              .map(([category, data]) => {
                const percentage = totalExpenses > 0 ? (data.total / totalExpenses) * 100 : 0;
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700">
                        {categoryLabels[category] || category}
                      </span>
                      <span className="text-sm font-bold text-slate-900">
                        ${data.total.toFixed(2)} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="text-center text-slate-500 py-8">No expense data available</p>
        )}
      </div>

      {/* Upcoming Payments */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Upcoming Payments</h3>
        {upcomingPayments.length > 0 ? (
          <div className="space-y-3">
            {upcomingPayments.map((payment) => {
              const dueDate = new Date(payment.dueDate);
              const daysUntil = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className={`h-5 w-5 ${daysUntil <= 2 ? 'text-red-500' : 'text-amber-500'}`} />
                    <div>
                      <p className="font-medium text-slate-900">{getCategoryDisplayName(payment)}</p>
                      <p className="text-xs text-slate-600">
                        Due in {daysUntil} {daysUntil === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                  </div>
                  <p className="font-bold text-slate-900">${payment.estBudget?.toFixed(2) || payment.actualCost?.toFixed(2) || '0.00'}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-slate-500 py-8">No upcoming payments</p>
        )}
      </div>

      {/* Complete Budget List */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Complete Budget List</h3>
          <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium">
            📥 Download Report
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Budget</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Actual</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Due Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-900">{getCategoryDisplayName(row)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">${row.estBudget?.toFixed(2) || '0.00'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">${row.actualCost?.toFixed(2) || '0.00'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{row.dueDate || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        row.status === 'paid' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {row.status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-4 py-8 text-center text-slate-500">
                    No budget items found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}