import React, { useMemo } from "react";
import CloseScreenButton from "../common/CloseScreenButton.jsx";

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

const renderInlineFormatting = (value = "") => {
  let html = escapeHtml(value);

  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, label, url) => `<a href="${url}" target="_blank" rel="noreferrer">${label}</a>`
  );

  html = html
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<u>$1</u>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");

  return html;
};

const formatTextToHtml = (value = "") => {
  const lines = String(value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const html = [];
  let listType = "";

  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = "";
    }
  };

  lines.forEach((line) => {
    const bulletMatch = line.match(/^\s*[-*]\s+(.+)$/);
    const numberMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);

    if (!line.trim()) {
      closeList();
      html.push('<div class="formatted-spacer"></div>');
      return;
    }

    if (bulletMatch) {
      if (listType !== "ul") {
        closeList();
        html.push("<ul>");
        listType = "ul";
      }
      html.push(`<li>${renderInlineFormatting(bulletMatch[1])}</li>`);
      return;
    }

    if (numberMatch) {
      if (listType !== "ol") {
        closeList();
        html.push("<ol>");
        listType = "ol";
      }
      html.push(`<li>${renderInlineFormatting(numberMatch[1])}</li>`);
      return;
    }

    closeList();
    html.push(`<p>${renderInlineFormatting(line)}</p>`);
  });

  closeList();
  return html.join("");
};

const FormattedText = ({ value, className = "" }) => {
  const html = formatTextToHtml(value);
  if (!html) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
};

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
                  <div class="field-value">${formatTextToHtml(cleanDisplayValue(task[field]))}</div>
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
  <title>To Do List</title>
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

    .field-value p {
      margin: 0 0 4px;
    }

    .field-value ul,
    .field-value ol {
      margin: 0 0 4px 20px;
      padding: 0;
    }

    .field-value li {
      margin: 0 0 3px;
    }

    .field-value a {
      color: #1d4ed8;
      font-weight: 700;
      text-decoration: underline;
    }

    .formatted-spacer {
      height: 8px;
    }

    @media (max-width: 640px) {
      body {
        padding: 8px;
      }

      .page {
        width: 100%;
        max-width: none;
        box-sizing: border-box;
        padding: 12px;
        border-radius: 14px;
      }

      .title {
        padding-bottom: 10px;
        margin-bottom: 12px;
        border-bottom-width: 2px;
      }

      .title h1 {
        font-size: 21px;
        line-height: 1.15;
      }

      .title p {
        margin-top: 5px;
        font-size: 11px;
        line-height: 1.3;
      }

      .type-section {
        margin-top: 14px;
      }

      .type-heading {
        padding: 7px 9px;
        margin-bottom: 7px;
        border-left-width: 5px;
        border-radius: 9px;
      }

      .type-heading h2 {
        font-size: 15px;
      }

      .type-heading span {
        font-size: 11px;
      }

      .task-card {
        padding: 9px 10px;
        margin-bottom: 8px;
        border-radius: 10px;
      }

      .task-title-row {
        gap: 7px;
        margin-bottom: 6px;
      }

      .checkbox {
        font-size: 15px;
      }

      .task-title-row h3 {
        font-size: 14px;
        line-height: 1.25;
      }

      .field-row {
        grid-template-columns: 78px minmax(0, 1fr);
        gap: 7px;
        padding: 4px 0;
        font-size: 12px;
      }

      .field-value {
        min-width: 0;
        overflow-wrap: anywhere;
        line-height: 1.3;
      }

      .field-value ul,
      .field-value ol {
        margin-left: 16px;
      }

      .formatted-spacer {
        height: 5px;
      }
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
      <h1>To Do List</h1>
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
    link.download = `To_Do_List_${formatDateForFile()}.html`;
    link.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 px-2 py-3 sm:px-4 sm:py-6 print:static print:bg-white print:p-0">
      <style>
        {`
          .formatted-task-text p {
            margin: 0 0 4px;
          }

          .formatted-task-text ul,
          .formatted-task-text ol {
            margin: 0 0 4px 20px;
            padding: 0;
          }

          .formatted-task-text li {
            margin: 0 0 3px;
          }

          .formatted-task-text a {
            color: #1d4ed8;
            font-weight: 700;
            text-decoration: underline;
          }

          .formatted-spacer {
            height: 8px;
          }

          @media (max-width: 640px) {
            .premium-todo-toolbar {
              margin-bottom: 8px;
            }

            .premium-todo-toolbar button {
              min-height: 34px;
              padding: 6px 10px;
              border-radius: 9px;
              font-size: 12px;
            }

            .premium-todo-print-root {
              width: 100%;
              box-sizing: border-box;
            }

            .premium-todo-field-value {
              min-width: 0;
              overflow-wrap: anywhere;
            }

            .formatted-task-text p {
              margin-bottom: 3px;
            }

            .formatted-task-text ul,
            .formatted-task-text ol {
              margin-left: 16px;
            }

            .formatted-spacer {
              height: 5px;
            }
          }

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

      <div className="premium-todo-toolbar premium-no-print mx-auto mb-4 flex max-w-[900px] items-center justify-between gap-2">
        <CloseScreenButton onClick={onClose} />

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

      <main className="premium-todo-print-root mx-auto w-full max-w-[900px] rounded-xl border border-slate-200 bg-white p-3 font-serif text-slate-900 shadow-2xl sm:rounded-[22px] sm:p-9 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="mb-3 border-b-2 border-slate-900 pb-2 text-center sm:mb-6 sm:border-b-[3px] sm:pb-4">
          <h1 className="m-0 text-xl font-extrabold leading-tight sm:text-[32px]">
            To Do List
          </h1>
          <p className="mt-1 text-[11px] leading-snug text-slate-600 sm:mt-2 sm:text-[15px]">
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
              <section key={type} className="mt-4 break-inside-avoid sm:mt-7">
                <div
                  className="mb-2 flex items-center justify-between rounded-lg border-l-[5px] bg-slate-100 px-3 py-2 sm:mb-3 sm:rounded-xl sm:border-l-[7px] sm:px-4 sm:py-3"
                  style={{ borderLeftColor: color }}
                >
                  <h2 className="m-0 text-[15px] font-extrabold sm:text-lg">{type}</h2>
                  <span className="text-[11px] font-bold text-slate-500 sm:text-sm">
                    {items.length} item{items.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {items.map((task) => {
                    const fields = FIELD_ORDER.filter((field) => cleanDisplayValue(task[field]));

                    return (
                      <article
                        key={task.id || task.taskName}
                        className="break-inside-avoid rounded-xl border border-slate-200 bg-white px-3 py-2.5 sm:rounded-2xl sm:px-4 sm:py-3"
                      >
                        <div className="mb-2 flex items-start gap-2 sm:mb-3 sm:gap-3">
                          <span className="text-[15px] leading-tight sm:text-lg">☐</span>
                          <h3 className="m-0 text-sm font-extrabold leading-snug sm:text-base">
                            {task.taskName || "Untitled task"}
                          </h3>
                        </div>

                        <div className="divide-y divide-slate-100">
                          {fields.map((field) => (
                            <div
                              key={field}
                              className="grid grid-cols-[78px_minmax(0,1fr)] gap-2 py-1 text-xs sm:grid-cols-[145px_minmax(0,1fr)] sm:gap-3 sm:text-[13.5px]"
                            >
                              <div className="font-extrabold text-slate-700">
                                {FIELD_LABELS[field] || field}
                              </div>
                              <FormattedText
                                value={cleanDisplayValue(task[field])}
                                className="premium-todo-field-value formatted-task-text leading-snug text-slate-900"
                              />
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
