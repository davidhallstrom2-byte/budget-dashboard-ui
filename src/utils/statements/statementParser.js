// src/utils/statements/statementParser.js

/**
 * Parses bank/credit card statement text into transactions
 * Handles both single-line and table formats
 */

const TRANSACTION_KEYWORDS = [
  'purchase',
  'payment',
  'recurring payment',
  'monthly service fee',
  'service fee',
  'overdraft fee',
  'maintenance fee',
  'purchase return',
  'refund',
  'withdrawal',
  'deposit',
  'transfer',
  'atm',
  'debit',
  'credit',
  'zelle'
];

/**
 * Extract merchant name from transaction text
 */
function extractMerchant(text) {
  // Remove common noise
  let cleaned = text
    .replace(/Authorized On \d{2}\/\d{2}/gi, '')
    .replace(/Card \d{4}/gi, '')
    .replace(/[A-Z]\d{12,}/g, '') // Transaction IDs
    .replace(/\d{3}-\d{3}-\d{4}/g, '') // Phone numbers
    .replace(/\b[A-Z]{2}\b(?!\w)/g, '') // State codes (but not part of words)
    .replace(/Posted On \d{2}\/\d{2}/gi, '')
    .replace(/Ref #\s*\w+/gi, '')
    .replace(/ATM ID \d+/gi, '')
    .trim();

  // Remove transaction type keywords to isolate merchant
  TRANSACTION_KEYWORDS.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  });

  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Take first meaningful words (likely merchant name)
  const words = cleaned.split(/\s+/).filter(w => w.length > 1);
  const merchant = words.slice(0, 5).join(' ');
  
  return merchant || 'Unknown Merchant';
}

/**
 * Categorize transaction based on merchant name
 */
function categorizeTransaction(merchant, transactionType) {
  const m = merchant.toLowerCase();
  const type = (transactionType || '').toLowerCase();

  // Banking fees
  if (type.includes('fee') || type.includes('service')) {
    return { key: 'banking', label: 'Banking & Finance' };
  }

  // Deposits/Transfers
  if (type.includes('deposit') || type.includes('zelle') || type.includes('transfer')) {
    return { key: 'income', label: 'Income' };
  }

  // Subscriptions
  if (m.includes('netflix') || m.includes('hulu') || m.includes('spotify') || 
      m.includes('disney') || m.includes('paramount') || m.includes('amazon prime') ||
      m.includes('espn') || m.includes('mlb') || m.includes('hbo')) {
    return { key: 'subscriptions', label: 'Subscriptions' };
  }

  // Internet/Phone
  if (m.includes('spectrum') || m.includes('verizon') || m.includes('at&t') || 
      m.includes('t-mobile') || m.includes('comcast') || m.includes('xfinity')) {
    return { key: 'housing', label: 'Housing' };
  }

  // Transportation
  if (m.includes('uber') || m.includes('lyft') || m.includes('shell') || 
      m.includes('chevron') || m.includes('gas') || m.includes('exxon') ||
      m.includes('mobil') || m.includes('bp ')) {
    return { key: 'transportation', label: 'Transportation' };
  }

  // Food
  if (m.includes('restaurant') || m.includes('starbucks') || m.includes('mcdonald') ||
      m.includes('instacart') || m.includes('doordash') || m.includes('grubhub') ||
      m.includes('7-eleven') || m.includes('grocery') || m.includes('food')) {
    return { key: 'food', label: 'Food & Dining' };
  }

  // Shopping
  if (m.includes('amazon') || m.includes('walmart') || m.includes('target') || 
      m.includes('costco') || m.includes('best buy')) {
    return { key: 'misc', label: 'Miscellaneous' };
  }

  // Default
  return { key: 'misc', label: 'Miscellaneous' };
}

/**
 * Parse table-formatted line (with tabs or multiple spaces as separators)
 */
