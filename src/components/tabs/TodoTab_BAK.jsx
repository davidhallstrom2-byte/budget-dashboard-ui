import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  AlertCircle,
  BriefcaseBusiness,
  Car,
  Check,
  Clock,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Edit2,
  FileText,
  GripVertical,
  HeartPulse,
  Landmark,
  ListTodo,
  Phone,
  Plus,
  RotateCcw,
  Scale,
  ShieldCheck,
  Smile,
  Stethoscope,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import PageContainer from "../common/PageContainer";
import PremiumTodoListView from "../todo/PremiumTodoListView";

const STORAGE_KEY = "todoTab.tasks.v1";
const STORAGE_BACKUP_KEY = "todoTab.tasks.backup.v1";
const ARCHIVE_STORAGE_KEY = "todoTab.tasks.archived.v1";

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

const TODO_CATEGORY_ICONS = {
  General: { icon: ListTodo, color: "text-slate-300" },
  Medical: { icon: Stethoscope, color: "text-rose-500" },
  "DMV / Vehicle": { icon: Car, color: "text-blue-500" },
  Insurance: { icon: ShieldCheck, color: "text-emerald-500" },
  "DPSS / Benefits": { icon: Landmark, color: "text-amber-400" },
  Legal: { icon: Scale, color: "text-purple-500" },
  Moving: { icon: Truck, color: "text-orange-500" },
  Work: { icon: BriefcaseBusiness, color: "text-cyan-500" },
  Dental: { icon: Smile, color: "text-pink-500" },
  "Phone / Lifeline": { icon: Phone, color: "text-indigo-500" },
};

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

const MULTILINE_FIELDS = new Set(["details", "documents", "questions", "outcome", "notes", "impact", "requiredAction", "website", "systemLink"]);

const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createEmptyTask = () => ({
  ...DEFAULT_FORM,
  id: createId(),
});


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
  const insuranceId = createId();
  const dmvId = createId();

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

  return [
    {
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
    },
    {
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
    },
  ];
};

const normalizeInsuranceDmvTasks = (tasks = []) => {
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

const readStoredTasks = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    const primaryTasks = Array.isArray(parsed) ? parsed : [];

    if (primaryTasks.length > 0) {
      const normalized = normalizeInsuranceDmvTasks(primaryTasks);

      if (normalized.changed) {
        localStorage.setItem(STORAGE_BACKUP_KEY, JSON.stringify(primaryTasks));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized.tasks));
      }

      return normalized.tasks;
    }

    const backup = localStorage.getItem(STORAGE_BACKUP_KEY);
    const backupParsed = backup ? JSON.parse(backup) : [];
    const backupTasks = Array.isArray(backupParsed) ? backupParsed : [];
    const normalizedBackup = normalizeInsuranceDmvTasks(backupTasks);
    return normalizedBackup.tasks;
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

