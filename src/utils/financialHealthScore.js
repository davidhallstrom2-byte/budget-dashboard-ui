// src/utils/financialHealthScore.js
// Automated Financial Health Score Calculator

/**
 * Calculate Financial Health Score (0-100) based on budget data
 * @param {Object} totals - Output from computeTotals()
 * @param {Object} buckets - Buckets from state (income, housing, etc.)
 * @returns {Object} - Score, breakdown, and recommendations
 */
export function calculateFinancialHealthScore(totals, buckets) {
  const scores = {
    incomeExpenseRatio: 0,
    savingsRate: 0,
    debtRatio: 0,
    categoryBalance: 0,
    budgetAdherence: 0
  };

  const weights = {
    incomeExpenseRatio: 0.30,  // 30%
    savingsRate: 0.25,          // 25%
    debtRatio: 0.20,            // 20%
    categoryBalance: 0.15,      // 15%
    budgetAdherence: 0.10       // 10%
  };

  // 1. INCOME vs EXPENSES RATIO (30%)
  if (totals.totalIncome > 0) {
    const expenseRatio = totals.totalExpenses / totals.totalIncome;
    
    if (expenseRatio <= 0.70) {
      scores.incomeExpenseRatio = 100;
    } else if (expenseRatio <= 0.80) {
      scores.incomeExpenseRatio = 85;
    } else if (expenseRatio <= 0.90) {
      scores.incomeExpenseRatio = 70;
    } else if (expenseRatio <= 1.00) {
      scores.incomeExpenseRatio = 50;
    } else {
      scores.incomeExpenseRatio = 20;
    }
  }

  // 2. SAVINGS RATE (25%)
  if (totals.totalIncome > 0) {
    const savingsRate = totals.netIncome / totals.totalIncome;
    
    if (savingsRate >= 0.20) {
      scores.savingsRate = 100;
    } else if (savingsRate >= 0.15) {
      scores.savingsRate = 90;
    } else if (savingsRate >= 0.10) {
      scores.savingsRate = 75;
    } else if (savingsRate >= 0.05) {
      scores.savingsRate = 50;
    } else if (savingsRate > 0) {
      scores.savingsRate = 30;
    } else {
      scores.savingsRate = 0;
    }
  }

  // 3. DEBT-TO-INCOME RATIO (20%)
  const debtPayments = calculateDebtPayments(buckets);
  if (totals.totalIncome > 0) {
    const dtiRatio = debtPayments / totals.totalIncome;
    
    if (dtiRatio === 0) {
      scores.debtRatio = 100;
    } else if (dtiRatio <= 0.15) {
      scores.debtRatio = 90;
    } else if (dtiRatio <= 0.20) {
      scores.debtRatio = 75;
    } else if (dtiRatio <= 0.30) {
      scores.debtRatio = 50;
    } else if (dtiRatio <= 0.40) {
      scores.debtRatio = 30;
    } else {
      scores.debtRatio = 10;
    }
  }

  // 4. CATEGORY BALANCE (15%)
  const categoryScores = calculateCategoryBalance(totals, buckets);
  scores.categoryBalance = categoryScores.overall;

  // 5. BUDGET ADHERENCE (10%)
  scores.budgetAdherence = calculateBudgetAdherence(buckets);

  // Calculate weighted overall score
  const overallScore = Math.round(
    scores.incomeExpenseRatio * weights.incomeExpenseRatio +
    scores.savingsRate * weights.savingsRate +
    scores.debtRatio * weights.debtRatio +
    scores.categoryBalance * weights.categoryBalance +
    scores.budgetAdherence * weights.budgetAdherence
  );

  // Generate recommendations
  const recommendations = generateRecommendations(scores, totals, buckets);

  // Determine health status
  const status = getHealthStatus(overallScore);

  return {
    overallScore,
    status,
    breakdown: {
      incomeExpenseRatio: {
        score: Math.round(scores.incomeExpenseRatio),
        weight: weights.incomeExpenseRatio * 100,
        label: 'Income vs Expenses'
      },
      savingsRate: {
        score: Math.round(scores.savingsRate),
        weight: weights.savingsRate * 100,
        label: 'Savings Rate'
      },
      debtRatio: {
        score: Math.round(scores.debtRatio),
        weight: weights.debtRatio * 100,
        label: 'Debt Management'
      },
      categoryBalance: {
        score: Math.round(scores.categoryBalance),
        weight: weights.categoryBalance * 100,
        label: 'Category Balance'
      },
      budgetAdherence: {
        score: Math.round(scores.budgetAdherence),
        weight: weights.budgetAdherence * 100,
        label: 'Budget Adherence'
      }
    },
    metrics: {
      expenseRatio: totals.totalIncome > 0 ? (totals.totalExpenses / totals.totalIncome) : 0,
      savingsRate: totals.totalIncome > 0 ? (totals.netIncome / totals.totalIncome) : 0,
      dtiRatio: totals.totalIncome > 0 ? (debtPayments / totals.totalIncome) : 0
    },
    categoryBreakdown: categoryScores.details,
    recommendations
  };
}

function calculateDebtPayments(buckets) {
  let debtPayments = 0;
  
  if (buckets.banking) {
    buckets.banking.forEach(item => {
      if (!item.category.toLowerCase().includes('service fee') && 
          !item.category.toLowerCase().includes('bank fee')) {
        debtPayments += item.estBudget || 0;
      }
    });
  }
  
  return debtPayments;
}

