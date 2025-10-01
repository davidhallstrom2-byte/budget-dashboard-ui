// src/utils/financialHealthScore.js
// Automated Financial Health Score Calculator (null-safe)

const BUCKET_KEYS = [
  "income",
  "housing",
  "transportation",
  "food",
  "personal",
  "homeOffice",
  "banking",
  "subscriptions",
  "misc",
];

function ensureBuckets(input) {
  const b = (input && typeof input === "object") ? input : {};
  const safe = {};
  for (const k of BUCKET_KEYS) {
    safe[k] = Array.isArray(b[k]) ? b[k] : [];
  }
  return safe;
}

function sum(arr, pick) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) {
    try {
      s += Number(pick(arr[i])) || 0;
    } catch {
      // skip bad rows
    }
  }
  return s;
}

function sumEst(rows) { return sum(rows, (r) => r?.estBudget); }
function sumActual(rows) { return sum(rows, (r) => r?.actualCost); }

/**
 * Calculate Financial Health Score (0-100) based on budget data
 * @param {Object} totals - Output from computeTotals()
 * @param {Object} buckets - Buckets from state (income, housing, etc.)
 * @returns {Object} - Score, breakdown, and recommendations
 */
export function calculateFinancialHealthScore(totals = {}, buckets = {}) {
  const b = ensureBuckets(buckets);

  const scores = {
    incomeExpenseRatio: 0,
    savingsRate: 0,
    debtRatio: 0,
    categoryBalance: 0,
    budgetAdherence: 0
  };

  const weights = {
    incomeExpenseRatio: 0.30,  // 30%
    savingsRate: 0.25,         // 25%
    debtRatio: 0.20,           // 20%
    categoryBalance: 0.15,     // 15%
    budgetAdherence: 0.10      // 10%
  };

  const income = Number(totals.totalIncome) || 0;
  const expenses = Number(totals.totalExpenses) || 0;
  const net = Number(totals.netIncome) || (income - expenses);

  // 1) INCOME vs EXPENSES RATIO
  if (income > 0) {
    const expenseRatio = expenses / income;
    if (expenseRatio <= 0.70) scores.incomeExpenseRatio = 100;
    else if (expenseRatio <= 0.80) scores.incomeExpenseRatio = 85;
    else if (expenseRatio <= 0.90) scores.incomeExpenseRatio = 70;
    else if (expenseRatio <= 1.00) scores.incomeExpenseRatio = 50;
    else scores.incomeExpenseRatio = 20;
  }

  // 2) SAVINGS RATE
  if (income > 0) {
    const savingsRate = net / income;
    if (savingsRate >= 0.20) scores.savingsRate = 100;
    else if (savingsRate >= 0.15) scores.savingsRate = 90;
    else if (savingsRate >= 0.10) scores.savingsRate = 75;
    else if (savingsRate >= 0.05) scores.savingsRate = 50;
    else if (savingsRate > 0) scores.savingsRate = 30;
    else scores.savingsRate = 0;
  }

  // 3) DEBT-TO-INCOME RATIO
  const debtPayments = calculateDebtPayments(b);
  if (income > 0) {
    const dtiRatio = debtPayments / income;
    if (dtiRatio === 0) scores.debtRatio = 100;
    else if (dtiRatio <= 0.15) scores.debtRatio = 90;
    else if (dtiRatio <= 0.20) scores.debtRatio = 75;
    else if (dtiRatio <= 0.30) scores.debtRatio = 50;
    else if (dtiRatio <= 0.40) scores.debtRatio = 30;
    else scores.debtRatio = 10;
  }

  // 4) CATEGORY BALANCE
  const categoryScores = calculateCategoryBalance({ totalIncome: income }, b);
  scores.categoryBalance = categoryScores.overall;

  // 5) BUDGET ADHERENCE
  scores.budgetAdherence = calculateBudgetAdherence(b);

  // Weighted overall
  const overallScore = Math.round(
    scores.incomeExpenseRatio * weights.incomeExpenseRatio +
    scores.savingsRate * weights.savingsRate +
    scores.debtRatio * weights.debtRatio +
    scores.categoryBalance * weights.categoryBalance +
    scores.budgetAdherence * weights.budgetAdherence
  );

  const recommendations = generateRecommendations(scores, { totalIncome: income, totalExpenses: expenses, netIncome: net }, b);
  const status = getHealthStatus(overallScore);

  return {
    overallScore,
    status,
    breakdown: {
      incomeExpenseRatio: { score: Math.round(scores.incomeExpenseRatio), weight: weights.incomeExpenseRatio * 100, label: "Income vs Expenses" },
      savingsRate:       { score: Math.round(scores.savingsRate),       weight: weights.savingsRate * 100,       label: "Savings Rate" },
      debtRatio:         { score: Math.round(scores.debtRatio),         weight: weights.debtRatio * 100,         label: "Debt Management" },
      categoryBalance:   { score: Math.round(scores.categoryBalance),   weight: weights.categoryBalance * 100,   label: "Category Balance" },
      budgetAdherence:   { score: Math.round(scores.budgetAdherence),   weight: weights.budgetAdherence * 100,   label: "Budget Adherence" },
    },
    metrics: {
      expenseRatio: income > 0 ? (expenses / income) : 0,
      savingsRate:  income > 0 ? (net / income) : 0,
      dtiRatio:     income > 0 ? (debtPayments / income) : 0,
    },
    categoryBreakdown: categoryScores.details,
    recommendations,
  };
}