const parseTasksFromText = (text = "") => {
  const parsedTasks = splitTasksFromText(text)
    .map(parseStructuredTask)
    .filter((task) => task.taskName || task.details);

  return normalizeInsuranceDmvTasks(parsedTasks).tasks;
};

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
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState({});

  useEffect(() => {
    hasHydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hasHydrated.current) return;

    const currentSaved = localStorage.getItem(STORAGE_KEY);
    if (currentSaved && currentSaved !== "[]") {
      localStorage.setItem(STORAGE_BACKUP_KEY, currentSaved);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeInsuranceDmvTasks(tasks).tasks));
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
      setTasks((current) => normalizeInsuranceDmvTasks(applyAutoLinks([taskToSave], current)).tasks);
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
      setIsCreateOpen(true);
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
    return normalizeInsuranceDmvTasks(updated).tasks;
  });

  setParsedTasks([]);
  setImportText("");
};

  const editTask = (task) => {
    setForm({ ...createEmptyTask(), ...task });
    setEditingId(task.id);
    setShowAdvanced(true);
    setIsCreateOpen(true);
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

  const addTaskToCategory = (type) => {
    setForm({ ...createEmptyTask(), type });
    setEditingId(null);
    setShowAdvanced(false);
    setIsCreateOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById("todo-create-task")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const duplicateTask = (task) => {
    const copy = {
      ...task,
      id: createId(),
      taskName: `${task.taskName || "Task"} Copy`,
      completed: false,
      completedAt: "",
    };
    setTasks((current) => normalizeInsuranceDmvTasks([...current, copy]).tasks);
  };

  const archiveTask = (task) => {
    try {
      const saved = localStorage.getItem(ARCHIVE_STORAGE_KEY);
      const archived = saved ? JSON.parse(saved) : [];
      const nextArchived = Array.isArray(archived) ? archived : [];
      localStorage.setItem(
        ARCHIVE_STORAGE_KEY,
        JSON.stringify([{ ...task, archivedAt: new Date().toISOString() }, ...nextArchived])
      );
    } catch {
      localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify([{ ...task, archivedAt: new Date().toISOString() }]));
    }

    deleteTask(task.id);
  };

  const clearTask = (id) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              completed: false,
              completedAt: "",
              blockedBy: "",
            }
          : task
      )
    );
  };

  const toggleCategory = (type) => {
    setCollapsedCategories((current) => ({ ...current, [type]: !current[type] }));
  };

  const getTaskDateValue = (task) => task.deadline || task.date || task.effectiveDate || "";

  const getTaskStatus = (task) => {
    if (task.completed) return "done";
    const rawDate = getTaskDateValue(task);
    const parsedDate = Date.parse(rawDate);
    if (Number.isNaN(parsedDate)) return "pending";

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(parsedDate);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "overdue";
    if (diffDays <= 5) return "dueSoon";
    return "pending";
  };

  const getTaskRowClass = (task, isBlocked) => {
    if (task.completed) return "bg-green-100 border-green-200";
    if (isBlocked) return "bg-yellow-100 border-yellow-200";
    const status = getTaskStatus(task);
    if (status === "overdue") return "bg-red-100 border-red-200";
    if (status === "dueSoon") return "bg-yellow-100 border-yellow-200";
    return "bg-white border-slate-200";
  };

  const getStatusLabel = (task, isBlocked) => {
    if (task.completed) return "Done";
    if (isBlocked) return "Blocked";
    const status = getTaskStatus(task);
    if (status === "overdue") return "Overdue";
    if (status === "dueSoon") return "Due Soon";
    return "Pending";
  };

  const getStatusClass = (task, isBlocked) => {
    if (task.completed) return "bg-green-600 text-white";
    if (isBlocked) return "bg-yellow-500 text-white";
    const status = getTaskStatus(task);
    if (status === "overdue") return "bg-red-600 text-white";
    if (status === "dueSoon") return "bg-yellow-500 text-white";
    return "bg-slate-200 text-slate-700";
  };

  const exportCategoryText = (type, categoryTasks) => {
    const text = sortTasks(categoryTasks)
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

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}-todo-export.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tasksByType = useMemo(() => {
    const map = TASK_TYPES.reduce((acc, type) => ({ ...acc, [type]: [] }), {});

    tasks.forEach((task) => {
      const type = TASK_TYPES.includes(task.type) ? task.type : inferTaskType(task);
      if (!map[type]) map[type] = [];
      map[type].push(task);
    });

    return map;
  }, [tasks]);

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

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setIsImportOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
        >
          <h3 className="text-base font-semibold">Import structured text</h3>
          {isImportOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>

        {isImportOpen && (
          <div className="border-t border-slate-200 px-6 pb-6 pt-4">
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
          </div>
        )}
      </section>

      <section id="todo-create-task" className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setIsCreateOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
        >
          <h3 className="text-base font-semibold">{editingId ? "Edit task" : "Create task"}</h3>
          {isCreateOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </button>

        {isCreateOpen && (
          <div className="border-t border-slate-200 px-6 pb-6 pt-4">
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
          </div>
        )}
      </section>

      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-2xl font-bold text-slate-900">Manage Categories & Tasks</h3>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCollapsedCategories(TASK_TYPES.reduce((map, type) => ({ ...map, [type]: true }), {}))}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-600 px-4 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <ChevronDown size={16} />
              Collapse All
            </button>
            <button
              type="button"
              onClick={() => setCollapsedCategories({})}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-slate-600 px-4 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <ChevronRight size={16} />
              Expand All
            </button>
          </div>
        </div>

        {TASK_TYPES.map((type) => {
          const categoryTasks = sortTasks(tasksByType[type] || []);
          const isCollapsed = Boolean(collapsedCategories[type]);
          const Icon = TODO_CATEGORY_ICONS[type]?.icon || ListTodo;
          const iconColor = TODO_CATEGORY_ICONS[type]?.color || "text-slate-300";
          const overdueCount = categoryTasks.filter((task) => !task.completed && getTaskStatus(task) === "overdue").length;
          const dueSoonCount = categoryTasks.filter((task) => !task.completed && getTaskStatus(task) === "dueSoon").length;

          return (
            <div key={type} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 bg-black px-4 py-2 text-white">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <GripVertical className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" />
                  <button
                    type="button"
                    onClick={() => toggleCategory(type)}
                    className="shrink-0 rounded p-1 text-white transition-colors hover:bg-slate-800"
                    aria-label={isCollapsed ? `Expand ${type}` : `Collapse ${type}`}
                  >
                    {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronDown className="h-4 w-4 rotate-180" />}
                  </button>
                  <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} aria-hidden="true" />
                  <div className="flex min-w-0 items-center gap-2">
                    <h4 className="truncate text-base font-semibold text-white sm:text-lg">{type}</h4>
                    <span className="text-xs font-semibold text-slate-300 sm:text-sm">({categoryTasks.length})</span>
                  </div>
                  {overdueCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                      <AlertCircle className="h-3 w-3" />
                      {overdueCount}
                    </span>
                  )}
                  {dueSoonCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-bold text-white">
                      <Clock className="h-3 w-3" />
                      {dueSoonCount}
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addTaskToCategory(type)}
                    className="flex items-center gap-1.5 rounded bg-blue-600 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 sm:px-3 sm:text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Task</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCategoryText(type, categoryTasks)}
                    className="rounded p-1.5 text-white transition-colors hover:bg-slate-800"
                    aria-label={`Download ${type}`}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => addTaskToCategory(type)}
                    className="rounded p-1.5 text-white transition-colors hover:bg-slate-800"
                    aria-label={`Edit ${type}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="border border-slate-300 rounded-b-lg">
                  <table className="w-full table-fixed text-sm">
                    <thead className="bg-slate-50 text-slate-800">
                      <tr className="border-b border-slate-200">
                        <th className="w-8 px-1 py-2 text-left font-medium text-gray-700"></th>
                        <th className="w-[25%] px-2 py-2 text-left font-medium text-gray-700">Task</th>
                        <th className="w-[14%] px-2 py-2 text-left font-medium text-gray-700">Due Date</th>
                        <th className="w-[11%] px-2 py-2 text-left font-medium text-gray-700">Status</th>
                        <th className="w-[28%] px-2 py-2 text-left font-medium text-gray-700">Details</th>
                        <th className="w-[22%] px-2 py-2 text-left font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryTasks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 text-sm text-slate-500">
                            No tasks in this category.
                          </td>
                        </tr>
                      ) : (
                        categoryTasks.map((task) => {
                          const blocker = task.blockedBy ? taskById[task.blockedBy] : null;
                          const isBlocked = Boolean(blocker && !blocker.completed);
                          const controls = controlledByMap[task.id] || [];
                          const statusLabel = getStatusLabel(task, isBlocked);
                          const statusClass = getStatusClass(task, isBlocked);
                          const rowClass = getTaskRowClass(task, isBlocked);
                          const fieldsToShow = Array.from(
                            new Set([...(TYPE_FIELDS[task.type] || []), ...Object.keys(task).filter((field) => task[field])])
                          ).filter((field) => !["id", "completed", "completedAt", "taskName", "details", "type", "blockedBy", "date", "deadline"].includes(field));

                          return (
                            <React.Fragment key={task.id}>
                              <tr className={`border-b ${rowClass}`}>
                                <td className="align-top px-2 py-2">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(task.completed)}
                                    onChange={() => toggleTask(task.id)}
                                    className="h-4 w-4 cursor-pointer rounded border-slate-300"
                                  />
                                </td>
                                <td className="align-top px-2 py-2">
                                  <input
                                    value={task.taskName || ""}
                                    onChange={(event) => updateTaskField(task.id, "taskName", event.target.value)}
                                    className={`w-full rounded border border-slate-300 bg-white p-1 text-sm font-semibold ${
                                      task.completed ? "text-slate-400 line-through" : "text-slate-900"
                                    }`}
                                  />
                                  <div className="mt-1 text-xs font-medium text-slate-600">{type}</div>
                                  {isBlocked && <div className="mt-1 text-xs font-semibold text-amber-800">Blocked by: {blocker.taskName}</div>}
                                  {controls.length > 0 && (
                                    <div className="mt-1 text-xs text-slate-600">Controls: {controls.map((item) => item.taskName).join(", ")}</div>
                                  )}
                                </td>
                                <td className="align-top px-2 py-2">
                                  <input
                                    value={task.deadline || task.date || ""}
                                    onChange={(event) => updateTaskField(task.id, task.deadline !== undefined ? "deadline" : "date", event.target.value)}
                                    placeholder="mm/dd/yyyy"
                                    className="w-full rounded border border-slate-300 bg-white p-1 text-sm"
                                  />
                                </td>
                                <td className="align-top px-2 py-2">
                                  <span className={`inline-flex rounded px-2 py-1 text-xs font-bold ${statusClass}`}>{statusLabel}</span>
                                </td>
                                <td className="align-top px-2 py-2">
                                  <textarea
                                    value={task.details || ""}
                                    onChange={(event) => updateTaskField(task.id, "details", event.target.value)}
                                    rows={2}
                                    className="w-full rounded border border-slate-300 bg-white p-1 text-sm"
                                  />
                                </td>
                                <td className="align-top px-2 py-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => toggleTask(task.id)}
                                      className={`inline-flex items-center justify-center rounded px-2 py-1 text-xs font-semibold text-white ${
                                        task.completed ? "bg-slate-600 hover:bg-slate-700" : "bg-green-600 hover:bg-green-700"
                                      }`}
                                    >
                                      {task.completed ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                                      <span className="ml-1">{task.completed ? "Reopen" : "Done"}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => duplicateTask(task)}
                                      className="inline-flex items-center justify-center rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700"
                                      aria-label="Copy task"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => archiveTask(task)}
                                      className="inline-flex items-center justify-center rounded bg-purple-600 px-2 py-1 text-white hover:bg-purple-700"
                                      aria-label="Archive task"
                                    >
                                      <Archive className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteTask(task.id)}
                                      className="inline-flex items-center justify-center rounded bg-red-600 px-2 py-1 text-white hover:bg-red-700"
                                      aria-label="Delete task"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => clearTask(task.id)}
                                      className="inline-flex items-center justify-center rounded bg-slate-400 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-500"
                                    >
                                      Clr
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => editTask(task)}
                                      className="inline-flex items-center justify-center rounded bg-slate-700 px-2 py-1 text-white hover:bg-slate-800"
                                      aria-label="Edit task"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {fieldsToShow.length > 0 && (
                                <tr className={`border-b ${rowClass}`}>
                                  <td></td>
                                  <td colSpan={5} className="px-2 pb-2">
                                    <div className="grid gap-2 md:grid-cols-3">
                                      {fieldsToShow.map((field) => (
                                        <label key={field} className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                          {FIELD_LABEL_DISPLAY[field] || field}
                                          <div className="mt-1">
                                            {MULTILINE_FIELDS.has(field) ? (
                                              <textarea
                                                value={task[field] || ""}
                                                onChange={(event) => updateTaskField(task.id, field, event.target.value)}
                                                rows={2}
                                                className="w-full rounded border border-slate-300 bg-white p-1 text-sm font-normal normal-case tracking-normal text-slate-900"
                                              />
                                            ) : (
                                              <input
                                                value={task[field] || ""}
                                                onChange={(event) => updateTaskField(task.id, field, event.target.value)}
                                                className="w-full rounded border border-slate-300 bg-white p-1 text-sm font-normal normal-case tracking-normal text-slate-900"
                                              />
                                            )}
                                          </div>
                                        </label>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
        <Copy className="h-4 w-4" />
        Copy
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
        <Download size={16} />
        Download
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