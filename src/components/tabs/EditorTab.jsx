// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\components\tabs\EditorTab.jsx
// src/components/tabs/EditorTab.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Plus, Archive, Undo2, GripVertical, Trash2, FolderPlus, FolderMinus, Edit2, ArrowUp, ArrowDown, Copy, ChevronDown, ChevronUp, Zap, AlertCircle, Clock, Download, ListPlus, CalendarClock, Ban, FileText, X, Save, PauseCircle, Play, ScanSearch } from 'lucide-react';
import {
  DollarSign, Home, Car, Utensils, User, Monitor,
  CreditCard, Repeat, Package, PiggyBank
} from 'lucide-react';
import PageContainer from "../common/PageContainer.jsx";
import CollapseToggleButton from '../common/CollapseToggleButton.jsx';
import CreditReportScanner from '../credit/CreditReportScanner.jsx';
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
  emergencyFund:  { icon: PiggyBank,   color: 'text-blue-600' },
  misc:           { icon: Package,     color: 'text-gray-600' },
};

const PROTECTED_BUCKETS = new Set([
  'income','housing','transportation','food','personal','homeOffice','banking','subscriptions','emergencyFund','misc'
]);

const DEFAULT_ORDER = [
  'income','housing','transportation','food','personal','homeOffice','banking','subscriptions','emergencyFund','misc'
];

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

const CREDIT_REPORT_FILE_ENDPOINT = '/budget-dashboard-fs/upload-credit-report.php';

const normalizeCreditReportFile = (file = {}) => ({
  id: file.id || `credit-report-file-${Date.now()}`,
  originalName: file.originalName || file.name || 'Credit report',
  savedName: file.savedName || '',
  mimeType: file.mimeType || file.type || '',
  size: Number(file.size || file.sizeBytes || 0) || 0,
  uploadedAt: file.uploadedAt || new Date().toISOString(),
  bureau: file.bureau || '',
  reportDate: file.reportDate || '',
});

const formatCreditReportFileSize = (size = 0) => {
  const bytes = Number(size || 0);
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const buildCreditReportFileUrl = (action, reportFile = {}) => {
  const savedName = String(reportFile.savedName || '').trim();
  if (!savedName) return '';

  const params = new URLSearchParams();
  params.set('action', action);
  params.set('savedName', savedName);
  if (reportFile.originalName) params.set('name', reportFile.originalName);
  return `${CREDIT_REPORT_FILE_ENDPOINT}?${params.toString()}`;
};

const uploadCreditReportOriginal = async (file, reportMeta = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bureau', reportMeta.bureau || '');
  formData.append('reportDate', reportMeta.reportDate || '');

  const response = await fetch(CREDIT_REPORT_FILE_ENDPOINT, {
    method: 'POST',
    body: formData,
  });
  const responseText = await response.text();
  let payload;

  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new Error('The credit-report storage endpoint did not return a valid response.');
  }

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || `Credit-report upload failed with status ${response.status}.`);
  }

  return normalizeCreditReportFile(payload.file || payload);
};

const ITEM_TEMPLATES = [
  { name: 'Rent/Mortgage', category: 'housing', estBudget: 1500, recurrence: 'monthly' },
  { name: 'Electric Bill', category: 'housing', estBudget: 150, recurrence: 'monthly' },
  { name: 'Water Bill', category: 'housing', estBudget: 50, recurrence: 'monthly' },
  { name: 'Internet', category: 'housing', estBudget: 80, recurrence: 'monthly' },
  { name: 'Car Payment', category: 'transportation', estBudget: 400, recurrence: 'monthly' },
  { name: 'Car Insurance', category: 'transportation', estBudget: 150, recurrence: 'monthly' },
  { name: 'Gas', category: 'transportation', estBudget: 200, recurrence: 'monthly' },
  { name: 'Groceries', category: 'food', estBudget: 600, recurrence: 'monthly' },
  { name: 'Phone Bill', category: 'personal', estBudget: 70, recurrence: 'monthly' },
  { name: 'Netflix', category: 'subscriptions', estBudget: 15.49, recurrence: 'monthly' },
  { name: 'Spotify', category: 'subscriptions', estBudget: 10.99, recurrence: 'monthly' },
];

const HOMELIGHT_SAVINGS_PROGRAM_ID = 'homelight-savings-2026';
const HOMELIGHT_SAVINGS_MONTHS = [
  { key: '2026-07', label: 'July', dueDate: '2026-07-31', required: 500 },
  { key: '2026-08', label: 'August', dueDate: '2026-08-31', required: 500 },
  { key: '2026-09', label: 'September', dueDate: '2026-09-30', required: 1000 },
  { key: '2026-10', label: 'October', dueDate: '2026-10-31', required: 1000 },
  { key: '2026-11', label: 'November', dueDate: '2026-11-30', required: 1000 },
  { key: '2026-12', label: 'December', dueDate: '2026-12-31', required: 1000 },
];

