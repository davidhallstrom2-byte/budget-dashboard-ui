// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\utils\ocr\index.jsx
/* eslint-disable no-console */
/**
 * Client-side OCR adapter (images via tesseract.js; PDFs via pdfjs-dist).
 * Exports:
 *   - detectAvailable(): Promise<boolean>
 *   - extractFromFile(file): Promise<{ items: NormalizedItem[] }>
 *   - providerLabel: string
 *   - OCR_AVAILABLE: boolean
 */

export const providerLabel = "Tesseract.js + PDF.js";
export const OCR_AVAILABLE = true;

// PDF.js worker for Vite
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import PdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";
GlobalWorkerOptions.workerPort = new PdfjsWorker();

const CATEGORY_LABEL = {
  income: "Income",
  housing: "Housing",
  transportation: "Transportation",
  food: "Food",
  personal: "Personal",
  homeOffice: "Home Office",
  banking: "Banking & Credit",
  misc: "Misc",
};

const KNOWN_VENDORS = [
  { key: "banking", terms: ["wells fargo", "service fee", "credit one", "visa", "prime checking", "bank of america", "chase"] },
  { key: "housing", terms: ["spectrum", "rent", "internet", "mobile", "utilities", "electric", "gas"] },
  { key: "homeOffice", terms: ["chatgpt", "openai", "google ai pro", "linkedin premium", "supergrok", "prime"] },
  { key: "food", terms: ["instacart", "grocery", "groceries", "restaurant", "ubereats", "doordash"] },
  { key: "personal", terms: ["netflix", "paramount", "amazon prime", "cvs extracare", "spotify", "hbo", "max"] },
];

function includesCI(hay = "", needle = "") {
  return hay.toLowerCase().includes(needle.toLowerCase());
}

function guessCategory(text = "") {
  const t = text.toLowerCase();
  for (const group of KNOWN_VENDORS) {
    if (group.terms.some((x) => t.includes(x))) return group.key;
  }
  if (t.includes("credit") || t.includes("debit") || t.includes("bank")) return "banking";
  if (t.includes("rent")) return "housing";
  if (t.includes("internet") || t.includes("mobile")) return "housing";
  return "misc";
}

function titleCase(s = "") {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ")
    .trim();
}

function pickVendor(text = "", filename = "") {
  const source = (text || filename || "").toLowerCase();
  for (const g of KNOWN_VENDORS) {
    const hit = g.terms.find((t) => source.includes(t));
    if (hit) {
      if (includesCI(hit, "credit one")) return "Credit One Bank";
      if (includesCI(hit, "wells fargo")) return "Wells Fargo Service Fee";
      if (includesCI(hit, "spectrum") && includesCI(source, "internet")) return "Spectrum Internet";
      if (includesCI(hit, "spectrum") && includesCI(source, "mobile")) return "Spectrum Mobile";
      if (includesCI(hit, "chatgpt")) return "ChatGPT Plus";
      return titleCase(hit);
    }
  }
  const cap = (text || "").match(/\b([A-Z][A-Z&\.\- ]{2,})\b/);
  if (cap) return titleCase(cap[1].toLowerCase());
  return "Scanned Item";
}

// Improved amount parser - supports $12, 12.00, 1,234.56, (12.34), USD 12.34
function parseAmount(text = "", filename = "") {
  const source = `${filename}\n${text}`;
  const moneyRe =
    /(?:USD|US\$)?\s*\$?\s*(\(?-?\d{1,3}(?:,\d{3})*(?:\.\d{2})?-?|-?\d+(?:\.\d{2})?)\)?/g;
  const hits = [...source.matchAll(moneyRe)];
  if (!hits.length) return 0;
  const nums = hits
    .map((m) => {
      const raw = m[1] ?? "";
      const neg = raw.includes("-") || raw.startsWith("(");
      const clean = raw.replace(/[(),]/g, "");
      const n = parseFloat(clean);
      if (!Number.isFinite(n)) return NaN;
      return Math.abs(neg ? n : n);
    })
    .filter((n) => Number.isFinite(n));
  if (!nums.length) return 0;
  return Math.max(...nums);
}

// Improved date parser - supports 2025-09-10, 09/10/2025, Sep 10 2025, September 10, 2025
function parseISODate(text = "", filename = "") {
  const source = `${filename}\n${text}`;

  // yyyy-mm-dd
  let m =
    source.match(/\b(20[0-9]{2})[-_/\.](0[1-9]|1[0-2])[-_/\.](0[1-9]|[12][0-9]|3[01])\b/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // mm-dd-yyyy or mm/dd/yyyy
  m = source.match(
    /\b(0[1-9]|1[0-2])[-_/\.](0[1-9]|[12][0-9]|3[01])[-_/\.](20[0-9]{2})\b/
  );
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;

  // Month name dd, yyyy
  const months =
    "(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)";
  const nameRe = new RegExp(
    `\\b${months}\\s+([0-3]?\\d)(?:st|nd|rd|th)?(?:,)?\\s+(20\\d{2})\\b`,
    "i"
  );
  m = source.match(nameRe);
  if (m) {
    const monthNames = {
      jan: "01",
      january: "01",
      feb: "02",
      february: "02",
      mar: "03",
      march: "03",
      apr: "04",
      april: "04",
      may: "05",
      jun: "06",
      june: "06",
      jul: "07",
      july: "07",
      aug: "08",
      august: "08",
      sep: "09",
      sept: "09",
      september: "09",
      oct: "10",
      october: "10",
      nov: "11",
      november: "11",
      dec: "12",
      december: "12",
    };
    const mm = monthNames[m[1].toLowerCase()];
    const dd = String(m[2]).padStart(2, "0");
    return `${m[3]}-${mm}-${dd}`;
  }

  // fallback today
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

async function ocrImageToText(file) {
  try {
    const tesseract = await import("tesseract.js");
    const { data } = await tesseract.recognize(file, "eng");
    return data?.text || "";
  } catch (err) {
    console.warn("[ocr] tesseract recognize failed:", err);
    return "";
  }
}

async function pdfToText(file) {
  try {
    const buf = await file.arrayBuffer();
    const task = getDocument({ data: buf });
    const pdf = await task.promise;
    let out = "";
    const clamps = Math.min(pdf.numPages || 1, 3);
    for (let p = 1; p <= clamps; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      out += " " + content.items.map((it) => it.str).join(" ");
    }
    return out;
  } catch (err) {
    console.warn("[ocr] pdf extraction failed:", err);
    return "";
  }
}

export async function detectAvailable() {
  try {
    await import("tesseract.js");
    return true;
  } catch {
    return false;
  }
}

export async function extractFromFile(file) {
  if (!file) return { items: [] };
  const nameOnly = (file.name || "").replace(/\.[a-zA-Z0-9]+$/, "");
  const isPDF =
    (file.type || "").includes("pdf") || /\.pdf$/i.test(file.name || "");

  let text = "";
  if (isPDF) text = await pdfToText(file);
  else text = await ocrImageToText(file);

  const src = `${text}\n${nameOnly}`;
  const categoryKey = guessCategory(src);
  const vendor = pickVendor(src, nameOnly);
  const amount = parseAmount(src, nameOnly);
  const dueDate = parseISODate(src, nameOnly);

  const item = {
    categoryKey,
    categoryLabel: CATEGORY_LABEL[categoryKey] || "Misc",
    category: vendor,
    estBudget: amount || 0,
    dueDate,
    bankSource: "Pending",
  };

  return { items: [item] };
}

export default {
  providerLabel,
  OCR_AVAILABLE,
  detectAvailable,
  extractFromFile,
};
