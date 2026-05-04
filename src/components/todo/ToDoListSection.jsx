import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit3,
  FileText,
  Minus,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";

const TYPE_ORDER = [
  "Medical",
  "DMV / Vehicle",
  "Insurance",
  "DPSS / Benefits",
  "Legal",
  "Moving",
  "Work",
  "Dental",
  "Phone / Lifeline",
  "General",
];

const TYPE_STYLES = {
  Medical: { icon: "text-blue-600" },
  "DMV / Vehicle": { icon: "text-orange-600" },
  Insurance: { icon: "text-red-600" },
  "DPSS / Benefits": { icon: "text-green-600" },
  Legal: { icon: "text-purple-600" },
  Moving: { icon: "text-cyan-600" },
  Work: { icon: "text-slate-600" },
  Dental: { icon: "text-pink-600" },
  "Phone / Lifeline": { icon: "text-teal-600" },
  General: { icon: "text-slate-600" },
};

const parseTaskDate = (value) => {
  if (!value) return null;

  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;

  const date = new Date(parsed);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getDaysUntil = (value) => {
  const date = parseTaskDate(value);
  if (!date) return null;

  return Math.ceil((date.getTime() - getToday().getTime()) / 86400000);
};

const getTaskDate = (task) => task.deadline || task.date || task.effectiveDate || "";

const getTaskStatus = (task, taskById = {}) => {
  if (task.completed) return "completed";

  const blocker = task.blockedBy ? taskById[task.blockedBy] : null;
  if (blocker && !blocker.completed) return "blocked";

  const daysUntil = getDaysUntil(getTaskDate(task));
  if (daysUntil !== null && daysUntil < 0) return "overdue";
  if (daysUntil !== null && daysUntil <= 5) return "dueSoon";

  return "pending";
};

const getStatusLabel = (task, taskById = {}) => {
  const status = getTaskStatus(task, taskById);
  const daysUntil = getDaysUntil(getTaskDate(task));

  if (status === "completed") return "Done";
  if (status === "blocked") return "Blocked";
  if (status === "overdue") return `Overdue (${Math.abs(daysUntil)} days)`;
  if (status === "dueSoon") return daysUntil === 0 ? "Due today" : `Due in ${daysUntil} days`;

  return "Pending";
};

const getStatusClass = (task, taskById = {}) => {
  const status = getTaskStatus(task, taskById);

  if (status === "completed") return "bg-green-100 text-green-800";
  if (status === "blocked") return "bg-purple-100 text-purple-800";
  if (status === "overdue") return "bg-red-100 text-red-800";
  if (status === "dueSoon") return "bg-yellow-100 text-yellow-800";

  return "bg-slate-100 text-slate-800";
};

const groupTasksByType = (tasks) => {
  const groups = tasks.reduce((acc, task) => {
    const type = task.type || "General";
    if (!acc[type]) acc[type] = [];
    acc[type].push(task);
    return acc;
  }, {});

  return Object.fromEntries(
    Object.entries(groups).sort(([a], [b]) => {
      const aIndex = TYPE_ORDER.indexOf(a);
      const bIndex = TYPE_ORDER.indexOf(b);

      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      return a.localeCompare(b);
    })
  );
};

const getFieldsToShow = (task, typeFields = {}) => {
  return Array.from(
    new Set([...(typeFields[task.type] || []), ...Object.keys(task).filter((field) => task[field])])
  ).filter((field) => !["id", "completed", "taskName", "details", "type", "blockedBy"].includes(field));
};

const getFilterButtonClass = (active, activeClass, inactiveClass) => {
  return `px-3 py-1 rounded-full text-xs font-medium transition-colors ${
    active ? `ring-2 ring-white ${activeClass}` : inactiveClass
  }`;
};

const getTaskSearchText = (task) =>
  Object.values(task || {})
    .filter((value) => value !== undefined && value !== null)
    .join(" ")
    .toLowerCase();

const noop = () => {};

export default function TodoListSection({
  tasks = [],
  taskById = {},
  controlledByMap = {},
  typeFields = {},
  fieldLabels = {},
  multilineFields = new Set(),
  sortTasks,
  searchQuery = "",
  onEdit,
  onDelete,
  onToggle,
  onUpdateField,
}) {
  const [expandedTypes, setExpandedTypes] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");
  const canToggle = typeof onToggle === "function";
  const canEdit = typeof onEdit === "function";
  const canDelete = typeof onDelete === "function";
  const canUpdateField = typeof onUpdateField === "function";

  const sortedTasks = useMemo(() => {
    if (typeof sortTasks === "function") return sortTasks(tasks);
    return [...tasks];
  }, [tasks, sortTasks]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = String(searchQuery || "").trim().toLowerCase();

    return sortedTasks.filter((task) => {
      if (statusFilter !== "all" && getTaskStatus(task, taskById) !== statusFilter) return false;
      if (normalizedQuery && !getTaskSearchText(task).includes(normalizedQuery)) return false;
      return true;
    });
  }, [sortedTasks, statusFilter, taskById, searchQuery]);

  const groupedTasks = useMemo(() => groupTasksByType(filteredTasks), [filteredTasks]);

  const toggleType = (type) => {
    setExpandedTypes((current) => ({
      ...current,
      [type]: !current[type],
    }));
  };

  const expandAll = () => {
    const nextExpanded = {};
    Object.keys(groupedTasks).forEach((type) => {
      nextExpanded[type] = true;
    });
    setExpandedTypes(nextExpanded);
  };

  const collapseAll = () => {
    setExpandedTypes({});
  };

  return (
    <section className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 rounded-xl overflow-hidden mb-6">
      <div className="bg-red-600 text-white px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold whitespace-nowrap">To-Do List</h3>

          <button
            type="button"
            onClick={expandAll}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title="Expand All Task Groups"
          >
            <Plus className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={collapseAll}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title="Collapse All Task Groups"
          >
            <Minus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: "all", label: "All Tasks", color: "bg-white/20 hover:bg-white/30" },
            { id: "overdue", label: "Overdue", color: "bg-red-500/80 hover:bg-red-500" },
            { id: "dueSoon", label: "Due Soon", color: "bg-yellow-500/80 hover:bg-yellow-500" },
            { id: "pending", label: "Pending", color: "bg-blue-400/80 hover:bg-blue-400" },
            { id: "blocked", label: "Blocked", color: "bg-purple-500/80 hover:bg-purple-500" },
            { id: "completed", label: "Done", color: "bg-green-500/80 hover:bg-green-500" },
          ].map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              className={getFilterButtonClass(statusFilter === filter.id, filter.color, filter.color)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="p-8 text-center bg-white">
          <FileText className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-500">No tasks match the current filter.</p>
        </div>
      ) : (
        <div>
          {Object.entries(groupedTasks).map(([type, items]) => {
            const expanded = Boolean(expandedTypes[type]);
            const styles = TYPE_STYLES[type] || TYPE_STYLES.General;
            const statusCounts = {
              overdue: items.filter((task) => getTaskStatus(task, taskById) === "overdue").length,
              dueSoon: items.filter((task) => getTaskStatus(task, taskById) === "dueSoon").length,
              blocked: items.filter((task) => getTaskStatus(task, taskById) === "blocked").length,
            };

            return (
              <div key={type} className="border-b border-gray-200 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleType(type)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <FileText className={`w-5 h-5 ${styles.icon}`} />
                    <span className="font-medium text-sm sm:text-base">{type}</span>
                    <span className="text-xs sm:text-sm text-gray-500">({items.length})</span>

                    <div className="flex gap-1">
                      {statusCounts.overdue > 0 && (
                        <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {statusCounts.overdue}
                        </span>
                      )}

                      {statusCounts.dueSoon > 0 && (
                        <span className="px-2 py-0.5 bg-yellow-500 text-white text-xs rounded-full flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {statusCounts.dueSoon}
                        </span>
                      )}

                      {statusCounts.blocked > 0 && (
                        <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          {statusCounts.blocked}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 overflow-x-auto bg-white">
                    <table className="w-full min-w-[1000px]">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-72">Task</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-32">Due Date</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-40">Status</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-96">Details</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 w-40">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="bg-white">
                        {items.map((task) => {
                          const blocker = task.blockedBy ? taskById[task.blockedBy] : null;
                          const controls = controlledByMap[task.id] || [];
                          const fieldsToShow = getFieldsToShow(task, typeFields);

                          return (
                            <tr
                              key={task.id}
                              className={`border-t border-gray-200 hover:bg-red-50 ${
                                blocker && !blocker.completed ? "bg-purple-50" : "bg-white"
                              }`}
                            >
                              <td className="px-3 py-2 text-sm align-top">
                                <label className="flex items-start gap-2">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(task.completed)}
                                    onChange={() => (canToggle ? onToggle(task.id) : noop())}
                                    disabled={!canToggle}
                                    className="mt-0.5 h-4 w-4"
                                  />

                                  <span className="min-w-0">
                                    <span className={`${task.completed ? "text-slate-400 line-through" : "text-gray-900"}`}>
                                      {task.taskName || "Untitled task"}
                                    </span>

                                    {task.details && (
                                      <span className="mt-1 block whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
                                        {task.details}
                                      </span>
                                    )}
                                  </span>
                                </label>
                              </td>

                              <td className="px-3 py-2 text-sm align-top whitespace-nowrap text-gray-700">
                                {getTaskDate(task) || "N/A"}
                              </td>

                              <td className="px-3 py-2 align-top whitespace-nowrap">
                                <span className={`px-2 py-1 text-xs rounded-full ${getStatusClass(task, taskById)}`}>
                                  {getStatusLabel(task, taskById)}
                                </span>
                              </td>

                              <td className="px-3 py-2 text-sm align-top text-gray-700">
                                {blocker && !blocker.completed && (
                                  <div className="mb-2 rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-900">
                                    Blocked by: {blocker.taskName}
                                  </div>
                                )}

                                {controls.length > 0 && (
                                  <div className="mb-2 rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                                    Controls: {controls.map((item) => item.taskName).join(", ")}
                                  </div>
                                )}

                                {fieldsToShow.length > 0 ? (
                                  <div className="grid gap-2 md:grid-cols-2">
                                    {fieldsToShow.map((field) => (
                                      <label key={field} className="text-xs font-medium text-gray-600">
                                        {fieldLabels[field] || field}

                                        <div className="mt-1">
                                          {multilineFields.has(field) ? (
                                            <textarea
                                              value={task[field] || ""}
                                              onChange={(event) =>
                                                canUpdateField ? onUpdateField(task.id, field, event.target.value) : noop()
                                              }
                                              readOnly={!canUpdateField}
                                              rows={2}
                                              className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-normal text-gray-900 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                                            />
                                          ) : (
                                            <input
                                              value={task[field] || ""}
                                              onChange={(event) =>
                                                canUpdateField ? onUpdateField(task.id, field, event.target.value) : noop()
                                              }
                                              readOnly={!canUpdateField}
                                              className="w-full rounded border border-gray-300 px-2 py-1 text-xs font-normal text-gray-900 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-red-500"
                                            />
                                          )}
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">No additional fields.</span>
                                )}
                              </td>

                              <td className="px-3 py-2 align-top whitespace-nowrap">
                                <div className="flex flex-wrap gap-2">
                                  {canToggle && (
                                    <button
                                      type="button"
                                      onClick={() => onToggle(task.id)}
                                      className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      {task.completed ? "Reopen" : "Done"}
                                    </button>
                                  )}

                                  {canEdit && (
                                    <button
                                      type="button"
                                      onClick={() => onEdit(task)}
                                      className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      Edit
                                    </button>
                                  )}

                                  {canDelete && (
                                    <button
                                      type="button"
                                      onClick={() => onDelete(task.id)}
                                      className="inline-flex items-center gap-1 rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}