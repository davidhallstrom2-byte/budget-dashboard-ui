import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  AlertCircle,
  BriefcaseBusiness,
  Car,
  CalendarPlus,
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
  History,
  PanelRightOpen,
} from "lucide-react";
import PageContainer from "../common/PageContainer";
import PremiumTodoListView from "../todo/PremiumTodoListView";
import ArchivedDrawer from "../ui/ArchivedDrawer";
import { createGoogleCalendarEvent } from "../../utils/googleCalendarApi";

const STORAGE_KEY = "todoTab.tasks.v1";
const STORAGE_BACKUP_KEY = "todoTab.tasks.backup.v1";
const ARCHIVE_STORAGE_KEY = "todoTab.tasks.archived.v1";
const SAFETY_SNAPSHOT_STORAGE_KEY = "todoTab.tasks.safetySnapshots.v1";
const MAX_SAFETY_SNAPSHOTS = 30;

const CONTACTS_STORAGE_KEY = "todoTab.contacts.v1";
const TODO_GOOGLE_CALENDAR_ADDED_STORAGE_KEY = "todoTab.googleCalendar.addedIds.v1";

const DEFAULT_CONTACTS = [
  {
    id: "contact-dpss",
    name: "DPSS",
    category: "DPSS / Benefits",
    phone: "(866) 613-3777",
    website: "https://benefitscal.com",
    organization: "DPSS",
    notes: "Benefits, GR, CalFresh, Medi-Cal case support.",
  },
  {
    id: "contact-dmv",
    name: "California DMV",
    category: "DMV / Vehicle",
    phone: "1-800-777-0133",
    website: "https://www.dmv.ca.gov/",
    organization: "California DMV",
    notes: "Driver license, registration, address changes, vehicle issues.",
  },
  {
    id: "contact-usps",
    name: "USPS",
    category: "Moving",
    phone: "1-800-275-8777",
    website: "https://www.usps.com/manage/forward.htm",
    organization: "USPS",
    notes: "Mail forwarding and change of address.",
  },
  {
    id: "contact-spectrum",
    name: "Spectrum",
    category: "Phone / Lifeline",
    phone: "1-833-267-6094",
    website: "https://www.spectrum.net/",
    organization: "Spectrum",
    notes: "Internet, cable, service change, billing, downgrade, transfer.",
  },
  {
    id: "contact-health-net",
    name: "Health Net",
    category: "Medical",
    phone: "1-800-675-6110",
    website: "https://www.healthnet.com/",
    organization: "Health Net",
    notes: "Medi-Cal plan support and member services.",
  },
  {
    id: "contact-dr-taylor",
    name: "Dr. Taylor",
    category: "Medical",
    phone: "(626) 459-5420",
    address: "11436 Garvey Ave, Ste B, El Monte, CA 91732",
    organization: "Mayflower Medical Group",
    person: "Dr. Taylor",
    notes: "Primary care.",
  },
  {
    id: "contact-dr-ananyan",
    name: "Dr. Ananyan",
    category: "Medical",
    phone: "323-264-6157",
    address: "3616 E 1st St, Los Angeles, CA 90063",
    organization: "Podiatry",
    person: "Dr. Ananyan",
    notes: "Podiatry.",
  },
  {
    id: "contact-custodio-dubey",
    name: "Custodio & Dubey",
    category: "Legal",
    phone: "213-593-9095",
    organization: "Custodio & Dubey",
    person: "Keshav Nair / Maria Saavedra",
    notes: "Attorney contact.",
  },
  {
    id: "contact-211-la",
    name: "211 LA",
    category: "Moving",
    phone: "211",
    website: "https://211la.org/",
    organization: "211 LA",
    notes: "Moving assistance and local support resources.",
  },
];

const EMPTY_CONTACT_FORM = {
  id: "",
  name: "",
  category: "General",
  phone: "",
  directPhone: "",
  website: "",
  address: "",
  organization: "",
  company: "",
  person: "",
  notes: "",
};

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
  typeOverride: "",
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
  followUpNotes: "",
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
  followUpNotes: ["follow-up notes", "follow up notes", "followup notes", "follow-up", "follow up"],
  fileName: ["file", "file name", "filename"],
};

const FIELD_LABEL_DISPLAY = {
  taskName: "Task name",
  details: "Details",
  type: "Type",
  typeOverride: "Category",
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
  followUpNotes: "Follow-up Notes",
};

