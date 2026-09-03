import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  AlertCircle,
  BriefcaseBusiness,
  Car,
  CalendarPlus,
  Check,
  Clock,
  ChevronDown,
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
  Search,
  ShieldCheck,
  Smile,
  Stethoscope,
  Trash2,
  Truck,
  X,
  History,
  PanelRightOpen,
} from "lucide-react";
import PageContainer from "../common/PageContainer";
import TabPageHeader, { TAB_HEADER_ACTION_CLASS } from "../common/TabPageHeader.jsx";
import CloseScreenButton from "../common/CloseScreenButton.jsx";
import DataToolsScreen from "../common/DataToolsScreen.jsx";
import CollapseToggleButton from "../common/CollapseToggleButton.jsx";
import PremiumTodoListView from "../todo/PremiumTodoListView";
import ArchivedDrawer from "../ui/ArchivedDrawer";
import ContactManager from "../contacts/ContactManager";
import { createGoogleCalendarEvent } from "../../utils/googleCalendarApi";
import { formatPhoneInput, formatPhoneNumber } from "../../utils/phone";
import { cleanCscDisplayShift, formatAppShortDate, formatAppShortDateTime } from "../../utils/cscDisplay.js";
import {
  CONTACT_APPLY_FIELDS,
  createEmptyContact,
  getInitialContactsForState,
  normalizeContact,
  normalizeContacts,
} from "../../utils/contactsStore";

const STORAGE_KEY = "todoTab.tasks.v1";
const STORAGE_BACKUP_KEY = "todoTab.tasks.backup.v1";
const ARCHIVE_STORAGE_KEY = "todoTab.tasks.archived.v1";
const SAFETY_SNAPSHOT_STORAGE_KEY = "todoTab.tasks.safetySnapshots.v1";
const TODO_GOOGLE_CALENDAR_ADDED_STORAGE_KEY = "todoTab.googleCalendar.addedIds.v1";
const MAX_SAFETY_SNAPSHOTS = 30;
const MAX_TASK_SCAN_TEXT_LENGTH = 12000;
const TASK_FILE_UPLOAD_ENDPOINT = "/budget-dashboard-fs/upload-task-file.php";
const TASK_FILE_UPLOAD_LOCALWP_ENDPOINT = "http://main-dashboard.local/budget-dashboard-fs/upload-task-file.php";
const TASK_FILE_PUBLIC_BASE_PATH = "/budget-dashboard-fs";
const CUSTOM_TASK_CATEGORIES_STORAGE_KEY = "todoTab.taskCategories.custom.v1";
const TASK_WORKFLOW_STATUSES = ["Pending", "Waiting"];
const CSC_SHIFTS_STORAGE_KEY = "cscShifts.v1";
const CSC_SHIFT_UPDATE_EVENT = "cscShifts:updated";
const DEFAULT_APPOINTMENT_DURATION_MINUTES = 60;

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
];

const LEGACY_TASK_CATEGORIES = new Set(["phone / lifeline"]);
const isLegacyTaskCategory = (value = "") =>
  LEGACY_TASK_CATEGORIES.has(cleanTaskCategoryName(value).toLowerCase());

const normalizeTaskWorkflowStatus = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "waiting" || normalized === "follow-up due" || normalized === "follow up due"
    ? "Waiting"
    : "Pending";
};

const cleanTaskCategoryName = (value = "") => String(value || "").replace(/\s+/g, " ").trim();

const compareAlphabetically = (firstValue = "", secondValue = "") =>
  String(firstValue || "").localeCompare(String(secondValue || ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });

const mergeTaskCategories = (...categoryGroups) => {
  const seen = new Set();
  const merged = [];

  categoryGroups.forEach((group) => {
    const categories = Array.isArray(group) ? group : [group];

    categories.forEach((category) => {
      const name = cleanTaskCategoryName(category);
      if (!name) return;

      const key = name.toLowerCase();
      if (seen.has(key)) return;

      seen.add(key);
      merged.push(name);
    });
  });

  return merged;
};

const readStoredCustomTaskCategories = () => {
  try {
    if (typeof localStorage === "undefined") return [];
    const saved = localStorage.getItem(CUSTOM_TASK_CATEGORIES_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return mergeTaskCategories(Array.isArray(parsed) ? parsed : []).filter(
      (category) => !TASK_TYPES.includes(category) && !isLegacyTaskCategory(category)
    );
  } catch {
    return [];
  }
};

const writeStoredCustomTaskCategories = (categories = []) => {
  try {
    if (typeof localStorage === "undefined") return;
    const cleaned = mergeTaskCategories(categories).filter(
      (category) => !TASK_TYPES.includes(category) && !isLegacyTaskCategory(category)
    );
    localStorage.setItem(CUSTOM_TASK_CATEGORIES_STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Ignore storage write failures so task entry still works.
  }
};

const extractTaskCategoryNames = (tasks = []) =>
  mergeTaskCategories(
    tasks.flatMap((task) => [task?.typeOverride, task?.type]).filter(Boolean)
  ).filter((category) => category && category !== "General" && !isLegacyTaskCategory(category));

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
};

const DEFAULT_FORM = {
  taskName: "",
  details: "",
  type: "General",
  typeOverride: "",
  date: "",
  time: "",
  endTime: "",
  contactId: "",
  contactName: "",
  phone: "",
  directPhone: "",
  cellPhone: "",
  fax: "",
  email: "",
  address: "",
  address2: "",
  address3: "",
  contactDetails: "",
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
  followUpNotes: "",
  status: "Pending",
  waitingOn: "",
  followUpDate: "",
  followUpTime: "",
  company: "",
  vehicle: "",
  policyStatus: "",
  effectiveDate: "",
  impact: "",
  requiredAction: "",
  systemLink: "",
  completed: false,
};

const TASK_SCAN_FILL_FIELDS = Object.keys(DEFAULT_FORM).filter(
  (field) => !["id", "completed", "details", "documents", "notes", "followUpNotes", "systemLink"].includes(field)
);

const FIELD_LABELS = {
  phone: ["phone", "tel", "telephone"],
  directPhone: ["direct phone", "direct", "office direct"],
  cellPhone: ["cell", "cell phone", "mobile", "mobile phone"],
  fax: ["fax", "facsimile"],
  email: ["email", "email address", "e-mail"],
  address: ["address", "location"],
  address2: ["address 2", "second address", "office 2"],
  address3: ["address 3", "third address", "office 3"],
  deadline: ["deadline", "due", "due date", "reg due", "registration due", "suspension"],
  date: ["date", "appointment date", "visit date", "order date"],
  time: ["time", "appointment time", "start time"],
  endTime: ["end time", "appointment end time", "finish time"],
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
  status: ["task status", "workflow status"],
  waitingOn: ["waiting on", "awaiting", "waiting for"],
  followUpDate: ["follow-up date", "follow up date", "followup date"],
  followUpTime: ["follow-up time", "follow up time", "followup time"],
  followUpNotes: ["follow-up notes", "follow up notes", "followup notes", "follow-up", "follow up"],
  fileName: ["file", "file name", "filename"],
};

const FIELD_LABEL_DISPLAY = {
  taskName: "Task name",
  details: "Details",
  type: "Type",
  typeOverride: "Category",
  date: "Appointment / event date",
  time: "Appointment start time",
  endTime: "Appointment end time",
  contactId: "Contact ID",
  contactName: "Contact name",
  phone: "Main phone",
  directPhone: "Direct phone",
  cellPhone: "Mobile phone",
  fax: "Fax",
  email: "Email",
  address: "Primary address",
  address2: "Second office / address",
  address3: "Third office / address",
  contactDetails: "Additional contact details",
  deadline: "Due date",
  blockedBy: "Blocked by",
  person: "Person",
  organization: "Organization",
  website: "Website or portal link",
  plate: "Plate",
  vin: "VIN",
  policyNumber: "Policy #",
  caseNumber: "Case / Citation #",
  amount: "Amount",
  documents: "Documents needed",
  questions: "Questions",
  outcome: "Desired outcome",
  fileName: "File name",
  notes: "Notes",
  status: "Status",
  waitingOn: "Waiting on",
  followUpDate: "Follow-up date",
  followUpTime: "Follow-up time",
  company: "Company",
  vehicle: "Vehicle",
  policyStatus: "Policy status",
  effectiveDate: "Effective date",
  impact: "Impact",
  requiredAction: "Required action",
  systemLink: "Website or portal link",
  followUpNotes: "Follow-up Notes",
};

const normalizeType = (value = "") => {
  const candidate = cleanTaskCategoryName(value);
  if (isLegacyTaskCategory(candidate)) return "General";
  return candidate || "General";
};

const getFieldLabel = (task, field) => {
  const taskType = normalizeType(task?.typeOverride || task?.type);

  if (field === "caseNumber") {
    if (taskType === "DMV / Vehicle") return "Citation #";
    if (taskType === "DPSS / Benefits") return "Case #";
    if (taskType === "Legal") return "Case #";
    return "Case #";
  }

  return FIELD_LABEL_DISPLAY[field] || field;
};

const TYPE_FIELDS = {
  General: ["date", "deadline", "time", "phone", "website", "documents", "questions", "outcome", "notes"],
  Medical: ["person", "organization", "phone", "address", "date", "deadline", "time", "documents", "questions", "outcome", "notes"],
  "DMV / Vehicle": ["plate", "vin", "vehicle", "date", "deadline", "time", "amount", "caseNumber", "phone", "website", "documents", "requiredAction", "impact", "notes"],
  Insurance: ["company", "policyNumber", "policyStatus", "effectiveDate", "time", "phone", "website", "amount", "deadline", "requiredAction", "impact", "documents", "notes"],
  "DPSS / Benefits": ["person", "organization", "caseNumber", "phone", "website", "deadline", "time", "amount", "documents", "questions", "outcome", "notes"],
  Legal: ["person", "organization", "caseNumber", "phone", "address", "date", "deadline", "time", "amount", "website", "documents", "questions", "outcome", "notes"],
  Moving: ["date", "deadline", "time", "address", "phone", "amount", "documents", "questions", "outcome", "notes"],
  Work: ["organization", "person", "phone", "website", "date", "deadline", "time", "documents", "questions", "outcome", "notes"],
  Dental: ["person", "organization", "phone", "address", "date", "deadline", "time", "documents", "questions", "outcome", "notes"],
};

const MULTILINE_FIELDS = new Set(["details", "contactDetails", "documents", "questions", "outcome", "notes", "followUpNotes", "impact", "requiredAction"]);
const FORMATTED_TEXT_FIELDS = new Set(["notes", "followUpNotes"]);
const URL_FIELDS = new Set(["website"]);
const DATE_PICKER_FIELDS = new Set(["date", "deadline", "effectiveDate", "followUpDate"]);
const TIME_PICKER_FIELDS = new Set(["time", "endTime", "followUpTime"]);
const PHONE_NUMBER_FIELDS = new Set(["phone", "directPhone", "cellPhone", "fax"]);
const shouldUseFormattingToolbar = (field) => FORMATTED_TEXT_FIELDS.has(field);
const DOCUMENT_DETAIL_FIELDS = new Set(["fileName", "documents"]);
const NOTE_DETAIL_FIELDS = new Set(["notes", "followUpNotes"]);

const SCHEDULE_FORM_FIELDS = ["date", "time", "endTime", "deadline", "effectiveDate"];
const FOLLOW_UP_FORM_FIELDS = ["waitingOn", "followUpDate", "followUpTime"];
const CONTACT_FORM_FIELDS = [
  "contactName",
  "person",
  "organization",
  "company",
  "email",
  "phone",
  "directPhone",
  "cellPhone",
  "fax",
  "website",
  "address",
  "address2",
  "address3",
  "contactDetails",
];
const PRIMARY_CONTACT_FIELDS = new Set(["contactName", "organization", "phone", "website"]);
const PREPARATION_FORM_FIELDS = ["questions", "documents", "fileName", "outcome", "notes", "followUpNotes"];

const hasTaskContactInformation = (task = {}) =>
  Boolean(task.contactId) || CONTACT_FORM_FIELDS.some((field) => Boolean(String(task[field] || "").trim()));
const hasAdditionalTaskContactInformation = (task = {}) =>
  CONTACT_FORM_FIELDS.some(
    (field) => !PRIMARY_CONTACT_FIELDS.has(field) && Boolean(String(task[field] || "").trim())
  );
const hasTaskPreparationInformation = (task = {}) =>
  PREPARATION_FORM_FIELDS.some((field) => Boolean(String(task[field] || "").trim()));

const orderTaskFormFields = (fields = []) => {
  const uniqueFields = Array.from(new Set(fields));
  const noteFields = uniqueFields.filter((field) => NOTE_DETAIL_FIELDS.has(field));
  const documentFields = uniqueFields.filter((field) => DOCUMENT_DETAIL_FIELDS.has(field));
  const otherFields = uniqueFields.filter((field) => !NOTE_DETAIL_FIELDS.has(field) && !DOCUMENT_DETAIL_FIELDS.has(field));

  return [...otherFields, ...noteFields, ...documentFields];
};


const getTextareaRows = (value, minRows = 1, maxRows = 10, charsPerRow = 72) => {
  const text = String(value || "");
  if (!text.trim()) return minRows;

  const estimatedRows = text
    .split(/\r?\n/)
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerRow)), 0);

  return Math.max(minRows, Math.min(maxRows, estimatedRows));
};


const compactMultilineText = (value) =>
  String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const AutoResizeTextarea = ({
  value,
  onChange,
  className = "",
  minRows = 1,
  maxRows = 8,
  charsPerRow = 72,
  compactOnChange = false,
  ...props
}) => {
  const textareaRef = useRef(null);
  const displayValue = String(value || "");

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    const lineHeight = 20;
    const verticalPadding = 10;
    const minHeight = Math.max(34, minRows * lineHeight + verticalPadding);
    const maxHeight = Math.max(minHeight, maxRows * lineHeight + verticalPadding);

    el.style.height = "auto";
    const nextHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [displayValue, minRows, maxRows]);

  return (
    <textarea
      ref={textareaRef}
      value={displayValue}
      onChange={(event) => onChange(event.target.value)}
      onBlur={(event) => {
        if (compactOnChange) onChange(compactMultilineText(event.target.value));
        props.onBlur?.(event);
      }}
      rows={getTextareaRows(displayValue, minRows, maxRows, charsPerRow)}
      className={`${className} resize-none`}
      {...props}
    />
  );
};

const safeJsonParse = (value, fallback) => {
  try {
    const parsed = JSON.parse(value || "");
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

const formatDateTime = (value) => formatAppShortDateTime(value, String(value || ""));

const escapeFormattedHtml = (value = "") =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const renderInlineFormatting = (value = "") => {
  let html = escapeFormattedHtml(value);

  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, label, url) => `<a href="${url}" target="_blank" rel="noreferrer" class="font-bold text-blue-700 underline">${label}</a>`
  );

  html = html.replace(
    /\[color:(#[0-9a-fA-F]{6})\]([\s\S]+?)\[\/color\]/g,
    (_match, color, text) => `<span style="color: ${color};">${text}</span>`
  );

  html = html
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<u>$1</u>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  return html;
};

const formatTextToHtml = (value = "") => {
  const lines = String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const html = [];
  let listType = "";

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = "";
    }
  };

  lines.forEach((line) => {
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    const numberMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);

    if (!line.trim()) {
      closeList();
      html.push('<div class="h-2"></div>');
      return;
    }

    if (bulletMatch) {
      if (listType !== "ul") {
        closeList();
        html.push('<ul class="list-disc space-y-1 pl-5">');
        listType = "ul";
      }
      html.push(`<li>${renderInlineFormatting(bulletMatch[1])}</li>`);
      return;
    }

    if (numberMatch) {
      if (listType !== "ol") {
        closeList();
        html.push('<ol class="list-decimal space-y-1 pl-5">');
        listType = "ol";
      }
      html.push(`<li>${renderInlineFormatting(numberMatch[1])}</li>`);
      return;
    }

    closeList();
    html.push(`<p>${renderInlineFormatting(line)}</p>`);
  });

  closeList();
  return html.join("");
};

const hasFormattingMarkup = (value = "") => /\*\*[^*]+\*\*|\*[^*\n]+\*|__[^_]+__|~~[^~]+~~|\[color:#[0-9a-fA-F]{6}\][\s\S]+?\[\/color\]|^\s*[-*]\s+|^\s*\d+[.)]\s+|\[[^\]]+\]\(https?:\/\/[^\s)]+\)/m.test(String(value ?? ""));

const TEXT_COLOR_OPTIONS = [
  { label: "Black", value: "#111827" },
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#ea580c" },
  { label: "Yellow", value: "#ca8a04" },
  { label: "Green", value: "#16a34a" },
  { label: "Blue", value: "#2563eb" },
  { label: "Purple", value: "#7c3aed" },
];

const DEFAULT_NOTE_TEXT_COLOR = "#111827";

const normalizeFormattedTextColor = (value = "") => {
  const color = String(value || "").trim();
  const compactColor = color.toLowerCase().replace(/\s+/g, "");

  // White text is unreadable on the light note cards and is not a supported
  // palette option. Convert any legacy white formatting back to the default.
  if (
    !color ||
    compactColor === "white" ||
    compactColor === "transparent" ||
    compactColor === "#fff" ||
    compactColor === "#ffffff" ||
    compactColor === "rgb(255,255,255)" ||
    compactColor === "rgba(255,255,255,1)"
  ) {
    return DEFAULT_NOTE_TEXT_COLOR;
  }

  return color;
};

const looksLikeHtmlNote = (value = "") => /<(p|div|span|strong|em|u|s|ul|ol|li|a|br)\b/i.test(String(value ?? ""));

const sanitizeFormattedHtml = (value = "") => {
  if (typeof document === "undefined") return escapeFormattedHtml(value);

  const template = document.createElement("template");
  template.innerHTML = String(value ?? "");

  const allowedTags = new Set(["P", "DIV", "SPAN", "STRONG", "B", "EM", "I", "U", "S", "UL", "OL", "LI", "A", "BR", "FONT"]);
  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
  const nodes = [];

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  nodes.forEach((node) => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(document.createTextNode(node.textContent || ""));
      return;
    }

    if (node.tagName === "FONT") {
      const color = node.getAttribute("color");
      const span = document.createElement("span");
      if (color) span.setAttribute("style", `color: ${normalizeFormattedTextColor(color)};`);
      span.innerHTML = node.innerHTML;
      node.replaceWith(span);
      return;
    }

    [...node.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      const valueText = attribute.value || "";

      if (name.startsWith("on")) {
        node.removeAttribute(attribute.name);
        return;
      }

      if (name === "style") {
        const textColor = node.style.color;
        if (textColor) {
          node.setAttribute("style", `color: ${normalizeFormattedTextColor(textColor)};`);
        } else {
          node.removeAttribute("style");
        }
        return;
      }

      if (node.tagName === "A" && name === "href" && /^https?:\/\//i.test(valueText)) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noreferrer");
        return;
      }

      if (name !== "target" && name !== "rel") {
        node.removeAttribute(attribute.name);
      }
    });
  });

  return template.innerHTML;
};

const applyTextFormatting = (format, value, onChange, textarea, option = {}) => {
  const currentValue = String(value ?? "");
  const start = textarea?.selectionStart ?? currentValue.length;
  const end = textarea?.selectionEnd ?? currentValue.length;
  const selected = currentValue.slice(start, end);

  const wrapSelection = (prefix, suffix, placeholder) => {
    const inner = selected || placeholder;
    return {
      nextValue: `${currentValue.slice(0, start)}${prefix}${inner}${suffix}${currentValue.slice(end)}`,
      nextStart: start + prefix.length,
      nextEnd: start + prefix.length + inner.length,
    };
  };

  const prefixLines = (prefix, placeholder) => {
    const inner = selected || placeholder;
    const formatted = inner
      .split(/\r?\n/)
      .map((line, index) => `${typeof prefix === "function" ? prefix(index) : prefix}${line || placeholder}`)
      .join("\n");

    return {
      nextValue: `${currentValue.slice(0, start)}${formatted}${currentValue.slice(end)}`,
      nextStart: start,
      nextEnd: start + formatted.length,
    };
  };

  const formats = {
    bold: () => wrapSelection("**", "**", "bold text"),
    italic: () => wrapSelection("*", "*", "italic text"),
    underline: () => wrapSelection("__", "__", "underlined text"),
    strike: () => wrapSelection("~~", "~~", "struck text"),
    bullet: () => prefixLines("- ", "List item"),
    numbered: () => prefixLines((index) => `${index + 1}. `, "List item"),
    link: () => wrapSelection("[", "](https://example.com)", "link text"),
    color: () => wrapSelection(`[color:${option.color || "#2563eb"}]`, "[/color]", "colored text"),
  };

  const result = formats[format]?.();
  if (!result) return;

  onChange(result.nextValue);
  window.requestAnimationFrame(() => {
    textarea?.focus();
    textarea?.setSelectionRange(result.nextStart, result.nextEnd);
  });
};

const FormattedText = ({ value, className = "" }) => {
  const rawValue = String(value ?? "");
  const html = looksLikeHtmlNote(rawValue) ? sanitizeFormattedHtml(rawValue) : formatTextToHtml(rawValue);
  if (!html) return null;
  return <div className={className} style={{ color: DEFAULT_NOTE_TEXT_COLOR }} dangerouslySetInnerHTML={{ __html: html }} />;
};

const getEditorHtml = (value = "") => {
  const rawValue = String(value ?? "");
  if (!rawValue.trim()) return "";
  return looksLikeHtmlNote(rawValue) ? sanitizeFormattedHtml(rawValue) : formatTextToHtml(rawValue);
};

