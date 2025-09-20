// JSON import/export for DB-primary mode.
// - Works in dev (no /api.js) and in WP build mode.
// - Detects & converts legacy full-state rows {category, estBudget, actualSpent, bankSource, ...}
//   to canonical rows {id, name, amount, dueDate, notes, paid}.
// - Items JSON (array or { items: [...] }) also supported, including capitalized keys.

const LS_KEY = "budget-dashboard-state-v1";

/* -------------------------------- Export -------------------------------- */
export async function exportStateToFile() {
  try {
    let state;
    try {
      const r = await (window.getCurrentState?.());
      if (r?.ok && r.state) state = r.state;
    } catch {}
    if (!state) {
      try { const raw = window.localStorage.getItem(LS_KEY); if (raw) state = JSON.parse(raw); } catch {}
    }
    if (!state) state = {};

    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `budget_state_${new Date().toISOString().slice(0,10)}.json`,
    });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch (e) {
    console.error("[exportStateToFile]", e);
    alert("Export failed.");
  }
}

/* -------------------------------- Helpers ------------------------------- */
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
function normAmt(v){
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") { const n = Number(v.replace(/[^0-9.-]/g,"")); return Number.isFinite(n) ? n : 0; }
  return 0;
}
// tolerant getters for capitalized/alternate field names
function pick(obj, ...keys) {
  for (const k of keys) if (obj?.[k] !== undefined && obj?.[k] !== null) return obj[k];
  return undefined;
}

/* --------------------- Item normalizer (items import) -------------------- */
function normItem(raw){
  if (!isObj(raw)) return null;

  const categoryKey = pick(raw, "categoryKey","CategoryKey","category","Category");
  const name = pick(raw, "name","Name","title","label","category","Category");
  const amountSrc = pick(raw, "amount","Amount","estBudget","EstBudget","actualSpent","ActualSpent");
  const dueSrc = pick(raw, "dueDate","DueDate","date","Date","due","Due");
  const notesSrc = pick(raw, "notes","Notes","memo","description","bankSource","BankSource");
  const paidSrc = pick(raw, "paid","Paid");

  const out = {
    id: typeof raw.id === "string" ? raw.id : (crypto?.randomUUID?.() || String(Date.now() + Math.random())),
    categoryKey: typeof categoryKey === "string" ? categoryKey : null,
    name: typeof name === "string" ? name : "Item",
    amount: normAmt(amountSrc),
    dueDate: typeof dueSrc === "string" ? dueSrc : null,
    notes: typeof notesSrc === "string" ? notesSrc : null,
    paid: !!paidSrc,
    minPayment: normAmt(pick(raw, "minPayment","MinPayment")) || undefined,
    billingMonth: pick(raw, "billingMonth","BillingMonth") ?? undefined,
  };
  if (!out.categoryKey || !out.name) return null;
  return out;
}

function ensureSection(state, key){
  state.budgetData = state.budgetData || {};
  if (!Array.isArray(state.budgetData[key])) state.budgetData[key] = [];
  state.ui = state.ui || {};
  state.ui.sections = Array.isArray(state.ui.sections) ? state.ui.sections : [];
  if (!state.ui.sections.includes(key)) state.ui.sections.push(key);
  return state;
}

