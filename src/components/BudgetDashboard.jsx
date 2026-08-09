import React, { useState, useEffect, useMemo } from 'react';
import { initializeState, saveToServer } from '../utils/state.js';
import LoadingGate from './common/LoadingGate';
import PageContainer from './common/PageContainer';
import DashboardTab from './tabs/DashboardTab';
import EditorTab from './tabs/EditorTab';
import AnalysisTab from './tabs/AnalysisTab';
import CalculatorTab from './tabs/CalculatorTab';
import TodoTab from './tabs/TodoTab';
import RidesTab from './tabs/RidesTab';
import CscShiftsTab from './tabs/CscShiftsTab';
import CscOpportunitiesTab from './tabs/CscOpportunitiesTab';
import PaychecksTab from './tabs/PaychecksTab';
import ArchivedDrawer from './ui/ArchivedDrawer';
import StickyToolbar from './common/StickyToolbar.jsx';
import TabPageHeader from './common/TabPageHeader.jsx';
import StatementScanner from './statements/StatementScanner';
import NotificationPanel from './modern/NotificationPanel';
import CloseScreenButton from './common/CloseScreenButton.jsx';
import { formatPhoneNumber } from '../utils/phone';
import {
  Search,
  X,
  WalletCards,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Archive,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Car,
  CircleDollarSign,
  ListTodo,
  LayoutDashboard,
  Pencil,
  Calculator,
  Menu,
  Monitor,
} from 'lucide-react';

const TODO_STORAGE_KEY = 'todoTab.tasks.v1';
const TODO_ARCHIVE_STORAGE_KEY = 'todoTab.tasks.archived.v1';
const TODO_CONTACTS_STORAGE_KEY = 'todoTab.contacts.v1';
const RIDES_ARCHIVE_STORAGE_KEY = 'modivcareRides.archived.v1';
const RIDES_STORAGE_EVENT = 'modivcareRides:updated';
const PAYCHECK_ARCHIVE_STORAGE_KEY = 'paychecksTab.archived.v1';
const PAYCHECK_STORAGE_EVENT = 'paychecksChanged';

const getTodoTaskType = (task = {}) => task.typeOverride || task.type || '';

const isExplicitInsuranceOrDmvTask = (task = {}) => {
  const type = getTodoTaskType(task);
  return type === 'Insurance' || type === 'DMV / Vehicle';
};

