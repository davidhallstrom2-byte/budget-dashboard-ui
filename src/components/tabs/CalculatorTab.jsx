import React, { useState } from "react";

export default function CalculatorTab() {
  const [income, setIncome] = useState("");
  const [target, setTarget] = useState("");
  const [months, setMonths] = useState("12");

  const monthly = Number(target||0) / Math.max(Number(months||0), 1);
  const pct = Number(income||0) > 0 ? (monthly / Number(income)) * 100 : 0;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-3">Calculator</h2>

      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Gross Monthly Income" value={income} onChange={setIncome} placeholder="5000" />
        <Field label="Savings Target ($)" value={target} onChange={setTarget} placeholder="3000" />
        <Field label="Months" value={months} onChange={setMonths} placeholder="12" />
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-4">
        <Info label="Monthly Contribution" value={`$${monthly.toFixed(2)}`} />
        <Info label="% of Income" value={`${pct.toFixed(1)}%`} />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="text-sm text-gray-600">{label}</span>
      <input
        className="mt-1 w-full border rounded-md p-2"
        value={value}
        onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
      />
    </label>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}
