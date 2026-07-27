// src/components/tabs/DashboardTab.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, Printer, AlertCircle, Clock, Download, Plus, Minus, CheckCircle2, Ban, Landmark, PauseCircle } from 'lucide-react';
import {
  DollarSign, Home, Car, Utensils, User, Monitor,
  CreditCard, Repeat, Package, WalletCards, PiggyBank
} from 'lucide-react';
import PageContainer from '../common/PageContainer.jsx';
import TabPageHeader from '../common/TabPageHeader.jsx';
import EmergencyFundWidget from '../modern/EmergencyFundWidget';
import CloseScreenButton from '../common/CloseScreenButton.jsx';

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
const CSC_ARCHIVE_STORAGE_KEY = 'cscShifts.archived.v1';
const CSC_SHIFT_UPDATE_EVENT = 'cscShifts:updated';
const PAYCHECK_STORAGE_KEY = 'paychecksTab.paychecks.v1';
const PAYCHECK_UPDATE_EVENT = 'paychecksChanged';
const RIDES_STORAGE_KEY = 'modivcareRides.v1';
const RIDES_ARCHIVE_STORAGE_KEY = 'modivcareRides.archived.v1';
const RIDES_UPDATE_EVENT = 'modivcareRides:updated';
const CASH_FLOW_STORAGE_KEY = 'dashboard.cashFlow.v1';
const CASH_FLOW_UPDATE_EVENT = 'dashboard:cashFlowUpdated';
const OVERTIME_HOUR_THRESHOLD = 8;
const DOUBLE_TIME_HOUR_THRESHOLD = 12;
const OVERTIME_RATE_MULTIPLIER = 1.5;
const DOUBLE_TIME_RATE_MULTIPLIER = 2;
const HOMELIGHT_SAVINGS_PROGRAM_ID = 'homelight-savings-2026';
const HOMELIGHT_SAVINGS_MONTHS = [
  { key: '2026-07', label: 'July', shortLabel: 'Jul', dueDate: '2026-07-31', required: 500 },
  { key: '2026-08', label: 'August', shortLabel: 'Aug', dueDate: '2026-08-31', required: 500 },
  { key: '2026-09', label: 'September', shortLabel: 'Sep', dueDate: '2026-09-30', required: 1000 },
  { key: '2026-10', label: 'October', shortLabel: 'Oct', dueDate: '2026-10-31', required: 1000 },
  { key: '2026-11', label: 'November', shortLabel: 'Nov', dueDate: '2026-11-30', required: 1000 },
  { key: '2026-12', label: 'December', shortLabel: 'Dec', dueDate: '2026-12-31', required: 1000 },
];

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

