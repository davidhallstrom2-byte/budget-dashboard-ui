import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CircleDollarSign,
  Download,
  Eye,
  Pencil,
  Plus,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import PageContainer from "../common/PageContainer";
import TabPageHeader from "../common/TabPageHeader.jsx";

const PAYCHECK_STORAGE_KEY = "paychecksTab.paychecks.v1";
const PAYCHECK_UPLOAD_ENDPOINT = "/budget-dashboard-fs/upload-paycheck-file.php";
const PAYCHECK_UPLOAD_LOCALWP_HTTP_ENDPOINT = "http://main-dashboard.local/budget-dashboard-fs/upload-paycheck-file.php";
const PAYCHECK_UPLOAD_LOCALWP_HTTPS_ENDPOINT = "https://main-dashboard.local/budget-dashboard-fs/upload-paycheck-file.php";
const GUARD_CARD_PROOF_SUBMITTED_DATE = "2026-06-22";
const FUTURE_EXPECTED_CSC_RATE = 19.5;
const MAX_PAYCHECK_SCAN_TEXT_LENGTH = 16000;

const DEFAULT_PAYCHECK = {
  id: "",
  employer: "Contemporary Services Corporation",
  employeeName: "",
  checkDate: "",
  payPeriodStart: "",
  payPeriodEnd: "",
  checkNumber: "",
  rate: "",
  hours: "",
  grossPay: "",
  earningsLines: [],
  taxes: "",
  deductions: "",
  netPay: "",
  checkAmount: "",
  expectedRate: "",
  payRateNote: "",
  notes: "",
  scanText: "",
  attachment: null,
  createdAt: "",
  updatedAt: "",
};

const money = (value) => {
  const number = Number(String(value || "").replace(/[$,\s]/g, ""));
  return Number.isFinite(number) ? number : null;
};

const formatMoney = (value) => {
  const number = money(value);
  if (number === null) return "";
  return number.toFixed(2);
};

const formatPaycheckAmount = (value, referenceAmount = "") => {
  const number = money(value);
  if (number === null) return "";

  const reference = money(referenceAmount);
  const rawDigits = String(value || "").replace(/\D/g, "");

  if (
    reference &&
    number > reference &&
    rawDigits.length >= 3 &&
    !String(value || "").includes(".")
  ) {
    return (number / 100).toFixed(2);
  }

  return number.toFixed(2);
};

const formatRate = (value) => {
  const number = money(value);
  if (number === null) return "";

  if (number > 100) {
    return (number / 100).toFixed(2);
  }

  return number.toFixed(2);
};

const calculateHoursFromGrossAndRate = (grossPay, rate) => {
  const gross = money(grossPay);
  const hourlyRate = money(formatRate(rate));

  if (!gross || !hourlyRate) return "";

  return (gross / hourlyRate).toFixed(2);
};

const normalizePaycheckHours = (hours, grossPay, rate) => {
  const cleanHours = formatRate(hours);
  const calculatedHours = calculateHoursFromGrossAndRate(grossPay, rate);

  if (!calculatedHours) return cleanHours;
  if (!cleanHours) return calculatedHours;

  const cleanNumber = money(cleanHours);
  const calculatedNumber = money(calculatedHours);

  if (cleanNumber !== null && calculatedNumber !== null && Math.abs(cleanNumber - calculatedNumber) > 0.25) {
    return calculatedHours;
  }

  return cleanHours;
};

const formatDateForInput = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[1].padStart(2, "0")}-${slashMatch[2].padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";

  return [
    String(parsed.getFullYear()).padStart(4, "0"),
    String(parsed.getMonth() + 1).padStart(2, "0"),
    String(parsed.getDate()).padStart(2, "0"),
  ].join("-");
};

const formatDateForDisplay = (value = "") => {
  const iso = formatDateForInput(value);
  if (!iso) return "";

  const [year, month, day] = iso.split("-");
  return `${month}/${day}/${year}`;
};

const formatCompactDate = (value = "") => {
  const iso = formatDateForInput(value);
  if (!iso) return "";

  const [, year, month, day] = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
  if (!year || !month || !day) return "";

  return `${Number(month)}/${Number(day)}/${String(year).slice(-2)}`;
};

const formatCompactPayPeriod = (startValue = "", endValue = "") => {
  const startIso = formatDateForInput(startValue);
  const endIso = formatDateForInput(endValue);

  if (!startIso && !endIso) return "";
  if (!startIso) return formatCompactDate(endIso);
  if (!endIso) return formatCompactDate(startIso);

  const [startYear, startMonth, startDay] = startIso.split("-");
  const [endYear, endMonth, endDay] = endIso.split("-");
  const startDate = `${Number(startMonth)}/${Number(startDay)}`;
  const endDate = `${Number(endMonth)}/${Number(endDay)}`;
  const endDateWithYear = `${endDate}/${String(endYear).slice(-2)}`;

  if (startYear === endYear) return `${startDate}-${endDate}`;

  return `${startDate}/${String(startYear).slice(-2)}-${endDateWithYear}`;
};

