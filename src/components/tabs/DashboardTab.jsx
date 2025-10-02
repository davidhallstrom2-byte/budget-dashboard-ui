import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Printer, Search, AlertCircle, Clock, Download } from 'lucide-react';
import {
  DollarSign, Home, Car, Utensils, User, Monitor,
  CreditCard, Repeat, Package
} from 'lucide-react';
import PageContainer from '../common/PageContainer.jsx';

const categoryIcons = {
  income:         { icon: DollarSign,  color: 'text-green-600' },
  housing:        { icon: Home,        color: 'text-blue-600' },
  transportation: { icon: Car,         color: 'text-purple-600' },
  food:           { icon: Utensils,    color: 'text-orange-600' },
  personal:       { icon: User,        color: 'text-pink-600' },
  homeOffice:     { icon: Monitor,     color: 'text-indigo-600' },
  banking:        { icon: CreditCard,  color: 'text-emerald-600' },
  subscriptions:  { icon: Repeat,      color: 'text-teal-600' },
  misc:           { icon: Package,     color: 'text-gray-600' },
};

const DEFAULT_TITLES = {
  income: 'Income',
  housing: 'Housing',
  transportation: 'Transportation',
  food: 'Food & Dining',
  personal: 'Personal',
  homeOffice: 'Home & Office',
  banking: 'Banking & Finance',
  subscriptions: 'Subscriptions',
  misc: 'Miscellaneous'
};

