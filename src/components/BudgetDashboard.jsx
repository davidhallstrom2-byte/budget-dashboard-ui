import React, { useState, useEffect, useMemo } from 'react';
import { initializeState, saveToServer } from '../utils/state.js';
import LoadingGate from './common/LoadingGate';
import PageContainer from './common/PageContainer';
import DashboardTab from './tabs/DashboardTab';
import AnalysisTab from './tabs/AnalysisTab';
import CalculatorTab from './tabs/CalculatorTab';
import TodoTab from './tabs/TodoTab';
import EditorTab from './tabs/EditorTab';
import CscShiftsTab from './tabs/CscShiftsTab';
import ArchivedDrawer from './ui/ArchivedDrawer';
import StickyToolbar from './common/StickyToolbar.jsx';
import StatementScanner from './statements/StatementScanner';
import NotificationPanel from './modern/NotificationPanel';
import {
  Search,
  X,
  WalletCards,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Archive,
  BarChart3,
} from 'lucide-react';

const TODO_STORAGE_KEY = 'todoTab.tasks.v1';
const TODO_ARCHIVE_STORAGE_KEY = 'todoTab.tasks.archived.v1';
const TODO_CONTACTS_STORAGE_KEY = 'todoTab.contacts.v1';

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
    phone: contact.phone || '',
    directPhone: contact.directPhone || '',
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

  const tabs = useMemo(
    () => [
      { id: 'todo', label: 'To-Do', bgColor: 'bg-green-50', inactiveClass: 'bg-green-100 text-green-900 hover:bg-green-200' },
      { id: 'cscShifts', label: 'CSC Shifts', bgColor: 'bg-yellow-100', inactiveClass: 'bg-yellow-100 text-yellow-900 hover:bg-yellow-200' },
      { id: 'budget', label: 'Budget', bgColor: 'bg-blue-100', inactiveClass: 'bg-blue-100 text-blue-900 hover:bg-blue-200' },
    ],
    []
  );

  const budgetTabs = useMemo(
    () => [
      { id: 'overview', label: 'Overview', inactiveClass: 'bg-blue-50 text-blue-900 hover:bg-blue-100' },
      { id: 'editor', label: 'Editor', inactiveClass: 'bg-orange-50 text-orange-900 hover:bg-orange-100' },
      { id: 'analysis', label: 'Analysis', inactiveClass: 'bg-purple-50 text-purple-900 hover:bg-purple-100' },
      { id: 'calculator', label: 'Calculator', inactiveClass: 'bg-green-50 text-green-900 hover:bg-green-100' },
    ],
    []
  );

  const activeTabConfig = useMemo(
    () => tabs.find((t) => t.id === activeTab),
    [tabs, activeTab]
  );

  const renderBudgetSubnav = () => (
    <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-white/80 p-2 shadow-sm">
      {budgetTabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => setActiveBudgetTab(tab.id)}
          title={`Open Budget ${tab.label}`}
          aria-label={`Open Budget ${tab.label}`}
          className={`rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
            activeBudgetTab === tab.id
              ? 'bg-blue-700 text-white shadow-sm'
              : tab.inactiveClass
          }`}
          aria-pressed={activeBudgetTab === tab.id}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  // FIX: Use PageContainer (max-w-6xl) instead of budget-fixed-width (1360px hardcoded)
  // so all subnav headers match the width of the Overview tab which uses PageContainer.
  const renderBudgetToolHeader = (title, description) => (
    <PageContainer className="mb-6">
      <section className="rounded-xl border border-blue-200 bg-blue-50 px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
            {description && (
              <p className="mt-1 text-sm font-medium text-slate-600">{description}</p>
            )}
          </div>
          {renderBudgetSubnav()}
        </div>
      </section>
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
      phone: taskData.phone || '',
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

  const handleExportJSON = () => {
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

  const handleBudgetSafetySnapshot = () => {
    const now = new Date();
    const stamp = now
      .toISOString()
      .slice(0, 16)
      .replace(/[-:T]/g, '');
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
    'h-10 w-10 p-0 rounded-lg transition-colors flex items-center justify-center flex-shrink-0';

  const toolbarCountButtonClass =
    'h-10 w-16 p-0 rounded-lg transition-colors flex items-center justify-center gap-1 flex-shrink-0 text-xs font-semibold';

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

  const renderSaveIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
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
            <span>({todoArchiveCount})</span>
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('todo-toolbar:snapshot')} className={`${toolbarIconButtonClass} bg-emerald-700 text-white hover:bg-emerald-800`} title="To-Do Safety Snapshot" aria-label="Create To-Do Safety Snapshot">
            {renderHistoryIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('todo-toolbar:export')} className={`${toolbarIconButtonClass} bg-green-500 text-white hover:bg-green-600`} title="Export To-Do" aria-label="Export To-Do">
            {renderDownloadIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('todo-toolbar:import')} className={`${toolbarIconButtonClass} bg-amber-500 text-white hover:bg-amber-600`} title="Import To-Do" aria-label="Import To-Do">
            {renderUploadIcon()}
          </button>
          <button type="button" onClick={() => dispatchToolbarEvent('todo-toolbar:save')} className={`${toolbarIconButtonClass} bg-blue-500 text-white hover:bg-blue-600`} title="Save To-Do Safety Snapshot" aria-label="Save To-Do Safety Snapshot">
            {renderSaveIcon()}
          </button>
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
            <span>({cscArchiveCount})</span>
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
          <button type="button" onClick={() => dispatchToolbarEvent('csc-toolbar:save')} className={`${toolbarIconButtonClass} bg-blue-500 text-white hover:bg-blue-600`} title="Save CSC Safety Snapshot" aria-label="Save CSC Safety Snapshot">
            {renderSaveIcon()}
          </button>
        </>
      );
    }

    return (
      <>
        <button
          onClick={() => setIsStatementScannerOpen(true)}
          className={`${toolbarIconButtonClass} bg-indigo-500 text-white hover:bg-indigo-600`}
          title="Scan Statement"
          aria-label="Scan Statement"
        >
          {renderPlusIcon()}
        </button>

        <button
          onClick={() => setIsBudgetArchiveDrawerOpen(true)}
          className={`${toolbarCountButtonClass} bg-purple-500 text-white hover:bg-purple-600`}
          title="Budget Archives"
          aria-label="Open Budget Archives"
        >
          {renderArchiveIcon()}
          <span>({state.archived?.length || 0})</span>
        </button>

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
          onClick={() => setShowExportDialog(true)}
          className={`${toolbarIconButtonClass} bg-green-500 text-white hover:bg-green-600`}
          title="Export JSON"
          aria-label="Export JSON"
        >
          {renderDownloadIcon()}
        </button>

        <label
          className={`${toolbarIconButtonClass} bg-amber-500 text-white hover:bg-amber-600 cursor-pointer`}
          title="Import JSON"
          aria-label="Import JSON"
        >
          <input
            type="file"
            accept=".json"
            onChange={handleImportJSON}
            className="hidden"
          />
          {renderUploadIcon()}
        </label>

        <button
          onClick={() => saveBudget()}
          disabled={isSaving}
          className={`${toolbarIconButtonClass} ${
            isSaving
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
          title="Save Budget"
          aria-label="Save Budget"
        >
          {isSaving ? (
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            renderSaveIcon()
          )}
        </button>
      </>
    );
  };

  if (isLoading) return <LoadingGate />;

  return (
    <div className="min-h-screen bg-gray-50">
      {saveStatus && (
        <div
          className="fixed inset-0 pointer-events-none z-[9999]"
          style={{ isolation: 'isolate' }}
        >
          <div
            className={`absolute top-20 right-4 px-4 py-2 rounded-lg shadow-lg pointer-events-auto ${
              saveStatus.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
            role="status"
            aria-live="polite"
          >
            {saveStatus.message}
          </div>
        </div>
      )}

      <StickyToolbar bgTint={activeTabConfig?.bgColor || ''}>
        <div className="flex justify-between items-center gap-2 h-14">
          <div className="flex items-center space-x-1 overflow-x-auto flex-shrink min-w-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'budget') {
                    setActiveBudgetTab((current) => current || 'overview');
                  }
                }}
                title={`Open ${tab.label} tab`}
                aria-label={`Open ${tab.label} tab`}
                className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-black text-white'
                    : tab.inactiveClass
                }`}
                aria-pressed={activeTab === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <NotificationPanel
              state={state}
              activeTab={activeTab}
              onMarkPaid={handleMarkPaidFromNotification}
            />

            <div className="relative w-48 hidden lg:block">
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

      <div className={`${activeTabConfig?.bgColor || 'bg-white'} min-h-screen`}>
        {activeTab === 'cscShifts' && (
          <CscShiftsTab searchQuery={searchQuery} />
        )}

        {activeTab === 'todo' && (
          <TodoTab
            key={todoRefreshKey}
            editTaskId={todoEditTaskId}
            onEditTaskLoaded={() => setTodoEditTaskId('')}
          />
        )}

        {activeTab === 'budget' && (
          <div className="min-h-screen">
            {activeBudgetTab === 'overview' && (
              <DashboardTab
                state={state}
                setState={setState}
                saveBudget={saveBudget}
                searchQuery={searchQuery}
                budgetSubnav={renderBudgetSubnav()}
              />
            )}

            {activeBudgetTab === 'editor' && (
              <div className="pt-4">
                {renderBudgetToolHeader('Budget Editor', 'Edit budget items, categories, amounts, due dates, notes, and payment details.')}
                <EditorTab
                  state={state}
                  setState={setState}
                  saveBudget={saveBudget}
                  searchQuery={searchQuery}
                />
              </div>
            )}

            {activeBudgetTab === 'analysis' && (
              <div className="pt-4">
                {renderBudgetToolHeader('Budget Analysis', 'Review budget trends, spending patterns, category totals, and variance insights.')}
                <AnalysisTab
                  state={state}
                  setState={setState}
                  saveBudget={saveBudget}
                  searchQuery={searchQuery}
                />
              </div>
            )}

            {activeBudgetTab === 'calculator' && (
              <div className="pt-4">
                {renderBudgetToolHeader('Budget Calculator', 'Calculate payment scenarios, totals, savings targets, and budget adjustments.')}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 overflow-y-auto px-4 py-6">
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl max-h-[calc(100vh-3rem)] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Export Budget</h3>

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
                onClick={handleExportJSON}
                title="Export budget JSON file"
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
