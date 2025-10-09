// src/components/tabs/DashboardTab.jsx
import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Printer, Search, AlertCircle, Clock, Download, MessageSquare, X } from 'lucide-react';
import {
  DollarSign, Home, Car, Utensils, User, Monitor,
  CreditCard, Repeat, Package
} from 'lucide-react';
import PageContainer from '../common/PageContainer.jsx';
import EmergencyFundWidget from '../modern/EmergencyFundWidget';

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
  const [showUrgentAlert, setShowUrgentAlert] = useState(true);
  const [viewingNote, setViewingNote] = useState(null);

  const categoryNames = state?.meta?.categoryNames || {};
  const categoryOrder =
    (state?.meta?.categoryOrder && state.meta.categoryOrder.length > 0)
      ? state.meta.categoryOrder
      : Object.keys(state?.buckets || {});

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
      if (bucket === 'income') return;
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

      {/* Urgent Payment Alert Modal */}
      {(() => {
        const urgentItems = [];
        Object.entries(state?.buckets || {}).forEach(([bucket, items]) => {
          items.forEach(item => {
            if (item.status !== 'paid') {
              const today = new Date();
              const dueDate = new Date(item.dueDate);
              const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
              if (diffDays >= 0 && diffDays <= 3) {
                urgentItems.push({ ...item, bucket, daysUntil: diffDays });
              }
            }
          });
        });

        if (urgentItems.length === 0 || !showUrgentAlert) return null;

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
              <div className="bg-red-600 px-6 py-4 rounded-t-lg">
                <div className="flex items-center gap-3 text-white">
                  <AlertCircle className="w-8 h-8 flex-shrink-0" />
                  <h3 className="text-xl font-bold">URGENT PAYMENT ALERT</h3>
                </div>
              </div>

              <div className="p-6">
                <p className="text-red-900 font-semibold mb-4">
                  {urgentItems.length} payment{urgentItems.length !== 1 ? 's' : ''} due within 3 days:
                </p>

                <div className="space-y-3 mb-6">
                  {urgentItems.map(item => (
                    <div key={`${item.bucket}-${item.id}`} className="bg-red-50 border border-red-200 rounded p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-bold text-red-900">{item.category}</p>
                          <p className="text-sm text-red-700">
                            {item.daysUntil === 0 ? '🔴 DUE TODAY' : `Due in ${item.daysUntil} day${item.daysUntil !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                        <p className="text-lg font-bold text-red-900">${(item.actualCost || item.estBudget || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowUrgentAlert(false)}
                  className="w-full px-4 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
                >
                  I Acknowledge
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
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

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={exportAllToCSV}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={printReport}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print Report</span>
            </button>
          </div>
        </div>
      </div>

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
                  <span className="text-red-800 truncate">{item.category}</span>
                  <span className="text-red-600 ml-2">${(item.actualCost || item.estBudget || 0).toFixed(2)}</span>
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
                  <span className="text-yellow-800 truncate">{item.category}</span>
                  <span className="text-yellow-600 ml-2">${(item.actualCost || item.estBudget || 0).toFixed(2)}</span>
                </div>
              ))}
              {alerts.upcoming.length > 5 && (
                <p className="text-xs text-yellow-600">+ {alerts.upcoming.length - 5} more upcoming items</p>
              )}
            </div>
          </div>
        )}
      </div>

<div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl overflow-hidden mb-6">
  <div className="bg-blue-600 text-white px-4 py-3">
    <h3 className="text-lg font-bold">Budget List</h3>
  </div>

        {categoryOrder.map(bucketName => {
          const items = state.buckets[bucketName] || [];
          const filteredItems = getFilteredItems(items);
          if (filteredItems.length === 0 && (searchQuery || statusFilter !== 'all')) return null;

          const IconComponent = categoryIcons[bucketName]?.icon || Package;
          const iconColor = categoryIcons[bucketName]?.color || 'text-gray-600';
          const displayTitle = categoryNames[bucketName] || DEFAULT_TITLES[bucketName] || bucketName;
          const isExpanded = expandedCategories[bucketName] !== false; // Default to true (expanded)

          const totalBudgeted = items.reduce((sum, item) => sum + (Number(item.estBudget) || 0), 0);
          const totalActual = items.reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0);
          const statusCounts = getCategoryStatusCounts(items);

          return (
            <div key={bucketName} className="border-b border-gray-200 last:border-b-0">
              <button
                onClick={() => toggleCategory(bucketName)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <IconComponent className={`w-5 h-5 ${iconColor}`} />
                  <span className="font-medium text-sm sm:text-base">{displayTitle}</span>
                  <span className="text-xs sm:text-sm text-gray-500">({filteredItems.length})</span>

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

                <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                  <span className="text-gray-600 hidden sm:inline">Budget: <strong>${totalBudgeted.toFixed(2)}</strong></span>
                  <span className="text-gray-600">Actual: <strong>${totalActual.toFixed(2)}</strong></span>
                </div>
              </button>

{isExpanded && (
  <div className="px-4 pb-4 overflow-x-auto bg-white">
    <table className="w-full min-w-[600px]">
      <thead className="bg-gray-100">
  <tr>
    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-64">Item</th>
    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 w-32">Est. Budget</th>
    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 w-32">Actual Cost</th>
    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-32">Due Date</th>
    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-40">Status</th>
    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 w-16">Notes</th>
  </tr>
</thead>
      <tbody className="bg-white">
        {filteredItems.map(item => (
                        <tr key={item.id} className="border-t border-gray-200 hover:bg-blue-50">
                          <td className="px-3 py-2 text-sm">{item.category}</td>
                          <td className="px-3 py-2 text-sm text-right">${(item.estBudget || 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-sm text-right">${(item.actualCost || 0).toFixed(2)}</td>
                          <td className="px-3 py-2 text-sm">{item.dueDate || 'N/A'}</td>
                          <td className="px-3 py-2">{getStatusBadge(item)}</td>
                          <td className="px-3 py-2 text-center">
                            {item.note && (
                              <button
                                onClick={() => setViewingNote({ item, categoryName: displayTitle })}
                                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                title="View Notes"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td className="px-3 py-2 text-sm font-semibold">Subtotal</td>
                        <td className="px-3 py-2 text-sm text-right font-bold">${totalBudgeted.toFixed(2)}</td>
                        <td className="px-3 py-2 text-sm text-right font-bold">${totalActual.toFixed(2)}</td>
                        <td colSpan="3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grand Totals */}
      <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-300 rounded-xl overflow-hidden mb-6">
        <div className="bg-blue-600 text-white px-4 py-3">
          <h3 className="text-lg font-bold">GRAND TOTALS</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">
                {Object.values(state.buckets).flat().length}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Total Est. Budget</p>
              <p className="text-2xl font-bold text-blue-900">
                ${Object.values(state.buckets).flat().reduce((sum, item) => sum + (Number(item.estBudget) || 0), 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Total Actual Cost</p>
              <p className="text-2xl font-bold text-purple-900">
                ${Object.values(state.buckets).flat().reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Variance</p>
              {(() => {
                const totalBudget = Object.values(state.buckets).flat().reduce((sum, item) => sum + (Number(item.estBudget) || 0), 0);
                const totalActual = Object.values(state.buckets).flat().reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0);
                const variance = totalActual - totalBudget;
                return (
                  <p className={`text-2xl font-bold ${variance > 0 ? 'text-red-600' : variance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                    {variance > 0 ? '+' : ''}${variance.toFixed(2)}
                  </p>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      <EmergencyFundWidget state={state} setState={setState} saveBudget={saveBudget} />

      {viewingNote && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setViewingNote(null)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {viewingNote.item.category}
                </h3>
                <p className="text-sm text-gray-500">{viewingNote.categoryName}</p>
              </div>
              <button
                onClick={() => setViewingNote(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {viewingNote.item.note}
                </p>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setViewingNote(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </PageContainer>
  );
};

export default DashboardTab;