const createId = () => `paycheck-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const safeJsonParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const normalizePaycheckAttachment = (attachment = null) => {
  if (!attachment || typeof attachment !== "object") return null;

  return {
    id: attachment.id || createId(),
    originalName: attachment.originalName || attachment.name || "",
    savedName: attachment.savedName || "",
    url: attachment.url || "",
    viewUrl: attachment.viewUrl || "",
    downloadUrl: attachment.downloadUrl || "",
    mimeType: attachment.mimeType || attachment.type || "",
    size: Number(attachment.size || 0),
    uploadedAt: attachment.uploadedAt || new Date().toISOString(),
  };
};

const normalizeEarningsLine = (line = {}) => ({
  id: line.id || createId(),
  type: String(line.type || "").trim(),
  rate: formatRate(line.rate),
  hours: formatRate(line.hours),
  workLine: String(line.workLine || "").trim(),
  amount: formatMoney(line.amount),
});

const normalizeEarningsLines = (lines = []) =>
  Array.isArray(lines)
    ? lines.map(normalizeEarningsLine).filter((line) => line.type || line.rate || line.hours || line.amount)
    : [];

const sumEarningsLineField = (lines = [], field) =>
  lines.reduce((sum, line) => sum + (money(line[field]) || 0), 0);

const getUniqueEarningsRates = (lines = []) =>
  Array.from(new Set(lines.map((line) => line.rate).filter(Boolean)));

const buildEarningsSummary = (lines = []) =>
  lines
    .map((line) =>
      [
        line.type || "Earnings",
        line.rate ? `$${line.rate}/hr` : "",
        line.hours ? `${line.hours} hrs` : "",
        line.amount ? `$${line.amount}` : "",
      ]
        .filter(Boolean)
        .join(" - ")
    )
    .join("\n");

const getPaycheckRateDisplay = (paycheck = {}) => {
  const uniqueRates = getUniqueEarningsRates(normalizeEarningsLines(paycheck.earningsLines));
  if (uniqueRates.length > 1) return uniqueRates.map((rate) => `$${rate}`).join(" / ");
  if (uniqueRates.length === 1) return `$${uniqueRates[0]}`;
  return `$${paycheck.rate || "0.00"}`;
};

const getPaycheckRateLines = (paycheck = {}) => {
  const earningsLines = normalizeEarningsLines(paycheck.earningsLines);
  if (!earningsLines.length) return [getPaycheckRateDisplay(paycheck)];

  return earningsLines.map((line) =>
    [line.type || "Earnings", line.rate ? `$${line.rate}/hr` : ""].filter(Boolean).join(" ")
  );
};

const getPaycheckHourLines = (paycheck = {}) => {
  const earningsLines = normalizeEarningsLines(paycheck.earningsLines);
  if (!earningsLines.length) return [paycheck.hours || "0.00"];

  return earningsLines.map((line) =>
    [line.hours || "0.00", "hrs", line.amount ? `$${line.amount}` : ""].filter(Boolean).join(" ")
  );
};

const getPaycheckEarningsRows = (paycheck = {}) => {
  const earningsLines = normalizeEarningsLines(paycheck.earningsLines);

  if (earningsLines.length) {
    return earningsLines.map((line) => ({
      id: line.id || createId(),
      type: line.type || "Earnings",
      rate: line.rate || "0.00",
      hours: line.hours || "0.00",
      amount: line.amount || "0.00",
    }));
  }

  return [
    {
      id: `${paycheck.id || createId()}-earnings`,
      type: "Earnings",
      rate: formatRate(paycheck.rate) || "0.00",
      hours: formatRate(paycheck.hours) || "0.00",
      amount: formatMoney(paycheck.grossPay) || "0.00",
    },
  ];
};

const isPaycheckRateWarning = (paycheck = {}) =>
  /below expected|lower pre-guard-card/i.test(paycheck.payRateNote || "");

const getPaycheckNotesDisplay = (paycheck = {}) => {
  const notes = String(paycheck.notes || "").trim();
  const earningsLines = normalizeEarningsLines(paycheck.earningsLines);
  if (!notes || !earningsLines.length) return notes;

  const earningsSummary = buildEarningsSummary(earningsLines).trim();
  if (notes === earningsSummary) return "";

  return notes
    .split("\n")
    .filter((line) => !/^Regular\s+-\s+\$\d/i.test(line) && !/^Overtime\s+-\s+\$\d/i.test(line))
    .join("\n")
    .trim();
};

const normalizePaycheck = (paycheck = {}) => {
  const earningsLines = normalizeEarningsLines(paycheck.earningsLines);
  const earningsHours = earningsLines.length ? sumEarningsLineField(earningsLines, "hours").toFixed(2) : "";
  const earningsGross = earningsLines.length ? sumEarningsLineField(earningsLines, "amount").toFixed(2) : "";
  const uniqueRates = getUniqueEarningsRates(earningsLines);

  const normalized = {
    ...DEFAULT_PAYCHECK,
    ...paycheck,
    id: paycheck.id || createId(),
    checkDate: formatDateForInput(paycheck.checkDate),
    payPeriodStart: formatDateForInput(paycheck.payPeriodStart),
    payPeriodEnd: formatDateForInput(paycheck.payPeriodEnd),
    rate: formatRate(paycheck.rate || uniqueRates[0] || ""),
    grossPay: formatMoney(paycheck.grossPay || earningsGross),
    earningsLines,
    taxes: formatMoney(paycheck.taxes),
    deductions: String(paycheck.deductions || "").trim(),
    netPay: formatMoney(paycheck.netPay),
    checkAmount: formatMoney(paycheck.checkAmount),
    expectedRate: formatRate(paycheck.expectedRate),
    attachment: normalizePaycheckAttachment(paycheck.attachment),
    createdAt: paycheck.createdAt || new Date().toISOString(),
    updatedAt: paycheck.updatedAt || new Date().toISOString(),
  };

  normalized.hours = earningsHours || normalizePaycheckHours(paycheck.hours, normalized.grossPay, normalized.rate);

  return {
    ...normalized,
    payRateNote: buildPayRateNote(normalized),
  };
};

const readStoredPaychecks = () => {
  if (typeof localStorage === "undefined") return [];
  const parsed = safeJsonParse(localStorage.getItem(PAYCHECK_STORAGE_KEY), []);
  return Array.isArray(parsed) ? parsed.map(normalizePaycheck) : [];
};

const writeStoredPaychecks = (paychecks = []) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PAYCHECK_STORAGE_KEY, JSON.stringify(paychecks.map(normalizePaycheck)));
};

const getUploadEndpointCandidates = () => {
  if (typeof window === "undefined") return [PAYCHECK_UPLOAD_ENDPOINT];

  const host = window.location.hostname;
  const isLocalDevHost = host === "localhost" || host === "127.0.0.1";
  const isLocalWpHost = host === "main-dashboard.local";

  if (isLocalWpHost) return [PAYCHECK_UPLOAD_ENDPOINT];

  const localWpCandidates = window.location.protocol === "https:"
    ? [PAYCHECK_UPLOAD_LOCALWP_HTTPS_ENDPOINT, PAYCHECK_UPLOAD_LOCALWP_HTTP_ENDPOINT]
    : [PAYCHECK_UPLOAD_LOCALWP_HTTP_ENDPOINT, PAYCHECK_UPLOAD_LOCALWP_HTTPS_ENDPOINT];

  const candidates = isLocalDevHost
    ? [...localWpCandidates, PAYCHECK_UPLOAD_ENDPOINT]
    : [PAYCHECK_UPLOAD_ENDPOINT];

  return Array.from(new Set(candidates));
};

const resolveUploadEndpoint = () => {
  if (typeof window === "undefined") return PAYCHECK_UPLOAD_ENDPOINT;
  const host = window.location.hostname;
  const isLocalDevHost = host === "localhost" || host === "127.0.0.1";
  const isLocalWpHost = host === "main-dashboard.local";
  if (isLocalWpHost) return PAYCHECK_UPLOAD_ENDPOINT;
  if (!isLocalDevHost) return PAYCHECK_UPLOAD_ENDPOINT;
  return window.location.protocol === "https:" ? PAYCHECK_UPLOAD_LOCALWP_HTTPS_ENDPOINT : PAYCHECK_UPLOAD_LOCALWP_HTTP_ENDPOINT;
};

const resolvePaycheckEndpointUrl = (url = "") => {
  const rawUrl = String(url || "").trim();
  if (!rawUrl) return "";
  if (!rawUrl.startsWith("/budget-dashboard-fs/")) return rawUrl;

  const endpoint = resolveUploadEndpoint();
  try {
    const endpointUrl = new URL(endpoint, window.location.origin);
    return `${endpointUrl.origin}${rawUrl}`;
  } catch {
    return rawUrl;
  }
};

const buildPaycheckFileUrl = (action, attachment = {}) => {
  const endpoint = resolveUploadEndpoint();
  const params = new URLSearchParams({
    action,
    savedName: attachment.savedName || "",
  });

  if (attachment.originalName) params.set("originalName", attachment.originalName);
  return `${endpoint}?${params.toString()}`;
};

const getAttachmentViewUrl = (attachment = {}) => {
  if (attachment.viewUrl) return resolvePaycheckEndpointUrl(attachment.viewUrl);
  if (attachment.savedName) return buildPaycheckFileUrl("view", attachment);
  return resolvePaycheckEndpointUrl(attachment.url);
};

const getAttachmentDownloadUrl = (attachment = {}) => {
  if (attachment.downloadUrl) return resolvePaycheckEndpointUrl(attachment.downloadUrl);
  if (attachment.savedName) return buildPaycheckFileUrl("download", attachment);
  return resolvePaycheckEndpointUrl(attachment.url);
};

const buildPayRateNote = (paycheck = {}) => {
  const earningsLines = normalizeEarningsLines(paycheck.earningsLines);
  const rates = earningsLines.length
    ? earningsLines.map((line) => money(line.rate)).filter((rate) => rate !== null)
    : [money(paycheck.rate)].filter((rate) => rate !== null);
  const lowestRate = rates.length ? Math.min(...rates) : null;
  const checkDate = formatDateForInput(paycheck.checkDate);

  if (!lowestRate) return paycheck.payRateNote || "";

  if (checkDate && checkDate >= GUARD_CARD_PROOF_SUBMITTED_DATE && lowestRate < FUTURE_EXPECTED_CSC_RATE) {
    return `Rate below expected $${FUTURE_EXPECTED_CSC_RATE.toFixed(2)}/hr after guard card proof submitted on 06/22/2026. Verify payroll if this was paid after the new rate should apply.`;
  }

  if (lowestRate < FUTURE_EXPECTED_CSC_RATE) {
    return "Lower pre-guard-card payroll rate. Guard card proof was submitted on 06/22/2026. Future CSC pay should be $19.50/hr.";
  }

  return "Rate meets expected post-guard-card CSC rate.";
};

const cleanScanText = (value = "") =>
  String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const limitScanText = (value = "") => {
  const text = cleanScanText(value);
  if (text.length <= MAX_PAYCHECK_SCAN_TEXT_LENGTH) return text;
  return `${text.slice(0, MAX_PAYCHECK_SCAN_TEXT_LENGTH).trim()}\n\n[Scan text truncated to ${MAX_PAYCHECK_SCAN_TEXT_LENGTH.toLocaleString()} characters.]`;
};

const findDateAfterLabel = (text, labelPattern) => {
  const regex = new RegExp(`${labelPattern}\\s*:?\\s*([A-Za-z]+\\s+\\d{1,2},\\s*\\d{4}|\\d{1,2}/\\d{1,2}/\\d{4})`, "i");
  const match = text.match(regex);
  return match ? formatDateForInput(match[1]) : "";
};

const findMoneyAfterLabel = (text, labelPattern) => {
  const regex = new RegExp(`${labelPattern}\\s*:?\\s*\\$?\\s*(\\d[\\d,]*(?:\\.\\d{2})?)`, "i");
  const match = text.match(regex);
  return match ? formatMoney(match[1]) : "";
};

const findNumberAfterLabel = (text, labelPattern) => {
  const regex = new RegExp(`${labelPattern}\\s*:?\\s*(\\d+(?:\\.\\d+)?)`, "i");
  const match = text.match(regex);
  return match ? formatRate(match[1]) : "";
};

const parseEarningsLines = (flatText = "") => {
  const earningsLines = [];
  const earningsRegex = /\b(Regular|Overtime)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9-]+)?\s+(\d+(?:\.\d{2}))/gi;
  let match = earningsRegex.exec(flatText);

  while (match) {
    earningsLines.push(
      normalizeEarningsLine({
        type: match[1],
        rate: match[2],
        hours: match[3],
        workLine: match[4] || "",
        amount: match[5],
      })
    );
    match = earningsRegex.exec(flatText);
  }

  return earningsLines;
};

const parsePaycheckScanText = (rawText = "") => {
  const text = limitScanText(rawText);
  const flat = text.replace(/\n/g, " ");
  const parsed = { ...DEFAULT_PAYCHECK, scanText: text };

  if (/contemporary services corporation|csc/i.test(text)) {
    parsed.employer = "Contemporary Services Corporation";
  }

  const employeeMatch = text.match(/\bDAVID\s+G\s+HALLSTROM\b|\bDAVID\s+HALLSTROM\s+II\b/i);
  if (employeeMatch) parsed.employeeName = employeeMatch[0].replace(/\s+/g, " ").trim();

  parsed.checkDate = findDateAfterLabel(flat, "Check Date");
  parsed.payPeriodStart = findDateAfterLabel(flat, "Period Beginning");
  parsed.payPeriodEnd = findDateAfterLabel(flat, "Period Ending");

  const checkNumberMatch = flat.match(/Check Number\s*:?\s*(\d{5,})/i);
  if (checkNumberMatch) parsed.checkNumber = checkNumberMatch[1];

  const netPayMatch = flat.match(/Net Pay\s*:?\s*\$?\s*(\d[\d,]*(?:\.\d{2})?)/i);
  if (netPayMatch) parsed.netPay = formatMoney(netPayMatch[1]);

  const checkAmountMatch = flat.match(/Check Amount\s*:?\s*\$?\s*(\d[\d,]*(?:\.\d{2})?)/i);
  if (checkAmountMatch) parsed.checkAmount = formatMoney(checkAmountMatch[1]);

  const grossMatch = flat.match(/Gross Earnings\s*:?\s*(?:\d+(?:\.\d+)?)?\s*\$?\s*(\d[\d,]*(?:\.\d{2})?)/i);
  if (grossMatch) parsed.grossPay = formatMoney(grossMatch[1]);

  const earningsLines = parseEarningsLines(flat);
  if (earningsLines.length) {
    parsed.earningsLines = earningsLines;
    parsed.rate = earningsLines[0].rate;
    parsed.hours = sumEarningsLineField(earningsLines, "hours").toFixed(2);
    parsed.grossPay = parsed.grossPay || sumEarningsLineField(earningsLines, "amount").toFixed(2);
  }

  parsed.hours = parsed.hours || findNumberAfterLabel(flat, "Total Hours Worked");
  parsed.grossPay = parsed.grossPay || findMoneyAfterLabel(flat, "Gross");

  const taxTotalMatch = flat.match(/Taxes\s+(\d+(?:\.\d{2})?)\s+(\d+(?:\.\d{2})?)/i);
  if (taxTotalMatch) parsed.taxes = formatPaycheckAmount(taxTotalMatch[1], parsed.grossPay);

  if (/No Deductions/i.test(text)) {
    parsed.deductions = "No deductions";
  }

  if (!parsed.rate && parsed.grossPay && parsed.hours) {
    const gross = money(parsed.grossPay);
    const hours = money(parsed.hours);
    if (gross && hours) parsed.rate = formatRate(gross / hours);
  }

  parsed.netPay = parsed.netPay || parsed.checkAmount;
  parsed.checkAmount = parsed.checkAmount || parsed.netPay;
  parsed.expectedRate = parsed.checkDate && parsed.checkDate >= GUARD_CARD_PROOF_SUBMITTED_DATE ? "19.50" : "18.50";
  parsed.payRateNote = buildPayRateNote(parsed);

  return normalizePaycheck(parsed);
};

function loadScriptOnce(src, globalName) {
  return new Promise((resolve, reject) => {
    if (globalName && window[globalName]) {
      resolve(window[globalName]);
      return;
    }

    const existing = document.querySelector(`script[data-paycheck-scan-src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(globalName ? window[globalName] : true), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.paycheckScanSrc = src;
    script.onload = () => resolve(globalName ? window[globalName] : true);
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsArrayBuffer(file);
  });
}

