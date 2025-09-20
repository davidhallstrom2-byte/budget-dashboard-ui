// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\utils\receipts\csv.js
function esc(s) {
  const v = String(s ?? "");
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function num(n) {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

export function receiptsToCsv(receipts = []) {
  const headers = [
    "merchant",
    "date",
    "currency",
    "subtotal",
    "tax",
    "total",
    "items_count",
    "categories", // pipe-delimited unique categories
    "items_json", // full items JSON for traceability
  ];

  const lines = [headers.join(",")];

  for (const r of receipts) {
    const items = Array.isArray(r?.items) ? r.items : [];
    const cats = Array.from(
      new Set(
        items
          .map((it) => String(it?.category || ""))
          .filter(Boolean)
          .map((c) => c.toLowerCase())
      )
    ).join("|");

    const row = [
      esc(r?.merchant),
      esc(r?.date),
      esc(r?.currency || "USD"),
      num(r?.subtotal).toFixed(2),
      num(r?.tax).toFixed(2),
      num(r?.total).toFixed(2),
      items.length,
      esc(cats),
      esc(JSON.stringify(items)),
    ];
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

export function downloadCsv(name, csvString) {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name.endsWith(".csv") ? name : `${name}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