const normalizeType = (value = "") => {
  const candidate = String(value || "").trim();
  return TASK_TYPES.includes(candidate) ? candidate : "General";
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

const REQUIRED_FIELDS_BY_TYPE = {
  Medical: ["phone", "date"],
  "DMV / Vehicle": ["plate", "vin", "deadline"],
  Insurance: ["company", "phone", "effectiveDate"],
  "DPSS / Benefits": ["caseNumber", "phone"],
  Legal: ["caseNumber", "deadline", "phone"],
  Moving: ["date", "address", "phone"],
  Work: ["organization", "phone"],
  Dental: ["phone", "date"],
  "Phone / Lifeline": ["phone", "website"],
};

const MULTILINE_FIELDS = new Set(["details", "documents", "questions", "outcome", "notes", "followUpNotes", "impact", "requiredAction", "website", "systemLink"]);
const FORMATTED_TEXT_FIELDS = new Set(["notes", "followUpNotes"]);
const shouldUseFormattingToolbar = (field) => FORMATTED_TEXT_FIELDS.has(field);

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
  const displayValue = compactOnChange ? compactMultilineText(value) : String(value || "");

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
      onChange={(event) => onChange(compactOnChange ? compactMultilineText(event.target.value) : event.target.value)}
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

const formatDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

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
      if (color) span.setAttribute("style", `color: ${color};`);
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
        const colorMatch = valueText.match(/color\s*:\s*(#[0-9a-fA-F]{3,6}|rgb\([^)]*\)|[a-zA-Z]+)/);
        if (colorMatch) {
          node.setAttribute("style", `color: ${colorMatch[1]};`);
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
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

const getEditorHtml = (value = "") => {
  const rawValue = String(value ?? "");
  if (!rawValue.trim()) return "";
  return looksLikeHtmlNote(rawValue) ? sanitizeFormattedHtml(rawValue) : formatTextToHtml(rawValue);
};

const FormattingToolbar = ({ editorRef, selectionRef, colorValue, setColorValue }) => {
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

  const runCommand = (command, value = null) => {
    focusAndRestoreSelection();
    if (command === "createLink") {
      const url = window.prompt("Enter link URL:", "https://");
      if (!url || !/^https?:\/\//i.test(url)) return;
      document.execCommand(command, false, url);
      saveCurrentSelection();
      return;
    }
    document.execCommand(command, false, value);
    saveCurrentSelection();
  };

  const applyColor = (color) => {
    const nextColor = color || "#111827";
    setColorValue(nextColor);
    setShowColorMenu(false);
    focusAndRestoreSelection();
    document.execCommand("styleWithCSS", false, true);
    document.execCommand("foreColor", false, nextColor);
    saveCurrentSelection();
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
    const nextHtml = sanitizeFormattedHtml(editorRef.current?.innerHTML || "").trim();
    onChange(nextHtml);
  };

  return (
    <div>
      <FormattingToolbar editorRef={editorRef} selectionRef={selectionRef} colorValue={colorValue} setColorValue={setColorValue} />
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

const normalizeContact = (contact = {}) => ({
  ...EMPTY_CONTACT_FORM,
  ...contact,
  id: contact.id || createId(),
  name: String(contact.name || contact.organization || contact.company || contact.person || "Untitled contact").trim(),
  category: TASK_TYPES.includes(contact.category) ? contact.category : "General",
});

const readStoredContacts = () => {
  if (typeof localStorage === "undefined") return DEFAULT_CONTACTS.map(normalizeContact);

  const parsed = safeJsonParse(localStorage.getItem(CONTACTS_STORAGE_KEY), null);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    const defaults = DEFAULT_CONTACTS.map(normalizeContact);
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }

  return parsed.map(normalizeContact);
};

const writeStoredContacts = (contacts = []) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts.map(normalizeContact)));
};

const createEmptyContact = () => ({
  ...EMPTY_CONTACT_FORM,
  id: createId(),
});

const CONTACT_APPLY_FIELDS = [
  "phone",
  "address",
  "website",
  "organization",
  "company",
  "person",
];

const applyContactToTaskData = (task = {}, contact = {}, replaceExisting = false) => {
  const next = { ...task };

  if (TASK_TYPES.includes(contact.category) && (replaceExisting || !next.type || next.type === "General")) {
    next.type = contact.category;
    next.typeOverride = contact.category;
  }

  CONTACT_APPLY_FIELDS.forEach((field) => {
    if (contact[field] && (replaceExisting || !String(next[field] || "").trim())) {
      next[field] = contact[field];
    }
  });

  if (contact.directPhone && (replaceExisting || !String(next.phone || "").trim())) {
    next.phone = contact.directPhone;
  }

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
  const haystack = [
    task.time,
    task.startTime,
    task.appointmentTime,
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

  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3].toUpperCase();

  if (!hour || hour > 12 || minute > 59) return "";

  const hour24 =
    meridiem === "PM" && hour !== 12
      ? hour + 12
      : meridiem === "AM" && hour === 12
        ? 0
        : hour;

  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
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
    task.phone ? `Phone: ${task.phone}` : "",
    task.organization ? `Organization: ${task.organization}` : "",
    task.company ? `Company: ${task.company}` : "",
    task.person ? `Person: ${task.person}` : "",
    task.caseNumber ? `Case #: ${task.caseNumber}` : "",
    task.policyNumber ? `Policy #: ${task.policyNumber}` : "",
    task.amount ? `Amount: ${task.amount}` : "",
    task.website ? `Website: ${task.website}` : "",
    task.systemLink ? `System link: ${task.systemLink}` : "",
    task.questions ? `Questions:\n${task.questions}` : "",
    noteText ? `Notes:\n${noteText}` : "",
    followUpText ? `Follow-up notes:\n${followUpText}` : "",
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
      dateTime: addHoursToTodoCalendarDateTime(dateValue, timeValue, 1),
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

const createEmptyTask = () => ({
  ...DEFAULT_FORM,
  id: createId(),
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

    normalizedTasks.push(normalizeTaskCategory(task));
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
    return Array.isArray(parsed) ? parsed : [];
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

const getExplicitTaskType = (task) => {
  const title = String(task?.taskName || "").toLowerCase();
  const details = String(task?.details || "").toLowerCase();
  const notes = String(task?.notes || "").toLowerCase();
  const text = `${title} ${details} ${notes}`;

  if (/\bcall\s+dpss\b|\bdpss\b|calfresh|medi-cal|redetermination|benefitscal|\bgr\b/.test(text)) return "DPSS / Benefits";
  if (/spectrum|internet|basic\s+tv|tv\s+package|cable|wireless|phone\s+service/.test(text)) return "Phone / Lifeline";
  if (/secure\s+moving\s+assistance|\bmoving\b|move-in|move-out|storage|211\s*la/.test(text)) return "Moving";
  if (/parking citation|citationprocessingcenter|dmv|registration renewal|vehicle registration|plate\s*:|vin\s*:/.test(text)) return "DMV / Vehicle";
  if (/auto insurance|insurance assignment|caarp|aipso|integon|policy|coverage|carrier|premium|cancelled|canceled/.test(text)) return "Insurance";
  if (/lifeline phone|lifeline phones|safelink|truconnect|assurance wireless|california lifeline/.test(text)) return "Phone / Lifeline";
  if (/dental|dentist|bhakta/.test(text)) return "Dental";
  if (/csc|reactivation|retraining|work|job|shift|schedule/.test(text)) return "Work";
  if (/attorney|lawyer|court|legal|hearing|notice|eviction|custodio|dubey/.test(text)) return "Legal";
  if (/doctor|medical|clinic|podiatry|urology|oncology|cardiology|blood draw|quest|lab|authorization|referral|antibiotics|wound/.test(text)) return "Medical";

  return "";
};

const inferTaskType = (task) => {
  if (TASK_TYPES.includes(task?.typeOverride)) return task.typeOverride;

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
  if (/(spectrum|internet|basic\s+tv|tv\s+package|cable|wireless|phone\s+service)/i.test(haystack)) return "Phone / Lifeline";
  if (/(move|moving|move-in|move-out|storage|rental|211 la)/i.test(haystack)) return "Moving";
  if (/(insurance|integon|policy|coverage|carrier|premium|cancelled|canceled|effective date|policy status|caarp|aipso)/i.test(haystack)) return "Insurance";
  if (/(dmv|registration|plate|vin|vehicle|license|parking citation|citationprocessingcenter)/i.test(haystack)) return "DMV / Vehicle";
  if (/(lifeline|phone|wireless|safelink|truconnect|assurance wireless|california lifeline)/i.test(haystack)) return "Phone / Lifeline";
  if (/(doctor|medical|clinic|podiatry|urology|oncology|cardiology|blood draw|quest|lab|authorization|referral|antibiotics|wound)/i.test(haystack)) return "Medical";
  if (/(court|legal|attorney|lawyer|hearing|notice|eviction|custodio|dubey)/i.test(haystack)) return "Legal";
  if (/(work|job|shift|schedule|reactivation|retraining|csc)/i.test(haystack)) return "Work";
  if (/(dental|dentist|teeth|bhakta)/i.test(haystack)) return "Dental";

  return TASK_TYPES.includes(task.type) ? task.type : "General";
};

const normalizeTaskCategory = (task = {}) => {
  const correctedType = inferTaskType(task);
  const normalizedType = TASK_TYPES.includes(correctedType) ? correctedType : "General";
  return combineNotesIntoFollowUpEntries({
    ...task,
    type: normalizedType,
    typeOverride: TASK_TYPES.includes(task.typeOverride) ? task.typeOverride : task.typeOverride || "",
  });
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
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [movingTaskId, setMovingTaskId] = useState(null);
  const [isArchiveDrawerOpen, setIsArchiveDrawerOpen] = useState(false);
  const [archivedTasks, setArchivedTasks] = useState(readStoredArchivedTasks);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [checkedTaskIds, setCheckedTaskIds] = useState([]);
  const [bulkMoveType, setBulkMoveType] = useState(TASK_TYPES[0] || "General");
  const [followUpDrafts, setFollowUpDrafts] = useState({});
  const [editingFollowUpEntries, setEditingFollowUpEntries] = useState({});
  const [contacts, setContacts] = useState(readStoredContacts);
  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [contactForm, setContactForm] = useState(createEmptyContact);
  const [editingContactId, setEditingContactId] = useState(null);
  const [replaceExistingContactFields, setReplaceExistingContactFields] = useState(false);
  const [contactApplyTarget, setContactApplyTarget] = useState("form");
  const [completionCelebration, setCompletionCelebration] = useState(null);
  const [calendarAddingTaskId, setCalendarAddingTaskId] = useState("");
  const [calendarAddedIds, setCalendarAddedIds] = useState(readTodoGoogleCalendarAddedIds);
  const completionCelebrationTimeoutRef = useRef(null);
  const previousTaskCompletionRef = useRef(new Map(tasks.map((task) => [task.id, Boolean(task.completed)])));

  useEffect(() => {
    hasHydrated.current = true;
  }, []);

  useEffect(() => {
    const openCreateTask = () => {
      setForm(createEmptyTask());
      setEditingId(null);
      setShowAdvanced(false);
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

    window.addEventListener("todo-toolbar:add", openCreateTask);
    window.addEventListener("todo-toolbar:archive", openArchiveDrawer);
    window.addEventListener("todo-toolbar:snapshot", saveSnapshot);
    window.addEventListener("todo-toolbar:save", saveSnapshot);
    window.addEventListener("todo-toolbar:export", openExport);
    window.addEventListener("todo-toolbar:import", openImport);

    return () => {
      window.removeEventListener("todo-toolbar:add", openCreateTask);
      window.removeEventListener("todo-toolbar:archive", openArchiveDrawer);
      window.removeEventListener("todo-toolbar:snapshot", saveSnapshot);
      window.removeEventListener("todo-toolbar:save", saveSnapshot);
      window.removeEventListener("todo-toolbar:export", openExport);
      window.removeEventListener("todo-toolbar:import", openImport);
    };
  }, [tasks, archivedTasks]);

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

  useEffect(() => {
    writeStoredContacts(contacts);
  }, [contacts]);

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
      (field) => !["taskName", "details", "type", "typeOverride", "completed", "id"].includes(field)
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

    const taskToSave = stampTask(
      normalizeDerivedFields({
        ...form,
        taskName: form.taskName.trim(),
        details: form.details.trim(),
        id: editingId || form.id || createId(),
        typeOverride: form.typeOverride || form.type || "General",
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
    setIsCreateOpen(false);
  };

  const parseImport = () => {
    const parsed = parseTasksFromText(importText);
    setParsedTasks(parsed);

    if (parsed.length === 1) {
      setForm({ ...createEmptyTask(), ...parsed[0] });
      setShowAdvanced(true);
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

  const editTask = (task) => {
    setForm({ ...createEmptyTask(), ...task });
    setEditingId(task.id);
    setShowAdvanced(true);
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
    const shouldCelebrate = Boolean(taskToToggle && !taskToToggle.completed);

    setTasks((current) =>
      current.map((task) => {
        if (task.id !== id) return task;
        const nextCompleted = !task.completed;
        return addTaskHistory(
          {
            ...task,
            completed: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : "",
          },
          nextCompleted ? "Marked done" : "Reopened"
        );
      })
    );

    if (shouldCelebrate) {
      showCompletionCelebration(1, taskToToggle.taskName);
    }
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
          {contacts.map((contact) => (
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
    if (!TASK_TYPES.includes(nextType)) return;

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

    const followUpEntryText = [
      `Created from completed task: ${sourceTaskName}`,
      sourceSummary ? `Source summary:\n${sourceSummary}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

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
        systemLink: sourceTask.systemLink || sourceTask.website || "",
        caseNumber: sourceTask.caseNumber || "",
        amount: sourceTask.amount || "",
        documents: sourceTask.documents || "",
        questions: sourceTask.questions || "",
        outcome: sourceTask.outcome || "",
        requiredAction: "",
        impact: "",
        notes: "Connected follow-up. Source task summary is saved below.",
        completed: false,
        completedAt: "",
        blockedBy: "",
        sourceTaskId: sourceTask.id || "",
        sourceTaskName,
        sourceTaskSummary: sourceSummary,
        sourceTaskSnapshot: sourceSnapshot,
        sourceTaskArchivedAt: now,
        sourceTaskCompletedAt: now,
        followUpEntries: followUpEntryText
          ? [
              {
                id: createId(),
                createdAt: now,
                text: followUpEntryText,
              },
            ]
          : [],
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
    if (task.completed) return "bg-green-50 border-green-200";
    if (isBlocked) return "bg-amber-50 border-amber-200";
    const status = getTaskStatus(task);
    if (status === "overdue") return "bg-white border-red-200";
    if (status === "dueSoon") return "bg-white border-yellow-200";
    return "bg-white border-slate-200";
  };

  const getTaskDetailRowClass = (task, isBlocked) => {
    if (task.completed) return "bg-green-50 border-green-200";
    if (isBlocked) return "bg-amber-50 border-amber-200";
    const status = getTaskStatus(task);
    if (status === "overdue") return "bg-green-50 border-red-200";
    if (status === "dueSoon") return "bg-green-50 border-yellow-200";
    return "bg-green-50 border-green-200";
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
      const normalizedTask = normalizeTaskCategory(task);
      const type = normalizedTask.type;
      if (!map[type]) map[type] = [];
      map[type].push(normalizedTask);
    });

    return map;
  }, [tasks]);

  const activeCategorySummary = useMemo(() => {
    return TASK_TYPES.map((type) => {
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
  }, [tasksByType]);

  const totalActiveTasks = useMemo(() => tasks.filter((task) => !task.completed).length, [tasks]);

  const visibleCategoryTypes = useMemo(() => {
    if (!showActiveOnly) return TASK_TYPES;

    return TASK_TYPES.filter((type) => {
      const categoryTasks = tasksByType[type] || [];
      return categoryTasks.some((task) => !task.completed);
    });
  }, [showActiveOnly, tasksByType]);

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
    if (!checkedTaskIds.length || !TASK_TYPES.includes(bulkMoveType)) return;

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
        contact.website,
        contact.address,
        contact.organization,
        contact.company,
        contact.person,
        contact.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [contactSearch, contacts]);

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

    return (
      <input
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    );
  };

  return (
    <PageContainer className="space-y-6 bg-green-50 py-6">
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

      <div className="rounded-xl border-2 border-black bg-gradient-to-r from-green-50 to-emerald-100 px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">To-Do</h2>
            <p className="mt-1 text-sm font-medium text-slate-600">Manage tasks here. Budget details stay on the Dashboard tab.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setIsImportOpen(true)}
              title="Import structured text"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" />
              Import
            </button>

            <button
              type="button"
              onClick={() => {
                setForm(createEmptyTask());
                setEditingId(null);
                setShowAdvanced(false);
                setIsCreateOpen(true);
              }}
              title="Add task"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Add Task
            </button>

            <button
              type="button"
              onClick={() => setIsExportOpen(true)}
              title="Open export options"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Download className="h-4 w-4" />
              Export
            </button>

            <button
              type="button"
              onClick={() => setShowPremiumTodoView(true)}
              title="View premium To-Do list"
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              <ListTodo className="h-4 w-4" />
              Premium View
            </button>
          </div>
        </div>
      </div>

      <section className="rounded-xl border-2 border-green-300 bg-gradient-to-r from-green-50 to-green-100 p-3 shadow-md">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[220px] shrink-0">
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <span>Active Tasks</span>
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-700 px-2 text-xs font-bold leading-none text-white shadow-sm">
                {totalActiveTasks}
              </span>
            </h3>
          </div>

          <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-2">
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
                      setCollapsedCategories(
                        TASK_TYPES.reduce((map, categoryType) => ({ ...map, [categoryType]: categoryType !== item.type }), {})
                      );
                      window.requestAnimationFrame(() => {
                        document.getElementById(getCategoryAnchorId(item.type))?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }}
                    className="group inline-flex items-center justify-between gap-2 rounded-lg border border-black bg-white px-4 py-2 text-left text-sm font-semibold shadow-sm transition hover:bg-green-100"
                    title={`Go to ${item.type} active tasks`}
                    aria-label={`Go to ${item.type} active tasks`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} aria-hidden="true" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{item.type}</div>
                      </div>
                    </div>
                    <div
                      className={`flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold leading-none text-white shadow-sm ${
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
              <div className="rounded-lg border border-green-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
                No active tasks.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-start justify-end gap-3">
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                writeSafetySnapshot("Manual safety snapshot", tasks, archivedTasks);
                alert("Safety snapshot saved.");
              }}
              title="Save a manual safety snapshot of active and archived To-Do tasks"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
            >
              <History size={16} />
              Safety Snapshot
            </button>
            <button
              type="button"
              onClick={() => {
                setArchivedTasks(readStoredArchivedTasks());
                setIsArchiveDrawerOpen(true);
              }}
              title={`Open archive drawer with ${archivedTasks.length} archived task${archivedTasks.length === 1 ? "" : "s"}`}
              aria-label={`Open archive drawer with ${archivedTasks.length} archived task${archivedTasks.length === 1 ? "" : "s"}`}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-800"
            >
              <Archive size={16} />
              Archive Drawer
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-black">{archivedTasks.length}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowActiveOnly((current) => !current)}
              title={showActiveOnly ? "Show all task categories" : "Show only categories with active tasks and hide completed tasks"}
              aria-pressed={showActiveOnly}
              className={`inline-flex min-w-[168px] items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm ${
                showActiveOnly ? "bg-blue-700 hover:bg-blue-800" : "bg-slate-600 hover:bg-slate-700"
              }`}
            >
              <Check size={16} />
              {showActiveOnly ? "Active Only" : "Show Active"}
            </button>
            <button
              type="button"
              onClick={() => setCollapsedCategories(TASK_TYPES.reduce((map, type) => ({ ...map, [type]: true }), {}))}
              title="Collapse all categories"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <ChevronDown size={16} />
              Collapse All
            </button>
            <button
              type="button"
              onClick={() => setCollapsedCategories({})}
              title="Expand all visible categories"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <ChevronRight size={16} />
              Expand All
            </button>
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
                    {TASK_TYPES.map((categoryType) => (
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

        {visibleCategoryTypes.map((type) => {
          const rawCategoryTasks = sortTasks(tasksByType[type] || []);
          const categoryTasks = showActiveOnly ? rawCategoryTasks.filter((task) => !task.completed) : rawCategoryTasks;
          const isCollapsed = Boolean(collapsedCategories[type]);
          const Icon = TODO_CATEGORY_ICONS[type]?.icon || ListTodo;
          const iconColor = TODO_CATEGORY_ICONS[type]?.color || "text-slate-300";
          const activeCount = rawCategoryTasks.filter((task) => !task.completed).length;
          const completedCount = rawCategoryTasks.length - activeCount;
          const overdueCount = rawCategoryTasks.filter((task) => !task.completed && getTaskStatus(task) === "overdue").length;
          const dueSoonCount = rawCategoryTasks.filter((task) => !task.completed && getTaskStatus(task) === "dueSoon").length;

          return (
            <div
              key={type}
              id={getCategoryAnchorId(type)}
              className={`scroll-mt-6 overflow-hidden rounded-xl border-2 bg-gradient-to-r from-green-50 to-green-100 shadow-md ${
                activeCount > 0 ? "border-green-300 ring-1 ring-green-100" : "border-green-200 opacity-85"
              }`}
            >
              <div className="flex items-center justify-between gap-3 bg-green-700 px-4 py-2 text-white">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <GripVertical className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" aria-hidden="true" title="Category section" />
                  <button
                    type="button"
                    onClick={() => toggleCategory(type)}
                    className="shrink-0 rounded p-1 text-white transition-colors hover:bg-green-800"
                    aria-label={isCollapsed ? `Expand ${type}` : `Collapse ${type}`}
                    title={isCollapsed ? `Expand ${type}` : `Collapse ${type}`}
                  >
                    {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronDown className="h-4 w-4 rotate-180" />}
                  </button>
                  <Icon className={`h-5 w-5 shrink-0 ${iconColor}`} aria-hidden="true" />
                  <div className="flex min-w-0 items-center gap-2">
                    <h4 className="truncate text-base font-semibold text-white sm:text-lg">{type}</h4>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide shadow-sm ${
                        overdueCount > 0
                          ? "bg-red-600 text-white"
                          : activeCount > 0
                            ? "bg-blue-600 text-white"
                            : "bg-slate-700 text-slate-300"
                      }`}
                      title={`${activeCount} active tasks, ${completedCount} completed tasks${overdueCount > 0 ? `, ${overdueCount} overdue` : ""}`}
                    >
                      Active {activeCount}
                    </span>
                    {completedCount > 0 && (
                      <span className="hidden text-xs font-semibold text-slate-400 sm:inline">{completedCount} done</span>
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
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addTaskToCategory(type)}
                    className="flex items-center gap-1.5 rounded bg-blue-600 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 sm:px-3 sm:text-sm"
                    title={`Add task to ${type}`}
                    aria-label={`Add task to ${type}`}
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Task</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => exportCategoryText(type, categoryTasks)}
                    className="rounded p-1.5 text-white transition-colors hover:bg-green-800"
                    aria-label={`Download ${type}`}
                    title={`Download ${type} tasks`}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => addTaskToCategory(type)}
                    className="rounded p-1.5 text-white transition-colors hover:bg-green-800"
                    aria-label={`Edit ${type}`}
                    title={`Edit ${type} category`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <div className="rounded-b-xl border-2 border-green-700 bg-green-50">
                  <table className="w-full table-fixed text-sm">
                    <thead className="bg-green-100 text-green-950">
                      <tr className="border-b-2 border-green-700">
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
                        categoryTasks.map((task, taskIndex) => {
                          const blocker = task.blockedBy ? taskById[task.blockedBy] : null;
                          const isBlocked = Boolean(blocker && !blocker.completed);
                          const controls = controlledByMap[task.id] || [];
                          const statusLabel = getStatusLabel(task, isBlocked);
                          const statusClass = getStatusClass(task, isBlocked);
                          const rowClass = getTaskRowClass(task, isBlocked);
                          const taskType = TASK_TYPES.includes(task.type) ? task.type : inferTaskType(task);
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
                          const mainRowDividerClass = taskIndex > 0 ? "border-t-4 border-black" : "";

                          return (
                            <React.Fragment key={task.id}>
                              <tr className={`${rowClass} ${mainRowDividerClass}`}>
                                <td className="align-top px-2 py-2">
                                  <input
                                    type="checkbox"
                                    checked={checkedTaskIds.includes(task.id)}
                                    onChange={() => toggleCheckedTask(task.id)}
                                    className="h-4 w-4 cursor-pointer rounded border-slate-300"
                                    title="Select task"
                                    aria-label={`Select ${task.taskName || "task"}`}
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
                                  {task.sourceTaskName && (
                                    <div className="mt-1 text-xs font-semibold text-indigo-700">Related source: {task.sourceTaskName}</div>
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
                                <td className="align-top px-2 py-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => toggleTask(task.id)}
                                      className={`inline-flex items-center justify-center rounded px-2 py-1 text-xs font-semibold text-white ${
                                        task.completed ? "bg-slate-600 hover:bg-slate-700" : "bg-green-600 hover:bg-green-700"
                                      }`}
                                      title={task.completed ? "Reopen task" : "Mark task done"}
                                      aria-label={task.completed ? "Reopen task" : "Mark task done"}
                                    >
                                      {task.completed ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                                      <span className="ml-1">{task.completed ? "Reopen" : "Done"}</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => duplicateTask(task)}
                                      className="inline-flex items-center justify-center rounded bg-blue-600 px-2 py-1 text-white hover:bg-blue-700"
                                      aria-label="Copy task"
                                      title="Copy task"
                                    >
                                      <Copy className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => createConnectedFollowUpTask(task)}
                                      className="inline-flex items-center justify-center rounded bg-indigo-600 px-2 py-1 text-white hover:bg-indigo-700"
                                      aria-label="Create connected follow-up task"
                                      title="Create connected follow-up, mark this done, and archive the source task"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => archiveTask(task)}
                                      className="inline-flex items-center justify-center rounded bg-purple-600 px-2 py-1 text-white hover:bg-purple-700"
                                      aria-label="Archive task"
                                      title="Archive task"
                                    >
                                      <Archive className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteTask(task.id)}
                                      className="inline-flex items-center justify-center rounded bg-red-600 px-2 py-1 text-white hover:bg-red-700"
                                      aria-label="Delete task"
                                      title="Delete task"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => clearTask(task.id)}
                                      className="inline-flex items-center justify-center rounded bg-slate-400 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-500"
                                      title="Clear task fields"
                                      aria-label="Clear task fields"
                                    >
                                      Clr
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setMovingTaskId((current) => (current === task.id ? null : task.id))}
                                      className="inline-flex items-center justify-center rounded bg-amber-600 px-2 py-1 text-xs font-semibold text-white hover:bg-amber-700"
                                      title="Change task category"
                                    >
                                      Move
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedTaskId(task.id)}
                                      className="inline-flex items-center justify-center rounded bg-cyan-700 px-2 py-1 text-white hover:bg-cyan-800"
                                      aria-label="Open task detail drawer"
                                      title="Open task detail drawer"
                                    >
                                      <PanelRightOpen className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => createTaskGoogleCalendarEvent(task)}
                                      disabled={calendarAddingTaskId === task.id}
                                      className={`inline-flex items-center justify-center rounded px-2 py-1 text-white ${
                                        calendarAddedIds.includes(task.id)
                                          ? "bg-green-700 hover:bg-green-800"
                                          : "bg-emerald-700 hover:bg-emerald-800"
                                      } disabled:cursor-wait disabled:opacity-60`}
                                      aria-label="Add task to Google Calendar"
                                      title={calendarAddedIds.includes(task.id) ? "Added to Google Calendar" : "Add task to Google Calendar"}
                                    >
                                      {calendarAddedIds.includes(task.id) ? <Check className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => editTask(task)}
                                      className="inline-flex items-center justify-center rounded bg-slate-700 px-2 py-1 text-white hover:bg-slate-800"
                                      aria-label="Edit task"
                                      title="Edit task"
                                    >
                                      <Edit2 className="h-4 w-4" />
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
                                        {TASK_TYPES.map((categoryType) => (
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
                                <tr className={`${getTaskDetailRowClass(task, isBlocked)} border-b border-slate-200`}>
                                  <td></td>
                                  <td colSpan={5} className="px-2 pb-3">
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
                                    )}

                                    {task.sourceTaskSummary && (
                                      <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-800">Related Source Task</div>
                                        <div className="text-sm font-semibold text-slate-900">{task.sourceTaskName || "Source task"}</div>
                                        <FormattedText value={task.sourceTaskSummary} className="mt-2 whitespace-pre-wrap text-sm text-slate-800" />
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

                                      <div className="flex gap-2">
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
                                          className="self-start rounded bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                                          title="Add follow-up entry"
                                        >
                                          Add Note
                                        </button>
                                      </div>
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

      {isImportOpen && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/50 px-4 py-4 backdrop-blur-sm sm:px-6">
          <div className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Import structured text</h3>
                <p className="text-sm text-slate-600">Paste tasks, parse them, then add the previewed tasks.</p>
              </div>
              <button type="button" onClick={() => setIsImportOpen(false)} title="Close import" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
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
                        {task.deadline && <div className="text-slate-600">Deadline: {task.deadline}</div>}
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
                <p className="text-sm text-slate-600">Only the fields that fit this task type are shown first.</p>
              </div>
              <button type="button" onClick={() => { setForm(createEmptyTask()); setEditingId(null); setShowAdvanced(false); setIsCreateOpen(false); }} title="Close task form" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-3 md:grid-cols-2">
                {renderContactPicker("form")}

                <label className="text-sm font-medium md:col-span-2">
                  Task name
                  <input value={form.taskName} onChange={(event) => updateForm("taskName", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </label>

                <label className="text-sm font-medium">
                  Type
                  <select value={form.type} onChange={(event) => updateForm("type", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    {TASK_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>

                <label className="text-sm font-medium">
                  Blocked by
                  <select value={form.blockedBy} onChange={(event) => updateForm("blockedBy", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Not blocked</option>
                    {tasks.filter((task) => task.id !== editingId).map((task) => <option key={task.id} value={task.id}>{task.taskName}</option>)}
                  </select>
                </label>

                <label className="text-sm font-medium md:col-span-2">
                  Details
                  <textarea
                    value={form.details || ""}
                    onChange={(event) => updateForm("details", event.target.value)}
                    rows={4}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                {visibleFormFields.map((field) => (
                  <label key={field} className="text-sm font-medium">
                    {getFieldLabel(form, field)}
                    <div className="mt-1">{renderInput(field, form[field], (value) => updateForm(field, value))}</div>
                  </label>
                ))}
              </div>

              <button type="button" onClick={() => setShowAdvanced((value) => !value)} title={showAdvanced ? "Hide advanced task fields" : "Show advanced task fields"} className="mt-3 text-sm font-medium text-slate-700 underline">
                {showAdvanced ? "Hide advanced fields" : "Show advanced fields"}
              </button>

              {showAdvanced && (
                <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-2">
                  {Object.keys(DEFAULT_FORM)
                    .filter((field) => !["taskName", "details", "type", "typeOverride", "completed", "id"].includes(field))
                    .filter((field) => !visibleFormFields.includes(field))
                    .map((field) => (
                      <label key={field} className="text-sm font-medium">
                        {getFieldLabel(form, field)}
                        <div className="mt-1">{renderInput(field, form[field], (value) => updateForm(field, value))}</div>
                      </label>
                    ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 px-6 py-4">
              <button type="button" onClick={saveTask} title={editingId ? "Save task changes" : "Add task to the list"} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">{editingId ? "Save changes" : "Add task"}</button>
              <button type="button" onClick={() => { setForm(createEmptyTask()); setEditingId(null); setShowAdvanced(false); setIsCreateOpen(false); }} title="Cancel task editing" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">Cancel</button>
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
              <button type="button" onClick={() => setIsExportOpen(false)} title="Close export" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
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
                  {TASK_TYPES.map((categoryType) => (
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
              <button type="button" onClick={() => setSelectedTaskId(null)} title="Close task detail drawer" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                <X className="h-5 w-5" />
              </button>
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
                    {TASK_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Due Date
                  <input value={selectedTask.deadline || selectedTask.date || ""} onChange={(event) => updateTaskField(selectedTask.id, selectedTask.deadline !== undefined ? "deadline" : "date", event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
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
                  .filter((field) => !["taskName", "details", "type", "typeOverride", "completed", "id"].includes(field))
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

      {isContactsOpen && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/50 px-4 py-4 backdrop-blur-sm sm:px-6">
          <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-black text-slate-900">Manage Contacts</h3>
                <p className="text-sm font-semibold text-slate-600">Add, edit, delete, search, and use saved contacts.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsContactsOpen(false)}
                title="Close contacts"
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[340px_1fr]">
              <div className="overflow-y-auto border-r border-slate-200 px-4 py-5">
                <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-blue-900">
                  {contactApplyTarget === "selectedTask" && selectedTask
                    ? `Use applies to: ${selectedTask.taskName || "selected task"}`
                    : "Use applies to the Add Task form."}
                </div>

                <div className="grid gap-3">
                  <label className="text-sm font-bold text-slate-800">
                    Name
                    <input
                      value={contactForm.name}
                      onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="text-sm font-bold text-slate-800">
                    Category
                    <select
                      value={contactForm.category}
                      onChange={(event) => setContactForm((current) => ({ ...current, category: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      {TASK_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </label>

                  <label className="text-sm font-bold text-slate-800">
                    Phone
                    <input
                      value={contactForm.phone}
                      onChange={(event) => setContactForm((current) => ({ ...current, phone: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="text-sm font-bold text-slate-800">
                    Direct Phone
                    <input
                      value={contactForm.directPhone}
                      onChange={(event) => setContactForm((current) => ({ ...current, directPhone: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="text-sm font-bold text-slate-800">
                    Website
                    <input
                      value={contactForm.website}
                      onChange={(event) => setContactForm((current) => ({ ...current, website: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="text-sm font-bold text-slate-800">
                    Address
                    <AutoResizeTextarea
                      value={contactForm.address}
                      onChange={(value) => setContactForm((current) => ({ ...current, address: value }))}
                      minRows={1}
                      maxRows={6}
                      compactOnChange
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="text-sm font-bold text-slate-800">
                    Organization
                    <input
                      value={contactForm.organization}
                      onChange={(event) => setContactForm((current) => ({ ...current, organization: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="text-sm font-bold text-slate-800">
                    Company
                    <input
                      value={contactForm.company}
                      onChange={(event) => setContactForm((current) => ({ ...current, company: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="text-sm font-bold text-slate-800">
                    Person
                    <input
                      value={contactForm.person}
                      onChange={(event) => setContactForm((current) => ({ ...current, person: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>

                  <label className="text-sm font-bold text-slate-800">
                    Notes
                    <AutoResizeTextarea
                      value={contactForm.notes}
                      onChange={(value) => setContactForm((current) => ({ ...current, notes: value }))}
                      minRows={1}
                      maxRows={8}
                      compactOnChange
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveContact}
                    title={editingContactId ? "Save contact changes" : "Add saved contact"}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
                  >
                    {editingContactId ? "Save Contact" : "Add Contact"}
                  </button>
                  <button
                    type="button"
                    onClick={resetContactForm}
                    title="Clear contact form"
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 flex-col overflow-hidden px-4 py-5">
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <input
                    value={contactSearch}
                    onChange={(event) => setContactSearch(event.target.value)}
                    placeholder="Search contacts..."
                    className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={replaceExistingContactFields}
                      onChange={(event) => setReplaceExistingContactFields(event.target.checked)}
                    />
                    Replace filled fields when using
                  </label>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200">
                  {filteredContacts.length ? (
                    <div className="divide-y divide-slate-200">
                      {filteredContacts.map((contact) => (
                        <div key={contact.id} className="bg-white p-4 hover:bg-slate-50">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-base font-black text-slate-900">{contact.name}</div>
                              <div className="mt-1 text-xs font-black uppercase tracking-wide text-slate-500">{contact.category}</div>
                              <div className="mt-2 grid gap-1 text-sm text-slate-700 md:grid-cols-2">
                                {contact.phone && <div><span className="font-bold">Phone:</span> {contact.phone}</div>}
                                {contact.directPhone && <div><span className="font-bold">Direct:</span> {contact.directPhone}</div>}
                                {contact.website && <div className="truncate"><span className="font-bold">Website:</span> {contact.website}</div>}
                                {contact.organization && <div><span className="font-bold">Organization:</span> {contact.organization}</div>}
                                {contact.company && <div><span className="font-bold">Company:</span> {contact.company}</div>}
                                {contact.person && <div><span className="font-bold">Person:</span> {contact.person}</div>}
                                {contact.address && <div className="whitespace-pre-wrap md:col-span-2"><span className="font-bold">Address:</span> {contact.address}</div>}
                                {contact.notes && <div className="whitespace-pre-wrap md:col-span-2"><span className="font-bold">Notes:</span> {contact.notes}</div>}
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => applyContactToTarget(contact)}
                                title="Use this contact"
                                className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800"
                              >
                                Use
                              </button>
                              <button
                                type="button"
                                onClick={() => editContact(contact)}
                                title="Edit this contact"
                                className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-900"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteContact(contact.id)}
                                title="Delete this contact"
                                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-sm font-semibold text-slate-600">No contacts found.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ArchivedDrawer
        isOpen={isArchiveDrawerOpen}
        onClose={() => setIsArchiveDrawerOpen(false)}
        archivedItems={archivedTasks}
        onRestore={restoreArchivedTask}
        onDelete={deleteArchivedTask}
        archiveType="todo"
        title="To-Do Archives"
      />

      {showPremiumTodoView && <PremiumTodoListView tasks={tasks} onClose={() => setShowPremiumTodoView(false)} />}
    </PageContainer>
  );
}