const normalizeHomelightDate = (value = '') => {
  const raw = String(value || '').trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`;

  return '';
};

const getHomelightSavingsMonthKey = (item = {}) => {
  if (item.homelightSavingsProgramId === HOMELIGHT_SAVINGS_PROGRAM_ID && item.homelightSavingsMonth) {
    return item.homelightSavingsMonth;
  }

  const itemName = String(item.category || '').trim().toLowerCase();
  const dueDate = normalizeHomelightDate(item.dueDate);
  const matchingMonth = HOMELIGHT_SAVINGS_MONTHS.find((month) => month.dueDate === dueDate);

  return itemName.includes('homelight') && itemName.includes('sav') && matchingMonth
    ? matchingMonth.key
    : '';
};

const ACCOUNT_STATUS_OPTIONS = [
  'Open',
  'Current',
  'Past Due',
  'Suspended',
  'Closed',
  'Charged Off',
  'Sent to Collections',
  'Settled',
  'Disputed',
  'Bankruptcy Review',
  'Paid in Full',
  'Unknown',
];

const getDebtNumber = (value) => {
  const parsed = Number(String(value ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDebtCurrency = (value) =>
  `$${getDebtNumber(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const AUNT_PERSONAL_LOAN_ID = 'aunt-car-rear-differential-loan';
const AUNT_PERSONAL_LOAN_INITIALIZED_KEY = 'auntPersonalLoanInitialized';
const PERSONAL_LOAN_FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'weekly', label: 'Weekly' },
];

const isAuntPersonalLoan = (item = {}) =>
  item.personalLoanId === AUNT_PERSONAL_LOAN_ID;

const getPersonalLoanStatusLabel = (item = {}) => {
  if (item.repaymentStatus === 'paidOff' || getDebtNumber(item.currentAmountOwed || item.currentBalance) <= 0) {
    return 'Paid off';
  }
  if (item.repaymentStatus === 'active') return 'Repayment active';
  if (item.repaymentStatus === 'paused') return 'Repayment paused';
  return 'Repayment not started';
};

const advancePersonalLoanDueDate = (dateValue, frequency = 'monthly') => {
  const source = String(dateValue || '').trim();
  if (!source) return '';

  const nextDate = new Date(`${source}T12:00:00`);
  if (Number.isNaN(nextDate.getTime())) return '';

  if (frequency === 'weekly') {
    nextDate.setDate(nextDate.getDate() + 7);
  } else if (frequency === 'biweekly') {
    nextDate.setDate(nextDate.getDate() + 14);
  } else {
    const originalDay = nextDate.getDate();
    nextDate.setDate(1);
    nextDate.setMonth(nextDate.getMonth() + 1);
    const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
    nextDate.setDate(Math.min(originalDay, lastDay));
  }

  return nextDate.toISOString().split('T')[0];
};

const getDebtDaysDelinquent = (item = {}) => {
  const sourceDate = item.delinquentSince || '';
  if (!sourceDate) return 0;

  const start = new Date(`${sourceDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) return 0;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000));
};

const getDelinquencyStage = (days = 0) => {
  if (days >= 120) return '120+ days';
  if (days >= 90) return '90-119 days';
  if (days >= 60) return '60-89 days';
  if (days >= 30) return '30-59 days';
  if (days >= 1) return '1-29 days';
  return 'Current';
};

const hasDebtTrackingDetails = (item = {}) =>
  Boolean(
    item.accountStatus ||
      item.currentAmountOwed ||
      item.pastDueAmount ||
      item.originalBalance ||
      item.lastPaymentDate ||
      item.delinquentSince ||
      item.collectionAgency ||
      item.sentToCollectionsDate ||
      item.originalCreditor ||
      item.accountLast4 ||
      item.settlementAmount ||
      item.debtStatusNotes
  );

const buildCreditReportNote = (account = {}, reportMeta = {}) => {
  const details = [
    `Imported from ${account.bureau || reportMeta.bureau || 'credit'} report${account.reportDate || reportMeta.reportDate ? ` dated ${account.reportDate || reportMeta.reportDate}` : ''}.`,
    account.rawStatus ? `Reported status: ${account.rawStatus}.` : '',
    account.accountType ? `Account type: ${account.accountType}.` : '',
    account.dateReported ? `Last reported: ${account.dateReported}.` : '',
    account.dateReportedRaw ? `Last reported: ${account.dateReportedRaw}.` : '',
    account.delinquentSinceRaw ? `First delinquency reported as: ${account.delinquentSinceRaw}.` : '',
    account.remarks ? `Remarks: ${account.remarks}.` : '',
  ];
  return details.filter(Boolean).join(' ');
};

const buildCreditReportDebtPatch = (account = {}) => {
  const patch = {
    creditBureau: account.bureau || '',
    creditReportDate: account.reportDate || '',
    creditAccountType: account.accountType || '',
    creditDateOpened: account.dateOpened || '',
    creditDateReported: account.dateReported || '',
    creditLimit: account.creditLimit ?? '',
    creditMonthlyPayment: account.monthlyPayment ?? '',
    debtUpdatedAt: new Date().toISOString(),
  };

  if (account.accountStatus && account.accountStatus !== 'Unknown') patch.accountStatus = account.accountStatus;
  if (account.currentBalance !== null && account.currentBalance !== undefined) {
    patch.currentAmountOwed = account.currentBalance;
    patch.currentBalance = account.currentBalance;
  }
  if (account.pastDueAmount !== null && account.pastDueAmount !== undefined) patch.pastDueAmount = account.pastDueAmount;
  if (account.originalBalance !== null && account.originalBalance !== undefined) patch.originalBalance = account.originalBalance;
  if (account.lastPaymentDate) patch.lastPaymentDate = account.lastPaymentDate;
  if (account.delinquentSince) patch.delinquentSince = account.delinquentSince;
  if (account.collectionAgency) patch.collectionAgency = account.collectionAgency;
  if (account.sentToCollectionsDate) patch.sentToCollectionsDate = account.sentToCollectionsDate;
  if (account.originalCreditor) patch.originalCreditor = account.originalCreditor;
  if (account.accountLast4) patch.accountLast4 = String(account.accountLast4).slice(-4);

  return patch;
};

const getFridaysInMonth = (year, month) => {
  const fridays = [];
  const date = new Date(year, month, 1);
  while (date.getDay() !== 5) date.setDate(date.getDate() + 1);
  while (date.getMonth() === month) {
    fridays.push(new Date(date));
    date.setDate(date.getDate() + 7);
  }
  return fridays;
};

const EditorTab = ({ state, setState, saveBudget, searchQuery }) => {
  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedFromBucket, setDraggedFromBucket] = useState(null);
  const [recentlyDeleted, setRecentlyDeleted] = useState(null);
  const [undoTimerId, setUndoTimerId] = useState(null);
  const [categoryNames, setCategoryNames] = useState({});
  const [recentlyCleared, setRecentlyCleared] = useState(false);
  const [clearTimerId, setClearTimerId] = useState(null);

  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [statusFilter, setStatusFilter] = useState('all');

  const [isSaving, setIsSaving] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const [categoryOrder, setCategoryOrder] = useState([]);
  const [draggedCategory, setDraggedCategory] = useState(null);
  const [batchAddMode, setBatchAddMode] = useState(false);
  const [batchAddCategory, setBatchAddCategory] = useState('');
  const [debtEditor, setDebtEditor] = useState(null);
  const [personalLoanEditor, setPersonalLoanEditor] = useState(null);
  const [showCreditReportScanner, setShowCreditReportScanner] = useState(false);
  const [showSavedCreditReports, setShowSavedCreditReports] = useState(false);
  const batchItemNameRef = useRef(null);
  const auntLoanInitializationRef = useRef(false);

  const preserveItemActionScroll = (event) => {
    if (!event.target.closest('button')) return;

    const scrollLeft = window.scrollX;
    const scrollTop = window.scrollY;
    const restoreScroll = () => {
      window.scrollTo({
        left: scrollLeft,
        top: scrollTop,
        behavior: 'auto',
      });
    };

    requestAnimationFrame(() => {
      restoreScroll();
      requestAnimationFrame(restoreScroll);
    });
  };

  useEffect(() => {
    if (state?.meta?.categoryNames) {
      setCategoryNames(state.meta.categoryNames);
    }
    if (state?.meta?.categoryOrder) {
      setCategoryOrder(state.meta.categoryOrder);
    } else {
      const customBuckets = Object.keys(state?.buckets || {}).filter(k => !DEFAULT_ORDER.includes(k));
      setCategoryOrder([...DEFAULT_ORDER, ...customBuckets]);
    }
  }, [state?.meta?.categoryNames, state?.meta?.categoryOrder, state?.buckets]);

  useEffect(() => {
    if (!state?.buckets) return;
    const personal = state.buckets.personal || [];
    if (personal.length === 0) return;

    const toMoveNames = new Set([
      'AMC Premier','Disney+/ESPN/HULU','Paramount+','Netflix','Amazon Prime','CVS ExtraCare'
    ]);

    let moved = false;
    const keep = [];
    const move = [];
    for (const item of personal) {
      if (item?.category && toMoveNames.has(item.category.trim())) {
        move.push(item);
        moved = true;
      } else {
        keep.push(item);
      }
    }
    if (moved) {
      const updatedBuckets = {
        ...state.buckets,
        personal: keep,
        subscriptions: [...(state.buckets.subscriptions || []), ...move]
      };
      const updatedState = { ...state, buckets: updatedBuckets };
      setState(updatedState);
      setTimeout(() => saveBudgetWithIndicator(updatedState, false), 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      auntLoanInitializationRef.current ||
      !state?.buckets?.banking ||
      state?.meta?.[AUNT_PERSONAL_LOAN_INITIALIZED_KEY]
    ) {
      return;
    }

    auntLoanInitializationRef.current = true;

    const existingLoan = Object.values(state.buckets)
      .flatMap((items) => items || [])
      .find((item) => isAuntPersonalLoan(item));

    const loanItem = existingLoan || {
      id: `personal-loan-${AUNT_PERSONAL_LOAN_ID}`,
      category: 'Personal Loan - Aunt',
      estBudget: 0,
      actualCost: 0,
      dueDate: '',
      status: 'paused',
      recurrence: 'none',
      currentBalance: 2365,
      currentAmountOwed: 2365,
      originalBalance: 2365,
      availableCredit: 0,
      accountStatus: 'Open',
      personalLoanId: AUNT_PERSONAL_LOAN_ID,
      loanType: 'personal',
      lender: 'Aunt',
      loanPurpose: 'Car rear differential',
      interestRate: 0,
      repaymentStatus: 'notStarted',
      repaymentFrequency: 'monthly',
      paymentAmount: 0,
      firstPaymentDate: '',
      nextPaymentDate: '',
      loanPaymentHistory: [],
      pausedReason: 'Repayment not started - waiting until affordable',
      pausedAt: new Date().toISOString(),
      debtStatusNotes: 'Personal loan from Aunt for the car rear differential. Repayment has not started.',
      loanCreatedAt: new Date().toISOString(),
    };

    const updatedState = {
      ...state,
      buckets: existingLoan
        ? state.buckets
        : {
            ...state.buckets,
            banking: [...state.buckets.banking, loanItem],
          },
      meta: {
        ...(state.meta || {}),
        [AUNT_PERSONAL_LOAN_INITIALIZED_KEY]: true,
      },
    };

    setState(updatedState);
    setCollapsedCategories((current) => ({ ...current, banking: false }));
    setTimeout(
      () => saveBudgetWithIndicator(
        updatedState,
        existingLoan
          ? 'Aunt personal loan linked to the repayment manager.'
          : 'Aunt personal loan created with repayment not started.'
      ),
      100
    );
    // This one-time data migration must use the hydrated state present when the Editor opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.buckets?.banking, state?.meta?.[AUNT_PERSONAL_LOAN_INITIALIZED_KEY]]);

  // CSC AUTO-GENERATION DISABLED
  // The useEffect that was here has been removed to prevent automatic regeneration of CSC weekly income entries
  // Users can now delete CSC rows without them reappearing

  const saveBudgetWithIndicator = async (customState = null, customMessage = null) => {
    setIsSaving(true);
    await saveBudget(customState, customMessage);
    setTimeout(() => setIsSaving(false), 1000);
  };

  const homelightSavingsProgress = useMemo(() => {
    const linkedItems = new Map();

    Object.values(state?.buckets || {}).forEach((items) => {
      (items || []).forEach((item) => {
        const monthKey = getHomelightSavingsMonthKey(item);
        if (monthKey && !linkedItems.has(monthKey)) linkedItems.set(monthKey, item);
      });
    });

    const totalSaved = Array.from(linkedItems.values()).reduce(
      (sum, item) => sum + (Number(item.actualCost) || 0),
      0
    );

    return {
      linkedCount: linkedItems.size,
      missingCount: Math.max(HOMELIGHT_SAVINGS_MONTHS.length - linkedItems.size, 0),
      totalSaved,
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
    setCollapsedCategories((current) => ({ ...current, housing: false }));
    setTimeout(
      () => saveBudgetWithIndicator(
        updatedState,
        missingItems.length
          ? `Homelight savings plan linked and ${missingItems.length} missing month${missingItems.length === 1 ? '' : 's'} added.`
          : 'Homelight savings plan linked to the Budget Editor.'
      ),
      100
    );
  };

  const auntPersonalLoanRecord = useMemo(() => {
    for (const [bucket, items] of Object.entries(state?.buckets || {})) {
      const item = (items || []).find((entry) => isAuntPersonalLoan(entry));
      if (item) return { bucket, item };
    }
    return null;
  }, [state?.buckets]);

  const openPersonalLoanEditor = (bucket, item, focusPayment = false) => {
    const paymentAmount = getDebtNumber(item.paymentAmount || item.estBudget);
    setPersonalLoanEditor({
      bucket,
      item: {
        ...item,
        lender: item.lender || 'Aunt',
        loanPurpose: item.loanPurpose || 'Car rear differential',
        originalBalance: getDebtNumber(item.originalBalance || 2365),
        currentAmountOwed: getDebtNumber(item.currentAmountOwed || item.currentBalance),
        interestRate: getDebtNumber(item.interestRate),
        repaymentStatus: item.repaymentStatus || 'notStarted',
        repaymentFrequency: item.repaymentFrequency || 'monthly',
        paymentAmount,
        firstPaymentDate: item.firstPaymentDate || '',
        nextPaymentDate: item.nextPaymentDate || item.dueDate || '',
        debtStatusNotes: item.debtStatusNotes || '',
      },
      paymentEntry: {
        amount: paymentAmount || '',
        date: new Date().toISOString().split('T')[0],
      },
      focusPayment,
    });
  };

  const updatePersonalLoanEditorField = (field, value) => {
    setPersonalLoanEditor((current) =>
      current
        ? {
            ...current,
            item: {
              ...current.item,
              [field]: value,
            },
          }
        : current
    );
  };

  const updatePersonalLoanPaymentEntry = (field, value) => {
    setPersonalLoanEditor((current) =>
      current
        ? {
            ...current,
            paymentEntry: {
              ...current.paymentEntry,
              [field]: value,
            },
          }
        : current
    );
  };

  const savePersonalLoanPlan = () => {
    if (!personalLoanEditor?.bucket || !personalLoanEditor?.item?.id) return;

    const repaymentStatus = personalLoanEditor.item.repaymentStatus || 'notStarted';
    const paymentAmount = getDebtNumber(personalLoanEditor.item.paymentAmount);
    const firstPaymentDate = personalLoanEditor.item.firstPaymentDate || '';
    const currentAmountOwed = getDebtNumber(personalLoanEditor.item.currentAmountOwed);

    if (repaymentStatus === 'active' && paymentAmount <= 0) {
      alert('Enter a payment amount before starting repayment.');
      return;
    }

    if (repaymentStatus === 'active' && !firstPaymentDate) {
      alert('Choose the first payment date before starting repayment.');
      return;
    }

    const isPaidOff = currentAmountOwed <= 0 || repaymentStatus === 'paidOff';
    const isActive = repaymentStatus === 'active' && !isPaidOff;
    const normalizedRepaymentStatus = isPaidOff ? 'paidOff' : repaymentStatus;
    const updatedItem = {
      ...personalLoanEditor.item,
      category: personalLoanEditor.item.category || 'Personal Loan - Aunt',
      personalLoanId: AUNT_PERSONAL_LOAN_ID,
      loanType: 'personal',
      lender: personalLoanEditor.item.lender || 'Aunt',
      loanPurpose: personalLoanEditor.item.loanPurpose || 'Car rear differential',
      originalBalance: getDebtNumber(personalLoanEditor.item.originalBalance),
      currentBalance: isPaidOff ? 0 : currentAmountOwed,
      currentAmountOwed: isPaidOff ? 0 : currentAmountOwed,
      interestRate: getDebtNumber(personalLoanEditor.item.interestRate),
      repaymentStatus: normalizedRepaymentStatus,
      repaymentFrequency: personalLoanEditor.item.repaymentFrequency || 'monthly',
      paymentAmount: isPaidOff ? 0 : paymentAmount,
      firstPaymentDate,
      nextPaymentDate: isActive
        ? (personalLoanEditor.item.nextPaymentDate || firstPaymentDate)
        : '',
      estBudget: isActive ? paymentAmount : 0,
      actualCost: isActive ? getDebtNumber(personalLoanEditor.item.actualCost) : 0,
      dueDate: isActive
        ? (personalLoanEditor.item.nextPaymentDate || firstPaymentDate)
        : '',
      status: isPaidOff ? 'paid' : isActive ? 'pending' : 'paused',
      accountStatus: isPaidOff ? 'Paid in Full' : 'Open',
      pausedReason: isPaidOff || isActive
        ? ''
        : normalizedRepaymentStatus === 'paused'
          ? 'Repayment temporarily paused'
          : 'Repayment not started - waiting until affordable',
      pausedAt: isPaidOff || isActive ? '' : new Date().toISOString(),
      debtStatusNotes: personalLoanEditor.item.debtStatusNotes || '',
      loanUpdatedAt: new Date().toISOString(),
    };

    const updatedBuckets = {
      ...state.buckets,
      [personalLoanEditor.bucket]: state.buckets[personalLoanEditor.bucket].map((item) =>
        item.id === updatedItem.id ? updatedItem : item
      ),
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setPersonalLoanEditor(null);
    setTimeout(
      () => saveBudgetWithIndicator(
        updatedState,
        isPaidOff
          ? 'Aunt personal loan marked paid off.'
          : isActive
            ? 'Aunt personal loan repayment plan started.'
            : 'Aunt personal loan saved with no active payment due.'
      ),
      100
    );
  };

  const pausePersonalLoanRepayment = (bucket, item) => {
    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              repaymentStatus: 'paused',
              status: 'paused',
              dueDate: '',
              nextPaymentDate: '',
              estBudget: 0,
              actualCost: 0,
              pausedReason: 'Repayment temporarily paused',
              pausedAt: new Date().toISOString(),
              loanUpdatedAt: new Date().toISOString(),
            }
          : entry
      ),
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(
      () => saveBudgetWithIndicator(updatedState, 'Aunt personal loan repayment paused. No payment is currently due.'),
      100
    );
  };

  const recordPersonalLoanPayment = () => {
    if (!personalLoanEditor?.bucket || !personalLoanEditor?.item?.id) return;

    const paymentAmount = getDebtNumber(personalLoanEditor.paymentEntry?.amount);
    const paymentDate = personalLoanEditor.paymentEntry?.date || '';
    const currentAmountOwed = getDebtNumber(
      personalLoanEditor.item.currentAmountOwed || personalLoanEditor.item.currentBalance
    );

    if (personalLoanEditor.item.repaymentStatus !== 'active') {
      alert('Start the repayment plan before recording a payment.');
      return;
    }
    if (paymentAmount <= 0 || !paymentDate) {
      alert('Enter the payment amount and payment date.');
      return;
    }

    const appliedAmount = Math.min(paymentAmount, currentAmountOwed);
    const remainingBalance = Math.max(0, currentAmountOwed - appliedAmount);
    const isPaidOff = remainingBalance <= 0;
    const nextPaymentDate = isPaidOff
      ? ''
      : advancePersonalLoanDueDate(
          personalLoanEditor.item.nextPaymentDate || personalLoanEditor.item.dueDate || paymentDate,
          personalLoanEditor.item.repaymentFrequency
        );
    const historyEntry = {
      id: `aunt-loan-payment-${Date.now()}`,
      amount: appliedAmount,
      paymentDate,
      balanceAfter: remainingBalance,
      recordedAt: new Date().toISOString(),
    };
    const updatedItem = {
      ...personalLoanEditor.item,
      currentBalance: remainingBalance,
      currentAmountOwed: remainingBalance,
      actualCost: appliedAmount,
      lastPaymentDate: paymentDate,
      nextPaymentDate,
      dueDate: nextPaymentDate,
      repaymentStatus: isPaidOff ? 'paidOff' : 'active',
      status: isPaidOff ? 'paid' : 'pending',
      accountStatus: isPaidOff ? 'Paid in Full' : 'Open',
      estBudget: isPaidOff ? 0 : getDebtNumber(personalLoanEditor.item.paymentAmount),
      paymentAmount: isPaidOff ? 0 : getDebtNumber(personalLoanEditor.item.paymentAmount),
      loanPaymentHistory: [
        ...(Array.isArray(personalLoanEditor.item.loanPaymentHistory)
          ? personalLoanEditor.item.loanPaymentHistory
          : []),
        historyEntry,
      ],
      pausedReason: '',
      pausedAt: '',
      loanUpdatedAt: new Date().toISOString(),
    };

    const updatedBuckets = {
      ...state.buckets,
      [personalLoanEditor.bucket]: state.buckets[personalLoanEditor.bucket].map((item) =>
        item.id === updatedItem.id ? updatedItem : item
      ),
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setPersonalLoanEditor(null);
    setTimeout(
      () => saveBudgetWithIndicator(
        updatedState,
        isPaidOff
          ? `Final payment of ${formatDebtCurrency(appliedAmount)} recorded. Aunt personal loan is paid off.`
          : `${formatDebtCurrency(appliedAmount)} payment recorded. Remaining balance: ${formatDebtCurrency(remainingBalance)}.`
      ),
      100
    );
  };

  const getRowBackgroundColor = (item) => {
    if (item.status === 'notPaying') return 'bg-slate-200 border-slate-300';
    if (item.status === 'paused') return 'bg-indigo-50 border-indigo-200';
    if (item.colorCleared) return 'bg-white border-gray-200';
    if (item.status === 'paid') return 'bg-green-100 border-green-200';
    const today = new Date();
    const diffDays = Math.ceil((new Date(item.dueDate) - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'bg-red-100 border-red-200';
    if (diffDays <= 5) return 'bg-yellow-100 border-yellow-200';
    return 'bg-white border-gray-200';
  };

  const getItemStatus = (item) => {
    if (item.status === 'notPaying') return 'notPaying';
    if (item.status === 'paused') return 'paused';
    if (item.status === 'paid') return 'paid';
    const today = new Date();
    const diffDays = Math.ceil((new Date(item.dueDate) - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 5) return 'dueSoon';
    return 'pending';
  };

  const handlePaidClick = (bucket, id) => {
    const item = state.buckets[bucket].find(item => item.id === id);
    if (!item) return;

    if (isAuntPersonalLoan(item)) {
      openPersonalLoanEditor(bucket, item, true);
      return;
    }

    const previousState = { dueDate: item.dueDate, status: item.status, actualCost: item.actualCost };

    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map(it =>
        it.id === id
          ? {
              ...it,
              status: 'paid',
              previousState,
              notPayingReason: '',
              notPayingAt: '',
              notPayingPreviousState: undefined,
              pausedReason: '',
              pausedAt: '',
              pausedPreviousState: undefined,
            }
          : it
      )
    };

    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Item marked as paid!'), 100);
  };

  const handleUndoPaid = (bucket, id) => {
    const item = state.buckets[bucket].find(item => item.id === id);
    if (!item || !item.previousState) return;

    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map(it =>
        it.id === id ? { ...it, ...it.previousState, previousState: undefined } : it
      )
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Payment undone!'), 100);
  };


  const handlePauseClick = (bucket, id) => {
    const item = state.buckets[bucket].find((entry) => entry.id === id);
    if (!item || ['paid', 'notPaying', 'paused'].includes(item.status)) return;

    if (isAuntPersonalLoan(item)) {
      pausePersonalLoanRepayment(bucket, item);
      return;
    }

    const reason = window.prompt(
      'Reason for temporarily pausing this item:',
      item.pausedReason || 'Paused until income improves'
    );

    if (reason === null) return;

    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: 'paused',
              pausedReason: reason.trim() || 'Temporarily paused',
              pausedAt: new Date().toISOString(),
              pausedPreviousState: {
                status: entry.status || 'pending',
                dueDate: entry.dueDate,
                actualCost: entry.actualCost,
                colorCleared: entry.colorCleared,
              },
              previousState: undefined,
              notPayingReason: '',
              notPayingAt: '',
              notPayingPreviousState: undefined,
              colorCleared: false,
            }
          : entry
      ),
    };

    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(
      () => saveBudgetWithIndicator(updatedState, 'Item paused and removed from active totals and alerts.'),
      100
    );
  };

  const handleResumePaused = (bucket, id) => {
    const item = state.buckets[bucket].find((entry) => entry.id === id);
    if (!item || item.status !== 'paused') return;

    if (isAuntPersonalLoan(item)) {
      openPersonalLoanEditor(bucket, item);
      return;
    }

    const previousState = item.pausedPreviousState || {};
    const restoredStatus =
      previousState.status && !['paused', 'notPaying'].includes(previousState.status)
        ? previousState.status
        : 'pending';

    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: restoredStatus,
              dueDate: previousState.dueDate ?? entry.dueDate,
              actualCost: previousState.actualCost ?? entry.actualCost,
              colorCleared: previousState.colorCleared ?? false,
              pausedReason: '',
              pausedAt: '',
              pausedPreviousState: undefined,
              notPayingReason: '',
              notPayingAt: '',
              notPayingPreviousState: undefined,
            }
          : entry
      ),
    };

    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(
      () => saveBudgetWithIndicator(updatedState, 'Paused item returned to the active budget.'),
      100
    );
  };

  const handleNotPayingClick = (bucket, id) => {
    const item = state.buckets[bucket].find((entry) => entry.id === id);
    if (!item || ['paid', 'notPaying', 'paused'].includes(item.status)) return;

    const reason = window.prompt(
      'Reason this item is no longer in the active payment plan:',
      item.notPayingReason || 'Bankruptcy review'
    );

    if (reason === null) return;

    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: 'notPaying',
              notPayingReason: reason.trim() || 'No longer in active payment plan',
              notPayingAt: new Date().toISOString(),
              notPayingPreviousState: {
                status: entry.status || 'pending',
                dueDate: entry.dueDate,
                actualCost: entry.actualCost,
                colorCleared: entry.colorCleared,
              },
              previousState: undefined,
              pausedReason: '',
              pausedAt: '',
              pausedPreviousState: undefined,
              colorCleared: false,
            }
          : entry
      ),
    };

    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(
      () => saveBudgetWithIndicator(updatedState, 'Item removed from the active payment plan.'),
      100
    );
  };

  const handleResumePaying = (bucket, id) => {
    const item = state.buckets[bucket].find((entry) => entry.id === id);
    if (!item) return;

    const previousState = item.notPayingPreviousState || {};
    const restoredStatus =
      previousState.status && !['notPaying', 'paused'].includes(previousState.status)
        ? previousState.status
        : 'pending';

    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: restoredStatus,
              dueDate: previousState.dueDate ?? entry.dueDate,
              actualCost: previousState.actualCost ?? entry.actualCost,
              colorCleared: previousState.colorCleared ?? false,
              notPayingReason: '',
              notPayingAt: '',
              notPayingPreviousState: undefined,
              pausedReason: '',
              pausedAt: '',
              pausedPreviousState: undefined,
            }
          : entry
      ),
    };

    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(
      () => saveBudgetWithIndicator(updatedState, 'Item returned to the active payment plan.'),
      100
    );
  };

  const openDebtEditor = (bucket, item) => {
    setDebtEditor({
      bucket,
      item: {
        ...item,
        accountStatus: item.accountStatus || '',
        currentAmountOwed: getDebtNumber(item.currentAmountOwed || item.currentBalance),
        pastDueAmount: getDebtNumber(item.pastDueAmount),
        originalBalance: getDebtNumber(item.originalBalance),
        settlementAmount: getDebtNumber(item.settlementAmount),
        lastPaymentDate: item.lastPaymentDate || '',
        delinquentSince: item.delinquentSince || '',
        collectionAgency: item.collectionAgency || '',
        sentToCollectionsDate: item.sentToCollectionsDate || '',
        originalCreditor: item.originalCreditor || '',
        accountLast4: item.accountLast4 || '',
        debtStatusNotes: item.debtStatusNotes || '',
      },
    });
  };

  const updateDebtEditorField = (field, value) => {
    setDebtEditor((current) =>
      current
        ? {
            ...current,
            item: {
              ...current.item,
              [field]: value,
            },
          }
        : current
    );
  };

  const saveDebtDetails = () => {
    if (!debtEditor?.bucket || !debtEditor?.item?.id) return;

    const currentAmountOwed = getDebtNumber(debtEditor.item.currentAmountOwed);
    const pastDueAmount = getDebtNumber(debtEditor.item.pastDueAmount);
    const originalBalance = getDebtNumber(debtEditor.item.originalBalance);
    const settlementAmount = getDebtNumber(debtEditor.item.settlementAmount);

    const updatedBuckets = {
      ...state.buckets,
      [debtEditor.bucket]: state.buckets[debtEditor.bucket].map((item) =>
        item.id === debtEditor.item.id
          ? {
              ...item,
              accountStatus: debtEditor.item.accountStatus || '',
              currentAmountOwed,
              currentBalance: currentAmountOwed,
              pastDueAmount,
              originalBalance,
              lastPaymentDate: debtEditor.item.lastPaymentDate || '',
              delinquentSince: debtEditor.item.delinquentSince || '',
              collectionAgency: debtEditor.item.collectionAgency || '',
              sentToCollectionsDate: debtEditor.item.sentToCollectionsDate || '',
              originalCreditor: debtEditor.item.originalCreditor || '',
              accountLast4: String(debtEditor.item.accountLast4 || '').replace(/\D/g, '').slice(-4),
              settlementAmount,
              debtStatusNotes: debtEditor.item.debtStatusNotes || '',
              debtUpdatedAt: new Date().toISOString(),
            }
          : item
      ),
    };

    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setDebtEditor(null);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Debt and account details saved.'), 100);
  };

  const savedCreditReports = useMemo(
    () => (Array.isArray(state?.meta?.creditReports) ? state.meta.creditReports.map(normalizeCreditReportFile) : []),
    [state?.meta?.creditReports]
  );

  const handleCreditReportImport = async (operations = [], reportMeta = {}, originalReport = {}) => {
    if (!operations.length) return;

    let savedReportFile = null;
    if (originalReport.saveOriginal && originalReport.file) {
      savedReportFile = await uploadCreditReportOriginal(originalReport.file, reportMeta);
    }

    const updatedBuckets = Object.fromEntries(
      Object.entries(state.buckets || {}).map(([bucket, items]) => [bucket, [...(items || [])]])
    );
    let createdCount = 0;
    let updatedCount = 0;

    operations.forEach((operation, index) => {
      const account = operation.account || {};
      const debtPatch = buildCreditReportDebtPatch(account);
      const importNote = buildCreditReportNote(account, reportMeta);
      const historyEntry = {
        bureau: account.bureau || reportMeta.bureau || '',
        reportDate: account.reportDate || reportMeta.reportDate || '',
        importedAt: new Date().toISOString(),
        reportFileId: savedReportFile?.id || '',
        reportFileName: savedReportFile?.originalName || '',
      };

      if (operation.type === 'update') {
        const bucketItems = updatedBuckets[operation.bucket] || [];
        const itemIndex = bucketItems.findIndex((item) => item.id === operation.itemId);
        if (itemIndex === -1) return;

        const existing = bucketItems[itemIndex];
        const existingNotes = String(existing.debtStatusNotes || '').trim();
        bucketItems[itemIndex] = {
          ...existing,
          ...debtPatch,
          debtStatusNotes: [existingNotes, importNote]
            .filter(Boolean)
            .filter((note, noteIndex, notes) => notes.indexOf(note) === noteIndex)
            .join('\n'),
          creditReportHistory: [...(Array.isArray(existing.creditReportHistory) ? existing.creditReportHistory : []), historyEntry],
        };
        updatedCount += 1;
        return;
      }

      const targetBucket = updatedBuckets[operation.bucket] ? operation.bucket : 'misc';
      const budgetStatus = operation.budgetStatus === 'notPaying' ? 'notPaying' : 'pending';
      const newItem = {
        id: `credit-report-${Date.now()}-${index}`,
        category: account.creditor || account.originalCreditor || 'Credit Account',
        estBudget: account.monthlyPayment ?? 0,
        actualCost: 0,
        dueDate: '',
        status: budgetStatus,
        recurrence: 'monthly',
        note: '',
        accountStatus: account.accountStatus || 'Unknown',
        ...debtPatch,
        debtStatusNotes: importNote,
        creditReportHistory: [historyEntry],
        notPayingReason: budgetStatus === 'notPaying' ? 'Imported from credit report for payment-plan review' : '',
        notPayingAt: budgetStatus === 'notPaying' ? new Date().toISOString() : '',
        notPayingPreviousState: undefined,
        pausedReason: '',
        pausedAt: '',
        pausedPreviousState: undefined,
      };

      updatedBuckets[targetBucket] = [...(updatedBuckets[targetBucket] || []), newItem];
      createdCount += 1;
    });

    const currentReports = Array.isArray(state?.meta?.creditReports) ? state.meta.creditReports : [];
    const updatedState = {
      ...state,
      buckets: updatedBuckets,
      meta: {
        ...(state.meta || {}),
        creditReports: savedReportFile ? [...currentReports, savedReportFile] : currentReports,
      },
    };
    setState(updatedState);
    setShowCreditReportScanner(false);
    if (savedReportFile) setShowSavedCreditReports(true);
    const summary = [
      createdCount ? `${createdCount} created` : '',
      updatedCount ? `${updatedCount} updated` : '',
    ].filter(Boolean).join(', ');
    setTimeout(() => saveBudgetWithIndicator(updatedState, `Credit report import complete: ${summary}.`), 100);
  };

  const deleteSavedCreditReport = async (reportFile) => {
    if (!reportFile?.savedName) return;
    if (!confirm(`Delete the saved original credit report "${reportFile.originalName}"?`)) return;

    const formData = new FormData();
    formData.append('action', 'delete');
    formData.append('savedName', reportFile.savedName);

    const response = await fetch(CREDIT_REPORT_FILE_ENDPOINT, {
      method: 'POST',
      body: formData,
    });
    const responseText = await response.text();
    let payload;

    try {
      payload = JSON.parse(responseText);
    } catch {
      throw new Error('The credit-report storage endpoint did not return a valid response.');
    }

    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || 'The saved credit report could not be deleted.');
    }

    const updatedReports = savedCreditReports.filter((file) => file.id !== reportFile.id);
    const updatedState = {
      ...state,
      meta: {
        ...(state.meta || {}),
        creditReports: updatedReports,
      },
    };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Saved credit report deleted.'), 100);
  };

  const handleRollForward = (bucket, id) => {
    const item = state.buckets[bucket].find(item => item.id === id);
    if (!item || getHomelightSavingsMonthKey(item) || ['notPaying', 'paused'].includes(item.status)) return;

    const currentDate = new Date(item.dueDate);
    const nextDate = new Date(currentDate);
    const recurrence = item.recurrence || 'monthly';

    switch (recurrence) {
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'biweekly':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'annual':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      case 'varies':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      default:
        nextDate.setMonth(nextDate.getMonth() + 1);
    }

    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map(it =>
        it.id === id ? {
          ...it,
          dueDate: nextDate.toISOString().split('T')[0],
          status: 'pending',
          actualCost: 0,
          previousState: undefined,
          notPayingReason: '',
          notPayingAt: '',
          notPayingPreviousState: undefined,
          pausedReason: '',
          pausedAt: '',
          pausedPreviousState: undefined
        } : it
      )
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);

    const recurrenceText = recurrence.charAt(0).toUpperCase() + recurrence.slice(1);
    setTimeout(() => saveBudgetWithIndicator(updatedState, `Rolled forward (${recurrenceText})!`), 100);
  };

  const handleArchiveClick = (bucket, id) => {
    const item = state.buckets[bucket].find(item => item.id === id);
    if (!item) return;

    const archivedItem = { ...item, originalBucket: bucket, archivedAt: new Date().toISOString() };
    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].filter(it => it.id !== id)
    };
    const updatedState = { ...state, buckets: updatedBuckets, archived: [...(state.archived || []), archivedItem] };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Item archived successfully!'), 100);
  };

  const handleDeleteClick = (bucket, id) => {
    setState(prevState => {
      const item = prevState.buckets[bucket].find(x => x.id === id);
      if (!item) return prevState;

      const updatedBuckets = { 
        ...prevState.buckets, 
        [bucket]: prevState.buckets[bucket].filter(x => x.id !== id) 
      };
      const updatedState = { ...prevState, buckets: updatedBuckets };

      if (undoTimerId) clearTimeout(undoTimerId);
      setRecentlyDeleted({ bucket, item });
      const tid = setTimeout(() => setRecentlyDeleted(null), 10000);
      setUndoTimerId(tid);

      // Save immediately without setTimeout to prevent race conditions
      saveBudgetWithIndicator(updatedState, 'Item deleted successfully!');
      
      return updatedState;
    });
  };
  const handleClearStatus = (bucket, id) => {
    const item = state.buckets[bucket].find(x => x.id === id);
    if (!item || ['notPaying', 'paused'].includes(item.status)) return;

    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map(it =>
        it.id === id ? { ...it, colorCleared: true, previousState: undefined } : it
      )
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);

    if (clearTimerId) clearTimeout(clearTimerId);
    setRecentlyCleared(true);
    const tid = setTimeout(() => setRecentlyCleared(false), 3000);
    setClearTimerId(tid);

    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Row color cleared'), 100);
  };

  const undoDelete = () => {
    if (!recentlyDeleted) return;
    const { bucket, item } = recentlyDeleted;
    const updatedBuckets = { ...state.buckets, [bucket]: [...(state.buckets[bucket] || []), item] };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Delete undone successfully!'), 100);
    if (undoTimerId) clearTimeout(undoTimerId);
    setUndoTimerId(null);
    setRecentlyDeleted(null);
  };

  const handleMoveUp = (bucket, index) => {
    if (index === 0) return;
    const items = [...state.buckets[bucket]];
    [items[index - 1], items[index]] = [items[index], items[index - 1]];
    const updatedBuckets = { ...state.buckets, [bucket]: items };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, false), 100);
  };

  const handleMoveDown = (bucket, index) => {
    const items = state.buckets[bucket];
    if (index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    const updatedBuckets = { ...state.buckets, [bucket]: newItems };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, false), 100);
  };

  const handleDragStart = (e, bucket, item) => {
    setDraggedItem(item);
    setDraggedFromBucket(bucket);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetBucket) => {
    e.preventDefault();
    if (!draggedItem || !draggedFromBucket) return;
    if (draggedFromBucket === targetBucket) {
      setDraggedItem(null);
      setDraggedFromBucket(null);
      return;
    }

    const updatedSourceBucket = state.buckets[draggedFromBucket].filter(it => it.id !== draggedItem.id);
    const updatedTargetBucket = [...state.buckets[targetBucket], draggedItem];

    const updatedBuckets = {
      ...state.buckets,
      [draggedFromBucket]: updatedSourceBucket,
      [targetBucket]: updatedTargetBucket
    };

    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, `Item moved to ${targetBucket}`), 100);
    setDraggedItem(null);
    setDraggedFromBucket(null);
  };

  const handleCategoryDragStart = (e, categoryKey) => {
    setDraggedCategory(categoryKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleCategoryDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleCategoryDrop = (e, targetCategoryKey) => {
    e.preventDefault();
    if (!draggedCategory || draggedCategory === targetCategoryKey) {
      setDraggedCategory(null);
      return;
    }

    const newOrder = [...categoryOrder];
    const draggedIndex = newOrder.indexOf(draggedCategory);
    const targetIndex = newOrder.indexOf(targetCategoryKey);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedCategory);

    setCategoryOrder(newOrder);

    const updatedState = {
      ...state,
      meta: {
        ...state.meta,
        categoryOrder: newOrder
      }
    };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Categories reordered!'), 100);
    setDraggedCategory(null);
  };

  const exportCategoryToCSV = (bucketName, items) => {
    const displayTitle = categoryNames[bucketName] || DEFAULT_TITLES[bucketName] || bucketName;
    const headers = [
      'Item',
      'Est. Budget',
      'Actual Cost',
      'Due Date',
      'Payment Plan Status',
      'Payment Plan Reason',
      'Pause Reason',
      'Paused At',
      'Account Status',
      'Current Amount Owed',
      'Past Due Amount',
      'Original Balance',
      'Last Payment Date',
      'Delinquent Since',
      'Days Delinquent',
      'Delinquency Stage',
      'Collection Agency',
      'Sent to Collections',
      'Original Creditor',
      'Account Last 4',
      'Settlement Amount',
      'Debt Notes',
      'Loan Lender',
      'Loan Purpose',
      'Interest Rate',
      'Repayment Status',
      'Payment Amount',
      'Payment Frequency',
      'First Payment Date',
      'Next Payment Date',
      'Payment History',
    ];
    const rows = items.map(item => {
      const daysDelinquent = getDebtDaysDelinquent(item);
      return [
        item.category || '',
        item.estBudget || 0,
        item.actualCost || 0,
        item.dueDate || '',
        item.status || 'pending',
        item.notPayingReason || '',
        item.pausedReason || '',
        item.pausedAt || '',
        item.accountStatus || '',
        item.currentAmountOwed || item.currentBalance || 0,
        item.pastDueAmount || 0,
        item.originalBalance || 0,
        item.lastPaymentDate || '',
        item.delinquentSince || '',
        daysDelinquent,
        getDelinquencyStage(daysDelinquent),
        item.collectionAgency || '',
        item.sentToCollectionsDate || '',
        item.originalCreditor || '',
        item.accountLast4 || '',
        item.settlementAmount || 0,
        item.debtStatusNotes || '',
        item.lender || '',
        item.loanPurpose || '',
        item.interestRate || 0,
        item.repaymentStatus || '',
        item.paymentAmount || 0,
        item.repaymentFrequency || '',
        item.firstPaymentDate || '',
        item.nextPaymentDate || '',
        Array.isArray(item.loanPaymentHistory)
          ? item.loanPaymentHistory
              .map((payment) => `${payment.paymentDate}: ${formatDebtCurrency(payment.amount)} (${formatDebtCurrency(payment.balanceAfter)} remaining)`)
              .join(' | ')
          : '',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${displayTitle}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renameCategory = (bucketName) => {
    const currentName = categoryNames[bucketName] || DEFAULT_TITLES[bucketName] || bucketName;
    const newName = prompt(`Rename category "${currentName}" to:`, currentName)?.trim();
    if (!newName || newName === currentName) return;

    const updatedNames = { ...categoryNames, [bucketName]: newName };
    setCategoryNames(updatedNames);

    const updatedState = {
      ...state,
      meta: {
        ...state.meta,
        categoryNames: updatedNames
      }
    };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Category renamed successfully!'), 100);
  };

  const addCategory = () => {
    const key = prompt('New category key (letters only, no spaces):')?.trim();
    if (!key) return;
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) { alert('Invalid key format.'); return; }
    if (state.buckets[key]) { alert('Category already exists.'); return; }

    const newOrder = [...categoryOrder, key];
    const updatedState = {
      ...state,
      buckets: { ...state.buckets, [key]: [] },
      meta: {
        ...state.meta,
        categoryOrder: newOrder
      }
    };
    setState(updatedState);
    setCategoryOrder(newOrder);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Category added successfully!'), 100);
  };

  const deleteCategory = () => {
    const deletableCategories = Object.keys(state.buckets || {})
      .filter(key => !PROTECTED_BUCKETS.has(key))
      .filter(key => (state.buckets[key] || []).length === 0);

    if (deletableCategories.length === 0) {
      alert('No categories available to delete. Categories must be empty and not protected.');
      return;
    }

    const options = deletableCategories.map(key => `<option value="${key}">${key}</option>`).join('');

    const dialog = document.createElement('div');
    dialog.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
        <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
          <h3 style="margin: 0 0 15px 0;">Delete Category</h3>
          <label style="display: block; margin-bottom: 10px;">Category to delete (must be empty and not protected):</label>
          <select id="categorySelect" style="width: 100%; padding: 8px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px;">
            ${options}
          </select>
          <div style="display: flex; gap: 10px; justify-content: flex-end;">
            <button id="cancelBtn" style="padding: 8px 16px; background: #e5e7eb; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
            <button id="okBtn" style="padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">OK</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    const closeDialog = () => document.body.removeChild(dialog);
    dialog.querySelector('#cancelBtn').onclick = closeDialog;
    dialog.querySelector('#okBtn').onclick = () => {
      const selectedKey = dialog.querySelector('#categorySelect').value;
      if (selectedKey) {
        const { [selectedKey]: _, ...rest } = state.buckets;
        const newOrder = categoryOrder.filter(k => k !== selectedKey);
        const updatedState = {
          ...state,
          buckets: rest,
          meta: {
            ...state.meta,
            categoryOrder: newOrder
          }
        };
        setState(updatedState);
        setCategoryOrder(newOrder);
        setTimeout(() => saveBudgetWithIndicator(updatedState, 'Category deleted successfully!'), 100);
      }
      closeDialog();
    };
  };

  const addRow = (bucket) => {
    const newRow = {
      id: `${bucket}-${Date.now()}`,
      category: '',
      estBudget: 0,
      actualCost: 0,
      dueDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      recurrence: 'monthly'
    };
    const updatedBuckets = { ...state.buckets, [bucket]: [...state.buckets[bucket], newRow] };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
  };

  const addBatchItem = (e) => {
    e.preventDefault();
    if (!batchAddCategory || !batchItemNameRef.current) return;

    const itemName = batchItemNameRef.current.value.trim();
    if (!itemName) return;

    const newRow = {
      id: `${batchAddCategory}-${Date.now()}`,
      category: itemName,
      estBudget: 0,
      actualCost: 0,
      dueDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      recurrence: 'monthly'
    };

    const updatedBuckets = {
      ...state.buckets,
      [batchAddCategory]: [...(state.buckets[batchAddCategory] || []), newRow]
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);

    batchItemNameRef.current.value = '';
    batchItemNameRef.current.focus();
  };

  const updateRow = (bucket, id, field, value) => {
    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map(item => item.id === id ? { ...item, [field]: value } : item)
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
  };

  const handleActualCostBlur = (bucket, id, value) => {
    const actualValue = parseFloat(value) || 0;
    updateRow(bucket, id, 'actualCost', actualValue);
  };

  const duplicateItem = (bucket, id) => {
    const item = state.buckets[bucket].find(x => x.id === id);
    if (!item) return;

    const newItem = {
      ...item,
      id: `${bucket}-${Date.now()}`,
      status: 'pending',
      actualCost: 0,
      previousState: undefined,
      colorCleared: false,
      notPayingReason: '',
      notPayingAt: '',
      notPayingPreviousState: undefined,
      pausedReason: '',
      pausedAt: '',
      pausedPreviousState: undefined,
    };

    const updatedBuckets = { ...state.buckets, [bucket]: [...state.buckets[bucket], newItem] };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setTimeout(() => saveBudgetWithIndicator(updatedState, 'Item duplicated!'), 100);
  };

  const collapseAll = () => {
    const allCategories = {};
    categoryOrder.forEach(key => { allCategories[key] = true; });
    setCollapsedCategories(allCategories);
  };

  const expandAll = () => { setCollapsedCategories({}); };

  const toggleCategory = (key) => {
    setCollapsedCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleSelectItem = (bucket, id) => {
    const key = `${bucket}:${id}`;
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) newSet.delete(key);
      else newSet.add(key);
      return newSet;
    });
  };

  const bulkDelete = () => {
    if (selectedItems.size === 0) return;
    if (!confirm(`Delete ${selectedItems.size} selected items?`)) return;

    const count = selectedItems.size;
    
    // Calculate the new state
    const updatedBuckets = { ...state.buckets };
    selectedItems.forEach(key => {
      const [bucket, id] = key.split(':');
      updatedBuckets[bucket] = updatedBuckets[bucket].filter(x => x.id !== id);
    });
    const updatedState = { ...state, buckets: updatedBuckets };
    
    // Update state and clear selection
    setState(updatedState);
    setSelectedItems(new Set());
    
    // Save with the exact state we just calculated
    saveBudgetWithIndicator(updatedState, `${count} items deleted!`);
  };

  const bulkArchive = () => {
    if (selectedItems.size === 0) return;

    const count = selectedItems.size;
    
    // Calculate the new state
    const updatedBuckets = { ...state.buckets };
    const newArchived = [...(state.archived || [])];

    selectedItems.forEach(key => {
      const [bucket, id] = key.split(':');
      const item = updatedBuckets[bucket].find(x => x.id === id);
      if (item) {
        newArchived.push({ ...item, originalBucket: bucket, archivedAt: new Date().toISOString() });
        updatedBuckets[bucket] = updatedBuckets[bucket].filter(x => x.id !== id);
      }
    });
    const updatedState = { ...state, buckets: updatedBuckets, archived: newArchived };
    
    // Update state and clear selection
    setState(updatedState);
    setSelectedItems(new Set());
    
    // Save with the exact state we just calculated
    saveBudgetWithIndicator(updatedState, `${count} items archived!`);
  };

  const bulkRollForward = () => {
    if (selectedItems.size === 0) return;

    // Calculate the new state
    const updatedBuckets = { ...state.buckets };
    let rolledCount = 0;

    selectedItems.forEach(key => {
      const [bucket, id] = key.split(':');
      const itemIndex = updatedBuckets[bucket].findIndex(x => x.id === id);

      if (itemIndex !== -1) {
        const item = updatedBuckets[bucket][itemIndex];
        if (getHomelightSavingsMonthKey(item) || ['notPaying', 'paused'].includes(item.status)) return;

        const currentDate = new Date(item.dueDate);
        const nextDate = new Date(currentDate);
        const recurrence = item.recurrence || 'monthly';

        switch (recurrence) {
          case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case 'biweekly':
            nextDate.setDate(nextDate.getDate() + 14);
            break;
          case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case 'quarterly':
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
          case 'yearly':
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        }

        updatedBuckets[bucket][itemIndex] = {
          ...item,
          dueDate: nextDate.toISOString().split('T')[0],
          status: 'pending',
          actualCost: 0,
          previousState: undefined,
          notPayingReason: '',
          notPayingAt: '',
          notPayingPreviousState: undefined,
          pausedReason: '',
          pausedAt: '',
          pausedPreviousState: undefined
        };
        rolledCount++;
      }
    });
    const updatedState = { ...state, buckets: updatedBuckets };
    
    // Update state and clear selection
    setState(updatedState);
    setSelectedItems(new Set());
    
    // Save with the exact state we just calculated
    saveBudgetWithIndicator(updatedState, `${rolledCount} items rolled forward!`);
  };

  const addFromTemplate = (template) => {
    const newItem = {
      id: `${template.category}-${Date.now()}`,
      category: template.name,
      estBudget: template.estBudget,
      actualCost: 0,
      dueDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      recurrence: template.recurrence || 'monthly'
    };

    const updatedBuckets = {
      ...state.buckets,
      [template.category]: [...(state.buckets[template.category] || []), newItem]
    };
    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    setShowTemplates(false);
    setTimeout(() => saveBudgetWithIndicator(updatedState, `Added "${template.name}" from template!`), 100);
  };

  const getCategoryStatusCounts = (items) => {
    const counts = { overdue: 0, dueSoon: 0, pending: 0, paid: 0, paused: 0, notPaying: 0 };
    items.forEach(item => {
      const status = getItemStatus(item);
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  };

  const getFilteredItems = (items) => {
    let filtered = items;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => {
        const status = getItemStatus(item);
        return status === statusFilter;
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

  const BucketSection = ({ bucketName, items, title }) => {
    const IconComponent = categoryIcons[bucketName]?.icon || Package;
    const iconColor = categoryIcons[bucketName]?.color || 'text-gray-600';
    const displayTitle = categoryNames[bucketName] || DEFAULT_TITLES[bucketName] || title;
    const isCollapsed = collapsedCategories[bucketName];

    const filteredItems = getFilteredItems(items).sort((a, b) => {
      const dateA = new Date(a.dueDate || '9999-12-31');
      const dateB = new Date(b.dueDate || '9999-12-31');
      return dateA - dateB;
    });

    const activeItems = items.filter((item) => !['notPaying', 'paused'].includes(item.status));
    const totalBudgeted = activeItems.reduce((sum, item) => sum + (Number(item.estBudget) || 0), 0);
    const totalActual = activeItems.reduce((sum, item) => sum + (Number(item.actualCost) || 0), 0);
    const variance = totalActual - totalBudgeted;
    const statusCounts = getCategoryStatusCounts(items);

    return (
      <div
        className="mb-4"
        onDragOver={handleCategoryDragOver}
        onDrop={(e) => handleCategoryDrop(e, bucketName)}
      >
        <div draggable onDragStart={(e) => handleCategoryDragStart(e, bucketName)} className="bg-black text-white px-4 py-2 rounded-t-lg flex items-center justify-between cursor-move">
          <div className="flex items-center gap-2 flex-wrap">
            <GripVertical className="w-4 h-4 text-gray-400 hidden sm:block" />
            <CollapseToggleButton
              expanded={!isCollapsed}
              onClick={() => toggleCategory(bucketName)}
              title={isCollapsed ? `Expand ${displayTitle}` : `Collapse ${displayTitle}`}
              ariaLabel={isCollapsed ? `Expand ${displayTitle}` : `Collapse ${displayTitle}`}
              className="border-slate-500 bg-slate-700 hover:bg-slate-600 focus-visible:ring-white"
            />
            <IconComponent className={`w-5 h-5 ${iconColor}`} aria-hidden="true" />
            <h3 className="text-base sm:text-lg font-semibold">{displayTitle}</h3>
            <span className="text-xs sm:text-sm opacity-75">({filteredItems.length})</span>

            <div className="flex gap-1">
              {statusCounts.overdue > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {statusCounts.overdue}
                </span>
              )}
              {statusCounts.pending > 0 && (
                <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {statusCounts.pending}
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
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => addRow(bucketName)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs sm:text-sm font-medium"
              title="Add Item"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Item</span>
            </button>
            <button
              onClick={() => exportCategoryToCSV(bucketName, items)}
              className="p-1.5 hover:bg-gray-800 rounded transition-colors"
              title="Export to CSV"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => renameCategory(bucketName)}
              className="p-1.5 hover:bg-gray-800 rounded transition-colors hidden sm:block"
              title="Rename Category"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!isCollapsed && (
          <div
            className="editor-table-scroll table-scroll-wrapper rounded-b-lg border border-gray-300"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, bucketName)}
          >
            {bucketName === 'banking' ? (
              // BANKING & FINANCE - CUSTOM TABLE
              <table className="editor-budget-table editor-banking-table banking-table w-full table-fixed">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-1 py-2 text-left text-sm font-medium text-gray-700 w-8"></th>
                    <th className="px-1 py-2 text-left text-sm font-medium text-gray-700 w-8"></th>
                    <th className="px-1 py-2 text-left text-sm font-medium text-gray-700 w-8"></th>
                    <th className="px-2 py-2 text-left text-sm font-medium text-gray-700 w-[21%]">Item</th>
                    <th className="px-2 py-2 text-right text-sm font-medium text-gray-700 w-[9%]">Minimum</th>
                    <th className="px-2 py-2 text-right text-sm font-medium text-gray-700 w-[9%]">Balance</th>
                    <th className="px-2 py-2 text-right text-sm font-medium text-gray-700 w-[9%]">Actual Paid</th>
                    <th className="px-2 py-2 text-right text-sm font-medium text-gray-700 w-[9%]">Available</th>
                    <th className="px-2 py-2 text-left text-sm font-medium text-gray-700 w-[11%]">Due Date</th>
                    <th className="px-2 py-2 text-left text-sm font-medium text-gray-700 w-[24%]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const itemKey = `${bucketName}:${item.id}`;
                    const isSelected = selectedItems.has(itemKey);

                    return (
                      <tr
                        key={item.id}
                        onClickCapture={preserveItemActionScroll}
                        className={`border-t ${getRowBackgroundColor(item)} ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                      >
                        <td className="px-1 py-2 w-8">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectItem(bucketName, item.id)}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="px-1 py-2 w-8">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleMoveUp(bucketName, (state.buckets[bucketName] || []).indexOf(item))}
                              disabled={(state.buckets[bucketName] || []).indexOf(item) === 0}
                              className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move Up"
                            >
                              <ArrowUp className="w-3 h-3 text-gray-600" />
                            </button>
                            <button
                              onClick={() => handleMoveDown(bucketName, (state.buckets[bucketName] || []).indexOf(item))}
                              disabled={(state.buckets[bucketName] || []).indexOf(item) === (state.buckets[bucketName] || []).length - 1}
                              className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Move Down"
                            >
                              <ArrowDown className="w-3 h-3 text-gray-600" />
                            </button>
                          </div>
                        </td>
                        <td 
                          className="px-1 py-2 w-8"
                          draggable
                          onDragStart={(e) => handleDragStart(e, bucketName, item)}
                        >
                          <GripVertical className="w-4 h-4 text-gray-400 cursor-grab hover:text-gray-600" />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            defaultValue={item.category}
                            onBlur={(e) => updateRow(bucketName, item.id, 'category', e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                            className="w-full p-1 border rounded bg-white text-sm"
                            placeholder="Enter item name"
                          />
                          {item.status === 'paused' && (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              <span
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white"
                                title={`Paused${item.pausedReason ? `: ${item.pausedReason}` : ''}`}
                                aria-label={`Paused${item.pausedReason ? `: ${item.pausedReason}` : ''}`}
                              >
                                <PauseCircle className="h-3 w-3" />
                              </span>
                              {item.pausedReason && (
                                <span className="text-[11px] font-semibold text-indigo-800">
                                  {item.pausedReason}
                                </span>
                              )}
                            </div>
                          )}
                          {item.status === 'notPaying' && (
                            <div className="mt-1 flex flex-wrap items-center gap-1">
                              <span
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white"
                                title={`Not paying${item.notPayingReason ? `: ${item.notPayingReason}` : ''}`}
                                aria-label={`Not paying${item.notPayingReason ? `: ${item.notPayingReason}` : ''}`}
                              >
                                <Ban className="h-3 w-3" />
                              </span>
                              {item.notPayingReason && (
                                <span className="text-[11px] font-semibold text-slate-700">
                                  {item.notPayingReason}
                                </span>
                              )}
                            </div>
                          )}
                          {hasDebtTrackingDetails(item) && (
                            <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] font-semibold">
                              {item.accountStatus && (
                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">
                                  {item.accountStatus}
                                </span>
                              )}
                              {getDebtNumber(item.currentAmountOwed || item.currentBalance) > 0 && (
                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-800">
                                  Owed {formatDebtCurrency(item.currentAmountOwed || item.currentBalance)}
                                </span>
                              )}
                              {getDebtDaysDelinquent(item) > 0 && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
                                  {getDebtDaysDelinquent(item)} days delinquent
                                </span>
                              )}
                              {item.collectionAgency && (
                                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-800">
                                  Collections: {item.collectionAgency}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="text"
                            defaultValue={item.estBudget}
                            onBlur={(e) => updateRow(bucketName, item.id, 'estBudget', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                            className="w-full p-1 border rounded bg-white text-right text-sm"
                            placeholder="Min payment"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="text"
                            defaultValue={item.currentBalance || 0}
                            onBlur={(e) => updateRow(bucketName, item.id, 'currentBalance', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                            className="w-full p-1 border rounded bg-white text-right text-sm"
                            placeholder="Balance"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="text"
                            defaultValue={item.actualCost || 0}
                            onBlur={(e) => updateRow(bucketName, item.id, 'actualCost', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                            className="w-full p-1 border rounded bg-white text-right text-sm"
                            placeholder="Paid"
                          />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input
                            type="text"
                            defaultValue={item.availableCredit || 0}
                            onBlur={(e) => updateRow(bucketName, item.id, 'availableCredit', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                            className="w-full p-1 border rounded bg-white text-right text-sm"
                            placeholder="Available"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <input
                            type="date"
                            defaultValue={item.dueDate}
                            onBlur={(e) => updateRow(bucketName, item.id, 'dueDate', e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                            className="w-full p-1 border rounded bg-white text-sm"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex flex-wrap gap-1">
                            {item.status === 'notPaying' ? (
                              <button
                                onClick={() => handleResumePaying(bucketName, item.id)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded bg-slate-700 text-white hover:bg-slate-800"
                                title="Return this item to its previous budget status"
                                aria-label="Return this item to its previous budget status"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                              </button>
                            ) : item.status === 'paused' ? (
                              <button
                                onClick={() => handleResumePaused(bucketName, item.id)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded bg-indigo-600 text-white hover:bg-indigo-700"
                                title="Resume this paused budget item"
                                aria-label="Resume this paused budget item"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            ) : item.status === 'paid' && item.previousState ? (
                              <>
                                <button
                                  onClick={() => handleUndoPaid(bucketName, item.id)}
                                  className="px-1.5 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                                  title="Undo Payment"
                                >
                                  <Undo2 className="w-3.5 h-3.5" />
                                </button>
                                {!getHomelightSavingsMonthKey(item) && (
                                  <button
                                    onClick={() => handleRollForward(bucketName, item.id)}
                                    className="px-1.5 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                    title="Roll Forward to Next Month"
                                  >
                                    <CalendarClock className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <button
                                onClick={() => handlePaidClick(bucketName, item.id)}
                                className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                                title="Mark as Paid"
                              >
                                Paid
                              </button>
                            )}

                            {!['notPaying', 'paid', 'paused'].includes(item.status) && bucketName !== 'income' && (
                              <button
                                onClick={() => handlePauseClick(bucketName, item.id)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded bg-indigo-600 text-white hover:bg-indigo-700"
                                title="Pause this item temporarily. It will stay visible but be removed from active totals and alerts."
                                aria-label="Pause this budget item temporarily"
                              >
                                <PauseCircle className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {!['notPaying', 'paid', 'paused'].includes(item.status) && (
                              <button
                                onClick={() => handleNotPayingClick(bucketName, item.id)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded bg-slate-700 text-white hover:bg-slate-800"
                                title="Stop paying this item"
                                aria-label="Stop paying this item"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {isAuntPersonalLoan(item) && (
                              <button
                                onClick={() => openPersonalLoanEditor(bucketName, item)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-700 text-white hover:bg-blue-800"
                                title="Manage aunt personal loan repayment"
                                aria-label="Manage aunt personal loan repayment"
                              >
                                <DollarSign className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {bucketName !== 'income' && (
                              <button
                                onClick={() => openDebtEditor(bucketName, item)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded bg-amber-600 text-white hover:bg-amber-700"
                                title="Edit debt, delinquency, closure, and collections details"
                                aria-label="Edit debt, delinquency, closure, and collections details"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {!isAuntPersonalLoan(item) && (
                              <button
                                onClick={() => duplicateItem(bucketName, item.id)}
                                className="px-1.5 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                                title="Duplicate Item"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button
                              onClick={() => handleArchiveClick(bucketName, item.id)}
                              className="px-1.5 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                              title="Archive Item"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteClick(bucketName, item.id)}
                              className="px-1.5 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {!['notPaying', 'paused'].includes(item.status) && (item.status === 'paid' || getRowBackgroundColor(item) !== 'bg-white border-gray-200') && (
                              <button
                                onClick={() => handleClearStatus(bucketName, item.id)}
                                className="px-2 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs"
                                title="Clear Status (Reset to White)"
                              >
                                Clr
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="editor-budget-table editor-standard-table w-full min-w-0 md:min-w-[900px]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-1 py-2 text-left text-sm font-medium text-gray-700 w-8"></th>
                  <th className="px-1 py-2 text-left text-sm font-medium text-gray-700 w-8"></th>
                  <th className="px-1 py-2 text-left text-sm font-medium text-gray-700 w-8"></th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Item</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 w-28">Est. Budget</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-700 w-28">Actual Cost</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 w-36">{bucketName === 'income' ? 'Received Date' : 'Due Date'}</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const itemKey = `${bucketName}:${item.id}`;
                  const isSelected = selectedItems.has(itemKey);

                  return (
                    <tr
                      key={item.id}
                      onClickCapture={preserveItemActionScroll}
                      className={`border-t ${getRowBackgroundColor(item)} ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      <td className="px-1 py-2 w-8">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectItem(bucketName, item.id)}
                          className="w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="px-1 py-2 w-8">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleMoveUp(bucketName, (state.buckets[bucketName] || []).indexOf(item))}
                            disabled={(state.buckets[bucketName] || []).indexOf(item) === 0}
                            className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3 h-3 text-gray-600" />
                          </button>
                          <button
                            onClick={() => handleMoveDown(bucketName, (state.buckets[bucketName] || []).indexOf(item))}
                            disabled={(state.buckets[bucketName] || []).indexOf(item) === (state.buckets[bucketName] || []).length - 1}
                            className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3 h-3 text-gray-600" />
                          </button>
                        </div>
                      </td>
                      <td 
                        className="px-1 py-2 w-8"
                        draggable
                        onDragStart={(e) => handleDragStart(e, bucketName, item)}
                      >
                        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab hover:text-gray-600" />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          defaultValue={item.category}
                          onBlur={(e) => updateRow(bucketName, item.id, 'category', e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                          className="w-full p-1 border rounded bg-white"
                          placeholder="Enter item name"
                        />
                        {getHomelightSavingsMonthKey(item) && (
                          <span className="mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800">
                            Homelight plan · Actual Cost = saved
                          </span>
                        )}
                        {item.status === 'paused' && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white"
                              title={`Paused${item.pausedReason ? `: ${item.pausedReason}` : ''}`}
                              aria-label={`Paused${item.pausedReason ? `: ${item.pausedReason}` : ''}`}
                            >
                              <PauseCircle className="h-3 w-3" />
                            </span>
                            {item.pausedReason && (
                              <span className="text-[11px] font-semibold text-indigo-800">
                                {item.pausedReason}
                              </span>
                            )}
                          </div>
                        )}
                        {item.status === 'notPaying' && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            <span
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-white"
                                title={`Not paying${item.notPayingReason ? `: ${item.notPayingReason}` : ''}`}
                                aria-label={`Not paying${item.notPayingReason ? `: ${item.notPayingReason}` : ''}`}
                              >
                                <Ban className="h-3 w-3" />
                              </span>
                            {item.notPayingReason && (
                              <span className="text-[11px] font-semibold text-slate-700">
                                {item.notPayingReason}
                              </span>
                            )}
                          </div>
                        )}
                          {hasDebtTrackingDetails(item) && (
                            <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] font-semibold">
                              {item.accountStatus && (
                                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-indigo-800">
                                  {item.accountStatus}
                                </span>
                              )}
                              {getDebtNumber(item.currentAmountOwed || item.currentBalance) > 0 && (
                                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-800">
                                  Owed {formatDebtCurrency(item.currentAmountOwed || item.currentBalance)}
                                </span>
                              )}
                              {getDebtDaysDelinquent(item) > 0 && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">
                                  {getDebtDaysDelinquent(item)} days delinquent
                                </span>
                              )}
                              {item.collectionAgency && (
                                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-violet-800">
                                  Collections: {item.collectionAgency}
                                </span>
                              )}
                            </div>
                          )}
                      </td>
                      <td className="px-4 py-2 text-right w-28">
                        <input
                          type="number"
                          defaultValue={item.estBudget}
                          onBlur={(e) => updateRow(bucketName, item.id, 'estBudget', parseFloat(e.target.value) || 0)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                          className="w-full p-1 border rounded bg-white text-right"
                          step="0.01"
                        />
                      </td>
                      <td className="px-4 py-2 text-right w-28">
                        <input
                          type="number"
                          defaultValue={item.actualCost}
                          onBlur={(e) => handleActualCostBlur(bucketName, item.id, e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                          className="w-full p-1 border rounded bg-white text-right"
                          step="0.01"
                          placeholder={item.estBudget > 0 ? `Auto: ${item.estBudget}` : '0'}
                        />
                      </td>
                      <td className="px-4 py-2 w-36">
                        <input
                          type="date"
                          defaultValue={item.dueDate}
                          onBlur={(e) => updateRow(bucketName, item.id, 'dueDate', e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                          className="w-full p-1 border rounded bg-white"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          {item.status === 'notPaying' ? (
                            <button
                              onClick={() => handleResumePaying(bucketName, item.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-700 text-white hover:bg-slate-800"
                              title="Return this item to its previous budget status"
                              aria-label="Return this item to its previous budget status"
                            >
                              <Undo2 className="w-4 h-4" />
                            </button>
                          ) : item.status === 'paused' ? (
                            <button
                              onClick={() => handleResumePaused(bucketName, item.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded bg-indigo-600 text-white hover:bg-indigo-700"
                              title="Resume this paused budget item"
                              aria-label="Resume this paused budget item"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          ) : item.status === 'paid' && item.previousState ? (
                            <>
                              <button
                                onClick={() => handleUndoPaid(bucketName, item.id)}
                                className="px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700"
                                title="Undo Payment"
                              >
                                <Undo2 className="w-4 h-4" />
                              </button>
                              {!getHomelightSavingsMonthKey(item) && (
                                <button
                                  onClick={() => handleRollForward(bucketName, item.id)}
                                  className="px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                  title="Roll Forward to Next Month"
                                >
                                  <CalendarClock className="w-4 h-4" />
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => handlePaidClick(bucketName, item.id)}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                              title="Mark as Paid"
                            >
                              Paid
                            </button>
                          )}

                          {!['notPaying', 'paid', 'paused'].includes(item.status) && bucketName !== 'income' && (
                            <button
                              onClick={() => handlePauseClick(bucketName, item.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded bg-indigo-600 text-white hover:bg-indigo-700"
                              title="Pause this item temporarily. It will stay visible but be removed from active totals and alerts."
                              aria-label="Pause this budget item temporarily"
                            >
                              <PauseCircle className="w-4 h-4" />
                            </button>
                          )}

                          {!['notPaying', 'paid', 'paused'].includes(item.status) && (
                            <button
                              onClick={() => handleNotPayingClick(bucketName, item.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-700 text-white hover:bg-slate-800"
                                title="Stop paying this item"
                                aria-label="Stop paying this item"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                          )}

                          {isAuntPersonalLoan(item) && (
                            <button
                              onClick={() => openPersonalLoanEditor(bucketName, item)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-700 text-white hover:bg-blue-800"
                              title="Manage aunt personal loan repayment"
                              aria-label="Manage aunt personal loan repayment"
                            >
                              <DollarSign className="h-4 w-4" />
                            </button>
                          )}

                          {bucketName !== 'income' && (
                            <button
                              onClick={() => openDebtEditor(bucketName, item)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded bg-amber-600 text-white hover:bg-amber-700"
                              title="Edit debt, delinquency, closure, and collections details"
                              aria-label="Edit debt, delinquency, closure, and collections details"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                          )}

                          {!isAuntPersonalLoan(item) && (
                            <button
                              onClick={() => duplicateItem(bucketName, item.id)}
                              className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              title="Duplicate Item"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            onClick={() => handleArchiveClick(bucketName, item.id)}
                            className="px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                            title="Archive Item"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(bucketName, item.id)}
                            className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                            title="Delete Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {!['notPaying', 'paused'].includes(item.status) && (item.status === 'paid' || getRowBackgroundColor(item) !== 'bg-white border-gray-200') && (
                            <button
                              onClick={() => handleClearStatus(bucketName, item.id)}
                              className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs"
                              title="Clear Status (Reset to White)"
                            >
                              Clr
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </div>
        )}

        {isCollapsed && (
          <div className="border border-gray-300 rounded-b-lg bg-gray-50 px-4 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-gray-600 gap-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span>{filteredItems.length} items</span>
                {statusCounts.overdue > 0 && (
                  <span className="text-red-600 font-medium">{statusCounts.overdue} overdue</span>
                )}
                {statusCounts.pending > 0 && (
                  <span className="text-yellow-600 font-medium">{statusCounts.pending} pending</span>
                )}
                {statusCounts.paused > 0 && (
                  <span className="text-indigo-700 font-medium">{statusCounts.paused} paused</span>
                )}
                {statusCounts.notPaying > 0 && (
                  <span className="text-slate-700 font-medium">{statusCounts.notPaying} not paying</span>
                )}
              </div>
              <div className="flex gap-4 flex-wrap">
                <span>Budgeted: <strong>${totalBudgeted.toFixed(2)}</strong></span>
                <span>Actual: <strong>${totalActual.toFixed(2)}</strong></span>
                <span className={variance > 0 ? 'text-red-600' : 'text-green-600'}>
                  Variance: <strong>{variance > 0 ? '+' : ''}${variance.toFixed(2)}</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageContainer className="overflow-x-hidden py-3 sm:py-4">
      <style>{`
        @media (max-width: 767.98px) {
          .editor-table-scroll {
            width: 100%;
            max-width: 100%;
            overflow-x: hidden;
          }

          .editor-budget-table,
          .editor-budget-table tbody {
            display: block;
            width: 100%;
            min-width: 0;
          }

          .editor-budget-table {
            table-layout: auto;
          }

          .editor-budget-table thead {
            display: none;
          }

          .editor-budget-table tbody tr {
            box-sizing: border-box;
            display: grid;
            width: 100%;
            min-width: 0;
            grid-template-columns: repeat(12, minmax(0, 1fr));
            gap: 8px;
            padding: 10px;
          }

          .editor-budget-table tbody td {
            display: block;
            width: auto !important;
            min-width: 0;
            padding: 0;
          }

          .editor-budget-table tbody td::before {
            display: block;
            margin-bottom: 3px;
            color: #475569;
            font-size: 10px;
            font-weight: 800;
            line-height: 1.1;
            text-transform: uppercase;
            letter-spacing: 0.025em;
          }

          .editor-budget-table input,
          .editor-budget-table select,
          .editor-budget-table textarea {
            box-sizing: border-box;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            font-size: 16px;
          }

          .editor-budget-table tbody td:nth-child(1) {
            grid-column: 1 / span 1;
            align-self: center;
          }

          .editor-budget-table tbody td:nth-child(2) {
            grid-column: 2 / span 1;
            align-self: center;
          }

          .editor-budget-table tbody td:nth-child(3) {
            grid-column: 3 / span 1;
            align-self: center;
          }

          .editor-budget-table tbody td:nth-child(4) {
            grid-column: 4 / -1;
            align-self: start;
          }

          .editor-standard-table tbody td:nth-child(5) {
            grid-column: 1 / span 4;
          }

          .editor-standard-table tbody td:nth-child(5)::before {
            content: "Est. Budget";
          }

          .editor-standard-table tbody td:nth-child(6) {
            grid-column: 5 / span 4;
          }

          .editor-standard-table tbody td:nth-child(6)::before {
            content: "Actual Cost";
          }

          .editor-standard-table tbody td:nth-child(7) {
            grid-column: 9 / -1;
          }

          .editor-standard-table tbody td:nth-child(7)::before {
            content: "Date";
          }

          .editor-standard-table tbody td:nth-child(8) {
            grid-column: 1 / -1;
          }

          .editor-standard-table tbody td:nth-child(8)::before,
          .editor-banking-table tbody td:nth-child(10)::before {
            content: "Actions";
          }

          .editor-standard-table tbody td:nth-child(8) > div,
          .editor-banking-table tbody td:nth-child(10) > div {
            gap: 4px;
          }

          .editor-banking-table tbody td:nth-child(5) {
            grid-column: 1 / span 6;
          }

          .editor-banking-table tbody td:nth-child(5)::before {
            content: "Minimum";
          }

          .editor-banking-table tbody td:nth-child(6) {
            grid-column: 7 / -1;
          }

          .editor-banking-table tbody td:nth-child(6)::before {
            content: "Balance";
          }

          .editor-banking-table tbody td:nth-child(7) {
            grid-column: 1 / span 6;
          }

          .editor-banking-table tbody td:nth-child(7)::before {
            content: "Actual Paid";
          }

          .editor-banking-table tbody td:nth-child(8) {
            grid-column: 7 / -1;
          }

          .editor-banking-table tbody td:nth-child(8)::before {
            content: "Available";
          }

          .editor-banking-table tbody td:nth-child(9) {
            grid-column: 1 / -1;
          }

          .editor-banking-table tbody td:nth-child(9)::before {
            content: "Due Date";
          }

          .editor-banking-table tbody td:nth-child(10) {
            grid-column: 1 / -1;
          }
        }
      `}</style>
      <section
        className="rounded-xl border border-cyan-200 bg-white p-3 shadow-sm lg:flex lg:items-center lg:justify-between lg:gap-4"
        aria-label="Budget editor filters"
      >
        <div className="min-w-0 pb-3 lg:pb-0">
          <p className="text-xs font-extrabold uppercase tracking-wide text-cyan-800">Editor filters</p>
          <p className="mt-0.5 max-w-2xl text-sm leading-5 text-slate-600">
            Manage categories, budget items, payment status, debt details, savings plans, and recurring dates.
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:grid-cols-4 lg:flex lg:flex-nowrap" role="group" aria-label="Filter budget items">
          {[
            { id: 'all', label: 'All', title: 'Show all budget items', icon: Package },
            { id: 'pending', label: 'Pending', title: 'Show pending budget items', icon: CalendarClock },
            { id: 'dueSoon', label: 'Due Soon', title: 'Show budget items due soon', icon: Clock },
            { id: 'overdue', label: 'Overdue', title: 'Show overdue budget items', icon: AlertCircle },
            { id: 'paid', label: 'Paid', title: 'Show paid budget items', icon: Save },
            { id: 'paused', label: 'Paused', title: 'Show paused budget items', icon: PauseCircle },
            { id: 'notPaying', label: 'Excluded', title: 'Show items excluded from the payment plan', icon: Ban },
          ].map((filter) => {
            const FilterIcon = filter.icon;
            const isActive = statusFilter === filter.id;

            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setStatusFilter(filter.id)}
                title={filter.title}
                aria-label={filter.title}
                aria-pressed={isActive}
                className={`inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 ${
                  isActive
                    ? 'border-cyan-700 bg-cyan-700 text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-900'
                }`}
              >
                <FilterIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap">{filter.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-3 mb-4 flex flex-col gap-3 rounded-xl border-2 border-lime-300 bg-gradient-to-r from-lime-50 to-emerald-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <PiggyBank className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" />
          <div>
            <h3 className="font-black text-emerald-950">Homelight Savings Plan</h3>
            <p className="text-xs font-semibold text-emerald-800 sm:text-sm">
              {homelightSavingsProgress.linkedCount} of {HOMELIGHT_SAVINGS_MONTHS.length} months linked · ${homelightSavingsProgress.totalSaved.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} saved
            </p>
            <p className="mt-1 text-xs text-emerald-800">
              Est. Budget is the contracted minimum. Enter the amount actually saved in Actual Cost.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={setupHomelightSavingsPlan}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white hover:bg-emerald-800"
        >
          <Plus className="h-4 w-4" />
          {homelightSavingsProgress.missingCount > 0
            ? `Add ${homelightSavingsProgress.missingCount} Missing Month${homelightSavingsProgress.missingCount === 1 ? '' : 's'}`
            : 'Refresh Plan Links'}
        </button>
      </section>

      {auntPersonalLoanRecord && (
        <section className="mb-4 flex flex-col gap-3 rounded-xl border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <DollarSign className="mt-0.5 h-6 w-6 shrink-0 text-blue-700" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-blue-950">Personal Loan from Aunt</h3>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-black ${
                    auntPersonalLoanRecord.item.repaymentStatus === 'active'
                      ? 'bg-green-100 text-green-800'
                      : auntPersonalLoanRecord.item.repaymentStatus === 'paidOff'
                        ? 'bg-slate-200 text-slate-800'
                        : 'bg-indigo-100 text-indigo-800'
                  }`}
                >
                  {getPersonalLoanStatusLabel(auntPersonalLoanRecord.item)}
                </span>
              </div>
              <p className="mt-1 text-sm font-bold text-blue-900">
                Remaining balance: {formatDebtCurrency(
                  auntPersonalLoanRecord.item.currentAmountOwed ||
                  auntPersonalLoanRecord.item.currentBalance
                )} · Interest: {getDebtNumber(auntPersonalLoanRecord.item.interestRate)}%
              </p>
              <p className="mt-1 text-xs text-blue-800">
                Purpose: {auntPersonalLoanRecord.item.loanPurpose || 'Car rear differential'}. The original repair expense remains separate, so the $2,365 is not counted twice.
              </p>
              {auntPersonalLoanRecord.item.repaymentStatus === 'active' ? (
                <p className="mt-1 text-xs font-semibold text-green-800">
                  {formatDebtCurrency(auntPersonalLoanRecord.item.paymentAmount)} {auntPersonalLoanRecord.item.repaymentFrequency || 'monthly'} · next due {auntPersonalLoanRecord.item.nextPaymentDate || auntPersonalLoanRecord.item.dueDate}
                </p>
              ) : auntPersonalLoanRecord.item.repaymentStatus !== 'paidOff' ? (
                <p className="mt-1 text-xs font-semibold text-indigo-800">
                  No payment amount or due date is active. This loan is excluded from totals and payment alerts until repayment starts.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openPersonalLoanEditor(
                auntPersonalLoanRecord.bucket,
                auntPersonalLoanRecord.item
              )}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-black text-white hover:bg-blue-800"
            >
              <Edit2 className="h-4 w-4" />
              {auntPersonalLoanRecord.item.repaymentStatus === 'notStarted'
                ? 'Start Repayment'
                : 'Manage Loan'}
            </button>
            {auntPersonalLoanRecord.item.repaymentStatus === 'active' && (
              <>
                <button
                  type="button"
                  onClick={() => openPersonalLoanEditor(
                    auntPersonalLoanRecord.bucket,
                    auntPersonalLoanRecord.item,
                    true
                  )}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-3 py-2 text-xs font-black text-white hover:bg-green-800"
                >
                  <DollarSign className="h-4 w-4" />
                  Record Payment
                </button>
                <button
                  type="button"
                  onClick={() => pausePersonalLoanRepayment(
                    auntPersonalLoanRecord.bucket,
                    auntPersonalLoanRecord.item
                  )}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-700 px-3 py-2 text-xs font-black text-white hover:bg-indigo-800"
                >
                  <PauseCircle className="h-4 w-4" />
                  Pause Repayment
                </button>
              </>
            )}
          </div>
        </section>
      )}

      <div className="mb-4 flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-semibold text-gray-800">Manage Categories & Items</h3>
            {selectedItems.size > 0 && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {selectedItems.size} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
              title="Quick Templates"
            >
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">Templates</span>
            </button>

            <button
              onClick={() => setBatchAddMode(!batchAddMode)}
              className={`flex items-center gap-2 px-3 py-2 rounded transition-colors text-sm ${
                batchAddMode
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
              }`}
              title="Batch Add Mode"
            >
              <ListPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Batch Add {batchAddMode && '(ON)'}</span>
            </button>

            <button
              onClick={() => setShowCreditReportScanner(true)}
              className="flex items-center gap-2 rounded bg-rose-700 px-3 py-2 text-sm font-bold text-white hover:bg-rose-800"
              title="Scan a credit report and review debt-account matches"
            >
              <ScanSearch className="h-4 w-4" />
              <span className="hidden sm:inline">Scan Credit Report</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSavedCreditReports((current) => !current)}
              className="flex items-center gap-2 rounded bg-indigo-700 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-800"
              title="View saved original credit reports"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Saved Reports ({savedCreditReports.length})</span>
            </button>

            {selectedItems.size > 0 && (
              <>
                <button
                  onClick={bulkRollForward}
                  className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 text-sm"
                  title="Roll Forward Selected"
                >
                  <CalendarClock className="w-4 h-4" />
                  <span className="hidden sm:inline">Roll Forward ({selectedItems.size})</span>
                </button>
                <button
                  onClick={bulkArchive}
                  className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
                  title="Archive Selected"
                >
                  <Archive className="w-4 h-4" />
                  <span className="hidden sm:inline">Archive ({selectedItems.size})</span>
                </button>
                <button
                  onClick={bulkDelete}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                  title="Delete Selected"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Delete ({selectedItems.size})</span>
                </button>
              </>
            )}
            <CollapseToggleButton
              action="collapse"
              onClick={collapseAll}
              title="Collapse all categories"
              ariaLabel="Collapse all budget categories"
            />
            <CollapseToggleButton
              action="expand"
              onClick={expandAll}
              title="Expand all categories"
              ariaLabel="Expand all budget categories"
            />
            <button
              onClick={addCategory}
              className="flex items-center gap-2 px-3 py-2 bg-black text-white rounded hover:bg-gray-900 text-sm"
              title="Add Category"
            >
              <FolderPlus className="w-4 h-4" />
              <span className="hidden lg:inline">Add Category</span>
            </button>
            <button
              onClick={deleteCategory}
              className="flex items-center gap-2 px-3 py-2 bg-gray-200 text-gray-900 rounded hover:bg-gray-300 text-sm"
              title="Delete Category (must be empty)"
            >
              <FolderMinus className="w-4 h-4" />
              <span className="hidden lg:inline">Delete Category</span>
            </button>
          </div>
        </div>
      </div>

      {showSavedCreditReports && (
        <section className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-black text-indigo-950">Saved Credit Reports</h3>
              <p className="mt-1 text-xs font-semibold text-indigo-800">
                Original files are stored separately. Budget data contains only file metadata and links.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSavedCreditReports(false)}
              className="rounded-lg p-2 text-indigo-800 hover:bg-indigo-100"
              aria-label="Close saved credit reports"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {savedCreditReports.length === 0 ? (
            <p className="mt-4 rounded-lg border border-indigo-100 bg-white p-4 text-sm font-semibold text-slate-600">
              No original credit reports have been saved yet.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {[...savedCreditReports].reverse().map((reportFile) => (
                <div key={reportFile.id} className="flex flex-col gap-3 rounded-lg border border-indigo-100 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate font-black text-slate-950">{reportFile.originalName}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {[
                        reportFile.bureau,
                        reportFile.reportDate ? `Report date ${reportFile.reportDate}` : '',
                        formatCreditReportFileSize(reportFile.size),
                        reportFile.uploadedAt ? `Saved ${new Date(reportFile.uploadedAt).toLocaleString()}` : '',
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <a
                      href={buildCreditReportFileUrl('view', reportFile)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-black text-white hover:bg-blue-800"
                    >
                      <FileText className="h-4 w-4" />
                      View
                    </a>
                    <a
                      href={buildCreditReportFileUrl('download', reportFile)}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-black text-white hover:bg-emerald-800"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => deleteSavedCreditReport(reportFile).catch((error) => alert(error.message))}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-700 px-3 py-2 text-xs font-black text-white hover:bg-red-800"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {batchAddMode && (
        <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-orange-900">Batch Add Mode - Quick Item Entry</h3>
            <button
              onClick={() => setBatchAddMode(false)}
              className="text-orange-600 hover:text-orange-800"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Category</label>
              <select
                value={batchAddCategory}
                onChange={(e) => setBatchAddCategory(e.target.value)}
                className="w-full p-2 border border-orange-200 rounded focus:ring-2 focus:ring-orange-500"
              >
                <option value="">-- Choose Category --</option>
                {categoryOrder.map(key => (
                  <option key={key} value={key}>
                    {categoryNames[key] || DEFAULT_TITLES[key] || key}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
              <input
                ref={batchItemNameRef}
                type="text"
                placeholder="Enter item name and press Enter"
                disabled={!batchAddCategory}
                onKeyDown={(e) => { if (e.key === 'Enter') addBatchItem(e); }}
                className="w-full p-2 border border-orange-200 rounded focus:ring-2 focus:ring-orange-500 disabled:bg-gray-100"
              />
            </div>
            <button
              onClick={addBatchItem}
              disabled={!batchAddCategory}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">Tip: Press Enter after typing item name to quickly add multiple items</p>
        </div>
      )}

      {showTemplates && (
        <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-indigo-900">Quick Templates</h3>
            <button
              onClick={() => setShowTemplates(false)}
              className="text-indigo-600 hover:text-indigo-800"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {ITEM_TEMPLATES.map((template, idx) => (
              <button
                key={idx}
                onClick={() => addFromTemplate(template)}
                className="p-3 bg-white border border-indigo-200 rounded hover:bg-indigo-100 text-left transition-colors"
              >
                <div className="font-medium text-sm text-gray-900">{template.name}</div>
                <div className="text-xs text-gray-600 mt-1">${template.estBudget.toFixed(2)}</div>
                <div className="text-xs text-indigo-600 mt-1 capitalize">{template.category}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {recentlyDeleted && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span className="text-sm text-red-800">Item deleted successfully!</span>
          <button
            onClick={undoDelete}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1 text-sm"
          >
            <Undo2 className="w-4 h-4" />
            Undelete
          </button>
        </div>
      )}

      {recentlyCleared && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded">
          <span className="text-sm text-green-800">Row bgcolor reset</span>
        </div>
      )}


      <CreditReportScanner
        isOpen={showCreditReportScanner}
        onClose={() => setShowCreditReportScanner(false)}
        state={state}
        onImport={handleCreditReportImport}
      />

      {personalLoanEditor && (
        <div className="fixed inset-0 z-[9998]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setPersonalLoanEditor(null)}
            aria-label="Close personal loan repayment"
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-700" />
                  <h2 className="text-xl font-black text-slate-950">Aunt Personal Loan</h2>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  Set repayment terms when affordable, record each payment, and track the remaining balance.
                </p>
              </div>
              <CloseScreenButton onClick={() => setPersonalLoanEditor(null)} />
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-blue-800">Current Loan Status</p>
                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold text-blue-700">Remaining balance</p>
                    <p className="text-xl font-black text-blue-950">
                      {formatDebtCurrency(
                        personalLoanEditor.item.currentAmountOwed ||
                        personalLoanEditor.item.currentBalance
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-blue-700">Repayment</p>
                    <p className="text-sm font-black text-blue-950">
                      {getPersonalLoanStatusLabel(personalLoanEditor.item)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-blue-700">Interest</p>
                    <p className="text-sm font-black text-blue-950">
                      {getDebtNumber(personalLoanEditor.item.interestRate)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-bold text-slate-700">
                  Lender
                  <input
                    value={personalLoanEditor.item.lender || ''}
                    onChange={(event) => updatePersonalLoanEditorField('lender', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Purpose
                  <input
                    value={personalLoanEditor.item.loanPurpose || ''}
                    onChange={(event) => updatePersonalLoanEditorField('loanPurpose', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Original Balance
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={personalLoanEditor.item.originalBalance ?? 2365}
                    onChange={(event) => updatePersonalLoanEditorField('originalBalance', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Remaining Balance
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={personalLoanEditor.item.currentAmountOwed ?? 2365}
                    onChange={(event) => updatePersonalLoanEditorField('currentAmountOwed', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Interest Rate
                  <div className="relative mt-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={personalLoanEditor.item.interestRate ?? 0}
                      onChange={(event) => updatePersonalLoanEditorField('interestRate', event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-8 text-sm"
                    />
                    <span className="pointer-events-none absolute right-3 top-2 text-sm font-bold text-slate-500">%</span>
                  </div>
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Repayment Status
                  <select
                    value={personalLoanEditor.item.repaymentStatus || 'notStarted'}
                    onChange={(event) => updatePersonalLoanEditorField('repaymentStatus', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="notStarted">Repayment not started</option>
                    <option value="active">Repayment active</option>
                    <option value="paused">Repayment paused</option>
                    <option value="paidOff">Paid off</option>
                  </select>
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Payment Amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={personalLoanEditor.item.paymentAmount ?? 0}
                    onChange={(event) => updatePersonalLoanEditorField('paymentAmount', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    placeholder="Enter when repayment starts"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Payment Frequency
                  <select
                    value={personalLoanEditor.item.repaymentFrequency || 'monthly'}
                    onChange={(event) => updatePersonalLoanEditorField('repaymentFrequency', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {PERSONAL_LOAN_FREQUENCIES.map((frequency) => (
                      <option key={frequency.value} value={frequency.value}>
                        {frequency.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-bold text-slate-700">
                  First Payment Date
                  <input
                    type="date"
                    value={personalLoanEditor.item.firstPaymentDate || ''}
                    onChange={(event) => {
                      updatePersonalLoanEditorField('firstPaymentDate', event.target.value);
                      if (!personalLoanEditor.item.nextPaymentDate) {
                        updatePersonalLoanEditorField('nextPaymentDate', event.target.value);
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Next Payment Date
                  <input
                    type="date"
                    value={personalLoanEditor.item.nextPaymentDate || ''}
                    onChange={(event) => updatePersonalLoanEditorField('nextPaymentDate', event.target.value)}
                    disabled={personalLoanEditor.item.repaymentStatus !== 'active'}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                  />
                </label>

                <label className="md:col-span-2 text-sm font-bold text-slate-700">
                  Loan Notes
                  <textarea
                    value={personalLoanEditor.item.debtStatusNotes || ''}
                    onChange={(event) => updatePersonalLoanEditorField('debtStatusNotes', event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              {personalLoanEditor.item.repaymentStatus === 'active' && (
                <section
                  className={`mt-6 rounded-xl border-2 p-4 ${
                    personalLoanEditor.focusPayment
                      ? 'border-green-400 bg-green-50'
                      : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <h3 className="font-black text-slate-950">Record a Payment</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Recording a payment reduces the remaining balance and advances the next due date.
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <label className="text-sm font-bold text-slate-700">
                      Amount
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        autoFocus={personalLoanEditor.focusPayment}
                        value={personalLoanEditor.paymentEntry?.amount ?? ''}
                        onChange={(event) => updatePersonalLoanPaymentEntry('amount', event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-sm font-bold text-slate-700">
                      Payment Date
                      <input
                        type="date"
                        value={personalLoanEditor.paymentEntry?.date || ''}
                        onChange={(event) => updatePersonalLoanPaymentEntry('date', event.target.value)}
                        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={recordPersonalLoanPayment}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-black text-white hover:bg-green-800"
                    >
                      <DollarSign className="h-4 w-4" />
                      Record Payment
                    </button>
                  </div>
                </section>
              )}

              <section className="mt-6">
                <h3 className="font-black text-slate-950">Payment History</h3>
                {Array.isArray(personalLoanEditor.item.loanPaymentHistory) &&
                personalLoanEditor.item.loanPaymentHistory.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {[...personalLoanEditor.item.loanPaymentHistory].reverse().map((payment) => (
                      <div
                        key={payment.id}
                        className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-black text-slate-900">
                            {formatDebtCurrency(payment.amount)}
                          </p>
                          <p className="text-xs text-slate-600">{payment.paymentDate}</p>
                        </div>
                        <p className="text-xs font-bold text-slate-700">
                          {formatDebtCurrency(payment.balanceAfter)} remaining
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                    No payments recorded yet.
                  </p>
                )}
              </section>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setPersonalLoanEditor(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePersonalLoanPlan}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-800"
              >
                <Save className="h-4 w-4" />
                Save Repayment Plan
              </button>
            </div>
          </aside>
        </div>
      )}

      {debtEditor && (
        <div className="fixed inset-0 z-[9998]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setDebtEditor(null)}
            aria-label="Close debt details"
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-700" />
                  <h2 className="text-xl font-black text-slate-950">Debt and Account Details</h2>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {debtEditor.item.category || 'Budget item'} · track amount owed, delinquency, closure, collections, settlement, and account history.
                </p>
              </div>
              <CloseScreenButton onClick={() => setDebtEditor(null)} />
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-bold text-slate-700">
                  Account Status
                  <select
                    value={debtEditor.item.accountStatus || ''}
                    onChange={(event) => updateDebtEditorField('accountStatus', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Not specified</option>
                    {ACCOUNT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Current Amount Owed
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={debtEditor.item.currentAmountOwed ?? 0}
                    onChange={(event) => updateDebtEditorField('currentAmountOwed', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Past-Due Amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={debtEditor.item.pastDueAmount ?? 0}
                    onChange={(event) => updateDebtEditorField('pastDueAmount', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Original Balance
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={debtEditor.item.originalBalance ?? 0}
                    onChange={(event) => updateDebtEditorField('originalBalance', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Last Payment Date
                  <input
                    type="date"
                    value={debtEditor.item.lastPaymentDate || ''}
                    onChange={(event) => updateDebtEditorField('lastPaymentDate', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Delinquent Since
                  <input
                    type="date"
                    value={debtEditor.item.delinquentSince || ''}
                    onChange={(event) => updateDebtEditorField('delinquentSince', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-800">Days Delinquent</p>
                  <p className="mt-1 text-2xl font-black text-amber-950">
                    {getDebtDaysDelinquent(debtEditor.item)}
                  </p>
                </div>

                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-orange-800">Delinquency Stage</p>
                  <p className="mt-1 text-xl font-black text-orange-950">
                    {getDelinquencyStage(getDebtDaysDelinquent(debtEditor.item))}
                  </p>
                </div>

                <label className="text-sm font-bold text-slate-700">
                  Collection Agency
                  <input
                    value={debtEditor.item.collectionAgency || ''}
                    onChange={(event) => updateDebtEditorField('collectionAgency', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Date Sent to Collections
                  <input
                    type="date"
                    value={debtEditor.item.sentToCollectionsDate || ''}
                    onChange={(event) => updateDebtEditorField('sentToCollectionsDate', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Original Creditor
                  <input
                    value={debtEditor.item.originalCreditor || ''}
                    onChange={(event) => updateDebtEditorField('originalCreditor', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Account Number, Last 4
                  <input
                    inputMode="numeric"
                    maxLength={4}
                    value={debtEditor.item.accountLast4 || ''}
                    onChange={(event) => updateDebtEditorField('accountLast4', event.target.value.replace(/\D/g, '').slice(-4))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Settlement Amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={debtEditor.item.settlementAmount ?? 0}
                    onChange={(event) => updateDebtEditorField('settlementAmount', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-rose-800">Payment Plan Decision</p>
                  <p className="mt-1 text-sm font-black text-rose-950">
                    {debtEditor.item.status === 'notPaying'
                      ? 'Excluded from active payment plan'
                      : debtEditor.item.status === 'paused'
                        ? 'Temporarily paused'
                        : 'Included in active payment plan'}
                  </p>
                  {debtEditor.item.notPayingReason && (
                    <p className="mt-1 text-xs font-semibold text-rose-800">{debtEditor.item.notPayingReason}</p>
                  )}
                  {debtEditor.item.pausedReason && (
                    <p className="mt-1 text-xs font-semibold text-indigo-800">{debtEditor.item.pausedReason}</p>
                  )}
                </div>

                <label className="md:col-span-2 text-sm font-bold text-slate-700">
                  Status Notes
                  <textarea
                    value={debtEditor.item.debtStatusNotes || ''}
                    onChange={(event) => updateDebtEditorField('debtStatusNotes', event.target.value)}
                    rows={4}
                    placeholder="Add collection contacts, settlement discussions, dispute details, closure notes, or bankruptcy-related notes."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setDebtEditor(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveDebtDetails}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-black text-white hover:bg-amber-700"
              >
                <Save className="h-4 w-4" />
                Save Debt Details
              </button>
            </div>
          </aside>
        </div>
      )}

      {categoryOrder.map(key => {
        if (!state.buckets[key]) return null;
        const title = DEFAULT_TITLES[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
        return (
          <BucketSection
            key={key}
            bucketName={key}
            items={state.buckets[key]}
            title={title}
          />
        );
      })}
    </PageContainer>
  );
};

export default EditorTab;
