// src/components/credit/CreditReportScanner.jsx
import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Link2,
  ScanSearch,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import CloseScreenButton from '../common/CloseScreenButton.jsx';

const BUREAU_OPTIONS = ['Experian', 'Equifax', 'TransUnion'];
const DEFAULT_BUCKETS = [
  ['banking', 'Banking & Finance'],
  ['housing', 'Housing'],
  ['transportation', 'Transportation'],
  ['personal', 'Personal'],
  ['subscriptions', 'Subscriptions'],
  ['misc', 'Miscellaneous'],
];

const FIELD_LINE_PATTERN = /^(account|acct|balance|status|pay status|payment status|account type|date|opened|closed|credit|high|original|past due|amount|monthly|last payment|first delinquency|delinquent|collection|assigned|original creditor|remarks|comments|responsibility|term|loan|subscriber|creditor)\b/i;
const SECTION_LINE_PATTERN = /^(accounts?|credit accounts?|account information|potentially negative|satisfactory accounts?|collections?|inquiries|personal information|consumer statements?|public records?|credit score|payment history)$/i;

const cleanLine = (value = '') =>
  String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();

const normalizeText = (value = '') =>
  String(value || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(cleanLine)
    .filter(Boolean)
    .join('\n');

const redactSensitiveValue = (value = '') =>
  cleanLine(value)
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[redacted SSN]')
    .replace(/\b(?:SSN|Social Security(?: Number)?)\s*[:#-]?\s*\d{4,9}\b/gi, '[redacted SSN]')
    .replace(/\b(?:DOB|Date of Birth)\s*[:#-]?\s*[^|,;]+/gi, '[redacted birth date]');

const normalizeCreditor = (value = '') =>
  cleanLine(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\b(incorporated|corporation|company|limited|llc|inc|corp|co|ltd|services|service|financial|bank|usa|na|n a)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const parseMoney = (value = '') => {
  const raw = cleanLine(value);
  if (!raw || /^(?:n\/?a|not reported|unknown|--|none)$/i.test(raw)) return null;
  const match = raw.match(/-?\$?\s*([\d,]+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const number = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(number)) return null;
  return /\(.*\)/.test(raw) || /^-/.test(raw) ? -Math.abs(number) : number;
};

const normalizeFullDate = (value = '') => {
  const raw = cleanLine(value);
  if (!raw) return '';

  const iso = raw.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;

  const slash = raw.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  if (slash) {
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
  }

  const monthName = raw.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i);
  if (monthName) {
    const parsed = new Date(`${monthName[1]} ${monthName[2]}, ${monthName[3]} 12:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return [parsed.getFullYear(), String(parsed.getMonth() + 1).padStart(2, '0'), String(parsed.getDate()).padStart(2, '0')].join('-');
    }
  }

  return '';
};

const extractLast4 = (value = '') => {
  const raw = cleanLine(value);
  if (!raw) return '';

  const maskedEnding = raw.match(/(?:\*|x|X|•|#){2,}\s*[- ]*([A-Za-z0-9]{4})\b/);
  if (maskedEnding) return maskedEnding[1].toUpperCase();

  if (/(?:\*|x|X|•|#){2,}\s*$/.test(raw)) return '';

  const compact = raw.replace(/[^A-Za-z0-9]/g, '');
  return compact.length >= 4 ? compact.slice(-4).toUpperCase() : '';
};

const getFieldValue = (lines, labelPatterns) => {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    for (const labelPattern of labelPatterns) {
      const inline = line.match(new RegExp(`^(?:${labelPattern})\\s*(?::|#|-)?\\s+(.+)$`, 'i'));
      if (inline?.[1]) return redactSensitiveValue(inline[1]);

      if (new RegExp(`^(?:${labelPattern})\\s*:?$`, 'i').test(line)) {
        const nextLine = lines[index + 1];
        if (nextLine && !FIELD_LINE_PATTERN.test(nextLine)) return redactSensitiveValue(nextLine);
      }
    }
  }
  return '';
};

const mapAccountStatus = (rawStatus = '') => {
  const status = cleanLine(rawStatus).toLowerCase();
  if (!status) return 'Unknown';
  if (/paid in full|paid.*closed|account paid/.test(status)) return 'Paid in Full';
  if (/charge[- ]?off|charged off/.test(status)) return 'Charged Off';
  if (/collection|placed for collection/.test(status)) return 'Sent to Collections';
  if (/bankrupt/.test(status)) return 'Bankruptcy Review';
  if (/settled/.test(status)) return 'Settled';
  if (/dispute/.test(status)) return 'Disputed';
  if (/suspend/.test(status)) return 'Suspended';
  if (/closed/.test(status)) return 'Closed';
  if (/past due|delinquent|late|\b30 days\b|\b60 days\b|\b90 days\b|\b120 days\b/.test(status)) return 'Past Due';
  if (/current|pays? as agreed|never late|satisfactory/.test(status)) return 'Current';
  if (/open/.test(status)) return 'Open';
  return 'Unknown';
};

const findCreditorLine = (lines, markerIndex) => {
  for (let index = markerIndex - 1; index >= Math.max(0, markerIndex - 8); index -= 1) {
    const line = cleanLine(lines[index]);
    if (!line || FIELD_LINE_PATTERN.test(line) || SECTION_LINE_PATTERN.test(line)) continue;
    if (/^(?:experian|equifax|transunion|trans union)$/i.test(line)) continue;
    if (/\b(?:report|credit file|prepared for|page \d+)\b/i.test(line)) continue;
    if (line.length >= 2 && line.length <= 100) return index;
  }
  return Math.max(0, markerIndex - 1);
};

const segmentTradelines = (text) => {
  const lines = normalizeText(text).split('\n');
  let markers = lines
    .map((line, index) => (/^(?:account number|account #|acct number|acct #|partial account number)\b/i.test(line) ? index : -1))
    .filter((index) => index >= 0);

  if (markers.length === 0) {
    markers = lines
      .map((line, index) => (/^(?:account name|creditor name|subscriber name)\b/i.test(line) ? index : -1))
      .filter((index) => index >= 0);
  }

  const starts = markers.map((marker) => findCreditorLine(lines, marker));

  return markers.map((marker, index) => {
    const start = starts[index];
    const end = index + 1 < markers.length ? starts[index + 1] : lines.length;
    return {
      marker,
      markerOffset: marker - start,
      lines: lines.slice(start, Math.max(start + 1, end)),
    };
  });
};

const getCreditorName = (blockLines, markerOffset = 0) => {
  const named = getFieldValue(blockLines, ['account name', 'creditor name', 'subscriber name', 'company name', 'lender name']);
  if (named) return named;

  for (let index = Math.min(markerOffset, blockLines.length - 1); index >= 0; index -= 1) {
    const line = blockLines[index];
    if (!FIELD_LINE_PATTERN.test(line) && !SECTION_LINE_PATTERN.test(line) && line.length <= 100) return redactSensitiveValue(line);
  }

  return '';
};

const parseTradelineBlock = (block, bureau, reportDate, config) => {
  const lines = block.lines;
  const accountNumber = getFieldValue(lines, ['account number', 'account #', 'acct number', 'acct #', 'partial account number']);
  const rawStatus = getFieldValue(lines, config.statusLabels);
  const creditor = getCreditorName(lines, Math.max(0, block.markerOffset));
  const balance = parseMoney(getFieldValue(lines, config.balanceLabels));
  const pastDueAmount = parseMoney(getFieldValue(lines, config.pastDueLabels));
  const originalBalance = parseMoney(getFieldValue(lines, ['original balance', 'original amount', 'high balance', 'highest balance']));
  const monthlyPayment = parseMoney(getFieldValue(lines, ['monthly payment', 'scheduled payment amount', 'payment amount']));
  const creditLimit = parseMoney(getFieldValue(lines, ['credit limit', 'limit']));
  const delinquentSinceRaw = getFieldValue(lines, config.delinquencyLabels);
  const collectionAgency = getFieldValue(lines, ['collection agency', 'assigned to', 'agency name']);
  const originalCreditor = getFieldValue(lines, ['original creditor', 'original lender']);
  const remarks = getFieldValue(lines, ['remarks?', 'comments?', 'account history']);
  const dateReportedRaw = getFieldValue(lines, ['date reported', 'date updated', 'status updated', 'last reported', 'reported date']);

  const account = {
    creditor,
    accountLast4: extractLast4(accountNumber),
    accountType: getFieldValue(lines, ['account type', 'type of account', 'loan type']),
    accountStatus: mapAccountStatus(rawStatus),
    rawStatus,
    currentBalance: balance,
    pastDueAmount,
    originalBalance,
    monthlyPayment,
    creditLimit,
    dateOpened: normalizeFullDate(getFieldValue(lines, ['date opened', 'opened date', 'opened'])),
    lastPaymentDate: normalizeFullDate(getFieldValue(lines, ['last payment date', 'date of last payment', 'last payment made'])),
    delinquentSince: normalizeFullDate(delinquentSinceRaw),
    delinquentSinceRaw: delinquentSinceRaw && !normalizeFullDate(delinquentSinceRaw) ? delinquentSinceRaw : '',
    dateReported: normalizeFullDate(dateReportedRaw),
    dateReportedRaw: dateReportedRaw && !normalizeFullDate(dateReportedRaw) ? dateReportedRaw : '',
    collectionAgency,
    sentToCollectionsDate: normalizeFullDate(getFieldValue(lines, ['date assigned', 'assigned date', 'collection date', 'placed for collection'])),
    originalCreditor,
    remarks,
    bureau,
    reportDate,
  };

  if (account.accountStatus === 'Sent to Collections' && !account.collectionAgency) {
    account.collectionAgency = creditor;
  }

  return account;
};

const BUREAU_CONFIGS = {
  Experian: {
    statusLabels: ['status detail', 'payment status', 'account status', 'status(?! updated| date)'],
    balanceLabels: ['current balance', 'balance amount', 'balance(?! updated| date)'],
    pastDueLabels: ['past due amount', 'amount past due', 'past due'],
    delinquencyLabels: ['date of first delinquency', 'first delinquency date', 'delinquency first reported'],
  },
  Equifax: {
    statusLabels: ['account status', 'current status', 'payment status', 'activity designator'],
    balanceLabels: ['balance amount', 'current balance', 'balance(?! updated| date)'],
    pastDueLabels: ['amount past due', 'past due amount', 'past due'],
    delinquencyLabels: ['date of first delinquency', 'date major delinquency first reported', 'first delinquency date'],
  },
  TransUnion: {
    statusLabels: ['pay status', 'account status', 'payment status', 'status(?! updated| date)'],
    balanceLabels: ['current balance', 'balance amount', 'balance(?! updated| date)'],
    pastDueLabels: ['past due', 'amount past due', 'past due amount'],
    delinquencyLabels: ['date of first delinquency', 'first delinquency date', 'estimated month and year item will be removed'],
  },
  Generic: {
    statusLabels: ['pay status', 'status detail', 'account status', 'current status', 'payment status', 'activity designator', 'status(?! updated| date)'],
    balanceLabels: ['current balance', 'balance amount', 'balance(?! updated| date)'],
    pastDueLabels: ['amount past due', 'past due amount', 'past due'],
    delinquencyLabels: ['date of first delinquency', 'date major delinquency first reported', 'first delinquency date', 'delinquency first reported'],
  },
};

const detectReportDate = (text) => {
  const lines = normalizeText(text).split('\n');
  return normalizeFullDate(
    getFieldValue(lines, ['report date', 'credit report date', 'date generated', 'prepared on', 'file date'])
  );
};

export const detectCreditBureau = (text = '') => {
  const normalized = String(text || '').toLowerCase();
  const matches = BUREAU_OPTIONS.filter((bureau) => {
    if (bureau === 'TransUnion') return /trans\s*union/.test(normalized);
    return normalized.includes(bureau.toLowerCase());
  });
  return matches.length === 1 ? matches[0] : matches.length > 1 ? 'Multi-Bureau' : 'Unknown';
};

const parseBureauReport = (text, bureau) => {
  const reportDate = detectReportDate(text);
  const config = BUREAU_CONFIGS[bureau] || BUREAU_CONFIGS.Experian;
  const blocks = segmentTradelines(text);
  const warnings = [];

  if (blocks.length === 0) {
    warnings.push('No account-number sections were detected. Try copying the report with account headings and field labels included.');
  }

  const accounts = blocks
    .map((block) => parseTradelineBlock(block, bureau, reportDate, config))
    .filter((account) => {
      const hasDebtField = account.currentBalance !== null || account.pastDueAmount !== null || account.rawStatus || account.accountLast4;
      const looksLikeInquiry = /inquir|requestor|promotional review/i.test(account.creditor);
      return account.creditor && hasDebtField && !looksLikeInquiry;
    });

  const unique = [];
  const seen = new Set();
  accounts.forEach((account) => {
    const key = [normalizeCreditor(account.creditor), account.accountLast4, account.currentBalance, account.rawStatus].join('|');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(account);
    }
  });

  if (unique.length < accounts.length) warnings.push(`${accounts.length - unique.length} duplicate account section(s) were ignored.`);

  return { bureau, reportDate, accounts: unique, warnings };
};

export const parseExperianCreditReport = (text) => parseBureauReport(text, 'Experian');
export const parseEquifaxCreditReport = (text) => parseBureauReport(text, 'Equifax');
export const parseTransUnionCreditReport = (text) => parseBureauReport(text, 'TransUnion');

export const parseCreditReportText = (text, bureauOverride = '') => {
  const normalized = normalizeText(text);
  if (normalized.length < 80) throw new Error('The report text is too short to identify credit accounts.');

  const detected = bureauOverride || detectCreditBureau(normalized);
  if (detected === 'Experian') return parseExperianCreditReport(normalized);
  if (detected === 'Equifax') return parseEquifaxCreditReport(normalized);
  if (detected === 'TransUnion') return parseTransUnionCreditReport(normalized);

  const fallback = parseBureauReport(normalized, 'Generic');
  return {
    ...fallback,
    bureau: detected,
    warnings: [
      `The bureau was ${detected === 'Multi-Bureau' ? 'not unique' : 'not detected'}, so the general account parser was used.`,
      ...fallback.warnings,
    ],
    accounts: fallback.accounts.map((account) => ({ ...account, bureau: detected })),
  };
};

const extractPdfText = async (file, onProgress) => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerUrl = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress(`Reading PDF page ${pageNumber} of ${pdf.numPages}`);
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    let pageText = '';
    let previousY = null;

    content.items.forEach((item) => {
      const y = Array.isArray(item.transform) ? Math.round(item.transform[5]) : null;
      if (previousY !== null && y !== null && Math.abs(y - previousY) > 2) pageText += '\n';
      pageText += `${item.str || ''}${item.hasEOL ? '\n' : ' '}`;
      if (y !== null) previousY = y;
    });

    pageTexts.push(pageText);
  }

  return { text: pageTexts.join('\n'), pdf };
};

const ocrImage = async (source, onProgress) => {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (message) => {
      if (message?.status === 'recognizing text' && Number.isFinite(message.progress)) {
        onProgress(`Reading image text, ${Math.round(message.progress * 100)}%`);
      }
    },
  });

  try {
    const result = await worker.recognize(source);
    return result?.data?.text || '';
  } finally {
    await worker.terminate();
  }
};

const ocrPdfPages = async (pdf, onProgress) => {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  const texts = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      onProgress(`OCR page ${pageNumber} of ${pdf.numPages}`);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.8 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d', { willReadFrequently: true });
      await page.render({ canvasContext: context, viewport }).promise;
      const result = await worker.recognize(canvas);
      texts.push(result?.data?.text || '');
      canvas.width = 1;
      canvas.height = 1;
    }
  } finally {
    await worker.terminate();
  }

  return texts.join('\n');
};

const getExistingAccounts = (state) =>
  Object.entries(state?.buckets || {})
    .filter(([bucket]) => bucket !== 'income')
    .flatMap(([bucket, items]) =>
      (items || []).map((item) => ({
        key: `${bucket}:${item.id}`,
        bucket,
        itemId: item.id,
        name: item.category || 'Unnamed item',
        accountLast4: String(item.accountLast4 || '').toUpperCase(),
        normalizedName: normalizeCreditor(item.category || item.originalCreditor || ''),
      }))
    );

const creditorSimilarity = (first, second) => {
  if (!first || !second) return false;
  if (first === second || first.includes(second) || second.includes(first)) return true;
  const firstTokens = new Set(first.split(' ').filter((token) => token.length > 2));
  const secondTokens = second.split(' ').filter((token) => token.length > 2);
  return secondTokens.some((token) => firstTokens.has(token));
};

const suggestExistingMatch = (account, existingAccounts) => {
  const creditor = normalizeCreditor(account.creditor || account.originalCreditor);
  const last4Matches = account.accountLast4
    ? existingAccounts.filter((existing) => existing.accountLast4 === account.accountLast4)
    : [];

  const strongLast4 = last4Matches.find((existing) => creditorSimilarity(creditor, existing.normalizedName));
  if (strongLast4) return strongLast4;
  if (last4Matches.length === 1) return last4Matches[0];

  const nameMatches = existingAccounts.filter((existing) => creditorSimilarity(creditor, existing.normalizedName));
  return nameMatches.length === 1 ? nameMatches[0] : null;
};

const formatMoney = (value) =>
  value === null || value === undefined
    ? 'Not reported'
    : `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CreditReportScanner({ isOpen, onClose, state, onImport }) {
  const [sourceText, setSourceText] = useState('');
  const [bureauOverride, setBureauOverride] = useState('');
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [reviewRows, setReviewRows] = useState([]);
  const fileInputRef = useRef(null);

  const existingAccounts = useMemo(() => getExistingAccounts(state), [state]);
  const bucketOptions = useMemo(() => {
    const known = new Map(DEFAULT_BUCKETS);
    Object.keys(state?.buckets || {}).forEach((bucket) => {
      if (!['income', 'emergencyFund'].includes(bucket) && !known.has(bucket)) known.set(bucket, bucket);
    });
    return Array.from(known.entries()).filter(([bucket]) => state?.buckets?.[bucket]);
  }, [state]);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setSourceText('');
    setBureauOverride('');
    setProcessing(false);
    setProgress('');
    setError('');
    setReport(null);
    setReviewRows([]);
    onClose();
  };

  const prepareReview = (parsedReport) => {
    if (!parsedReport.accounts.length) {
      throw new Error('No credit accounts were detected. Try pasting more of the account-details section or choose the correct bureau.');
    }

    const rows = parsedReport.accounts.map((account, index) => {
      const suggested = suggestExistingMatch(account, existingAccounts);
      return {
        id: `credit-scan-${index}`,
        selected: true,
        account,
        target: suggested?.key || 'create',
        suggestedMatch: suggested?.key || '',
        bucket: state?.buckets?.banking ? 'banking' : bucketOptions[0]?.[0] || 'misc',
        budgetStatus: 'pending',
      };
    });

    setReport(parsedReport);
    setReviewRows(rows);
    setSourceText('');
  };

  const parseText = (text) => {
    setProcessing(true);
    setError('');
    setProgress('Analyzing account sections');
    try {
      prepareReview(parseCreditReportText(text, bureauOverride));
    } catch (parseError) {
      setError(parseError.message || 'The credit report could not be parsed.');
    } finally {
      setProcessing(false);
      setProgress('');
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError('The selected file is larger than 50 MB.');
      return;
    }

    setProcessing(true);
    setError('');
    try {
      let text = '';
      if (file.type === 'text/plain' || /\.txt$/i.test(file.name)) {
        setProgress('Reading text file');
        text = await file.text();
      } else if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        const extracted = await extractPdfText(file, setProgress);
        text = extracted.text;
        if (normalizeText(text).length < 500) {
          setProgress('The PDF contains scanned pages. Starting local OCR.');
          text = await ocrPdfPages(extracted.pdf, setProgress);
        }
      } else if (file.type.startsWith('image/')) {
        setProgress('Starting local image OCR');
        text = await ocrImage(file, setProgress);
      } else {
        throw new Error('Choose a PDF, TXT, JPG, PNG, or WEBP file.');
      }

      prepareReview(parseCreditReportText(text, bureauOverride));
    } catch (fileError) {
      setError(fileError.message || 'The selected file could not be processed.');
    } finally {
      setProcessing(false);
      setProgress('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateReviewRow = (id, updates) => {
    setReviewRows((current) => current.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const handleImport = () => {
    const selectedRows = reviewRows.filter((row) => row.selected);
    if (!selectedRows.length) {
      setError('Select at least one account to import.');
      return;
    }

    const operations = selectedRows.map((row) => {
      if (row.target !== 'create') {
        const existing = existingAccounts.find((account) => account.key === row.target);
        return {
          type: 'update',
          bucket: existing.bucket,
          itemId: existing.itemId,
          account: row.account,
        };
      }

      return {
        type: 'create',
        bucket: row.bucket,
        budgetStatus: row.budgetStatus,
        account: row.account,
      };
    });

    onImport(operations, {
      bureau: report.bureau,
      reportDate: report.reportDate,
      accountCount: selectedRows.length,
    });
    resetAndClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-950/70 px-4 py-6">
      <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-rose-50 via-white to-indigo-50 px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <ScanSearch className="h-6 w-6 text-rose-700" />
              <h2 className="text-xl font-black text-slate-950">Credit Report Scanner</h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">Review every detected account before any budget or debt record changes.</p>
          </div>
          <CloseScreenButton onClick={resetAndClose} />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!report ? (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                  <div className="flex items-center gap-2 font-black"><ShieldCheck className="h-5 w-5" />Local privacy protections</div>
                  <p className="mt-2">The report is processed in your browser. The original file and raw text are not added to budget data. Full account numbers, SSNs, and birth dates are not imported.</p>
                </div>
                <label className="text-sm font-bold text-slate-700">
                  Credit Bureau
                  <select value={bureauOverride} onChange={(event) => setBureauOverride(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">Detect automatically</option>
                    {BUREAU_OPTIONS.map((bureau) => <option key={bureau} value={bureau}>{bureau}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2"><FileText className="h-5 w-5 text-blue-700" /><h3 className="font-black text-slate-950">Paste report text</h3></div>
                  <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} rows={15} placeholder="Copy the account-details or tradeline section from your credit report and paste it here." className="mt-3 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs" />
                  <button type="button" onClick={() => parseText(sourceText)} disabled={processing || !sourceText.trim()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 font-black text-white hover:bg-blue-800 disabled:opacity-50">
                    <ScanSearch className="h-4 w-4" />Analyze Pasted Text
                  </button>
                </div>

                <div className="rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 p-6 text-center">
                  <Upload className="mx-auto h-12 w-12 text-indigo-600" />
                  <h3 className="mt-3 font-black text-slate-950">Upload a credit report</h3>
                  <p className="mt-2 text-sm text-slate-600">PDF text is extracted locally. Scanned PDFs and images use local OCR.</p>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={processing} className="mt-5 rounded-lg bg-indigo-700 px-5 py-2 font-black text-white hover:bg-indigo-800 disabled:opacity-50">Choose PDF, TXT, or Image</button>
                  <input ref={fileInputRef} type="file" accept=".pdf,.txt,image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
                  <p className="mt-3 text-xs font-semibold text-slate-500">Maximum file size: 50 MB</p>
                </div>
              </div>

              {processing && <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-900">{progress || 'Processing credit report locally...'}</div>}
              {error && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900"><AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />{error}</div>}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-slate-950">{report.accounts.length} account{report.accounts.length === 1 ? '' : 's'} detected</p>
                  <p className="text-sm text-slate-600">Bureau: {report.bureau}{report.reportDate ? ` · Report date: ${report.reportDate}` : ''}</p>
                </div>
                <button type="button" onClick={() => { setReport(null); setReviewRows([]); setError(''); }} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100">Scan Different Report</button>
              </div>

              {report.warnings.map((warning, index) => <div key={`${warning}-${index}`} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900"><AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />{warning}</div>)}
              {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-900">{error}</div>}

              <div className="space-y-3">
                {reviewRows.map((row) => {
                  const isCreate = row.target === 'create';
                  return (
                    <div key={row.id} className={`rounded-xl border p-4 ${row.selected ? 'border-indigo-300 bg-white' : 'border-slate-200 bg-slate-50 opacity-65'}`}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={row.selected} onChange={(event) => updateReviewRow(row.id, { selected: event.target.checked })} className="mt-1 h-4 w-4" aria-label={`Select ${row.account.creditor}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-black text-slate-950">{row.account.creditor}</h3>
                            {row.account.accountLast4 && <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">•••• {row.account.accountLast4}</span>}
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">{row.account.accountStatus}</span>
                            {row.suggestedMatch && <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800"><Link2 className="h-3 w-3" />Possible match</span>}
                          </div>

                          <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-5">
                            <div><span className="font-bold text-slate-500">Balance</span><p className="font-black text-slate-900">{formatMoney(row.account.currentBalance)}</p></div>
                            <div><span className="font-bold text-slate-500">Past Due</span><p className="font-black text-red-700">{formatMoney(row.account.pastDueAmount)}</p></div>
                            <div><span className="font-bold text-slate-500">Original / High</span><p className="font-black text-slate-900">{formatMoney(row.account.originalBalance)}</p></div>
                            <div><span className="font-bold text-slate-500">Last Payment</span><p className="font-black text-slate-900">{row.account.lastPaymentDate || 'Not reported'}</p></div>
                            <div><span className="font-bold text-slate-500">First Delinquency</span><p className="font-black text-slate-900">{row.account.delinquentSince || row.account.delinquentSinceRaw || 'Not reported'}</p></div>
                          </div>

                          <div className="mt-4 grid gap-3 lg:grid-cols-3">
                            <label className="text-xs font-bold text-slate-700 lg:col-span-2">Import action
                              <select value={row.target} onChange={(event) => updateReviewRow(row.id, { target: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                <option value="create">Create a new debt item</option>
                                {existingAccounts.map((existing) => <option key={existing.key} value={existing.key}>Update: {existing.name}{existing.accountLast4 ? ` •••• ${existing.accountLast4}` : ''} ({existing.bucket})</option>)}
                              </select>
                            </label>

                            {isCreate ? (
                              <label className="text-xs font-bold text-slate-700">Budget category
                                <select value={row.bucket} onChange={(event) => updateReviewRow(row.id, { bucket: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                  {bucketOptions.map(([bucket, label]) => <option key={bucket} value={bucket}>{label}</option>)}
                                </select>
                              </label>
                            ) : (
                              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-900">Existing budget amounts, due date, notes, and payment-plan status will be preserved.</div>
                            )}
                          </div>

                          {isCreate && (
                            <label className="mt-3 block text-xs font-bold text-slate-700">Payment plan decision
                              <select value={row.budgetStatus} onChange={(event) => updateReviewRow(row.id, { budgetStatus: event.target.value })} className="mt-1 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                                <option value="pending">Active payment plan</option>
                                <option value="notPaying">Not Paying</option>
                              </select>
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <button type="button" onClick={resetAndClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
          {report && (
            <button type="button" onClick={handleImport} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-5 py-2 text-sm font-black text-white hover:bg-emerald-800">
              <CheckCircle2 className="h-4 w-4" />Import {reviewRows.filter((row) => row.selected).length} Selected Account{reviewRows.filter((row) => row.selected).length === 1 ? '' : 's'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
