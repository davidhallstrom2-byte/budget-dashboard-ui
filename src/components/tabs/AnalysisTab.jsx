import React, { useMemo } from "react";

export default function AnalysisTab({ state }) {
  const data = state?.budgetData || {};
  const income = (data.income || []).reduce((a,b)=>a+Number(b.amount||0),0);
  const debtMins = (data.banking || []).reduce((a,b)=>a+Number(b.minPayment||b.amount||0),0);
  const loans    = (data.personal || []).reduce((a,b)=>a+Number(b.minPayment||0),0);
  const monthlyDebt = debtMins + loans;
  const dti = income>0 ? (monthlyDebt / income) : 0;

  const status = useMemo(()=>{
    if (dti < 0.36) return {label:"Good",   color:"text-emerald-600"};
    if (dti <= 0.43) return {label:"Caution",color:"text-amber-600"};
    return {label:"Risky",  color:"text-red-600"};
  },[dti]);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-3">Analysis</h2>
      <div className="grid sm:grid-cols-3 gap-4">
        <Card title="Gross Monthly Income" value={`$${income.toFixed(2)}`} />
        <Card title="Monthly Debt Payments" value={`$${monthlyDebt.toFixed(2)}`} />
        <Card title="DTI" value={`${(dti*100).toFixed(1)}%`} subtitle={<span className={status.color}>{status.label}</span>} />
      </div>
      <p className="text-xs text-gray-500 mt-3">DTI = monthly debt payments ÷ gross monthly income. &lt;36% good, 36–43% caution, &gt;43% risky.</p>
    </div>
  );
}

function Card({ title, value, subtitle }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-sm text-gray-600">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {subtitle ? <div className="text-sm mt-1">{subtitle}</div> : null}
    </div>
  );
}
