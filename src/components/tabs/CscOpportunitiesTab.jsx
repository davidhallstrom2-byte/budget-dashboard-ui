import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Link2Off,
  ListX,
  ListTodo,
  MapPin,
  Phone,
  Plus,
  Printer,
  RefreshCcw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import PageContainer from '../common/PageContainer.jsx';
import TabPageHeader, { TAB_HEADER_ACTION_CLASS } from '../common/TabPageHeader.jsx';
import CloseScreenButton from '../common/CloseScreenButton.jsx';
import DataToolsScreen from '../common/DataToolsScreen.jsx';
import { formatPhoneNumber } from '../../utils/phone';
import { cleanCscDisplayShift, cleanCscDisplayTitle, cleanCscVenueDisplay, formatAppShortDate } from '../../utils/cscDisplay.js';

const OPPORTUNITIES_STORAGE_KEY = 'cscOpportunities.v1';
const OPPORTUNITIES_ARCHIVE_STORAGE_KEY = 'cscOpportunities.archived.v1';
const VENUE_CONTACTS_STORAGE_KEY = 'cscVenueContacts.v1';
const OPPORTUNITIES_SNAPSHOT_STORAGE_KEY = 'cscOpportunities.safetySnapshot.v1';
const OPPORTUNITIES_DEDUPE_BACKUP_STORAGE_KEY = 'cscOpportunities.dedupeBackup.v1';
const OPPORTUNITIES_EXCLUDED_BACKUP_STORAGE_KEY = 'cscOpportunities.excludedBackup.v1';
const OPPORTUNITIES_DISMISSED_STORAGE_KEY = 'cscOpportunities.dismissed.v1';
const CSC_STORAGE_KEY = 'cscShifts.v1';
const CSC_ARCHIVE_STORAGE_KEY = 'cscShifts.archived.v1';
const OPPORTUNITIES_UPDATE_EVENT = 'cscOpportunities:updated';
const CSC_SHIFT_UPDATE_EVENT = 'cscShifts:updated';
const CSC_OPEN_SHIFT_STORAGE_KEY = 'cscShifts.openLinkedShiftId.v1';
const CSC_RETURN_CONTEXT_STORAGE_KEY = 'cscShifts.returnContext.v1';
const CSC_CREATE_DRAFT_STORAGE_KEY = 'cscShifts.createDraftFromOpportunity.v1';
const OPPORTUNITY_OPEN_STORAGE_KEY = 'cscOpportunities.openLinkedOpportunityId.v1';
const TODO_STORAGE_KEY = 'todoTab.tasks.v1';
const TODO_BACKUP_STORAGE_KEY = 'todoTab.tasks.backup.v1';
const TODO_UPDATE_EVENT = 'todoTab:updated';
const APP_NAVIGATE_EVENT = 'app:navigate';
const EVENT_WATCH_REPORT_STORAGE_KEY = 'cscEventWatch.latestReport.v1';
const EVENT_WATCH_SYNC_STORAGE_KEY = 'cscEventWatch.autoSync.v1';
const EVENT_WATCH_FEED_URL = '/budget-dashboard-fs/csc-event-watch-feed.php';
const EVENT_WATCH_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const KIA_FORUM_EVENTS_URL = 'https://thekiaforum.com/events/';
const SOFI_STADIUM_EVENTS_URL = 'https://www.sofistadium.com/events';
const INTUIT_DOME_EVENTS_URL = 'https://www.intuitdome.com/events/event-schedule';
const ROSE_BOWL_EVENTS_URL = 'https://www.rosebowlstadium.com/events/calendar/list';
const HOLLYWOOD_BOWL_EVENTS_URL =
  'https://www.hollywoodbowl.com/events/performances?Venue=Hollywood+Bowl&Season=upcoming';
const SHRINE_EVENTS_URL = 'https://www.shrineauditorium.com/calendar/';
const NOVO_THEATER_EVENTS_URL = 'https://www.thenovodtla.com/events';
const LONG_BEACH_AMPHITHEATER_EVENTS_URL = 'https://fmbamp.com/events-tickets/';
const LONG_BEACH_CONVENTION_CENTER_EVENTS_URL =
  'https://www.lbentertainmentcenter.com/events/';
const ROXY_EVENTS_URL = 'https://www.theroxy.com/shows/';
const YOUTUBE_THEATER_EVENTS_URL = 'https://www.youtubetheater.com/events';
const DEFAULT_HOURLY_RATE = '19.50';
const CSC_EMAIL_CHECK_REPORT_STORAGE_KEY = 'cscOpportunities.emailShiftCheckReport.v1';
const CSC_GMAIL_ACCESS_TOKEN_STORAGE_KEY = 'cscOpportunities.gmailAccessToken.v1';
const CSC_GMAIL_ACCESS_TOKEN_EXPIRES_STORAGE_KEY = 'cscOpportunities.gmailAccessTokenExpiresAt.v1';
const CSC_GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const CSC_GMAIL_MESSAGES_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages';
const GOOGLE_IDENTITY_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const CSC_GMAIL_SEARCH_QUERY = 'from:jobs@csc-usa.com subject:"Your Scheduling Details" newer_than:90d';
const CSC_GMAIL_MAX_MESSAGES = 20;

let cscGmailIdentityScriptPromise = null;
let cscGmailTokenClient = null;
let cscGmailPendingTokenRequest = null;

const EDITABLE_STATUS_OPTIONS = [
  'New',
  'Monitoring',
  'Shift Requested',
  'No Shifts Available',
  'Cancelled',
  'Completed',
];

const STATUS_OPTIONS = [...EDITABLE_STATUS_OPTIONS, 'Scheduled'];

const normalizeStatusText = (value = '') =>
  String(value || '')
    .trim()
    .toLowerCase();

const isCompletedShiftStatus = (status = '') => {
  const normalizedStatus = normalizeStatusText(status);
  return normalizedStatus === 'done' || normalizedStatus === 'completed';
};

const isCancelledShiftStatus = (status = '') => {
  const normalizedStatus = normalizeStatusText(status);
  return normalizedStatus === 'cancelled' || normalizedStatus === 'canceled';
};

const getOpportunityStatusFromLinkedShift = (shift = {}) => {
  if (isCancelledShiftStatus(shift.shiftStatus)) return 'Cancelled';
  if (isCompletedShiftStatus(shift.shiftStatus)) return 'Completed';
  return 'Scheduled';
};

const isActiveOpportunityStatus = (status = '') =>
  !['cancelled', 'canceled', 'completed'].includes(normalizeStatusText(status));

const normalizeOpportunityStatus = (status = '', linkedCscShiftId = '') => {
  const normalizedStatus = String(status || '').trim();

  if (normalizedStatus === 'Completed') return 'Completed';
  if (normalizedStatus === 'Cancelled') return 'Cancelled';

  if (linkedCscShiftId) return 'Scheduled';

  if (normalizedStatus === 'Scheduled') return 'New';
  return EDITABLE_STATUS_OPTIONS.includes(normalizedStatus) ? normalizedStatus : 'New';
};

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
    aliases: [
      'the shrine',
      'shrine',
      'shrine auditorium',
      'the shrine auditorium',
      'shrine auditorium and expo hall',
      'shrine auditorium & expo hall',
      'shrine expo hall',
      'shrine auditorium and expo hall los angeles',
    ],
    address: '665 W Jefferson Blvd, Los Angeles, CA 90007',
    logoPath: '/budget-dashboard-fs/venue-logos/shrine-auditorium-logo.png',
    sourceUrl: SHRINE_EVENTS_URL,
    schedulerPhone: '310-320-7223',
  },
  {
    venue: 'Novo Theater',
    aliases: ['novo theater', 'the novo', 'novo', 'the novo theater'],
    address: '800 W Olympic Blvd, Los Angeles, CA 90015',
    logoPath: '/budget-dashboard-fs/venue-logos/novo-theater.png',
    sourceUrl: NOVO_THEATER_EVENTS_URL,
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
  {
    venue: 'Long Beach Amphitheater',
    aliases: [
      'long beach amphitheater',
      'long beach amphitheatre',
      'f&m bank amphitheater',
      'f and m bank amphitheater',
      'f m bank amphitheater',
    ],
    address: '',
    logoPath: '/budget-dashboard-fs/venue-logos/long-beach-amphitheater.png',
    sourceUrl: LONG_BEACH_AMPHITHEATER_EVENTS_URL,
  },
  {
    venue: 'Long Beach Convention Center',
    aliases: [
      'long beach convention center',
      'long beach convention & entertainment center',
      'long beach convention and entertainment center',
      'long beach entertainment center',
      'convention center long beach',
    ],
    address: '300 E Ocean Blvd, Long Beach, CA 90802',
    logoPath: '/budget-dashboard-fs/venue-logos/long-beach-convention-center.png',
    sourceUrl: LONG_BEACH_CONVENTION_CENTER_EVENTS_URL,
  },
  {
    venue: 'The Roxy',
    aliases: ['the roxy', 'roxy theatre', 'roxy theater', 'the roxy theatre', 'the roxy theater'],
    address: '9009 W Sunset Blvd, West Hollywood, CA 90069',
    logoPath: '/budget-dashboard-fs/venue-logos/the-roxy.png',
    sourceUrl: ROXY_EVENTS_URL,
  },
  {
    venue: 'YouTube Theater',
    aliases: ['youtube theater', 'youtube theatre'],
    address: '1011 Stadium Dr, Inglewood, CA 90305',
    logoPath: '/budget-dashboard-fs/venue-logos/youtube-theater.png',
    sourceUrl: YOUTUBE_THEATER_EVENTS_URL,
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

const todayIso = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 10);
};


const formatDate = (value) => formatAppShortDate(value, 'Date not entered');

const getOpportunityDateSearchTerms = (value = '') => {
  const isoDate = String(value || '').trim();
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0);
  if (Number.isNaN(date.getTime())) return isoDate;

  const numericMonth = String(Number(month));
  const numericDay = String(Number(day));
  const shortYear = year.slice(-2);
  const shortMonth = date.toLocaleDateString('en-US', { month: 'short' });
  const longMonth = date.toLocaleDateString('en-US', { month: 'long' });
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });

  return Array.from(
    new Set([
      isoDate,
      `${month}/${day}/${year}`,
      `${numericMonth}/${numericDay}/${year}`,
      `${month}/${day}/${shortYear}`,
      `${numericMonth}/${numericDay}/${shortYear}`,
      `${month}/${day}`,
      `${numericMonth}/${numericDay}`,
      `${shortMonth} ${numericDay}`,
      `${shortMonth} ${numericDay}, ${year}`,
      `${shortMonth} ${numericDay} ${year}`,
      `${longMonth} ${numericDay}`,
      `${longMonth} ${numericDay}, ${year}`,
      `${longMonth} ${numericDay} ${year}`,
      `${weekday}, ${shortMonth} ${numericDay}, ${year}`,
    ])
  )
    .join(' ')
    .toLowerCase();
};

const buildOpportunitySearchText = (opportunity = {}, resolvedStatus = '') =>
  [
    opportunity.id,
    opportunity.eventName,
    opportunity.venue,
    getOpportunityDateSearchTerms(opportunity.eventDate),
    opportunity.eventTime,
    resolvedStatus,
    opportunity.status,
    opportunity.notes,
    opportunity.sourceText,
    opportunity.archiveReason,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

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

const createEmptyEventWatchReport = (defaults = {}) => ({
  scanDate: String(defaults.scanDate || '').trim(),
  savedAt: defaults.savedAt || '',
  source: defaults.source || '',
  newEvents: Array.isArray(defaults.newEvents) ? defaults.newEvents.filter(Boolean) : [],
  rescheduledEvents: Array.isArray(defaults.rescheduledEvents)
    ? defaults.rescheduledEvents.filter(Boolean)
    : [],
  cancelledEvents: Array.isArray(defaults.cancelledEvents)
    ? defaults.cancelledEvents.filter(Boolean)
    : [],
  scanStatus: Array.isArray(defaults.scanStatus) ? defaults.scanStatus.filter(Boolean) : [],
  rawText: String(defaults.rawText || ''),
});

const stripEventWatchMarkup = (value = '') =>
  String(value || '')
    .replace(/^\s*[-*•]+\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/^\s*#+\s*/, '')
    .trim();

const normalizeReportItems = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return stripEventWatchMarkup(item);
        if (!item || typeof item !== 'object') return '';
        return stripEventWatchMarkup(
          [
            item.venue,
            item.eventName || item.event || item.title,
            item.eventDate || item.date,
            item.eventTime || item.time,
            item.details || item.status,
          ]
            .filter(Boolean)
            .join(' | ')
        );
      })
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const item = stripEventWatchMarkup(value);
    return item && !/^none\.?$/i.test(item) ? [item] : [];
  }

  return [];
};

const normalizeEventWatchSavedAt = (value = '') => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const parsedDate = new Date(trimmed);
  return Number.isNaN(parsedDate.getTime()) ? '' : parsedDate.toISOString();
};

const formatEventWatchReportForCopy = (report = {}) => {
  const normalizedReport = createEmptyEventWatchReport(report);
  const savedAt = normalizeEventWatchSavedAt(normalizedReport.savedAt);
  const metadataLines = ['CSC Event Watch - Daily Scan Summary'];

  if (normalizedReport.scanDate) {
    metadataLines.push(`Scan date: ${normalizedReport.scanDate}`);
  }

  metadataLines.push(`Source: ${normalizedReport.source || 'CSC Event Watch'}`);

  if (savedAt) {
    metadataLines.push(`Saved: ${savedAt}`);
  }

  const formatSection = (title, items) => {
    const normalizedItems = normalizeReportItems(items);
    return [
      title,
      ...(normalizedItems.length
        ? normalizedItems.map((item) => `- ${item}`)
        : ['None.']),
    ].join('\n');
  };

  return [
    ...metadataLines,
    '',
    formatSection('NEW EVENTS', normalizedReport.newEvents),
    '',
    formatSection('RESCHEDULED EVENTS', normalizedReport.rescheduledEvents),
    '',
    formatSection('CANCELLED EVENTS', normalizedReport.cancelledEvents),
    '',
    formatSection('SCAN STATUS', normalizedReport.scanStatus),
  ].join('\n');
};

const copyTextToClipboard = async (text = '') => {
  const value = String(text || '');
  if (!value) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall back to the browser's legacy copy command when clipboard permissions are blocked.
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard access is unavailable.');
  }

  const clipboardHelper = document.createElement('textarea');
  clipboardHelper.value = value;
  clipboardHelper.setAttribute('readonly', '');
  clipboardHelper.style.position = 'fixed';
  clipboardHelper.style.left = '-9999px';
  clipboardHelper.style.opacity = '0';
  document.body.appendChild(clipboardHelper);

  try {
    clipboardHelper.select();
    const copied = document.execCommand('copy');
    if (!copied) throw new Error('Clipboard copy was rejected.');
    return true;
  } finally {
    clipboardHelper.remove();
  }
};

const parseEventWatchReportText = (value = '') => {
  const rawText = String(value || '').trim();
  if (!rawText) return createEmptyEventWatchReport();

  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === 'object') {
      const status = parsed.scanStatus || parsed.status || {};
      const statusItems = Array.isArray(status)
        ? status
        : [
            ...(normalizeReportItems(status.checked || status.successfullyChecked).map(
              (item) => `Successfully checked: ${item}`
            )),
            ...(normalizeReportItems(status.failed || status.couldNotCheck).map(
              (item) => `Extraction failed: ${item}`
            )),
            ...(normalizeReportItems(status.needsVerification).map(
              (item) => `Needs verification: ${item}`
            )),
          ];

      return createEmptyEventWatchReport({
        scanDate: parsed.scanDate || parsed.scannedAt || parsed.date || '',
        savedAt:
          normalizeEventWatchSavedAt(parsed.savedAt || parsed.saved || parsed.savedDate) ||
          new Date().toISOString(),
        source: parsed.source || 'CSC Event Watch',
        newEvents: normalizeReportItems(parsed.newEvents || parsed.new),
        rescheduledEvents: normalizeReportItems(
          parsed.rescheduledEvents || parsed.rescheduled
        ),
        cancelledEvents: normalizeReportItems(parsed.cancelledEvents || parsed.cancelled),
        scanStatus: normalizeReportItems(statusItems),
        rawText,
      });
    }
  } catch {
    // The daily report is usually copied as formatted text, not JSON.
  }

  const sectionItems = {
    newEvents: [],
    rescheduledEvents: [],
    cancelledEvents: [],
    scanStatus: [],
  };
  let activeSection = '';
  let scanDate = '';
  let source = '';
  let savedAt = '';

  rawText.split(/\r?\n/).forEach((line) => {
    const cleaned = stripEventWatchMarkup(line);
    if (!cleaned) return;

    const scanDateMatch = cleaned.match(/^scan\s+date(?:\s+and\s+time)?\s*:\s*(.+)$/i);
    if (scanDateMatch) {
      scanDate = scanDateMatch[1].trim();
      return;
    }

    const sourceMatch = cleaned.match(/^source\s*:\s*(.+)$/i);
    if (sourceMatch) {
      source = sourceMatch[1].trim();
      return;
    }

    const savedAtMatch = cleaned.match(/^saved(?:\s+at)?\s*:\s*(.+)$/i);
    if (savedAtMatch) {
      savedAt = normalizeEventWatchSavedAt(savedAtMatch[1]);
      return;
    }

    if (/^new events\s*:?$/i.test(cleaned)) {
      activeSection = 'newEvents';
      return;
    }
    if (/^rescheduled events\s*:?$/i.test(cleaned)) {
      activeSection = 'rescheduledEvents';
      return;
    }
    if (/^cancelled events\s*:?$/i.test(cleaned)) {
      activeSection = 'cancelledEvents';
      return;
    }
    if (/^scan status\s*:?$/i.test(cleaned)) {
      activeSection = 'scanStatus';
      return;
    }

    if (!activeSection || /^csc event watch\b/i.test(cleaned) || /^daily scan summary$/i.test(cleaned)) {
      return;
    }
    if (/^none\.?$/i.test(cleaned)) return;
    sectionItems[activeSection].push(cleaned);
  });

  return createEmptyEventWatchReport({
    scanDate,
    savedAt: savedAt || new Date().toISOString(),
    source: source || 'CSC Event Watch',
    ...sectionItems,
    rawText,
  });
};

const loadEventWatchReport = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(EVENT_WATCH_REPORT_STORAGE_KEY) || 'null');
    return parsed && typeof parsed === 'object'
      ? createEmptyEventWatchReport(parsed)
      : createEmptyEventWatchReport();
  } catch {
    return createEmptyEventWatchReport();
  }
};

const formatOpportunityForReport = (opportunity = {}) =>
  [
    canonicalVenueName(opportunity.venue) || 'Venue not entered',
    opportunity.eventName || 'Event name not entered',
    opportunity.eventDate ? formatDate(opportunity.eventDate) : 'Date not entered',
    opportunity.eventTime ? formatTime(opportunity.eventTime) : '',
  ]
    .filter(Boolean)
    .join(' | ');

const buildLocalVenueScanReport = (scannedItems = [], existingItems = [], venue = '') => {
  const canonicalVenue = canonicalVenueName(venue);
  const existingForVenue = existingItems.filter(
    (item) => canonicalVenueName(item.venue) === canonicalVenue
  );
  const newEvents = [];
  const rescheduledEvents = [];
  const cancelledEvents = [];

  scannedItems.forEach((item) => {
    const normalizedName = normalizeText(item.eventName);
    const sameEvent = existingForVenue.find(
      (existing) => normalizeText(existing.eventName) === normalizedName
    );
    const isCancelled = /\bcancell?ed\b/i.test(String(item.eventName || ''));

    if (isCancelled) {
      cancelledEvents.push(formatOpportunityForReport(item));
      return;
    }

    if (!sameEvent) {
      newEvents.push(formatOpportunityForReport(item));
      return;
    }

    if (
      String(sameEvent.eventDate || '') !== String(item.eventDate || '') ||
      String(sameEvent.eventTime || '') !== String(item.eventTime || '')
    ) {
      rescheduledEvents.push(
        `${canonicalVenue} | ${item.eventName} | ${formatDate(sameEvent.eventDate)}${
          sameEvent.eventTime ? ` at ${formatTime(sameEvent.eventTime)}` : ''
        } to ${formatDate(item.eventDate)}${item.eventTime ? ` at ${formatTime(item.eventTime)}` : ''}`
      );
    }
  });

  return createEmptyEventWatchReport({
    scanDate: new Date().toLocaleString('en-US'),
    savedAt: new Date().toISOString(),
    source: `CSC Opportunities venue scanner, ${canonicalVenue}`,
    newEvents,
    rescheduledEvents,
    cancelledEvents,
    scanStatus: [`Successfully checked: ${canonicalVenue}`],
  });
};

const getOpportunityMonthKey = (value = '') => String(value || '').slice(0, 7);

const formatOpportunityMonth = (monthKey = '') => {
  const match = String(monthKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return monthKey || 'Month not entered';

  const date = new Date(Number(match[1]), Number(match[2]) - 1, 1);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
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
  const eventName = cleanCscDisplayTitle(value);
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
  return cleanCscVenueDisplay(definition?.venue || String(value || '').trim());
};

const getVenueDefinition = (value = '') => {
  const canonical = canonicalVenueName(value);
  return VENUE_DEFINITIONS.find((item) => item.venue === canonical) || null;
};

const isExcludedOpportunityEvent = (opportunity = {}) => {
  const venue = canonicalVenueName(opportunity.venue);
  const eventName = normalizeText(opportunity.eventName);

  if (venue !== 'Rose Bowl') return false;

  /*
   * Exclude recurring public/visitor events that are not CSC staffing
   * opportunities. These records are filtered from scanner imports, Event
   * Watch sync, JSON imports, and existing active/archive data.
   */
  return (
    /\bflea markets?\b/.test(eventName) ||
    /^(?:tour|tours|public tours?|holiday tours?|stadium tours?|rose bowl tours?)$/.test(
      eventName
    )
  );
};

const removeExcludedOpportunityRecords = (items = []) =>
  (Array.isArray(items) ? items : []).filter(
    (item) => !isExcludedOpportunityEvent(item)
  );

const getOpportunityDismissalKeys = (opportunity = {}) => {
  const keys = new Set();
  const eventWatchIdentity = String(opportunity.eventWatchIdentity || opportunity.identity || '').trim();

  if (eventWatchIdentity) {
    keys.add(`event-watch:${eventWatchIdentity}`);
  }

  const venue = canonicalVenueName(opportunity.venue);
  const eventName = normalizeText(opportunity.eventName);
  const eventDate = String(opportunity.eventDate || '').trim();
  const eventTime = String(opportunity.eventTime || '').trim();

  if (venue && eventName && eventDate) {
    keys.add(
      `event:${normalizeText(venue)}|${eventDate}|${eventTime}|${eventName}`
    );
    // Also keep a time-agnostic key because venue feeds can adjust the public
    // event time while still referring to the same event the user deleted.
    keys.add(`event-date:${normalizeText(venue)}|${eventDate}|${eventName}`);
  }

  return Array.from(keys);
};

const readDismissedOpportunityKeys = () => {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(OPPORTUNITIES_DISMISSED_STORAGE_KEY) || '[]'
    );
    return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
  } catch {
    return new Set();
  }
};

const writeDismissedOpportunityKeys = (keys = new Set()) => {
  localStorage.setItem(
    OPPORTUNITIES_DISMISSED_STORAGE_KEY,
    JSON.stringify(Array.from(keys))
  );
};

const isDismissedOpportunity = (opportunity = {}, dismissedKeys = readDismissedOpportunityKeys()) =>
  getOpportunityDismissalKeys(opportunity).some((key) => dismissedKeys.has(key));

const rememberDismissedOpportunity = (opportunity = {}) => {
  const dismissedKeys = readDismissedOpportunityKeys();
  getOpportunityDismissalKeys(opportunity).forEach((key) => dismissedKeys.add(key));
  writeDismissedOpportunityKeys(dismissedKeys);
};

const getCscGoogleClientId = () => {
  const envClientId =
    import.meta.env?.VITE_GOOGLE_CALENDAR_CLIENT_ID ||
    import.meta.env?.VITE_GOOGLE_CLIENT_ID ||
    '';
  const savedClientId = localStorage.getItem('googleCalendar.clientId') || '';
  return String(envClientId || savedClientId).trim();
};

const loadGoogleIdentityScriptForCscGmail = () => {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (cscGmailIdentityScriptPromise) return cscGmailIdentityScriptPromise;

  cscGmailIdentityScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${GOOGLE_IDENTITY_SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Google Identity Services failed to load.')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_IDENTITY_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Identity Services failed to load.'));
    document.head.appendChild(script);
  });

  return cscGmailIdentityScriptPromise;
};

const readStoredCscGmailAccessToken = () => {
  const token = localStorage.getItem(CSC_GMAIL_ACCESS_TOKEN_STORAGE_KEY) || '';
  const expiresAt = Number(localStorage.getItem(CSC_GMAIL_ACCESS_TOKEN_EXPIRES_STORAGE_KEY) || 0);
  if (!token || !expiresAt || Date.now() >= expiresAt - 60000) return '';
  return token;
};

const storeCscGmailAccessToken = (tokenResponse = {}) => {
  const token = String(tokenResponse.access_token || '').trim();
  if (!token) return '';
  const expiresInSeconds = Number(tokenResponse.expires_in || 3600);
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  localStorage.setItem(CSC_GMAIL_ACCESS_TOKEN_STORAGE_KEY, token);
  localStorage.setItem(CSC_GMAIL_ACCESS_TOKEN_EXPIRES_STORAGE_KEY, String(expiresAt));
  return token;
};

const clearCscGmailAccessToken = () => {
  localStorage.removeItem(CSC_GMAIL_ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(CSC_GMAIL_ACCESS_TOKEN_EXPIRES_STORAGE_KEY);
};

const getCscGmailAccessToken = async () => {
  const existingToken = readStoredCscGmailAccessToken();
  if (existingToken) return existingToken;

  const clientId = getCscGoogleClientId();
  if (!clientId) {
    throw new Error(
      'Missing Google Client ID. Use the same Google Client ID already configured for Google Calendar.'
    );
  }

  await loadGoogleIdentityScriptForCscGmail();
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services is unavailable.');
  }
  if (cscGmailPendingTokenRequest) return cscGmailPendingTokenRequest;

  cscGmailPendingTokenRequest = new Promise((resolve, reject) => {
    cscGmailTokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: CSC_GMAIL_READONLY_SCOPE,
      callback: (tokenResponse) => {
        cscGmailPendingTokenRequest = null;
        if (tokenResponse?.error) {
          reject(new Error(tokenResponse.error_description || tokenResponse.error));
          return;
        }
        const token = storeCscGmailAccessToken(tokenResponse);
        if (!token) {
          reject(new Error('Google authorization did not return a Gmail access token.'));
          return;
        }
        resolve(token);
      },
      error_callback: (error) => {
        cscGmailPendingTokenRequest = null;
        reject(new Error(error?.message || error?.type || 'Google Gmail authorization failed.'));
      },
    });

    cscGmailTokenClient.requestAccessToken({ prompt: 'consent' });
  });

  return cscGmailPendingTokenRequest;
};

const fetchCscGmailJson = async (url, token) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) clearCscGmailAccessToken();
    const apiMessage = data?.error?.message || '';
    if (response.status === 403 && /gmail api|access not configured|disabled/i.test(apiMessage)) {
      throw new Error(
        'Gmail API access is not enabled for this Google project. Enable the Gmail API for the same project used by Google Calendar, then run Check CSC Email again.'
      );
    }
    throw new Error(apiMessage || `Gmail request failed with status ${response.status}.`);
  }

  return data;
};

const decodeGmailBase64Url = (value = '') => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = window.atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
};

const normalizeGmailPlainText = (value = '') =>
  String(value || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const looksLikeGmailHtml = (value = '') =>
  /<\/?(?:html|head|body|table|tbody|thead|tr|td|th|div|p|br|strong|span)\b/i.test(
    String(value || '')
  );

const stripGmailHtml = (html = '') => {
  if (!html) return '';

  const documentValue = new DOMParser().parseFromString(String(html), 'text/html');
  documentValue.querySelectorAll('script, style, noscript').forEach((node) => node.remove());

  // CSC scheduling emails are commonly HTML tables. Convert each table row into one
  // plain-text record and separate rows with blank lines so the scheduling parser can
  // treat each shift independently instead of exposing raw <html>/<td> markup.
  const tableRows = Array.from(documentValue.querySelectorAll('tr'))
    .map((row) =>
      Array.from(row.children)
        .filter((cell) => ['TD', 'TH'].includes(cell.tagName))
        .map((cell) => normalizeGmailPlainText(cell.textContent || '').replace(/\n+/g, ' '))
        .filter(Boolean)
        .join(' ')
    )
    .filter(Boolean);

  if (tableRows.length) {
    documentValue.querySelectorAll('table').forEach((table) => table.remove());
    const surroundingText = normalizeGmailPlainText(documentValue.body?.textContent || '');
    return normalizeGmailPlainText(
      [surroundingText, tableRows.join('\n\n')].filter(Boolean).join('\n\n')
    );
  }

  documentValue.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
  documentValue.querySelectorAll('p, div, li').forEach((node) => node.append('\n'));
  return normalizeGmailPlainText(documentValue.body?.textContent || '');
};

const extractGmailPayloadText = (payload = {}) => {
  const plainParts = [];
  const htmlParts = [];

  const visit = (part = {}) => {
    const mimeType = String(part.mimeType || '').toLowerCase();
    const encodedData = part.body?.data;
    if (encodedData) {
      const decoded = decodeGmailBase64Url(encodedData);
      const normalizedDecoded = looksLikeGmailHtml(decoded)
        ? stripGmailHtml(decoded)
        : normalizeGmailPlainText(decoded);

      if (mimeType === 'text/plain') plainParts.push(normalizedDecoded);
      else if (mimeType === 'text/html') htmlParts.push(normalizedDecoded);
    }
    (part.parts || []).forEach(visit);
  };

  visit(payload);
  return normalizeGmailPlainText(
    (plainParts.length ? plainParts : htmlParts).filter(Boolean).join('\n\n')
  );
};

const getGmailHeader = (payload = {}, headerName = '') =>
  String(
    (payload.headers || []).find(
      (header) => String(header.name || '').toLowerCase() === String(headerName || '').toLowerCase()
    )?.value || ''
  ).trim();

const fetchRecentCscSchedulingEmails = async () => {
  const token = await getCscGmailAccessToken();
  const listUrl = `${CSC_GMAIL_MESSAGES_ENDPOINT}?maxResults=${CSC_GMAIL_MAX_MESSAGES}&q=${encodeURIComponent(
    CSC_GMAIL_SEARCH_QUERY
  )}`;
  const listData = await fetchCscGmailJson(listUrl, token);
  const messageRefs = Array.isArray(listData.messages) ? listData.messages : [];
  const messages = [];

  for (const messageRef of messageRefs) {
    const messageData = await fetchCscGmailJson(
      `${CSC_GMAIL_MESSAGES_ENDPOINT}/${encodeURIComponent(messageRef.id)}?format=full`,
      token
    );
    messages.push({
      id: messageData.id,
      internalDate: Number(messageData.internalDate || 0),
      subject: getGmailHeader(messageData.payload, 'Subject'),
      from: getGmailHeader(messageData.payload, 'From'),
      body: extractGmailPayloadText(messageData.payload),
    });
  }

  return messages.sort((first, second) => second.internalDate - first.internalDate);
};

const CSC_EMAIL_DATE_TIME_REGEX =
  /\b(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?\b/gi;

const parseCscEmailDateTime = (value = '') => {
  const match = String(value || '').trim().match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i
  );
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  let hours = Number(match[4]);
  const minutes = Number(match[5]);
  const meridiem = String(match[7] || '').toUpperCase();

  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    if (meridiem === 'PM' && hours !== 12) hours += 12;
  }

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return {
    date: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  };
};