const loadArchivedCscBudgetShifts = () => {
  try {
    const saved = localStorage.getItem(CSC_ARCHIVE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load archived CSC shifts for budget dashboard:', error);
    return [];
  }
};

const loadPaycheckBudgetItems = () => {
  try {
    const saved = localStorage.getItem(PAYCHECK_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load paychecks for budget dashboard:', error);
    return [];
  }
};

const loadRideBudgetItems = () => {
  try {
    const active = JSON.parse(localStorage.getItem(RIDES_STORAGE_KEY) || '[]');
    const archived = JSON.parse(localStorage.getItem(RIDES_ARCHIVE_STORAGE_KEY) || '[]');
    const byId = new Map();

    [...(Array.isArray(active) ? active : []), ...(Array.isArray(archived) ? archived : [])].forEach((ride) => {
      if (ride?.id) byId.set(ride.id, ride);
    });

    return Array.from(byId.values());
  } catch (error) {
    console.error('Failed to load rides for budget dashboard:', error);
    return [];
  }
};

const loadDashboardCashFlow = () => {
  const emptyCashFlow = {
    availableNow: '',
    updatedAt: '',
  };

  try {
    const saved = localStorage.getItem(CASH_FLOW_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : {};
    return { ...emptyCashFlow, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
  } catch (error) {
    console.error('Failed to load dashboard cash-flow snapshot:', error);
    return emptyCashFlow;
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

  const hours = getCscShiftHours(shift);
  const regularHours = Math.min(hours, OVERTIME_HOUR_THRESHOLD);
  const overtimeHours = Math.min(Math.max(hours - OVERTIME_HOUR_THRESHOLD, 0), DOUBLE_TIME_HOUR_THRESHOLD - OVERTIME_HOUR_THRESHOLD);
  const doubleTimeHours = Math.max(hours - DOUBLE_TIME_HOUR_THRESHOLD, 0);
  const regularPay = regularHours * hourlyRate;
  const overtimePay = overtimeHours * hourlyRate * OVERTIME_RATE_MULTIPLIER;
  const doubleTimePay = doubleTimeHours * hourlyRate * DOUBLE_TIME_RATE_MULTIPLIER;

  return Math.round((regularPay + overtimePay + doubleTimePay) * 100) / 100;
};

const formatDashboardCurrency = (amount) =>
  `$${(Number(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getDashboardNumber = (value) => {
  const number = Number(String(value || '').replace(/[$,\s]/g, ''));
  return Number.isFinite(number) ? number : 0;
};

const getDashboardHourlyRate = (value) => {
  const number = getDashboardNumber(value);
  if (number > 100) return number / 100;
  return number;
};

const getDashboardRideFinancials = (ride = {}) => {
  const fare = getDashboardNumber(ride.fareAmount);
  const tip = getDashboardNumber(ride.tipAmount);
  const fees = getDashboardNumber(ride.feeAmount);
  const itemizedTotal = fare + tip + fees;
  const storedTotal = getDashboardNumber(ride.totalAmount);
  const total = storedTotal > 0 ? storedTotal : itemizedTotal;
  const fareAndFees = Math.max(total - tip, fare + fees);

  return {
    fare,
    tip,
    fees,
    fareAndFees,
    total,
  };
};

const getDashboardPaycheckHours = (paycheck = {}) => {
  const hours = getDashboardNumber(paycheck?.hours);
  const grossPay = getDashboardNumber(paycheck?.grossPay);
  const rate = getDashboardHourlyRate(paycheck?.rate);

  if (grossPay && rate) {
    const calculatedHours = grossPay / rate;
    if (!hours || Math.abs(hours - calculatedHours) > 0.25) {
      return calculatedHours;
    }
  }

  return hours;
};

const normalizeDashboardDate = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return '';

  return [
    String(parsed.getFullYear()).padStart(4, '0'),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
};

const formatDashboardDate = (value = '') => {
  const normalized = normalizeDashboardDate(value);
  if (!normalized) return '';

  const [year, month, day] = normalized.split('-');
  return `${month}/${day}/${year}`;
};

const formatDashboardUpdatedAt = (value = '') => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getDashboardItemAmount = (item = {}) => {
  const actual = getDashboardNumber(item.actualCost || item.actualSpent);
  const estimated = getDashboardNumber(item.estBudget || item.estimatedBudget || item.estimatedCost);
  return actual > 0 ? actual : estimated;
};

const getDashboardDateAtNoon = (value = '') => {
  const normalized = normalizeDashboardDate(value);
  if (!normalized) return null;

  const parsed = new Date(`${normalized}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDashboardIsoDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const addDashboardDays = (value, days) => {
  const date = value instanceof Date ? new Date(value) : getDashboardDateAtNoon(value);
  if (!date || Number.isNaN(date.getTime())) return null;

  date.setDate(date.getDate() + days);
  date.setHours(12, 0, 0, 0);
  return date;
};

const getNextCscFridayPayday = (value = new Date()) => {
  const payday = new Date(value);
  payday.setHours(12, 0, 0, 0);
  payday.setDate(payday.getDate() + ((5 - payday.getDay() + 7) % 7));
  return payday;
};

const getCscPayPeriodForPayday = (payday) => {
  return {
    start: addDashboardDays(payday, -13),
    end: addDashboardDays(payday, -7),
    source: 'csc-saturday-friday-cycle',
  };
};

const getHomelightSavingsMonthKey = (item = {}) => {
  if (item.homelightSavingsProgramId === HOMELIGHT_SAVINGS_PROGRAM_ID && item.homelightSavingsMonth) {
    return item.homelightSavingsMonth;
  }

  const itemName = String(item.category || '').trim().toLowerCase();
  const dueDate = normalizeDashboardDate(item.dueDate);
  const matchingMonth = HOMELIGHT_SAVINGS_MONTHS.find((month) => month.dueDate === dueDate);

  return itemName.includes('homelight') && itemName.includes('sav') && matchingMonth
    ? matchingMonth.key
    : '';
};

const getDebtDaysDelinquent = (item = {}) => {
  const sourceDate = normalizeDashboardDate(item.delinquentSince);
  if (!sourceDate) return 0;

  const start = new Date(`${sourceDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) return 0;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000));
};

const getDebtStage = (days = 0) => {
  if (days >= 120) return '120+';
  if (days >= 90) return '90-119';
  if (days >= 60) return '60-89';
  if (days >= 30) return '30-59';
  if (days >= 1) return '1-29';
  return 'Current';
};

const getDebtAmountOwed = (item = {}) =>
  getDashboardNumber(item.currentAmountOwed || item.currentBalance);

const hasDebtDetails = (item = {}) =>
  Boolean(
    item.accountStatus ||
      item.currentAmountOwed ||
      item.currentBalance ||
      item.pastDueAmount ||
      item.originalBalance ||
      item.lastPaymentDate ||
      item.delinquentSince ||
      item.collectionAgency ||
      item.sentToCollectionsDate ||
      item.originalCreditor ||
      item.accountLast4 ||
      item.settlementAmount ||
      item.debtStatusNotes ||
      item.status === 'notPaying'
  );

const isBudgetItemPaused = (item = {}) => item.status === 'paused';
const isBudgetItemActive = (item = {}) => !['notPaying', 'paused'].includes(item.status);

const DashboardTab = ({
  state,
  setState,
  saveBudget,
  searchQuery,
  budgetSubnav = null,
  onOpenEditor = () => {},
  showUrgentAlert = false,
  onCloseUrgentAlert = () => {},
}) => {
  const [expandedCategories, setExpandedCategories] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grouped'); // 'grouped' or 'flat'
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const [showBudgetOverview, setShowBudgetOverview] = useState(false);
  const [showPaymentAlerts, setShowPaymentAlerts] = useState(false);
  const [showDebtReconciliation, setShowDebtReconciliation] = useState(false);
  const [showHomelightSavings, setShowHomelightSavings] = useState(false);
  const [cscShifts, setCscShifts] = useState(() => loadCscBudgetShifts());
  const [archivedCscShifts, setArchivedCscShifts] = useState(() => loadArchivedCscBudgetShifts());
  const [paychecks, setPaychecks] = useState(() => loadPaycheckBudgetItems());
  const [rides, setRides] = useState(() => loadRideBudgetItems());
  const [cashFlow, setCashFlow] = useState(() => loadDashboardCashFlow());
  const [cashFlowDraft, setCashFlowDraft] = useState(() => loadDashboardCashFlow());
  const [isEditingCashFlow, setIsEditingCashFlow] = useState(false);

  const categoryNames = state?.meta?.categoryNames || {};
  const categoryOrder =
    (state?.meta?.categoryOrder && state.meta.categoryOrder.length > 0)
      ? state.meta.categoryOrder
      : Object.keys(state?.buckets || {});

  useEffect(() => {
    let refreshTimeoutId = null;

    const refreshCscShifts = () => {
      setCscShifts(loadCscBudgetShifts());
      setArchivedCscShifts(loadArchivedCscBudgetShifts());
    };

    const refreshAfterCscUpdate = () => {
      refreshCscShifts();
      window.clearTimeout(refreshTimeoutId);
      refreshTimeoutId = window.setTimeout(refreshCscShifts, 0);
    };

    window.addEventListener('storage', refreshCscShifts);
    window.addEventListener(CSC_SHIFT_UPDATE_EVENT, refreshAfterCscUpdate);

    return () => {
      window.clearTimeout(refreshTimeoutId);
      window.removeEventListener('storage', refreshCscShifts);
      window.removeEventListener(CSC_SHIFT_UPDATE_EVENT, refreshAfterCscUpdate);
    };
  }, []);

  useEffect(() => {
    const refreshPaychecks = () => setPaychecks(loadPaycheckBudgetItems());

    window.addEventListener('storage', refreshPaychecks);
    window.addEventListener(PAYCHECK_UPDATE_EVENT, refreshPaychecks);

    return () => {
      window.removeEventListener('storage', refreshPaychecks);
      window.removeEventListener(PAYCHECK_UPDATE_EVENT, refreshPaychecks);
    };
  }, []);

  useEffect(() => {
    const refreshRides = () => setRides(loadRideBudgetItems());

    window.addEventListener('storage', refreshRides);
    window.addEventListener(RIDES_UPDATE_EVENT, refreshRides);

    return () => {
      window.removeEventListener('storage', refreshRides);
      window.removeEventListener(RIDES_UPDATE_EVENT, refreshRides);
    };
  }, []);

  useEffect(() => {
    const refreshCashFlow = () => {
      const nextCashFlow = loadDashboardCashFlow();
      setCashFlow(nextCashFlow);
      if (!isEditingCashFlow) setCashFlowDraft(nextCashFlow);
    };

    window.addEventListener('storage', refreshCashFlow);
    window.addEventListener(CASH_FLOW_UPDATE_EVENT, refreshCashFlow);

    return () => {
      window.removeEventListener('storage', refreshCashFlow);
      window.removeEventListener(CASH_FLOW_UPDATE_EVENT, refreshCashFlow);
    };
  }, [isEditingCashFlow]);

  const handleSaveCashFlow = (event) => {
    event.preventDefault();

    const nextCashFlow = {
      availableNow: cashFlowDraft.availableNow,
      updatedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(CASH_FLOW_STORAGE_KEY, JSON.stringify(nextCashFlow));
      setCashFlow(nextCashFlow);
      setCashFlowDraft(nextCashFlow);
      setIsEditingCashFlow(false);
      window.dispatchEvent(new Event(CASH_FLOW_UPDATE_EVENT));
    } catch (error) {
      console.error('Failed to save dashboard cash-flow snapshot:', error);
    }
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const getItemStatus = (item) => {
    if (item.status === 'notPaying') return 'notPaying';
    if (item.status === 'paused') return 'paused';
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
      case 'notPaying':
        return (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-1 text-xs font-bold text-slate-800"
            title={item.notPayingReason || 'Excluded from active payment plan'}
          >
            <Ban className="h-3 w-3" />
            Excluded
          </span>
        );
      case 'paused':
        return (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-800"
            title={item.pausedReason || 'Temporarily paused'}
          >
            <PauseCircle className="h-3 w-3" />
            Paused
          </span>
        );
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
    const counts = { overdue: 0, dueSoon: 0, pending: 0, paid: 0, paused: 0, notPaying: 0 };
    items.forEach(item => {
      const status = getItemStatus(item);
      if (status === 'overdue') counts.overdue++;
      else if (status === 'dueSoon') counts.dueSoon++;
      else if (status === 'paid') counts.paid++;
      else if (status === 'paused') counts.paused++;
      else if (status === 'notPaying') counts.notPaying++;
      else counts.pending++;
    });
    return counts;
  };

  const cscIncome = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const activeShifts = cscShifts.filter((shift) => shift?.shiftStatus !== 'Cancelled');
    const paidShifts = activeShifts.filter((shift) => shift?.paidStatus === 'Paid');
    const unpaidShifts = activeShifts.filter((shift) => shift?.paidStatus !== 'Paid');
    const doneShifts = activeShifts.filter((shift) => shift?.shiftStatus === 'Done');
    const currentMonthUnpaidShifts = unpaidShifts.filter((shift) =>
      normalizeDashboardDate(shift?.startDate).startsWith(currentMonth)
    );

    const estimatedPay = activeShifts.reduce((sum, shift) => sum + getCscEstimatedPay(shift), 0);
    const paidPay = paidShifts.reduce((sum, shift) => sum + getCscEstimatedPay(shift), 0);
    const unpaidPay = unpaidShifts.reduce((sum, shift) => sum + getCscEstimatedPay(shift), 0);
    const currentMonthUnpaidPay = currentMonthUnpaidShifts.reduce((sum, shift) => sum + getCscEstimatedPay(shift), 0);
    const estimatedHours = activeShifts.reduce((sum, shift) => sum + getCscShiftHours(shift), 0);
    const workedHours = doneShifts.reduce((sum, shift) => sum + getCscShiftHours(shift), 0);

    return {
      activeShiftCount: activeShifts.length,
      paidShiftCount: paidShifts.length,
      unpaidShiftCount: unpaidShifts.length,
      currentMonthUnpaidShiftCount: currentMonthUnpaidShifts.length,
      estimatedPay,
      paidPay,
      unpaidPay,
      currentMonthUnpaidPay,
      estimatedHours,
      workedHours,
    };
  }, [cscShifts]);

  const cscIncomeItem = useMemo(() => ({
    id: 'system-csc-shift-income',
    category: 'CSC Unpaid Shift Projection',
    estBudget: cscIncome.unpaidPay,
    actualCost: 0,
    dueDate: '',
    status: cscIncome.unpaidPay > 0 ? 'pending' : 'paid',
    note: `${cscIncome.unpaidShiftCount} unpaid shifts · paid shifts should come from scanned paychecks · projected unpaid ${formatDashboardCurrency(cscIncome.unpaidPay)}`,
    isSystemItem: true,
  }), [cscIncome]);

  const paycheckIncome = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const normalized = paychecks
      .map((paycheck) => {
        const checkDate = normalizeDashboardDate(paycheck?.checkDate);
        const rate = getDashboardHourlyRate(paycheck?.rate);
        const hours = getDashboardPaycheckHours(paycheck);
        const grossPay = getDashboardNumber(paycheck?.grossPay);
        const taxes = getDashboardNumber(paycheck?.taxes);
        const netPay = getDashboardNumber(paycheck?.netPay || paycheck?.checkAmount);
        return {
          ...paycheck,
          checkDate,
          rate,
          hours,
          grossPay,
          taxes,
          netPay,
        };
      })
      .filter((paycheck) => paycheck.checkDate || paycheck.netPay || paycheck.grossPay);

    const currentMonthPaychecks = normalized.filter((paycheck) => paycheck.checkDate.startsWith(currentMonth));
    const totalGrossPay = normalized.reduce((sum, paycheck) => sum + paycheck.grossPay, 0);
    const totalTaxes = normalized.reduce((sum, paycheck) => sum + paycheck.taxes, 0);
    const totalNetPay = normalized.reduce((sum, paycheck) => sum + paycheck.netPay, 0);
    const totalHours = normalized.reduce((sum, paycheck) => sum + paycheck.hours, 0);
    const currentMonthNetPay = currentMonthPaychecks.reduce((sum, paycheck) => sum + paycheck.netPay, 0);
    const currentMonthGrossPay = currentMonthPaychecks.reduce((sum, paycheck) => sum + paycheck.grossPay, 0);
    const currentMonthHours = currentMonthPaychecks.reduce((sum, paycheck) => sum + paycheck.hours, 0);
    const latestPaycheck = [...normalized].sort((a, b) => String(b.checkDate).localeCompare(String(a.checkDate)))[0] || null;

    return {
      paychecks: normalized,
      paycheckCount: normalized.length,
      currentMonthPaychecks,
      currentMonthCount: currentMonthPaychecks.length,
      totalGrossPay,
      totalTaxes,
      totalNetPay,
      totalHours,
      currentMonthNetPay,
      currentMonthGrossPay,
      currentMonthHours,
      latestPaycheck,
    };
  }, [paychecks]);

  const cscWeeklyPay = useMemo(() => {
    const payday = getNextCscFridayPayday();
    const payPeriod = getCscPayPeriodForPayday(payday);
    const paydayDate = getDashboardIsoDate(payday);
    const payPeriodStart = getDashboardIsoDate(payPeriod.start);
    const payPeriodEnd = getDashboardIsoDate(payPeriod.end);

    const shiftRecordsById = new Map();
    [...archivedCscShifts, ...cscShifts].forEach((shift, index) => {
      const recordKey = String(shift?.id || '').trim() || [
        normalizeDashboardDate(shift?.startDate),
        shift?.startTime || '',
        normalizeDashboardDate(shift?.finishDate),
        shift?.finishTime || '',
        shift?.venue || '',
        shift?.event || '',
        shift?.jobName || '',
      ].join('|') || `csc-shift-${index}`;
      const recordSource = cscShifts.includes(shift) ? 'active' : 'archived';
      shiftRecordsById.set(recordKey, { shift, recordSource });
    });

    const shiftsForPaycheck = Array.from(shiftRecordsById.values()).filter(({ shift }) => {
      if (shift?.shiftStatus === 'Cancelled') return false;

      const shiftDate = normalizeDashboardDate(shift?.startDate);
      return Boolean(shiftDate && shiftDate >= payPeriodStart && shiftDate <= payPeriodEnd);
    });
    const expectedGross = shiftsForPaycheck.reduce(
      (sum, record) => sum + getCscEstimatedPay(record.shift),
      0
    );
    const expectedHours = shiftsForPaycheck.reduce(
      (sum, record) => sum + getCscShiftHours(record.shift),
      0
    );
    const archivedShiftCount = shiftsForPaycheck.filter(
      (record) => record.recordSource === 'archived'
    ).length;

    return {
      paydayDate,
      payPeriodStart,
      payPeriodEnd,
      shiftCount: shiftsForPaycheck.length,
      archivedShiftCount,
      expectedGross: Math.round(expectedGross * 100) / 100,
      expectedHours: Math.round(expectedHours * 100) / 100,
    };
  }, [archivedCscShifts, cscShifts]);

  const paycheckIncomeItem = useMemo(() => ({
    id: 'system-csc-paycheck-income',
    category: 'CSC Paycheck Income',
    estBudget: paycheckIncome.totalGrossPay,
    actualCost: paycheckIncome.totalNetPay,
    dueDate: '',
    status: 'paid',
    note: `${paycheckIncome.paycheckCount} scanned paycheck${paycheckIncome.paycheckCount === 1 ? '' : 's'} · ${paycheckIncome.totalHours.toFixed(1)} hrs · taxes ${formatDashboardCurrency(paycheckIncome.totalTaxes)}`,
    isSystemItem: true,
  }), [paycheckIncome]);

  const rideExpenses = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const normalized = rides
      .map((ride) => {
        const rideDate = normalizeDashboardDate(ride?.rideDate);
        return {
          ...ride,
          rideDate,
          financials: getDashboardRideFinancials(ride),
        };
      })
      .filter((ride) => ride.rideDate);

    const currentMonthRides = normalized.filter((ride) => ride.rideDate.startsWith(currentMonth));
    const sumFinancials = (rideList) =>
      rideList.reduce(
        (totals, ride) => {
          totals.fare += ride.financials.fare;
          totals.tip += ride.financials.tip;
          totals.fees += ride.financials.fees;
          totals.fareAndFees += ride.financials.fareAndFees;
          totals.total += ride.financials.total;
          return totals;
        },
        { fare: 0, tip: 0, fees: 0, fareAndFees: 0, total: 0 }
      );

    return {
      rideCount: normalized.length,
      currentMonthRideCount: currentMonthRides.length,
      allTime: sumFinancials(normalized),
      currentMonth: sumFinancials(currentMonthRides),
    };
  }, [rides]);

  const rideFareFeesItem = useMemo(() => ({
    id: 'system-ride-fares-fees',
    category: 'Ride Fares & Fees',
    estBudget: 0,
    actualCost: rideExpenses.currentMonth.fareAndFees,
    dueDate: '',
    status: 'paid',
    note: `${rideExpenses.currentMonthRideCount} ride${rideExpenses.currentMonthRideCount === 1 ? '' : 's'} this month · fares ${formatDashboardCurrency(rideExpenses.currentMonth.fare)} · fees ${formatDashboardCurrency(rideExpenses.currentMonth.fees)} · all tracked ${formatDashboardCurrency(rideExpenses.allTime.fareAndFees)}`,
    isSystemItem: true,
  }), [rideExpenses]);

  const rideTipsItem = useMemo(() => ({
    id: 'system-ride-tips',
    category: 'Ride Tips',
    estBudget: 0,
    actualCost: rideExpenses.currentMonth.tip,
    dueDate: '',
    status: 'paid',
    note: `${rideExpenses.currentMonthRideCount} ride${rideExpenses.currentMonthRideCount === 1 ? '' : 's'} this month · all tracked tips ${formatDashboardCurrency(rideExpenses.allTime.tip)}`,
    isSystemItem: true,
  }), [rideExpenses]);

  const debtSummary = useMemo(() => {
    const accounts = [];

    Object.entries(state?.buckets || {}).forEach(([bucketName, items]) => {
      if (bucketName === 'income') return;

      (items || []).forEach((item) => {
        if (!hasDebtDetails(item)) return;

        const amountOwed = getDebtAmountOwed(item);
        const pastDueAmount = getDashboardNumber(item.pastDueAmount);
        const daysDelinquent = getDebtDaysDelinquent(item);
        const accountStatus = String(item.accountStatus || 'Not specified').trim();
        const normalizedStatus = accountStatus.toLowerCase();

        accounts.push({
          ...item,
          bucketName,
          bucketDisplayName: categoryNames[bucketName] || DEFAULT_TITLES[bucketName] || bucketName,
          amountOwed,
          pastDueAmount,
          daysDelinquent,
          delinquencyStage: getDebtStage(daysDelinquent),
          accountStatus,
          normalizedStatus,
          excludedFromPaymentPlan: item.status === 'notPaying',
          pausedFromPaymentPlan: item.status === 'paused',
        });
      });
    });

    const stageCounts = {
      current: 0,
      '1-29': 0,
      '30-59': 0,
      '60-89': 0,
      '90-119': 0,
      '120+': 0,
    };

    accounts.forEach((account) => {
      const stage = account.delinquencyStage;
      stageCounts[stage === 'Current' ? 'current' : stage] += 1;
    });

    const isClosed = (account) => /closed|paid in full|settled/i.test(account.accountStatus);
    const isCollections = (account) =>
      /collection/i.test(account.accountStatus) || Boolean(account.collectionAgency || account.sentToCollectionsDate);
    const isChargedOff = (account) => /charged off/i.test(account.accountStatus);

    return {
      accounts: [...accounts].sort((first, second) => {
        if (second.daysDelinquent !== first.daysDelinquent) return second.daysDelinquent - first.daysDelinquent;
        return second.amountOwed - first.amountOwed;
      }),
      accountCount: accounts.length,
      totalOwed: accounts.reduce((sum, account) => sum + account.amountOwed, 0),
      totalPastDue: accounts.reduce((sum, account) => sum + account.pastDueAmount, 0),
      activePlanOwed: accounts
        .filter((account) => !account.excludedFromPaymentPlan && !account.pausedFromPaymentPlan)
        .reduce((sum, account) => sum + account.amountOwed, 0),
      pausedOwed: accounts
        .filter((account) => account.pausedFromPaymentPlan)
        .reduce((sum, account) => sum + account.amountOwed, 0),
      pausedCount: accounts.filter((account) => account.pausedFromPaymentPlan).length,
      excludedOwed: accounts
        .filter((account) => account.excludedFromPaymentPlan)
        .reduce((sum, account) => sum + account.amountOwed, 0),
      excludedCount: accounts.filter((account) => account.excludedFromPaymentPlan).length,
      closedCount: accounts.filter(isClosed).length,
      collectionsCount: accounts.filter(isCollections).length,
      chargedOffCount: accounts.filter(isChargedOff).length,
      delinquentCount: accounts.filter((account) => account.daysDelinquent > 0).length,
      stageCounts,
    };
  }, [state?.buckets, categoryNames]);

  const homelightSavings = useMemo(() => {
    const linkedItems = new Map();

    Object.entries(state?.buckets || {}).forEach(([bucketName, items]) => {
      (items || []).forEach((item) => {
        const monthKey = getHomelightSavingsMonthKey(item);
        if (!monthKey || linkedItems.has(monthKey)) return;
        linkedItems.set(monthKey, { ...item, bucketName });
      });
    });

    const now = new Date();
    const todayKey = [
      String(now.getFullYear()).padStart(4, '0'),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('-');

    const months = HOMELIGHT_SAVINGS_MONTHS.map((month) => {
      const item = linkedItems.get(month.key) || null;
      const saved = getDashboardNumber(item?.actualCost);
      const variance = saved - month.required;
      let status = 'upcoming';

      if (!item) status = 'notLinked';
      else if (saved >= month.required) status = 'met';
      else if (month.dueDate < todayKey) status = 'short';
      else if (saved > 0) status = 'inProgress';

      return { ...month, item, saved, variance, status };
    });

    const totalRequired = months.reduce((sum, month) => sum + month.required, 0);
    const totalSaved = months.reduce((sum, month) => sum + month.saved, 0);
    const requiredToDate = months
      .filter((month) => month.dueDate <= todayKey)
      .reduce((sum, month) => sum + month.required, 0);
    const overallVariance = totalSaved - requiredToDate;
    const nextMonth = months.find((month) => month.dueDate >= todayKey && month.saved < month.required) || null;

    return {
      months,
      totalRequired,
      totalSaved,
      requiredToDate,
      overallVariance,
      remaining: Math.max(totalRequired - totalSaved, 0),
      linkedCount: linkedItems.size,
      missingCount: Math.max(HOMELIGHT_SAVINGS_MONTHS.length - linkedItems.size, 0),
      nextMonth,
    };
  }, [state?.buckets]);

  const setupHomelightSavingsPlan = () => {
    const linkedMonths = new Set();
    const updatedBuckets = {};

    Object.entries(state?.buckets || {}).forEach(([bucketName, items]) => {
      updatedBuckets[bucketName] = (items || []).map((item) => {
        const monthKey = getHomelightSavingsMonthKey(item);
        if (!monthKey || linkedMonths.has(monthKey)) return item;

        linkedMonths.add(monthKey);
        return {
          ...item,
          homelightSavingsProgramId: HOMELIGHT_SAVINGS_PROGRAM_ID,
          homelightSavingsMonth: monthKey,
          recurrence: 'none',
        };
      });
    });

    const missingItems = HOMELIGHT_SAVINGS_MONTHS
      .filter((month) => !linkedMonths.has(month.key))
      .map((month) => ({
        id: `homelight-savings-${month.key}`,
        category: `Homelight Savings - ${month.label}`,
        estBudget: month.required,
        actualCost: 0,
        dueDate: month.dueDate,
        status: 'pending',
        recurrence: 'none',
        note: `Homelight contracted savings requirement for ${month.label} 2026. Enter the amount saved in Actual Cost.`,
        homelightSavingsProgramId: HOMELIGHT_SAVINGS_PROGRAM_ID,
        homelightSavingsMonth: month.key,
      }));

    updatedBuckets.housing = [...(updatedBuckets.housing || []), ...missingItems];

    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    saveBudget(
      updatedState,
      missingItems.length
        ? `Homelight savings plan linked and ${missingItems.length} missing month${missingItems.length === 1 ? '' : 's'} added.`
        : 'Homelight savings plan linked to the Budget Editor.'
    );
  };

  const getBudgetItemsForBucket = (bucketName) => {
    const items = state?.buckets?.[bucketName] || [];

    if (bucketName === 'transportation') {
      const rideItems = [];
      if (rideExpenses.currentMonthRideCount || rideExpenses.currentMonth.total) {
        rideItems.push(rideFareFeesItem, rideTipsItem);
      }
      return [...items, ...rideItems];
    }

    if (bucketName !== 'income') return items;

    const systemIncomeItems = [];
    if (paycheckIncome.paycheckCount || paycheckIncome.totalNetPay) systemIncomeItems.push(paycheckIncomeItem);
    if (cscIncome.unpaidShiftCount || cscIncome.unpaidPay) systemIncomeItems.push(cscIncomeItem);
    return [...items, ...systemIncomeItems];
  };

  const summary = useMemo(() => {
    const allItems = Object.values(state?.buckets || {}).flat();

    const expenseItems = Object.entries(state?.buckets || {})
      .filter(([bucketName]) => bucketName !== 'income')
      .flatMap(([, items]) => items || [])
      .filter(isBudgetItemActive);

    const manualIncome = (state?.buckets?.income || []).reduce((sum, item) =>
      sum + (Number(item.actualCost) || Number(item.estBudget) || 0), 0
    );

    const manualIncomeReceived = (state?.buckets?.income || []).reduce(
      (sum, item) => sum + getDashboardNumber(item.actualCost || item.actualSpent),
      0
    );

    const income = manualIncome + paycheckIncome.currentMonthNetPay + cscIncome.currentMonthUnpaidPay;
    const expenses = expenseItems.reduce((sum, item) => sum + getDashboardItemAmount(item), 0) +
      rideExpenses.currentMonth.total;
    const actualIncomeReceived = manualIncomeReceived + paycheckIncome.currentMonthNetPay;
    const actualExpensesPaid = expenseItems.reduce(
      (sum, item) => sum + getDashboardNumber(item.actualCost || item.actualSpent),
      0
    ) + rideExpenses.currentMonth.total;

    const activeBudgetItems = allItems.filter(isBudgetItemActive);
    const totalBudgeted = activeBudgetItems.reduce((sum, item) => sum + (Number(item.estBudget) || 0), 0);
    const totalActual =
      activeBudgetItems.reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0) +
      rideExpenses.currentMonth.total;

    return {
      income,
      manualIncome,
      cscIncome,
      paycheckIncome,
      expenses,
      netIncome: income - expenses,
      actualIncomeReceived,
      actualExpensesPaid,
      actualMonthToDateNet: actualIncomeReceived - actualExpensesPaid,
      budgetVariance: totalActual - totalBudgeted
    };
  }, [state?.buckets, cscIncome, paycheckIncome, rideExpenses]);


  const budgetOverview = useMemo(() => {
    const allItems = categoryOrder
      .filter((bucketName) => bucketName !== 'income')
      .flatMap((bucketName) => getBudgetItemsForBucket(bucketName));
    const totalItems = allItems.length;
    const activeItems = allItems.filter(isBudgetItemActive);
    const overdueStatusItems = activeItems.filter((item) => getItemStatus(item) === 'overdue');
    const dueSoonStatusItems = activeItems.filter((item) => getItemStatus(item) === 'dueSoon');
    const pendingStatusItems = activeItems.filter((item) => getItemStatus(item) === 'pending');
    const paidStatusItems = activeItems.filter((item) => getItemStatus(item) === 'paid');
    const paidItems = paidStatusItems.length;
    const pendingItems = pendingStatusItems.length;
    const pausedItems = allItems.filter(isBudgetItemPaused).length;
    const notPayingItems = allItems.filter((item) => item.status === 'notPaying').length;
    const overdueItems = overdueStatusItems.length;
    const dueSoonItems = dueSoonStatusItems.length;
    const totalEstimated = activeItems.reduce(
      (sum, item) => sum + Number(item.estBudget || item.estimatedBudget || item.estimatedCost || 0),
      0
    );
    const totalActual = activeItems.reduce(
      (sum, item) => sum + Number(item.actualCost || item.actualSpent || 0),
      0
    );
    const statusAmount = (items) => items.reduce((sum, item) => sum + getDashboardItemAmount(item), 0);
    const closestDueSoonDate = dueSoonStatusItems
      .map((item) => normalizeDashboardDate(item.dueDate))
      .filter(Boolean)
      .sort()[0] || '';

    return {
      totalItems,
      paidItems,
      pendingItems,
      pausedItems,
      notPayingItems,
      overdueItems,
      dueSoonItems,
      overdueAmount: statusAmount(overdueStatusItems),
      dueSoonAmount: statusAmount(dueSoonStatusItems),
      pendingAmount: statusAmount(pendingStatusItems),
      paidAmount: statusAmount(paidStatusItems),
      closestDueSoonDate,
      totalEstimated,
      totalActual,
      archivedItems: state?.archived?.length || 0,
    };
  }, [state?.buckets, state?.archived, categoryOrder, cscIncome, paycheckIncome, rideExpenses]);

  const cashFlowOverview = useMemo(() => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const fourteenDaysFromNow = new Date(today);
    fourteenDaysFromNow.setDate(fourteenDaysFromNow.getDate() + 14);

    const hasAvailableNow = String(cashFlow.availableNow ?? '').trim() !== '';
    const availableNow = getDashboardNumber(cashFlow.availableNow);
    const nextIncomeAmount = cscWeeklyPay.expectedGross;
    const nextIncomeDate = getDashboardDateAtNoon(cscWeeklyPay.paydayDate);

    const unpaidExpenseItems = categoryOrder
      .filter((bucketName) => bucketName !== 'income')
      .flatMap((bucketName) => getBudgetItemsForBucket(bucketName))
      .filter(isBudgetItemActive)
      .filter((item) => getItemStatus(item) !== 'paid');

    const dueBeforeNextIncomeItems = nextIncomeDate
      ? unpaidExpenseItems.filter((item) => {
          const dueDate = getDashboardDateAtNoon(item.dueDate);
          return dueDate && dueDate <= nextIncomeDate;
        })
      : [];

    const nextFourteenDayItems = unpaidExpenseItems.filter((item) => {
      const dueDate = getDashboardDateAtNoon(item.dueDate);
      return dueDate && dueDate >= today && dueDate <= fourteenDaysFromNow;
    });

    const dueBeforeNextIncome = dueBeforeNextIncomeItems.reduce(
      (sum, item) => sum + getDashboardItemAmount(item),
      0
    );
    const dueNextFourteenDays = nextFourteenDayItems.reduce(
      (sum, item) => sum + getDashboardItemAmount(item),
      0
    );
    const nextIncomeWithinFourteenDays = Boolean(
      nextIncomeDate && nextIncomeDate >= today && nextIncomeDate <= fourteenDaysFromNow
    );
    const incomingNextFourteenDays = nextIncomeWithinFourteenDays ? nextIncomeAmount : 0;
    const lowestBalance = availableNow - dueBeforeNextIncome;

    return {
      hasAvailableNow,
      availableNow,
      nextIncomeAmount,
      nextIncomeDate: cscWeeklyPay.paydayDate,
      hasNextIncomeDate: Boolean(nextIncomeDate),
      dueBeforeNextIncome,
      dueBeforeNextIncomeCount: dueBeforeNextIncomeItems.length,
      lowestBalance,
      safeToSpend: Math.max(0, lowestBalance),
      afterNextIncome: lowestBalance + nextIncomeAmount,
      dueNextFourteenDays,
      dueNextFourteenDaysCount: nextFourteenDayItems.length,
      incomingNextFourteenDays,
      nextFourteenDayNet: incomingNextFourteenDays - dueNextFourteenDays,
    };
  }, [cashFlow, cscWeeklyPay, state?.buckets, categoryOrder, rideExpenses]);

  const alerts = useMemo(() => {
    const allItems = [];
    categoryOrder.forEach((bucket) => {
      if (bucket === 'income') return;
      const items = getBudgetItemsForBucket(bucket);
      items.forEach(item => {
        allItems.push({ ...item, bucket });
      });
    });

    const activeItems = allItems.filter(isBudgetItemActive);
    const overdue = activeItems.filter(item => getItemStatus(item) === 'overdue');
    const upcoming = activeItems.filter(item => getItemStatus(item) === 'dueSoon');

    return { overdue, upcoming };
  }, [state?.buckets, categoryOrder, cscIncome, paycheckIncome, rideExpenses]);

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
        if (statusFilter === 'paused') return status === 'paused';
        if (statusFilter === 'notPaying') return status === 'notPaying';
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
    const headers = [
      'Category',
      'Item',
      'Est. Budget',
      'Paid',
      'Due Date',
      'Payment Plan Status',
      'Not Paying Reason',
      'Pause Reason',
      'Paused At',
      'Account Status',
      'Amount Owed',
      'Past Due',
      'Delinquent Since',
      'Days Delinquent',
      'Delinquency Stage',
      'Collection Agency',
      'Original Creditor',
      'Account Last 4',
      'Settlement Amount',
      'Debt Notes',
    ];
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
          item.status || 'pending',
          item.notPayingReason || '',
          item.pausedReason || '',
          item.pausedAt || '',
          item.accountStatus || '',
          getDebtAmountOwed(item),
          getDashboardNumber(item.pastDueAmount),
          item.delinquentSince || '',
          getDebtDaysDelinquent(item),
          getDebtStage(getDebtDaysDelinquent(item)),
          item.collectionAgency || '',
          item.originalCreditor || '',
          item.accountLast4 || '',
          getDashboardNumber(item.settlementAmount),
          item.debtStatusNotes || ''
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
          .paused { background-color: #eef2ff; }
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
            <strong>CSC Paychecks:</strong> ${formatDashboardCurrency(paycheckIncome.totalNetPay)}
          </div>
          <div class="summary-card">
            <strong>CSC Unpaid Shift Projection:</strong> ${formatDashboardCurrency(cscIncome.unpaidPay)}
          </div>
          <div class="summary-card">
            <strong>Ride Expenses This Month:</strong> ${formatDashboardCurrency(rideExpenses.currentMonth.total)}
          </div>
          <div class="summary-card">
            <strong>Total Debt Owed:</strong> ${formatDashboardCurrency(debtSummary.totalOwed)}
          </div>
          <div class="summary-card">
            <strong>Total Past Due:</strong> ${formatDashboardCurrency(debtSummary.totalPastDue)}
          </div>
          <div class="summary-card">
            <strong>Excluded From Payment Plan:</strong> ${formatDashboardCurrency(debtSummary.excludedOwed)}
          </div>
          <div class="summary-card">
            <strong>Paused Budget Items:</strong> ${budgetOverview.pausedItems}
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
                <th>Paid</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => {
                const status = getItemStatus(item);
                const rowClass = status === 'overdue' ? 'overdue' : status === 'dueSoon' ? 'due-soon' : status === 'paid' ? 'paid' : status === 'paused' ? 'paused' : '';
                return `
                  <tr class="${rowClass}">
                    <td>${item.category || ''}</td>
                    <td>$${(item.estBudget || 0).toFixed(2)}</td>
                    <td>$${(item.actualCost || 0).toFixed(2)}</td>
                    <td>${item.dueDate || ''}</td>
                    <td>${status}</td>
                    <td>${[
                      item.note || '',
                      item.accountStatus ? `Account status: ${item.accountStatus}` : '',
                      getDebtAmountOwed(item) ? `Amount owed: ${formatDashboardCurrency(getDebtAmountOwed(item))}` : '',
                      item.pastDueAmount ? `Past due: ${formatDashboardCurrency(item.pastDueAmount)}` : '',
                      item.delinquentSince ? `Delinquent since: ${item.delinquentSince} (${getDebtDaysDelinquent(item)} days)` : '',
                      item.collectionAgency ? `Collections: ${item.collectionAgency}` : '',
                      item.notPayingReason ? `Payment plan: ${item.notPayingReason}` : '',
                      item.pausedReason ? `Paused: ${item.pausedReason}` : '',
                      item.pausedAt ? `Paused at: ${formatDashboardDate(item.pausedAt)}` : '',
                      item.debtStatusNotes || '',
                    ].filter(Boolean).join(' | ')}</td>
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
        if (statusFilter === 'paused') return status === 'paused';
        if (statusFilter === 'notPaying') return status === 'notPaying';
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
    <PageContainer surfaceClassName="min-h-screen bg-blue-50" className="budget-overview-page bg-blue-50 py-6">
      {/* Urgent Payment Alert Modal */}
      {(() => {
        const urgentItems = [];
        Object.entries(state?.buckets || {}).forEach(([bucket, items]) => {
          if (bucket === 'income') return; // Skip income items
          items.forEach(item => {
            if (item.status !== 'paid' && isBudgetItemActive(item)) {
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
          <CloseScreenButton onClick={onCloseUrgentAlert} />
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

      <TabPageHeader
        icon={WalletCards}
        title="Budget Overview"
        subtitle="Review budget status, due dates, saved items, spending totals, CSC income, and paycheck activity."
        theme="blue"
        actions={budgetSubnav}
        className="budget-mobile-header"
      />

      <section className="mx-auto mb-3 mt-3 max-w-6xl overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm sm:mb-5 sm:mt-5 sm:rounded-2xl">
        <button
          type="button"
          onClick={() => setShowBudgetOverview((prev) => !prev)}
          className="flex w-full items-center gap-1.5 border-b border-blue-100 bg-blue-100/60 px-4 py-2 text-left text-sm font-bold text-blue-900 transition-colors hover:bg-blue-100 sm:gap-2 sm:px-5 sm:py-2.5"
        >
          {showBudgetOverview ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {showBudgetOverview ? 'Hide Stats' : 'Show Stats'}
        </button>

        {showBudgetOverview && (
          <div className="space-y-3 border-t border-blue-100 bg-slate-50/70 p-3 sm:space-y-4 sm:p-4">
            <section aria-labelledby="financial-snapshot-title">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <h2 id="financial-snapshot-title" className="text-sm font-extrabold text-slate-900 sm:text-base">Financial Overview</h2>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-500 sm:text-xs">Actual cash position, month-to-date results, and month-end forecast.</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-wide text-slate-500 sm:text-[11px]">
                  Current month
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-3 sm:gap-3">
                <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-3.5 text-emerald-950 shadow-sm sm:rounded-2xl sm:p-4">
                  <DollarSign className="absolute right-3 top-3 h-8 w-8 text-emerald-200 sm:h-9 sm:w-9" />
                  <p className="relative text-[11px] font-extrabold uppercase leading-tight tracking-wide text-emerald-700 sm:text-xs">Income Forecast</p>
                  <p className="relative mt-1.5 text-2xl font-black leading-none sm:text-[28px]">{formatDashboardCurrency(summary.income)}</p>
                  <div className="relative mt-2.5 grid grid-cols-3 gap-1.5 border-t border-emerald-100 pt-2 text-[10px] leading-tight sm:text-[11px]">
                    <div>
                      <p className="text-emerald-700">Budget</p>
                      <p className="font-extrabold">{formatDashboardCurrency(summary.manualIncome)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-700">Paychecks</p>
                      <p className="font-extrabold">{formatDashboardCurrency(paycheckIncome.currentMonthNetPay)}</p>
                    </div>
                    <div>
                      <p className="text-emerald-700">Unpaid this month</p>
                      <p className="font-extrabold">{formatDashboardCurrency(cscIncome.currentMonthUnpaidPay)}</p>
                    </div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-3.5 text-rose-950 shadow-sm sm:rounded-2xl sm:p-4">
                  <CreditCard className="absolute right-3 top-3 h-8 w-8 text-rose-200 sm:h-9 sm:w-9" />
                  <p className="relative text-[11px] font-extrabold uppercase leading-tight tracking-wide text-rose-700 sm:text-xs">Total Expenses</p>
                  <p className="relative mt-1.5 text-2xl font-black leading-none sm:text-[28px]">{formatDashboardCurrency(summary.expenses)}</p>
                  <p className="relative mt-2.5 border-t border-rose-100 pt-2 text-[10px] font-semibold leading-tight text-rose-700 sm:text-[11px]">
                    Active budget costs and this month&apos;s ride expenses.
                  </p>
                </div>

                <div className={`${summary.netIncome >= 0 ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-950' : 'border-orange-200 bg-gradient-to-br from-orange-50 to-red-100 text-orange-950'} relative overflow-hidden rounded-xl border p-3.5 shadow-sm sm:rounded-2xl sm:p-4`}>
                  <PiggyBank className={`${summary.netIncome >= 0 ? 'text-blue-200' : 'text-orange-200'} absolute right-3 top-3 h-8 w-8 sm:h-9 sm:w-9`} />
                  <p className={`${summary.netIncome >= 0 ? 'text-blue-700' : 'text-orange-700'} relative text-[11px] font-extrabold uppercase leading-tight tracking-wide sm:text-xs`}>Projected Month-End Surplus</p>
                  <p className="relative mt-1.5 text-2xl font-black leading-none sm:text-[28px]">{formatDashboardCurrency(summary.netIncome)}</p>
                  <p className={`${summary.netIncome >= 0 ? 'border-blue-200 text-blue-700' : 'border-orange-200 text-orange-700'} relative mt-2.5 border-t pt-2 text-[10px] font-semibold leading-tight sm:text-[11px]`}>
                    Assumes this month&apos;s listed unpaid shifts are completed and paid.
                  </p>
                </div>
              </div>
            </section>

            <section aria-labelledby="cash-runway-title" className="overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm sm:rounded-2xl">
              <div className="flex flex-col gap-2 border-b border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-sky-50 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div>
                  <h2 id="cash-runway-title" className="text-sm font-extrabold text-slate-900 sm:text-base">Next-Income Cash Runway</h2>
                  <p className="mt-0.5 text-[10px] leading-tight text-slate-500 sm:text-[11px]">
                    Money available before the next CSC Friday paycheck.
                    {cashFlow.updatedAt ? ` Updated ${formatDashboardUpdatedAt(cashFlow.updatedAt)}.` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCashFlowDraft(cashFlow);
                    setIsEditingCashFlow((current) => !current);
                  }}
                  className="self-start rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-[11px] font-extrabold text-indigo-700 transition-colors hover:bg-indigo-50 sm:self-auto"
                >
                  {isEditingCashFlow ? 'Close' : 'Update Available Cash'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-px bg-indigo-100 lg:grid-cols-6">
                <div className={`${summary.actualMonthToDateNet >= 0 ? 'bg-emerald-50 text-emerald-950' : 'bg-rose-50 text-rose-950'} p-2.5 sm:p-3`}>
                  <p className={`${summary.actualMonthToDateNet >= 0 ? 'text-emerald-700' : 'text-rose-700'} text-[10px] font-extrabold uppercase leading-tight tracking-wide sm:text-[11px]`}>Actual MTD Net</p>
                  <p className="mt-1 text-lg font-black leading-none sm:text-xl">{formatDashboardCurrency(summary.actualMonthToDateNet)}</p>
                  <p className="mt-1.5 text-[10px] leading-tight opacity-75">Received minus paid</p>
                </div>

                <div className="bg-white p-2.5 text-slate-950 sm:p-3">
                  <p className="text-[10px] font-extrabold uppercase leading-tight tracking-wide text-slate-500 sm:text-[11px]">Available Now</p>
                  <p className="mt-1 text-lg font-black leading-none sm:text-xl">
                    {cashFlowOverview.hasAvailableNow ? formatDashboardCurrency(cashFlowOverview.availableNow) : 'Set amount'}
                  </p>
                  <p className="mt-1.5 text-[10px] leading-tight text-slate-500">Current cash balance</p>
                </div>

                <div
                  className="bg-sky-50 p-2.5 text-sky-950 sm:p-3"
                  title={`CSC pay period ${formatDashboardDate(cscWeeklyPay.payPeriodStart)} to ${formatDashboardDate(cscWeeklyPay.payPeriodEnd)} · ${cscWeeklyPay.expectedHours.toFixed(2)} hours · ${cscWeeklyPay.shiftCount} shift${cscWeeklyPay.shiftCount === 1 ? '' : 's'} · ${cscWeeklyPay.archivedShiftCount} from Archive`}
                >
                  <p className="text-[10px] font-extrabold uppercase leading-tight tracking-wide text-sky-700 sm:text-[11px]">Next Income</p>
                  <p className="mt-1 text-lg font-black leading-none sm:text-xl">{formatDashboardCurrency(cashFlowOverview.nextIncomeAmount)}</p>
                  <p className="mt-1.5 text-[10px] leading-tight text-sky-700">
                    Expected gross · Fri {formatDashboardDate(cashFlowOverview.nextIncomeDate)}
                  </p>
                </div>

                <div className="bg-amber-50 p-2.5 text-amber-950 sm:p-3">
                  <p className="text-[10px] font-extrabold uppercase leading-tight tracking-wide text-amber-700 sm:text-[11px]">Due Before Then</p>
                  <p className="mt-1 text-lg font-black leading-none sm:text-xl">
                    {cashFlowOverview.hasNextIncomeDate ? formatDashboardCurrency(cashFlowOverview.dueBeforeNextIncome) : 'Set date'}
                  </p>
                  <p className="mt-1.5 text-[10px] leading-tight text-amber-700">
                    {cashFlowOverview.hasNextIncomeDate
                      ? `${cashFlowOverview.dueBeforeNextIncomeCount} item${cashFlowOverview.dueBeforeNextIncomeCount === 1 ? '' : 's'}`
                      : 'Uses budget due dates'}
                  </p>
                </div>

                <div className={`${cashFlowOverview.lowestBalance >= 0 ? 'bg-blue-50 text-blue-950' : 'bg-rose-50 text-rose-950'} p-2.5 sm:p-3`}>
                  <p className={`${cashFlowOverview.lowestBalance >= 0 ? 'text-blue-700' : 'text-rose-700'} text-[10px] font-extrabold uppercase leading-tight tracking-wide sm:text-[11px]`}>Lowest Balance</p>
                  <p className="mt-1 text-lg font-black leading-none sm:text-xl">
                    {cashFlowOverview.hasAvailableNow && cashFlowOverview.hasNextIncomeDate
                      ? formatDashboardCurrency(cashFlowOverview.lowestBalance)
                      : 'Needs setup'}
                  </p>
                  <p className="mt-1.5 text-[10px] leading-tight opacity-75">Before next income</p>
                </div>

                <div className={`${cashFlowOverview.safeToSpend > 0 ? 'bg-indigo-50 text-indigo-950' : 'bg-slate-50 text-slate-950'} p-2.5 sm:p-3`}>
                  <p className={`${cashFlowOverview.safeToSpend > 0 ? 'text-indigo-700' : 'text-slate-500'} text-[10px] font-extrabold uppercase leading-tight tracking-wide sm:text-[11px]`}>Safe to Spend</p>
                  <p className="mt-1 text-lg font-black leading-none sm:text-xl">
                    {cashFlowOverview.hasAvailableNow && cashFlowOverview.hasNextIncomeDate
                      ? formatDashboardCurrency(cashFlowOverview.safeToSpend)
                      : 'Needs setup'}
                  </p>
                  <p className="mt-1.5 text-[10px] leading-tight opacity-75">
                    {cashFlowOverview.hasAvailableNow && cashFlowOverview.hasNextIncomeDate
                      ? `${formatDashboardCurrency(cashFlowOverview.afterNextIncome)} after deposit`
                      : 'After bills due first'}
                  </p>
                </div>
              </div>

              {isEditingCashFlow && (
                <form onSubmit={handleSaveCashFlow} className="grid gap-3 border-t border-indigo-100 bg-indigo-50/50 p-3 sm:grid-cols-[1fr_auto] sm:items-end sm:p-4">
                  <label className="block text-[11px] font-bold text-slate-700">
                    Cash available now
                    <input
                      type="number"
                      step="0.01"
                      value={cashFlowDraft.availableNow}
                      onChange={(event) => setCashFlowDraft((current) => ({ ...current, availableNow: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                      placeholder="0.00"
                    />
                  </label>
                  <div className="flex gap-2 sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setCashFlowDraft(cashFlow);
                        setIsEditingCashFlow(false);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-indigo-800">
                      Save
                    </button>
                  </div>
                </form>
              )}
            </section>

            <div className="grid items-start gap-3 sm:gap-4 lg:grid-cols-[1.35fr_1fr]">
              <div className="flex min-w-0 flex-col gap-2 sm:gap-2.5">
                <section aria-labelledby="csc-earnings-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:rounded-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-100 via-white to-emerald-50 px-3.5 py-2 text-slate-900 sm:px-4">
                  <div>
                    <h2 id="csc-earnings-title" className="text-sm font-extrabold sm:text-base">CSC Earnings</h2>
                    <p className="mt-0.5 text-[10px] leading-tight text-slate-600 sm:text-[11px]">Paid income, upcoming pay, and latest check.</p>
                  </div>
                  <DollarSign className="h-5 w-5 text-emerald-600" />
                </div>

                <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-3">
                  <div className="bg-emerald-50 p-2.5 sm:p-3">
                    <p className="text-[10px] font-extrabold uppercase leading-tight tracking-wide text-emerald-700 sm:text-[11px]">Paid This Month</p>
                    <p className="mt-1 text-xl font-black leading-none text-emerald-950 sm:text-[22px]">{formatDashboardCurrency(paycheckIncome.currentMonthNetPay)}</p>
                    <p className="mt-1.5 text-[10px] leading-tight text-emerald-700 sm:text-[11px]">
                      {paycheckIncome.currentMonthCount} check{paycheckIncome.currentMonthCount === 1 ? '' : 's'} · {paycheckIncome.currentMonthHours.toFixed(1)} hrs
                    </p>
                  </div>

                  <div className="bg-amber-50 p-2.5 sm:p-3">
                    <p className="text-[10px] font-extrabold uppercase leading-tight tracking-wide text-amber-700 sm:text-[11px]">Unpaid Shifts</p>
                    <p className="mt-1 text-xl font-black leading-none text-amber-950 sm:text-[22px]">{formatDashboardCurrency(cscIncome.unpaidPay)}</p>
                    <p className="mt-1.5 text-[10px] leading-tight text-amber-700 sm:text-[11px]">
                      {cscIncome.unpaidShiftCount} shift{cscIncome.unpaidShiftCount === 1 ? '' : 's'} · {cscIncome.estimatedHours.toFixed(1)} estimated hrs
                    </p>
                  </div>

                  <div className="col-span-2 bg-blue-50 p-2.5 sm:col-span-1 sm:p-3">
                    <p className="text-[10px] font-extrabold uppercase leading-tight tracking-wide text-blue-700 sm:text-[11px]">Latest Paycheck</p>
                    {paycheckIncome.latestPaycheck ? (
                      <>
                        <p className="mt-1 text-xl font-black leading-none text-blue-950 sm:text-[22px]">{formatDashboardCurrency(paycheckIncome.latestPaycheck.netPay)}</p>
                        <p className="mt-1.5 text-[10px] leading-tight text-blue-700 sm:text-[11px]">
                          {formatDashboardDate(paycheckIncome.latestPaycheck.checkDate)} · ${paycheckIncome.latestPaycheck.rate.toFixed(2)}/hr · {paycheckIncome.latestPaycheck.hours.toFixed(2)} hrs
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-xs font-semibold text-blue-700">No scanned paychecks yet.</p>
                    )}
                  </div>
                </div>

                </section>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sky-950 sm:px-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="rounded-lg bg-white p-1.5 shadow-sm"><Car className="h-5 w-5 text-sky-600" /></span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold">Ride Expenses This Month</p>
                      <p className="mt-0.5 truncate text-[10px] leading-tight text-sky-700 sm:text-[11px]">
                        Fares {formatDashboardCurrency(rideExpenses.currentMonth.fareAndFees)} · Tips {formatDashboardCurrency(rideExpenses.currentMonth.tip)} · All time {formatDashboardCurrency(rideExpenses.allTime.total)}
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-lg font-black leading-none">{formatDashboardCurrency(rideExpenses.currentMonth.total)}</p>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-violet-950 sm:px-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="rounded-lg bg-white p-1.5 shadow-sm"><Clock className="h-5 w-5 text-violet-600" /></span>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold">Next 14 Days Cash Flow</p>
                      <p className="mt-0.5 truncate text-[10px] leading-tight text-violet-700 sm:text-[11px]">
                        Incoming {formatDashboardCurrency(cashFlowOverview.incomingNextFourteenDays)} · Due {formatDashboardCurrency(cashFlowOverview.dueNextFourteenDays)} across {cashFlowOverview.dueNextFourteenDaysCount} item{cashFlowOverview.dueNextFourteenDaysCount === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <p className={`${cashFlowOverview.nextFourteenDayNet >= 0 ? 'text-emerald-700' : 'text-rose-700'} shrink-0 text-lg font-black leading-none`}>
                    {formatDashboardCurrency(cashFlowOverview.nextFourteenDayNet)}
                  </p>
                </div>
              </div>

              <section aria-labelledby="budget-health-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:rounded-2xl">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-3.5 py-2.5 sm:px-4">
                  <div>
                    <h2 id="budget-health-title" className="text-sm font-extrabold text-slate-900 sm:text-base">Budget Health</h2>
                    <p className="mt-0.5 text-[10px] leading-tight text-slate-500 sm:text-[11px]">What needs attention right now.</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Active items</p>
                    <p className="mt-0.5 text-lg font-black leading-none text-slate-900">
                      {budgetOverview.overdueItems + budgetOverview.dueSoonItems + budgetOverview.pendingItems + budgetOverview.paidItems}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 p-3">
                  <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 text-red-950 sm:p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-extrabold text-red-700">Overdue</p>
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    </div>
                    <p className="mt-1.5 text-xl font-black leading-none sm:text-2xl">
                      {budgetOverview.overdueItems} <span className="text-xs font-extrabold">item{budgetOverview.overdueItems === 1 ? '' : 's'}</span>
                    </p>
                    <p className="mt-1.5 text-xs font-black text-red-700">{formatDashboardCurrency(budgetOverview.overdueAmount)}</p>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-amber-950 sm:p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-extrabold text-amber-700">Due Soon</p>
                      <Clock className="h-4 w-4 text-amber-500" />
                    </div>
                    <p className="mt-1.5 text-xl font-black leading-none sm:text-2xl">
                      {budgetOverview.dueSoonItems} <span className="text-xs font-extrabold">item{budgetOverview.dueSoonItems === 1 ? '' : 's'}</span>
                    </p>
                    <p className="mt-1.5 text-xs font-black text-amber-700">{formatDashboardCurrency(budgetOverview.dueSoonAmount)}</p>
                    <p className="mt-1 text-[10px] leading-tight text-amber-700">
                      {budgetOverview.closestDueSoonDate ? `Closest due ${formatDashboardDate(budgetOverview.closestDueSoonDate)}` : 'Nothing due in the next 5 days'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-2.5 text-blue-950 sm:p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-extrabold text-blue-700">Pending</p>
                      <CreditCard className="h-4 w-4 text-blue-500" />
                    </div>
                    <p className="mt-1.5 text-xl font-black leading-none sm:text-2xl">
                      {budgetOverview.pendingItems} <span className="text-xs font-extrabold">item{budgetOverview.pendingItems === 1 ? '' : 's'}</span>
                    </p>
                    <p className="mt-1.5 text-xs font-black text-blue-700">{formatDashboardCurrency(budgetOverview.pendingAmount)}</p>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-950 sm:p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-extrabold text-emerald-700">Paid</p>
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </div>
                    <p className="mt-1.5 text-xl font-black leading-none sm:text-2xl">
                      {budgetOverview.paidItems} <span className="text-xs font-extrabold">item{budgetOverview.paidItems === 1 ? '' : 's'}</span>
                    </p>
                    <p className="mt-1.5 text-xs font-black text-emerald-700">{formatDashboardCurrency(budgetOverview.paidAmount)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 border-t border-slate-100 bg-slate-50 text-[10px] leading-tight sm:text-[11px]">
                  <div className="border-r border-slate-200 px-3 py-2 sm:px-4">
                    <p className="text-slate-500">Budgeted</p>
                    <p className="font-extrabold text-slate-900">{formatDashboardCurrency(budgetOverview.totalEstimated)}</p>
                  </div>
                  <div className="px-3 py-2 sm:px-4">
                    <p className="text-slate-500">Paid amount</p>
                    <p className="font-extrabold text-slate-900">{formatDashboardCurrency(budgetOverview.paidAmount)}</p>
                  </div>
                </div>
                <p className="border-t border-slate-100 px-3.5 py-2 text-[10px] leading-tight text-slate-500 sm:px-4 sm:text-[11px]">
                  Archived {budgetOverview.archivedItems}
                  {(budgetOverview.pausedItems > 0 || budgetOverview.notPayingItems > 0)
                    ? ` · ${budgetOverview.pausedItems} paused · ${budgetOverview.notPayingItems} excluded from active totals`
                    : ''}
                </p>
              </section>
            </div>

          </div>
        )}
      </section>



      {homelightSavings.missingCount > 0 && (
      <section className="mx-auto mb-6 max-w-6xl overflow-hidden rounded-2xl border-2 border-lime-300 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowHomelightSavings((current) => !current)}
          className="flex w-full flex-col gap-3 bg-gradient-to-r from-lime-100 via-emerald-50 to-teal-50 px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between sm:px-5"
          aria-expanded={showHomelightSavings}
          aria-controls="homelight-savings-details"
        >
          <div className="flex min-w-0 items-center gap-3">
            {showHomelightSavings ? <ChevronDown className="h-5 w-5 shrink-0 text-emerald-800" /> : <ChevronRight className="h-5 w-5 shrink-0 text-emerald-800" />}
            <PiggyBank className="h-7 w-7 shrink-0 text-emerald-700" />
            <div className="min-w-0">
              <h2 className="text-lg font-black text-emerald-950 sm:text-xl">Homelight Savings Plan</h2>
              <p className="text-xs font-semibold text-emerald-800 sm:text-sm">
                June 10 through December 31, 2026 · Contracted savings goal {formatDashboardCurrency(homelightSavings.totalRequired)}
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-1.5 text-[10px] font-black sm:w-auto sm:grid-cols-4 sm:gap-2 sm:text-xs">
            <span className="rounded-lg bg-white px-2 py-1.5 text-emerald-900 shadow-sm">
              Saved {formatDashboardCurrency(homelightSavings.totalSaved)}
            </span>
            <span className="rounded-lg bg-white px-2 py-1.5 text-slate-800 shadow-sm">
              Due Now {formatDashboardCurrency(homelightSavings.requiredToDate)}
            </span>
            <span className={`rounded-lg px-2 py-1.5 text-white shadow-sm ${homelightSavings.overallVariance < 0 ? 'bg-red-600' : 'bg-emerald-600'}`}>
              {homelightSavings.overallVariance === 0
                ? 'On Track'
                : `${homelightSavings.overallVariance < 0 ? 'Behind' : 'Ahead'} ${formatDashboardCurrency(Math.abs(homelightSavings.overallVariance))}`}
            </span>
            <span className="rounded-lg bg-slate-800 px-2 py-1.5 text-white shadow-sm">
              Left {formatDashboardCurrency(homelightSavings.remaining)}
            </span>
          </div>
        </button>

        {showHomelightSavings && (
          <div id="homelight-savings-details" className="border-t border-lime-200 p-3 sm:p-5">
            <div className="grid grid-cols-3 gap-1.5 sm:gap-3 xl:grid-cols-6">
              {homelightSavings.months.map((month) => {
                const statusStyles = {
                  met: 'border-emerald-300 bg-emerald-50 text-emerald-950',
                  short: 'border-red-300 bg-red-50 text-red-950',
                  inProgress: 'border-blue-300 bg-blue-50 text-blue-950',
                  notLinked: 'border-slate-300 bg-slate-100 text-slate-800',
                  upcoming: 'border-amber-300 bg-amber-50 text-amber-950',
                };
                const statusLabels = {
                  met: month.variance > 0 ? `+${formatDashboardCurrency(month.variance)}` : 'Met',
                  short: `Short ${formatDashboardCurrency(Math.abs(month.variance))}`,
                  inProgress: `${formatDashboardCurrency(Math.abs(month.variance))} left`,
                  notLinked: 'Not linked',
                  upcoming: 'Upcoming',
                };

                return (
                  <div key={month.key} className={`min-w-0 rounded-xl border p-2 sm:p-3 ${statusStyles[month.status]}`}>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-black sm:text-sm">
                        <span className="sm:hidden">{month.shortLabel}</span>
                        <span className="hidden sm:inline">{month.label}</span>
                      </p>
                      {month.status === 'met' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                    </div>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-wide opacity-70 sm:text-[10px]">Required</p>
                    <p className="text-sm font-black sm:text-lg">{formatDashboardCurrency(month.required)}</p>
                    <p className="mt-1 text-[9px] font-bold uppercase tracking-wide opacity-70 sm:text-[10px]">Saved</p>
                    <p className="text-sm font-black sm:text-base">{formatDashboardCurrency(month.saved)}</p>
                    <p className="mt-1 truncate text-[9px] font-black sm:text-[10px]" title={statusLabels[month.status]}>
                      {statusLabels[month.status]}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex flex-col gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-emerald-950">
                  {homelightSavings.linkedCount} of {HOMELIGHT_SAVINGS_MONTHS.length} months linked to Budget Editor
                </p>
                <p className="text-xs font-semibold text-emerald-800">
                  Enter each month’s saved amount in the Editor’s Actual Cost field. Monthly and cumulative differences update here automatically.
                </p>
                {homelightSavings.nextMonth && (
                  <p className="mt-1 text-xs font-black text-emerald-900">
                    Next: {homelightSavings.nextMonth.label} {formatDashboardDate(homelightSavings.nextMonth.dueDate)} · {formatDashboardCurrency(homelightSavings.nextMonth.required)} required
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {homelightSavings.missingCount > 0 && (
                  <button
                    type="button"
                    onClick={setupHomelightSavingsPlan}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white hover:bg-emerald-800"
                  >
                    <Plus className="h-4 w-4" />
                    Add {homelightSavings.missingCount} Missing Month{homelightSavings.missingCount === 1 ? '' : 's'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenEditor}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-800"
                >
                  Open Budget Editor
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
      )}



      <section className="mx-auto mb-6 max-w-6xl overflow-hidden rounded-2xl border-2 border-amber-300 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowDebtReconciliation((current) => !current)}
          className="flex w-full flex-col gap-3 bg-gradient-to-r from-amber-100 via-orange-50 to-rose-50 px-5 py-4 text-left sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            {showDebtReconciliation ? <ChevronDown className="h-5 w-5 text-amber-800" /> : <ChevronRight className="h-5 w-5 text-amber-800" />}
            <Landmark className="h-6 w-6 text-amber-800" />
            <div>
              <h2 className="text-xl font-black text-slate-950">Debt and Delinquency Reconciliation</h2>
              <p className="text-sm font-semibold text-slate-600">
                Track amount owed, past-due balances, delinquency stages, closed accounts, charge-offs, collections, and payment-plan decisions.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-black">
            <span className="rounded-full bg-white px-3 py-1 text-slate-800 shadow-sm">
              Owed {formatDashboardCurrency(debtSummary.totalOwed)}
            </span>
            <span className="rounded-full bg-red-600 px-3 py-1 text-white">
              Past Due {formatDashboardCurrency(debtSummary.totalPastDue)}
            </span>
            <span className="rounded-full bg-slate-700 px-3 py-1 text-white">
              Excluded {formatDashboardCurrency(debtSummary.excludedOwed)}
            </span>
          </div>
        </button>

        {showDebtReconciliation && (
          <div className="border-t border-amber-200 p-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-rose-700">Total Amount Owed</p>
                <p className="mt-1 text-2xl font-black text-rose-950">{formatDashboardCurrency(debtSummary.totalOwed)}</p>
                <p className="mt-1 text-xs font-semibold text-rose-800">{debtSummary.accountCount} tracked account{debtSummary.accountCount === 1 ? '' : 's'}</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-red-700">Total Past Due</p>
                <p className="mt-1 text-2xl font-black text-red-950">{formatDashboardCurrency(debtSummary.totalPastDue)}</p>
                <p className="mt-1 text-xs font-semibold text-red-800">{debtSummary.delinquentCount} delinquent account{debtSummary.delinquentCount === 1 ? '' : 's'}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Still Planning to Pay</p>
                <p className="mt-1 text-2xl font-black text-emerald-950">{formatDashboardCurrency(debtSummary.activePlanOwed)}</p>
                <p className="mt-1 text-xs font-semibold text-emerald-800">Included in the active payment plan</p>
              </div>
              <div className="rounded-xl border border-slate-300 bg-slate-100 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-700">Excluded From Plan</p>
                <p className="mt-1 text-2xl font-black text-slate-950">{formatDashboardCurrency(debtSummary.excludedOwed)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-700">{debtSummary.excludedCount} account{debtSummary.excludedCount === 1 ? '' : 's'}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-1.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
              <div className="flex min-h-[64px] flex-col justify-center rounded-xl border border-slate-200 bg-white p-1.5 text-center sm:min-h-0 sm:block sm:p-3 sm:text-left">
                <p className="text-[9px] font-bold leading-3 text-slate-500 sm:text-xs sm:leading-normal">
                  <span className="sm:hidden">Closed</span>
                  <span className="hidden sm:inline">Closed / Settled</span>
                </p>
                <p className="mt-0.5 text-xl font-black text-slate-900 sm:mt-1 sm:text-2xl">{debtSummary.closedCount}</p>
              </div>
              <div className="flex min-h-[64px] flex-col justify-center rounded-xl border border-violet-200 bg-violet-50 p-1.5 text-center sm:min-h-0 sm:block sm:p-3 sm:text-left">
                <p className="text-[9px] font-bold leading-3 text-violet-700 sm:text-xs sm:leading-normal">
                  <span className="sm:hidden">Collect.</span>
                  <span className="hidden sm:inline">In Collections</span>
                </p>
                <p className="mt-0.5 text-xl font-black text-violet-950 sm:mt-1 sm:text-2xl">{debtSummary.collectionsCount}</p>
              </div>
              <div className="flex min-h-[64px] flex-col justify-center rounded-xl border border-orange-200 bg-orange-50 p-1.5 text-center sm:min-h-0 sm:block sm:p-3 sm:text-left">
                <p className="text-[9px] font-bold leading-3 text-orange-700 sm:text-xs sm:leading-normal">
                  <span className="sm:hidden">Charged</span>
                  <span className="hidden sm:inline">Charged Off</span>
                </p>
                <p className="mt-0.5 text-xl font-black text-orange-950 sm:mt-1 sm:text-2xl">{debtSummary.chargedOffCount}</p>
              </div>
              <div className="flex min-h-[64px] flex-col justify-center rounded-xl border border-amber-200 bg-amber-50 p-1.5 text-center sm:min-h-0 sm:block sm:p-3 sm:text-left">
                <p className="text-[9px] font-bold leading-3 text-amber-700 sm:text-xs sm:leading-normal">
                  <span className="sm:hidden">120+</span>
                  <span className="hidden sm:inline">120+ Days</span>
                </p>
                <p className="mt-0.5 text-xl font-black text-amber-950 sm:mt-1 sm:text-2xl">{debtSummary.stageCounts['120+']}</p>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-6 gap-1 sm:mt-4 sm:grid-cols-3 sm:gap-2 xl:grid-cols-6">
              {[
                ['Current', 'Current', debtSummary.stageCounts.current],
                ['1-29', '1-29 Days', debtSummary.stageCounts['1-29']],
                ['30-59', '30-59 Days', debtSummary.stageCounts['30-59']],
                ['60-89', '60-89 Days', debtSummary.stageCounts['60-89']],
                ['90-119', '90-119 Days', debtSummary.stageCounts['90-119']],
                ['120+', '120+ Days', debtSummary.stageCounts['120+']],
              ].map(([mobileLabel, label, count]) => (
                <div key={label} className="flex min-h-[58px] min-w-0 flex-col justify-center rounded-lg border border-slate-200 bg-slate-50 px-0.5 py-1.5 text-center sm:min-h-0 sm:block sm:px-3 sm:py-2">
                  <p className="text-[8px] font-bold leading-3 text-slate-600 sm:text-xs sm:leading-normal">
                    <span className="sm:hidden">{mobileLabel}</span>
                    <span className="hidden sm:inline">{label}</span>
                  </p>
                  <p className="mt-0.5 text-lg font-black leading-5 text-slate-950 sm:mt-1 sm:text-xl sm:leading-normal">{count}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[1150px]">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-black text-slate-700">Account</th>
                    <th className="px-3 py-2 text-left text-xs font-black text-slate-700">Category</th>
                    <th className="px-3 py-2 text-left text-xs font-black text-slate-700">Account Status</th>
                    <th className="px-3 py-2 text-right text-xs font-black text-slate-700">Amount Owed</th>
                    <th className="px-3 py-2 text-right text-xs font-black text-slate-700">Past Due</th>
                    <th className="px-3 py-2 text-right text-xs font-black text-slate-700">Days</th>
                    <th className="px-3 py-2 text-left text-xs font-black text-slate-700">Stage</th>
                    <th className="px-3 py-2 text-left text-xs font-black text-slate-700">Collections</th>
                    <th className="px-3 py-2 text-left text-xs font-black text-slate-700">Payment Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {debtSummary.accounts.length ? (
                    debtSummary.accounts.map((account) => (
                      <tr key={`${account.bucketName}-${account.id}`} className={account.excludedFromPaymentPlan ? 'bg-slate-50' : ''}>
                        <td className="px-3 py-2 text-sm font-bold text-slate-950">
                          {account.category || 'Unnamed account'}
                          {account.accountLast4 ? <span className="ml-1 text-xs text-slate-500">•••• {account.accountLast4}</span> : null}
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-700">{account.bucketDisplayName}</td>
                        <td className="px-3 py-2 text-sm">
                          <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-800">
                            {account.accountStatus}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-black text-rose-700">{formatDashboardCurrency(account.amountOwed)}</td>
                        <td className="px-3 py-2 text-right text-sm font-black text-red-700">{formatDashboardCurrency(account.pastDueAmount)}</td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-slate-900">{account.daysDelinquent}</td>
                        <td className="px-3 py-2 text-sm font-bold text-amber-800">{account.delinquencyStage}</td>
                        <td className="px-3 py-2 text-sm text-slate-700">
                          {account.collectionAgency || (account.sentToCollectionsDate ? `Sent ${formatDashboardDate(account.sentToCollectionsDate)}` : 'None listed')}
                        </td>
                        <td className="px-3 py-2 text-sm">
                          {account.excludedFromPaymentPlan ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-2 py-1 text-xs font-bold text-white">
                              <Ban className="h-3 w-3" />
                              Excluded
                            </span>
                          ) : account.pausedFromPaymentPlan ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-1 text-xs font-bold text-indigo-800">
                              <PauseCircle className="h-3 w-3" />
                              Paused
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" />
                              Active
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="px-4 py-8 text-center text-sm font-semibold text-slate-500">
                        No debt or account-status details have been entered yet. Use the amber document icon in Budget Editor actions.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>



      <div className="mx-auto mb-6 max-w-6xl overflow-hidden rounded-xl border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100">
        <div className="flex flex-col gap-2 bg-blue-600 px-3 py-3 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4">
          <div className="flex w-full items-center justify-between gap-2 sm:contents">
            <div className="flex min-w-0 items-center gap-1.5 sm:order-1 sm:gap-2">
              <h3 className="whitespace-nowrap text-lg font-bold">Budget List</h3>
              <button
                onClick={() => {
                  const allExpanded = {};
                  categoryOrder.forEach(bucket => {
                    allExpanded[bucket] = true;
                  });
                  setExpandedCategories(allExpanded);
                }}
                className="rounded p-1 transition-colors hover:bg-white/20"
                title="Expand All Categories"
                aria-label="Expand All Categories"
              >
                <Plus className="h-5 w-5" />
              </button>
              <button
                onClick={() => setExpandedCategories({})}
                className="rounded p-1 transition-colors hover:bg-white/20"
                title="Collapse All Categories"
                aria-label="Collapse All Categories"
              >
                <Minus className="h-5 w-5" />
              </button>
            </div>

            <div className="ml-auto flex shrink-0 gap-1.5 whitespace-nowrap sm:order-3 sm:gap-2">
              <button
                onClick={exportAllToCSV}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700 sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm"
                title="Export CSV"
                aria-label="Export CSV"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </button>
              <button
                onClick={printReport}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-white hover:bg-blue-800 sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-1.5 sm:text-sm"
                title="Print Report"
                aria-label="Print Report"
              >
                <Printer className="h-4 w-4" />
                <span className="hidden sm:inline">Print Report</span>
              </button>
            </div>
          </div>

          <div className="grid w-full grid-cols-4 gap-1.5 sm:order-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2">
            {[
              { id: 'all', label: 'All Items', color: 'bg-white/20 hover:bg-white/30' },
              { id: 'overdue', label: 'Overdue', color: 'bg-red-500/80 hover:bg-red-500' },
              { id: 'dueSoon', label: 'Due Soon', color: 'bg-yellow-500/80 hover:bg-yellow-500' },
              { id: 'pending', label: 'Pending', color: 'bg-blue-400/80 hover:bg-blue-400' },
              { id: 'paid', label: 'Paid', color: 'bg-green-500/80 hover:bg-green-500' },
              { id: 'paused', label: 'Paused', color: 'bg-indigo-500/80 hover:bg-indigo-500' },
              { id: 'notPaying', label: 'Excluded', color: 'bg-slate-500/80 hover:bg-slate-500' }
            ].map(filter => (
              <button
                key={filter.id}
                onClick={() => handleFilterChange(filter.id)}
                title={`Filter budget list by ${filter.label}`}
                aria-label={`Filter budget list by ${filter.label}`}
                className={`flex min-h-8 items-center justify-center rounded-full px-1.5 py-1 text-center text-[10px] font-bold leading-tight transition-colors sm:min-h-0 sm:px-3 sm:text-xs sm:font-medium sm:leading-normal ${
                  statusFilter === filter.id
                    ? 'ring-2 ring-white ' + filter.color
                    : filter.color
                }`}
              >
                {filter.label}
              </button>
            ))}
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
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 w-32">Paid</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-32">Due Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-40">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-64">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {flatItems.map(item => {
                    const rowColor = (() => {
                      if (item.status === 'notPaying') return 'bg-slate-100 border-slate-300';
                      if (item.status === 'paused') return 'bg-indigo-50 border-indigo-200';
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
                          {item.isSystemItem ? (
                            <div className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-900">
                              {item.note || 'Auto-calculated item.'}
                            </div>
                          ) : (
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
                          )}
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

          const activeItems = items.filter(isBudgetItemActive);
          const totalBudgeted = activeItems.reduce((sum, item) => sum + (Number(item.estBudget) || 0), 0);
          const totalActual = activeItems.reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0);
          
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
                    {statusCounts.paused > 0 && (
                      <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full flex items-center gap-1">
                        <PauseCircle className="w-3 h-3" />
                        {statusCounts.paused}
                      </span>
                    )}
                    {statusCounts.notPaying > 0 && (
                      <span className="px-2 py-0.5 bg-slate-600 text-white text-xs rounded-full flex items-center gap-1">
                        <Ban className="w-3 h-3" />
                        {statusCounts.notPaying}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm">
                  <span className="text-gray-600 hidden sm:inline">Budget: <strong>${totalBudgeted.toFixed(2)}</strong></span>
                  <span className="text-gray-600">Paid: <strong>${totalActual.toFixed(2)}</strong></span>
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
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 w-32">Paid</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 w-32">Available</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-32">Due Date</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-40">Status</th>
                          </>
                        ) : (
                          <>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-64">Item</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 w-32">Est. Budget</th>
                            <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 w-32">Paid</th>
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
                ${categoryOrder.flatMap((bucketName) => getBudgetItemsForBucket(bucketName)).filter(isBudgetItemActive).reduce((sum, item) => sum + (Number(item.estBudget) || 0), 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Total Paid</p>
              <p className="text-2xl font-bold text-purple-900">
                ${categoryOrder.flatMap((bucketName) => getBudgetItemsForBucket(bucketName)).filter(isBudgetItemActive).reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <p className="text-sm text-gray-600 mb-1">Variance</p>
              {(() => {
                const totalBudget = categoryOrder.flatMap((bucketName) => getBudgetItemsForBucket(bucketName)).filter(isBudgetItemActive).reduce((sum, item) => sum + (Number(item.estBudget) || 0), 0);
                const totalActual = categoryOrder.flatMap((bucketName) => getBudgetItemsForBucket(bucketName)).filter(isBudgetItemActive).reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0);
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

      <section className="mx-auto mb-6 max-w-6xl overflow-hidden rounded-xl border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-blue-100">
        <button
          type="button"
          onClick={() => setShowPaymentAlerts(prev => !prev)}
          className="flex w-full items-center justify-between gap-4 bg-blue-600 px-4 py-3 text-left text-white hover:bg-blue-700"
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
          <span className="text-sm font-semibold text-white">
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

      <EmergencyFundWidget state={state} setState={setState} saveBudget={saveBudget} />

    </PageContainer>
  );
};

export default DashboardTab;
