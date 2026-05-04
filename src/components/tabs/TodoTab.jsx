import React, { useEffect, useMemo, useRef, useState } from "react";
import PageContainer from "../common/PageContainer";
import PremiumTodoListView from "../todo/PremiumTodoListView";

const STORAGE_KEY = "todoTab.tasks.v1";
const STORAGE_BACKUP_KEY = "todoTab.tasks.backup.v1";

const TASK_TYPES = [
  "General",
  "Medical",
  "DMV / Vehicle",
  "Insurance",
  "DPSS / Benefits",
  "Legal",
  "Moving",
  "Work",
  "Dental",
  "Phone / Lifeline",
];

const DEFAULT_FORM = {
  taskName: "",
  details: "",
  type: "General",
  date: "",
  phone: "",
  address: "",
  deadline: "",
  blockedBy: "",
  person: "",
  organization: "",
  website: "",
  plate: "",
  vin: "",
  policyNumber: "",
  caseNumber: "",
  amount: "",
  documents: "",
  questions: "",
  outcome: "",
  fileName: "",
  notes: "",
  company: "",
  vehicle: "",
  policyStatus: "",
  effectiveDate: "",
  impact: "",
  requiredAction: "",
  systemLink: "",
  completed: false,
};

const FIELD_LABELS = {
  phone: ["phone", "tel", "telephone"],
  address: ["address", "location"],
  deadline: ["deadline", "due", "due date", "reg due", "registration due", "suspension"],
  date: ["date", "appointment date", "visit date", "order date"],
  caseNumber: ["case", "case #", "case number", "citation", "citation #", "citation number", "id"],
  amount: ["amount", "balance", "fee", "cost", "total", "payment"],
  plate: ["plate", "license plate"],
  vin: ["vin"],
  policyNumber: ["policy", "policy #", "policy number"],
  company: ["company", "carrier", "insurance company", "insurer"],
  vehicle: ["vehicle", "car", "auto"],
  policyStatus: ["policy status", "insurance status", "status"],
  effectiveDate: ["effective date", "start date", "coverage date"],
  impact: ["impact", "effect", "risk"],
  requiredAction: ["required action", "action required", "next step", "next steps"],
  systemLink: ["system link", "link", "website", "url", "portal"],
  person: ["person", "name", "patient", "client"],
  organization: ["organization", "agency", "office", "provider"],
  website: ["website", "site", "portal"],
  documents: ["documents", "docs", "bring", "upload", "submit"],
  questions: ["questions", "ask", "ask about"],
  outcome: ["outcome", "result", "goal"],
  notes: ["notes", "note"],
  fileName: ["file", "file name", "filename"],
};

const FIELD_LABEL_DISPLAY = {
  taskName: "Task name",
  details: "Details",
  type: "Type",
  date: "Date",
  phone: "Phone",
  address: "Address",
  deadline: "Deadline",
  blockedBy: "Blocked by",
  person: "Person",
  organization: "Organization",
  website: "Website",
  plate: "Plate",
  vin: "VIN",
  policyNumber: "Policy #",
  caseNumber: "Case / Citation #",
  amount: "Amount",
  documents: "Documents",
  questions: "Questions",
  outcome: "Outcome",
  fileName: "File name",
  notes: "Notes",
  company: "Company",
  vehicle: "Vehicle",
  policyStatus: "Policy status",
  effectiveDate: "Effective date",
  impact: "Impact",
  requiredAction: "Required action",
  systemLink: "System link",
};