const getCscEmailVenueCandidates = () => {
  const candidates = [
    { label: 'SoFi Stadium and Hollywood Park', venue: 'SoFi Stadium' },
    { label: 'Los Angeles Memorial Coliseum', venue: 'Los Angeles Memorial Coliseum' },
    { label: 'The Forum', venue: 'Kia Forum' },
    ...VENUE_DEFINITIONS.flatMap((definition) => [
      { label: definition.venue, venue: definition.venue },
      ...definition.aliases.map((alias) => ({ label: alias, venue: definition.venue })),
    ]),
  ];

  const seen = new Set();
  return candidates
    .filter((candidate) => {
      const key = normalizeText(candidate.label);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((first, second) => second.label.length - first.label.length);
};

const findCscEmailVenueInPrefix = (prefix = '') => {
  const source = String(prefix || '');
  const lowerSource = source.toLowerCase();
  let best = null;

  getCscEmailVenueCandidates().forEach((candidate) => {
    const index = lowerSource.lastIndexOf(String(candidate.label || '').toLowerCase());
    if (index < 0) return;

    const match = { ...candidate, index };

    if (!best) {
      best = match;
      return;
    }

    // Overlapping aliases for the same canonical venue must prefer the longest
    // complete label. Example:
    // "SoFi Stadium and Hollywood Park" must beat the nested "Hollywood Park"
    // alias so "SoFi Stadium and" never leaks into the parsed Job name.
    if (candidate.venue === best.venue) {
      if (
        candidate.label.length > best.label.length ||
        (candidate.label.length === best.label.length && index > best.index)
      ) {
        best = match;
      }
      return;
    }

    // Different venues still use the venue reference closest to the assignment
    // fields, which is the safest interpretation of CSC's table row order.
    if (index > best.index || (index === best.index && candidate.label.length > best.label.length)) {
      best = match;
    }
  });

  return best;
};

const parseCscSchedulingParagraph = (paragraph = '', message = {}) => {
  const source = String(paragraph || '').replace(/\s+/g, ' ').trim();
  if (!source) return null;

  const dateMatches = Array.from(source.matchAll(CSC_EMAIL_DATE_TIME_REGEX));
  if (dateMatches.length < 2) return null;

  const startMatch = dateMatches[0];
  const endMatch = dateMatches[1];
  const start = parseCscEmailDateTime(startMatch[0]);
  const end = parseCscEmailDateTime(endMatch[0]);
  if (!start || !end) return null;

  const prefix = source.slice(0, startMatch.index).trim();
  const venueMatch = findCscEmailVenueInPrefix(prefix);
  if (!venueMatch) return null;

  const rawJobName = prefix.slice(0, venueMatch.index).trim();
  const jobName = rawJobName
    .replace(/^.*?Job Name Venue Shift Name Role Name Start Time End Time Parking Information SignIn Location Uniform Requirement\s*/i, '')
    .trim();
  if (!jobName || /^dear\b/i.test(jobName)) return null;

  const assignmentText = prefix.slice(venueMatch.index + venueMatch.label.length).trim();
  const roleMatch = assignmentText.match(
    /\b(Security Guard(?:\s+\d+)?|C&T Event Staff|Event Staff|Workers|Supervisor|Guest Services|Usher)\s*$/i
  );
  const roleName = roleMatch ? roleMatch[1].trim() : '';
  const shiftName = roleMatch
    ? assignmentText.slice(0, roleMatch.index).trim()
    : assignmentText;

  return {
    jobName: cleanCscDisplayTitle(jobName),
    venue: cleanCscVenueDisplay(canonicalVenueName(venueMatch.venue)),
    shiftName: cleanCscDisplayTitle(shiftName),
    roleName: cleanCscDisplayTitle(roleName, { stripNumericPrefix: false }),
    startDate: start.date,
    startTime: start.time,
    finishDate: end.date,
    finishTime: end.time,
    emailId: message.id || '',
    emailSubject: message.subject || '',
    emailTimestamp: message.internalDate || 0,
  };
};

const parseCscSchedulingEmailRows = (message = {}) =>
  String(message.body || '')
    .replace(/\r/g, '')
    .replace(/\u00a0/g, ' ')
    .split(/\n\s*\n+/)
    .map((paragraph) => parseCscSchedulingParagraph(paragraph, message))
    .filter(Boolean);

const getCscEmailShiftIdentityKey = (shift = {}) =>
  [canonicalVenueName(shift.venue), normalizeText(shift.jobName || shift.event || shift.shiftName)]
    .filter(Boolean)
    .join('|');

const getCscEmailShiftWindowKey = (shift = {}) =>
  [shift.startDate, shift.startTime, shift.finishDate || shift.startDate, shift.finishTime].join('|');

const buildCscEmailCheckReport = (messages = [], allShifts = readCscShifts()) => {
  const newestRowsByIdentity = new Map();
  const currentDate = todayIso();

  messages.forEach((message) => {
    parseCscSchedulingEmailRows(message).forEach((row) => {
      if (!row.startDate || row.startDate < currentDate) return;
      const identityKey = getCscEmailShiftIdentityKey(row);
      if (!identityKey || newestRowsByIdentity.has(identityKey)) return;
      newestRowsByIdentity.set(identityKey, row);
    });
  });

  const activeLocalShifts = allShifts.filter((shift) => !isCancelledShiftStatus(shift.shiftStatus));
  const newShifts = [];
  const changedShifts = [];
  const wishEssOverrides = [];
  const currentShifts = [];

  Array.from(newestRowsByIdentity.values())
    .sort((first, second) => `${first.startDate}|${first.startTime}|${first.jobName}`.localeCompare(`${second.startDate}|${second.startTime}|${second.jobName}`))
    .forEach((emailShift) => {
      const emailIdentity = normalizeText(emailShift.jobName);
      const sameVenue = activeLocalShifts.filter(
        (shift) => canonicalVenueName(shift.venue) === canonicalVenueName(emailShift.venue)
      );
      const exactIdentityMatches = sameVenue.filter(
        (shift) => normalizeText(shift.jobName || '') === emailIdentity
      );
      const candidatePool = exactIdentityMatches.length
        ? exactIdentityMatches
        : sameVenue
            .map((shift) => ({
              shift,
              score: Math.max(
                getEventIdentityScore(emailShift.jobName, shift.jobName),
                getEventIdentityScore(emailShift.jobName, shift.event),
                getEventIdentityScore(emailShift.jobName, shift.shiftName)
              ),
            }))
            .filter((candidate) => candidate.score >= 0.72)
            .sort((first, second) => second.score - first.score)
            .map((candidate) => candidate.shift);

      const localShift = candidatePool.find((shift) => shift.startDate === emailShift.startDate) || candidatePool[0] || null;
      if (!localShift) {
        newShifts.push(emailShift);
        return;
      }

      const changes = [];
      if (getCscEmailShiftWindowKey(localShift) !== getCscEmailShiftWindowKey(emailShift)) {
        changes.push(
          `Work time: ${formatDate(localShift.startDate)} ${formatTime(localShift.startTime)} to ${formatTime(localShift.finishTime)} -> ${formatDate(emailShift.startDate)} ${formatTime(emailShift.startTime)} to ${formatTime(emailShift.finishTime)}`
        );
      }
      if (
        emailShift.shiftName &&
        localShift.shiftName &&
        normalizeText(emailShift.shiftName) !== normalizeText(localShift.shiftName)
      ) {
        changes.push(`Shift: ${localShift.shiftName} -> ${emailShift.shiftName}`);
      }
      if (
        emailShift.roleName &&
        localShift.roleName &&
        normalizeText(emailShift.roleName) !== normalizeText(localShift.roleName)
      ) {
        changes.push(`Role: ${localShift.roleName} -> ${emailShift.roleName}`);
      }

      if (changes.length) {
        const wishEssConfirmed =
          localShift.scheduleSource === 'wish-ess' &&
          localShift.wishEssStatus === 'confirmed';

        if (wishEssConfirmed) {
          wishEssOverrides.push({
            ...emailShift,
            localShiftId: localShift.id,
            changes,
            authoritativeShift: localShift,
          });
        } else {
          changedShifts.push({ ...emailShift, localShiftId: localShift.id, changes });
        }
      } else {
        currentShifts.push({ ...emailShift, localShiftId: localShift.id });
      }
    });

  return {
    checkedAt: new Date().toISOString(),
    query: CSC_GMAIL_SEARCH_QUERY,
    messagesScanned: messages.length,
    scheduledRowsFound: newestRowsByIdentity.size,
    newShifts,
    changedShifts,
    wishEssOverrides,
    currentShifts,
  };
};

const loadCscEmailCheckReport = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CSC_EMAIL_CHECK_REPORT_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;

    // Older report versions could accidentally save an entire raw HTML email into
    // jobName. Do not render that stale malformed report after this fix. The next
    // Check CSC Email run replaces it with structured plain-text shift fields.
    const reportRows = [
      ...(Array.isArray(parsed.newShifts) ? parsed.newShifts : []),
      ...(Array.isArray(parsed.changedShifts) ? parsed.changedShifts : []),
      ...(Array.isArray(parsed.wishEssOverrides) ? parsed.wishEssOverrides : []),
      ...(Array.isArray(parsed.currentShifts) ? parsed.currentShifts : []),
    ];
    const containsRawHtml = reportRows.some((shift) =>
      [shift?.jobName, shift?.venue, shift?.shiftName, shift?.roleName].some(looksLikeGmailHtml)
    );

    return containsRawHtml ? null : parsed;
  } catch {
    return null;
  }
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
  schedulerPhone: formatPhoneNumber(defaults.schedulerPhone || ''),
  schedulerExtension: defaults.schedulerExtension || '',
  bestCallTime: defaults.bestCallTime || '',
  callFrequency: defaults.callFrequency || 'Daily',
  lastCalledDate: defaults.lastCalledDate || '',
  nextCallDate: defaults.nextCallDate || '',
  nextCallDateSetAt: defaults.nextCallDateSetAt || '',
  status: normalizeOpportunityStatus(defaults.status, defaults.linkedCscShiftId),
  linkedCscShiftId: defaults.linkedCscShiftId || '',
  linkedTodoTaskId: defaults.linkedTodoTaskId || '',
  linkedRideId: defaults.linkedRideId || '',
  googleCalendarEventId: defaults.googleCalendarEventId || '',
  googleCalendarEventLink: defaults.googleCalendarEventLink || '',
  googleCalendarAddedAt: defaults.googleCalendarAddedAt || '',
  notes: defaults.notes || '',
  notesUpdatedAt: defaults.notesUpdatedAt || '',
  venueLogo: getVenueDefinition(defaults.venue || 'Kia Forum')?.logoPath || defaults.venueLogo || '',
  callHistory: Array.isArray(defaults.callHistory) ? defaults.callHistory : [],
  activityLog: Array.isArray(defaults.activityLog) ? defaults.activityLog : [],
  lastScannedAt: defaults.lastScannedAt || '',
  lastVerifiedAt: defaults.lastVerifiedAt || '',
  archivedAt: defaults.archivedAt || '',
  archiveReason: defaults.archiveReason || '',
  eventWatchIdentity: defaults.eventWatchIdentity || '',
  eventWatchAction: defaults.eventWatchAction || '',
  eventWatchBatchId: defaults.eventWatchBatchId || '',
  eventWatchLastVerifiedAt: defaults.eventWatchLastVerifiedAt || '',
  eventWatchSource: defaults.eventWatchSource || '',
  createdAt: defaults.createdAt || new Date().toISOString(),
  updatedAt: defaults.updatedAt || new Date().toISOString(),
});

const createDefaultContacts = () =>
  VENUE_DEFINITIONS.map((definition) => ({
    id: createId('csc-venue-contact'),
    venue: definition.venue,
    schedulerName: definition.schedulerName || '',
    schedulerPhone: formatPhoneNumber(definition.schedulerPhone || ''),
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

const isExpiredOpportunity = (opportunity = {}, currentDate = todayIso()) => {
  const eventDate = String(opportunity.eventDate || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(eventDate) && eventDate < currentDate;
};

const archiveExpiredOpportunities = (items = []) => {
  const opportunities = Array.isArray(items) ? items : [];
  const currentDate = todayIso();
  const expired = opportunities.filter((item) => isExpiredOpportunity(item, currentDate));

  if (!expired.length) return opportunities;

  try {
    const archived = readArray(OPPORTUNITIES_ARCHIVE_STORAGE_KEY, []);
    const archivedById = new Map(
      archived
        .filter((item) => item?.id)
        .map((item) => [item.id, item])
    );
    const archivedAt = new Date().toISOString();

    expired.forEach((item) => {
      const existing = archivedById.get(item.id);
      archivedById.set(item.id, {
        ...item,
        archivedAt: existing?.archivedAt || archivedAt,
        archiveReason: 'Event date passed',
      });
    });

    localStorage.setItem(
      OPPORTUNITIES_ARCHIVE_STORAGE_KEY,
      JSON.stringify(Array.from(archivedById.values()))
    );
  } catch (error) {
    console.error('Failed to archive expired CSC opportunities:', error);
  }

  return opportunities.filter((item) => !isExpiredOpportunity(item, currentDate));
};

const loadOpportunities = () => {
  const dismissedKeys = readDismissedOpportunityKeys();

  return archiveExpiredOpportunities(
    removeExcludedOpportunityRecords(
      readArray(OPPORTUNITIES_STORAGE_KEY, [])
        .map((item) => createBlankOpportunity(item))
        .filter((item) => !isDismissedOpportunity(item, dismissedKeys))
    )
  );
};

const loadArchivedOpportunities = () =>
  removeExcludedOpportunityRecords(
    readArray(OPPORTUNITIES_ARCHIVE_STORAGE_KEY, []).map((item) =>
      createBlankOpportunity(item)
    )
  ).sort((first, second) =>
    String(second.archivedAt || '').localeCompare(String(first.archivedAt || ''))
  );

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
      schedulerPhone: formatPhoneNumber(storedContact.schedulerPhone || contact.schedulerPhone),
      schedulerExtension: storedContact.schedulerExtension || contact.schedulerExtension,
      eventUrl: storedContact.eventUrl || contact.eventUrl,
      venueLogo: contact.venueLogo || storedContact.venueLogo || '',
    };
  });
};

const writeOpportunitySnapshot = (label, opportunities, contacts, archivedOpportunities = []) => {
  try {
    localStorage.setItem(
      OPPORTUNITIES_SNAPSHOT_STORAGE_KEY,
      JSON.stringify({
        id: createId('csc-opportunity-snapshot'),
        label,
        createdAt: new Date().toISOString(),
        opportunities,
        archivedOpportunities,
        contacts,
      })
    );
    return true;
  } catch (error) {
    console.error('Failed to save CSC opportunities safety snapshot:', error);
    return false;
  }
};


const opportunityBaseKey = (opportunity = {}) =>
  [canonicalVenueName(opportunity.venue), opportunity.eventDate, normalizeText(opportunity.eventName)].join('|');

const opportunityKey = (opportunity = {}) =>
  [opportunityBaseKey(opportunity), String(opportunity.eventTime || '').trim()].join('|');

const normalizeOpportunityEventIdentity = (value = '') =>
  normalizeText(value)
    .replace(/\b(?:and|amp)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getOpportunityEventIdentityTokens = (value = '') =>
  normalizeOpportunityEventIdentity(value).split(' ').filter(Boolean);

const opportunityEventNamesMatch = (firstValue = '', secondValue = '') => {
  const first = normalizeOpportunityEventIdentity(firstValue);
  const second = normalizeOpportunityEventIdentity(secondValue);

  if (!first || !second) return false;
  if (first === second) return true;

  const firstTokens = getOpportunityEventIdentityTokens(first);
  const secondTokens = getOpportunityEventIdentityTokens(second);
  const shorter =
    firstTokens.length <= secondTokens.length ? firstTokens : secondTokens;
  const longer =
    firstTokens.length <= secondTokens.length ? secondTokens : firstTokens;

  // Venue feeds often expand a short headliner label into the full public title.
  // Example: "Chicago / Styx" and
  // "Chicago & Styx - The Windy Cities Tour - All the Hits... Your Kind of Tour".
  // Treat that as one event only when the shorter identity has at least two
  // meaningful tokens and appears as the opening identity of the longer title.
  if (
    shorter.length >= 2 &&
    shorter.every((token, index) => longer[index] === token)
  ) {
    return true;
  }

  return false;
};

const opportunityEventTimesCompatible = (firstValue = '', secondValue = '') => {
  const first = String(firstValue || '').trim();
  const second = String(secondValue || '').trim();

  if (!first || !second || first === second) return true;

  const toMinutes = (value = '') => {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (
      !Number.isFinite(hours) ||
      !Number.isFinite(minutes) ||
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59
    ) {
      return null;
    }

    return hours * 60 + minutes;
  };

  const firstMinutes = toMinutes(first);
  const secondMinutes = toMinutes(second);
  if (firstMinutes === null || secondMinutes === null) return false;

  /*
   * A CSC shift call time and the public venue event time are often different.
   * Treat same-event records within three hours as compatible so a 5:00 PM CSC
   * shift and a 6:00 PM public event do not become duplicate opportunities.
   * Larger gaps remain separate to protect legitimate same-day multiple shows.
   */
  const directDifference = Math.abs(firstMinutes - secondMinutes);
  const wrappedDifference = 24 * 60 - directDifference;
  return Math.min(directDifference, wrappedDifference) <= 180;
};

const areLikelyDuplicateOpportunities = (first = {}, second = {}) => {
  if (!first || !second) return false;

  return (
    canonicalVenueName(first.venue) === canonicalVenueName(second.venue) &&
    Boolean(first.eventDate) &&
    String(first.eventDate || '') === String(second.eventDate || '') &&
    opportunityEventTimesCompatible(first.eventTime, second.eventTime) &&
    opportunityEventNamesMatch(first.eventName, second.eventName)
  );
};

const getOpportunityRecordPriority = (opportunity = {}) => {
  let score = 0;

  if (opportunity.linkedCscShiftId) score += 10000;
  if (normalizeOpportunityStatus(opportunity.status, opportunity.linkedCscShiftId) === 'Scheduled') {
    score += 5000;
  }
  if (opportunity.eventWatchIdentity) score += 500;
  if (opportunity.eventTime) score += 100;
  if (opportunity.googleCalendarEventId || opportunity.googleCalendarEventLink) score += 80;
  if (opportunity.linkedTodoTaskId) score += 60;
  if (opportunity.linkedRideId) score += 60;
  if (opportunity.notes) score += 20;

  return score;
};

const getMoreDescriptiveOpportunityName = (firstValue = '', secondValue = '') => {
  const first = String(firstValue || '').trim();
  const second = String(secondValue || '').trim();

  if (!first) return second;
  if (!second) return first;
  if (!opportunityEventNamesMatch(first, second)) return first;

  const firstTokens = getOpportunityEventIdentityTokens(first);
  const secondTokens = getOpportunityEventIdentityTokens(second);

  if (secondTokens.length > firstTokens.length) return second;
  if (firstTokens.length > secondTokens.length) return first;

  return second.length > first.length ? second : first;
};

const mergeOpportunityLogEntries = (first = [], second = []) => {
  const byKey = new Map();

  [...first, ...second].forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;

    const key =
      String(entry.id || '').trim() ||
      [
        entry.action,
        entry.detail,
        entry.createdAt,
        index,
      ]
        .map((value) => String(value || '').trim())
        .join('|');

    if (!byKey.has(key)) byKey.set(key, entry);
  });

  return Array.from(byKey.values()).sort((firstEntry, secondEntry) =>
    String(secondEntry.createdAt || '').localeCompare(
      String(firstEntry.createdAt || '')
    )
  );
};

const mergeDuplicateOpportunityRecords = (first = {}, second = {}) => {
  const firstPriority = getOpportunityRecordPriority(first);
  const secondPriority = getOpportunityRecordPriority(second);
  const primary = secondPriority > firstPriority ? second : first;
  const secondary = primary === first ? second : first;
  const eventName = getMoreDescriptiveOpportunityName(
    primary.eventName,
    secondary.eventName
  );

  return createBlankOpportunity({
    ...secondary,
    ...primary,
    id: primary.id || secondary.id,
    eventName,
    venue: canonicalVenueName(primary.venue || secondary.venue),
    eventDate: primary.eventDate || secondary.eventDate,
    eventTime:
      secondary.eventUrl && secondary.eventTime
        ? secondary.eventTime
        : primary.eventUrl && primary.eventTime
          ? primary.eventTime
          : primary.eventTime || secondary.eventTime,
    expectedEndTime: primary.expectedEndTime || secondary.expectedEndTime,
    eventUrl: secondary.eventUrl || primary.eventUrl,
    sourceText:
      String(secondary.sourceText || '').length >
      String(primary.sourceText || '').length
        ? secondary.sourceText
        : primary.sourceText,
    schedulerName: primary.schedulerName || secondary.schedulerName,
    schedulerPhone: primary.schedulerPhone || secondary.schedulerPhone,
    schedulerExtension:
      primary.schedulerExtension || secondary.schedulerExtension,
    bestCallTime: primary.bestCallTime || secondary.bestCallTime,
    callFrequency: primary.callFrequency || secondary.callFrequency,
    lastCalledDate: primary.lastCalledDate || secondary.lastCalledDate,
    nextCallDate: primary.nextCallDate || secondary.nextCallDate,
    linkedCscShiftId:
      primary.linkedCscShiftId || secondary.linkedCscShiftId,
    linkedTodoTaskId:
      primary.linkedTodoTaskId || secondary.linkedTodoTaskId,
    linkedRideId: primary.linkedRideId || secondary.linkedRideId,
    googleCalendarEventId:
      primary.googleCalendarEventId || secondary.googleCalendarEventId,
    googleCalendarEventLink:
      primary.googleCalendarEventLink || secondary.googleCalendarEventLink,
    googleCalendarAddedAt:
      primary.googleCalendarAddedAt || secondary.googleCalendarAddedAt,
    notes: primary.notes || secondary.notes,
    notesUpdatedAt:
      primary.notesUpdatedAt || secondary.notesUpdatedAt,
    venueLogo: primary.venueLogo || secondary.venueLogo,
    callHistory: mergeOpportunityLogEntries(
      primary.callHistory,
      secondary.callHistory
    ),
    activityLog: mergeOpportunityLogEntries(
      primary.activityLog,
      secondary.activityLog
    ),
    lastScannedAt:
      [primary.lastScannedAt, secondary.lastScannedAt]
        .filter(Boolean)
        .sort()
        .pop() || '',
    lastVerifiedAt:
      [primary.lastVerifiedAt, secondary.lastVerifiedAt]
        .filter(Boolean)
        .sort()
        .pop() || '',
    eventWatchIdentity:
      primary.eventWatchIdentity || secondary.eventWatchIdentity,
    eventWatchAction:
      primary.eventWatchAction || secondary.eventWatchAction,
    eventWatchBatchId:
      primary.eventWatchBatchId || secondary.eventWatchBatchId,
    eventWatchLastVerifiedAt:
      [primary.eventWatchLastVerifiedAt, secondary.eventWatchLastVerifiedAt]
        .filter(Boolean)
        .sort()
        .pop() || '',
    eventWatchSource:
      primary.eventWatchSource || secondary.eventWatchSource,
    createdAt:
      [primary.createdAt, secondary.createdAt]
        .filter(Boolean)
        .sort()[0] ||
      primary.createdAt ||
      secondary.createdAt,
    updatedAt: new Date().toISOString(),
  });
};

const getExplicitOpportunityShiftForDedupe = (
  opportunity = {},
  allShifts = []
) =>
  allShifts.find(
    (shift) =>
      shift?.id &&
      !isCancelledShiftStatus(shift.shiftStatus) &&
      (
        (opportunity.linkedCscShiftId &&
          shift.id === opportunity.linkedCscShiftId) ||
        (opportunity.id &&
          (shift.createdFromOpportunityId === opportunity.id ||
            shift.linkedOpportunityId === opportunity.id))
      )
  ) || null;

const getOpportunityShiftForDedupe = (
  opportunity = {},
  allShifts = readCscShifts()
) => {
  const explicitShift = getExplicitOpportunityShiftForDedupe(
    opportunity,
    allShifts
  );
  if (explicitShift) return explicitShift;

  const matchResult = getMatchingCscShiftResult(opportunity, allShifts);
  return matchResult.match || null;
};

const getOpportunityShiftAuthorityScore = (
  opportunity = {},
  shift = {}
) => {
  let score = getOpportunityShiftEventScore(opportunity, shift) * 100;

  if (opportunity.linkedCscShiftId === shift.id) score += 1000;
  if (
    opportunity.id &&
    (shift.createdFromOpportunityId === opportunity.id ||
      shift.linkedOpportunityId === opportunity.id)
  ) {
    score += 1000;
  }
  if (
    opportunity.eventDate === shift.startDate &&
    opportunity.eventTime &&
    opportunity.eventTime === shift.startTime
  ) {
    score += 500;
  }
  if (
    normalizeText(opportunity.eventName) ===
    normalizeText(getShiftOpportunityEventName(shift))
  ) {
    score += 250;
  }

  return score;
};

