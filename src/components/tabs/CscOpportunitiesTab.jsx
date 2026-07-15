import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Edit3,
  ExternalLink,
  MapPin,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import PageContainer from '../common/PageContainer.jsx';

const OPPORTUNITIES_STORAGE_KEY = 'cscOpportunities.v1';
const VENUE_CONTACTS_STORAGE_KEY = 'cscVenueContacts.v1';
const OPPORTUNITIES_SNAPSHOT_STORAGE_KEY = 'cscOpportunities.safetySnapshot.v1';
const CSC_STORAGE_KEY = 'cscShifts.v1';
const CSC_ARCHIVE_STORAGE_KEY = 'cscShifts.archived.v1';
const CSC_SNAPSHOT_STORAGE_KEY = 'cscShifts.safetySnapshot.v1';
const OPPORTUNITIES_UPDATE_EVENT = 'cscOpportunities:updated';
const CSC_SHIFT_UPDATE_EVENT = 'cscShifts:updated';
const CSC_OPEN_SHIFT_STORAGE_KEY = 'cscShifts.openLinkedShiftId.v1';
const KIA_FORUM_EVENTS_URL = 'https://thekiaforum.com/events/';
const SOFI_STADIUM_EVENTS_URL = 'https://www.sofistadium.com/events';
const INTUIT_DOME_EVENTS_URL = 'https://www.intuitdome.com/events/event-schedule';
const ROSE_BOWL_EVENTS_URL = 'https://www.rosebowlstadium.com/events/calendar/list';
const HOLLYWOOD_BOWL_EVENTS_URL =
  'https://www.hollywoodbowl.com/events/performances?Venue=Hollywood+Bowl&Season=upcoming';
const DEFAULT_HOURLY_RATE = '19.50';

const STATUS_OPTIONS = [
  'New',
  'Shift Requested',
  'Scheduled',
  'No Shifts Available',
  'Cancelled',
];

const VENUE_DEFINITIONS = [
  {
    venue: 'Rose Bowl',
    aliases: ['rose bowl', 'rose bowl stadium'],
    address: '1001 Rose Bowl Dr, Pasadena, CA 91103',
    logoPath: '/budget-dashboard-fs/venue-logos/rose-bowl.png',
    sourceUrl: ROSE_BOWL_EVENTS_URL,
    schedulerPhone: '310-320-7223',
  },
  {
    venue: 'Kia Forum',
    aliases: ['the kia forum', 'kia forum', 'the forum', 'forum'],
    address: '3900 W Manchester Blvd, Inglewood, CA 90305',
    logoPath: '/budget-dashboard-fs/venue-logos/kia-forum.png',
    sourceUrl: KIA_FORUM_EVENTS_URL,
  },
  {
    venue: 'Hollywood Bowl',
    aliases: ['hollywood bowl'],
    address: '2301 N Highland Ave, Los Angeles, CA 90068',
    logoPath: '/budget-dashboard-fs/venue-logos/hollywood-bowl.png',
    sourceUrl: HOLLYWOOD_BOWL_EVENTS_URL,
    schedulerPhone: '310-320-7223',
  },
  {
    venue: 'The Shrine',
    aliases: ['the shrine', 'shrine auditorium', 'the shrine auditorium'],
    address: '665 W Jefferson Blvd, Los Angeles, CA 90007',
    logoPath: '/budget-dashboard-fs/venue-logos/shrine-auditorium.png',
    sourceUrl: '',
  },
  {
    venue: 'Intuit Dome',
    aliases: ['intuit dome'],
    address: '3930 W Century Blvd, Inglewood, CA 90303',
    logoPath: '/budget-dashboard-fs/venue-logos/intuit-dome.png',
    sourceUrl: INTUIT_DOME_EVENTS_URL,
    schedulerName: 'Toni',
    schedulerPhone: '310-320-7223',
    schedulerExtension: '28163',
  },
  {
    venue: 'SoFi Stadium',
    aliases: ['sofi stadium and hollywood park', 'sofi stadium', 'hollywood park', 'sofi'],
    address: '1001 Stadium Dr, Inglewood, CA 90301',
    logoPath: '/budget-dashboard-fs/venue-logos/sofi-stadium.png',
    sourceUrl: SOFI_STADIUM_EVENTS_URL,
    schedulerName: 'Karen',
    schedulerPhone: '310-320-7223',
    schedulerExtension: '28102',
  },
];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_INDEX = MONTH_NAMES.reduce((map, month, index) => {
  map[month.toLowerCase()] = index + 1;
  return map;
}, {});

const createId = (prefix = 'csc-opportunity') => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const todayIso = () => new Date().toISOString().slice(0, 10);