/* --------- Legacy full-state → canonical full-state transformer ---------- */
function looksLikeLegacyRow(row){
  return row && typeof row === "object" && ("category" in row || "Category" in row) &&
         (("estBudget" in row) || ("EstBudget" in row) || ("actualSpent" in row) || ("ActualSpent" in row));
}
function isLegacyFullState(data){
  if (!isObj(data) || !isObj(data.budgetData)) return false;
  for (const key of Object.keys(data.budgetData)) {
    const arr = data.budgetData[key];
    if (Array.isArray(arr) && arr.some(looksLikeLegacyRow)) return true;
  }
  return false;
}
function transformLegacyFullState(legacy){
  const out = { budgetData: {}, archived: [], ui: { sections: [], labels: {}, subscriptions: [] } };
  const bd = legacy?.budgetData && isObj(legacy.budgetData) ? legacy.budgetData : {};
  const keys = Object.keys(bd);

  for (const key of keys) {
    const arr = Array.isArray(bd[key]) ? bd[key] : [];
    out.budgetData[key] = arr.map((r) => {
      const id = (crypto?.randomUUID?.() || String(Date.now() + Math.random()));
      const name = (pick(r, "category","Category") || "Item");

      // Prefer actualSpent ONLY if > 0; else fall back to estBudget (or Amount).
      const actual = normAmt(pick(r, "actualSpent","ActualSpent"));
      const est = normAmt(pick(r, "estBudget","EstBudget","amount","Amount"));
      const amount = actual > 0 ? actual : est;

      const dueDate = pick(r, "dueDate","DueDate") || null;
      const bankSource = pick(r, "bankSource","BankSource");
      const extraNotes = pick(r, "notes","Notes","memo","description");
      const notes = typeof bankSource === "string" ? bankSource : (typeof extraNotes === "string" ? extraNotes : null);
      const paid = String(bankSource || "").toLowerCase() === "paid";

      return { id, name, amount, dueDate, notes, paid };
    });
    out.ui.sections.push(key);
  }
  return out;
}

/* ------------------------------ Parser ---------------------------------- */
function parsePayload(text){
  let data; try { data = JSON.parse(text); } catch { throw new Error("Invalid JSON (could not parse)."); }

  // Full state (legacy or canonical)?
  if (isObj(data) && isObj(data.budgetData)) {
    if (isLegacyFullState(data)) return { kind: "state", state: transformLegacyFullState(data) };
    return { kind: "state", state: data };
  }

  // Items (array or {items:[]})
  let items = Array.isArray(data) ? data : (isObj(data) && Array.isArray(data.items) ? data.items : null);
  if (!items) throw new Error("JSON must be a full state or a list of items.");
  items = items.map(normItem).filter(Boolean);
  if (!items.length) throw new Error("No valid items found.");
  return { kind: "items", items };
}

/* ------------------------------- Import --------------------------------- */
export async function importStateFromFile() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";

  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parsePayload(text);

      if (parsed.kind === "state") {
        // 1) Instant UI
        window.dispatchEvent(new CustomEvent("bd:replace-state-local", { detail: { state: parsed.state } }));
        // 2) Save to DB (if available)
        let ok = false;
        try { const r = await (window.saveCurrentState?.(parsed.state, 0)); ok = !!(r && r.ok); } catch {}
        if (!ok) {
          alert("Imported locally (DB sync failed).");
        } else {
          window.dispatchEvent(new Event("bd:replace-state"));
          alert("Import complete.");
        }
        return;
      }

      // ITEMS: merge immutably
      let base = null;
      try { const r = await (window.getCurrentState?.()); if (r?.ok && r.state) base = r.state; } catch {}
      if (!base) { try { const raw = window.localStorage.getItem(LS_KEY); if (raw) base = JSON.parse(raw); } catch {} }
      if (!base) base = { budgetData:{}, archived:[], ui:{ sections:[], labels:{}, subscriptions:[] } };

      const next = structuredClone(base);
      for (const it of parsed.items) {
        if (!it || !it.categoryKey) continue;
        ensureSection(next, it.categoryKey);
        next.budgetData[it.categoryKey] = [...next.budgetData[it.categoryKey], it];
      }

      // Instant UI
      window.dispatchEvent(new CustomEvent("bd:replace-state-local", { detail: { state: next } }));

      // Save & rehydrate
      let ok = false;
      try { const r = await (window.saveCurrentState?.(next, 0)); ok = !!(r && r.ok); } catch {}
      if (!ok) {
        alert(`Imported ${parsed.items.length} item(s) locally (DB sync failed).`);
      } else {
        window.dispatchEvent(new Event("bd:replace-state"));
        alert(`Imported ${parsed.items.length} item(s).`);
      }
    } catch (e) {
      console.error("[importStateFromFile]", e);
      alert(e?.message || "Import failed.");
    } finally {
      input.value = "";
    }
  };

  input.click();
}