async function getTesseract() {
  return loadScriptOnce("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js", "Tesseract");
}

async function getPdfJs() {
  const pdfjsLib = await loadScriptOnce("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js", "pdfjsLib");
  if (pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }
  return pdfjsLib;
}

async function ocrImageDataUrl(dataUrl) {
  const Tesseract = await getTesseract();
  const result = await Tesseract.recognize(dataUrl, "eng");
  return result?.data?.text || "";
}

async function ocrPdfFile(file) {
  const [pdfjsLib, arrayBuffer] = await Promise.all([getPdfJs(), readFileAsArrayBuffer(file)]);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
    pageTexts.push(await ocrImageDataUrl(canvas.toDataURL("image/png")));
  }

  return pageTexts.join("\n\n");
}

const extractTextFromFile = async (file) => {
  const name = file.name || "";
  const type = file.type || "";

  if (type.startsWith("text/") || /\.(txt|csv)$/i.test(name)) {
    return file.text();
  }

  if (type === "application/pdf" || /\.pdf$/i.test(name)) {
    return ocrPdfFile(file);
  }

  if (type.startsWith("image/") || /\.(png|jpe?g|webp|heic)$/i.test(name)) {
    return ocrImageDataUrl(await readFileAsDataUrl(file));
  }

  return "";
};

