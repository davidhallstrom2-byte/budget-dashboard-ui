import React, { useMemo } from "react";

const FIELD_ORDER = [
  "details",
  "date",
  "deadline",
  "phone",
  "address",
  "person",
  "organization",
  "website",
  "systemLink",
  "caseNumber",
  "policyNumber",
  "plate",
  "vin",
  "vehicle",
  "company",
  "policyStatus",
  "effectiveDate",
  "amount",
  "documents",
  "questions",
  "requiredAction",
  "impact",
  "outcome",
  "notes",
];

const FIELD_LABELS = {
  details: "Details",
  date: "Date",
  deadline: "Deadline",
  phone: "Phone",
  address: "Address",
  person: "Person",
  organization: "Organization",
  website: "Website",
  systemLink: "System Link",
  caseNumber: "Case / Citation #",
  policyNumber: "Policy #",
  plate: "Plate",
  vin: "VIN",
  vehicle: "Vehicle",
  company: "Company",
  policyStatus: "Policy Status",
  effectiveDate: "Effective Date",
  amount: "Amount",
  documents: "Documents",
  questions: "Questions",
  requiredAction: "Required Action",
  impact: "Impact",
  outcome: "Outcome",
  notes: "Notes",
};

const TYPE_COLORS = {
  Medical: "#2563eb",
  "DMV / Vehicle": "#ea580c",
  Insurance: "#dc2626",
  "DPSS / Benefits": "#16a34a",
  Legal: "#7c3aed",
  Moving: "#0891b2",
  Work: "#334155",
  Dental: "#db2777",
  "Phone / Lifeline": "#0f766e",
  General: "#475569",
};

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const cleanDisplayValue = (value = "") =>
  String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const formatDateForFile = () => {
  const now = new Date();
  return now.toISOString().slice(0, 10);
};

const groupTasksByType = (tasks) =>
  tasks.reduce((groups, task) => {
    const type = task.type || "General";
    if (!groups[type]) groups[type] = [];
    groups[type].push(task);
    return groups;
  }, {});

