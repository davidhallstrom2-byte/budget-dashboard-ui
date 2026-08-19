const CSC_STORAGE_KEY = 'cscShifts.v1';
const CSC_ARCHIVE_STORAGE_KEY = 'cscShifts.archived.v1';
const CSC_SHIFT_UPDATE_EVENT = 'cscShifts:updated';

const money = (value) => {
  const number = Number(String(value ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(number) ? number : 0;
};

const roundCurrency = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const normalizeDate = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return '';

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const slashMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (slashMatch) {
    const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
    return `${year}-${slashMatch[1].padStart(2, '0')}-${slashMatch[2].padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';

  return [
    String(parsed.getFullYear()).padStart(4, '0'),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
};

const isCscPaycheck = (paycheck = {}) => {
  const employer = String(paycheck.employer || '').trim();
  return !employer || /contemporary services|\bcsc\b/i.test(employer);
};

const getPaycheckIdentity = (paycheck = {}, index = 0) =>
  String(
    paycheck.id ||
      paycheck.checkNumber ||
      [paycheck.checkDate, paycheck.payPeriodStart, paycheck.payPeriodEnd, index].join('|')
  );

const getEarningsLineDate = (line = {}, paycheck = {}) => {
  const savedDate = normalizeDate(line.workDate || line.dateWorked || line.date || '');
  if (savedDate) return savedDate;

  const workLine = String(line.workLine || '');
  const compactMonthDay = workLine.match(/(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/);
  if (!compactMonthDay) return '';

  const yearCandidates = [
    normalizeDate(paycheck.payPeriodStart).slice(0, 4),
    normalizeDate(paycheck.payPeriodEnd).slice(0, 4),
    normalizeDate(paycheck.checkDate).slice(0, 4),
  ].filter(Boolean);

  for (const year of new Set(yearCandidates)) {
    const candidate = `${year}-${compactMonthDay[1]}-${compactMonthDay[2]}`;
    const parsed = new Date(`${candidate}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) return candidate;
  }

  return '';
};

const isNonWorkedPremiumLine = (line = {}) =>
  /break|premium|meal|penalty/i.test(String(line.type || line.earningType || ''));

const groupPaycheckEarningsByDate = (paycheck = {}) => {
  const groups = new Map();

  (Array.isArray(paycheck.earningsLines) ? paycheck.earningsLines : []).forEach((line) => {
    const workDate = getEarningsLineDate(line, paycheck);
    if (!workDate) return;

    const group = groups.get(workDate) || {
      workDate,
      grossPay: 0,
      workedHours: 0,
      paidHours: 0,
      earningsLines: [],
    };
    const lineHours = money(line.hours || line.totalHours || line.quantity || line.units);

    group.grossPay += money(
      line.amount || line.grossPay || line.earningsAmount || line.currentAmount
    );
    group.paidHours += lineHours;
    if (!isNonWorkedPremiumLine(line)) group.workedHours += lineHours;
    group.earningsLines.push({ ...line, workDate });
    groups.set(workDate, group);
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    grossPay: roundCurrency(group.grossPay),
    workedHours: roundCurrency(group.workedHours),
    paidHours: roundCurrency(group.paidHours),
  }));
};

const getShiftHours = (shift = {}) => {
  const startDate = normalizeDate(shift.startDate);
  const finishDate = normalizeDate(shift.finishDate || shift.startDate);
  if (!startDate || !finishDate || !shift.startTime || !shift.finishTime) return 0;

  const start = new Date(`${startDate}T${shift.startTime}:00`);
  const finish = new Date(`${finishDate}T${shift.finishTime}:00`);
  const difference = finish.getTime() - start.getTime();
  if (!Number.isFinite(difference) || difference <= 0) return 0;

  return Math.round((difference / 3600000) * 100) / 100;
};

const clearAutomaticReconciliation = (shift = {}) => {
  if (!shift.paycheckReconciled) return { ...shift };

  const restored = {
    ...shift,
    shiftStatus: shift.prePaycheckShiftStatus || shift.shiftStatus || 'Done',
    paidStatus: shift.prePaycheckPaidStatus || 'Unpaid',
    paymentDate: shift.prePaycheckPaymentDate || '',
  };

  [
    'paycheckReconciled',
    'reconciledPaycheckId',
    'reconciledCheckNumber',
    'actualGrossPay',
    'actualNetPay',
    'actualWorkedHours',
    'actualPaidHours',
    'actualEarningsLines',
    'prePaycheckShiftStatus',
    'prePaycheckPaidStatus',
    'prePaycheckPaymentDate',
  ].forEach((field) => delete restored[field]);

  return restored;
};