export default function PaychecksTab() {
  const [paychecks, setPaychecks] = useState(readStoredPaychecks);
  const [form, setForm] = useState(() => normalizePaycheck({ id: createId(), expectedRate: "19.50" }));
  const [editingId, setEditingId] = useState("");
  const [scanText, setScanText] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const [scanError, setScanError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const totals = useMemo(() => {
    return paychecks.reduce(
      (sum, item) => ({
        grossPay: sum.grossPay + (money(item.grossPay) || 0),
        taxes: sum.taxes + (money(item.taxes) || 0),
        netPay: sum.netPay + (money(item.netPay) || 0),
        hours: sum.hours + (money(item.hours) || 0),
      }),
      { grossPay: 0, taxes: 0, netPay: 0, hours: 0 }
    );
  }, [paychecks]);

  const updatePaychecks = (updater) => {
    setPaychecks((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      const normalized = next.map(normalizePaycheck).sort((a, b) => String(b.checkDate).localeCompare(String(a.checkDate)));
      writeStoredPaychecks(normalized);
      window.dispatchEvent(new Event("paychecksChanged"));
      return normalized;
    });
  };

  const updateForm = (field, value) => {
    setForm((current) => normalizePaycheck({ ...current, [field]: value, updatedAt: new Date().toISOString() }));
  };

  const updatePaycheckNotes = (paycheckId, value) => {
    updatePaychecks((current) =>
      current.map((item) =>
        item.id === paycheckId
          ? { ...item, notes: value, updatedAt: new Date().toISOString() }
          : item
      )
    );
  };

  const resetForm = () => {
    setForm(normalizePaycheck({ id: createId(), expectedRate: "19.50" }));
    setEditingId("");
    setScanText("");
    setScanStatus("");
    setScanError("");
    setUploadStatus("");
    setUploadError("");
  };

  const uploadPaycheckFile = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("paycheckId", form.id || createId());
    formData.append("checkDate", form.checkDate || "");

    let lastError = null;
    const triedEndpoints = [];

    for (const endpoint of getUploadEndpointCandidates()) {
      triedEndpoints.push(endpoint);
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || `Upload failed at ${endpoint}`);
        }

        return normalizePaycheckAttachment(payload.file || payload);
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(
      [
        lastError?.message || "Could not upload paycheck file.",
        "Confirm upload-paycheck-file.php is saved in C:\\Users\\david\\Local Sites\\main-dashboard\\app\\public\\budget-dashboard-fs.",
        `Tried: ${triedEndpoints.join(", ")}`,
      ].join(" ")
    );
  };

  const deletePaycheckFile = async (attachment) => {
    if (!attachment?.savedName) return;

    const formData = new FormData();
    formData.append("action", "delete");
    formData.append("savedName", attachment.savedName);

    let lastError = null;

    for (const endpoint of getUploadEndpointCandidates()) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || `Delete failed at ${endpoint}`);
        }

        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("Could not delete paycheck file.");
  };

  const handleScanFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsScanning(true);
    setScanStatus("");
    setScanError("");
    setUploadStatus("");
    setUploadError("");

    try {
      const [attachment, extractedText] = await Promise.all([
        uploadPaycheckFile(file),
        extractTextFromFile(file).catch(() => ""),
      ]);

      const parsed = parsePaycheckScanText(extractedText);
      const next = normalizePaycheck({
        ...form,
        ...Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== "" && value !== null)),
        id: form.id || parsed.id || createId(),
        attachment,
        scanText: extractedText,
        fileName: file.name,
      });

      setForm(next);
      setScanText(limitScanText(extractedText));
      setScanStatus(extractedText ? "Paycheck scanned. Review fields before saving." : "File uploaded. OCR did not find readable text, so enter pay fields manually.");
      setUploadStatus(`${file.name} saved locally.`);
    } catch (error) {
      setScanError(error?.message || "Could not scan paycheck.");
    } finally {
      setIsScanning(false);
    }
  };

  const applyEditedScanText = () => {
    const parsed = parsePaycheckScanText(scanText);
    setForm((current) =>
      normalizePaycheck({
        ...current,
        ...Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== "" && value !== null)),
        id: current.id || parsed.id || createId(),
        attachment: current.attachment,
        scanText,
      })
    );
    setScanStatus("Edited scan text applied. Review fields before saving.");
  };

  const savePaycheck = () => {
    const normalized = normalizePaycheck({
      ...form,
      id: editingId || form.id || createId(),
      updatedAt: new Date().toISOString(),
    });

    updatePaychecks((current) => {
      if (editingId) {
        return current.map((item) => (item.id === editingId ? normalized : item));
      }

      return [normalized, ...current];
    });

    resetForm();
  };

  const editPaycheck = (paycheck) => {
    setForm(normalizePaycheck(paycheck));
    setEditingId(paycheck.id);
    setScanText(paycheck.scanText || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removePaycheck = async (paycheck) => {
    if (!window.confirm(`Delete paycheck ${paycheck.checkNumber || paycheck.checkDate || ""}?`)) return;

    if (paycheck.attachment && window.confirm("Also delete the saved paycheck file from local storage?")) {
      try {
        await deletePaycheckFile(paycheck.attachment);
      } catch (error) {
        setUploadError(error?.message || "Could not delete saved paycheck file.");
      }
    }

    updatePaychecks((current) => current.filter((item) => item.id !== paycheck.id));
  };

  const removeAttachmentFromForm = async () => {
    if (!form.attachment) return;
    if (!window.confirm(`Remove ${form.attachment.originalName || "this paycheck file"}?`)) return;

    try {
      await deletePaycheckFile(form.attachment);
    } catch (error) {
      const removeLinkOnly = window.confirm(`${error?.message || "Could not delete the local file."} Remove the link anyway?`);
      if (!removeLinkOnly) return;
    }

    setForm((current) => normalizePaycheck({ ...current, attachment: null }));
  };

  const downloadAttachment = async (attachment) => {
    const url = getAttachmentDownloadUrl(attachment);
    if (!url) return;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed.");

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.originalName || attachment.savedName || "paycheck";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const renderTextInput = (field, label, type = "text") => (
    <label className="text-sm font-semibold text-slate-700">
      {label}
      <input
        type={type}
        value={form[field] || ""}
        onChange={(event) => updateForm(field, event.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
      />
    </label>
  );

  return (
    <PageContainer surfaceClassName="min-h-screen bg-teal-50" className="flex flex-col gap-6 bg-teal-50 py-6">
      <TabPageHeader
        icon={CircleDollarSign}
        title="Paychecks"
        subtitle="Scan paycheck stubs, preserve the original file, and track rates, hours, gross pay, taxes, and net pay."
        theme="teal"
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Paycheck totals">
        <div className="rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-cyan-700">Hours</p>
          <p className="mt-1 text-3xl font-black text-slate-950">{totals.hours.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-blue-700">Gross</p>
          <p className="mt-1 text-3xl font-black text-slate-950">${totals.grossPay.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-amber-700">Taxes</p>
          <p className="mt-1 text-3xl font-black text-slate-950">${totals.taxes.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Net</p>
          <p className="mt-1 text-3xl font-black text-slate-950">${totals.netPay.toFixed(2)}</p>
        </div>
      </section>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-wide text-blue-950">
          <ScanLine className="h-4 w-4" />
          Scan Paycheck
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm font-semibold text-blue-950 md:col-span-2">
            Paycheck PDF or image
            <input
              type="file"
              accept="image/*,application/pdf,.pdf,.txt,.csv"
              onChange={handleScanFile}
              disabled={isScanning}
              className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-700 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-blue-800 disabled:cursor-wait disabled:opacity-60"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={applyEditedScanText}
              disabled={!scanText.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <Check className="h-4 w-4" />
              Apply Scan Text
            </button>
          </div>
        </div>

        {isScanning && <div className="mt-3 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-900">Scanning paycheck and saving file...</div>}
        {scanStatus && <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-bold text-green-900">{scanStatus}</div>}
        {uploadStatus && <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-bold text-green-900">{uploadStatus}</div>}
        {scanError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-900">{scanError}</div>}
        {uploadError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-900">{uploadError}</div>}

        <label className="mt-3 block text-sm font-semibold text-blue-950">
          Extracted scan text
          <textarea
            value={scanText}
            onChange={(event) => setScanText(event.target.value)}
            rows={5}
            placeholder="OCR text appears here. You can edit it, then click Apply Scan Text."
            className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-base font-black text-slate-900">{editingId ? "Edit Paycheck" : "Add Paycheck"}</h3>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {renderTextInput("employer", "Employer")}
          {renderTextInput("employeeName", "Employee")}
          {renderTextInput("checkDate", "Check Date", "date")}
          {renderTextInput("checkNumber", "Check Number")}
          {renderTextInput("payPeriodStart", "Pay Period Start", "date")}
          {renderTextInput("payPeriodEnd", "Pay Period End", "date")}
          {renderTextInput("rate", "Rate")}
          {renderTextInput("expectedRate", "Expected Rate")}
          {renderTextInput("hours", "Hours")}
          {renderTextInput("grossPay", "Gross Pay")}
          {renderTextInput("taxes", "Taxes")}
          {renderTextInput("deductions", "Deductions")}
          {renderTextInput("netPay", "Net Pay")}
          {renderTextInput("checkAmount", "Check Amount")}

          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Pay Rate Note
            <textarea
              value={form.payRateNote || ""}
              onChange={(event) => updateForm("payRateNote", event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700 md:col-span-2">
            Notes
            <textarea
              value={form.notes || ""}
              onChange={(event) => updateForm("notes", event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>

        {form.earningsLines?.length > 0 && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-2 text-sm font-black text-slate-900">Earnings Lines</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="py-1 pr-3 text-left font-bold">Type</th>
                    <th className="py-1 px-3 text-right font-bold">Rate</th>
                    <th className="py-1 px-3 text-right font-bold">Hours</th>
                    <th className="py-1 px-3 text-left font-bold">WorkLine</th>
                    <th className="py-1 pl-3 text-right font-bold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {form.earningsLines.map((line) => (
                    <tr key={line.id} className="border-t border-slate-200">
                      <td className="py-1 pr-3 font-semibold text-slate-900">{line.type}</td>
                      <td className="py-1 px-3 text-right text-slate-700">${line.rate || "0.00"}</td>
                      <td className="py-1 px-3 text-right text-slate-700">{line.hours || "0.00"}</td>
                      <td className="py-1 px-3 text-slate-700">{line.workLine}</td>
                      <td className="py-1 pl-3 text-right font-semibold text-slate-900">${line.amount || "0.00"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {form.attachment && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-slate-900">{form.attachment.originalName || form.attachment.savedName}</div>
                <div className="text-xs text-slate-500">Saved paycheck file</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.open(getAttachmentViewUrl(form.attachment), "_blank", "noopener,noreferrer")}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800"
                >
                  <Eye className="h-4 w-4" />
                  View
                </button>
                <button
                  type="button"
                  onClick={() => downloadAttachment(form.attachment)}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={removeAttachmentFromForm}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-800"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={savePaycheck}
            className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800"
          >
            <Plus className="h-4 w-4" />
            {editingId ? "Save Paycheck" : "Add Paycheck"}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[880px] table-fixed text-sm">
          <colgroup>
            <col className="w-[76px]" />
            <col className="w-[58px]" />
            <col className="w-[290px]" />
            <col className="w-[58px]" />
            <col className="w-[54px]" />
            <col className="w-[62px]" />
            <col />
            <col className="w-[144px]" />
          </colgroup>
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-1.5 py-2 text-left font-bold">Date / Period</th>
              <th className="px-1.5 py-2 text-left font-bold">Check #</th>
              <th className="px-2 py-2 text-left font-bold">Earnings</th>
              <th className="px-1.5 py-2 text-right font-bold">Gross</th>
              <th className="px-1.5 py-2 text-right font-bold">Taxes</th>
              <th className="px-1.5 py-2 text-right font-bold">Net</th>
              <th className="px-2 py-2 text-left font-bold">Notes</th>
              <th className="px-2.5 py-2 text-left font-bold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paychecks.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                  No paychecks saved yet.
                </td>
              </tr>
            ) : (
              paychecks.map((paycheck) => {
                const hasRateWarning = isPaycheckRateWarning(paycheck);
                const earningsRows = getPaycheckEarningsRows(paycheck);

                return (
                  <tr key={paycheck.id} className="border-t border-slate-200 align-top">
                    <td className="px-1.5 py-2 text-slate-900">
                      <div className="leading-tight">
                        <div className="font-black tabular-nums">{formatCompactDate(paycheck.checkDate)}</div>
                        {paycheck.payPeriodStart || paycheck.payPeriodEnd ? (
                          <div className="mt-0.5 whitespace-nowrap text-sm font-semibold text-slate-500">
                            {formatCompactPayPeriod(paycheck.payPeriodStart, paycheck.payPeriodEnd)}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-1.5 py-2 text-slate-700 tabular-nums">{paycheck.checkNumber}</td>
                    <td className="px-2 py-2">
                      <div className="space-y-0.5">
                        {earningsRows.map((line, index) => {
                          const lineRate = money(line.rate);
                          const isLowRateLine = hasRateWarning && lineRate !== null && lineRate < FUTURE_EXPECTED_CSC_RATE;

                          return (
                            <div
                              key={`${paycheck.id}-earnings-${line.id || index}`}
                              className={`grid grid-cols-[68px_72px_50px_66px] items-center gap-1 rounded px-1.5 py-1 text-sm leading-tight ${
                                isLowRateLine ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-700"
                              }`}
                            >
                              <span className={`truncate font-black ${isLowRateLine ? "text-amber-800" : "text-slate-950"}`}>
                                {line.type || "Earnings"}
                              </span>
                              <span className="text-right font-bold">${line.rate || "0.00"}/hr</span>
                              <span className="text-right">{line.hours || "0.00"}h</span>
                              <span className="text-right font-bold">${line.amount || "0.00"}</span>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-1.5 py-2 text-right text-slate-700 tabular-nums">${paycheck.grossPay || "0.00"}</td>
                    <td className="px-1.5 py-2 text-right text-slate-700 tabular-nums">${paycheck.taxes || "0.00"}</td>
                    <td className="px-1.5 py-2 text-right font-bold text-green-700 tabular-nums">${paycheck.netPay || "0.00"}</td>
                    <td className="px-2 py-2">
                      <div className="space-y-1">
                        {hasRateWarning ? (
                          <div title={paycheck.payRateNote} className="inline-flex max-w-full items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-1 text-xs font-bold leading-tight text-amber-900">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">Rate warning</span>
                          </div>
                        ) : null}
                        <textarea
                          value={paycheck.notes || ""}
                          onChange={(event) => updatePaycheckNotes(paycheck.id, event.target.value)}
                          rows={earningsRows.length > 3 ? 3 : 2}
                          placeholder="Add notes..."
                          className="min-h-[42px] w-full resize-y rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm leading-snug text-slate-700 shadow-inner placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </td>
                    <td className="px-2.5 py-2.5">
                      <div className="grid w-fit grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => editPaycheck(paycheck)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-700 text-white hover:bg-blue-800"
                          title="Edit paycheck"
                          aria-label="Edit paycheck"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {paycheck.attachment ? (
                          <button
                            type="button"
                            onClick={() => window.open(getAttachmentViewUrl(paycheck.attachment), "_blank", "noopener,noreferrer")}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-white hover:bg-slate-800"
                            title="View paycheck file"
                            aria-label="View paycheck file"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        ) : null}
                        {paycheck.attachment ? (
                          <button
                            type="button"
                            onClick={() => downloadAttachment(paycheck.attachment)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-slate-700 text-white hover:bg-slate-800"
                            title="Download paycheck file"
                            aria-label="Download paycheck file"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removePaycheck(paycheck)}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-red-700 text-white hover:bg-red-800"
                          title="Delete paycheck"
                          aria-label="Delete paycheck"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}
