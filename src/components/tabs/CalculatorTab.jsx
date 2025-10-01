// src/components/tabs/CalculatorTab.jsx
import React, { useState, useRef } from 'react';
import PageContainer from "../common/PageContainer";
import { Calculator, TrendingUp, PiggyBank, CreditCard, Target } from 'lucide-react';

export default function CalculatorTab({ state }) {
  const [activeCalculator, setActiveCalculator] = useState('income');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [savingsGoal, setSavingsGoal] = useState('');
  const [savingsMonths, setSavingsMonths] = useState('12');
  const [debtAmount, setDebtAmount] = useState('');
  const [interestRate, setInterestRate] = useState('18');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  const [emergencyMonths, setEmergencyMonths] = useState('6');
  const sectionRefs = useRef({});

  const STICKY_OFFSET = 96; // px

  const buckets = state?.buckets || {};
  const sum = (arr, key) => (arr || []).reduce((s, x) => s + (Number(x?.[key]) || 0), 0);
  const totals = {
    totalIncome: sum(buckets.income, 'estBudget'),
    totalExpenses:
      sum(buckets.housing, 'estBudget') +
      sum(buckets.transportation, 'estBudget') +
      sum(buckets.food, 'estBudget') +
      sum(buckets.personal, 'estBudget') +
      sum(buckets.homeOffice, 'estBudget') +
      sum(buckets.banking, 'estBudget') +
      sum(buckets.subscriptions, 'estBudget') +
      sum(buckets.misc, 'estBudget'),
  };
  totals.netIncome = totals.totalIncome - totals.totalExpenses;

  const calculators = [
    { id: 'income', label: 'Income', icon: TrendingUp, color: 'bg-blue-500' },
    { id: 'scenarios', label: 'Scenarios', icon: Calculator, color: 'bg-purple-500' },
    { id: 'breakeven', label: 'Break-Even', icon: Target, color: 'bg-green-500' },
    { id: 'savings', label: 'Savings Goal', icon: PiggyBank, color: 'bg-orange-500' },
    { id: 'debt', label: 'Debt Payoff', icon: CreditCard, color: 'bg-red-500' },
    { id: 'emergency', label: 'Emergency Fund', icon: PiggyBank, color: 'bg-indigo-500' }
  ];

  const scrollToCalculator = (calcId) => {
    setActiveCalculator(calcId);
    const el = sectionRefs.current[calcId];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - STICKY_OFFSET;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  const getCategoryTotal = (key) => sum(buckets[key], 'estBudget');

  const scenarios = [
    { title: 'Reduce Subscriptions by 50%', description: 'Cut half of subscription costs', category: 'Subscriptions', savings: getCategoryTotal('subscriptions') * 0.5 },
    { title: 'Cut Dining by 25%', description: 'Trim eating-out and snacks', category: 'Food', savings: getCategoryTotal('food') * 0.25 },
    { title: 'Reduce Transportation by 15%', description: 'Carpool or use public transport', category: 'Transportation', savings: getCategoryTotal('transportation') * 0.15 },
  ];

  const breakEvenIncome = totals.totalExpenses;
  const hourlyRateNeeded = (hours) => hours > 0 ? Math.ceil(breakEvenIncome / (hours * 4)) : 0;

  const calculateSavingsGoal = () => {
    if (!savingsGoal || !savingsMonths) return null;
    const goal = parseFloat(savingsGoal);
    const months = parseInt(savingsMonths);
    const monthlyNeeded = goal / months;
    const totalIncomeNeeded = totals.totalExpenses + monthlyNeeded;
    const additionalIncomeNeeded = totalIncomeNeeded - totals.totalIncome;
    return {
      monthlyNeeded,
      totalIncomeNeeded,
      additionalIncomeNeeded,
      canAfford: totals.netIncome >= monthlyNeeded,
      percentOfIncome: totals.totalIncome > 0 ? (monthlyNeeded / totals.totalIncome * 100).toFixed(1) : 0
    };
  };
  const savingsCalc = calculateSavingsGoal();

  const calculateDebtPayoff = () => {
    if (!debtAmount || !interestRate || !monthlyPayment) return null;
    const principal = parseFloat(debtAmount);
    const rate = parseFloat(interestRate) / 100 / 12;
    const payment = parseFloat(monthlyPayment);

    if (payment <= principal * rate) {
      return { error: 'Payment too low to cover interest', months: Infinity, totalInterest: Infinity, totalPaid: Infinity };
    }

    const months = Math.log(payment / (payment - principal * rate)) / Math.log(1 + rate);
    const totalPaid = payment * months;
    const totalInterest = totalPaid - principal;

    return { months: Math.ceil(months), totalInterest, totalPaid };
  };
  const debtCalc = calculateDebtPayoff();

  const emergencyFundNeeded = () => {
    const monthlyExpenses = totals.totalExpenses;
    const months = parseInt(emergencyMonths) || 0;
    const target = monthlyExpenses * months;
    return { monthlyExpenses, target };
  };
  const emergencyCalc = emergencyFundNeeded();

  const anchorStyle = { scrollMarginTop: `${STICKY_OFFSET}px` };

  return (
    <PageContainer className="py-6 space-y-6">
      {/* Header Bar — inherits page bg */}
      <div className="mb-2 bg-transparent">
        <div className="rounded-b-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <h2 className="text-2xl font-bold text-slate-800">Budget Calculator</h2>
        </div>
      </div>

      {/* Top selector pills */}
      <div className="flex flex-wrap gap-2">
        {calculators.map(({ id, label, icon: Icon, color }) => {
          const active = activeCalculator === id;
          return (
            <button
              key={id}
              onClick={() => scrollToCalculator(id)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border ${active ? `${color} text-white border-transparent` : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}
              title={label}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Income Calculator */}
      <div ref={(el) => (sectionRefs.current['income'] = el)} style={anchorStyle} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="bg-blue-500 px-6 py-3 text-white">
          <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1">
            <h3 className="text-lg font-semibold">Income Calculator</h3>
            <span className="text-sm opacity-90 md:text-right">Calculate your budget with different income levels</span>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Test Income Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  value={incomeAmount}
                  onChange={(e) => setIncomeAmount(e.target.value)}
                  placeholder="Enter monthly income"
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mt-4">
                <p className="text-sm text-slate-600 mb-2">Quick presets:</p>
                <div className="flex flex-wrap gap-2">
                  {[3000, 4000, 5000, 6000].map(v => (
                    <button key={v} onClick={() => setIncomeAmount(String(v))}
                      className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded">{`$${v}`}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-2">Impact</h4>
              <p className="text-sm text-slate-700">Income change vs current budget.</p>
              <div className="mt-3 text-sm">
                <p className="text-slate-700">Current Net Income: <span className={`font-semibold ${totals.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>${totals.netIncome.toFixed(2)}</span></p>
                {incomeAmount && (
                  <>
                    <p className="text-slate-700 mt-2">New Net Income (with ${Number(incomeAmount).toFixed(2)}):</p>
                    <p className={`text-lg font-bold ${((Number(incomeAmount) - totals.totalExpenses) >= 0) ? 'text-green-700' : 'text-red-700'}`}>
                      ${(Number(incomeAmount) - totals.totalExpenses).toFixed(2)}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What-If Scenarios */}
      <div ref={(el) => (sectionRefs.current['scenarios'] = el)} style={anchorStyle} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="bg-purple-500 px-6 py-3 text-white">
          <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1">
            <h3 className="text-lg font-semibold">What-If Scenarios</h3>
            <span className="text-sm opacity-90 md:text-right">See how budget changes could impact your finances</span>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-700 mb-2">Quick scenarios (click to apply):</p>
                <div className="flex flex-wrap gap-2">
                  {scenarios.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => setIncomeAmount(String(totals.totalIncome + s.savings))}
                      className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded"
                      title={s.description}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-2">Estimated Savings</h4>
                <ul className="list-disc list-inside text-sm text-slate-700">
                  {scenarios.map((s, idx) => (
                    <li key={idx}>
                      {s.title}: <span className="font-semibold">${(s.savings || 0).toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-2">Net Result</h4>
              <p className="text-sm text-slate-700">If you apply a scenario, this shows the new net income.</p>
              <div className="mt-3 text-sm">
                <p className="text-slate-700">Current Net Income: <span className={`font-semibold ${totals.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}`}>${totals.netIncome.toFixed(2)}</span></p>
                {incomeAmount && (
                  <>
                    <p className="text-slate-700 mt-2">New Net Income (with scenario):</p>
                    <p className={`text-lg font-bold ${((Number(incomeAmount) - totals.totalExpenses) >= 0) ? 'text-green-700' : 'text-red-700'}`}>
                      ${(Number(incomeAmount) - totals.totalExpenses).toFixed(2)}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Break-Even Calculator */}
      <div ref={(el) => (sectionRefs.current['breakeven'] = el)} style={anchorStyle} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="bg-green-500 px-6 py-3 text-white">
          <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1">
            <h3 className="text-lg font-semibold">Break-Even Calculator</h3>
            <span className="text-sm opacity-90 md:text-right">Calculate minimum income needed to cover expenses</span>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-700 mb-2">Your current monthly expenses total:</p>
              <p className="text-2xl font-bold text-slate-900">${totals.totalExpenses.toFixed(2)}</p>
              <div className="mt-4">
                <p className="text-sm text-slate-700 mb-2">Hourly rate needed at different weekly hours:</p>
                <ul className="text-sm text-slate-700 space-y-1">
                  {[20, 30, 40, 50].map(h => (
                    <li key={h}>• {h} hrs/week: <span className="font-semibold">${hourlyRateNeeded(h)}</span> per hour</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-2">Break-Even Income</h4>
              <p className="text-sm text-slate-700">You need at least this much monthly income to break even:</p>
              <p className="text-2xl font-bold mt-2 text-slate-900">${breakEvenIncome.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Savings Goal Planner */}
      <div ref={(el) => (sectionRefs.current['savings'] = el)} style={anchorStyle} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="bg-orange-500 px-6 py-3 text-white">
          <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1">
            <h3 className="text-lg font-semibold">Savings Goal Planner</h3>
            <span className="text-sm opacity-90 md:text-right">Plan for future savings targets</span>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Savings Goal Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  value={savingsGoal}
                  onChange={(e) => setSavingsGoal(e.target.value)}
                  placeholder="Enter total savings goal"
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <label className="block text-sm font-medium text-slate-700 mt-4 mb-2">Months to Save</label>
              <input
                type="number"
                value={savingsMonths}
                onChange={(e) => setSavingsMonths(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-2">Monthly Amount Needed</h4>
              {savingsCalc ? (
                <>
                  <p className="text-sm text-slate-700">You need to save each month:</p>
                  <p className="text-2xl font-bold mt-1 text-slate-900">${savingsCalc.monthlyNeeded.toFixed(2)}</p>
                  <p className="text-sm text-slate-700 mt-2">This is {savingsCalc.percentOfIncome}% of your income.</p>
                  <p className={`text-sm mt-2 ${savingsCalc.canAfford ? 'text-green-700' : 'text-red-700'}`}>
                    {savingsCalc.canAfford ? 'You can afford this with current net income.' : 'You will need to adjust budget or earn more.'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-700">Enter goal and months to see results.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Debt Payoff Calculator */}
      <div ref={(el) => (sectionRefs.current['debt'] = el)} style={anchorStyle} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="bg-red-500 px-6 py-3 text-white">
          <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1">
            <h3 className="text-lg font-semibold">Debt Payoff Calculator</h3>
            <span className="text-sm opacity-90 md:text-right">Calculate debt payoff timeline and totals</span>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Debt Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                <input
                  type="number"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  placeholder="Total debt balance"
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <label className="block text-sm font-medium text-slate-700 mt-4 mb-2">APR (%)</label>
              <input
                type="number"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />

              <label className="block text-sm font-medium text-slate-700 mt-4 mb-2">Monthly Payment</label>
              <input
                type="number"
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-2">Results</h4>
              {debtCalc ? debtCalc.error ? (
                <p className="text-sm text-red-700">{debtCalc.error}</p>
              ) : (
                <>
                  <p className="text-sm text-slate-700">Months to pay off:</p>
                  <p className="text-2xl font-bold text-slate-900">{debtCalc.months}</p>
                  <p className="text-sm text-slate-700 mt-2">Total interest:</p>
                  <p className="text-lg font-semibold text-slate-900">${debtCalc.totalInterest.toFixed(2)}</p>
                  <p className="text-sm text-slate-700 mt-2">Total paid:</p>
                  <p className="text-lg font-semibold text-slate-900">${debtCalc.totalPaid.toFixed(2)}</p>
                </>
              ) : (
                <p className="text-sm text-slate-700">Enter all fields to calculate payoff.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Fund Calculator */}
      <div ref={(el) => (sectionRefs.current['emergency'] = el)} style={anchorStyle} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="bg-indigo-500 px-6 py-3 text-white">
          <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-1">
            <h3 className="text-lg font-semibold">Emergency Fund Calculator</h3>
            <span className="text-sm opacity-90 md:text-right">Plan your financial safety net</span>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Months to Cover</label>
              <input
                type="number"
                value={emergencyMonths}
                onChange={(e) => setEmergencyMonths(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-semibold text-slate-900 mb-2">Target Emergency Fund</h4>
              <p className="text-sm text-slate-700">Your monthly expenses are:</p>
              <p className="text-2xl font-bold text-slate-900">${(emergencyCalc.monthlyExpenses || 0).toFixed(2)}</p>
              <p className="text-sm text-slate-700 mt-2">Emergency fund target:</p>
              <p className="text-lg font-semibold text-slate-900">${(emergencyCalc.target || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
