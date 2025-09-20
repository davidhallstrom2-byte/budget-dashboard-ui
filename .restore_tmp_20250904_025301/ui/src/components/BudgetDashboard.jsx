// src/components/BudgetDashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sun, Moon, Archive } from "lucide-react";
import {
  loadState, saveState, loadDark, saveDark,
} from "../lib/storage";
import {
  addMonthsSafe, normalizeDateString,
} from "../lib/date";
import {
  nonArchivedOf, totalsOf, categoryTotalsOf, upcomingPaymentsOf, sectionLabel, flatRowsOf, totalsByCategoryOf,
} from "../lib/derive";

import DashboardTab from "./tabs/DashboardTab.jsx";
import AnalysisTab from "./tabs/AnalysisTab.jsx";
import CalculatorTab from "./tabs/CalculatorTab.jsx";
import EditorTab from "./tabs/EditorTab.jsx";
import Toasts from "./ui/Toasts.jsx";
import ArchivedDrawer from "./ui/ArchivedDrawer.jsx";

const isDark = () =>
  !!(typeof document !== "undefined" && document.body?.classList?.contains("dark"));
const setDark = (value) => {
  document.body.classList.toggle("dark", value);
  saveDark(value);
};

export default function BudgetDashboard() {
  const importRef = useRef(null);
  const toastTimers = useRef(new Map());

  const seed = {
    income: [{ category: "Income", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming", archived: false }],
    housing: [
      { category: "Rent", estBudget: 0, actualSpent: 0, dueDate: "2025-09-01", bankSource: "Upcoming", archived: false },
      { category: "Spectrum Internet", estBudget: 132.25, actualSpent: 0, dueDate: "2025-09-09", bankSource: "Upcoming", archived: false },
      { category: "Spectrum Mobile", estBudget: 325.40, actualSpent: 0, dueDate: "2025-09-04", bankSource: "Upcoming", archived: false }
    ],
    transportation: [
      { category: "Gas/Fuel", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming", archived: false },
      { category: "Car Insurance", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming", archived: false },
      { category: "Maintenance", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming", archived: false },
      { category: "Uber One", estBudget: 9.99, actualSpent: 0, dueDate: "2025-09-14", bankSource: "Upcoming", archived: false }
    ],
    food: [
      { category: "Groceries", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming", archived: false },
      { category: "Restaurants/Dining Out", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming", archived: false },
      { category: "Street Food", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming", archived: false },
      { category: "Instacart", estBudget: 0, actualSpent: 0, dueDate: "2025-09-23", bankSource: "Upcoming", archived: false, annualSub: 79.0 }
    ],
    personal: [
      { category: "MoviePass", estBudget: 9.99, actualSpent: 0, dueDate: "2025-09-04", bankSource: "Upcoming", archived: false },
      { category: "Xbox Game Pass", estBudget: 19.99, actualSpent: 0, dueDate: "2025-09-04", bankSource: "Upcoming", archived: false },
      { category: "MLB.tv", estBudget: 24.99, actualSpent: 0, dueDate: "2025-09-14", bankSource: "Upcoming", archived: false },
      { category: "Hulu", estBudget: 11.99, actualSpent: 0, dueDate: "2025-09-15", bankSource: "Upcoming", archived: false },
      { category: "Paramount+", estBudget: 10.99, actualSpent: 0, dueDate: "2025-09-20", bankSource: "Upcoming", archived: false },
      { category: "Netflix", estBudget: 26.99, actualSpent: 0, dueDate: "2025-09-27", bankSource: "Upcoming", archived: false },
      { category: "Prime", estBudget: 14.99, actualSpent: 0, dueDate: "2025-09-29", bankSource: "Upcoming", archived: false },
      { category: "ESPN+", estBudget: 10.99, actualSpent: 0, dueDate: "2025-09-29", bankSource: "Upcoming", archived: false },
      { category: "CVS ExtraCare", estBudget: 5.48, actualSpent: 0, dueDate: "2025-09-16", bankSource: "Upcoming", archived: false }
    ],
    homeOffice: [
      { category: "LinkedIn Premium", estBudget: 29.99, actualSpent: 0, dueDate: "2025-09-19", bankSource: "Upcoming", archived: false },
      { category: "Google AI Pro", estBudget: 19.99, actualSpent: 0, dueDate: "2025-09-20", bankSource: "Upcoming", archived: false },
      { category: "ChatGPT Plus", estBudget: 19.99, actualSpent: 0, dueDate: "2025-08-27", bankSource: "Upcoming", archived: false },
      { category: "SuperGrok (trial)", estBudget: 30.0, actualSpent: 0, dueDate: "2025-09-14", bankSource: "Upcoming", archived: false }
    ],
    banking: [
      { category: "Wells Fargo Service Fee", estBudget: 25.0, actualSpent: 0, dueDate: "2025-09-01", bankSource: "Upcoming", archived: false },
      { category: "Credit One Bank", estBudget: 43.0, actualSpent: 0, dueDate: "2025-08-22", bankSource: "Upcoming", archived: false }
    ],
    misc: [
      { category: "Gifts/Donations", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming", archived: false },
      { category: "Entertainment", estBudget: 0, actualSpent: 0, dueDate: "", bankSource: "Upcoming", archived: false }
    ],
  };

  const [budgetData, _setBudgetData] = useState(seed);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showOptimizations, setShowOptimizations] = useState(false);
  const [newIncomeAmount, setNewIncomeAmount] = useState("");
  const [newItemForm, setNewItemForm] = useState({ category: "", itemName: "", amount: "", dueDate: "", annualSub: "" });
  const [showAddForm, setShowAddForm] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [archivedOpen, setArchivedOpen] = useState(false);

  const persist = (nextBudget) => {
    saveState({ budgetData: nextBudget, activeTab, showAddForm, newItemForm, newIncomeAmount });
    saveDark(isDark());
  };
  const setBudgetData = (producer) => {
    _setBudgetData((prev) => {
      const next = typeof producer === "function" ? producer(prev) : producer;
      persist(next);
      return next;
    });
  };

  useEffect(() => {
    const saved = loadState();
    if (saved) {
      if (saved.budgetData) _setBudgetData(saved.budgetData);
      if (saved.activeTab) setActiveTab(saved.activeTab);
      if (typeof saved.showAddForm === "boolean") setShowAddForm(saved.showAddForm);
      if (saved.newItemForm) setNewItemForm(saved.newItemForm);
      if (saved.newIncomeAmount) setNewIncomeAmount(saved.newIncomeAmount);
    }
    const dark = loadDark();
    if (dark !== null) setDark(dark);
  }, []);

  useEffect(() => {
    const onUnload = () => persist(budgetData);
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [budgetData, activeTab, showAddForm, newItemForm, newIncomeAmount]);

  const handleExport = () => {
    const url = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(budgetData, null, 2));
    const a = document.createElement("a");
    a.href = url; a.download = "budget-data.json"; a.click();
  };
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "s") { e.preventDefault(); handleExport(); }
      if (key === "i") { e.preventDefault(); importRef.current?.click(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [budgetData]);

  const nonArchived = useMemo(() => nonArchivedOf(budgetData), [budgetData]);
  const totals = useMemo(() => totalsOf(nonArchived), [nonArchived]);
  const pieData = useMemo(() => categoryTotalsOf(nonArchived), [nonArchived]);
  const upcoming = useMemo(() => upcomingPaymentsOf(nonArchived), [nonArchived]);
  const flatRows = useMemo(() => flatRowsOf(nonArchived), [nonArchived]);
  const totalsByCategory = useMemo(() => totalsByCategoryOf(nonArchived), [nonArchived]);

  const removeToast = (id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const tid = toastTimers.current.get(id);
    if (tid) { clearTimeout(tid); toastTimers.current.delete(id); }
  };
  const pushToast = (message, onUndo) => {
    const id = Math.random().toString(36).slice(2);
    const timeoutId = window.setTimeout(() => removeToast(id), 10000);
    toastTimers.current.set(id, timeoutId);
    setToasts((t) => [...t, { id, message, onUndo }]);
  };

  const setItem = (cat, idx, patch) =>
    setBudgetData((p) => ({ ...p, [cat]: p[cat].map((i, k) => (k === idx ? { ...i, ...patch } : i)) }));

  const updateExpense = (cat, idx, value) => setItem(cat, idx, { estBudget: Number(value || 0) });
  const updateActual  = (cat, idx, value) => setItem(cat, idx, { actualSpent: Number(value || 0) });
  const updateName    = (cat, idx, v)     => setItem(cat, idx, { category: v });
  const updateDueDate = (cat, idx, date)  => setItem(cat, idx, { dueDate: normalizeDateString(date) });

  const toggleArchive = (cat, idx) => setItem(cat, idx, { archived: !budgetData[cat][idx]?.archived });

  const deleteItem = (cat, idx) => {
    const item = budgetData[cat][idx];
    setBudgetData((p) => ({ ...p, [cat]: p[cat].filter((_, k) => k !== idx) }));
    pushToast(`Deleted "${item.category}" from ${sectionLabel(cat)}.`, () => {
      setBudgetData((p) => {
        const arr = [...p[cat]];
        arr.splice(idx, 0, item);
        return { ...p, [cat]: arr };
      });
    });
  };

  const markAsPaid = (cat, idx) => {
    const prev = budgetData[cat][idx];
    const months = prev.annualSub && prev.annualSub > 0 ? 12 : 1;
    const nextDue = prev.dueDate ? addMonthsSafe(prev.dueDate, months) : prev.dueDate;
    setItem(cat, idx, { bankSource: "Paid", actualSpent: prev.estBudget || prev.annualSub || 0, dueDate: nextDue });
    pushToast(`Marked "${prev.category}" paid.`, () => setItem(cat, idx, { ...prev }));
  };

  const addIncome = () => {
    const amt = parseFloat(newIncomeAmount || "0");
    if (!amt || amt <= 0) return;
    setBudgetData((p) => ({ ...p, income: [{ category: "Income", estBudget: amt, actualSpent: 0, dueDate: "", bankSource: "Upcoming", archived: false }] }));
    setNewIncomeAmount("");
  };

  const addNewItem = () => {
    if (!newItemForm.category || !newItemForm.itemName || !newItemForm.amount) {
      pushToast("Fill category, item name, and amount", null);
      return;
    }
    const item = {
      category: newItemForm.itemName, estBudget: parseFloat(newItemForm.amount), actualSpent: 0,
      dueDate: normalizeDateString(newItemForm.dueDate), bankSource: "Upcoming", archived: false,
      ...(newItemForm.annualSub ? { annualSub: parseFloat(newItemForm.annualSub) } : {})
    };
    setBudgetData((p) => ({ ...p, [newItemForm.category]: [...p[newItemForm.category], item] }));
    setNewItemForm({ category: "", itemName: "", amount: "", dueDate: "", annualSub: "" });
    setShowAddForm(false);
    pushToast("Item added.", null);
  };

  const handleImport = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        Object.keys(parsed).forEach((k) => {
          parsed[k] = (parsed[k] || []).map((i) => ({
            ...i,
            estBudget: Number(i.estBudget ?? 0),
            actualSpent: Number(i.actualSpent ?? 0),
            dueDate: normalizeDateString(i.dueDate ?? ""),
            archived: !!i.archived,
          }));
        });
        setBudgetData(parsed);
        pushToast("Import successful.", null);
      } catch {
        pushToast("Import failed: invalid JSON.", null);
      }
    };
    reader.readAsText(file);
  };

  const archivedList = useMemo(() => {
    const out = [];
    for (const cat of Object.keys(budgetData)) {
      (budgetData[cat] || []).forEach((item, idx) => {
        if (item.archived) out.push({ cat, idx, item, label: sectionLabel(cat) });
      });
    }
    return out;
  }, [budgetData]);

  return (
    <>
      <div className="sticky top-0 z-50 bg-white/80 dark:bg-neutral-900/80 backdrop-blur border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <nav className="flex gap-2" aria-label="Sections">
              {["dashboard", "analysis", "calculator", "editor"].map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-3 py-1.5 rounded-md text-sm border ${
                    activeTab === t
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-white text-gray-700 hover:bg-gray-50 border-gray-200"
                  }`}
                  role="tab"
                  aria-selected={activeTab === t}
                  aria-controls={`panel-${t}`}
                  id={`tab-${t}`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setArchivedOpen(true)}
                className="px-3 py-1.5 rounded-md text-sm border bg-white hover:bg-gray-50 text-gray-700"
                title="Show archived items"
              >
                <Archive className="inline h-4 w-4 mr-1" />
                Archived ({archivedList.length})
              </button>

              <button
                onClick={() => setDark(!isDark())}
                className="px-3 py-1.5 rounded-md text-sm border bg-white hover:bg-gray-50 text-gray-700"
                aria-label="Toggle dark mode"
                title="Toggle dark mode"
              >
                {isDark() ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {activeTab === "dashboard" && (
          <DashboardTab
            totals={totals} pieData={pieData} upcoming={upcoming}
            flatRows={flatRows} totalsByCategory={totalsByCategory}
          />
        )}
        {activeTab === "analysis" && (
          <AnalysisTab
            pieData={pieData} totals={totals} nonArchived={nonArchived}
            showOptimizations={showOptimizations} setShowOptimizations={setShowOptimizations}
          />
        )}
        {activeTab === "calculator" && (
          <CalculatorTab newIncomeAmount={newIncomeAmount} setNewIncomeAmount={setNewIncomeAmount} addIncome={addIncome} />
        )}
        {activeTab === "editor" && (
          <EditorTab
            importRef={importRef} handleImport={handleImport} handleExport={handleExport}
            budgetData={budgetData} sectionLabel={sectionLabel}
            newItemForm={newItemForm} setNewItemForm={setNewItemForm}
            showAddForm={showAddForm} setShowAddForm={setShowAddForm}
            addNewItem={addNewItem} updateName={updateName} updateExpense={updateExpense}
            updateActual={updateActual} updateDueDate={updateDueDate}
            markAsPaid={markAsPaid} toggleArchive={toggleArchive} deleteItem={deleteItem}
          />
        )}
      </div>

      <ArchivedDrawer
        open={archivedOpen}
        onClose={() => setArchivedOpen(false)}
        archivedList={archivedList}
        onUnarchive={(cat, idx) => toggleArchive(cat, idx)}
        onDelete={(cat, idx) => deleteItem(cat, idx)}
      />

      <Toasts
        toasts={toasts}
        onUndo={(t) => { t.onUndo?.(); removeToast(t.id); }}
        onClose={(id) => removeToast(id)}
      />
    </>
  );
}
