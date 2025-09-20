// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\components\receipts\DedupeDialog.jsx
import React from "react";

function DiffCell({ a, b }) {
  const same = String(a ?? "") === String(b ?? "");
  return <td style={{ padding:"8px 12px", fontSize:14, background: same ? "transparent" : "#fefce8" }}>{String(a ?? "")}</td>;
}

export default function DedupeDialog({ open, existing, incoming, similarity, onDecision, onClose }) {
  if (!open) return null;
  const Row = ({ label, a, b }) => (
    <tr>
      <td style={{ padding:"8px 12px", fontSize:14, color:"#6b7280", width:160 }}>{label}</td>
      <DiffCell a={a} b={b} />
      <DiffCell a={b} b={a} />
    </tr>
  );
  return (
    <div className="bd-modal-backdrop" role="dialog" aria-modal="true">
      <div className="bd-modal">
        <div className="bd-modal-header">
          <div>
            <div style={{ fontSize:16, fontWeight:600 }}>Possible duplicate receipt detected</div>
            {similarity ? <div style={{ fontSize:12, color:"#6b7280", marginTop:2 }}>{similarity.reason} • similarity {Math.round((similarity.score || 0) * 100)}%</div> : null}
          </div>
          <button className="bd-btn" onClick={()=>onClose?.()}>Close</button>
        </div>
        <div className="bd-modal-body">
          <table className="bd-table">
            <thead><tr><th>Field</th><th>Existing</th><th>Incoming</th></tr></thead>
            <tbody>
              <Row label="Merchant" a={existing?.merchant} b={incoming?.merchant} />
              <Row label="Date" a={existing?.date} b={incoming?.date} />
              <Row label="Subtotal" a={existing?.subtotal} b={incoming?.subtotal} />
              <Row label="Tax" a={existing?.tax} b={incoming?.tax} />
              <Row label="Total" a={existing?.total} b={incoming?.total} />
              <Row label="Items" a={(existing?.items||[]).map(i=>i.name).join(", ")} b={(incoming?.items||[]).map(i=>i.name).join(", ")} />
              <Row label="Notes" a={existing?.notes} b={incoming?.notes} />
            </tbody>
          </table>
        </div>
        <div className="bd-modal-footer">
          <button className="bd-btn" onClick={()=>onDecision?.("skip")}>Skip</button>
          <button className="bd-btn" onClick={()=>onDecision?.("keep-both")}>Keep Both</button>
          <button className="bd-btn bd-btn--primary" onClick={()=>onDecision?.("replace")}>Replace Existing</button>
        </div>
      </div>
    </div>
  );
}
