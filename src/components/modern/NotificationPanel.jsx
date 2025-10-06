// src/components/modern/NotificationPanel.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Bell, AlertCircle, Clock, X, CheckCircle } from 'lucide-react';

export default function NotificationPanel({ state, onMarkPaid }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef(null);

  const getItemStatus = (item) => {
    if (item.status === 'paid') return 'paid';
    const today = new Date();
    const dueDate = new Date(item.dueDate);
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 5) return 'dueSoon';
    return 'pending';
  };

  const allItems = [];
  Object.entries(state?.buckets || {}).forEach(([bucket, items]) => {
    items.forEach(item => {
      const status = getItemStatus(item);
      if (status === 'overdue' || status === 'dueSoon') {
        allItems.push({ ...item, bucket, status });
      }
    });
  });

  allItems.sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (a.status !== 'overdue' && b.status === 'overdue') return 1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  const overdueCount = allItems.filter(i => i.status === 'overdue').length;
  const dueSoonCount = allItems.filter(i => i.status === 'dueSoon').length;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const getDaysText = (item) => {
    const today = new Date();
    const dueDate = new Date(item.dueDate);
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      const absDays = Math.abs(diffDays);
      return `${absDays} day${absDays !== 1 ? 's' : ''} overdue`;
    }
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return 'Due tomorrow';
    return `Due in ${diffDays} days`;
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        title="Payment Reminders"
      >
        <Bell className={`w-5 h-5 ${overdueCount > 0 ? 'text-red-600' : 'text-slate-600'}`} />
        {(overdueCount > 0 || dueSoonCount > 0) && (
          <span className={`absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center text-xs font-bold text-white rounded-full ${
            overdueCount > 0 ? 'bg-red-600' : 'bg-yellow-600'
          }`}>
            {overdueCount + dueSoonCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50 max-h-[500px] overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h3 className="font-semibold text-slate-900">Payment Reminders</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-slate-200 rounded transition-colors"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          {allItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-500">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-sm">All caught up! No urgent payments.</p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              {allItems.map((item) => (
                <div
                  key={`${item.bucket}-${item.id}`}
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
                          {item.category}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 space-y-0.5">
                        <p className={`font-semibold ${
                          item.status === 'overdue' ? 'text-red-700' : 'text-yellow-700'
                        }`}>
                          {getDaysText(item)}
                        </p>
                        <p>Amount: ${(item.actualCost || item.estBudget || 0).toFixed(2)}</p>
                        <p className="text-slate-500 capitalize">{item.bucket}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        onMarkPaid(item.bucket, item.id);
                      }}
                      className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium whitespace-nowrap flex-shrink-0"
                    >
                      Mark Paid
                    </button>
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
                <span className="text-slate-600">
                  Total: ${allItems.reduce((sum, item) => sum + (item.actualCost || item.estBudget || 0), 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}