// src/utils/cscDisplay.js

const CSC_DISPLAY_ACRONYMS = new Map([
  ['ada', 'ADA'],
  ['ai', 'AI'],
  ['bts', 'BTS'],
  ['ca', 'CA'],
  ['c&t', 'C&T'],
  ['csc', 'CSC'],
  ['ess', 'ESS'],
  ['fifa', 'FIFA'],
  ['idl', 'IDL'],
  ['la', 'LA'],
  ['lamc', 'LAMC'],
  ['mlb', 'MLB'],
  ['nba', 'NBA'],
  ['nfl', 'NFL'],
  ['nhl', 'NHL'],
  ['sofi', 'SoFi'],
  ['us', 'US'],
  ['usa', 'USA'],
  ['vip', 'VIP'],
]);

const CSC_DISPLAY_SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'vs',
  'with',
]);

const normalizeWhitespace = (value = '') =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeEmbeddedCscVenueNames = (value = '') =>
  String(value || '')
    // SoFi's scheduler frequently uses the longer internal venue label.
    .replace(/\bsofi\s+stadium\s+(?:and|&)\s+hollywood\s+park\b/gi, 'SoFi Stadium')
    // Clean malformed legacy rows where the overlapping venue parser left "and".
    .replace(/\bsofi\s+stadium\s+(?:and|&)\s*(?=$|[-–—|,;:])/gi, 'SoFi Stadium')
    // Hollywood Park is the scheduler-side alias for the SoFi assignment venue.
    .replace(/\bhollywood\s+park\b/gi, 'SoFi Stadium')
    // Canonical Forum display name selected for the app.
    .replace(/\bthe\s+kia\s+forum\b/gi, 'Kia Forum')
    .replace(/\bthe\s+forum\b/gi, 'Kia Forum')
    .replace(/\bkia\s+forum\b/gi, 'Kia Forum')
    // Prevent duplicate venue labels if legacy text contains both aliases.
    .replace(/\bSoFi Stadium(?:\s+SoFi Stadium)+\b/gi, 'SoFi Stadium')
    .replace(/\bKia Forum(?:\s+Kia Forum)+\b/gi, 'Kia Forum');

const capitalizeWord = (word = '') => {
  const text = String(word || '');
  if (!text) return '';

  const acronym = CSC_DISPLAY_ACRONYMS.get(text.toLowerCase());
  if (acronym) return acronym;

  if (/[a-z]/.test(text) && /[A-Z]/.test(text.slice(1))) return text;

  return `${text.charAt(0).toLocaleUpperCase('en-US')}${text
    .slice(1)
    .toLocaleLowerCase('en-US')}`;
};

const titleCaseSegment = (segment = '') => {
  const words = String(segment || '').split(/\s+/).filter(Boolean);

  return words
    .map((word, index) => {
      const punctuationMatch = word.match(/^([("'[\{]*)(.*?)([)"'\]\},.!?:;]*)$/);
      const prefix = punctuationMatch?.[1] || '';
      const core = punctuationMatch?.[2] || word;
      const suffix = punctuationMatch?.[3] || '';
      if (!core) return word;

      const acronym = CSC_DISPLAY_ACRONYMS.get(core.toLowerCase());
      if (acronym) return `${prefix}${acronym}${suffix}`;

      if (index > 0 && CSC_DISPLAY_SMALL_WORDS.has(core.toLowerCase())) {
        return `${prefix}${core.toLowerCase()}${suffix}`;
      }

      return `${prefix}${capitalizeWord(core)}${suffix}`;
    })
    .join(' ');
};

export const toCscDisplayTitleCase = (value = '') =>
  normalizeWhitespace(value)
    .split(/\s+(-|\/|\|)\s+/)
    .map((segment) => (/^[-/|]$/.test(segment) ? segment : titleCaseSegment(segment)))
    .join(' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();

export const cleanCscDisplayTitle = (value = '', options = {}) => {
  const {
    stripNumericPrefix = true,
    titleCase = true,
  } = options;

  let text = normalizeEmbeddedCscVenueNames(normalizeWhitespace(value));
  if (!text) return '';

  text = text
    .replace(/[([{]\s*DNS\s*[)\]}]/gi, ' ')
    .replace(/\bDNS\b/gi, ' ');

  if (stripNumericPrefix) {
    text = text.replace(/^\s*\d{6,8}\s*(?=[A-Za-z])/i, '');
  }

  text = text
    .replace(/\s*[\[(\{][^)\]\}]*\b(?:yk\s*\d+\s*)?(?:to\s+)?fill\b[^)\]\}]*[)\]\}]\s*/gi, ' ')
    .replace(/\bYK\s*\d+\s*(?:to\s+)?fill\b/gi, ' ')
    .replace(/\b\d+\s+(?:to\s+)?fill\b/gi, ' ')
    .replace(/\bto\s+fill\b/gi, ' ');

  text = text.replace(/([a-z])\s*[vV][sS]\s*(?=[A-Z])/g, '$1 vs ');

  text = text
    .replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, ' ')
    .replace(/\s*[-–—|]\s*/g, ' - ')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/(?:\s*-\s*){2,}/g, ' - ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:|/]+|[\s\-–—:|/]+$/g, '')
    .trim();

  return titleCase ? toCscDisplayTitleCase(text) : text;
};

export const cleanCscVenueDisplay = (value = '') => {
  const text = normalizeWhitespace(value);
  if (!text) return '';

  const normalized = text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized.includes('sofi stadium') || normalized.includes('hollywood park')) {
    return 'SoFi Stadium';
  }

  if (
    normalized === 'forum' ||
    normalized === 'the forum' ||
    normalized === 'kia forum' ||
    normalized === 'the kia forum'
  ) {
    return 'Kia Forum';
  }

  return normalizeEmbeddedCscVenueNames(text);
};

const getDateParts = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    };
  }

  const text = String(value).trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3]),
    };
  }

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\D|$)/);
  if (slashMatch) {
    const rawYear = Number(slashMatch[3]);
    return {
      year: slashMatch[3].length === 2 ? 2000 + rawYear : rawYear,
      month: Number(slashMatch[1]),
      day: Number(slashMatch[2]),
    };
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth() + 1,
    day: parsed.getDate(),
  };
};

export const formatAppShortDate = (value = '', fallback = '') => {
  const parts = getDateParts(value);
  if (!parts) return fallback || String(value || '');

  const { year, month, day } = parts;
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return fallback || String(value || '');
  }

  return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${String(year).slice(-2)}`;
};

export const formatAppShortDateTime = (value = '', fallback = '') => {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return fallback || String(value || '');
  }

  const dateLabel = formatAppShortDate(date);
  const timeLabel = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return `${dateLabel}, ${timeLabel}`;
};

export const cleanCscDisplayShift = (shift = {}) => ({
  ...shift,
  venue: cleanCscVenueDisplay(shift.venue),
  event: cleanCscDisplayTitle(shift.event),
  jobName: cleanCscDisplayTitle(shift.jobName),
  shiftName: cleanCscDisplayTitle(shift.shiftName),
  roleName: cleanCscDisplayTitle(shift.roleName, { stripNumericPrefix: false }),
});
