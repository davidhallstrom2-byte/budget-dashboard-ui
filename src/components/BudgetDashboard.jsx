import React, { useState, useEffect, useMemo } from 'react';
import { initializeState, saveToServer } from '../utils/state.js';
import LoadingGate from './common/LoadingGate';
import PageContainer from './common/PageContainer';
import DashboardTab from './tabs/DashboardTab';
import AnalysisTab from './tabs/AnalysisTab';
import CalculatorTab from './tabs/CalculatorTab';
import TodoTab from './tabs/TodoTab';
import TodoListSection from './todo/TodoListSection';
import EditorTab from './tabs/EditorTab';
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
  ListTodo,
  Archive,
  BarChart3,
  CheckSquare,
} from 'lucide-react';

const TODO_STORAGE_KEY = 'todoTab.tasks.v1';
const TODO_ARCHIVE_STORAGE_KEY = 'todoTab.tasks.archived.v1';


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

    if (isCombinedInsuranceDmvTask(task)) {
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
    const normalized = normalizeTodoTaskList(baseTasks);

    if (normalized.changed) {
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

  const urgentPaymentItems = items.filter((item) => {
    if (item.status === 'paid') return false;
    const days = getDaysUntil(item.dueDate);
    return days !== null && days <= 0;
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
    urgentPaymentItems,
    totalEstimated,
    totalActual,
    archivedItems: state?.archived?.length || 0,
  };
};

const getUrgentTodoTasks = (todoTasks = []) => {
  return todoTasks
    .filter((task) => {
      if (!task || task.completed) return false;
      const days = getDaysUntil(task.deadline || task.date);
      return days !== null && days <= 0;
    })
    .map((task) => ({
      ...task,
      daysUntil: getDaysUntil(task.deadline || task.date),
    }))
    .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0));
};

const getTodoOverview = (todoTasks) => {
  const total = todoTasks.length;
  const completed = todoTasks.filter((task) => task.completed).length;
  const open = todoTasks.filter((task) => !task.completed).length;
  const blocked = todoTasks.filter((task) => task.blockedBy && !task.completed).length;
  const urgentTasks = getUrgentTodoTasks(todoTasks);

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
    urgentTasks: urgentTasks.length,
  };
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));