function parseTableLine(line, currentYear = new Date().getFullYear()) {
  // Split by tabs or multiple spaces (2+)
  const parts = line.split(/\t+|\s{2,}/).map(p => p.trim()).filter(Boolean);
  
  if (parts.length < 2) return null;

  // First part should be date (M/D format)
  const dateMatch = parts[0].match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!dateMatch) return null;

  const month = dateMatch[1].padStart(2, '0');
  const day = dateMatch[2].padStart(2, '0');
  const dateISO = `${currentYear}-${month}-${day}`;

  // Second part is description
  const description = parts[1] || '';

  // Find transaction type
  let transactionType = 'Purchase';
  for (const keyword of TRANSACTION_KEYWORDS) {
    const regex = new RegExp(keyword, 'i');
    if (regex.test(description)) {
      transactionType = keyword
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      break;
    }
  }

  // Extract all amounts from remaining parts
  const amounts = parts.slice(2)
    .flatMap(p => Array.from(p.matchAll(/(\d{1,10}(?:,\d{3})*\.\d{2})/g)))
    .map(m => parseFloat(m[1].replace(/,/g, '')))
    .filter(n => !isNaN(n) && n > 0);

  if (amounts.length === 0) return null;

  // For table format: Usually first amount is transaction, last is running balance
  // If only one amount, it's the transaction amount
  const amount = amounts.length === 1 ? amounts[0] : amounts[0];

  // Determine if deposit or withdrawal based on description or column
  const isDeposit = /deposit|zelle from|transfer from/i.test(description);
  const isReturn = /return|refund|credit/i.test(description);

  // Extract merchant
  const merchant = extractMerchant(description);
  
  // Categorize
  const category = categorizeTransaction(merchant, transactionType);

  return {
    id: `stmt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    date: dateISO,
    merchant,
    transactionType,
    amount: (isDeposit || isReturn) ? -amount : amount, // Deposits/returns are negative (credits)
    categoryKey: category.key,
    categoryLabel: category.label,
    rawLine: line
  };
}

/**
 * Parse single-line format (original format)
 */
function parseSingleLine(line, currentYear = new Date().getFullYear()) {
  // Extract date (M/D format at start)
  const dateMatch = line.match(/^(\d{1,2})\/(\d{1,2})\s/);
  if (!dateMatch) return null;

  const month = dateMatch[1].padStart(2, '0');
  const day = dateMatch[2].padStart(2, '0');
  const dateISO = `${currentYear}-${month}-${day}`;

  // Extract transaction type
  let transactionType = 'Purchase';
  for (const keyword of TRANSACTION_KEYWORDS) {
    const regex = new RegExp(keyword, 'i');
    if (regex.test(line)) {
      transactionType = keyword
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      break;
    }
  }

  // Extract amounts (find all decimal numbers)
  const amounts = Array.from(line.matchAll(/(\d{1,10}(?:,\d{3})*\.\d{2})/g))
    .map(m => parseFloat(m[1].replace(/,/g, '')))
    .filter(n => !isNaN(n) && n > 0);

  if (amounts.length === 0) return null;

  // Last amount before final balance is the transaction amount
  const amount = amounts.length === 1 ? amounts[0] : amounts[amounts.length - 2] || amounts[amounts.length - 1];

  // Extract merchant
  const merchant = extractMerchant(line);
  
  // Categorize
  const category = categorizeTransaction(merchant, transactionType);

  // Determine if this is a debit or credit
  const isReturn = transactionType.toLowerCase().includes('return') || 
                   transactionType.toLowerCase().includes('refund') ||
                   transactionType.toLowerCase().includes('credit') ||
                   /deposit|zelle from/i.test(line);

  return {
    id: `stmt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    date: dateISO,
    merchant,
    transactionType,
    amount: isReturn ? -amount : amount,
    categoryKey: category.key,
    categoryLabel: category.label,
    rawLine: line
  };
}

/**
 * Parse full statement text into transactions
 */
export function parseStatementText(text, options = {}) {
  const { year = new Date().getFullYear() } = options;
  
  if (!text || typeof text !== 'string') {
    return { transactions: [], errors: ['Invalid input'] };
  }

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    // Filter out header rows
    .filter(line => !/(^Date|^Transaction|Deposits\/|Withdrawals\/|Ending|Check No\.|Description)/i.test(line));

  const transactions = [];
  const errors = [];

  for (const line of lines) {
    try {
      // Try table format first (has tabs or multiple spaces)
      let transaction = null;
      if (/\t+|\s{2,}/.test(line)) {
        transaction = parseTableLine(line, year);
      }
      
      // Fall back to single-line format
      if (!transaction) {
        transaction = parseSingleLine(line, year);
      }

      if (transaction) {
        transactions.push(transaction);
      }
    } catch (err) {
      errors.push(`Failed to parse line: ${line.substring(0, 50)}...`);
      console.warn('Parse error:', err, line);
    }
  }

  return {
    transactions,
    errors,
    summary: {
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce((sum, t) => sum + Math.abs(t.amount), 0),
      categories: [...new Set(transactions.map(t => t.categoryLabel))]
    }
  };
}

/**
 * Convert parsed transactions to budget items
 */
export function transactionsToBudgetItems(transactions) {
  return transactions.map(t => ({
    categoryKey: t.categoryKey,
    item: {
      id: t.id,
      category: `${t.merchant} - ${t.transactionType}`,
      estBudget: Math.abs(t.amount),
      actualCost: Math.abs(t.amount),
      dueDate: t.date,
      status: 'pending'
    }
  }));
}