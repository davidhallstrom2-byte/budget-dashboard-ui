// src/components/modern/NotificationPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, AlertCircle, Clock, X, CheckCircle } from 'lucide-react';

const TODO_STORAGE_KEY = 'todoTab.tasks.v1';
const CSC_STORAGE_KEY = 'cscShifts.v1';

const readJsonStorage = (key, fallback = []) => {
  if (typeof window === 'undefined') return fallback;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || 'null');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const parseDateValue = (value) => {
  if (!value) return null;

  const raw = String(value).trim();
  if (!raw) return null;

  const mmddyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const [, month, day, year] = mmddyyyy;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDaysUntil = (value) => {
  const parsed = parseDateValue(value);
  if (!parsed) return null;

  const today = startOfDay(new Date());
  const target = startOfDay(parsed);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
};

const getReminderStatus = (value) => {
  const days = getDaysUntil(value);
  if (days === null) return 'pending';
  if (days < 0) return 'overdue';
  if (days <= 5) return 'dueSoon';
  return 'pending';
};

const getDaysText = (value) => {
  const days = getDaysUntil(value);

  if (days === null) return 'No date set';
  if (days < 0) {
    const absDays = Math.abs(days);
    return `${absDays} day${absDays !== 1 ? 's' : ''} overdue`;
  }
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days} days`;
};

const formatMoney = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));

const getBudgetItems = (state) => {
  const items = [];

  Object.entries(state?.buckets || {}).forEach(([bucket, bucketItems]) => {
    (bucketItems || []).forEach((item) => {
      if (item.status === 'paid') return;

      const status = getReminderStatus(item.dueDate);
      if (status !== 'overdue' && status !== 'dueSoon') return;

      items.push({
        id: item.id,
        key: `budget-${bucket}-${item.id}`,
        source: 'budget',
        bucket,
        status,
        label: item.category || item.item || 'Budget item',
        subLabel: bucket,
        dateValue: item.dueDate,
        amount: Number(item.actualCost || item.estimatedBudget || item.estimatedCost || item.estBudget || 0),
        raw: item,
      });
    });
  });

  return items;
};

const getTodoItems = () => {
  const tasks = readJsonStorage(TODO_STORAGE_KEY);

  return tasks
    .filter((task) => !task.completed && !task.archived)
    .map((task) => {
      const dateValue = task.deadline || task.dueDate || task.date;
      return {
        id: task.id,
        key: `todo-${task.id}`,
        source: 'todo',
        status: getReminderStatus(dateValue),
        label: task.taskName || task.title || 'To-Do task',
        subLabel: task.type || task.category || 'To-Do',
        dateValue,
        amount: 0,
        raw: task,
      };
    })
    .filter((item) => item.status === 'overdue' || item.status === 'dueSoon');
};

const getCscItems = () => {
  const shifts = readJsonStorage(CSC_STORAGE_KEY);

  return shifts
    .filter((shift) => {
      const status = String(shift.shiftStatus || shift.status || '').toLowerCase();
      return status !== 'done' && status !== 'cancelled' && status !== 'canceled';
    })
    .map((shift) => {
      const dateValue = shift.startDate || shift.date;
      const labelParts = [shift.venue, shift.event || shift.jobName].filter(Boolean);
      const timeParts = [shift.startTime, shift.finishTime].filter(Boolean);

      return {
        id: shift.id,
        key: `csc-${shift.id}`,
        source: 'csc',
        status: getReminderStatus(dateValue),
        label: labelParts.join(' - ') || 'CSC shift',
        subLabel: timeParts.length ? timeParts.join(' to ') : shift.city || 'CSC shift',
        dateValue,
        amount: Number(shift.estimatedPay || shift.pay || 0),
        raw: shift,
      };
    })
    .filter((item) => item.status === 'overdue' || item.status === 'dueSoon');
};

export default function NotificationPanel({ state, activeTab = 'budget', onMarkPaid }) {
  const [isOpen, setIsOpen] = useState(false);
  const [storageRefreshKey, setStorageRefreshKey] = useState(0);
  const panelRef = useRef(null);

  useEffect(() => {
    const refresh = () => setStorageRefreshKey((value) => value + 1);

    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('todoTab:updated', refresh);
    window.addEventListener('cscShifts:updated', refresh);

    const interval = window.setInterval(refresh, 30000);

    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('todoTab:updated', refresh);
      window.removeEventListener('cscShifts:updated', refresh);
      window.clearInterval(interval);
    };
  }, []);

  const notificationConfig = useMemo(() => {
    if (activeTab === 'todo') {
      return {
        title: 'To-Do Reminders',
        emptyTitle: 'No urgent To-Do reminders.',
        buttonTitle: 'To-Do Reminders',
        showMarkPaid: false,
        totalLabel: 'Tasks',
      };
    }

    if (activeTab === 'cscShifts') {
      return {
        title: 'CSC Shift Reminders',
        emptyTitle: 'No urgent CSC shifts.',
        buttonTitle: 'CSC Shift Reminders',
        showMarkPaid: false,
        totalLabel: 'Shifts',
      };
    }

    return {
      title: 'Payment Reminders',
      emptyTitle: 'All caught up! No urgent payments.',
      buttonTitle: 'Payment Reminders',
      showMarkPaid: true,
      totalLabel: 'Total',
    };
  }, [activeTab]);

  const allItems = useMemo(() => {
    let items;

    if (activeTab === 'todo') {
      items = getTodoItems();
    } else if (activeTab === 'cscShifts') {
      items = getCscItems();
    } else {
      items = getBudgetItems(state);
    }

    return [...items].sort((a, b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (a.status !== 'overdue' && b.status === 'overdue') return 1;

      const aDate = parseDateValue(a.dateValue)?.getTime() || 0;
      const bDate = parseDateValue(b.dateValue)?.getTime() || 0;
      return aDate - bDate;
    });
  }, [activeTab, state, storageRefreshKey]);

  const overdueCount = allItems.filter((item) => item.status === 'overdue').length;
  const dueSoonCount = allItems.filter((item) => item.status === 'dueSoon').length;
  const reminderCount = overdueCount + dueSoonCount;

  useEffect(() => {
    setIsOpen(false);
  }, [activeTab]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (!isOpen) return undefined;

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        title={notificationConfig.buttonTitle}
        aria-label={notificationConfig.buttonTitle}
      >
        <Bell className={`w-5 h-5 ${overdueCount > 0 ? 'text-red-600' : 'text-slate-600'}`} />
        {reminderCount > 0 && (
          <span className={`absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs font-bold text-white rounded-full ${
            overdueCount > 0 ? 'bg-red-600' : 'bg-yellow-600'
          }`}>
            {reminderCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50 max-h-[500px] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h3 className="font-semibold text-slate-900">{notificationConfig.title}</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-200 rounded transition-colors"
              aria-label="Close reminders"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {allItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm">{notificationConfig.emptyTitle}</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {allItems.map((item) => (
                <div
                  key={item.key}
                  className={`px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    item.status === 'overdue' ? 'bg-red-50' : 'bg-yellow-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {item.status === 'overdue' ? (
                          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                        )}
                        <span className="font-medium text-slate-900 truncate">
                          {item.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <p className={`font-semibold ${
                          item.status === 'overdue' ? 'text-red-700' : 'text-yellow-700'
                        }`}>
                          {getDaysText(item.dateValue)}
                        </p>
                        {item.source === 'budget' && (
                          <p>Amount: {formatMoney(item.amount)}</p>
                        )}
                        {item.source === 'csc' && item.amount > 0 && (
                          <p>Estimated pay: {formatMoney(item.amount)}</p>
                        )}
                        <p className="text-slate-500 capitalize">{item.subLabel}</p>
                      </div>
                    </div>

                    {notificationConfig.showMarkPaid && (
                      <button
                        onClick={() => {
                          onMarkPaid(item.bucket, item.id);
                        }}
                        className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium whitespace-nowrap flex-shrink-0"
                      >
                        Mark Paid
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {allItems.length > 0 && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs">
                <div className="space-x-3">
                  {overdueCount > 0 && (
                    <span className="text-red-700 font-semibold">
                      {overdueCount} overdue
                    </span>
                  )}
                  {dueSoonCount > 0 && (
                    <span className="text-yellow-700 font-semibold">
                      {dueSoonCount} due soon
                    </span>
                  )}
                </div>
                {activeTab === 'budget' ? (
                  <span className="text-slate-600">
                    Total: {formatMoney(allItems.reduce((sum, item) => sum + item.amount, 0))}
                  </span>
                ) : (
                  <span className="text-slate-600">
                    {notificationConfig.totalLabel}: {allItems.length}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
