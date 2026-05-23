// src/components/tabs/DashboardTab.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, Printer, Search, AlertCircle, Clock, Download, Plus, Minus, Archive } from 'lucide-react';
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
  emergencyFund: 'Emergency Fund',
  misc: 'Miscellaneous'
};

const CSC_STORAGE_KEY = 'cscShifts.v1';
const CSC_SHIFT_UPDATE_EVENT = 'cscShifts:updated';

const loadCscBudgetShifts = () => {
  try {
    const saved = localStorage.getItem(CSC_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load CSC shifts for budget dashboard:', error);
    return [];
  }
};

const getCscShiftHours = (shift) => {
  if (!shift?.startDate || !shift?.startTime || !shift?.finishDate || !shift?.finishTime) return 0;

  const start = new Date(`${shift.startDate}T${shift.startTime}:00`);
  const finish = new Date(`${shift.finishDate}T${shift.finishTime}:00`);
  const diff = finish.getTime() - start.getTime();

  if (!Number.isFinite(diff) || diff <= 0) return 0;

  return Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
};

const getCscEstimatedPay = (shift) => {
  const hourlyRate = Number.parseFloat(shift?.hourlyRate);
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) return 0;

  return Math.round(getCscShiftHours(shift) * hourlyRate * 100) / 100;
};

