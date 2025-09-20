// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\components\receipts\RulesEditor.jsx
import React from "react";
import { loadState, saveState } from "../../utils/state";

export default function RulesEditor({ onChange }) {
  const [rules, setRules] = React.useState(() => loadState().rules || []);
  React.useEffect(() => {
    const onAny = () => setRules(loadState().rules || []);
    window.addEventListener("storage", onAny);
    window.addEventListener("bd-state-updated", onAny);
    return () => { window.removeEventListener("storage", onAny); window.removeEventListener("bd-state-updated", onAny); };
  }, []);
  const persist = (next) => { const s = loadState(); saveState({ ...s, rules: next }); setRules(next); onChange?.(next); };
  const update = (i, k, v) => persist(rules.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const remove = (i) => persist(rules.filter((_, idx) => idx !== i));
  const add = () => persist([...rules, { match:"", category:"", merchant:"", defaultCategory:"" }]);

  return (
    <div className="space-y-3">
      <div className="bd-card">
        <div style={{ fontWeight:700, fontSize:16, marginBottom:8 }}>Rules Editor</div>
        <div className="bd-help" style={{ marginBottom:12 }}>Add keyword rules (<b>match → category</b>) or per-merchant defaults (<b>merchant → defaultCategory</b>).</div>
        <div className="space-y-2">
          {rules.map((r,i)=>(
            <div key={i} className="bd-card" style={{ padding:12 }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div><div className="bd-label">Keyword Match</div><input className="bd-input" placeholder="e.g., starbucks" value={r.match||""} onChange={(e)=>update(i,"match",e.target.value)} /></div>
                <div><div className="bd-label">Category</div><input className="bd-input" placeholder="e.g., Coffee" value={r.category||""} onChange={(e)=>update(i,"category",e.target.value)} /></div>
                <div><div className="bd-label">Merchant (exact)</div><input className="bd-input" placeholder="e.g., Trader Joe's" value={r.merchant||""} onChange={(e)=>update(i,"merchant",e.target.value)} /></div>
                <div><div className="bd-label">Default Category</div><input className="bd-input" placeholder="e.g., Groceries" value={r.defaultCategory||""} onChange={(e)=>update(i,"defaultCategory",e.target.value)} /></div>
              </div>
              <div style={{ marginTop:8 }}><button className="bd-btn" onClick={()=>remove(i)}>✕ Remove</button></div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:8 }}><button className="bd-btn bd-btn--primary" onClick={add}>Add Rule</button></div>
      </div>
    </div>
  );
}