const formatDate = (value) => {
  if (!value) return 'Date not entered';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTime = (value) => {
  if (!value) return '';
  const [hours, minutes] = String(value).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const formatShortDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const TITLE_PHRASE_PATTERNS = [
  /^just the two of us$/i,
  /\bthe music of\b/i,
  /\bworld tour\b/i,
  /\btour\b/i,
  /\bevent title\b/i,
  /\bspectacular\b/i,
  /\bwith fireworks\b/i,
  /\btribute\b/i,
  /\bconcert\b/i,
  /\bfestival\b/i,
  /\banniversary\b/i,
  /\bshow\b/i,
  /\bpresents\b/i,
  /:/,
];

const looksLikeEventTitle = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return false;
  return TITLE_PHRASE_PATTERNS.some((pattern) => pattern.test(text));
};

const FormattedEventName = ({ value, artistClassName = 'font-bold', titleClassName = 'font-normal' }) => {
  const eventName = String(value || '').trim();
  const separatorMatch = eventName.match(/^(.+?)\s+-\s+(.+)$/);

  if (!separatorMatch) {
    return (
      <span className={looksLikeEventTitle(eventName) ? titleClassName : artistClassName}>
        {eventName}
      </span>
    );
  }

  const artistOrTitle = separatorMatch[1].trim();
  const title = separatorMatch[2].trim();

  return (
    <>
      <span className={looksLikeEventTitle(artistOrTitle) ? titleClassName : artistClassName}>
        {artistOrTitle}
      </span>
      <span className={titleClassName}> - {title}</span>
    </>
  );
};

const normalizeText = (value = '') =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const canonicalVenueName = (value = '') => {
  const normalized = normalizeText(value);
  const definition = VENUE_DEFINITIONS.find((item) =>
    item.aliases.some((alias) => normalized === normalizeText(alias) || normalized.includes(normalizeText(alias)))
  );
  return definition?.venue || String(value || '').trim();
};

const getVenueDefinition = (value = '') => {
  const canonical = canonicalVenueName(value);
  return VENUE_DEFINITIONS.find((item) => item.venue === canonical) || null;
};

const createBlankOpportunity = (defaults = {}) => ({
  id: defaults.id || createId(),
  eventName: defaults.eventName || '',
  venue: canonicalVenueName(defaults.venue || 'Kia Forum'),
  eventDate: defaults.eventDate || '',
  eventTime: defaults.eventTime || '',
  expectedEndTime: defaults.expectedEndTime || '',
  sourceText: defaults.sourceText || '',
  eventUrl: defaults.eventUrl || '',
  schedulerName: defaults.schedulerName || '',
  schedulerPhone: defaults.schedulerPhone || '',
  schedulerExtension: defaults.schedulerExtension || '',
  bestCallTime: defaults.bestCallTime || '',
  callFrequency: defaults.callFrequency || 'Daily',
  lastCalledDate: defaults.lastCalledDate || '',
  nextCallDate: defaults.nextCallDate || '',
  status: STATUS_OPTIONS.includes(defaults.status) ? defaults.status : 'New',
  linkedCscShiftId: defaults.linkedCscShiftId || '',
  notes: defaults.notes || '',
  notesUpdatedAt: defaults.notesUpdatedAt || '',
  venueLogo: getVenueDefinition(defaults.venue || 'Kia Forum')?.logoPath || defaults.venueLogo || '',
  callHistory: Array.isArray(defaults.callHistory) ? defaults.callHistory : [],
  createdAt: defaults.createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const createDefaultContacts = () =>
  VENUE_DEFINITIONS.map((definition) => ({
    id: createId('csc-venue-contact'),
    venue: definition.venue,
    schedulerName: definition.schedulerName || '',
    schedulerPhone: definition.schedulerPhone || '',
    schedulerExtension: definition.schedulerExtension || '',
    bestCallTime: '',
    callFrequency: 'Daily',
    eventUrl: definition.sourceUrl || '',
    venueLogo: definition.logoPath || '',
    address: definition.address || '',
    notes: '',
    updatedAt: new Date().toISOString(),
  }));

const readArray = (storageKey, fallback = []) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const loadOpportunities = () =>
  readArray(OPPORTUNITIES_STORAGE_KEY, []).map((item) => createBlankOpportunity(item));

const loadVenueContacts = () => {
  const stored = readArray(VENUE_CONTACTS_STORAGE_KEY, []);
  const defaults = createDefaultContacts();
  const byVenue = new Map(stored.map((item) => [canonicalVenueName(item.venue), item]));

  return defaults.map((contact) => {
    const storedContact = byVenue.get(contact.venue) || {};

    return {
      ...contact,
      ...storedContact,
      venue: contact.venue,
      schedulerName: storedContact.schedulerName || contact.schedulerName,
      schedulerPhone: storedContact.schedulerPhone || contact.schedulerPhone,
      schedulerExtension: storedContact.schedulerExtension || contact.schedulerExtension,
      eventUrl: storedContact.eventUrl || contact.eventUrl,
      venueLogo: contact.venueLogo || storedContact.venueLogo || '',
    };
  });
};

const writeOpportunitySnapshot = (label, opportunities, contacts) => {
  try {
    localStorage.setItem(
      OPPORTUNITIES_SNAPSHOT_STORAGE_KEY,
      JSON.stringify({
        id: createId('csc-opportunity-snapshot'),
        label,
        createdAt: new Date().toISOString(),
        opportunities,
        contacts,
      })
    );
    return true;
  } catch (error) {
    console.error('Failed to save CSC opportunities safety snapshot:', error);
    return false;
  }
};


const opportunityKey = (opportunity = {}) =>
  [canonicalVenueName(opportunity.venue), opportunity.eventDate, normalizeText(opportunity.eventName)].join('|');

const sanitizeScannedLine = (value = '') =>
  String(value || '')
    .replace(/^[#>*\-•\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

const isScannerNoiseLine = (value = '') => {
  const line = normalizeText(value);
  if (!line) return true;
  return /^(upcoming events|jump to month|select date|loading view|tickets|info|previous events|today|next events|search kia forum|search|call us|email us|subscribe to the newsletter|event calendar|parking|premium|plan your visit|venue policies|faqs|dine with us|accessibility|connect|explore the kia forum|about us|premium seating|careers|venue rentals|lost found|be the first to know)$/.test(line);
};

const parseMonthHeader = (line = '') => {
  const match = sanitizeScannedLine(line).match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})$/i
  );
  if (!match) return null;
  return { month: match[1], year: Number(match[2]) };
};

const parseDateLine = (line = '', currentYear = new Date().getFullYear()) => {
  const match = sanitizeScannedLine(line).match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,?\s+(20\d{2}))?$/i
  );
  if (!match) return null;
  const month = MONTH_INDEX[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3] || currentYear);
  if (!month || !day || day > 31) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const parseKiaForumEvents = (text = '', sourceUrl = KIA_FORUM_EVENTS_URL) => {
  const lines = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(sanitizeScannedLine)
    .filter(Boolean);

  const parsed = [];
  let currentYear = new Date().getFullYear();

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const monthHeader = parseMonthHeader(line);
    if (monthHeader) {
      currentYear = monthHeader.year;
      continue;
    }

    const eventDate = parseDateLine(line, currentYear);
    if (!eventDate) continue;

    let eventName = '';
    let subtitle = '';
    let cursor = index + 1;

    while (cursor < lines.length && !eventName) {
      const candidate = lines[cursor];
      if (parseMonthHeader(candidate) || parseDateLine(candidate, currentYear)) break;
      if (!isScannerNoiseLine(candidate) && !/^https?:\/\//i.test(candidate)) eventName = candidate;
      cursor += 1;
    }

    while (cursor < lines.length && !subtitle) {
      const candidate = lines[cursor];
      if (parseMonthHeader(candidate) || parseDateLine(candidate, currentYear)) break;
      if (!isScannerNoiseLine(candidate) && !/^https?:\/\//i.test(candidate)) subtitle = candidate;
      cursor += 1;
    }

    if (!eventName) continue;

    parsed.push(
      createBlankOpportunity({
        eventName: subtitle ? `${eventName} - ${subtitle}` : eventName,
        venue: 'Kia Forum',
        eventDate,
        sourceText: [line, eventName, subtitle].filter(Boolean).join('\n'),
        eventUrl: sourceUrl || KIA_FORUM_EVENTS_URL,
        status: 'New',
      })
    );
  }

  const byKey = new Map();
  parsed.forEach((item) => byKey.set(opportunityKey(item), item));
  return Array.from(byKey.values());
};

const SOFI_MONTH_INDEX = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const parseSofiTime = (value = '') => {
  const normalized = sanitizeScannedLine(value).replace(/\./g, '').trim();
  if (!normalized || /^time\s+tba$/i.test(normalized)) return '';

  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!match) return '';

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3].toUpperCase();

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return '';
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (meridiem === 'PM' && hours !== 12) hours += 12;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const parseSofiDateTimeLine = (line = '') => {
  const cleaned = sanitizeScannedLine(line);
  const match = cleaned.match(
    /^(?:Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat)\.?,\s*([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s*(20\d{2})\s*\/\s*(.+)$/i
  );

  if (!match) return null;

  const month = SOFI_MONTH_INDEX[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3]);
  if (!month || !day || day > 31 || !year) return null;

  return {
    eventDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    eventTime: parseSofiTime(match[4]),
    timeLabel: sanitizeScannedLine(match[4]),
  };
};

const isSofiScannerNoiseLine = (value = '') => {
  const line = normalizeText(value);
  if (!line) return true;

  return /^(buy tickets|suites|parking|fly american airlines|dining guide|food beverage guide|priority access|book your tour)$/.test(
    line
  );
};

const parseSofiEvents = (text = '', sourceUrl = SOFI_STADIUM_EVENTS_URL) => {
  const lines = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(sanitizeScannedLine)
    .filter(Boolean);

  const parsed = [];

  for (let index = 0; index < lines.length; index += 1) {
    const headerMatch = lines[index].match(/^More Info for\s+(.+)$/i);
    if (!headerMatch) continue;

    const nextHeaderIndex = lines.findIndex(
      (candidate, candidateIndex) => candidateIndex > index && /^More Info for\s+/i.test(candidate)
    );
    const blockEnd = nextHeaderIndex >= 0 ? nextHeaderIndex : lines.length;
    const blockLines = lines.slice(index + 1, blockEnd);

    if (
      blockLines.some((line) => /^Date\s*&\s*Time\s*TBA$/i.test(line)) ||
      blockLines.some((line) => /^Multiple Dates\s*\/\s*Times$/i.test(line))
    ) {
      index = blockEnd - 1;
      continue;
    }

    const dateLineIndex = blockLines.findIndex((line) => parseSofiDateTimeLine(line));
    if (dateLineIndex < 0) {
      index = blockEnd - 1;
      continue;
    }

    const dateDetails = parseSofiDateTimeLine(blockLines[dateLineIndex]);
    const headerEventName = sanitizeScannedLine(headerMatch[1]);
    const contentLines = blockLines
      .slice(dateLineIndex + 1)
      .filter((line) => !isSofiScannerNoiseLine(line) && !/^More Info for\s+/i.test(line));

    const eventTitle = contentLines[0] || headerEventName;
    const subtitle = contentLines.slice(1).find((line) => {
      const normalized = normalizeText(line);
      return normalized && normalized !== normalizeText(eventTitle) && normalized !== normalizeText(headerEventName);
    });
    const eventName = subtitle ? `${eventTitle} - ${subtitle}` : eventTitle;

    parsed.push(
      createBlankOpportunity({
        eventName,
        venue: 'SoFi Stadium',
        eventDate: dateDetails.eventDate,
        eventTime: dateDetails.eventTime,
        sourceText: [lines[index], ...blockLines].join('\n'),
        eventUrl: sourceUrl || SOFI_STADIUM_EVENTS_URL,
        status: 'New',
      })
    );

    index = blockEnd - 1;
  }

  const byKey = new Map();
  parsed.forEach((item) => byKey.set(opportunityKey(item), item));
  return Array.from(byKey.values());
};


const INTUIT_DOME_MONTH_INDEX = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const parseIntuitDomeTime = (value = '') => {
  const normalized = sanitizeScannedLine(value).replace(/\./g, '').trim();
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);

  if (!match) return '';

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3].toUpperCase();

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return '';
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (meridiem === 'PM' && hours !== 12) hours += 12;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const parseIntuitDomeDateTimeLine = (line = '', currentYear = new Date().getFullYear()) => {
  const cleaned = sanitizeScannedLine(line);
  const match = cleaned.match(
    /^(?:SUN|MON|TUE|WED|THU|FRI|SAT),\s*([A-Z]{3})\s+(\d{1,2})\s*\/\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))$/i
  );

  if (!match) return null;

  const month = INTUIT_DOME_MONTH_INDEX[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(currentYear);

  if (!month || !day || day > 31 || !year) return null;

  return {
    eventDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    eventTime: parseIntuitDomeTime(match[3]),
  };
};

const isIntuitDomeDateRangeLine = (value = '') =>
  /^[A-Za-z]{3}\s+\d{1,2}\s*-\s*[A-Za-z]{3}\s+\d{1,2}$/i.test(sanitizeScannedLine(value));

const isIntuitDomeScannerNoiseLine = (value = '') => {
  const line = normalizeText(value);

  if (!line) return true;

  return /^(event schedule image|tickets|info|learn more)$/.test(line);
};