const formatDashboardCurrency = (amount) =>
  `$${(Number(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const DashboardTab = ({
  state,
  setState,
  saveBudget,
  searchQuery,
  budgetSubnav = null,
  showUrgentAlert = false,
  onCloseUrgentAlert = () => {},
}) => {
  const [expandedCategories, setExpandedCategories] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' or 'flat'
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const [showBudgetOverview, setShowBudgetOverview] = useState(false);
  const [showPaymentAlerts, setShowPaymentAlerts] = useState(false);
  const [cscShifts, setCscShifts] = useState(() => loadCscBudgetShifts());

  const categoryNames = state?.meta?.categoryNames || {};
  const categoryOrder =
    (state?.meta?.categoryOrder && state.meta.categoryOrder.length > 0)
      ? state.meta.categoryOrder
      : Object.keys(state?.buckets || {});

  useEffect(() => {
    const refreshCscShifts = () => setCscShifts(loadCscBudgetShifts());

    window.addEventListener('storage', refreshCscShifts);
    window.addEventListener(CSC_SHIFT_UPDATE_EVENT, refreshCscShifts);

    return () => {
      window.removeEventListener('storage', refreshCscShifts);
      window.removeEventListener(CSC_SHIFT_UPDATE_EVENT, refreshCscShifts);
    };
  }, []);

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

  const cscIncome = useMemo(() => {
    const activeShifts = cscShifts.filter((shift) => shift?.shiftStatus !== 'Cancelled');
    const paidShifts = activeShifts.filter((shift) => shift?.paidStatus === 'Paid');
    const unpaidShifts = activeShifts.filter((shift) => shift?.paidStatus !== 'Paid');
    const doneShifts = activeShifts.filter((shift) => shift?.shiftStatus === 'Done');

    const estimatedPay = activeShifts.reduce((sum, shift) => sum + getCscEstimatedPay(shift), 0);
    const paidPay = paidShifts.reduce((sum, shift) => sum + getCscEstimatedPay(shift), 0);
    const unpaidPay = unpaidShifts.reduce((sum, shift) => sum + getCscEstimatedPay(shift), 0);
    const estimatedHours = activeShifts.reduce((sum, shift) => sum + getCscShiftHours(shift), 0);
    const workedHours = doneShifts.reduce((sum, shift) => sum + getCscShiftHours(shift), 0);

    return {
      activeShiftCount: activeShifts.length,
      paidShiftCount: paidShifts.length,
      unpaidShiftCount: unpaidShifts.length,
      estimatedPay,
      paidPay,
      unpaidPay,
      estimatedHours,
      workedHours,
    };
  }, [cscShifts]);

  const cscIncomeItem = useMemo(() => ({
    id: 'system-csc-shift-income',
    category: 'CSC Shift Income',
    estBudget: cscIncome.estimatedPay,
    actualCost: cscIncome.paidPay,
    dueDate: '',
    status: cscIncome.unpaidPay > 0 ? 'pending' : 'paid',
    note: `${cscIncome.activeShiftCount} active shifts · ${cscIncome.estimatedHours.toFixed(1)} estimated hours · unpaid ${formatDashboardCurrency(cscIncome.unpaidPay)}`,
    isSystemItem: true,
  }), [cscIncome]);

  const getBudgetItemsForBucket = (bucketName) => {
    const items = state?.buckets?.[bucketName] || [];
    if (bucketName !== 'income') return items;
    if (!cscIncome.activeShiftCount && !cscIncome.estimatedPay) return items;
    return [...items, cscIncomeItem];
  };

  const summary = useMemo(() => {
    const allItems = Object.values(state?.buckets || {}).flat();

    const manualIncome = (state?.buckets?.income || []).reduce((sum, item) =>
      sum + (Number(item.actualCost) || Number(item.estBudget) || 0), 0
    );

    const income = manualIncome + cscIncome.estimatedPay;

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
      manualIncome,
      cscIncome,
      expenses,
      netIncome: income - expenses,
      budgetVariance: totalActual - totalBudgeted
    };
  }, [state?.buckets, cscIncome]);


  const budgetOverview = useMemo(() => {
    const allItems = categoryOrder.flatMap((bucketName) => getBudgetItemsForBucket(bucketName));
    const totalItems = allItems.length;
    const paidItems = allItems.filter((item) => item.status === 'paid').length;
    const pendingItems = allItems.filter((item) => item.status !== 'paid').length;
    const overdueItems = allItems.filter((item) => getItemStatus(item) === 'overdue').length;
    const dueSoonItems = allItems.filter((item) => getItemStatus(item) === 'dueSoon').length;
    const totalEstimated = allItems.reduce(
      (sum, item) => sum + Number(item.estBudget || item.estimatedBudget || item.estimatedCost || 0),
      0
    );
    const totalActual = allItems.reduce(
      (sum, item) => sum + Number(item.actualCost || item.actualSpent || 0),
      0
    );

    return {
      totalItems,
      paidItems,
      pendingItems,
      overdueItems,
      dueSoonItems,
      totalEstimated,
      totalActual,
      archivedItems: state?.archived?.length || 0,
    };
  }, [state?.buckets, state?.archived]);

  const alerts = useMemo(() => {
    const allItems = [];
    categoryOrder.forEach((bucket) => {
      if (bucket === 'income') return;
      const items = getBudgetItemsForBucket(bucket);
      items.forEach(item => {
        allItems.push({ ...item, bucket });
      });
    });

    const overdue = allItems.filter(item => getItemStatus(item) === 'overdue');
    const upcoming = allItems.filter(item => getItemStatus(item) === 'dueSoon');

    return { overdue, upcoming };
  }, [state?.buckets]);

  const handleFilterChange = (filterId) => {
    setStatusFilter(filterId);
    // Switch to flat view when filtering, grouped when showing all
    setViewMode(filterId === 'all' ? 'grouped' : 'flat');
  };

  const getFilteredItemsWithBucket = () => {
    const allItems = [];
    
    categoryOrder.forEach(bucketName => {
      const items = getBudgetItemsForBucket(bucketName);
      items.forEach(item => {
        allItems.push({
          ...item,
          bucketName,
          bucketDisplayName: categoryNames[bucketName] || DEFAULT_TITLES[bucketName] || bucketName
        });
      });
    });

    let filtered = allItems;

    // Apply status filter
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

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item =>
        item.category?.toLowerCase().includes(query) ||
        item.estBudget?.toString().includes(query) ||
        item.actualCost?.toString().includes(query) ||
        item.bucketDisplayName?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const exportAllToCSV = () => {
    const headers = ['Category', 'Item', 'Est. Budget', 'Actual Cost', 'Due Date', 'Status'];
    const rows = [];

    categoryOrder.forEach(bucketName => {
      const items = getBudgetItemsForBucket(bucketName);
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
      const items = getBudgetItemsForBucket(bucketName);
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
            <strong>Income:</strong> ${formatDashboardCurrency(summary.income)}
          </div>
          <div class="summary-card">
            <strong>CSC Shift Income:</strong> ${formatDashboardCurrency(cscIncome.estimatedPay)}
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
                <th>Notes</th>
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
                    <td>${item.note || ''}</td>
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
      {/* Urgent Payment Alert Modal */}
      {(() => {
        const urgentItems = [];
        Object.entries(state?.buckets || {}).forEach(([bucket, items]) => {
          if (bucket === 'income') return; // Skip income items
          items.forEach(item => {
            if (item.status !== 'paid') {
              const today = new Date();
              const dueDate = new Date(item.dueDate);
              const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
              if (diffDays <= 0) {
                urgentItems.push({ ...item, bucket, daysUntil: diffDays });
              }
            }
          });
        });

        if (urgentItems.length === 0 || !showUrgentAlert) return null;

        return (
  <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-start overflow-y-auto px-4 py-6">
    
    <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[calc(100vh-3rem)] overflow-y-auto relative">

      {/* Header */}
      <div className="bg-red-600 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <h3 className="text-lg font-bold">URGENT PAYMENT ALERT</h3>
          </div>
          <button
            onClick={onCloseUrgentAlert}
            title="Close payment alert"
            className="px-2 py-1 bg-white text-red-600 rounded text-sm font-bold"
          >
            X
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <p className="text-red-900 font-semibold">
          {urgentItems.length} payment{urgentItems.length !== 1 ? 's' : ''} {urgentItems.some(i => i.daysUntil < 0) ? 'overdue or due today' : 'due today'}:
        </p>

        {urgentItems.map(item => (
          <div key={`${item.bucket}-${item.id}`} className="bg-red-50 border border-red-200 rounded p-3">
            <div className="flex justify-between">
              <div>
                <p className="font-bold text-red-900">{item.category}</p>
                <p className="text-sm text-red-700">
                  {item.daysUntil === 0
                    ? 'DUE TODAY'
                    : item.daysUntil < 0
                    ? `OVERDUE ${Math.abs(item.daysUntil)} day${Math.abs(item.daysUntil) !== 1 ? 's' : ''}`
                    : `Due in ${item.daysUntil} day${item.daysUntil !== 1 ? 's' : ''}`}
                </p>
              </div>
              <p className="font-bold text-red-900">
                ${(item.actualCost || item.estBudget || 0).toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t">
        <button
          onClick={onCloseUrgentAlert}
          className="w-full px-4 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700"
        >
          Close
        </button>
      </div>

    </div>
  </div>
);
      })()}

      <section className="mx-auto mb-6 max-w-6xl overflow-hidden rounded-xl border border-blue-200 bg-blue-50 shadow-sm">
        <div className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Budget Overview</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">Budget status, due dates, saved items, and spending totals.</p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {budgetSubnav}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowBudgetOverview((prev) => !prev)}
          className="flex w-full items-center gap-2 border-t border-blue-100 bg-blue-100/60 px-6 py-2 text-left text-sm font-medium text-slate-600 hover:bg-blue-100 transition-colors"
        >
          {showBudgetOverview ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {showBudgetOverview ? 'Hide Stats' : 'Show Stats'}
        </button>

        {showBudgetOverview && (
          <div className="space-y-4 border-t border-blue-100 p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-950 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-green-700">Income</p>
                    <p className="mt-1 text-2xl font-extrabold">{formatDashboardCurrency(summary.income)}</p>
                    <p className="mt-1 text-xs font-semibold text-green-800">
                      Budget: {formatDashboardCurrency(summary.manualIncome)} · CSC: {formatDashboardCurrency(cscIncome.estimatedPay)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600 opacity-80" />
                </div>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-950 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-red-700">Expenses</p>
                    <p className="mt-1 text-2xl font-extrabold">${summary.expenses.toFixed(2)}</p>
                  </div>
                  <CreditCard className="h-8 w-8 text-red-600 opacity-80" />
                </div>
              </div>

              <div className={`${summary.netIncome >= 0 ? 'border-blue-200 bg-blue-50 text-blue-950' : 'border-orange-200 bg-orange-50 text-orange-950'} rounded-2xl border p-4 shadow-sm`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm font-bold ${summary.netIncome >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>Net Income</p>
                    <p className="mt-1 text-2xl font-extrabold">${summary.netIncome.toFixed(2)}</p>
                  </div>
                  <Monitor className={`h-8 w-8 opacity-80 ${summary.netIncome >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                </div>
              </div>

              <div className={`${summary.budgetVariance <= 0 ? 'border-purple-200 bg-purple-50 text-purple-950' : 'border-yellow-200 bg-yellow-50 text-yellow-950'} rounded-2xl border p-4 shadow-sm`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm font-bold ${summary.budgetVariance <= 0 ? 'text-purple-700' : 'text-yellow-700'}`}>Budget Variance</p>
                    <p className="mt-1 text-2xl font-extrabold">
                      {summary.budgetVariance > 0 ? '+' : ''}${summary.budgetVariance.toFixed(2)}
                    </p>
                  </div>
                  <Package className={`h-8 w-8 opacity-80 ${summary.budgetVariance <= 0 ? 'text-purple-600' : 'text-yellow-600'}`} />
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">Budget Items</p>
                    <p className="mt-1 text-2xl font-extrabold">{budgetOverview.totalItems}</p>
                    <p className="mt-1 text-xs opacity-80">
                      {budgetOverview.pendingItems} pending · {budgetOverview.paidItems} paid
                    </p>
                  </div>
                  <CreditCard className="h-8 w-8 opacity-80" />
                </div>
              </div>

              <div className="rounded-2xl border border-yellow-300 bg-yellow-50 p-4 text-yellow-950 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">CSC Shift Income</p>
                    <p className="mt-1 text-2xl font-extrabold">{formatDashboardCurrency(cscIncome.estimatedPay)}</p>
                    <p className="mt-1 text-xs opacity-80">
                      {cscIncome.activeShiftCount} shifts · {cscIncome.estimatedHours.toFixed(1)} hrs · paid {formatDashboardCurrency(cscIncome.paidPay)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 opacity-80" />
                </div>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-950 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">Overdue</p>
                    <p className="mt-1 text-2xl font-extrabold">{budgetOverview.overdueItems}</p>
                    <p className="mt-1 text-xs opacity-80">Budget items past due</p>
                  </div>
                  <AlertCircle className="h-8 w-8 opacity-80" />
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">Due Soon</p>
                    <p className="mt-1 text-2xl font-extrabold">{budgetOverview.dueSoonItems}</p>
                    <p className="mt-1 text-xs opacity-80">Budget items due within 5 days</p>
                  </div>
                  <Clock className="h-8 w-8 opacity-80" />
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">Paid Items</p>
                    <p className="mt-1 text-2xl font-extrabold">{budgetOverview.paidItems}</p>
                    <p className="mt-1 text-xs opacity-80">{budgetOverview.pendingItems} still pending</p>
                  </div>
                  <Package className="h-8 w-8 opacity-80" />
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900">
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  <h3 className="font-extrabold">Archived Budget Items</h3>
                </div>
                <p className="mt-2 text-2xl font-extrabold">{budgetOverview.archivedItems}</p>
                <p className="text-sm text-slate-600">Stored in the budget archive drawer.</p>
              </div>

              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-950">
                <h3 className="font-extrabold">Budget Totals</h3>
                <p className="mt-2 text-sm">
                  Estimated: <span className="font-extrabold">${budgetOverview.totalEstimated.toFixed(2)}</span>
                </p>
                <p className="text-sm">
                  Actual: <span className="font-extrabold">${budgetOverview.totalActual.toFixed(2)}</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mx-auto mb-6 max-w-6xl overflow-hidden rounded-xl border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100">
        <button
          type="button"
          onClick={() => setShowPaymentAlerts(prev => !prev)}
          className="flex w-full items-center justify-between gap-4 bg-slate-950 px-4 py-3 text-left text-white hover:bg-slate-900"
          title={showPaymentAlerts ? 'Collapse overdue and due soon items' : 'Expand overdue and due soon items'}
        >
          <div className="flex items-center gap-2">
            {showPaymentAlerts ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            <AlertCircle className="h-5 w-5 text-red-300" />
            <h3 className="text-lg font-bold">Payment Alerts</h3>
            <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-extrabold text-white">
              Overdue {alerts.overdue.length}
            </span>
            <span className="rounded-full bg-yellow-500 px-2 py-1 text-xs font-extrabold text-white">
              Due Soon {alerts.upcoming.length}
            </span>
          </div>
          <span className="text-sm font-semibold text-slate-200">
            {showPaymentAlerts ? 'Collapse' : 'Expand'}
          </span>
        </button>

        {showPaymentAlerts && (
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
            <div className="overflow-hidden rounded-xl border-2 border-blue-300 bg-blue-50">
              <div className="flex items-center gap-2 bg-red-600 px-4 py-3 text-white">
                <AlertCircle className="h-5 w-5" />
                <h3 className="text-lg font-bold">Overdue Items ({alerts.overdue.length})</h3>
              </div>
              <div className="bg-white p-4">
                {alerts.overdue.length > 0 ? (
                  <div className="space-y-2">
                    {(showAllOverdue ? alerts.overdue : alerts.overdue.slice(0, 5)).map(item => (
                      <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-gray-100 py-2 text-sm last:border-b-0">
                        <span className="truncate font-medium text-gray-800">{item.category}</span>
                        <span className="whitespace-nowrap text-xs text-gray-600">{item.dueDate}</span>
                        <span className="whitespace-nowrap text-right font-bold text-red-600">${(item.actualCost || item.estBudget || 0).toFixed(2)}</span>
                      </div>
                    ))}
                    {alerts.overdue.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setShowAllOverdue(prev => !prev)}
                        title={showAllOverdue ? 'Show fewer overdue items' : 'Show all overdue items'}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                      >
                        {showAllOverdue
                          ? 'Show fewer overdue items'
                          : `+ ${alerts.overdue.length - 5} more overdue items`}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="py-2 text-center text-sm text-gray-500">No overdue items</p>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border-2 border-blue-300 bg-blue-50">
              <div className="flex items-center gap-2 bg-yellow-500 px-4 py-3 text-white">
                <Clock className="h-5 w-5" />
                <h3 className="text-lg font-bold">Due Soon ({alerts.upcoming.length})</h3>
              </div>
              <div className="bg-white p-4">
                {alerts.upcoming.length > 0 ? (
                  <div className="space-y-2">
                    {alerts.upcoming.slice(0, 5).map(item => (
                      <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-gray-100 py-2 text-sm last:border-b-0">
                        <span className="truncate font-medium text-gray-800">{item.category}</span>
                        <span className="whitespace-nowrap text-xs text-gray-600">{item.dueDate}</span>
                        <span className="whitespace-nowrap text-right font-bold text-yellow-600">${(item.actualCost || item.estBudget || 0).toFixed(2)}</span>
                      </div>
                    ))}
                    {alerts.upcoming.length > 5 && (
                      <p className="pt-2 text-xs text-gray-600">+ {alerts.upcoming.length - 5} more upcoming items</p>
                    )}
                  </div>
                ) : (
                  <p className="py-2 text-center text-sm text-gray-500">No items due within 5 days</p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="mx-auto mb-6 max-w-6xl overflow-hidden rounded-xl border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100">
        <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold whitespace-nowrap">Budget List</h3>
            <button
              onClick={() => {
                const allExpanded = {};
                categoryOrder.forEach(bucket => {
                  allExpanded[bucket] = true;
                });
                setExpandedCategories(allExpanded);
              }}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Expand All Categories"
              aria-label="Expand All Categories"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={() => setExpandedCategories({})}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              title="Collapse All Categories"
              aria-label="Collapse All Categories"
            >
              <Minus className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'all', label: 'All Items', color: 'bg-white/20 hover:bg-white/30' },
              { id: 'overdue', label: 'Overdue', color: 'bg-red-500/80 hover:bg-red-500' },
              { id: 'dueSoon', label: 'Due Soon', color: 'bg-yellow-500/80 hover:bg-yellow-500' },
              { id: 'pending', label: 'Pending', color: 'bg-blue-400/80 hover:bg-blue-400' },
              { id: 'paid', label: 'Paid', color: 'bg-green-500/80 hover:bg-green-500' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => handleFilterChange(filter.id)}
                title={`Filter budget list by ${filter.label}`}
                aria-label={`Filter budget list by ${filter.label}`}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === filter.id
                    ? 'ring-2 ring-white ' + filter.color
                    : filter.color
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 whitespace-nowrap">
            <button
              onClick={exportAllToCSV}
              className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={printReport}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-700 text-white rounded-lg hover:bg-blue-800 text-sm"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print Report</span>
            </button>
          </div>
        </div>

        {/* FLAT LIST VIEW - shown when filtering */}
        {viewMode === 'flat' && (() => {
          const flatItems = getFilteredItemsWithBucket().sort((a, b) => {
            const dateA = new Date(a.dueDate || '9999-12-31');
            const dateB = new Date(b.dueDate || '9999-12-31');
            return dateA - dateB;
          });

          return (
            <div className="px-4 pb-4 overflow-x-auto bg-white">
              <div className="py-3 text-sm text-gray-600">
                Showing {flatItems.length} {statusFilter !== 'all' ? statusFilter : ''} item{flatItems.length !== 1 ? 's' : ''} across all categories
              </div>
              <table className="w-full min-w-[1000px]">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-48">Category</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-64">Item</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 w-32">Est. Budget</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 w-32">Actual Cost</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-32">Due Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-40">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-64">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {flatItems.map(item => {
                    const rowColor = (() => {
                      if (item.status === 'paid') return 'bg-green-100 border-green-200';
                      const today = new Date();
                      const diffDays = Math.ceil((new Date(item.dueDate) - today) / (1000 * 60 * 60 * 24));
                      if (diffDays < 0) return 'bg-red-100 border-red-200';
                      if (diffDays <= 5) return 'bg-yellow-100 border-yellow-200';
                      return 'bg-white border-gray-200';
                    })();

                    return (
                      <tr key={`${item.bucketName}-${item.id}`} className={`border-t ${rowColor} hover:bg-blue-50`}>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900">{item.bucketDisplayName}</td>
                        <td className="px-3 py-2 text-sm">{item.category}</td>
                        <td className="px-3 py-2 text-sm text-right">${(item.estBudget || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-sm text-right">${(item.actualCost || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-sm">{item.dueDate || 'N/A'}</td>
                        <td className="px-3 py-2">{getStatusBadge(item)}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={item.note || ''}
                            onChange={(e) => {
                              const updatedBucket = state.buckets[item.bucketName].map(i =>
                                i.id === item.id ? { ...i, note: e.target.value } : i
                              );
                              setState({ ...state, buckets: { ...state.buckets, [item.bucketName]: updatedBucket } });
                            }}
                            onBlur={saveBudget}
                            placeholder="Add note..."
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* GROUPED VIEW - shown when no filter or "All Items" */}
        {viewMode === 'grouped' && categoryOrder.map(bucketName => {
          const items = getBudgetItemsForBucket(bucketName);
          const filteredItems = getFilteredItems(items);
          if (filteredItems.length === 0 && (searchQuery || statusFilter !== 'all')) return null;

          const IconComponent = categoryIcons[bucketName]?.icon || Package;
          const iconColor = categoryIcons[bucketName]?.color || 'text-gray-600';
          const displayTitle = categoryNames[bucketName] || DEFAULT_TITLES[bucketName] || bucketName;
          const isExpanded = expandedCategories[bucketName] === true;

          const totalBudgeted = items.reduce((sum, item) => sum + (Number(item.estBudget) || 0), 0);
          const totalActual = items.reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0);
          
          // Banking-specific totals
          const totalBalance = bucketName === 'banking' ? items.reduce((sum, item) => sum + (Number(item.currentBalance) || 0), 0) : 0;
          const totalAvailable = bucketName === 'banking' ? items.reduce((sum, item) => sum + (Number(item.availableCredit) || 0), 0) : 0;
          
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
                  <table className="w-full min-w-[900px]">
                    <thead className="bg-gray-100">
                      <tr>
                        {bucketName === 'banking' ? (
                          <>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-48">Item</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 w-32">Minimum</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 w-32">Balance</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 w-32">Actual Paid</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 w-32">Available</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-32">Due Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-40">Status</th>
                          </>
                        ) : (
                          <>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-64">Item</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 w-32">Est. Budget</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 w-32">Actual Cost</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-32">Due Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-40">Status</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-64">Notes</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {filteredItems.map(item => (
                        <tr key={item.id} className="border-t border-gray-200 hover:bg-blue-50">
                          {bucketName === 'banking' ? (
                            <>
                              <td className="px-3 py-2 text-sm">{item.category}</td>
                              <td className="px-3 py-2 text-sm text-right">${(item.estBudget || 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-right">${(item.currentBalance || 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-right">${(item.actualCost || 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-right">${(item.availableCredit || 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm">{item.dueDate || 'N/A'}</td>
                              <td className="px-3 py-2">{getStatusBadge(item)}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-3 py-2 text-sm">{item.category}</td>
                              <td className="px-3 py-2 text-sm text-right">${(item.estBudget || 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm text-right">${(item.actualCost || 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-sm">{item.dueDate || 'N/A'}</td>
                              <td className="px-3 py-2">{getStatusBadge(item)}</td>
                              <td className="px-3 py-2">
                            {item.isSystemItem ? (
                              <div className="rounded border border-yellow-200 bg-yellow-50 px-2 py-1 text-xs font-semibold text-yellow-900">
                                {item.note || 'Auto-calculated from CSC Shifts.'}
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={item.note || ''}
                                onChange={(e) => {
                                  const updatedBucket = state.buckets[bucketName].map(i =>
                                    i.id === item.id ? { ...i, note: e.target.value } : i
                                  );
                                  setState({ ...state, buckets: { ...state.buckets, [bucketName]: updatedBucket } });
                                }}
                                onBlur={saveBudget}
                                placeholder="Add note..."
                                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              />
                            )}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                      <tr>
                        <td className="px-3 py-2 text-sm font-semibold">Subtotal</td>
                        {bucketName === 'banking' ? (
                          <>
                            <td className="px-3 py-2 text-sm text-right font-bold">${totalBudgeted.toFixed(2)}</td>
                            <td className="px-3 py-2 text-sm text-right font-bold">${totalBalance.toFixed(2)}</td>
                            <td className="px-3 py-2 text-sm text-right font-bold">${totalActual.toFixed(2)}</td>
                            <td className="px-3 py-2 text-sm text-right font-bold">${totalAvailable.toFixed(2)}</td>
                            <td colSpan="2"></td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 text-sm text-right font-bold">${totalBudgeted.toFixed(2)}</td>
                            <td className="px-3 py-2 text-sm text-right font-bold">${totalActual.toFixed(2)}</td>
                            <td colSpan="3"></td>
                          </>
                        )}
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
      <div className="mx-auto mb-6 max-w-6xl overflow-hidden rounded-xl border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100">
        <div className="bg-blue-600 text-white px-4 py-3">
          <h3 className="text-lg font-bold">GRAND TOTALS</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Total Items</p>
              <p className="text-2xl font-bold text-gray-900">
                {categoryOrder.flatMap((bucketName) => getBudgetItemsForBucket(bucketName)).length}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Total Est. Budget</p>
              <p className="text-2xl font-bold text-blue-900">
                ${categoryOrder.flatMap((bucketName) => getBudgetItemsForBucket(bucketName)).reduce((sum, item) => sum + (Number(item.estBudget) || 0), 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Total Actual Cost</p>
              <p className="text-2xl font-bold text-purple-900">
                ${categoryOrder.flatMap((bucketName) => getBudgetItemsForBucket(bucketName)).reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Variance</p>
              {(() => {
                const totalBudget = categoryOrder.flatMap((bucketName) => getBudgetItemsForBucket(bucketName)).reduce((sum, item) => sum + (Number(item.estBudget) || 0), 0);
                const totalActual = categoryOrder.flatMap((bucketName) => getBudgetItemsForBucket(bucketName)).reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0);
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

    </PageContainer>
  );
};

export default DashboardTab;