const FormattingToolbar = ({ editorRef, selectionRef, colorValue, setColorValue, onFormatChange }) => {
  const [showColorMenu, setShowColorMenu] = useState(false);
  const buttonClass = "rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-black text-slate-700 hover:bg-slate-100";

  const focusEditor = () => {
    editorRef.current?.focus({ preventScroll: true });
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    const savedRange = selectionRef?.current;

    if (!editor || !savedRange) return false;

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(savedRange);
    return true;
  };

  const focusAndRestoreSelection = () => {
    focusEditor();
    return restoreSelection();
  };

  const saveCurrentSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  };

  const commitFormattingChange = () => {
    window.requestAnimationFrame(() => onFormatChange?.());
  };

  const runCommand = (command, value = null) => {
    focusAndRestoreSelection();
    if (command === "createLink") {
      const url = window.prompt("Enter link URL:", "https://");
      if (!url || !/^https?:\/\//i.test(url)) return;
      document.execCommand(command, false, url);
      saveCurrentSelection();
      commitFormattingChange();
      return;
    }
    document.execCommand(command, false, value);
    saveCurrentSelection();
    commitFormattingChange();
  };

  const applyColor = (color) => {
    const nextColor = normalizeFormattedTextColor(color || DEFAULT_NOTE_TEXT_COLOR);
    setColorValue(nextColor);
    setShowColorMenu(false);
    focusAndRestoreSelection();
    document.execCommand("styleWithCSS", false, true);
    document.execCommand("foreColor", false, nextColor);
    saveCurrentSelection();
    commitFormattingChange();
  };

  return (
    <div className="relative mb-1 flex flex-wrap items-center gap-1">
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("bold")} className={buttonClass} title="Bold selected text">B</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("italic")} className={`${buttonClass} italic`} title="Italic selected text">I</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("underline")} className={`${buttonClass} underline`} title="Underline selected text">U</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("strikeThrough")} className={`${buttonClass} line-through`} title="Strikethrough selected text">S</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("insertUnorderedList")} className={buttonClass} title="Make selected lines bullets">• List</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("insertOrderedList")} className={buttonClass} title="Make selected lines numbered">1. List</button>
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand("createLink")} className={buttonClass} title="Add link">Link</button>
      <div className="relative">
        <button
          type="button"
          onMouseDown={(event) => {
            event.preventDefault();
            restoreSelection();
          }}
          onClick={() => setShowColorMenu((current) => !current)}
          className="flex h-[30px] w-14 items-center justify-center gap-1 rounded border border-slate-300 bg-white px-1 hover:bg-slate-100"
          title="Text color"
          aria-label="Text color"
        >
          <span className="h-3 w-3 rounded-sm border border-slate-300" style={{ backgroundColor: colorValue }} />
          <span className="text-xs text-slate-600">⌄</span>
        </button>
        {showColorMenu && (
          <div className="absolute left-0 top-8 z-50 grid grid-cols-7 gap-1 rounded border border-slate-300 bg-white p-1 shadow-lg">
            {TEXT_COLOR_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  applyColor(option.value);
                }}
                className="h-6 w-6 rounded border border-slate-300 hover:ring-2 hover:ring-slate-400"
                style={{ backgroundColor: option.value }}
                title={option.label}
                aria-label={option.label}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const FormattingTextarea = ({ value, onChange, rows = 2, className = "", placeholder = "", ...props }) => {
  const editorRef = useRef(null);
  const selectionRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [colorValue, setColorValue] = useState("#111827");

  useEffect(() => {
    if (!editorRef.current || isFocused) return;
    editorRef.current.innerHTML = getEditorHtml(value);
  }, [value, isFocused]);

  const saveSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();

    if (!editor || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) {
      selectionRef.current = range.cloneRange();
    }
  };

  const updateValueFromEditor = () => {
    saveSelection();
    const nextHtml = sanitizeFormattedHtml(editorRef.current?.innerHTML || "");
    onChange(nextHtml);
  };

  return (
    <div>
      <FormattingToolbar
        editorRef={editorRef}
        selectionRef={selectionRef}
        colorValue={colorValue}
        setColorValue={setColorValue}
        onFormatChange={updateValueFromEditor}
      />
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => {
          setIsFocused(true);
          window.requestAnimationFrame(saveSelection);
        }}
        onBlur={() => {
          setIsFocused(false);
          updateValueFromEditor();
        }}
        onInput={updateValueFromEditor}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        data-placeholder={placeholder}
        className={`${className} rich-note-editor`}
        style={{ minHeight: `${Math.max(44, rows * 24)}px` }}
        {...props}
      />
      <style>{`
        .rich-note-editor {
          color: ${DEFAULT_NOTE_TEXT_COLOR};
        }
        .rich-note-editor:empty::before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
        .rich-note-editor p {
          margin: 0 0 0.25rem 0;
        }
        .rich-note-editor ul,
        .rich-note-editor ol {
          margin: 0.25rem 0 0.25rem 1.25rem;
        }
      `}</style>
    </div>
  );
};

const buildContactTaskDetails = (contact = {}) => {
  const details = [];
  const formatOfficeAddress = (office = {}) => {
    const cityStateZip = [
      office.city,
      [office.state, office.zip].filter(Boolean).join(" "),
    ].filter(Boolean).join(", ");
    return [office.address, cityStateZip].filter(Boolean).join(", ");
  };
  const officeLocations = Array.isArray(contact.officeLocations) && contact.officeLocations.length
    ? contact.officeLocations
    : [
        { label: "Office 1", address: contact.address, city: contact.city, state: contact.state, zip: contact.zip, phone: contact.phone, fax: contact.fax },
        { label: "Office 2", address: contact.address2, city: contact.city2, state: contact.state2, zip: contact.zip2 },
        { label: "Office 3", address: contact.address3, city: contact.city3, state: contact.state3, zip: contact.zip3 },
      ];

  officeLocations.filter((office) => office?.address || office?.phone || office?.fax).forEach((office, index) => {
    const officeParts = [];
    const officeAddress = formatOfficeAddress(office);
    if (officeAddress) officeParts.push(officeAddress);
    if (office.phone) officeParts.push(`Phone: ${office.phone}`);
    if (office.fax) officeParts.push(`Fax: ${office.fax}`);
    if (officeParts.length) details.push(`${office.label || `Office ${index + 1}`}: ${officeParts.join(" | ")}`);
  });

  if (contact.directPhone) details.push(`Direct phone: ${contact.directPhone}`);
  if (contact.cellPhone) details.push(`Mobile phone: ${contact.cellPhone}`);

  if (contact.treatmentRequested) {
    details.push(`Treatment Requested: ${contact.treatmentRequested}`);
  }

  if (contact.comments) {
    details.push(`Comments: ${contact.comments}`);
  }

  if (contact.notes) details.push(`Contact Notes: ${contact.notes}`);

  if (contact.scannedDocumentName) {
    details.push(`Scanned Document: ${contact.scannedDocumentName}`);
  }

  return Array.from(new Set(details.map((item) => String(item || "").trim()).filter(Boolean))).join("\n");
};

const appendContactTaskDetails = (currentDetails = "", nextDetails = "") => {
  const current = String(currentDetails || "").trim();
  const addition = String(nextDetails || "").trim();

  if (!addition) return currentDetails || "";
  if (!current) return addition;
  if (current.includes(addition)) return current;

  return `${current}\n${addition}`;
};

