import React, { useEffect, useMemo, useState } from "react";
import { subscribe } from "/src/utils/state.js";

export default function EditorTab() {
  const [appState, setAppState] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ sectionKey: "", name: "", amount: "", dueDate: "", notes: "" });

  useEffect(() => {
    const un = subscribe(setAppState);
    return () => un();
  }, []);

  useEffect(() => {
    const open = () => {
      const firstKey = Object.keys(appState?.budgetData || {})[0] || "";
      setForm((f) => ({ ...f, sectionKey: f.sectionKey || firstKey }));
      setShowAddModal(true);
    };
    window.addEventListener("bd:add-item", open);
    return () => window.removeEventListener("bd:add-item", open);
  }, [appState]);

  const bd = useMemo(() => appState?.budgetData ?? {}, [appState]);
  const sections = useMemo(
    () => Object.entries(bd).map(([key, rows]) => ({
      key,
      title: (appState?.ui?.labels?.[key]) || key[0]?.toUpperCase() + key.slice(1),
      rows: Array.isArray(rows) ? rows : [],
    })),
    [bd, appState]
  );

  function normalizeAmount(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    if (typeof v === "string") {
      const n = Number(v.replace(/[^0-9.-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!appState) return;

    const sectionKey = form.sectionKey?.trim();
    const name = (form.name || "").trim();
    const amount = normalizeAmount(form.amount);
    const dueDate = form.dueDate || null;
    const notes = form.notes?.trim() || null;

    if (!sectionKey || !name) return alert("Please choose a section and enter a name.");

    const item = {
      id: (crypto?.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random()),
      name, amount, dueDate, notes, paid: false,
    };

    const next = structuredClone(appState || {});
    if (!next.budgetData) next.budgetData = {};
    if (!Array.isArray(next.budgetData[sectionKey])) next.budgetData[sectionKey] = [];
    next.budgetData[sectionKey] = [...next.budgetData[sectionKey], item];

    if (!next.ui) next.ui = {};
    if (!Array.isArray(next.ui.sections)) next.ui.sections = [];
    if (!next.ui.sections.includes(sectionKey)) next.ui.sections.push(sectionKey);

    setShowAddModal(false);
    setForm((f) => ({ ...f, name: "", amount: "", dueDate: "", notes: "" }));

    try {
      const res = await (window.saveCurrentState?.(next, 0));
      if (!res || !res.ok) {
        setAppState(next);
        alert("Saved locally (DB sync failed).");
      } else {
        window.dispatchEvent(new Event("bd:replace-state"));
      }
    } catch {
      setAppState(next);
      alert("Saved locally (DB sync failed).");
    }
  }

  if (!appState) return <div className="text-sm text-gray-500">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Editor</h2>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1 rounded-xl bg-blue-600 text-white" onClick={() => setShowAddModal(true)}>+ Add Item</button>
          <button className="px-3 py-1 rounded-xl border" onClick={() => window.dispatchEvent(new Event("bd:add-item"))} title="Legacy event trigger">Trigger Event</button>
        </div>
      </div>

      {sections.length === 0 ? (
        <p className="text-slate-500">Use Scan Receipt, Upload Receipt, or Manual Entry.</p>
      ) : (
        <div className="space-y-6">
          {sections.map((sec) => (
            <div key={sec.key} className="rounded-xl bg-white p-4 shadow-sm border">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{sec.title}</h3>
                <button className="px-2 py-1 rounded-md text-sm border" onClick={() => { setForm((f) => ({ ...f, sectionKey: sec.key })); setShowAddModal(true); }}>
                  + Add to {sec.title}
                </button>
              </div>

              {sec.rows.length === 0 ? (
                <p className="text-sm text-gray-500 mt-2">No items yet.</p>
              ) : (
                <table className="w-full text-sm mt-3">
                  <thead className="text-left text-gray-500">
                    <tr>
                      <th className="py-1 pr-4">Name</th>
                      <th className="py-1 pr-4">Amount</th>
                      <th className="py-1 pr-4">Due</th>
                      <th className="py-1">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sec.rows.map((r, idx) => (
                      <tr key={r?.id ?? `${sec.key}-${idx}`} className="border-t">
                        <td className="py-1 pr-4">{r?.name ?? ""}</td>
                        <td className="py-1 pr-4">{Number(r?.amount || 0).toFixed(2)}</td>
                        <td className="py-1 pr-4">{r?.dueDate ?? ""}</td>
                        <td className="py-1">{r?.notes ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
            <h4 className="text-base font-semibold mb-3">Add Item</h4>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Section</label>
                <select className="w-full rounded-md border px-3 py-2 text-sm" value={form.sectionKey} onChange={(e) => setForm((f) => ({ ...f, sectionKey: e.target.value }))} required>
                  <option value="" disabled>Choose a section</option>
                  {Object.keys(bd).map((k) => (
                    <option key={k} value={k}>{(appState?.ui?.labels?.[k]) || k[0]?.toUpperCase() + k.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Name</label>
                <input className="w-full rounded-md border px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g., Rent, Paycheck, Target" required />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Amount</label>
                <input className="w-full rounded-md border px-3 py-2 text-sm" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="e.g., 1200.00" inputMode="decimal" />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Due Date</label>
                <input type="date" className="w-full rounded-md border px-3 py-2 text-sm" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1">Notes</label>
                <input className="w-full rounded-md border px-3 py-2 text-sm" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="optional" />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" className="rounded-md border px-3 py-1.5 text-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="rounded-md bg-blue-600 text-white px-3 py-1.5 text-sm">Add Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