const buildPrintableHtml = (tasks) => {
  const grouped = groupTasksByType(tasks);

  const sections = Object.entries(grouped)
    .map(([type, items]) => {
      const color = TYPE_COLORS[type] || TYPE_COLORS.General;

      const taskCards = items
        .map((task) => {
          const fields = FIELD_ORDER.filter((field) => cleanDisplayValue(task[field]));

          const fieldRows = fields
            .map(
              (field) => `
                <div class="field-row">
                  <div class="field-label">${escapeHtml(FIELD_LABELS[field] || field)}</div>
                  <div class="field-value">${escapeHtml(cleanDisplayValue(task[field])).replaceAll("\n", "<br>")}</div>
                </div>
              `
            )
            .join("");

          return `
            <article class="task-card">
              <div class="task-title-row">
                <span class="checkbox">☐</span>
                <h3>${escapeHtml(task.taskName || "Untitled task")}</h3>
              </div>
              ${fieldRows}
            </article>
          `;
        })
        .join("");

      return `
        <section class="type-section">
          <div class="type-heading" style="border-left-color:${color}">
            <h2>${escapeHtml(type)}</h2>
            <span>${items.length} item${items.length === 1 ? "" : "s"}</span>
          </div>
          ${taskCards}
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Hallstrom Premium To-Do List</title>
  <style>
    body {
      margin: 0;
      padding: 32px;
      font-family: Cambria, Georgia, serif;
      color: #0f172a;
      background: #f8fafc;
    }

    .page {
      max-width: 850px;
      margin: 0 auto;
      background: #ffffff;
      padding: 36px;
      border-radius: 22px;
      border: 1px solid #dbe4f0;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    }

    .title {
      text-align: center;
      border-bottom: 3px solid #0f172a;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }

    .title h1 {
      margin: 0;
      font-size: 32px;
      font-weight: 800;
    }

    .title p {
      margin: 8px 0 0;
      color: #475569;
      font-size: 15px;
    }

    .type-section {
      margin-top: 26px;
      break-inside: avoid;
    }

    .type-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-left: 7px solid #475569;
      background: #f1f5f9;
      padding: 10px 14px;
      border-radius: 12px;
      margin-bottom: 12px;
    }

    .type-heading h2 {
      margin: 0;
      font-size: 18px;
    }

    .type-heading span {
      font-size: 13px;
      color: #64748b;
      font-weight: 700;
    }

    .task-card {
      border: 1px solid #dbe4f0;
      border-radius: 14px;
      padding: 14px 16px;
      margin-bottom: 12px;
      background: #ffffff;
      break-inside: avoid;
    }

    .task-title-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 10px;
    }

    .checkbox {
      font-size: 18px;
      line-height: 1.2;
    }

    .task-title-row h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 800;
    }

    .field-row {
      display: grid;
      grid-template-columns: 145px 1fr;
      gap: 12px;
      padding: 5px 0;
      border-top: 1px solid #eef2f7;
      font-size: 13.5px;
    }

    .field-label {
      font-weight: 800;
      color: #334155;
    }

    .field-value {
      color: #0f172a;
      line-height: 1.35;
    }

    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }

      .page {
        box-shadow: none;
        border: none;
        border-radius: 0;
        padding: 0;
        max-width: none;
      }

      @page {
        size: Letter;
        margin: 0.5in;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="title">
      <h1>Hallstrom Premium To-Do List</h1>
      <p>Structured life management list, generated ${formatDateForFile()}</p>
    </header>
    ${sections}
  </main>
</body>
</html>`;
};

export default function PremiumTodoListView({ tasks = [], onClose }) {
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;

      const aDate = Date.parse(a.deadline || a.date || "");
      const bDate = Date.parse(b.deadline || b.date || "");

      if (Number.isNaN(aDate) && Number.isNaN(bDate)) return 0;
      if (Number.isNaN(aDate)) return 1;
      if (Number.isNaN(bDate)) return -1;

      return aDate - bDate;
    });
  }, [tasks]);

  const groupedTasks = useMemo(() => groupTasksByType(sortedTasks), [sortedTasks]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const html = buildPrintableHtml(sortedTasks);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `Hallstrom_Premium_To-Do_List_${formatDateForFile()}.html`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 px-4 py-6 print:static print:bg-white print:p-0">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden !important;
            }

            .premium-todo-print-root,
            .premium-todo-print-root * {
              visibility: visible !important;
            }

            .premium-todo-print-root {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              box-shadow: none !important;
              border: none !important;
            }

            .premium-no-print {
              display: none !important;
            }

            @page {
              size: Letter;
              margin: 0.5in;
            }
          }
        `}
      </style>

      <div className="premium-no-print mx-auto mb-4 flex max-w-[900px] items-center justify-between gap-3">
        <button
          onClick={onClose}
          className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm"
        >
          Close
        </button>

        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm"
          >
            Print
          </button>

          <button
            onClick={handleDownload}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm"
          >
            Download
          </button>
        </div>
      </div>

      <main className="premium-todo-print-root mx-auto max-w-[900px] rounded-[22px] border border-slate-200 bg-white p-9 font-serif text-slate-900 shadow-2xl print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="mb-6 border-b-[3px] border-slate-900 pb-4 text-center">
          <h1 className="m-0 text-[32px] font-extrabold leading-tight">
            Hallstrom Premium To-Do List
          </h1>
          <p className="mt-2 text-[15px] text-slate-600">
            Structured life management list, generated {formatDateForFile()}
          </p>
        </header>

        {sortedTasks.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
            No tasks available.
          </div>
        ) : (
          Object.entries(groupedTasks).map(([type, items]) => {
            const color = TYPE_COLORS[type] || TYPE_COLORS.General;

            return (
              <section key={type} className="mt-7 break-inside-avoid">
                <div
                  className="mb-3 flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3"
                  style={{ borderLeft: `7px solid ${color}` }}
                >
                  <h2 className="m-0 text-lg font-extrabold">{type}</h2>
                  <span className="text-sm font-bold text-slate-500">
                    {items.length} item{items.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="space-y-3">
                  {items.map((task) => {
                    const fields = FIELD_ORDER.filter((field) => cleanDisplayValue(task[field]));

                    return (
                      <article
                        key={task.id || task.taskName}
                        className="break-inside-avoid rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="mb-3 flex items-start gap-3">
                          <span className="text-lg leading-tight">☐</span>
                          <h3 className="m-0 text-base font-extrabold leading-snug">
                            {task.taskName || "Untitled task"}
                          </h3>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {fields.map((field) => (
                            <div
                              key={field}
                              className="grid grid-cols-[145px_1fr] gap-3 py-1 text-[13.5px]"
                            >
                              <div className="font-extrabold text-slate-700">
                                {FIELD_LABELS[field] || field}
                              </div>
                              <div className="whitespace-pre-wrap leading-snug text-slate-900">
                                {cleanDisplayValue(task[field])}
                              </div>
                            </div>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}