const applyContactToTaskData = (task = {}, contact = {}, replaceExisting = false) => {
  const next = { ...task };
  const fillField = (field, value) => {
    if (value && (replaceExisting || !String(next[field] || "").trim())) next[field] = value;
  };
  const formatOfficeAddress = (office = {}) => {
    const cityStateZip = [office.city, [office.state, office.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    return [office.address, cityStateZip].filter(Boolean).join(", ");
  };

  const contactCategory = cleanTaskCategoryName(contact.category);
  if (contactCategory && (replaceExisting || !next.type || next.type === "General")) {
    next.type = contactCategory;
    next.typeOverride = contactCategory;
  }

  CONTACT_APPLY_FIELDS.forEach((field) => {
    if (["address", "address2", "address3"].includes(field)) return;
    fillField(field, contact[field]);
  });

  fillField("contactId", contact.id);
  fillField("contactName", contact.name);

  const officeLocations = Array.isArray(contact.officeLocations) ? contact.officeLocations : [];
  const formattedAddresses = officeLocations.map(formatOfficeAddress).filter(Boolean);
  fillField("address", formattedAddresses[0] || contact.address);
  fillField("address2", formattedAddresses[1] || contact.address2);
  fillField("address3", formattedAddresses[2] || contact.address3);

  const contactTaskDetails = buildContactTaskDetails(contact);
  fillField("contactDetails", contactTaskDetails);

  return normalizeDerivedFields(next);
};

const readStoredSafetySnapshots = () => {
  if (typeof localStorage === "undefined") return [];
  const parsed = safeJsonParse(localStorage.getItem(SAFETY_SNAPSHOT_STORAGE_KEY), []);
  return Array.isArray(parsed) ? parsed : [];
};

const writeSafetySnapshot = (action, activeTasks = [], archivedTasks = []) => {
  if (typeof localStorage === "undefined") return;

  const snapshot = {
    id: createId(),
    action,
    createdAt: new Date().toISOString(),
    activeTasks,
    archivedTasks,
  };

  const nextSnapshots = [snapshot, ...readStoredSafetySnapshots()].slice(0, MAX_SAFETY_SNAPSHOTS);
  localStorage.setItem(SAFETY_SNAPSHOT_STORAGE_KEY, JSON.stringify(nextSnapshots));
};

const addTaskHistory = (task = {}, action, detail = "") => {
  const entry = {
    id: createId(),
    action,
    detail,
    createdAt: new Date().toISOString(),
  };

  const currentLog = Array.isArray(task.activityLog) ? task.activityLog : [];

  return {
    ...task,
    updatedAt: entry.createdAt,
    activityLog: [entry, ...currentLog].slice(0, 100),
  };
};

const getFollowUpEntries = (task = {}) => (Array.isArray(task.followUpEntries) ? task.followUpEntries : []);

const getFirstFilledValue = (task = {}, fields = []) => {
  for (const field of fields) {
    const value = String(task[field] ?? "").trim();
    if (value) return value;
  }

  return "";
};

const buildConnectedFollowUpSourceSummary = (task = {}) => {
  const entries = getFollowUpEntries(task)
    .slice(0, 3)
    .map((entry) => {
      const entryText = stripTodoCalendarHtml(entry?.text || "").trim();
      if (!entryText) return "";
      const entryDate = formatDateTime(entry?.createdAt);
      return entryDate ? `${entryDate}: ${entryText}` : entryText;
    })
    .filter(Boolean);

  const lines = [
    task.taskName ? `Source task: ${task.taskName}` : "",
    getFirstFilledValue(task, ["person"]) ? `Person: ${getFirstFilledValue(task, ["person"])}` : "",
    getFirstFilledValue(task, ["organization", "company"]) ? `Organization: ${getFirstFilledValue(task, ["organization", "company"])}` : "",
    getFirstFilledValue(task, ["caseNumber", "policyNumber"]) ? `Case / ID: ${getFirstFilledValue(task, ["caseNumber", "policyNumber"])}` : "",
    getFirstFilledValue(task, ["phone"]) ? `Phone: ${getFirstFilledValue(task, ["phone"])}` : "",
    getFirstFilledValue(task, ["website", "systemLink"]) ? `Website: ${getFirstFilledValue(task, ["website", "systemLink"])}` : "",
    getFirstFilledValue(task, ["deadline", "date", "effectiveDate"]) ? `Date / deadline: ${getFirstFilledValue(task, ["deadline", "date", "effectiveDate"])}` : "",
    task.time ? `Time: ${formatTodoTimeForTextInput(task.time)}` : "",
    normalizeTaskWorkflowStatus(task.status) === "Waiting" ? "Status: Waiting" : "",
    task.waitingOn ? `Waiting on: ${task.waitingOn}` : "",
    task.followUpDate ? `Follow-up: ${formatTaskFollowUpSchedule(task)}` : "",
    getFirstFilledValue(task, ["amount"]) ? `Amount: ${getFirstFilledValue(task, ["amount"])}` : "",
    task.details ? `Details: ${stripTodoCalendarHtml(task.details).trim()}` : "",
    task.notes ? `Notes: ${stripTodoCalendarHtml(task.notes).trim()}` : "",
    entries.length ? `Recent notes: ${entries.join(" | ")}` : "",
  ].filter(Boolean);

  return lines.join("\n");
};

const buildConnectedFollowUpSourceSnapshot = (task = {}) => ({
  id: task.id || "",
  taskName: task.taskName || "",
  details: task.details || "",
  type: task.type || "",
  typeOverride: task.typeOverride || "",
  date: task.date || "",
  deadline: task.deadline || "",
  time: task.time || "",
  status: normalizeTaskWorkflowStatus(task.status),
  waitingOn: task.waitingOn || "",
  followUpDate: task.followUpDate || "",
  followUpTime: task.followUpTime || "",
  person: task.person || "",
  organization: task.organization || task.company || "",
  phone: task.phone || "",
  address: task.address || "",
  website: task.website || "",
  systemLink: task.systemLink || "",
  caseNumber: task.caseNumber || task.policyNumber || "",
  amount: task.amount || "",
  notes: task.notes || "",
  followUpEntries: getFollowUpEntries(task).slice(0, 10),
  attachments: normalizeTaskAttachments(task.attachments),
  completedAt: task.completedAt || "",
  archivedAt: task.archivedAt || "",
});

const readTodoGoogleCalendarAddedIds = () => {
  const parsed = safeJsonParse(localStorage.getItem(TODO_GOOGLE_CALENDAR_ADDED_STORAGE_KEY), []);
  return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
};

const writeTodoGoogleCalendarAddedIds = (ids = []) => {
  localStorage.setItem(
    TODO_GOOGLE_CALENDAR_ADDED_STORAGE_KEY,
    JSON.stringify(Array.from(new Set(ids)).filter(Boolean))
  );
};

const stripTodoCalendarHtml = (value = "") => {
  const rawValue = String(value ?? "");

  if (typeof document === "undefined") {
    return rawValue.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  const template = document.createElement("template");
  template.innerHTML = rawValue;
  const textValue = template.content.textContent || rawValue;

  return textValue
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const normalizeTodoCalendarDate = (value = "") => {
  const rawValue = String(value || "").trim();

  if (!rawValue) return "";

  const isoMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const slashMatch = rawValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    const day = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) return "";

  return [
    String(parsedDate.getFullYear()).padStart(4, "0"),
    String(parsedDate.getMonth() + 1).padStart(2, "0"),
    String(parsedDate.getDate()).padStart(2, "0"),
  ].join("-");
};

const formatTodoDateForTextInput = (value = "") => {
  const normalized = normalizeTodoCalendarDate(value);
  if (!normalized) return String(value || "");

  const [year, month, day] = normalized.split("-");
  return `${month}/${day}/${year}`;
};

const normalizeTodoCalendarTime = (value = "") => {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  const browserTimeMatch = rawValue.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (browserTimeMatch) {
    const hour = Number(browserTimeMatch[1]);
    const minute = Number(browserTimeMatch[2]);
    const second = Number(browserTimeMatch[3] || 0);

    if (hour > 23 || minute > 59 || second > 59) return "";

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
  }

  const meridiemMatch = rawValue.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (!meridiemMatch) return "";

  const hour = Number(meridiemMatch[1]);
  const minute = Number(meridiemMatch[2] || 0);
  const meridiem = meridiemMatch[3].toUpperCase();

  if (!hour || hour > 12 || minute > 59) return "";

  const hour24 =
    meridiem === "PM" && hour !== 12
      ? hour + 12
      : meridiem === "AM" && hour === 12
        ? 0
        : hour;

  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
};

const formatTodoTimeForTextInput = (value = "") => {
  const normalized = normalizeTodoCalendarTime(value);
  if (!normalized) return String(value || "");

  const [hourValue, minuteValue] = normalized.split(":");
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const meridiem = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${meridiem}`;
};

const readScheduledCscShifts = () => {
  try {
    if (typeof localStorage === "undefined") return [];
    const parsed = JSON.parse(localStorage.getItem(CSC_SHIFTS_STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((shift) => {
        const status = String(shift?.shiftStatus || "Scheduled").trim().toLowerCase();
        return shift?.startDate && !["cancelled", "canceled", "done", "complete", "completed"].includes(status);
      })
      .map(cleanCscDisplayShift);
  } catch {
    return [];
  }
};

const buildLocalDateTime = (dateValue = "", timeValue = "") => {
  const date = normalizeTodoCalendarDate(dateValue);
  const time = normalizeTodoCalendarTime(timeValue);
  if (!date || !time) return null;

  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? null : value;
};

const getCscShiftWindow = (shift = {}) => {
  const start = buildLocalDateTime(shift.startDate, shift.startTime);
  const end = buildLocalDateTime(shift.finishDate || shift.startDate, shift.finishTime);
  if (!start || !end) return null;
  if (end <= start) end.setDate(end.getDate() + 1);
  return { start, end };
};

const getTodoAppointmentWindow = (task = {}) => {
  const date = normalizeTodoCalendarDate(task.date);
  if (!date) return null;

  const start = buildLocalDateTime(date, task.time);
  if (!start) {
    const dayStart = new Date(`${date}T00:00:00`);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    return { start: dayStart, end: dayEnd, hasExactTime: false, usesDefaultDuration: false };
  }

  const normalizedEndTime = normalizeTodoCalendarTime(task.endTime);
  const end = normalizedEndTime
    ? buildLocalDateTime(date, normalizedEndTime)
    : new Date(start.getTime() + DEFAULT_APPOINTMENT_DURATION_MINUTES * 60 * 1000);

  if (!end) return null;
  if (end <= start) end.setDate(end.getDate() + 1);

  return {
    start,
    end,
    hasExactTime: true,
    usesDefaultDuration: !normalizedEndTime,
  };
};

const getTodoCscShiftConflictResult = (task = {}, shifts = []) => {
  const appointmentWindow = getTodoAppointmentWindow(task);
  if (!appointmentWindow) {
    return { conflicts: [], hasAppointmentDate: false, hasExactTime: false, usesDefaultDuration: false };
  }

  const conflicts = shifts.filter((shift) => {
    const shiftWindow = getCscShiftWindow(shift);
    if (!shiftWindow) return false;
    return appointmentWindow.start < shiftWindow.end && shiftWindow.start < appointmentWindow.end;
  });

  return {
    conflicts,
    hasAppointmentDate: true,
    hasExactTime: appointmentWindow.hasExactTime,
    usesDefaultDuration: appointmentWindow.usesDefaultDuration,
  };
};

const formatCscShiftConflictWindow = (shift = {}) => {
  const startDate = formatAppShortDate(shift.startDate);
  const finishDate = formatAppShortDate(shift.finishDate || shift.startDate);
  const startTime = formatTodoTimeForTextInput(shift.startTime);
  const finishTime = formatTodoTimeForTextInput(shift.finishTime);
  const finish = finishDate && finishDate !== startDate ? `${finishDate} ${finishTime}` : finishTime;
  return `${startDate} ${startTime} to ${finish}`.trim();
};

const formatLocalDateTimeForCalendar = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  return `${[
    String(value.getFullYear()).padStart(4, "0"),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-")}T${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}:${String(value.getSeconds()).padStart(2, "0")}`;
};

const getTodoAppointmentEndDateTime = (task = {}, dateValue = "", startTimeValue = "") => {
  const appointmentWindow = getTodoAppointmentWindow({
    ...task,
    date: dateValue,
    time: startTimeValue,
  });
  return appointmentWindow?.hasExactTime ? formatLocalDateTimeForCalendar(appointmentWindow.end) : "";
};

const getTaskFollowUpTimestamp = (task = {}) => {
  const dateValue = normalizeTodoCalendarDate(task.followUpDate || "");
  if (!dateValue) return Number.NaN;

  const [year, month, day] = dateValue.split("-").map(Number);
  const normalizedTime = normalizeTodoCalendarTime(task.followUpTime || "") || "00:00:00";
  const [hour, minute, second] = normalizedTime.split(":").map(Number);
  const followUpDateTime = new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);

  return followUpDateTime.getTime();
};

const isTaskFollowUpDue = (task = {}, nowTimestamp = Date.now()) => {
  const followUpTimestamp = getTaskFollowUpTimestamp(task);
  return Number.isFinite(followUpTimestamp) && followUpTimestamp <= nowTimestamp;
};

const formatTaskFollowUpSchedule = (task = {}) =>
  [formatAppShortDate(task.followUpDate), task.followUpTime ? formatTodoTimeForTextInput(task.followUpTime) : ""]
    .filter(Boolean)
    .join(" at ");

const TodoDatePickerInput = ({ value, onChange, className = "", placeholder = "mm/dd/yyyy" }) => {
  const pickerRef = useRef(null);
  const normalizedValue = normalizeTodoCalendarDate(value);

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;

    if (typeof picker.showPicker === "function") {
      picker.showPicker();
      return;
    }

    picker.focus();
    picker.click();
  };

  return (
    <div className="flex items-center gap-1">
      <input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={className}
      />
      <input
        ref={pickerRef}
        type="date"
        value={normalizedValue}
        onChange={(event) => onChange(formatTodoDateForTextInput(event.target.value))}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={openPicker}
        title="Pick date"
        aria-label="Pick date"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-blue-600 shadow-sm hover:bg-slate-50"
      >
        <CalendarPlus className="h-4 w-4" />
      </button>
    </div>
  );
};

const TodoTimePickerInput = ({ value, onChange, className = "", placeholder = "h:mm AM" }) => {
  const pickerRef = useRef(null);
  const normalizedValue = normalizeTodoCalendarTime(value);
  const pickerValue = normalizedValue ? normalizedValue.slice(0, 5) : "";

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;

    if (typeof picker.showPicker === "function") {
      picker.showPicker();
      return;
    }

    picker.focus();
    picker.click();
  };

  return (
    <div className="flex items-center gap-1">
      <input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        onBlur={(event) => onChange(formatTodoTimeForTextInput(event.target.value))}
        placeholder={placeholder}
        className={className}
      />
      <input
        ref={pickerRef}
        type="time"
        value={pickerValue}
        onChange={(event) => onChange(formatTodoTimeForTextInput(event.target.value))}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={openPicker}
        title="Pick time"
        aria-label="Pick time"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-blue-600 shadow-sm hover:bg-slate-50"
      >
        <Clock className="h-4 w-4" />
      </button>
    </div>
  );
};


function loadTodoScanScriptOnce(src, globalName) {
  return new Promise((resolve, reject) => {
    if (globalName && window[globalName]) {
      resolve(window[globalName]);
      return;
    }

    const existing = document.querySelector(`script[data-todo-scan-src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(globalName ? window[globalName] : true), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.todoScanSrc = src;
    script.onload = () => resolve(globalName ? window[globalName] : true);
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

function readTodoScanFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function readTodoScanFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsArrayBuffer(file);
  });
}

async function getTodoScanTesseract() {
  return loadTodoScanScriptOnce("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js", "Tesseract");
}

async function getTodoScanPdfJs() {
  const pdfjsLib = await loadTodoScanScriptOnce("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js", "pdfjsLib");
  if (pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }
  return pdfjsLib;
}

async function ocrTodoScanImageDataUrl(dataUrl) {
  const Tesseract = await getTodoScanTesseract();
  const result = await Tesseract.recognize(dataUrl, "eng");
  return result?.data?.text || "";
}

async function ocrTodoScanPdfFile(file) {
  const [pdfjsLib, arrayBuffer] = await Promise.all([getTodoScanPdfJs(), readTodoScanFileAsArrayBuffer(file)]);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");
    const text = await ocrTodoScanImageDataUrl(dataUrl);
    pageTexts.push(text);
  }

  return pageTexts.join("\n\n");
}

const limitTodoScanText = (value = "") => {
  const text = String(value || "").trim();
  if (text.length <= MAX_TASK_SCAN_TEXT_LENGTH) return text;
  return `${text.slice(0, MAX_TASK_SCAN_TEXT_LENGTH).trim()}\n\n[Scan text truncated to ${MAX_TASK_SCAN_TEXT_LENGTH.toLocaleString()} characters.]`;
};

const buildTodoScanDocumentBlock = (fileName = "", text = "") =>
  [fileName ? `Scanned document: ${fileName}` : "Scanned document", limitTodoScanText(text)]
    .filter(Boolean)
    .join("\n");

const appendTodoScanTextBlock = (currentValue = "", nextValue = "") =>
  [String(currentValue || "").trim(), String(nextValue || "").trim()]
    .filter(Boolean)
    .join("\n\n");

const addDaysToTodoCalendarDate = (dateValue, days = 1) => {
  const normalized = normalizeTodoCalendarDate(dateValue);
  if (!normalized) return "";

  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const findTodoCalendarTime = (task = {}) => {
  const directTimeValue = normalizeTodoCalendarTime(task.time || task.startTime || task.appointmentTime || "");
  if (directTimeValue) return directTimeValue;

  const haystack = [
    task.details,
    task.questions,
    task.notes,
    task.followUpNotes,
    ...getFollowUpEntries(task).map((entry) => stripTodoCalendarHtml(entry?.text || "")),
  ]
    .filter(Boolean)
    .join("\n");

  const match = haystack.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (!match) return "";
  return normalizeTodoCalendarTime(match[0]);
};

const addHoursToTodoCalendarDateTime = (dateValue, timeValue, hours = 1) => {
  const normalized = normalizeTodoCalendarDate(dateValue);
  if (!normalized || !timeValue) return "";

  const [year, month, day] = normalized.split("-").map(Number);
  const [hour, minute, second] = timeValue.split(":").map(Number);
  const date = new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
  date.setHours(date.getHours() + hours);

  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-") + `T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
};

const buildTodoGoogleCalendarEventPayload = (task = {}) => {
  const dateValue = normalizeTodoCalendarDate(task.deadline || task.date || task.effectiveDate || "");
  if (!dateValue) {
    throw new Error("Add a due date or date before sending this task to Google Calendar.");
  }

  const timeValue = findTodoCalendarTime(task);
  const noteText = stripTodoCalendarHtml(task.notes || task.followUpNotes || "");
  const followUpText = getFollowUpEntries(task)
    .map((entry) => stripTodoCalendarHtml(entry?.text || ""))
    .filter(Boolean)
    .join("\n\n");

  const description = [
    task.details ? `Details:\n${task.details}` : "",
    timeValue ? `Time: ${formatTodoTimeForTextInput(timeValue)}` : "",
    task.phone ? `Phone: ${task.phone}` : "",
    task.organization ? `Organization: ${task.organization}` : "",
    task.company ? `Company: ${task.company}` : "",
    task.person ? `Person: ${task.person}` : "",
    task.caseNumber ? `Case #: ${task.caseNumber}` : "",
    task.policyNumber ? `Policy #: ${task.policyNumber}` : "",
    task.amount ? `Amount: ${task.amount}` : "",
    task.website || task.systemLink ? `Website: ${task.website || task.systemLink}` : "",
    task.questions ? `Questions:\n${task.questions}` : "",
    normalizeTaskWorkflowStatus(task.status) === "Waiting" ? "Status: Waiting" : "",
    task.waitingOn ? `Waiting on: ${task.waitingOn}` : "",
    task.followUpDate ? `Follow-up: ${formatTaskFollowUpSchedule(task)}` : "",
    noteText ? `Notes:\n${noteText}` : "",
    followUpText ? `Follow-up notes:\n${followUpText}` : "",
    normalizeTaskAttachments(task.attachments).length
      ? `Attached files:\n${normalizeTaskAttachments(task.attachments)
          .map((attachment) => `${attachment.originalName || attachment.savedName || "Attached file"}: ${attachment.url || attachment.savedName || ""}`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const payload = {
    summary: task.taskName || task.title || "To-Do Task",
    location: task.address || "",
    description,
  };

  if (timeValue) {
    payload.start = {
      dateTime: `${dateValue}T${timeValue}`,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
    };
    payload.end = {
      dateTime: getTodoAppointmentEndDateTime(task, dateValue, timeValue) || addHoursToTodoCalendarDateTime(dateValue, timeValue, 1),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles",
    };
  } else {
    payload.start = { date: dateValue };
    payload.end = { date: addDaysToTodoCalendarDate(dateValue, 1) };
  }

  return payload;
};


const combineNotesIntoFollowUpEntries = (task = {}) => {
  const notesText = String(task.notes || "").trim();

  if (!notesText) {
    return { ...task, notes: "" };
  }

  const existingEntries = getFollowUpEntries(task);
  const alreadySaved = existingEntries.some((entry) => String(entry?.text || "").trim() === notesText);
  const createdAt = task.updatedAt || task.createdAt || new Date().toISOString();

  return {
    ...task,
    notes: "",
    followUpEntries: alreadySaved
      ? existingEntries
      : [
          {
            id: `notes-${task.id || createId()}`,
            text: notesText,
            createdAt,
            source: "notes",
          },
          ...existingEntries,
        ],
  };
};

const stampTask = (task = {}, action, detail = "") => {
  const createdAt = task.createdAt || new Date().toISOString();
  return addTaskHistory({ ...task, createdAt }, action, detail);
};


const createId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const normalizeTaskAttachment = (attachment = {}) => ({
  id: attachment.id || `file-${createId()}`,
  originalName: attachment.originalName || attachment.name || attachment.fileName || "Attached file",
  savedName: attachment.savedName || "",
  url: attachment.url || "",
  viewUrl: attachment.viewUrl || "",
  downloadUrl: attachment.downloadUrl || "",
  mimeType: attachment.mimeType || attachment.type || "",
  size: Number(attachment.size || attachment.sizeBytes || 0) || 0,
  uploadedAt: attachment.uploadedAt || new Date().toISOString(),
});

const normalizeTaskAttachments = (attachments) => {
  if (!Array.isArray(attachments)) return [];

  return attachments
    .map(normalizeTaskAttachment)
    .filter((attachment) => attachment.url || attachment.savedName || attachment.originalName);
};

const formatTaskAttachmentSize = (size = 0) => {
  const bytes = Number(size || 0);
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getTaskFileUploadEndpointCandidates = () => {
  if (typeof window === "undefined") return [TASK_FILE_UPLOAD_ENDPOINT];

  const isLocalDevHost = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || "");
  const candidates = isLocalDevHost
    ? [TASK_FILE_UPLOAD_LOCALWP_ENDPOINT, TASK_FILE_UPLOAD_ENDPOINT]
    : [TASK_FILE_UPLOAD_ENDPOINT];

  return Array.from(new Set(candidates));
};

const getTaskFileEndpointBase = () => {
  if (typeof window === "undefined") return TASK_FILE_UPLOAD_ENDPOINT;

  const isLocalDevHost = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || "");
  return isLocalDevHost ? TASK_FILE_UPLOAD_LOCALWP_ENDPOINT : TASK_FILE_UPLOAD_ENDPOINT;
};

const getTaskFileLocalWpOrigin = () => {
  try {
    return new URL(TASK_FILE_UPLOAD_LOCALWP_ENDPOINT).origin;
  } catch {
    return "";
  }
};

const resolveTaskAttachmentUrl = (url = "") => {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("blob:") || value.startsWith("data:")) return value;

  if (typeof window === "undefined") return value;

  const isLocalDevHost = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || "");
  if (isLocalDevHost && value.startsWith(`${TASK_FILE_PUBLIC_BASE_PATH}/`)) {
    const origin = getTaskFileLocalWpOrigin();
    return origin ? `${origin}${value}` : value;
  }

  return value;
};

const buildTaskFileEndpointUrl = (action, attachment = {}) => {
  const savedName = String(attachment.savedName || "").trim();
  if (!savedName) return "";

  const params = new URLSearchParams();
  params.set("action", action);
  params.set("savedName", savedName);

  const originalName = String(attachment.originalName || "").trim();
  if (originalName) params.set("name", originalName);

  return `${getTaskFileEndpointBase()}?${params.toString()}`;
};

const getTaskAttachmentViewUrl = (attachment = {}) => {
  if (attachment.viewUrl) return resolveTaskAttachmentUrl(attachment.viewUrl);
  if (attachment.savedName) return buildTaskFileEndpointUrl("view", attachment);
  return resolveTaskAttachmentUrl(attachment.url);
};

const getTaskAttachmentDownloadUrl = (attachment = {}) => {
  if (attachment.downloadUrl) return resolveTaskAttachmentUrl(attachment.downloadUrl);
  if (attachment.savedName) return buildTaskFileEndpointUrl("download", attachment);
  return resolveTaskAttachmentUrl(attachment.url);
};

const createEmptyTask = () => ({
  ...DEFAULT_FORM,
  id: createId(),
  attachments: [],
});

const createPrintSafeTask = (task = {}) => ({
  ...task,
  documents: "",
  fileName: "",
  attachments: [],
  sourceTaskSnapshot: task.sourceTaskSnapshot
    ? {
        ...task.sourceTaskSnapshot,
        documents: "",
        fileName: "",
        attachments: [],
      }
    : task.sourceTaskSnapshot,
});

const getCategoryAnchorId = (type) =>
  `todo-category-${String(type).replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`;


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
    task.effectiveDate ? `Effective date: ${formatAppShortDate(task.effectiveDate)}` : '',
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

    const normalizedTask = normalizeTaskCategory(task);
    if (JSON.stringify(normalizedTask) !== JSON.stringify(task)) changed = true;
    normalizedTasks.push(normalizedTask);
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


const readStoredArchivedTasks = () => {
  try {
    const saved = localStorage.getItem(ARCHIVE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed.map(normalizeTaskCategory) : [];
  } catch {
    return [];
  }
};

const writeStoredArchivedTasks = (items) => {
  try {
    localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(Array.isArray(items) ? items : []));
  } catch {
    // Keep the UI responsive if browser storage is unavailable.
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
  const cleanValue = TIME_PICKER_FIELDS.has(field) ? formatTodoTimeForTextInput(value) : String(value || "").trim();
  if (!cleanValue) return;

  if (!task[field]) {
    task[field] = cleanValue;
    return;
  }

  if (!String(task[field]).includes(cleanValue)) {
    task[field] = `${task[field]}\n${cleanValue}`;
  }
};

const getExplicitTaskType = (task) => {
  const title = String(task?.taskName || "").toLowerCase();
  const details = String(task?.details || "").toLowerCase();
  const notes = String(task?.notes || "").toLowerCase();
  const text = `${title} ${details} ${notes}`;

  if (/\bcall\s+dpss\b|\bdpss\b|calfresh|medi-cal|redetermination|benefitscal|\bgr\b/.test(text)) return "DPSS / Benefits";
  if (/secure\s+moving\s+assistance|\bmoving\b|move-in|move-out|storage|211\s*la/.test(text)) return "Moving";
  if (/parking citation|citationprocessingcenter|dmv|registration renewal|vehicle registration|plate\s*:|vin\s*:/.test(text)) return "DMV / Vehicle";
  if (/auto insurance|insurance assignment|caarp|aipso|integon|policy|coverage|carrier|premium|cancelled|canceled/.test(text)) return "Insurance";
  if (/dental|dentist|bhakta/.test(text)) return "Dental";
  if (/csc|reactivation|retraining|work|job|shift|schedule/.test(text)) return "Work";
  if (/attorney|lawyer|court|legal|hearing|notice|eviction|custodio|dubey/.test(text)) return "Legal";
  if (/doctor|medical|clinic|podiatry|urology|oncology|cardiology|blood draw|quest|lab|authorization|referral|antibiotics|wound/.test(text)) return "Medical";

  return "";
};

const inferTaskType = (task) => {
  const manualOverride = cleanTaskCategoryName(task?.typeOverride);
  if (manualOverride) return manualOverride;

  const explicitType = getExplicitTaskType(task);
  if (explicitType) return explicitType;

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

  if (/(dpss|calfresh|medi-cal|gr\b|benefitscal|benefits|redetermination|case\s?#)/i.test(haystack)) return "DPSS / Benefits";
  if (/(move|moving|move-in|move-out|storage|rental|211 la)/i.test(haystack)) return "Moving";
  if (/(insurance|integon|policy|coverage|carrier|premium|cancelled|canceled|effective date|policy status|caarp|aipso)/i.test(haystack)) return "Insurance";
  if (/(dmv|registration|plate|vin|vehicle|license|parking citation|citationprocessingcenter)/i.test(haystack)) return "DMV / Vehicle";
  if (/(doctor|medical|clinic|podiatry|urology|oncology|cardiology|blood draw|quest|lab|authorization|referral|antibiotics|wound)/i.test(haystack)) return "Medical";
  if (/(court|legal|attorney|lawyer|hearing|notice|eviction|custodio|dubey)/i.test(haystack)) return "Legal";
  if (/(work|job|shift|schedule|reactivation|retraining|csc)/i.test(haystack)) return "Work";
  if (/(dental|dentist|teeth|bhakta)/i.test(haystack)) return "Dental";

  const manualType = cleanTaskCategoryName(task?.type);
  return manualType || "General";
};

const normalizeTaskCategory = (task = {}) => {
  const correctedType = inferTaskType(task);
  const normalizedType = normalizeType(correctedType);
  const overrideCandidate = cleanTaskCategoryName(task.typeOverride);
  const normalizedOverride = overrideCandidate ? normalizeType(overrideCandidate) : "";
  const website = String(task.website || task.systemLink || "").trim();

  return combineNotesIntoFollowUpEntries({
    ...task,
    type: normalizedType,
    typeOverride: normalizedOverride,
    website,
    systemLink: "",
    status: normalizeTaskWorkflowStatus(task.status),
    followUpTime: task.followUpTime ? formatTodoTimeForTextInput(task.followUpTime) : "",
    attachments: normalizeTaskAttachments(task.attachments),
    phone: formatPhoneNumber(task.phone || ""),
    directPhone: formatPhoneNumber(task.directPhone || ""),
    cellPhone: formatPhoneNumber(task.cellPhone || ""),
    fax: formatPhoneNumber(task.fax || ""),
  });
};

const normalizeDerivedFields = (task) => {
  const combined = `${task.taskName}\n${task.details}\n${task.notes}\n${task.documents}\n${task.requiredAction}\n${task.impact}`;

  if (!task.website && task.systemLink) {
    task.website = String(task.systemLink).trim();
  }
  task.systemLink = "";

  if (!task.phone) {
    const phoneMatch = combined.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    if (phoneMatch) task.phone = phoneMatch[0].trim();
  }

  PHONE_NUMBER_FIELDS.forEach((field) => {
    task[field] = formatPhoneNumber(task[field] || "");
  });

  if (!task.website) {
    const urlMatch = combined.match(/https?:\/\/[^\s]+|www\.[^\s]+/i);
    if (urlMatch) {
      task.website = urlMatch[0].trim();
    }
  }

  if (!task.amount) {
    const amountMatch = combined.match(/\$\s?\d[\d,]*(?:\.\d{2})?(?:\s?→\s?\$\s?\d[\d,]*(?:\.\d{2})?)?/);
    if (amountMatch) task.amount = amountMatch[0].trim();
  }

  if (task.time) {
    task.time = formatTodoTimeForTextInput(task.time);
  }

  task.status = normalizeTaskWorkflowStatus(task.status);

  if (task.followUpTime) {
    task.followUpTime = formatTodoTimeForTextInput(task.followUpTime);
  }

  if (!task.time) {
    const timeMatch = combined.match(/\b(?:time|appointment time|start time)\s*:?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\b/i);
    if (timeMatch) task.time = formatTodoTimeForTextInput(timeMatch[1]);
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

export default function TodoTab({ contacts: sharedContacts, onContactsChange } = {}) {
  const hasHydrated = useRef(false);
  const [tasks, setTasks] = useState(readStoredTasks);
  const printListTasks = useMemo(() => tasks.map(createPrintSafeTask), [tasks]);
  const [form, setForm] = useState(createEmptyTask);
  const [scheduledCscShifts, setScheduledCscShifts] = useState(readScheduledCscShifts);
  const [importText, setImportText] = useState("");
  const [parsedTasks, setParsedTasks] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showContactFields, setShowContactFields] = useState(false);
  const [showMoreContactFields, setShowMoreContactFields] = useState(false);
  const [showDependencyFields, setShowDependencyFields] = useState(false);
  const [showNotesFields, setShowNotesFields] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPremiumTodoView, setShowPremiumTodoView] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isDataOpen, setIsDataOpen] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [taskSearch, setTaskSearch] = useState("");
  const [taskViewFilter, setTaskViewFilter] = useState("all");
  const [movingTaskId, setMovingTaskId] = useState(null);
  const [isArchiveDrawerOpen, setIsArchiveDrawerOpen] = useState(false);
  const [archivedTasks, setArchivedTasks] = useState(readStoredArchivedTasks);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [checkedTaskIds, setCheckedTaskIds] = useState([]);
  const [bulkMoveType, setBulkMoveType] = useState(TASK_TYPES[0] || "General");
  const [customTaskCategories, setCustomTaskCategories] = useState(readStoredCustomTaskCategories);
  const [followUpDrafts, setFollowUpDrafts] = useState({});
  const [editingFollowUpEntries, setEditingFollowUpEntries] = useState({});
  const [localContacts, setLocalContacts] = useState(() => getInitialContactsForState(sharedContacts));
  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [contactForm, setContactForm] = useState(createEmptyContact);
  const [editingContactId, setEditingContactId] = useState(null);
  const [replaceExistingContactFields, setReplaceExistingContactFields] = useState(false);
  const [contactApplyTarget, setContactApplyTarget] = useState("form");
  const contacts = useMemo(() => getInitialContactsForState(sharedContacts?.length ? sharedContacts : localContacts), [sharedContacts, localContacts]);
  const alphabetizedContacts = useMemo(
    () =>
      [...contacts].sort((first, second) =>
        compareAlphabetically(
          `${first.name || ""} ${first.category || ""}`,
          `${second.name || ""} ${second.category || ""}`
        )
      ),
    [contacts]
  );
  const taskCategoryTypes = useMemo(
    () => mergeTaskCategories(TASK_TYPES, customTaskCategories, extractTaskCategoryNames(tasks)).sort(compareAlphabetically),
    [customTaskCategories, tasks]
  );

  useEffect(() => {
    writeStoredCustomTaskCategories(customTaskCategories);
  }, [customTaskCategories]);

  useEffect(() => {
    if (!taskCategoryTypes.includes(bulkMoveType)) {
      setBulkMoveType(taskCategoryTypes[0] || "General");
    }
  }, [bulkMoveType, taskCategoryTypes]);

  const setContacts = useCallback((updater) => {
    setLocalContacts((current) => {
      const baseContacts = getInitialContactsForState(sharedContacts?.length ? sharedContacts : current);
      const nextContacts = normalizeContacts(
        typeof updater === "function" ? updater(baseContacts) : updater
      );

      if (typeof onContactsChange === "function") {
        onContactsChange(nextContacts);
      }

      return nextContacts;
    });
  }, [onContactsChange, sharedContacts]);
  const [completionCelebration, setCompletionCelebration] = useState(null);
  const [calendarAddingTaskId, setCalendarAddingTaskId] = useState("");
  const [calendarAddedIds, setCalendarAddedIds] = useState(readTodoGoogleCalendarAddedIds);
  const [isTaskScanOpen, setIsTaskScanOpen] = useState(false);
  const [taskScanText, setTaskScanText] = useState("");
  const [taskScanFileName, setTaskScanFileName] = useState("");
  const [taskScanStatus, setTaskScanStatus] = useState("");
  const [taskScanError, setTaskScanError] = useState("");
  const [isTaskFileUploading, setIsTaskFileUploading] = useState(false);
  const [taskFileUploadStatus, setTaskFileUploadStatus] = useState("");
  const [taskFileUploadError, setTaskFileUploadError] = useState("");
  const [statusClock, setStatusClock] = useState(() => Date.now());
  const completionCelebrationTimeoutRef = useRef(null);
  const previousTaskCompletionRef = useRef(new Map(tasks.map((task) => [task.id, Boolean(task.completed)])));
  const cscAppointmentConflictResult = useMemo(
    () => getTodoCscShiftConflictResult(form, scheduledCscShifts),
    [form.date, form.time, form.endTime, scheduledCscShifts]
  );

  const resetTaskScan = useCallback(() => {
    setIsTaskScanOpen(false);
    setTaskScanText("");
    setTaskScanFileName("");
    setTaskScanStatus("");
    setTaskScanError("");
    setIsTaskFileUploading(false);
    setTaskFileUploadStatus("");
    setTaskFileUploadError("");
  }, []);

  useEffect(() => {
    hasHydrated.current = true;
  }, []);

  useEffect(() => {
    const refreshScheduledCscShifts = () => setScheduledCscShifts(readScheduledCscShifts());

    refreshScheduledCscShifts();
    window.addEventListener(CSC_SHIFT_UPDATE_EVENT, refreshScheduledCscShifts);
    window.addEventListener("storage", refreshScheduledCscShifts);
    window.addEventListener("focus", refreshScheduledCscShifts);

    return () => {
      window.removeEventListener(CSC_SHIFT_UPDATE_EVENT, refreshScheduledCscShifts);
      window.removeEventListener("storage", refreshScheduledCscShifts);
      window.removeEventListener("focus", refreshScheduledCscShifts);
    };
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => setStatusClock(Date.now()), 30000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const openCreateTask = () => {
      setForm(createEmptyTask());
      setEditingId(null);
      setShowAdvanced(false);
      setShowContactFields(false);
      setShowMoreContactFields(false);
      setShowDependencyFields(false);
      setShowNotesFields(false);
      resetTaskScan();
      setIsCreateOpen(true);
    };

    const openArchiveDrawer = () => {
      setArchivedTasks(readStoredArchivedTasks());
      setIsArchiveDrawerOpen(true);
    };

    const saveSnapshot = () => {
      writeSafetySnapshot("Toolbar safety snapshot", tasks, archivedTasks);
      alert("Safety snapshot saved.");
    };

    const openExport = () => setIsExportOpen(true);
    const openImport = () => setIsImportOpen(true);
    const openData = () => setIsDataOpen(true);

    window.addEventListener("todo-toolbar:add", openCreateTask);
    window.addEventListener("todo-toolbar:archive", openArchiveDrawer);
    window.addEventListener("todo-toolbar:snapshot", saveSnapshot);
    window.addEventListener("todo-toolbar:save", saveSnapshot);
    window.addEventListener("todo-toolbar:export", openExport);
    window.addEventListener("todo-toolbar:import", openImport);
    window.addEventListener("todo-toolbar:data", openData);

    return () => {
      window.removeEventListener("todo-toolbar:add", openCreateTask);
      window.removeEventListener("todo-toolbar:archive", openArchiveDrawer);
      window.removeEventListener("todo-toolbar:snapshot", saveSnapshot);
      window.removeEventListener("todo-toolbar:save", saveSnapshot);
      window.removeEventListener("todo-toolbar:export", openExport);
      window.removeEventListener("todo-toolbar:import", openImport);
      window.removeEventListener("todo-toolbar:data", openData);
    };
  }, [tasks, archivedTasks, resetTaskScan]);

  const playCompletionSound = () => {
    if (typeof window === "undefined") return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const audioContext = new AudioContext();
      const now = audioContext.currentTime;
      const masterGain = audioContext.createGain();

      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
      masterGain.connect(audioContext.destination);

      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const noteGain = audioContext.createGain();
        const start = now + index * 0.1;
        const stop = start + 0.22;

        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(frequency, start);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.08, stop);
        noteGain.gain.setValueAtTime(0.0001, start);
        noteGain.gain.exponentialRampToValueAtTime(0.35, start + 0.025);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, stop);
        oscillator.connect(noteGain);
        noteGain.connect(masterGain);
        oscillator.start(start);
        oscillator.stop(stop + 0.03);
      });

      window.setTimeout(() => {
        audioContext.close().catch(() => {});
      }, 1500);
    } catch {}
  };

  const showCompletionCelebration = (count = 1, taskName = "") => {
    if (completionCelebrationTimeoutRef.current) {
      window.clearTimeout(completionCelebrationTimeoutRef.current);
      completionCelebrationTimeoutRef.current = null;
    }

    playCompletionSound();

    setCompletionCelebration({
      id: Date.now(),
      count,
      taskName: String(taskName ?? "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    });
  };



  useEffect(() => {
    const previousTaskCompletion = previousTaskCompletionRef.current;
    const newlyCompletedTasks = tasks.filter((task) => {
      const wasCompleted = previousTaskCompletion.get(task.id);
      return wasCompleted === false && task.completed === true;
    });

    previousTaskCompletionRef.current = new Map(tasks.map((task) => [task.id, Boolean(task.completed)]));

    if (!newlyCompletedTasks.length) return;

    showCompletionCelebration(
      newlyCompletedTasks.length,
      newlyCompletedTasks.length === 1 ? newlyCompletedTasks[0].taskName : ""
    );
  }, [tasks]);

  useEffect(() => {
    return () => {
      if (completionCelebrationTimeoutRef.current) {
        window.clearTimeout(completionCelebrationTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setTasks((current) => {
      const normalized = normalizeInsuranceDmvTasks(current).tasks;
      const changed = JSON.stringify(normalized) !== JSON.stringify(current);
      return changed ? normalized : current;
    });
  }, []);

  useEffect(() => {
    if (!hasHydrated.current) return;

    const currentSaved = localStorage.getItem(STORAGE_KEY);
    if (currentSaved && currentSaved !== "[]") {
      localStorage.setItem(STORAGE_BACKUP_KEY, currentSaved);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeInsuranceDmvTasks(tasks).tasks));
  }, [tasks]);

  useEffect(() => {
    const refreshArchivedTasks = () => setArchivedTasks(readStoredArchivedTasks());

    window.addEventListener("todoTasksChanged", refreshArchivedTasks);
    window.addEventListener("storage", refreshArchivedTasks);

    return () => {
      window.removeEventListener("todoTasksChanged", refreshArchivedTasks);
      window.removeEventListener("storage", refreshArchivedTasks);
    };
  }, []);

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

    return orderTaskFormFields(
      Array.from(new Set([...typeFields, ...valuedFields])).filter(
        (field) => !["taskName", "details", "type", "typeOverride", "blockedBy", "contactId", "completed", "id"].includes(field)
      )
    );
  }, [form]);

  const scheduleFormFields = SCHEDULE_FORM_FIELDS.filter(
    (field) => ["date", "time", "endTime", "deadline"].includes(field) || visibleFormFields.includes(field)
  );
  const contactFormFields = CONTACT_FORM_FIELDS;
  const primaryContactFormFields = contactFormFields.filter((field) => PRIMARY_CONTACT_FIELDS.has(field));
  const additionalContactFormFields = contactFormFields.filter((field) => !PRIMARY_CONTACT_FIELDS.has(field));
  const preparationFormFields = PREPARATION_FORM_FIELDS.filter((field) => visibleFormFields.includes(field));
  const followUpFormFields = FOLLOW_UP_FORM_FIELDS;
  const organizedFormFieldNames = new Set([
    ...scheduleFormFields,
    ...followUpFormFields,
    ...contactFormFields,
    ...preparationFormFields,
  ]);
  const categoryDetailFormFields = visibleFormFields.filter((field) => !organizedFormFieldNames.has(field));
  const advancedFormFields = Object.keys(DEFAULT_FORM)
    .filter((field) => !["taskName", "details", "type", "typeOverride", "blockedBy", "contactId", "completed", "id", "systemLink"].includes(field))
    .filter((field) => !organizedFormFieldNames.has(field) && !categoryDetailFormFields.includes(field));

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const addCustomTaskCategory = (rawCategoryName, options = {}) => {
    const typedCategory = cleanTaskCategoryName(rawCategoryName);
    if (!typedCategory || isLegacyTaskCategory(typedCategory)) return "";

    const existingCategory = taskCategoryTypes.find(
      (category) => category.toLowerCase() === typedCategory.toLowerCase()
    );
    const nextCategory = existingCategory || typedCategory;

    if (!existingCategory) {
      setCustomTaskCategories((current) =>
        mergeTaskCategories(current, nextCategory).filter((category) => !TASK_TYPES.includes(category))
      );
    }

    if (options.selectInTaskForm) {
      setForm((current) => ({ ...current, type: nextCategory, typeOverride: nextCategory }));
      setBulkMoveType(nextCategory);
    }

    return nextCategory;
  };

  const applyTaskScanTextToForm = (rawText = taskScanText, fileName = taskScanFileName) => {
    const limitedText = limitTodoScanText(rawText);
    if (!limitedText.trim() && !fileName) return;

    const parsedTask = limitedText.trim() ? parseStructuredTask(limitedText) : createEmptyTask();
    const documentBlock = buildTodoScanDocumentBlock(fileName, limitedText);

    setForm((current) => {
      const next = { ...current };

      TASK_SCAN_FILL_FIELDS.forEach((field) => {
        const parsedValue = parsedTask[field];
        if (!parsedValue) return;

        if (field === "type" || field === "typeOverride") {
          if ((!next.type || next.type === "General") && taskCategoryTypes.includes(parsedValue)) {
            next.type = parsedValue;
            next.typeOverride = parsedValue;
          }
          return;
        }

        if (!String(next[field] || "").trim()) {
          next[field] = parsedValue;
        }
      });

      if (fileName && !String(next.fileName || "").trim()) {
        next.fileName = fileName;
      }

      if (documentBlock && !String(next.documents || "").includes(documentBlock)) {
        next.documents = appendTodoScanTextBlock(next.documents, documentBlock);
      }

      return normalizeDerivedFields(next);
    });
  };

  const scanTaskFile = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setTaskScanError("");
    setTaskFileUploadError("");
    setTaskFileUploadStatus("");
    setIsTaskFileUploading(true);

    try {
      const uploadedNames = [];
      let latestScanText = "";
      let latestScanFileName = "";

      for (const file of files) {
        setTaskFileUploadStatus(`Saving ${file.name} to local documents...`);
        const attachment = await processTaskFileUpload(file);
        uploadedNames.push(attachment.originalName || file.name);

        let text = "";

        if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
          setTaskScanStatus(`Scanning ${file.name}...`);
          text = await ocrTodoScanPdfFile(file);
        } else if (file.type.startsWith("image/")) {
          setTaskScanStatus(`Scanning ${file.name}...`);
          const dataUrl = await readTodoScanFileAsDataUrl(file);
          text = await ocrTodoScanImageDataUrl(dataUrl);
        } else if (/\.txt$/i.test(file.name)) {
          setTaskScanStatus(`Reading ${file.name}...`);
          text = await file.text();
        }

        if (text.trim()) {
          const limitedText = limitTodoScanText(text);
          latestScanText = latestScanText ? `${latestScanText}\n\n${limitedText}` : limitedText;
          latestScanFileName = file.name;
          applyTaskScanTextToForm(limitedText, file.name);
        }
      }

      if (latestScanText) {
        setTaskScanText(limitTodoScanText(latestScanText));
        setTaskScanFileName(latestScanFileName);
        setTaskScanStatus("Scan complete. Text was added to Documents and blank task fields were filled.");
      } else {
        setTaskScanStatus("");
      }

      setTaskFileUploadStatus(`${uploadedNames.length} file${uploadedNames.length === 1 ? "" : "s"} saved to local documents.`);
    } catch (error) {
      setTaskFileUploadError(error?.message || "File upload failed.");
      setTaskScanStatus("");
    } finally {
      setIsTaskFileUploading(false);
      event.target.value = "";
    }
  };

  const applyEditedTaskScanText = () => {
    applyTaskScanTextToForm(taskScanText, taskScanFileName);
    setTaskScanStatus("Scan text applied to the Add Task form.");
    setTaskScanError("");
  };

  const clearTaskScan = () => {
    setTaskScanText("");
    setTaskScanFileName("");
    setTaskScanStatus("");
    setTaskScanError("");
  };

  const uploadTaskFileToLocalDrive = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("taskId", form.id || createId());
    formData.append("taskName", form.taskName || "task-file");

    let lastError = null;

    for (const endpoint of getTaskFileUploadEndpointCandidates()) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        const responseText = await response.text();
        let payload = null;

        try {
          payload = JSON.parse(responseText);
        } catch {
          throw new Error("Upload endpoint did not return JSON.");
        }

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || `Upload failed with status ${response.status}.`);
        }

        return normalizeTaskAttachment(payload.file || payload);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Could not upload file.");
  };

  const deleteTaskFileFromLocalDrive = async (attachment) => {
    if (!attachment?.savedName) return true;

    const formData = new FormData();
    formData.append("action", "delete");
    formData.append("savedName", attachment.savedName);

    let lastError = null;

    for (const endpoint of getTaskFileUploadEndpointCandidates()) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });

        const responseText = await response.text();
        let payload = null;

        try {
          payload = JSON.parse(responseText);
        } catch {
          throw new Error("Delete endpoint did not return JSON.");
        }

        if (!response.ok || payload?.ok === false) {
          throw new Error(payload?.error || `Delete failed with status ${response.status}.`);
        }

        return true;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Could not delete file.");
  };

  const addTaskAttachmentToForm = (attachment) => {
    setForm((current) => ({
      ...current,
      attachments: normalizeTaskAttachments([...(current.attachments || []), attachment]),
      fileName: current.fileName || attachment.originalName || current.fileName,
    }));
  };

  const removeTaskAttachmentFromForm = async (attachmentId) => {
    const attachment = normalizeTaskAttachments(form.attachments).find((item) => item.id === attachmentId);
    if (!attachment) return;

    if (!window.confirm(`Remove ${attachment.originalName || "this file"} from this task?`)) return;

    try {
      await deleteTaskFileFromLocalDrive(attachment);
    } catch (error) {
      const removeLinkOnly = window.confirm(
        `${error?.message || "Could not delete the local file."} Remove the file link from this task anyway?`
      );
      if (!removeLinkOnly) return;
    }

    setForm((current) => ({
      ...current,
      attachments: normalizeTaskAttachments(current.attachments).filter((item) => item.id !== attachmentId),
    }));
  };

  const removeTaskAttachment = async (taskId, attachmentId) => {
    const task = tasks.find((item) => item.id === taskId);
    const attachment = normalizeTaskAttachments(task?.attachments).find((item) => item.id === attachmentId);
    if (!task || !attachment) return;

    if (!window.confirm(`Remove ${attachment.originalName || "this file"} from this task?`)) return;

    try {
      await deleteTaskFileFromLocalDrive(attachment);
    } catch (error) {
      const removeLinkOnly = window.confirm(
        `${error?.message || "Could not delete the local file."} Remove the file link from this task anyway?`
      );
      if (!removeLinkOnly) return;
    }

    setTasks((current) =>
      current.map((item) =>
        item.id === taskId
          ? addTaskHistory(
              {
                ...item,
                attachments: normalizeTaskAttachments(item.attachments).filter((file) => file.id !== attachmentId),
                updatedAt: new Date().toISOString(),
              },
              "File removed",
              attachment.originalName || attachment.savedName || "Attached file"
            )
          : item
      )
    );
  };

  const processTaskFileUpload = async (file) => {
    const attachment = await uploadTaskFileToLocalDrive(file);
    addTaskAttachmentToForm(attachment);
    return attachment;
  };

  const closeTaskForm = () => {
    setForm(createEmptyTask());
    setEditingId(null);
    setShowAdvanced(false);
    setShowContactFields(false);
    setShowMoreContactFields(false);
    setShowDependencyFields(false);
    setShowNotesFields(false);
    resetTaskScan();
    setIsCreateOpen(false);
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
    if (!form.taskName.trim()) return;

    if (cscAppointmentConflictResult.conflicts.length > 0) {
      const conflictDetails = cscAppointmentConflictResult.conflicts
        .map((shift) => {
          const shiftName = shift.event || shift.jobName || shift.shiftName || shift.venue || "CSC shift";
          const venue = shift.venue && shift.venue !== shiftName ? `, ${shift.venue}` : "";
          return `• ${shiftName}${venue}\n  ${formatCscShiftConflictWindow(shift)}`;
        })
        .join("\n\n");
      const appointmentTimingNote = cscAppointmentConflictResult.hasExactTime
        ? cscAppointmentConflictResult.usesDefaultDuration
          ? "The appointment is being treated as one hour because no end time was entered."
          : "The appointment time overlaps the CSC shift."
        : "No appointment time was entered, so the entire date is being checked.";

      const shouldSave = window.confirm(
        `CSC shift conflict detected.\n\n${appointmentTimingNote}\n\n${conflictDetails}\n\nSave this appointment anyway?`
      );
      if (!shouldSave) return;
    }

    const taskToSave = stampTask(
      normalizeDerivedFields({
        ...form,
        taskName: form.taskName.trim(),
        details: form.details.trim(),
        id: editingId || form.id || createId(),
        typeOverride: form.typeOverride || form.type || "General",
        attachments: normalizeTaskAttachments(form.attachments),
      }),
      editingId ? "Task edited" : "Task created"
    );

    if (editingId) {
      writeSafetySnapshot("Before task edit", tasks, archivedTasks);
      setTasks((current) => current.map((task) => (task.id === editingId ? taskToSave : task)));
    } else {
      setTasks((current) => normalizeInsuranceDmvTasks(applyAutoLinks([taskToSave], current)).tasks);
    }

    setForm(createEmptyTask());
    setEditingId(null);
    setShowAdvanced(false);
    setShowContactFields(false);
    setShowMoreContactFields(false);
    setShowDependencyFields(false);
    setShowNotesFields(false);
    resetTaskScan();
    setIsCreateOpen(false);
  };

  const parseImport = () => {
    const parsed = parseTasksFromText(importText);
    setParsedTasks(parsed);

    if (parsed.length === 1) {
      setForm({ ...createEmptyTask(), ...parsed[0] });
      setShowAdvanced(true);
      setShowContactFields(hasTaskContactInformation(parsed[0]));
      setShowMoreContactFields(hasAdditionalTaskContactInformation(parsed[0]));
      setShowDependencyFields(Boolean(parsed[0].blockedBy));
      setShowNotesFields(hasTaskPreparationInformation(parsed[0]));
      resetTaskScan();
      setIsImportOpen(false);
      setIsCreateOpen(true);
    }
  };

const addParsedTasks = () => {
  if (!parsedTasks.length) return;

  writeSafetySnapshot("Before bulk import", tasks, archivedTasks);

  const newTasks = parsedTasks.map((task) =>
    stampTask(
      {
        ...task,
        id: createId(),
        completed: false,
      },
      "Task imported"
    )
  );

  setTasks((current) => {
    const updated = applyAutoLinks(newTasks, current);
    return normalizeInsuranceDmvTasks(updated).tasks;
  });

  setParsedTasks([]);
  setImportText("");
  setIsImportOpen(false);
};

  const saveTaskContact = (task = {}) => {
    const contactName = String(task.contactName || task.person || task.organization || task.company || task.taskName || "").trim();
    const contactPhone = String(task.phone || "").trim();
    const contactAddress = String(task.address || "").trim();

    if (!contactName && !contactPhone && !contactAddress) {
      window.alert("This task does not have enough contact information to save.");
      return;
    }

    const noteParts = [
      task.documents ? `Documents: ${stripTodoCalendarHtml(task.documents)}` : "",
      task.questions ? `Questions: ${stripTodoCalendarHtml(task.questions)}` : "",
      task.details ? `Details: ${stripTodoCalendarHtml(task.details)}` : "",
      task.outcome ? `Outcome: ${stripTodoCalendarHtml(task.outcome)}` : "",
      task.notes ? `Notes: ${stripTodoCalendarHtml(task.notes)}` : "",
      task.contactDetails ? stripTodoCalendarHtml(task.contactDetails) : "",
    ].filter(Boolean);

    const officeLocations = [task.address, task.address2, task.address3]
      .map((address, index) => ({
        label: index === 0 ? "Office" : `Office ${index + 1}`,
        address: String(address || "").trim(),
        phone: index === 0 ? contactPhone : "",
        fax: index === 0 ? String(task.fax || "").trim() : "",
      }))
      .filter((office) => office.address || office.phone || office.fax);

    const taskContact = normalizeContact({
      name: contactName || contactPhone || "Saved task contact",
      category: task.type || task.typeOverride || "General",
      person: task.person || contactName,
      organization: task.organization || "",
      company: task.company || "",
      phone: contactPhone,
      directPhone: task.directPhone || "",
      cellPhone: task.cellPhone || "",
      fax: task.fax || "",
      email: task.email || "",
      address: contactAddress,
      address2: task.address2 || "",
      address3: task.address3 || "",
      officeLocations,
      website: task.website || task.systemLink || "",
      notes: noteParts.join("\n"),
      updatedAt: new Date().toISOString(),
    });

    const normalizeMatch = (value = "") => String(value || "").toLowerCase().replace(/\D/g, "").trim();
    const normalizeNameMatch = (value = "") => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const taskPhoneKey = normalizeMatch(taskContact.phone);
    const taskNameKey = normalizeNameMatch(taskContact.name || taskContact.person || taskContact.organization);

    setContacts((current) => {
      const existingIndex = current.findIndex((contact) => {
        const existingPhoneKey = normalizeMatch(contact.phone);
        const existingNameKey = normalizeNameMatch(contact.name || contact.person || contact.organization);

        if (taskPhoneKey && existingPhoneKey && taskPhoneKey === existingPhoneKey) return true;
        if (taskNameKey && existingNameKey && taskNameKey === existingNameKey) return true;
        return false;
      });

      if (existingIndex === -1) {
        return [
          {
            ...taskContact,
            createdAt: new Date().toISOString(),
          },
          ...current,
        ];
      }

      return current.map((contact, index) => {
        if (index !== existingIndex) return contact;

        return normalizeContact({
          ...contact,
          name: contact.name || taskContact.name,
          category: contact.category || taskContact.category,
          person: contact.person || taskContact.person,
          organization: contact.organization || taskContact.organization,
          company: contact.company || taskContact.company,
          phone: contact.phone || taskContact.phone,
          directPhone: contact.directPhone || taskContact.directPhone,
          cellPhone: contact.cellPhone || taskContact.cellPhone,
          fax: contact.fax || taskContact.fax,
          email: contact.email || taskContact.email,
          address: contact.address || taskContact.address,
          address2: contact.address2 || taskContact.address2,
          address3: contact.address3 || taskContact.address3,
          officeLocations: contact.officeLocations?.length ? contact.officeLocations : taskContact.officeLocations,
          website: contact.website || taskContact.website,
          notes: [contact.notes, taskContact.notes].filter(Boolean).join("\n"),
          updatedAt: new Date().toISOString(),
        });
      });
    });

    window.alert(`Saved contact: ${taskContact.name}`);
  };

  const editTask = (task) => {
    setForm({ ...createEmptyTask(), ...task, attachments: normalizeTaskAttachments(task.attachments) });
    setEditingId(task.id);
    setShowAdvanced(true);
    setShowContactFields(hasTaskContactInformation(task));
    setShowMoreContactFields(hasAdditionalTaskContactInformation(task));
    setShowDependencyFields(Boolean(task.blockedBy));
    setShowNotesFields(hasTaskPreparationInformation(task));
    resetTaskScan();
    setIsCreateOpen(true);
  };

  const deleteTask = (id) => {
    if (!window.confirm("Delete this task? A safety snapshot will be saved first.")) return;

    writeSafetySnapshot("Before task delete", tasks, archivedTasks);
    setTasks((current) =>
      current
        .filter((task) => task.id !== id)
        .map((task) => (task.blockedBy === id ? { ...task, blockedBy: "" } : task))
    );
  };

  const toggleTask = (id) => {
    const taskToToggle = tasks.find((task) => task.id === id);
    if (!taskToToggle) return;

    if (taskToToggle.completed) {
      setTasks((current) =>
        current.map((task) =>
          task.id === id
            ? addTaskHistory(
                {
                  ...task,
                  completed: false,
                  completedAt: "",
                },
                "Reopened"
              )
            : task
        )
      );
      return;
    }

    const completedAt = new Date().toISOString();

    writeSafetySnapshot("Before task done archive", tasks, archivedTasks);

    const archivedTask = addTaskHistory(
      {
        ...taskToToggle,
        completed: true,
        completedAt,
        archivedAt: completedAt,
      },
      "Marked done and archived"
    );

    setArchivedTasks((current) => {
      const nextArchived = [archivedTask, ...current.filter((item) => item?.id !== id)];
      writeStoredArchivedTasks(nextArchived);
      return nextArchived;
    });

    setTasks((current) =>
      normalizeInsuranceDmvTasks(
        current
          .filter((task) => task.id !== id)
          .map((task) => (task.blockedBy === id ? { ...task, blockedBy: "" } : task))
      ).tasks
    );

    setMovingTaskId(null);
    setSelectedTaskId((current) => (current === id ? null : current));
    setCheckedTaskIds((current) => current.filter((taskId) => taskId !== id));
    showCompletionCelebration(1, taskToToggle.taskName);
    window.dispatchEvent(new Event("todoTasksChanged"));
  };

  const updateTaskField = (id, field, value) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              [field]: value,
              updatedAt: new Date().toISOString(),
            }
          : task
      )
    );
  };

  const createTaskGoogleCalendarEvent = async (task) => {
    if (!task?.id || calendarAddingTaskId) return;

    try {
      setCalendarAddingTaskId(task.id);
      const eventPayload = buildTodoGoogleCalendarEventPayload(task);
      const createdEvent = await createGoogleCalendarEvent(eventPayload);

      setCalendarAddedIds((current) => {
        const nextIds = Array.from(new Set([...current, task.id]));
        writeTodoGoogleCalendarAddedIds(nextIds);
        return nextIds;
      });

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? addTaskHistory(
                {
                  ...item,
                  googleCalendarEventId: createdEvent?.id || item.googleCalendarEventId || "",
                  googleCalendarEventLink: createdEvent?.htmlLink || item.googleCalendarEventLink || "",
                  googleCalendarAddedAt: new Date().toISOString(),
                },
                "Added to Google Calendar",
                createdEvent?.htmlLink || ""
              )
            : item
        )
      );
    } catch (error) {
      window.alert(error?.message || "Could not add this task to Google Calendar.");
    } finally {
      setCalendarAddingTaskId("");
    }
  };

  const openContactManager = (target = "form") => {
    setContactApplyTarget(target);
    setContactForm(createEmptyContact());
    setEditingContactId(null);
    setIsContactsOpen(true);
  };

  const applyContactToForm = (contact) => {
    if (!contact) return;
    setForm((current) => applyContactToTaskData(current, contact, replaceExistingContactFields));
  };

  const applyContactToSelectedTask = (contact) => {
    if (!contact || !selectedTaskId) return;
    setTasks((current) =>
      current.map((task) =>
        task.id === selectedTaskId
          ? addTaskHistory(
              applyContactToTaskData(task, contact, replaceExistingContactFields),
              "Contact applied",
              contact.name
            )
          : task
      )
    );
  };

  const applyContactToTarget = (contact) => {
    if (contactApplyTarget === "selectedTask" && selectedTaskId) {
      applyContactToSelectedTask(contact);
      return;
    }

    applyContactToForm(contact);
  };

  const saveContact = () => {
    const cleanName = contactForm.name.trim();
    if (!cleanName) return;

    const contactToSave = normalizeContact({
      ...contactForm,
      name: cleanName,
      updatedAt: new Date().toISOString(),
      createdAt: contactForm.createdAt || new Date().toISOString(),
    });

    setContacts((current) => {
      if (editingContactId) {
        return current.map((contact) => (contact.id === editingContactId ? contactToSave : contact));
      }

      return [contactToSave, ...current];
    });

    setContactForm(createEmptyContact());
    setEditingContactId(null);
  };

  const editContact = (contact) => {
    setContactForm(normalizeContact(contact));
    setEditingContactId(contact.id);
  };

  const deleteContact = (id) => {
    if (!window.confirm("Delete this saved contact?")) return;

    setContacts((current) => current.filter((contact) => contact.id !== id));
    if (editingContactId === id) {
      setContactForm(createEmptyContact());
      setEditingContactId(null);
    }
  };

  const resetContactForm = () => {
    setContactForm(createEmptyContact());
    setEditingContactId(null);
  };

  const renderContactPicker = (target = "form") => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-black text-slate-900">Contact Picker</div>
        <button
          type="button"
          onClick={() => openContactManager(target)}
          title="Add, edit, delete, search, and use saved contacts"
          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
        >
          Manage Contacts
        </button>
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <select
          value=""
          onChange={(event) => {
            const contact = contacts.find((item) => item.id === event.target.value);
            if (contact) {
              target === "selectedTask" ? applyContactToSelectedTask(contact) : applyContactToForm(contact);
            }
          }}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">Select saved contact...</option>
          {alphabetizedContacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name}{contact.category ? ` - ${contact.category}` : ""}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
          <input
            type="checkbox"
            checked={replaceExistingContactFields}
            onChange={(event) => setReplaceExistingContactFields(event.target.checked)}
          />
          Replace filled fields
        </label>
      </div>
      <div className="mt-2 text-xs font-semibold text-slate-500">
        By default, saved contacts fill empty fields only.
      </div>
    </div>
  );

  const moveTaskToCategory = (id, nextType) => {
    if (!taskCategoryTypes.includes(nextType)) return;

    writeSafetySnapshot("Before category move", tasks, archivedTasks);
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? addTaskHistory(
              {
                ...task,
                type: nextType,
                typeOverride: nextType,
              },
              "Category changed",
              `Moved from ${task.type || "General"} to ${nextType}`
            )
          : task
      )
    );
    setMovingTaskId(null);
  };

  const addTaskToCategory = (type) => {
    setForm({ ...createEmptyTask(), type, typeOverride: type });
    setEditingId(null);
    setShowAdvanced(false);
    setShowContactFields(false);
    setShowMoreContactFields(false);
    setShowDependencyFields(false);
    setShowNotesFields(false);
    resetTaskScan();
    setIsCreateOpen(true);
    window.requestAnimationFrame(() => {
      document.getElementById("todo-create-task")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const duplicateTask = (task) => {
    const copy = stampTask(
      {
        ...task,
        id: createId(),
        taskName: `${task.taskName || "Task"} Copy`,
        completed: false,
        completedAt: "",
      },
      "Task copied",
      `Copied from ${task.taskName || "task"}`
    );
    setTasks((current) => normalizeInsuranceDmvTasks([...current, copy]).tasks);
  };

  const createConnectedFollowUpTask = (task) => {
    if (!task?.id) return;

    const sourceTask = tasks.find((item) => item.id === task.id) || task;
    const now = new Date().toISOString();
    const sourceSummary = buildConnectedFollowUpSourceSummary(sourceTask);
    const sourceSnapshot = buildConnectedFollowUpSourceSnapshot(sourceTask);
    const sourceTaskName = sourceTask.taskName || "Completed task";
    const sourceType = normalizeType(sourceTask.typeOverride || sourceTask.type);
    const nextTaskName = window.prompt("Follow-up task name:", `Follow up: ${sourceTaskName}`);

    if (nextTaskName === null) return;

    const cleanedTaskName = String(nextTaskName).trim();
    if (!cleanedTaskName) return;

    writeSafetySnapshot("Before connected follow-up creation", tasks, archivedTasks);

    const followUpTask = stampTask(
      {
        ...createEmptyTask(),
        id: createId(),
        taskName: cleanedTaskName,
        details: `Next follow-up connected to: ${sourceTaskName}`,
        type: sourceType,
        typeOverride: sourceType,
        person: sourceTask.person || "",
        organization: sourceTask.organization || sourceTask.company || "",
        company: sourceTask.company || "",
        phone: sourceTask.phone || "",
        address: sourceTask.address || "",
        website: sourceTask.website || "",
        systemLink: "",
        caseNumber: sourceTask.caseNumber || "",
        amount: sourceTask.amount || "",
        documents: sourceTask.documents || "",
        questions: sourceTask.questions || "",
        outcome: sourceTask.outcome || "",
        requiredAction: "",
        impact: "",
        notes: "",
        completed: false,
        completedAt: "",
        blockedBy: "",
        sourceTaskId: sourceTask.id || "",
        sourceTaskName,
        sourceTaskSummary: sourceSummary,
        sourceTaskSnapshot: sourceSnapshot,
        sourceTaskArchivedAt: now,
        sourceTaskCompletedAt: now,
        followUpEntries: [],
      },
      "Connected follow-up created",
      `Source task: ${sourceTaskName}`
    );

    const archivedTask = addTaskHistory(
      {
        ...sourceTask,
        completed: true,
        completedAt: sourceTask.completedAt || now,
        archivedAt: now,
        connectedFollowUpTaskId: followUpTask.id,
        connectedFollowUpTaskName: followUpTask.taskName,
      },
      "Archived after connected follow-up created",
      `New follow-up: ${followUpTask.taskName}`
    );

    setTasks((current) => {
      const nextTasks = current
        .filter((item) => item.id !== sourceTask.id)
        .map((item) => (item.blockedBy === sourceTask.id ? { ...item, blockedBy: followUpTask.id } : item));

      return normalizeInsuranceDmvTasks([followUpTask, ...nextTasks]).tasks;
    });

    setArchivedTasks((current) => {
      const nextArchived = [archivedTask, ...current.filter((item) => item?.id !== sourceTask.id)];
      writeStoredArchivedTasks(nextArchived);
      return nextArchived;
    });

    setMovingTaskId(null);
    setSelectedTaskId(followUpTask.id);
    setCheckedTaskIds((current) => current.filter((id) => id !== sourceTask.id));
    window.dispatchEvent(new Event("todoTasksChanged"));
  };

  const archiveTask = (task) => {
    if (!task?.id) return;

    setTasks((current) => {
      const taskToArchive = current.find((item) => item.id === task.id) || task;
      writeSafetySnapshot("Before task archive", current, archivedTasks);

      const archivedTask = addTaskHistory(
        {
          ...taskToArchive,
          archivedAt: new Date().toISOString(),
        },
        "Archived"
      );

      let nextArchived = [archivedTask];

      try {
        const saved = localStorage.getItem(ARCHIVE_STORAGE_KEY);
        const archived = saved ? JSON.parse(saved) : [];
        const archivedList = Array.isArray(archived) ? archived : [];
        nextArchived = [archivedTask, ...archivedList.filter((item) => item?.id !== task.id)];
        localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(nextArchived));
      } catch {
        localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(nextArchived));
      }

      setArchivedTasks(nextArchived);

      const nextTasks = current
        .filter((item) => item.id !== task.id)
        .map((item) => (item.blockedBy === task.id ? { ...item, blockedBy: "" } : item));

      try {
        const currentSaved = localStorage.getItem(STORAGE_KEY);
        if (currentSaved) {
          localStorage.setItem(STORAGE_BACKUP_KEY, currentSaved);
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeInsuranceDmvTasks(nextTasks).tasks));
        window.dispatchEvent(new Event("todoTasksChanged"));
      } catch {
        // The React state update below still removes the task if localStorage is temporarily unavailable.
      }

      return nextTasks;
    });

    setMovingTaskId(null);
  };

  const restoreArchivedTask = (id) => {
    const archivedTask = archivedTasks.find((item) => item?.id === id);
    if (!archivedTask) return;

    const { archivedAt, archived, ...restoredTask } = archivedTask;
    writeSafetySnapshot("Before archive restore", tasks, archivedTasks);

    const normalizedRestoredTask = addTaskHistory(
      normalizeTaskCategory({
        ...restoredTask,
        completed: false,
        status: "Pending",
      }),
      "Restored from archive"
    );
    const nextArchived = archivedTasks.filter((item) => item?.id !== id);

    setArchivedTasks(nextArchived);
    writeStoredArchivedTasks(nextArchived);
    setTasks((current) => normalizeInsuranceDmvTasks([normalizedRestoredTask, ...current.filter((item) => item?.id !== id)]).tasks);
    window.dispatchEvent(new Event("todoTasksChanged"));
  };

  const deleteArchivedTask = (id) => {
    if (!window.confirm("Permanently delete this archived task?")) return;

    writeSafetySnapshot("Before archived task delete", tasks, archivedTasks);
    const nextArchived = archivedTasks.filter((item) => item?.id !== id);
    setArchivedTasks(nextArchived);
    writeStoredArchivedTasks(nextArchived);
    window.dispatchEvent(new Event("todoTasksChanged"));
  };

  const clearTask = (id) => {
    writeSafetySnapshot("Before task clear", tasks, archivedTasks);
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? addTaskHistory(
              {
                ...task,
                completed: false,
                completedAt: "",
                blockedBy: "",
              },
              "Task cleared"
            )
          : task
      )
    );
  };

  const addFollowUpEntry = (id) => {
    const text = String(followUpDrafts[id] || "").trim();
    if (!text) return;

    setTasks((current) =>
      current.map((task) => {
        if (task.id !== id) return task;

        const entry = {
          id: createId(),
          createdAt: new Date().toISOString(),
          text,
        };

        return addTaskHistory(
          {
            ...task,
            followUpEntries: [entry, ...getFollowUpEntries(task)],
          },
          "Follow-up entry added",
          text
        );
      })
    );

    setFollowUpDrafts((current) => ({ ...current, [id]: "" }));
  };


  const startEditingFollowUpEntry = (taskId, entry) => {
    setEditingFollowUpEntries((current) => ({
      ...current,
      [`${taskId}:${entry.id}`]: entry.text || "",
    }));
  };

  const cancelEditingFollowUpEntry = (taskId, entryId) => {
    setEditingFollowUpEntries((current) => {
      const next = { ...current };
      delete next[`${taskId}:${entryId}`];
      return next;
    });
  };

  const saveFollowUpEntry = (taskId, entryId) => {
    const editKey = `${taskId}:${entryId}`;
    const nextText = String(editingFollowUpEntries[editKey] || "").trim();
    if (!nextText) return;

    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;

        const nextEntries = getFollowUpEntries(task).map((entry) =>
          entry.id === entryId
            ? {
                ...entry,
                text: nextText,
                updatedAt: new Date().toISOString(),
              }
            : entry
        );

        return addTaskHistory(
          {
            ...task,
            followUpEntries: nextEntries,
          },
          "Follow-up entry edited",
          nextText
        );
      })
    );

    cancelEditingFollowUpEntry(taskId, entryId);
  };

  const deleteFollowUpEntry = (taskId, entryId) => {
    if (!window.confirm("Remove this follow-up entry?")) return;

    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;

        return addTaskHistory(
          {
            ...task,
            followUpEntries: getFollowUpEntries(task).filter((entry) => entry.id !== entryId),
          },
          "Follow-up entry removed"
        );
      })
    );

    cancelEditingFollowUpEntry(taskId, entryId);
  };

  const toggleCategory = (type) => {
    setCollapsedCategories((current) => ({ ...current, [type]: !current[type] }));
  };

  const getTaskDateValue = (task) => task.deadline || task.date || task.effectiveDate || "";

  const getTaskStatus = (task) => {
    if (task.completed) return "done";
    const workflowStatus = normalizeTaskWorkflowStatus(task.status);
    const rawDate = getTaskDateValue(task);
    const parsedDate = Date.parse(rawDate);

    if (!Number.isNaN(parsedDate)) {
      const today = new Date(statusClock);
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(parsedDate);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

      if (diffDays < 0) return "overdue";
      if (workflowStatus !== "Waiting" && diffDays <= 5) return "dueSoon";
    }

    if (workflowStatus === "Waiting") {
      return isTaskFollowUpDue(task, statusClock) ? "followUpDue" : "waiting";
    }

    return "pending";
  };

  const getTaskRowClass = (task, isBlocked) => {
    if (task.completed) return "bg-green-50 border-green-200";
    if (isBlocked) return "bg-amber-50 border-amber-200";
    const status = getTaskStatus(task);
    if (status === "overdue") return "bg-white border-red-200";
    if (status === "followUpDue") return "bg-fuchsia-50 border-fuchsia-300";
    if (status === "waiting") return "bg-blue-50 border-blue-200";
    if (status === "dueSoon") return "bg-white border-yellow-200";
    return "bg-white border-slate-200";
  };

  const getTaskDetailRowClass = (task, isBlocked) => {
    if (task.completed) return "bg-green-50 border-green-200";
    if (isBlocked) return "bg-amber-50 border-amber-200";
    const status = getTaskStatus(task);
    if (status === "overdue") return "bg-green-50 border-red-200";
    if (status === "followUpDue") return "bg-fuchsia-50 border-fuchsia-300";
    if (status === "waiting") return "bg-blue-50 border-blue-200";
    if (status === "dueSoon") return "bg-green-50 border-yellow-200";
    return "bg-green-50 border-green-200";
  };

  const getStatusLabel = (task, isBlocked) => {
    if (task.completed) return "Done";
    if (isBlocked) return "Blocked";
    const status = getTaskStatus(task);
    if (status === "overdue") return "Overdue";
    if (status === "followUpDue") return "Follow-up Due";
    if (status === "waiting") return "Waiting";
    if (status === "dueSoon") return "Due Soon";
    return "Pending";
  };

  const getStatusClass = (task, isBlocked) => {
    if (task.completed) return "bg-green-600 text-white";
    if (isBlocked) return "bg-yellow-500 text-white";
    const status = getTaskStatus(task);
    if (status === "overdue") return "bg-red-600 text-white";
    if (status === "followUpDue") return "bg-fuchsia-700 text-white";
    if (status === "waiting") return "bg-blue-600 text-white";
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
    const map = taskCategoryTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {});

    tasks.forEach((task) => {
      const normalizedTask = normalizeTaskCategory(task);
      const type = normalizedTask.type;
      if (!map[type]) map[type] = [];
      map[type].push(normalizedTask);
    });

    return map;
  }, [tasks, taskCategoryTypes]);

  const activeCategorySummary = useMemo(() => {
    return taskCategoryTypes.map((type) => {
      const categoryTasks = tasksByType[type] || [];
      const activeCount = categoryTasks.filter((task) => !task.completed).length;
      const overdueCount = categoryTasks.filter((task) => !task.completed && getTaskStatus(task) === "overdue").length;
      const dueSoonCount = categoryTasks.filter((task) => !task.completed && getTaskStatus(task) === "dueSoon").length;

      return {
        type,
        activeCount,
        overdueCount,
        dueSoonCount,
        totalCount: categoryTasks.length,
      };
    }).filter((item) => item.activeCount > 0);
  }, [statusClock, taskCategoryTypes, tasksByType]);

  const totalActiveTasks = useMemo(() => tasks.filter((task) => !task.completed).length, [tasks]);

  const taskSummary = useMemo(() => {
    const activeTasks = tasks.filter((task) => !task.completed);

    return {
      active: activeTasks.length,
      overdue: activeTasks.filter((task) => getTaskStatus(task) === "overdue").length,
      dueSoon: activeTasks.filter((task) => getTaskStatus(task) === "dueSoon").length,
      followUpDue: activeTasks.filter((task) => getTaskStatus(task) === "followUpDue").length,
      waiting: activeTasks.filter((task) => getTaskStatus(task) === "waiting").length,
    };
  }, [statusClock, tasks]);

  const taskMatchesWorkspaceFilters = (task) => {
    const query = taskSearch.trim().toLowerCase();
    const blocker = task.blockedBy ? taskById[task.blockedBy] : null;
    const isBlocked = Boolean(blocker && !blocker.completed);
    const status = getTaskStatus(task);

    if (query) {
      const searchableText = [
        task.taskName,
        task.type,
        task.details,
        task.status,
        task.waitingOn,
        task.sourceTaskName,
        task.sourceTaskSummary,
        task.notes,
        task.followUpNotes,
        task.phone,
        task.organization,
        task.person,
        task.caseNumber,
        task.address,
        task.deadline,
        task.date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!searchableText.includes(query)) return false;
    }

    if (taskViewFilter === "all") return true;
    if (taskViewFilter === "blocked") return isBlocked;
    if (taskViewFilter === "done") return Boolean(task.completed);
    if (task.completed) return false;
    if (taskViewFilter === "pending") return status === "pending";
    if (taskViewFilter === "overdue") return status === "overdue";
    if (taskViewFilter === "dueSoon") return status === "dueSoon";
    if (taskViewFilter === "waiting") return status === "waiting";
    if (taskViewFilter === "followUpDue") return status === "followUpDue";
    return true;
  };

  const visibleFilteredTaskCount = tasks.filter((task) => {
    if (showActiveOnly && task.completed && taskViewFilter !== "done") return false;
    return taskMatchesWorkspaceFilters(task);
  }).length;

  const visibleCategoryTypes = useMemo(() => {
    if (!showActiveOnly) return taskCategoryTypes;

    return taskCategoryTypes.filter((type) => {
      const categoryTasks = tasksByType[type] || [];
      return categoryTasks.some((task) => !task.completed);
    });
  }, [showActiveOnly, taskCategoryTypes, tasksByType]);

  const selectedTask = useMemo(() => tasks.find((task) => task.id === selectedTaskId) || null, [selectedTaskId, tasks]);

  const checkedTasks = useMemo(
    () => checkedTaskIds.map((id) => tasks.find((task) => task.id === id)).filter(Boolean),
    [checkedTaskIds, tasks]
  );

  const toggleCheckedTask = (id) => {
    setCheckedTaskIds((current) =>
      current.includes(id) ? current.filter((taskId) => taskId !== id) : [...current, id]
    );
  };

  useEffect(() => {
    setCheckedTaskIds((current) => current.filter((id) => tasks.some((task) => task.id === id)));
  }, [tasks]);

  const clearCheckedTasks = () => {
    setCheckedTaskIds([]);
  };

  const markCheckedTasksDone = () => {
    if (!checkedTaskIds.length) return;

    const tasksToCelebrate = tasks.filter((task) => checkedTaskIds.includes(task.id) && !task.completed);

    writeSafetySnapshot("Before bulk mark done", tasks, archivedTasks);
    setTasks((current) =>
      current.map((task) =>
        checkedTaskIds.includes(task.id)
          ? addTaskHistory(
              {
                ...task,
                completed: true,
                completedAt: task.completedAt || new Date().toISOString(),
              },
              "Marked done",
              "Bulk action"
            )
          : task
      )
    );
    setCheckedTaskIds([]);

    if (tasksToCelebrate.length > 0) {
      showCompletionCelebration(
        tasksToCelebrate.length,
        tasksToCelebrate.length === 1 ? tasksToCelebrate[0].taskName : ""
      );
    }
  };

  const moveCheckedTasks = () => {
    if (!checkedTaskIds.length || !taskCategoryTypes.includes(bulkMoveType)) return;

    writeSafetySnapshot("Before bulk category move", tasks, archivedTasks);
    setTasks((current) =>
      current.map((task) =>
        checkedTaskIds.includes(task.id)
          ? addTaskHistory(
              {
                ...task,
                type: bulkMoveType,
                typeOverride: bulkMoveType,
              },
              "Category changed",
              `Bulk moved to ${bulkMoveType}`
            )
          : task
      )
    );
    setCheckedTaskIds([]);
  };

  const archiveCheckedTasks = () => {
    if (!checkedTaskIds.length) return;

    setTasks((current) => {
      const checkedSet = new Set(checkedTaskIds);
      const tasksToArchive = current.filter((task) => checkedSet.has(task.id));
      if (!tasksToArchive.length) return current;

      writeSafetySnapshot("Before bulk task archive", current, archivedTasks);

      const archivedNow = tasksToArchive.map((task) =>
        addTaskHistory(
          {
            ...task,
            archivedAt: new Date().toISOString(),
          },
          "Archived",
          "Bulk action"
        )
      );

      const nextArchived = [
        ...archivedNow,
        ...archivedTasks.filter((task) => task?.id && !checkedSet.has(task.id)),
      ];

      setArchivedTasks(nextArchived);
      writeStoredArchivedTasks(nextArchived);

      return current
        .filter((task) => !checkedSet.has(task.id))
        .map((task) => (checkedSet.has(task.blockedBy) ? { ...task, blockedBy: "" } : task));
    });

    setCheckedTaskIds([]);
    setMovingTaskId(null);
  };

  const deleteCheckedTasks = () => {
    if (!checkedTaskIds.length) return;
    const count = checkedTaskIds.length;
    if (!window.confirm(`Delete ${count} selected task${count === 1 ? "" : "s"}? A safety snapshot will be saved first.`)) return;

    writeSafetySnapshot("Before bulk task delete", tasks, archivedTasks);
    setTasks((current) => {
      const checkedSet = new Set(checkedTaskIds);
      return current
        .filter((task) => !checkedSet.has(task.id))
        .map((task) => (checkedSet.has(task.blockedBy) ? { ...task, blockedBy: "" } : task));
    });
    setCheckedTaskIds([]);
    setMovingTaskId(null);
    if (checkedTaskIds.includes(selectedTaskId)) {
      setSelectedTaskId(null);
    }
  };


  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase();
    if (!query) return contacts;

    return contacts.filter((contact) =>
      [
        contact.name,
        contact.category,
        contact.phone,
        contact.directPhone,
        contact.cellPhone,
        contact.fax,
        contact.email,
        contact.website,
        contact.address,
        contact.address2,
        contact.address3,
        contact.organization,
        contact.company,
        contact.person,
        contact.notes,
        JSON.stringify(contact.officeLocations || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [contactSearch, contacts]);

  const downloadTaskAttachment = async (attachment = {}) => {
    const downloadUrl = getTaskAttachmentDownloadUrl(attachment);

    if (!downloadUrl) {
      alert("This file does not have a valid download link.");
      return;
    }

    const fileName = attachment.originalName || attachment.savedName || "attached-file";

    const openDownloadUrl = () => {
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
    };

    try {
      const response = await fetch(downloadUrl, { method: "GET" });

      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}.`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      openDownloadUrl();
    }
  };

  const renderTaskAttachments = (attachments = [], options = {}) => {
    const normalizedAttachments = normalizeTaskAttachments(attachments);
    const { taskId = "", editable = true } = options;

    if (!normalizedAttachments.length) return null;

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Attached Files</div>
        <div className="space-y-2">
          {normalizedAttachments.map((attachment) => {
            const sizeLabel = formatTaskAttachmentSize(attachment.size);
            const removeHandler = taskId
              ? () => removeTaskAttachment(taskId, attachment.id)
              : () => removeTaskAttachmentFromForm(attachment.id);
            const viewUrl = getTaskAttachmentViewUrl(attachment);
            const downloadUrl = getTaskAttachmentDownloadUrl(attachment);

            return (
              <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2 font-semibold text-slate-900">
                    <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="truncate">{attachment.originalName || attachment.savedName || "Attached file"}</span>
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-slate-500">
                    {[sizeLabel, attachment.uploadedAt ? `Uploaded ${formatDateTime(attachment.uploadedAt)}` : ""].filter(Boolean).join(" • ")}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {viewUrl && (
                    <a
                      href={viewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                      title="View attached file"
                    >
                      View
                    </a>
                  )}
                  {downloadUrl && (
                    <button
                      type="button"
                      onClick={() => downloadTaskAttachment(attachment)}
                      className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
                      title="Download attached file"
                    >
                      Download
                    </button>
                  )}
                  {editable && (
                    <button
                      type="button"
                      onClick={removeHandler}
                      className="rounded bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
                      title="Remove attached file"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
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

  const renderTaskScanPanel = () => (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-blue-950">Attach Documents / Images</div>
          <div className="text-xs font-semibold text-blue-800">Files are saved to your local documents folder. The task stores only file links and metadata.</div>
        </div>
        <button
          type="button"
          onClick={() => setIsTaskScanOpen((current) => !current)}
          title={isTaskScanOpen ? "Hide file uploader" : "Attach documents or images to this task"}
          className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800"
        >
          {isTaskScanOpen ? "Hide Files" : "Attach Files"}
        </button>
      </div>

      {isTaskScanOpen && (
        <div className="mt-3 grid gap-2">
          <label className="text-xs font-black text-blue-950">
            Document or image files
            <input
              type="file"
              multiple
              accept="image/*,application/pdf,.pdf,.txt,.doc,.docx,.rtf,.csv,.xls,.xlsx"
              onChange={scanTaskFile}
              disabled={isTaskFileUploading}
              className="mt-1 block w-full text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-700 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
            />
            <span className="mt-1 block text-[11px] font-semibold text-blue-800">Supports PDF, JPG, PNG, HEIC, TXT, DOC, DOCX, RTF, CSV, XLS, and XLSX. Images, PDFs, and TXT can also extract text into the task.</span>
          </label>

          {renderTaskAttachments(form.attachments, { editable: true })}

          {taskScanFileName && (
            <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-900">
              Last scanned file: {taskScanFileName}
            </div>
          )}

          <textarea
            value={taskScanText}
            onChange={(event) => setTaskScanText(event.target.value)}
            placeholder="Extracted scan text will appear here for PDFs, images, and TXT files. You can edit it before applying it to the task."
            rows={5}
            className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyEditedTaskScanText}
              disabled={!taskScanText.trim() && !taskScanFileName}
              title="Apply extracted text to this task"
              className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Apply Extracted Text
            </button>
            <button
              type="button"
              onClick={clearTaskScan}
              title="Clear extracted text"
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-900 hover:bg-blue-100"
            >
              Clear Text
            </button>
          </div>

          {taskFileUploadStatus && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-900">{taskFileUploadStatus}</div>}
          {taskFileUploadError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-900">{taskFileUploadError}</div>}
          {taskScanStatus && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-900">{taskScanStatus}</div>}
          {taskScanError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-900">{taskScanError}</div>}
        </div>
      )}
    </div>
  );

  const renderInput = (field, value, onChange) => {
    if (field === "status") {
      return (
        <select
          value={normalizeTaskWorkflowStatus(value)}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {TASK_WORKFLOW_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      );
    }

    if (MULTILINE_FIELDS.has(field)) {
      if (shouldUseFormattingToolbar(field)) {
        return (
          <FormattingTextarea
            value={value || ""}
            onChange={onChange}
            rows={getTextareaRows(value, 1, 8)}
            className="min-h-[38px] w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        );
      }

      return (
        <textarea
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          rows={getTextareaRows(value, 1, 8)}
          className="min-h-[38px] w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      );
    }

    if (DATE_PICKER_FIELDS.has(field)) {
      return (
        <TodoDatePickerInput
          value={value || ""}
          onChange={onChange}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      );
    }

    if (TIME_PICKER_FIELDS.has(field)) {
      return (
        <TodoTimePickerInput
          value={value || ""}
          onChange={onChange}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      );
    }

    if (URL_FIELDS.has(field)) {
      return (
        <input
          type="url"
          inputMode="url"
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      );
    }

    return (
      <input
        type={PHONE_NUMBER_FIELDS.has(field) ? "tel" : "text"}
        inputMode={PHONE_NUMBER_FIELDS.has(field) ? "tel" : undefined}
        value={value || ""}
        onChange={(event) => onChange(PHONE_NUMBER_FIELDS.has(field) ? formatPhoneInput(event.target.value) : event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    );
  };

  const renderTaskFormFields = (fields = []) => fields.map((field) => (
    <label
      key={field}
      className={`text-sm font-medium ${MULTILINE_FIELDS.has(field) ? "md:col-span-2" : ""}`}
    >
      {getFieldLabel(form, field)}
      <div className="mt-1">{renderInput(field, form[field], (value) => updateForm(field, value))}</div>
    </label>
  ));

  return (
    <PageContainer surfaceClassName="min-h-screen bg-slate-100" className="flex flex-col gap-3 bg-gradient-to-b from-emerald-50 via-slate-100 to-slate-100 py-3 sm:gap-4 sm:py-4">
      {completionCelebration && (
        <div
          key={completionCelebration.id}
          className="fixed inset-0 z-[9999] flex cursor-pointer items-center justify-center overflow-hidden bg-slate-950/20 px-4"
          aria-live="polite"
          aria-atomic="true"
          role="button"
          tabIndex={0}
          onClick={() => setCompletionCelebration(null)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setCompletionCelebration(null);
            }
          }}
        >
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 36 }).map((_, index) => {
              const angle = (index * 137.5) % 360;
              const distance = 120 + (index % 6) * 34;
              const delay = (index % 9) * 70;
              const size = 7 + (index % 4) * 3;
              const colors = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b", "#ef4444", "#06b6d4"];
              const color = colors[index % colors.length];

              return (
                <span
                  key={`firework-${index}`}
                  className="absolute left-1/2 top-1/2 rounded-full shadow-lg animate-[todo-firework_1450ms_ease-out_forwards]"
                  style={{
                    width: `${size}px`,
                    height: `${size}px`,
                    backgroundColor: color,
                    boxShadow: `0 0 18px ${color}`,
                    animationDelay: `${delay}ms`,
                    "--todo-firework-x": `${Math.cos((angle * Math.PI) / 180) * distance}px`,
                    "--todo-firework-y": `${Math.sin((angle * Math.PI) / 180) * distance}px`,
                  }}
                />
              );
            })}
          </div>

          <div className="relative animate-[todo-complete-pop_650ms_ease-out_forwards] rounded-[2rem] border border-green-200 bg-white px-12 py-10 text-center shadow-2xl ring-4 ring-green-200/70">
            <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-700 text-white shadow-2xl animate-[todo-complete-pulse_1100ms_ease-out_1]">
              <Check className="h-14 w-14" />
            </div>
            <div className="text-4xl font-black tracking-tight text-slate-900">Task complete!</div>
            {completionCelebration.count > 1 ? (
              <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50 px-6 py-4 text-xl font-black text-purple-800 shadow-inner">
                {completionCelebration.count} tasks marked done
              </div>
            ) : completionCelebration.taskName ? (
              <div className="mt-4 max-w-xl rounded-2xl border border-green-200 bg-green-50 px-6 py-4 shadow-inner">
                <div className="break-words text-2xl font-black leading-snug text-slate-900">
                  {completionCelebration.taskName}
                </div>
              </div>
            ) : (
              <div className="mt-3 max-w-md text-lg font-bold text-slate-600">Nice work.</div>
            )}
            <div className="mt-5 text-3xl animate-[todo-sparkle-pop_1500ms_ease-in-out_infinite]">✦ ✨ ✦</div>
          </div>
          <style>{`
            @keyframes todo-complete-pop {
              0% { opacity: 0; transform: translateY(28px) scale(0.72) rotate(-2deg); }
              55% { opacity: 1; transform: translateY(0) scale(1.12) rotate(1deg); }
              100% { opacity: 1; transform: translateY(0) scale(1) rotate(0); }
            }
            @keyframes todo-complete-pulse {
              0% { transform: scale(0.55); }
              50% { transform: scale(1.18); }
              100% { transform: scale(1); }
            }
            @keyframes todo-firework {
              0% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
              12% { opacity: 1; }
              78% { opacity: 1; transform: translate(calc(-50% + var(--todo-firework-x)), calc(-50% + var(--todo-firework-y))) scale(1); }
              100% { opacity: 0; transform: translate(calc(-50% + var(--todo-firework-x)), calc(-50% + var(--todo-firework-y) + 36px)) scale(0.25); }
            }
            @keyframes todo-sparkle-pop {
              0%, 100% { opacity: 0.55; transform: scale(0.92); }
              50% { opacity: 1; transform: scale(1.08); }
            }
          `}</style>
        </div>
      )}

      <style>{`
        .todo-mobile-field-label {
          display: none;
        }

        .todo-task-action-row > button {
          opacity: 0.78;
          filter: saturate(0.72);
          transition: opacity 160ms ease, filter 160ms ease, transform 160ms ease, background-color 160ms ease;
        }

        .todo-task-action-row:hover > button,
        .todo-task-action-row:focus-within > button {
          opacity: 1;
          filter: saturate(1);
        }

        .todo-task-action-row > button:hover,
        .todo-task-action-row > button:focus-visible {
          transform: translateY(-1px);
          outline: 2px solid #ffffff;
          outline-offset: 1px;
        }

        .todo-task-time-field {
          margin-top: 0.25rem;
        }

        @media (max-width: 639px) {
          .todo-task-table,
          .todo-task-body,
          .todo-empty-row,
          .todo-task-main-row,
          .todo-task-detail-row,
          .todo-empty-cell,
          .todo-task-cell,
          .todo-task-detail-cell {
            display: block;
          }

          .todo-task-table {
            width: 100%;
            table-layout: auto;
          }

          .todo-task-table colgroup,
          .todo-task-head,
          .todo-task-detail-spacer {
            display: none;
          }

          .todo-task-main-row {
            display: flex;
            flex-direction: column;
            position: relative;
            margin: 0.75rem 0.5rem 0;
            overflow: hidden;
            border-width: 1px;
            border-style: solid;
            border-color: #cbd5e1;
            border-radius: 1rem 1rem 0 0;
            box-shadow: 0 10px 24px -18px rgba(15, 23, 42, 0.65);
          }

          .todo-task-check-cell {
            position: absolute;
            left: 0.75rem;
            top: 1rem;
            padding: 0;
            z-index: 1;
          }

          .todo-task-name-cell {
            padding: 0.75rem 0.75rem 0.5rem 2.5rem;
          }

          .todo-task-due-cell,
          .todo-task-status-cell {
            padding: 0 0.75rem 0.5rem;
          }

          .todo-task-details-cell {
            padding: 0 0.75rem 0.75rem;
          }

          .todo-mobile-field-label {
            display: block;
            margin-bottom: 0.25rem;
            color: #64748b;
            font-size: 0.6875rem;
            font-weight: 700;
            letter-spacing: 0.025em;
            text-transform: uppercase;
          }

          .todo-task-datetime-fields {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 0.5rem;
          }

          .todo-task-time-field {
            margin-top: 0;
          }

          .todo-task-actions-cell {
            order: 5;
            padding: 0.625rem 0.75rem;
            border-top: 1px solid #e2e8f0;
            background: #f8fafc;
          }

          .todo-task-action-row {
            display: grid !important;
            width: 100% !important;
            grid-template-columns: repeat(5, minmax(44px, 1fr)) !important;
            align-items: center;
            justify-items: stretch !important;
            gap: 0.375rem !important;
          }

          .todo-task-action-row > button {
            width: 100% !important;
            height: 44px !important;
            border-radius: 0.625rem;
            opacity: 1;
            filter: none;
          }

          .todo-task-detail-row {
            margin: 0 0.5rem 0.75rem;
            border-width: 0 1px 1px;
            border-style: solid;
            border-color: #cbd5e1;
            border-radius: 0 0 1rem 1rem;
          }

          .todo-task-detail-cell {
            padding: 0 0.75rem 0.75rem;
          }

          .todo-follow-up-compose {
            flex-direction: column;
          }

          .todo-add-note-button {
            width: 100%;
          }
        }
      `}</style>

      <TabPageHeader
        icon={ListTodo}
        title="To-Do"
        subtitle="Manage tasks, deadlines, contacts, documents, follow-ups, and completion history."
        theme="emerald"
        className="budget-mobile-header"
        actions={
          <div className="flex w-max flex-nowrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setForm(createEmptyTask());
                setEditingId(null);
                setShowAdvanced(false);
                setShowContactFields(false);
                setShowMoreContactFields(false);
                setShowDependencyFields(false);
                setShowNotesFields(false);
                resetTaskScan();
                setIsCreateOpen(true);
              }}
              title="Add task"
              aria-label="Add task"
              className={`${TAB_HEADER_ACTION_CLASS} !h-11 !w-auto !gap-2 !px-4 !text-sm bg-amber-400 text-slate-950 shadow-lg shadow-slate-950/20 hover:bg-amber-300`}
            >
              <Plus className="h-4 w-4" />
              <span>Add Task</span>
            </button>

            <button
              type="button"
              onClick={() => setShowPremiumTodoView(true)}
              title="Open the print and on-the-go task list"
              aria-label="Open the print and on-the-go task list"
              className={`${TAB_HEADER_ACTION_CLASS} !h-11 !w-auto !gap-2 !px-3 !text-sm border border-white/35 bg-white/15 text-white hover:bg-white/25`}
            >
              <ListTodo className="h-4 w-4" />
              <span>Print List</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDataOpen(true)}
              title="Open To-Do data and backup tools"
              aria-label="Open To-Do data and backup tools"
              aria-haspopup="dialog"
              aria-expanded={isDataOpen}
              className={`${TAB_HEADER_ACTION_CLASS} !h-11 !w-auto !gap-2 !px-3 !text-sm border border-white/35 bg-white text-emerald-950 hover:bg-emerald-50`}
            >
              <FileText className="h-4 w-4" />
              <span>Data</span>
            </button>
          </div>
        }
      />

      {isDataOpen ? (
        <DataToolsScreen
          title="To-Do Data and Backups"
          subtitle="Import tasks, export your To-Do data, or save a safety snapshot before major changes."
          onClose={() => setIsDataOpen(false)}
          tools={[
            {
              key: "import",
              icon: FileText,
              tone: "indigo",
              title: "Import Tasks",
              description: "Open the structured task importer to review and add task data.",
              buttonLabel: "Open Task Import",
              onClick: () => {
                setIsDataOpen(false);
                setIsImportOpen(true);
              },
            },
            {
              key: "export",
              icon: Download,
              tone: "sky",
              title: "Export To-Do",
              description: "Open the existing To-Do export options for active and completed tasks.",
              buttonLabel: "Open Export Options",
              onClick: () => {
                setIsDataOpen(false);
                setIsExportOpen(true);
              },
            },
            {
              key: "snapshot",
              icon: ShieldCheck,
              tone: "emerald",
              title: "Safety Snapshot",
              description: "Save a local snapshot of active and archived tasks before bulk updates.",
              buttonLabel: "Save Safety Snapshot",
              onClick: () => {
                writeSafetySnapshot("Manual safety snapshot", tasks, archivedTasks);
                alert("Safety snapshot saved.");
              },
            },
            {
              key: "dashboard-export",
              icon: Download,
              tone: "violet",
              title: "Complete Dashboard Backup",
              description: "Download all dashboard data as one JSON backup file.",
              buttonLabel: "Export Complete Dashboard",
              onClick: () => window.dispatchEvent(new CustomEvent("dashboard-toolbar:export-all")),
            },
          ]}
        />
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
        <div className="border-b border-slate-200 bg-white p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="group" aria-label="Filter tasks by status">
            {[
              {
                key: "all",
                label: "Active",
                count: taskSummary.active,
                icon: Check,
                cardClass: "border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100",
                selectedClass: "border-emerald-500 bg-emerald-100 ring-2 ring-emerald-200",
                labelClass: "text-emerald-800",
                countClass: "text-emerald-950",
                iconClass: "bg-emerald-100 text-emerald-700",
                orbClass: "bg-emerald-100/80",
              },
              {
                key: "overdue",
                label: "Overdue",
                count: taskSummary.overdue,
                icon: AlertCircle,
                cardClass: "border-rose-200 bg-rose-50/80 hover:bg-rose-100",
                selectedClass: "border-rose-500 bg-rose-100 ring-2 ring-rose-200",
                labelClass: "text-rose-800",
                countClass: "text-rose-950",
                iconClass: "bg-rose-100 text-rose-700",
                orbClass: "bg-rose-100/80",
              },
              {
                key: "dueSoon",
                label: "Due soon",
                count: taskSummary.dueSoon,
                icon: Clock,
                cardClass: "border-amber-200 bg-amber-50/80 hover:bg-amber-100",
                selectedClass: "border-amber-500 bg-amber-100 ring-2 ring-amber-200",
                labelClass: "text-amber-800",
                countClass: "text-amber-950",
                iconClass: "bg-amber-100 text-amber-700",
                orbClass: "bg-amber-100/80",
              },
              {
                key: "followUpDue",
                label: "Follow-up due",
                count: taskSummary.followUpDue,
                icon: History,
                cardClass: "border-fuchsia-200 bg-fuchsia-50/80 hover:bg-fuchsia-100",
                selectedClass: "border-fuchsia-500 bg-fuchsia-100 ring-2 ring-fuchsia-200",
                labelClass: "text-fuchsia-800",
                countClass: "text-fuchsia-950",
                iconClass: "bg-fuchsia-100 text-fuchsia-700",
                orbClass: "bg-fuchsia-100/80",
              },
            ].map((item) => {
              const isSelected = taskViewFilter === item.key && showActiveOnly;
              const StatusIcon = item.icon;

              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setShowActiveOnly(true);
                    setTaskViewFilter(item.key);
                  }}
                  title={`Show ${item.label.toLowerCase()} tasks`}
                  aria-label={`Show ${item.count} ${item.label.toLowerCase()} tasks`}
                  aria-pressed={isSelected}
                  className={`group relative flex min-h-[84px] min-w-0 items-center justify-between overflow-hidden rounded-2xl border px-4 py-3 text-left shadow-sm transition-colors hover:shadow-md focus:outline-none focus:ring-2 focus:ring-slate-900/20 ${
                    isSelected ? item.selectedClass : item.cardClass
                  }`}
                >
                  <span className={`absolute -right-6 -top-8 h-24 w-24 rounded-full ${item.orbClass}`} aria-hidden="true" />
                  <span className="relative z-10 flex min-w-0 flex-col">
                    <span className={`truncate text-[11px] font-black uppercase tracking-[0.14em] ${item.labelClass}`}>
                      {item.label}
                    </span>
                    <span className={`mt-1 text-3xl font-black leading-none sm:text-4xl ${item.countClass}`}>
                      {item.count}
                    </span>
                  </span>
                  <span className={`relative z-10 ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${item.iconClass}`} aria-hidden="true">
                    <StatusIcon className="h-5 w-5" />
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 sm:p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Active categories</div>
            {taskSummary.waiting > 0 && (
              <button type="button" onClick={() => setTaskViewFilter("waiting")} className="text-xs font-bold text-blue-700 hover:underline">
                {taskSummary.waiting} waiting
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {activeCategorySummary.length > 0 ? (
              activeCategorySummary.map((item) => {
                const Icon = TODO_CATEGORY_ICONS[item.type]?.icon || ListTodo;
                const iconColor = TODO_CATEGORY_ICONS[item.type]?.color || "text-slate-600";

                return (
                  <a
                    key={item.type}
                    href={`#${getCategoryAnchorId(item.type)}`}
                    onClick={(event) => {
                      event.preventDefault();
                      setShowActiveOnly(true);
                      setTaskViewFilter("all");
                      setCollapsedCategories(
                        taskCategoryTypes.reduce((map, categoryType) => ({ ...map, [categoryType]: categoryType !== item.type }), {})
                      );
                      window.requestAnimationFrame(() => {
                        document.getElementById(getCategoryAnchorId(item.type))?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }}
                    className="group flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    title={`Go to ${item.type} active tasks`}
                    aria-label={`Go to ${item.type} active tasks`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />
                      <div className="truncate text-xs font-bold text-slate-800">{item.type}</div>
                    </div>
                    <div
                      className={`flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-black leading-none text-white shadow-sm ${
                        item.overdueCount > 0 ? "bg-red-600 group-hover:bg-red-700" : "bg-blue-700 group-hover:bg-blue-800"
                      }`}
                      title={
                        item.overdueCount > 0
                          ? `${item.overdueCount} overdue task${item.overdueCount === 1 ? "" : "s"}`
                          : `${item.activeCount} active task${item.activeCount === 1 ? "" : "s"}`
                      }
                    >
                      {item.activeCount}
                    </div>
                  </a>
                );
              })
            ) : (
              <div className="col-span-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                No active tasks.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-3 sm:space-y-5">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-2 shadow-sm">
          <div className="grid grid-cols-5 items-center gap-2 sm:grid-cols-[minmax(220px,1fr)_140px_repeat(3,40px)] lg:grid-cols-[minmax(240px,380px)_150px_repeat(3,44px)_minmax(170px,1fr)]">
            <label className="relative col-span-5 block sm:col-span-1">
              <span className="sr-only">Search tasks</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={taskSearch}
                onChange={(event) => setTaskSearch(event.target.value)}
                placeholder="Search tasks, details, contacts, or cases"
                className="h-10 w-full rounded-lg border border-emerald-300 bg-white pl-9 pr-9 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
              />
              {taskSearch && (
                <button type="button" onClick={() => setTaskSearch("")} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 hover:bg-emerald-100" title="Clear task search" aria-label="Clear task search">
                  <X className="h-4 w-4" />
                </button>
              )}
            </label>

            <label className="col-span-2 sm:col-span-1">
              <span className="sr-only">Filter tasks by status</span>
              <select
                value={taskViewFilter}
                onChange={(event) => {
                  const nextFilter = event.target.value;
                  setTaskViewFilter(nextFilter);
                  if (nextFilter === "done") setShowActiveOnly(false);
                }}
                className="h-10 w-full rounded-lg border border-emerald-300 bg-white px-2 text-sm font-bold text-slate-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
              >
                <option value="all">All statuses</option>
                <option value="overdue">Overdue</option>
                <option value="dueSoon">Due soon</option>
                <option value="followUpDue">Follow-up due</option>
                <option value="waiting">Waiting</option>
                <option value="blocked">Blocked</option>
                <option value="pending">Pending</option>
                <option value="done">Done</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => setShowActiveOnly((current) => !current)}
              title={showActiveOnly ? "Show all task categories" : "Show only categories with active tasks and hide completed tasks"}
              aria-label={showActiveOnly ? "Show all task categories" : "Show only categories with active tasks and hide completed tasks"}
              aria-pressed={showActiveOnly}
              className={`inline-flex h-10 w-full items-center justify-center rounded-lg text-xs font-bold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                showActiveOnly ? "bg-emerald-700 text-white hover:bg-emerald-800" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Check size={18} />
            </button>
            <CollapseToggleButton
              action="collapse"
              onClick={() => setCollapsedCategories(taskCategoryTypes.reduce((map, type) => ({ ...map, [type]: true }), {}))}
              title="Collapse all categories"
              ariaLabel="Collapse all task categories"
              className="h-10 w-full"
            />
            <CollapseToggleButton
              action="expand"
              onClick={() => setCollapsedCategories({})}
              title="Expand all categories"
              ariaLabel="Expand all visible task categories"
              className="h-10 w-full"
            />

            <div className="col-span-5 flex min-w-0 items-center justify-between gap-2 px-1 text-xs font-bold text-emerald-950 sm:col-span-5 lg:col-span-1 lg:pl-2" role="status">
              <span className="truncate">{taskSearch || taskViewFilter !== "all" ? "Filtered task view" : "All active tasks"}</span>
              {(taskSearch || taskViewFilter !== "all") && (
                <button
                  type="button"
                  onClick={() => { setTaskSearch(""); setTaskViewFilter("all"); }}
                  className="shrink-0 rounded-md px-2 py-1 text-emerald-900 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>

        {checkedTasks.length > 0 && (
          <div className="rounded-xl border-2 border-green-300 bg-green-50 px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-green-950">
                  Selected: {checkedTasks.length} task{checkedTasks.length === 1 ? "" : "s"}
                </p>
                <p className="text-xs font-semibold text-slate-600">
                  Choose one bulk action for the checked items.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={markCheckedTasksDone}
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-green-600 px-3 text-sm font-bold text-white hover:bg-green-700"
                  title="Mark selected tasks done"
                >
                  <Check className="h-4 w-4" />
                  Done
                </button>
                <button
                  type="button"
                  onClick={archiveCheckedTasks}
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-purple-600 px-3 text-sm font-bold text-white hover:bg-purple-700"
                  title="Archive selected tasks"
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </button>
                <div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-amber-300 bg-white">
                  <select
                    value={bulkMoveType}
                    onChange={(event) => setBulkMoveType(event.target.value)}
                    className="h-full border-0 bg-white px-2 text-sm font-bold text-slate-900 focus:outline-none"
                    title="Choose category for selected tasks"
                  >
                    {taskCategoryTypes.map((categoryType) => (
                      <option key={categoryType} value={categoryType}>
                        {categoryType}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={moveCheckedTasks}
                    className="h-full bg-orange-600 px-3 text-sm font-bold text-white hover:bg-orange-700"
                    title="Move selected tasks to chosen category"
                  >
                    Move
                  </button>
                </div>
                <button
                  type="button"
                  onClick={clearCheckedTasks}
                  className="inline-flex h-9 items-center rounded-lg bg-slate-500 px-3 text-sm font-bold text-white hover:bg-slate-600"
                  title="Uncheck selected tasks"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={deleteCheckedTasks}
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-red-600 px-3 text-sm font-bold text-white hover:bg-red-700"
                  title="Delete selected tasks"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {visibleCategoryTypes.length === 0 && (
          <div className="rounded-xl border-2 border-green-300 bg-gradient-to-r from-green-50 to-green-100 px-4 py-6 text-sm font-semibold text-slate-700 shadow-md">
            No active tasks. Click Active Only again to show all categories.
          </div>
        )}

        {visibleCategoryTypes.length > 0 && visibleFilteredTaskCount === 0 && (
          <div className="rounded-2xl border border-slate-300 bg-white px-5 py-8 text-center shadow-sm" role="status">
            <Search className="mx-auto h-7 w-7 text-slate-400" aria-hidden="true" />
            <p className="mt-2 text-sm font-black text-slate-800">No tasks match this view.</p>
            <button type="button" onClick={() => { setTaskSearch(""); setTaskViewFilter("all"); }} className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800">
              Clear filters
            </button>
          </div>
        )}

        {visibleCategoryTypes.map((type) => {
          const rawCategoryTasks = sortTasks(tasksByType[type] || []);
          const baseCategoryTasks = showActiveOnly && taskViewFilter !== "done"
            ? rawCategoryTasks.filter((task) => !task.completed)
            : rawCategoryTasks;
          const categoryTasks = baseCategoryTasks.filter(taskMatchesWorkspaceFilters);
          const isCollapsed = Boolean(collapsedCategories[type]);
          const Icon = TODO_CATEGORY_ICONS[type]?.icon || ListTodo;
          const iconColor = TODO_CATEGORY_ICONS[type]?.color || "text-slate-300";
          const activeCount = rawCategoryTasks.filter((task) => !task.completed).length;
          const completedCount = rawCategoryTasks.length - activeCount;
          const overdueCount = rawCategoryTasks.filter((task) => !task.completed && getTaskStatus(task) === "overdue").length;
          const dueSoonCount = rawCategoryTasks.filter((task) => !task.completed && getTaskStatus(task) === "dueSoon").length;
          const followUpDueCount = rawCategoryTasks.filter((task) => !task.completed && getTaskStatus(task) === "followUpDue").length;

          if ((taskSearch.trim() || taskViewFilter !== "all") && categoryTasks.length === 0) return null;

          return (
            <div
              key={type}
              id={getCategoryAnchorId(type)}
              className={`scroll-mt-6 overflow-hidden rounded-2xl border bg-white shadow-md shadow-slate-900/5 ${
                activeCount > 0 ? "border-slate-300" : "border-slate-200 opacity-85"
              }`}
            >
              <div className="flex items-center justify-between gap-3 border-l-8 border-emerald-300 bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-700 px-3 py-2.5 text-white sm:px-4">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <GripVertical className="hidden h-4 w-4 shrink-0 text-emerald-200 sm:block" aria-hidden="true" title="Category section" />
                  <CollapseToggleButton
                    expanded={!isCollapsed}
                    onClick={() => toggleCategory(type)}
                    ariaLabel={isCollapsed ? `Expand ${type}` : `Collapse ${type}`}
                    title={isCollapsed ? `Expand ${type}` : `Collapse ${type}`}
                    className="border-emerald-400 bg-emerald-800/70 hover:bg-emerald-800 focus-visible:ring-white"
                  />
                  <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} aria-hidden="true" />
                  <div className="flex min-w-0 items-center gap-2">
                    <h4 className="truncate text-base font-black text-white sm:text-lg">{type}</h4>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide shadow-sm ${
                        overdueCount > 0
                          ? "bg-red-600 text-white"
                          : activeCount > 0
                            ? "bg-emerald-100 text-emerald-900"
                            : "bg-emerald-950/60 text-emerald-100"
                      }`}
                      title={`${activeCount} active tasks, ${completedCount} completed tasks${overdueCount > 0 ? `, ${overdueCount} overdue` : ""}`}
                    >
                      Active {activeCount}
                    </span>
                    {completedCount > 0 && (
                      <span className="hidden text-xs font-semibold text-emerald-100 sm:inline">{completedCount} done</span>
                    )}
                  </div>
                  {overdueCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white" title={`${overdueCount} overdue task${overdueCount === 1 ? "" : "s"}`}>
                      <AlertCircle className="h-3 w-3" />
                      {overdueCount}
                    </span>
                  )}
                  {dueSoonCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500 px-2 py-0.5 text-xs font-bold text-white" title={`${dueSoonCount} due soon task${dueSoonCount === 1 ? "" : "s"}`}>
                      <Clock className="h-3 w-3" />
                      {dueSoonCount}
                    </span>
                  )}
                  {followUpDueCount > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-700 px-2 py-0.5 text-xs font-bold text-white" title={`${followUpDueCount} follow-up task${followUpDueCount === 1 ? "" : "s"} due`}>
                      <Clock className="h-3 w-3" />
                      {followUpDueCount} follow-up
                    </span>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addTaskToCategory(type)}
                    className="flex min-h-10 items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 shadow-sm transition-colors hover:bg-amber-300 sm:text-sm"
                    title={`Add task to ${type}`}
                    aria-label={`Add task to ${type}`}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Task</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCategoryText(type, categoryTasks)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
                    aria-label={`Download ${type}`}
                    title={`Download ${type} tasks`}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="rounded-b-2xl bg-slate-50">
                  <table className="todo-task-table w-full table-fixed text-sm">
                    <colgroup>
                      <col className="w-8" />
                      <col className="w-[23%]" />
                      <col className="w-[13%]" />
                      <col className="w-[15%]" />
                      <col />
                      <col style={{ width: "188px" }} />
                    </colgroup>
                    <thead className="todo-task-head bg-slate-100 text-slate-800">
                      <tr className="border-b border-slate-300">
                        <th className="px-1 py-2 text-left font-medium text-gray-700"></th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">Task</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">Hard Deadline / Time</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">Status</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">Details</th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="todo-task-body">
                      {categoryTasks.length === 0 ? (
                        <tr className="todo-empty-row">
                          <td colSpan={6} className="todo-empty-cell px-4 py-4 text-sm text-slate-500">
                            No tasks in this category.
                          </td>
                        </tr>
                      ) : (
                        categoryTasks.map((task, taskIndex) => {
                          const blocker = task.blockedBy ? taskById[task.blockedBy] : null;
                          const isBlocked = Boolean(blocker && !blocker.completed);
                          const controls = controlledByMap[task.id] || [];
                          const statusLabel = getStatusLabel(task, isBlocked);
                          const statusClass = getStatusClass(task, isBlocked);
                          const rowClass = getTaskRowClass(task, isBlocked);
                          const taskType = taskCategoryTypes.includes(task.type) ? task.type : inferTaskType(task);
                          const allowedFields = TYPE_FIELDS[taskType] || TYPE_FIELDS.General;
                          const hiddenDetailFields = new Set([
                            "id",
                            "completed",
                            "completedAt",
                            "taskName",
                            "details",
                            "type",
                            "typeOverride",
                            "blockedBy",
                            "date",
                            "deadline",
                            "time",
                            "status",
                            "waitingOn",
                            "followUpDate",
                            "followUpTime",
                            "notes",
                            "followUpNotes",
                          ]);
                          const savedExtraFields = Object.keys(DEFAULT_FORM).filter(
                            (field) => task[field] && !hiddenDetailFields.has(field)
                          );
                          const fieldsToShow = Array.from(new Set([...allowedFields, ...savedExtraFields])).filter(
                            (field) => task[field] && !hiddenDetailFields.has(field)
                          );

                          const followUpEntries = getFollowUpEntries(task);
                          const hasDetailFields = true;
                          const mainRowDividerClass = taskIndex > 0 ? "border-t-2 border-slate-300" : "";

                          return (
                            <React.Fragment key={task.id}>
                              <tr className={`todo-task-main-row ${rowClass} ${mainRowDividerClass}`}>
                                <td className="todo-task-cell todo-task-check-cell align-top px-2 py-2">
                                  <input
                                    type="checkbox"
                                    checked={checkedTaskIds.includes(task.id)}
                                    onChange={() => toggleCheckedTask(task.id)}
                                    className="h-4 w-4 cursor-pointer rounded border-slate-300"
                                    title="Select task"
                                    aria-label={`Select ${task.taskName || "task"}`}
                                  />
                                </td>
                                <td className="todo-task-cell todo-task-name-cell align-top px-2 py-2">
                                  <input
                                    value={task.taskName || ""}
                                    onChange={(event) => updateTaskField(task.id, "taskName", event.target.value)}
                                    className={`w-full rounded-lg border-2 border-slate-900 bg-[#FFF4C2] px-3 py-2.5 text-base font-bold leading-snug shadow-sm outline-none transition-colors focus:border-blue-800 focus:ring-2 focus:ring-blue-200 ${
                                      task.completed ? "text-slate-400 line-through" : "text-slate-900"
                                    }`}
                                  />
                                  <div className="mt-1 text-xs font-medium text-slate-600">{type}</div>
                                  {isBlocked && <div className="mt-1 text-xs font-semibold text-amber-800">Blocked by: {blocker.taskName}</div>}
                                  {controls.length > 0 && (
                                    <div className="mt-1 text-xs text-slate-600">Controls: {controls.map((item) => item.taskName).join(", ")}</div>
                                  )}
                                  {task.sourceTaskName && (
                                    <div className="mt-1 text-xs font-semibold text-indigo-700">Related source: {task.sourceTaskName}</div>
                                  )}
                                </td>
                                <td className="todo-task-cell todo-task-due-cell align-top px-2 py-2">
                                  <div className="todo-mobile-field-label">Hard deadline and time</div>
                                  <div className="todo-task-datetime-fields">
                                    <TodoDatePickerInput
                                      value={task.deadline || task.date || ""}
                                      onChange={(value) => updateTaskField(task.id, task.deadline !== undefined ? "deadline" : "date", value)}
                                      className="w-full rounded border border-slate-300 bg-white p-1 text-sm"
                                    />
                                    <div className="todo-task-time-field">
                                      <TodoTimePickerInput
                                        value={task.time || ""}
                                        onChange={(value) => updateTaskField(task.id, "time", value)}
                                        className="w-full rounded border border-slate-300 bg-white p-1 text-sm"
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="todo-task-cell todo-task-status-cell align-top px-2 py-2">
                                  <div className="todo-mobile-field-label">Status</div>
                                  <span className={`inline-flex rounded px-2 py-1 text-xs font-bold ${statusClass}`}>{statusLabel}</span>
                                  {!task.completed && !isBlocked && (
                                    <select
                                      value={normalizeTaskWorkflowStatus(task.status)}
                                      onChange={(event) => updateTaskField(task.id, "status", event.target.value)}
                                      className="mt-2 w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-xs font-semibold text-slate-800"
                                      title="Change task status"
                                      aria-label={`Change status for ${task.taskName || "task"}`}
                                    >
                                      {TASK_WORKFLOW_STATUSES.map((status) => (
                                        <option key={status} value={status}>{status}</option>
                                      ))}
                                    </select>
                                  )}
                                  {normalizeTaskWorkflowStatus(task.status) === "Waiting" && task.waitingOn && (
                                    <div className="mt-2 text-xs font-semibold leading-snug text-blue-900">On: {task.waitingOn}</div>
                                  )}
                                  {normalizeTaskWorkflowStatus(task.status) === "Waiting" && task.followUpDate && (
                                    <div className="mt-1 text-xs font-semibold leading-snug text-fuchsia-800">Follow up: {formatTaskFollowUpSchedule(task)}</div>
                                  )}
                                </td>
                                <td className="todo-task-cell todo-task-details-cell align-top px-2 py-2">
                                  <div className="todo-mobile-field-label">Details</div>
                                  <AutoResizeTextarea
                                    value={task.details || ""}
                                    onChange={(value) => updateTaskField(task.id, "details", value)}
                                    minRows={1}
                                    maxRows={8}
                                    charsPerRow={55}
                                    compactOnChange
                                    className="min-h-[34px] w-full rounded border border-slate-300 bg-white p-1 text-sm"
                                  />
                                </td>
                                <td className="todo-task-cell todo-task-actions-cell align-top px-2 py-2 text-left">
                                  <div
                                    className="todo-task-action-row grid justify-items-center"
                                    style={{ gridTemplateColumns: "repeat(5, 28px)", gap: "6px", width: "164px" }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleTask(task.id)}
                                      className={`inline-flex h-7 w-7 items-center justify-center rounded p-0 text-white transition-colors ${
                                        task.completed ? "bg-slate-600 hover:bg-slate-700" : "bg-green-600 hover:bg-green-700"
                                      }`}
                                      title={task.completed ? "Reopen task" : "Mark done and archive"}
                                      aria-label={task.completed ? "Reopen task" : "Mark done and archive"}
                                    >
                                      {task.completed ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => duplicateTask(task)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-600 p-0 text-white transition-colors hover:bg-blue-700"
                                      aria-label="Copy task"
                                      title="Copy task"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => createConnectedFollowUpTask(task)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded bg-indigo-600 p-0 text-white transition-colors hover:bg-indigo-700"
                                      aria-label="Create connected follow-up task"
                                      title="Create connected follow-up, mark this done, and archive the source task"
                                    >
                                      <span className="flex h-4 w-5 items-center justify-center" aria-hidden="true">
                                        <Plus className="h-3.5 w-3.5 -mr-1" />
                                        <Plus className="h-3.5 w-3.5" />
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => archiveTask(task)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded bg-purple-600 p-0 text-white transition-colors hover:bg-purple-700"
                                      aria-label="Archive task"
                                      title="Archive task"
                                    >
                                      <Archive className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setMovingTaskId((current) => (current === task.id ? null : task.id))}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded bg-amber-600 p-0 text-white transition-colors hover:bg-amber-700"
                                      title="Change task category"
                                      aria-label="Change task category"
                                    >
                                      <Truck className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => createTaskGoogleCalendarEvent(task)}
                                      disabled={calendarAddingTaskId === task.id}
                                      className={`inline-flex h-7 w-7 items-center justify-center rounded p-0 text-white transition-colors ${
                                        calendarAddedIds.includes(task.id)
                                          ? "bg-blue-700 hover:bg-blue-800"
                                          : "bg-blue-600 hover:bg-blue-700"
                                      } disabled:cursor-wait disabled:opacity-60`}
                                      aria-label="Add task to Google Calendar"
                                      title={calendarAddedIds.includes(task.id) ? "Added to Google Calendar" : "Add task to Google Calendar"}
                                    >
                                      {calendarAddedIds.includes(task.id) ? <Check className="h-3.5 w-3.5" /> : <CalendarPlus className="h-3.5 w-3.5" />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => saveTaskContact(task)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded bg-teal-600 p-0 text-white transition-colors hover:bg-teal-700"
                                      aria-label="Save task contact"
                                      title="Save task contact"
                                    >
                                      <Phone className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => editTask(task)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded bg-slate-700 p-0 text-white transition-colors hover:bg-slate-800"
                                      aria-label="Edit task"
                                      title="Edit task"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteTask(task.id)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded bg-red-600 p-0 text-white transition-colors hover:bg-red-700"
                                      aria-label="Delete task"
                                      title="Delete task"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                  {movingTaskId === task.id && (
                                    <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2">
                                      <label className="block text-[11px] font-bold uppercase tracking-wide text-amber-900">Move to category</label>
                                      <select
                                        value={type}
                                        onChange={(event) => moveTaskToCategory(task.id, event.target.value)}
                                        title="Select a new task category"
                                        className="mt-1 w-full rounded border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900"
                                      >
                                        {taskCategoryTypes.map((categoryType) => (
                                          <option key={categoryType} value={categoryType}>
                                            {categoryType}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </td>
                              </tr>

                              {hasDetailFields && (
                                <tr className={`todo-task-detail-row ${getTaskDetailRowClass(task, isBlocked)} border-b border-slate-200`}>
                                  <td className="todo-task-detail-spacer"></td>
                                  <td colSpan={5} className="todo-task-detail-cell px-2 pb-3">

                                    {normalizeTaskWorkflowStatus(task.status) === "Waiting" && (
                                      <div className="mt-2 rounded-lg border border-fuchsia-200 bg-fuchsia-50 p-3">
                                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-fuchsia-900">Waiting & Follow-up</div>
                                        <div className="grid gap-2 md:grid-cols-3">
                                          <label className="text-xs font-semibold text-slate-700">
                                            Waiting on
                                            <input
                                              value={task.waitingOn || ""}
                                              onChange={(event) => updateTaskField(task.id, "waitingOn", event.target.value)}
                                              placeholder="Person or organization"
                                              className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-900"
                                            />
                                          </label>
                                          <label className="text-xs font-semibold text-slate-700">
                                            Follow-up date
                                            <div className="mt-1">
                                              <TodoDatePickerInput
                                                value={task.followUpDate || ""}
                                                onChange={(value) => updateTaskField(task.id, "followUpDate", value)}
                                                className="w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-900"
                                              />
                                            </div>
                                          </label>
                                          <label className="text-xs font-semibold text-slate-700">
                                            Follow-up time
                                            <div className="mt-1">
                                              <TodoTimePickerInput
                                                value={task.followUpTime || ""}
                                                onChange={(value) => updateTaskField(task.id, "followUpTime", value)}
                                                className="w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-900"
                                              />
                                            </div>
                                          </label>
                                        </div>
                                        <p className="mt-2 text-xs font-semibold text-fuchsia-800">At the follow-up date and time, the badge changes to Follow-up Due. The hard deadline remains unchanged.</p>
                                      </div>
                                    )}

                                    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
                                      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Notes</div>

                                      {followUpEntries.length > 0 && (
                                        <div className="mb-3 space-y-2">
                                          {followUpEntries.slice(0, 10).map((entry) => {
                                            const editKey = `${task.id}:${entry.id}`;
                                            const isEditingEntry = Object.prototype.hasOwnProperty.call(editingFollowUpEntries, editKey);

                                            return (
                                              <div key={entry.id} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                                                <div className="flex items-start justify-between gap-3">
                                                  <div>
                                                    <div className="text-xs font-bold text-slate-500">{formatDateTime(entry.createdAt)}</div>
                                                    {entry.updatedAt && (
                                                      <div className="text-[11px] font-semibold text-slate-400">Edited {formatDateTime(entry.updatedAt)}</div>
                                                    )}
                                                  </div>
                                                  <div className="flex shrink-0 items-center gap-2">
                                                    {isEditingEntry ? (
                                                      <>
                                                        <button
                                                          type="button"
                                                          onClick={() => saveFollowUpEntry(task.id, entry.id)}
                                                          className="rounded bg-green-600 px-2 py-1 text-xs font-bold text-white hover:bg-green-700"
                                                          title="Save follow-up entry"
                                                        >
                                                          Save
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => cancelEditingFollowUpEntry(task.id, entry.id)}
                                                          className="rounded bg-slate-500 px-2 py-1 text-xs font-bold text-white hover:bg-slate-600"
                                                          title="Cancel editing follow-up entry"
                                                        >
                                                          Cancel
                                                        </button>
                                                      </>
                                                    ) : (
                                                      <>
                                                        <button
                                                          type="button"
                                                          onClick={() => startEditingFollowUpEntry(task.id, entry)}
                                                          className="rounded bg-slate-800 p-1.5 text-white hover:bg-slate-700"
                                                          title="Edit follow-up entry"
                                                          aria-label="Edit follow-up entry"
                                                        >
                                                          <Edit2 className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => deleteFollowUpEntry(task.id, entry.id)}
                                                          className="rounded bg-red-600 p-1.5 text-white hover:bg-red-700"
                                                          title="Remove follow-up entry"
                                                          aria-label="Remove follow-up entry"
                                                        >
                                                          <Trash2 className="h-4 w-4" />
                                                        </button>
                                                      </>
                                                    )}
                                                  </div>
                                                </div>

                                                {isEditingEntry ? (
                                                  <FormattingTextarea
                                                    value={editingFollowUpEntries[editKey] || ""}
                                                    onChange={(value) =>
                                                      setEditingFollowUpEntries((current) => ({
                                                        ...current,
                                                        [editKey]: value,
                                                      }))
                                                    }
                                                    rows={getTextareaRows(editingFollowUpEntries[editKey], 1, 10, 80)}
                                                    className="mt-2 min-h-[34px] w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-900"
                                                  />
                                                ) : (
                                                  <FormattedText value={entry.text} className="mt-1 space-y-1 text-slate-900" />
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}

                                      <div className="todo-follow-up-compose flex gap-2">
                                        <div className="flex-1">
                                          <FormattingTextarea
                                            value={followUpDrafts[task.id] || ""}
                                            onChange={(value) => setFollowUpDrafts((current) => ({ ...current, [task.id]: value }))}
                                            rows={1}
                                            placeholder="Add a follow-up note..."
                                            className="min-h-[34px] w-full rounded border border-slate-300 bg-white p-2 text-sm font-normal normal-case tracking-normal text-slate-900"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => addFollowUpEntry(task.id)}
                                          className="todo-add-note-button self-start rounded bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                                          title="Add follow-up entry"
                                        >
                                          Add Note
                                        </button>
                                      </div>
                                    </div>

                                    {fieldsToShow.length > 0 && (
                                      <div className="grid gap-2 md:grid-cols-3">
                                        {fieldsToShow.map((field) => (
                                          <label key={field} className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                            {getFieldLabel(task, field)}
                                            <div className="mt-1">
                                              {MULTILINE_FIELDS.has(field) ? (
                                                shouldUseFormattingToolbar(field) ? (
                                                  <FormattingTextarea
                                                    value={task[field] || ""}
                                                    onChange={(value) => updateTaskField(task.id, field, value)}
                                                    rows={getTextareaRows(task[field], 1, 8, 48)}
                                                    className="min-h-[34px] w-full resize-none rounded border border-slate-300 bg-white p-1 text-sm font-normal normal-case tracking-normal text-slate-900"
                                                  />
                                                ) : (
                                                  <AutoResizeTextarea
                                                    value={task[field] || ""}
                                                    onChange={(value) => updateTaskField(task.id, field, value)}
                                                    minRows={1}
                                                    maxRows={8}
                                                    charsPerRow={48}
                                                    compactOnChange
                                                    className="min-h-[34px] w-full rounded border border-slate-300 bg-white p-1 text-sm font-normal normal-case tracking-normal text-slate-900"
                                                  />
                                                )
                                              ) : (
                                                DATE_PICKER_FIELDS.has(field) ? (
                                                  <TodoDatePickerInput
                                                    value={task[field] || ""}
                                                    onChange={(value) => updateTaskField(task.id, field, value)}
                                                    className="w-full rounded border border-slate-300 bg-white p-1 text-sm font-normal normal-case tracking-normal text-slate-900"
                                                  />
                                                ) : TIME_PICKER_FIELDS.has(field) ? (
                                                  <TodoTimePickerInput
                                                    value={task[field] || ""}
                                                    onChange={(value) => updateTaskField(task.id, field, value)}
                                                    className="w-full rounded border border-slate-300 bg-white p-1 text-sm font-normal normal-case tracking-normal text-slate-900"
                                                  />
                                                ) : (
                                                  <input
                                                    value={task[field] || ""}
                                                    onChange={(event) => updateTaskField(task.id, field, event.target.value)}
                                                    className="w-full rounded border border-slate-300 bg-white p-1 text-sm font-normal normal-case tracking-normal text-slate-900"
                                                  />
                                                )
                                              )}
                                            </div>
                                          </label>
                                        ))}
                                      </div>
                                    )}

                                    {normalizeTaskAttachments(task.attachments).length > 0 && (
                                      <div className="mt-2">
                                        {renderTaskAttachments(task.attachments, { taskId: task.id, editable: true })}
                                      </div>
                                    )}

                                    {task.sourceTaskSummary && (
                                      <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-800">Related Source Task</div>
                                        <div className="text-sm font-semibold text-slate-900">{task.sourceTaskName || "Source task"}</div>
                                        <FormattedText value={task.sourceTaskSummary} className="mt-2 whitespace-pre-wrap text-sm text-slate-800" />
                                      </div>
                                    )}


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

      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/50 px-4 py-4 backdrop-blur-sm sm:px-6">
          <div className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Import structured text</h3>
                <p className="text-sm text-slate-600">Paste tasks, parse them, then add the previewed tasks.</p>
              </div>
              <CloseScreenButton onClick={() => setIsImportOpen(false)} />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                rows={10}
                placeholder={"[ ] Task name\nDetails\nPhone: ...\nCase #: ...\nDeadline: ..."}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={parseImport} title="Parse pasted task text" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">Parse</button>
                <button type="button" onClick={addParsedTasks} disabled={!parsedTasks.length} title="Add parsed tasks to the To-Do list" className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">Add parsed tasks</button>
              </div>

              {parsedTasks.length > 0 && (
                <div className="mt-4 rounded-xl bg-slate-50 p-3">
                  <div className="mb-2 text-sm font-semibold">Parsed preview</div>
                  <div className="space-y-2">
                    {parsedTasks.map((task) => (
                      <div key={task.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                        <div className="font-semibold">{task.taskName}</div>
                        <div className="text-slate-600">Type: {task.type}</div>
                        {task.deadline && <div className="text-slate-600">Deadline: {formatAppShortDate(task.deadline)}</div>}
                        {task.caseNumber && <div className="text-slate-600">{getFieldLabel(task, "caseNumber")}: {task.caseNumber}</div>}
                        {task.phone && <div className="text-slate-600">Phone: {task.phone}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/50 px-4 py-4 backdrop-blur-sm sm:px-6">
          <div id="todo-create-task" className="flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{editingId ? "Edit task" : "Add task"}</h3>
                <p className="text-sm text-slate-600">Start with the essentials, then open optional sections only when needed.</p>
              </div>
              <CloseScreenButton onClick={closeTaskForm} />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-3">
                    <h4 className="font-black text-slate-900">Task Details</h4>
                    <p className="text-xs font-semibold text-slate-500">Name the task, choose its category, and record what needs to happen.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm font-medium md:col-span-2">
                      Task name <span className="text-red-600">*</span>
                      <input
                        autoFocus
                        value={form.taskName}
                        onChange={(event) => updateForm("taskName", event.target.value)}
                        placeholder="What needs to be done?"
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>

                    <label className="text-sm font-medium">
                      Category
                      <select
                        value={form.type}
                        onChange={(event) => {
                          const nextType = event.target.value;
                          setForm((current) => ({ ...current, type: nextType, typeOverride: nextType }));
                        }}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      >
                        {taskCategoryTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </label>

                    <label className="text-sm font-medium">
                      Status
                      <select value={normalizeTaskWorkflowStatus(form.status)} onChange={(event) => updateForm("status", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                        {TASK_WORKFLOW_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </label>

                    <label className="text-sm font-medium md:col-span-2">
                      Details
                      <textarea
                        value={form.details || ""}
                        onChange={(event) => updateForm("details", event.target.value)}
                        placeholder="Add instructions, context, or the next action."
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                  <div className="mb-3">
                    <h4 className="font-black text-slate-900">Schedule</h4>
                    <p className="text-xs font-semibold text-slate-500">Use the event date for an appointment and the due date for the final deadline.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">{renderTaskFormFields(scheduleFormFields)}</div>

                  {cscAppointmentConflictResult.hasAppointmentDate && (
                    <div
                      className={`mt-3 rounded-xl border p-3 ${
                        cscAppointmentConflictResult.conflicts.length > 0
                          ? "border-red-300 bg-red-50"
                          : cscAppointmentConflictResult.hasExactTime
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-amber-300 bg-amber-50"
                      }`}
                      role="status"
                      aria-live="polite"
                    >
                      {cscAppointmentConflictResult.conflicts.length > 0 ? (
                        <>
                          <div className="font-black text-red-950">CSC shift conflict detected</div>
                          <p className="mt-1 text-xs font-semibold text-red-900">
                            {cscAppointmentConflictResult.hasExactTime
                              ? cscAppointmentConflictResult.usesDefaultDuration
                                ? "This check assumes a one-hour appointment because no end time was entered."
                                : "The appointment overlaps the following scheduled CSC shift."
                              : "No appointment time was entered, so this is treated as a possible all-day conflict."}
                          </p>
                          <div className="mt-2 space-y-2">
                            {cscAppointmentConflictResult.conflicts.map((shift, index) => {
                              const shiftName = shift.event || shift.jobName || shift.shiftName || shift.venue || "CSC shift";
                              return (
                                <div key={shift.id || `${shift.startDate}-${shift.startTime}-${index}`} className="rounded-lg border border-red-200 bg-white px-3 py-2">
                                  <div className="text-sm font-black text-slate-950">{shiftName}</div>
                                  {shift.venue && shift.venue !== shiftName && (
                                    <div className="text-xs font-bold text-slate-800">{shift.venue}</div>
                                  )}
                                  <div className="text-xs font-semibold text-slate-800">{formatCscShiftConflictWindow(shift)}</div>
                                </div>
                              );
                            })}
                          </div>
                          <p className="mt-2 text-xs font-bold text-red-950">Saving will require confirmation.</p>
                        </>
                      ) : cscAppointmentConflictResult.hasExactTime ? (
                        <>
                          <div className="font-black text-emerald-950">No CSC shift conflict found</div>
                          <p className="mt-1 text-xs font-semibold text-emerald-900">
                            {cscAppointmentConflictResult.usesDefaultDuration
                              ? "Checked as a one-hour appointment. Add an end time if it will last longer."
                              : "The appointment does not overlap an active scheduled CSC shift."}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="font-black text-amber-950">Add an appointment time for an exact check</div>
                          <p className="mt-1 text-xs font-semibold text-amber-900">No CSC shift is currently scheduled on this date.</p>
                        </>
                      )}
                    </div>
                  )}
                </section>

                {(normalizeTaskWorkflowStatus(form.status) === "Waiting" || followUpFormFields.some((field) => Boolean(form[field]))) && (
                  <section className="rounded-xl border border-fuchsia-200 bg-fuchsia-50/40 p-4">
                    <div className="mb-3">
                      <h4 className="font-black text-slate-900">Waiting & Follow-up</h4>
                      <p className="text-xs font-semibold text-slate-500">Record who has the next action and when you want to follow up.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">{renderTaskFormFields(followUpFormFields)}</div>
                  </section>
                )}

                <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-black text-slate-900">Dependency</h4>
                      <p className="text-xs font-semibold text-slate-500">Use this only when another task must be completed first.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDependencyFields((current) => !current)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
                    >
                      {showDependencyFields ? "Hide dependency" : form.blockedBy ? "Edit dependency" : "Add dependency"}
                    </button>
                  </div>
                  {showDependencyFields && (
                    <label className="mt-3 block text-sm font-medium">
                      Blocked by
                      <select value={form.blockedBy} onChange={(event) => updateForm("blockedBy", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                        <option value="">Not blocked</option>
                        {tasks.filter((task) => task.id !== editingId).map((task) => <option key={task.id} value={task.id}>{task.taskName}</option>)}
                      </select>
                    </label>
                  )}
                </section>

                <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h4 className="font-black text-slate-900">Contact Information</h4>
                      <p className="text-xs font-semibold text-slate-500">Add a saved contact, organization, phone number, or website when needed.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowContactFields((current) => !current)}
                      className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50"
                    >
                      {showContactFields ? "Hide contacts" : hasTaskContactInformation(form) ? "Edit contacts" : "Add contact"}
                    </button>
                  </div>
                  {showContactFields && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {renderContactPicker("form")}
                      {renderTaskFormFields(primaryContactFormFields)}
                      {additionalContactFormFields.length > 0 && (
                        <div className="md:col-span-2">
                          <button
                            type="button"
                            onClick={() => setShowMoreContactFields((current) => !current)}
                            className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-50"
                          >
                            {showMoreContactFields ? "Hide additional contact fields" : "More contact fields"}
                          </button>
                        </div>
                      )}
                      {showMoreContactFields && renderTaskFormFields(additionalContactFormFields)}
                    </div>
                  )}
                </section>

                {categoryDetailFormFields.length > 0 && (
                  <section className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                    <div className="mb-3">
                      <h4 className="font-black text-slate-900">{form.type === "General" ? "Additional Details" : `${form.type} Details`}</h4>
                      <p className="text-xs font-semibold text-slate-500">Add only the information that is useful for this task.</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">{renderTaskFormFields(categoryDetailFormFields)}</div>
                  </section>
                )}

                {preparationFormFields.length > 0 && (
                  <section className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="font-black text-slate-900">Notes and Documents</h4>
                        <p className="text-xs font-semibold text-slate-500">Keep questions, required documents, the desired outcome, and notes together.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowNotesFields((current) => !current)}
                        className="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-bold text-violet-900 hover:bg-violet-50"
                      >
                        {showNotesFields ? "Hide notes and documents" : hasTaskPreparationInformation(form) ? "Edit notes and documents" : "Add notes or documents"}
                      </button>
                    </div>
                    {showNotesFields && (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">{renderTaskFormFields(preparationFormFields)}</div>
                    )}
                  </section>
                )}

                {renderTaskScanPanel()}
              </div>

              {advancedFormFields.length > 0 && (
                <button type="button" onClick={() => setShowAdvanced((value) => !value)} title={showAdvanced ? "Hide advanced task fields" : "Show advanced task fields"} className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
                  {showAdvanced ? "Hide advanced fields" : "Show advanced fields"}
                </button>
              )}

              {showAdvanced && advancedFormFields.length > 0 && (
                <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2">
                  {advancedFormFields.map((field) => (
                      <label key={field} className="text-sm font-medium">
                        {getFieldLabel(form, field)}
                        <div className="mt-1">{renderInput(field, form[field], (value) => updateForm(field, value))}</div>
                      </label>
                    ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-6 py-4">
              <p className="text-xs font-semibold text-slate-500"><span className="text-red-600">*</span> Task name is required.</p>
              <div className="flex gap-2">
                <button type="button" onClick={closeTaskForm} title="Cancel task editing" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button
                  type="button"
                  onClick={saveTask}
                  disabled={!form.taskName.trim()}
                  title={editingId ? "Save task changes" : "Add task to the list"}
                  className="rounded-lg bg-slate-950 px-5 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {editingId ? "Save changes" : "Add task"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isExportOpen && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/50 px-4 py-4 backdrop-blur-sm sm:px-6">
          <div className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Export To-Do List</h3>
                <p className="text-sm text-slate-600">Copy or download the current task list.</p>
              </div>
              <CloseScreenButton onClick={() => setIsExportOpen(false)} />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="mb-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => navigator.clipboard.writeText(exportText)} title="Copy exported To-Do text" className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700">
                  <Copy className="h-4 w-4" />
                  Copy
                </button>

                <button type="button" onClick={() => { const blob = new Blob([exportText], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "todo-export.txt"; a.click(); URL.revokeObjectURL(url); }} title="Download exported To-Do text" className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
                  <Download size={16} />
                  Download
                </button>
              </div>

              <textarea readOnly value={exportText} rows={18} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-800 shadow-inner" />
            </div>
          </div>
        </div>
      )}

      {checkedTasks.length > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="relative flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-green-300 bg-white px-4 py-3 pr-12 shadow-2xl">
            <button
              type="button"
              onClick={clearCheckedTasks}
              className="absolute right-2 top-2 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              title="Close selected tasks bar"
              aria-label="Close selected tasks bar"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mr-2">
              <p className="text-sm font-black text-green-950">
                {checkedTasks.length} selected
              </p>
              <p className="text-xs font-semibold text-slate-600">
                Choose an action for the checked task{checkedTasks.length === 1 ? "" : "s"}, or close this bar.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={markCheckedTasksDone}
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-green-600 px-3 text-sm font-bold text-white hover:bg-green-700"
                title="Mark checked tasks done"
              >
                <Check className="h-4 w-4" />
                Done
              </button>
              <button
                type="button"
                onClick={archiveCheckedTasks}
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-purple-600 px-3 text-sm font-bold text-white hover:bg-purple-700"
                title="Archive checked tasks"
              >
                <Archive className="h-4 w-4" />
                Archive
              </button>
              <div className="inline-flex h-9 items-center overflow-hidden rounded-lg border border-amber-300 bg-white">
                <select
                  value={bulkMoveType}
                  onChange={(event) => setBulkMoveType(event.target.value)}
                  className="h-full border-0 bg-white px-2 text-sm font-bold text-slate-900 focus:outline-none"
                  title="Choose category for checked tasks"
                >
                  {taskCategoryTypes.map((categoryType) => (
                    <option key={categoryType} value={categoryType}>
                      {categoryType}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={moveCheckedTasks}
                  className="h-full bg-orange-600 px-3 text-sm font-bold text-white hover:bg-orange-700"
                  title="Move checked tasks to chosen category"
                >
                  Move
                </button>
              </div>
              <button
                type="button"
                onClick={clearCheckedTasks}
                className="inline-flex h-9 items-center rounded-lg bg-slate-500 px-3 text-sm font-bold text-white hover:bg-slate-600"
                title="Uncheck selected tasks and close this bar"
              >
                Uncheck
              </button>
              <button
                type="button"
                onClick={deleteCheckedTasks}
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-red-600 px-3 text-sm font-bold text-white hover:bg-red-700"
                title="Delete checked tasks"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/50 px-4 py-4 backdrop-blur-sm sm:px-6">
          <div className="flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Task Details</h3>
                <p className="text-sm font-semibold text-slate-600">{selectedTask.taskName || "Untitled task"}</p>
              </div>
              <CloseScreenButton onClick={() => setSelectedTaskId(null)} />
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 md:grid-cols-2">
                {renderContactPicker("selectedTask")}

                <label className="text-sm font-semibold md:col-span-2">
                  Task name
                  <input value={selectedTask.taskName || ""} onChange={(event) => updateTaskField(selectedTask.id, "taskName", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-semibold">
                  Category
                  <select value={selectedTask.type || "General"} onChange={(event) => moveTaskToCategory(selectedTask.id, event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    {taskCategoryTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Status
                  <select
                    value={normalizeTaskWorkflowStatus(selectedTask.status)}
                    onChange={(event) => updateTaskField(selectedTask.id, "status", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {TASK_WORKFLOW_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Hard deadline
                  <div className="mt-1">
                    <TodoDatePickerInput
                      value={selectedTask.deadline || selectedTask.date || ""}
                      onChange={(value) => updateTaskField(selectedTask.id, selectedTask.deadline !== undefined ? "deadline" : "date", value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </label>
                <label className="text-sm font-semibold">
                  Deadline time
                  <div className="mt-1">
                    <TodoTimePickerInput
                      value={selectedTask.time || ""}
                      onChange={(value) => updateTaskField(selectedTask.id, "time", value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </label>
                <label className="text-sm font-semibold">
                  Waiting on
                  <input value={selectedTask.waitingOn || ""} onChange={(event) => updateTaskField(selectedTask.id, "waitingOn", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>
                <label className="text-sm font-semibold">
                  Follow-up date
                  <div className="mt-1">
                    <TodoDatePickerInput
                      value={selectedTask.followUpDate || ""}
                      onChange={(value) => updateTaskField(selectedTask.id, "followUpDate", value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </label>
                <label className="text-sm font-semibold">
                  Follow-up time
                  <div className="mt-1">
                    <TodoTimePickerInput
                      value={selectedTask.followUpTime || ""}
                      onChange={(value) => updateTaskField(selectedTask.id, "followUpTime", value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </label>
                <label className="text-sm font-semibold md:col-span-2">
                  Details
                  <AutoResizeTextarea
                    value={selectedTask.details || ""}
                    onChange={(value) => updateTaskField(selectedTask.id, "details", value)}
                    minRows={1}
                    maxRows={12}
                    charsPerRow={90}
                    compactOnChange
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                {Array.from(new Set([...(TYPE_FIELDS[selectedTask.type] || []), ...Object.keys(DEFAULT_FORM).filter((field) => selectedTask[field])]))
                  .filter((field) => !["taskName", "details", "type", "typeOverride", "completed", "id", "time", "status", "waitingOn", "followUpDate", "followUpTime"].includes(field))
                  .map((field) => (
                    <label key={field} className="text-sm font-semibold">
                      {getFieldLabel(selectedTask, field)}
                      <div className="mt-1">
                        {MULTILINE_FIELDS.has(field) ? (
                          shouldUseFormattingToolbar(field) ? (
                            <FormattingTextarea value={selectedTask[field] || ""} onChange={(value) => updateTaskField(selectedTask.id, field, value)} rows={getTextareaRows(selectedTask[field], 2, 12, 90)} className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                          ) : (
                            <AutoResizeTextarea value={selectedTask[field] || ""} onChange={(value) => updateTaskField(selectedTask.id, field, value)} minRows={1} maxRows={12} charsPerRow={90} compactOnChange className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                          )
                        ) : DATE_PICKER_FIELDS.has(field) ? (
                          <TodoDatePickerInput
                            value={selectedTask[field] || ""}
                            onChange={(value) => updateTaskField(selectedTask.id, field, value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        ) : TIME_PICKER_FIELDS.has(field) ? (
                          <TodoTimePickerInput
                            value={selectedTask[field] || ""}
                            onChange={(value) => updateTaskField(selectedTask.id, field, value)}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        ) : (
                          <input value={selectedTask[field] || ""} onChange={(event) => updateTaskField(selectedTask.id, field, event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                        )}
                      </div>
                    </label>
                  ))}
              </div>

              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-slate-700">
                  <History className="h-4 w-4" />
                  Activity History
                </h4>
                {Array.isArray(selectedTask.activityLog) && selectedTask.activityLog.length > 0 ? (
                  <div className="space-y-2">
                    {selectedTask.activityLog.slice(0, 20).map((entry) => (
                      <div key={entry.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                        <div className="font-bold text-slate-900">{entry.action}</div>
                        <div className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</div>
                        {entry.detail && <div className="mt-1 whitespace-pre-wrap text-slate-700">{entry.detail}</div>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-600">No activity history yet.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ContactManager
        isOpen={isContactsOpen}
        onClose={() => setIsContactsOpen(false)}
        contactApplyTarget={contactApplyTarget}
        selectedTask={selectedTask}
        contactForm={contactForm}
        setContactForm={setContactForm}
        editingContactId={editingContactId}
        saveContact={saveContact}
        resetContactForm={resetContactForm}
        contactSearch={contactSearch}
        setContactSearch={setContactSearch}
        replaceExistingContactFields={replaceExistingContactFields}
        setReplaceExistingContactFields={setReplaceExistingContactFields}
        filteredContacts={filteredContacts}
        applyContactToTarget={applyContactToTarget}
        editContact={editContact}
        deleteContact={deleteContact}
        taskTypes={taskCategoryTypes}
        onAddTaskCategory={addCustomTaskCategory}
        AutoResizeTextarea={AutoResizeTextarea}
      />

      <ArchivedDrawer
        isOpen={isArchiveDrawerOpen}
        onClose={() => setIsArchiveDrawerOpen(false)}
        archivedItems={archivedTasks}
        onRestore={restoreArchivedTask}
        onDelete={deleteArchivedTask}
        archiveType="todo"
        title="To-Do Archives"
      />

      {showPremiumTodoView && <PremiumTodoListView tasks={printListTasks} onClose={() => setShowPremiumTodoView(false)} />}
    </PageContainer>
  );
}