const parseIntuitDomeEvents = (text = '', sourceUrl = INTUIT_DOME_EVENTS_URL) => {
  const lines = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(sanitizeScannedLine)
    .filter(Boolean);

  const parsed = [];
  let currentYear = new Date().getFullYear();
  let pendingEventName = '';

  lines.forEach((line) => {
    const monthHeader = parseMonthHeader(line);

    if (monthHeader) {
      currentYear = monthHeader.year;
      pendingEventName = '';
      return;
    }

    if (isIntuitDomeDateRangeLine(line) || isIntuitDomeScannerNoiseLine(line) || /^https?:\/\//i.test(line)) {
      return;
    }

    const dateDetails = parseIntuitDomeDateTimeLine(line, currentYear);

    if (dateDetails) {
      if (pendingEventName) {
        parsed.push(
          createBlankOpportunity({
            eventName: pendingEventName,
            venue: 'Intuit Dome',
            eventDate: dateDetails.eventDate,
            eventTime: dateDetails.eventTime,
            sourceText: [pendingEventName, line].join('\n'),
            eventUrl: sourceUrl || INTUIT_DOME_EVENTS_URL,
            status: 'New',
          })
        );
      }

      pendingEventName = '';
      return;
    }

    pendingEventName = line;
  });

  const byKey = new Map();
  parsed.forEach((item) => byKey.set(opportunityKey(item), item));
  return Array.from(byKey.values());
};


const ROSE_BOWL_MONTH_INDEX = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const parseRoseBowlTime = (value = '') => {
  const normalized = sanitizeScannedLine(value).replace(/\./g, '').trim();

  if (!normalized || /^TBD$/i.test(normalized)) return '';

  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);

  if (!match) return '';

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3].toUpperCase();

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return '';
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (meridiem === 'PM' && hours !== 12) hours += 12;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const parseRoseBowlDateTimeLine = (line = '') => {
  const cleaned = sanitizeScannedLine(line);
  const match = cleaned.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(20\d{2})\s*\/\s*(.+)$/i
  );

  if (!match) return null;

  const month = ROSE_BOWL_MONTH_INDEX[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3]);
  const listedTimes = match[4]
    .split(',')
    .map((value) => sanitizeScannedLine(value))
    .filter(Boolean);

  if (!month || !day || day > 31 || !year) return null;

  return {
    eventDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    eventTime: parseRoseBowlTime(listedTimes[0] || ''),
    listedTimes,
  };
};

const isRoseBowlScannerNoiseLine = (value = '') => {
  const cleaned = sanitizeScannedLine(value);
  const normalized = normalizeText(cleaned);

  if (!normalized) return true;
  if (/^image$/i.test(cleaned)) return true;
  if (/^\d{1,2}$/i.test(cleaned)) return true;
  if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)$/i.test(cleaned)) return true;

  return /^(event calendar|events|upcoming events|tickets|info|learn more|more info|view details|buy tickets)$/.test(
    normalized
  );
};

const parseRoseBowlEvents = (text = '', sourceUrl = ROSE_BOWL_EVENTS_URL) => {
  const lines = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(sanitizeScannedLine)
    .filter(Boolean);

  const parsed = [];

  for (let index = 0; index < lines.length; index += 1) {
    const dateDetails = parseRoseBowlDateTimeLine(lines[index]);

    if (!dateDetails) continue;

    let nextDateIndex = lines.length;

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (parseRoseBowlDateTimeLine(lines[cursor])) {
        nextDateIndex = cursor;
        break;
      }
    }

    const eventBlock = lines
      .slice(index + 1, nextDateIndex)
      .filter((line) => !isRoseBowlScannerNoiseLine(line) && !/^https?:\/\//i.test(line));
    const eventName = eventBlock[0] || '';

    if (!eventName) {
      index = nextDateIndex - 1;
      continue;
    }

    parsed.push(
      createBlankOpportunity({
        eventName,
        venue: 'Rose Bowl',
        eventDate: dateDetails.eventDate,
        eventTime: dateDetails.eventTime,
        sourceText: [lines[index], ...eventBlock].join('\n'),
        eventUrl: sourceUrl || ROSE_BOWL_EVENTS_URL,
        status: 'New',
      })
    );

    index = nextDateIndex - 1;
  }

  const byKey = new Map();
  parsed.forEach((item) => byKey.set(opportunityKey(item), item));
  return Array.from(byKey.values());
};