const TYPE_FIELDS = {
  General: ["date", "deadline", "phone", "website", "documents", "questions", "outcome", "notes"],
  Medical: ["person", "organization", "phone", "address", "date", "deadline", "documents", "questions", "outcome", "notes"],
  "DMV / Vehicle": ["plate", "vin", "vehicle", "date", "deadline", "amount", "caseNumber", "phone", "website", "systemLink", "documents", "requiredAction", "impact", "notes"],
  Insurance: ["company", "policyNumber", "policyStatus", "effectiveDate", "phone", "website", "systemLink", "amount", "deadline", "requiredAction", "impact", "documents", "notes"],
  "DPSS / Benefits": ["person", "organization", "caseNumber", "phone", "website", "systemLink", "deadline", "amount", "documents", "questions", "outcome", "notes"],
  Legal: ["person", "organization", "caseNumber", "phone", "address", "date", "deadline", "amount", "website", "systemLink", "documents", "questions", "outcome", "notes"],
  Moving: ["date", "deadline", "address", "phone", "amount", "documents", "questions", "outcome", "notes"],
  Work: ["organization", "person", "phone", "website", "date", "deadline", "documents", "questions", "outcome", "notes"],
  Dental: ["person", "organization", "phone", "address", "date", "deadline", "documents", "questions", "outcome", "notes"],
  "Phone / Lifeline": ["person", "company", "phone", "website", "systemLink", "caseNumber", "deadline", "documents", "questions", "outcome", "notes"],
};

const MULTILINE_FIELDS = new Set(["details", "documents", "questions", "outcome", "notes", "impact", "requiredAction"]);

const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createEmptyTask = () => ({
  ...DEFAULT_FORM,
  id: createId(),
});

const readStoredTasks = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;

    const backup = localStorage.getItem(STORAGE_BACKUP_KEY);
    const backupParsed = backup ? JSON.parse(backup) : [];
    return Array.isArray(backupParsed) ? backupParsed : [];
  } catch {
    return [];
  }
};

const normalizeText = (value = "") =>
  String(value)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();

const normalizeLabel = (label = "") =>
  label
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .replace(/[:-]+$/g, "")
    .trim();

const getFieldFromLabel = (rawLabel = "") => {
  const label = normalizeLabel(rawLabel);

  for (const [field, labels] of Object.entries(FIELD_LABELS)) {
    if (labels.some((item) => label === item || label.startsWith(`${item} `))) return field;
  }

  return null;
};

const cleanTaskName = (line = "") =>
  line
    .replace(/^\s*\[\s*\]\s*/i, "")
    .replace(/^\s*[-•]\s*/i, "")
    .trim();

const isTaskStartLine = (line = "") => /^\s*\[\s*\]\s+/.test(line);

const splitTasksFromText = (text = "") => {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const lines = normalized.split("\n");
  const groups = [];
  let current = [];

  lines.forEach((line) => {
    if (isTaskStartLine(line) && current.length) {
      groups.push(current.join("\n").trim());
      current = [line];
    } else if (line.trim()) {
      current.push(line);
    }
  });

  if (current.length) groups.push(current.join("\n").trim());
  return groups.length ? groups : [normalized];
};

