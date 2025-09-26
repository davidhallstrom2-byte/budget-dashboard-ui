import { useState, useRef } from 'react';
import { useBudgetState } from '../../utils/state';
import { Calculator, TrendingUp, DollarSign, Target, PiggyBank, Zap } from 'lucide-react';

export default function CalculatorTab() {
  const [activeCalculator, setActiveCalculator] = useState('income');
  const [incomeAmount, setIncomeAmount] = useState('');
  const [savingsGoal, setSavingsGoal] = useState('');
  const [savingsMonths, setSavingsMonths] = useState('12');
  const [debtAmount, setDebtAmount] = useState('');
  const [interestRate, setInterestRate] = useState('18');
  const [monthlyPayment, setMonthlyPayment] = useState('');
  
  const sectionRefs = useRef({});

  // Get store data
  const store = useBudgetState();
  const buckets = store.buckets || {};
  const computeTotals = store.computeTotals;
  
  const totals = computeTotals();

  const calculators = [
    { id: 'income', label: 'Income', color: 'bg-blue-500', icon: DollarSign },
    { id: 'scenarios', label: 'Scenarios', color: 'bg-purple-500', icon: Zap },
    { id: 'breakeven', label: 'Break-Even', color: 'bg-green-500', icon: TrendingUp },
    { id: 'savings', label: 'Savings Goal', color: 'bg-orange-500', icon: Target },
    { id: 'debt', label: 'Debt Payoff', color: 'bg-red-500', icon: PiggyBank }
  ];

  const scrollToCalculator = (calcId) => {
    setActiveCalculator(calcId);
    sectionRefs.current[calcId]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Calculate category totals
  const getCategoryTotal = (categoryKey) => {
    return (buckets[categoryKey] || []).reduce((sum, item) => sum + (item.estBudget || 0), 0);
  };

  // Scenarios
  const scenarios = [
    {
      title: 'Reduce Subscriptions by 50%',
      description: 'Cut half of subscription costs',
      category: 'Subscriptions',
      savings: (getCategoryTotal('personal') + getCategoryTotal('homeOffice')) * 0.5,
      color: 'blue'
    },
    {
      title: 'Reduce Food Spending by 25%',
      description: 'Cook more at home, reduce dining out',
      category: 'Food',
      savings: getCategoryTotal('food') * 0.25,
      color: 'green'
    },
    {
      title: 'Optimize Transportation',
      description: 'Carpool, use public transit more',
      category: 'Transportation',
      savings: getCategoryTotal('transportation') * 0.3,
      color: 'purple'
    },
    {
      title: 'Negotiate Bills',
      description: 'Call providers for better rates',
      category: 'Housing',
      savings: getCategoryTotal('housing') * 0.1,
      color: 'orange'
    }
  ].filter(scenario => scenario.savings > 0);

  // Break-even calculations
  const breakEvenIncome = totals.totalExpenses;
  const hourlyRateNeeded = (rate) => Math.ceil(breakEvenIncome / (rate * 4));

  // Savings goal calculator
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
      canAfford: totals.netIncome >= monthlyNeeded
    };
  };

  const savingsCalc = calculateSavingsGoal();

  // Debt payoff calculator
  const calculateDebtPayoff = () => {
    if (!debtAmount || !interestRate || !monthlyPayment) return null;

    const principal = parseFloat(debtAmount);
    const rate = parseFloat(interestRate) / 100 / 12;
    const payment = parseFloat(monthlyPayment);

    if (payment <= principal * rate) {
      return { error: 'Payment too low to cover interest', minimumPayment: (principal * rate).toFixed(2) };
    }

    const months = Math.log(payment / (payment - principal * rate)) / Math.log(1 + rate);
    const totalPaid = payment * months;
    const totalInterest = totalPaid - principal;

    return {
      months: Math.ceil(months),
      years: (months / 12).toFixed(1),
      totalPaid,
      totalInterest,
      minimumPayment: (principal * rate).toFixed(2)
    };
  };

  const debtCalc = calculateDebtPayoff();

  return (
    <div className="space-y-4">
      {/* Calculator Navigation Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {calculators.map((calc) => {
          const Icon = calc.icon;
          return (
            <button
              key={calc.id}
              onClick={() => scrollToCalculator(calc.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors
                ${activeCalculator === calc.id
                  ? `${calc.color} text-white`
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }
              `}
            >
              <Icon className="h-4 w-4" />
              {calc.label}
            </button>
          );
        })}
      </div>

      {/* All Calculators Displayed */}
      <div className="space-y-6">
        {/* Income Calculator */}
        <div
          ref={(el) => (sectionRefs.current['income'] = el)}
          className="bg-white rounded-lg border border-slate-200 overflow-hidden"
        >
          <div className="bg-blue-500 px-6 py-4 flex items-center gap-3">
            <DollarSign className="h-6 w-6 text-white" />
            <div className="text-white">
              <h3 className="text-lg font-semibold">Income Calculator</h3>
              <p className="text-sm opacity-90">Calculate your budget with different income levels</p>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Test Income Amount
                </label>
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
              </div>

              {incomeAmount && parseFloat(incomeAmount) > 0 && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Test Income:</span>
                      <span className="font-semibold text-slate-900">${parseFloat(incomeAmount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Current Expenses:</span>
                      <span className="font-semibold text-red-600">${totals.totalExpenses.toFixed(2)}</span>
                    </div>
                    <div className="border-t border-slate-300 pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="font-medium text-slate-900">Net Income:</span>
                        <span className={`text-lg font-bold ${
                          (parseFloat(incomeAmount) - totals.totalExpenses) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${(parseFloat(incomeAmount) - totals.totalExpenses).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* What-If Scenarios */}
        <div
          ref={(el) => (sectionRefs.current['scenarios'] = el)}
          className="bg-white rounded-lg border border-slate-200 overflow-hidden"
        >
          <div className="bg-purple-500 px-6 py-4 flex items-center gap-3">
            <Zap className="h-6 w-6 text-white" />
            <div className="text-white">
              <h3 className="text-lg font-semibold">What-If Scenarios</h3>
              <p className="text-sm opacity-90">Explore potential savings opportunities</p>
            </div>
          </div>
          <div className="p-6">
            {scenarios.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {scenarios.map((scenario, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-l-4 ${
                      scenario.color === 'blue' ? 'bg-blue-50 border-blue-500' :
                      scenario.color === 'green' ? 'bg-green-50 border-green-500' :
                      scenario.color === 'purple' ? 'bg-purple-50 border-purple-500' :
                      'bg-orange-50 border-orange-500'
                    }`}
                  >
                    <h4 className="font-semibold text-slate-900 mb-1">{scenario.title}</h4>
                    <p className="text-sm text-slate-600 mb-3">{scenario.description}</p>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Monthly Savings:</span>
                        <span className="font-semibold text-green-600">+${scenario.savings.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">New Net Income:</span>
                        <span className="font-bold text-slate-900">
                          ${(totals.netIncome + scenario.savings).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500">
                <p>Add some expenses to see savings scenarios</p>
              </div>
            )}
          </div>
        </div>

        {/* Break-Even Analysis */}
        <div
          ref={(el) => (sectionRefs.current['breakeven'] = el)}
          className="bg-white rounded-lg border border-slate-200 overflow-hidden"
        >
          <div className="bg-green-500 px-6 py-4 flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-white" />
            <div className="text-white">
              <h3 className="text-lg font-semibold">Break-Even Analysis</h3>
              <p className="text-sm opacity-90">Calculate income needed to cover expenses</p>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-sm text-red-600 mb-1">Current Expenses</p>
                  <p className="text-3xl font-bold text-red-700">${totals.totalExpenses.toFixed(2)}</p>
                  <p className="text-xs text-red-600 mt-1">per month</p>
                </div>
                <div className={`rounded-lg p-4 border ${
                  totals.netIncome >= 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
                }`}>
                  <p className={`text-sm mb-1 ${totals.netIncome >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                    Current Income
                  </p>
                  <p className={`text-3xl font-bold ${totals.netIncome >= 0 ? 'text-green-700' : 'text-orange-700'}`}>
                    ${totals.totalIncome.toFixed(2)}
                  </p>
                  <p className={`text-xs mt-1 ${totals.netIncome >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                    {totals.netIncome >= 0 ? 'Above break-even' : `Need $${Math.abs(totals.netIncome).toFixed(2)} more`}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-900 mb-3">Ways to Reach Break-Even</h4>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <div className="h-6 w-6 bg-blue-100 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-600 text-xs font-semibold">1</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Full-time Employment</p>
                      <p className="text-slate-600">
                        Earn ${breakEvenIncome.toFixed(2)}/month (~${(breakEvenIncome / 4).toFixed(2)}/week)
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="h-6 w-6 bg-blue-100 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-600 text-xs font-semibold">2</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Hourly Work at $15/hr</p>
                      <p className="text-slate-600">
                        Work ~{hourlyRateNeeded(15)} hours/week
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <div className="h-6 w-6 bg-blue-100 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-600 text-xs font-semibold">3</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Freelancing at $50/hr</p>
                      <p className="text-slate-600">
                        Work ~{hourlyRateNeeded(50)} hours/week
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Savings Goal Calculator */}
        <div
          ref={(el) => (sectionRefs.current['savings'] = el)}
          className="bg-white rounded-lg border border-slate-200 overflow-hidden"
        >
          <div className="bg-orange-500 px-6 py-4 flex items-center gap-3">
            <Target className="h-6 w-6 text-white" />
            <div className="text-white">
              <h3 className="text-lg font-semibold">Savings Goal Calculator</h3>
              <p className="text-sm opacity-90">Plan to reach your savings target</p>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Savings Goal
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                    <input
                      type="number"
                      value={savingsGoal}
                      onChange={(e) => setSavingsGoal(e.target.value)}
                      placeholder="e.g., 5000"
                      className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Time Frame (months)
                  </label>
                  <input
                    type="number"
                    value={savingsMonths}
                    onChange={(e) => setSavingsMonths(e.target.value)}
                    placeholder="12"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {savingsCalc && (
                <div className={`rounded-lg p-4 ${
                  savingsCalc.canAfford ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <h4 className={`font-semibold mb-3 ${
                    savingsCalc.canAfford ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {savingsCalc.canAfford ? 'Goal is Achievable!' : 'Additional Income Needed'}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Monthly savings needed:</span>
                      <span className="font-semibold text-slate-900">
                        ${savingsCalc.monthlyNeeded.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Total income required:</span>
                      <span className="font-semibold text-slate-900">
                        ${savingsCalc.totalIncomeNeeded.toFixed(2)}
                      </span>
                    </div>
                    {!savingsCalc.canAfford && (
                      <div className="flex justify-between pt-2 border-t border-slate-300">
                        <span className="text-slate-900 font-medium">Additional income needed:</span>
                        <span className="font-bold text-red-600">
                          ${Math.abs(savingsCalc.additionalIncomeNeeded).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {savingsCalc.canAfford && (
                      <div className="flex justify-between pt-2 border-t border-slate-300">
                        <span className="text-slate-900 font-medium">Surplus after savings:</span>
                        <span className="font-bold text-green-600">
                          ${(totals.netIncome - savingsCalc.monthlyNeeded).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Debt Payoff Calculator */}
        <div
          ref={(el) => (sectionRefs.current['debt'] = el)}
          className="bg-white rounded-lg border border-slate-200 overflow-hidden"
        >
          <div className="bg-red-500 px-6 py-4 flex items-center gap-3">
            <PiggyBank className="h-6 w-6 text-white" />
            <div className="text-white">
              <h3 className="text-lg font-semibold">Debt Payoff Calculator</h3>
              <p className="text-sm opacity-90">Calculate how long to pay off debt</p>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Debt Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    value={debtAmount}
                    onChange={(e) => setDebtAmount(e.target.value)}
                    placeholder="e.g., 5000"
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Interest Rate (%)
                </label>
                <input
                  type="number"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  placeholder="18"
                  step="0.1"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Monthly Payment
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    value={monthlyPayment}
                    onChange={(e) => setMonthlyPayment(e.target.value)}
                    placeholder="e.g., 200"
                    className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>
            </div>

            {debtCalc && (
              <div className="bg-slate-50 rounded-lg p-4">
                {debtCalc.error ? (
                  <div className="text-center py-4">
                    <p className="text-red-600 font-medium">{debtCalc.error}</p>
                    <p className="text-sm text-slate-600 mt-2">
                      Minimum payment to cover interest: ${debtCalc.minimumPayment}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Payoff Time</p>
                      <p className="text-2xl font-bold text-slate-900">{debtCalc.months}</p>
                      <p className="text-xs text-slate-500">months ({debtCalc.years} years)</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Total Paid</p>
                      <p className="text-2xl font-bold text-slate-900">${debtCalc.totalPaid.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Total Interest</p>
                      <p className="text-2xl font-bold text-red-600">${debtCalc.totalInterest.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-slate-600">Min. Payment</p>
                      <p className="text-2xl font-bold text-orange-600">${debtCalc.minimumPayment}</p>
                      <p className="text-xs text-slate-500">to cover interest</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}