const HOLLYWOOD_BOWL_MONTH_INDEX = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const parseHollywoodBowlTime = (value = '') => {
  const normalized = sanitizeScannedLine(value).replace(/\./g, '').trim();
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);

  if (!match) return '';

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3].toUpperCase();

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return '';
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (meridiem === 'PM' && hours !== 12) hours += 12;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const parseHollywoodBowlDateLine = (line = '') => {
  const cleaned = sanitizeScannedLine(line);
  const match = cleaned.match(
    /^(?:Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat),?\s+([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,\s*(20\d{2}))?$/i
  );

  if (!match) return null;

  const month = HOLLYWOOD_BOWL_MONTH_INDEX[match[1].toLowerCase()];
  const day = Number(match[2]);
  const explicitYear = Number(match[3] || 0);

  if (!month || !day || day > 31) return null;

  return {
    month,
    day,
    explicitYear,
  };
};

const isHollywoodBowlScannerNoiseLine = (value = '') => {
  const line = normalizeText(value);

  if (!line) return true;

  return /^(program artist listing|event schedule image|tickets|info|learn more|more info|view details|buy tickets|special house rules apply|house rules apply)$/.test(
    line
  );
};

const getUniqueHollywoodBowlTitleLines = (lines = []) => {
  const seen = new Set();

  return lines.filter((candidate) => {
    if (
      isHollywoodBowlScannerNoiseLine(candidate) ||
      parseHollywoodBowlTime(candidate) ||
      parseHollywoodBowlDateLine(candidate) ||
      parseMonthHeader(candidate) ||
      /^https?:\/\//i.test(candidate)
    ) {
      return false;
    }

    const key = normalizeText(candidate);
    if (!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
};

const parseHollywoodBowlEvents = (text = '', sourceUrl = HOLLYWOOD_BOWL_EVENTS_URL) => {
  const lines = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(sanitizeScannedLine)
    .filter(Boolean);

  const parsed = [];
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const firstMonthHeader = lines.map(parseMonthHeader).find(Boolean) || null;
  let inferredYear = firstMonthHeader?.year || now.getFullYear();
  let lastEventMonth = firstMonthHeader ? 0 : currentMonth;
  let hasParsedEvent = false;
  let pendingTitleLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const monthHeader = parseMonthHeader(line);

    if (monthHeader) {
      inferredYear = monthHeader.year;
      lastEventMonth = MONTH_INDEX[monthHeader.month.toLowerCase()] || lastEventMonth;
      pendingTitleLines = [];
      continue;
    }

    if (isHollywoodBowlScannerNoiseLine(line) || /^https?:\/\//i.test(line)) {
      continue;
    }

    const dateDetails = parseHollywoodBowlDateLine(line);

    if (!dateDetails) {
      if (!parseHollywoodBowlTime(line)) pendingTitleLines.push(line);
      continue;
    }

    let eventYear = dateDetails.explicitYear || inferredYear;

    if (!dateDetails.explicitYear) {
      if (!hasParsedEvent && !firstMonthHeader && dateDetails.month < currentMonth) {
        eventYear += 1;
      } else if (hasParsedEvent && dateDetails.month < lastEventMonth) {
        eventYear += 1;
      }
    }

    inferredYear = eventYear;
    lastEventMonth = dateDetails.month;

    let timeLine = '';
    let eventTime = '';

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor];

      if (isHollywoodBowlScannerNoiseLine(candidate) || /^https?:\/\//i.test(candidate)) continue;
      if (parseHollywoodBowlDateLine(candidate) || parseMonthHeader(candidate)) break;

      const parsedTime = parseHollywoodBowlTime(candidate);
      if (parsedTime) {
        timeLine = candidate;
        eventTime = parsedTime;
        index = cursor;
      }
      break;
    }

    const uniqueTitleLines = getUniqueHollywoodBowlTitleLines(pendingTitleLines);

    if (uniqueTitleLines.length) {
      parsed.push(
        createBlankOpportunity({
          eventName: uniqueTitleLines.join(' - '),
          venue: 'Hollywood Bowl',
          eventDate: `${eventYear}-${String(dateDetails.month).padStart(2, '0')}-${String(dateDetails.day).padStart(2, '0')}`,
          eventTime,
          sourceText: [...uniqueTitleLines, line, timeLine].filter(Boolean).join('\n'),
          eventUrl: sourceUrl || HOLLYWOOD_BOWL_EVENTS_URL,
          status: 'New',
        })
      );

      hasParsedEvent = true;
    }

    pendingTitleLines = [];
  }

  const byKey = new Map();
  parsed.forEach((item) => byKey.set(opportunityKey(item), item));
  return Array.from(byKey.values());
};

const parseVenueEvents = (text = '', selectedVenue = '', sourceUrl = '') => {
  const venue = canonicalVenueName(selectedVenue);

  if (venue === 'Rose Bowl') {
    return parseRoseBowlEvents(text, sourceUrl || ROSE_BOWL_EVENTS_URL);
  }

  if (venue === 'Kia Forum') {
    return parseKiaForumEvents(text, sourceUrl || KIA_FORUM_EVENTS_URL);
  }

  if (venue === 'SoFi Stadium') {
    return parseSofiEvents(text, sourceUrl || SOFI_STADIUM_EVENTS_URL);
  }

  if (venue === 'Intuit Dome') {
    return parseIntuitDomeEvents(text, sourceUrl || INTUIT_DOME_EVENTS_URL);
  }

  if (venue === 'Hollywood Bowl') {
    return parseHollywoodBowlEvents(text, sourceUrl || HOLLYWOOD_BOWL_EVENTS_URL);
  }

  return [];
};

const getSimilarityScore = (firstValue = '', secondValue = '') => {
  const firstTokens = new Set(normalizeText(firstValue).split(' ').filter((token) => token.length > 2));
  const secondTokens = new Set(normalizeText(secondValue).split(' ').filter((token) => token.length > 2));
  if (!firstTokens.size || !secondTokens.size) return 0;
  let matches = 0;
  firstTokens.forEach((token) => {
    if (secondTokens.has(token)) matches += 1;
  });
  return matches / Math.max(firstTokens.size, secondTokens.size);
};

const readCscShifts = () => {
  const active = readArray(CSC_STORAGE_KEY, []).map((shift) => ({ ...shift, recordSource: 'active' }));
  const archived = readArray(CSC_ARCHIVE_STORAGE_KEY, []).map((shift) => ({ ...shift, recordSource: 'archived' }));
  return [...active, ...archived];
};

const findMatchingCscShift = (opportunity = {}) => {
  const candidates = readCscShifts().filter((shift) => shift.startDate === opportunity.eventDate);
  if (!candidates.length) return null;

  const canonicalOpportunityVenue = canonicalVenueName(opportunity.venue);
  const scored = candidates.map((shift) => {
    const venueScore = canonicalVenueName(shift.venue) === canonicalOpportunityVenue ? 3 : 0;
    const eventScore = Math.max(
      getSimilarityScore(opportunity.eventName, shift.event),
      getSimilarityScore(opportunity.eventName, shift.jobName),
      getSimilarityScore(opportunity.eventName, shift.shiftName)
    );
    return { shift, score: venueScore + eventScore * 3 };
  });

  scored.sort((first, second) => second.score - first.score);
  return scored[0]?.score >= 3 ? scored[0].shift : null;
};

const isOpportunityActiveForDateConflict = (opportunity = {}) =>
  Boolean(opportunity.eventDate) && opportunity.status !== 'Cancelled';

const getSameDateVenueConflicts = (opportunities = [], candidate = {}) => {
  if (!isOpportunityActiveForDateConflict(candidate)) return [];

  const candidateVenue = canonicalVenueName(candidate.venue);

  return opportunities
    .filter((opportunity) => {
      if (!isOpportunityActiveForDateConflict(opportunity)) return false;
      if (candidate.id && opportunity.id === candidate.id) return false;
      if (opportunity.eventDate !== candidate.eventDate) return false;
      return canonicalVenueName(opportunity.venue) !== candidateVenue;
    })
    .sort((first, second) =>
      `${first.eventTime || '99:99'}|${canonicalVenueName(first.venue)}|${first.eventName}`.localeCompare(
        `${second.eventTime || '99:99'}|${canonicalVenueName(second.venue)}|${second.eventName}`
      )
    );
};

const buildSameDateConflictGroups = (opportunities = []) => {
  const byDate = new Map();

  opportunities.filter(isOpportunityActiveForDateConflict).forEach((opportunity) => {
    const current = byDate.get(opportunity.eventDate) || [];
    current.push(opportunity);
    byDate.set(opportunity.eventDate, current);
  });

  return Array.from(byDate.entries())
    .map(([eventDate, dateOpportunities]) => {
      const venues = new Set(dateOpportunities.map((opportunity) => canonicalVenueName(opportunity.venue)));
      if (venues.size < 2) return null;

      return {
        eventDate,
        opportunities: [...dateOpportunities].sort((first, second) =>
          `${first.eventTime || '99:99'}|${canonicalVenueName(first.venue)}|${first.eventName}`.localeCompare(
            `${second.eventTime || '99:99'}|${canonicalVenueName(second.venue)}|${second.eventName}`
          )
        ),
      };
    })
    .filter(Boolean)
    .sort((first, second) => first.eventDate.localeCompare(second.eventDate));
};

const getStatusClass = (status) => {
  if (status === 'Scheduled') return 'bg-emerald-100 text-emerald-900 border-emerald-200';
  if (status === 'Shift Requested') return 'bg-blue-100 text-blue-900 border-blue-200';
  if (status === 'No Shifts Available' || status === 'Cancelled') return 'bg-slate-200 text-slate-800 border-slate-300';
  return 'bg-amber-100 text-amber-900 border-amber-200';
};

const downloadJson = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const VenueLogo = ({ opportunity, sizeClass = 'h-12 w-12' }) => {
  const venue = canonicalVenueName(opportunity.venue);
  const definition = getVenueDefinition(venue);
  const logoSource = definition?.logoPath || opportunity.venueLogo || '';
  const [failedSource, setFailedSource] = useState('');

  useEffect(() => {
    if (failedSource && failedSource !== logoSource) setFailedSource('');
  }, [failedSource, logoSource]);

  const initials = venue
    .split(' ')
    .filter((word) => !['the', 'and'].includes(word.toLowerCase()))
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  if (!logoSource || failedSource === logoSource) {
    return (
      <div className={`${sizeClass} flex shrink-0 items-center justify-center rounded-xl bg-slate-900 text-sm font-black text-white`}>
        {initials || 'CSC'}
      </div>
    );
  }

  return (
    <img
      key={logoSource}
      src={logoSource}
      alt={`${venue} logo`}
      onError={() => setFailedSource(logoSource)}
      className={`${sizeClass} shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1`}
    />
  );
};

const CscOpportunitiesTab = ({ searchQuery = '' }) => {
  const [opportunities, setOpportunities] = useState(() => loadOpportunities());
  const [venueContacts, setVenueContacts] = useState(() => loadVenueContacts());
  const [localSearch, setLocalSearch] = useState('');
  const [venueFilter, setVenueFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [saveMessage, setSaveMessage] = useState('');
  const [showFormDrawer, setShowFormDrawer] = useState(false);
  const [showScanDrawer, setShowScanDrawer] = useState(false);
  const [showCreateShiftDrawer, setShowCreateShiftDrawer] = useState(false);
  const [showConflictSection, setShowConflictSection] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState(() => createBlankOpportunity());
  const [scanText, setScanText] = useState('');
  const [scanVenue, setScanVenue] = useState('Kia Forum');
  const [scanSourceUrl, setScanSourceUrl] = useState(KIA_FORUM_EVENTS_URL);
  const [scannedOpportunities, setScannedOpportunities] = useState([]);
  const [shiftDraft, setShiftDraft] = useState(null);
  const [notesDrafts, setNotesDrafts] = useState({});
  const [expandedNoteIds, setExpandedNoteIds] = useState(() => new Set());
  const [overflowingNoteIds, setOverflowingNoteIds] = useState(() => new Set());
  const noteTextareaRefs = useRef(new Map());
  const importInputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(OPPORTUNITIES_STORAGE_KEY, JSON.stringify(opportunities));
    window.dispatchEvent(new CustomEvent(OPPORTUNITIES_UPDATE_EVENT, { detail: { opportunities } }));
  }, [opportunities]);

  useEffect(() => {
    localStorage.setItem(VENUE_CONTACTS_STORAGE_KEY, JSON.stringify(venueContacts));
  }, [venueContacts]);

  const sameDateConflictGroups = useMemo(
    () => buildSameDateConflictGroups(opportunities),
    [opportunities]
  );

  const sameDateConflictMap = useMemo(() => {
    const map = new Map();

    sameDateConflictGroups.forEach((group) => {
      group.opportunities.forEach((opportunity) => {
        const conflicts = group.opportunities.filter(
          (candidate) =>
            candidate.id !== opportunity.id &&
            canonicalVenueName(candidate.venue) !== canonicalVenueName(opportunity.venue)
        );

        if (conflicts.length) map.set(opportunity.id, conflicts);
      });
    });

    return map;
  }, [sameDateConflictGroups]);

  const confirmSameDateConflict = (candidate, actionLabel) => {
    const conflicts = getSameDateVenueConflicts(opportunities, candidate);
    if (!conflicts.length) return true;

    const conflictLines = conflicts
      .map(
        (conflict) =>
          `• ${conflict.venue}: ${conflict.eventName}${
            conflict.eventTime ? ` at ${formatTime(conflict.eventTime)}` : ''
          }${conflict.status === 'Scheduled' ? ' [Scheduled]' : ''}`
      )
      .join('\n');

    return window.confirm(
      `DATE CONFLICT WARNING\n\n${candidate.eventName || 'This event'} at ${
        candidate.venue || 'this venue'
      } is on ${formatDate(candidate.eventDate)}.\n\nOther venue events on the same date:\n${conflictLines}\n\nContinue and ${actionLabel}?`
    );
  };

  const flashMessage = (message, duration = 3000) => {
    setSaveMessage(message);
    window.setTimeout(() => setSaveMessage(''), duration);
  };

  const saveSnapshot = (label) =>
    writeOpportunitySnapshot(label, opportunities, venueContacts);

  const getContactForVenue = (venue) =>
    venueContacts.find((contact) => canonicalVenueName(contact.venue) === canonicalVenueName(venue));

  const applyVenueDefaults = (opportunity, venue) => {
    const definition = getVenueDefinition(venue);
    const contact = getContactForVenue(venue);
    return createBlankOpportunity({
      ...opportunity,
      venue: canonicalVenueName(venue),
      eventUrl: opportunity.eventUrl || contact?.eventUrl || definition?.sourceUrl || '',
      schedulerName: opportunity.schedulerName || contact?.schedulerName || definition?.schedulerName || '',
      schedulerPhone: opportunity.schedulerPhone || contact?.schedulerPhone || definition?.schedulerPhone || '',
      schedulerExtension:
        opportunity.schedulerExtension || contact?.schedulerExtension || definition?.schedulerExtension || '',
      venueLogo: definition?.logoPath || contact?.venueLogo || opportunity.venueLogo || '',
    });
  };

  const updateOpportunity = (id, updates) => {
    setOpportunities((current) =>
      current.map((item) =>
        item.id === id
          ? createBlankOpportunity({ ...item, ...updates, id: item.id, createdAt: item.createdAt })
          : item
      )
    );
  };

  const openAddOpportunity = () => {
    setEditingOpportunity(applyVenueDefaults(createBlankOpportunity({ venue: 'Kia Forum' }), 'Kia Forum'));
    setShowFormDrawer(true);
  };

  const openEditOpportunity = (opportunity) => {
    setEditingOpportunity(createBlankOpportunity(opportunity));
    setShowFormDrawer(true);
  };

  const handleSaveOpportunity = () => {
    const prepared = applyVenueDefaults(editingOpportunity, editingOpportunity.venue);
    if (!prepared.eventName || !prepared.venue || !prepared.eventDate) {
      flashMessage('Event name, venue, and event date are required.');
      return;
    }

    const currentOpportunity = opportunities.find((item) => item.id === prepared.id);
    const scheduledDetailsChanged =
      prepared.status === 'Scheduled' &&
      (!currentOpportunity ||
        currentOpportunity.status !== 'Scheduled' ||
        currentOpportunity.eventDate !== prepared.eventDate ||
        canonicalVenueName(currentOpportunity.venue) !== canonicalVenueName(prepared.venue));

    if (
      scheduledDetailsChanged &&
      !confirmSameDateConflict(prepared, 'save this opportunity as scheduled')
    ) {
      return;
    }

    saveSnapshot('Before CSC opportunity save');
    setOpportunities((current) => {
      const existingIndex = current.findIndex((item) => item.id === prepared.id);
      const next = [...current];
      if (existingIndex >= 0) next[existingIndex] = prepared;
      else next.unshift(prepared);
      return next.sort((first, second) => `${first.eventDate} ${first.eventTime}`.localeCompare(`${second.eventDate} ${second.eventTime}`));
    });
    setShowFormDrawer(false);
    flashMessage('CSC opportunity saved.');
  };

  const handleDeleteOpportunity = (opportunity) => {
    if (!window.confirm(`Permanently delete ${opportunity.eventName}?`)) return;
    saveSnapshot('Before CSC opportunity delete');
    setOpportunities((current) => current.filter((item) => item.id !== opportunity.id));
    flashMessage('CSC opportunity deleted.');
  };

  const handleCheckScheduled = (opportunity) => {
    const match = findMatchingCscShift(opportunity);

    if (match) {
      if (!confirmSameDateConflict(opportunity, 'link this scheduled CSC shift')) return;

      saveSnapshot('Before CSC opportunity shift link');
      updateOpportunity(opportunity.id, {
        status: 'Scheduled',
        linkedCscShiftId: match.id,
        nextCallDate: '',
      });
      flashMessage(`Scheduled shift found and linked for ${opportunity.eventName}.`);
      return;
    }

    updateOpportunity(opportunity.id, { linkedCscShiftId: '' });
    flashMessage(`No CSC shift match found for ${opportunity.eventName}.`);
  };

  const handleOpenLinkedShift = (linkedShift) => {
    if (!linkedShift?.id) {
      flashMessage('The linked CSC shift could not be found.');
      return;
    }

    try {
      sessionStorage.setItem(CSC_OPEN_SHIFT_STORAGE_KEY, linkedShift.id);
      localStorage.removeItem(CSC_OPEN_SHIFT_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to queue linked CSC shift:', error);
      localStorage.setItem(CSC_OPEN_SHIFT_STORAGE_KEY, linkedShift.id);
    }

    const cscShiftsTabButton = document.querySelector('button[aria-label="Open CSC Shifts tab"]');

    if (cscShiftsTabButton) {
      cscShiftsTabButton.click();
      return;
    }

    flashMessage('CSC Shifts tab could not be opened.');
  };

  const handleMarkScheduled = (opportunity) => {
    if (!confirmSameDateConflict(opportunity, 'mark this opportunity as scheduled')) return;

    const match = findMatchingCscShift(opportunity);
    saveSnapshot('Before CSC opportunity marked scheduled');
    updateOpportunity(opportunity.id, {
      status: 'Scheduled',
      linkedCscShiftId: match?.id || opportunity.linkedCscShiftId || '',
      nextCallDate: '',
    });
    flashMessage(match ? 'Opportunity linked to an existing CSC shift.' : 'Opportunity marked scheduled.');
  };

  const measureOpportunityNotes = (opportunityId, textarea = noteTextareaRefs.current.get(opportunityId)) => {
    if (!textarea || typeof window === 'undefined' || typeof document === 'undefined') return;

    const computed = window.getComputedStyle(textarea);
    const mirror = document.createElement('textarea');
    const width = textarea.getBoundingClientRect().width || textarea.clientWidth;
    const lineHeight = Number.parseFloat(computed.lineHeight) || 20;
    const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computed.paddingBottom) || 0;
    const oneRowScrollHeight = lineHeight + paddingTop + paddingBottom;

    mirror.value = textarea.value;
    mirror.rows = 1;
    mirror.wrap = 'soft';

    Object.assign(mirror.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
      width: `${width}px`,
      height: 'auto',
      minHeight: '0',
      maxHeight: 'none',
      overflow: 'hidden',
      resize: 'none',
      boxSizing: computed.boxSizing,
      fontFamily: computed.fontFamily,
      fontSize: computed.fontSize,
      fontStyle: computed.fontStyle,
      fontWeight: computed.fontWeight,
      letterSpacing: computed.letterSpacing,
      lineHeight: computed.lineHeight,
      paddingTop: computed.paddingTop,
      paddingRight: computed.paddingRight,
      paddingBottom: computed.paddingBottom,
      paddingLeft: computed.paddingLeft,
      borderTopWidth: computed.borderTopWidth,
      borderRightWidth: computed.borderRightWidth,
      borderBottomWidth: computed.borderBottomWidth,
      borderLeftWidth: computed.borderLeftWidth,
      borderStyle: 'solid',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      wordBreak: 'break-word',
    });

    document.body.appendChild(mirror);
    const hasMoreThanOneRow = mirror.scrollHeight > oneRowScrollHeight + 1;
    document.body.removeChild(mirror);

    setOverflowingNoteIds((current) => {
      const currentlyOverflowing = current.has(opportunityId);
      if (currentlyOverflowing === hasMoreThanOneRow) return current;

      const next = new Set(current);
      if (hasMoreThanOneRow) next.add(opportunityId);
      else next.delete(opportunityId);
      return next;
    });

    if (!hasMoreThanOneRow) {
      setExpandedNoteIds((current) => {
        if (!current.has(opportunityId)) return current;
        const next = new Set(current);
        next.delete(opportunityId);
        return next;
      });
    }
  };

  const setOpportunityNotesRef = (opportunityId, textarea) => {
    if (!textarea) {
      noteTextareaRefs.current.delete(opportunityId);
      return;
    }

    noteTextareaRefs.current.set(opportunityId, textarea);
    window.requestAnimationFrame(() => measureOpportunityNotes(opportunityId, textarea));
  };

  const handleNotesChange = (opportunityId, value, textarea) => {
    setNotesDrafts((current) => ({ ...current, [opportunityId]: value }));
    window.requestAnimationFrame(() => measureOpportunityNotes(opportunityId, textarea));
  };

  const toggleOpportunityNotes = (opportunityId) => {
    setExpandedNoteIds((current) => {
      const next = new Set(current);
      if (next.has(opportunityId)) next.delete(opportunityId);
      else next.add(opportunityId);
      return next;
    });
  };

  useEffect(() => {
    const measureAllNotes = () => {
      noteTextareaRefs.current.forEach((textarea, opportunityId) => {
        measureOpportunityNotes(opportunityId, textarea);
      });
    };

    const frameId = window.requestAnimationFrame(measureAllNotes);
    window.addEventListener('resize', measureAllNotes);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', measureAllNotes);
    };
  }, [opportunities, notesDrafts]);

  const handleSaveNotes = (opportunity) => {
    const nextNotes = notesDrafts[opportunity.id] ?? opportunity.notes ?? '';
    saveSnapshot('Before CSC opportunity notes update');
    updateOpportunity(opportunity.id, {
      notes: nextNotes,
      notesUpdatedAt: new Date().toISOString(),
    });
    setNotesDrafts((current) => {
      const next = { ...current };
      delete next[opportunity.id];
      return next;
    });
    flashMessage('Opportunity notes saved.');
  };

  const openCreateShift = (opportunity) => {
    const venueDefinition = getVenueDefinition(opportunity.venue);
    setShiftDraft({
      opportunityId: opportunity.id,
      startDate: opportunity.eventDate,
      startTime: opportunity.eventTime || '',
      finishDate: opportunity.eventDate,
      finishTime: opportunity.expectedEndTime || '',
      venue: opportunity.venue,
      city: /inglewood/i.test(venueDefinition?.address || '') ? 'Inglewood' : '',
      address: venueDefinition?.address || '',
      event: opportunity.eventName,
      jobName: opportunity.eventName,
      shiftName: '',
      roleName: '',
      shiftStatus: 'Scheduled',
      hourlyRate: DEFAULT_HOURLY_RATE,
      paidStatus: 'Unpaid',
      paymentDate: '',
      notes: opportunity.notes || '',
      parking: '',
      uniform: '',
      supervisor: '',
    });
    setShowCreateShiftDrawer(true);
  };

  const handleCreateCscShift = () => {
    if (!shiftDraft?.startDate || !shiftDraft?.startTime || !shiftDraft?.finishTime || !shiftDraft?.venue) {
      flashMessage('Start date, start time, finish time, and venue are required.');
      return;
    }

    const sourceOpportunity = opportunities.find((item) => item.id === shiftDraft.opportunityId);
    const shiftConflictCandidate = {
      ...(sourceOpportunity || {}),
      id: sourceOpportunity?.id || shiftDraft.opportunityId,
      eventName: shiftDraft.event || sourceOpportunity?.eventName || 'CSC shift',
      eventDate: shiftDraft.startDate,
      eventTime: shiftDraft.startTime,
      venue: shiftDraft.venue,
      status: 'Scheduled',
    };

    if (!confirmSameDateConflict(shiftConflictCandidate, 'create and link this CSC shift')) return;

    const activeShifts = readArray(CSC_STORAGE_KEY, []);
    const archivedShifts = readArray(CSC_ARCHIVE_STORAGE_KEY, []);
    localStorage.setItem(
      CSC_SNAPSHOT_STORAGE_KEY,
      JSON.stringify({
        id: createId('csc-snapshot'),
        label: 'Before CSC opportunity created shift',
        createdAt: new Date().toISOString(),
        activeShifts,
        archivedShifts,
      })
    );

    const newShift = {
      ...shiftDraft,
      id: createId('csc-opportunity-shift'),
      finishDate: shiftDraft.finishDate || shiftDraft.startDate,
      createdFromOpportunityId: shiftDraft.opportunityId,
    };
    delete newShift.opportunityId;
    const nextShifts = [...activeShifts, newShift].sort((first, second) =>
      `${first.startDate}T${first.startTime}`.localeCompare(`${second.startDate}T${second.startTime}`)
    );
    localStorage.setItem(CSC_STORAGE_KEY, JSON.stringify(nextShifts));
    window.dispatchEvent(new CustomEvent(CSC_SHIFT_UPDATE_EVENT, { detail: { shifts: nextShifts } }));

    updateOpportunity(shiftDraft.opportunityId, {
      status: 'Scheduled',
      linkedCscShiftId: newShift.id,
      eventTime: shiftDraft.startTime,
      expectedEndTime: shiftDraft.finishTime,
      nextCallDate: '',
    });
    setShowCreateShiftDrawer(false);
    setShiftDraft(null);
    flashMessage('CSC shift created and linked to the opportunity.');
  };

  const handleScan = () => {
    const parsed = parseVenueEvents(scanText, scanVenue, scanSourceUrl);

    const contact = getContactForVenue(scanVenue);
    const withDefaults = parsed.map((item) =>
      applyVenueDefaults(
        createBlankOpportunity({
          ...item,
          venueLogo: contact?.venueLogo || item.venueLogo,
        }),
        item.venue
      )
    );

    setScannedOpportunities(withDefaults);
    flashMessage(
      withDefaults.length
        ? `Scanner found ${withDefaults.length} event opportunit${withDefaults.length === 1 ? 'y' : 'ies'}. Review before importing.`
        : 'No event opportunities found. Copy the event date and event name lines from the venue page.'
    );
  };

  const handleImportScanned = () => {
    if (!scannedOpportunities.length) {
      flashMessage('Scan event text before importing.');
      return;
    }

    saveSnapshot('Before CSC opportunities scan import');
    let added = 0;
    let skipped = 0;
    setOpportunities((current) => {
      const byKey = new Map(current.map((item) => [opportunityKey(item), item]));
      scannedOpportunities.forEach((item) => {
        const key = opportunityKey(item);
        if (byKey.has(key)) {
          skipped += 1;
          return;
        }
        byKey.set(key, createBlankOpportunity(item));
        added += 1;
      });
      return Array.from(byKey.values()).sort((first, second) =>
        `${first.eventDate} ${first.eventTime}`.localeCompare(`${second.eventDate} ${second.eventTime}`)
      );
    });
    setScannedOpportunities([]);
    setScanText('');
    setShowScanDrawer(false);
    flashMessage(`Imported ${added} opportunities. Skipped ${skipped} duplicates.`);
  };

  const handleRemoveScanPreview = (id) => {
    setScannedOpportunities((current) => current.filter((item) => item.id !== id));
  };

  const handleExport = () => {
    downloadJson(
      {
        exportedAt: new Date().toISOString(),
        opportunities,
        venueContacts,
      },
      `CSC_Opportunities_David_Hallstrom_${todayIso()}.json`
    );
    flashMessage('CSC opportunities exported.');
  };

  const handleImportFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(String(loadEvent.target?.result || '{}'));
        const incomingOpportunities = Array.isArray(parsed.opportunities) ? parsed.opportunities : [];
        const incomingContacts = Array.isArray(parsed.venueContacts) ? parsed.venueContacts : [];
        saveSnapshot('Before CSC opportunities JSON import');
        setOpportunities(incomingOpportunities.map((item) => createBlankOpportunity(item)));
        if (incomingContacts.length) setVenueContacts(incomingContacts);
        flashMessage('CSC opportunities imported.');
      } catch (error) {
        console.error('Failed to import CSC opportunities:', error);
        flashMessage('CSC opportunities import failed.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleManualSnapshot = () => {
    flashMessage(saveSnapshot('Manual CSC opportunities snapshot') ? 'CSC opportunities safety snapshot saved.' : 'Snapshot failed.');
  };

  useEffect(() => {
    const openAdd = () => openAddOpportunity();
    const snapshot = () => handleManualSnapshot();
    const exportData = () => handleExport();
    const importData = () => importInputRef.current?.click();

    window.addEventListener('csc-opportunities-toolbar:add', openAdd);
    window.addEventListener('csc-opportunities-toolbar:snapshot', snapshot);
    window.addEventListener('csc-opportunities-toolbar:save', snapshot);
    window.addEventListener('csc-opportunities-toolbar:export', exportData);
    window.addEventListener('csc-opportunities-toolbar:import', importData);

    return () => {
      window.removeEventListener('csc-opportunities-toolbar:add', openAdd);
      window.removeEventListener('csc-opportunities-toolbar:snapshot', snapshot);
      window.removeEventListener('csc-opportunities-toolbar:save', snapshot);
      window.removeEventListener('csc-opportunities-toolbar:export', exportData);
      window.removeEventListener('csc-opportunities-toolbar:import', importData);
    };
  }, [opportunities, venueContacts]);

  const combinedSearch = [searchQuery, localSearch].filter(Boolean).join(' ').trim().toLowerCase();

  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opportunity) => {
      if (venueFilter !== 'All' && canonicalVenueName(opportunity.venue) !== venueFilter) return false;
      if (statusFilter !== 'All' && opportunity.status !== statusFilter) return false;
      if (!combinedSearch) return true;
      const haystack = [
        opportunity.eventName,
        opportunity.venue,
        opportunity.eventDate,
        opportunity.eventTime,
        opportunity.status,
        opportunity.notes,
        opportunity.sourceText,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(combinedSearch);
    });
  }, [combinedSearch, opportunities, statusFilter, venueFilter]);

  const upcomingOpportunities = useMemo(
    () => filteredOpportunities.filter((item) => item.eventDate >= todayIso()),
    [filteredOpportunities]
  );

  const scheduledCount = opportunities.filter((item) => item.status === 'Scheduled').length;
  const notesCount = opportunities.filter((item) => String(item.notes || '').trim()).length;

  const renderOpportunityCard = (opportunity) => {
    const match = opportunity.linkedCscShiftId
      ? readCscShifts().find((shift) => shift.id === opportunity.linkedCscShiftId)
      : null;
    const dateConflicts = sameDateConflictMap.get(opportunity.id) || [];
    const notesValue = notesDrafts[opportunity.id] ?? opportunity.notes ?? '';
    const notesChanged = notesValue !== (opportunity.notes ?? '');
    const notesExpanded = expandedNoteIds.has(opportunity.id);
    const notesHaveMore = overflowingNoteIds.has(opportunity.id);

    return (
      <article key={opportunity.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <VenueLogo opportunity={opportunity} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-normal text-slate-950"><FormattedEventName value={opportunity.eventName} /></h3>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-extrabold ${getStatusClass(opportunity.status)}`}>
                  {opportunity.status}
                </span>
                {match ? (
                  <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-extrabold text-white">Shift Linked</span>
                ) : null}
                {dateConflicts.length ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2.5 py-1 text-xs font-extrabold text-red-900">
                    <CircleAlert className="h-3.5 w-3.5" />
                    Date Conflict ({dateConflicts.length})
                  </span>
                ) : null}
              </div>
              <p className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-700">
                <MapPin className="h-4 w-4" />
                {opportunity.venue}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                <CalendarDays className="h-4 w-4" />
                {formatDate(opportunity.eventDate)}
                {opportunity.eventTime ? ` at ${formatTime(opportunity.eventTime)}` : ''}
              </p>
              {opportunity.eventUrl ? (
                <a
                  href={opportunity.eventUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 flex min-w-0 items-start gap-1 text-xs font-semibold text-blue-700 underline decoration-1 underline-offset-2 hover:text-blue-900"
                  title={opportunity.eventUrl}
                >
                  <span>Upcoming Events</span>
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                </a>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:max-w-[460px] lg:justify-end">
            {match ? (
              <button
                type="button"
                onClick={() => handleOpenLinkedShift(match)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-cyan-800"
              >
                <ExternalLink className="h-4 w-4" />
                Open Linked Shift
              </button>
            ) : (
              <button type="button" onClick={() => handleCheckScheduled(opportunity)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-800">
                <RefreshCcw className="h-4 w-4" />
                Check Scheduled
              </button>
            )}
            {!match && opportunity.status !== 'Scheduled' ? (
              <button type="button" onClick={() => handleMarkScheduled(opportunity)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white hover:bg-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Mark Scheduled
              </button>
            ) : null}
            {!match ? (
              <button type="button" onClick={() => openCreateShift(opportunity)} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-extrabold text-white hover:bg-slate-800">
                <CalendarCheck2 className="h-4 w-4" />
                Create CSC Shift
              </button>
            ) : null}
            <button type="button" onClick={() => openEditOpportunity(opportunity)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-600 text-white hover:bg-slate-700" title="Edit opportunity" aria-label="Edit opportunity">
              <Edit3 className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => handleDeleteOpportunity(opportunity)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700" title="Delete opportunity" aria-label="Delete opportunity">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {dateConflicts.length ? (
          <div className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 p-3">
            <div className="flex items-center gap-2 text-red-950">
              <CircleAlert className="h-5 w-5 shrink-0" />
              <p className="text-sm font-black">Same-date events at other venues</p>
            </div>
            <div className="mt-2 grid gap-1.5">
              {dateConflicts.map((conflict) => (
                <div
                  key={conflict.id}
                  className="flex flex-col gap-0.5 rounded-lg bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="font-normal text-red-950">
                    <span className="font-extrabold">{conflict.venue}:</span>{' '}
                    <FormattedEventName value={conflict.eventName} />
                  </span>
                  <span className="text-xs font-bold text-red-800">
                    {conflict.eventTime ? formatTime(conflict.eventTime) : 'Time not listed'}
                    {conflict.status === 'Scheduled' ? ', Scheduled' : `, ${conflict.status}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">CSC Shift Link</p>
            {match ? (
              <>
                <p className="mt-1 text-sm font-extrabold text-slate-950">
                  {match.jobName || match.event || 'Linked CSC shift'}
                </p>
                <p className="text-xs font-bold text-emerald-700">
                  {match.shiftStatus || 'Scheduled'}, {match.paidStatus || 'Unpaid'}
                  {match.recordSource === 'archived' ? ', Archived' : ''}
                </p>
                <p className="text-xs text-slate-600">
                  {formatDate(match.startDate)} {formatTime(match.startTime)}
                  {match.finishTime ? ` to ${formatTime(match.finishTime)}` : ''}
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm font-extrabold text-slate-950">
                {opportunity.linkedCscShiftId ? 'Linked shift not found' : 'Not linked'}
              </p>
            )}
          </div>
          <div className="h-full rounded-xl bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label htmlFor={`opportunity-notes-${opportunity.id}`} className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Notes
                </label>
                {notesHaveMore ? (
                  <button
                    type="button"
                    onClick={() => toggleOpportunityNotes(opportunity.id)}
                    className="text-xs font-normal text-blue-700 underline decoration-1 underline-offset-2 hover:text-blue-900"
                    title={notesExpanded ? 'Show less notes' : 'Show more notes'}
                    aria-label={notesExpanded ? 'Show less notes' : 'Show more notes'}
                  >
                    {notesExpanded ? 'less' : 'more'}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => handleSaveNotes(opportunity)}
                disabled={!notesChanged}
                className={`rounded-lg px-3 py-1.5 text-xs font-extrabold text-white ${
                  notesChanged ? 'bg-indigo-700 hover:bg-indigo-800' : 'cursor-not-allowed bg-slate-400'
                }`}
              >
                Save Notes
              </button>
            </div>
            <textarea
              ref={(textarea) => setOpportunityNotesRef(opportunity.id, textarea)}
              id={`opportunity-notes-${opportunity.id}`}
              rows={notesExpanded ? 4 : 1}
              wrap="soft"
              value={notesValue}
              onChange={(event) => {
                const textarea = event.currentTarget;
                handleNotesChange(opportunity.id, textarea.value, textarea);
              }}
              placeholder="Add notes about this event or shift opportunity..."
              className={`mt-2 w-full whitespace-pre-wrap break-words rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 [overflow-wrap:anywhere] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
                notesExpanded ? 'resize-y overflow-auto' : 'resize-none overflow-hidden'
              }`}
            />
            {opportunity.notesUpdatedAt ? (
              <p className="mt-1 text-right text-[11px] font-semibold text-slate-500">
                {formatShortDateTime(opportunity.notesUpdatedAt)}
              </p>
            ) : null}
          </div>
        </div>
      </article>
    );
  };

  return (
    <PageContainer>
      <div className="space-y-6 py-6">
        <input ref={importInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />

        <section className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 to-violet-100 px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-indigo-700" />
                <h2 className="text-2xl font-black text-slate-950">CSC Opportunities</h2>
              </div>
              <p className="mt-1 text-sm font-medium text-slate-600">
                Track venue events, editable notes, and links to actual CSC shifts.
              </p>
              {saveMessage ? <p className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-extrabold text-indigo-900 shadow-sm">{saveMessage}</p> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowScanDrawer(true)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-800">
                <ClipboardCheck className="h-4 w-4" />
                Scan Events
              </button>
              <button type="button" onClick={openAddOpportunity} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-800">
                <Plus className="h-4 w-4" />
                Add Opportunity
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-950 shadow-sm">
            <p className="text-sm font-bold">Active Opportunities</p>
            <p className="mt-1 text-3xl font-black">{opportunities.length}</p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-violet-950 shadow-sm">
            <p className="text-sm font-bold">With Notes</p>
            <p className="mt-1 text-3xl font-black">{notesCount}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
            <p className="text-sm font-bold">Scheduled</p>
            <p className="mt-1 text-3xl font-black">{scheduledCount}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950 shadow-sm">
            <p className="text-sm font-bold">Upcoming Events</p>
            <p className="mt-1 text-3xl font-black">{upcomingOpportunities.length}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowConflictSection((current) => !current)}
            aria-expanded={showConflictSection}
            aria-controls="same-date-venue-conflicts"
            title={showConflictSection ? 'Hide same-date venue conflicts' : 'Show same-date venue conflicts'}
            className="rounded-2xl border border-red-300 bg-red-50 p-4 text-left text-red-950 shadow-sm transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
          >
            <p className="text-sm font-bold">Conflict Dates</p>
            <p className="mt-1 text-3xl font-black">{sameDateConflictGroups.length}</p>
            <p className="mt-1 text-xs font-bold text-red-800">
              {showConflictSection ? 'Click to hide' : 'Click to view'}
            </p>
          </button>
        </section>

        {sameDateConflictGroups.length && showConflictSection ? (
          <section
            id="same-date-venue-conflicts"
            className="rounded-2xl border-2 border-red-300 bg-red-50 p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-6 w-6 shrink-0 text-red-700" />
              <div>
                <h2 className="text-xl font-black text-red-950">Same-Date Venue Conflicts</h2>
                <p className="text-sm font-semibold text-red-800">
                  These dates have active opportunities at more than one venue. Cancelled opportunities are excluded.
                </p>
              </div>
            </div>
            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
              {sameDateConflictGroups.map((group) => (
                <div key={group.eventDate} className="rounded-xl border border-red-200 bg-white p-3">
                  <p className="font-black text-red-950">{formatDate(group.eventDate)}</p>
                  <div className="mt-2 grid gap-1.5">
                    {group.opportunities.map((opportunity) => (
                      <div
                        key={opportunity.id}
                        className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="font-normal text-slate-950">
                          <span className="font-extrabold">{opportunity.venue}:</span>{' '}
                          <FormattedEventName value={opportunity.eventName} />
                        </span>
                        <span className="text-xs font-bold text-slate-600">
                          {opportunity.eventTime ? formatTime(opportunity.eventTime) : 'Time not listed'}, {opportunity.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">Venue Event Opportunities</h2>
              <p className="text-sm text-slate-600">Opportunities stay separate from CSC Shifts until you create or link a shift.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={venueFilter} onChange={(event) => setVenueFilter(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold">
                <option value="All">All venues</option>
                {VENUE_DEFINITIONS.map((definition) => <option key={definition.venue} value={definition.venue}>{definition.venue}</option>)}
              </select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold">
                <option value="All">All statuses</option>
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <label className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={localSearch} onChange={(event) => setLocalSearch(event.target.value)} placeholder="Search opportunities" className="h-10 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm" />
              </label>
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            {filteredOpportunities.length ? filteredOpportunities.map(renderOpportunityCard) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <CircleAlert className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-2 font-extrabold text-slate-800">No opportunities match the current filters.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {showFormDrawer ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/60">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-950">CSC Opportunity</h3>
                <p className="text-sm text-slate-600">Enter the venue event details and notes.</p>
              </div>
              <button type="button" onClick={() => setShowFormDrawer(false)} className="rounded-lg border border-slate-200 p-2"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="md:col-span-2 text-sm font-bold text-slate-700">Event name
                <input value={editingOpportunity.eventName} onChange={(event) => setEditingOpportunity((current) => ({ ...current, eventName: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-bold text-slate-700">Venue
                <select value={editingOpportunity.venue} onChange={(event) => setEditingOpportunity((current) => applyVenueDefaults({ ...current, venue: event.target.value }, event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
                  {VENUE_DEFINITIONS.map((definition) => <option key={definition.venue} value={definition.venue}>{definition.venue}</option>)}
                  <option value="Other CSC Venue">Other CSC Venue</option>
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">Status
                <select value={editingOpportunity.status} onChange={(event) => setEditingOpportunity((current) => ({ ...current, status: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
                  {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">Event date
                <input type="date" value={editingOpportunity.eventDate} onChange={(event) => setEditingOpportunity((current) => ({ ...current, eventDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-bold text-slate-700">Event time
                <input type="time" value={editingOpportunity.eventTime} onChange={(event) => setEditingOpportunity((current) => ({ ...current, eventTime: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-bold text-slate-700">Expected end time
                <input type="time" value={editingOpportunity.expectedEndTime} onChange={(event) => setEditingOpportunity((current) => ({ ...current, expectedEndTime: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="md:col-span-2 text-sm font-bold text-slate-700">Event URL
                <input value={editingOpportunity.eventUrl} onChange={(event) => setEditingOpportunity((current) => ({ ...current, eventUrl: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="md:col-span-2 text-sm font-bold text-slate-700">Notes
                <textarea rows={4} value={editingOpportunity.notes} onChange={(event) => setEditingOpportunity((current) => ({ ...current, notes: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowFormDrawer(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-extrabold text-slate-700">Cancel</button>
              <button type="button" onClick={handleSaveOpportunity} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-800">Save Opportunity</button>
            </div>
          </div>
        </div>
      ) : null}

      {showScanDrawer ? (
        <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/60">
          <div className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-950">Scan Venue Events</h3>
                <p className="text-sm text-slate-600">Open the venue page, copy the event listings, paste them here, then review before importing.</p>
              </div>
              <button type="button" onClick={() => setShowScanDrawer(false)} className="rounded-lg border border-slate-200 p-2"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">Venue
                <select value={scanVenue} onChange={(event) => {
                  const venue = event.target.value;
                  const definition = getVenueDefinition(venue);
                  setScanVenue(venue);
                  setScanSourceUrl(definition?.sourceUrl || '');
                }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
                  {VENUE_DEFINITIONS.map((definition) => <option key={definition.venue} value={definition.venue}>{definition.venue}</option>)}
                  <option value="Other CSC Venue">Other CSC Venue</option>
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">Source URL
                <input value={scanSourceUrl} onChange={(event) => setScanSourceUrl(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
            </div>

            {scanSourceUrl ? (
              <a href={scanSourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-800">
                <ExternalLink className="h-4 w-4" />
                Open Venue Events Page
              </a>
            ) : null}

            <label className="mt-4 block text-sm font-bold text-slate-700">Paste event listing text
              <textarea rows={12} value={scanText} onChange={(event) => setScanText(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm" placeholder={'July 2026\nJuly 17\nYOUNG THE GIANT\nVictory Garden Tour'} />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={handleScan} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-800">
                <Search className="h-4 w-4" />
                Scan Text
              </button>
              <button type="button" onClick={() => { setScanText(''); setScannedOpportunities([]); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-extrabold text-slate-700">Clear</button>
            </div>

            {scannedOpportunities.length ? (
              <div className="mt-6">
                <h4 className="text-lg font-black text-slate-950">Review Found Events ({scannedOpportunities.length})</h4>
                <div className="mt-3 grid gap-2">
                  {scannedOpportunities.map((opportunity) => (
                    <div key={opportunity.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div>
                        <p className="font-normal text-slate-950">
                          <span className="font-extrabold">{opportunity.venue}:</span>{' '}
                          <FormattedEventName value={opportunity.eventName} />
                        </p>
                        <p className="text-sm text-slate-600">{formatDate(opportunity.eventDate)}</p>
                      </div>
                      <button type="button" onClick={() => handleRemoveScanPreview(opportunity.id)} className="rounded-lg bg-red-600 p-2 text-white" title="Remove from import" aria-label="Remove from import"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={handleImportScanned} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-emerald-700">
                  <Upload className="h-4 w-4" />
                  Import Reviewed Events
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showCreateShiftDrawer && shiftDraft ? (
        <div className="fixed inset-0 z-[85] flex justify-end bg-slate-950/60">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-slate-950">Create CSC Shift</h3>
                <p className="text-sm text-slate-600">Confirm the exact shift window before creating the CSC shift.</p>
              </div>
              <button type="button" onClick={() => setShowCreateShiftDrawer(false)} className="rounded-lg border border-slate-200 p-2"><X className="h-5 w-5" /></button>
            </div>
            {getSameDateVenueConflicts(opportunities, {
              id: shiftDraft.opportunityId,
              eventName: shiftDraft.event,
              eventDate: shiftDraft.startDate,
              eventTime: shiftDraft.startTime,
              venue: shiftDraft.venue,
              status: 'Scheduled',
            }).length ? (
              <div className="mt-5 rounded-xl border-2 border-red-300 bg-red-50 p-3">
                <div className="flex items-center gap-2 text-red-950">
                  <CircleAlert className="h-5 w-5" />
                  <p className="text-sm font-black">Date conflict before creating this shift</p>
                </div>
                <div className="mt-2 space-y-1 text-sm text-red-900">
                  {getSameDateVenueConflicts(opportunities, {
                    id: shiftDraft.opportunityId,
                    eventName: shiftDraft.event,
                    eventDate: shiftDraft.startDate,
                    eventTime: shiftDraft.startTime,
                    venue: shiftDraft.venue,
                    status: 'Scheduled',
                  }).map((conflict) => (
                    <p key={conflict.id}>
                      <span className="font-extrabold">{conflict.venue}:</span>{' '}<FormattedEventName value={conflict.eventName} />
                      {conflict.eventTime ? ` at ${formatTime(conflict.eventTime)}` : ''}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[
                ['Start date', 'startDate', 'date'],
                ['Start time', 'startTime', 'time'],
                ['Finish date', 'finishDate', 'date'],
                ['Finish time', 'finishTime', 'time'],
              ].map(([label, field, type]) => (
                <label key={field} className="text-sm font-bold text-slate-700">{label}
                  <input type={type} value={shiftDraft[field] || ''} onChange={(event) => setShiftDraft((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
                </label>
              ))}
              <label className="md:col-span-2 text-sm font-bold text-slate-700">Venue
                <input value={shiftDraft.venue} onChange={(event) => setShiftDraft((current) => ({ ...current, venue: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="md:col-span-2 text-sm font-bold text-slate-700">Address
                <input value={shiftDraft.address} onChange={(event) => setShiftDraft((current) => ({ ...current, address: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="md:col-span-2 text-sm font-bold text-slate-700">Event
                <input value={shiftDraft.event} onChange={(event) => setShiftDraft((current) => ({ ...current, event: event.target.value, jobName: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-bold text-slate-700">Shift Name
                <input value={shiftDraft.shiftName} onChange={(event) => setShiftDraft((current) => ({ ...current, shiftName: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-bold text-slate-700">Role Name
                <input value={shiftDraft.roleName} onChange={(event) => setShiftDraft((current) => ({ ...current, roleName: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreateShiftDrawer(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-extrabold text-slate-700">Cancel</button>
              <button type="button" onClick={handleCreateCscShift} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-800">Create and Link Shift</button>
            </div>
          </div>
        </div>
      ) : null}

    </PageContainer>
  );
};

export {
  parseRoseBowlEvents,
  parseKiaForumEvents,
  parseSofiEvents,
  parseIntuitDomeEvents,
  parseHollywoodBowlEvents,
  parseVenueEvents,
  findMatchingCscShift,
};
export default CscOpportunitiesTab;
