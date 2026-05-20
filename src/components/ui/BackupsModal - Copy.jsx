import React, { useEffect, useMemo, useRef, useState } from "react";

const api = {
  list: () => window.listBackups?.(),
  create: (name) => window.backupStateToDB?.(name),
  restoreLatest: () => window.restoreLatestFromDB?.(),
  restoreById: (id) => window.restoreById?.(id),
  deleteById: (id) => window.deleteBackup?.(id),
};

function fmtBytes(n) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
function defaultBackupName() {
  const z = new Date(), p = (x)=>String(x).padStart(2,"0");
  return `bk_${z.getFullYear()}-${p(z.getMonth()+1)}-${p(z.getDate())}_${p(z.getHours())}-${p(z.getMinutes())}-${p(z.getSeconds())}`;
}

export default function BackupsModal({ open, onClose }) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [name, setName] = useState(defaultBackupName());
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const sorted = useMemo(() => [...items].sort(
    (a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")
  ), [items]);

  useEffect(() => {
    if (!open) return;
    setError(""); setStatus(""); setName(defaultBackupName());
    (async () => {
      setLoading(true);
      try {
        const res = await api.list();
        if (res?.ok && Array.isArray(res.backups)) setItems(res.backups);
        else setError("Could not load backups.");
      } catch(e) {
        console.error(e); setError("Failed to load backups.");
      } finally { setLoading(false); }
      setTimeout(()=>inputRef.current?.focus(), 50);
    })();
  }, [open]);

  async function doCreate(e){ e?.preventDefault();
    setError(""); setStatus("Creating backup…");
    try {
      const res = await api.create((name||"").trim());
      if (res?.ok) {
        setStatus("Backup saved.");
        const list = await api.list(); if (list?.ok) setItems(list.backups||[]);
      } else setError(res?.error||"Backup failed.");
    } catch(e){ console.error(e); setError("Backup failed. See console."); }
    finally { setTimeout(()=>setStatus(""), 1200); }
  }
  async function doRestore(id){
    setError(""); setStatus("Restoring…");
    try {
      const res = await api.restoreById?.(id);
      if (res?.ok) setStatus("Restored.");
      else setError(res?.error||"Restore failed.");
    } catch(e){ console.error(e); setError("Restore failed. See console."); }
    finally { setTimeout(()=>setStatus(""), 1200); }
  }
  async function doDelete(id){
    if (!confirm("Delete this backup permanently?")) return;
    setError(""); setStatus("Deleting…");
    try {
      const res = await api.deleteById?.(id);
      if (res?.ok) {
        setStatus("Deleted.");
        const list = await api.list(); if (list?.ok) setItems(list.backups||[]);
      } else setError(res?.error||"Delete failed.");
    } catch(e){ console.error(e); setError("Delete failed. See console."); }
    finally { setTimeout(()=>setStatus(""), 1000); }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 p-4">
      <div className="mt-10 w-full max-w-3xl rounded-2xl bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Backups</h2>
          <button onClick={onClose} className="rounded-xl border px-3 py-1 text-sm hover:bg-gray-50">Close</button>
        </div>

        <form onSubmit={doCreate} className="mt-4 flex gap-2">
          <input
            ref={inputRef}
            value={name}
            onChange={e=>setName(e.target.value)}
            className="w-full rounded-xl border px-3 py-2"
            placeholder="Backup name (optional)"
          />
          <button type="submit" className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Create Backup
          </button>
        </form>

        <div className="mt-3 text-sm">
          {loading && <span>Loading… </span>}
          {status && <span className="text-green-700">{status} </span>}
          {error && <span className="text-red-700">{error}</span>}
        </div>

        <div className="mt-4 max-h-[50vh] overflow-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Size</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length===0 && (
                <tr><td className="px-3 py-6 text-gray-500" colSpan={4}>No backups yet.</td></tr>
              )}
              {sorted.map(b=>(
                <tr key={b.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{b.name || b.id}</div>
                    <div className="text-xs text-gray-500">{b.id}</div>
                  </td>
                  <td className="px-3 py-2">{b.createdAt?.replace("T"," ").replace("Z","") || "—"}</td>
                  <td className="px-3 py-2">{fmtBytes(b.bytes)}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button onClick={()=>doRestore(b.id)} className="rounded-lg border px-3 py-1 hover:bg-gray-50">Restore</button>
                      <button onClick={()=>doDelete(b.id)} className="rounded-lg border px-3 py-1 hover:bg-gray-50">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
          <div>Tip: you can also restore the <em>latest</em> backup.</div>
          <button
            onClick={() => api.restoreLatest?.().then(()=>setStatus("Restored latest."))}
            className="rounded-lg border px-3 py-1 hover:bg-gray-50"
          >
            Restore Latest
          </button>
        </div>
      </div>
    </div>
  );
}
