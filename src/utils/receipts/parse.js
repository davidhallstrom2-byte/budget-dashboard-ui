// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\utils\receipts\parse.js
function currencyToNumber(s) {
  if (typeof s === "number") return s;
  const m = String(s || "").replace(/[, ]/g, "").match(/-?\d+(\.\d{1,2})?/);
  return m ? Number(m[0]) : 0;
}

function findDate(lines) {
  const joined = lines.join(" ");
  const iso = joined.match(/\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/);
  if (iso) return iso[0];
  const us = joined.match(/\b(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](20\d{2})\b/);
  if (us) {
    const [m, d, y] = us[0].split(/[\/\-]/).map((x) => x.padStart(2, "0"));
    return `${y}-${m}-${d}`;
  }
  return new Date().toISOString().slice(0, 10);
}

function findTotals(lines) {
  let cand = [];
  for (const ln of lines) {
    if (/total/i.test(ln)) cand.push(currencyToNumber(ln));
  }
  if (cand.length) return Math.max(...cand.filter((n) => n > 0));
  // fallback: highest money-like number
  for (const ln of lines) {
    const nums = ln.match(/\$?-?\d{1,5}(\.\d{1,2})?/g) || [];
    cand.push(...nums.map(currencyToNumber));
  }
  cand = cand.filter((n) => n > 0);
  return cand.length ? Math.max(...cand) : 0;
}

export function parseReceiptText(text) {
  const t = (text || "").replace(/\r/g, "");
  const lines = t.split("\n").map((s) => s.trim()).filter(Boolean);
  const merchant = lines[0] || "Unknown";
  const date = findDate(lines);
  const total = findTotals(lines);
  const taxMatch = t.match(/\b(tax|vat)\b[: ]+\$?\s*(-?\d+(\.\d{1,2})?)/i);
  const tax = taxMatch ? currencyToNumber(taxMatch[2]) : 0;

  const id = `r-${(merchant || "x").toLowerCase().replace(/[^a-z0-9]/g, "")}-${date}-${Math.round(total*100)}`;
  return { id, merchant, date, subtotal: Math.max(0, total - tax), tax, total, items: [], meta: { createdAt: new Date().toISOString(), source: "ocr" } };
}

export function isDuplicateOrNear(a, b) {
  const sameMerchant = String(a.merchant||"").toLowerCase() === String(b.merchant||"").toLowerCase();
  const sameTotal = Math.abs((Number(a.total)||0) - (Number(b.total)||0)) <= 0.5;
  const sameDate = String(a.date||"") === String(b.date||"");
  const exact = sameMerchant && sameTotal && sameDate;
  const near = sameMerchant && sameTotal;
  const score = exact ? 1 : near ? 0.7 : 0;
  const reason = exact ? "Exact match (merchant, date, total)" : near ? "Near match (merchant + total)" : "No match";
  return { exact, near, score, reason };
}