const mergeDuplicateOpportunitiesUsingCscShift = (
  first = {},
  second = {},
  shift = {}
) => {
  const firstScore = getOpportunityShiftAuthorityScore(first, shift);
  const secondScore = getOpportunityShiftAuthorityScore(second, shift);
  const primary = secondScore > firstScore ? second : first;
  const secondary = primary === first ? second : first;
  const merged = mergeDuplicateOpportunityRecords(primary, secondary);
  const shiftEventName = getShiftOpportunityEventName(shift);

  return createBlankOpportunity({
    ...merged,
    id: primary.id || merged.id,
    eventName: shiftEventName || merged.eventName,
    venue: canonicalVenueName(shift.venue || merged.venue),
    eventDate: shift.startDate || merged.eventDate,
    eventTime: shift.startTime || merged.eventTime,
    expectedEndTime:
      !shift.finishDate || shift.finishDate === shift.startDate
        ? shift.finishTime || merged.expectedEndTime
        : '',
    linkedCscShiftId: shift.id || merged.linkedCscShiftId,
    status: getOpportunityStatusFromLinkedShift(shift),
    lastVerifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
};

const getSharedCscShiftForOpportunityDuplicates = (
  first = {},
  second = {},
  allShifts = readCscShifts()
) => {
  if (
    !first ||
    !second ||
    !first.eventDate ||
    first.eventDate !== second.eventDate ||
    canonicalVenueName(first.venue) !== canonicalVenueName(second.venue)
  ) {
    return null;
  }

  const firstShift = getOpportunityShiftForDedupe(first, allShifts);
  const secondShift = getOpportunityShiftForDedupe(second, allShifts);

  if (!firstShift?.id || firstShift.id !== secondShift?.id) return null;

  const firstEventScore = getOpportunityShiftEventScore(first, firstShift);
  const secondEventScore = getOpportunityShiftEventScore(second, firstShift);

  /*
   * CSC Shifts is the authoritative tie-breaker only when both opportunity
   * records independently look like the same scheduled job. This prevents a
   * weak same-day venue match from collapsing two genuinely different events.
   */
  if (firstEventScore < 0.45 || secondEventScore < 0.45) return null;

  return firstShift;
};

const dedupeOpportunityRecords = (
  items = [],
  allShifts = readCscShifts()
) => {
  const deduped = [];
  let removedCount = 0;

  (Array.isArray(items) ? items : []).forEach((rawItem) => {
    const item = createBlankOpportunity(rawItem);
    let duplicateIndex = -1;
    let sharedShift = null;

    for (let index = 0; index < deduped.length; index += 1) {
      const candidate = deduped[index];

      if (areLikelyDuplicateOpportunities(candidate, item)) {
        duplicateIndex = index;
        break;
      }

      const candidateSharedShift =
        getSharedCscShiftForOpportunityDuplicates(
          candidate,
          item,
          allShifts
        );

      if (candidateSharedShift) {
        duplicateIndex = index;
        sharedShift = candidateSharedShift;
        break;
      }
    }

    if (duplicateIndex < 0) {
      deduped.push(item);
      return;
    }

    deduped[duplicateIndex] = sharedShift
      ? mergeDuplicateOpportunitiesUsingCscShift(
          deduped[duplicateIndex],
          item,
          sharedShift
        )
      : mergeDuplicateOpportunityRecords(
          deduped[duplicateIndex],
          item
        );

    removedCount += 1;
  });

  return { opportunities: deduped, removedCount };
};

const loadDedupedOpportunities = () => {
  const loaded = loadOpportunities();
  const result = dedupeOpportunityRecords(loaded);

  if (result.removedCount > 0) {
    try {
      localStorage.setItem(
        OPPORTUNITIES_DEDUPE_BACKUP_STORAGE_KEY,
        JSON.stringify({
          createdAt: new Date().toISOString(),
          reason: 'Before automatic CSC opportunity duplicate merge',
          opportunities: loaded,
        })
      );
    } catch (error) {
      console.error('Failed to save CSC opportunity dedupe recovery backup:', error);
    }
  }

  return result.opportunities;
};

const normalizeEventWatchAction = (value = '') => {
  const normalized = normalizeText(value);
  if (normalized === 'rescheduled' || normalized === 'reschedule') return 'rescheduled';
  if (normalized === 'cancelled' || normalized === 'canceled' || normalized === 'cancel') {
    return 'cancelled';
  }
  return 'new';
};

const normalizeEventWatchFeedItem = (item = {}) => ({
  action: normalizeEventWatchAction(item.action),
  venue: canonicalVenueName(item.venue || ''),
  eventName: String(item.eventName || item.event || item.title || '').trim(),
  eventDate: String(item.eventDate || item.date || '').trim(),
  eventTime: String(item.eventTime || item.time || '').trim(),
  previousDate: String(item.previousDate || '').trim(),
  previousTime: String(item.previousTime || '').trim(),
  officialStatus: String(item.officialStatus || '').trim(),
  officialUrl: String(item.officialUrl || item.eventUrl || '').trim(),
  identity: String(item.identity || '').trim(),
  firstSeenAt: String(item.firstSeenAt || '').trim(),
  lastVerifiedAt: String(item.lastVerifiedAt || '').trim(),
  batchId: String(item.batchId || '').trim(),
});

const getEventWatchMeaningfulChanges = (existing = {}, nextCandidate = {}) => {
  const changes = [];

  const addChange = (label, beforeValue, afterValue, formatter = (value) => String(value || '')) => {
    const before = String(beforeValue || '').trim();
    const after = String(afterValue || '').trim();

    if (before === after) return;

    changes.push(
      `${label}: ${before ? formatter(before) : 'Not set'} -> ${after ? formatter(after) : 'Not set'}`
    );
  };

  addChange('Event', existing.eventName, nextCandidate.eventName);
  addChange(
    'Venue',
    canonicalVenueName(existing.venue),
    canonicalVenueName(nextCandidate.venue)
  );
  addChange('Date', existing.eventDate, nextCandidate.eventDate, formatDate);
  addChange('Time', existing.eventTime, nextCandidate.eventTime, formatTime);
  addChange('Event URL', existing.eventUrl, nextCandidate.eventUrl);
  addChange(
    'Status',
    normalizeOpportunityStatus(existing.status, existing.linkedCscShiftId),
    normalizeOpportunityStatus(nextCandidate.status, nextCandidate.linkedCscShiftId)
  );

  return changes;
};

const formatEventWatchChangeDetail = (opportunity = {}, changes = []) =>
  `${canonicalVenueName(opportunity.venue) || 'Venue not entered'} - ${
    opportunity.eventName || 'Event name not entered'
  }: ${changes.join('; ')}`;

const isValidEventWatchFeedItem = (item = {}) =>
  Boolean(item.eventName && item.venue);

const getEventWatchMatchIndex = (items = [], feedItem = {}) => {
  const normalizedName = normalizeText(feedItem.eventName);
  const canonicalVenue = canonicalVenueName(feedItem.venue);

  const identityIndex = feedItem.identity
    ? items.findIndex(
        (candidate) =>
          String(candidate.eventWatchIdentity || '').trim() === feedItem.identity
      )
    : -1;
  if (identityIndex >= 0) return identityIndex;

  const sameCurrentEventIndex = items.findIndex((candidate) =>
    areLikelyDuplicateOpportunities(candidate, feedItem)
  );
  if (sameCurrentEventIndex >= 0) return sameCurrentEventIndex;

  if (feedItem.previousDate) {
    const previousEventIndex = items.findIndex((candidate) =>
      areLikelyDuplicateOpportunities(candidate, {
        ...feedItem,
        eventDate: feedItem.previousDate,
        eventTime: feedItem.previousTime,
      })
    );
    if (previousEventIndex >= 0) return previousEventIndex;
  }

  if (feedItem.action === 'new' || !feedItem.officialUrl) return -1;

  const urlMatches = items
    .map((candidate, index) => ({ candidate, index }))
    .filter(
      ({ candidate }) =>
        String(candidate.eventUrl || '').trim() === feedItem.officialUrl &&
        canonicalVenueName(candidate.venue) === canonicalVenue &&
        normalizeText(candidate.eventName) === normalizedName
    );

  return urlMatches.length === 1 ? urlMatches[0].index : -1;
};

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

  return dedupeScannedOpportunities(parsed);
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

  // Carbonhouse venue pages now place the date before the event title. Keep the
  // older "More Info for" parser above, then also accept the current date-first layout.
  for (let index = 0; index < lines.length; index += 1) {
    const dateDetails = parseSofiDateTimeLine(lines[index]);
    if (!dateDetails) continue;

    let nextDateIndex = lines.length;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (parseSofiDateTimeLine(lines[cursor])) {
        nextDateIndex = cursor;
        break;
      }
    }

    const blockLines = lines.slice(index + 1, nextDateIndex);
    const titleLines = blockLines
      .map((line) => sanitizeScannedLine(line).replace(/^More Info for\s+/i, ''))
      .filter((line) => {
        const normalized = normalizeText(line);
        if (!normalized || /^https?:\/\//i.test(line)) return false;
        if (isSofiScannerNoiseLine(line)) return false;
        return !/^(on sale now|preseason|more info|suites|parking|all upcoming events|all event types|concerts|football|tours|list grid calendar)$/.test(
          normalized
        );
      });

    const eventTitle = titleLines[0] || '';
    const subtitle = titleLines.slice(1).find(
      (line) => normalizeText(line) !== normalizeText(eventTitle)
    );
    if (!eventTitle) continue;

    parsed.push(
      createBlankOpportunity({
        eventName: subtitle ? `${eventTitle} - ${subtitle}` : eventTitle,
        venue: 'SoFi Stadium',
        eventDate: dateDetails.eventDate,
        eventTime: dateDetails.eventTime,
        sourceText: [lines[index], ...blockLines].join('\n'),
        eventUrl: sourceUrl || SOFI_STADIUM_EVENTS_URL,
        status: 'New',
      })
    );
  }

  return dedupeScannedOpportunities(
    parsed.filter((item) => !isExcludedOpportunityEvent(item))
  );
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
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(20\d{2})(?:\s*[\/|•·–—-]\s*(.+))?$/i
  );

  if (!match) return null;

  const month = ROSE_BOWL_MONTH_INDEX[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3]);
  const trailingText = sanitizeScannedLine(match[4] || '');
  const listedTimes = trailingText
    .split(/\s*(?:,|\/|\||•|·)\s*/)
    .map((value) => sanitizeScannedLine(value))
    .filter((value) => Boolean(parseRoseBowlTime(value)));
  const inlineEventName = sanitizeScannedLine(
    trailingText
      .replace(/\b\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b(?:\s*,\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)\b)*/gi, '')
      .replace(/^[\/|•·–—-]+|[\/|•·–—-]+$/g, '')
  );

  if (!month || !day || day > 31 || !year) return null;

  return {
    eventDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    eventTime: parseRoseBowlTime(listedTimes[0] || ''),
    listedTimes,
    inlineEventName,
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
    const eventName = dateDetails.inlineEventName || eventBlock[0] || '';

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
    /^(?:Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat)\.?\s*(?:\/|,)?\s*([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s*(20\d{2}))?(?:\s*(?:-|–|—|\/|\|)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)))?$/i
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
    eventTime: parseHollywoodBowlTime(match[4] || ''),
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
    let eventTime = dateDetails.eventTime || '';

    for (let cursor = index + 1; !eventTime && cursor < lines.length; cursor += 1) {
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


const SHRINE_DEFAULT_SCAN_YEAR = 2026;

const SHRINE_MONTH_INDEX = {
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

const parseShrineTime = (value = '') => {
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

const isShrineWeekdayLine = (value = '') =>
  /^(Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat)$/i.test(sanitizeScannedLine(value));

const parseShrineDateLine = (line = '', fallbackYear = SHRINE_DEFAULT_SCAN_YEAR) => {
  const cleaned = sanitizeScannedLine(line);
  const match = cleaned.match(
    /^(?:(?:Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat)\s+)?([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s*(20\d{2}))?$/i
  );

  if (!match) return null;

  const month = SHRINE_MONTH_INDEX[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3] || fallbackYear || SHRINE_DEFAULT_SCAN_YEAR);

  if (!month || !day || day > 31 || !year) return null;

  return {
    eventDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    year,
  };
};

const parseShrineInlineEventLine = (line = '', fallbackYear = SHRINE_DEFAULT_SCAN_YEAR) => {
  const cleaned = sanitizeScannedLine(line);
  const match = cleaned.match(
    /^(?:(?:Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat)\.?,?\s*)?([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s*(20\d{2}))?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s+(.+)$/i
  );

  if (!match) return null;

  const month = SHRINE_MONTH_INDEX[match[1].toLowerCase()];
  const day = Number(match[2]);
  const year = Number(match[3] || fallbackYear || SHRINE_DEFAULT_SCAN_YEAR);
  const eventTime = parseShrineTime(match[4]);
  const eventName = sanitizeScannedLine(match[5]);

  if (!month || !day || day > 31 || !year || !eventName) return null;

  return {
    eventName,
    eventDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    eventTime,
    sourceText: cleaned,
  };
};

const parseShrineEmbeddedEventLine = (line = '', fallbackYear = SHRINE_DEFAULT_SCAN_YEAR) => {
  const cleaned = sanitizeScannedLine(line);
  const match = cleaned.match(
    /^(.+?)\s+(?:Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat)\.?,?\s*([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,?\s*(20\d{2}))?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\.?$/i
  );

  if (!match) return null;

  const month = SHRINE_MONTH_INDEX[match[2].toLowerCase()];
  const day = Number(match[3]);
  const year = Number(match[4] || fallbackYear || SHRINE_DEFAULT_SCAN_YEAR);
  const eventTime = parseShrineTime(match[5]);
  const eventName = sanitizeScannedLine(match[1]);

  if (!month || !day || day > 31 || !year || !eventName) return null;

  return {
    eventName,
    eventDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    eventTime,
    sourceText: cleaned,
  };
};

const isShrineScannerNoiseLine = (value = '') => {
  const cleaned = sanitizeScannedLine(value);
  const line = normalizeText(cleaned);

  if (!line) return true;
  if (isShrineWeekdayLine(cleaned)) return true;
  if (/^https?:\/\//i.test(cleaned)) return true;
  if (/^\d+\s+tickets?\s+left$/i.test(cleaned)) return true;
  if (/^lowest\s+price$/i.test(cleaned)) return true;

  return /^(tickets|ticket|buy tickets|more info|info|learn more|view details|event details|event info|all events|upcoming events|events|shrine auditorium and expo hall los angeles los angeles ca|shrine auditorium expo hall los angeles los angeles ca)$/.test(
    line
  );
};

const parseShrineEvents = (text = '', sourceUrl = SHRINE_EVENTS_URL) => {
  const lines = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(sanitizeScannedLine)
    .filter(Boolean);

  const parsed = [];
  let currentYear = SHRINE_DEFAULT_SCAN_YEAR;

  for (let index = 0; index < lines.length; index += 1) {
    const inlineEvent =
      parseShrineInlineEventLine(lines[index], currentYear) ||
      parseShrineEmbeddedEventLine(lines[index], currentYear);

    if (inlineEvent && !isShrineScannerNoiseLine(inlineEvent.eventName)) {
      parsed.push(
        createBlankOpportunity({
          eventName: inlineEvent.eventName,
          venue: 'The Shrine',
          eventDate: inlineEvent.eventDate,
          eventTime: inlineEvent.eventTime,
          sourceText: inlineEvent.sourceText,
          eventUrl: sourceUrl || SHRINE_EVENTS_URL,
          status: 'New',
        })
      );
      currentYear = Number(inlineEvent.eventDate.slice(0, 4)) || currentYear;
      continue;
    }

    const dateDetails = parseShrineDateLine(lines[index], currentYear);

    if (!dateDetails) continue;

    currentYear = dateDetails.year;

    let eventTime = '';
    let eventName = '';
    let eventLine = '';
    let cursor = index + 1;

    while (cursor < lines.length) {
      const candidate = lines[cursor];

      if (parseShrineDateLine(candidate, currentYear) || parseShrineInlineEventLine(candidate, currentYear)) break;

      const parsedTime = parseShrineTime(candidate);
      if (parsedTime && !eventTime) {
        eventTime = parsedTime;
        cursor += 1;
        continue;
      }

      if (!isShrineScannerNoiseLine(candidate) && !parseShrineTime(candidate) && !eventName) {
        eventName = candidate;
        eventLine = candidate;
      }

      if (eventName) break;
      cursor += 1;
    }

    if (!eventName) continue;

    parsed.push(
      createBlankOpportunity({
        eventName,
        venue: 'The Shrine',
        eventDate: dateDetails.eventDate,
        eventTime,
        sourceText: [lines[index], eventTime ? formatTime(eventTime) : '', eventLine].filter(Boolean).join('\n'),
        eventUrl: sourceUrl || SHRINE_EVENTS_URL,
        status: 'New',
      })
    );
  }

  const byKey = new Map();
  parsed.forEach((item) => byKey.set(opportunityKey(item), item));
  return Array.from(byKey.values());
};

const getVenueScannerLines = (text = '') =>
  String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map(sanitizeScannedLine)
    .filter(Boolean);

const parseVenueScannerTime = (value = '') => {
  const cleaned = sanitizeScannedLine(value).replace(/\./g, '').trim();
  const match = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);

  if (!match) return '';

  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3].toUpperCase();

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return '';
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (meridiem === 'PM' && hours !== 12) hours += 12;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const createVenueScannerDate = (monthName = '', dayValue = '', yearValue = '') => {
  const month = SHRINE_MONTH_INDEX[String(monthName || '').replace(/\./g, '').toLowerCase()];
  const day = Number(dayValue);
  const year = Number(yearValue);

  if (!month || !day || day > 31 || !year) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const inferVenueScannerYear = (monthName = '', explicitYear = '') => {
  const parsedExplicitYear = Number(explicitYear || 0);
  if (parsedExplicitYear) return parsedExplicitYear;

  const month = SHRINE_MONTH_INDEX[String(monthName || '').replace(/\./g, '').toLowerCase()];
  const now = new Date();
  if (!month) return now.getFullYear();
  return month < now.getMonth() + 1 ? now.getFullYear() + 1 : now.getFullYear();
};

const dedupeScannedOpportunities = (items = []) =>
  dedupeOpportunityRecords(items).opportunities;

const parseNovoDateTimeLine = (line = '') => {
  const cleaned = sanitizeScannedLine(line);
  const match = cleaned.match(
    /^(?:Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat)\.?,\s*([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s*(20\d{2})(?:\s+(?:Show|Doors?)\s*:?\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)))?$/i
  );

  if (!match) return null;

  const eventDate = createVenueScannerDate(match[1], match[2], match[3]);
  if (!eventDate) return null;

  return {
    eventDate,
    eventTime: parseVenueScannerTime(match[4] || ''),
  };
};

const isNovoScannerNoiseLine = (value = '') => {
  const cleaned = sanitizeScannedLine(value);
  const normalized = normalizeText(cleaned);

  if (!normalized) return true;
  if (/^(with|featuring)\b/i.test(cleaned)) return true;
  if (/\bpresents?:?$/i.test(cleaned)) return true;
  if (/\btour(?:\s+\d{4})?$/i.test(cleaned)) return true;

  return /^(calendar of events|calendar|events|upcoming shows|view all|buy tickets|load more events|ticketed by axs com|the novo|calendar partners suppliers|box office|about the novo|venue info|careers|extras|contact us)$/.test(
    normalized
  );
};

const parseNovoEvents = (text = '', sourceUrl = NOVO_THEATER_EVENTS_URL) => {
  const lines = getVenueScannerLines(text);
  const parsed = [];

  for (let index = 0; index < lines.length; index += 1) {
    const dateDetails = parseNovoDateTimeLine(lines[index]);
    if (!dateDetails) continue;

    let blockStart = index - 1;

    while (
      blockStart >= 0 &&
      !parseNovoDateTimeLine(lines[blockStart]) &&
      !/^buy tickets$/i.test(lines[blockStart])
    ) {
      blockStart -= 1;
    }

    const titleCandidates = lines
      .slice(blockStart + 1, index)
      .filter((line) => !isNovoScannerNoiseLine(line) && !/^https?:\/\//i.test(line));
    const eventName = titleCandidates[titleCandidates.length - 1] || '';

    if (!eventName) continue;

    parsed.push(
      createBlankOpportunity({
        eventName,
        venue: 'Novo Theater',
        eventDate: dateDetails.eventDate,
        eventTime: dateDetails.eventTime,
        sourceText: [...lines.slice(blockStart + 1, index), lines[index]].join('\n'),
        eventUrl: sourceUrl || NOVO_THEATER_EVENTS_URL,
        status: 'New',
      })
    );
  }

  return dedupeScannedOpportunities(parsed);
};

const parseLongBeachAmphitheaterDateLine = (line = '') => {
  const cleaned = sanitizeScannedLine(line);
  const detailedMatch = cleaned.match(
    /^(?:(?:Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat)\.?,?\s*)?([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(20\d{2})(?:\s*[\/|•·–—-]\s*(?:(?:Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat)\.?,?\s*)?(\d{1,2}(?::\d{2})?\s*(?:AM|PM)))?$/i
  );

  if (detailedMatch) {
    const eventDate = createVenueScannerDate(
      detailedMatch[1],
      detailedMatch[2],
      detailedMatch[3]
    );

    if (!eventDate) return null;

    return {
      eventDate,
      eventTime: parseVenueScannerTime(detailedMatch[4] || ''),
      isDetailed: true,
    };
  }

  const shortMatch = cleaned.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:,\s*(20\d{2}))?$/i);
  if (!shortMatch) return null;

  const year = inferVenueScannerYear(shortMatch[1], shortMatch[3]);
  const eventDate = createVenueScannerDate(shortMatch[1], shortMatch[2], year);
  if (!eventDate) return null;

  return {
    eventDate,
    eventTime: '',
    isDetailed: false,
  };
};

const parseLongBeachAmphitheaterDateAt = (lines = [], index = 0) => {
  const inlineDate = parseLongBeachAmphitheaterDateLine(lines[index]);

  if (inlineDate) {
    return {
      ...inlineDate,
      lineCount: 1,
    };
  }

  const monthLine = sanitizeScannedLine(lines[index]);
  const monthMatch = monthLine.match(
    /^(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\.?$/i
  );
  const dayLine = sanitizeScannedLine(lines[index + 1]);
  const dayMatch = dayLine.match(/^(\d{1,2})(?:,?\s*(20\d{2}))?$/);

  if (!monthMatch || !dayMatch) return null;

  const year = inferVenueScannerYear(monthMatch[1], dayMatch[2]);
  const eventDate = createVenueScannerDate(monthMatch[1], dayMatch[1], year);
  if (!eventDate) return null;

  return {
    eventDate,
    eventTime: '',
    isDetailed: false,
    lineCount: 2,
  };
};

const parseLongBeachAmphitheaterTimeLine = (line = '') => {
  const cleaned = sanitizeScannedLine(line);
  if (
    !/^(?:(?:Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat)\.?\s+)?\d{1,2}(?::\d{2})?\s*(?:AM|PM)$/i.test(
      cleaned
    )
  ) {
    return '';
  }

  return parseVenueScannerTime(cleaned);
};

const isLongBeachAmphitheaterScannerNoiseLine = (value = '') => {
  const cleaned = sanitizeScannedLine(value);
  const normalized = normalizeText(cleaned);

  if (!normalized) return true;
  if (/^(with|featuring)\b/i.test(cleaned)) return true;
  if (/^image\b/i.test(cleaned)) return true;
  if (parseLongBeachAmphitheaterTimeLine(cleaned)) return true;

  return /^(events tickets|events and tickets|featured events|upcoming events|all events|buy tickets|premium|buy tickets premium|parking|venue info|f m bank amphitheater|search|sign up|private events|premium experiences|about us|partner with us|contact us|careers)$/.test(
    normalized
  );
};

const parseLongBeachAmphitheaterEvents = (
  text = '',
  sourceUrl = LONG_BEACH_AMPHITHEATER_EVENTS_URL
) => {
  const lines = getVenueScannerLines(text);
  const parsed = [];

  for (let index = 0; index < lines.length; index += 1) {
    const dateDetails = parseLongBeachAmphitheaterDateAt(lines, index);
    if (!dateDetails) continue;

    const contentStartIndex = index + dateDetails.lineCount;
    let nextDateIndex = lines.length;
    for (let cursor = contentStartIndex; cursor < lines.length; cursor += 1) {
      if (parseLongBeachAmphitheaterDateAt(lines, cursor)) {
        nextDateIndex = cursor;
        break;
      }
    }

    let eventName = '';
    let eventTime = dateDetails.eventTime;
    let sourceLines = [];

    if (dateDetails.isDetailed) {
      let blockStart = index - 1;
      while (
        blockStart >= 0 &&
        !parseLongBeachAmphitheaterDateLine(lines[blockStart]) &&
        !/^(?:buy tickets|buy tickets premium)$/i.test(lines[blockStart])
      ) {
        blockStart -= 1;
      }

      const candidates = lines
        .slice(blockStart + 1, index)
        .filter(
          (line) =>
            !isLongBeachAmphitheaterScannerNoiseLine(line) && !/^https?:\/\//i.test(line)
        );
      eventName = candidates[candidates.length - 1] || '';
      sourceLines = [...lines.slice(blockStart + 1, index), lines[index]];
    } else {
      const blockLines = lines.slice(contentStartIndex, nextDateIndex);
      eventName =
        blockLines.find(
          (line) =>
            !isLongBeachAmphitheaterScannerNoiseLine(line) &&
            !parseLongBeachAmphitheaterDateLine(line) &&
            !/^https?:\/\//i.test(line)
        ) || '';
      eventTime =
        blockLines.map(parseLongBeachAmphitheaterTimeLine).find(Boolean) || eventTime;
      const uniqueBlockLines = blockLines.filter(
        (line, lineIndex) =>
          lineIndex === 0 ||
          normalizeText(line) !== normalizeText(blockLines[lineIndex - 1])
      );
      sourceLines = [
        ...lines.slice(index, contentStartIndex),
        ...uniqueBlockLines,
      ];
    }

    if (!eventName) continue;

    const supportingActs = sourceLines.filter((line) =>
      /^(with|featuring)\b/i.test(sanitizeScannedLine(line))
    );

    parsed.push(
      createBlankOpportunity({
        eventName,
        venue: 'Long Beach Amphitheater',
        eventDate: dateDetails.eventDate,
        eventTime,
        sourceText: sourceLines.join('\n'),
        eventUrl: sourceUrl || LONG_BEACH_AMPHITHEATER_EVENTS_URL,
        status: 'New',
        notes: supportingActs.join('\n'),
      })
    );
  }

  return dedupeScannedOpportunities(parsed);
};

const parseLongBeachConventionCenterDateLine = (line = '') => {
  const cleaned = sanitizeScannedLine(line);
  const match = cleaned.match(
    /^(?:Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat)?\.?,?\s*([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:\s*(?:-|–|—|to)\s*(?:[A-Za-z]{3,9}\.?\s+)?\d{1,2})?(?:,?\s*(20\d{2}))?(?:\s+(\d{1,2}(?::\d{2})?\s*(?:AM|PM))(?:\s*(?:-|–|—)\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM))?)?$/i
  );

  if (!match) return null;

  const year = inferVenueScannerYear(match[1], match[3]);
  const eventDate = createVenueScannerDate(match[1], match[2], year);
  if (!eventDate) return null;

  return {
    eventDate,
    eventTime: parseVenueScannerTime(match[4] || ''),
  };
};

const isLongBeachConventionCenterScannerNoiseLine = (value = '') => {
  const cleaned = sanitizeScannedLine(value);
  const normalized = normalizeText(cleaned);

  if (!normalized) return true;
  if (/^https?:\/\//i.test(cleaned)) return true;
  if (/^(exhibit hall|grand ballroom|prom \d|terrace theater|long beach arena)\b/i.test(cleaned)) {
    return true;
  }

  return /^(upcoming events|view calendar|events|buy tickets|register|free event|more info|venue|venue convention center|convention center|long beach convention center|long beach convention entertainment center|concert event updates sign up|saved|search)$/.test(
    normalized
  );
};

const parseLongBeachConventionCenterEvents = (
  text = '',
  sourceUrl = LONG_BEACH_CONVENTION_CENTER_EVENTS_URL
) => {
  const lines = getVenueScannerLines(text);
  const parsed = [];

  for (let index = 0; index < lines.length; index += 1) {
    const dateDetails = parseLongBeachConventionCenterDateLine(lines[index]);
    if (!dateDetails) continue;

    let blockStart = index - 1;
    while (
      blockStart >= 0 &&
      !parseLongBeachConventionCenterDateLine(lines[blockStart]) &&
      !/^more info$/i.test(lines[blockStart])
    ) {
      blockStart -= 1;
    }

    let nextDateIndex = lines.length;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (parseLongBeachConventionCenterDateLine(lines[cursor])) {
        nextDateIndex = cursor;
        break;
      }
    }

    const priorCandidates = lines
      .slice(blockStart + 1, index)
      .filter(
        (line) =>
          !isLongBeachConventionCenterScannerNoiseLine(line) && !/^https?:\/\//i.test(line)
      );
    const followingCandidates = lines
      .slice(index + 1, nextDateIndex)
      .filter(
        (line) =>
          !isLongBeachConventionCenterScannerNoiseLine(line) &&
          !parseLongBeachConventionCenterDateLine(line) &&
          !/^https?:\/\//i.test(line)
      );
    const eventName = priorCandidates[0] || followingCandidates[0] || '';

    if (!eventName) continue;

    parsed.push(
      createBlankOpportunity({
        eventName,
        venue: 'Long Beach Convention Center',
        eventDate: dateDetails.eventDate,
        eventTime: dateDetails.eventTime,
        sourceText: [
          ...lines.slice(blockStart + 1, index),
          lines[index],
          ...lines.slice(index + 1, nextDateIndex),
        ].join('\n'),
        eventUrl: sourceUrl || LONG_BEACH_CONVENTION_CENTER_EVENTS_URL,
        status: 'New',
      })
    );
  }

  return dedupeScannedOpportunities(parsed);
};

const parseRoxyDateLine = (line = '') => {
  const cleaned = sanitizeScannedLine(line);
  const match = cleaned.match(
    /^(?:Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat)\.?,\s*([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s*(20\d{2})(?:\s+(?:(?:Show|Doors?)\s*:?\s*)?(\d{1,2}(?::\d{2})?\s*(?:AM|PM)))?$/i
  );

  if (!match) return null;

  const eventDate = createVenueScannerDate(match[1], match[2], match[3]);
  if (!eventDate) return null;

  return {
    eventDate,
    eventTime: parseVenueScannerTime(match[4] || ''),
  };
};

const parseRoxyTimeLine = (line = '') => {
  const cleaned = sanitizeScannedLine(line);
  if (!/^(?:show|doors?)\s*:?\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)$/i.test(cleaned)) {
    return '';
  }
  return parseVenueScannerTime(cleaned);
};

const isRoxyScannerNoiseLine = (value = '') => {
  const cleaned = sanitizeScannedLine(value);
  const normalized = normalizeText(cleaned);

  if (!normalized) return true;
  if (/^(with|featuring)\b/i.test(cleaned)) return true;
  if (/\bpresents?:?$/i.test(cleaned)) return true;
  if (parseRoxyTimeLine(cleaned)) return true;

  return /^(shows|show|buy tickets|ticket info|faq|venue info|directions|prohibited items|history|contact us|newsletter|where to stay|rental info|search|goldenvoice|the roxy)$/.test(
    normalized
  );
};

const parseRoxyEvents = (text = '', sourceUrl = ROXY_EVENTS_URL) => {
  const lines = getVenueScannerLines(text);
  const parsed = [];

  for (let index = 0; index < lines.length; index += 1) {
    const dateDetails = parseRoxyDateLine(lines[index]);
    if (!dateDetails) continue;

    let blockStart = index - 1;
    while (
      blockStart >= 0 &&
      !parseRoxyDateLine(lines[blockStart]) &&
      !/^buy tickets$/i.test(lines[blockStart])
    ) {
      blockStart -= 1;
    }

    let nextDateIndex = lines.length;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (parseRoxyDateLine(lines[cursor])) {
        nextDateIndex = cursor;
        break;
      }
    }

    const titleCandidates = lines
      .slice(blockStart + 1, index)
      .filter((line) => !isRoxyScannerNoiseLine(line) && !/^https?:\/\//i.test(line));
    const eventName = titleCandidates[titleCandidates.length - 1] || '';
    const eventTime =
      dateDetails.eventTime ||
      lines.slice(index + 1, nextDateIndex).map(parseRoxyTimeLine).find(Boolean) ||
      '';

    if (!eventName) continue;

    parsed.push(
      createBlankOpportunity({
        eventName,
        venue: 'The Roxy',
        eventDate: dateDetails.eventDate,
        eventTime,
        sourceText: [
          ...lines.slice(blockStart + 1, index),
          lines[index],
          ...lines.slice(index + 1, nextDateIndex),
        ].join('\n'),
        eventUrl: sourceUrl || ROXY_EVENTS_URL,
        status: 'New',
      })
    );
  }

  return dedupeScannedOpportunities(parsed);
};

const parseYouTubeTheaterDateLine = (line = '') => {
  const cleaned = sanitizeScannedLine(line);
  const datedEventMatch = cleaned.match(
    /^(?:(?:Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat)\.?\s*,?\s*)?([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s*(20\d{2})(?:\s*(?:\/|\||-|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM)))?$/i
  );

  if (datedEventMatch) {
    const eventDate = createVenueScannerDate(
      datedEventMatch[1],
      datedEventMatch[2],
      datedEventMatch[3]
    );
    if (!eventDate) return null;

    return {
      eventDate,
      eventTime: parseVenueScannerTime(datedEventMatch[4] || ''),
    };
  }

  const dateRangeMatch = cleaned.match(
    /^([A-Za-z]{3,9})\.?\s+(\d{1,2})\s*(?:-|–|—|to)\s*(?:[A-Za-z]{3,9}\.?\s+)?\d{1,2},\s*(20\d{2})$/i
  );

  if (!dateRangeMatch) return null;

  const eventDate = createVenueScannerDate(
    dateRangeMatch[1],
    dateRangeMatch[2],
    dateRangeMatch[3]
  );
  if (!eventDate) return null;

  return {
    eventDate,
    eventTime: '',
  };
};

const parseYouTubeTheaterInlineEvent = (line = '') => {
  const cleaned = sanitizeScannedLine(line);
  const match = cleaned.match(
    /^(?:(?:Sun|Mon|Tue|Tues|Wed|Thu|Thur|Fri|Sat)\.?,?\s*)?([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s*(20\d{2})\s*(?:\/|\||-|–|—)\s*(\d{1,2}(?::\d{2})?\s*(?:AM|PM))\s+(.+)$/i
  );
  if (!match) return null;

  const eventDate = createVenueScannerDate(match[1], match[2], match[3]);
  const eventName = sanitizeScannedLine(match[5]);
  if (!eventDate || !eventName) return null;

  return {
    eventDate,
    eventTime: parseVenueScannerTime(match[4]),
    eventName,
    sourceText: cleaned,
  };
};

const parseYouTubeTheaterEventStart = (line = '') => {
  const cleaned = sanitizeScannedLine(line);
  if (!/^event starts?\s+/i.test(cleaned)) return '';
  return parseVenueScannerTime(cleaned);
};

const isYouTubeTheaterScannerNoiseLine = (value = '') => {
  const cleaned = sanitizeScannedLine(value);
  const normalized = normalizeText(cleaned);

  if (!normalized) return true;
  if (/^(with|featuring)\b/i.test(cleaned)) return true;
  if (/\btour(?:\s+\d{4})?$/i.test(cleaned)) return true;
  if (/\bpresents?:?$/i.test(cleaned)) return true;
  if (/^doors open:/i.test(cleaned)) return true;
  if (parseYouTubeTheaterEventStart(cleaned)) return true;

  return /^(all upcoming events|all categories|comedy|concerts|list grid calendar|buy tickets|more info|buy tickets more info|premium|parking|premium parking|parking map|rideshare information|more events|youtube theater|contact us)$/.test(
    normalized
  );
};

const getYouTubeTheaterEventName = (blockLines = []) => {
  const titleLines = [];

  for (const value of blockLines) {
    const line = sanitizeScannedLine(value);
    const normalized = normalizeText(line);

    if (!line || /^https?:\/\//i.test(line) || parseYouTubeTheaterDateLine(line)) {
      continue;
    }

    const reachedEventControls =
      /^doors open:/i.test(line) ||
      Boolean(parseYouTubeTheaterEventStart(line)) ||
      /^(buy tickets|more info|buy tickets more info|premium|parking|premium parking|parking map|rideshare information)$/.test(
        normalized
      );

    if (reachedEventControls) {
      if (titleLines.length) break;
      continue;
    }

    if (isYouTubeTheaterScannerNoiseLine(line)) continue;

    titleLines.push(line);
    if (titleLines.length === 2) break;
  }

  return titleLines.join(' - ');
};

const parseYouTubeTheaterEvents = (
  text = '',
  sourceUrl = YOUTUBE_THEATER_EVENTS_URL
) => {
  const lines = getVenueScannerLines(text);
  const parsed = [];

  for (let index = 0; index < lines.length; index += 1) {
    const inlineEvent = parseYouTubeTheaterInlineEvent(lines[index]);
    if (inlineEvent) {
      parsed.push(
        createBlankOpportunity({
          eventName: inlineEvent.eventName,
          venue: 'YouTube Theater',
          eventDate: inlineEvent.eventDate,
          eventTime: inlineEvent.eventTime,
          sourceText: inlineEvent.sourceText,
          eventUrl: sourceUrl || YOUTUBE_THEATER_EVENTS_URL,
          status: 'New',
        })
      );
      continue;
    }

    const dateDetails = parseYouTubeTheaterDateLine(lines[index]);
    if (!dateDetails) continue;

    let nextDateIndex = lines.length;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (parseYouTubeTheaterDateLine(lines[cursor])) {
        nextDateIndex = cursor;
        break;
      }
    }

    const blockLines = lines.slice(index + 1, nextDateIndex);
    const eventName = getYouTubeTheaterEventName(blockLines);
    const eventTime =
      dateDetails.eventTime ||
      blockLines.map(parseYouTubeTheaterEventStart).find(Boolean) ||
      '';

    if (!eventName) continue;

    parsed.push(
      createBlankOpportunity({
        eventName,
        venue: 'YouTube Theater',
        eventDate: dateDetails.eventDate,
        eventTime,
        sourceText: [lines[index], ...blockLines].join('\n'),
        eventUrl: sourceUrl || YOUTUBE_THEATER_EVENTS_URL,
        status: 'New',
      })
    );
  }

  return dedupeScannedOpportunities(parsed);
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

  if (venue === 'The Shrine') {
    return parseShrineEvents(text, sourceUrl || SHRINE_EVENTS_URL);
  }

  if (venue === 'Novo Theater') {
    return parseNovoEvents(text, sourceUrl || NOVO_THEATER_EVENTS_URL);
  }

  if (venue === 'Long Beach Amphitheater') {
    return parseLongBeachAmphitheaterEvents(
      text,
      sourceUrl || LONG_BEACH_AMPHITHEATER_EVENTS_URL
    );
  }

  if (venue === 'Long Beach Convention Center') {
    return parseLongBeachConventionCenterEvents(
      text,
      sourceUrl || LONG_BEACH_CONVENTION_CENTER_EVENTS_URL
    );
  }

  if (venue === 'The Roxy') {
    return parseRoxyEvents(text, sourceUrl || ROXY_EVENTS_URL);
  }

  if (venue === 'YouTube Theater') {
    return parseYouTubeTheaterEvents(text, sourceUrl || YOUTUBE_THEATER_EVENTS_URL);
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

const EVENT_IDENTITY_NOISE_TOKENS = new Set([
  '2026',
  'csc',
  'dns',
  'event',
  'feat',
  'featuring',
  'guest',
  'guests',
  'main',
  'preseason',
  'production',
  'sec',
  'security',
  'shift',
  'special',
  'versus',
  'vs',
  'with',
]);

const normalizeEventIdentity = (value = '') =>
  normalizeText(value)
    .replace(/([a-z])vs(?=[a-z0-9])/g, '$1 vs ')
    .replace(/\b(?:and|amp)\b/g, ' ')
    .replace(/\bday\s*(\d+)\b/g, ' n$1 ')
    .replace(/\bnight\s*(\d+)\b/g, ' n$1 ')
    .replace(/\s+/g, ' ')
    .trim();

const getEventIdentityTokens = (value = '') =>
  normalizeEventIdentity(value)
    .split(' ')
    .filter((token) => token && !EVENT_IDENTITY_NOISE_TOKENS.has(token));

const getEditDistance = (firstValue = '', secondValue = '') => {
  const first = String(firstValue || '');
  const second = String(secondValue || '');
  if (!first) return second.length;
  if (!second) return first.length;

  const previous = Array.from({ length: second.length + 1 }, (_, index) => index);
  const current = new Array(second.length + 1).fill(0);

  for (let firstIndex = 1; firstIndex <= first.length; firstIndex += 1) {
    current[0] = firstIndex;
    for (let secondIndex = 1; secondIndex <= second.length; secondIndex += 1) {
      const substitutionCost = first[firstIndex - 1] === second[secondIndex - 1] ? 0 : 1;
      current[secondIndex] = Math.min(
        current[secondIndex - 1] + 1,
        previous[secondIndex] + 1,
        previous[secondIndex - 1] + substitutionCost
      );
    }
    for (let secondIndex = 0; secondIndex <= second.length; secondIndex += 1) {
      previous[secondIndex] = current[secondIndex];
    }
  }

  return previous[second.length];
};

const eventIdentityTokensMatch = (firstToken = '', secondToken = '') => {
  if (!firstToken || !secondToken) return false;
  if (firstToken === secondToken) return true;
  if (firstToken.length >= 5 && secondToken.length >= 5) {
    if (firstToken.includes(secondToken) || secondToken.includes(firstToken)) return true;
    return getEditDistance(firstToken, secondToken) <= 2;
  }
  return false;
};

const getEventIdentityScore = (firstValue = '', secondValue = '') => {
  const firstTokens = getEventIdentityTokens(firstValue);
  const secondTokens = getEventIdentityTokens(secondValue);
  if (!firstTokens.length || !secondTokens.length) return 0;

  const usedSecondIndexes = new Set();
  let matches = 0;

  firstTokens.forEach((firstToken) => {
    const matchIndex = secondTokens.findIndex(
      (secondToken, index) =>
        !usedSecondIndexes.has(index) && eventIdentityTokensMatch(firstToken, secondToken)
    );
    if (matchIndex < 0) return;
    usedSecondIndexes.add(matchIndex);
    matches += 1;
  });

  return matches / Math.max(firstTokens.length, secondTokens.length);
};

const getEventLeadIdentityTokens = (value = '') => {
  const leadText = String(value || '')
    .split(/\s+-\s+/)[0]
    .trim();

  return getEventIdentityTokens(leadText).filter(
    (token) => !['the', 'a', 'an'].includes(token)
  );
};

const getLeadIdentityScore = (firstValue = '', secondValue = '') => {
  const firstTokens = getEventLeadIdentityTokens(firstValue);
  const secondTokens = getEventLeadIdentityTokens(secondValue);

  if (!firstTokens.length || !secondTokens.length) return 0;

  const shorter =
    firstTokens.length <= secondTokens.length ? firstTokens : secondTokens;
  const longer =
    firstTokens.length <= secondTokens.length ? secondTokens : firstTokens;

  let matches = 0;
  const usedIndexes = new Set();

  shorter.forEach((token) => {
    const matchIndex = longer.findIndex(
      (candidate, index) =>
        !usedIndexes.has(index) && eventIdentityTokensMatch(token, candidate)
    );

    if (matchIndex < 0) return;
    usedIndexes.add(matchIndex);
    matches += 1;
  });

  if (!matches) return 0;

  /*
   * CSC shift names frequently replace the public tour title with an internal
   * assignment suffix such as "N1" or "N2". When the headliner identity
   * matches, treat that as strong evidence on the same date and venue.
   */
  if (
    matches === shorter.length &&
    shorter.some((token) => token.length >= 4)
  ) {
    return 0.8;
  }

  return matches / Math.max(firstTokens.length, secondTokens.length);
};

const getOpportunityShiftEventScore = (opportunity = {}, shift = {}) =>
  Math.max(
    getEventIdentityScore(opportunity.eventName, shift.event),
    getEventIdentityScore(opportunity.eventName, shift.jobName),
    getEventIdentityScore(opportunity.eventName, shift.shiftName),
    getLeadIdentityScore(opportunity.eventName, shift.event),
    getLeadIdentityScore(opportunity.eventName, shift.jobName),
    getLeadIdentityScore(opportunity.eventName, shift.shiftName)
  );

const readCscShifts = () => {
  const preserveAuthorityMetadata = (shift = {}, recordSource = 'active') => ({
    ...cleanCscDisplayShift({ ...shift, recordSource }),
    scheduleSource: shift.scheduleSource || '',
    wishEssStatus: shift.wishEssStatus || '',
    wishEssVerifiedAt: shift.wishEssVerifiedAt || '',
    wishEssSnapshotId: shift.wishEssSnapshotId || '',
  });

  const active = readArray(CSC_STORAGE_KEY, []).map((shift) =>
    preserveAuthorityMetadata(shift, 'active')
  );
  const archived = readArray(CSC_ARCHIVE_STORAGE_KEY, []).map((shift) =>
    preserveAuthorityMetadata(shift, 'archived')
  );
  return [...active, ...archived];
};

const getLinkedCscShiftForOpportunity = (opportunity = {}, allShifts = readCscShifts()) => {
  if (!opportunity?.linkedCscShiftId && !opportunity?.id) return null;

  return (
    allShifts.find((shift) => opportunity.linkedCscShiftId && shift.id === opportunity.linkedCscShiftId) ||
    allShifts.find(
      (shift) =>
        opportunity.id &&
        (shift.createdFromOpportunityId === opportunity.id || shift.linkedOpportunityId === opportunity.id)
    ) ||
    null
  );
};

const getResolvedOpportunityStatus = (opportunity = {}, allShifts = readCscShifts()) => {
  const linkedShift = getLinkedCscShiftForOpportunity(opportunity, allShifts);
  if (linkedShift) return getOpportunityStatusFromLinkedShift(linkedShift);
  return normalizeOpportunityStatus(opportunity.status, opportunity.linkedCscShiftId);
};

const isOpportunityCompleted = (opportunity = {}, allShifts = readCscShifts()) =>
  getResolvedOpportunityStatus(opportunity, allShifts) === 'Completed';

const getMatchingCscShiftResult = (opportunity = {}, allShifts = readCscShifts()) => {
  const canonicalOpportunityVenue = canonicalVenueName(opportunity.venue);
  const candidatesById = new Map();

  allShifts.forEach((shift) => {
    if (!shift?.id || isCancelledShiftStatus(shift.shiftStatus)) return;
    if (shift.startDate !== opportunity.eventDate) return;
    if (canonicalVenueName(shift.venue) !== canonicalOpportunityVenue) return;

    const eventScore = getOpportunityShiftEventScore(opportunity, shift);
    if (eventScore < 0.45) return;

    const existing = candidatesById.get(shift.id);
    if (!existing || eventScore > existing.eventScore) {
      candidatesById.set(shift.id, { shift, eventScore });
    }
  });

  const ranked = Array.from(candidatesById.values()).sort((first, second) => {
    if (second.eventScore !== first.eventScore) return second.eventScore - first.eventScore;
    if (first.shift.recordSource !== second.shift.recordSource) {
      return first.shift.recordSource === 'active' ? -1 : 1;
    }
    return `${first.shift.startTime || ''}|${first.shift.finishTime || ''}`.localeCompare(
      `${second.shift.startTime || ''}|${second.shift.finishTime || ''}`
    );
  });

  if (!ranked.length) return { match: null, ambiguousMatches: [], rankedMatches: [] };

  const topScore = ranked[0].eventScore;
  const equallyStrong = ranked.filter((candidate) => topScore - candidate.eventScore <= 0.08);
  const distinctWindows = new Set(
    equallyStrong.map(({ shift }) =>
      [shift.startDate, shift.startTime, shift.finishDate || shift.startDate, shift.finishTime].join('|')
    )
  );

  if (equallyStrong.length > 1 && distinctWindows.size > 1) {
    return {
      match: null,
      ambiguousMatches: equallyStrong.map(({ shift }) => shift),
      rankedMatches: ranked.map(({ shift }) => shift),
    };
  }

  return {
    match: ranked[0].shift,
    ambiguousMatches: [],
    rankedMatches: ranked.map(({ shift }) => shift),
  };
};

const findMatchingCscShift = (opportunity = {}, allShifts = readCscShifts()) =>
  getMatchingCscShiftResult(opportunity, allShifts).match;

const getShiftOpportunityEventName = (shift = {}) => {
  const event = String(shift.event || '').trim();
  const jobName = String(shift.jobName || '').trim();
  const genericEvent = /^(?:accepted csc shift|csc courtesy shift reminder|event|shift)$/i.test(event);
  const genericJobName = /^(?:accepted csc shift|csc courtesy shift reminder|job|shift)$/i.test(jobName);

  if (jobName && !genericJobName) return cleanCscDisplayTitle(jobName);
  if (event && !genericEvent) return cleanCscDisplayTitle(event);
  return cleanCscDisplayTitle(jobName || event || 'Scheduled CSC shift');
};

const createOpportunityFromScheduledShift = (shift = {}) =>
  createBlankOpportunity({
    id: `csc-opportunity-from-shift-${shift.id}`,
    eventName: getShiftOpportunityEventName(shift),
    venue: canonicalVenueName(shift.venue),
    eventDate: shift.startDate || '',
    eventTime: shift.startTime || '',
    expectedEndTime:
      !shift.finishDate || shift.finishDate === shift.startDate ? shift.finishTime || '' : '',
    status: getOpportunityStatusFromLinkedShift(shift),
    linkedCscShiftId: shift.id,
    lastVerifiedAt: new Date().toISOString(),
    sourceText: 'Created automatically from a scheduled CSC shift.',
  });

const repairOpportunityShiftLinks = (
  items = [],
  allShifts = readCscShifts(),
  archivedItems = []
) => {
  const currentItems = Array.isArray(items) ? items : [];
  const nonCancelledShifts = allShifts.filter(
    (shift) => shift?.id && !isCancelledShiftStatus(shift.shiftStatus)
  );
  const linkedShiftIds = new Set();
  const representedShiftIds = new Set(
    (Array.isArray(archivedItems) ? archivedItems : [])
      .map((opportunity) => opportunity.linkedCscShiftId)
      .filter(Boolean)
  );
  let changed = false;

  const repairedItems = currentItems.map((opportunity) => {
    const explicitLinkedShift = getLinkedCscShiftForOpportunity(opportunity, allShifts);

    if (explicitLinkedShift) {
      linkedShiftIds.add(explicitLinkedShift.id);
      representedShiftIds.add(explicitLinkedShift.id);
      const nextStatus = getOpportunityStatusFromLinkedShift(explicitLinkedShift);
      if (
        opportunity.linkedCscShiftId === explicitLinkedShift.id &&
        opportunity.status === nextStatus
      ) {
        return opportunity;
      }

      changed = true;
      return createBlankOpportunity({
        ...opportunity,
        linkedCscShiftId: explicitLinkedShift.id,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
    }

    const result = getMatchingCscShiftResult(opportunity, allShifts);
    result.rankedMatches.forEach((shift) => representedShiftIds.add(shift.id));

    if (!result.match) {
      if (!opportunity.linkedCscShiftId) return opportunity;
      changed = true;
      return createBlankOpportunity({
        ...opportunity,
        linkedCscShiftId: '',
        status: opportunity.status === 'Scheduled' ? 'New' : opportunity.status,
        updatedAt: new Date().toISOString(),
      });
    }

    linkedShiftIds.add(result.match.id);
    representedShiftIds.add(result.match.id);
    changed = true;
    return createBlankOpportunity({
      ...opportunity,
      linkedCscShiftId: result.match.id,
      status: getOpportunityStatusFromLinkedShift(result.match),
      lastVerifiedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  const currentDate = todayIso();
  nonCancelledShifts.forEach((shift) => {
    if (!shift.startDate || shift.startDate < currentDate) return;
    if (linkedShiftIds.has(shift.id) || representedShiftIds.has(shift.id)) return;
    if (!shift.venue || (!shift.event && !shift.jobName && !shift.shiftName)) return;

    repairedItems.push(createOpportunityFromScheduledShift(shift));
    linkedShiftIds.add(shift.id);
    changed = true;
  });

  const shiftAwareDedupe = dedupeOpportunityRecords(
    repairedItems,
    allShifts
  );

  if (shiftAwareDedupe.removedCount > 0) {
    changed = true;
  }

  const sortedItems = shiftAwareDedupe.opportunities.sort((first, second) =>
    `${first.eventDate || ''} ${first.eventTime || ''} ${first.eventName || ''}`.localeCompare(
      `${second.eventDate || ''} ${second.eventTime || ''} ${second.eventName || ''}`
    )
  );

  return { opportunities: sortedItems, changed };
};

const isOpportunityActiveForDateConflict = (opportunity = {}) =>
  Boolean(opportunity.eventDate) && isActiveOpportunityStatus(opportunity.status);

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

const DEFAULT_OPPORTUNITY_DURATION_MINUTES = 4 * 60;

const buildLocalDateTime = (date = '', time = '') => {
  const normalizedDate = String(date || '').trim();
  const normalizedTime = String(time || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) || !/^\d{2}:\d{2}$/.test(normalizedTime)) {
    return null;
  }

  const value = new Date(`${normalizedDate}T${normalizedTime}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
};

const getOpportunityTimeWindow = (opportunity = {}) => {
  const start = buildLocalDateTime(opportunity.eventDate, opportunity.eventTime);
  if (!start) return null;

  let end = opportunity.expectedEndTime
    ? buildLocalDateTime(opportunity.eventDate, opportunity.expectedEndTime)
    : null;

  if (end && end <= start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  if (!end) {
    end = new Date(start.getTime() + DEFAULT_OPPORTUNITY_DURATION_MINUTES * 60 * 1000);
  }

  return { start, end };
};

const getCscShiftTimeWindow = (shift = {}) => {
  const start = buildLocalDateTime(shift.startDate, shift.startTime);
  if (!start || !shift.finishTime) return null;

  const finishDate = shift.finishDate || shift.startDate;
  let end = buildLocalDateTime(finishDate, shift.finishTime);
  if (!end) return null;

  if (end <= start) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }

  return { start, end };
};

const isSameOpportunityShift = (opportunity = {}, shift = {}) => {
  if (
    (opportunity.linkedCscShiftId && opportunity.linkedCscShiftId === shift.id) ||
    (opportunity.id &&
      (shift.createdFromOpportunityId === opportunity.id || shift.linkedOpportunityId === opportunity.id))
  ) {
    return true;
  }

  if (
    opportunity.eventDate !== shift.startDate ||
    canonicalVenueName(opportunity.venue) !== canonicalVenueName(shift.venue)
  ) {
    return false;
  }

  const eventSimilarity = getOpportunityShiftEventScore(opportunity, shift);

  return eventSimilarity >= 0.45;
};

const getScheduledShiftConflicts = (opportunity = {}, allShifts = []) => {
  if (!isOpportunityActiveForDateConflict(opportunity)) return [];

  const opportunityWindow = getOpportunityTimeWindow(opportunity);
  if (!opportunityWindow) return [];

  return allShifts
    .filter((shift) => {
      if (isCancelledShiftStatus(shift.shiftStatus)) return false;
      if (isSameOpportunityShift(opportunity, shift)) return false;

      const shiftWindow = getCscShiftTimeWindow(shift);
      if (!shiftWindow) return false;

      return opportunityWindow.start < shiftWindow.end && shiftWindow.start < opportunityWindow.end;
    })
    .sort((first, second) =>
      `${first.startDate || ''}|${first.startTime || ''}|${canonicalVenueName(first.venue)}`.localeCompare(
        `${second.startDate || ''}|${second.startTime || ''}|${canonicalVenueName(second.venue)}`
      )
    );
};

const getStatusClass = (status) => {
  if (status === 'Scheduled') return 'bg-emerald-100 text-emerald-900 border-emerald-200';
  if (status === 'Completed') return 'bg-slate-100 text-slate-700 border-slate-200';
  if (status === 'Shift Requested') return 'bg-blue-100 text-blue-900 border-blue-200';
  if (status === 'No Shifts Available' || status === 'Cancelled') return 'bg-slate-200 text-slate-800 border-slate-300';
  return 'bg-amber-100 text-amber-900 border-amber-200';
};

const getIsoDayDifference = (futureDate = '', currentDate = todayIso()) => {
  const futureMatch = String(futureDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const currentMatch = String(currentDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!futureMatch || !currentMatch) return null;

  const futureUtc = Date.UTC(Number(futureMatch[1]), Number(futureMatch[2]) - 1, Number(futureMatch[3]));
  const currentUtc = Date.UTC(Number(currentMatch[1]), Number(currentMatch[2]) - 1, Number(currentMatch[3]));
  return Math.round((futureUtc - currentUtc) / (24 * 60 * 60 * 1000));
};

const getOpportunityAttentionState = (
  opportunity = {},
  resolvedStatus = opportunity.status,
  currentDate = todayIso()
) => {
  if (!isActiveOpportunityStatus(resolvedStatus) || resolvedStatus === 'Scheduled') return null;

  const nextCallDate = String(opportunity.nextCallDate || '').trim();
  const hasCallHistory = Boolean(opportunity.lastCalledDate || opportunity.callHistory?.length);
  const hasExplicitFollowUp = Boolean(
    opportunity.nextCallDateSetAt ||
      opportunity.linkedTodoTaskId ||
      hasCallHistory ||
      resolvedStatus !== 'New'
  );

  /*
   * Brand-new opportunities can carry stale legacy nextCallDate values from
   * older data or merges. Do not label those OVERDUE unless the follow-up was
   * explicitly set through the current workflow, linked to a To-Do, or backed
   * by actual call history.
   */
  if (resolvedStatus === 'New' && !hasCallHistory && !hasExplicitFollowUp) {
    return {
      key: 'new-review',
      label: 'NEW - REVIEW',
      rank: 1,
      className: 'border-violet-300 bg-violet-100 text-violet-900',
    };
  }

  if (hasExplicitFollowUp && nextCallDate && nextCallDate < currentDate) {
    return {
      key: 'overdue',
      label: 'OVERDUE',
      rank: 1,
      className: 'border-red-400 bg-red-700 text-white',
    };
  }

  if (hasExplicitFollowUp && nextCallDate === currentDate) {
    return {
      key: 'call-today',
      label: 'CALL TODAY',
      rank: 2,
      className: 'border-orange-400 bg-orange-600 text-white',
    };
  }

  if (resolvedStatus === 'Shift Requested') {
    return {
      key: 'awaiting-shift',
      label: 'AWAITING SHIFT',
      rank: 3,
      className: 'border-blue-300 bg-blue-100 text-blue-900',
    };
  }

  if (resolvedStatus === 'New' && !hasCallHistory) {
    return {
      key: 'new-review',
      label: 'NEW - REVIEW',
      rank: 4,
      className: 'border-violet-300 bg-violet-100 text-violet-900',
    };
  }

  const daysUntilEvent = getIsoDayDifference(opportunity.eventDate, currentDate);
  if (daysUntilEvent !== null && daysUntilEvent >= 0 && daysUntilEvent <= 7) {
    return {
      key: 'event-soon',
      label: 'EVENT SOON',
      rank: 5,
      className: 'border-amber-300 bg-amber-100 text-amber-950',
    };
  }

  return null;
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
      className={`${sizeClass} shrink-0 rounded-xl object-cover`}
    />
  );
};

const navigateToAppTab = (tab, recordId = '', extra = {}) => {
  window.dispatchEvent(
    new CustomEvent(APP_NAVIGATE_EVENT, {
      detail: { tab, recordId, ...extra },
    })
  );
};

const storeLinkedShiftReturnContext = (opportunityId = '', shiftId = '') => {
  const returnContext = {
    returnTab: 'cscOpportunities',
    returnRecordId: String(opportunityId || '').trim(),
    openedShiftId: String(shiftId || '').trim(),
    createdAt: new Date().toISOString(),
  };
  const serializedContext = JSON.stringify(returnContext);

  try {
    sessionStorage.setItem(CSC_RETURN_CONTEXT_STORAGE_KEY, serializedContext);
    localStorage.setItem(CSC_RETURN_CONTEXT_STORAGE_KEY, serializedContext);
    sessionStorage.setItem(CSC_OPEN_SHIFT_STORAGE_KEY, returnContext.openedShiftId);
    localStorage.setItem(CSC_OPEN_SHIFT_STORAGE_KEY, returnContext.openedShiftId);
  } catch (error) {
    console.error('Failed to save the CSC shift return location:', error);
  }

  return returnContext;
};

const readStoredTodoTasks = () => readArray(TODO_STORAGE_KEY, []);

const CscOpportunitiesTab = ({ searchQuery = '' }) => {
  const [opportunities, setOpportunities] = useState(() => loadDedupedOpportunities());
  const [archivedOpportunities, setArchivedOpportunities] = useState(() => loadArchivedOpportunities());
  const [venueContacts, setVenueContacts] = useState(() => loadVenueContacts());
  const [localSearch, setLocalSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [excludedVenues, setExcludedVenues] = useState([]);
  const [showVenueFilter, setShowVenueFilter] = useState(false);
  const [monthFilter, setMonthFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [summaryFilter, setSummaryFilter] = useState('active');
  const [showMonthOverview, setShowMonthOverview] = useState(false);
  const [monthViewRequest, setMonthViewRequest] = useState(0);
  const [saveMessage, setSaveMessage] = useState('');
  const [showFormDrawer, setShowFormDrawer] = useState(false);
  const [showScanDrawer, setShowScanDrawer] = useState(false);
  const [showCreateShiftDrawer, setShowCreateShiftDrawer] = useState(false);
  const [showEventWatchDrawer, setShowEventWatchDrawer] = useState(false);
  const [showEmailCheckDrawer, setShowEmailCheckDrawer] = useState(false);
  const [emailCheckBusy, setEmailCheckBusy] = useState(false);
  const [emailCheckError, setEmailCheckError] = useState('');
  const [emailCheckReport, setEmailCheckReport] = useState(() => loadCscEmailCheckReport());
  const [showDataScreen, setShowDataScreen] = useState(false);
  const [showArchiveDrawer, setShowArchiveDrawer] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [eventWatchReport, setEventWatchReport] = useState(() => loadEventWatchReport());
  const [eventWatchReportText, setEventWatchReportText] = useState('');
  const [eventWatchSyncState, setEventWatchSyncState] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(EVENT_WATCH_SYNC_STORAGE_KEY) || 'null');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const [showConflictSection, setShowConflictSection] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState(() => createBlankOpportunity());
  const [scanText, setScanText] = useState('');
  const [scanVenue, setScanVenue] = useState('Kia Forum');
  const [scanSourceUrl, setScanSourceUrl] = useState(KIA_FORUM_EVENTS_URL);
  const [scannedOpportunities, setScannedOpportunities] = useState([]);
  const [shiftDraft, setShiftDraft] = useState(null);
  const [notesDrafts, setNotesDrafts] = useState({});
  const [expandedNoteIds, setExpandedNoteIds] = useState(() => new Set());
  const [overflowingNoteIds, setOverflowingNoteIds] = useState(() => new Set());
  const [expandedOpportunityIds, setExpandedOpportunityIds] = useState(() => new Set());
  const [cscShiftSyncVersion, setCscShiftSyncVersion] = useState(0);
  const noteTextareaRefs = useRef(new Map());
  const importInputRef = useRef(null);
  const venueFilterRef = useRef(null);
  const saveMessageTimerRef = useRef(null);
  const eventWatchSyncInProgressRef = useRef(false);
  const opportunitiesRef = useRef(opportunities);
  const archivedOpportunitiesRef = useRef(archivedOpportunities);
  const venueContactsRef = useRef(venueContacts);

  const venueNames = useMemo(
    () => VENUE_DEFINITIONS.map((definition) => definition.venue),
    []
  );
  const excludedVenueSet = useMemo(() => new Set(excludedVenues), [excludedVenues]);
  const selectedVenueCount = venueNames.length - excludedVenues.length;
  const allVenuesSelected = excludedVenues.length === 0;
  const someVenuesSelected = selectedVenueCount > 0 && !allVenuesSelected;
  const venueFilterLabel = allVenuesSelected
    ? 'All venues'
    : selectedVenueCount === 0
      ? 'No venues'
      : `${selectedVenueCount} of ${venueNames.length} venues`;

  useEffect(
    () => () => {
      if (saveMessageTimerRef.current) {
        window.clearTimeout(saveMessageTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const hasOpenLayer =
      showPrintPreview ||
      showEventWatchDrawer ||
      showEmailCheckDrawer ||
      showArchiveDrawer ||
      showCreateShiftDrawer ||
      showScanDrawer ||
      showFormDrawer ||
      showDataScreen;
    if (!hasOpenLayer) return undefined;

    const closeTopLayer = (event) => {
      if (event.key !== 'Escape') return;
      if (showPrintPreview) setShowPrintPreview(false);
      else if (showEmailCheckDrawer) setShowEmailCheckDrawer(false);
      else if (showEventWatchDrawer) setShowEventWatchDrawer(false);
      else if (showArchiveDrawer) setShowArchiveDrawer(false);
      else if (showCreateShiftDrawer) setShowCreateShiftDrawer(false);
      else if (showScanDrawer) setShowScanDrawer(false);
      else if (showFormDrawer) setShowFormDrawer(false);
      else if (showDataScreen) setShowDataScreen(false);
    };

    document.addEventListener('keydown', closeTopLayer);
    return () => document.removeEventListener('keydown', closeTopLayer);
  }, [
    showArchiveDrawer,
    showCreateShiftDrawer,
    showDataScreen,
    showEmailCheckDrawer,
    showEventWatchDrawer,
    showFormDrawer,
    showPrintPreview,
    showScanDrawer,
  ]);

  const toggleVenue = (venue) => {
    setExcludedVenues((current) =>
      current.includes(venue)
        ? current.filter((item) => item !== venue)
        : [...current, venue]
    );
  };

  useEffect(() => {
    if (!showVenueFilter) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!venueFilterRef.current?.contains(event.target)) setShowVenueFilter(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setShowVenueFilter(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);

    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showVenueFilter]);

  useEffect(() => {
    const removeExpiredOpportunities = () => {
      setOpportunities((current) => archiveExpiredOpportunities(current));
      setArchivedOpportunities(loadArchivedOpportunities());
    };

    const removeExpiredWhenVisible = () => {
      if (document.visibilityState === 'visible') removeExpiredOpportunities();
    };

    removeExpiredOpportunities();
    window.addEventListener('focus', removeExpiredOpportunities);
    document.addEventListener('visibilitychange', removeExpiredWhenVisible);
    const intervalId = window.setInterval(removeExpiredOpportunities, 60 * 1000);

    return () => {
      window.removeEventListener('focus', removeExpiredOpportunities);
      document.removeEventListener('visibilitychange', removeExpiredWhenVisible);
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const refreshExternalOpportunities = (event) => {
      const nextOpportunities = event?.detail?.opportunities;
      if (!Array.isArray(nextOpportunities)) return;

      setOpportunities((current) => {
        if (nextOpportunities === current) return current;
        if (JSON.stringify(nextOpportunities) === JSON.stringify(current)) return current;
        return archiveExpiredOpportunities(
          nextOpportunities.map((item) => createBlankOpportunity(item))
        );
      });
    };

    window.addEventListener(OPPORTUNITIES_UPDATE_EVENT, refreshExternalOpportunities);

    return () => {
      window.removeEventListener(OPPORTUNITIES_UPDATE_EVENT, refreshExternalOpportunities);
    };
  }, []);

  useEffect(() => {
    const reconcileWithCscShifts = () => {
      const allShifts = readCscShifts();

      setOpportunities((current) => {
        const repairResult = repairOpportunityShiftLinks(
          current,
          allShifts,
          archivedOpportunities
        );
        if (!repairResult.changed) return current;

        writeOpportunitySnapshot(
          'Before automatic CSC opportunity and shift link repair',
          current,
          venueContacts,
          archivedOpportunities
        );
        return archiveExpiredOpportunities(repairResult.opportunities);
      });
    };

    const refreshCscShiftSync = () => {
      setCscShiftSyncVersion((current) => current + 1);
      reconcileWithCscShifts();
    };

    reconcileWithCscShifts();
    window.addEventListener(CSC_SHIFT_UPDATE_EVENT, refreshCscShiftSync);
    window.addEventListener(APP_NAVIGATE_EVENT, refreshCscShiftSync);
    window.addEventListener('storage', refreshCscShiftSync);
    window.addEventListener('focus', refreshCscShiftSync);

    return () => {
      window.removeEventListener(CSC_SHIFT_UPDATE_EVENT, refreshCscShiftSync);
      window.removeEventListener(APP_NAVIGATE_EVENT, refreshCscShiftSync);
      window.removeEventListener('storage', refreshCscShiftSync);
      window.removeEventListener('focus', refreshCscShiftSync);
    };
  }, [archivedOpportunities, venueContacts]);

  useEffect(() => {
    let opportunityId = '';

    try {
      opportunityId =
        sessionStorage.getItem(OPPORTUNITY_OPEN_STORAGE_KEY) ||
        localStorage.getItem(OPPORTUNITY_OPEN_STORAGE_KEY) ||
        '';
      sessionStorage.removeItem(OPPORTUNITY_OPEN_STORAGE_KEY);
      localStorage.removeItem(OPPORTUNITY_OPEN_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to read linked CSC opportunity request:', error);
    }

    if (!opportunityId) return;

    if (archivedOpportunities.some((opportunity) => opportunity.id === opportunityId)) {
      setArchiveSearch(opportunityId);
      setShowArchiveDrawer(true);
      return;
    }

    setLocalSearch('');
    setExcludedVenues([]);
    setMonthFilter('All');
    setStatusFilter('All');
    window.requestAnimationFrame(() => {
      document.getElementById(`csc-opportunity-${opportunityId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }, []);

  useEffect(() => {
    const activeExcluded = opportunities.filter(isExcludedOpportunityEvent);
    const archivedExcluded = archivedOpportunities.filter(
      isExcludedOpportunityEvent
    );

    if (!activeExcluded.length && !archivedExcluded.length) return;

    try {
      localStorage.setItem(
        OPPORTUNITIES_EXCLUDED_BACKUP_STORAGE_KEY,
        JSON.stringify({
          createdAt: new Date().toISOString(),
          reason: 'Before removing non-CSC opportunity records',
          activeExcluded,
          archivedExcluded,
        })
      );
    } catch (error) {
      console.error(
        'Failed to save excluded CSC opportunity recovery backup:',
        error
      );
    }

    if (activeExcluded.length) {
      setOpportunities((current) =>
        current.filter((item) => !isExcludedOpportunityEvent(item))
      );
    }

    if (archivedExcluded.length) {
      setArchivedOpportunities((current) =>
        current.filter((item) => !isExcludedOpportunityEvent(item))
      );
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(OPPORTUNITIES_STORAGE_KEY, JSON.stringify(opportunities));
    window.dispatchEvent(new CustomEvent(OPPORTUNITIES_UPDATE_EVENT, { detail: { opportunities } }));
    opportunitiesRef.current = opportunities;
  }, [opportunities]);

  useEffect(() => {
    localStorage.setItem(
      OPPORTUNITIES_ARCHIVE_STORAGE_KEY,
      JSON.stringify(archivedOpportunities)
    );
    archivedOpportunitiesRef.current = archivedOpportunities;
  }, [archivedOpportunities]);

  useEffect(() => {
    localStorage.setItem(VENUE_CONTACTS_STORAGE_KEY, JSON.stringify(venueContacts));
    venueContactsRef.current = venueContacts;
  }, [venueContacts]);

  useEffect(() => {
    localStorage.setItem(EVENT_WATCH_SYNC_STORAGE_KEY, JSON.stringify(eventWatchSyncState));
  }, [eventWatchSyncState]);

  const allCscShiftsForStatus = useMemo(() => readCscShifts(), [cscShiftSyncVersion, opportunities]);

  useEffect(() => {
    const completed = opportunities.filter(
      (opportunity) =>
        getResolvedOpportunityStatus(opportunity, allCscShiftsForStatus) === 'Completed'
    );
    if (!completed.length) return;

    writeOpportunitySnapshot(
      'Before moving completed CSC opportunities to archive',
      opportunities,
      venueContacts,
      archivedOpportunities
    );

    const archivedAt = new Date().toISOString();
    setArchivedOpportunities((currentArchived) => {
      const byId = new Map(currentArchived.map((item) => [item.id, item]));
      completed.forEach((item) => {
        byId.set(
          item.id,
          createBlankOpportunity({
            ...item,
            status: 'Completed',
            archivedAt: item.archivedAt || archivedAt,
            archiveReason: 'Linked CSC shift completed',
          })
        );
      });
      return Array.from(byId.values()).sort((first, second) =>
        String(second.archivedAt || '').localeCompare(String(first.archivedAt || ''))
      );
    });
    setOpportunities((current) =>
      current.filter((item) => !completed.some((completedItem) => completedItem.id === item.id))
    );
  }, [allCscShiftsForStatus, archivedOpportunities, opportunities, venueContacts]);

  const sameDateConflictGroups = useMemo(
    () =>
      buildSameDateConflictGroups(
        opportunities
          .map((opportunity) => ({
            ...opportunity,
            status: getResolvedOpportunityStatus(opportunity, allCscShiftsForStatus),
          }))
          .filter((opportunity) => isActiveOpportunityStatus(opportunity.status))
      ),
    [allCscShiftsForStatus, opportunities]
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

  const scheduledShiftConflictMap = useMemo(() => {
    const map = new Map();

    opportunities.forEach((opportunity) => {
      const resolvedOpportunity = {
        ...opportunity,
        status: getResolvedOpportunityStatus(opportunity, allCscShiftsForStatus),
      };
      const conflicts = getScheduledShiftConflicts(resolvedOpportunity, allCscShiftsForStatus);
      if (conflicts.length) map.set(opportunity.id, conflicts);
    });

    return map;
  }, [allCscShiftsForStatus, opportunities]);

  const scheduledShiftConflictGroups = useMemo(() => {
    const byDate = new Map();

    opportunities.forEach((opportunity) => {
      const conflicts = scheduledShiftConflictMap.get(opportunity.id) || [];
      if (!conflicts.length || !opportunity.eventDate) return;

      const current = byDate.get(opportunity.eventDate) || [];
      current.push({
        opportunity: {
          ...opportunity,
          status: getResolvedOpportunityStatus(opportunity, allCscShiftsForStatus),
        },
        conflicts,
      });
      byDate.set(opportunity.eventDate, current);
    });

    return Array.from(byDate.entries())
      .map(([eventDate, items]) => ({
        eventDate,
        items: items.sort((first, second) =>
          `${first.opportunity.eventTime || '99:99'}|${canonicalVenueName(first.opportunity.venue)}`.localeCompare(
            `${second.opportunity.eventTime || '99:99'}|${canonicalVenueName(second.opportunity.venue)}`
          )
        ),
      }))
      .sort((first, second) => first.eventDate.localeCompare(second.eventDate));
  }, [allCscShiftsForStatus, opportunities, scheduledShiftConflictMap]);

  const conflictDateCount = useMemo(() => {
    const dates = new Set();
    sameDateConflictGroups.forEach((group) => dates.add(group.eventDate));
    scheduledShiftConflictGroups.forEach((group) => dates.add(group.eventDate));
    return dates.size;
  }, [sameDateConflictGroups, scheduledShiftConflictGroups]);

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

  const flashMessage = (message, duration = 6000) => {
    if (saveMessageTimerRef.current) {
      window.clearTimeout(saveMessageTimerRef.current);
    }

    setSaveMessage(message);
    saveMessageTimerRef.current = window.setTimeout(() => {
      setSaveMessage('');
      saveMessageTimerRef.current = null;
    }, duration);
  };

  const syncEmailCheckReportIntoOpportunities = (report) => {
    const allShifts = readCscShifts();
    const checkedAt = report?.checkedAt || new Date().toISOString();
    const emailRows = [
      ...(Array.isArray(report?.currentShifts)
        ? report.currentShifts.map((row) => ({ ...row, emailCheckState: 'current' }))
        : []),
      ...(Array.isArray(report?.changedShifts)
        ? report.changedShifts.map((row) => ({ ...row, emailCheckState: 'changed' }))
        : []),
      ...(Array.isArray(report?.wishEssOverrides)
        ? report.wishEssOverrides.map((row) => ({ ...row, emailCheckState: 'wish-override' }))
        : []),
      ...(Array.isArray(report?.newShifts)
        ? report.newShifts.map((row) => ({ ...row, emailCheckState: 'new' }))
        : []),
    ];

    if (!emailRows.length) {
      return { added: 0, updated: 0 };
    }

    writeOpportunitySnapshot(
      'Before syncing CSC Gmail shift check into opportunities',
      opportunitiesRef.current,
      venueContactsRef.current,
      archivedOpportunitiesRef.current
    );

    let added = 0;
    let updated = 0;

    setOpportunities((current) => {
      const next = [...current];

      emailRows.forEach((row) => {
        const linkedShift =
          (row.localShiftId
            ? allShifts.find((shift) => shift.id === row.localShiftId)
            : null) ||
          findMatchingCscShift(
            {
              eventName: row.jobName || row.shiftName || '',
              venue: row.venue || '',
              eventDate: row.startDate || '',
              eventTime: row.startTime || '',
            },
            allShifts
          );

        const linkedShiftEventName = linkedShift
          ? getShiftOpportunityEventName(linkedShift)
          : '';

        const eventName = cleanCscDisplayTitle(
          linkedShiftEventName ||
            row.jobName ||
            row.shiftName ||
            'Scheduled CSC shift'
        );

        const eventDate = linkedShift?.startDate || row.startDate || '';
        const eventTime = linkedShift?.startTime || row.startTime || '';
        const expectedEndTime =
          linkedShift &&
          (!linkedShift.finishDate || linkedShift.finishDate === linkedShift.startDate)
            ? linkedShift.finishTime || ''
            : !row.finishDate || row.finishDate === row.startDate
              ? row.finishTime || ''
              : '';

        const emailDetail =
          row.emailCheckState === 'wish-override'
            ? `CSC email differs, but Wish ESS remains authoritative: ${(row.changes || []).join('; ')}`
            : row.emailCheckState === 'changed'
              ? `CSC email reports changes that are not yet confirmed by Wish ESS: ${(row.changes || []).join('; ')}`
              : row.emailCheckState === 'new'
                ? 'CSC email shows this as scheduled, but it is not confirmed in CSC Shifts or Wish ESS.'
                : 'CSC email scheduling details verified against CSC Shifts.';

        const candidate = createBlankOpportunity({
          eventName,
          venue: canonicalVenueName(linkedShift?.venue || row.venue || ''),
          eventDate,
          eventTime,
          expectedEndTime,
          status: linkedShift
            ? getOpportunityStatusFromLinkedShift(linkedShift)
            : 'Monitoring',
          linkedCscShiftId: linkedShift?.id || '',
          sourceText: `CSC Gmail shift check: ${
            row.emailSubject || 'Your Scheduling Details'
          }`,
          lastVerifiedAt: checkedAt,
          activityLog: [
            {
              id: createId('csc-opportunity-activity'),
              action:
                row.emailCheckState === 'wish-override'
                  ? 'Wish ESS retained over CSC email'
                  : row.emailCheckState === 'changed'
                    ? 'CSC email change detected'
                    : row.emailCheckState === 'new'
                      ? 'CSC email scheduled shift detected'
                      : 'CSC email scheduling verified',
              detail: emailDetail,
              createdAt: checkedAt,
            },
          ],
        });

        const matchIndex = next.findIndex((existing) => {
          if (
            candidate.linkedCscShiftId &&
            existing.linkedCscShiftId === candidate.linkedCscShiftId
          ) {
            return true;
          }

          if (areLikelyDuplicateOpportunities(existing, candidate)) {
            return true;
          }

          return (
            existing.eventDate === candidate.eventDate &&
            canonicalVenueName(existing.venue) ===
              canonicalVenueName(candidate.venue) &&
            getEventIdentityScore(existing.eventName, candidate.eventName) >= 0.72
          );
        });

        if (matchIndex >= 0) {
          const existing = next[matchIndex];
          const merged = mergeDuplicateOpportunityRecords(existing, candidate);

          next[matchIndex] = createBlankOpportunity({
            ...merged,
            id: existing.id,
            linkedCscShiftId:
              candidate.linkedCscShiftId || existing.linkedCscShiftId,
            status: candidate.linkedCscShiftId
              ? candidate.status
              : existing.status,
            lastVerifiedAt: checkedAt,
            activityLog: mergeOpportunityLogEntries(
              existing.activityLog,
              candidate.activityLog
            ),
            updatedAt: checkedAt,
          });
          updated += 1;
          return;
        }

        next.push(candidate);
        added += 1;
      });

      const deduped = dedupeOpportunityRecords(next, allShifts).opportunities;

      return archiveExpiredOpportunities(deduped).sort((first, second) =>
        `${first.eventDate || '9999-99-99'} ${first.eventTime || '99:99'}`.localeCompare(
          `${second.eventDate || '9999-99-99'} ${second.eventTime || '99:99'}`
        )
      );
    });

    return { added, updated };
  };

  const handleCheckCscEmail = async () => {
    setShowEmailCheckDrawer(true);
    setEmailCheckBusy(true);
    setEmailCheckError('');

    try {
      const messages = await fetchRecentCscSchedulingEmails();
      const report = buildCscEmailCheckReport(messages, readCscShifts());
      setEmailCheckReport(report);
      localStorage.setItem(CSC_EMAIL_CHECK_REPORT_STORAGE_KEY, JSON.stringify(report));

      const opportunitySync = syncEmailCheckReportIntoOpportunities(report);

      const wishOverrideCount = report.wishEssOverrides?.length || 0;

      flashMessage(
        report.newShifts.length || report.changedShifts.length || wishOverrideCount
          ? `CSC email check updated CSC Opportunities: ${report.newShifts.length} email-only, ${report.changedShifts.length} unconfirmed change${report.changedShifts.length === 1 ? '' : 's'}, ${wishOverrideCount} difference${wishOverrideCount === 1 ? '' : 's'} overridden by Wish ESS.`
          : `CSC email check verified CSC Opportunities against ${report.currentShifts.length} current scheduled shift${report.currentShifts.length === 1 ? '' : 's'}.`
      );
    } catch (error) {
      console.error('CSC Gmail shift check failed:', error);
      setEmailCheckError(error?.message || 'CSC email check failed.');
    } finally {
      setEmailCheckBusy(false);
    }
  };

  const saveSnapshot = (label) =>
    writeOpportunitySnapshot(
      label,
      opportunities,
      venueContacts,
      archivedOpportunities
    );

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

    if (isExcludedOpportunityEvent(prepared)) {
      flashMessage('This Rose Bowl public event is not a CSC opportunity and will not be added.');
      return;
    }

    saveSnapshot('Before CSC opportunity save');
    setOpportunities((current) => {
      const existingIndex = current.findIndex((item) => item.id === prepared.id);
      const next = [...current];
      if (existingIndex >= 0) next[existingIndex] = prepared;
      else next.unshift(prepared);
      return archiveExpiredOpportunities(next).sort((first, second) =>
        `${first.eventDate} ${first.eventTime}`.localeCompare(`${second.eventDate} ${second.eventTime}`)
      );
    });
    setShowFormDrawer(false);
    flashMessage('CSC opportunity saved.');
  };

  const handleDeleteOpportunity = (opportunity) => {
    if (!window.confirm(`Permanently delete ${opportunity.eventName}?`)) return;
    saveSnapshot('Before CSC opportunity delete');

    try {
      rememberDismissedOpportunity(opportunity);
    } catch (error) {
      console.error('Failed to remember deleted CSC opportunity:', error);
    }

    setOpportunities((current) => current.filter((item) => item.id !== opportunity.id));
    flashMessage('CSC opportunity deleted and blocked from automatic re-import.');
  };

  const handleArchiveOpportunity = (opportunity, reason = 'Archived manually') => {
    if (!opportunity?.id) return;
    saveSnapshot('Before CSC opportunity archive');
    const archivedOpportunity = createBlankOpportunity({
      ...opportunity,
      archivedAt: new Date().toISOString(),
      archiveReason: reason,
    });
    setArchivedOpportunities((current) => [
      archivedOpportunity,
      ...current.filter((item) => item.id !== opportunity.id),
    ]);
    setOpportunities((current) => current.filter((item) => item.id !== opportunity.id));
    flashMessage('CSC opportunity archived.');
  };

  const handleRestoreArchivedOpportunity = (opportunity) => {
    if (!opportunity?.id) return;
    const linkedShift = getLinkedCscShiftForOpportunity(opportunity, readCscShifts());
    if (linkedShift && isCompletedShiftStatus(linkedShift.shiftStatus)) {
      flashMessage(
        'This opportunity remains archived while its linked CSC shift is Done. Unarchive the shift first if you need to reopen the opportunity.'
      );
      return;
    }
    saveSnapshot('Before CSC opportunity restore');
    const restoredOpportunity = createBlankOpportunity({
      ...opportunity,
      archivedAt: '',
      archiveReason: '',
      status: opportunity.status === 'Completed' ? 'Monitoring' : opportunity.status,
      updatedAt: new Date().toISOString(),
    });
    setOpportunities((current) => [
      restoredOpportunity,
      ...current.filter((item) => item.id !== opportunity.id),
    ]);
    setArchivedOpportunities((current) =>
      current.filter((item) => item.id !== opportunity.id)
    );
    flashMessage('CSC opportunity restored.');
  };

  const handleDeleteArchivedOpportunity = (opportunity) => {
    if (!opportunity?.id || !window.confirm(`Permanently delete ${opportunity.eventName}?`)) {
      return;
    }
    saveSnapshot('Before archived CSC opportunity delete');
    setArchivedOpportunities((current) =>
      current.filter((item) => item.id !== opportunity.id)
    );
    flashMessage('Archived CSC opportunity permanently deleted.');
  };

  const handleLogOpportunityCall = (opportunity) => {
    const now = new Date();
    const timestamp = now.toISOString();
    const callEntry = {
      id: createId('csc-opportunity-call'),
      outcome: 'Called scheduler',
      calledAt: timestamp,
      phone: opportunity.schedulerPhone || '',
      extension: opportunity.schedulerExtension || '',
    };
    saveSnapshot('Before CSC opportunity call log update');
    updateOpportunity(opportunity.id, {
      lastCalledDate: timestamp.slice(0, 10),
      callHistory: [callEntry, ...(opportunity.callHistory || [])],
      updatedAt: timestamp,
    });
    flashMessage('Scheduler call logged for today.');
  };

  const handleUpdateNextCallDate = (opportunity, nextCallDate) => {
    const updatedAt = new Date().toISOString();
    saveSnapshot('Before CSC opportunity follow-up date update');
    updateOpportunity(opportunity.id, {
      nextCallDate,
      nextCallDateSetAt: nextCallDate ? updatedAt : '',
      updatedAt,
    });

    if (!opportunity.linkedTodoTaskId) return;
    const tasks = readStoredTodoTasks();
    const nextTasks = tasks.map((task) =>
      task.id === opportunity.linkedTodoTaskId
        ? {
            ...task,
            deadline: nextCallDate,
            updatedAt: new Date().toISOString(),
          }
        : task
    );

    try {
      localStorage.setItem(TODO_BACKUP_STORAGE_KEY, JSON.stringify(tasks));
      localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(nextTasks));
      window.dispatchEvent(new CustomEvent(TODO_UPDATE_EVENT, { detail: { tasks: nextTasks } }));
    } catch (error) {
      console.error('Failed to update linked CSC opportunity To-Do:', error);
      flashMessage('Follow-up date saved, but the linked To-Do could not be updated.');
    }
  };

  const handleCheckScheduled = (opportunity) => {
    const matchResult = getMatchingCscShiftResult(opportunity);
    const match = matchResult.match;

    if (match) {
      if (!confirmSameDateConflict(opportunity, 'link this scheduled CSC shift')) return;

      saveSnapshot('Before CSC opportunity shift link');
      const nextStatus = getOpportunityStatusFromLinkedShift(match);
      updateOpportunity(opportunity.id, {
        status: nextStatus,
        linkedCscShiftId: match.id,
        nextCallDate: nextStatus === 'Completed' ? '' : opportunity.nextCallDate || '',
      });
      flashMessage(
        nextStatus === 'Completed'
          ? `Completed CSC shift found and linked for ${opportunity.eventName}.`
          : `Scheduled shift found and linked for ${opportunity.eventName}.`
      );
      return;
    }

    if (matchResult.ambiguousMatches.length) {
      const timeOptions = matchResult.ambiguousMatches
        .map(
          (shift) =>
            `${formatTime(shift.startTime)} to ${formatTime(shift.finishTime)}${
              shift.jobName ? `, ${shift.jobName}` : ''
            }`
        )
        .join('; ');
      flashMessage(
        `Multiple CSC shifts match ${opportunity.eventName}: ${timeOptions}. Open the correct shift and link it manually.`
      );
      return;
    }

    updateOpportunity(opportunity.id, { linkedCscShiftId: '' });
    flashMessage(`No CSC shift match found for ${opportunity.eventName}.`);
  };

  const handleOpenLinkedShift = (linkedShift, opportunity) => {
    if (!linkedShift?.id) {
      flashMessage('The linked CSC shift could not be found.');
      return;
    }

    const returnContext = storeLinkedShiftReturnContext(opportunity?.id, linkedShift.id);

    navigateToAppTab('cscShifts', linkedShift.id, {
      shiftId: linkedShift.id,
      returnTab: returnContext.returnTab,
      returnRecordId: returnContext.returnRecordId,
    });
  };

  const handleCreateOrOpenTodo = (opportunity) => {
    const tasks = readStoredTodoTasks();
    const linkedTask = tasks.find((task) => task.id === opportunity.linkedTodoTaskId);

    if (linkedTask) {
      navigateToAppTab('todo', linkedTask.id);
      return;
    }

    const now = new Date().toISOString();
    const taskId = createId('todo-csc-opportunity');
    const venueDefinition = getVenueDefinition(opportunity.venue);
    const task = {
      id: taskId,
      taskName: `Follow up on ${opportunity.eventName}`,
      details: `CSC opportunity at ${cleanCscVenueDisplay(opportunity.venue)}`,
      type: 'Work',
      typeOverride: 'Work',
      date: opportunity.nextCallDate || opportunity.eventDate || '',
      deadline: opportunity.nextCallDate || opportunity.eventDate || '',
      time: opportunity.eventTime || '',
      organization: opportunity.venue || '',
      address: venueDefinition?.address || '',
      website: opportunity.eventUrl || '',
      systemLink: opportunity.eventUrl || '',
      notes: opportunity.notes || '',
      requiredAction: 'Check CSC scheduling availability and update the linked opportunity.',
      completed: false,
      completedAt: '',
      sourceOpportunityId: opportunity.id,
      createdAt: now,
      updatedAt: now,
      history: [
        {
          id: createId('todo-history'),
          action: 'Task created from CSC opportunity',
          detail: `${opportunity.eventName} at ${cleanCscVenueDisplay(opportunity.venue)}`,
          createdAt: now,
        },
      ],
    };

    try {
      localStorage.setItem(TODO_BACKUP_STORAGE_KEY, JSON.stringify(tasks));
      localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify([task, ...tasks]));
      window.dispatchEvent(new CustomEvent(TODO_UPDATE_EVENT, { detail: { tasks: [task, ...tasks] } }));
      updateOpportunity(opportunity.id, { linkedTodoTaskId: taskId });
      navigateToAppTab('todo', taskId);
    } catch (error) {
      console.error('Failed to create To-Do from CSC opportunity:', error);
      flashMessage('The follow-up task could not be created.');
    }
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

  const toggleOpportunityCard = (opportunityId) => {
    setExpandedOpportunityIds((current) => {
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

    if (!confirmSameDateConflict(shiftConflictCandidate, 'open this CSC shift draft')) return;

    const queuedShift = {
      ...shiftDraft,
      id: createId('csc-opportunity-shift'),
      finishDate: shiftDraft.finishDate || shiftDraft.startDate,
      createdFromOpportunityId: shiftDraft.opportunityId,
      linkedOpportunityId: shiftDraft.opportunityId,
    };
    delete queuedShift.opportunityId;

    try {
      sessionStorage.setItem(CSC_CREATE_DRAFT_STORAGE_KEY, JSON.stringify(queuedShift));
      setShowCreateShiftDrawer(false);
      setShiftDraft(null);
      navigateToAppTab('cscShifts');
    } catch (error) {
      console.error('Failed to queue CSC shift draft:', error);
      flashMessage('The CSC shift draft could not be opened.');
    }
  };

  const performEventWatchAutoSync = async ({ silent = false } = {}) => {
    if (eventWatchSyncInProgressRef.current) return;
    eventWatchSyncInProgressRef.current = true;

    const attemptedAt = new Date().toISOString();
    setEventWatchSyncState((current) => ({
      ...current,
      syncing: true,
      lastAttemptAt: attemptedAt,
      error: '',
    }));

    try {
      const response = await fetch(`${EVENT_WATCH_FEED_URL}?t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });

      const responseText = await response.text();
      const contentType = String(response.headers.get('content-type') || '').toLowerCase();

      if (!response.ok) {
        throw new Error(`Event Watch feed returned HTTP ${response.status}.`);
      }

      const looksLikeHtml =
        /<!doctype\s+html/i.test(responseText) ||
        /<html\b/i.test(responseText) ||
        contentType.includes('text/html');

      if (looksLikeHtml) {
        throw new Error(
          'Event Watch feed is unavailable on this server. The feed URL returned an HTML page instead of JSON.'
        );
      }

      let payload = null;

      try {
        payload = JSON.parse(responseText);
      } catch {
        throw new Error(
          'Event Watch feed returned an invalid response instead of valid JSON.'
        );
      }

      if (!payload || typeof payload !== 'object') {
        throw new Error('Event Watch feed returned an empty or invalid JSON response.');
      }

      const feedItems = (Array.isArray(payload?.events) ? payload.events : payload?.rows || [])
        .map((item) => normalizeEventWatchFeedItem(item))
        .filter(isValidEventWatchFeedItem)
        .filter((item) => !isExcludedOpportunityEvent(item));

      if (!feedItems.length) {
        throw new Error('The Event Watch feed did not contain any valid events.');
      }

      const currentOpportunities = opportunitiesRef.current.map((item) =>
        createBlankOpportunity(item)
      );
      const currentArchived = archivedOpportunitiesRef.current.map((item) =>
        createBlankOpportunity(item)
      );
      const nextOpportunities = [...currentOpportunities];
      const syncTime = new Date().toISOString();
      let added = 0;
      let updated = 0;
      let cancelled = 0;
      let verified = 0;
      let skipped = 0;
      const updateDetails = [];

      const prepareFeedOpportunity = (feedItem, defaults = {}) => {
        const definition = getVenueDefinition(feedItem.venue);
        const contact = venueContactsRef.current.find(
          (candidate) =>
            canonicalVenueName(candidate.venue) === canonicalVenueName(feedItem.venue)
        );

        return createBlankOpportunity({
          ...defaults,
          eventName: feedItem.eventName,
          venue: feedItem.venue,
          eventDate:
            defaults.eventDate !== undefined ? defaults.eventDate : feedItem.eventDate,
          eventTime:
            defaults.eventTime !== undefined ? defaults.eventTime : feedItem.eventTime,
          eventUrl: feedItem.officialUrl || defaults.eventUrl || contact?.eventUrl || '',
          schedulerName:
            defaults.schedulerName || contact?.schedulerName || definition?.schedulerName || '',
          schedulerPhone:
            defaults.schedulerPhone || contact?.schedulerPhone || definition?.schedulerPhone || '',
          schedulerExtension:
            defaults.schedulerExtension ||
            contact?.schedulerExtension ||
            definition?.schedulerExtension ||
            '',
          venueLogo: definition?.logoPath || contact?.venueLogo || defaults.venueLogo || '',
          sourceText: defaults.sourceText || 'CSC Event Watch automatic feed',
          lastScannedAt: syncTime,
          lastVerifiedAt: feedItem.lastVerifiedAt || syncTime,
          eventWatchIdentity: feedItem.identity,
          eventWatchAction: feedItem.action,
          eventWatchBatchId: feedItem.batchId,
          eventWatchLastVerifiedAt: feedItem.lastVerifiedAt || syncTime,
          eventWatchSource: 'CSC Event Watch automatic feed',
          updatedAt: syncTime,
        });
      };

      const dismissedOpportunityKeys = readDismissedOpportunityKeys();

      feedItems.forEach((feedItem) => {
        if (isDismissedOpportunity(feedItem, dismissedOpportunityKeys)) {
          skipped += 1;
          return;
        }

        const archivedIndex = getEventWatchMatchIndex(currentArchived, feedItem);
        if (archivedIndex >= 0) {
          skipped += 1;
          return;
        }

        const matchIndex = getEventWatchMatchIndex(nextOpportunities, feedItem);

        if (feedItem.action === 'cancelled') {
          if (matchIndex < 0) {
            skipped += 1;
            return;
          }

          const existing = nextOpportunities[matchIndex];
          if (normalizeOpportunityStatus(existing.status, existing.linkedCscShiftId) === 'Cancelled') {
            skipped += 1;
            return;
          }

          nextOpportunities[matchIndex] = prepareFeedOpportunity(feedItem, {
            ...existing,
            eventDate: existing.eventDate || feedItem.eventDate,
            eventTime: existing.eventTime || feedItem.eventTime,
            status: 'Cancelled',
            id: existing.id,
            createdAt: existing.createdAt,
            activityLog: [
              {
                id: createId('csc-opportunity-activity'),
                action: 'Cancelled by CSC Event Watch',
                detail: `${feedItem.eventName} at ${feedItem.venue}`,
                createdAt: syncTime,
              },
              ...(existing.activityLog || []),
            ],
          });
          cancelled += 1;
          return;
        }

        if (matchIndex >= 0) {
          const existing = nextOpportunities[matchIndex];
          const isReschedule = feedItem.action === 'rescheduled';
          const alreadyProcessed =
            String(existing.eventWatchBatchId || '') === feedItem.batchId &&
            String(existing.eventWatchIdentity || '') === feedItem.identity &&
            String(existing.eventWatchAction || '') === feedItem.action &&
            (!isReschedule ||
              (String(existing.eventDate || '') === feedItem.eventDate &&
                String(existing.eventTime || '') === feedItem.eventTime));
          if (alreadyProcessed) {
            skipped += 1;
            return;
          }

          const nextCandidate = prepareFeedOpportunity(feedItem, {
            ...existing,
            eventDate: isReschedule
              ? feedItem.eventDate || existing.eventDate
              : existing.eventDate || feedItem.eventDate,
            eventTime: isReschedule
              ? feedItem.eventTime || existing.eventTime
              : existing.eventTime || feedItem.eventTime,
            id: existing.id,
            createdAt: existing.createdAt,
            activityLog: isReschedule
              ? [
                  {
                    id: createId('csc-opportunity-activity'),
                    action: 'Rescheduled by CSC Event Watch',
                    detail: `${existing.eventDate || 'Date not entered'}${
                      existing.eventTime ? ` ${existing.eventTime}` : ''
                    } to ${feedItem.eventDate || 'Date not entered'}${
                      feedItem.eventTime ? ` ${feedItem.eventTime}` : ''
                    }`,
                    createdAt: syncTime,
                  },
                  ...(existing.activityLog || []),
                ]
              : existing.activityLog,
          });

          if (JSON.stringify(nextCandidate) === JSON.stringify(existing)) {
            skipped += 1;
          } else {
            const meaningfulChanges = getEventWatchMeaningfulChanges(
              existing,
              nextCandidate
            );

            nextOpportunities[matchIndex] = nextCandidate;

            if (meaningfulChanges.length) {
              updated += 1;
              updateDetails.push(
                formatEventWatchChangeDetail(nextCandidate, meaningfulChanges)
              );
            } else {
              verified += 1;
            }
          }
          return;
        }

        nextOpportunities.push(
          prepareFeedOpportunity(feedItem, {
            status: 'New',
            createdAt: feedItem.firstSeenAt || syncTime,
            activityLog: [
              {
                id: createId('csc-opportunity-activity'),
                action: 'Added automatically by CSC Event Watch',
                detail: `${feedItem.eventName} at ${feedItem.venue}`,
                createdAt: syncTime,
              },
            ],
          })
        );
        added += 1;
      });

      const changedCount = added + updated + cancelled;
      if (changedCount) {
        writeOpportunitySnapshot(
          'Before automatic CSC Event Watch synchronization',
          currentOpportunities,
          venueContactsRef.current,
          currentArchived
        );

        const dedupedSync = dedupeOpportunityRecords(nextOpportunities);
        const sortedNext = archiveExpiredOpportunities(
          dedupedSync.opportunities
        ).sort(
          (first, second) =>
            `${first.eventDate || '9999-99-99'} ${first.eventTime || '99:99'}`.localeCompare(
              `${second.eventDate || '9999-99-99'} ${second.eventTime || '99:99'}`
            )
        );
        opportunitiesRef.current = sortedNext;
        setOpportunities(sortedNext);
      }

      const batchIds = feedItems.map((item) => item.batchId).filter(Boolean).sort();
      const latestBatchId = batchIds.length ? batchIds[batchIds.length - 1] : '';
      const latestFeedItems = latestBatchId
        ? feedItems.filter((item) => item.batchId === latestBatchId)
        : feedItems;
      const latestReport = createEmptyEventWatchReport({
        scanDate:
          latestBatchId.replace(/^event-watch-/, '') ||
          String(payload?.generatedAt || '').trim() ||
          syncTime,
        savedAt: syncTime,
        source: 'CSC Event Watch automatic feed',
        newEvents: latestFeedItems
          .filter((item) => item.action === 'new')
          .map((item) =>
            formatOpportunityForReport({
              venue: item.venue,
              eventName: item.eventName,
              eventDate: item.eventDate,
              eventTime: item.eventTime,
            })
          ),
        rescheduledEvents: latestFeedItems
          .filter((item) => item.action === 'rescheduled')
          .map((item) =>
            formatOpportunityForReport({
              venue: item.venue,
              eventName: item.eventName,
              eventDate: item.eventDate,
              eventTime: item.eventTime,
            })
          ),
        cancelledEvents: latestFeedItems
          .filter((item) => item.action === 'cancelled')
          .map((item) =>
            formatOpportunityForReport({
              venue: item.venue,
              eventName: item.eventName,
              eventDate: item.eventDate,
              eventTime: item.eventTime,
            })
          ),
        scanStatus: [
          `Automatic sync completed: ${added} added, ${updated} updated, ${cancelled} cancelled, ${verified} verified, ${skipped} skipped.`,
          ...updateDetails.map((detail) => `Updated: ${detail}`),
        ],
      });

      localStorage.setItem(EVENT_WATCH_REPORT_STORAGE_KEY, JSON.stringify(latestReport));
      setEventWatchReport(latestReport);

      const completedState = {
        syncing: false,
        lastAttemptAt: attemptedAt,
        lastSuccessAt: syncTime,
        feedGeneratedAt: String(payload?.generatedAt || ''),
        feedCount: feedItems.length,
        added,
        updated,
        cancelled,
        verified,
        skipped,
        updateDetails,
        error: '',
      };
      setEventWatchSyncState(completedState);

      if (!silent && (added > 0 || updated > 0 || cancelled > 0)) {
        const updateSuffix =
          updated > 0 && updateDetails.length
            ? ` ${updateDetails.join(' | ')}`
            : '';

        flashMessage(
          `Event Watch synchronized automatically: ${added} added, ${updated} updated, ${cancelled} cancelled.${updateSuffix}`,
          updated > 0 ? 9000 : 6000
        );
      }
    } catch (error) {
      console.error('Failed to synchronize the CSC Event Watch feed:', error);
      const failedState = {
        syncing: false,
        lastAttemptAt: attemptedAt,
        error: error?.message || 'Event Watch synchronization failed.',
      };
      setEventWatchSyncState((current) => ({ ...current, ...failedState }));
      if (!silent) {
        flashMessage(
          failedState.error.startsWith('Event Watch feed')
            ? failedState.error
            : `Event Watch synchronization failed: ${failedState.error}`
        );
      }
    } finally {
      eventWatchSyncInProgressRef.current = false;
    }
  };

  useEffect(() => {
    const syncNow = () => {
      if (document.visibilityState === 'visible') {
        void performEventWatchAutoSync({ silent: false });
      }
    };
    const syncQuietly = () => {
      if (document.visibilityState === 'visible') {
        void performEventWatchAutoSync({ silent: true });
      }
    };

    syncNow();
    const intervalId = window.setInterval(syncQuietly, EVENT_WATCH_SYNC_INTERVAL_MS);
    window.addEventListener('focus', syncQuietly);
    document.addEventListener('visibilitychange', syncQuietly);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncQuietly);
      document.removeEventListener('visibilitychange', syncQuietly);
    };
  }, []);

  const handleScan = () => {
    const parsed = parseVenueEvents(scanText, scanVenue, scanSourceUrl);

    const contact = getContactForVenue(scanVenue);
    const withDefaults = parsed.map((item) =>
      applyVenueDefaults(
        createBlankOpportunity({
          ...item,
          venueLogo: contact?.venueLogo || item.venueLogo,
          lastScannedAt: new Date().toISOString(),
          lastVerifiedAt: new Date().toISOString(),
        }),
        item.venue
      )
    );

    const currentDate = todayIso();
    const currentOpportunities = withDefaults.filter(
      (item) =>
        !isExpiredOpportunity(item, currentDate) &&
        !isExcludedOpportunityEvent(item)
    );
    const expiredCount = withDefaults.length - currentOpportunities.length;

    const latestReport = buildLocalVenueScanReport(
      currentOpportunities,
      opportunities,
      scanVenue
    );
    try {
      localStorage.setItem(EVENT_WATCH_REPORT_STORAGE_KEY, JSON.stringify(latestReport));
      setEventWatchReport(latestReport);
    } catch (error) {
      console.error('Failed to save the latest CSC Event Watch report:', error);
    }

    setScannedOpportunities(currentOpportunities);
    flashMessage(
      currentOpportunities.length
        ? `Scanner found ${currentOpportunities.length} current event opportunit${
            currentOpportunities.length === 1 ? 'y' : 'ies'
          }.${expiredCount ? ` Skipped ${expiredCount} past event${expiredCount === 1 ? '' : 's'}.` : ''} Review before importing.`
        : expiredCount
          ? `Scanner skipped ${expiredCount} past event${expiredCount === 1 ? '' : 's'}.`
          : 'No event opportunities found. Copy the event date and event name lines from the venue page.'
    );
  };

  const openEventWatchReport = () => {
    const latestReport = loadEventWatchReport();
    setEventWatchReport(latestReport);
    setEventWatchReportText(latestReport.rawText || '');
    setShowEventWatchDrawer(true);
  };

  const handleCopyEventWatchReport = async () => {
    const hasReportData =
      eventWatchReport.scanDate ||
      eventWatchReport.newEvents.length ||
      eventWatchReport.rescheduledEvents.length ||
      eventWatchReport.cancelledEvents.length ||
      eventWatchReport.scanStatus.length;

    if (!hasReportData) {
      flashMessage('No Event Watch report is available to copy.');
      return;
    }

    const reportText = formatEventWatchReportForCopy(eventWatchReport);
    setEventWatchReportText(reportText);

    try {
      await copyTextToClipboard(reportText);
      flashMessage('All Event Watch events and report information copied.');
    } catch (error) {
      console.error('Failed to copy the CSC Event Watch report:', error);
      flashMessage('Report loaded into Upload Latest Report. Clipboard copy was unavailable.');
    }
  };

  const handleSaveEventWatchReport = () => {
    const parsedReport = parseEventWatchReportText(eventWatchReportText);
    const hasReportData =
      parsedReport.scanDate ||
      parsedReport.newEvents.length ||
      parsedReport.rescheduledEvents.length ||
      parsedReport.cancelledEvents.length ||
      parsedReport.scanStatus.length;

    if (!hasReportData) {
      flashMessage('Paste the complete Event Watch daily report before saving.');
      return;
    }

    try {
      localStorage.setItem(EVENT_WATCH_REPORT_STORAGE_KEY, JSON.stringify(parsedReport));
      setEventWatchReport(parsedReport);
      flashMessage('Latest Event Watch report saved.');
    } catch (error) {
      console.error('Failed to save the latest CSC Event Watch report:', error);
      flashMessage('The Event Watch report could not be saved.');
    }
  };

  const handleImportScanned = () => {
    if (!scannedOpportunities.length) {
      flashMessage('Scan event text before importing.');
      return;
    }

    saveSnapshot('Before CSC opportunities scan import');
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const nextOpportunities = [...opportunities];

    const dismissedOpportunityKeys = readDismissedOpportunityKeys();

    scannedOpportunities.forEach((item) => {
      if (
        isExcludedOpportunityEvent(item) ||
        isDismissedOpportunity(item, dismissedOpportunityKeys)
      ) {
        skipped += 1;
        return;
      }

      const archivedMatch = archivedOpportunities.some((candidate) =>
        areLikelyDuplicateOpportunities(candidate, item)
      );
      if (archivedMatch) {
        skipped += 1;
        return;
      }

      const duplicateIndex = nextOpportunities.findIndex((candidate) =>
        areLikelyDuplicateOpportunities(candidate, item)
      );

      if (duplicateIndex >= 0) {
        const existing = nextOpportunities[duplicateIndex];
        const merged = mergeDuplicateOpportunityRecords(existing, item);

        if (JSON.stringify(merged) === JSON.stringify(existing)) {
          skipped += 1;
        } else {
          nextOpportunities[duplicateIndex] = merged;
          updated += 1;
        }
        return;
      }

      nextOpportunities.push(createBlankOpportunity(item));
      added += 1;
    });

    setOpportunities(
      archiveExpiredOpportunities(nextOpportunities).sort((first, second) =>
        `${first.eventDate} ${first.eventTime}`.localeCompare(
          `${second.eventDate} ${second.eventTime}`
        )
      )
    );
    setScannedOpportunities([]);
    setScanText('');
    setShowScanDrawer(false);
    flashMessage(
      `Imported ${added} opportunities, updated ${updated}, skipped ${skipped} existing or archived duplicates.`
    );
  };

  const handleRemoveScanPreview = (id) => {
    setScannedOpportunities((current) => current.filter((item) => item.id !== id));
  };

  const handleUpdateScanPreview = (id, updates) => {
    setScannedOpportunities((current) =>
      current.map((item) =>
        item.id === id ? createBlankOpportunity({ ...item, ...updates, id: item.id }) : item
      )
    );
  };

  const handleExport = () => {
    downloadJson(
      {
        exportedAt: new Date().toISOString(),
        opportunities,
        archivedOpportunities,
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
        const dismissedOpportunityKeys = readDismissedOpportunityKeys();
        const incomingOpportunities = removeExcludedOpportunityRecords(
          Array.isArray(parsed.opportunities) ? parsed.opportunities : []
        ).filter(
          (item) => !isDismissedOpportunity(item, dismissedOpportunityKeys)
        );
        const incomingArchivedOpportunities = removeExcludedOpportunityRecords(
          Array.isArray(parsed.archivedOpportunities)
            ? parsed.archivedOpportunities
            : []
        );
        const incomingContacts = Array.isArray(parsed.venueContacts) ? parsed.venueContacts : [];
        saveSnapshot('Before CSC opportunities JSON import');
        const activeById = new Map(opportunities.map((item) => [item.id, item]));
        const protectedArchivedIds = new Set([
          ...archivedOpportunities.map((item) => item.id),
          ...incomingArchivedOpportunities.map((item) => item?.id).filter(Boolean),
        ]);
        incomingOpportunities.forEach((item) => {
          const normalized = createBlankOpportunity(item);
          if (protectedArchivedIds.has(normalized.id)) return;
          activeById.set(normalized.id, {
            ...(activeById.get(normalized.id) || {}),
            ...normalized,
          });
        });
        protectedArchivedIds.forEach((id) => activeById.delete(id));
        setOpportunities(
          archiveExpiredOpportunities(Array.from(activeById.values())).sort(
            (first, second) =>
              `${first.eventDate} ${first.eventTime}`.localeCompare(
                `${second.eventDate} ${second.eventTime}`
              )
          )
        );

        if (incomingArchivedOpportunities.length) {
          const archivedById = new Map(
            archivedOpportunities.map((item) => [item.id, item])
          );
          incomingArchivedOpportunities.forEach((item) => {
            const normalized = createBlankOpportunity(item);
            archivedById.set(normalized.id, {
              ...(archivedById.get(normalized.id) || {}),
              ...normalized,
            });
          });
          setArchivedOpportunities(Array.from(archivedById.values()));
        }

        if (incomingContacts.length) {
          const contactsByVenue = new Map(
            venueContacts.map((contact) => [canonicalVenueName(contact.venue), contact])
          );
          incomingContacts.forEach((contact) => {
            const key = canonicalVenueName(contact.venue);
            contactsByVenue.set(key, { ...(contactsByVenue.get(key) || {}), ...contact });
          });
          setVenueContacts(Array.from(contactsByVenue.values()));
        }
        flashMessage('CSC opportunities merged safely. Existing records were preserved.');
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

  const openPrintPreview = () => setShowPrintPreview(true);

  useEffect(() => {
    const openAdd = () => openAddOpportunity();
    const snapshot = () => handleManualSnapshot();
    const exportData = () => handleExport();
    const importData = () => importInputRef.current?.click();
    const printData = () => openPrintPreview();
    const openData = () => setShowDataScreen(true);

    window.addEventListener('csc-opportunities-toolbar:add', openAdd);
    window.addEventListener('csc-opportunities-toolbar:snapshot', snapshot);
    window.addEventListener('csc-opportunities-toolbar:save', snapshot);
    window.addEventListener('csc-opportunities-toolbar:export', exportData);
    window.addEventListener('csc-opportunities-toolbar:import', importData);
    window.addEventListener('csc-opportunities-toolbar:print', printData);
    window.addEventListener('csc-opportunities-toolbar:data', openData);

    return () => {
      window.removeEventListener('csc-opportunities-toolbar:add', openAdd);
      window.removeEventListener('csc-opportunities-toolbar:snapshot', snapshot);
      window.removeEventListener('csc-opportunities-toolbar:save', snapshot);
      window.removeEventListener('csc-opportunities-toolbar:export', exportData);
      window.removeEventListener('csc-opportunities-toolbar:import', importData);
      window.removeEventListener('csc-opportunities-toolbar:print', printData);
      window.removeEventListener('csc-opportunities-toolbar:data', openData);
    };
  }, [archivedOpportunities, opportunities, venueContacts]);

  const combinedSearch = [searchQuery, localSearch].filter(Boolean).join(' ').trim().toLowerCase();

  const filteredArchivedOpportunities = useMemo(() => {
    const query = archiveSearch.trim().toLowerCase();
    if (!query) return archivedOpportunities;
    return archivedOpportunities.filter((opportunity) =>
      buildOpportunitySearchText(opportunity, opportunity.status).includes(query)
    );
  }, [archiveSearch, archivedOpportunities]);

  const matchesSummaryFilter = (opportunity, resolvedStatus) => {
    if (summaryFilter === 'active') return isActiveOpportunityStatus(resolvedStatus);
    if (summaryFilter === 'attention') {
      return Boolean(getOpportunityAttentionState(opportunity, resolvedStatus));
    }
    if (summaryFilter === 'notes') {
      return isActiveOpportunityStatus(resolvedStatus) && Boolean(String(opportunity.notes || '').trim());
    }
    if (summaryFilter === 'upcoming') {
      return isActiveOpportunityStatus(resolvedStatus) && Boolean(opportunity.eventDate) && opportunity.eventDate >= todayIso();
    }
    if (summaryFilter === 'conflicts') {
      return (
        isActiveOpportunityStatus(resolvedStatus) &&
        (sameDateConflictMap.has(opportunity.id) || scheduledShiftConflictMap.has(opportunity.id))
      );
    }
    return true;
  };

  const handleStatusFilterChange = (nextStatus) => {
    setStatusFilter(nextStatus);
    setSummaryFilter(nextStatus === 'All' ? 'active' : '');
  };

  const applySummaryFilter = (nextSummaryFilter) => {
    if (nextSummaryFilter === 'scheduled') {
      setSummaryFilter('');
      setStatusFilter('Scheduled');
      setShowConflictSection(false);
      return;
    }

    setSummaryFilter(nextSummaryFilter);
    setStatusFilter('All');
    if (nextSummaryFilter !== 'conflicts') setShowConflictSection(false);
    if (nextSummaryFilter === 'conflicts') setShowConflictSection(true);
  };

  const summaryCardClassName = (key, colorClassName) => {
    const isActive =
      (key === 'scheduled' && statusFilter === 'Scheduled' && !summaryFilter) ||
      (key !== 'scheduled' && summaryFilter === key);

    return `csc-summary-card ${colorClassName} relative overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${
      isActive ? 'ring-2 ring-slate-950 ring-offset-2' : ''
    }`;
  };

  const monthOptions = useMemo(() => {
    const counts = new Map();

    opportunities.forEach((opportunity) => {
      const resolvedStatus = getResolvedOpportunityStatus(opportunity, allCscShiftsForStatus);

      if (excludedVenueSet.has(canonicalVenueName(opportunity.venue))) return;
      if (statusFilter === 'All' && resolvedStatus === 'Completed') return;
      if (statusFilter !== 'All' && resolvedStatus !== statusFilter) return;
      if (!matchesSummaryFilter(opportunity, resolvedStatus)) return;
      if (dateFilter && opportunity.eventDate !== dateFilter) return;

      if (combinedSearch) {
        const haystack = buildOpportunitySearchText(opportunity, resolvedStatus);

        if (!haystack.includes(combinedSearch)) return;
      }

      const monthKey = getOpportunityMonthKey(opportunity.eventDate);
      if (!monthKey) return;
      counts.set(monthKey, (counts.get(monthKey) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([monthKey, count]) => ({ monthKey, count, label: formatOpportunityMonth(monthKey) }))
      .sort((first, second) => first.monthKey.localeCompare(second.monthKey));
  }, [
    allCscShiftsForStatus,
    combinedSearch,
    dateFilter,
    opportunities,
    statusFilter,
    summaryFilter,
    excludedVenueSet,
    sameDateConflictMap,
    scheduledShiftConflictMap,
  ]);

  const opportunitiesMatchingNonMonthFilters = useMemo(() => {
    return opportunities.filter((opportunity) => {
      const resolvedStatus = getResolvedOpportunityStatus(opportunity, allCscShiftsForStatus);

      if (excludedVenueSet.has(canonicalVenueName(opportunity.venue))) return false;
      if (statusFilter === 'All' && resolvedStatus === 'Completed') return false;
      if (statusFilter !== 'All' && resolvedStatus !== statusFilter) return false;
      if (!matchesSummaryFilter(opportunity, resolvedStatus)) return false;
      if (dateFilter && opportunity.eventDate !== dateFilter) return false;
      if (!combinedSearch) return true;

      const haystack = buildOpportunitySearchText(opportunity, resolvedStatus);

      return haystack.includes(combinedSearch);
    });
  }, [
    allCscShiftsForStatus,
    combinedSearch,
    dateFilter,
    opportunities,
    statusFilter,
    summaryFilter,
    excludedVenueSet,
    sameDateConflictMap,
    scheduledShiftConflictMap,
  ]);

  const monthlyOpportunityGroups = useMemo(() => {
    const groups = new Map();

    opportunitiesMatchingNonMonthFilters.forEach((opportunity) => {
      const monthKey = getOpportunityMonthKey(opportunity.eventDate);
      if (!monthKey) return;

      const current = groups.get(monthKey) || {
        monthKey,
        label: formatOpportunityMonth(monthKey),
        opportunities: [],
        venueCounts: new Map(),
      };
      const venue = canonicalVenueName(opportunity.venue) || 'Venue not entered';

      current.opportunities.push(opportunity);
      current.venueCounts.set(venue, (current.venueCounts.get(venue) || 0) + 1);
      groups.set(monthKey, current);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        venueCounts: Array.from(group.venueCounts.entries()).sort((first, second) => first[0].localeCompare(second[0])),
      }))
      .sort((first, second) => first.monthKey.localeCompare(second.monthKey));
  }, [opportunitiesMatchingNonMonthFilters]);

  const filteredOpportunities = useMemo(() => {
    const filtered = opportunitiesMatchingNonMonthFilters.filter((opportunity) => {
      if (monthFilter === 'All') return true;
      return getOpportunityMonthKey(opportunity.eventDate) === monthFilter;
    });

    if (summaryFilter !== 'attention') return filtered;

    return [...filtered].sort((first, second) => {
      const firstStatus = getResolvedOpportunityStatus(first, allCscShiftsForStatus);
      const secondStatus = getResolvedOpportunityStatus(second, allCscShiftsForStatus);
      const firstAttention = getOpportunityAttentionState(first, firstStatus);
      const secondAttention = getOpportunityAttentionState(second, secondStatus);
      const rankDifference = (firstAttention?.rank || 99) - (secondAttention?.rank || 99);
      if (rankDifference) return rankDifference;

      const firstFollowUp = first.nextCallDate || '9999-99-99';
      const secondFollowUp = second.nextCallDate || '9999-99-99';
      if (firstFollowUp !== secondFollowUp) return firstFollowUp.localeCompare(secondFollowUp);

      return `${first.eventDate || '9999-99-99'}|${first.eventTime || '99:99'}|${first.eventName || ''}`.localeCompare(
        `${second.eventDate || '9999-99-99'}|${second.eventTime || '99:99'}|${second.eventName || ''}`
      );
    });
  }, [allCscShiftsForStatus, monthFilter, opportunitiesMatchingNonMonthFilters, summaryFilter]);

  const handleViewMonth = (monthKey) => {
    setMonthFilter(monthKey);
    setShowMonthOverview(false);
    setMonthViewRequest((current) => current + 1);
  };

  useEffect(() => {
    if (!monthViewRequest) return undefined;

    const animationFrameId = window.requestAnimationFrame(() => {
      const firstOpportunity = filteredOpportunities[0];
      const target = firstOpportunity
        ? document.getElementById(`csc-opportunity-${firstOpportunity.id}`)
        : document.getElementById('csc-opportunities-list');

      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMonthViewRequest(0);
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [filteredOpportunities, monthViewRequest]);

  const activeOpportunities = useMemo(
    () =>
      opportunities.filter(
        (item) => isActiveOpportunityStatus(getResolvedOpportunityStatus(item, allCscShiftsForStatus))
      ),
    [allCscShiftsForStatus, opportunities]
  );

  const upcomingOpportunities = useMemo(
    () => activeOpportunities.filter((item) => item.eventDate >= todayIso()),
    [activeOpportunities]
  );

  const scheduledCount = activeOpportunities.filter(
    (item) => getResolvedOpportunityStatus(item, allCscShiftsForStatus) === 'Scheduled'
  ).length;
  const attentionCount = activeOpportunities.filter((item) => {
    const resolvedStatus = getResolvedOpportunityStatus(item, allCscShiftsForStatus);
    return Boolean(getOpportunityAttentionState(item, resolvedStatus));
  }).length;
  const notesCount = activeOpportunities.filter((item) => String(item.notes || '').trim()).length;

  const printOpportunityRows = useMemo(
    () =>
      activeOpportunities
        .map((opportunity) => ({
          opportunity,
          status: getResolvedOpportunityStatus(opportunity, allCscShiftsForStatus),
          linkedShift: getLinkedCscShiftForOpportunity(opportunity, allCscShiftsForStatus),
          ambiguousMatches: getLinkedCscShiftForOpportunity(opportunity, allCscShiftsForStatus)
            ? []
            : getMatchingCscShiftResult(opportunity, allCscShiftsForStatus).ambiguousMatches,
          dateConflicts: sameDateConflictMap.get(opportunity.id) || [],
          shiftConflicts: scheduledShiftConflictMap.get(opportunity.id) || [],
        }))
        .sort((first, second) =>
          `${first.opportunity.eventDate || '9999-99-99'}|${first.opportunity.eventTime || '99:99'}|${canonicalVenueName(first.opportunity.venue)}|${first.opportunity.eventName}`.localeCompare(
            `${second.opportunity.eventDate || '9999-99-99'}|${second.opportunity.eventTime || '99:99'}|${canonicalVenueName(second.opportunity.venue)}|${second.opportunity.eventName}`
          )
        ),
    [activeOpportunities, allCscShiftsForStatus, sameDateConflictMap, scheduledShiftConflictMap]
  );

  const formatOpportunityWindow = (opportunity = {}) => {
    const start = opportunity.eventTime ? formatTime(opportunity.eventTime) : 'Time not listed';
    const finish = opportunity.expectedEndTime ? ` to ${formatTime(opportunity.expectedEndTime)}` : '';
    return `${start}${finish}`;
  };

  const formatShiftWindow = (shift = {}) => {
    const date = shift.startDate ? formatDate(shift.startDate) : 'Date not listed';
    const start = shift.startTime ? formatTime(shift.startTime) : 'Time not listed';
    const finish = shift.finishTime ? ` to ${formatTime(shift.finishTime)}` : '';
    return `${date}, ${start}${finish}`;
  };

  const escapePrintHtml = (value = '') =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const handlePrintCscEmailReport = () => {
    if (!emailCheckReport) {
      flashMessage('Run Check CSC Email before printing the report.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1200,height=850');
    if (!printWindow) {
      flashMessage('Allow pop-ups for this site to print the CSC Email Shift Check report.');
      return;
    }

    const newShifts = Array.isArray(emailCheckReport.newShifts)
      ? emailCheckReport.newShifts
      : [];
    const changedShifts = Array.isArray(emailCheckReport.changedShifts)
      ? emailCheckReport.changedShifts
      : [];
    const wishEssOverrides = Array.isArray(emailCheckReport.wishEssOverrides)
      ? emailCheckReport.wishEssOverrides
      : [];
    const currentShifts = Array.isArray(emailCheckReport.currentShifts)
      ? emailCheckReport.currentShifts
      : [];

    const formatEmailShiftFinish = (shift = {}) =>
      shift.finishTime ? formatTime(shift.finishTime) : 'Time not listed';

    const renderEmailShiftRows = (items = [], includeChanges = false) =>
      items
        .map((shift) => {
          const changes = includeChanges && Array.isArray(shift.changes)
            ? shift.changes
                .map((change) => `<div>${escapePrintHtml(change)}</div>`)
                .join('')
            : '';

          return `
            <tr>
              <td>${escapePrintHtml(cleanCscDisplayTitle(shift.jobName || 'Job not listed'))}</td>
              <td>${escapePrintHtml(canonicalVenueName(shift.venue) || shift.venue || 'Venue not listed')}</td>
              <td>${escapePrintHtml(shift.startDate ? formatDate(shift.startDate) : 'Date not listed')}</td>
              <td>${escapePrintHtml(shift.startTime ? formatTime(shift.startTime) : 'Time not listed')}</td>
              <td>${escapePrintHtml(formatEmailShiftFinish(shift))}</td>
              <td>${escapePrintHtml(cleanCscDisplayTitle(shift.shiftName || ''))}</td>
              <td>${escapePrintHtml(cleanCscDisplayTitle(shift.roleName || '', { stripNumericPrefix: false }))}</td>
              ${includeChanges ? `<td class="changes-cell">${changes || '<span class="muted">Change details not listed</span>'}</td>` : ''}
            </tr>`;
        })
        .join('');

    const renderEmailShiftSection = (title, items = [], className = '', includeChanges = false) => {
      const rows = renderEmailShiftRows(items, includeChanges);
      const columnCount = includeChanges ? 8 : 7;

      return `
        <section class="report-section ${className}">
          <h2>${escapePrintHtml(title)} <span class="count">(${items.length})</span></h2>
          ${
            rows
              ? `<table>
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Venue</th>
                      <th>Work Date</th>
                      <th>Start</th>
                      <th>Finish</th>
                      <th>Shift</th>
                      <th>Role</th>
                      ${includeChanges ? '<th>Changes</th>' : ''}
                    </tr>
                  </thead>
                  <tbody>${rows}</tbody>
                </table>`
              : `<div class="empty">None.</div>`
          }
        </section>`;
    };

    const checkedAt = emailCheckReport.checkedAt
      ? formatShortDateTime(emailCheckReport.checkedAt)
      : 'Not available';

    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>CSC Email Shift Check</title>
          <style>
            @page { size: landscape; margin: 0.32in; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              color: #0f172a;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 8pt;
              line-height: 1.2;
            }
            h1 {
              margin: 0;
              font-size: 16pt;
            }
            .meta {
              margin: 4px 0 10px;
              color: #475569;
              font-size: 8pt;
              font-weight: 700;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8px;
              margin: 0 0 12px;
            }
            .summary-card {
              border: 1px solid #94a3b8;
              padding: 7px 9px;
              border-radius: 6px;
            }
            .summary-label {
              color: #475569;
              font-size: 7pt;
              font-weight: 700;
              text-transform: uppercase;
            }
            .summary-value {
              margin-top: 2px;
              font-size: 15pt;
              font-weight: 800;
            }
            .report-section {
              margin-top: 12px;
              break-inside: auto;
            }
            h2 {
              margin: 0 0 5px;
              font-size: 11pt;
            }
            .count {
              color: #64748b;
              font-size: 9pt;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }
            thead {
              display: table-header-group;
            }
            tr {
              break-inside: avoid;
              page-break-inside: avoid;
            }
            th,
            td {
              border: 1px solid #94a3b8;
              padding: 4px 5px;
              vertical-align: top;
              overflow-wrap: anywhere;
            }
            th {
              background: #e2e8f0;
              color: #0f172a;
              font-size: 7pt;
              text-align: left;
              text-transform: uppercase;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            tbody tr:nth-child(even) td {
              background: #f8fafc;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            /*
             * Keep compact fields at predictable physical widths.
             * Job intentionally has no fixed width so it receives all remaining
             * table space and is much less likely to wrap to a second line.
             */
            th:nth-child(1), td:nth-child(1) {
              width: 350px;
              min-width: 350px;
              max-width: 350px;
              overflow-wrap: normal;
              word-break: normal;
            }
            th:nth-child(2), td:nth-child(2) { width: 1.10in; }
            th:nth-child(3), td:nth-child(3) { width: 0.78in; white-space: nowrap; }
            th:nth-child(4), td:nth-child(4) { width: 0.72in; white-space: nowrap; }
            th:nth-child(5), td:nth-child(5) { width: 0.72in; white-space: nowrap; }
            th:nth-child(6), td:nth-child(6) { width: 1.35in; }
            th:nth-child(7), td:nth-child(7) { width: 1.15in; }

            /*
             * Changed-shift reports have an eighth Changes column. Keep the
             * compact columns fixed, reserve enough room for Changes, and again
             * let Job absorb the remaining width.
             */
            .changed th:nth-child(1), .changed td:nth-child(1) {
              width: 350px;
              min-width: 350px;
              max-width: 350px;
              overflow-wrap: normal;
              word-break: normal;
            }
            .changed th:nth-child(2), .changed td:nth-child(2) { width: 1.00in; }
            .changed th:nth-child(3), .changed td:nth-child(3) { width: 0.76in; white-space: nowrap; }
            .changed th:nth-child(4), .changed td:nth-child(4) { width: 0.68in; white-space: nowrap; }
            .changed th:nth-child(5), .changed td:nth-child(5) { width: 0.68in; white-space: nowrap; }
            .changed th:nth-child(6), .changed td:nth-child(6) { width: 1.15in; }
            .changed th:nth-child(7), .changed td:nth-child(7) { width: 1.00in; }
            .changed th:nth-child(8), .changed td:nth-child(8) { width: 2.35in; }
            .changes-cell div + div {
              margin-top: 3px;
              padding-top: 3px;
              border-top: 1px dotted #cbd5e1;
            }
            .empty {
              border: 1px solid #cbd5e1;
              padding: 7px;
              color: #64748b;
            }
            .muted { color: #64748b; }
          </style>
        </head>
        <body>
          <h1>CSC Email Shift Check</h1>
          <div class="meta">
            Last checked: ${escapePrintHtml(checkedAt)}
            &nbsp; | &nbsp; Emails scanned: ${escapePrintHtml(Number(emailCheckReport.messagesScanned || 0))}
            &nbsp; | &nbsp; Upcoming rows found: ${escapePrintHtml(Number(emailCheckReport.scheduledRowsFound || 0))}
            &nbsp; | &nbsp; Printed: ${escapePrintHtml(new Date().toLocaleString('en-US'))}
          </div>

          <div class="summary">
            <div class="summary-card">
              <div class="summary-label">Missing from CSC Shifts</div>
              <div class="summary-value">${newShifts.length}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Changed Shifts</div>
              <div class="summary-value">${changedShifts.length}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Wish ESS Wins</div>
              <div class="summary-value">${wishEssOverrides.length}</div>
            </div>
            <div class="summary-card">
              <div class="summary-label">Already Current</div>
              <div class="summary-value">${currentShifts.length}</div>
            </div>
          </div>

          ${renderEmailShiftSection('Missing from CSC Shifts', newShifts, 'new')}
          ${renderEmailShiftSection('Email Changes Not Confirmed by Wish ESS', changedShifts, 'changed', true)}
          ${renderEmailShiftSection('Wish ESS Overrides CSC Email', wishEssOverrides, 'changed', true)}
          ${renderEmailShiftSection('Already Current', currentShifts, 'current')}

          <script>window.addEventListener('load', () => { window.focus(); window.print(); });<\/script>
        </body>
      </html>`);
    printWindow.document.close();
  };

  const handlePrintOpportunityList = () => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      flashMessage('Allow pop-ups for this site to print the CSC Opportunities list.');
      return;
    }

    const tableRows = printOpportunityRows
      .map(({ opportunity, status, linkedShift, ambiguousMatches, dateConflicts, shiftConflicts }) => {
        const conflictLines = [
          ...dateConflicts.map(
            (conflict) =>
              `Opportunity: ${canonicalVenueName(conflict.venue) || 'Venue not listed'}, ${conflict.eventName || 'Event not listed'}${
                conflict.eventTime ? `, ${formatTime(conflict.eventTime)}` : ''
              }, ${conflict.status || 'New'}`
          ),
          ...shiftConflicts.map(
            (shift) =>
              `CSC shift: ${canonicalVenueName(shift.venue) || 'Venue not listed'}, ${
                shift.event || shift.jobName || shift.shiftName || 'Shift'
              }, ${formatShiftWindow(shift)}`
          ),
          ...ambiguousMatches.map(
            (shift) =>
              `Possible duplicate match: ${shift.event || shift.jobName || shift.shiftName || 'CSC shift'}, ${formatShiftWindow(shift)}`
          ),
        ];
        const linkedShiftLines = linkedShift
          ? [
              linkedShift.jobName || linkedShift.event || linkedShift.shiftName || 'Linked CSC shift',
              `${linkedShift.recordSource === 'archived' ? 'Archived' : 'Active'} shift, ${linkedShift.shiftStatus || 'Scheduled'}`,
              formatShiftWindow(linkedShift),
              `Payment: ${linkedShift.paidStatus || 'Unpaid'}`,
            ]
          : ['Not linked'];

        return `
          <tr>
            <td class="date-cell"><strong>${escapePrintHtml(formatDate(opportunity.eventDate))}</strong><br>${escapePrintHtml(formatOpportunityWindow(opportunity))}</td>
            <td><strong>${escapePrintHtml(cleanCscDisplayTitle(opportunity.eventName || 'Event not entered'))}</strong></td>
            <td>${escapePrintHtml(canonicalVenueName(opportunity.venue) || 'Venue not entered')}</td>
            <td><strong>${escapePrintHtml(status)}</strong></td>
            <td class="${conflictLines.length ? 'conflict-cell' : ''}">${
              conflictLines.length
                ? conflictLines.map((line) => `<div>${escapePrintHtml(line)}</div>`).join('')
                : '<span class="muted">None</span>'
            }</td>
            <td class="${linkedShift ? 'linked-cell' : ''}">${linkedShiftLines
              .map((line, index) => `<div${index === 0 ? ' class="strong"' : ''}>${escapePrintHtml(line)}</div>`)
              .join('')}</td>
          </tr>`;
      })
      .join('');

    printWindow.document.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>CSC Opportunities List</title>
          <style>
            @page { size: landscape; margin: 0.28in; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #111827; font-family: Arial, Helvetica, sans-serif; font-size: 7.2pt; line-height: 1.16; }
            h1 { margin: 0; font-size: 13pt; }
            .summary { margin: 2px 0 7px; color: #475569; font-size: 7.5pt; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            thead { display: table-header-group; }
            tr { break-inside: avoid; page-break-inside: avoid; }
            th { padding: 3px 4px; border: 1px solid #64748b; background: #e2e8f0; color: #0f172a; font-size: 7pt; text-align: left; text-transform: uppercase; }
            td { padding: 3px 4px; border: 1px solid #94a3b8; vertical-align: top; overflow-wrap: anywhere; }
            tbody tr:nth-child(even) td { background: #f8fafc; }
            th:nth-child(1), td:nth-child(1) { width: 13%; }
            th:nth-child(2), td:nth-child(2) { width: 18%; }
            th:nth-child(3), td:nth-child(3) { width: 12%; }
            th:nth-child(4), td:nth-child(4) { width: 8%; }
            th:nth-child(5), td:nth-child(5) { width: 25%; }
            th:nth-child(6), td:nth-child(6) { width: 24%; }
            .conflict-cell { background: #fff1f2 !important; color: #881337; }
            .linked-cell { background: #ecfeff !important; }
            .strong { font-weight: 700; }
            .muted { color: #64748b; }
            td div + div { margin-top: 2px; padding-top: 2px; border-top: 1px dotted #cbd5e1; }
          </style>
        </head>
        <body>
          <h1>CSC Opportunities List</h1>
          <div class="summary">${printOpportunityRows.length} active opportunities, generated ${escapePrintHtml(
            new Date().toLocaleString('en-US')
          )}</div>
          <table>
            <thead><tr><th>Date / Time</th><th>Event</th><th>Venue</th><th>Status</th><th>Conflicts</th><th>Linked CSC Shift</th></tr></thead>
            <tbody>${tableRows || '<tr><td colspan="6">No active CSC opportunities.</td></tr>'}</tbody>
          </table>
          <script>window.addEventListener('load', () => { window.focus(); window.print(); });<\/script>
        </body>
      </html>`);
    printWindow.document.close();
  };

  const renderOpportunityCard = (opportunity) => {
    const match = getLinkedCscShiftForOpportunity(opportunity, allCscShiftsForStatus);
    const ambiguousMatches = match
      ? []
      : getMatchingCscShiftResult(opportunity, allCscShiftsForStatus).ambiguousMatches;
    const resolvedStatus = getResolvedOpportunityStatus(opportunity, allCscShiftsForStatus);
    const linkedTask = readStoredTodoTasks().find((task) => task.id === opportunity.linkedTodoTaskId) || null;
    const dateConflicts = sameDateConflictMap.get(opportunity.id) || [];
    const scheduledShiftConflicts = scheduledShiftConflictMap.get(opportunity.id) || [];
    const notesValue = notesDrafts[opportunity.id] ?? opportunity.notes ?? '';
    const notesChanged = notesValue !== (opportunity.notes ?? '');
    const notesExpanded = expandedNoteIds.has(opportunity.id);
    const notesHaveMore = overflowingNoteIds.has(opportunity.id);
    const opportunityExpanded = expandedOpportunityIds.has(opportunity.id);
    const isLinkedScheduled = Boolean(match && resolvedStatus === 'Scheduled');
    const attentionState = getOpportunityAttentionState(opportunity, resolvedStatus);

    return (
      <article
        id={`csc-opportunity-${opportunity.id}`}
        key={opportunity.id}
        className={`csc-opportunity-mobile-card overflow-visible rounded-2xl border p-4 transition-shadow hover:shadow-lg ${
          isLinkedScheduled
            ? 'border-emerald-400 bg-emerald-50 shadow-md ring-2 ring-emerald-200'
            : 'bg-white shadow-sm'
        } ${
          scheduledShiftConflicts.length || dateConflicts.length
            ? 'border-l-4 border-l-red-500'
            : match
              ? 'border-l-8 border-l-emerald-600'
              : 'border-l-4 border-l-violet-300'
        }`}
      >
        {isLinkedScheduled ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-300 bg-emerald-700 px-3 py-2.5 text-white shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarCheck2 className="h-5 w-5 shrink-0" />
              <span className="text-sm font-black uppercase tracking-wide">
                Already Scheduled
              </span>
            </div>
            <span className="rounded-full border border-emerald-200 bg-white/15 px-3 py-1 text-xs font-extrabold">
              Linked to CSC Shifts
            </span>
          </div>
        ) : null}

        <div className="csc-opportunity-top flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <VenueLogo opportunity={opportunity} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black leading-snug text-slate-950"><FormattedEventName value={opportunity.eventName} /></h3>
                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-extrabold ${
                    isLinkedScheduled
                      ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                      : getStatusClass(resolvedStatus)
                  }`}
                >
                  {resolvedStatus}
                </span>
                {attentionState ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-black ${attentionState.className}`}
                    title="This opportunity needs follow-up attention"
                  >
                    <CircleAlert className="h-3.5 w-3.5" />
                    {attentionState.label}
                  </span>
                ) : null}
                {match ? (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold text-white ${
                      isLinkedScheduled
                        ? 'bg-emerald-900 shadow-sm ring-2 ring-emerald-300'
                        : 'bg-emerald-600'
                    }`}
                  >
                    <CalendarCheck2 className="h-3.5 w-3.5" />
                    Shift Linked
                  </span>
                ) : null}
                {dateConflicts.length ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-300 bg-red-100 px-2.5 py-1 text-xs font-extrabold text-red-900">
                    <CircleAlert className="h-3.5 w-3.5" />
                    Date Conflict ({dateConflicts.length})
                  </span>
                ) : null}
                {scheduledShiftConflicts.length ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-400 bg-red-700 px-2.5 py-1 text-xs font-extrabold text-white">
                    <CircleAlert className="h-3.5 w-3.5" />
                    CSC Shift Conflict ({scheduledShiftConflicts.length})
                  </span>
                ) : null}
                {ambiguousMatches.length ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400 bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-950">
                    <CircleAlert className="h-3.5 w-3.5" />
                    Multiple Shift Matches ({ambiguousMatches.length})
                  </span>
                ) : null}
              </div>
              <p className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-700">
                <MapPin className="h-4 w-4" />
                {cleanCscVenueDisplay(opportunity.venue)}
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                <CalendarDays className="h-4 w-4" />
                {formatDate(opportunity.eventDate)}
                {opportunity.eventTime ? ` at ${formatTime(opportunity.eventTime)}` : ''}
              </p>
            </div>
          </div>

          <aside
            className={`csc-opportunity-actions relative flex w-full shrink-0 flex-wrap items-center gap-2 rounded-xl border p-2 shadow-sm lg:w-auto lg:max-w-[22rem] ${
              isLinkedScheduled
                ? 'border-emerald-300 bg-emerald-100'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="csc-opportunity-actions-grid flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {match ? (
                <button
                  type="button"
                  onClick={() => handleOpenLinkedShift(match, opportunity)}
                  className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 lg:flex-none ${
                    isLinkedScheduled
                      ? 'bg-emerald-800 hover:bg-emerald-900 focus:ring-emerald-500'
                      : 'bg-cyan-700 hover:bg-cyan-800 focus:ring-cyan-500'
                  }`}
                  title="Open linked CSC shift"
                  aria-label="Open linked CSC shift"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Open Shift</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCheckScheduled(opportunity)}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 lg:flex-none"
                  title="Find a matching CSC shift"
                  aria-label="Find a matching CSC shift"
                >
                  <RefreshCcw className="h-4 w-4" />
                  <span>Find Shift</span>
                </button>
              )}

              {!match ? (
                <button
                  type="button"
                  onClick={() => openCreateShift(opportunity)}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-extrabold text-slate-800 transition hover:border-slate-400 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 lg:flex-none"
                  title="Create CSC shift"
                  aria-label="Create CSC shift"
                >
                  <CalendarCheck2 className="h-4 w-4" />
                  <span>Create Shift</span>
                </button>
              ) : null}
            </div>

            <details className="csc-opportunity-more relative shrink-0">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-extrabold text-slate-700 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2">
                More
                <ChevronDown className="h-4 w-4" />
              </summary>
              <div className="absolute right-0 top-full z-40 mt-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                <button
                  type="button"
                  onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open');
                    handleCreateOrOpenTodo(opportunity);
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-900"
                >
                  <ListTodo className="h-4 w-4" />
                  {linkedTask ? 'Open linked To-Do' : 'Create To-Do'}
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open');
                    openEditOpportunity(opportunity);
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                >
                  <Edit3 className="h-4 w-4" />
                  Edit opportunity
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open');
                    handleArchiveOpportunity(opportunity);
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold text-violet-700 hover:bg-violet-50 hover:text-violet-900"
                >
                  <Archive className="h-4 w-4" />
                  Archive opportunity
                </button>
                <div className="my-1 border-t border-slate-200" />
                <button
                  type="button"
                  onClick={(event) => {
                    event.currentTarget.closest('details')?.removeAttribute('open');
                    handleDeleteOpportunity(opportunity);
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold text-red-700 hover:bg-red-50 hover:text-red-900"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete opportunity
                </button>
              </div>
            </details>

            <button
              type="button"
              onClick={() => toggleOpportunityCard(opportunity.id)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50 hover:text-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
              title={opportunityExpanded ? 'Collapse opportunity details' : 'Expand opportunity details'}
              aria-label={opportunityExpanded ? 'Collapse opportunity details' : 'Expand opportunity details'}
              aria-expanded={opportunityExpanded}
              aria-controls={`csc-opportunity-details-${opportunity.id}`}
            >
              <ChevronDown
                className={`h-5 w-5 transition-transform ${opportunityExpanded ? 'rotate-180' : ''}`}
              />
            </button>
          </aside>
        </div>

        {opportunityExpanded ? (
          <div id={`csc-opportunity-details-${opportunity.id}`}>
            {opportunity.eventUrl ? (
              <a
                href={opportunity.eventUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-blue-700 underline decoration-1 underline-offset-2 hover:text-blue-900"
                title={opportunity.eventUrl}
              >
                <span>Open venue event page</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              </a>
            ) : null}

            {scheduledShiftConflicts.length ? (
          <div className="mt-4 rounded-xl border-2 border-red-500 bg-red-50 p-3">
            <div className="flex items-center gap-2 text-red-950">
              <CircleAlert className="h-5 w-5 shrink-0" />
              <p className="text-sm font-black">Conflicts with a scheduled CSC shift</p>
            </div>
            <div className="mt-2 grid gap-1.5">
              {scheduledShiftConflicts.map((shift) => (
                <div
                  key={shift.id}
                  className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-950"
                >
                  <p className="font-normal">
                    <span className="font-extrabold">Conflicts with: {canonicalVenueName(shift.venue) || 'CSC shift'}</span>
                    {shift.event || shift.jobName || shift.shiftName ? `, ${shift.event || shift.jobName || shift.shiftName}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-red-800">
                    {formatDate(shift.startDate)}
                    {shift.startTime ? `, ${formatTime(shift.startTime)}` : ''}
                    {shift.finishTime ? ` to ${formatTime(shift.finishTime)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {ambiguousMatches.length ? (
          <div className="mt-4 rounded-xl border-2 border-amber-400 bg-amber-50 p-3">
            <div className="flex items-center gap-2 text-amber-950">
              <CircleAlert className="h-5 w-5 shrink-0" />
              <p className="text-sm font-black">Multiple CSC shifts match this opportunity</p>
            </div>
            <div className="mt-2 grid gap-1.5">
              {ambiguousMatches.map((shift) => (
                <div key={shift.id} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-950">
                  <p className="font-extrabold">{shift.event || shift.jobName || shift.shiftName || 'CSC shift'}</p>
                  <p className="mt-0.5 text-xs font-bold text-amber-800">{formatShiftWindow(shift)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
                  className="flex flex-col gap-2 rounded-lg bg-white px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="min-w-0 font-normal text-red-950">
                    <span className="font-extrabold">{conflict.venue}:</span>{' '}
                    <FormattedEventName value={conflict.eventName} />
                  </span>
                  <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                    <span className="text-xs font-bold text-red-800">
                      {conflict.eventTime ? formatTime(conflict.eventTime) : 'Time not listed'}
                      {conflict.status === 'Scheduled' ? ', Scheduled' : `, ${conflict.status}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteOpportunity(conflict)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 transition hover:border-red-300 hover:bg-red-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
                      title={`Delete ${conflict.eventName}`}
                      aria-label={`Delete ${conflict.eventName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="csc-opportunity-meta-grid mt-4 grid gap-3 xl:grid-cols-3">
          <div
            className={`csc-shift-card ${match ? 'csc-shift-card-linked' : 'csc-shift-card-empty'} rounded-xl border p-4 xl:col-span-2 ${
              match ? 'border-cyan-200 bg-cyan-50' : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div
              className={`csc-shift-header flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-start sm:justify-between ${
                match ? 'border-cyan-200' : 'border-slate-200'
              }`}
            >
              <div className="min-w-0">
                <p
                  className={`text-[11px] font-black uppercase tracking-wide ${
                    match ? 'text-cyan-800' : 'text-slate-500'
                  }`}
                >
                  {match ? 'Linked CSC Shift' : 'CSC Shift'}
                </p>
                <p className={`${!match ? 'csc-mobile-empty-detail' : ''} mt-1 truncate text-base font-black text-slate-950`}>
                  {match
                    ? match.jobName || match.event || 'Linked CSC shift'
                    : opportunity.linkedCscShiftId
                      ? 'Linked shift not found'
                      : 'No shift linked'}
                </p>
                <p className={`${!match ? 'csc-mobile-empty-detail' : ''} mt-1 text-sm font-semibold text-slate-600`}>
                  {match
                    ? `${formatDate(match.startDate)}${
                        match.startTime ? `, ${formatTime(match.startTime)}` : ''
                      }${match.finishTime ? ` to ${formatTime(match.finishTime)}` : ''}`
                    : 'Create or link a CSC shift when this opportunity becomes confirmed work.'}
                </p>
              </div>

              <span
                className={`${!match ? 'csc-empty-status-badge' : ''} inline-flex w-fit shrink-0 items-center rounded-full px-3 py-1 text-xs font-black ${
                  match
                    ? match.recordSource === 'archived'
                      ? 'bg-slate-700 text-white'
                      : 'bg-emerald-600 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
                title={!match ? 'Not linked' : undefined}
                aria-label={!match ? 'Not linked' : undefined}
              >
                {match ? (
                  match.recordSource === 'archived' ? 'Archived Shift' : 'Active Shift'
                ) : (
                  <>
                    <Link2Off className="csc-mobile-status-icon h-4 w-4" aria-hidden="true" />
                    <span className="csc-desktop-status-text">Not Linked</span>
                  </>
                )}
              </span>
            </div>

            {match ? (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-cyan-200 bg-white/80 p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wide text-cyan-800">Status</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{match.shiftStatus || 'Scheduled'}</p>
                  </div>
                  <div className="rounded-lg border border-cyan-200 bg-white/80 p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wide text-cyan-800">Work Time</p>
                    <p className="mt-1 text-sm font-black text-slate-950">
                      {[match.startTime ? formatTime(match.startTime) : '', match.finishTime ? formatTime(match.finishTime) : '']
                        .filter(Boolean)
                        .join(' to ') || 'Managed in CSC Shifts'}
                    </p>
                  </div>
                  <div className="rounded-lg border border-cyan-200 bg-white/80 p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wide text-cyan-800">Payment</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{match.paidStatus || 'Unpaid'}</p>
                  </div>
                  <div className="rounded-lg border border-cyan-200 bg-white/80 p-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wide text-cyan-800">Calendar</p>
                    <p className="mt-1 text-sm font-black text-slate-950">
                      {match.googleCalendarEventId || match.googleCalendarEventLink ? 'Added' : 'Not added'}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs font-semibold text-cyan-950">
                  Calendar, rides, paychecks, pay, completion, and cancellation are managed in CSC Shifts.
                </p>
              </>
            ) : null}
          </div>

          <div className="csc-followup-card rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="csc-followup-header flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Follow-Up</p>
                <p className={`${!linkedTask ? 'csc-mobile-empty-detail' : ''} mt-1 text-sm font-black text-slate-950`}>
                  {linkedTask
                    ? linkedTask.completed
                      ? 'To-Do completed'
                      : 'To-Do is open'
                    : 'No To-Do created'}
                </p>
              </div>
              <span
                className={`${!linkedTask ? 'csc-empty-status-badge' : ''} inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${
                  linkedTask
                    ? linkedTask.completed
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
                title={!linkedTask ? 'Not created' : undefined}
                aria-label={!linkedTask ? 'Not created' : undefined}
              >
                {linkedTask ? (
                  linkedTask.completed ? 'Completed' : 'Open'
                ) : (
                  <>
                    <ListX className="csc-mobile-status-icon h-4 w-4" aria-hidden="true" />
                    <span className="csc-desktop-status-text">Not Created</span>
                  </>
                )}
              </span>
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                    Scheduler Contact
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-950">
                    {opportunity.schedulerName || 'Scheduler not entered'}
                  </p>
                  <p className="text-xs font-semibold text-slate-600">
                    Last called: {opportunity.lastCalledDate ? formatDate(opportunity.lastCalledDate) : 'Not logged'}
                    {opportunity.callHistory?.length ? `, ${opportunity.callHistory.length} call${opportunity.callHistory.length === 1 ? '' : 's'} logged` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {opportunity.schedulerPhone ? (
                    <a
                      href={`tel:${opportunity.schedulerPhone.replace(/[^\d+]/g, '')}${opportunity.schedulerExtension ? `,${opportunity.schedulerExtension}` : ''}`}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-extrabold text-white hover:bg-emerald-800"
                    >
                      <Phone className="h-4 w-4" />
                      Call {opportunity.schedulerExtension ? `Ext. ${opportunity.schedulerExtension}` : 'Scheduler'}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleLogOpportunityCall(opportunity)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-100"
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    Log Call Today
                  </button>
                </div>
              </div>
              <label className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
                Next follow-up
                <input
                  type="date"
                  value={opportunity.nextCallDate || ''}
                  onChange={(event) =>
                    handleUpdateNextCallDate(opportunity, event.target.value)
                  }
                  className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal text-slate-950"
                />
                {opportunity.nextCallDate && opportunity.nextCallDate < todayIso() ? (
                  <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-extrabold text-red-800">
                    Overdue
                  </span>
                ) : null}
              </label>
            </div>

            <div className="csc-opportunity-notes pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label htmlFor={`opportunity-notes-${opportunity.id}`} className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                    Opportunity Notes
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
                rows={notesExpanded ? 5 : 2}
                wrap="soft"
                value={notesValue}
                onChange={(event) => {
                  const textarea = event.currentTarget;
                  handleNotesChange(opportunity.id, textarea.value, textarea);
                }}
                placeholder="Add notes about this event or shift opportunity..."
                className={`csc-opportunity-notes-input mt-2 w-full whitespace-pre-wrap break-words rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 [overflow-wrap:anywhere] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
                  notesExpanded ? 'resize-y overflow-auto' : 'resize-none overflow-hidden'
                }`}
              />
              {opportunity.notesUpdatedAt ? (
                <p className="mt-1 text-right text-[11px] font-semibold text-slate-500">
                  Updated {formatShortDateTime(opportunity.notesUpdatedAt)}
                </p>
              ) : null}
            </div>
          </div>
        </div>
          </div>
        ) : null}
      </article>
    );
  };

  return (
    <PageContainer surfaceClassName="min-h-screen bg-gradient-to-b from-violet-100 via-violet-50 to-slate-100">
      <div className="csc-opportunities-page flex flex-col gap-3 py-3 sm:gap-4 sm:py-4">
        <style>{`
          .csc-mobile-status-icon {
            display: none;
          }

          .csc-summary-title-mobile {
            display: none;
          }

          .csc-opportunity-more summary::-webkit-details-marker {
            display: none;
          }

          .csc-opportunity-more[open] > summary {
            border-color: #8b5cf6;
            background: #f5f3ff;
            color: #4c1d95;
          }

          .csc-opportunity-more[open] > summary svg {
            transform: rotate(180deg);
          }

          @media (prefers-reduced-motion: reduce) {
            .csc-opportunities-page *,
            .csc-opportunities-page *::before,
            .csc-opportunities-page *::after {
              scroll-behavior: auto !important;
              transition-duration: 0.01ms !important;
              animation-duration: 0.01ms !important;
              animation-iteration-count: 1 !important;
            }
          }

          @media (max-width: 639px) {
            .csc-opportunities-page {
              gap: 0.75rem;
              padding-top: 0.75rem;
              padding-bottom: 0.75rem;
            }

            .csc-opportunity-browser-heading,
            .csc-month-label {
              display: none;
            }

            .csc-opportunity-browser {
              padding: 0.625rem;
              border-radius: 1rem;
            }

            .csc-opportunity-browser-layout {
              gap: 0;
            }

            .csc-filter-grid {
              display: grid;
              width: 100%;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0.5rem;
            }

            .csc-filter-control {
              width: 100%;
              min-width: 0;
              min-height: 2.75rem;
              padding-left: 0.5rem;
              padding-right: 1.5rem;
              font-size: 0.75rem;
            }

            .csc-filter-month-button {
              width: 100%;
              min-height: 2.75rem;
              justify-content: center;
              padding: 0 0.625rem;
            }

            .csc-filter-search {
              grid-column: 1 / -1;
              min-width: 0;
            }

            .csc-filter-search input {
              width: 100%;
              min-height: 2.75rem;
            }

            .csc-summary-grid {
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 0.5rem;
            }

            .csc-summary-card:last-child {
              grid-column: 1 / -1;
            }

            .csc-summary-card {
              min-width: 0;
              min-height: 4.5rem;
              padding: 0.625rem 0.75rem;
              border-radius: 0.75rem;
              text-align: left;
              transform: none;
            }

            .csc-summary-title-desktop,
            .csc-summary-hint {
              display: none;
            }

            .csc-summary-title-mobile {
              display: inline;
            }

            .csc-summary-title {
              font-size: 0.75rem;
              line-height: 1rem;
            }

            .csc-summary-count {
              margin-top: 0.125rem;
              font-size: 1.5rem;
              line-height: 1.75rem;
            }

            .csc-opportunity-mobile-card {
              padding: 0.75rem;
            }

            .csc-opportunity-top {
              gap: 0.75rem;
            }

            .csc-opportunity-actions-title,
            .csc-opportunity-action-placeholder,
            .csc-mobile-empty-detail {
              display: none;
            }

            .csc-empty-status-badge {
              width: 2rem;
              height: 2rem;
              justify-content: center;
              padding: 0;
            }

            .csc-empty-status-badge .csc-desktop-status-text {
              display: none;
            }

            .csc-empty-status-badge .csc-mobile-status-icon {
              display: block;
            }

            .csc-opportunity-actions-grid {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              padding: 0;
            }

            .csc-opportunity-meta-grid {
              grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
              gap: 0.5rem;
              margin-top: 0.75rem;
            }

            .csc-shift-card {
              padding: 0.75rem;
            }

            .csc-shift-card-linked {
              grid-column: 1 / -1;
            }

            .csc-shift-header {
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              gap: 0.5rem;
              padding-bottom: 0;
              border-bottom-width: 0;
            }

            .csc-followup-card {
              display: contents;
            }

            .csc-followup-header {
              align-items: center;
              flex-wrap: nowrap;
              gap: 0.375rem;
              padding: 0.75rem;
              border: 1px solid #e2e8f0;
              border-radius: 0.75rem;
              background: #f8fafc;
            }

            .csc-opportunity-notes {
              grid-column: 1 / -1;
              padding: 0.75rem;
              border: 1px solid #e2e8f0;
              border-radius: 0.75rem;
              background: #f8fafc;
            }

            .csc-opportunity-notes-input {
              margin-top: 0.5rem;
              min-height: 3.25rem;
              padding: 0.5rem 0.625rem;
            }
          }
        `}</style>
        <input ref={importInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />

        {saveMessage ? (
          <div
            className="pointer-events-none fixed inset-x-3 top-4 z-[100] flex justify-center sm:inset-x-6"
            role="status"
            aria-live="polite"
          >
            <div className="pointer-events-auto flex w-full max-w-2xl items-start gap-3 rounded-2xl border border-violet-300 bg-violet-950 px-4 py-3 text-white shadow-2xl ring-1 ring-black/10 sm:px-5">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-violet-200" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-sm font-extrabold leading-5 sm:text-base">
                {saveMessage}
              </p>
              <button
                type="button"
                onClick={() => setSaveMessage('')}
                className="-mr-1 -mt-1 rounded-lg p-1.5 text-violet-100 hover:bg-white/15 hover:text-white"
                aria-label="Dismiss message"
                title="Dismiss message"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}

        <TabPageHeader
          icon={Sparkles}
          title="CSC Opportunities"
          subtitle="Events, notes, and links to CSC shifts."
          theme="violet"
          className="budget-mobile-header"
          actions={
            <div className="flex w-max flex-nowrap items-center gap-2">
              <button
                type="button"
                onClick={openAddOpportunity}
                title="Add opportunity"
                aria-label="Add opportunity"
                className={`${TAB_HEADER_ACTION_CLASS} !h-11 !w-auto !min-w-0 !gap-2 !px-2.5 !text-sm border border-slate-700 bg-slate-950 text-white shadow-sm hover:bg-slate-800`}
              >
                <Plus className="h-4 w-4" />
                <span className="csc-header-action-label">Add</span>
              </button>
              <button
                type="button"
                onClick={() => setShowScanDrawer(true)}
                title="Scan venue events"
                aria-label="Scan venue events"
                className={`${TAB_HEADER_ACTION_CLASS} !h-11 !w-auto !min-w-0 !gap-2 !px-2.5 !text-sm border border-white/30 bg-white/15 text-white hover:bg-white/25`}
              >
                <ClipboardCheck className="h-4 w-4" />
                <span className="csc-header-action-label">Scan</span>
              </button>
              <button
                type="button"
                onClick={() => void handleCheckCscEmail()}
                disabled={emailCheckBusy}
                title="Check Gmail now for new or changed CSC scheduled shifts"
                aria-label="Check Gmail now for new or changed CSC scheduled shifts"
                aria-haspopup="dialog"
                aria-expanded={showEmailCheckDrawer}
                className={`${TAB_HEADER_ACTION_CLASS} !h-11 !w-auto !min-w-0 !gap-2 !px-2.5 !text-sm border border-white/30 bg-blue-700 text-white hover:bg-blue-600 disabled:cursor-wait disabled:opacity-75`}
              >
                <RefreshCcw className={`h-4 w-4 ${emailCheckBusy ? 'animate-spin' : ''}`} />
                <span className="csc-header-action-label">Email</span>
              </button>
              <button
                type="button"
                onClick={openEventWatchReport}
                title="Show the latest venue scan report"
                aria-label="Show the latest venue scan report"
                className={`${TAB_HEADER_ACTION_CLASS} !h-11 !w-auto !min-w-0 !gap-2 !px-2.5 !text-sm border border-white/30 bg-emerald-700 text-white hover:bg-emerald-600`}
              >
                <CalendarCheck2 className="h-4 w-4" />
                <span className="csc-header-action-label">Report</span>
              </button>
              <button
                type="button"
                onClick={() => setShowArchiveDrawer(true)}
                title={`Open archived opportunities, ${archivedOpportunities.length} saved`}
                aria-label={`Open archived opportunities, ${archivedOpportunities.length} saved`}
                aria-haspopup="dialog"
                aria-expanded={showArchiveDrawer}
                className={`${TAB_HEADER_ACTION_CLASS} !h-11 !w-auto !min-w-0 !gap-2 !px-2.5 !text-sm border border-white/30 bg-violet-800 text-white hover:bg-violet-700`}
              >
                <Archive className="h-4 w-4" />
                <span className="csc-header-action-label">Archive ({archivedOpportunities.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setShowDataScreen(true)}
                title="Open CSC opportunity data and backup tools"
                aria-label="Open CSC opportunity data and backup tools"
                aria-haspopup="dialog"
                aria-expanded={showDataScreen}
                className={`${TAB_HEADER_ACTION_CLASS} !h-11 !w-auto !min-w-0 !gap-2 !px-2.5 !text-sm bg-white text-violet-900 shadow-sm hover:bg-violet-50`}
              >
                <Upload className="h-4 w-4" />
                <span className="csc-header-action-label">Data</span>
              </button>
            </div>
          }
        />

        {showDataScreen ? (
          <DataToolsScreen
            title="CSC Opportunity Data and Backups"
            subtitle="Export or import opportunities and venue contacts, or save a safety snapshot before major changes."
            onClose={() => setShowDataScreen(false)}
            tools={[
              {
                key: 'export',
                icon: Download,
                tone: 'sky',
                title: 'Export Opportunities',
                description: 'Download active and archived opportunities plus venue contacts as one JSON backup file.',
                buttonLabel: 'Export Opportunities',
                onClick: handleExport,
              },
              {
                key: 'import',
                icon: Upload,
                tone: 'indigo',
                title: 'Merge Backup',
                description: 'Merge opportunities and venue contacts from a backup without deleting current records.',
                buttonLabel: 'Choose Backup File',
                onClick: () => importInputRef.current?.click(),
              },
              {
                key: 'snapshot',
                icon: ShieldCheck,
                tone: 'emerald',
                title: 'Safety Snapshot',
                description: 'Save a local CSC Opportunities snapshot before imports or other major updates.',
                buttonLabel: 'Save Safety Snapshot',
                onClick: handleManualSnapshot,
              },
              {
                key: 'dashboard-export',
                icon: Download,
                tone: 'violet',
                title: 'Complete Dashboard Backup',
                description: 'Download all dashboard data as one JSON backup file.',
                buttonLabel: 'Export Complete Dashboard',
                onClick: () => window.dispatchEvent(new CustomEvent('dashboard-toolbar:export-all')),
              },
            ]}
          />
        ) : null}

        {showEmailCheckDrawer ? (
          <div
            className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-slate-950/55 p-3 pt-8 sm:p-6 sm:pt-12"
            role="dialog"
            aria-modal="true"
            aria-labelledby="csc-email-check-title"
          >
            <section className="w-full max-w-5xl rounded-3xl border border-blue-200 bg-white p-4 shadow-2xl sm:p-6">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 id="csc-email-check-title" className="text-xl font-black text-slate-950">
                    CSC Email Shift Check
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    Secondary scheduling check. Wish ESS is authoritative. Gmail can update Opportunity notes and detect differences, but it cannot override Wish ESS-confirmed CSC Shift details.
                  </p>
                  {emailCheckReport?.checkedAt ? (
                    <p className="mt-2 text-xs font-bold text-slate-500">
                      Last checked: {formatShortDateTime(emailCheckReport.checkedAt)} | Emails scanned: {Number(emailCheckReport.messagesScanned || 0)} | Upcoming rows found: {Number(emailCheckReport.scheduledRowsFound || 0)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCheckCscEmail()}
                    disabled={emailCheckBusy}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-extrabold text-white hover:bg-blue-800 disabled:cursor-wait disabled:opacity-70"
                  >
                    <RefreshCcw className={`h-4 w-4 ${emailCheckBusy ? 'animate-spin' : ''}`} />
                    {emailCheckBusy ? 'Checking' : 'Check Again'}
                  </button>
                  <button
                    type="button"
                    onClick={handlePrintCscEmailReport}
                    disabled={emailCheckBusy || !emailCheckReport}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 text-sm font-extrabold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Print the complete CSC Email Shift Check report"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                  <CloseScreenButton onClick={() => setShowEmailCheckDrawer(false)} />
                </div>
              </div>

              {emailCheckBusy ? (
                <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-center">
                  <RefreshCcw className="mx-auto h-7 w-7 animate-spin text-blue-700" />
                  <p className="mt-2 text-sm font-extrabold text-blue-950">Checking CSC scheduling emails...</p>
                </div>
              ) : null}

              {emailCheckError ? (
                <div className="mt-5 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-900">
                  {emailCheckError}
                </div>
              ) : null}

              {!emailCheckBusy && !emailCheckError && emailCheckReport ? (
                <>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Missing from CSC Shifts</p>
                      <p className="mt-1 text-3xl font-black text-emerald-950">{emailCheckReport.newShifts?.length || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-amber-800">Email Changes</p>
                      <p className="mt-1 text-3xl font-black text-amber-950">{emailCheckReport.changedShifts?.length || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-violet-800">Wish ESS Wins</p>
                      <p className="mt-1 text-3xl font-black text-violet-950">{emailCheckReport.wishEssOverrides?.length || 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-600">Already Current</p>
                      <p className="mt-1 text-3xl font-black text-slate-950">{emailCheckReport.currentShifts?.length || 0}</p>
                    </div>
                  </div>

                  {(emailCheckReport.wishEssOverrides?.length || 0) > 0 ? (
                    <section className="mt-5 rounded-2xl border border-violet-300 bg-violet-50 p-4">
                      <h3 className="text-base font-black text-violet-950">Wish ESS Overrides CSC Email</h3>
                      <p className="mt-1 text-sm font-semibold text-violet-800">
                        These Gmail rows disagree with CSC Shifts, but the linked Wish ESS-confirmed schedule remains unchanged.
                      </p>
                      <div className="mt-3 grid gap-2">
                        {emailCheckReport.wishEssOverrides.map((shift) => (
                          <article
                            key={`wish-override-${getCscEmailShiftIdentityKey(shift)}`}
                            className="rounded-xl border border-violet-200 bg-white p-3"
                          >
                            <p className="font-extrabold text-slate-950">
                              {cleanCscDisplayTitle(shift.jobName || 'Job not listed')} - {canonicalVenueName(shift.venue) || shift.venue || 'Venue not listed'}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-slate-700">
                              Wish ESS kept: {shift.authoritativeShift?.startDate ? formatDate(shift.authoritativeShift.startDate) : 'Date not listed'} {shift.authoritativeShift?.startTime ? formatTime(shift.authoritativeShift.startTime) : ''} to {shift.authoritativeShift?.finishTime ? formatTime(shift.authoritativeShift.finishTime) : ''}
                            </p>
                            <div className="mt-2 text-sm text-violet-900">
                              {(shift.changes || []).map((change) => (
                                <div key={change}>{change}</div>
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {(emailCheckReport.changedShifts?.length || 0) > 0 ? (
                    <section className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                      <h3 className="text-base font-black text-amber-950">Changed Scheduled Shifts</h3>
                      <div className="mt-3 overflow-x-auto rounded-xl border border-amber-200 bg-white">
                        <table className="min-w-[1050px] w-full border-collapse text-left text-sm">
                          <thead className="bg-amber-100 text-[11px] font-black uppercase tracking-wide text-amber-950">
                            <tr>
                              <th className="border-b border-r border-amber-200 px-3 py-2">Job</th>
                              <th className="border-b border-r border-amber-200 px-3 py-2">Venue</th>
                              <th className="border-b border-r border-amber-200 px-3 py-2">Work Date</th>
                              <th className="border-b border-r border-amber-200 px-3 py-2">Start</th>
                              <th className="border-b border-r border-amber-200 px-3 py-2">Finish</th>
                              <th className="border-b border-r border-amber-200 px-3 py-2">Shift</th>
                              <th className="border-b border-r border-amber-200 px-3 py-2">Role</th>
                              <th className="border-b border-amber-200 px-3 py-2">Changes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {emailCheckReport.changedShifts.map((shift) => (
                              <tr
                                key={`changed-${getCscEmailShiftIdentityKey(shift)}`}
                                className="border-b border-amber-100 last:border-b-0"
                              >
                                <td className="border-r border-amber-100 px-3 py-2 font-normal text-slate-950">
                                  {cleanCscDisplayTitle(shift.jobName || 'Job not listed')}
                                </td>
                                <td className="border-r border-amber-100 px-3 py-2 font-normal text-slate-700">
                                  {canonicalVenueName(shift.venue) || shift.venue || 'Venue not listed'}
                                </td>
                                <td className="border-r border-amber-100 px-3 py-2 font-normal text-slate-700">
                                  {shift.startDate ? formatDate(shift.startDate) : 'Date not listed'}
                                </td>
                                <td className="border-r border-amber-100 px-3 py-2 font-normal text-amber-900">
                                  {shift.startTime ? formatTime(shift.startTime) : 'Time not listed'}
                                </td>
                                <td className="border-r border-amber-100 px-3 py-2 font-normal text-amber-900">
                                  {shift.finishTime ? formatTime(shift.finishTime) : 'Time not listed'}
                                </td>
                                <td className="border-r border-amber-100 px-3 py-2 font-normal text-slate-700">
                                  {cleanCscDisplayTitle(shift.shiftName || '')}
                                </td>
                                <td className="border-r border-amber-100 px-3 py-2 font-normal text-slate-700">
                                  {cleanCscDisplayTitle(shift.roleName || '', { stripNumericPrefix: false })}
                                </td>
                                <td className="px-3 py-2 font-normal text-amber-950">
                                  {(shift.changes || []).length
                                    ? (shift.changes || []).map((change) => (
                                        <div key={change} className="border-b border-dotted border-amber-200 py-0.5 last:border-b-0">
                                          {change}
                                        </div>
                                      ))
                                    : 'Change details not listed'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ) : null}

                  {(emailCheckReport.newShifts?.length || 0) > 0 ? (
                    <section className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
                      <h3 className="text-base font-black text-emerald-950">Missing from CSC Shifts</h3>
                      <div className="mt-3 overflow-x-auto rounded-xl border border-emerald-200 bg-white">
                        <table className="min-w-[900px] w-full border-collapse text-left text-sm">
                          <thead className="bg-emerald-100 text-[11px] font-black uppercase tracking-wide text-emerald-950">
                            <tr>
                              <th className="border-b border-r border-emerald-200 px-3 py-2">Job</th>
                              <th className="border-b border-r border-emerald-200 px-3 py-2">Venue</th>
                              <th className="border-b border-r border-emerald-200 px-3 py-2">Work Date</th>
                              <th className="border-b border-r border-emerald-200 px-3 py-2">Start</th>
                              <th className="border-b border-r border-emerald-200 px-3 py-2">Finish</th>
                              <th className="border-b border-r border-emerald-200 px-3 py-2">Shift</th>
                              <th className="border-b border-emerald-200 px-3 py-2">Role</th>
                            </tr>
                          </thead>
                          <tbody>
                            {emailCheckReport.newShifts.map((shift) => (
                              <tr
                                key={`new-${getCscEmailShiftIdentityKey(shift)}`}
                                className="border-b border-emerald-100 last:border-b-0"
                              >
                                <td className="border-r border-emerald-100 px-3 py-2 font-normal text-slate-950">
                                  {cleanCscDisplayTitle(shift.jobName || 'Job not listed')}
                                </td>
                                <td className="border-r border-emerald-100 px-3 py-2 font-normal text-slate-700">
                                  {canonicalVenueName(shift.venue) || shift.venue || 'Venue not listed'}
                                </td>
                                <td className="border-r border-emerald-100 px-3 py-2 font-normal text-slate-700">
                                  {shift.startDate ? formatDate(shift.startDate) : 'Date not listed'}
                                </td>
                                <td className="border-r border-emerald-100 px-3 py-2 font-normal text-emerald-900">
                                  {shift.startTime ? formatTime(shift.startTime) : 'Time not listed'}
                                </td>
                                <td className="border-r border-emerald-100 px-3 py-2 font-normal text-emerald-900">
                                  {shift.finishTime ? formatTime(shift.finishTime) : 'Time not listed'}
                                </td>
                                <td className="border-r border-emerald-100 px-3 py-2 font-normal text-slate-700">
                                  {cleanCscDisplayTitle(shift.shiftName || '')}
                                </td>
                                <td className="px-3 py-2 font-normal text-slate-700">
                                  {cleanCscDisplayTitle(shift.roleName || '', { stripNumericPrefix: false })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ) : null}

                  {(emailCheckReport.currentShifts?.length || 0) > 0 ? (
                    <section className="mt-5 rounded-2xl border border-slate-300 bg-slate-50 p-4">
                      <h3 className="text-base font-black text-slate-950">Already Current</h3>
                      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="min-w-[900px] w-full border-collapse text-left text-sm">
                          <thead className="bg-slate-100 text-[11px] font-black uppercase tracking-wide text-slate-700">
                            <tr>
                              <th className="border-b border-r border-slate-200 px-3 py-2">Job</th>
                              <th className="border-b border-r border-slate-200 px-3 py-2">Venue</th>
                              <th className="border-b border-r border-slate-200 px-3 py-2">Work Date</th>
                              <th className="border-b border-r border-slate-200 px-3 py-2">Start</th>
                              <th className="border-b border-r border-slate-200 px-3 py-2">Finish</th>
                              <th className="border-b border-r border-slate-200 px-3 py-2">Shift</th>
                              <th className="border-b border-slate-200 px-3 py-2">Role</th>
                            </tr>
                          </thead>
                          <tbody>
                            {emailCheckReport.currentShifts.map((shift) => (
                              <tr
                                key={`current-${getCscEmailShiftIdentityKey(shift)}`}
                                className="border-b border-slate-100 last:border-b-0"
                              >
                                <td className="border-r border-slate-100 px-3 py-2 font-normal text-slate-950">
                                  {cleanCscDisplayTitle(shift.jobName || 'Job not listed')}
                                </td>
                                <td className="border-r border-slate-100 px-3 py-2 font-normal text-slate-700">
                                  {canonicalVenueName(shift.venue) || shift.venue || 'Venue not listed'}
                                </td>
                                <td className="border-r border-slate-100 px-3 py-2 font-normal text-slate-700">
                                  {shift.startDate ? formatDate(shift.startDate) : 'Date not listed'}
                                </td>
                                <td className="border-r border-slate-100 px-3 py-2 font-normal text-slate-700">
                                  {shift.startTime ? formatTime(shift.startTime) : 'Time not listed'}
                                </td>
                                <td className="border-r border-slate-100 px-3 py-2 font-normal text-slate-700">
                                  {shift.finishTime ? formatTime(shift.finishTime) : 'Time not listed'}
                                </td>
                                <td className="border-r border-slate-100 px-3 py-2 font-normal text-slate-700">
                                  {cleanCscDisplayTitle(shift.shiftName || '')}
                                </td>
                                <td className="px-3 py-2 font-normal text-slate-700">
                                  {cleanCscDisplayTitle(shift.roleName || '', { stripNumericPrefix: false })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ) : null}

                  {!emailCheckReport.newShifts?.length &&
                  !emailCheckReport.changedShifts?.length &&
                  !emailCheckReport.wishEssOverrides?.length ? (
                    <div className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-center">
                      <CalendarCheck2 className="mx-auto h-8 w-8 text-emerald-700" />
                      <p className="mt-2 text-base font-black text-emerald-950">No missing or changed upcoming CSC shifts found.</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-800">No Gmail differences remain after applying the Wish ESS authority rule.</p>
                    </div>
                  ) : null}
                </>
              ) : null}
            </section>
          </div>
        ) : null}

        <section className="csc-summary-grid grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <button
            type="button"
            onClick={() => applySummaryFilter('active')}
            aria-pressed={summaryFilter === 'active'}
            className={summaryCardClassName('active', 'border-indigo-200 bg-gradient-to-br from-white to-indigo-100 text-indigo-950')}
            title="Show active opportunities"
          >
            <p className="csc-summary-title text-sm font-bold">
              <span className="csc-summary-title-desktop">Active Opportunities</span>
              <span className="csc-summary-title-mobile">Active</span>
            </p>
            <p className="csc-summary-count mt-1 text-3xl font-black">{activeOpportunities.length}</p>
            <p className="csc-summary-hint mt-1 text-xs font-bold text-indigo-800">
              {summaryFilter === 'active' ? 'Filtered' : 'Click to filter'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => applySummaryFilter('attention')}
            aria-pressed={summaryFilter === 'attention'}
            className={summaryCardClassName('attention', 'border-orange-200 bg-gradient-to-br from-white to-orange-100 text-orange-950')}
            title="Show opportunities that need follow-up attention"
          >
            <p className="csc-summary-title text-sm font-bold">
              <span className="csc-summary-title-desktop">Needs Attention</span>
              <span className="csc-summary-title-mobile">Attention</span>
            </p>
            <p className="csc-summary-count mt-1 text-3xl font-black">{attentionCount}</p>
            <p className="csc-summary-hint mt-1 text-xs font-bold text-orange-800">
              {summaryFilter === 'attention' ? 'Filtered' : 'Click to filter'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => applySummaryFilter('notes')}
            aria-pressed={summaryFilter === 'notes'}
            className={summaryCardClassName('notes', 'border-violet-200 bg-gradient-to-br from-white to-violet-100 text-violet-950')}
            title="Show active opportunities with notes"
          >
            <p className="csc-summary-title text-sm font-bold">
              <span className="csc-summary-title-desktop">With Notes</span>
              <span className="csc-summary-title-mobile">Notes</span>
            </p>
            <p className="csc-summary-count mt-1 text-3xl font-black">{notesCount}</p>
            <p className="csc-summary-hint mt-1 text-xs font-bold text-violet-800">
              {summaryFilter === 'notes' ? 'Filtered' : 'Click to filter'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => applySummaryFilter('scheduled')}
            aria-pressed={statusFilter === 'Scheduled' && !summaryFilter}
            className={summaryCardClassName('scheduled', 'border-emerald-200 bg-gradient-to-br from-white to-emerald-100 text-emerald-950')}
            title="Show scheduled opportunities"
          >
            <p className="csc-summary-title text-sm font-bold">
              <span className="csc-summary-title-desktop">Scheduled</span>
              <span className="csc-summary-title-mobile">Scheduled</span>
            </p>
            <p className="csc-summary-count mt-1 text-3xl font-black">{scheduledCount}</p>
            <p className="csc-summary-hint mt-1 text-xs font-bold text-emerald-800">
              {statusFilter === 'Scheduled' && !summaryFilter ? 'Filtered' : 'Click to filter'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => applySummaryFilter('upcoming')}
            aria-pressed={summaryFilter === 'upcoming'}
            className={summaryCardClassName('upcoming', 'border-blue-200 bg-gradient-to-br from-white to-blue-100 text-blue-950')}
            title="Show upcoming active events"
          >
            <p className="csc-summary-title text-sm font-bold">
              <span className="csc-summary-title-desktop">Upcoming Events</span>
              <span className="csc-summary-title-mobile">Upcoming</span>
            </p>
            <p className="csc-summary-count mt-1 text-3xl font-black">{upcomingOpportunities.length}</p>
            <p className="csc-summary-hint mt-1 text-xs font-bold text-blue-800">
              {summaryFilter === 'upcoming' ? 'Filtered' : 'Click to filter'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => applySummaryFilter('conflicts')}
            aria-pressed={summaryFilter === 'conflicts'}
            aria-expanded={showConflictSection}
            aria-controls="csc-opportunity-conflicts"
            title="Show opportunity conflicts"
            className={summaryCardClassName('conflicts', 'border-red-300 bg-gradient-to-br from-white to-red-100 text-red-950')}
          >
            <p className="csc-summary-title text-sm font-bold">
              <span className="csc-summary-title-desktop">Conflict Dates</span>
              <span className="csc-summary-title-mobile">Conflicts</span>
            </p>
            <p className="csc-summary-count mt-1 text-3xl font-black">{conflictDateCount}</p>
            <p className="csc-summary-hint mt-1 text-xs font-bold text-red-800">
              {summaryFilter === 'conflicts' ? 'Filtered' : 'Click to filter'}
            </p>
          </button>
        </section>

        {conflictDateCount && showConflictSection ? (
          <section
            id="csc-opportunity-conflicts"
            className="rounded-2xl border-2 border-red-300 bg-red-50 p-5 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-6 w-6 shrink-0 text-red-700" />
              <div>
                <h2 className="text-xl font-black text-red-950">Opportunity Conflicts</h2>
                <p className="text-sm font-semibold text-red-800">
                  Conflicting opportunities remain visible in the active list with a warning on each event card.
                </p>
              </div>
            </div>
            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
              {scheduledShiftConflictGroups.map((group) => (
                <div key={`shift-${group.eventDate}`} className="rounded-xl border border-red-300 bg-white p-3">
                  <p className="font-black text-red-950">{formatDate(group.eventDate)}</p>
                  <div className="mt-2 grid gap-2">
                    {group.items.map(({ opportunity, conflicts }) => (
                      <div key={opportunity.id} className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                        <p className="text-sm font-normal text-slate-950">
                          <span className="font-extrabold">{cleanCscVenueDisplay(opportunity.venue)}:</span>{' '}
                          <FormattedEventName value={opportunity.eventName} />
                          {opportunity.eventTime ? ` at ${formatTime(opportunity.eventTime)}` : ''}
                        </p>
                        {conflicts.map((shift) => (
                          <p key={shift.id} className="mt-1 text-xs font-bold text-red-800">
                            Conflicts with: {canonicalVenueName(shift.venue) || 'CSC shift'}
                            {shift.event || shift.jobName || shift.shiftName
                              ? `, ${shift.event || shift.jobName || shift.shiftName}`
                              : ''}
                            {shift.startTime ? `, ${formatTime(shift.startTime)}` : ''}
                            {shift.finishTime ? ` to ${formatTime(shift.finishTime)}` : ''}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {sameDateConflictGroups.map((group) => (
                <div key={`venue-${group.eventDate}`} className="rounded-xl border border-red-200 bg-white p-3">
                  <p className="font-black text-red-950">{formatDate(group.eventDate)}</p>
                  <p className="mt-0.5 text-xs font-bold text-red-700">Active opportunities at multiple venues</p>
                  <div className="mt-2 grid gap-1.5">
                    {group.opportunities.map((opportunity) => (
                      <div
                        key={opportunity.id}
                        className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <span className="font-normal text-slate-950">
                          <span className="font-extrabold">{cleanCscVenueDisplay(opportunity.venue)}:</span>{' '}
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

        <section className="csc-opportunity-browser rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="csc-opportunity-browser-layout flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="csc-opportunity-browser-heading">
              <h2 className="text-xl font-black text-slate-950">Opportunity Pipeline</h2>
              <p className="text-sm text-slate-600">Find venue events, identify conflicts, and connect confirmed work to CSC Shifts.</p>
            </div>
            <div className="csc-filter-grid flex flex-wrap gap-2">
              <label className="csc-filter-search relative order-first w-full xl:w-64">
                <span className="sr-only">Search opportunities</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={localSearch}
                  onChange={(event) => setLocalSearch(event.target.value)}
                  placeholder="Search event, venue, or date"
                  aria-label="Search opportunities by event, venue, or date"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </label>
              <div className="csc-filter-date flex min-w-[11.5rem] items-center gap-1">
                <div className="relative min-w-0 flex-1">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-700" />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(event) => {
                      setDateFilter(event.target.value);
                      setMonthFilter('All');
                    }}
                    aria-label="Filter opportunities by exact date"
                    title="Choose an exact event date"
                    className="h-10 w-full rounded-lg border border-violet-200 bg-violet-50 pl-9 pr-2 text-sm font-bold text-violet-950 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                  />
                </div>
                {dateFilter ? (
                  <button
                    type="button"
                    onClick={() => setDateFilter('')}
                    aria-label="Clear selected date"
                    title="Clear selected date"
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-violet-200 bg-white text-violet-800 hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <div ref={venueFilterRef} className="csc-venue-filter-wrap relative">
                <button
                  type="button"
                  onClick={() => setShowVenueFilter((current) => !current)}
                  aria-haspopup="true"
                  aria-expanded={showVenueFilter}
                  aria-label={`Filter venues, ${venueFilterLabel}`}
                  className="csc-filter-control flex h-10 min-w-[12rem] items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-bold text-violet-950 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                >
                  <span className="truncate">{venueFilterLabel}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${showVenueFilter ? '' : 'rotate-180'}`} />
                </button>

                {showVenueFilter ? (
                  <div className="csc-venue-filter-menu absolute left-0 top-full z-50 mt-1 min-w-[15rem] overflow-hidden rounded-xl border border-violet-200 bg-white shadow-xl">
                    <label className="flex cursor-pointer items-center gap-3 border-b border-violet-100 bg-violet-50 px-3 py-2.5 font-extrabold text-violet-950 hover:bg-violet-100">
                      <input
                        ref={(input) => {
                          if (input) input.indeterminate = someVenuesSelected;
                        }}
                        type="checkbox"
                        checked={allVenuesSelected}
                        onChange={(event) => setExcludedVenues(event.target.checked ? [] : venueNames)}
                        className="h-4 w-4 rounded border-violet-300 text-violet-700 focus:ring-violet-500"
                      />
                      <span>All venues</span>
                    </label>
                    <div className="max-h-72 overflow-y-auto py-1">
                      {venueNames.map((venue) => (
                        <label key={venue} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm font-semibold text-violet-950 hover:bg-violet-50">
                          <input
                            type="checkbox"
                            checked={!excludedVenueSet.has(venue)}
                            onChange={() => toggleVenue(venue)}
                            className="h-4 w-4 rounded border-violet-300 text-violet-700 focus:ring-violet-500"
                          />
                          <span>{venue}</span>
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center justify-between border-t border-violet-100 bg-slate-50 px-3 py-2">
                      <span className="text-xs font-bold text-slate-600">{selectedVenueCount} selected</span>
                      <button
                        type="button"
                        onClick={() => setShowVenueFilter(false)}
                        className="rounded-md bg-violet-700 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-violet-800"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              <select aria-label="Filter by month" value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} className="csc-filter-control h-10 rounded-lg border border-purple-200 bg-purple-50 px-3 text-sm font-bold text-purple-950 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200">
                <option value="All">All months</option>
                {monthOptions.map((month) => (
                  <option key={month.monthKey} value={month.monthKey}>
                    {month.label} ({month.count})
                  </option>
                ))}
              </select>
              <select aria-label="Filter by status" value={statusFilter} onChange={(event) => handleStatusFilterChange(event.target.value)} className="csc-filter-control h-10 rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 text-sm font-bold text-fuchsia-950 focus:border-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-200">
                <option value="All">All statuses</option>
                {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setShowMonthOverview((current) => !current)}
                aria-expanded={showMonthOverview}
                aria-controls="csc-opportunities-month-overview"
                aria-label={showMonthOverview ? 'Hide month overview' : 'View opportunities by month'}
                title={showMonthOverview ? 'Hide month overview' : 'View opportunities by month'}
                className={`csc-filter-month-button inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-extrabold transition ${
                  showMonthOverview
                    ? 'border-violet-700 bg-violet-700 text-white hover:bg-violet-800'
                    : 'border-violet-300 bg-white text-violet-800 hover:bg-violet-50'
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                <span className="csc-month-label">{showMonthOverview ? 'Hide Months' : 'View by Month'}</span>
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
            <p className="text-sm font-bold text-slate-600" role="status" aria-live="polite">
              Showing <span className="text-slate-950">{filteredOpportunities.length}</span> of{' '}
              <span className="text-slate-950">{activeOpportunities.length}</span> active opportunities
            </p>
            {localSearch || dateFilter || excludedVenues.length || monthFilter !== 'All' || statusFilter !== 'All' || summaryFilter !== 'active' ? (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  setDateFilter('');
                  setExcludedVenues([]);
                  setMonthFilter('All');
                  setStatusFilter('All');
                  setSummaryFilter('active');
                  setShowMonthOverview(false);
                  setShowConflictSection(false);
                }}
                className="inline-flex min-h-10 items-center rounded-lg border border-violet-200 bg-violet-50 px-3 text-sm font-extrabold text-violet-800 hover:bg-violet-100"
              >
                Clear filters
              </button>
            ) : null}
          </div>

          {showMonthOverview ? (
            <div id="csc-opportunities-month-overview" className="mt-5 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 shadow-inner">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-violet-950">Opportunities by Month</h3>
                  <p className="text-sm font-medium text-slate-600">
                    {allVenuesSelected
                      ? 'Showing all venues.'
                      : `Showing ${selectedVenueCount} of ${venueNames.length} venues.`}{' '}
                    Choose a month to filter the opportunity cards below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMonthFilter('All')}
                  className={`inline-flex w-fit items-center rounded-lg px-3 py-2 text-sm font-extrabold ${
                    monthFilter === 'All'
                      ? 'bg-violet-700 text-white'
                      : 'border border-violet-300 bg-white text-violet-800 hover:bg-violet-50'
                  }`}
                >
                  All Months
                </button>
              </div>

              {monthlyOpportunityGroups.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {monthlyOpportunityGroups.map((group) => (
                    <button
                      key={group.monthKey}
                      type="button"
                      onClick={() => handleViewMonth(group.monthKey)}
                      className={`rounded-xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                        monthFilter === group.monthKey
                          ? 'border-violet-600 bg-violet-700 text-white shadow-md'
                          : 'border-violet-200 bg-white text-slate-950 hover:border-violet-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-black">{group.label}</p>
                          <p className={`mt-1 text-sm font-bold ${monthFilter === group.monthKey ? 'text-violet-100' : 'text-slate-600'}`}>
                            {group.opportunities.length} opportunit{group.opportunities.length === 1 ? 'y' : 'ies'}
                          </p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${
                          monthFilter === group.monthKey ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-900'
                        }`}>
                          View
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {group.venueCounts.map(([venue, count]) => (
                          <span
                            key={venue}
                            className={`rounded-full px-2 py-1 text-[11px] font-bold ${
                              monthFilter === group.monthKey
                                ? 'bg-white/15 text-white'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {venue}: {count}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-violet-300 bg-white/70 p-6 text-center text-sm font-bold text-slate-600">
                  No months match the current venue, status, or search filters.
                </div>
              )}
            </div>
          ) : null}

          <div id="csc-opportunities-list" className="mt-4 grid gap-4">
            {filteredOpportunities.length ? filteredOpportunities.map(renderOpportunityCard) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <CircleAlert className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-2 font-extrabold text-slate-800">No opportunities match the current filters.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {showPrintPreview ? (
        <div role="dialog" aria-modal="true" aria-labelledby="csc-opportunity-print-title" className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/70 p-3 sm:p-5">
          <div className="flex max-h-[94vh] w-full max-w-[96rem] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
              <div>
                <h3 id="csc-opportunity-print-title" className="text-xl font-black text-slate-950">CSC Opportunities List</h3>
                <p className="text-sm font-semibold text-slate-600">
                  {printOpportunityRows.length} active opportunities, compact landscape preview
                </p>
              </div>
              <CloseScreenButton onClick={() => setShowPrintPreview(false)} />
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
              <table className="w-full min-w-[1040px] table-fixed border-collapse text-[11px] leading-tight text-slate-900">
                <thead className="sticky top-0 z-10 bg-slate-200">
                  <tr>
                    <th className="w-[13%] border border-slate-400 px-2 py-2 text-left uppercase">Date / Time</th>
                    <th className="w-[18%] border border-slate-400 px-2 py-2 text-left uppercase">Event</th>
                    <th className="w-[12%] border border-slate-400 px-2 py-2 text-left uppercase">Venue</th>
                    <th className="w-[8%] border border-slate-400 px-2 py-2 text-left uppercase">Status</th>
                    <th className="w-[25%] border border-slate-400 px-2 py-2 text-left uppercase">Conflicts</th>
                    <th className="w-[24%] border border-slate-400 px-2 py-2 text-left uppercase">Linked CSC Shift</th>
                  </tr>
                </thead>
                <tbody>
                  {printOpportunityRows.length ? (
                    printOpportunityRows.map(({ opportunity, status, linkedShift, ambiguousMatches, dateConflicts, shiftConflicts }) => (
                      <tr key={opportunity.id} className="odd:bg-white even:bg-slate-50">
                        <td className="border border-slate-300 px-2 py-1.5 align-top">
                          <div className="font-extrabold">{formatDate(opportunity.eventDate)}</div>
                          <div>{formatOpportunityWindow(opportunity)}</div>
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 align-top font-extrabold">
                          <FormattedEventName value={opportunity.eventName || 'Event not entered'} />
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 align-top">
                          {canonicalVenueName(opportunity.venue) || 'Venue not entered'}
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 align-top font-extrabold">{status}</td>
                        <td className={`border border-slate-300 px-2 py-1.5 align-top ${dateConflicts.length || shiftConflicts.length || ambiguousMatches.length ? 'bg-rose-50 text-rose-950' : 'text-slate-500'}`}>
                          {dateConflicts.map((conflict) => (
                            <div key={`opportunity-${conflict.id}`} className="border-b border-dotted border-rose-200 pb-1 last:border-0 last:pb-0">
                              <strong>Opportunity:</strong> {canonicalVenueName(conflict.venue)}, <FormattedEventName value={conflict.eventName} />
                              {conflict.eventTime ? `, ${formatTime(conflict.eventTime)}` : ''}, {conflict.status || 'New'}
                            </div>
                          ))}
                          {shiftConflicts.map((shift) => (
                            <div key={`shift-${shift.id}`} className="border-b border-dotted border-rose-200 py-1 last:border-0 last:pb-0">
                              <strong>CSC shift:</strong> {canonicalVenueName(shift.venue)}, {shift.event || shift.jobName || shift.shiftName || 'Shift'}, {formatShiftWindow(shift)}
                            </div>
                          ))}
                          {ambiguousMatches.map((shift) => (
                            <div key={`ambiguous-${shift.id}`} className="border-b border-dotted border-amber-200 py-1 last:border-0 last:pb-0">
                              <strong>Possible duplicate:</strong> {shift.event || shift.jobName || shift.shiftName || 'CSC shift'}, {formatShiftWindow(shift)}
                            </div>
                          ))}
                          {!dateConflicts.length && !shiftConflicts.length && !ambiguousMatches.length ? 'None' : null}
                        </td>
                        <td className={`border border-slate-300 px-2 py-1.5 align-top ${linkedShift ? 'bg-cyan-50' : 'text-slate-500'}`}>
                          {linkedShift ? (
                            <>
                              <div className="font-extrabold">{linkedShift.jobName || linkedShift.event || linkedShift.shiftName || 'Linked CSC shift'}</div>
                              <div>{linkedShift.recordSource === 'archived' ? 'Archived' : 'Active'} shift, {linkedShift.shiftStatus || 'Scheduled'}</div>
                              <div>{formatShiftWindow(linkedShift)}</div>
                              <div>Payment: {linkedShift.paidStatus || 'Unpaid'}</div>
                            </>
                          ) : 'Not linked'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} className="border border-slate-300 p-6 text-center font-bold text-slate-600">No active CSC opportunities.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
              <button type="button" onClick={() => setShowPrintPreview(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-100">Close</button>
              <button type="button" onClick={handlePrintOpportunityList} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-indigo-800">
                <Printer className="h-4 w-4" />
                Print List
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showEventWatchDrawer ? (
        <div role="dialog" aria-modal="true" aria-labelledby="csc-event-watch-title" className="fixed inset-0 z-[90] flex justify-end bg-slate-950/60">
          <div className="h-full w-full max-w-3xl overflow-y-auto bg-slate-50 p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-800">
                  <CalendarCheck2 className="h-6 w-6" />
                  <h3 id="csc-event-watch-title" className="text-2xl font-black text-slate-950">Latest Event Watch Report</h3>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {eventWatchReport.scanDate
                    ? `Scan date: ${eventWatchReport.scanDate}`
                    : 'No Event Watch report has been saved yet.'}
                </p>
                {eventWatchReport.source ? (
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Source: {eventWatchReport.source}
                    {eventWatchReport.savedAt
                      ? ` | Saved ${formatShortDateTime(eventWatchReport.savedAt)}`
                      : ''}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopyEventWatchReport()}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-700 bg-white px-4 py-2 text-sm font-extrabold text-emerald-800 hover:bg-emerald-50"
                  title="Copy all events and report information"
                >
                  <Copy className="h-4 w-4" />
                  Copy Events
                </button>
                <CloseScreenButton onClick={() => setShowEventWatchDrawer(false)} />
              </div>
            </div>

            <section className="mt-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-base font-black text-emerald-950">
                    Automatic Opportunity Import
                  </h4>
                  <p className="mt-1 text-sm font-semibold text-emerald-900">
                    Event Watch checks for feed changes when this page opens, regains focus, and every five minutes while visible.
                  </p>
                  <p className="mt-2 text-xs font-bold text-emerald-800">
                    {eventWatchSyncState.lastSuccessAt
                      ? `Last successful sync: ${formatShortDateTime(eventWatchSyncState.lastSuccessAt)}`
                      : 'No successful automatic sync has completed yet.'}
                  </p>
                  {eventWatchSyncState.lastSuccessAt ? (
                    <p className="mt-1 text-xs font-bold text-emerald-800">
                      {Number(eventWatchSyncState.added || 0)} added,{' '}
                      {Number(eventWatchSyncState.updated || 0)} updated,{' '}
                      {Number(eventWatchSyncState.cancelled || 0)} cancelled,{' '}
                      {Number(eventWatchSyncState.verified || 0)} verified,{' '}
                      {Number(eventWatchSyncState.skipped || 0)} skipped
                    </p>
                  ) : null}
                  {Array.isArray(eventWatchSyncState.updateDetails) &&
                  eventWatchSyncState.updateDetails.length ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-white p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-amber-900">
                        What changed
                      </p>
                      <ul className="mt-2 space-y-1 text-xs font-semibold text-slate-800">
                        {eventWatchSyncState.updateDetails.map((detail, index) => (
                          <li key={`${detail}-${index}`} className="leading-5">
                            • {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {eventWatchSyncState.error ? (
                    <p className="mt-2 text-sm font-extrabold text-red-700">
                      {eventWatchSyncState.error}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void performEventWatchAutoSync({ silent: false })}
                  disabled={Boolean(eventWatchSyncState.syncing)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-70"
                >
                  <RefreshCcw
                    className={`h-4 w-4 ${eventWatchSyncState.syncing ? 'animate-spin' : ''}`}
                  />
                  {eventWatchSyncState.syncing ? 'Syncing' : 'Sync Now'}
                </button>
              </div>
            </section>

            <div className="mt-5 grid gap-4">
              {[
                {
                  title: 'New Events',
                  items: eventWatchReport.newEvents,
                  className: 'border-emerald-200 bg-emerald-50',
                  titleClassName: 'text-emerald-950',
                },
                {
                  title: 'Rescheduled Events',
                  items: eventWatchReport.rescheduledEvents,
                  className: 'border-amber-200 bg-amber-50',
                  titleClassName: 'text-amber-950',
                },
                {
                  title: 'Cancelled Events',
                  items: eventWatchReport.cancelledEvents,
                  className: 'border-red-200 bg-red-50',
                  titleClassName: 'text-red-950',
                },
                {
                  title: 'Scan Status',
                  items: eventWatchReport.scanStatus,
                  className: 'border-blue-200 bg-blue-50',
                  titleClassName: 'text-blue-950',
                },
              ].map((section) => (
                <section key={section.title} className={`rounded-2xl border p-4 ${section.className}`}>
                  <div className="flex items-center justify-between gap-3">
                    <h4 className={`text-base font-black ${section.titleClassName}`}>
                      {section.title}
                    </h4>
                    <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-black text-slate-700">
                      {section.items.length}
                    </span>
                  </div>
                  {section.items.length ? (
                    <ul className="mt-3 grid gap-2">
                      {section.items.map((item, index) => (
                        <li
                          key={`${section.title}-${index}-${item}`}
                          className="rounded-xl border border-white/80 bg-white/75 px-3 py-2 text-sm font-semibold leading-6 text-slate-800"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm font-bold text-slate-600">None.</p>
                  )}
                </section>
              ))}
            </div>

            <section className="mt-5 rounded-2xl border border-slate-300 bg-white p-4">
              <h4 className="text-base font-black text-slate-950">Upload Latest Report</h4>
              <p className="mt-1 text-sm font-medium text-slate-600">
                Copy Events loads the complete displayed report into this box and copies it to the clipboard. You can also paste a newer report manually, then save it below.
              </p>
              <textarea
                rows={10}
                value={eventWatchReportText}
                onChange={(event) => setEventWatchReportText(event.target.value)}
                className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm leading-6"
                placeholder={'CSC Event Watch - Daily Scan Summary\nScan date: August 4, 2026\n\nNEW EVENTS\nNone.\n\nRESCHEDULED EVENTS\nNone.\n\nCANCELLED EVENTS\nNone.\n\nSCAN STATUS\nSuccessfully checked: Kia Forum'}
              />
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEventWatchDrawer(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveEventWatchReport}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-extrabold text-white hover:bg-emerald-800"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Save Latest Report
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {showArchiveDrawer ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="csc-opportunity-archive-title"
          className="fixed inset-0 z-[92] flex justify-end bg-slate-950/60"
        >
          <div className="flex h-full w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
              <div>
                <h3 id="csc-opportunity-archive-title" className="text-2xl font-black text-slate-950">
                  Archived CSC Opportunities
                </h3>
                <p className="text-sm text-slate-600">
                  Completed, expired, and manually archived opportunities remain recoverable.
                </p>
              </div>
              <CloseScreenButton onClick={() => setShowArchiveDrawer(false)} />
            </div>
            <div className="border-b border-slate-200 bg-slate-50 p-4 sm:px-6">
              <label className="relative block">
                <span className="sr-only">Search archived opportunities</span>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={archiveSearch}
                  onChange={(event) => setArchiveSearch(event.target.value)}
                  placeholder="Search archived event, venue, date, or reason"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
                />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              {filteredArchivedOpportunities.length ? (
                <div className="grid gap-3">
                  {filteredArchivedOpportunities.map((opportunity) => (
                    <article key={opportunity.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h4 className="break-words text-base font-black text-slate-950">
                            {opportunity.eventName || 'Event not entered'}
                          </h4>
                          <p className="mt-1 text-sm font-bold text-slate-700">
                            {opportunity.venue || 'Venue not entered'}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {opportunity.eventDate ? formatDate(opportunity.eventDate) : 'Date not entered'}
                            {opportunity.eventTime ? ` at ${formatTime(opportunity.eventTime)}` : ''}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {opportunity.archiveReason || 'Archived'}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleRestoreArchivedOpportunity(opportunity)}
                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-extrabold text-white hover:bg-emerald-800"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteArchivedOpportunity(opportunity)}
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-extrabold text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-600">
                  No archived opportunities match this search.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showFormDrawer ? (
        <div role="dialog" aria-modal="true" aria-labelledby="csc-opportunity-form-title" className="fixed inset-0 z-[80] flex justify-end bg-slate-950/60">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="csc-opportunity-form-title" className="text-2xl font-black text-slate-950">CSC Opportunity</h3>
                <p className="text-sm text-slate-600">Enter the venue event details and notes.</p>
              </div>
              <CloseScreenButton onClick={() => setShowFormDrawer(false)} />
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
                <select
                  value={editingOpportunity.linkedCscShiftId ? editingOpportunity.status || 'Scheduled' : editingOpportunity.status}
                  disabled={Boolean(editingOpportunity.linkedCscShiftId)}
                  onChange={(event) => setEditingOpportunity((current) => ({ ...current, status: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-600"
                >
                  {editingOpportunity.linkedCscShiftId ? (
                    <option value={editingOpportunity.status || 'Scheduled'}>
                      {editingOpportunity.status || 'Scheduled'}, managed by CSC Shifts
                    </option>
                  ) : (
                    EDITABLE_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)
                  )}
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
              <label className="text-sm font-bold text-slate-700">Scheduler name
                <input value={editingOpportunity.schedulerName} onChange={(event) => setEditingOpportunity((current) => ({ ...current, schedulerName: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-bold text-slate-700">Scheduler phone
                <input type="tel" value={editingOpportunity.schedulerPhone} onChange={(event) => setEditingOpportunity((current) => ({ ...current, schedulerPhone: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-bold text-slate-700">Scheduler extension
                <input value={editingOpportunity.schedulerExtension} onChange={(event) => setEditingOpportunity((current) => ({ ...current, schedulerExtension: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
              </label>
              <label className="text-sm font-bold text-slate-700">Next follow-up date
                <input type="date" value={editingOpportunity.nextCallDate} onChange={(event) => setEditingOpportunity((current) => ({ ...current, nextCallDate: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
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
        <div role="dialog" aria-modal="true" aria-labelledby="csc-opportunity-scan-title" className="fixed inset-0 z-[80] flex justify-end bg-slate-950/60">
          <div className="h-full w-full max-w-3xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="csc-opportunity-scan-title" className="text-2xl font-black text-slate-950">Scan Venue Events</h3>
                <p className="text-sm text-slate-600">Open the venue page, copy the event listings, paste them here, then review before importing.</p>
              </div>
              <CloseScreenButton onClick={() => setShowScanDrawer(false)} />
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
                    <div key={opportunity.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-extrabold text-slate-950">{cleanCscVenueDisplay(opportunity.venue)}</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem_8rem]">
                          <label className="text-xs font-bold text-slate-600">
                            Event
                            <input
                              value={opportunity.eventName}
                              onChange={(event) =>
                                handleUpdateScanPreview(opportunity.id, { eventName: event.target.value })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-950"
                            />
                          </label>
                          <label className="text-xs font-bold text-slate-600">
                            Date
                            <input
                              type="date"
                              value={opportunity.eventDate}
                              onChange={(event) =>
                                handleUpdateScanPreview(opportunity.id, { eventDate: event.target.value })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-950"
                            />
                          </label>
                          <label className="text-xs font-bold text-slate-600">
                            Time
                            <input
                              type="time"
                              value={opportunity.eventTime || ''}
                              onChange={(event) =>
                                handleUpdateScanPreview(opportunity.id, { eventTime: event.target.value })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-950"
                            />
                          </label>
                        </div>
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
        <div role="dialog" aria-modal="true" aria-labelledby="csc-opportunity-create-shift-title" className="fixed inset-0 z-[85] flex justify-end bg-slate-950/60">
          <div className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="csc-opportunity-create-shift-title" className="text-2xl font-black text-slate-950">Create CSC Shift</h3>
                <p className="text-sm text-slate-600">Confirm the exact shift window before creating the CSC shift.</p>
              </div>
              <CloseScreenButton onClick={() => setShowCreateShiftDrawer(false)} />
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
  parseShrineEvents,
  parseNovoEvents,
  parseLongBeachAmphitheaterEvents,
  parseLongBeachConventionCenterEvents,
  parseRoxyEvents,
  parseYouTubeTheaterEvents,
  parseVenueEvents,
  parseEventWatchReportText,
  formatEventWatchReportForCopy,
  buildLocalVenueScanReport,
  findMatchingCscShift,
  getScheduledShiftConflicts,
};
export default CscOpportunitiesTab;