const DashboardTab = ({ state, setState, saveBudget }) => {
  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const categoryNames = state?.meta?.categoryNames || {};
  const categoryOrder = state?.meta?.categoryOrder || Object.keys(state?.buckets || {});

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const getItemStatus = (item) => {
    if (item.status === 'paid') return 'paid';
    const today = new Date();
    const dueDate = new Date(item.dueDate);
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 5) return 'dueSoon';
    return 'pending';
  };

  const getStatusBadge = (item) => {
    const status = getItemStatus(item);
    const today = new Date();
    const dueDate = new Date(item.dueDate);
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    switch (status) {
      case 'paid':
        return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Paid</span>;
      case 'overdue':
        return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Overdue ({Math.abs(diffDays)} days)</span>;
      case 'dueSoon':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Due in {diffDays} days</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">Pending</span>;
    }
  };

  const getCategoryStatusCounts = (items) => {
    const counts = { overdue: 0, dueSoon: 0, pending: 0, paid: 0 };
    items.forEach(item => {
      const status = getItemStatus(item);
      if (status === 'overdue') counts.overdue++;
      else if (status === 'dueSoon') counts.dueSoon++;
      else if (status === 'paid') counts.paid++;
      else counts.pending++;
    });
    return counts;
  };

  const summary = useMemo(() => {
    const allItems = Object.values(state?.buckets || {}).flat();
    
    const income = (state?.buckets?.income || []).reduce((sum, item) => 
      sum + (Number(item.actualCost) || Number(item.estBudget) || 0), 0
    );

    const expenses = allItems
      .filter(item => {
        const bucketKeys = Object.keys(state?.buckets || {});
        for (const key of bucketKeys) {
          if (key !== 'income' && state.buckets[key].includes(item)) {
            return true;
          }
        }
        return false;
      })
      .reduce((sum, item) => sum + (Number(item.actualCost) || Number(item.estBudget) || 0), 0);

    const totalBudgeted = allItems.reduce((sum, item) => sum + (Number(item.estBudget) || 0), 0);
    const totalActual = allItems.reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0);

    return {
      income,
      expenses,
      netIncome: income - expenses,
      budgetVariance: totalActual - totalBudgeted
    };
  }, [state?.buckets]);

  const alerts = useMemo(() => {
    const allItems = [];
    Object.entries(state?.buckets || {}).forEach(([bucket, items]) => {
      items.forEach(item => {
        allItems.push({ ...item, bucket });
      });
    });

    const overdue = allItems.filter(item => getItemStatus(item) === 'overdue');
    const upcoming = allItems.filter(item => getItemStatus(item) === 'dueSoon');

    return { overdue, upcoming };
  }, [state?.buckets]);

  const exportAllToCSV = () => {
    const headers = ['Category', 'Item', 'Est. Budget', 'Actual Cost', 'Due Date', 'Status'];
    const rows = [];

    categoryOrder.forEach(bucketName => {
      const items = state.buckets[bucketName] || [];
      const displayTitle = categoryNames[bucketName] || DEFAULT_TITLES[bucketName] || bucketName;
      
      items.forEach(item => {
        rows.push([
          displayTitle,
          item.category || '',
          item.estBudget || 0,
          item.actualCost || 0,
          item.dueDate || '',
          item.status || 'pending'
        ]);
      });
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `budget_dashboard_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    const allItems = [];
    
    categoryOrder.forEach(bucketName => {
      const items = state.buckets[bucketName] || [];
      const displayTitle = categoryNames[bucketName] || DEFAULT_TITLES[bucketName] || bucketName;
      allItems.push({ category: displayTitle, items });
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Budget Dashboard Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .summary { margin-bottom: 30px; }
          .summary-card { display: inline-block; margin-right: 20px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
          .overdue { background-color: #fee; }
          .due-soon { background-color: #ffc; }
          .paid { background-color: #efe; }
        </style>
      </head>
      <body>
        <h1>Budget Dashboard Report</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        
        <div class="summary">
          <div class="summary-card">
            <strong>Income:</strong> $${summary.income.toFixed(2)}
          </div>
          <div class="summary-card">
            <strong>Expenses:</strong> $${summary.expenses.toFixed(2)}
          </div>
          <div class="summary-card">
            <strong>Net Income:</strong> $${summary.netIncome.toFixed(2)}
          </div>
          <div class="summary-card">
            <strong>Budget Variance:</strong> $${summary.budgetVariance.toFixed(2)}
          </div>
        </div>

        ${allItems.map(({ category, items }) => `
          <h2>${category}</h2>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Est. Budget</th>
                <th>Actual Cost</th>
                <th>Due Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => {
                const status = getItemStatus(item);
                const rowClass = status === 'overdue' ? 'overdue' : status === 'dueSoon' ? 'due-soon' : status === 'paid' ? 'paid' : '';
                return `
                  <tr class="${rowClass}">
                    <td>${item.category || ''}</td>
                    <td>$${(item.estBudget || 0).toFixed(2)}</td>
                    <td>$${(item.actualCost || 0).toFixed(2)}</td>
                    <td>${item.dueDate || ''}</td>
                    <td>${status}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `).join('')}
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const getFilteredItems = (items) => {
    let filtered = items;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => {
        const status = getItemStatus(item);
        if (statusFilter === 'overdue') return status === 'overdue';
        if (statusFilter === 'dueSoon') return status === 'dueSoon';
        if (statusFilter === 'paid') return status === 'paid';
        if (statusFilter === 'pending') return status === 'pending';
        return true;
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.category?.toLowerCase().includes(query) ||
        item.estBudget?.toString().includes(query) ||
        item.actualCost?.toString().includes(query)
      );
    }

    return filtered;
  };

  return (
    <PageContainer className="py-6">
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl px-6 py-4 mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Budget Dashboard</h2>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium">Income</p>
              <p className="text-2xl font-bold text-green-900">${summary.income.toFixed(2)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium">Expenses</p>
              <p className="text-2xl font-bold text-red-900">${summary.expenses.toFixed(2)}</p>
            </div>
            <CreditCard className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className={`${summary.netIncome >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-lg p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${summary.netIncome >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Net Income</p>
              <p className={`text-2xl font-bold ${summary.netIncome >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>${summary.netIncome.toFixed(2)}</p>
            </div>
            <Monitor className={`w-8 h-8 ${summary.netIncome >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
          </div>
        </div>

        <div className={`${summary.budgetVariance <= 0 ? 'bg-purple-50 border-purple-200' : 'bg-yellow-50 border-yellow-200'} border rounded-lg p-4`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${summary.budgetVariance <= 0 ? 'text-purple-600' : 'text-yellow-600'}`}>Budget Variance</p>
              <p className={`text-2xl font-bold ${summary.budgetVariance <= 0 ? 'text-purple-900' : 'text-yellow-900'}`}>
                {summary.budgetVariance > 0 ? '+' : ''}${summary.budgetVariance.toFixed(2)}
              </p>
            </div>
            <Package className={`w-8 h-8 ${summary.budgetVariance <= 0 ? 'text-purple-600' : 'text-yellow-600'}`} />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search items by name, budget, or cost..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Filter:</span>
            {[
              { id: 'all', label: 'All Items', color: 'bg-gray-200 text-gray-800' },
              { id: 'overdue', label: 'Overdue', color: 'bg-red-100 text-red-800' },
              { id: 'dueSoon', label: 'Due Soon', color: 'bg-yellow-100 text-yellow-800' },
              { id: 'pending', label: 'Pending', color: 'bg-blue-100 text-blue-800' },
              { id: 'paid', label: 'Paid', color: 'bg-green-100 text-green-800' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => setStatusFilter(filter.id)}
                className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  statusFilter === filter.id
                    ? 'ring-2 ring-blue-500 ' + filter.color
                    : filter.color + ' opacity-60 hover:opacity-100'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={exportAllToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={printReport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>
          </div>
        </div>
      </div>

      {/* Alert Sections - Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {alerts.overdue.length > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <h3 className="font-semibold text-red-900">Overdue Items ({alerts.overdue.length})</h3>
            </div>
            <div className="space-y-2">
              {alerts.overdue.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-red-800">{item.category}</span>
                  <span className="text-red-600">${(item.actualCost || item.estBudget || 0).toFixed(2)}</span>
                </div>
              ))}
              {alerts.overdue.length > 5 && (
                <p className="text-xs text-red-600">+ {alerts.overdue.length - 5} more overdue items</p>
              )}
            </div>
          </div>
        )}

        {alerts.upcoming.length > 0 && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <h3 className="font-semibold text-yellow-900">Upcoming Items ({alerts.upcoming.length})</h3>
            </div>
            <div className="space-y-2">
              {alerts.upcoming.slice(0, 5).map(item => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-yellow-800">{item.category}</span>
                  <span className="text-yellow-600">${(item.actualCost || item.estBudget || 0).toFixed(2)}</span>
                </div>
              ))}
              {alerts.upcoming.length > 5 && (
                <p className="text-xs text-yellow-600">+ {alerts.upcoming.length - 5} more upcoming items</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Category Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Category Breakdown</h3>
        </div>

        {categoryOrder.map(bucketName => {
          const items = state.buckets[bucketName] || [];
          const filteredItems = getFilteredItems(items);
          if (filteredItems.length === 0 && (searchQuery || statusFilter !== 'all')) return null;

          const IconComponent = categoryIcons[bucketName]?.icon || Package;
          const iconColor = categoryIcons[bucketName]?.color || 'text-gray-600';
          const displayTitle = categoryNames[bucketName] || DEFAULT_TITLES[bucketName] || bucketName;
          const isExpanded = expandedCategories[bucketName];

          const totalBudgeted = items.reduce((sum, item) => sum + (Number(item.estBudget) || 0), 0);
          const totalActual = items.reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0);
          const statusCounts = getCategoryStatusCounts(items);

          return (
            <div key={bucketName} className="border-b border-gray-200 last:border-b-0">
              <button
                onClick={() => toggleCategory(bucketName)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <IconComponent className={`w-5 h-5 ${iconColor}`} />
                  <span className="font-medium">{displayTitle}</span>
                  <span className="text-sm text-gray-500">({filteredItems.length} items)</span>
                  
                  <div className="flex gap-1">
                    {statusCounts.overdue > 0 && (
                      <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {statusCounts.overdue}
                      </span>
                    )}
                    {statusCounts.dueSoon > 0 && (
                      <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {statusCounts.dueSoon}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600">Budget: <strong>${totalBudgeted.toFixed(2)}</strong></span>
                  <span className="text-gray-600">Actual: <strong>${totalActual.toFixed(2)}</strong></span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Item</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Est. Budget</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700">Actual Cost</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Due Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map(item => (
                        <tr key={item.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-sm">{item.category}</td>
                          <td className="px-3 py-2 text-sm text-right">${(item.estBudget || 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-sm text-right">${(item.actualCost || 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-sm">{item.dueDate || 'N/A'}</td>
                          <td className="px-3 py-2">{getStatusBadge(item)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td className="px-3 py-2 text-sm font-semibold">Subtotal</td>
                        <td className="px-3 py-2 text-sm text-right font-bold">${totalBudgeted.toFixed(2)}</td>
                        <td className="px-3 py-2 text-sm text-right font-bold">${totalActual.toFixed(2)}</td>
                        <td colSpan="2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Complete Budget List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Complete Budget List</h3>
          <button
            onClick={printReport}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Category</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Item</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Est. Budget</th>
                <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Actual Cost</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Due Date</th>
                <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {categoryOrder.map(bucketName => {
                const items = state.buckets[bucketName] || [];
                const filteredItems = getFilteredItems(items);
                const displayTitle = categoryNames[bucketName] || DEFAULT_TITLES[bucketName] || bucketName;

                return filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{displayTitle}</td>
                    <td className="px-4 py-2 text-sm">{item.category}</td>
                    <td className="px-4 py-2 text-sm text-right">${(item.estBudget || 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-sm text-right">${(item.actualCost || 0).toFixed(2)}</td>
                    <td className="px-4 py-2 text-sm">{item.dueDate || 'N/A'}</td>
                    <td className="px-4 py-2">{getStatusBadge(item)}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
};

export default DashboardTab;