const extractLabeledField = (line = "") => {
  const colonMatch = line.match(/^\s*([^:]+?)\s*:\s*(.+?)\s*$/);

  if (colonMatch) {
    const field = getFieldFromLabel(colonMatch[1]);
    if (field) return { field, value: colonMatch[2].trim() };
  }

  const dashMatch = line.match(/^\s*([A-Za-z][A-Za-z\s/#]+?)\s+-\s+(.+?)\s*$/);

  if (dashMatch) {
    const field = getFieldFromLabel(dashMatch[1]);
    if (field) return { field, value: dashMatch[2].trim() };
  }

  return null;
};

const appendField = (task, field, value) => {
  const cleanValue = String(value || "").trim();
  if (!cleanValue) return;

  if (!task[field]) {
    task[field] = cleanValue;
    return;
  }

  if (!String(task[field]).includes(cleanValue)) {
    task[field] = `${task[field]}\n${cleanValue}`;
  }
};

const inferTaskType = (task) => {
  const haystack = [
    task.taskName,
    task.details,
    task.notes,
    task.organization,
    task.company,
    task.website,
    task.systemLink,
    task.caseNumber,
    task.policyNumber,
    task.plate,
    task.vin,
    task.documents,
    task.requiredAction,
    task.impact,
  ]
    .join(" ")
    .toLowerCase();

  if (/(insurance|integon|policy|coverage|carrier|premium|cancelled|canceled|effective date|policy status)/i.test(haystack)) return "Insurance";
  if (/(dmv|registration|plate|vin|vehicle|license|parking citation|citationprocessingcenter)/i.test(haystack)) return "DMV / Vehicle";
  if (/(dpss|calfresh|medi-cal|gr\b|benefitscal|benefits|redetermination|case\s?#|lifeline support)/i.test(haystack)) return "DPSS / Benefits";
  if (/(doctor|medical|clinic|podiatry|urology|oncology|cardiology|blood draw|quest|lab|authorization|referral|antibiotics|wound)/i.test(haystack)) return "Medical";
  if (/(court|legal|attorney|lawyer|hearing|notice|eviction|custodio|dubey)/i.test(haystack)) return "Legal";
  if (/(move|moving|move-in|move-out|storage|rental|211 la)/i.test(haystack)) return "Moving";
  if (/(work|job|shift|schedule|reactivation|retraining|csc)/i.test(haystack)) return "Work";
  if (/(dental|dentist|teeth|bhakta)/i.test(haystack)) return "Dental";
  if (/(lifeline|phone|wireless|safelink|truconnect|assurance wireless|california lifeline)/i.test(haystack)) return "Phone / Lifeline";

  return "General";
};

const normalizeDerivedFields = (task) => {
  const combined = `${task.taskName}\n${task.details}\n${task.notes}\n${task.documents}\n${task.requiredAction}\n${task.impact}`;

  if (!task.phone) {
    const phoneMatch = combined.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) task.phone = phoneMatch[0].trim();
  }

  if (!task.website && !task.systemLink) {
    const urlMatch = combined.match(/https?:\/\/[^\s]+|www\.[^\s]+/i);
    if (urlMatch) {
      task.website = urlMatch[0].trim();
      task.systemLink = urlMatch[0].trim();
    }
  }

  if (!task.amount) {
    const amountMatch = combined.match(/\$\s?\d[\d,]*(?:\.\d{2})?(?:\s?→\s?\$\s?\d[\d,]*(?:\.\d{2})?)?/);
    if (amountMatch) task.amount = amountMatch[0].trim();
  }

  if (!task.plate) {
    const plateMatch = combined.match(/\bplate\s*:?\s*([A-Z0-9]{2,8})\b/i);
    if (plateMatch) task.plate = plateMatch[1].trim();
  }

  if (!task.vin) {
    const vinMatch = combined.match(/\bvin\s*:?\s*([A-HJ-NPR-Z0-9]{11,17})\b/i);
    if (vinMatch) task.vin = vinMatch[1].trim();
  }

  if (!task.policyNumber) {
    const policyMatch = combined.match(/\bpolicy\s*(?:#|number)?\s*:?\s*([A-Z0-9-]+)/i);
    if (policyMatch) task.policyNumber = policyMatch[1].trim();
  }

  if (!task.caseNumber) {
    const caseMatch = combined.match(/\b(?:case|citation|id)\s*(?:#|number)?\s*:?\s*([A-Z0-9-]+)/i);
    if (caseMatch) task.caseNumber = caseMatch[1].trim();
  }

  if (!task.company && /integon/i.test(combined)) task.company = "Integon";
  if (!task.policyStatus && /(cancelled|canceled)/i.test(combined)) task.policyStatus = "Cancelled";

  task.type = inferTaskType(task);
  return task;
};

const parseStructuredTask = (rawText = "") => {
  const task = createEmptyTask();
  const lines = normalizeText(rawText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return task;

  task.taskName = cleanTaskName(lines[0]);
  const details = [];

  lines.slice(1).forEach((line) => {
    const extracted = extractLabeledField(line);

    if (extracted) {
      appendField(task, extracted.field, extracted.value);
      return;
    }

    if (/^(documents?|docs?|bring|upload|submit)\b/i.test(line)) {
      appendField(task, "documents", line);
      return;
    }

    if (/^(questions?|ask)\b/i.test(line)) {
      appendField(task, "questions", line);
      return;
    }

    if (/^(outcome|goal|result)\b/i.test(line)) {
      appendField(task, "outcome", line);
      return;
    }

    if (/^(impact|risk|effect)\b/i.test(line)) {
      appendField(task, "impact", line);
      return;
    }

    if (/^(required action|action required|next step|next steps)\b/i.test(line)) {
      appendField(task, "requiredAction", line);
      return;
    }

    details.push(line);
  });

  task.details = details.join("\n").trim();
  return normalizeDerivedFields(task);
};

const parseTasksFromText = (text = "") =>
  splitTasksFromText(text)
    .map(parseStructuredTask)
    .filter((task) => task.taskName || task.details);

const taskMatchesAutoInsuranceRule = (task) => {
  const text = `${task.taskName} ${task.details} ${task.company} ${task.notes}`.toLowerCase();
  return text.includes("auto insurance") || text.includes("integon");
};

const isDmvRegistrationTask = (task) => {
  const text = `${task.taskName} ${task.details} ${task.type}`.toLowerCase();
  return task.type === "DMV / Vehicle" && /(dmv|registration|vehicle|plate|vin)/i.test(text);
};

const sortTasks = (tasks) => {
  return [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    const aDate = Date.parse(a.deadline || a.date || "");
    const bDate = Date.parse(b.deadline || b.date || "");

    if (Number.isNaN(aDate) && Number.isNaN(bDate)) return 0;
    if (Number.isNaN(aDate)) return 1;
    if (Number.isNaN(bDate)) return -1;

    return aDate - bDate;
  });
};

export default function TodoTab() {
  const hasHydrated = useRef(false);
  const [tasks, setTasks] = useState(readStoredTasks);
  const [form, setForm] = useState(createEmptyTask);
  const [importText, setImportText] = useState("");
  const [parsedTasks, setParsedTasks] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPremiumTodoView, setShowPremiumTodoView] = useState(false);

  useEffect(() => {
    hasHydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hasHydrated.current) return;

    const currentSaved = localStorage.getItem(STORAGE_KEY);
    if (currentSaved && currentSaved !== "[]") {
      localStorage.setItem(STORAGE_BACKUP_KEY, currentSaved);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const taskById = useMemo(() => {
    return tasks.reduce((map, task) => {
      map[task.id] = task;
      return map;
    }, {});
  }, [tasks]);

  const controlledByMap = useMemo(() => {
    return tasks.reduce((map, task) => {
      if (task.blockedBy) {
        if (!map[task.blockedBy]) map[task.blockedBy] = [];
        map[task.blockedBy].push(task);
      }
      return map;
    }, {});
  }, [tasks]);

  const visibleFormFields = useMemo(() => {
    const typeFields = TYPE_FIELDS[form.type] || TYPE_FIELDS.General;
    const valuedFields = Object.keys(DEFAULT_FORM).filter((field) => form[field] && field !== "completed");

    return Array.from(new Set([...typeFields, ...valuedFields])).filter(
      (field) => !["taskName", "details", "type", "completed", "id"].includes(field)
    );
  }, [form]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const applyAutoLinks = (incomingTasks, existingTasks) => {
    const allTasks = [...existingTasks, ...incomingTasks];
    const insuranceBlocker = [...incomingTasks, ...existingTasks].find(taskMatchesAutoInsuranceRule);

    if (!insuranceBlocker) return allTasks;

    return allTasks.map((task) => {
      if (task.id === insuranceBlocker.id) return task;
      if (isDmvRegistrationTask(task) && !task.completed) return { ...task, blockedBy: insuranceBlocker.id };
      return task;
    });
  };

  const saveTask = () => {
    if (!form.taskName.trim() && !form.details.trim()) return;

    const taskToSave = normalizeDerivedFields({
      ...form,
      taskName: form.taskName.trim(),
      details: form.details.trim(),
      id: editingId || form.id || createId(),
    });

    if (editingId) {
      setTasks((current) => current.map((task) => (task.id === editingId ? taskToSave : task)));
    } else {
      setTasks((current) => applyAutoLinks([taskToSave], current));
    }

    setForm(createEmptyTask());
    setEditingId(null);
    setShowAdvanced(false);
  };

  const parseImport = () => {
    const parsed = parseTasksFromText(importText);
    setParsedTasks(parsed);

    if (parsed.length === 1) {
      setForm({ ...createEmptyTask(), ...parsed[0] });
      setShowAdvanced(true);
    }
  };

const addParsedTasks = () => {
  if (!parsedTasks.length) return;

  const newTasks = parsedTasks.map((task) => ({
    ...task,
    id: crypto.randomUUID(),
    completed: false,
  }));

  setTasks((current) => {
    const updated = applyAutoLinks(newTasks, current);
    return [...updated];
  });

  setParsedTasks([]);
  setImportText("");
};

  const editTask = (task) => {
    setForm({ ...createEmptyTask(), ...task });
    setEditingId(task.id);
    setShowAdvanced(true);
  };

  const deleteTask = (id) => {
    setTasks((current) =>
      current
        .filter((task) => task.id !== id)
        .map((task) => (task.blockedBy === id ? { ...task, blockedBy: "" } : task))
    );
  };

  const toggleTask = (id) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, completed: !task.completed } : task)));
  };

  const updateTaskField = (id, field, value) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, [field]: value } : task)));
  };

  const exportText = useMemo(() => {
    return sortTasks(tasks)
      .map((task) => {
        const lines = [`[${task.completed ? "x" : " "}] ${task.taskName}`];

        Object.keys(FIELD_LABEL_DISPLAY).forEach((field) => {
          if (field !== "taskName" && task[field]) {
            lines.push(`${FIELD_LABEL_DISPLAY[field]}: ${task[field]}`);
          }
        });

        return lines.join("\n");
      })
      .join("\n\n");
  }, [tasks]);

  const renderInput = (field, value, onChange) => {
    if (MULTILINE_FIELDS.has(field)) {
      return (
        <textarea
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      );
    }

    return (
      <input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    );
  };

  return (
  <PageContainer className="py-6 space-y-6">
<div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-200 rounded-xl px-6 py-4 mb-6">
  <h2 className="text-2xl font-bold text-slate-800">To-Do</h2>

</div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-base font-semibold">Import structured text</h3>

        <textarea
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          rows={8}
          placeholder={"[ ] Task name\nDetails\nPhone: ...\nCase #: ...\nDeadline: ..."}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={parseImport} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Parse
          </button>

          <button
            onClick={addParsedTasks}
            disabled={!parsedTasks.length}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Add parsed tasks
          </button>
        </div>

        {parsedTasks.length > 0 && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3">
            <div className="mb-2 text-sm font-semibold">Parsed preview</div>

            <div className="space-y-2">
              {parsedTasks.map((task) => (
                <div key={task.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <div className="font-semibold">{task.taskName}</div>
                  <div className="text-slate-600">Type: {task.type}</div>
                  {task.deadline && <div className="text-slate-600">Deadline: {task.deadline}</div>}
                  {task.caseNumber && <div className="text-slate-600">Case / Citation #: {task.caseNumber}</div>}
                  {task.phone && <div className="text-slate-600">Phone: {task.phone}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-3 text-base font-semibold">{editingId ? "Edit task" : "Create task"}</h3>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-medium md:col-span-2">
            Task name
            <input
              value={form.taskName}
              onChange={(event) => updateForm("taskName", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm font-medium">
            Type
            <select
              value={form.type}
              onChange={(event) => updateForm("type", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {TASK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium">
            Blocked by
            <select
              value={form.blockedBy}
              onChange={(event) => updateForm("blockedBy", event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Not blocked</option>
              {tasks
                .filter((task) => task.id !== editingId)
                .map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.taskName}
                  </option>
                ))}
            </select>
          </label>

          <label className="text-sm font-medium md:col-span-2">
            Details
            <textarea
              value={form.details}
              onChange={(event) => updateForm("details", event.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          {visibleFormFields.map((field) => (
            <label key={field} className="text-sm font-medium">
              {FIELD_LABEL_DISPLAY[field] || field}
              <div className="mt-1">{renderInput(field, form[field], (value) => updateForm(field, value))}</div>
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced((value) => !value)}
          className="mt-3 text-sm font-medium text-slate-700 underline"
        >
          {showAdvanced ? "Hide advanced fields" : "Show advanced fields"}
        </button>

        {showAdvanced && (
          <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2">
            {Object.keys(DEFAULT_FORM)
              .filter((field) => !["taskName", "details", "type", "completed", "id"].includes(field))
              .filter((field) => !visibleFormFields.includes(field))
              .map((field) => (
                <label key={field} className="text-sm font-medium">
                  {FIELD_LABEL_DISPLAY[field] || field}
                  <div className="mt-1">{renderInput(field, form[field], (value) => updateForm(field, value))}</div>
                </label>
              ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={saveTask} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            {editingId ? "Save changes" : "Add task"}
          </button>

          {editingId && (
            <button
              onClick={() => {
                setForm(createEmptyTask());
                setEditingId(null);
              }}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
            >
              Cancel edit
            </button>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Tasks</h3>

        {sortTasks(tasks).map((task) => {
          const blocker = task.blockedBy ? taskById[task.blockedBy] : null;
          const isBlocked = blocker && !blocker.completed;
          const controls = controlledByMap[task.id] || [];

          const fieldsToShow = Array.from(
            new Set([...(TYPE_FIELDS[task.type] || []), ...Object.keys(task).filter((field) => task[field])])
          ).filter((field) => !["id", "completed", "taskName", "details", "type", "blockedBy"].includes(field));

          return (
            <article
              key={task.id}
              className={`rounded-2xl border p-4 shadow-sm ${
                isBlocked ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <label className="flex items-start gap-3">
                  <input type="checkbox" checked={task.completed} onChange={() => toggleTask(task.id)} className="mt-1" />

                  <span>
                    <span className={`block font-semibold ${task.completed ? "text-slate-400 line-through" : "text-slate-900"}`}>
                      {task.taskName}
                    </span>
                    <span className="text-sm text-slate-600">{task.type}</span>
                  </span>
                </label>

                <div className="flex gap-2">
                  <button onClick={() => editTask(task)} className="rounded-lg border border-slate-300 px-3 py-1 text-sm">
                    Edit
                  </button>

                  <button onClick={() => deleteTask(task.id)} className="rounded-lg border border-slate-300 px-3 py-1 text-sm">
                    Delete
                  </button>
                </div>
              </div>

              {task.details && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{task.details}</p>}

              {isBlocked && (
                <div className="mt-3 rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900">
                  Blocked by: {blocker.taskName}
                </div>
              )}

              {controls.length > 0 && (
                <div className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
                  Controls: {controls.map((item) => item.taskName).join(", ")}
                </div>
              )}

              {fieldsToShow.length > 0 && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {fieldsToShow.map((field) => (
                    <label key={field} className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {FIELD_LABEL_DISPLAY[field] || field}

                      <div className="mt-1">
                        {MULTILINE_FIELDS.has(field) ? (
                          <textarea
                            value={task[field] || ""}
                            onChange={(event) => updateTaskField(task.id, field, event.target.value)}
                            rows={2}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                          />
                        ) : (
                          <input
                            value={task[field] || ""}
                            onChange={(event) => updateTaskField(task.id, field, event.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                          />
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </section>

<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
  <div className="mb-3 flex items-center justify-between gap-3">
    <h3 className="text-base font-semibold">Export</h3>

    <div className="flex flex-wrap gap-2">
      <button
  onClick={() => setShowPremiumTodoView(true)}
  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
>
  View Premium To-Do List
      </button>
      <button
        onClick={() => navigator.clipboard.writeText(exportText)}
        className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
      >
        📋 Copy
      </button>

      <button
        onClick={() => {
          const blob = new Blob([exportText], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "todo-export.txt";
          a.click();
          URL.revokeObjectURL(url);
        }}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
      >
        ⬇️ Download
      </button>
    </div>
  </div>

  <textarea
    readOnly
    value={exportText}
    rows={10}
    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800 shadow-inner"
  />
</section>    {showPremiumTodoView && (
  <PremiumTodoListView
    tasks={tasks}
    onClose={() => setShowPremiumTodoView(false)}
  />
)}</PageContainer>
  );
}