function calculateCategoryBalance(totals, buckets) {
  if (totals.totalIncome === 0) {
    return { overall: 0, details: {} };
  }

  const recommendations = {
    housing: { min: 0.25, max: 0.30, ideal: 0.28 },
    transportation: { min: 0.10, max: 0.15, ideal: 0.12 },
    food: { min: 0.10, max: 0.15, ideal: 0.12 },
    personal: { min: 0.05, max: 0.10, ideal: 0.07 },
    homeOffice: { min: 0.02, max: 0.05, ideal: 0.03 }
  };

  const categoryDetails = {};
  let totalScore = 0;
  let categoryCount = 0;

  Object.keys(recommendations).forEach(category => {
    if (buckets[category]) {
      const categoryTotal = buckets[category].reduce((sum, item) => 
        sum + (item.actualCost || 0), 0);
      const percentage = categoryTotal / totals.totalIncome;
      const rec = recommendations[category];

      let score = 0;
      if (percentage >= rec.min && percentage <= rec.max) {
        score = 100;
      } else if (percentage < rec.min) {
        score = 100;
      } else {
        const excess = (percentage - rec.max) / rec.max;
        score = Math.max(0, 100 - (excess * 200));
      }

      categoryDetails[category] = {
        percentage: Math.round(percentage * 100),
        score: Math.round(score),
        recommended: `${Math.round(rec.min * 100)}-${Math.round(rec.max * 100)}%`,
        status: percentage > rec.max ? 'over' : percentage < rec.min ? 'under' : 'optimal'
      };

      totalScore += score;
      categoryCount++;
    }
  });

  return {
    overall: categoryCount > 0 ? totalScore / categoryCount : 0,
    details: categoryDetails
  };
}

function calculateBudgetAdherence(buckets) {
  let totalEstimated = 0;
  let totalActual = 0;
  let itemsWithData = 0;

  Object.keys(buckets).forEach(category => {
    if (Array.isArray(buckets[category])) {
      buckets[category].forEach(item => {
        if (item.estBudget > 0) {
          totalEstimated += item.estBudget;
          totalActual += item.actualCost || 0;
          itemsWithData++;
        }
      });
    }
  });

  if (itemsWithData === 0 || totalEstimated === 0) {
    return 100;
  }

  const variance = Math.abs(totalActual - totalEstimated) / totalEstimated;
  
  if (variance <= 0.05) return 100;
  if (variance <= 0.10) return 90;
  if (variance <= 0.15) return 75;
  if (variance <= 0.25) return 50;
  return 30;
}

function generateRecommendations(scores, totals, buckets) {
  const recommendations = [];

  if (scores.incomeExpenseRatio < 70) {
    const expenseRatio = (totals.totalExpenses / totals.totalIncome) * 100;
    recommendations.push({
      priority: 'high',
      category: 'Expenses',
      issue: `Expenses are ${Math.round(expenseRatio)}% of income`,
      action: 'Reduce spending by 10-15% to create a healthier buffer',
      impact: '+15 points'
    });
  }

  if (scores.savingsRate < 75) {
    const currentSavings = totals.netIncome > 0 ? 
      Math.round((totals.netIncome / totals.totalIncome) * 100) : 0;
    const target = Math.max(10, currentSavings + 5);
    recommendations.push({
      priority: 'high',
      category: 'Savings',
      issue: `Saving only ${currentSavings}% of income`,
      action: `Increase savings rate to ${target}% by automating transfers`,
      impact: '+20 points'
    });
  }

  if (scores.debtRatio < 75) {
    recommendations.push({
      priority: 'medium',
      category: 'Debt',
      issue: 'Debt payments are high relative to income',
      action: 'Focus on paying down high-interest debt first',
      impact: '+15 points'
    });
  }

  const categoryScores = calculateCategoryBalance(totals, buckets);
  Object.entries(categoryScores.details).forEach(([category, data]) => {
    if (data.status === 'over' && data.percentage > 35) {
      recommendations.push({
        priority: 'medium',
        category: category.charAt(0).toUpperCase() + category.slice(1),
        issue: `${category} is ${data.percentage}% of income (recommended: ${data.recommended})`,
        action: `Reduce ${category} spending by ${data.percentage - 30}%`,
        impact: '+10 points'
      });
    }
  });

  if (scores.incomeExpenseRatio >= 85 && scores.savingsRate >= 75) {
    recommendations.push({
      priority: 'low',
      category: 'Growth',
      issue: 'Strong financial foundation established',
      action: 'Consider increasing retirement contributions or investment portfolio',
      impact: 'Long-term wealth building'
    });
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return recommendations.sort((a, b) => 
    priorityOrder[a.priority] - priorityOrder[b.priority]
  );
}

function getHealthStatus(score) {
  if (score >= 80) return { label: 'Healthy', color: 'green', message: 'Great financial health!' };
  if (score >= 60) return { label: 'Coping', color: 'yellow', message: 'On track, with room to improve' };
  return { label: 'Vulnerable', color: 'red', message: 'Needs attention' };
}

export function saveScoreHistory(score) {
  const history = getScoreHistory();
  const today = new Date().toISOString().split('T')[0];
  
  const existingIndex = history.findIndex(entry => entry.date === today);
  if (existingIndex >= 0) {
    history[existingIndex] = { date: today, score };
  } else {
    history.push({ date: today, score });
  }
  
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const filtered = history.filter(entry => 
    new Date(entry.date) >= ninetyDaysAgo
  );
  
  localStorage.setItem('financialHealthHistory', JSON.stringify(filtered));
}

export function getScoreHistory() {
  try {
    const history = localStorage.getItem('financialHealthHistory');
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
}