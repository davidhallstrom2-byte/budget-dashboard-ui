// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\components\modern\OptimizationSuggestions.jsx
import React, { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const getState = () => {
  try {
    const raw = localStorage.getItem("bd:state");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function OptimizationSuggestions() {
  const [show, setShow] = useState(false);
  const budgetData = (getState()?.modernBudgetData) || {};

  const nonArchived = useMemo(() => {
    const out={}; for(const k of Object.keys(budgetData)) out[k]=(budgetData[k]||[]).filter(i=>!i.archived); return out;
  }, [budgetData]);

  const totals = useMemo(() => {
    const income=(nonArchived.income||[]).reduce((s,i)=>s+(i.estBudget||0),0);
    let expenses=0; Object.keys(nonArchived).forEach(k=>{ if(k!=="income")(nonArchived[k]||[]).forEach(i=>expenses+=i.estBudget||0); });
    return { income, expenses };
  }, [nonArchived]);

  const streaming = (nonArchived.personal||[]).filter(i=>['Netflix','Hulu','Paramount+','Prime','ESPN+','MLB.tv','MoviePass'].some(s=>i.category?.includes(s)));
  const streamingCost = streaming.reduce((s,i)=>s+(i.estBudget||0),0);
  const spectrumMobile=(nonArchived.housing||[]).find(i=>i.category==="Spectrum Mobile");
  const ai=(nonArchived.homeOffice||[]).filter(i=>['ChatGPT','Google AI','SuperGrok'].some(s=>i.category?.includes(s)));
  const aiCost=ai.reduce((s,i)=>s+(i.estBudget||0),0);
  const bankingFees=(nonArchived.banking||[]).reduce((s,i)=>s+(i.estBudget||0),0);

  const suggestions = [
    ...(totals.income===0?[{type:"critical",title:"Add Income Source",desc:"No income recorded. Add expected income to see your true position."}]:[]),
    ...(spectrumMobile && spectrumMobile.estBudget>100?[{type:"high",title:"Expensive Mobile Plan",desc:`Spectrum Mobile (${spectrumMobile.estBudget}/month) looks high—consider alternatives.`}]:[]),
    ...(streamingCost>75?[{type:"warning",title:"High Entertainment Spending",desc:`$${streamingCost.toFixed(2)}/month on ${streaming.length} streaming services.`}]:[]),
    ...(aiCost>50?[{type:"medium",title:"Multiple AI Subscriptions",desc:`$${aiCost.toFixed(2)}/month on ${ai.length} AI tools.`}]:[]),
    ...(bankingFees>40?[{type:"medium",title:"High Banking Fees",desc:`$${bankingFees.toFixed(2)}/month in banking fees.`}]:[]),
  ];

  const box = (c) => ({
    critical: "bg-red-50 border-red-500",
    high: "bg-blue-50 border-blue-400",
    warning: "bg-yellow-50 border-yellow-500",
    medium: "bg-blue-50 border-blue-400",
    info: "bg-blue-50 border-blue-400",
  }[c] || "bg-blue-50 border-blue-400");

  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Optimization Suggestions</h3>
        <button
          onClick={() => setShow(v=>!v)}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {show ? "Hide Details" : "Show Details"}
        </button>
      </div>

      <div className="space-y-4">
        {suggestions.length===0 ? (
          <p className="text-sm text-gray-600">Your budget looks well optimized!</p>
        ) : suggestions.map((s, i)=>(
          <div key={i} className={`p-4 rounded-xl border ${box(s.type)}`}>
            <h4 className="font-semibold">{s.title}</h4>
            <p className="text-sm text-gray-700 mt-1">{s.desc}</p>
            {show && (
              <div className="mt-2 p-2 bg-white rounded border">
                <p className="text-sm">Tip: trim overlapping subscriptions and renegotiate expensive plans.</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