const formatTodoDueText = (daysUntil) => {
  if (daysUntil === null || daysUntil === undefined) return 'No deadline set';
  if (daysUntil < 0) return `OVERDUE ${Math.abs(daysUntil)} day${Math.abs(daysUntil) === 1 ? '' : 's'}`;
  if (daysUntil === 0) return 'DUE TODAY';
  return `Due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
};

const getTaskOwnerLabel = (task = {}) => task.ownerOverride || task.person || task.owner || task.assignedTo || '';

const getTaskCategoryLabel = (task = {}) => task.typeOverride || task.type || task.category || 'General';

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

const DashboardOverviewStrip = ({
  state,
  todoTasks,
  onNavigateToTab,
  onOpenUrgentPayments,
  onOpenUrgentTodos,
}) => {
  const budget = useMemo(() => getBudgetOverview(state), [state]);
  const todo = useMemo(() => getTodoOverview(todoTasks), [todoTasks]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Overview</h2>
          <p className="text-sm text-slate-600">
            Budget status, task counts, alerts, and saved items in one place.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => {
              if (budget.urgentPaymentItems > 0) {
                onOpenUrgentPayments();
                return;
              }
              onNavigateToTab('editor');
            }}
            title={budget.urgentPaymentItems > 0 ? 'View overdue and due today payments' : 'View budget items'}
            className="group relative flex items-center gap-2 rounded-full border border-blue-300 bg-blue-100 px-4 py-2 text-sm font-bold text-blue-800 shadow-sm transition-all hover:bg-blue-200 active:scale-95"
          >
            <BarChart3 className="h-4 w-4" />
            <span>{budget.totalItems} items</span>

            {budget.urgentPaymentItems > 0 && (
              <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                {budget.urgentPaymentItems}
              </span>
            )}

            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
              {budget.urgentPaymentItems > 0 ? 'View payment alerts' : 'View budget items'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (todo.urgentTasks > 0) {
                onOpenUrgentTodos();
                return;
              }
              onNavigateToTab('todo');
            }}
            title={todo.urgentTasks > 0 ? 'View overdue and due today tasks' : 'View to-do list'}
            className="group relative flex items-center gap-2 rounded-full border border-red-300 bg-red-100 px-4 py-2 text-sm font-bold text-red-800 shadow-sm transition-all hover:bg-red-200 active:scale-95"
          >
            <CheckSquare className="h-4 w-4" />
            <span>{todo.total} tasks</span>

            {todo.urgentTasks > 0 && (
              <span className="ml-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                {todo.urgentTasks}
              </span>
            )}

            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white opacity-0 transition group-hover:opacity-100">
              {todo.urgentTasks > 0 ? 'View to-do alerts' : 'View to-do list'}
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
          value={budget.overdueItems + todo.overdue}
          detail={`${budget.overdueItems} budget · ${todo.overdue} to-do`}
          icon={AlertTriangle}
          className="border-red-200 bg-red-50 text-red-950"
        />

        <OverviewCard
          title="Due Soon"
          value={budget.dueSoonItems + todo.dueSoon}
          detail="Due within 5 days"
          icon={Clock}
          className="border-amber-200 bg-amber-50 text-amber-950"
        />

        <OverviewCard
          title="To-Do Progress"
          value={`${todo.completed}/${todo.total}`}
          detail={`${todo.open} open · ${todo.blocked} blocked`}
          icon={ListTodo}
          className="border-violet-200 bg-violet-50 text-violet-950"
        />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            <h3 className="font-extrabold">Paid Items</h3>
          </div>
          <p className="mt-2 text-2xl font-extrabold">{budget.paidItems}</p>
          <p className="text-sm opacity-80">Items marked paid in budget.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            <h3 className="font-extrabold">Archived Items</h3>
          </div>
          <p className="mt-2 text-2xl font-extrabold">{budget.archivedItems}</p>
          <p className="text-sm text-slate-600">Stored in archive drawer.</p>
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

const UrgentTodoAlertModal = ({ tasks, isOpen, onClose, onEditTask }) => {
  if (!isOpen || tasks.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 px-4 py-6">
      <div className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-red-600 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-7 w-7 flex-shrink-0" />
            <h2 className="text-2xl font-extrabold">URGENT TO-DO ALERT</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded bg-white px-3 py-1 text-2xl font-bold text-red-600 hover:bg-red-50"
            aria-label="Close urgent to-do alert"
          >
            X
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6">
          <p className="mb-4 text-lg font-bold text-red-900">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} overdue or due today:
          </p>

          <div className="space-y-4">
            {tasks.map((task) => {
              const dueValue = task.deadline || task.date || '';
              const ownerLabel = getTaskOwnerLabel(task);
              const categoryLabel = getTaskCategoryLabel(task);
              const detailLines = [
                ownerLabel ? `For: ${ownerLabel}` : '',
                categoryLabel ? `Category: ${categoryLabel}` : '',
                dueValue ? `Due Date: ${dueValue}` : '',
                task.phone ? `Phone: ${task.phone}` : '',
                task.website ? `Website: ${task.website}` : '',
                task.notes ? `Notes: ${task.notes}` : '',
              ].filter(Boolean);

              return (
                <div key={task.id} className="rounded border border-red-200 bg-red-50 p-4 text-red-950">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-extrabold">{task.taskName || 'Untitled task'}</h3>
                      <p className="mt-1 text-red-700">{formatTodoDueText(task.daysUntil)}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onEditTask(task)}
                      className="rounded border border-red-300 bg-white px-3 py-1 text-sm font-bold text-red-700 hover:bg-red-100"
                    >
                      Edit
                    </button>
                  </div>

                  {detailLines.length > 0 && (
                    <div className="mt-3 space-y-1 text-sm text-red-950">
                      {detailLines.map((line, index) => (
                        <p key={`${task.id}-detail-${index}`} className="whitespace-pre-wrap">
                          {line}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const BudgetDashboard = () => {
  const [state, setState] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isBudgetArchiveDrawerOpen, setIsBudgetArchiveDrawerOpen] = useState(false);
  const [isTodoArchiveDrawerOpen, setIsTodoArchiveDrawerOpen] = useState(false);
  const [isStatementScannerOpen, setIsStatementScannerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFilename, setExportFilename] = useState('budget-data');
  const [todoTasks, setTodoTasks] = useState(readTodoTasks);
  const [todoArchivedTasks, setTodoArchivedTasks] = useState(readTodoArchivedTasks);
  const [todoEditTaskId, setTodoEditTaskId] = useState('');
  const [isUrgentPaymentAlertOpen, setIsUrgentPaymentAlertOpen] = useState(false);
  const [isUrgentTodoAlertOpen, setIsUrgentTodoAlertOpen] = useState(false);

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
    const refreshTodoTasks = () => {
      setTodoTasks(readTodoTasks());
      setTodoArchivedTasks(readTodoArchivedTasks());
    };

    refreshTodoTasks();

    window.addEventListener('focus', refreshTodoTasks);
    window.addEventListener('storage', refreshTodoTasks);

    return () => {
      window.removeEventListener('focus', refreshTodoTasks);
      window.removeEventListener('storage', refreshTodoTasks);
    };
  }, [activeTab]);

  const todoTaskById = useMemo(() => {
    return todoTasks.reduce((acc, task) => {
      if (task?.id) acc[task.id] = task;
      return acc;
    }, {});
  }, [todoTasks]);

  const urgentTodoTasks = useMemo(() => getUrgentTodoTasks(todoTasks), [todoTasks]);

  const handleTodoTasksChange = (nextTasks) => {
    const normalized = normalizeTodoTaskList(nextTasks);
    setTodoTasks(normalized.tasks);
    writeTodoTasks(normalized.tasks);
  };

  const handleEditTodoTask = (task) => {
    if (!task?.id) return;

    setTodoEditTaskId(task.id);
    setActiveTab('todo');
  };

  const handleToggleTodoCompletion = (taskId) => {
    const nextTasks = todoTasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            completed: !task.completed,
            completedAt: !task.completed ? new Date().toISOString() : '',
          }
        : task
    );

    handleTodoTasksChange(nextTasks);
  };

  const handleUpdateTodoField = (taskId, field, value) => {
    const nextTasks = todoTasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            [field]: value,
          }
        : task
    );

    handleTodoTasksChange(nextTasks);
  };


  const handleArchiveTodoTask = (taskId) => {
    const taskToArchive = todoTasks.find((task) => task.id === taskId);

    if (!taskToArchive) return;

    const updatedArchivedTasks = appendArchivedTodoTask(taskToArchive);
    setTodoArchivedTasks(updatedArchivedTasks);
    handleTodoTasksChange(todoTasks.filter((task) => task.id !== taskId));
    setSaveStatus({ type: 'success', message: 'To-do task archived successfully!' });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleRestoreArchivedTodoTask = (id) => {
    const archivedTask = todoArchivedTasks.find((task) => task.id === id);
    if (!archivedTask) return;

    const { archivedAt, ...restoredTask } = archivedTask;
    const updatedArchivedTasks = todoArchivedTasks.filter((task) => task.id !== id);
    const updatedTasks = [restoredTask, ...todoTasks];

    setTodoArchivedTasks(updatedArchivedTasks);
    writeTodoArchivedTasks(updatedArchivedTasks);
    handleTodoTasksChange(updatedTasks);
    setSaveStatus({ type: 'success', message: 'To-do task restored successfully!' });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleDeleteArchivedTodoTask = (id) => {
    if (!confirm('Permanently delete this archived to-do task?')) return;

    const updatedArchivedTasks = todoArchivedTasks.filter((task) => task.id !== id);
    setTodoArchivedTasks(updatedArchivedTasks);
    writeTodoArchivedTasks(updatedArchivedTasks);
    setSaveStatus({ type: 'success', message: 'Archived to-do task deleted permanently!' });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const tabs = useMemo(
    () => [
      { id: 'dashboard', label: 'Dashboard', bgColor: 'bg-blue-100' },
      { id: 'todo', label: 'To-Do', bgColor: 'bg-red-100' },
      { id: 'editor', label: 'Editor', bgColor: 'bg-orange-100' },
      { id: 'analysis', label: 'Analysis', bgColor: 'bg-purple-100' },
      { id: 'calculator', label: 'Calculator', bgColor: 'bg-green-100' },
    ],
    []
  );

  const activeTabConfig = useMemo(
    () => tabs.find((t) => t.id === activeTab),
    [tabs, activeTab]
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
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-black text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
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
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => setIsStatementScannerOpen(true)}
              className="p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"
              title="Scan Statement"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </button>

            <button
              onClick={() => setIsBudgetArchiveDrawerOpen(true)}
              className="p-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-1"
              title="Budget Archives"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                />
              </svg>
              <span className="text-xs">({state.archived?.length || 0})</span>
            </button>

            <button
              onClick={() => setIsTodoArchiveDrawerOpen(true)}
              className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1"
              title="To-Do Archives"
            >
              <Archive className="w-4 h-4" />
              <span className="text-xs">({todoArchivedTasks.length})</span>
            </button>

            <button
              onClick={() => setShowExportDialog(true)}
              className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              title="Export JSON"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
            </button>

            <label
              className="p-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors cursor-pointer"
              title="Import JSON"
            >
              <input
                type="file"
                accept=".json"
                onChange={handleImportJSON}
                className="hidden"
              />
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
            </label>

            <button
              onClick={() => saveBudget()}
              disabled={isSaving}
              className={`p-2 rounded-lg transition-colors ${
                isSaving
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
              title="Save Budget"
            >
              {isSaving ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </StickyToolbar>

      <div className={`${activeTabConfig?.bgColor || 'bg-white'} min-h-screen`}>
        {activeTab === 'dashboard' && (
          <>
            <PageContainer className="py-6 space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl px-6 py-4 mb-6">
                <h2 className="text-2xl font-bold text-slate-800">
                  Budget Dashboard
                </h2>
              </div>

              <DashboardOverviewStrip
                state={state}
                todoTasks={todoTasks}
                onNavigateToTab={setActiveTab}
                onOpenUrgentPayments={() => setIsUrgentPaymentAlertOpen(true)}
                onOpenUrgentTodos={() => setIsUrgentTodoAlertOpen(true)}
              />

              <TodoListSection
                tasks={todoTasks}
                taskById={todoTaskById}
                searchQuery={searchQuery}
                onToggle={handleToggleTodoCompletion}
                onUpdateField={handleUpdateTodoField}
                onArchive={handleArchiveTodoTask}
                onOpenArchives={() => setIsTodoArchiveDrawerOpen(true)}
                archivedCount={todoArchivedTasks.length}
                onEdit={handleEditTodoTask}
              />
            </PageContainer>

            <DashboardTab
              state={state}
              setState={setState}
              saveBudget={saveBudget}
              searchQuery={searchQuery}
              showUrgentAlert={isUrgentPaymentAlertOpen}
              onCloseUrgentAlert={() => setIsUrgentPaymentAlertOpen(false)}
            />
          </>
        )}

        {activeTab === 'analysis' && (
          <AnalysisTab
            state={state}
            setState={setState}
            saveBudget={saveBudget}
            searchQuery={searchQuery}
          />
        )}

        {activeTab === 'calculator' && (
          <CalculatorTab
            state={state}
            setState={setState}
            saveBudget={saveBudget}
            searchQuery={searchQuery}
          />
        )}

        {activeTab === 'todo' && (
          <TodoTab
            editTaskId={todoEditTaskId}
            onEditTaskLoaded={() => setTodoEditTaskId('')}
          />
        )}

        {activeTab === 'editor' && (
          <EditorTab
            state={state}
            setState={setState}
            saveBudget={saveBudget}
            searchQuery={searchQuery}
          />
        )}
      </div>

      <UrgentTodoAlertModal
        tasks={urgentTodoTasks}
        isOpen={isUrgentTodoAlertOpen}
        onClose={() => setIsUrgentTodoAlertOpen(false)}
        onEditTask={(task) => {
          setIsUrgentTodoAlertOpen(false);
          handleEditTodoTask(task);
        }}
      />

      <ArchivedDrawer
        isOpen={isBudgetArchiveDrawerOpen}
        onClose={() => setIsBudgetArchiveDrawerOpen(false)}
        archivedItems={state.archived || []}
        onRestore={handleRestoreArchived}
        onDelete={handleDeleteArchived}
        archiveType="budget"
        title="Budget Archives"
      />

      <ArchivedDrawer
        isOpen={isTodoArchiveDrawerOpen}
        onClose={() => setIsTodoArchiveDrawerOpen(false)}
        archivedItems={todoArchivedTasks}
        onRestore={handleRestoreArchivedTodoTask}
        onDelete={handleDeleteArchivedTodoTask}
        archiveType="todo"
        title="To-Do Archives"
      />

      <StatementScanner
        isOpen={isStatementScannerOpen}
        onClose={() => setIsStatementScannerOpen(false)}
        onImport={handleStatementImport}
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
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleExportJSON}
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