function calculateDebtPayments(b) {
  // Treat "banking" items as debt payments unless labeled bank fees
  const rows = b.banking;
  let debtPayments = 0;
  for (const item of rows) {
    const name = (item?.category || "").toLowerCase();
    if (!name.includes("service fee") && !name.includes("bank fee")) {
      debtPayments += Number(item?.estBudget) || 0;
    }
  }
  return debtPayments;
}

function calculateCategoryBalance(totals, b) {
  const income = Number(totals?.totalIncome) || 0;
  if (income === 0) return { overall: 0, details: {} };

  const recommendations = {
    housing:        { min: 0.25, max: 0.30, ideal: 0.28 },
    transportation: { min: 0.10, max: 0.15, ideal: 0.12 },
    food:           { min: 0.10, max: 0.15, ideal: 0.12 },
    personal:       { min: 0.05, max: 0.10, ideal: 0.07 },
    homeOffice:     { min: 0.02, max: 0.05, ideal: 0.03 },
  };

  const details = {};
  let totalScore = 0;
  let count = 0;

  for (const category of Object.keys(recommendations)) {
    const rows = b[category];
    if (!rows || rows.length === 0) continue;

    const categoryTotal = sumActual(rows);
    const percentage = categoryTotal / income;
    const rec = recommendations[category];

    let score;
    if (percentage <= rec.max) {
      // within or under the cap is fine
      score = 100;
    } else {
      const excess = (percentage - rec.max) / rec.max;
      score = Math.max(0, 100 - excess * 200);
    }

    details[category] = {
      percentage: Math.round(percentage * 100),
      score: Math.round(score),
      recommended: `${Math.round(rec.min * 100)}-${Math.round(rec.max * 100)}%`,
      status: percentage > rec.max ? "over" : percentage < rec.min ? "under" : "optimal",
    };

    totalScore += score;
    count++;
  }

  return { overall: count > 0 ? totalScore / count : 0, details };
}

function calculateBudgetAdherence(b) {
  let totalEstimated = 0;
  let totalActual = 0;
  let itemsWithData = 0;

  for (const key of Object.keys(b)) {
    const rows = b[key];
    for (const item of rows) {
      const est = Number(item?.estBudget) || 0;
      if (est > 0) {
        totalEstimated += est;
        totalActual += Number(item?.actualCost) || 0;
        itemsWithData++;
      }
    }
  }

  if (itemsWithData === 0 || totalEstimated === 0) return 100;

  const variance = Math.abs(totalActual - totalEstimated) / totalEstimated;
  if (variance <= 0.05) return 100;
  if (variance <= 0.10) return 90;
  if (variance <= 0.15) return 75;
  if (variance <= 0.25) return 50;
  return 30;
}

function generateRecommendations(scores, totals, b) {
  const recs = [];
  const income = Number(totals.totalIncome) || 0;
  const expenses = Number(totals.totalExpenses) || 0;
  const net = Number(totals.netIncome) || (income - expenses);

  if (scores.incomeExpenseRatio < 70 && income > 0) {
    const expenseRatio = Math.round((expenses / income) * 100);
    recs.push({
      priority: "high",
      category: "Expenses",
      issue: `Expenses are ${expenseRatio}% of income`,
      action: "Reduce spending by 10-15% to create a healthier buffer",
      impact: "+15 points",
    });
  }

  if (scores.savingsRate < 75 && income > 0) {
    const currentSavings = net > 0 ? Math.round((net / income) * 100) : 0;
    const target = Math.max(10, currentSavings + 5);
    recs.push({
      priority: "high",
      category: "Savings",
      issue: `Saving only ${currentSavings}% of income`,
      action: `Increase savings rate to ${target}% by automating transfers`,
      impact: "+20 points",
    });
  }

  if (scores.debtRatio < 75) {
    recs.push({
      priority: "medium",
      category: "Debt",
      issue: "Debt payments are high relative to income",
      action: "Focus on paying down high-interest debt first",
      impact: "+15 points",
    });
  }

  const categoryScores = calculateCategoryBalance({ totalIncome: income }, b);
  for (const [category, data] of Object.entries(categoryScores.details)) {
    if (data.status === "over" && data.percentage > 35) {
      recs.push({
        priority: "medium",
        category: category.charAt(0).toUpperCase() + category.slice(1),
        issue: `${category} is ${data.percentage}% of income (recommended: ${data.recommended})`,
        action: `Reduce ${category} spending by ${data.percentage - 30}%`,
        impact: "+10 points",
      });
    }
  }

  if (scores.incomeExpenseRatio >= 85 && scores.savingsRate >= 75) {
    recs.push({
      priority: "low",
      category: "Growth",
      issue: "Strong financial foundation established",
      action: "Consider increasing retirement contributions or investment portfolio",
      impact: "Long-term wealth building",
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b2) => order[a.priority] - order[b2.priority]);
}

function getHealthStatus(score) {
  if (score >= 80) return { label: "Healthy", color: "green", message: "Great financial health!" };
  if (score >= 60) return { label: "Coping", color: "yellow", message: "On track, with room to improve" };
  return { label: "Vulnerable", color: "red", message: "Needs attention" };
}

export function saveScoreHistory(score) {
  const history = getScoreHistory();
  const today = new Date().toISOString().split("T")[0];

  const i = history.findIndex((e) => e.date === today);
  if (i >= 0) history[i] = { date: today, score };
  else history.push({ date: today, score });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const filtered = history.filter((e) => new Date(e.date) >= cutoff);

  localStorage.setItem("financialHealthHistory", JSON.stringify(filtered));
}

export function getScoreHistory() {
  try {
    const history = localStorage.getItem("financialHealthHistory");
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
}
