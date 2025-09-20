// src/lib/derive.js
export const sectionLabel = (key) =>
  key === "homeOffice" ? "Home Office" :
  key === "banking" ? "Banking & Credit" :
  key.charAt(0).toUpperCase() + key.slice(1);

export const nonArchivedOf = (data) => {
  const out = {};
  for (const k of Object.keys(data)) out[k] = (data[k] || []).filter((i) => !i.archived);
  return out;
};

export const totalsOf = (nonArchived) => {
  const totalIncome = (nonArchived.income || []).reduce((s, i) => s + (i.estBudget || 0), 0);
  let totalExpenses = 0;
  Object.keys(nonArchived).forEach((k) => {
    if (k !== "income") nonArchived[k].forEach((i) => (totalExpenses += i.estBudget || 0));
  });
  return { totalIncome, totalExpenses, netIncome: totalIncome - totalExpenses };
};

export const categoryTotalsOf = (nonArchived) =>
  Object.keys(nonArchived).filter((k) => k !== "income").map((k) => ({
    name: k === "homeOffice" ? "Home Office" : k,
    value: nonArchived[k].reduce((s, i) => s + (i.estBudget || 0), 0),
  }));

export const upcomingPaymentsOf = (nonArchived) => {
  const out = [];
  const now = new Date();
  Object.keys(nonArchived).forEach((k) => {
    if (k !== "income") {
      (nonArchived[k] || []).forEach((i) => {
        if (i.dueDate) {
          const d = new Date(i.dueDate);
          if (!isNaN(d)) {
            const diff = Math.ceil((d - now) / (1000*60*60*24));
            out.push({
              category: k === "homeOffice" ? "Home Office" : k,
              name: i.category, dueDate: i.dueDate, daysUntilDue: diff,
              estBudget: i.estBudget, priority: diff <= 3 ? "high" : diff <= 7 ? "medium" : "low",
            });
          }
        }
      });
    }
  });
  return out.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
};

export const flatRowsOf = (nonArchived) =>
  Object.keys(nonArchived).flatMap((k) =>
    (nonArchived[k] || []).map((i) => ({
      section: k, sectionLabel: sectionLabel(k), name: i.category,
      dueDate: i.dueDate, estBudget: i.estBudget || 0, actualSpent: i.actualSpent || 0,
      status: i.bankSource === "Paid" ? "Paid" : i.actualSpent > 0 ? "Partial" : "Pending",
    }))
  );

export const totalsByCategoryOf = (nonArchived) =>
  Object.keys(nonArchived).reduce((acc, k) => {
    const budget = (nonArchived[k] || []).reduce((s, i) => s + (i.estBudget || 0), 0);
    const actual = (nonArchived[k] || []).reduce((s, i) => s + (i.actualSpent || 0), 0);
    acc[sectionLabel(k)] = { budget, actual };
    return acc;
  }, {});
