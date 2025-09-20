// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\utils\receipts\rules.js
const toTitle = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim().replace(/\b([a-z])/g, (m, c) => c.toUpperCase());
const stripNoise = (s) => (s || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9\s.&'-]/g, " ").replace(/\s+/g, " ").trim();
const norm = (s) => stripNoise(s).toLowerCase().replace(/&/g, " and ").replace(/\s+/g, " ").trim();

export function normalizeMerchantName(name) {
  const cleaned = stripNoise(name);
  const trimmed = cleaned.replace(/\b(inc\.?|llc|co\.?|corp\.?|ltd\.?)\b/gi, "").replace(/\s+/g, " ").trim();
  const titled = toTitle(trimmed || cleaned);
  return titled || "Unknown";
}

export function applyCategoryRules(receipt, rulesInput) {
  const r = receipt || {};
  const rules = Array.isArray(rulesInput) ? rulesInput : [];
  const base = { ...r, merchant: normalizeMerchantName(r.merchant || "") };
  const mNorm = norm(base.merchant);
  const textBag = mNorm + " " + (Array.isArray(base.items) ? base.items.map((it) => norm(it.name)).join(" ") : "");
  let chosen = base.category || "";

  if (!chosen) {
    const def = rules.find((x) => x.merchant && norm(x.merchant) === mNorm && x.defaultCategory);
    if (def) chosen = def.defaultCategory;
  }
  for (const rule of rules) {
    if (!rule?.match || !rule?.category) continue;
    const needle = norm(rule.match); if (!needle) continue;
    if (textBag.includes(needle)) { chosen = rule.category; break; }
  }
  return { ...base, category: chosen || base.category || "" };
}
