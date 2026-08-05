import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Download,
  Eye,
  Pencil,
  Plus,
  Printer,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import PageContainer from "../common/PageContainer";
import TabPageHeader from "../common/TabPageHeader.jsx";

const PAYCHECK_STORAGE_KEY = "paychecksTab.paychecks.v1";
const CSC_SHIFT_STORAGE_KEY = "cscShifts.v1";
const CSC_SHIFT_ARCHIVE_STORAGE_KEY = "cscShifts.archived.v1";
const PAYCHECK_UPLOAD_ENDPOINT = "/budget-dashboard-fs/upload-paycheck-file.php";
const PAYCHECK_UPLOAD_LOCALWP_HTTP_ENDPOINT = "http://main-dashboard.local/budget-dashboard-fs/upload-paycheck-file.php";
const PAYCHECK_UPLOAD_LOCALWP_HTTPS_ENDPOINT = "https://main-dashboard.local/budget-dashboard-fs/upload-paycheck-file.php";
// Browser file previews use the LocalWP endpoint directly so navigation keeps its filename query.
const MAX_PAYCHECK_SCAN_TEXT_LENGTH = 16000;
const CSC_PAY_RATE_SCHEDULE = [
  {
    effectiveFrom: "0000-01-01",
    effectiveThrough: "2026-06-21",
    regularRate: 18.04,
  },
  {
    effectiveFrom: "2026-06-22",
    effectiveThrough: "9999-12-31",
    regularRate: 19.5,
  },
];
const KNOWN_PAYCHECK_ATTACHMENT_RECOVERY = {
  "7333153": {
    id: "file-recovered-check-7333153",
    originalName: "C7339495---Regular.pdf",
    savedName: "2026-07-04_paycheck-1783130562234-205fd3e31aae1_195cf38f.pdf",
    mimeType: "application/pdf",
    uploadedAt: "2026-07-04T00:00:00.000Z",
  },
};
const VERIFIED_CSC_PAYSTUB_EARNINGS = {
  "7333153": [
    { id: "7333153-1", type: "Regular", rate: "18.04", hours: "8.00", workLine: "00136817700530", workDate: "2026-05-30", amount: "144.32" },
  ],
  "7335104": [
    { id: "7335104-1", type: "Regular", rate: "18.04", hours: "8.00", workLine: "00136929170612", workDate: "2026-06-12", amount: "144.32" },
    { id: "7335104-2", type: "Overtime", rate: "27.06", hours: "3.50", workLine: "00136929170612", workDate: "2026-06-12", amount: "94.71" },
    { id: "7335104-3", type: "Regular", rate: "18.04", hours: "6.50", workLine: "00136976220611", workDate: "2026-06-11", amount: "117.26" },
    { id: "7335104-4", type: "Regular", rate: "18.04", hours: "4.00", workLine: "00137066960609", workDate: "2026-06-09", amount: "72.16" },
  ],
  "7337371": [
    { id: "7337371-1", type: "Regular", rate: "18.04", hours: "8.00", workLine: "00136929620615", workDate: "2026-06-15", amount: "144.32" },
    { id: "7337371-2", type: "Overtime", rate: "27.06", hours: "2.75", workLine: "00136929620615", workDate: "2026-06-15", amount: "74.42" },
  ],
  "7339495": [
    { id: "7339495-1", type: "Regular", rate: "18.04", hours: "8.00", workLine: "00136929850621", workDate: "2026-06-21", amount: "144.32" },
    { id: "7339495-2", type: "Overtime", rate: "27.06", hours: "1.75", workLine: "00136929850621", workDate: "2026-06-21", amount: "47.36" },
    { id: "7339495-3", type: "Regular", rate: "19.50", hours: "8.00", workLine: "00136929860625", workDate: "2026-06-25", amount: "156.00" },
    { id: "7339495-4", type: "Overtime", rate: "29.25", hours: "3.25", workLine: "00136929860625", workDate: "2026-06-25", amount: "95.06" },
  ],
  "7341625": [
    { id: "7341625-1", type: "Regular", rate: "19.50", hours: "7.00", workLine: "00136563340629", workDate: "2026-06-29", amount: "136.50" },
    { id: "7341625-2", type: "Overtime", rate: "29.25", hours: "2.50", workLine: "00136929870628", workDate: "2026-06-28", amount: "73.13" },
    { id: "7341625-3", type: "Regular", rate: "19.50", hours: "8.00", workLine: "00136929870628", workDate: "2026-06-28", amount: "156.00" },
    { id: "7341625-4", type: "Regular", rate: "19.50", hours: "8.00", workLine: "00136929880702", workDate: "2026-07-02", amount: "156.00" },
    { id: "7341625-5", type: "Overtime", rate: "29.25", hours: "1.25", workLine: "00136929880702", workDate: "2026-07-02", amount: "36.56" },
  ],
  "7343608": [
    { id: "7343608-1", type: "Regular", rate: "19.50", hours: "5.75", workLine: "00136860490708", workDate: "2026-07-08", amount: "112.13" },
    { id: "7343608-2", type: "Overtime", rate: "29.25", hours: "1.00", workLine: "00136929890710", workDate: "2026-07-10", amount: "29.25" },
    { id: "7343608-3", type: "Regular", rate: "19.50", hours: "8.00", workLine: "00136929890710", workDate: "2026-07-10", amount: "156.00" },
    { id: "7343608-4", type: "Regular", rate: "19.50", hours: "6.00", workLine: "00137016880707", workDate: "2026-07-07", amount: "117.00" },
    { id: "7343608-5", type: "Overtime", rate: "29.25", hours: "6.00", workLine: "00137037930704", workDate: "2026-07-04", amount: "175.50" },
  ],
  "7346705": [
    { id: "7346705-1", type: "Regular", rate: "19.50", hours: "6.00", workLine: "00136588480718", workDate: "2026-07-18", amount: "117.00" },
    { id: "7346705-2", type: "CA Break Premium", rate: "19.50", hours: "1.00", workLine: "00136588480718", workDate: "2026-07-18", amount: "19.50" },
  ],
};

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
  paylocityDetails: {
    federalIncomeTaxCurrent: "",
    federalIncomeTaxYtd: "",
    socialSecurityCurrent: "",
    socialSecurityYtd: "",
    medicareCurrent: "",
    medicareYtd: "",
    californiaIncomeTaxCurrent: "",
    californiaIncomeTaxYtd: "",
    californiaSdiCurrent: "",
    californiaSdiYtd: "",
    deductionsCurrent: "",
    deductionsYtd: "",
    grossPayYtd: "",
    netPayYtd: "",
    sickHoursAvailable: "",
    federalFilingStatus: "",
    stateFilingStatus: "",
  },
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