const chooseShiftForEarningsGroup = (records = [], group = {}) => {
  const candidates = records.filter(
    (record) =>
      !record.matched &&
      record.shift.shiftStatus !== 'Cancelled' &&
      normalizeDate(record.shift.startDate) === group.workDate
  );

  if (candidates.length === 1) return candidates[0];
  if (candidates.length < 2 || group.workedHours <= 0) return null;

  const exactHours = candidates.filter(
    (record) => Math.abs(getShiftHours(record.shift) - group.workedHours) <= 0.26
  );
  return exactHours.length === 1 ? exactHours[0] : null;
};

export const reconcileCscShiftRecords = (
  activeShifts = [],
  archivedShifts = [],
  paychecks = []
) => {
  const active = (Array.isArray(activeShifts) ? activeShifts : []).map(
    clearAutomaticReconciliation
  );
  const archived = (Array.isArray(archivedShifts) ? archivedShifts : []).map(
    clearAutomaticReconciliation
  );
  const records = [
    ...active.map((shift, index) => ({ source: 'active', index, shift, matched: false })),
    ...archived.map((shift, index) => ({ source: 'archived', index, shift, matched: false })),
  ];

  (Array.isArray(paychecks) ? paychecks : [])
    .filter(isCscPaycheck)
    .map((paycheck, index) => ({ paycheck, index }))
    .sort((a, b) =>
      normalizeDate(a.paycheck.checkDate).localeCompare(normalizeDate(b.paycheck.checkDate))
    )
    .forEach(({ paycheck, index }) => {
      const groups = groupPaycheckEarningsByDate(paycheck);
      if (!groups.length) return;

      const fullGross = money(paycheck.grossPay) || groups.reduce(
        (sum, group) => sum + group.grossPay,
        0
      );
      const fullNet = money(paycheck.netPay || paycheck.checkAmount);
      const datedGross = groups.reduce((sum, group) => sum + group.grossPay, 0);
      const targetDatedNet = fullGross > 0
        ? roundCurrency(fullNet * Math.min(1, datedGross / fullGross))
        : 0;
      let allocatedNet = 0;

      const allocatedGroups = groups.map((group, groupIndex) => {
        const isLastGroup = groupIndex === groups.length - 1;
        const netPay = isLastGroup
          ? roundCurrency(targetDatedNet - allocatedNet)
          : fullGross > 0
            ? roundCurrency(fullNet * (group.grossPay / fullGross))
            : 0;
        allocatedNet = roundCurrency(allocatedNet + netPay);
        return { ...group, netPay };
      });

      allocatedGroups.forEach((group) => {
        const record = chooseShiftForEarningsGroup(records, group);
        if (!record) return;

        const current = record.shift;
        const next = {
          ...current,
          prePaycheckShiftStatus: current.shiftStatus || 'Scheduled',
          prePaycheckPaidStatus: current.paidStatus || 'Unpaid',
          prePaycheckPaymentDate: current.paymentDate || '',
          shiftStatus: 'Done',
          paidStatus: 'Paid',
          paymentDate: normalizeDate(paycheck.checkDate),
          paycheckReconciled: true,
          reconciledPaycheckId: getPaycheckIdentity(paycheck, index),
          reconciledCheckNumber: String(paycheck.checkNumber || ''),
          actualGrossPay: roundCurrency(group.grossPay),
          actualNetPay: group.netPay,
          actualWorkedHours: roundCurrency(group.workedHours),
          actualPaidHours: roundCurrency(group.paidHours),
          actualEarningsLines: group.earningsLines,
        };

        record.shift = next;
        record.matched = true;
        if (record.source === 'active') active[record.index] = next;
        else archived[record.index] = next;
      });
    });

  const changed =
    JSON.stringify(activeShifts || []) !== JSON.stringify(active) ||
    JSON.stringify(archivedShifts || []) !== JSON.stringify(archived);

  return { activeShifts: active, archivedShifts: archived, changed };
};

const readStoredArray = (storageKey) => {
  if (typeof localStorage === 'undefined') return [];

  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Failed to read ${storageKey} for paycheck reconciliation:`, error);
    return [];
  }
};

export const reconcileStoredCscShiftsWithPaychecks = (paychecks = []) => {
  const activeShifts = readStoredArray(CSC_STORAGE_KEY);
  const archivedShifts = readStoredArray(CSC_ARCHIVE_STORAGE_KEY);
  const result = reconcileCscShiftRecords(activeShifts, archivedShifts, paychecks);

  if (result.changed && typeof localStorage !== 'undefined') {
    localStorage.setItem(CSC_STORAGE_KEY, JSON.stringify(result.activeShifts));
    localStorage.setItem(CSC_ARCHIVE_STORAGE_KEY, JSON.stringify(result.archivedShifts));
    window.dispatchEvent(
      new CustomEvent(CSC_SHIFT_UPDATE_EVENT, {
        detail: {
          shifts: result.activeShifts,
          archivedShifts: result.archivedShifts,
          source: 'paycheck-reconciliation',
        },
      })
    );
  }

  return result;
};

export default reconcileStoredCscShiftsWithPaychecks;
