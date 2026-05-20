import React, { useMemo, useState } from "react";
import {
  Archive,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
  FileText,
  Minus,
  Plus,
  Printer,
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

const TYPE_OPTIONS = TYPE_ORDER;

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

const OWNER_LABELS = ["David", "Carmen", "David + Carmen"];

const OWNER_BADGE_CLASSES = {
  David: "border-blue-200 bg-blue-100 text-blue-800",
  Carmen: "border-pink-200 bg-pink-100 text-pink-800",
  "David + Carmen": "border-purple-200 bg-purple-100 text-purple-800",
};

const DEFAULT_FIELD_LABELS = {
  taskName: "Task",
  details: "Details",
  type: "Type",
  date: "Date",
  deadline: "Deadline",
  phone: "Phone",
  address: "Address",
  caseNumber: "Case #",
  citationNumber: "Citation #",
  plate: "Plate",
  vin: "VIN",
  policyNumber: "Policy #",
  amount: "Amount",
  website: "Website",
  hoursOfOperation: "Hours of Operation",
  documents: "Documents",
  questions: "Questions",
  outcome: "Outcome",
  notes: "Notes",
  followUpNotes: "Follow-up Notes",
  fileName: "File Name",
  company: "Company",
  vehicle: "Vehicle",
  policyStatus: "Policy Status",
  effectiveDate: "Effective Date",
  impact: "Impact",
  requiredAction: "Required Action",
  systemLink: "System Link",
  person: "Person",
  organization: "Organization",
};

const FIELD_DISPLAY_ORDER = [
  "person",
  "organization",
  "phone",
  "address",
  "date",
  "deadline",
  "caseNumber",
  "citationNumber",
  "plate",
  "vin",
  "vehicle",
  "company",
  "policyNumber",
  "policyStatus",
  "effectiveDate",
  "amount",
  "website",
  "hoursOfOperation",
  "systemLink",
  "documents",
  "questions",
  "requiredAction",
  "impact",
  "outcome",
  "fileName",
];

const HIDDEN_DETAIL_FIELDS = new Set([
  "id",
  "completed",
  "completedAt",
  "taskName",
  "details",
  "type",
  "blockedBy",
  "notes",
  "followUpNotes",
  "typeOverride",
  "ownerOverride",
]);

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

const getDisplayTaskType = (task = {}) => {
  if (TYPE_OPTIONS.includes(task.typeOverride)) return task.typeOverride;

  const text = [
    task.taskName,
    task.details,
    task.notes,
    task.followUpNotes,
    task.organization,
    task.person,
    task.company,
    task.website,
    task.hoursOfOperation,
    task.systemLink,
    task.caseNumber,
    task.policyNumber,
    task.plate,
    task.vin,
    task.documents,
    task.questions,
    task.requiredAction,
    task.impact,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    /(dr\.?\s|doctor|medical|clinic|podiatry|urology|oncology|cardiology|ophthalmology|dermatology|psychiatry|wound|blood draw|quest|lab|authorization|referral|antibiotics|testosterone|psa|estradiol|cbc|cmp|ct lung)/i.test(
      text
    )
  ) {
    return "Medical";
  }

  if (/(dental|dentist|teeth|bhakta)/i.test(text)) return "Dental";
  if (/(insurance|integon|policy|coverage|carrier|premium|cancelled|canceled|effective date|policy status)/i.test(text)) return "Insurance";
  if (/(dmv|registration|plate|vin|vehicle|license|parking citation|citationprocessingcenter)/i.test(text)) return "DMV / Vehicle";
  if (/(dpss|calfresh|medi-cal|gr\b|benefitscal|benefits|redetermination|case\s?#|lifeline support)/i.test(text)) return "DPSS / Benefits";
  if (/(court|legal|attorney|lawyer|hearing|notice|eviction|custodio|dubey)/i.test(text)) return "Legal";
  if (/(move|moving|move-in|move-out|storage|rental|211 la)/i.test(text)) return "Moving";
  if (/(lifeline|phone|wireless|safelink|truconnect|assurance wireless|california lifeline)/i.test(text)) return "Phone / Lifeline";
  if (/(work|job|shift|schedule|reactivation|retraining|csc)/i.test(text)) return "Work";

  return task.type || "General";
};

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
    const type = getDisplayTaskType(task);
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

const getTaskSearchText = (task) =>
  Object.values(task || {})
    .filter((value) => value !== undefined && value !== null)
    .join(" ")
    .toLowerCase();

const getFieldLabel = (field, fieldLabels = {}) => {
  return fieldLabels[field] || DEFAULT_FIELD_LABELS[field] || field;
};

const getFieldsToShow = (task, typeFields = {}) => {
  const displayType = getDisplayTaskType(task);
  const preferredFields = typeFields[displayType] || typeFields[task.type] || [];

  const fields = Array.from(
    new Set([
      ...preferredFields,
      ...FIELD_DISPLAY_ORDER,
      ...Object.keys(task || {}),
    ])
  );

  return fields.filter((field) => {
    if (HIDDEN_DETAIL_FIELDS.has(field)) return false;

    const value = task[field];
    return value !== undefined && value !== null && String(value).trim() !== "";
  });
};

const getFilterButtonClass = (active, activeClass, inactiveClass) => {
  return `px-3 py-1 rounded-full text-xs font-medium transition-colors ${
    active ? `ring-2 ring-white ${activeClass}` : inactiveClass
  }`;
};

const getTaskOwnerLabel = (task = {}) => {
  if (OWNER_LABELS.includes(task.ownerOverride)) return task.ownerOverride;

  const text = [
    task.taskName,
    task.details,
    task.notes,
    task.followUpNotes,
    task.person,
    task.organization,
    task.documents,
    task.questions,
    task.requiredAction,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const hasDavid = /\bdavid\b|david g hallstrom|hallstrom ii|case:\s*david|applicant:\s*david/i.test(text);
  const hasCarmen = /\bcarmen\b|maria burciaga|maria d\.? hallstrom|maria hallstrom/i.test(text);

  if (hasDavid && hasCarmen) return "David + Carmen";
  if (hasDavid) return "David";
  if (hasCarmen) return "Carmen";

  return "";
};

const getOwnerBadgeClass = (owner) => {
  return OWNER_BADGE_CLASSES[owner] || "border-slate-200 bg-slate-100 text-slate-700";
};


const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatDateForFile = () => new Date().toISOString().slice(0, 10);

const buildTodoReportHtml = ({ tasks, taskById, typeFields, fieldLabels }) => {
  const groupedTasks = groupTasksByType(tasks);

  const sections = Object.entries(groupedTasks)
    .map(([type, items]) => {
      const taskCards = items
        .map((task) => {
          const fieldsToShow = getFieldsToShow(task, typeFields);
          const ownerLabel = getTaskOwnerLabel(task);
          const statusLabel = getStatusLabel(task, taskById);
          const dueDate = getTaskDate(task) || "N/A";
          const details = String(task.details || "").replace(/^Details:\s*/i, "");

          const detailRows = fieldsToShow
            .map(
              (field) => `
                <div class="field-row">
                  <div class="field-label">${escapeHtml(getFieldLabel(field, fieldLabels))}</div>
                  <div class="field-value">${escapeHtml(task[field]).replaceAll("\n", "<br>")}</div>
                </div>
              `
            )
            .join("");

          const notesBlock = task.notes
            ? `
              <div class="notes-block">
                <div class="notes-label">Notes</div>
                <div class="notes-value">${escapeHtml(task.notes).replaceAll("\n", "<br>")}</div>
              </div>
            `
            : "";

          const followUpNotesBlock = task.followUpNotes
            ? `
              <div class="notes-block">
                <div class="notes-label">Follow-up Notes</div>
                <div class="notes-value">${escapeHtml(task.followUpNotes).replaceAll("\n", "<br>")}</div>
              </div>
            `
            : "";

          return `
            <article class="task-card">
              <div class="task-title-row">
                <span class="checkbox">${task.completed ? "☑" : "☐"}</span>
                <div class="task-title-main">
                  <h3>${escapeHtml(task.taskName || "Untitled task")}</h3>
                  <div class="task-meta">
                    <span class="status-pill">${escapeHtml(statusLabel)}</span>
                    <span class="meta-item">Due: ${escapeHtml(dueDate)}</span>
                    ${ownerLabel ? `<span class="owner-pill">For: ${escapeHtml(ownerLabel)}</span>` : ""}
                  </div>
                </div>
              </div>
              ${details ? `<div class="task-details">${escapeHtml(details).replaceAll("\n", "<br>")}</div>` : ""}
              ${detailRows ? `<div class="field-list">${detailRows}</div>` : ""}
              ${notesBlock}
              ${followUpNotesBlock}
            </article>
          `;
        })
        .join("");

      return `
        <div class="type-heading">
          <h2>${escapeHtml(type)}</h2>
          <span>${items.length} item${items.length === 1 ? "" : "s"}</span>
        </div>
        ${taskCards}
      `;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Hallstrom To-Do List</title>
  <style>
    body {
      margin: 0;
      padding: 10px;
      font-family: Cambria, Georgia, serif;
      color: #0f172a;
      background: #f8fafc;
      font-size: 10px;
    }

    .page {
      max-width: 980px;
      margin: 0 auto;
      background: #ffffff;
      padding: 10px;
      border: 1px solid #dbe4f0;
      border-radius: 12px;
    }

    .title {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 8px;
      text-align: center;
    }

    .title h1 {
      margin: 0;
      font-size: 18px;
      line-height: 1.05;
      font-weight: 800;
    }

    .title p {
      margin: 4px 0 0;
      font-size: 11px;
      color: #475569;
    }

    .report-columns {
      column-count: 2;
      column-gap: 8px;
      column-fill: auto;
    }

    .type-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-left: 5px solid #dc2626;
      background: #fef2f2;
      padding: 4px 7px;
      border-radius: 7px;
      margin: 6px 0 5px 0;
      break-after: avoid;
      page-break-after: avoid;
    }

    .type-heading h2 {
      margin: 0;
      font-size: 13px;
      font-weight: 800;
    }

    .type-heading span {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
    }

    .task-card {
      border: 1px solid #dbe4f0;
      border-radius: 8px;
      padding: 5px 6px;
      margin: 0 0 5px 0;
      background: #ffffff;
      display: inline-block;
      width: 100%;
      box-sizing: border-box;
      break-inside: avoid-column;
      page-break-inside: auto;
    }

    .task-title-row {
      display: flex;
      align-items: flex-start;
      gap: 5px;
      margin-bottom: 4px;
    }

    .checkbox {
      font-size: 13px;
      line-height: 1.1;
    }

    .task-title-main h3 {
      margin: 0;
      font-size: 11px;
      line-height: 1.15;
      font-weight: 800;
    }

    .task-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 3px;
      margin-top: 3px;
      font-family: Arial, sans-serif;
      font-size: 10px;
    }

    .status-pill,
    .owner-pill,
    .meta-item {
      display: inline-block;
      border-radius: 999px;
      padding: 1px 5px;
      font-weight: 700;
    }

    .status-pill {
      background: #e0f2fe;
      color: #075985;
    }

    .owner-pill {
      background: #f3e8ff;
      color: #6b21a8;
    }

    .meta-item {
      background: #f1f5f9;
      color: #334155;
    }

    .task-details {
      margin: 4px 0 5px 17px;
      color: #334155;
      font-size: 10px;
      line-height: 1.2;
    }

    .field-list {
      border-top: 1px solid #e2e8f0;
      margin-top: 4px;
    }

    .field-row {
      display: grid;
      grid-template-columns: 70px 1fr;
      gap: 6px;
      padding: 2px 0;
      border-bottom: 1px solid #eef2f7;
      font-size: 10px;
      line-height: 1.2;
    }

    .field-label,
    .notes-label {
      font-weight: 800;
      color: #334155;
    }

    .field-value,
    .notes-value {
      color: #0f172a;
    }

    .notes-block {
      margin-top: 5px;
      border: 1px solid #dbe4f0;
      border-radius: 7px;
      background: #f8fafc;
      padding: 5px 6px;
      font-size: 10px;
      line-height: 1.2;
    }

    .notes-label {
      margin-bottom: 2px;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }

      .page {
        max-width: none;
        border: none;
        border-radius: 0;
        padding: 0;
      }

      .report-columns {
        column-count: 2;
        column-gap: 0.12in;
        column-fill: auto;
      }

      .task-card {
        margin-bottom: 5px;
        break-inside: avoid-column;
        page-break-inside: auto;
      }

      @page {
        size: Letter;
        margin: 0.28in;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="title">
      <h1>Hallstrom To-Do List</h1>
      <p>Structured life management list, generated ${formatDateForFile()}</p>
    </header>
    <div class="report-columns">${sections || '<p>No tasks available.</p>'}</div>
  </main>
</body>
</html>`;
};

const noop = () => {};

export default function TodoListSection({
  tasks = [],
  taskById = {},
  controlledByMap = {},
  typeFields = {},
  fieldLabels = {},
  sortTasks,
  searchQuery = "",
  onEdit,
  onDelete,
  onArchive,
  onOpenArchives,
  archivedCount = 0,
  onToggle,
  onUpdateField,
}) {
  const [expandedTypes, setExpandedTypes] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");

  const canToggle = typeof onToggle === "function";
  const canEdit = typeof onEdit === "function";
  const canDelete = typeof onDelete === "function";
  const canArchive = typeof onArchive === "function";
  const canOpenArchives = typeof onOpenArchives === "function";
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

  const handlePrintReport = () => {
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) return;

    reportWindow.document.write(
      buildTodoReportHtml({
        tasks: filteredTasks,
        taskById,
        typeFields,
        fieldLabels,
      })
    );
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  const handleDownloadWordDoc = () => {
    const html = buildTodoReportHtml({
      tasks: filteredTasks,
      taskById,
      typeFields,
      fieldLabels,
    });
    const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `Hallstrom_To-Do_List_${formatDateForFile()}.doc`;
    link.click();

    URL.revokeObjectURL(url);
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

          {canOpenArchives && (
            <button
              type="button"
              onClick={onOpenArchives}
              className="inline-flex items-center gap-1 rounded-full bg-purple-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-purple-700"
              title="Open archived to-do tasks"
            >
              <Archive className="w-3 h-3" />
              ({archivedCount})
            </button>
          )}

          <button
            type="button"
            onClick={handlePrintReport}
            className="inline-flex items-center gap-1 rounded-full bg-slate-700 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-slate-800"
            title="Print formatted to-do list"
          >
            <Printer className="w-3 h-3" />
            Print
          </button>

          <button
            type="button"
            onClick={handleDownloadWordDoc}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-emerald-700"
            title="Download formatted Word document"
          >
            <Download className="w-3 h-3" />
            Word
          </button>
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
                  <div className="px-4 pb-4 bg-white">
                    <table className="w-full table-fixed">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="w-[28%] px-3 py-2 text-left text-xs font-medium text-gray-700">Task</th>
                          <th className="w-[12%] px-3 py-2 text-left text-xs font-medium text-gray-700">Due Date</th>
                          <th className="w-[10%] px-3 py-2 text-left text-xs font-medium text-gray-700">Status</th>
                          <th className="w-[36%] px-3 py-2 text-left text-xs font-medium text-gray-700">Details</th>
                          <th className="w-[14%] px-3 py-2 text-left text-xs font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="bg-white">
                        {items.map((task) => {
                          const blocker = task.blockedBy ? taskById[task.blockedBy] : null;
                          const controls = controlledByMap[task.id] || [];
                          const fieldsToShow = getFieldsToShow(task, typeFields);
                          const ownerLabel = getTaskOwnerLabel(task);

                          return (
                            <React.Fragment key={task.id}>
                              <tr
                                className={`border-t border-gray-200 hover:bg-red-50 ${
                                  blocker && !blocker.completed ? "bg-purple-50" : "bg-white"
                                }`}
                              >
                                <td className="px-3 py-2 text-sm align-top break-words">
                                  <label className="flex items-start gap-2">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(task.completed)}
                                      onChange={() => (canToggle ? onToggle(task.id) : noop())}
                                      disabled={!canToggle}
                                      className="mt-0.5 h-4 w-4"
                                    />

                                    <span className="block min-w-0 flex-1">
                                      <span className={`font-semibold ${task.completed ? "text-slate-400 line-through" : "text-gray-900"}`}>
                                        {task.taskName || "Untitled task"}
                                      </span>

                                      {ownerLabel && (
                                        <span
                                          className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getOwnerBadgeClass(
                                            ownerLabel
                                          )}`}
                                        >
                                          {ownerLabel}
                                        </span>
                                      )}

                                      {task.details && (
                                        <span className="mt-1 block whitespace-pre-wrap text-xs leading-relaxed text-gray-600">
                                          Details: {String(task.details).replace(/^Details:\s*/i, "")}
                                        </span>
                                      )}
                                    </span>
                                  </label>
                                </td>

                                <td className="px-3 py-2 text-sm align-top text-gray-700">
                                  {getTaskDate(task) || "N/A"}
                                </td>

                                <td className="px-3 py-2 align-top">
                                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusClass(task, taskById)}`}>
                                    {getStatusLabel(task, taskById)}
                                  </span>
                                </td>

                                <td className="px-3 py-2 text-sm align-top text-gray-700 break-words">
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

                                  {fieldsToShow.length > 0 && (
                                    <div className="space-y-1.5">
                                      {fieldsToShow.map((field) => (
                                        <div key={field} className="text-xs leading-relaxed">
                                          <span className="font-semibold text-gray-600">
                                            {getFieldLabel(field, fieldLabels)}:
                                          </span>{" "}
                                          <span className="whitespace-pre-wrap break-words text-gray-900">{task[field]}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>

                                <td className="px-3 py-2 align-top" rowSpan={2}>
                                  <div className="flex flex-col items-start gap-2">
                                    {canUpdateField && (
                                      <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-700">
                                        <span>Move</span>
                                        <select
                                          value={getDisplayTaskType(task)}
                                          onChange={(event) => onUpdateField(task.id, "typeOverride", event.target.value)}
                                          className="w-full rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                          title="Move task to another category"
                                        >
                                          {TYPE_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                              {option}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                    )}

                                    {canUpdateField && (
                                      <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-700">
                                        <span>For</span>
                                        <select
                                          value={ownerLabel || ""}
                                          onChange={(event) => onUpdateField(task.id, "ownerOverride", event.target.value)}
                                          className="w-full rounded border border-purple-200 bg-purple-50 px-2 py-1 text-xs font-medium text-purple-800 hover:bg-purple-100 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                                          title="Set who this task is for"
                                        >
                                          <option value="">No label</option>
                                          {OWNER_LABELS.map((option) => (
                                            <option key={option} value={option}>
                                              {option}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                    )}

                                    {canToggle && (
                                      <button
                                        type="button"
                                        onClick={() => onToggle(task.id)}
                                        className="inline-flex w-full items-center justify-center gap-1 rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-100"
                                      >
                                        <CheckCircle2 className="w-3 h-3" />
                                        {task.completed ? "Reopen" : "Done"}
                                      </button>
                                    )}

                                    {canArchive && task.completed && (
                                      <button
                                        type="button"
                                        onClick={() => onArchive(task.id)}
                                        className="inline-flex w-full items-center justify-center gap-1 rounded border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-200"
                                        title="Archive completed task"
                                      >
                                        <Archive className="w-3 h-3" />
                                        Archive
                                      </button>
                                    )}

                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => onEdit(task)}
                                        className="inline-flex w-full items-center justify-center gap-1 rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                        Edit
                                      </button>
                                    )}

                                    {canDelete && (
                                      <button
                                        type="button"
                                        onClick={() => onDelete(task.id)}
                                        className="inline-flex w-full items-center justify-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-800 hover:bg-red-100"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>

                              <tr
                                className={`border-b border-gray-200 ${
                                  blocker && !blocker.completed ? "bg-purple-50" : "bg-white"
                                }`}
                              >
                                <td className="px-3 pb-3 pt-1 text-sm align-top" colSpan={4}>
                                  <label className="block text-xs font-semibold text-gray-700">
                                    Notes
                                    <textarea
                                      value={task.notes || ""}
                                      onChange={(event) =>
                                        canUpdateField ? onUpdateField(task.id, "notes", event.target.value) : noop()
                                      }
                                      readOnly={!canUpdateField}
                                      rows={4}
                                      placeholder="Add notes..."
                                      className="mt-1 block w-full resize-y rounded border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                                    />
                                  </label>

                                  <label className="mt-3 block text-xs font-semibold text-gray-700">
                                    Follow-up Notes
                                    <textarea
                                      value={task.followUpNotes || ""}
                                      onChange={(event) =>
                                        canUpdateField
                                          ? onUpdateField(task.id, "followUpNotes", event.target.value)
                                          : noop()
                                      }
                                      readOnly={!canUpdateField}
                                      rows={4}
                                      placeholder="Add follow-up notes..."
                                      className="mt-1 block w-full resize-y rounded border border-gray-300 bg-white px-3 py-2 text-sm font-normal text-gray-900 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                                    />
                                  </label>
                                </td>
                              </tr>
                            </React.Fragment>
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