const formatOptionalMoney = (value) => {
  if (String(value ?? "").trim() === "") return "";
  return formatMoney(value);
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

  const slashMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (slashMatch) {
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
    return `${year}-${slashMatch[1].padStart(2, "0")}-${slashMatch[2].padStart(2, "0")}`;
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

const shiftIsoDate = (value = "", days = 0) => {
  const iso = formatDateForInput(value);
  if (!iso) return "";

  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const formatCompactPayPeriod = (startValue = "", endValue = "") => {
  let startIso = formatDateForInput(startValue);
  let endIso = formatDateForInput(endValue);

  if (!startIso && !endIso) return "";
  if (!startIso) startIso = shiftIsoDate(endIso, -6);
  if (!endIso) endIso = shiftIsoDate(startIso, 6);

  const [startYear, startMonth, startDay] = startIso.split("-");
  const [endYear, endMonth, endDay] = endIso.split("-");
  const startDate = `${Number(startMonth)}/${Number(startDay)}`;
  const endDate = `${Number(endMonth)}/${Number(endDay)}`;
  const endDateWithYear = `${endDate}/${String(endYear).slice(-2)}`;

  if (startYear === endYear) return `${startDate}-${endDate}`;

  return `${startDate}/${String(startYear).slice(-2)}-${endDateWithYear}`;
};

const resolvePayPeriodRange = (startValue = "", endValue = "") => {
  let startDate = formatDateForInput(startValue);
  let endDate = formatDateForInput(endValue);

  if (!startDate && !endDate) return null;
  if (!startDate) startDate = shiftIsoDate(endDate, -6);
  if (!endDate) endDate = shiftIsoDate(startDate, 6);

  return {
    startDate,
    endDate,
    label: `${formatCompactDate(startDate)} - ${formatCompactDate(endDate)}`,
  };
};

const readStoredCscShiftArray = (storageKey) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeCscShiftStatus = (value = "") => {
  const status = String(value || "").trim();

  if (["Done", "Paid", "Complete", "Completed"].includes(status)) return "Done";
  if (status === "Cancelled") return "Cancelled";
  return "Scheduled";
};

const formatCscShiftDate = (value = "") => {
  const iso = formatDateForInput(value);
  if (!iso) return "";

  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatCscShiftTime = (value = "") => {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return "";

  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

const formatCscCurrency = (value) =>
  (Number(value) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

const getCscShiftHours = (shift = {}) => {
  const start = new Date(`${shift.startDate}T${shift.startTime}:00`);
  const finish = new Date(`${shift.finishDate || shift.startDate}T${shift.finishTime}:00`);
  const difference = finish.getTime() - start.getTime();

  if (!Number.isFinite(difference) || difference <= 0) return 0;
  return Math.round((difference / (1000 * 60 * 60)) * 100) / 100;
};

const getCscShiftEstimatedPay = (shift = {}) => {
  if (normalizeCscShiftStatus(shift.shiftStatus) === "Cancelled") return 0;

  const parsedRate = Number.parseFloat(shift.hourlyRate);
  const hourlyRate =
    Number.isFinite(parsedRate) && parsedRate > 0 && ![15.5, 20.5].includes(parsedRate)
      ? parsedRate
      : 19.5;
  const hours = getCscShiftHours(shift);
  const regularHours = Math.min(hours, 8);
  const overtimeHours = Math.min(Math.max(hours - 8, 0), 4);
  const doubleTimeHours = Math.max(hours - 12, 0);

  return Math.round(
    (regularHours * hourlyRate +
      overtimeHours * hourlyRate * 1.5 +
      doubleTimeHours * hourlyRate * 2) *
      100
  ) / 100;
};

const deriveCscUniform = (shift = {}) => {
  if (shift.uniform) return shift.uniform;

  const roleName = String(shift.roleName || "").toLowerCase();
  const venue = String(shift.venue || "").toLowerCase();

  if (/\bc\s*&\s*t\b|coat\s*(?:and|&)\s*tie/.test(roleName)) return "Coat & Tie";
  if (roleName.includes("security")) {
    return venue.includes("rose bowl") || venue.includes("hollywood bowl")
      ? "All black / white shirt"
      : "All black uniform";
  }

  return "Not entered";
};

const normalizeCscShiftIdentityText = (value = "") =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const shouldShowDistinctCscJobName = (shift = {}) => {
  const jobName = normalizeCscShiftIdentityText(shift.jobName);
  const eventName = normalizeCscShiftIdentityText(shift.event);
  return Boolean(jobName) && (!eventName || jobName !== eventName);
};

const buildWorkedPayPeriodSummary = (paycheck = {}) => {
  const range = resolvePayPeriodRange(paycheck.payPeriodStart, paycheck.payPeriodEnd);
  if (!range) return null;

  const shiftsById = new Map();
  readStoredCscShiftArray(CSC_SHIFT_STORAGE_KEY).forEach((shift, index) => {
    const id = String(shift?.id || `active-${index}`);
    shiftsById.set(id, { ...shift, id, recordSource: "active" });
  });
  readStoredCscShiftArray(CSC_SHIFT_ARCHIVE_STORAGE_KEY).forEach((shift, index) => {
    const id = String(shift?.id || `archived-${index}`);
    shiftsById.set(id, { ...shift, id, recordSource: "archived" });
  });

  const payableShifts = Array.from(shiftsById.values())
    .filter((shift) => {
      const shiftDate = formatDateForInput(shift.startDate);
      return (
        shiftDate &&
        shiftDate >= range.startDate &&
        shiftDate <= range.endDate &&
        normalizeCscShiftStatus(shift.shiftStatus) !== "Cancelled"
      );
    })
    .sort((first, second) =>
      `${first.startDate}T${first.startTime}`.localeCompare(`${second.startDate}T${second.startTime}`)
    );
  const workedShifts = payableShifts.filter(
    (shift) => normalizeCscShiftStatus(shift.shiftStatus) === "Done"
  );

  return {
    ...range,
    paycheckId: paycheck.id,
    checkNumber: paycheck.checkNumber || "",
    shiftCount: payableShifts.length,
    workedShiftCount: workedShifts.length,
    workedHours: workedShifts.reduce((sum, shift) => sum + getCscShiftHours(shift), 0),
    earnedPay: workedShifts.reduce((sum, shift) => sum + getCscShiftEstimatedPay(shift), 0),
    workedShifts,
  };
};

const formatEarningsTypeLabel = (value = "Earnings") =>
  `${String(value || "Earnings").trim().replace(/:+$/, "")}:`;

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

  const source =
    (Array.isArray(attachment) ? attachment[0] : null) ||
    attachment.file ||
    attachment.attachment ||
    attachment.uploaded?.[0] ||
    attachment.data?.file ||
    attachment;

  if (!source || typeof source !== "object") return null;

  const url =
    source.url ||
    source.fileUrl ||
    source.file_url ||
    "";
  const viewUrl =
    source.viewUrl ||
    source.view_url ||
    source.previewUrl ||
    source.preview_url ||
    "";
  const downloadUrl =
    source.downloadUrl ||
    source.download_url ||
    "";

  const findUrlParameter = (names = []) => {
    for (const candidate of [viewUrl, downloadUrl, url]) {
      if (!candidate) continue;
      try {
        const parsedUrl = new URL(candidate, "https://main-dashboard.local");
        for (const name of names) {
          const value = parsedUrl.searchParams.get(name);
          if (value) return value;
        }
      } catch {
        // Ignore malformed legacy URLs and continue through the other fields.
      }
    }
    return "";
  };

  const savedName =
    source.savedName ||
    source.saved_name ||
    source.saved_file_name ||
    source.storageName ||
    source.storage_name ||
    findUrlParameter(["savedName", "saved_name", "saved_file_name"]);
  const originalName =
    source.originalName ||
    source.original_name ||
    source.original_file_name ||
    source.fileName ||
    source.file_name ||
    source.name ||
    findUrlParameter(["originalName", "original_name", "original_file_name"]);

  if (!savedName && !originalName && !url && !viewUrl && !downloadUrl) return null;

  return {
    id: source.id || source.fileId || source.file_id || createId(),
    originalName,
    savedName,
    url,
    viewUrl,
    downloadUrl,
    mimeType: source.mimeType || source.mime_type || source.type || "",
    size: Number(source.size || source.fileSize || source.file_size || 0),
    uploadedAt:
      source.uploadedAt ||
      source.uploaded_at ||
      source.createdAt ||
      source.created_at ||
      new Date().toISOString(),
  };
};

const getStoredPaycheckAttachment = (paycheck = {}) => {
  const nestedAttachment = normalizePaycheckAttachment(
    paycheck.attachment ||
    paycheck.paycheckFile ||
    paycheck.savedFile ||
    paycheck.fileAttachment
  );

  if (nestedAttachment?.savedName) return nestedAttachment;

  const rootAttachment = normalizePaycheckAttachment({
    id: paycheck.fileId || paycheck.file_id,
    originalName:
      paycheck.originalName ||
      paycheck.original_name ||
      paycheck.original_file_name ||
      paycheck.fileName ||
      paycheck.file_name,
    savedName:
      paycheck.savedName ||
      paycheck.saved_name ||
      paycheck.saved_file_name ||
      paycheck.storageName ||
      paycheck.storage_name,
    url: paycheck.fileUrl || paycheck.file_url,
    viewUrl: paycheck.viewUrl || paycheck.view_url,
    downloadUrl: paycheck.downloadUrl || paycheck.download_url,
    mimeType: paycheck.mimeType || paycheck.mime_type,
    size: paycheck.fileSize || paycheck.file_size,
    uploadedAt: paycheck.uploadedAt || paycheck.uploaded_at,
  });

  if (rootAttachment?.savedName) return rootAttachment;

  const checkNumber = String(paycheck.checkNumber || "").trim();
  const recoveredAttachment = normalizePaycheckAttachment(
    KNOWN_PAYCHECK_ATTACHMENT_RECOVERY[checkNumber]
  );

  return recoveredAttachment || nestedAttachment || rootAttachment;
};

const normalizeEarningsLine = (line = {}) => ({
  id: line.id || createId(),
  type: String(line.type || "").trim(),
  rate: formatRate(line.rate),
  hours: formatRate(line.hours),
  workLine: String(line.workLine || "").trim(),
  workDate: formatDateForInput(line.workDate),
  amount: formatMoney(line.amount),
});

const normalizeEarningsLines = (lines = []) =>
  Array.isArray(lines)
    ? lines.map(normalizeEarningsLine).filter((line) => line.type || line.rate || line.hours || line.amount)
    : [];

const isBreakPremiumEarningsLine = (line = {}) =>
  /\b(?:CA\s+)?Break\s+Pre(?:mium)?\b/i.test(String(line.type || ""));

const getWorkedEarningsHours = (lines = []) =>
  normalizeEarningsLines(lines).reduce(
    (sum, line) => sum + (isBreakPremiumEarningsLine(line) ? 0 : money(line.hours) || 0),
    0
  );

const formatWorkLineDate = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";

  const buildDate = (yearValue, monthValue, dayValue) => {
    const year = Number(yearValue);
    const month = Number(monthValue);
    const day = Number(dayValue);
    const date = new Date(year, month - 1, day);

    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return "";
    }

    return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`;
  };

  const yearFirst = text.match(
    /(?:^|\D)(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})(?=\D|$)/
  );
  if (yearFirst) return buildDate(yearFirst[1], yearFirst[2], yearFirst[3]);

  const monthFirst = text.match(
    /(?:^|\D)(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})(?=\D|$)/
  );
  if (monthFirst) return buildDate(monthFirst[3], monthFirst[1], monthFirst[2]);

  const shortYear = text.match(
    /(?:^|\D)(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})(?=\D|$)/
  );
  if (shortYear) return buildDate(`20${shortYear[3]}`, shortYear[1], shortYear[2]);

  const compactYearFirst = text.match(
    /(?:^|\D)(20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(?=\D|$)/
  );
  if (compactYearFirst) {
    return buildDate(compactYearFirst[1], compactYearFirst[2], compactYearFirst[3]);
  }

  const compactMonthFirst = text.match(
    /(?:^|\D)(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(20\d{2})(?=\D|$)/
  );
  if (compactMonthFirst) {
    return buildDate(compactMonthFirst[3], compactMonthFirst[1], compactMonthFirst[2]);
  }

  return "";
};

const getWorkLineDates = (lines = []) =>
  Array.from(
    new Set(
      normalizeEarningsLines(lines)
        .map((line) => formatWorkLineDate(line.workLine))
        .filter(Boolean)
    )
  );

const getWorkLineIsoDate = (lineOrValue = "", paycheck = {}) => {
  const line =
    lineOrValue && typeof lineOrValue === "object"
      ? lineOrValue
      : { workLine: lineOrValue };
  const savedWorkDate = formatDateForInput(line.workDate);
  if (savedWorkDate) return savedWorkDate;

  const displayDate = formatWorkLineDate(line.workLine);
  if (displayDate) return formatDateForInput(displayDate);

  const compactMonthDay = String(line.workLine || "").match(
    /(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/
  );
  if (!compactMonthDay) return "";

  const periodStart = formatDateForInput(paycheck.payPeriodStart);
  const periodEnd = formatDateForInput(paycheck.payPeriodEnd);
  const checkDate = formatDateForInput(paycheck.checkDate);
  const years = Array.from(
    new Set(
      [periodStart, periodEnd, checkDate]
        .filter(Boolean)
        .map((date) => date.slice(0, 4))
    )
  );

  for (const year of years) {
    const candidate = `${year}-${compactMonthDay[1]}-${compactMonthDay[2]}`;
    if ((!periodStart || candidate >= periodStart) && (!periodEnd || candidate <= periodEnd)) {
      return candidate;
    }
  }

  return years.length
    ? `${years[years.length - 1]}-${compactMonthDay[1]}-${compactMonthDay[2]}`
    : "";
};

const getEarningsLineWorkDateDisplay = (line = {}, paycheck = {}) => {
  const isoDate = getWorkLineIsoDate(line, paycheck);
  if (!isoDate) return "";

  const [year, month, day] = isoDate.split("-");
  return `${month}/${day}/${String(year).slice(-2)}`;
};

const getCscRegularRateForDate = (value = "") => {
  const isoDate = formatDateForInput(value);
  if (!isoDate) return null;

  const schedule = CSC_PAY_RATE_SCHEDULE.find(
    (entry) => isoDate >= entry.effectiveFrom && isoDate <= entry.effectiveThrough
  );

  return schedule?.regularRate ?? null;
};

const getExpectedCscRateForEarningsLine = (line = {}, paycheck = {}) => {
  const regularRate = getCscRegularRateForDate(getWorkLineIsoDate(line, paycheck));
  if (regularRate === null) return null;

  const type = String(line.type || "").trim();
  if (/\bOvertime\b/i.test(type)) return regularRate * 1.5;
  if (/\bDouble\s*Time\b/i.test(type)) return regularRate * 2;
  return regularRate;
};

const getAllowedCscRatesForEarningsLine = (line = {}, paycheck = {}) => {
  const expectedRate = getExpectedCscRateForEarningsLine(line, paycheck);
  if (expectedRate === null) return [];

  return [expectedRate];
};

const normalizePaylocityDetails = (details = {}) => {
  const source = details && typeof details === "object" ? details : {};
  const moneyFields = [
    "federalIncomeTaxCurrent",
    "federalIncomeTaxYtd",
    "socialSecurityCurrent",
    "socialSecurityYtd",
    "medicareCurrent",
    "medicareYtd",
    "californiaIncomeTaxCurrent",
    "californiaIncomeTaxYtd",
    "californiaSdiCurrent",
    "californiaSdiYtd",
    "deductionsCurrent",
    "deductionsYtd",
    "grossPayYtd",
    "netPayYtd",
  ];

  return {
    ...DEFAULT_PAYCHECK.paylocityDetails,
    ...source,
    ...Object.fromEntries(
      moneyFields.map((field) => [field, formatOptionalMoney(source[field])])
    ),
    sickHoursAvailable:
      String(source.sickHoursAvailable ?? "").trim() === ""
        ? ""
        : formatRate(source.sickHoursAvailable),
    federalFilingStatus: String(source.federalFilingStatus || "").trim(),
    stateFilingStatus: String(source.stateFilingStatus || "").trim(),
  };
};

const sumEarningsLineField = (lines = [], field) =>
  lines.reduce((sum, line) => sum + (money(line[field]) || 0), 0);

const getUniqueEarningsRates = (lines = []) =>
  Array.from(new Set(lines.map((line) => line.rate).filter(Boolean)));

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
      dateWorked: getEarningsLineWorkDateDisplay(line, paycheck),
    }));
  }

  return [
    {
      id: `${paycheck.id || createId()}-earnings`,
      type: "Earnings",
      rate: formatRate(paycheck.rate) || "0.00",
      hours: formatRate(paycheck.hours) || "0.00",
      amount: formatMoney(paycheck.grossPay) || "0.00",
      dateWorked: "",
    },
  ];
};

const normalizePaycheck = (paycheck = {}) => {
  const storedEarningsLines = normalizeEarningsLines(paycheck.earningsLines);
  const scannedEarningsLines = paycheck.scanText
    ? parseEarningsLines(String(paycheck.scanText).replace(/\n/g, " "))
    : [];
  const verifiedEarningsLines = normalizeEarningsLines(
    VERIFIED_CSC_PAYSTUB_EARNINGS[String(paycheck.checkNumber || "").trim()] || []
  );
  const selectedEarningsLines =
    verifiedEarningsLines.length
      ? verifiedEarningsLines
      : scannedEarningsLines.length > storedEarningsLines.length
      ? scannedEarningsLines
      : storedEarningsLines;
  const earningsLines = selectedEarningsLines.map((line) =>
    normalizeEarningsLine({
      ...line,
      workDate: getWorkLineIsoDate(line, paycheck),
    })
  );
  const earningsHours = earningsLines.length ? getWorkedEarningsHours(earningsLines).toFixed(2) : "";
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
    netPay: formatMoney(paycheck.netPay || paycheck.checkAmount),
    paylocityDetails: normalizePaylocityDetails(paycheck.paylocityDetails),
    attachment: getStoredPaycheckAttachment(paycheck),
    createdAt: paycheck.createdAt || new Date().toISOString(),
    updatedAt: paycheck.updatedAt || new Date().toISOString(),
  };

  normalized.hours = earningsLines.length
    ? earningsHours
    : normalizePaycheckHours(paycheck.hours, normalized.grossPay, normalized.rate);

  delete normalized.checkAmount;
  delete normalized.expectedRate;
  delete normalized.payRateNote;

  return normalized;
};

const readStoredPaychecks = () => {
  if (typeof localStorage === "undefined") return [];
  const parsed = safeJsonParse(localStorage.getItem(PAYCHECK_STORAGE_KEY), []);
  if (!Array.isArray(parsed)) return [];

  const normalized = parsed.map(normalizePaycheck);

  try {
    localStorage.setItem(PAYCHECK_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Keep the paycheck screen usable if browser storage is temporarily unavailable.
  }

  return normalized;
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
    ? [PAYCHECK_UPLOAD_ENDPOINT, ...localWpCandidates]
    : [PAYCHECK_UPLOAD_ENDPOINT];

  return Array.from(new Set(candidates));
};

const optionalNumber = (value) => {
  if (String(value ?? "").trim() === "") return null;
  return money(value);
};

const amountsMatch = (first, second, tolerance = 0.02) =>
  first !== null && second !== null && Math.abs(first - second) <= tolerance;

const getPaylocityTaxRows = (paycheck = {}) => {
  const details = normalizePaylocityDetails(paycheck.paylocityDetails);
  return [
    ["Federal income tax", details.federalIncomeTaxCurrent, details.federalIncomeTaxYtd],
    ["Social Security", details.socialSecurityCurrent, details.socialSecurityYtd],
    ["Medicare", details.medicareCurrent, details.medicareYtd],
    ["California income tax", details.californiaIncomeTaxCurrent, details.californiaIncomeTaxYtd],
    ["California SDI", details.californiaSdiCurrent, details.californiaSdiYtd],
  ]
    .filter(([, current, ytd]) => current !== "" || ytd !== "")
    .map(([label, current, ytd]) => ({ label, current, ytd }));
};

const getCurrentDeductionAmount = (paycheck = {}) => {
  const details = normalizePaylocityDetails(paycheck.paylocityDetails);
  const detailedAmount = optionalNumber(details.deductionsCurrent);
  if (detailedAmount !== null) return detailedAmount;

  const raw = String(paycheck.deductions || "").trim();
  if (!raw || /no deductions|none/i.test(raw)) return 0;
  if (/^\$?[\d,]+(?:\.\d{1,2})?$/.test(raw)) return money(raw);
  return null;
};

const getPaycheckReconciliation = (paycheck = {}) => {
  const earningsLines = normalizeEarningsLines(paycheck.earningsLines);
  const checks = [];

  if (earningsLines.length) {
    const earningsGross = sumEarningsLineField(earningsLines, "amount");
    const statedGross = optionalNumber(paycheck.grossPay);
    checks.push({
      id: "gross",
      label: "Earnings equal gross pay",
      actual: earningsGross,
      expected: statedGross,
      passed: amountsMatch(earningsGross, statedGross),
      detail: `$${earningsGross.toFixed(2)} earnings, $${(statedGross || 0).toFixed(2)} gross`,
    });

    const earningsHours = getWorkedEarningsHours(earningsLines);
    const statedHours = optionalNumber(paycheck.hours);
    checks.push({
      id: "hours",
      label: "Worked earnings hours equal total hours",
      actual: earningsHours,
      expected: statedHours,
      passed: amountsMatch(earningsHours, statedHours),
      detail: `${earningsHours.toFixed(2)} worked hours, ${(statedHours || 0).toFixed(2)} total hours`,
    });

    earningsLines.forEach((line, index) => {
      const actualRate = optionalNumber(line.rate);
      const allowedRates = getAllowedCscRatesForEarningsLine(line, paycheck);
      const dateWorked = getEarningsLineWorkDateDisplay(line, paycheck);

      if (actualRate !== null && allowedRates.length) {
        checks.push({
          id: `rate-${index}`,
          label: `${line.type || "Earnings"} rate matches work date`,
          actual: actualRate,
          expected: allowedRates[0],
          passed: allowedRates.some((rate) => amountsMatch(actualRate, rate, 0.01)),
          detail: `$${actualRate.toFixed(2)} actual, ${allowedRates
            .map((rate) => `$${rate.toFixed(2)}`)
            .join(" or ")} expected${dateWorked ? ` for ${dateWorked}` : ""}`,
        });
      }

      const lineHours = optionalNumber(line.hours);
      const lineAmount = optionalNumber(line.amount);
      if (actualRate !== null && lineHours !== null && lineAmount !== null) {
        const calculatedAmount = actualRate * lineHours;
        checks.push({
          id: `earnings-amount-${index}`,
          label: `${line.type || "Earnings"} rate times hours equals amount`,
          actual: calculatedAmount,
          expected: lineAmount,
          passed: amountsMatch(calculatedAmount, lineAmount),
          detail: `$${calculatedAmount.toFixed(2)} calculated, $${lineAmount.toFixed(2)} paid`,
        });
      }
    });
  }

  const gross = optionalNumber(paycheck.grossPay);
  const taxes = optionalNumber(paycheck.taxes);
  const deductions = getCurrentDeductionAmount(paycheck);
  const net = optionalNumber(paycheck.netPay);

  if (gross !== null && gross > 0 && taxes !== null && deductions !== null && net !== null) {
    const calculatedNet = gross - taxes - deductions;
    checks.push({
      id: "net",
      label: "Gross minus taxes and deductions equals net pay",
      actual: calculatedNet,
      expected: net,
      passed: amountsMatch(calculatedNet, net),
      detail: `$${calculatedNet.toFixed(2)} calculated, $${net.toFixed(2)} net`,
    });
  }

  const failedChecks = checks.filter((check) => !check.passed);
  return {
    checks,
    failedChecks,
    status: !checks.length ? "unavailable" : failedChecks.length ? "warning" : "verified",
  };
};

const hasPaylocityDetails = (paycheck = {}) => {
  const details = normalizePaylocityDetails(paycheck.paylocityDetails);
  return (
    getPaylocityTaxRows(paycheck).length > 0 ||
    [
      details.deductionsCurrent,
      details.deductionsYtd,
      details.grossPayYtd,
      details.netPayYtd,
      details.sickHoursAvailable,
      details.federalFilingStatus,
      details.stateFilingStatus,
    ].some((value) => String(value || "").trim())
  );
};

const cleanScanText = (value = "") =>
  String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const sanitizePaycheckScanText = (value = "") =>
  cleanScanText(value)
    .split("\n")
    .filter((line) => {
      const text = line.trim();
      if (!text) return true;
      if (/\b(?:bank\s+account|account\s+number|routing\s+number|micr)\b/i.test(text)) return false;
      if (/^[\s⑆⑇⑈<>|:]*\d{8,}[\s⑆⑇⑈<>|:]+\d{4,}/.test(text)) return false;
      if (/^\d{2,6}\s+\S.+\b(?:street|st|avenue|ave|boulevard|blvd|road|rd|drive|dr|lane|ln|court|ct|place|pl)\b/i.test(text)) return false;
      if (/^[A-Za-z .'-]+,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?$/i.test(text)) return false;
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const limitScanText = (value = "") => {
  const text = sanitizePaycheckScanText(value);
  if (text.length <= MAX_PAYCHECK_SCAN_TEXT_LENGTH) return text;
  return `${text.slice(0, MAX_PAYCHECK_SCAN_TEXT_LENGTH).trim()}\n\n[Scan text truncated to ${MAX_PAYCHECK_SCAN_TEXT_LENGTH.toLocaleString()} characters.]`;
};

const PAYCHECK_SCAN_DATE_PATTERN =
  "(?:[A-Za-z]{3,9}\\s+\\d{1,2},\\s*\\d{4}|\\d{1,2}[\\/-]\\d{1,2}[\\/-](?:\\d{4}|\\d{2}))";

const findDateAfterLabel = (text, labelPattern) => {
  const regex = new RegExp(`${labelPattern}\\s*:?\\s*(${PAYCHECK_SCAN_DATE_PATTERN})`, "i");
  const match = text.match(regex);
  return match ? formatDateForInput(match[1]) : "";
};

const findPayPeriodDates = (text = "") => {
  const directStart = findDateAfterLabel(
    text,
    "(?:Pay\\s+)?Period\\s+(?:Beginning|Begin|Start|From)"
  );
  const directEnd = findDateAfterLabel(
    text,
    "(?:Pay\\s+)?Period\\s+(?:Ending|End|Through|Thru|To)"
  );

  if (directStart && directEnd) {
    return { startDate: directStart, endDate: directEnd };
  }

  const rangePatterns = [
    new RegExp(
      `(?:Pay\\s+)?Period(?:\\s+Dates?)?\\s*:?\\s*(${PAYCHECK_SCAN_DATE_PATTERN})\\s*(?:-|–|—|to|through|thru)\\s*(${PAYCHECK_SCAN_DATE_PATTERN})`,
      "i"
    ),
    new RegExp(
      `Period\\s+(?:Beginning|Begin|Start)\\s+Period\\s+(?:Ending|End)(?:\\s+Check\\s+Date)?\\s+(${PAYCHECK_SCAN_DATE_PATTERN})\\s+(${PAYCHECK_SCAN_DATE_PATTERN})`,
      "i"
    ),
  ];

  for (const pattern of rangePatterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const startDate = formatDateForInput(match[1]);
    const endDate = formatDateForInput(match[2]);
    if (startDate && endDate) return { startDate, endDate };
  }

  return { startDate: directStart, endDate: directEnd };
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

const findCurrentYtdPair = (text, labelPattern) => {
  const regex = new RegExp(
    `${labelPattern}\\s*:?\\s*\\$?\\s*(\\d[\\d,]*\\.\\d{2})\\s+\\$?\\s*(\\d[\\d,]*\\.\\d{2})`,
    "i"
  );
  const match = text.match(regex);
  return match
    ? { current: formatMoney(match[1]), ytd: formatMoney(match[2]) }
    : { current: "", ytd: "" };
};

const findGrossCurrentYtd = (text) => {
  const match = text.match(
    /Gross Earnings\s*:?\s*(?:\d+(?:\.\d+)?\s+)?\$?\s*(\d[\d,]*\.\d{2})\s+\$?\s*(\d[\d,]*\.\d{2})/i
  );
  return match
    ? { current: formatMoney(match[1]), ytd: formatMoney(match[2]) }
    : { current: "", ytd: "" };
};

const findSickHoursAvailable = (text = "") => {
  const line = text
    .split("\n")
    .map((value) => value.trim())
    .find((value) => /sick/i.test(value) && /available|balance/i.test(value));
  if (!line) return "";

  const values = line.match(/\d+(?:\.\d+)?/g) || [];
  return values.length ? formatRate(values[values.length - 1]) : "";
};

const findFilingStatus = (text, jurisdiction) => {
  const regex = new RegExp(
    `${jurisdiction}\\s+(?:tax\\s+)?filing\\s+status\\s*:?\\s*([^\\n|]{1,60})`,
    "i"
  );
  const match = text.match(regex);
  if (!match) return "";
  return match[1]
    .replace(/\s{2,}.*$/, "")
    .replace(/\b(State|Federal)\s+(?:tax\s+)?filing\s+status.*$/i, "")
    .trim();
};

const parsePaylocityDetails = (text = "", flatText = "") => {
  const federalIncomeTax = findCurrentYtdPair(
    flatText,
    "(?:Federal Income Tax|Federal Withholding|FITW)"
  );
  const socialSecurity = findCurrentYtdPair(
    flatText,
    "(?:Social Security|OASDI)"
  );
  const medicare = findCurrentYtdPair(flatText, "Medicare");
  const californiaIncomeTax = findCurrentYtdPair(
    flatText,
    "(?:California Income Tax|California Withholding|CA Withholding|CAS)"
  );
  const californiaSdi = findCurrentYtdPair(
    flatText,
    "(?:California SDI|CA SDI|CASDI)"
  );
  const deductionTotals = findCurrentYtdPair(
    flatText,
    "(?:Total Deductions|Deductions Total)"
  );
  const grossTotals = findGrossCurrentYtd(flatText);
  const netTotals = findCurrentYtdPair(flatText, "Net Pay");

  return normalizePaylocityDetails({
    federalIncomeTaxCurrent: federalIncomeTax.current,
    federalIncomeTaxYtd: federalIncomeTax.ytd,
    socialSecurityCurrent: socialSecurity.current,
    socialSecurityYtd: socialSecurity.ytd,
    medicareCurrent: medicare.current,
    medicareYtd: medicare.ytd,
    californiaIncomeTaxCurrent: californiaIncomeTax.current,
    californiaIncomeTaxYtd: californiaIncomeTax.ytd,
    californiaSdiCurrent: californiaSdi.current,
    californiaSdiYtd: californiaSdi.ytd,
    deductionsCurrent: deductionTotals.current,
    deductionsYtd: deductionTotals.ytd,
    grossPayYtd: grossTotals.ytd,
    netPayYtd: netTotals.ytd,
    sickHoursAvailable: findSickHoursAvailable(text),
    federalFilingStatus: findFilingStatus(text, "Federal"),
    stateFilingStatus: findFilingStatus(text, "(?:State|California)"),
  });
};

const parseEarningsLines = (flatText = "") => {
  const earningsLines = [];
  const earningsRegex = /\b(Regular|Overtime|Double\s*Time|CA\s+Break\s+Pre(?:mium)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+([A-Za-z0-9-]+)?\s+(\d+(?:\.\d{2}))/gi;
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
  const reportedHours = findNumberAfterLabel(flat, "Total Hours Worked");

  if (/contemporary services corporation|csc/i.test(text)) {
    parsed.employer = "Contemporary Services Corporation";
  }

  const employeeMatch = text.match(/\bDAVID\s+G\s+HALLSTROM\b|\bDAVID\s+HALLSTROM\s+II\b/i);
  if (employeeMatch) parsed.employeeName = employeeMatch[0].replace(/\s+/g, " ").trim();

  parsed.checkDate = findDateAfterLabel(flat, "Check Date");
  const scannedPayPeriod = findPayPeriodDates(flat);
  parsed.payPeriodStart = scannedPayPeriod.startDate;
  parsed.payPeriodEnd = scannedPayPeriod.endDate;

  const checkNumberMatch = flat.match(/Check Number\s*:?\s*(\d{5,})/i);
  if (checkNumberMatch) parsed.checkNumber = checkNumberMatch[1];

  const netPayMatch = flat.match(/Net Pay\s*:?\s*\$?\s*(\d[\d,]*(?:\.\d{2})?)/i);
  if (netPayMatch) parsed.netPay = formatMoney(netPayMatch[1]);

  const checkAmountMatch = flat.match(/Check Amount\s*:?\s*\$?\s*(\d[\d,]*(?:\.\d{2})?)/i);
  if (checkAmountMatch && !parsed.netPay) parsed.netPay = formatMoney(checkAmountMatch[1]);

  const grossMatch = flat.match(/Gross Earnings\s*:?\s*(?:\d+(?:\.\d+)?)?\s*\$?\s*(\d[\d,]*(?:\.\d{2})?)/i);
  if (grossMatch) parsed.grossPay = formatMoney(grossMatch[1]);

  const earningsLines = parseEarningsLines(flat);
  if (earningsLines.length) {
    parsed.earningsLines = earningsLines;
    parsed.rate = earningsLines[0].rate;
    parsed.hours = reportedHours || getWorkedEarningsHours(earningsLines).toFixed(2);
    parsed.grossPay = parsed.grossPay || sumEarningsLineField(earningsLines, "amount").toFixed(2);
  }

  parsed.hours = parsed.hours || reportedHours;
  parsed.grossPay = parsed.grossPay || findMoneyAfterLabel(flat, "Gross");

  const taxTotalMatch = flat.match(/Taxes\s+(\d+(?:\.\d{2})?)\s+(\d+(?:\.\d{2})?)/i);
  if (taxTotalMatch) parsed.taxes = formatPaycheckAmount(taxTotalMatch[1], parsed.grossPay);

  parsed.paylocityDetails = parsePaylocityDetails(text, flat);
  const scannedTaxTotal = getPaylocityTaxRows(parsed).reduce(
    (sum, row) => sum + (optionalNumber(row.current) || 0),
    0
  );
  if (!parsed.taxes && scannedTaxTotal > 0) {
    parsed.taxes = scannedTaxTotal.toFixed(2);
  }

  if (
    !parsed.grossPay &&
    parsed.paylocityDetails.grossPayYtd
  ) {
    const grossTotals = findGrossCurrentYtd(flat);
    parsed.grossPay = grossTotals.current;
  }

  if (/No Deductions/i.test(text)) {
    parsed.deductions = "No deductions";
    parsed.paylocityDetails.deductionsCurrent = "0.00";
  }

  if (!parsed.rate && parsed.grossPay && parsed.hours) {
    const gross = money(parsed.grossPay);
    const hours = money(parsed.hours);
    if (gross && hours) parsed.rate = formatRate(gross / hours);
  }

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
  const [form, setForm] = useState(() => normalizePaycheck({ id: createId() }));
  const [editingId, setEditingId] = useState("");
  const [scanText, setScanText] = useState("");
  const [scanStatus, setScanStatus] = useState("");
  const [scanError, setScanError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [isScanSectionOpen, setIsScanSectionOpen] = useState(false);
  const [isPaycheckFormOpen, setIsPaycheckFormOpen] = useState(false);
  const [selectedWorkedPayPeriod, setSelectedWorkedPayPeriod] = useState(null);

  useEffect(() => {
    if (!selectedWorkedPayPeriod) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSelectedWorkedPayPeriod(null);
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedWorkedPayPeriod]);

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

  const duplicateCheckNumbers = useMemo(() => {
    const counts = new Map();
    paychecks.forEach((paycheck) => {
      const checkNumber = String(paycheck.checkNumber || "").trim();
      if (!checkNumber) return;
      counts.set(checkNumber, (counts.get(checkNumber) || 0) + 1);
    });
    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([checkNumber]) => checkNumber)
    );
  }, [paychecks]);

  const duplicatePaycheckMatches = useMemo(() => {
    const checkNumber = String(form.checkNumber || "").trim();
    if (!checkNumber) return [];
    return paychecks.filter(
      (paycheck) =>
        paycheck.id !== editingId &&
        String(paycheck.checkNumber || "").trim() === checkNumber
    );
  }, [editingId, form.checkNumber, paychecks]);

  const formHasDuplicateCheckNumber = duplicatePaycheckMatches.length > 0;

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

  const resetForm = () => {
    setForm(normalizePaycheck({ id: createId() }));
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
          credentials: "include",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.ok) {
          throw new Error(payload?.error || `Upload failed at ${endpoint}`);
        }

        const attachment = normalizePaycheckAttachment(
          payload.file ||
          payload.attachment ||
          payload.uploaded?.[0] ||
          payload
        );

        if (!attachment?.savedName) {
          throw new Error("The upload succeeded, but the server filename was missing.");
        }

        return attachment;
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
    const normalizedAttachment = normalizePaycheckAttachment(attachment);
    if (!normalizedAttachment?.savedName) return;

    const formData = new FormData();
    formData.append("action", "delete");
    formData.append("savedName", normalizedAttachment.savedName);
    formData.append("saved_name", normalizedAttachment.savedName);
    formData.append("saved_file_name", normalizedAttachment.savedName);

    let lastError = null;

    for (const endpoint of getUploadEndpointCandidates()) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body: formData,
          credentials: "include",
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
        scanText: limitScanText(extractedText),
        fileName: file.name,
      });

      setForm(next);
      setScanText(limitScanText(extractedText));
      const matchingPaycheck = next.checkNumber
        ? paychecks.find(
            (paycheck) =>
              paycheck.id !== editingId &&
              String(paycheck.checkNumber || "").trim() ===
              String(next.checkNumber || "").trim()
          )
        : null;

      if (matchingPaycheck) {
        setScanStatus(
          `Check #${next.checkNumber} is already saved. Use Attach to Existing Check below to restore its file without creating a duplicate.`
        );
      } else {
        setScanStatus(
          extractedText
            ? "Paycheck scanned. Review fields before saving."
            : "File uploaded. OCR did not find readable text, so enter pay fields manually."
        );
      }
      setUploadStatus(`${file.name} saved locally.`);
      setIsPaycheckFormOpen(true);
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
        scanText: limitScanText(scanText),
      })
    );
    setScanError("");
    setScanStatus(
      "Edited scan text applied. The paycheck file remains saved. Open Add Paycheck to review the populated fields."
    );
  };

  const savePaycheck = () => {
    if (!editingId && formHasDuplicateCheckNumber) {
      setScanError(
        form.attachment
          ? `Check #${form.checkNumber} is already saved. Use Attach to Existing Check instead.`
          : `Check #${form.checkNumber} is already saved. Edit the existing check instead of creating a duplicate.`
      );
      setIsPaycheckFormOpen(true);
      return;
    }

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

  const attachScannedFileToExistingPaycheck = (paycheckId) => {
    const matchingPaycheck = paychecks.find(
      (paycheck) => paycheck.id === paycheckId
    );

    if (!matchingPaycheck) {
      setScanError("The existing paycheck could not be found. Refresh the page and scan the file again.");
      return;
    }

    if (!form.attachment) {
      setScanError("Scan the original paycheck file before attaching it to the existing check.");
      return;
    }

    const attachment = normalizePaycheckAttachment(form.attachment);
    if (!attachment?.savedName) {
      setScanError(
        "The paycheck file was uploaded without a server filename, so it was not attached. Select the file again and retry."
      );
      return;
    }

    const attachmentName =
      attachment?.originalName || attachment?.savedName || "Paycheck file";

    updatePaychecks((current) =>
      current.map((paycheck) =>
        paycheck.id === paycheckId
          ? normalizePaycheck({
              ...paycheck,
              attachment,
              fileName: form.fileName || paycheck.fileName || attachmentName,
              updatedAt: new Date().toISOString(),
            })
          : paycheck
      )
    );

    setForm(normalizePaycheck({ id: createId() }));
    setEditingId("");
    setScanText("");
    setScanError("");
    setUploadError("");
    setUploadStatus("");
    setScanStatus(
      `${attachmentName} attached to existing Check #${
        matchingPaycheck.checkNumber || form.checkNumber
      }. No duplicate paycheck was created.`
    );
    setIsPaycheckFormOpen(false);
  };

  const editPaycheck = (paycheck) => {
    setForm(normalizePaycheck(paycheck));
    setEditingId(paycheck.id);
    setScanText(paycheck.scanText || "");
    setIsPaycheckFormOpen(false);
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

  const openWorkedPayPeriod = (paycheck) => {
    const summary = buildWorkedPayPeriodSummary(paycheck);
    if (summary) setSelectedWorkedPayPeriod(summary);
  };

  const closeWorkedPayPeriod = () => {
    setSelectedWorkedPayPeriod(null);
  };

  const printWorkedPayPeriod = () => {
    const printTarget = document.getElementById("paycheck-worked-period-print");
    if (!printTarget || !selectedWorkedPayPeriod) return;

    const previousTitle = document.title;
    const printAncestors = [];
    let printAncestor = printTarget.parentElement;

    while (printAncestor && printAncestor !== document.body) {
      printAncestor.classList.add("paycheck-print-ancestor");
      printAncestors.push(printAncestor);
      printAncestor = printAncestor.parentElement;
    }

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      printTarget.classList.remove("paycheck-print-target");
      printAncestors.forEach((ancestor) => ancestor.classList.remove("paycheck-print-ancestor"));
      document.body.classList.remove("paycheck-worked-period-printing");
      document.title = previousTitle;
      window.removeEventListener("afterprint", cleanup);
    };

    printTarget.classList.add("paycheck-print-target");
    document.body.classList.add("paycheck-worked-period-printing");
    document.title = `CSC Shifts Worked - ${selectedWorkedPayPeriod.label}`;
    window.addEventListener("afterprint", cleanup, { once: true });

    window.requestAnimationFrame(() => {
      window.print();
      window.setTimeout(cleanup, 1000);
    });
  };

  const requestPaycheckFile = async (attachment, action) => {
    const normalizedAttachment = normalizePaycheckAttachment(attachment);
    if (!normalizedAttachment?.savedName && !normalizedAttachment?.originalName) {
      throw new Error("This paycheck does not have a valid saved file link.");
    }

    let lastError = null;

    for (const endpoint of getUploadEndpointCandidates()) {
      const formData = new FormData();
      formData.append("action", action);

      if (normalizedAttachment.savedName) {
        formData.append("savedName", normalizedAttachment.savedName);
        formData.append("saved_name", normalizedAttachment.savedName);
        formData.append("saved_file_name", normalizedAttachment.savedName);
      }

      if (normalizedAttachment.originalName) {
        formData.append("originalName", normalizedAttachment.originalName);
        formData.append("original_name", normalizedAttachment.originalName);
        formData.append("original_file_name", normalizedAttachment.originalName);
      }

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          body: formData,
          credentials: "include",
          headers: {
            Accept: "application/pdf,image/*,text/plain,text/csv,application/octet-stream,application/json",
          },
        });
        const contentType = String(response.headers.get("content-type") || "").toLowerCase();

        if (!response.ok || contentType.includes("application/json")) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || `Could not ${action} the paycheck file.`);
        }

        if (contentType.includes("text/html")) {
          throw new Error("The paycheck file endpoint returned the app page instead of the saved file.");
        }

        const blob = await response.blob();
        if (!blob.size) {
          throw new Error("The saved paycheck file was empty.");
        }

        return blob;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error(`Could not ${action} the paycheck file.`);
  };

  const viewAttachment = async (attachment) => {
    setUploadStatus("");
    setUploadError("");

    const normalizedAttachment = normalizePaycheckAttachment(attachment);
    if (!normalizedAttachment?.savedName && !normalizedAttachment?.originalName) {
      setUploadError("This paycheck does not have a valid saved file link.");
      return;
    }

    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      setUploadError("Allow pop-ups for this site, then select View again.");
      return;
    }
    previewWindow.opener = null;

    try {
      const blob = await requestPaycheckFile(normalizedAttachment, "view");
      const objectUrl = URL.createObjectURL(blob);
      previewWindow.location.replace(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
      previewWindow.close();
      setUploadError(error?.message || "Could not view the saved paycheck file.");
    }
  };

  const downloadAttachment = async (attachment) => {
    setUploadStatus("");
    setUploadError("");

    const normalizedAttachment = normalizePaycheckAttachment(attachment);
    if (!normalizedAttachment?.savedName && !normalizedAttachment?.originalName) {
      setUploadError("This paycheck does not have a valid saved file link.");
      return;
    }

    const fileName =
      normalizedAttachment.originalName ||
      normalizedAttachment.savedName ||
      "paycheck-file";

    try {
      const blob = await requestPaycheckFile(normalizedAttachment, "download");
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
      setUploadError(error?.message || "Could not download the saved paycheck file.");
    }
  };

  const renderTextInput = (field, label, type = "text", wrapperClassName = "") => (
    <label className={`min-w-0 text-xs font-bold text-slate-700 sm:text-sm ${wrapperClassName}`}>
      {label}
      <input
        type={type}
        value={form[field] || ""}
        onChange={(event) => updateForm(field, event.target.value)}
        className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-base sm:mt-1 sm:px-3 sm:py-2 sm:text-sm"
      />
    </label>
  );

  const renderPaycheckEditor = ({ inline = false } = {}) => (
    <div className={inline ? "p-2.5 sm:p-3" : "p-3 sm:p-4"}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-slate-500">
            {inline ? "Edit this paycheck" : "New paycheck"}
          </div>
          {inline ? (
            <div className="mt-0.5 text-sm font-black text-slate-950">
              {formatDateForDisplay(form.checkDate) || "No check date"}
              {form.checkNumber ? `, Check #${form.checkNumber}` : ""}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <X className="h-4 w-4" />
          {inline ? "Cancel" : "Clear"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-2.5 md:grid-cols-4">
        {renderTextInput("employer", "Employer", "text", "col-span-2")}
        {renderTextInput("employeeName", "Employee", "text", "col-span-2")}
        {renderTextInput("checkDate", "Check Date", "date")}
        {renderTextInput("checkNumber", "Check Number")}
        {renderTextInput("payPeriodStart", "Pay Period Start", "date")}
        {renderTextInput("payPeriodEnd", "Pay Period End", "date")}
        {!form.earningsLines?.length ? renderTextInput("rate", "Rate") : null}
        {renderTextInput("hours", "Total Hours")}
        {renderTextInput("grossPay", "Gross Pay")}
        {renderTextInput("taxes", "Taxes")}
        {renderTextInput("deductions", "Deductions")}
        {renderTextInput("netPay", "Net Pay")}
      </div>

      {formHasDuplicateCheckNumber ? (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-950">
          <div className="flex items-start gap-2 font-bold">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Check #{form.checkNumber} is already saved. A second paycheck will not be created.
            </span>
          </div>
          {form.attachment ? (
            <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
              {duplicatePaycheckMatches.map((paycheck) => (
                <button
                  key={paycheck.id}
                  type="button"
                  onClick={() => attachScannedFileToExistingPaycheck(paycheck.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-2.5 py-1.5 text-xs font-black text-white hover:bg-blue-800"
                >
                  <Check className="h-4 w-4" />
                  Attach to Existing Check
                  {duplicatePaycheckMatches.length > 1
                    ? ` from ${formatDateForDisplay(paycheck.checkDate) || "unknown date"}`
                    : ""}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-1 pl-6 font-semibold text-amber-900">
              Edit the existing paycheck instead.
            </div>
          )}
        </div>
      ) : null}

      {!inline && form.earningsLines?.length > 0 ? (
        <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <div className="mb-1.5 text-xs font-black text-slate-900">Earnings</div>
          <div className="space-y-1">
            {form.earningsLines.map((line) => (
              <div
                key={line.id}
                className="grid grid-cols-[minmax(120px,1fr)_70px_48px_68px] items-center gap-1 rounded-md bg-white px-2 py-1.5 text-xs text-slate-700"
              >
                <span className="min-w-0 whitespace-normal break-words text-slate-950">
                  {formatEarningsTypeLabel(line.type)}
                  {getEarningsLineWorkDateDisplay(line, form) ? (
                    <span className="ml-1 text-slate-500">
                      {getEarningsLineWorkDateDisplay(line, form)}
                    </span>
                  ) : null}
                </span>
                <span className="text-right">${line.rate || "0.00"}/hr</span>
                <span className="text-right">{line.hours || "0.00"}h</span>
                <span className="text-right">${line.amount || "0.00"}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {form.attachment ? (
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-slate-900">
              {form.attachment.originalName || form.attachment.savedName}
            </div>
            <div className="text-[11px] text-slate-500">Saved paycheck file</div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {!inline ? (
              <>
                {form.attachment.savedName || form.attachment.originalName ? (
                  <button
                    type="button"
                    onClick={() => viewAttachment(form.attachment)}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-800"
                    title="View paycheck file"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </button>
                ) : null}
                {form.attachment.savedName || form.attachment.originalName ? (
                  <button
                    type="button"
                    onClick={() => downloadAttachment(form.attachment)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              onClick={removeAttachmentFromForm}
              className="inline-flex items-center gap-1 rounded-lg bg-red-700 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-red-800"
            >
              <Trash2 className="h-4 w-4" />
              Remove File
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-2.5 flex justify-end">
        <button
          type="button"
          onClick={savePaycheck}
          className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-3 py-2 text-xs font-bold text-white hover:bg-green-800 sm:text-sm"
        >
          {inline ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {inline ? "Save Changes" : "Add Paycheck"}
        </button>
      </div>
    </div>
  );

  return (
    <PageContainer surfaceClassName="min-h-screen bg-slate-100 sm:bg-teal-50" className="flex flex-col gap-2 bg-slate-100 py-2 sm:gap-3 sm:bg-teal-50 sm:py-3">
      <style>{`
        @media print {
          @page { margin: 0.45in; }
          body.paycheck-worked-period-printing * { visibility: hidden !important; }
          body.paycheck-worked-period-printing .paycheck-print-ancestor,
          body.paycheck-worked-period-printing .paycheck-print-ancestor > .paycheck-print-ancestor,
          body.paycheck-worked-period-printing .paycheck-print-target,
          body.paycheck-worked-period-printing .paycheck-print-target * { visibility: visible !important; }
          body.paycheck-worked-period-printing .paycheck-print-ancestor {
            position: static !important;
            inset: auto !important;
            display: block !important;
            width: auto !important;
            max-width: none !important;
            height: auto !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: transparent !important;
          }
          body.paycheck-worked-period-printing .paycheck-print-ancestor > *:not(.paycheck-print-ancestor):not(.paycheck-print-target) {
            display: none !important;
          }
          body.paycheck-worked-period-printing .paycheck-print-target {
            position: static !important;
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          body.paycheck-worked-period-printing .paycheck-print-scroll {
            display: block !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
          }
          body.paycheck-worked-period-printing .paycheck-print-target article {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          body.paycheck-worked-period-printing .paycheck-no-print,
          body.paycheck-worked-period-printing .paycheck-no-print * {
            display: none !important;
          }
        }
      `}</style>
      <TabPageHeader
        icon={CircleDollarSign}
        title="Paychecks"
        subtitle="Scan paycheck stubs, preserve the original file, and track rates, hours, gross pay, taxes, and net pay."
        theme="teal"
        className="budget-mobile-header"
      />

      <section className="grid grid-cols-2 gap-1.5 sm:gap-2 md:grid-cols-4" aria-label="Paycheck totals">
        <div className="rounded-xl border border-cyan-200 bg-white p-2.5 shadow-sm sm:p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-cyan-700 sm:text-xs">Hours</p>
          <p className="mt-0.5 text-lg font-black leading-none text-slate-950 sm:mt-1 sm:text-2xl">{totals.hours.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-white p-2.5 shadow-sm sm:p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-blue-700 sm:text-xs">Gross</p>
          <p className="mt-0.5 text-lg font-black leading-none text-slate-950 sm:mt-1 sm:text-2xl">${totals.grossPay.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-white p-2.5 shadow-sm sm:p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-amber-700 sm:text-xs">Taxes</p>
          <p className="mt-0.5 text-lg font-black leading-none text-slate-950 sm:mt-1 sm:text-2xl">${totals.taxes.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white p-2.5 shadow-sm sm:p-3">
          <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700 sm:text-xs">Net</p>
          <p className="mt-0.5 text-lg font-black leading-none text-slate-950 sm:mt-1 sm:text-2xl">${totals.netPay.toFixed(2)}</p>
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-blue-200 bg-blue-50">
        <button
          type="button"
          onClick={() => setIsScanSectionOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-black uppercase tracking-wide text-blue-950 hover:bg-blue-100/70 sm:px-4 sm:py-3 sm:text-sm"
          aria-expanded={isScanSectionOpen}
          aria-controls="paycheck-scan-section"
        >
          <span className="flex items-center gap-2">
            <ScanLine className="h-4 w-4" />
            Scan Paycheck
          </span>
          {isScanSectionOpen ? <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" /> : <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />}
        </button>

        {isScanSectionOpen && (
          <div id="paycheck-scan-section" className="border-t border-blue-200 p-3 sm:p-4">
            <div className="grid gap-2 sm:gap-3 md:grid-cols-3">
          <label className="text-xs font-bold text-blue-950 sm:text-sm md:col-span-2">
            Paycheck PDF or image
            <input
              type="file"
              accept="image/*,application/pdf,.pdf,.txt,.csv"
              onChange={handleScanFile}
              disabled={isScanning}
              className="mt-0.5 block w-full text-xs text-slate-700 file:mr-2 file:rounded-lg file:border-0 file:bg-blue-700 file:px-2.5 file:py-1.5 file:text-xs file:font-bold file:text-white hover:file:bg-blue-800 disabled:cursor-wait disabled:opacity-60 sm:mt-1 sm:text-sm sm:file:mr-3 sm:file:px-3 sm:file:py-2 sm:file:text-sm"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={applyEditedScanText}
              disabled={!scanText.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:text-sm"
            >
              <Check className="h-4 w-4" />
              Apply Scan Text
            </button>
          </div>
            </div>

            {isScanning && <div className="mt-2 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-bold text-blue-900 sm:mt-3 sm:px-3 sm:py-2 sm:text-sm">Scanning paycheck and saving file...</div>}
            {scanStatus && <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-bold text-green-900 sm:mt-3 sm:px-3 sm:py-2 sm:text-sm">{scanStatus}</div>}
            {uploadStatus && <div className="mt-2 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs font-bold text-green-900 sm:mt-3 sm:px-3 sm:py-2 sm:text-sm">{uploadStatus}</div>}
            {scanError && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-900 sm:mt-3 sm:px-3 sm:py-2 sm:text-sm">{scanError}</div>}
            {uploadError && <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-900 sm:mt-3 sm:px-3 sm:py-2 sm:text-sm">{uploadError}</div>}

            <label className="mt-2 block text-xs font-bold text-blue-950 sm:mt-3 sm:text-sm">
              Extracted scan text
              <textarea
                value={scanText}
                onChange={(event) => setScanText(event.target.value)}
                rows={4}
                placeholder="OCR text appears here. You can edit it, then click Apply Scan Text."
                className="mt-0.5 w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-base sm:mt-1 sm:px-3 sm:py-2 sm:text-sm"
              />
            </label>
          </div>
        )}
      </div>

      {!editingId ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setIsPaycheckFormOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-black text-slate-900 hover:bg-slate-50 sm:px-4 sm:py-3 sm:text-base"
            aria-expanded={isPaycheckFormOpen}
            aria-controls="paycheck-form-section"
          >
            <span>Add Paycheck</span>
            {isPaycheckFormOpen ? <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" /> : <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />}
          </button>
          {isPaycheckFormOpen ? (
            <div id="paycheck-form-section" className="border-t border-slate-200">
              {renderPaycheckEditor()}
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm" aria-labelledby="paycheck-history-title">
        <div className="flex items-center justify-between gap-2 bg-slate-900 px-3 py-2 text-white sm:px-4 sm:py-2.5">
          <h2 id="paycheck-history-title" className="text-sm font-black sm:text-base">Paycheck History</h2>
          <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold sm:text-xs">
            {paychecks.length} {paychecks.length === 1 ? "check" : "checks"}
          </span>
        </div>
        <div className="overflow-visible md:overflow-x-auto">
        <table className="block w-full text-sm md:table md:min-w-[720px] md:table-fixed">
          <colgroup className="hidden md:table-column-group">
            <col className="w-[76px]" />
            <col className="w-[58px]" />
            <col className="w-[290px]" />
            <col className="w-[58px]" />
            <col className="w-[54px]" />
            <col className="w-[62px]" />
            <col className="w-[144px]" />
          </colgroup>
          <thead className="hidden bg-slate-100 text-slate-700 md:table-header-group">
            <tr>
              <th className="px-1.5 py-2 text-left font-bold">Date / Period</th>
              <th className="px-1.5 py-2 text-left font-bold">Check #</th>
              <th className="px-2 py-2 text-left font-bold">Earnings</th>
              <th className="px-1.5 py-2 text-right font-bold">Gross</th>
              <th className="px-1.5 py-2 text-right font-bold">Taxes</th>
              <th className="px-1.5 py-2 text-right font-bold">Net</th>
              <th className="px-2.5 py-2 text-left font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="block divide-y divide-slate-200 md:table-row-group md:divide-y-0">
            {paychecks.length === 0 ? (
              <tr className="block md:table-row">
                <td colSpan={7} className="block px-4 py-5 text-center text-sm text-slate-500 md:table-cell md:py-6">
                  No paychecks saved yet.
                </td>
              </tr>
            ) : (
              paychecks.map((paycheck, paycheckIndex) => {
                const earningsRows = getPaycheckEarningsRows(paycheck);
                const paycheckAttachment = getStoredPaycheckAttachment(paycheck);
                const isDuplicateCheckNumber =
                  Boolean(paycheck.checkNumber) &&
                  duplicateCheckNumbers.has(String(paycheck.checkNumber).trim());
                const isAlternatePayPeriod = paycheckIndex % 2 === 1;
                const paycheckBackgroundClass =
                  editingId === paycheck.id
                    ? "bg-blue-100"
                    : isAlternatePayPeriod
                      ? "bg-sky-50"
                      : "bg-white";
                const earningsBackgroundClass =
                  editingId === paycheck.id
                    ? "bg-blue-50"
                    : isAlternatePayPeriod
                      ? "bg-sky-100/70"
                      : "bg-slate-50";

                return (
                  <React.Fragment key={paycheck.id}>
                  <tr className={`grid grid-cols-6 gap-2 p-3 align-top md:table-row md:border-t md:border-slate-200 md:p-0 ${paycheckBackgroundClass}`}>
                    <td className="col-span-4 block text-slate-900 md:table-cell md:px-1.5 md:py-2">
                      <div className="leading-tight">
                        <div className="mb-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500 md:hidden">Check Date</div>
                        <div className="tabular-nums">{formatCompactDate(paycheck.checkDate)}</div>
                        {paycheck.payPeriodStart || paycheck.payPeriodEnd ? (
                          <button
                            type="button"
                            onClick={() => openWorkedPayPeriod(paycheck)}
                            className="mt-0.5 whitespace-nowrap text-left text-sm font-bold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900 hover:decoration-blue-700"
                            title={`Show shifts worked for ${formatCompactPayPeriod(paycheck.payPeriodStart, paycheck.payPeriodEnd)}`}
                            aria-label={`Show shifts worked for pay period ${formatCompactPayPeriod(paycheck.payPeriodStart, paycheck.payPeriodEnd)}`}
                          >
                            {formatCompactPayPeriod(paycheck.payPeriodStart, paycheck.payPeriodEnd)}
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td className="col-span-2 block text-right text-slate-700 tabular-nums md:table-cell md:px-1.5 md:py-2 md:text-left">
                      <div className="mb-0.5 text-[10px] font-black uppercase tracking-wide text-slate-500 md:hidden">Check #</div>
                      <div>{paycheck.checkNumber || "—"}</div>
                      {isDuplicateCheckNumber ? (
                        <div className="mt-1 inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-800">
                          <AlertCircle className="h-3 w-3" />
                          Duplicate
                        </div>
                      ) : null}
                    </td>
                    <td className="col-span-6 block md:table-cell md:px-2 md:py-2">
                      <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-slate-500 md:hidden">Earnings</div>
                      <div className="space-y-1 md:space-y-0.5">
                        {earningsRows.map((line, index) => (
                            <div
                              key={`${paycheck.id}-earnings-${line.id || index}`}
                              className={`grid grid-cols-[minmax(120px,1fr)_72px_48px_66px] items-center gap-1 rounded px-1.5 py-1 text-xs leading-tight text-slate-700 sm:text-sm md:grid-cols-[minmax(120px,1fr)_72px_50px_66px] ${earningsBackgroundClass}`}
                            >
                              <span className="min-w-0 whitespace-normal break-words text-slate-950">
                                {formatEarningsTypeLabel(line.type)}
                                {line.dateWorked ? (
                                  <span className="ml-1 text-slate-500">
                                    {line.dateWorked}
                                  </span>
                                ) : null}
                              </span>
                              <span className="text-right">${line.rate || "0.00"}/hr</span>
                              <span className="text-right">{line.hours || "0.00"}h</span>
                              <span className="text-right">${line.amount || "0.00"}</span>
                            </div>
                        ))}
                      </div>
                    </td>
                    <td className="col-span-2 block rounded-lg bg-blue-50 p-2 text-center text-slate-700 tabular-nums md:table-cell md:rounded-none md:bg-transparent md:px-1.5 md:py-2 md:text-right">
                      <div className="text-[10px] font-black uppercase tracking-wide text-blue-700 md:hidden">Gross</div>
                      <div className="font-bold md:font-normal">${paycheck.grossPay || "0.00"}</div>
                    </td>
                    <td className="col-span-2 block rounded-lg bg-amber-50 p-2 text-center text-slate-700 tabular-nums md:table-cell md:rounded-none md:bg-transparent md:px-1.5 md:py-2 md:text-right">
                      <div className="text-[10px] font-black uppercase tracking-wide text-amber-700 md:hidden">Taxes</div>
                      <div className="font-bold md:font-normal">${paycheck.taxes || "0.00"}</div>
                    </td>
                    <td className="col-span-2 block rounded-lg bg-emerald-50 p-2 text-center font-bold text-green-700 tabular-nums md:table-cell md:rounded-none md:bg-transparent md:px-1.5 md:py-2 md:text-right">
                      <div className="text-[10px] font-black uppercase tracking-wide text-emerald-700 md:hidden">Net</div>
                      <div>${paycheck.netPay || "0.00"}</div>
                    </td>
                    <td className="col-span-6 block md:table-cell md:px-2.5 md:py-2.5">
                      <div className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-4 md:w-fit md:grid-cols-4 md:gap-2">
                        <button
                          type="button"
                          onClick={() => editingId === paycheck.id ? resetForm() : editPaycheck(paycheck)}
                          className={`inline-flex h-9 items-center justify-center rounded-md px-2 text-white md:w-9 md:px-0 ${
                            editingId === paycheck.id
                              ? "bg-slate-600 hover:bg-slate-700"
                              : "bg-blue-700 hover:bg-blue-800"
                          }`}
                          title={editingId === paycheck.id ? "Cancel editing" : "Edit paycheck"}
                          aria-label={editingId === paycheck.id ? "Cancel editing" : "Edit paycheck"}
                        >
                          {editingId === paycheck.id ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                          <span className="ml-1 text-[11px] font-bold md:hidden">
                            {editingId === paycheck.id ? "Cancel" : "Edit"}
                          </span>
                        </button>
                        {paycheckAttachment?.savedName || paycheckAttachment?.originalName ? (
                          <button
                            type="button"
                            onClick={() => viewAttachment(paycheckAttachment)}
                            className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-2 text-white hover:bg-slate-800 md:w-9 md:px-0"
                            title="View paycheck file"
                            aria-label="View paycheck file"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="ml-1 text-[11px] font-bold md:hidden">View</span>
                          </button>
                        ) : null}
                        {paycheckAttachment?.savedName || paycheckAttachment?.originalName ? (
                          <button
                            type="button"
                            onClick={() => downloadAttachment(paycheckAttachment)}
                            className="inline-flex h-9 items-center justify-center rounded-md bg-slate-700 px-2 text-white hover:bg-slate-800 md:w-9 md:px-0"
                            title="Download paycheck file"
                            aria-label="Download paycheck file"
                          >
                            <Download className="h-4 w-4" />
                            <span className="ml-1 text-[11px] font-bold md:hidden">Download</span>
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removePaycheck(paycheck)}
                          className="inline-flex h-9 items-center justify-center rounded-md bg-red-700 px-2 text-white hover:bg-red-800 md:w-9 md:px-0"
                          title="Delete paycheck"
                          aria-label="Delete paycheck"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="ml-1 text-[11px] font-bold md:hidden">Delete Check</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editingId === paycheck.id ? (
                    <tr className="block border-t border-blue-200 bg-blue-50/70 md:table-row">
                      <td colSpan={7} className="block p-0 md:table-cell">
                        {renderPaycheckEditor({ inline: true })}
                      </td>
                    </tr>
                  ) : null}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </section>

      {selectedWorkedPayPeriod ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="paycheck-worked-period-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeWorkedPayPeriod();
          }}
        >
          <div
            id="paycheck-worked-period-print"
            className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
              <div className="min-w-0">
                <h2 id="paycheck-worked-period-title" className="text-lg font-extrabold text-slate-950 sm:text-xl">
                  Shifts Worked, {selectedWorkedPayPeriod.label}
                </h2>
                <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                  Only shifts marked Done are included.
                </p>
              </div>
              <div className="paycheck-no-print flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={printWorkedPayPeriod}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-extrabold text-white shadow-sm hover:bg-slate-800 sm:h-11 sm:px-4 sm:text-sm"
                  aria-label={`Print shifts worked for ${selectedWorkedPayPeriod.label}`}
                  title={`Print shifts worked for ${selectedWorkedPayPeriod.label}`}
                >
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button
                  type="button"
                  onClick={closeWorkedPayPeriod}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-950 sm:h-11 sm:w-11"
                  aria-label="Close shifts worked modal and return to Paychecks"
                  title="Close and return to Paychecks"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5 sm:py-4">
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3">
                  <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500 sm:text-[10px]">Worked Shifts</p>
                  <p className="mt-1 text-lg font-extrabold text-slate-950 sm:text-xl">
                    {selectedWorkedPayPeriod.workedShiftCount} out of {selectedWorkedPayPeriod.shiftCount}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3">
                  <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500 sm:text-[10px]">Worked Hours</p>
                  <p className="mt-1 text-lg font-extrabold text-slate-950 sm:text-xl">
                    {selectedWorkedPayPeriod.workedHours.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3">
                  <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500 sm:text-[10px]">Estimated Earned Pay</p>
                  <p className="mt-1 text-lg font-extrabold text-emerald-700 sm:text-xl">
                    {formatCscCurrency(selectedWorkedPayPeriod.earnedPay)}
                  </p>
                </div>
              </div>
            </div>

            <div className="paycheck-print-scroll flex-1 overflow-y-auto p-4 sm:p-5">
              {selectedWorkedPayPeriod.workedShifts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                  <p className="text-sm font-bold text-slate-700">
                    No shifts were marked Done for this pay period.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {selectedWorkedPayPeriod.workedShifts.map((shift) => (
                    <article
                      key={`${shift.recordSource}-${shift.id}`}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-lg font-extrabold text-slate-950">{shift.venue || "CSC Shift"}</h3>
                          <p className="mt-0.5 text-sm font-bold text-slate-700">{shift.event || "Event not entered"}</p>
                          {shouldShowDistinctCscJobName(shift) ? (
                            <p className="mt-0.5 text-xs font-semibold text-slate-500">{shift.jobName}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-green-800">
                            Done
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-700">
                            {shift.recordSource === "archived" ? "Archived" : "Active"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-slate-700">
                        <div className="grid grid-cols-[100px_1fr] gap-3 border-t border-slate-100 pt-2">
                          <span className="font-extrabold text-slate-950">Start</span>
                          <span>{formatCscShiftDate(shift.startDate)} {formatCscShiftTime(shift.startTime)}</span>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] gap-3 border-t border-slate-100 pt-2">
                          <span className="font-extrabold text-slate-950">Finish</span>
                          <span>{formatCscShiftDate(shift.finishDate || shift.startDate)} {formatCscShiftTime(shift.finishTime)}</span>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] gap-3 border-t border-slate-100 pt-2">
                          <span className="font-extrabold text-slate-950">Hours</span>
                          <span>{getCscShiftHours(shift).toFixed(1)}</span>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] gap-3 border-t border-slate-100 pt-2">
                          <span className="font-extrabold text-slate-950">Uniform</span>
                          <span>{deriveCscUniform(shift)}</span>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] gap-3 border-t border-slate-100 pt-2">
                          <span className="font-extrabold text-slate-950">Est. Pay</span>
                          <span>{formatCscCurrency(getCscShiftEstimatedPay(shift))}</span>
                        </div>
                        <div className="grid grid-cols-[100px_1fr] gap-3 border-t border-slate-100 pt-2">
                          <span className="font-extrabold text-slate-950">Paid Status</span>
                          <span>{shift.paidStatus || "Unpaid"}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}