const createTodoId = (prefix = 'task') => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const isCombinedInsuranceDmvTask = (task = {}) => {
  const text = [
    task.taskName,
    task.details,
    task.notes,
    task.requiredAction,
    task.impact,
    task.company,
    task.policyStatus,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const hasInsurance = /(insurance|caarp|aipso|integon|policy|carrier|naic|producer|coverage)/i.test(text);
  const hasDmv = /(dmv|registration|reg due|renewal|suspension|plate|vin|vehicle)/i.test(text);

  return hasInsurance && hasDmv;
};

const splitInsuranceDmvTask = (task = {}) => {
  const insuranceId = createTodoId('insurance');
  const dmvId = createTodoId('dmv');

  const insuranceNotes = [
    task.notes,
    'Wait 2-3 business days from 05/06/2026 for AIPSO insurer assignment.',
    'Need assigned insurer name and NAIC before DMV submission if online form requires NAIC.',
    task.company ? `Company: ${task.company}` : '',
    task.policyNumber ? `Policy #: ${task.policyNumber}` : '',
    task.policyStatus ? `Policy status: ${task.policyStatus}` : '',
    task.effectiveDate ? `Effective date: ${task.effectiveDate}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const dmvNotes = [
    'Submit insurance proof after assigned insurer and NAIC are confirmed.',
    task.notes && !/aipso|naic|insurance|carrier|policy/i.test(task.notes) ? task.notes : '',
  ]
    .filter(Boolean)
    .join('\n');

  const insuranceTask = {
    ...task,
    id: insuranceId,
    taskName: 'Resolve Auto Insurance Assignment',
    type: 'Insurance',
    date: '',
    deadline: task.effectiveDate || task.deadline || '',
    completed: false,
    completedAt: '',
    blockedBy: '',
    notes: insuranceNotes,
  };

  const dmvTask = {
    ...task,
    id: dmvId,
    taskName: 'Complete DMV Registration Renewal',
    type: 'DMV / Vehicle',
    company: '',
    policyNumber: '',
    policyStatus: '',
    effectiveDate: '',
    completed: false,
    completedAt: '',
    blockedBy: insuranceId,
    notes: dmvNotes,
  };

  return [insuranceTask, dmvTask];
};

const normalizeTodoTaskList = (tasks = []) => {
  const normalizedTasks = [];
  let changed = false;

  tasks.forEach((task) => {
    if (!task || typeof task !== 'object') return;

    if (!isExplicitInsuranceOrDmvTask(task) && isCombinedInsuranceDmvTask(task)) {
      const alreadyHasInsurance = tasks.some(
        (item) => item?.id !== task.id && item?.type === 'Insurance' && /auto insurance|insurance assignment/i.test(item?.taskName || '')
      );
      const alreadyHasDmv = tasks.some(
        (item) => item?.id !== task.id && item?.type === 'DMV / Vehicle' && /dmv|registration renewal/i.test(item?.taskName || '')
      );

      if (!alreadyHasInsurance && !alreadyHasDmv) {
        normalizedTasks.push(...splitInsuranceDmvTask(task));
        changed = true;
        return;
      }
    }

    normalizedTasks.push(task);
  });

  return { tasks: normalizedTasks, changed };
};

const readTodoTasks = () => {
  try {
    const saved = localStorage.getItem(TODO_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    const baseTasks = Array.isArray(parsed) ? parsed : [];
    const archivedTasks = readTodoArchivedTasks();
    const archivedIds = new Set(archivedTasks.map((task) => task?.id).filter(Boolean));
    const activeTasks = baseTasks.filter((task) => task?.id && !archivedIds.has(task.id));
    const normalized = normalizeTodoTaskList(activeTasks);

    if (normalized.changed || activeTasks.length !== baseTasks.length) {
      localStorage.setItem('todoTab.tasks.backup.v1', JSON.stringify(baseTasks));
      localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(normalized.tasks));
    }

    return normalized.tasks;
  } catch {
    return [];
  }
};

const readTodoArchivedTasks = () => {
  try {
    const saved = localStorage.getItem(TODO_ARCHIVE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeTodoArchivedTasks = (tasks) => {
  try {
    localStorage.setItem(TODO_ARCHIVE_STORAGE_KEY, JSON.stringify(Array.isArray(tasks) ? tasks : []));
  } catch (error) {
    console.error('Failed to save archived to-do tasks:', error);
  }
};

const appendArchivedTodoTask = (task) => {
  try {
    const archivedTasks = readTodoArchivedTasks();
    const archivedTask = {
      ...task,
      archivedAt: new Date().toISOString(),
    };
    const updatedArchivedTasks = [archivedTask, ...archivedTasks];
    writeTodoArchivedTasks(updatedArchivedTasks);
    return updatedArchivedTasks;
  } catch (error) {
    console.error('Failed to archive to-do task:', error);
    return readTodoArchivedTasks();
  }
};

const writeTodoTasks = (tasks) => {
  try {
    const current = localStorage.getItem(TODO_STORAGE_KEY);
    const normalized = normalizeTodoTaskList(Array.isArray(tasks) ? tasks : []);

    if (current) {
      localStorage.setItem('todoTab.tasks.backup.v1', current);
    }

    localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(normalized.tasks));
  } catch (error) {
    console.error('Failed to save to-do tasks:', error);
  }
};

const normalizeScannerContact = (contact = {}) => {
  const now = new Date().toISOString();
  const name = String(contact.name || contact.organization || contact.company || contact.person || 'Scanned Card').trim();

  return {
    id: contact.id || createTodoId('contact'),
    name: name || 'Scanned Card',
    category: contact.category || 'General',
    phone: formatPhoneNumber(contact.phone || ''),
    directPhone: formatPhoneNumber(contact.directPhone || ''),
    website: contact.website || '',
    address: contact.address || '',
    organization: contact.organization || '',
    company: contact.company || contact.organization || '',
    person: contact.person || '',
    notes: contact.notes || '',
    createdAt: contact.createdAt || now,
    updatedAt: now,
  };
};

const readTodoContacts = () => {
  try {
    const saved = localStorage.getItem(TODO_CONTACTS_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeTodoContacts = (contacts) => {
  try {
    localStorage.setItem(
      TODO_CONTACTS_STORAGE_KEY,
      JSON.stringify(Array.isArray(contacts) ? contacts.map(normalizeScannerContact) : [])
    );
  } catch (error) {
    console.error('Failed to save to-do contacts:', error);
  }
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed);
};

const startOfToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getDaysUntil = (value) => {
  const date = parseDate(value);
  if (!date) return null;

  const today = startOfToday();
  date.setHours(0, 0, 0, 0);

  return Math.ceil((date.getTime() - today.getTime()) / 86400000);
};

const flattenBudgetItems = (state) => {
  if (!state?.buckets) return [];

  return Object.entries(state.buckets).flatMap(([bucketKey, items]) =>
    Array.isArray(items)
      ? items.map((item) => ({
          ...item,
          bucketKey,
        }))
      : []
  );
};

const getBudgetOverview = (state) => {
  const items = flattenBudgetItems(state);

  const totalItems = items.length;
  const paidItems = items.filter((item) => item.status === 'paid').length;
  const pendingItems = items.filter((item) => item.status !== 'paid').length;

  const overdueItems = items.filter((item) => {
    if (item.status === 'paid') return false;
    const days = getDaysUntil(item.dueDate);
    return days !== null && days < 0;
  }).length;

  const dueSoonItems = items.filter((item) => {
    if (item.status === 'paid') return false;
    const days = getDaysUntil(item.dueDate);
    return days !== null && days >= 0 && days <= 5;
  }).length;

  const totalEstimated = items.reduce(
    (sum, item) => sum + Number(item.estimatedBudget || item.estimatedCost || 0),
    0
  );

  const totalActual = items.reduce(
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
};

const getTodoOverview = (todoTasks) => {
  const total = todoTasks.length;
  const completed = todoTasks.filter((task) => task.completed).length;
  const open = todoTasks.filter((task) => !task.completed).length;
  const blocked = todoTasks.filter((task) => task.blockedBy && !task.completed).length;

  const overdue = todoTasks.filter((task) => {
    if (task.completed) return false;
    const days = getDaysUntil(task.deadline || task.date);
    return days !== null && days < 0;
  }).length;

  const dueSoon = todoTasks.filter((task) => {
    if (task.completed) return false;
    const days = getDaysUntil(task.deadline || task.date);
    return days !== null && days >= 0 && days <= 5;
  }).length;

  return {
    total,
    completed,
    open,
    blocked,
    overdue,
    dueSoon,
  };
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));

const OverviewCard = ({ title, value, detail, icon: Icon, className }) => (
  <div className={`rounded-2xl border p-4 shadow-sm ${className}`}>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-2xl font-extrabold">{value}</p>
        {detail && <p className="mt-1 text-xs opacity-80">{detail}</p>}
      </div>
      <Icon className="h-8 w-8 opacity-80" />
    </div>
  </div>
);

const DashboardOverviewStrip = ({ state, onNavigateToTab }) => {
  const budget = useMemo(() => getBudgetOverview(state), [state]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Budget Overview</h2>
          <p className="text-sm text-slate-600">
            Budget status, due dates, saved items, and spending totals.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onNavigateToTab('editor')}
            title="View budget items"
            className="group relative flex items-center gap-2 rounded-full border border-blue-300 bg-blue-100 px-4 py-2 text-sm font-bold text-blue-800 shadow-sm transition-all hover:bg-blue-200 active:scale-95"
          >
            <BarChart3 className="h-4 w-4" />
            <span>{budget.totalItems} items</span>

            {budget.overdueItems > 0 && (
              <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                {budget.overdueItems}
              </span>
            )}

            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
              View budget items
            </span>
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <OverviewCard
          title="Budget Items"
          value={budget.totalItems}
          detail={`${budget.pendingItems} pending · ${budget.paidItems} paid`}
          icon={WalletCards}
          className="border-blue-200 bg-blue-50 text-blue-950"
        />

        <OverviewCard
          title="Overdue"
          value={budget.overdueItems}
          detail="Budget items past due"
          icon={AlertTriangle}
          className="border-red-200 bg-red-50 text-red-950"
        />

        <OverviewCard
          title="Due Soon"
          value={budget.dueSoonItems}
          detail="Budget items due within 5 days"
          icon={Clock}
          className="border-amber-200 bg-amber-50 text-amber-950"
        />

        <OverviewCard
          title="Paid Items"
          value={budget.paidItems}
          detail={`${budget.pendingItems} still pending`}
          icon={CheckCircle2}
          className="border-emerald-200 bg-emerald-50 text-emerald-950"
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            <h3 className="font-extrabold">Archived Budget Items</h3>
          </div>
          <p className="mt-2 text-2xl font-extrabold">{budget.archivedItems}</p>
          <p className="text-sm text-slate-600">Stored in the budget archive drawer.</p>
        </div>

        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-950">
          <h3 className="font-extrabold">Budget Totals</h3>
          <p className="mt-2 text-sm">
            Estimated: <span className="font-extrabold">{formatCurrency(budget.totalEstimated)}</span>
          </p>
          <p className="text-sm">
            Actual: <span className="font-extrabold">{formatCurrency(budget.totalActual)}</span>
          </p>
        </div>
      </div>
    </section>
  );
};

const BudgetDashboard = () => {
  const [state, setState] = useState(null);
  const [activeTab, setActiveTab] = useState('todo');
  const [activeBudgetTab, setActiveBudgetTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isBudgetArchiveDrawerOpen, setIsBudgetArchiveDrawerOpen] = useState(false);
  const [isStatementScannerOpen, setIsStatementScannerOpen] = useState(false);
  const [todoRefreshKey, setTodoRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFilename, setExportFilename] = useState('budget-data');
  const [todoEditTaskId, setTodoEditTaskId] = useState('');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [, setToolbarRefreshKey] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const initialState = await initializeState();
        if (mounted) setState(initialState);
      } catch (err) {
        console.error('Error initializing app:', err);
        if (mounted) {
          setState({
            buckets: {
              income: [],
              housing: [],
              transportation: [],
              food: [],
              personal: [],
              homeOffice: [],
              banking: [],
              subscriptions: [],
              misc: [],
            },
            archived: [],
          });
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const refreshToolbarCounts = () => setToolbarRefreshKey((current) => current + 1);

    window.addEventListener(RIDES_STORAGE_EVENT, refreshToolbarCounts);
    window.addEventListener(PAYCHECK_STORAGE_EVENT, refreshToolbarCounts);
    window.addEventListener('storage', refreshToolbarCounts);

    return () => {
      window.removeEventListener(RIDES_STORAGE_EVENT, refreshToolbarCounts);
      window.removeEventListener(PAYCHECK_STORAGE_EVENT, refreshToolbarCounts);
      window.removeEventListener('storage', refreshToolbarCounts);
    };
  }, []);

  useEffect(() => {
    const handleAppNavigate = (event) => {
      const detail = event?.detail || {};
      const tab = String(detail.tab || '').trim();
      const recordId = String(detail.recordId || '').trim();
      const validTabs = new Set(['todo', 'rides', 'cscShifts', 'cscOpportunities', 'paychecks', 'budget']);

      if (!validTabs.has(tab)) return;

      setSearchQuery('');

      if (tab === 'budget') {
        setActiveBudgetTab(detail.budgetTab || 'overview');
      }

      if (tab === 'todo') {
        setTodoEditTaskId(recordId);
        setTodoRefreshKey((current) => current + 1);
      }

      try {
        if (tab === 'cscShifts' && recordId) {
          sessionStorage.setItem('cscShifts.openLinkedShiftId.v1', recordId);
        }

        if (tab === 'rides' && recordId) {
          sessionStorage.setItem('modivcareRides.openLinkedRideId.v1', recordId);
        }

        if (tab === 'cscOpportunities' && recordId) {
          sessionStorage.setItem('cscOpportunities.openLinkedOpportunityId.v1', recordId);
        }
      } catch (error) {
        console.error('Failed to queue cross-tab navigation:', error);
      }

      setActiveTab(tab);
    };

    window.addEventListener('app:navigate', handleAppNavigate);

    return () => {
      window.removeEventListener('app:navigate', handleAppNavigate);
    };
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsMobileNavOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileNavOpen]);

  const tabs = useMemo(
    () => [
      {
        id: 'todo',
        label: 'To-Do',
        icon: ListTodo,
        bgColor: 'bg-lime-100',
        activeClass: 'bg-gradient-to-r from-emerald-900 via-emerald-700 to-teal-700 text-white border-emerald-500 shadow-md shadow-emerald-300/40',
        inactiveClass: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200 hover:border-slate-300 hover:shadow-sm',
      },
      {
        id: 'rides',
        label: 'Rides',
        icon: Car,
        bgColor: 'bg-sky-50',
        activeClass: 'bg-gradient-to-r from-sky-900 via-sky-700 to-cyan-700 text-white border-sky-500 shadow-md shadow-sky-300/40',
        inactiveClass: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200 hover:border-slate-300 hover:shadow-sm',
      },
      {
        id: 'cscShifts',
        label: 'CSC Shifts',
        icon: BriefcaseBusiness,
        bgColor: 'bg-yellow-100',
        activeClass: 'bg-gradient-to-r from-amber-900 via-amber-700 to-orange-700 text-white border-amber-500 shadow-md shadow-amber-300/40',
        inactiveClass: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200 hover:border-slate-300 hover:shadow-sm',
      },
      {
        id: 'cscOpportunities',
        label: 'CSC Opps',
        icon: CalendarDays,
        bgColor: 'bg-indigo-50',
        activeClass: 'bg-gradient-to-r from-violet-900 via-purple-700 to-fuchsia-700 text-white border-violet-500 shadow-md shadow-violet-300/40',
        inactiveClass: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200 hover:border-slate-300 hover:shadow-sm',
      },
      {
        id: 'paychecks',
        label: 'Paychecks',
        icon: CircleDollarSign,
        bgColor: 'bg-slate-50',
        activeClass: 'bg-gradient-to-r from-teal-900 via-teal-700 to-emerald-700 text-white border-teal-500 shadow-md shadow-teal-300/40',
        inactiveClass: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200 hover:border-slate-300 hover:shadow-sm',
      },
      {
        id: 'budget',
        label: 'Budget',
        icon: WalletCards,
        bgColor: 'bg-blue-100',
        activeClass: 'bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-700 text-white border-blue-500 shadow-md shadow-blue-300/40',
        inactiveClass: 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200 hover:border-slate-300 hover:shadow-sm',
      },
    ],
    []
  );

  const budgetTabs = useMemo(
    () => [
      { id: 'overview', label: 'Overview', inactiveClass: 'bg-blue-50 text-blue-900 hover:bg-blue-100' },
      { id: 'editor', label: 'Editor', inactiveClass: 'bg-indigo-50 text-indigo-900 hover:bg-indigo-100' },
      { id: 'analysis', label: 'Analysis', inactiveClass: 'bg-purple-50 text-purple-900 hover:bg-purple-100' },
      { id: 'calculator', label: 'Calculator', inactiveClass: 'bg-green-50 text-green-900 hover:bg-green-100' },
    ],
    []
  );

  const activeTabConfig = useMemo(
    () => tabs.find((t) => t.id === activeTab),
    [tabs, activeTab]
  );

  const activeContentBackgroundClass =
    activeTab === 'budget'
      ? activeBudgetTab === 'overview'
        ? 'bg-blue-50'
        : activeBudgetTab === 'analysis'
          ? 'bg-cyan-50'
          : activeBudgetTab === 'calculator'
            ? 'bg-amber-50'
            : 'bg-blue-100'
      : activeTabConfig?.bgColor || 'bg-white';

  const activeBudgetTabClass =
    activeBudgetTab === 'editor'
      ? 'bg-gradient-to-r from-indigo-900 via-indigo-700 to-violet-700 text-white border-indigo-500 shadow-md shadow-indigo-300/40'
      : activeBudgetTab === 'analysis'
        ? 'bg-gradient-to-r from-cyan-900 via-cyan-700 to-blue-700 text-white border-cyan-500 shadow-md shadow-cyan-300/40'
        : activeBudgetTab === 'calculator'
          ? 'bg-gradient-to-r from-amber-900 via-amber-700 to-orange-700 text-white border-amber-500 shadow-md shadow-amber-300/40'
          : 'bg-gradient-to-r from-blue-900 via-blue-700 to-indigo-700 text-white border-blue-500 shadow-md shadow-blue-300/40';

  const budgetSubnavIcons = {
    overview: LayoutDashboard,
    editor: Pencil,
    analysis: BarChart3,
    calculator: Calculator,
  };

  const renderBudgetSubnav = () => (
    <div className="budget-mobile-subnav inline-flex max-w-full flex-nowrap items-center gap-2">
      {budgetTabs.map((tab) => {
        const TabIcon = budgetSubnavIcons[tab.id] || WalletCards;

        return (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActiveBudgetTab(tab.id)}
          title={`Open Budget ${tab.label}`}
          aria-label={`Open Budget ${tab.label}`}
          className={`budget-mobile-subnav-button inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors ${
            activeBudgetTab === tab.id
              ? 'bg-blue-700 text-white shadow-sm'
              : tab.inactiveClass
          }`}
          aria-pressed={activeBudgetTab === tab.id}
        >
          <TabIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {tab.label}
        </button>
        );
      })}
    </div>
  );

  const renderBudgetToolHeader = (title, description, theme, Icon) => (
    <PageContainer className="budget-tool-header-shell py-6">
      <TabPageHeader
        icon={Icon}
        title={title}
        subtitle={description}
        theme={theme}
        actions={renderBudgetSubnav()}
        className="budget-mobile-header"
      />
    </PageContainer>
  );

  const saveBudget = async (customState = null, customMessage = null) => {
    setIsSaving(true);
    setSaveStatus(null);

    try {
      const result = await saveToServer(customState || state);

      if (customMessage !== false) {
        setSaveStatus(
          result?.success
            ? { type: 'success', message: customMessage || 'Budget saved successfully!' }
            : { type: 'error', message: result?.error || 'Save failed' }
        );
      }
    } catch {
      setSaveStatus({ type: 'error', message: 'Failed to save budget' });
    } finally {
      setIsSaving(false);

      if (customMessage !== false) {
        setTimeout(() => setSaveStatus(null), 3000);
      }
    }
  };

  const openBudgetTool = (toolId = 'overview') => {
    setActiveTab('budget');
    setActiveBudgetTab(toolId);
  };

  const handleStatementImport = (budgetItems) => {
    const updatedBuckets = { ...state.buckets };

    budgetItems.forEach(({ categoryKey, item }) => {
      if (updatedBuckets[categoryKey]) {
        updatedBuckets[categoryKey] = [...updatedBuckets[categoryKey], item];
      } else {
        updatedBuckets.misc = [...(updatedBuckets.misc || []), item];
      }
    });

    const updatedState = { ...state, buckets: updatedBuckets };
    setState(updatedState);
    saveBudget(updatedState, `Successfully imported ${budgetItems.length} transactions!`);
  };


  const handleScannerTodoCreate = (taskData = {}) => {
    const now = new Date().toISOString();
    const taskType = taskData.typeOverride || taskData.type || 'General';
    const scannedTask = {
      id: createTodoId('scan'),
      taskName: taskData.taskName || 'Review Scanned Document',
      details: taskData.details || '',
      type: taskType,
      typeOverride: taskType,
      date: taskData.date || now.slice(0, 10),
      phone: formatPhoneNumber(taskData.phone || ''),
      address: taskData.address || '',
      deadline: taskData.deadline || '',
      blockedBy: taskData.blockedBy || '',
      person: taskData.person || '',
      organization: taskData.organization || '',
      website: taskData.website || '',
      plate: taskData.plate || '',
      vin: taskData.vin || '',
      policyNumber: taskData.policyNumber || '',
      caseNumber: taskData.caseNumber || '',
      amount: taskData.amount || '',
      documents: taskData.documents || '',
      questions: taskData.questions || '',
      outcome: taskData.outcome || '',
      fileName: taskData.fileName || '',
      notes: taskData.notes || '',
      followUpNotes: taskData.followUpNotes || '',
      company: taskData.company || '',
      vehicle: taskData.vehicle || '',
      policyStatus: taskData.policyStatus || '',
      effectiveDate: taskData.effectiveDate || '',
      impact: taskData.impact || '',
      requiredAction: taskData.requiredAction || '',
      systemLink: taskData.systemLink || '',
      completed: false,
      completedAt: '',
      createdAt: now,
      history: [
        {
          id: createTodoId('history'),
          action: 'Task created from scanner',
          detail: taskData.documents || '',
          createdAt: now,
        },
      ],
    };

    const updatedTasks = [scannedTask, ...readTodoTasks()];
    writeTodoTasks(updatedTasks);
    setTodoRefreshKey((current) => current + 1);
    setActiveTab('todo');
    setSaveStatus({ type: 'success', message: 'Scanned document added to To-Do.' });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleScannerContactSave = (contactData = {}) => {
    const contact = normalizeScannerContact(contactData);
    const existingContacts = readTodoContacts();
    const updatedContacts = [contact, ...existingContacts.filter((item) => item?.id !== contact.id)];

    writeTodoContacts(updatedContacts);
    setTodoRefreshKey((current) => current + 1);
    setActiveTab('todo');
    setSaveStatus({ type: 'success', message: 'Scanned card saved to Manage Contacts.' });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleRestoreArchived = (id) => {
    const idx = state?.archived?.findIndex((i) => i.id === id);
    if (idx === -1 || idx === undefined) return;

    const archivedItem = state.archived[idx];
    const { originalBucket, archivedAt, ...restoredItem } = archivedItem;

    const updatedBuckets = {
      ...state.buckets,
      [originalBucket]: [...(state.buckets[originalBucket] || []), restoredItem],
    };

    const updatedArchived = state.archived.filter((_, i) => i !== idx);
    const updatedState = { ...state, buckets: updatedBuckets, archived: updatedArchived };

    setState(updatedState);
    saveBudget(updatedState, 'Item restored successfully!');
  };

  const handleDeleteArchived = (id) => {
    if (!confirm('Permanently delete this archived item?')) return;

    const updatedArchived = state?.archived?.filter((i) => i.id !== id) || [];
    const updatedState = { ...state, archived: updatedArchived };

    setState(updatedState);
    saveBudget(updatedState, 'Archived item deleted permanently!');
  };

  const handleMarkPaidFromNotification = (bucket, id) => {
    const item = state.buckets[bucket]?.find((budgetItem) => budgetItem.id === id);
    if (!item) return;

    const previousState = {
      dueDate: item.dueDate,
      status: item.status,
      actualCost: item.actualCost,
    };

    const updatedBuckets = {
      ...state.buckets,
      [bucket]: state.buckets[bucket].map((it) =>
        it.id === id ? { ...it, status: 'paid', previousState } : it
      ),
    };

    const updatedState = { ...state, buckets: updatedBuckets };

    setState(updatedState);
    saveBudget(updatedState, 'Item marked as paid!');
  };

  const handleBudgetExportJSON = () => {
    const filename = exportFilename.trim() || 'budget-data';
    const dataStr = JSON.stringify(state, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${filename}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    setShowExportDialog(false);
    setSaveStatus({ type: 'success', message: `Exported ${filename}.json` });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleFullDashboardExportJSON = () => {
    if (typeof localStorage === 'undefined') {
      setSaveStatus({ type: 'error', message: 'Export failed: browser storage is unavailable.' });
      setTimeout(() => setSaveStatus(null), 3000);
      return;
    }

    try {
      const items = {};

      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);

        if (
          !key ||
          key === 'budgetMobileSync.keyMeta.v1' ||
          key.startsWith('budgetMobileSync.') ||
          key.startsWith('googleCalendar.') ||
          /(?:accessToken|tokenExpiresAt|openLinked|returnContext|createDraft)/i.test(key)
        ) {
          continue;
        }

        items[key] = localStorage.getItem(key);
      }

      if (state) {
        items['budget-dashboard-state-v2'] = JSON.stringify(state);
      }

      const exportedAt = new Date().toISOString();
      const exportData = {
        type: 'budget-dashboard-mobile-migration',
        version: 1,
        exportedAt,
        items,
      };
      const filename = `budget-dashboard-mobile-data-${exportedAt.slice(0, 10)}.json`;
      const dataBlob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      setSaveStatus({
        type: 'success',
        message: `Exported ${Object.keys(items).length} dashboard data items.`,
      });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      setSaveStatus({ type: 'error', message: `Export failed: ${error.message}` });
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleBudgetSafetySnapshot = () => {
    const now = new Date();
    const stamp = now
      .toISOString()
      .slice(0, 16)
      .replace(/-/g, '')
      .replace(/:/g, '')
      .replace(/T/g, '');
    const filename = `budget-safety-snapshot-${stamp}.json`;
    const snapshot = {
      createdAt: now.toISOString(),
      type: 'budget-safety-snapshot',
      state,
    };
    const dataStr = JSON.stringify(snapshot, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    setSaveStatus({ type: 'success', message: 'Budget safety snapshot downloaded.' });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleImportJSON = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);

        if (!imported.buckets || !imported.archived) {
          throw new Error('Invalid budget file format');
        }

        setState(imported);
        saveBudget(imported, 'Budget imported successfully!');
      } catch (error) {
        setSaveStatus({ type: 'error', message: `Import failed: ${error.message}` });
        setTimeout(() => setSaveStatus(null), 3000);
      }
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  const dispatchToolbarEvent = (eventName) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(eventName));
  };

  const printActiveTab = () => {
    if (typeof window === 'undefined') return;

    if (activeTab === 'rides') {
      dispatchToolbarEvent('rides-toolbar:print');
      return;
    }

    if (activeTab === 'cscOpportunities') {
      dispatchToolbarEvent('csc-opportunities-toolbar:print');
      return;
    }

    window.print();
  };

  const openPaychecksAction = (buttonLabel) => {
    if (typeof document === 'undefined') return;

    const normalizedLabel = String(buttonLabel || '').trim().toLowerCase();
    const matchingButton = Array.from(document.querySelectorAll('button')).find(
      (button) => String(button.textContent || '').trim().toLowerCase() === normalizedLabel
    );

    if (matchingButton) {
      matchingButton.click();
      matchingButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setSaveStatus({ type: 'error', message: `${buttonLabel} is not available.` });
  };

  const getStoredArrayLength = (storageKey) => {
    if (typeof localStorage === 'undefined') return 0;

    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  };

  const toolbarIconButtonClass =
    'h-10 w-10 p-0 rounded-lg shadow-sm transition-colors flex items-center justify-center flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2';

  const toolbarCountButtonClass =
    'relative h-10 w-10 p-0 rounded-lg shadow-sm transition-colors flex items-center justify-center flex-shrink-0 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2';

  const toolbarCountBadgeClass =
    'absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-white text-slate-900 border border-slate-300 text-[10px] font-bold leading-none flex items-center justify-center shadow-sm';

  const renderArchiveIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
      />
    </svg>
  );

  const renderDownloadIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
      />
    </svg>
  );

  const renderUploadIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );

  const renderPlusIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14m7-7H5" />
    </svg>
  );

  const renderHistoryIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12a9 9 0 109-9m0 0V1m0 2H8m4 4v5l3 2" />
    </svg>
  );

  const renderPrintIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z" />
    </svg>
  );

  const renderScheduleListIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16v14H4V5zm0 5h16M9 5v14" />
    </svg>
  );

  const renderScanIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7V5a1 1 0 011-1h2M17 4h2a1 1 0 011 1v2M20 17v2a1 1 0 01-1 1h-2M7 20H5a1 1 0 01-1-1v-2M7 9h10M7 12h10M7 15h6" />
    </svg>
  );

  const renderPrintButton = (title) => (
    <button
      type="button"
      onClick={printActiveTab}
      className={`${toolbarIconButtonClass} bg-indigo-500 text-white hover:bg-indigo-600`}
      title={title}
      aria-label={title}
    >
      {renderPrintIcon()}
    </button>
  );

  const renderFullDashboardExportButton = () => (
    <button
      type="button"
      onClick={handleFullDashboardExportJSON}
      className={`${toolbarIconButtonClass} bg-blue-500 text-white hover:bg-blue-600`}
      title="Export Complete Dashboard JSON"
      aria-label="Export Complete Dashboard JSON"
    >
      {renderDownloadIcon()}
    </button>
  );

  const renderTabToolbarActions = () => {
    if (activeTab === 'todo') {
      const todoArchiveCount = getStoredArrayLength(TODO_ARCHIVE_STORAGE_KEY);

      return (
        <>
          <button type="button" onClick={() => dispatchToolbarEvent('todo-toolbar:add')} className={`${toolbarIconButtonClass} bg-slate-900 text-white hover:bg-slate-800`} title="Add To-Do Task" aria-label="Add To-Do Task">
            {renderPlusIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('todo-toolbar:archive')} className={`${toolbarCountButtonClass} bg-purple-500 text-white hover:bg-purple-600`} title="To-Do Archive Drawer" aria-label="Open To-Do Archive Drawer">
            {renderArchiveIcon()}
            <span className={toolbarCountBadgeClass}>{todoArchiveCount}</span>
          </button>
          {renderPrintButton('Print To-Do List')}
          <button type="button" onClick={() => dispatchToolbarEvent('todo-toolbar:snapshot')} className={`${toolbarIconButtonClass} bg-emerald-700 text-white hover:bg-emerald-800`} title="To-Do Safety Snapshot" aria-label="Create To-Do Safety Snapshot">
            {renderHistoryIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('todo-toolbar:export')} className={`${toolbarIconButtonClass} bg-green-500 text-white hover:bg-green-600`} title="Export To-Do" aria-label="Export To-Do">
            {renderDownloadIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('todo-toolbar:import')} className={`${toolbarIconButtonClass} bg-amber-500 text-white hover:bg-amber-600`} title="Import To-Do" aria-label="Import To-Do">
            {renderUploadIcon()}
          </button>
          {renderFullDashboardExportButton()}
        </>
      );
    }

    if (activeTab === 'cscShifts') {
      const cscArchiveCount = getStoredArrayLength('cscShifts.archived.v1');

      return (
        <>
          <button type="button" onClick={() => dispatchToolbarEvent('csc-toolbar:add')} className={`${toolbarIconButtonClass} bg-slate-900 text-white hover:bg-slate-800`} title="Add CSC Shift" aria-label="Add CSC Shift">
            {renderPlusIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('csc-toolbar:archive')} className={`${toolbarCountButtonClass} bg-purple-500 text-white hover:bg-purple-600`} title="CSC Archive Drawer" aria-label="Open CSC Archive Drawer">
            {renderArchiveIcon()}
            <span className={toolbarCountBadgeClass}>{cscArchiveCount}</span>
          </button>
          {renderPrintButton('Print CSC Shifts')}
          <button
            type="button"
            onClick={() => dispatchToolbarEvent('csc-toolbar:upcoming-schedules')}
            className={`${toolbarIconButtonClass} bg-cyan-600 text-white hover:bg-cyan-700`}
            title="Preview and Print Upcoming Schedules"
            aria-label="Preview and Print Upcoming Schedules"
          >
            {renderScheduleListIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('csc-toolbar:snapshot')} className={`${toolbarIconButtonClass} bg-emerald-700 text-white hover:bg-emerald-800`} title="CSC Safety Snapshot" aria-label="Create CSC Safety Snapshot">
            {renderHistoryIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('csc-toolbar:export')} className={`${toolbarIconButtonClass} bg-green-500 text-white hover:bg-green-600`} title="Export CSC Shifts" aria-label="Export CSC Shifts">
            {renderDownloadIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('csc-toolbar:import')} className={`${toolbarIconButtonClass} bg-amber-500 text-white hover:bg-amber-600`} title="Import CSC Shifts" aria-label="Import CSC Shifts">
            {renderUploadIcon()}
          </button>
          {renderFullDashboardExportButton()}
        </>
      );
    }

    if (activeTab === 'cscOpportunities') {
      return (
        <>
          <button type="button" onClick={() => dispatchToolbarEvent('csc-opportunities-toolbar:add')} className={`${toolbarIconButtonClass} bg-slate-900 text-white hover:bg-slate-800`} title="Add CSC Opportunity" aria-label="Add CSC Opportunity">
            {renderPlusIcon()}
          </button>
          {renderPrintButton('Print CSC Opportunities')}
          <button type="button" onClick={() => dispatchToolbarEvent('csc-opportunities-toolbar:snapshot')} className={`${toolbarIconButtonClass} bg-emerald-700 text-white hover:bg-emerald-800`} title="CSC Opportunities Safety Snapshot" aria-label="Create CSC Opportunities Safety Snapshot">
            {renderHistoryIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('csc-opportunities-toolbar:export')} className={`${toolbarIconButtonClass} bg-green-500 text-white hover:bg-green-600`} title="Export CSC Opportunities" aria-label="Export CSC Opportunities">
            {renderDownloadIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('csc-opportunities-toolbar:import')} className={`${toolbarIconButtonClass} bg-amber-500 text-white hover:bg-amber-600`} title="Import CSC Opportunities" aria-label="Import CSC Opportunities">
            {renderUploadIcon()}
          </button>
          {renderFullDashboardExportButton()}
        </>
      );
    }

    if (activeTab === 'rides') {
      const ridesArchiveCount = getStoredArrayLength(RIDES_ARCHIVE_STORAGE_KEY);

      return (
        <>
          <button type="button" onClick={() => dispatchToolbarEvent('rides-toolbar:add')} className={`${toolbarIconButtonClass} bg-slate-900 text-white hover:bg-slate-800`} title="Add Ride" aria-label="Add Ride">
            {renderPlusIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('rides-toolbar:archive')} className={`${toolbarCountButtonClass} bg-purple-500 text-white hover:bg-purple-600`} title="Rides Archive Drawer" aria-label="Open Rides Archive Drawer">
            {renderArchiveIcon()}
            <span className={toolbarCountBadgeClass}>{ridesArchiveCount}</span>
          </button>
          {renderPrintButton('Print Rides')}
          <button type="button" onClick={() => dispatchToolbarEvent('rides-toolbar:snapshot')} className={`${toolbarIconButtonClass} bg-emerald-700 text-white hover:bg-emerald-800`} title="Rides Safety Snapshot" aria-label="Create Rides Safety Snapshot">
            {renderHistoryIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('rides-toolbar:export')} className={`${toolbarIconButtonClass} bg-green-500 text-white hover:bg-green-600`} title="Export Rides" aria-label="Export Rides">
            {renderDownloadIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('rides-toolbar:import')} className={`${toolbarIconButtonClass} bg-amber-500 text-white hover:bg-amber-600`} title="Import Rides" aria-label="Import Rides">
            {renderUploadIcon()}
          </button>
          {renderFullDashboardExportButton()}
        </>
      );
    }

    if (activeTab === 'paychecks') {
      const paycheckArchiveCount = getStoredArrayLength(PAYCHECK_ARCHIVE_STORAGE_KEY);

      return (
        <>
          <button type="button" onClick={() => openPaychecksAction('Add Paycheck')} className={`${toolbarIconButtonClass} bg-slate-900 text-white hover:bg-slate-800`} title="Add Paycheck" aria-label="Add Paycheck">
            {renderPlusIcon()}
          </button>
          <button type="button" onClick={() => openPaychecksAction('Scan Paycheck')} className={`${toolbarIconButtonClass} bg-indigo-500 text-white hover:bg-indigo-600`} title="Scan Paycheck" aria-label="Scan Paycheck">
            {renderScanIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('paychecks-toolbar:archive')} className={`${toolbarCountButtonClass} bg-purple-500 text-white hover:bg-purple-600`} title="Paycheck Archive Drawer" aria-label="Open Paycheck Archive Drawer">
            {renderArchiveIcon()}
            <span className={toolbarCountBadgeClass}>{paycheckArchiveCount}</span>
          </button>
          {renderPrintButton('Print Paycheck History')}
          <button type="button" onClick={() => dispatchToolbarEvent('paychecks-toolbar:snapshot')} className={`${toolbarIconButtonClass} bg-emerald-700 text-white hover:bg-emerald-800`} title="Paychecks Safety Snapshot" aria-label="Create Paychecks Safety Snapshot">
            {renderHistoryIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('paychecks-toolbar:export')} className={`${toolbarIconButtonClass} bg-green-500 text-white hover:bg-green-600`} title="Export Paychecks" aria-label="Export Paychecks">
            {renderDownloadIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('paychecks-toolbar:import')} className={`${toolbarIconButtonClass} bg-amber-500 text-white hover:bg-amber-600`} title="Import Paychecks" aria-label="Import Paychecks">
            {renderUploadIcon()}
          </button>
          {renderFullDashboardExportButton()}
        </>
      );
    }

    if (activeTab !== 'budget') {
      return renderFullDashboardExportButton();
    }

    return (
      <>
        <button
          type="button"
          onClick={() => setIsStatementScannerOpen(true)}
          className={`${toolbarIconButtonClass} bg-indigo-500 text-white hover:bg-indigo-600`}
          title="Scan Statement"
          aria-label="Scan Statement"
        >
          {renderPlusIcon()}
        </button>

        <button
          type="button"
          onClick={() => setIsBudgetArchiveDrawerOpen(true)}
          className={`${toolbarCountButtonClass} bg-purple-500 text-white hover:bg-purple-600`}
          title="Budget Archives"
          aria-label="Open Budget Archives"
        >
          {renderArchiveIcon()}
          <span className={toolbarCountBadgeClass}>{state.archived?.length || 0}</span>
        </button>

        {renderPrintButton('Print Budget')}

        <button
          type="button"
          onClick={handleBudgetSafetySnapshot}
          className={`${toolbarIconButtonClass} bg-emerald-700 text-white hover:bg-emerald-800`}
          title="Budget Safety Snapshot"
          aria-label="Create Budget Safety Snapshot"
        >
          {renderHistoryIcon()}
        </button>

        <button
          type="button"
          onClick={() => setShowExportDialog(true)}
          className={`${toolbarIconButtonClass} bg-green-500 text-white hover:bg-green-600`}
          title="Export Budget Only"
          aria-label="Export Budget Only"
        >
          {renderDownloadIcon()}
        </button>

        <label
          className={`${toolbarIconButtonClass} bg-amber-500 text-white hover:bg-amber-600 cursor-pointer`}
          title="Import Budget JSON"
          aria-label="Import Budget JSON"
        >
          <input
            type="file"
            accept=".json"
            onChange={handleImportJSON}
            className="hidden"
          />
          {renderUploadIcon()}
        </label>

        {renderFullDashboardExportButton()}
      </>
    );
  };

  if (isLoading) return <LoadingGate />;

  return (
    <div className={`min-h-screen ${activeContentBackgroundClass}`}>
      <style>{`
        @media (max-width: 639px) {
          ${activeTab === 'todo' ? `
            html,
            body,
            #root {
              background-color: #ecfccb !important;
            }
          ` : ''}

          .budget-tool-header-shell,
          .budget-overview-page {
            padding-top: 0.75rem;
            padding-bottom: 0.75rem;
          }

        }
      `}</style>

      {saveStatus && (
        <div
          className="fixed inset-0 pointer-events-none z-[9999]"
          style={{ isolation: 'isolate' }}
        >
          <div
            className={`absolute inset-x-3 top-16 rounded-lg px-4 py-2 text-sm shadow-lg pointer-events-auto sm:left-auto sm:right-4 sm:top-20 sm:max-w-md ${
              saveStatus.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
            role="status"
            aria-live="polite"
          >
            {saveStatus.message}
          </div>
        </div>
      )}

      <StickyToolbar bgTint={activeContentBackgroundClass} contentClassName="w-full px-3 sm:px-4 lg:px-6">
        <div className="flex flex-col gap-0 py-2 lg:min-h-14 lg:flex-row lg:items-center lg:justify-between lg:gap-2">
          <div className="relative w-full min-w-0 lg:w-auto lg:flex-1">
            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => setIsMobileNavOpen((current) => !current)}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border-2 !border-black px-3 py-2 text-white transition-all active:scale-[0.99] ${
                  activeTab === 'budget'
                    ? activeBudgetTabClass
                    : activeTabConfig?.activeClass || tabs[0].activeClass
                }`}
                aria-expanded={isMobileNavOpen}
                aria-controls="mobile-main-navigation"
                aria-label={`${isMobileNavOpen ? 'Close' : 'Open'} main navigation. Current page: ${activeTabConfig?.label || 'To-Do'}`}
              >
                <span className="inline-flex min-w-0 items-center gap-2 text-sm font-black">
                  {activeTabConfig?.icon
                    ? React.createElement(activeTabConfig.icon, { className: 'h-5 w-5 shrink-0', 'aria-hidden': true })
                    : null}
                  <span className="truncate">{activeTabConfig?.label || 'To-Do'}</span>
                </span>

                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/30 bg-white/15">
                  {isMobileNavOpen ? (
                    <X className="h-5 w-5" aria-hidden="true" />
                  ) : (
                    <Menu className="h-5 w-5" aria-hidden="true" />
                  )}
                </span>
              </button>

              {isMobileNavOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-0 cursor-default"
                    onClick={() => setIsMobileNavOpen(false)}
                    aria-label="Close main navigation"
                    tabIndex={-1}
                  />

                  <div
                    id="mobile-main-navigation"
                    className="absolute inset-x-0 top-full z-10 mt-0 grid grid-cols-3 gap-2 rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-2xl"
                    role="menu"
                    aria-label="Main pages"
                  >
                    {tabs.map((tab) => {
                      const TabIcon = tab.icon;
                      const isActive = activeTab === tab.id;

                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(tab.id);
                            setIsMobileNavOpen(false);
                            if (tab.id === 'budget') {
                              setActiveBudgetTab((current) => current || 'overview');
                            }
                          }}
                          className={`inline-flex min-h-12 min-w-0 items-center justify-center gap-1 rounded-xl border-2 !border-black px-1.5 py-1.5 text-center text-[10px] font-black leading-tight transition-all active:scale-95 sm:text-xs ${
                            isActive
                              ? tab.id === 'budget'
                                ? activeBudgetTabClass
                                : tab.activeClass
                              : tab.inactiveClass
                          }`}
                          role="menuitem"
                          aria-current={isActive ? 'page' : undefined}
                        >
                          <TabIcon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden="true" />
                          <span className="min-w-0 whitespace-nowrap">{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="hidden w-full min-w-0 flex-nowrap items-center gap-1 lg:flex xl:gap-1.5">
              {tabs.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id === 'budget') {
                        setActiveBudgetTab((current) => current || 'overview');
                      }
                    }}
                    title={`Open ${tab.label} tab`}
                    aria-label={`Open ${tab.label} tab`}
                    className={`inline-flex min-h-10 w-auto shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-xl border-2 !border-black px-2 py-1.5 text-center text-xs font-black leading-tight transition-all duration-200 active:scale-95 xl:gap-1.5 xl:px-3 xl:text-sm ${
                      isActive
                        ? tab.id === 'budget'
                          ? activeBudgetTabClass
                          : tab.activeClass
                        : tab.inactiveClass
                    }`}
                    aria-pressed={isActive}
                  >
                    <TabIcon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={`mobile-horizontal-scroll ${activeContentBackgroundClass} flex w-full flex-shrink-0 flex-nowrap items-center gap-1 overflow-y-hidden rounded-xl px-2 py-1.5 transition-colors sm:gap-2 lg:w-auto lg:rounded-none lg:bg-transparent lg:p-0`}
          >
            {activeTab === 'budget' &&
            (activeBudgetTab === 'overview' || activeBudgetTab === 'editor') ? (
              <NotificationPanel
                state={state}
                activeTab={activeTab}
                onMarkPaid={handleMarkPaidFromNotification}
              />
            ) : null}

            <div className="relative hidden w-44 2xl:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {renderTabToolbarActions()}
          </div>
        </div>
      </StickyToolbar>

      <div className={`${activeContentBackgroundClass} min-h-screen`}>
        {activeTab === 'cscShifts' && (
          <CscShiftsTab searchQuery={searchQuery} />
        )}

        {activeTab === 'cscOpportunities' && (
          <CscOpportunitiesTab searchQuery={searchQuery} />
        )}

        {activeTab === 'paychecks' && (
          <PaychecksTab searchQuery={searchQuery} />
        )}

        {activeTab === 'rides' && (
          <RidesTab searchQuery={searchQuery} />
        )}

        {activeTab === 'todo' && (
          <TodoTab
            key={todoRefreshKey}
            editTaskId={todoEditTaskId}
            onEditTaskLoaded={() => setTodoEditTaskId('')}
          />
        )}

        {activeTab === 'budget' && (
          <div className={`${activeContentBackgroundClass} min-h-screen`}>
            {activeBudgetTab === 'overview' && (
              <DashboardTab
                state={state}
                setState={setState}
                saveBudget={saveBudget}
                searchQuery={searchQuery}
                budgetSubnav={renderBudgetSubnav()}
                onOpenEditor={() => setActiveBudgetTab('editor')}
              />
            )}

            {activeBudgetTab === 'editor' && (
              <div>
                {renderBudgetToolHeader('Budget Editor', 'Edit budget items, categories, amounts, due dates, notes, payment details, and recurring schedules.', 'indigo', Monitor)}
                <EditorTab
                  state={state}
                  setState={setState}
                  saveBudget={saveBudget}
                  searchQuery={searchQuery}
                />
              </div>
            )}

            {activeBudgetTab === 'analysis' && (
              <div className="bg-cyan-50">
                {renderBudgetToolHeader('Budget Analysis', 'Review budget trends, spending patterns, category totals, and variance insights.', 'cyan', BarChart3)}
                <AnalysisTab
                  state={state}
                  setState={setState}
                  saveBudget={saveBudget}
                  searchQuery={searchQuery}
                />
              </div>
            )}

            {activeBudgetTab === 'calculator' && (
              <div className="bg-amber-50">
                {renderBudgetToolHeader('Budget Calculator', 'Calculate payment scenarios, totals, savings targets, and budget adjustments.', 'amber', CircleDollarSign)}
                <CalculatorTab
                  state={state}
                  setState={setState}
                  saveBudget={saveBudget}
                  searchQuery={searchQuery}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <ArchivedDrawer
        isOpen={isBudgetArchiveDrawerOpen}
        onClose={() => setIsBudgetArchiveDrawerOpen(false)}
        archivedItems={state.archived || []}
        onRestore={handleRestoreArchived}
        onDelete={handleDeleteArchived}
        archiveType="budget"
        title="Budget Archives"
      />

      <StatementScanner
        isOpen={isStatementScannerOpen}
        onClose={() => setIsStatementScannerOpen(false)}
        onImport={handleStatementImport}
        onCreateTodo={handleScannerTodoCreate}
        onSaveContact={handleScannerContactSave}
      />

      {showExportDialog && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 px-3 py-4 sm:px-4 sm:py-6">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:max-h-[calc(100vh-3rem)] sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-lg font-bold">Export Budget Only</h3>
              <CloseScreenButton onClick={() => setShowExportDialog(false)} />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filename
              </label>
              <input
                type="text"
                value={exportFilename}
                onChange={(e) => setExportFilename(e.target.value)}
                placeholder="budget-data"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">.json will be added automatically</p>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowExportDialog(false)}
                title="Cancel export"
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleBudgetExportJSON}
                title="Export budget-only JSON file"
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetDashboard;
