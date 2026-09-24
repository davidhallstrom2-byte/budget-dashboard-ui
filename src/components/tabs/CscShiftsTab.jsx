import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Archive,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CalendarPlus,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Download,
  Eraser,
  Edit3,
  ExternalLink,
  FileUp,
  GripVertical,
  History,
  ListChecks,
  MapPin,
  Phone,
  Plus,
  Printer,
  PanelRightOpen,
  RotateCcw,
  Search,
  Sparkles,
  StickyNote,
  Table2,
  Trash2,
  X
} from 'lucide-react';
import PageContainer from '../common/PageContainer.jsx';
import TabPageHeader, { TAB_HEADER_ACTION_CLASS } from '../common/TabPageHeader.jsx';
import CloseScreenButton from '../common/CloseScreenButton.jsx';
import DataToolsScreen from '../common/DataToolsScreen.jsx';
import CollapseToggleButton from '../common/CollapseToggleButton.jsx';
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  ensureGoogleCalendarEventLabel,
  listGoogleCalendarEvents,
  updateGoogleCalendarEvent,
} from '../../utils/googleCalendarApi';
import { reconcileStoredCscShiftsWithPaychecks } from '../../utils/cscPaycheckReconciliation.js';
import { cleanCscDisplayTitle, cleanCscVenueDisplay, formatAppShortDate } from '../../utils/cscDisplay.js';

const CSC_STORAGE_KEY = 'cscShifts.v1';
const CSC_ARCHIVE_STORAGE_KEY = 'cscShifts.archived.v1';
const CSC_DELETED_SEED_STORAGE_KEY = 'cscShifts.deletedSeedIds.v1';
const CSC_SNAPSHOT_STORAGE_KEY = 'cscShifts.safetySnapshot.v1';
const CSC_SEPT_1_2026_RECOVERY_STORAGE_KEY = 'cscShifts.recovery.2026-09-01-sofi-bts.v1';
const CSC_CALENDAR_ADDED_STORAGE_KEY = 'cscShifts.googleCalendarAdded.v1';
const CSC_WISH_ESS_LATEST_STORAGE_KEY = 'cscShifts.wishEssLatest.v1';
const CSC_SHIFT_UPDATE_EVENT = 'cscShifts:updated';
const CSC_OPEN_SHIFT_STORAGE_KEY = 'cscShifts.openLinkedShiftId.v1';
const CSC_RETURN_CONTEXT_STORAGE_KEY = 'cscShifts.returnContext.v1';
const CSC_CREATE_DRAFT_STORAGE_KEY = 'cscShifts.createDraftFromOpportunity.v1';
const CSC_OPPORTUNITIES_STORAGE_KEY = 'cscOpportunities.v1';
const CSC_OPPORTUNITIES_UPDATE_EVENT = 'cscOpportunities:updated';
const CSC_OPPORTUNITY_OPEN_STORAGE_KEY = 'cscOpportunities.openLinkedOpportunityId.v1';
const RIDES_STORAGE_KEY = 'modivcareRides.v1';
const RIDES_ARCHIVE_STORAGE_KEY = 'modivcareRides.archived.v1';
const RIDES_CREATE_DRAFT_STORAGE_KEY = 'modivcareRides.createDraftFromOpportunity.v1';
const PAYCHECK_STORAGE_KEY = 'paychecksTab.paychecks.v1';
const PAYCHECK_UPDATE_EVENT = 'paychecksChanged';
const APP_NAVIGATE_EVENT = 'app:navigate';
const DEFAULT_HOURLY_RATE = '19.50';
const SUPERVISOR_HOURLY_RATE = '20.50';
const OLD_DEFAULT_HOURLY_RATES = ['15.50'];
const OVERTIME_HOUR_THRESHOLD = 8;
const DOUBLE_TIME_HOUR_THRESHOLD = 12;
const OVERTIME_RATE_MULTIPLIER = 1.5;
const DOUBLE_TIME_RATE_MULTIPLIER = 2;
const DEFAULT_VISIBLE_SHIFT_COUNT = 5;
const CSC_GOOGLE_CALENDAR_LABEL_ID = 'c5c5c5c5-5c5c-4c5c-8c5c-c5c5c5c5c5c5';
const CSC_GOOGLE_CALENDAR_LABEL_NAME = 'CSC Shifts';
const CSC_GOOGLE_CALENDAR_BACKGROUND_COLOR = '#8E24AA';

const CSC_COMPANY = {
  name: 'Contemporary Services Corporation',
  shortName: 'CSC',
  branch: 'Torrance, CA',
  address: '369 Van Ness Way, Suite 702, Torrance, CA 90501',
  phone: '(310) 210-7223',
  website: 'https://www.csc-usa.com',
  notes: 'Event staffing, crowd management, and event security company.',
};

const WISH_PORTAL_URL = 'https://ess.schedulingsite.com/login';

const ADDED_VENUE_OPTIONS = [
  'Novo Theater',
  'Shrine Auditorium',
  'Rose Bowl',
  'Hollywood Bowl',
  'Intuit Dome',
  'Long Beach Amphitheater',
  'Long Beach Convention Center',
  'The Roxy',
];

const VENUE_EVENT_CALENDAR_URLS = {
  'Novo Theater': 'https://www.thenovodtla.com/events',
  'Shrine Auditorium': 'https://www.shrineauditorium.com/calendar/',
  'Rose Bowl': 'https://www.rosebowlstadium.com/events/calendar/list',
  'Hollywood Bowl': 'https://www.hollywoodbowl.com/events/performances',
  'Intuit Dome': 'https://www.intuitdome.com/events/event-schedule',
  'Long Beach Amphitheater': 'https://fmbamp.com/',
  'Long Beach Convention Center': 'https://www.longbeachcc.com/calendar/',
  'The Roxy': 'https://www.theroxy.com/shows/',
};

const SHIFT_STATUS_OPTIONS = ['Scheduled', 'Cancelled', 'Done'];

const getShiftStatusColorClass = (status) => {
  if (status === 'Done') return 'bg-green-600 hover:bg-green-700';
  if (status === 'Cancelled') return 'bg-red-600 hover:bg-red-700';
  return 'bg-slate-600 hover:bg-slate-700';
};

const getShiftStatusOptionStyle = (status) => {
  if (status === 'Done') return { backgroundColor: '#16a34a', color: '#ffffff' };
  if (status === 'Cancelled') return { backgroundColor: '#dc2626', color: '#ffffff' };
  return { backgroundColor: '#475569', color: '#ffffff' };
};
const PAID_STATUS_OPTIONS = ['Unpaid', 'Paid'];

const GENERIC_CSC_PARKING_PASS_TEXT =
  'Parking will be dictated by your parking pass. If you have not received a parking pass, please contact scheduling with your email address to request a parking pass, and refer to your parking pass for parking instructions.';

const normalizeParkingTextForCompare = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isGenericCscParkingPassText = (value = '') => {
  const normalized = normalizeParkingTextForCompare(value);
  const generic = normalizeParkingTextForCompare(GENERIC_CSC_PARKING_PASS_TEXT);

  if (!normalized) return false;
  if (normalized === generic) return true;

  const hasGenericCore =
    normalized.includes('parking will be dictated by your parking pass') &&
    normalized.includes('please contact scheduling with your email address') &&
    normalized.includes('refer to your parking pass for parking instructions');

  if (!hasGenericCore) return false;

  const specificParkingPattern =
    /\b(lot|garage|gate|entry|enter|corner|street|st|drive|dr|avenue|ave|boulevard|blvd|zone|pink|blue|green|red|yellow|pincay|varus|century|location|address)\b/i;

  return !specificParkingPattern.test(String(value || ''));
};

const cleanCscParkingText = (value = '') => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();

  if (!text) return '';

  const genericParkingPattern =
    /Parking\s+will\s+be\s+dictated\s+by\s+your\s+parking\s+pass\.?\s+If\s+you\s+have\s+not\s+received\s+a\s+parking\s+pass,?\s+please\s+contact\s+scheduling\s+with\s+your\s+email\s+address\s+to\s+request\s+a\s+parking\s+pass,?\s+and\s+refer\s+to\s+your\s+parking\s+pass\s+for\s+parking\s+instructions\.?/gi;
  const withoutGeneric = text
    .replace(genericParkingPattern, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (withoutGeneric) return withoutGeneric;
  if (isGenericCscParkingPassText(text)) return '';

  return text;
};

const normalizeCscUniformType = (value = '') => {
  const text = String(value || '').toLowerCase();

  if (!text) return '';

  if (
    /\ball[-\s]?black\s*(?:\/|with)\s*(?:a\s+)?white\s+shirt\b/i.test(text)
  ) {
    return 'All black / white shirt';
  }

  if (
    /\bcoat\s*(?:&|and)\s*tie\b/i.test(text) ||
    /\bc\s*&\s*t\b/i.test(text) ||
    /\bsuit\s*(?:&|and)\s*tie\b/i.test(text) ||
    /\bdress\s+shirt\b/i.test(text) ||
    /\bdress\s+pants\b/i.test(text) ||
    /\bblack\s+suit\b/i.test(text)
  ) {
    return 'Coat & Tie';
  }

  if (
    /\ball[-\s]?black\b/i.test(text) ||
    /\ball\s+black\s+everything\b/i.test(text) ||
    /\bsolid\s+black\b/i.test(text) ||
    /\bblack\s+pants\b/i.test(text) ||
    /\bblack\s+t-?shirt\b/i.test(text) ||
    /\bblack\s+shoes\b/i.test(text) ||
    /\bblack\s+socks\b/i.test(text) ||
    /\bcsc\s*\/\s*sofi\s+uniform\b/i.test(text)
  ) {
    return 'All black uniform';
  }

  return '';
};

const deriveCscUniformFromRoleName = (roleName = '', venue = '') => {
  const normalizedRoleName = String(roleName || '').replace(/\s+/g, ' ').trim();
  const normalizedVenue = String(venue || '').replace(/\s+/g, ' ').trim();

  if (
    /\bcoat\s*(?:&|and)\s*tie\b/i.test(normalizedRoleName) ||
    /\bc\s*(?:&|and)\s*t\b/i.test(normalizedRoleName)
  ) {
    return 'Coat & Tie';
  }

  const isSecurityGuardRole =
    /\bsecurity\s+guards?\b/i.test(normalizedRoleName) ||
    /\bguard\s+card\s+security\b/i.test(normalizedRoleName) ||
    (/\bsecurity\b/i.test(normalizedRoleName) && /\bguards?\b/i.test(normalizedRoleName));

  if (!isSecurityGuardRole) return '';

  if (/\b(?:rose|hollywood)\s+bowl\b/i.test(normalizedVenue)) {
    return 'All black / white shirt';
  }

  return 'All black uniform';
};

const stripCscEmailFluff = (value = '') => {
  let text = String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  if (!text) return '';

  text = cleanCscParkingText(text);

  const fluffPatterns = [
    /(?:\*+)?\s*TIMES\s+MAY\s+CHANGE,?\s+PLEASE\s+CHECK\s+ESS\s+BEFORE\s+SHIFT(?:\*+)?\.?/gi,
    /\bONE\s+LUNCH\s+PER\s+PERSON,?\s+PER\s+SHIFT\s+WORKED\.?/gi,
    /\bTeam\s+Member\s+Uniform\s+Requirements\s*:?\s*/gi,
    /\bAll\s+team\s+members\s+are\s+required\s+to\s+wear[\s\S]*?(?:for\s+your\s+shift\.?|$)/gi,
    /\bPlease\s+wear\s+an?\s+all[-\s]?black[\s\S]*?(?=(?:\n\s*\n|Sign[-\s]?in|Parking|Entry|Location|$))/gi,
    /\bThe\s+following\s+items\s+are\s+NOT\s+PERMITTED\s*:[\s\S]*?(?:covered\.?|$)/gi,
    /\bJeans,?\s+faded\s+pants[\s\S]*?(?:covered\.?|$)/gi,
    /\bHats\s+must\s+be\s+solid\s+black[\s\S]*?(?:provided\s+at\s+sign[-\s]?in\.?|$)/gi,
    /\bBring\s+a\s+working\s+flashlight\s+and\s+pen\.?/gi,
    /\bCompliance\s+with\s+these\s+uniform\s+requirements[\s\S]*?(?:for\s+your\s+shift\.?|$)/gi,
    /\bAttendance\s+Policy\s+Reminder\s*:?\s*[\s\S]*?(?=(?:\n\s*\n|Special Notes|Venue|Shift|Job|Role|$))/gi,
    /\bPre[-\s]?Shift\s+Health\s+and\s+Wellness\s+Announcements\s*:?\s*[\s\S]*?(?=(?:\n\s*\n|Schedule for|Special Notes|Venue|Shift|Job|Role|$))/gi,
    /\bProhibited\s+Items\s*:?\s*[\s\S]*?(?=(?:\n\s*\n|Special Notes|Venue|Shift|Job|Role|$))/gi,
    /\bWe\s+hope\s+you\s+have\s+an\s+amazing\s+shift[^\n.!?]*[.!?]?/gi,
  ];

  fluffPatterns.forEach((pattern) => {
    text = text.replace(pattern, ' ');
  });

  return text
    .replace(/^\s*Special\s+Notes\s*:?\s*/i, '')
    .replace(/^\s*Uniform\s+Requirements\s*:?\s*/i, '')
    .replace(/^\s*Uniform\s+Notes\s*:?\s*/i, '')
    .replace(/\s+([,.])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
};


const isCscNoteFluffLine = (value = '') => {
  const line = String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();

  if (!line) return true;
  if (/^(email type|sender|schedule for|shift no|role|role name|shift name|post\/area|uniform|links)\s*:/i.test(line)) return true;
  if (/^(special notes|uniform requirements|uniform notes|attendance policy reminder|pre-shift health|prohibited items)\s*:?/i.test(line)) return true;

  return /all black everything|no hoodies|black shoes|black socks|black pants|black belt|black shirt|short sleeve|long sleeve|no marking on the sleeves|written up|sent home|flashlight and pen|hats with logos|csc logo|team member uniform|solid black|uniform requirements|not permitted|prohibited items|jeans|faded pants|sweats|athletic pants|cargo pants|tights|leggings|hoodies|sweatshirts|piercings|facial tattoos|attendance policy|health and wellness|one lunch|times may change|check ess|compliance with these uniform/i.test(line);
};

const dedupeCscNoteLines = (lines = []) => {
  const seenLines = new Set();
  const seenLabels = new Set();

  return lines.filter((line) => {
    const normalizedLine = String(line || '').replace(/\s+/g, ' ').trim();
    const normalizedKey = normalizedLine.toLowerCase();
    const labelMatch = normalizedLine.match(/^([A-Za-z][A-Za-z\s/-]*?)\s*:/);
    const labelKey = labelMatch?.[1]?.toLowerCase() || '';

    if (!normalizedLine) return false;
    if (seenLines.has(normalizedKey)) return false;
    if (labelKey && seenLabels.has(labelKey)) return false;

    seenLines.add(normalizedKey);
    if (labelKey) seenLabels.add(labelKey);

    return true;
  });
};

const escapeCscNoteLabel = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const CSC_NOTE_FIELD_LABELS = [
  'Email type',
  'Sender',
  'Schedule for',
  'Shift No',
  'Role',
  'Role Name',
  'Shift Name',
  'Shift name',
  'Post/area',
  'Sign-in location',
  'Sign in location',
  'Special Notes',
  'Uniform',
  'Links',
  'Parking',
  'Notes',
];

const normalizeExtractedCscNoteValue = (value = '') =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:.-]+|[\s.]+$/g, '')
    .trim();

const getCscNoteFieldValue = (value = '', labels = []) => {
  const text = String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) return '';

  const loweredLabels = labels.map((label) => String(label).toLowerCase());
  const nextLabels = CSC_NOTE_FIELD_LABELS.filter((label) => !loweredLabels.includes(label.toLowerCase()));
  const nextPattern = nextLabels.map(escapeCscNoteLabel).join('|');

  for (const label of labels) {
    const pattern = new RegExp(
      `(?:^|\\s)${escapeCscNoteLabel(label)}\\s*:\\s*([\\s\\S]*?)(?=\\s+(?:${nextPattern})\\s*:|$)`,
      'i'
    );
    const match = text.match(pattern);
    const valueText = normalizeExtractedCscNoteValue(match?.[1] || '');

    if (valueText) return valueText;
  }

  return '';
};

const removeCscNoteFields = (value = '', labels = []) => {
  let text = String(value || '');

  labels.forEach((label) => {
    const nextLabels = CSC_NOTE_FIELD_LABELS.filter((nextLabel) => nextLabel.toLowerCase() !== label.toLowerCase());
    const nextPattern = nextLabels.map(escapeCscNoteLabel).join('|');
    const fieldPattern = new RegExp(
      `(?:^|\\s)${escapeCscNoteLabel(label)}\\s*:\\s*[\\s\\S]*?(?=\\s+(?:${nextPattern})\\s*:|$)`,
      'gi'
    );

    text = text.replace(fieldPattern, ' ');
  });

  return text;
};

const getShiftNameFromCscNotes = (value = '') =>
  getCscNoteFieldValue(value, ['Shift Name', 'Shift name', 'Post/area']);

const getRoleNameFromCscNotes = (value = '') =>
  getCscNoteFieldValue(value, ['Role Name', 'Role']);

const cleanCscShiftNotes = (value = '', uniformSource = '') => {
  let text = stripCscEmailFluff(value);

  if (!text) return '';

  text = text
    .replace(/\bCSC\s+shift\s+email\s+imported\.?\s*Special\s+Notes\s*:\s*/gi, '')
    .replace(/\bSpecial\s+Notes\s*:\s*(?=Email\s+type\s*:)/gi, '')
    .replace(/\s+(Email\s+type|Sender|Schedule\s+for|Shift\s+No|Role\s+Name|Role|Shift\s+Name|Shift\s+name|Post\/area|Sign[-\s]?in\s+location|Uniform|Links|Parking|Notes)\s*:/gi, '\n$1:');

  text = removeCscNoteFields(text, [
    'Email type',
    'Sender',
    'Schedule for',
    'Shift No',
    'Role',
    'Role Name',
    'Shift Name',
    'Shift name',
    'Post/area',
    'Uniform',
    'Links',
  ]);

  const cleanedLines = text
    .replace(/\bUniform\s*:\s*(?:All\s+black\s+uniform|All\s+black\s*\/\s*white\s+shirt|Coat\s*&\s*tie)\.?\s*/gi, '')
    .replace(/^\s*Special\s+Notes\s*:?\s*/i, '')
    .replace(/\s+([,.])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !isCscNoteFluffLine(line));

  return dedupeCscNoteLines(cleanedLines).join('\n').trim();
};



const BASE_CSC_SHIFTS = [
  {
    id: 'csc-2026-06-11-lamc-fan-fest',
    startDate: '2026-06-11',
    startTime: '08:30',
    finishDate: '2026-06-11',
    finishTime: '17:00',
    venue: 'Los Angeles Memorial Coliseum',
    city: 'Los Angeles',
    address: '3911 S Figueroa St',
    event: 'FIFA World Cup LAMC Fan Fest 2026',
    jobName: 'TIMES TBD LAMC FIFA Fan Fest Day 1',
  },
  {
    id: 'csc-2026-06-12-sofi-usa-paraguay',
    startDate: '2026-06-12',
    startTime: '11:00',
    finishDate: '2026-06-12',
    finishTime: '22:30',
    venue: 'SoFi Stadium',
    city: 'Inglewood',
    address: '3883 W Century Blvd',
    event: '2026 FIFA World Cup',
    jobName: 'FIFA WorldCup-GXMAIN-USAvsParaguay',
  },
  {
    id: 'csc-2026-06-13-long-beach-watch-party',
    startDate: '2026-06-13',
    startTime: '08:00',
    finishDate: '2026-06-13',
    finishTime: '16:00',
    venue: 'City Of Long Beach',
    city: 'Long Beach',
    address: '',
    event: '2026 FIFA World Cup Watch Party',
    jobName: 'FIFA World Cup 2026 - Watch Party-6/13/2026',
  },
  {
    id: 'csc-2026-06-15-sofi-iran-new-zealand',
    startDate: '2026-06-15',
    startTime: '11:00',
    finishDate: '2026-06-15',
    finishTime: '22:30',
    venue: 'SoFi Stadium',
    city: 'Inglewood',
    address: '3883 W Century Blvd',
    event: '2026 FIFA World Cup',
    jobName: 'FIFA WorldCup-GXMAIN-IRvsNZ',
  },
  {
    id: 'csc-2026-06-18-sofi-world-cup',
    startDate: '2026-06-18',
    startTime: '05:00',
    finishDate: '2026-06-18',
    finishTime: '16:30',
    venue: 'SoFi Stadium',
    city: 'Inglewood',
    address: '3883 W Century Blvd',
    event: '2026 FIFA World Cup',
    jobName: 'FIFA WorldCup-GXMAIN',
  },
  {
    id: 'csc-2026-06-21-sofi-world-cup',
    startDate: '2026-06-21',
    startTime: '05:00',
    finishDate: '2026-06-21',
    finishTime: '16:30',
    venue: 'SoFi Stadium',
    city: 'Inglewood',
    address: '3883 W Century Blvd',
    event: '2026 FIFA World Cup',
    jobName: 'FIFA WorldCup-GXMAIN',
  },
  {
    id: 'csc-2026-06-25-sofi-world-cup',
    startDate: '2026-06-25',
    startTime: '11:00',
    finishDate: '2026-06-25',
    finishTime: '22:30',
    venue: 'SoFi Stadium',
    city: 'Inglewood',
    address: '3883 W Century Blvd',
    event: '2026 FIFA World Cup',
    jobName: 'FIFA WorldCup-GXMAIN',
  },
  {
    id: 'csc-2026-06-28-sofi-world-cup',
    startDate: '2026-06-28',
    startTime: '05:00',
    finishDate: '2026-06-28',
    finishTime: '16:30',
    venue: 'SoFi Stadium',
    city: 'Inglewood',
    address: '3883 W Century Blvd',
    event: '2026 FIFA World Cup',
    jobName: 'FIFA WorldCup-GXMAIN',
  },
  {
    id: 'csc-2026-07-02-sofi-world-cup',
    startDate: '2026-07-02',
    startTime: '05:00',
    finishDate: '2026-07-02',
    finishTime: '16:30',
    venue: 'SoFi Stadium',
    city: 'Inglewood',
    address: '3883 W Century Blvd',
    event: '2026 FIFA World Cup',
    jobName: 'FIFA WorldCup-GXMAIN',
  },
];

const normalizeHourlyRate = (value) => {
  const rate = String(value ?? '').trim();

  if (!rate || OLD_DEFAULT_HOURLY_RATES.includes(rate)) return DEFAULT_HOURLY_RATE;

  return rate;
};

const isSupervisorRole = (value = '') =>
  /\bsupervisor\b/i.test(String(value || '').trim());

const normalizeShiftStatus = (value) => {
  const status = String(value || '').trim();

  if (!status) return 'Scheduled';
  if (status === 'Worked') return 'Scheduled';
  if (status === 'Approved' || status === 'Confirmed') return 'Scheduled';
  if (status === 'Paid') return 'Done';
  if (status === 'Complete' || status === 'Completed') return 'Done';

  return SHIFT_STATUS_OPTIONS.includes(status) ? status : 'Scheduled';
};

const cleanCscEventTitle = (value = '') => cleanCscDisplayTitle(value);

const shouldOmitParkingForVenue = (value = '') => {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return (
    /^(?:the\s+)?(?:kia\s+)?forum$/.test(normalized) ||
    normalized.includes('sofi') ||
    normalized.includes('youtube theater') ||
    normalized.includes('youtube theatre') ||
    normalized.includes('rose bowl')
  );
};

const shouldOmitParkingForShift = (shift = {}) => shouldOmitParkingForVenue(shift.venue);

const cleanCscVenueAddress = (value = '') =>
  String(value || '')
    .replace(/\s*[•·]\s*(?:location\s*:?)?[\s\S]*$/i, '')
    .replace(/\s+location\s*:\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeCscVenueFields = (venueValue = '', cityValue = '', addressValue = '') => {
  const venue = String(venueValue || '').trim();
  const city = String(cityValue || '').trim();
  const address = cleanCscVenueAddress(addressValue);
  const identity = `${venue} ${address}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (identity.includes('forum')) {
    return {
      venue: 'The Kia Forum',
      city: 'Inglewood',
      address: '3900 W Manchester Blvd, Inglewood, CA 90305',
    };
  }

  if (identity.includes('sofi') || identity.includes('hollywood park')) {
    return {
      venue: 'SoFi Stadium',
      city: 'Inglewood',
      address: '3883 W Century Blvd',
    };
  }

  if (identity.includes('los angeles memorial coliseum')) {
    return {
      venue: 'Los Angeles Memorial Coliseum',
      city: 'Los Angeles',
      address: '3911 S Figueroa St',
    };
  }

  return { venue, city, address };
};

const normalizeShiftMoney = (value) => {
  const number = Number(String(value ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(number) ? number : 0;
};

const normalizeShift = (shift = {}) => {
  const rawNotes = shift.notes || '';
  const shiftName = cleanCscDisplayTitle(
    shift.shiftName || getShiftNameFromCscNotes(rawNotes)
  );
  const roleName = cleanCscDisplayTitle(
    shift.roleName || getRoleNameFromCscNotes(rawNotes),
    { stripNumericPrefix: false }
  );
  const uniform =
    deriveCscUniformFromRoleName(roleName, shift.venue) ||
    normalizeCscUniformType(shift.uniform || rawNotes || '');
  const venueFields = normalizeCscVenueFields(shift.venue, shift.city, shift.address);

  return {
    id: shift.id || `csc-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    startDate: shift.startDate || '',
    startTime: shift.startTime || '',
    finishDate: shift.finishDate || shift.startDate || '',
    finishTime: shift.finishTime || '',
    venue: cleanCscVenueDisplay(venueFields.venue),
    city: venueFields.city,
    address: venueFields.address,
    event: cleanCscEventTitle(shift.event),
    jobName: cleanCscEventTitle(shift.jobName),
    shiftName,
    roleName,
    shiftStatus: normalizeShiftStatus(shift.shiftStatus),
    hourlyRate: isSupervisorRole(roleName)
      ? SUPERVISOR_HOURLY_RATE
      : normalizeHourlyRate(shift.hourlyRate),
    paidStatus: shift.paidStatus || 'Unpaid',
    paymentDate: shift.paymentDate || '',
    paycheckReconciled: Boolean(shift.paycheckReconciled),
    reconciledPaycheckId: shift.reconciledPaycheckId || '',
    reconciledCheckNumber: shift.reconciledCheckNumber || '',
    actualGrossPay: normalizeShiftMoney(shift.actualGrossPay),
    actualNetPay: normalizeShiftMoney(shift.actualNetPay),
    actualWorkedHours: normalizeShiftMoney(shift.actualWorkedHours),
    actualPaidHours: normalizeShiftMoney(shift.actualPaidHours),
    actualEarningsLines: Array.isArray(shift.actualEarningsLines) ? shift.actualEarningsLines : [],
    prePaycheckShiftStatus: shift.prePaycheckShiftStatus || '',
    prePaycheckPaidStatus: shift.prePaycheckPaidStatus || '',
    prePaycheckPaymentDate: shift.prePaycheckPaymentDate || '',
    notes: cleanCscShiftNotes(rawNotes, uniform),
    parking: shouldOmitParkingForShift(shift) ? '' : cleanCscParkingText(shift.parking || ''),
    uniform,
    supervisor: shift.supervisor || '',
    createdFromOpportunityId: shift.createdFromOpportunityId || shift.linkedOpportunityId || '',
    linkedOpportunityId: shift.linkedOpportunityId || shift.createdFromOpportunityId || '',
    googleCalendarEventId: shift.googleCalendarEventId || '',
    googleCalendarEventLink: shift.googleCalendarEventLink || '',
    googleCalendarAddedAt: shift.googleCalendarAddedAt || '',
    scheduleSource: shift.scheduleSource || '',
    wishEssStatus: shift.wishEssStatus || '',
    wishEssVerifiedAt: shift.wishEssVerifiedAt || '',
    wishEssSnapshotId: shift.wishEssSnapshotId || '',
    archivedAt: shift.archivedAt || '',
  };
};

const syncOpportunityLinksFromShifts = (activeShifts = [], archivedShifts = []) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CSC_OPPORTUNITIES_STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed) || !parsed.length) return;

    const allShifts = [
      ...activeShifts.map((shift) => ({ ...shift, recordSource: 'active' })),
      ...archivedShifts.map((shift) => ({ ...shift, recordSource: 'archived' })),
    ];
    const shiftsById = new Map(allShifts.map((shift) => [shift.id, shift]));
    let changed = false;

    const nextOpportunities = parsed.map((opportunity) => {
      const linkedShift =
        shiftsById.get(opportunity.linkedCscShiftId) ||
        allShifts.find(
          (shift) =>
            shift.createdFromOpportunityId === opportunity.id ||
            shift.linkedOpportunityId === opportunity.id
        );

      if (!linkedShift) {
        if (!opportunity.linkedCscShiftId) return opportunity;

        changed = true;
        return {
          ...opportunity,
          linkedCscShiftId: '',
          status: opportunity.status === 'Scheduled' ? 'New' : opportunity.status,
          updatedAt: new Date().toISOString(),
        };
      }

      const nextStatus =
        linkedShift.shiftStatus === 'Cancelled'
          ? 'Cancelled'
          : linkedShift.shiftStatus === 'Done'
            ? 'Completed'
            : 'Scheduled';
      if (
        opportunity.linkedCscShiftId === linkedShift.id &&
        opportunity.status === nextStatus
      ) {
        return opportunity;
      }

      changed = true;
      return {
        ...opportunity,
        linkedCscShiftId: linkedShift.id,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
    });

    if (!changed) return;

    localStorage.setItem(CSC_OPPORTUNITIES_STORAGE_KEY, JSON.stringify(nextOpportunities));
    window.dispatchEvent(
      new CustomEvent(CSC_OPPORTUNITIES_UPDATE_EVENT, {
        detail: { opportunities: nextOpportunities },
      })
    );
  } catch (error) {
    console.error('Failed to sync CSC opportunities from shifts:', error);
  }
};

const seedShifts = BASE_CSC_SHIFTS.map(normalizeShift);

const createBlankShift = () =>
  normalizeShift({
    id: `csc-custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    startDate: '',
    startTime: '',
    finishDate: '',
    finishTime: '',
    venue: '',
    city: '',
    address: '',
    event: '',
    jobName: '',
    shiftName: '',
    roleName: '',
    shiftStatus: 'Scheduled',
    hourlyRate: DEFAULT_HOURLY_RATE,
    paidStatus: 'Unpaid',
    paymentDate: '',
    notes: '',
    parking: '',
    uniform: '',
    supervisor: '',
  });

const formatDate = (value) => formatAppShortDate(value);

const formatShortDate = (value) => formatAppShortDate(value);

const formatPayDate = (value) => formatAppShortDate(value);

const formatTime = (value) => {
  if (!value) return '';

  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatEssStartDateTime = (dateValue, timeValue) => {
  if (!dateValue) return '';
  const safeTime = /^\d{2}:\d{2}$/.test(String(timeValue || '')) ? timeValue : '';
  return `${formatAppShortDate(dateValue)}${safeTime ? ` ${safeTime}` : ''}`;
};

const formatEssFinishDateTime = (dateValue, timeValue) => {
  if (!dateValue) return '';
  const safeTime = /^\d{2}:\d{2}$/.test(String(timeValue || '')) ? timeValue : '';
  return `${formatAppShortDate(dateValue)}${safeTime ? ` ${safeTime}` : ''}`;
};

const formatCurrency = (value) => {
  const amount = Number(value) || 0;

  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
};

const getShiftHours = (shift) => {
  const start = new Date(`${shift.startDate}T${shift.startTime}:00`);
  const finish = new Date(`${shift.finishDate}T${shift.finishTime}:00`);
  const diff = finish.getTime() - start.getTime();

  if (!Number.isFinite(diff) || diff <= 0) return 0;

  return Math.round((diff / (1000 * 60 * 60)) * 100) / 100;
};

const getShiftEffectiveHourlyRate = (shift) => {
  const baseRate = Number.parseFloat(shift?.hourlyRate);
  if (!Number.isFinite(baseRate) || baseRate <= 0) return 0;

  return baseRate;
};

const getShiftHourlyRateLabel = (shift) => {
  const rate = Number.parseFloat(shift?.hourlyRate);

  if (!Number.isFinite(rate) || rate <= 0) return formatCurrency(0);

  return formatCurrency(rate);
};

const getEstimatedPay = (shift) => {
  if (shift?.shiftStatus === 'Cancelled') return 0;

  const rate = getShiftEffectiveHourlyRate(shift);
  if (!Number.isFinite(rate) || rate <= 0) return 0;

  const hours = getShiftHours(shift);
  const regularHours = Math.min(hours, OVERTIME_HOUR_THRESHOLD);
  const overtimeHours = Math.min(Math.max(hours - OVERTIME_HOUR_THRESHOLD, 0), DOUBLE_TIME_HOUR_THRESHOLD - OVERTIME_HOUR_THRESHOLD);
  const doubleTimeHours = Math.max(hours - DOUBLE_TIME_HOUR_THRESHOLD, 0);
  const regularPay = regularHours * rate;
  const overtimePay = overtimeHours * rate * OVERTIME_RATE_MULTIPLIER;
  const doubleTimePay = doubleTimeHours * rate * DOUBLE_TIME_RATE_MULTIPLIER;

  return Math.round((regularPay + overtimePay + doubleTimePay) * 100) / 100;
};

const hasReconciledPaycheck = (shift = {}) =>
  Boolean(shift.paycheckReconciled && shift.reconciledPaycheckId);

const getShiftActualGrossPay = (shift = {}) =>
  hasReconciledPaycheck(shift) ? parsePaycheckMoney(shift.actualGrossPay) : 0;

const getShiftActualNetPay = (shift = {}) =>
  hasReconciledPaycheck(shift) ? parsePaycheckMoney(shift.actualNetPay) : 0;

const getShiftPaidGrossPay = (shift = {}) =>
  getShiftActualGrossPay(shift) || getEstimatedPay(shift);

const getShiftPaymentStatusLabel = (shift) =>
  shift?.shiftStatus === 'Cancelled' ? 'Cancelled' : shift?.paidStatus || 'Unpaid';

const getDeletedSeedShiftIds = () => {
  try {
    const saved = localStorage.getItem(CSC_DELETED_SEED_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (error) {
    console.error('Failed to load deleted CSC seed shift ids:', error);
    return new Set();
  }
};

const saveDeletedSeedShiftId = (id) => {
  if (!id) return;

  try {
    const deletedIds = getDeletedSeedShiftIds();
    deletedIds.add(id);
    localStorage.setItem(CSC_DELETED_SEED_STORAGE_KEY, JSON.stringify(Array.from(deletedIds)));
  } catch (error) {
    console.error('Failed to save deleted CSC seed shift id:', error);
  }
};

const removeDeletedSeedShiftId = (id) => {
  if (!id) return;

  try {
    const deletedIds = getDeletedSeedShiftIds();
    deletedIds.delete(id);
    localStorage.setItem(CSC_DELETED_SEED_STORAGE_KEY, JSON.stringify(Array.from(deletedIds)));
  } catch (error) {
    console.error('Failed to remove deleted CSC seed shift id:', error);
  }
};


const normalizeShiftIdentityText = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const shouldShowDistinctJobName = (shift = {}) => {
  const jobName = normalizeShiftIdentityText(shift.jobName);
  const eventName = normalizeShiftIdentityText(shift.event);

  return Boolean(jobName) && (!eventName || jobName !== eventName);
};

const getShiftRoleDisplayFields = (shift = {}) => {
  const eventName = String(shift.event || '').trim();
  const jobName = String(shift.jobName || '').trim();
  let shiftName = String(shift.shiftName || '').trim();
  let roleName = String(shift.roleName || '').trim();

  if (jobName) {
    const jobParts = jobName
      .split(/\s+-\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
    const jobStartsWithEvent =
      jobParts.length > 1 &&
      eventName &&
      normalizeShiftIdentityText(jobParts[0]) === normalizeShiftIdentityText(eventName);

    if (jobStartsWithEvent) {
      if (!shiftName) shiftName = eventName || jobParts[0];
      if (!roleName) roleName = jobParts.slice(1).join(' - ');
    } else if (!shiftName && shouldShowDistinctJobName(shift)) {
      shiftName = jobName;
    }
  }

  if (!shiftName) shiftName = eventName;

  return {
    shiftName,
    roleName,
  };
};

const normalizeCalendarVenueIdentity = (value = '') => {
  const normalized = normalizeShiftIdentityText(value);

  if (normalized.includes('forum')) return 'kia forum';
  if (normalized.includes('sofi')) return 'sofi stadium';

  return normalized.replace(/^the\s+/, '');
};

const getShiftCalendarIdentityKeys = (shift = {}) => {
  const keys = [];
  const shiftId = String(shift.id || '').trim();
  const opportunityId = String(
    shift.linkedOpportunityId || shift.createdFromOpportunityId || ''
  ).trim();
  const startDate = String(shift.startDate || '').trim();
  const venue = normalizeCalendarVenueIdentity(shift.venue);
  const jobName = normalizeShiftIdentityText(shift.jobName);
  const event = normalizeShiftIdentityText(shift.event);
  const shiftName = normalizeShiftIdentityText(shift.shiftName);
  const roleName = normalizeShiftIdentityText(shift.roleName);
  const primaryWorkName = jobName || event;

  if (shiftId) keys.push(`shift:${shiftId}`);
  if (opportunityId) keys.push(`opportunity:${opportunityId}`);

  if (startDate && venue && primaryWorkName) {
    keys.push(
      `work:${[startDate, venue, primaryWorkName, shiftName, roleName].join('|')}`
    );
  }

  if (startDate && shift.startTime && venue && (primaryWorkName || shiftName || roleName)) {
    keys.push(
      `start:${[
        startDate,
        String(shift.startTime || '').trim(),
        venue,
        primaryWorkName,
        shiftName,
        roleName,
      ].join('|')}`
    );
  }

  return Array.from(new Set(keys));
};

const readCalendarRegistry = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(CSC_CALENDAR_ADDED_STORAGE_KEY) || '[]');

    if (!Array.isArray(saved)) return [];

    return saved
      .map((entry) => {
        if (typeof entry === 'string') {
          return {
            shiftId: entry,
            identityKeys: [`shift:${entry}`],
            googleCalendarEventId: '',
            googleCalendarEventLink: '',
            googleCalendarAddedAt: '',
          };
        }

        if (!entry || typeof entry !== 'object') return null;

        const shiftId = String(entry.shiftId || '').trim();
        const identityKeys = Array.isArray(entry.identityKeys)
          ? entry.identityKeys.filter(Boolean)
          : shiftId
            ? [`shift:${shiftId}`]
            : [];

        return {
          shiftId,
          identityKeys: Array.from(new Set(identityKeys)),
          googleCalendarEventId: String(entry.googleCalendarEventId || '').trim(),
          googleCalendarEventLink: String(entry.googleCalendarEventLink || '').trim(),
          googleCalendarAddedAt: String(entry.googleCalendarAddedAt || '').trim(),
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error('Failed to read the CSC Google Calendar registry:', error);
    return [];
  }
};

const writeCalendarRegistry = (registry = []) => {
  try {
    localStorage.setItem(CSC_CALENDAR_ADDED_STORAGE_KEY, JSON.stringify(registry));
  } catch (error) {
    console.error('Failed to save the CSC Google Calendar registry:', error);
  }
};

const findCalendarRegistryEntry = (shift = {}, registry = readCalendarRegistry()) => {
  const identityKeys = new Set(getShiftCalendarIdentityKeys(shift));

  return (
    registry.find((entry) =>
      (entry.identityKeys || []).some((identityKey) => identityKeys.has(identityKey))
    ) || null
  );
};

const getShiftCalendarLinkage = (shift = {}) => {
  if (shift.googleCalendarEventId || shift.googleCalendarEventLink) return shift;
  return findCalendarRegistryEntry(shift);
};

const isShiftCalendared = (shift = {}) => {
  const calendarLinkage = getShiftCalendarLinkage(shift);
  return Boolean(
    calendarLinkage?.googleCalendarEventId ||
      calendarLinkage?.googleCalendarEventLink ||
      calendarLinkage?.googleCalendarAddedAt
  );
};

const saveCalendarRegistryEntry = (shift = {}, calendarFields = {}) => {
  const registry = readCalendarRegistry();
  const identityKeys = getShiftCalendarIdentityKeys(shift);
  const existingIndex = registry.findIndex((entry) =>
    (entry.identityKeys || []).some((identityKey) => identityKeys.includes(identityKey))
  );
  const existingEntry = existingIndex >= 0 ? registry[existingIndex] : {};
  const nextEntry = {
    shiftId: shift.id || existingEntry.shiftId || '',
    identityKeys: Array.from(
      new Set([...(existingEntry.identityKeys || []), ...identityKeys])
    ),
    googleCalendarEventId:
      calendarFields.googleCalendarEventId ||
      shift.googleCalendarEventId ||
      existingEntry.googleCalendarEventId ||
      '',
    googleCalendarEventLink:
      calendarFields.googleCalendarEventLink ||
      shift.googleCalendarEventLink ||
      existingEntry.googleCalendarEventLink ||
      '',
    googleCalendarAddedAt:
      calendarFields.googleCalendarAddedAt ||
      shift.googleCalendarAddedAt ||
      existingEntry.googleCalendarAddedAt ||
      '',
  };

  if (existingIndex >= 0) {
    registry[existingIndex] = nextEntry;
  } else {
    registry.push(nextEntry);
  }

  writeCalendarRegistry(registry);
  return nextEntry;
};

const removeCalendarRegistryEntriesForShift = (shift = {}) => {
  const shiftId = String(shift.id || '').trim();
  const identityKeys = new Set(getShiftCalendarIdentityKeys(shift));
  const nextRegistry = readCalendarRegistry().filter((entry) => {
    if (shiftId && entry.shiftId === shiftId) return false;

    return !(entry.identityKeys || []).some((identityKey) =>
      identityKeys.has(identityKey)
    );
  });

  writeCalendarRegistry(nextRegistry);
  return nextRegistry;
};

const restoreShiftCalendarLinkage = (shift = {}, registry = readCalendarRegistry()) => {
  if (shift.googleCalendarEventId || shift.googleCalendarEventLink) {
    saveCalendarRegistryEntry(shift);
    return shift;
  }

  const registryEntry = findCalendarRegistryEntry(shift, registry);
  if (!registryEntry) return shift;

  return normalizeShift({
    ...shift,
    googleCalendarEventId: registryEntry.googleCalendarEventId || '',
    googleCalendarEventLink: registryEntry.googleCalendarEventLink || '',
    googleCalendarAddedAt: registryEntry.googleCalendarAddedAt || '',
  });
};

const shiftIdentityTextMatches = (firstValue = '', secondValue = '') => {
  const first = normalizeShiftIdentityText(firstValue);
  const second = normalizeShiftIdentityText(secondValue);

  return Boolean(first && second && (first === second || first.includes(second) || second.includes(first)));
};

// Scanner imports can legitimately change the scheduled time, shift name, role name,
// and operational prefixes for the same assignment. These helpers preserve the
// meaningful event identity so stale scanner records can be reconciled globally.
const STORED_SCANNER_ASSIGNMENT_STOP_WORDS = new Set([
  'and',
  'approved',
  'call',
  'csc',
  'day',
  'dns',
  'entry',
  'entries',
  'event',
  'fill',
  'floor',
  'guard',
  'hires',
  'main',
  'new',
  'night',
  'prod',
  'production',
  'sec',
  'security',
  'shift',
  'stage',
  'staff',
  'tc',
  'worker',
  'workers',
  'yk',
]);

const GENERIC_STORED_SCANNER_IDENTITY_TOKENS = new Set([
  'concert',
  'event',
  'fifa',
  'game',
  'show',
  'worldcup',
]);

const normalizeStoredScannerAssignmentSource = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/\bday\s*[-_:]?\s*(\d+)\b/g, ' day$1 ')
    .replace(/\bnight\s*[-_:]?\s*(\d+)\b/g, ' n$1 ')
    .replace(/\bn\s*[-_:]?\s*(\d+)\b/g, ' n$1 ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getStoredScannerAssignmentTokens = (shift = {}) => {
  const source = [shift.jobName, shift.event]
    .filter(Boolean)
    .join(' ');

  return Array.from(
    new Set(
      normalizeStoredScannerAssignmentSource(source)
        .split(' ')
        .map((token) => token.trim())
        .filter(Boolean)
        .filter((token) => !STORED_SCANNER_ASSIGNMENT_STOP_WORDS.has(token))
        .filter((token) => !/^\d+$/.test(token))
        .filter((token) => token.length >= 2)
    )
  );
};

const getStoredScannerSequenceMarkers = (shift = {}) =>
  getStoredScannerAssignmentTokens(shift).filter((token) => /^(?:day|n)\d+$/i.test(token));

const storedScannerSequenceConflicts = (firstShift = {}, secondShift = {}) => {
  const firstMarkers = getStoredScannerSequenceMarkers(firstShift);
  const secondMarkers = getStoredScannerSequenceMarkers(secondShift);

  if (!firstMarkers.length || !secondMarkers.length) return false;

  const secondMarkerSet = new Set(secondMarkers);
  return !firstMarkers.some((marker) => secondMarkerSet.has(marker));
};

const storedScannerAssignmentIdentityMatches = (firstShift = {}, secondShift = {}) => {
  if (storedScannerSequenceConflicts(firstShift, secondShift)) return false;

  const firstTokens = getStoredScannerAssignmentTokens(firstShift);
  const secondTokens = getStoredScannerAssignmentTokens(secondShift);

  if (!firstTokens.length || !secondTokens.length) return false;

  const secondSet = new Set(secondTokens);
  const sharedTokens = firstTokens.filter((token) => secondSet.has(token));
  const shorterLength = Math.min(firstTokens.length, secondTokens.length);
  const overlapRatio = shorterLength ? sharedTokens.length / shorterLength : 0;

  if (sharedTokens.length >= 2 && overlapRatio >= 0.6) return true;

  if (
    sharedTokens.length === 1 &&
    sharedTokens[0].length >= 7 &&
    !GENERIC_STORED_SCANNER_IDENTITY_TOKENS.has(sharedTokens[0]) &&
    shorterLength <= 2
  ) {
    return true;
  }

  return false;
};

const isScannerGeneratedShiftRecord = (shift = {}) =>
  /^csc-email-/i.test(String(shift.id || '').trim());

const storedScannerVenuesMatch = (firstShift = {}, secondShift = {}) => {
  const firstVenue = normalizeCalendarVenueIdentity(firstShift.venue);
  const secondVenue = normalizeCalendarVenueIdentity(secondShift.venue);

  if (firstVenue && secondVenue && firstVenue === secondVenue) return true;

  const firstAddress = normalizeShiftIdentityText(firstShift.address);
  const secondAddress = normalizeShiftIdentityText(secondShift.address);
  return Boolean(firstAddress && secondAddress && firstAddress === secondAddress);
};

const getStoredScannerStartTimestamp = (shift = {}) => {
  if (!shift.startDate || !shift.startTime) return Number.NaN;
  return new Date(`${shift.startDate}T${shift.startTime}:00`).getTime();
};

const getStoredScannerFinishTimestamp = (shift = {}) => {
  const finishDate = shift.finishDate || shift.startDate;
  if (!finishDate || !shift.finishTime) return Number.NaN;
  return new Date(`${finishDate}T${shift.finishTime}:00`).getTime();
};

const storedScannerWindowsMatch = (firstShift = {}, secondShift = {}) =>
  Boolean(
    firstShift.startDate &&
      firstShift.startTime &&
      secondShift.startDate &&
      secondShift.startTime &&
      firstShift.finishTime &&
      secondShift.finishTime &&
      firstShift.startDate === secondShift.startDate &&
      firstShift.startTime === secondShift.startTime &&
      (firstShift.finishDate || firstShift.startDate) ===
        (secondShift.finishDate || secondShift.startDate) &&
      firstShift.finishTime === secondShift.finishTime
  );

const storedScannerWindowsOverlap = (firstShift = {}, secondShift = {}) => {
  const firstStart = getStoredScannerStartTimestamp(firstShift);
  const firstFinish = getStoredScannerFinishTimestamp(firstShift);
  const secondStart = getStoredScannerStartTimestamp(secondShift);
  const secondFinish = getStoredScannerFinishTimestamp(secondShift);

  if (![firstStart, firstFinish, secondStart, secondFinish].every(Number.isFinite)) return false;

  return firstStart < secondFinish && secondStart < firstFinish;
};

const hasDirectStoredScannerCalendarLinkage = (shift = {}) =>
  Boolean(
    shift.googleCalendarEventId ||
      shift.googleCalendarEventLink ||
      shift.googleCalendarAddedAt
  );

const hasStoredScannerCalendarLinkage = (shift = {}) =>
  hasDirectStoredScannerCalendarLinkage(shift) || isShiftCalendared(shift);

const areStaleScannerDuplicateShifts = (firstShift = {}, secondShift = {}) => {
  if (!firstShift?.id || !secondShift?.id) return false;
  if (firstShift.id === secondShift.id) return true;
  if (!isScannerGeneratedShiftRecord(firstShift) || !isScannerGeneratedShiftRecord(secondShift)) return false;
  if (!firstShift.startDate || firstShift.startDate !== secondShift.startDate) return false;

  const firstStatus = normalizeShiftStatus(firstShift.shiftStatus);
  const secondStatus = normalizeShiftStatus(secondShift.shiftStatus);
  if (['Done', 'Cancelled'].includes(firstStatus) || ['Done', 'Cancelled'].includes(secondStatus)) return false;
  if (!storedScannerVenuesMatch(firstShift, secondShift)) return false;
  if (!storedScannerAssignmentIdentityMatches(firstShift, secondShift)) return false;

  if (storedScannerWindowsMatch(firstShift, secondShift)) return true;
  if (storedScannerWindowsOverlap(firstShift, secondShift)) return true;

  // A prior scanner bug commonly left the old record linked to Google Calendar
  // and created a new unlinked record when a schedule update moved the time.
  // Reconcile that stale pair even when the two time windows no longer overlap.
  const firstDirectCalendared = hasDirectStoredScannerCalendarLinkage(firstShift);
  const secondDirectCalendared = hasDirectStoredScannerCalendarLinkage(secondShift);

  if (firstDirectCalendared !== secondDirectCalendared) return true;

  const firstCalendared = hasStoredScannerCalendarLinkage(firstShift);
  const secondCalendared = hasStoredScannerCalendarLinkage(secondShift);

  return firstCalendared !== secondCalendared;
};

const getShiftStartKey = (shift = {}) =>
  [shift.startDate, shift.startTime]
    .map((value) => String(value || '').trim())
    .join('|');

const getShiftFinishTimestamp = (shift = {}) => {
  const finishDate = shift.finishDate || shift.startDate;
  const finishTime = shift.finishTime || '';

  if (!finishDate || !finishTime) return Number.NaN;

  return new Date(`${finishDate}T${finishTime}:00`).getTime();
};

const areLikelyDuplicateShifts = (firstShift = {}, secondShift = {}) => {
  if (!firstShift?.id || !secondShift?.id) return false;
  if (firstShift.id === secondShift.id) return true;
  if (!firstShift.startDate || !firstShift.startTime || !secondShift.startDate || !secondShift.startTime) return false;
  if (getShiftStartKey(firstShift) !== getShiftStartKey(secondShift)) return false;
  if (!shiftIdentityTextMatches(firstShift.venue, secondShift.venue)) return false;

  const bothHaveJobNames = Boolean(firstShift.jobName && secondShift.jobName);
  const bothHaveShiftNames = Boolean(firstShift.shiftName && secondShift.shiftName);
  const bothHaveRoleNames = Boolean(firstShift.roleName && secondShift.roleName);

  const jobMatches = shiftIdentityTextMatches(firstShift.jobName, secondShift.jobName);
  const shiftNameMatches = shiftIdentityTextMatches(firstShift.shiftName, secondShift.shiftName);
  const roleNameMatches = shiftIdentityTextMatches(firstShift.roleName, secondShift.roleName);
  const eventMatches = shiftIdentityTextMatches(firstShift.event, secondShift.event);

  if (bothHaveJobNames && !jobMatches) return false;
  if (bothHaveShiftNames && !shiftNameMatches) return false;
  if (bothHaveRoleNames && !roleNameMatches) return false;

  if (jobMatches && (shiftNameMatches || roleNameMatches || eventMatches)) return true;
  if (shiftNameMatches && (roleNameMatches || eventMatches || jobMatches)) return true;
  if (roleNameMatches && eventMatches && (!bothHaveJobNames || jobMatches)) return true;

  return false;
};

const appendUniqueShiftTextBlock = (existingText = '', nextText = '') => {
  const existing = String(existingText || '').trim();
  const next = String(nextText || '').trim();

  if (!next) return existing;
  if (!existing) return next;
  if (normalizeShiftIdentityText(existing).includes(normalizeShiftIdentityText(next))) return existing;
  if (normalizeShiftIdentityText(next).includes(normalizeShiftIdentityText(existing))) return next;

  return `${existing}\n\n${next}`;
};

const mergeDuplicateShiftRecords = (existingShift = {}, incomingShift = {}, preferIncomingSchedule = false) => {
  const existingStatus = normalizeShiftStatus(existingShift.shiftStatus);
  const incomingStatus = normalizeShiftStatus(incomingShift.shiftStatus);
  const existingLocked = existingStatus === 'Done' || existingStatus === 'Cancelled';
  const incomingLocked = incomingStatus === 'Done' || incomingStatus === 'Cancelled';
  const existingPaid = existingShift.paidStatus === 'Paid';
  const incomingPaid = incomingShift.paidStatus === 'Paid';
  const existingFinishTimestamp = getShiftFinishTimestamp(existingShift);
  const incomingFinishTimestamp = getShiftFinishTimestamp(incomingShift);
  const useIncomingFinish = preferIncomingSchedule
    ? Boolean(incomingShift.finishTime)
    : Number.isFinite(incomingFinishTimestamp) &&
      (!Number.isFinite(existingFinishTimestamp) || incomingFinishTimestamp > existingFinishTimestamp);
  const safeIncomingEvent =
    incomingShift.event && incomingShift.event !== 'CSC courtesy shift reminder' ? incomingShift.event : '';
  const safeIncomingJobName =
    incomingShift.jobName && incomingShift.jobName !== 'Accepted CSC shift' ? incomingShift.jobName : '';

  return normalizeShift({
    ...existingShift,
    id: existingShift.id || incomingShift.id,
    startDate:
      preferIncomingSchedule && incomingShift.startDate
        ? incomingShift.startDate
        : existingShift.startDate || incomingShift.startDate,
    startTime:
      preferIncomingSchedule && incomingShift.startTime
        ? incomingShift.startTime
        : existingShift.startTime || incomingShift.startTime,
    finishDate: useIncomingFinish
      ? incomingShift.finishDate || incomingShift.startDate
      : existingShift.finishDate || existingShift.startDate || incomingShift.finishDate || incomingShift.startDate,
    finishTime: useIncomingFinish ? incomingShift.finishTime : existingShift.finishTime || incomingShift.finishTime,
    venue: incomingShift.venue || existingShift.venue,
    city: incomingShift.city || existingShift.city,
    address: incomingShift.address || existingShift.address,
    event: safeIncomingEvent || existingShift.event || incomingShift.event,
    jobName: safeIncomingJobName || existingShift.jobName || incomingShift.jobName,
    shiftName: incomingShift.shiftName || existingShift.shiftName,
    roleName: incomingShift.roleName || existingShift.roleName,
    shiftStatus: existingLocked ? existingStatus : incomingLocked ? incomingStatus : incomingStatus || existingStatus,
    hourlyRate: existingShift.hourlyRate || incomingShift.hourlyRate || DEFAULT_HOURLY_RATE,
    paidStatus: existingPaid || incomingPaid ? 'Paid' : existingShift.paidStatus || incomingShift.paidStatus || 'Unpaid',
    paymentDate: existingShift.paymentDate || incomingShift.paymentDate,
    notes: cleanCscShiftNotes(
      appendUniqueShiftTextBlock(existingShift.notes, incomingShift.notes),
      existingShift.uniform || incomingShift.uniform || ''
    ),
    parking: incomingShift.parking || existingShift.parking,
    uniform: normalizeCscUniformType(
      incomingShift.uniform || existingShift.uniform || incomingShift.notes || existingShift.notes || ''
    ),
    supervisor: incomingShift.supervisor || existingShift.supervisor,
    createdFromOpportunityId:
      existingShift.createdFromOpportunityId || incomingShift.createdFromOpportunityId || '',
    linkedOpportunityId:
      existingShift.linkedOpportunityId || incomingShift.linkedOpportunityId || '',
    googleCalendarEventId:
      existingShift.googleCalendarEventId || incomingShift.googleCalendarEventId || '',
    googleCalendarEventLink:
      existingShift.googleCalendarEventLink || incomingShift.googleCalendarEventLink || '',
    googleCalendarAddedAt:
      existingShift.googleCalendarAddedAt || incomingShift.googleCalendarAddedAt || '',
    archivedAt: existingShift.archivedAt || incomingShift.archivedAt || '',
  });
};

const mergeStaleScannerDuplicateRecords = (existingShift = {}, incomingShift = {}) => {
  const existingDirectCalendared = hasDirectStoredScannerCalendarLinkage(existingShift);
  const incomingDirectCalendared = hasDirectStoredScannerCalendarLinkage(incomingShift);
  const existingCalendared = hasStoredScannerCalendarLinkage(existingShift);
  const incomingCalendared = hasStoredScannerCalendarLinkage(incomingShift);

  // When exactly one record owns the calendar link, the unlinked record is normally
  // the later scanner-created schedule update. Use its current schedule while keeping
  // the existing canonical ID and preserving calendar/linkage metadata from both.
  const directCalendarDifference = existingDirectCalendared !== incomingDirectCalendared;
  const effectiveCalendarDifference = existingCalendared !== incomingCalendared;
  const scheduleSource = directCalendarDifference
    ? existingDirectCalendared
      ? incomingShift
      : existingShift
    : effectiveCalendarDifference
      ? existingCalendared
        ? incomingShift
        : existingShift
      : incomingShift;
  const merged = mergeDuplicateShiftRecords(existingShift, scheduleSource, true);

  return normalizeShift({
    ...merged,
    id: existingShift.id,
    googleCalendarEventId:
      existingShift.googleCalendarEventId || incomingShift.googleCalendarEventId || '',
    googleCalendarEventLink:
      existingShift.googleCalendarEventLink || incomingShift.googleCalendarEventLink || '',
    googleCalendarAddedAt:
      existingShift.googleCalendarAddedAt || incomingShift.googleCalendarAddedAt || '',
    createdFromOpportunityId:
      existingShift.createdFromOpportunityId || incomingShift.createdFromOpportunityId || '',
    linkedOpportunityId:
      existingShift.linkedOpportunityId || incomingShift.linkedOpportunityId || '',
  });
};

const isStoredWishEssDuplicateShift = (firstShift = {}, secondShift = {}) => {
  const firstIsWishEss =
    firstShift.scheduleSource === 'wish-ess' ||
    firstShift.wishEssStatus === 'confirmed';
  const secondIsWishEss =
    secondShift.scheduleSource === 'wish-ess' ||
    secondShift.wishEssStatus === 'confirmed';

  if (!firstIsWishEss && !secondIsWishEss) return false;
  if (!storedScannerVenuesMatch(firstShift, secondShift)) return false;

  /*
   * Wish ESS is authoritative. If two active records have the same venue and
   * exact complete work window, they are the same scheduled assignment even
   * when older CSC email text used a different event/job label.
   */
  return storedScannerWindowsMatch(firstShift, secondShift);
};

const mergeStoredWishEssDuplicateRecords = (
  existingShift = {},
  incomingShift = {}
) => {
  const existingIsWishEss =
    existingShift.scheduleSource === 'wish-ess' ||
    existingShift.wishEssStatus === 'confirmed';
  const incomingIsWishEss =
    incomingShift.scheduleSource === 'wish-ess' ||
    incomingShift.wishEssStatus === 'confirmed';

  const wishEssShift = incomingIsWishEss
    ? incomingShift
    : existingIsWishEss
      ? existingShift
      : incomingShift;

  const enrichedShift =
    hasStoredScannerCalendarLinkage(existingShift) ||
    existingShift.shiftName ||
    existingShift.roleName ||
    existingShift.uniform
      ? existingShift
      : incomingShift;

  const merged = mergeDuplicateShiftRecords(
    enrichedShift,
    wishEssShift,
    true
  );

  return normalizeShift({
    ...merged,
    id: enrichedShift.id || existingShift.id || incomingShift.id,
    shiftName:
      enrichedShift.shiftName ||
      existingShift.shiftName ||
      incomingShift.shiftName ||
      '',
    roleName:
      enrichedShift.roleName ||
      existingShift.roleName ||
      incomingShift.roleName ||
      '',
    uniform:
      enrichedShift.uniform ||
      existingShift.uniform ||
      incomingShift.uniform ||
      '',
    notes: cleanCscShiftNotes(
      appendUniqueShiftTextBlock(existingShift.notes, incomingShift.notes),
      enrichedShift.uniform ||
        existingShift.uniform ||
        incomingShift.uniform ||
        ''
    ),
    googleCalendarEventId:
      existingShift.googleCalendarEventId ||
      incomingShift.googleCalendarEventId ||
      '',
    googleCalendarEventLink:
      existingShift.googleCalendarEventLink ||
      incomingShift.googleCalendarEventLink ||
      '',
    googleCalendarAddedAt:
      existingShift.googleCalendarAddedAt ||
      incomingShift.googleCalendarAddedAt ||
      '',
    createdFromOpportunityId:
      existingShift.createdFromOpportunityId ||
      incomingShift.createdFromOpportunityId ||
      '',
    linkedOpportunityId:
      existingShift.linkedOpportunityId ||
      incomingShift.linkedOpportunityId ||
      '',
    scheduleSource: 'wish-ess',
    wishEssStatus: 'confirmed',
    wishEssVerifiedAt:
      wishEssShift.wishEssVerifiedAt ||
      existingShift.wishEssVerifiedAt ||
      incomingShift.wishEssVerifiedAt ||
      new Date().toISOString(),
    wishEssSnapshotId:
      wishEssShift.wishEssSnapshotId ||
      existingShift.wishEssSnapshotId ||
      incomingShift.wishEssSnapshotId ||
      '',
  });
};

const dedupeShiftRecords = (records = []) => {
  const deduped = [];
  const removedIds = [];
  const replacementIds = new Map();

  records.forEach((rawShift) => {
    const shift = normalizeShift(rawShift);
    const duplicateIndex = deduped.findIndex(
      (existingShift) =>
        isStoredWishEssDuplicateShift(existingShift, shift) ||
        areLikelyDuplicateShifts(existingShift, shift) ||
        areStaleScannerDuplicateShifts(existingShift, shift)
    );

    if (duplicateIndex < 0) {
      deduped.push(shift);
      return;
    }

    const existingShift = deduped[duplicateIndex];
    const wishEssDuplicate = isStoredWishEssDuplicateShift(
      existingShift,
      shift
    );
    const staleScannerDuplicate =
      areStaleScannerDuplicateShifts(existingShift, shift);

    deduped[duplicateIndex] = wishEssDuplicate
      ? mergeStoredWishEssDuplicateRecords(existingShift, shift)
      : staleScannerDuplicate
        ? mergeStaleScannerDuplicateRecords(existingShift, shift)
        : mergeDuplicateShiftRecords(existingShift, shift, false);

    const keptShiftId = deduped[duplicateIndex].id || existingShift.id;

    if (shift.id && shift.id !== keptShiftId) {
      removedIds.push(shift.id);
      replacementIds.set(shift.id, keptShiftId);
    }

    if (existingShift.id && existingShift.id !== keptShiftId) {
      removedIds.push(existingShift.id);
      replacementIds.set(existingShift.id, keptShiftId);
    }
  });

  return {
    shifts: deduped.sort((first, second) =>
      `${first.startDate}T${first.startTime}`.localeCompare(`${second.startDate}T${second.startTime}`)
    ),
    removedIds: Array.from(new Set(removedIds)),
    replacementIds,
  };
};

const loadSavedShifts = () => {
  try {
    const saved = localStorage.getItem(CSC_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;
    const deletedSeedIds = getDeletedSeedShiftIds();
    const archivedSaved = localStorage.getItem(CSC_ARCHIVE_STORAGE_KEY);
    const archivedParsed = archivedSaved ? JSON.parse(archivedSaved) : [];
    const archivedRecords = Array.isArray(archivedParsed)
      ? archivedParsed.filter((shift) => shift?.id).map(normalizeShift)
      : [];
    const archivedIds = new Set(archivedRecords.map((shift) => shift.id));
    const isArchivedRecord = (shift) =>
      Boolean(
        shift?.id &&
          (archivedIds.has(shift.id) ||
            archivedRecords.some((archivedShift) =>
              areLikelyDuplicateShifts(archivedShift, normalizeShift(shift))
            ))
      );

    if (!Array.isArray(parsed)) {
      return seedShifts.filter(
        (shift) => !deletedSeedIds.has(shift.id) && !isArchivedRecord(shift)
      );
    }

    const savedById = new Map(parsed.map((shift) => [shift.id, normalizeShift(shift)]));
    const mergedSeeds = seedShifts
      .filter((shift) => !deletedSeedIds.has(shift.id) && !isArchivedRecord(shift))
      .map((shift) => ({ ...shift, ...(savedById.get(shift.id) || {}) }));
    const seedIds = new Set(seedShifts.map((shift) => shift.id));
    const imported = parsed
      .filter(
        (shift) =>
          shift?.id &&
          !seedIds.has(shift.id) &&
          !deletedSeedIds.has(shift.id) &&
          !isArchivedRecord(shift)
      )
      .map(normalizeShift);
    const mergedShifts = [...mergedSeeds, ...imported].sort((first, second) =>
      `${first.startDate}T${first.startTime}`.localeCompare(`${second.startDate}T${second.startTime}`)
    );
    const dedupeResult = dedupeShiftRecords(mergedShifts);

    if (dedupeResult.removedIds.length) {
      const snapshot = {
        id: `csc-snapshot-${Date.now()}`,
        label: 'Before automatic CSC duplicate cleanup',
        createdAt: new Date().toISOString(),
        activeShifts: mergedShifts,
        archivedShifts: archivedRecords,
      };

      localStorage.setItem(CSC_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
      localStorage.setItem(CSC_STORAGE_KEY, JSON.stringify(dedupeResult.shifts));

      const calendarRegistry = readCalendarRegistry();
      dedupeResult.replacementIds.forEach((keptId, removedId) => {
        calendarRegistry.forEach((entry) => {
          if (
            entry.shiftId === removedId ||
            (entry.identityKeys || []).includes(`shift:${removedId}`)
          ) {
            entry.shiftId = keptId;
            entry.identityKeys = Array.from(
              new Set([
                ...(entry.identityKeys || []).filter(
                  (identityKey) => identityKey !== `shift:${removedId}`
                ),
                `shift:${keptId}`,
              ])
            );
          }
        });
      });
      writeCalendarRegistry(calendarRegistry);
    }

    const calendarRegistry = readCalendarRegistry();
    return dedupeResult.shifts.map((shift) =>
      restoreShiftCalendarLinkage(shift, calendarRegistry)
    );
  } catch (error) {
    console.error('Failed to load and deduplicate CSC shifts:', error);
    return seedShifts;
  }
};

const loadArchivedShifts = () => {
  try {
    const saved = localStorage.getItem(CSC_ARCHIVE_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    if (!Array.isArray(parsed)) return [];

    const calendarRegistry = readCalendarRegistry();
    return parsed
      .filter((shift) => shift?.id)
      .map((shift) => normalizeShift(shift))
      .map((shift) => restoreShiftCalendarLinkage(shift, calendarRegistry))
      .sort((a, b) => String(b.archivedAt || '').localeCompare(String(a.archivedAt || '')));
  } catch {
    return [];
  }
};

const readCscSafetySnapshot = () => {
  try {
    const saved = localStorage.getItem(CSC_SNAPSHOT_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;

    if (!parsed || typeof parsed !== 'object') return null;

    return {
      ...parsed,
      activeShifts: Array.isArray(parsed.activeShifts) ? parsed.activeShifts : [],
      archivedShifts: Array.isArray(parsed.archivedShifts) ? parsed.archivedShifts : [],
    };
  } catch (error) {
    console.error('Failed to read CSC safety snapshot:', error);
    return null;
  }
};

const writeCscSafetySnapshot = (label, activeShifts, archivedShifts) => {
  try {
    const snapshot = {
      id: `csc-snapshot-${Date.now()}`,
      label,
      createdAt: new Date().toISOString(),
      activeShifts,
      archivedShifts,
    };

    localStorage.setItem(CSC_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch (error) {
    console.error('Failed to save CSC safety snapshot:', error);
    return false;
  }
};

const escapeCsvValue = (value) => {
  const text = String(value ?? '');
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
};

const parseCsvLine = (line) => {
  const values = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
};

const normalizeTimeValue = (value = '', marker = '') => {
  const timeText = String(value || '').trim();
  if (!timeText) return '';

  const match = timeText.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return timeText;

  let hours = Number(match[1]);
  const minutes = match[2];
  const suffix = String(marker || '').trim().toUpperCase();

  if (suffix === 'PM' && hours < 12) hours += 12;
  if (suffix === 'AM' && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${minutes}`;
};

const slashDateToIso = (value = '') => {
  const match = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';

  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

const createShiftIdFromEmail = (shift) => {
  const descriptorSlug = [shift.venue, shift.jobName || shift.event, shift.shiftName, shift.roleName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  const windowSlug = [shift.startDate, shift.startTime, shift.finishDate || shift.startDate, shift.finishTime]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const slug = [descriptorSlug, windowSlug || Date.now()].filter(Boolean).join('-');

  return `csc-email-${slug}`;
};

const inferVenueFromAcceptanceEmail = (jobText = '', roleText = '') => {
  const text = `${jobText} ${roleText}`.toLowerCase();

  if (/sofi|gxmain|worldcup/i.test(text) && !/watch party/i.test(text)) {
    return {
      venue: 'SoFi Stadium',
      city: 'Inglewood',
      address: '3883 W Century Blvd',
    };
  }

  if (/lamc|fan fest|coliseum/i.test(text)) {
    return {
      venue: 'Los Angeles Memorial Coliseum',
      city: 'Los Angeles',
      address: '3911 S Figueroa St',
    };
  }

  if (/long beach|watch party/i.test(text)) {
    return {
      venue: 'City Of Long Beach',
      city: 'Long Beach',
      address: '',
    };
  }

  return {
    venue: '',
    city: '',
    address: '',
  };
};

const cleanEventNameFromJob = (jobText = '') => {
  const cleaned = String(jobText || '')
    .replace(/\s+[–-]\s+(morning|afternoon|evening|night)\s+shift\s*$/i, '')
    .replace(/\s+\d{1,2}\/\d{1,2}\/\d{4}\s*$/i, '')
    .trim();

  return cleaned || String(jobText || '').trim();
};

const ACCEPTANCE_EMAIL_LABELS = [
  'Scheduled Start Time',
  'Scheduled Finish Time',
  'Scheduled Start',
  'Scheduled Finish',
  'Schedule for',
  'Attendance Policy Reminder',
  'Pre-Shift Health and Wellness Announcements',
  'Uniform Requirements',
  'Prohibited Items',
  'Uniform Notes',
  'ID Badge',
  'Event Date',
  'Job Start Time',
  'Job End Time',
  'Special Notes',
  'Venue Address',
  'Venue Name',
  'Event Name',
  'Shift Name',
  'Role Name',
  'Job Name',
  'Shift No',
  'Venue',
  'Shift',
  'Job',
  'Role',
];

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeEmailSource = (value = '') =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .replace(/\r/g, '\n')
    .trim();

const cleanScannedTextBlock = (value = '') =>
  String(value || '')
    .replace(/\s+-\s+/g, '\n- ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n\s+/g, '\n')
    .replace(/\s+-\s*$/g, '')
    .trim();

const cleanScannedInlineText = (value = '') =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const truncateScannedTextAt = (value = '', phrases = []) => {
  let result = String(value || '');

  phrases.forEach((phrase) => {
    const index = result.toLowerCase().indexOf(String(phrase || '').toLowerCase());
    if (index >= 0) result = result.slice(0, index);
  });

  return result.trim();
};

const getAcceptanceField = (source = '', labels = []) => {
  const normalizedSource = normalizeEmailSource(source);
  const compact = normalizedSource.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  const orderedLabels = [...ACCEPTANCE_EMAIL_LABELS].sort((first, second) => second.length - first.length);

  for (const label of labels) {
    const startPattern = new RegExp(`(?:^|\\s)${escapeRegExp(label)}\\s*:\\s*`, 'i');
    const startMatch = startPattern.exec(compact);
    if (!startMatch) continue;

    const startIndex = startMatch.index + startMatch[0].length;
    const remaining = compact.slice(startIndex);
    const nextLabels = orderedLabels.filter((nextLabel) => nextLabel.toLowerCase() !== label.toLowerCase());
    const nextPattern = new RegExp(`\\s(?:${nextLabels.map(escapeRegExp).join('|')})\\s*:\\s*`, 'i');
    const nextMatch = nextPattern.exec(remaining);
    const endIndex = nextMatch ? nextMatch.index : remaining.length;
    const value = remaining.slice(0, endIndex).trim();

    if (value) return value.replace(/^[-:]+\s*/, '').trim();
  }

  const lines = normalizedSource
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const label of labels) {
    const pattern = new RegExp(`^${escapeRegExp(label)}\\s*:?\\s*(.*)$`, 'i');
    const line = lines.find((candidate) => pattern.test(candidate));
    const value = line?.match(pattern)?.[1]?.trim() || '';

    if (value) return value.replace(/^[-:]+\s*/, '').trim();
  }

  return '';
};

const parseDateTimeText = (value = '') => {
  const match = String(value || '').trim().match(
    /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM)?/i
  );

  if (!match) {
    return { date: '', time: '' };
  }

  return {
    date: slashDateToIso(match[1]),
    time: normalizeTimeValue(match[2], match[3] || ''),
  };
};

const inferVenueCityFromFields = (venueName = '', venueAddress = '') => {
  const venueText = String(venueName || '').trim();
  const addressText = String(venueAddress || '').trim();
  const combined = `${venueText} ${addressText}`.toLowerCase();

  if (/rose\s*bowl|1001\s+rose\s+bowl/i.test(combined)) {
    return {
      venue: venueText || 'Rose Bowl',
      city: 'Pasadena',
      address: addressText || '1001 Rose Bowl Dr',
    };
  }

  if (/kia\s+forum|the\s+forum|3600\s+pincay|3900\s+(?:w|west)\s+manchester/i.test(combined)) {
    return {
      venue: 'The Kia Forum',
      city: 'Inglewood',
      address: '3900 W Manchester Blvd, Inglewood, CA 90305',
    };
  }

  if (/sofi|hollywood\s+park|3883\s+w\s+century/i.test(combined)) {
    return {
      venue: venueText || 'SoFi Stadium',
      city: 'Inglewood',
      address: addressText || '3883 W Century Blvd',
    };
  }

  if (/coliseum|3911\s+s\s+figueroa/i.test(combined)) {
    return {
      venue: venueText || 'Los Angeles Memorial Coliseum',
      city: 'Los Angeles',
      address: addressText || '3911 S Figueroa St',
    };
  }

  return {
    venue: venueText,
    city: '',
    address: addressText,
  };
};

const buildScannedEmailNotes = ({
  source,
  titleText,
  scheduleForText,
  shiftNumberText,
  specialNotesText,
}) => {
  const emailMatch = source.match(/\b[A-Z0-9._%+-]+@csc-usa\.com\b/i);
  const urls = Array.from(new Set(source.match(/https?:\/\/[^\s)]+/gi) || []));
  const uniformType = normalizeCscUniformType(`${source} ${specialNotesText || ''}`);
  const cleanedSpecialNotes = stripCscEmailFluff(specialNotesText);

  return cleanCscShiftNotes(
    [
      titleText ? `Email type: ${titleText}.` : 'CSC shift email imported.',
      emailMatch ? `Sender: ${emailMatch[0]}.` : '',
      shiftNumberText ? `Shift No: ${shiftNumberText}.` : '',
      uniformType ? `Uniform: ${uniformType}.` : '',
      cleanedSpecialNotes ? `Special Notes:\n${cleanedSpecialNotes}` : '',
      urls.length ? `Links:\n${urls.join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n'),
    uniformType
  );
};

const extractKiaForumEntryAddress = (value = '') => {
  const text = cleanScannedTextBlock(value);
  const stripped = text.replace(/^ENTRY\s+POINT\s+ADDRESS\s*:\s*/i, '').trim();
  const parkingIndex = stripped.search(/\bParking\s+will\s+be\b/i);
  const rawAddress = parkingIndex >= 0 ? stripped.slice(0, parkingIndex).trim() : stripped;

  return rawAddress
    .replace(/,\s*(CA),\s*(\d{5}(?:-\d{4})?)/i, ', $1 $2')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractKiaForumParking = (value = '') => {
  const text = cleanScannedTextBlock(value);
  const match = text.match(/\b(Parking\s+will\s+be.*)$/i);

  return cleanCscParkingText(match?.[1]?.trim() || '');
};

const cleanKiaForumSignIn = (value = '') =>
  cleanScannedTextBlock(value)
    .replace(/^SIGN[-\s]?IN\s+(?:IS\s+|LOCATION\s*:?\s*)/i, '')
    .trim();

const normalizeKiaForumVenueName = (value = '') => {
  const venueText = cleanScannedTextBlock(value);

  if (/^(the\s+forum|forum)$/i.test(venueText)) return 'The Kia Forum';

  return venueText;
};

const parseKiaForumScheduleEmail = (text) => {
  const source = String(text || '').replace(/\u00a0/g, ' ').replace(/\r/g, '\n').trim();

  if (
    !source ||
    !/\b(the\s+forum|kia\s+forum)\b/i.test(source) ||
    !/\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?/i.test(source)
  ) {
    return [];
  }

  const lines = source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidateLines = lines.filter((line) => {
    const cells = line.split(/\t+/).map((cell) => cell.trim()).filter(Boolean);

    return (
      cells.length >= 8 &&
      /\b(the\s+forum|kia\s+forum)\b/i.test(cells.join(' ')) &&
      cells.some((cell) => /\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}/i.test(cell))
    );
  });

  return candidateLines
    .map((line) => {
      const cells = line.split(/\t+/).map((cell) => cell.trim()).filter(Boolean);

      if (cells.length < 8) return null;

      const [
        jobNameCell,
        venueCell,
        shiftNameCell,
        roleNameCell,
        startTimeCell,
        endTimeCell,
        entryPointCell,
        signInCell,
        ...uniformCells
      ] = cells;
      const startDateTime = parseDateTimeText(startTimeCell);
      const finishDateTime = parseDateTimeText(endTimeCell);

      if (!startDateTime.date && !finishDateTime.date) return null;

      const cleanedJobName = cleanScannedInlineText(jobNameCell);
      const cleanedShiftName = cleanScannedInlineText(shiftNameCell);
      const cleanedRoleName = cleanScannedInlineText(roleNameCell);
      const venueName = normalizeKiaForumVenueName(venueCell);
      const entryAddress = extractKiaForumEntryAddress(entryPointCell);
      const parking = extractKiaForumParking(entryPointCell);
      const signIn = cleanKiaForumSignIn(signInCell);
      const uniform = normalizeCscUniformType(`${uniformCells.join(' ')} ${line}`);
      const venueInfo = inferVenueCityFromFields(venueName, entryAddress);
      const notes = cleanCscShiftNotes(
        [
          'Email type: Kia Forum schedule import.',
          uniform ? `Uniform: ${uniform}.` : '',
          signIn ? `Sign-in location:\n${signIn}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        uniform
      );

      const parsedShift = normalizeShift({
        ...venueInfo,
        startDate: startDateTime.date,
        startTime: startDateTime.time,
        finishDate: finishDateTime.date || startDateTime.date,
        finishTime: finishDateTime.time,
        event: cleanedJobName || 'Kia Forum event',
        jobName: cleanedJobName || cleanedRoleName || 'Kia Forum shift',
        shiftName: cleanedShiftName,
        roleName: cleanedRoleName,
        shiftStatus: 'Scheduled',
        hourlyRate: DEFAULT_HOURLY_RATE,
        paidStatus: 'Unpaid',
        notes,
        parking,
        uniform,
      });

      return normalizeShift({
        ...parsedShift,
        id: createShiftIdFromEmail(parsedShift),
      });
    })
    .filter(Boolean);
};

const cleanScheduleTableCell = (value = '') =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\[([^\]]+)\]\((?:\\.|[^)])*\)/g, '$1')
    .replace(/\\([()*_])/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const getScheduleTableCells = (line = '') => {
  const rawLine = String(line || '').trim();

  if (rawLine.startsWith('|') && rawLine.endsWith('|')) {
    return rawLine
      .slice(1, -1)
      .split('|')
      .map(cleanScheduleTableCell);
  }

  return rawLine.split(/\t+/).map(cleanScheduleTableCell);
};

const getScheduleTableCell = (cells = [], index = 0) => String(cells[index] || '').trim();

const normalizeScheduleVenueName = (value = '') => {
  const venueText = cleanScannedTextBlock(value);

  if (/^(the\s+forum|forum)$/i.test(venueText)) return 'The Kia Forum';
  if (/^sofi\s+stadium\s+and\s+hollywood\s+park$/i.test(venueText)) return 'SoFi Stadium';

  return venueText;
};

const extractScheduleEntryAddress = (parkingText = '') => {
  const cleaned = cleanScannedTextBlock(parkingText);
  const entryMatch = cleaned.match(/ENTRY\s+POINT\s+ADDRESS\s*:\s*([\s\S]*?)(?:\s+Parking\s+will\s+be\b|\s+Location\s*:|\s+SIGN[-\s]?IN\b|$)/i);

  if (!entryMatch) return '';

  return entryMatch[1]
    .replace(/,\s*(CA),\s*(\d{5}(?:-\d{4})?)/i, ', $1 $2')
    .replace(/\s+/g, ' ')
    .trim();
};

const extractScheduleParking = (parkingText = '') => {
  const cleaned = cleanScannedTextBlock(parkingText);
  const parkingWillBeMatch = cleaned.match(/\b(Parking\s+will\s+be[\s\S]*)$/i);
  const locationMatch = cleaned.match(/\b(Location\s*:\s*[\s\S]*)$/i);
  const parking = (parkingWillBeMatch?.[1] || locationMatch?.[1] || cleaned)
    .replace(/^ENTRY\s+POINT\s+ADDRESS\s*:\s*[\s\S]*?(?=\b(?:Parking\s+will\s+be|Location\s*:))/i, '')
    .trim();

  return cleanCscParkingText(parking);
};

const parseSchedulingDetailsTableEmail = (text) => {
  const source = String(text || '').replace(/\u00a0/g, ' ').replace(/\r/g, '\n').trim();

  if (!source) return [];

  const lines = source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const headerIndex = lines.findIndex((line) =>
    /Job Name/i.test(line) &&
    /Venue/i.test(line) &&
    /Shift Name/i.test(line) &&
    /Start Time/i.test(line) &&
    /End Time/i.test(line)
  );

  const emailMatch = source.match(/\b[A-Z0-9._%+-]+@csc-usa\.com\b/i);
  const titleText = source.match(/Your Scheduling Details/i)?.[0] || 'CSC schedule table';
  const dataLines = headerIndex >= 0 ? lines.slice(headerIndex + 1) : lines;

  return dataLines
    .map((line) => {
      const cells = getScheduleTableCells(line);

      if (cells.length < 6) return null;

      const jobNameCell = getScheduleTableCell(cells, 0);
      const venueCell = getScheduleTableCell(cells, 1);
      const shiftNameCell = getScheduleTableCell(cells, 2);
      const roleNameCell = getScheduleTableCell(cells, 3);
      const startTimeCell = getScheduleTableCell(cells, 4);
      const endTimeCell = getScheduleTableCell(cells, 5);
      const parkingCell = getScheduleTableCell(cells, 6);
      const signInCell = getScheduleTableCell(cells, 7);
      const uniformCell = getScheduleTableCell(cells, 8);
      const startDateTime = parseDateTimeText(startTimeCell);
      const finishDateTime = parseDateTimeText(endTimeCell);

      // This also filters Markdown separator rows and unrelated pasted text.
      if (
        !startDateTime.date ||
        !startDateTime.time ||
        !finishDateTime.date ||
        !finishDateTime.time ||
        !venueCell
      ) {
        return null;
      }

      const venueName = normalizeScheduleVenueName(venueCell);
      const entryAddress = extractScheduleEntryAddress(parkingCell);
      const venueInfoFromFields = inferVenueCityFromFields(venueName, entryAddress);
      const venueInfoFromText = inferVenueFromAcceptanceEmail(
        `${jobNameCell} ${shiftNameCell}`,
        venueCell
      );
      const venueInfo =
        venueInfoFromFields.venue || venueInfoFromFields.address
          ? venueInfoFromFields
          : venueInfoFromText;
      const cleanedJobName = cleanScannedInlineText(jobNameCell);
      const cleanedShiftName = cleanScannedInlineText(shiftNameCell);
      const cleanedRoleName = cleanScannedInlineText(roleNameCell);
      const cleanedSignIn = cleanKiaForumSignIn(signInCell);
      const parking = extractScheduleParking(parkingCell);
      const uniform = normalizeCscUniformType(`${uniformCell} ${line}`);
      const eventText = /fifa|world\s*cup/i.test(cleanedJobName)
        ? '2026 FIFA World Cup'
        : cleanEventNameFromJob(cleanedJobName);
      const notes = cleanCscShiftNotes(
        [
          `Email type: ${titleText}.`,
          emailMatch ? `Sender: ${emailMatch[0]}.` : '',
          uniform ? `Uniform: ${uniform}.` : '',
          cleanedSignIn ? `Sign-in location:\n${cleanedSignIn}` : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        uniform
      );

      const parsedShift = normalizeShift({
        ...venueInfo,
        startDate: startDateTime.date,
        startTime: startDateTime.time,
        finishDate: finishDateTime.date || startDateTime.date,
        finishTime: finishDateTime.time,
        event: eventText,
        jobName: cleanedJobName || cleanedRoleName || 'CSC scheduled shift',
        shiftName: cleanedShiftName,
        roleName: cleanedRoleName,
        shiftStatus: 'Scheduled',
        hourlyRate: DEFAULT_HOURLY_RATE,
        paidStatus: 'Unpaid',
        notes,
        parking,
        uniform,
      });

      return normalizeShift({
        ...parsedShift,
        id: createShiftIdFromEmail(parsedShift),
      });
    })
    .filter(Boolean);
};

const parseAcceptanceEmail = (text) => {
  const source = normalizeEmailSource(text);

  if (!source) return null;

  const eventDateText = getAcceptanceField(source, ['Event Date']);
  const oldJobText = getAcceptanceField(source, ['Job']);
  const oldRoleText = getAcceptanceField(source, ['Role']);
  const jobNameText = getAcceptanceField(source, ['Job Name']);
  const eventNameText = getAcceptanceField(source, ['Event Name']);
  const venueNameText = getAcceptanceField(source, ['Venue Name', 'Venue']);
  const venueAddressText = getAcceptanceField(source, ['Venue Address']);
  const shiftNameText = getAcceptanceField(source, ['Shift Name']);
  const roleNameText = getAcceptanceField(source, ['Role Name']);
  const inlineShiftText = getAcceptanceField(source, ['Shift']);
  const shiftNumberText = getAcceptanceField(source, ['Shift No']);
  const scheduleForText = getAcceptanceField(source, ['Schedule for']);
  const jobStartText = getAcceptanceField(source, ['Job Start Time', 'Scheduled Start Time', 'Scheduled Start']);
  const jobEndText = getAcceptanceField(source, ['Job End Time', 'Scheduled Finish Time', 'Scheduled Finish']);
  const specialNotesText = getAcceptanceField(source, ['Special Notes']);
  const uniformRequirementsText = getAcceptanceField(source, ['Uniform Requirements', 'Uniform Notes']);
  const attendanceText = getAcceptanceField(source, ['Attendance Policy Reminder']);
  const healthText = truncateScannedTextAt(getAcceptanceField(source, ['Pre-Shift Health and Wellness Announcements']), [
    'We hope you have an amazing shift',
    'Schedule for',
  ]);
  const approvedTitleMatch = source.match(/APPROVED\s*[–-]\s*Schedule\s+Update/i);
  const courtesyTitleMatch = source.match(/Courtesy\s+Shift\s+Reminder\s*&\s*Important\s+Info/i);
  const titleText = approvedTitleMatch?.[0] || courtesyTitleMatch?.[0] || '';

  const jobText = jobNameText || oldJobText || '';
  const shiftText = shiftNameText || inlineShiftText || '';
  const eventText = eventNameText || cleanEventNameFromJob(oldJobText || jobNameText || '');
  const roleText = oldRoleText || roleNameText || '';
  const eventDate = slashDateToIso(eventDateText || '');
  const startDateTime = parseDateTimeText(jobStartText);
  const finishDateTime = parseDateTimeText(jobEndText);
  const timeMatch = roleText.match(
    /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM)?\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM)?/i
  );

  const hasUsefulData = Boolean(
    jobText ||
    eventText ||
    roleText ||
    shiftText ||
    venueNameText ||
    eventDate ||
    startDateTime.date ||
    finishDateTime.date ||
    scheduleForText ||
    attendanceText ||
    healthText
  );

  if (!hasUsefulData) return null;

  const inferredFromFields = inferVenueCityFromFields(venueNameText, venueAddressText);
  const inferredFromText = inferVenueFromAcceptanceEmail(`${jobText} ${shiftText} ${eventText}`, roleText || `${eventText} ${venueNameText}`);
  const venueInfo = inferredFromFields.venue || inferredFromFields.address ? inferredFromFields : inferredFromText;
  const startDate = startDateTime.date || slashDateToIso(timeMatch?.[1] || '') || eventDate;
  const startTime = startDateTime.time || normalizeTimeValue(timeMatch?.[2] || '', timeMatch?.[3] || '');
  const finishDate = finishDateTime.date || slashDateToIso(timeMatch?.[4] || '') || startDate;
  const finishTime = finishDateTime.time || normalizeTimeValue(timeMatch?.[5] || '', timeMatch?.[6] || '');
  const parsedRoleName = roleNameText || roleText.split(/\s+[–-]\s+\d{1,2}\/\d{1,2}\/\d{4}\s+/i)[0]?.trim() || '';
  const uniform = normalizeCscUniformType(`${source} ${uniformRequirementsText} ${specialNotesText}`);
  const notes = buildScannedEmailNotes({
    source,
    titleText,
    scheduleForText,
    shiftNumberText,
    specialNotesText: [specialNotesText, uniformRequirementsText].filter(Boolean).join('\n\n'),
    attendanceText,
    healthText,
  });
  const parsedShift = normalizeShift({
    ...venueInfo,
    startDate,
    startTime,
    finishDate,
    finishTime,
    event: eventText || (courtesyTitleMatch ? 'CSC courtesy shift reminder' : cleanEventNameFromJob(jobText)),
    jobName: jobText || shiftText || parsedRoleName || 'Accepted CSC shift',
    shiftName: shiftText,
    roleName: parsedRoleName,
    shiftStatus: 'Scheduled',
    hourlyRate: DEFAULT_HOURLY_RATE,
    paidStatus: 'Unpaid',
    notes,
    parking: '',
    uniform,
  });

  return normalizeShift({
    ...parsedShift,
    id: createShiftIdFromEmail(parsedShift),
  });
};

const WISH_ESS_MONTH_NUMBERS = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};

const cleanWishEssCell = (value = '') => {
  const text = String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\\([():])/g, '$1')
    .trim();
  const markdownLinkLabel = text.match(/^\[([^\]]+)\]/)?.[1];

  return cleanScannedInlineText(markdownLinkLabel || text);
};

const parseWishEssDateTime = (value = '') => {
  const cleaned = cleanWishEssCell(value);
  const slashDateTime = parseDateTimeText(cleaned);

  if (slashDateTime.date && slashDateTime.time) return slashDateTime;

  const monthNameMatch = cleaned.match(
    /\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\s+(\d{1,2}:\d{2})(?::\d{2})?\s*(AM|PM)?\b/i
  );

  if (!monthNameMatch) return { date: '', time: '' };

  const month = WISH_ESS_MONTH_NUMBERS[monthNameMatch[2].slice(0, 3).toLowerCase()];
  if (!month) return { date: '', time: '' };

  return {
    date: `${monthNameMatch[3]}-${month}-${String(monthNameMatch[1]).padStart(2, '0')}`,
    time: normalizeTimeValue(monthNameMatch[4], monthNameMatch[5] || ''),
  };
};

const normalizeWishEssVenueFields = (venueValue = '', addressValue = '') => {
  const rawVenue = cleanWishEssCell(venueValue);
  const address = cleanWishEssCell(addressValue);
  let venue = rawVenue;
  let city = '';

  [
    ['Long Beach', /\s+Long\s+Beach$/i],
    ['Los Angeles', /\s+Los\s+Angeles$/i],
    ['Inglewood', /\s+Inglewood$/i],
    ['Pasadena', /\s+Pasadena$/i],
  ].some(([nextCity, suffixPattern]) => {
    if (!suffixPattern.test(venue)) return false;
    city = nextCity;
    venue = venue.replace(suffixPattern, '').trim();
    return true;
  });

  if (/long\s+beach\s+amphitheater/i.test(`${venue} ${address}`)) {
    return {
      venue: 'Long Beach Amphitheater',
      city: 'Long Beach',
      address: address || '1051 Queens Hwy',
    };
  }

  const inferredVenue = inferVenueCityFromFields(venue, address);

  return {
    ...inferredVenue,
    city: inferredVenue.city || city,
  };
};

const cleanWishEssEventName = (value = '') =>
  cleanWishEssCell(value)
    .replace(/^OCT\s+\d{4}\s+/i, '')
    .replace(/^\d{6,8}\s*/i, '')
    .replace(/^\d{4}\s+/i, '')
    .trim();

const getWishEssTableCells = (line = '') => {
  const rawLine = String(line || '').trim();

  if (rawLine.startsWith('|') && rawLine.endsWith('|')) {
    return rawLine
      .slice(1, -1)
      .split('|')
      .map(cleanWishEssCell);
  }

  return rawLine.split(/\t+/).map(cleanWishEssCell);
};

const parseWishEssUpcomingSchedules = (text) => {
  const source = String(text || '').replace(/\u00a0/g, ' ').replace(/\r/g, '\n').trim();

  if (!source || !/Your\s+Upcoming\s+Schedules/i.test(source)) return [];

  return source
    .split(/\n+/)
    .map((line) => getWishEssTableCells(line))
    .map((cells) => {
      if (cells.length < 6) return null;

      const [startCell, finishCell, venueCell, addressCell, eventCell, jobNameCell] = cells;
      const startDateTime = parseWishEssDateTime(startCell);
      const finishDateTime = parseWishEssDateTime(finishCell);

      if (
        !startDateTime.date ||
        !startDateTime.time ||
        !finishDateTime.date ||
        !finishDateTime.time
      ) {
        return null;
      }

      const venueInfo = normalizeWishEssVenueFields(venueCell, addressCell);
      const event = cleanWishEssEventName(eventCell) || cleanWishEssCell(jobNameCell);
      const jobName = cleanWishEssCell(jobNameCell) || event;
      const parsedShift = normalizeShift({
        ...venueInfo,
        startDate: startDateTime.date,
        startTime: startDateTime.time,
        finishDate: finishDateTime.date,
        finishTime: finishDateTime.time,
        event,
        jobName,
        shiftName: '',
        roleName: '',
        shiftStatus: 'Scheduled',
        hourlyRate: DEFAULT_HOURLY_RATE,
        paidStatus: 'Unpaid',
        notes: 'Imported from Wish ESS Upcoming Schedules.',
        parking: '',
        uniform: '',
        scheduleSource: 'wish-ess',
        wishEssStatus: 'confirmed',
      });

      return normalizeShift({
        ...parsedShift,
        id: createShiftIdFromEmail(parsedShift),
      });
    })
    .filter(Boolean);
};

const tagSecondaryCscEmailShifts = (items = []) =>
  items.map((shift) =>
    normalizeShift({
      ...shift,
      scheduleSource: shift.scheduleSource || 'csc-email',
      wishEssStatus: shift.wishEssStatus || 'email-only',
    })
  );

const parseAcceptanceEmails = (text) => {
  const wishEssShifts = parseWishEssUpcomingSchedules(text);

  if (wishEssShifts.length) return wishEssShifts;

  const tableShifts = parseSchedulingDetailsTableEmail(text);

  if (tableShifts.length) return tagSecondaryCscEmailShifts(tableShifts);

  const kiaForumShifts = parseKiaForumScheduleEmail(text);

  if (kiaForumShifts.length) return tagSecondaryCscEmailShifts(kiaForumShifts);

  const singleShift = parseAcceptanceEmail(text);

  return singleShift ? tagSecondaryCscEmailShifts([singleShift]) : [];
};

const isWishEssScheduleUpdateText = (text = '') =>
  /Your\s+Upcoming\s+Schedules/i.test(
    String(text || '').replace(/\u00a0/g, ' ')
  );

const isAuthoritativeScheduleUpdateText = (text = '', parsedShifts = []) =>
  Boolean(parsedShifts.length && isWishEssScheduleUpdateText(text));


const normalizeForScanCompare = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const SCANNER_ASSIGNMENT_STOP_WORDS = new Set([
  'and',
  'approved',
  'call',
  'csc',
  'day',
  'dns',
  'entry',
  'entries',
  'event',
  'fill',
  'floor',
  'guard',
  'hires',
  'main',
  'new',
  'night',
  'prod',
  'production',
  'sec',
  'security',
  'shift',
  'stage',
  'staff',
  'tc',
  'worker',
  'workers',
  'yk',
]);

const getScannerAssignmentTokens = (shift = {}) =>
  getStoredScannerAssignmentTokens(shift);

const scannerAssignmentIdentityMatches = (firstShift = {}, secondShift = {}) =>
  storedScannerAssignmentIdentityMatches(firstShift, secondShift);

const scannerAssignmentIdentityConflicts = (firstShift = {}, secondShift = {}) => {
  const firstTokens = getScannerAssignmentTokens(firstShift);
  const secondTokens = getScannerAssignmentTokens(secondShift);

  if (!firstTokens.length || !secondTokens.length) return false;
  if (storedScannerSequenceConflicts(firstShift, secondShift)) return true;

  return !scannerAssignmentIdentityMatches(firstShift, secondShift);
};

const appendUniqueTextBlock = (existingText = '', nextText = '') => {
  const existing = String(existingText || '').trim();
  const next = String(nextText || '').trim();

  if (!next) return existing;
  if (!existing) return next;
  if (existing.includes(next)) return existing;

  return `${existing}\n\n${next}`;
};

const getShiftWindowKey = (shift = {}) =>
  [shift.startDate, shift.startTime, shift.finishDate || shift.startDate, shift.finishTime]
    .map((value) => String(value || '').trim())
    .join('|');

const hasCompleteShiftWindow = (shift = {}) =>
  Boolean(shift.startDate && shift.startTime && (shift.finishDate || shift.startDate) && shift.finishTime);

const shiftWindowsMatch = (firstShift = {}, secondShift = {}) =>
  hasCompleteShiftWindow(firstShift) &&
  hasCompleteShiftWindow(secondShift) &&
  getShiftWindowKey(firstShift) === getShiftWindowKey(secondShift);

const scanTextIncludes = (firstValue = '', secondValue = '') => {
  const first = normalizeForScanCompare(firstValue);
  const second = normalizeForScanCompare(secondValue);

  return Boolean(first && second && (first.includes(second) || second.includes(first)));
};

const scanTextEquals = (firstValue = '', secondValue = '') => {
  const first = normalizeForScanCompare(firstValue);
  const second = normalizeForScanCompare(secondValue);

  return Boolean(first && second && first === second);
};

const getScannerShiftStartTimestamp = (shift = {}) => {
  if (!shift.startDate || !shift.startTime) return Number.NaN;
  return new Date(`${shift.startDate}T${shift.startTime}:00`).getTime();
};

const getScannerShiftFinishTimestamp = (shift = {}) => {
  const finishDate = shift.finishDate || shift.startDate;
  if (!finishDate || !shift.finishTime) return Number.NaN;
  return new Date(`${finishDate}T${shift.finishTime}:00`).getTime();
};

const scannerShiftWindowsOverlap = (firstShift = {}, secondShift = {}) => {
  const firstStart = getScannerShiftStartTimestamp(firstShift);
  const firstFinish = getScannerShiftFinishTimestamp(firstShift);
  const secondStart = getScannerShiftStartTimestamp(secondShift);
  const secondFinish = getScannerShiftFinishTimestamp(secondShift);

  if (![firstStart, firstFinish, secondStart, secondFinish].every(Number.isFinite)) return false;

  return firstStart < secondFinish && secondStart < firstFinish;
};

const getScannedShiftMatchScore = (existingShift = {}, scannedShift = {}) => {
  let score = 0;

  if (scanTextIncludes(existingShift.venue, scannedShift.venue)) score += 2;
  if (scanTextIncludes(existingShift.address, scannedShift.address)) score += 2;
  if (scanTextIncludes(existingShift.jobName, scannedShift.jobName)) score += 2;
  if (scanTextIncludes(existingShift.shiftName, scannedShift.shiftName)) score += 2;
  if (scanTextIncludes(existingShift.roleName, scannedShift.roleName)) score += 1;
  if (scanTextIncludes(existingShift.event, scannedShift.event)) score += 1;
  if (scanTextIncludes(existingShift.city, scannedShift.city)) score += 1;
  if (scannerAssignmentIdentityMatches(existingShift, scannedShift)) score += 4;
  if (shiftWindowsMatch(existingShift, scannedShift)) score += 4;

  return score;
};

const isWishEssScannedShift = (shift = {}) =>
  shift.scheduleSource === 'wish-ess';

const wishEssVenueOrAddressMatches = (existingShift = {}, scannedShift = {}) =>
  scanTextIncludes(existingShift.venue, scannedShift.venue) ||
  scanTextIncludes(existingShift.address, scannedShift.address);

const normalizeWishEssAssignmentIdentity = (shift = {}) =>
  normalizeForScanCompare(
    [shift.jobName, shift.event, shift.shiftName]
      .filter(Boolean)
      .join(' ')
  )
    .replace(/\br\s+and\s+b\b/g, ' rnb ')
    .replace(/\brandb\b/g, ' rnb ')
    .replace(/\br\s*&\s*b\b/g, ' rnb ')
    .replace(/\bproduction\b/g, ' prod ')
    .replace(/\bsecurity\b/g, ' sec ')
    .replace(/\s+/g, ' ')
    .trim();

const wishEssAssignmentIdentityMatches = (existingShift = {}, scannedShift = {}) => {
  if (scannerAssignmentIdentityMatches(existingShift, scannedShift)) return true;

  const existingIdentity = normalizeWishEssAssignmentIdentity(existingShift);
  const scannedIdentity = normalizeWishEssAssignmentIdentity(scannedShift);

  if (!existingIdentity || !scannedIdentity) return false;
  if (
    existingIdentity === scannedIdentity ||
    existingIdentity.includes(scannedIdentity) ||
    scannedIdentity.includes(existingIdentity)
  ) {
    return true;
  }

  const existingTokens = existingIdentity.split(' ').filter(Boolean);
  const scannedTokens = scannedIdentity.split(' ').filter(Boolean);
  const existingSet = new Set(existingTokens);
  const sharedTokens = scannedTokens.filter((token) => existingSet.has(token));
  const shorterLength = Math.min(existingTokens.length, scannedTokens.length);

  return shorterLength >= 2 && sharedTokens.length / shorterLength >= 0.6;
};

const isWishEssAuthoritativeMatch = (existingShift = {}, scannedShift = {}) => {
  if (!isWishEssScannedShift(scannedShift)) return false;
  if (!hasCompleteShiftWindow(existingShift) || !hasCompleteShiftWindow(scannedShift)) return false;

  const existingStatus = normalizeShiftStatus(existingShift.shiftStatus);
  if (existingStatus === 'Done' || existingStatus === 'Cancelled') return false;
  if (!wishEssVenueOrAddressMatches(existingShift, scannedShift)) return false;

  /*
   * Wish ESS is David's personal authoritative schedule. If Wish ESS and an
   * existing active record have the exact same venue and complete work window,
   * they represent one scheduled assignment even when email/event labels differ.
   * This is the key safeguard against duplicate Wish ESS rows.
   */
  if (shiftWindowsMatch(existingShift, scannedShift)) return true;

  /*
   * Schedule changes can move the time. In that case require the same work date,
   * venue, and a strong assignment identity before allowing Wish ESS to update
   * the existing record.
   */
  return (
    existingShift.startDate === scannedShift.startDate &&
    wishEssAssignmentIdentityMatches(existingShift, scannedShift)
  );
};

const isScannedAssignmentCandidate = (existingShift = {}, scannedShift = {}) => {
  if (!hasCompleteShiftWindow(existingShift) || !hasCompleteShiftWindow(scannedShift)) return false;

  if (isWishEssAuthoritativeMatch(existingShift, scannedShift)) return true;

  if (existingShift.startDate !== scannedShift.startDate) return false;

  const existingStatus = normalizeShiftStatus(existingShift.shiftStatus);
  if (existingStatus === 'Done' || existingStatus === 'Cancelled') return false;

  const venueOrAddressMatches =
    scanTextIncludes(existingShift.venue, scannedShift.venue) ||
    scanTextIncludes(existingShift.address, scannedShift.address);

  if (!venueOrAddressMatches) return false;

  const exactWindow = shiftWindowsMatch(existingShift, scannedShift);
  const windowsOverlap = scannerShiftWindowsOverlap(existingShift, scannedShift);
  const assignmentMatches = scannerAssignmentIdentityMatches(existingShift, scannedShift);
  const assignmentConflicts = scannerAssignmentIdentityConflicts(existingShift, scannedShift);

  if (assignmentMatches) {
    return true;
  }

  /*
   * For ordinary CSC email scans, assignment conflicts still block a merge.
   * Wish ESS has already been handled above with stricter authoritative rules.
   */
  if (assignmentConflicts) return false;

  if (exactWindow) return getScannedShiftMatchScore(existingShift, scannedShift) >= 4;
  if (windowsOverlap) return getScannedShiftMatchScore(existingShift, scannedShift) >= 6;

  return false;
};

const isSafeScannedDuplicateForCleanup = (existingShift = {}, scannedShift = {}) => {
  if (isWishEssAuthoritativeMatch(existingShift, scannedShift)) return true;
  if (!isScannedAssignmentCandidate(existingShift, scannedShift)) return false;
  if (shiftWindowsMatch(existingShift, scannedShift)) return true;
  if (scannerShiftWindowsOverlap(existingShift, scannedShift)) return true;
  if (!scannerAssignmentIdentityMatches(existingShift, scannedShift)) return false;

  const existingCalendared = isShiftCalendared(existingShift);
  const scannedCalendared = isShiftCalendared(scannedShift);

  if (existingCalendared !== scannedCalendared) return true;

  return (
    scanTextEquals(existingShift.jobName, scannedShift.jobName) ||
    scanTextEquals(existingShift.event, scannedShift.event)
  );
};

const isScannedOverlappingDuplicateMatch = (existingShift = {}, scannedShift = {}) =>
  isScannedAssignmentCandidate(existingShift, scannedShift) &&
  scannerShiftWindowsOverlap(existingShift, scannedShift);

const isScannedScheduleChangeMatch = (existingShift = {}, scannedShift = {}) =>
  isScannedAssignmentCandidate(existingShift, scannedShift) &&
  !shiftWindowsMatch(existingShift, scannedShift);

const findMatchingShiftIdForScannedEmail = (currentShifts = [], scannedShift = {}) => {
  if (!scannedShift?.startDate || !scannedShift?.startTime) return '';

  const exactIdMatch = currentShifts.find((shift) => shift.id === scannedShift.id);
  if (exactIdMatch) return exactIdMatch.id;

  /*
   * Wish ESS gets its own first-pass matcher. Prefer an existing canonical
   * record with the exact authoritative work window so importing Wish ESS
   * enriches that record instead of creating a second row.
   */
  if (isWishEssScannedShift(scannedShift)) {
    const wishCandidates = currentShifts
      .filter((shift) => isWishEssAuthoritativeMatch(shift, scannedShift))
      .map((shift, index) => ({
        shift,
        index,
        exactWindow: shiftWindowsMatch(shift, scannedShift) ? 1 : 0,
        calendared: isShiftCalendared(shift) ? 1 : 0,
        linked:
          shift.linkedOpportunityId || shift.createdFromOpportunityId ? 1 : 0,
        identityMatch: wishEssAssignmentIdentityMatches(shift, scannedShift) ? 1 : 0,
        score: getScannedShiftMatchScore(shift, scannedShift),
      }))
      .sort((first, second) =>
        second.exactWindow - first.exactWindow ||
        second.calendared - first.calendared ||
        second.linked - first.linked ||
        second.identityMatch - first.identityMatch ||
        second.score - first.score ||
        first.index - second.index
      );

    if (wishCandidates.length) return wishCandidates[0].shift.id;
  }

  const candidates = currentShifts.filter((shift) =>
    isScannedAssignmentCandidate(shift, scannedShift)
  );

  if (!candidates.length) {
    const sameStartDuplicate = currentShifts.find((shift) =>
      areLikelyDuplicateShifts(shift, scannedShift)
    );

    return sameStartDuplicate?.id || '';
  }

  const rankedCandidates = candidates
    .map((shift, index) => ({
      shift,
      index,
      exactWindow: shiftWindowsMatch(shift, scannedShift) ? 1 : 0,
      calendared: isShiftCalendared(shift) ? 1 : 0,
      assignmentMatch: scannerAssignmentIdentityMatches(shift, scannedShift) ? 1 : 0,
      score: getScannedShiftMatchScore(shift, scannedShift),
    }))
    .sort((first, second) =>
      second.exactWindow - first.exactWindow ||
      second.calendared - first.calendared ||
      second.assignmentMatch - first.assignmentMatch ||
      second.score - first.score ||
      first.index - second.index
    );

  return rankedCandidates[0]?.shift?.id || '';
};

const createUniqueScannedShiftId = (currentById, scannedShift = {}) => {
  const baseId = scannedShift.id || createShiftIdFromEmail(scannedShift);
  const existingShift = currentById.get(baseId);

  if (!existingShift) return baseId;

  if (shiftWindowsMatch(existingShift, scannedShift)) return baseId;

  const suffix = [scannedShift.startDate, scannedShift.startTime, scannedShift.finishDate, scannedShift.finishTime]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const trimmedBaseId = baseId.slice(0, Math.max(24, 110 - suffix.length));
  let uniqueId = `${trimmedBaseId}-${suffix || Date.now()}`;
  let counter = 2;

  while (currentById.has(uniqueId)) {
    uniqueId = `${trimmedBaseId}-${suffix || Date.now()}-${counter}`;
    counter += 1;
  }

  return uniqueId;
};

const mergeScannedShiftWithExisting = (existingShift = {}, scannedShift = {}) => {
  const incomingIsWishEss = scannedShift.scheduleSource === 'wish-ess';
  const existingIsWishEssConfirmed =
    existingShift.scheduleSource === 'wish-ess' &&
    existingShift.wishEssStatus === 'confirmed';

  if (existingIsWishEssConfirmed && !incomingIsWishEss) {
    return normalizeShift({
      ...existingShift,
      shiftName: scannedShift.shiftName || existingShift.shiftName || '',
      roleName: scannedShift.roleName || existingShift.roleName || '',
      notes: cleanCscShiftNotes(
        appendUniqueShiftTextBlock(existingShift.notes, scannedShift.notes),
        existingShift.uniform || scannedShift.uniform || ''
      ),
      parking: scannedShift.parking || existingShift.parking,
      uniform:
        scannedShift.uniform ||
        existingShift.uniform ||
        normalizeCscUniformType(scannedShift.notes || existingShift.notes || ''),
      supervisor: scannedShift.supervisor || existingShift.supervisor,
      scheduleSource: 'wish-ess',
      wishEssStatus: 'confirmed',
      wishEssVerifiedAt: existingShift.wishEssVerifiedAt || '',
      wishEssSnapshotId: existingShift.wishEssSnapshotId || '',
    });
  }

  const merged = mergeDuplicateShiftRecords(
    existingShift,
    scannedShift,
    incomingIsWishEss
  );

  return normalizeShift({
    ...merged,
    /*
     * Wish ESS does not provide shift name or role in Upcoming Schedules.
     * Preserve those richer secondary-email fields when Wish ESS confirms the
     * authoritative date/time/venue/event/job.
     */
    shiftName:
      incomingIsWishEss
        ? existingShift.shiftName || scannedShift.shiftName || ''
        : scannedShift.shiftName || existingShift.shiftName || '',
    roleName:
      incomingIsWishEss
        ? existingShift.roleName || scannedShift.roleName || ''
        : scannedShift.roleName || existingShift.roleName || '',
    uniform:
      incomingIsWishEss
        ? existingShift.uniform || scannedShift.uniform || ''
        : scannedShift.uniform || existingShift.uniform || '',
    scheduleSource:
      incomingIsWishEss
        ? 'wish-ess'
        : existingShift.scheduleSource || scannedShift.scheduleSource || 'csc-email',
    wishEssStatus:
      incomingIsWishEss
        ? 'confirmed'
        : existingShift.wishEssStatus || scannedShift.wishEssStatus || 'email-only',
    wishEssVerifiedAt:
      incomingIsWishEss
        ? scannedShift.wishEssVerifiedAt || new Date().toISOString()
        : existingShift.wishEssVerifiedAt || '',
    wishEssSnapshotId:
      incomingIsWishEss
        ? scannedShift.wishEssSnapshotId || existingShift.wishEssSnapshotId || ''
        : existingShift.wishEssSnapshotId || '',
  });
};

const hasShiftCalendarTimeChanged = (existingShift = {}, updatedShift = {}) =>
  hasCompleteShiftWindow(existingShift) &&
  hasCompleteShiftWindow(updatedShift) &&
  getShiftWindowKey(existingShift) !== getShiftWindowKey(updatedShift);

const hasShiftCalendarPayloadChanged = (existingShift = {}, updatedShift = {}) =>
  JSON.stringify(buildShiftCalendarEventPayload(existingShift)) !==
  JSON.stringify(buildShiftCalendarEventPayload(updatedShift));

const parseCsv = (text) => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    return normalizeShift({
      id: row.id,
      startDate: row.startDate,
      startTime: row.startTime,
      finishDate: row.finishDate,
      finishTime: row.finishTime,
      venue: row.venue,
      city: row.city,
      address: row.address,
      event: row.event,
      jobName: row.jobName,
      shiftName: row.shiftName,
      roleName: row.roleName,
      shiftStatus: row.shiftStatus,
      hourlyRate: row.hourlyRate,
      paidStatus: row.paidStatus,
      paymentDate: row.paymentDate,
      notes: row.notes,
      parking: row.parking,
      uniform: row.uniform,
      supervisor: row.supervisor,
      createdFromOpportunityId: row.createdFromOpportunityId,
      linkedOpportunityId: row.linkedOpportunityId,
      googleCalendarEventId: row.googleCalendarEventId,
      googleCalendarEventLink: row.googleCalendarEventLink,
      googleCalendarAddedAt: row.googleCalendarAddedAt,
    });
  });
};

const buildCsv = (shifts) => {
  const headers = [
    'id',
    'startDate',
    'startTime',
    'finishDate',
    'finishTime',
    'venue',
    'city',
    'address',
    'event',
    'jobName',
    'shiftName',
    'roleName',
    'hours',
    'shiftStatus',
    'hourlyRate',
    'estimatedPay',
    'paidStatus',
    'paymentDate',
    'notes',
    'parking',
    'uniform',
    'supervisor',
    'createdFromOpportunityId',
    'linkedOpportunityId',
    'googleCalendarEventId',
    'googleCalendarEventLink',
    'googleCalendarAddedAt',
  ];

  const rows = shifts.map((shift) => ({
    ...shift,
    hours: getShiftHours(shift).toFixed(2),
    estimatedPay: getEstimatedPay(shift).toFixed(2),
    paidStatus: getShiftPaymentStatusLabel(shift),
    paymentDate: shift.shiftStatus === 'Cancelled' ? '' : shift.paymentDate,
  }));

  return [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ].join('\n');
};

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const buildPremiumScheduleHtml = (shifts, summary) => {
  const rows = shifts
    .map(
      (shift) => `
        <section class="shift-card">
          <div class="shift-title-row">
            <div class="checkbox"></div>
            <div class="shift-title-copy">
              <h2>${escapeHtml(shift.venue || 'CSC Shift')}</h2>
              <p>${escapeHtml(shift.event || 'Event not entered')}</p>
            </div>
            <div class="status-pill">${escapeHtml(shift.shiftStatus)}</div>
          </div>
          <table>
            <tbody>
              <tr><th>Start</th><td>${escapeHtml(formatDate(shift.startDate))} ${escapeHtml(formatTime(shift.startTime))}</td></tr>
              <tr><th>Finish</th><td>${escapeHtml(formatDate(shift.finishDate))} ${escapeHtml(formatTime(shift.finishTime))}</td></tr>
              <tr><th>Venue Address</th><td>${escapeHtml(shift.address || 'Address not shown')}${shift.city ? `, ${escapeHtml(shift.city)}` : ''}</td></tr>
              ${shouldShowDistinctJobName(shift) ? `<tr><th>Job Name</th><td>${escapeHtml(shift.jobName)}</td></tr>` : ''}
              ${shift.shiftName ? `<tr><th>Shift Name</th><td>${escapeHtml(shift.shiftName)}</td></tr>` : ''}
              ${shift.roleName ? `<tr><th>Role Name</th><td>${escapeHtml(shift.roleName)}</td></tr>` : ''}
              <tr><th>Uniform</th><td>${escapeHtml(shift.uniform || 'Not entered')}</td></tr>
              <tr><th>Hours</th><td>${getShiftHours(shift).toFixed(1)}</td></tr>
              <tr><th>Hourly Rate</th><td>${escapeHtml(getShiftHourlyRateLabel(shift))}</td></tr>
              <tr><th>Estimated Pay</th><td>${escapeHtml(formatCurrency(getEstimatedPay(shift)))}</td></tr>
              <tr><th>Paid Status</th><td>${escapeHtml(getShiftPaymentStatusLabel(shift))}${shift.shiftStatus !== 'Cancelled' && shift.paymentDate ? `, ${escapeHtml(formatShortDate(shift.paymentDate))}` : ''}</td></tr>
              ${shift.parking ? `<tr><th>Parking</th><td>${escapeHtml(shift.parking)}</td></tr>` : ''}
              ${shift.supervisor ? `<tr><th>Supervisor</th><td>${escapeHtml(shift.supervisor)}</td></tr>` : ''}
              ${shift.notes ? `<tr><th>Notes</th><td>${escapeHtml(shift.notes)}</td></tr>` : ''}
            </tbody>
          </table>
        </section>`
    )
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>CSC Shifts List</title>
  <style>
    body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Georgia, 'Times New Roman', serif; }
    .document { max-width: 980px; margin: 32px auto; background: white; padding: 42px 46px; border-radius: 20px; box-shadow: 0 18px 60px rgba(15, 23, 42, 0.18); }
    h1 { margin: 0; text-align: center; font-size: 38px; line-height: 1.15; }
    .subtitle { margin: 10px 0 24px; text-align: center; color: #475569; font-size: 16px; }
    .rule { border-top: 3px solid #0f172a; margin: 0 0 26px; }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 24px; }
    .summary-card { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 14px; padding: 12px; }
    .summary-card strong { display: block; font-size: 18px; }
    .summary-card span { display: block; margin-top: 3px; color: #334155; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .company { border-left: 8px solid #d97706; background: #f8fafc; border-radius: 14px; padding: 14px 18px; margin-bottom: 18px; }
    .company strong { display: block; font-size: 18px; }
    .company p { margin: 4px 0 0; color: #334155; }
    .shifts-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
    .shift-card { border: 1px solid #dbe4ee; border-radius: 14px; padding: 12px 14px; break-inside: avoid; page-break-inside: avoid; }
    .shift-title-row { display: grid; grid-template-columns: 15px minmax(0, 1fr) auto; gap: 9px; align-items: start; }
    .shift-title-copy { min-width: 0; }
    .checkbox { width: 12px; height: 12px; border: 2px solid #0f172a; margin-top: 4px; }
    h2 { margin: 0; font-size: 16px; line-height: 1.15; }
    .shift-title-row h2, .shift-title-row p, th, td { white-space: normal; overflow-wrap: anywhere; word-break: break-word; }
    .shift-title-row p { margin: 3px 0 0; color: #475569; font-size: 12px; line-height: 1.25; }
    .status-pill { border: 1px solid #fde68a; background: #fffbeb; border-radius: 999px; padding: 4px 8px; font-size: 11px; font-weight: 700; white-space: nowrap; }
    table { width: 100%; border-collapse: collapse; margin-top: 9px; }
    th, td { border-top: 1px solid #e2e8f0; padding: 5px 0; text-align: left; vertical-align: top; font-size: 12px; line-height: 1.25; }
    th { width: 105px; color: #334155; font-weight: 700; padding-right: 8px; }
    td { color: #0f172a; }
    @media screen and (max-width: 760px) {
      .shifts-grid { grid-template-columns: 1fr; }
    }
    @media print {
      body { background: white; }
      .document { margin: 0; max-width: none; box-shadow: none; border-radius: 0; padding: 12px 14px; }
      h1 { font-size: 28px; }
      .subtitle { margin-bottom: 14px; font-size: 12px; }
      .rule { margin-bottom: 14px; }
      .company { margin-bottom: 10px; padding: 9px 12px; }
      .company strong { font-size: 14px; }
      .company p { font-size: 11px; }
      .summary { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; margin-bottom: 10px; }
      .summary-card { border-radius: 10px; padding: 7px; }
      .summary-card strong { font-size: 14px; }
      .summary-card span { font-size: 9px; }
      .shifts-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
      .shift-card { border-radius: 10px; padding: 8px 9px; }
      h2 { font-size: 13px; }
      .shift-title-row p { font-size: 10px; }
      .status-pill { font-size: 9px; padding: 2px 6px; }
      th, td { padding: 3px 0; font-size: 9.5px; }
      th { width: 78px; }
    }
  </style>
</head>
<body>
  <main class="document">
    <h1>CSC Shifts List</h1>
    <p class="subtitle">Structured shift schedule, generated ${escapeHtml(new Date().toISOString().slice(0, 10))}</p>
    <div class="rule"></div>
    <section class="company">
      <strong>${escapeHtml(CSC_COMPANY.name)} - ${escapeHtml(CSC_COMPANY.branch)}</strong>
      <p>${escapeHtml(CSC_COMPANY.address)}</p>
      <p>${escapeHtml(CSC_COMPANY.phone)} | ${escapeHtml(CSC_COMPANY.website)}</p>
    </section>
    <section class="summary">
      <div class="summary-card"><strong>${summary.totalShifts}</strong><span>Shifts</span></div>
      <div class="summary-card"><strong>${summary.totalHours.toFixed(1)}</strong><span>Hours</span></div>
      <div class="summary-card"><strong>${escapeHtml(formatCurrency(summary.estimatedPay))}</strong><span>Est. Pay</span></div>
      <div class="summary-card"><strong>${escapeHtml(formatCurrency(summary.owedAmount || summary.unpaidAmount))}</strong><span>Still Owed</span></div>
    </section>
    ${rows ? `<section class="shifts-grid">${rows}</section>` : '<p>No shifts match the current filters.</p>'}
  </main>
</body>
</html>`;
};

const getMonthKey = (dateValue) => {
  if (dateValue instanceof Date) {
    if (Number.isNaN(dateValue.getTime())) return 'No date';

    return `${dateValue.getFullYear()}-${String(dateValue.getMonth() + 1).padStart(2, '0')}`;
  }

  if (typeof dateValue === 'string') {
    const normalizedDate = dateValue.trim();
    const monthMatch = normalizedDate.match(/^(\d{4})-(\d{2})(?:-\d{2})?/);

    if (monthMatch) return `${monthMatch[1]}-${monthMatch[2]}`;
  }

  return 'No date';
};

const getMonthLabel = (monthKey) => {
  if (monthKey === 'No date') return monthKey;

  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

const getMonthKeyWithOffset = (offset = 0) => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() + offset);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

const parseLocalDate = (dateValue) => {
  if (!dateValue || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;

  const [year, month, day] = dateValue.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const toLocalDateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;

const getWeekRange = (dateValue) => {
  const date = parseLocalDate(dateValue);
  if (!date) return null;

  const dayOffset = (date.getDay() + 1) % 7;
  const startDate = new Date(date);
  startDate.setDate(date.getDate() - dayOffset);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  return {
    weekKey: toLocalDateKey(startDate),
    startDate,
    endDate,
  };
};

const getCscPayDate = (shift = {}) => {
  if (shift.shiftStatus === 'Cancelled') return '';
  if (shift.paymentDate) return shift.paymentDate;

  const weekRange = getWeekRange(shift.startDate);
  if (!weekRange) return '';

  const payDate = new Date(weekRange.endDate);
  payDate.setDate(payDate.getDate() + 7);

  return toLocalDateKey(payDate);
};

const formatWeekRange = (startDate, endDate) =>
  `${formatAppShortDate(startDate)} - ${formatAppShortDate(endDate)}`;

const MONTH_RANGE_OPTIONS = [
  { value: 'focus', label: 'Past, Current, Next' },
  { value: 'prior', label: 'Prior Months' },
  { value: 'currentYear', label: 'Current Year' },
  { value: 'historical', label: 'Historical All-Time' },
];

const readArrayStorage = (storageKey, fallback = []) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || 'null');
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const navigateToAppTab = (tab, recordId = '', extra = {}) => {
  window.dispatchEvent(
    new CustomEvent(APP_NAVIGATE_EVENT, {
      detail: { tab, recordId, ...extra },
    })
  );
};

const clearCscShiftReturnContext = () => {
  try {
    sessionStorage.removeItem(CSC_RETURN_CONTEXT_STORAGE_KEY);
    localStorage.removeItem(CSC_RETURN_CONTEXT_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear the CSC shift return location:', error);
  }
};

const normalizeCscShiftReturnContext = (context = null) => {
  const returnTab = String(context?.returnTab || '').trim();
  const returnRecordId = String(context?.returnRecordId || '').trim();
  const openedShiftId = String(context?.openedShiftId || context?.shiftId || '').trim();

  if (!returnTab) return null;

  return {
    returnTab,
    returnRecordId,
    openedShiftId,
  };
};

const readCscShiftReturnContext = () => {
  try {
    const rawContext =
      sessionStorage.getItem(CSC_RETURN_CONTEXT_STORAGE_KEY) ||
      localStorage.getItem(CSC_RETURN_CONTEXT_STORAGE_KEY) ||
      '';

    if (!rawContext) return null;

    return normalizeCscShiftReturnContext(JSON.parse(rawContext));
  } catch (error) {
    console.error('Failed to read the CSC shift return location:', error);
    clearCscShiftReturnContext();
    return null;
  }
};

const createRelatedRecordId = (prefix = 'record') =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const readStoredRides = () => [
  ...readArrayStorage(RIDES_STORAGE_KEY, []),
  ...readArrayStorage(RIDES_ARCHIVE_STORAGE_KEY, []),
];

const readStoredPaychecks = () => readArrayStorage(PAYCHECK_STORAGE_KEY, []);

const parsePaycheckMoney = (value) => {
  const number = Number(String(value ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(number) ? number : 0;
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

const getActualPaycheckGross = (paycheck = {}) => {
  const statedGross = parsePaycheckMoney(paycheck.grossPay);
  if (statedGross) return statedGross;

  return Array.isArray(paycheck.earningsLines)
    ? paycheck.earningsLines.reduce(
        (sum, line) => sum + parsePaycheckMoney(line?.amount),
        0
      )
    : 0;
};

const getActualPaycheckNet = (paycheck = {}) =>
  parsePaycheckMoney(paycheck.netPay || paycheck.checkAmount);

const roundPaycheckCurrency = (value = 0) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const getReportPaycheckGross = (paycheck = {}) =>
  Number.isFinite(paycheck.reportActualGross)
    ? paycheck.reportActualGross
    : getActualPaycheckGross(paycheck);

const getReportPaycheckNet = (paycheck = {}) =>
  Number.isFinite(paycheck.reportActualNet)
    ? paycheck.reportActualNet
    : getActualPaycheckNet(paycheck);

const normalizePaycheckDate = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return '';

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const monthFirstMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (!monthFirstMatch) {
    const monthNameMatch = text.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})$/);
    if (!monthNameMatch) return '';

    const parsedDate = new Date(`${monthNameMatch[1]} ${monthNameMatch[2]}, ${monthNameMatch[3]} 12:00:00`);
    if (Number.isNaN(parsedDate.getTime())) return '';
    return toLocalDateKey(parsedDate);
  }

  const year = monthFirstMatch[3].length === 2
    ? `20${monthFirstMatch[3]}`
    : monthFirstMatch[3];
  const month = monthFirstMatch[1].padStart(2, '0');
  const day = monthFirstMatch[2].padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftPaycheckDate = (value = '', days = 0) => {
  const dateValue = normalizePaycheckDate(value);
  const date = parseLocalDate(dateValue);
  if (!date) return '';

  date.setDate(date.getDate() + days);
  return toLocalDateKey(date);
};

const PAYCHECK_REPORT_DATE_PATTERN =
  '(?:[A-Za-z]{3,9}\\s+\\d{1,2},\\s*\\d{4}|\\d{1,2}[\\/-]\\d{1,2}[\\/-](?:\\d{4}|\\d{2}))';

const findPaycheckDateAfterLabel = (text = '', labelPattern = '') => {
  const match = String(text || '').match(
    new RegExp(`${labelPattern}\\s*:?\\s*(${PAYCHECK_REPORT_DATE_PATTERN})`, 'i')
  );
  return match ? normalizePaycheckDate(match[1]) : '';
};

const getPaycheckPeriodRange = (paycheck = {}) => {
  let startDate = normalizePaycheckDate(paycheck.payPeriodStart);
  let endDate = normalizePaycheckDate(paycheck.payPeriodEnd);
  const scanText = String(paycheck.scanText || '').replace(/\s+/g, ' ').trim();

  if ((!startDate || !endDate) && scanText) {
    startDate = startDate || findPaycheckDateAfterLabel(
      scanText,
      '(?:Pay\\s+)?Period\\s+(?:Beginning|Begin|Start|From)'
    );
    endDate = endDate || findPaycheckDateAfterLabel(
      scanText,
      '(?:Pay\\s+)?Period\\s+(?:Ending|End|Through|Thru|To)'
    );

    if (!startDate || !endDate) {
      const rangePatterns = [
        new RegExp(
          `(?:Pay\\s+)?Period(?:\\s+Dates?)?\\s*:?\\s*(${PAYCHECK_REPORT_DATE_PATTERN})\\s*(?:-|–|—|to|through|thru)\\s*(${PAYCHECK_REPORT_DATE_PATTERN})`,
          'i'
        ),
        new RegExp(
          `Period\\s+(?:Beginning|Begin|Start)\\s+Period\\s+(?:Ending|End)(?:\\s+Check\\s+Date)?\\s+(${PAYCHECK_REPORT_DATE_PATTERN})\\s+(${PAYCHECK_REPORT_DATE_PATTERN})`,
          'i'
        ),
      ];

      for (const pattern of rangePatterns) {
        const match = scanText.match(pattern);
        if (!match) continue;

        startDate = startDate || normalizePaycheckDate(match[1]);
        endDate = endDate || normalizePaycheckDate(match[2]);
        if (startDate && endDate) break;
      }
    }
  }

  if (!startDate && !endDate) return null;
  if (!startDate) startDate = shiftPaycheckDate(endDate, -6);
  if (!endDate) endDate = shiftPaycheckDate(startDate, 6);
  if (!startDate || !endDate) return null;

  return startDate <= endDate
    ? { startDate, endDate }
    : { startDate: endDate, endDate: startDate };
};

const getPaycheckWorkDates = (paycheck = {}) => {
  const periodRange = getPaycheckPeriodRange(paycheck);
  const checkDate = normalizePaycheckDate(paycheck.checkDate);
  const candidateYears = Array.from(
    new Set(
      [periodRange?.startDate, periodRange?.endDate, checkDate]
        .filter(Boolean)
        .map((dateValue) => dateValue.slice(0, 4))
    )
  );
  const workDates = new Set();

  (Array.isArray(paycheck.earningsLines) ? paycheck.earningsLines : []).forEach((line) => {
    const savedDate = normalizePaycheckDate(
      line?.workDate || line?.dateWorked || line?.date || ''
    );
    if (savedDate) {
      workDates.add(savedDate);
      return;
    }

    const workLine = String(line?.workLine || '');
    const explicitDateMatch = workLine.match(
      /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/
    );
    if (explicitDateMatch) {
      const explicitDate = explicitDateMatch[1]
        ? `${explicitDateMatch[1]}-${explicitDateMatch[2].padStart(2, '0')}-${explicitDateMatch[3].padStart(2, '0')}`
        : `${explicitDateMatch[6]}-${explicitDateMatch[4].padStart(2, '0')}-${explicitDateMatch[5].padStart(2, '0')}`;
      if (parseLocalDate(explicitDate)) workDates.add(explicitDate);
      return;
    }

    const compactMonthDay = workLine.match(/(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/);
    if (!compactMonthDay) return;

    for (const year of candidateYears) {
      const candidate = `${year}-${compactMonthDay[1]}-${compactMonthDay[2]}`;
      if (!parseLocalDate(candidate)) continue;
      if (
        periodRange &&
        (candidate < periodRange.startDate || candidate > periodRange.endDate)
      ) {
        continue;
      }
      workDates.add(candidate);
      break;
    }
  });

  return workDates;
};

const getPaycheckEarningsLineDate = (line = {}, paycheck = {}) => {
  const savedDate = normalizePaycheckDate(
    line?.workDate || line?.dateWorked || line?.date || ''
  );
  if (savedDate) return savedDate;

  const workLine = String(line?.workLine || '');
  const explicitDateMatch = workLine.match(
    /(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})/
  );
  if (explicitDateMatch) {
    const explicitDate = explicitDateMatch[1]
      ? `${explicitDateMatch[1]}-${explicitDateMatch[2].padStart(2, '0')}-${explicitDateMatch[3].padStart(2, '0')}`
      : `${explicitDateMatch[6]}-${explicitDateMatch[4].padStart(2, '0')}-${explicitDateMatch[5].padStart(2, '0')}`;
    return parseLocalDate(explicitDate) ? explicitDate : '';
  }

  const compactMonthDay = workLine.match(/(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/);
  if (!compactMonthDay) return '';

  const periodRange = getPaycheckPeriodRange(paycheck);
  const checkDate = normalizePaycheckDate(paycheck.checkDate);
  const candidateYears = Array.from(
    new Set(
      [periodRange?.startDate, periodRange?.endDate, checkDate]
        .filter(Boolean)
        .map((dateValue) => dateValue.slice(0, 4))
    )
  );

  for (const year of candidateYears) {
    const candidate = `${year}-${compactMonthDay[1]}-${compactMonthDay[2]}`;
    if (!parseLocalDate(candidate)) continue;
    if (
      periodRange &&
      (candidate < periodRange.startDate || candidate > periodRange.endDate)
    ) {
      continue;
    }
    return candidate;
  }

  return '';
};

const getPaycheckEarningsLineAmount = (line = {}) =>
  parsePaycheckMoney(
    line?.amount ||
      line?.grossPay ||
      line?.earningsAmount ||
      line?.currentAmount ||
      0
  );

const getPaycheckEarningsLineHours = (line = {}) =>
  parsePaycheckMoney(
    line?.hours ||
      line?.totalHours ||
      line?.quantity ||
      line?.units ||
      0
  );

const getPaycheckReportAllocation = (
  paycheck = {},
  reportDoneShifts = [],
  allDoneShifts = [],
  reportStartDate = '',
  reportEndDate = ''
) => {
  const fullGross = getActualPaycheckGross(paycheck);
  const fullNet = getActualPaycheckNet(paycheck);
  const matchingReportShifts = reportDoneShifts.filter(
    (shift) => getPaychecksMatchingShift(shift, [paycheck]).length > 0
  );
  const reportShiftDates = new Set(
    matchingReportShifts
      .map((shift) => normalizePaycheckDate(shift.startDate))
      .filter(Boolean)
  );
  const periodRange = getPaycheckPeriodRange(paycheck);
  const earningsLines = Array.isArray(paycheck.earningsLines)
    ? paycheck.earningsLines
    : [];
  const datedLines = earningsLines
    .map((line) => ({
      date: getPaycheckEarningsLineDate(line, paycheck),
      amount: getPaycheckEarningsLineAmount(line),
      hours: getPaycheckEarningsLineHours(line),
    }))
    .filter((line) => line.date);
  const selectedDatedLines = datedLines.filter((line) =>
    reportShiftDates.has(line.date)
  );
  const totalDatedAmount = datedLines.reduce((sum, line) => sum + line.amount, 0);
  const selectedDatedAmount = selectedDatedLines.reduce(
    (sum, line) => sum + line.amount,
    0
  );
  const totalDatedHours = datedLines.reduce((sum, line) => sum + line.hours, 0);
  const selectedDatedHours = selectedDatedLines.reduce(
    (sum, line) => sum + line.hours,
    0
  );
  const allWorkDates = getPaycheckWorkDates(paycheck);
  const selectedWorkDateCount = Array.from(allWorkDates).filter((date) =>
    reportShiftDates.has(date)
  ).length;
  const paycheckTotalHours = parsePaycheckMoney(paycheck.totalHours);
  const selectedShiftHours = matchingReportShifts.reduce(
    (sum, shift) => sum + getShiftHours(shift),
    0
  );
  const allMatchingShifts = allDoneShifts.filter(
    (shift) => getPaychecksMatchingShift(shift, [paycheck]).length > 0
  );
  const selectedEstimatedPay = matchingReportShifts.reduce(
    (sum, shift) => sum + getEstimatedPay(shift),
    0
  );
  const totalEstimatedPay = allMatchingShifts.reduce(
    (sum, shift) => sum + getEstimatedPay(shift),
    0
  );
  const paycheckFallsInsideReport = Boolean(
    periodRange &&
      reportStartDate &&
      reportEndDate &&
      periodRange.startDate >= reportStartDate &&
      periodRange.endDate <= reportEndDate
  );

  let allocationRatio = 0;
  let allocationMethod = 'matched paycheck';

  if (totalDatedAmount > 0 && selectedDatedAmount > 0) {
    allocationRatio = selectedDatedAmount / totalDatedAmount;
    allocationMethod = 'dated earnings lines';
  } else if (totalDatedHours > 0 && selectedDatedHours > 0) {
    allocationRatio = selectedDatedHours / totalDatedHours;
    allocationMethod = 'dated earnings hours';
  } else if (allWorkDates.size > 0 && selectedWorkDateCount > 0) {
    allocationRatio = selectedWorkDateCount / allWorkDates.size;
    allocationMethod = 'scanned work dates';
  } else if (paycheckTotalHours > 0 && selectedShiftHours > 0) {
    allocationRatio = selectedShiftHours / paycheckTotalHours;
    allocationMethod = 'worked hours';
  } else if (totalEstimatedPay > 0 && selectedEstimatedPay > 0) {
    allocationRatio = selectedEstimatedPay / totalEstimatedPay;
    allocationMethod = 'matched shift earnings';
  } else if (paycheckFallsInsideReport) {
    allocationRatio = 1;
  } else if (fullGross > 0 && selectedEstimatedPay > 0) {
    allocationRatio = selectedEstimatedPay / fullGross;
    allocationMethod = 'selected shift estimate';
  }

  allocationRatio = Math.max(0, Math.min(1, allocationRatio));

  return {
    ...paycheck,
    reportActualGross: roundPaycheckCurrency(fullGross * allocationRatio),
    reportActualNet: roundPaycheckCurrency(fullNet * allocationRatio),
    reportAllocationRatio: allocationRatio,
    reportAllocationMethod: allocationMethod,
    reportIsPartial: allocationRatio > 0 && allocationRatio < 0.999999,
  };
};

const getPaycheckPeriodDisplay = (paycheck = {}) => {
  const periodRange = getPaycheckPeriodRange(paycheck);
  if (!periodRange) return 'Period not scanned';

  return `${formatShortDate(periodRange.startDate)} - ${formatShortDate(periodRange.endDate)}`;
};

const getLinkedRideForShift = (shift = {}) =>
  readStoredRides().find((ride) => ride.linkedCscShiftId === shift.id) || null;

const READY_RIDE_STATUSES = new Set([
  'approved',
  'booked',
  'completed',
  'confirmed',
  'done',
  'ready',
  'scheduled',
]);

const getShiftTravelReadiness = (shift = {}) => {
  const linkedRide = getLinkedRideForShift(shift);

  if (!linkedRide) {
    return {
      linkedRide: null,
      label: 'My Car',
      needsAttention: false,
      title: 'Driving my car. Click to arrange a ride instead.',
    };
  }

  const normalizedRideStatus = String(linkedRide.status || '').trim().toLowerCase();
  const rideReady =
    READY_RIDE_STATUSES.has(normalizedRideStatus) ||
    Boolean(linkedRide.completedAt || linkedRide.confirmedAt);

  return {
    linkedRide,
    label: rideReady ? 'Ride Ready' : 'Ride Needed',
    needsAttention: !rideReady,
    title: rideReady ? 'Open the arranged ride' : 'Open and finish arranging this ride',
  };
};

const getPaychecksMatchingShift = (shift = {}, paychecks = []) => {
  const shiftDate = normalizePaycheckDate(shift.startDate);
  if (!shiftDate) return [];

  return paychecks.filter((paycheck) => {
    const periodRange = getPaycheckPeriodRange(paycheck);
    const scannedWorkDates = getPaycheckWorkDates(paycheck);
    const matchesPayPeriod = Boolean(
      periodRange &&
      shiftDate >= periodRange.startDate &&
      shiftDate <= periodRange.endDate
    );
    const matchesScannedWorkDate = scannedWorkDates.has(shiftDate);

    return scannedWorkDates.size > 0 ? matchesScannedWorkDate : matchesPayPeriod;
  });
};

const getUniquePaychecksMatchingShifts = (shifts = [], paychecks = []) => {
  const matched = new Map();

  shifts.forEach((shift) => {
    getPaychecksMatchingShift(shift, paychecks)
      .filter(isCscPaycheck)
      .forEach((paycheck) => {
        const paycheckIndex = paychecks.indexOf(paycheck);
        matched.set(getPaycheckIdentity(paycheck, paycheckIndex), paycheck);
      });
  });

  return Array.from(matched.values()).sort((a, b) => {
    const aRange = getPaycheckPeriodRange(a);
    const bRange = getPaycheckPeriodRange(b);
    const aDate = aRange?.startDate || normalizePaycheckDate(a.checkDate);
    const bDate = bRange?.startDate || normalizePaycheckDate(b.checkDate);
    return aDate.localeCompare(bDate);
  });
};

const buildShiftCalendarEventPayload = (shift = {}) => {
  const description = [
    `CSC shift status: ${shift.shiftStatus || 'Scheduled'}`,
    `Paid status: ${getShiftPaymentStatusLabel(shift)}`,
    `Hours: ${getShiftHours(shift).toFixed(1)}`,
    `Hourly rate: ${getShiftHourlyRateLabel(shift)}`,
    `Estimated pay: ${formatCurrency(getEstimatedPay(shift))}`,
    shift.jobName ? `Job: ${shift.jobName}` : '',
    shift.shiftName ? `Shift Name: ${shift.shiftName}` : '',
    shift.roleName ? `Role Name: ${shift.roleName}` : '',
    shift.uniform ? `Uniform: ${shift.uniform}` : '',
    shift.parking ? `Parking: ${shift.parking}` : '',
    shift.supervisor ? `Supervisor: ${shift.supervisor}` : '',
    shift.notes ? `Notes: ${shift.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';

  return {
    eventLabelId: CSC_GOOGLE_CALENDAR_LABEL_ID,
    summary: `CSC Shift - ${shift.venue || 'Shift'}${shift.event ? ` - ${shift.event}` : ''}`,
    location: [shift.venue, shift.address, shift.city].filter(Boolean).join(', '),
    description,
    start: {
      dateTime: `${shift.startDate}T${shift.startTime}:00`,
      timeZone: timezone,
    },
    end: {
      dateTime: `${shift.finishDate || shift.startDate}T${shift.finishTime}:00`,
      timeZone: timezone,
    },
  };
};

const ensureCscGoogleCalendarLabel = () =>
  ensureGoogleCalendarEventLabel({
    id: CSC_GOOGLE_CALENDAR_LABEL_ID,
    backgroundColor: CSC_GOOGLE_CALENDAR_BACKGROUND_COLOR,
    name: CSC_GOOGLE_CALENDAR_LABEL_NAME,
  });

const getCscCalendarLocalDateTimeKey = (dateTimeValue = '') => {
  const parsedDate = new Date(String(dateTimeValue || '').trim());

  if (!Number.isFinite(parsedDate.getTime())) return '';

  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(parsedDate);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );

  if (
    !values.year ||
    !values.month ||
    !values.day ||
    values.hour === undefined ||
    values.minute === undefined
  ) {
    return '';
  }

  return `${values.year}-${values.month}-${values.day}|${values.hour}:${values.minute}`;
};

const getCscShiftCalendarStartKey = (shift = {}) =>
  shift.startDate && shift.startTime
    ? `${String(shift.startDate).trim()}|${String(shift.startTime).trim()}`
    : '';

const getCscGoogleCalendarEventStartKey = (event = {}) =>
  getCscCalendarLocalDateTimeKey(event?.start?.dateTime || '');

const isCscManagedGoogleCalendarEvent = (event = {}) => {
  const summary = String(event?.summary || '').trim().toLowerCase();
  const description = String(event?.description || '').trim().toLowerCase();

  return (
    summary.startsWith('csc shift -') ||
    description.includes('csc shift status:')
  );
};

const getCscGoogleCalendarEventVenueIdentity = (event = {}) => {
  const location = String(event?.location || '').trim();
  const locationVenue = location.split(',')[0]?.trim();

  if (locationVenue) {
    return normalizeCalendarVenueIdentity(locationVenue);
  }

  const summary = String(event?.summary || '')
    .replace(/^CSC\s+Shift\s*-\s*/i, '')
    .trim();
  const summaryVenue = summary.split(/\s+-\s+/)[0]?.trim();

  return normalizeCalendarVenueIdentity(summaryVenue);
};

const getCscGoogleCalendarEventSearchText = (event = {}) =>
  normalizeShiftIdentityText(
    [
      event?.summary,
      event?.description,
      event?.location,
    ]
      .filter(Boolean)
      .join(' ')
  );

const getCscGoogleCalendarEventMatchScore = (
  shift = {},
  event = {},
  linkedEventId = ''
) => {
  const shiftStartKey = getCscShiftCalendarStartKey(shift);
  const eventStartKey = getCscGoogleCalendarEventStartKey(event);
  const isLinkedEvent = Boolean(
    linkedEventId && String(event?.id || '') === linkedEventId
  );

  // A persisted Google event ID is stronger evidence than the old event time.
  // If CSC changed the shift time, the linked Google event will still contain
  // the previous time until we PATCH it. Do not reject that known event merely
  // because its start time or venue is stale.
  if (!isLinkedEvent && (!shiftStartKey || shiftStartKey !== eventStartKey)) {
    return Number.NEGATIVE_INFINITY;
  }

  const shiftVenue = normalizeCalendarVenueIdentity(shift.venue);
  const eventVenue = getCscGoogleCalendarEventVenueIdentity(event);

  if (!isLinkedEvent && shiftVenue && eventVenue && shiftVenue !== eventVenue) {
    return Number.NEGATIVE_INFINITY;
  }

  const desiredSummary = normalizeShiftIdentityText(
    buildShiftCalendarEventPayload(shift).summary
  );
  const eventSummary = normalizeShiftIdentityText(event?.summary || '');
  const eventText = getCscGoogleCalendarEventSearchText(event);
  let score = isLinkedEvent ? 1100 : 100;

  if (desiredSummary && desiredSummary === eventSummary) {
    score += 200;
  }

  if (shiftVenue && eventVenue && shiftVenue === eventVenue) {
    score += 100;
  }

  [
    [shift.event, 50],
    [shift.jobName, 35],
    [shift.shiftName, 25],
    [shift.roleName, 20],
  ].forEach(([value, weight]) => {
    const normalizedValue = normalizeShiftIdentityText(value);
    if (normalizedValue && eventText.includes(normalizedValue)) {
      score += weight;
    }
  });

  return score;
};

const findBestCscGoogleCalendarEventForShift = (
  shift = {},
  events = [],
  registryEntry = null
) => {
  const linkedEventId = String(
    shift.googleCalendarEventId ||
      registryEntry?.googleCalendarEventId ||
      ''
  ).trim();

  return (
    events
      .filter(isCscManagedGoogleCalendarEvent)
      .map((event) => ({
        event,
        score: getCscGoogleCalendarEventMatchScore(
          shift,
          event,
          linkedEventId
        ),
      }))
      .filter((item) => Number.isFinite(item.score))
      .sort((first, second) => {
        if (second.score !== first.score) return second.score - first.score;

        const firstCreated = String(first.event?.created || '');
        const secondCreated = String(second.event?.created || '');
        return firstCreated.localeCompare(secondCreated);
      })[0]?.event || null
  );
};

const GOOGLE_CALENDAR_WINDOW_NAME = 'budget-dashboard-google-calendar';

const openCscGoogleCalendarEvent = (eventLink = '') => {
  const url = String(eventLink || '').trim();
  if (!url) return null;

  // IMPORTANT: do not pass "noopener" here. Browsers can treat a named target
  // with noopener like a fresh _blank context, which defeats tab reuse.
  // Using a stable window name lets later CSC calendar clicks reuse the same
  // Google Calendar tab that this dashboard previously opened.
  const calendarWindow = window.open(url, GOOGLE_CALENDAR_WINDOW_NAME);

  try {
    if (calendarWindow) calendarWindow.opener = null;
  } catch {
    // Ignore cross-origin restrictions after Google Calendar navigation.
  }

  calendarWindow?.focus?.();
  return calendarWindow;
};

const getCscGoogleCalendarDayBounds = (dateValue = '') => {
  const start = new Date(`${dateValue}T00:00:00`);
  if (!Number.isFinite(start.getTime())) return null;

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
};

const getAiShiftStartTimestamp = (shift = {}) => {
  if (!shift.startDate || !shift.startTime) return Number.NaN;
  return new Date(`${shift.startDate}T${shift.startTime}:00`).getTime();
};

const getAiShiftFinishTimestamp = (shift = {}) => {
  const finishDate = shift.finishDate || shift.startDate;
  if (!finishDate || !shift.finishTime) return Number.NaN;
  return new Date(`${finishDate}T${shift.finishTime}:00`).getTime();
};

const getAiShiftPrimaryTitle = (shift = {}) =>
  cleanCscDisplayTitle(
    shift.event ||
      shift.jobName ||
      shift.shiftName ||
      shift.roleName ||
      'CSC Shift'
  );

const classifyAiShiftEventType = (shift = {}) => {
  const source = [
    shift.event,
    shift.jobName,
    shift.shiftName,
    shift.venue,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (
    /\b(?:nfl|football|rams|chargers|raiders|cardinals|giants|usc|sjsu|bruins|trojans)\b/i.test(
      source
    )
  ) {
    return 'Football';
  }

  if (/\b(?:fifa|world cup|soccer|football club|fc)\b/i.test(source)) {
    return 'Soccer';
  }

  if (/\b(?:nba|basketball|clippers|lakers)\b/i.test(source)) {
    return 'Basketball';
  }

  return 'Concert / Entertainment';
};

const formatAiCountdown = (shift = {}, now = new Date()) => {
  const startTimestamp = getAiShiftStartTimestamp(shift);
  if (!Number.isFinite(startTimestamp)) return 'Start time not available';

  const diffHours = (startTimestamp - now.getTime()) / (1000 * 60 * 60);

  if (diffHours < -1) return 'In progress or already started';
  if (diffHours < 1) return 'Starts within the hour';
  if (diffHours < 24) return `Starts in ${Math.max(1, Math.round(diffHours))} hours`;

  const days = Math.ceil(diffHours / 24);
  return `Starts in ${days} day${days === 1 ? '' : 's'}`;
};

const buildCscAiOverviewText = (
  overview = {},
  monthlyBreakdownOverride = null,
  monthlyLabel = 'Monthly Breakdown'
) => {
  const lines = [];
  const monthlyBreakdown = Array.isArray(monthlyBreakdownOverride)
    ? monthlyBreakdownOverride
    : overview.monthlyBreakdown || [];
  const dateRange = overview.firstShift && overview.lastShift
    ? `${formatDate(overview.firstShift.startDate)} - ${formatDate(overview.lastShift.startDate)}`
    : 'No upcoming shifts';

  lines.push('CSC AI Overview');
  lines.push('');
  lines.push('Schedule Summary');
  lines.push(`Total Shifts: ${overview.totalShifts || 0}`);
  lines.push(`Total Scheduled Hours: ${(overview.totalHours || 0).toFixed(1)} hours`);
  lines.push(`Projected Gross Pay: ${formatCurrency(overview.estimatedPay || 0)}`);
  lines.push(`Date Range: ${dateRange}`);
  lines.push('');

  if (overview.nextShift) {
    lines.push('Next Shift');
    lines.push(
      `${formatDate(overview.nextShift.startDate)} ${formatTime(overview.nextShift.startTime)} - ${formatTime(overview.nextShift.finishTime)} | ${cleanCscVenueDisplay(overview.nextShift.venue)} | ${getAiShiftPrimaryTitle(overview.nextShift)} | ${getShiftHours(overview.nextShift).toFixed(1)} hrs`
    );
    lines.push(overview.nextShiftCountdown || '');
    lines.push('');
  }

  lines.push('This Week');
  lines.push(
    `${overview.thisWeek?.shiftCount || 0} shifts | ${(overview.thisWeek?.hours || 0).toFixed(1)} hours | ${formatCurrency(overview.thisWeek?.estimatedPay || 0)} projected gross`
  );
  lines.push('');

  lines.push('Venue Breakdown');
  (overview.venueBreakdown || []).forEach((venue) => {
    lines.push(
      `${venue.venue}: ${venue.shiftCount} shift${venue.shiftCount === 1 ? '' : 's'} | ${venue.hours.toFixed(1)} hours | ${formatCurrency(venue.estimatedPay)}`
    );
  });
  if (!(overview.venueBreakdown || []).length) lines.push('No upcoming venue data.');
  lines.push('');

  lines.push(monthlyLabel);
  monthlyBreakdown.forEach((month) => {
    lines.push(month.label);
    month.shifts.forEach((shift) => {
      lines.push(
        `${formatDate(shift.startDate)}: ${formatTime(shift.startTime)} - ${formatTime(shift.finishTime)} | ${cleanCscVenueDisplay(shift.venue)} | ${getAiShiftPrimaryTitle(shift)} (${getShiftHours(shift).toFixed(1)} hrs)`
      );
    });
    lines.push('');
  });
  if (!monthlyBreakdown.length) {
    lines.push('No CSC shift records in this month view.');
    lines.push('');
  }

  lines.push('Workload Alerts');
  if ((overview.workloadAlerts || []).length) {
    overview.workloadAlerts.forEach((alert) => lines.push(`${alert.title}: ${alert.detail}`));
  } else {
    lines.push('No heavy workload or short-turnaround alerts detected.');
  }
  lines.push('');

  lines.push('Operational Readiness');
  lines.push(
    `Calendar: ${overview.calendarReadyCount || 0} of ${overview.totalShifts || 0} upcoming shifts linked`
  );
  lines.push(
    `Missing Calendar Events: ${(overview.calendarMissing || []).length}`
  );
  lines.push(
    `Shifts Missing Key Details: ${(overview.missingInformation || []).length}`
  );
  lines.push(
    `Ride Plans Needing Attention: ${(overview.rideNeedsAttention || []).length}`
  );
  lines.push('');

  lines.push('Workload Highlights');
  if (overview.longestShift) {
    lines.push(
      `Longest Shift: ${getAiShiftPrimaryTitle(overview.longestShift)} on ${formatDate(overview.longestShift.startDate)}, ${getShiftHours(overview.longestShift).toFixed(1)} hours`
    );
  }
  if (overview.busiestStretch) {
    lines.push(
      `Busiest 7-Day Stretch: ${formatDate(overview.busiestStretch.startDate)} - ${formatDate(overview.busiestStretch.endDate)}, ${overview.busiestStretch.hours.toFixed(1)} hours across ${overview.busiestStretch.shiftCount} shifts`
    );
  }
  if (overview.busiestMonth) {
    lines.push(
      `Busiest Month: ${overview.busiestMonth.label}, ${overview.busiestMonth.hours.toFixed(1)} hours`
    );
  }
  if (overview.mostUsedVenue) {
    lines.push(
      `Most-Used Venue: ${overview.mostUsedVenue.venue}, ${overview.mostUsedVenue.shiftCount} shifts`
    );
  }
  lines.push('');

  lines.push('Event Mix');
  (overview.eventTypeBreakdown || []).forEach((item) => {
    lines.push(`${item.label}: ${item.shiftCount} shifts | ${item.hours.toFixed(1)} hours`);
  });
  if (!(overview.eventTypeBreakdown || []).length) lines.push('No upcoming event mix available.');
  lines.push('');

  lines.push('Paycheck Outlook');
  lines.push(
    `${overview.unpaidCompleted?.count || 0} completed unpaid shift${overview.unpaidCompleted?.count === 1 ? '' : 's'} | ${(overview.unpaidCompleted?.hours || 0).toFixed(1)} hours | ${formatCurrency(overview.unpaidCompleted?.amount || 0)} estimated gross still outstanding`
  );

  if ((overview.recentChanges || []).length) {
    lines.push('');
    lines.push('Changes Since Latest Safety Snapshot');
    overview.recentChanges.forEach((change) => lines.push(`${change.title}: ${change.detail}`));
  }

  return lines.join('\n');
};

const CscShiftsTab = ({ searchQuery = '' }) => {
  const [shifts, setShifts] = useState(() => loadSavedShifts());
  const [localSearch, setLocalSearch] = useState('');
  const [excludedVenues, setExcludedVenues] = useState([]);
  const [showVenueFilter, setShowVenueFilter] = useState(false);
  const [monthFilter, setMonthFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paidFilter, setPaidFilter] = useState('All');
  const [showMonthOverview, setShowMonthOverview] = useState(false);
  const [monthRangeMode, setMonthRangeMode] = useState('focus');
  const [saveMessage, setSaveMessage] = useState('');
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showScanDrawer, setShowScanDrawer] = useState(false);
  const [showArchiveDrawer, setShowArchiveDrawer] = useState(false);
  const [showDataScreen, setShowDataScreen] = useState(false);
  const [isCompleteBackupDragActive, setIsCompleteBackupDragActive] = useState(false);
  const [calendarAuditRunning, setCalendarAuditRunning] = useState(false);
  const [calendarAuditReport, setCalendarAuditReport] = useState(null);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveStatusFilter, setArchiveStatusFilter] = useState('All');
  const [shiftEmailText, setShiftEmailText] = useState('');
  const [scannedShifts, setScannedShifts] = useState([]);
  const scannedShift = scannedShifts[0] || null;
  const setScannedShift = (nextShift) => setScannedShifts(nextShift ? [nextShift] : []);
  const [archivedShifts, setArchivedShifts] = useState(() => loadArchivedShifts());
  const [premiumView] = useState(false);
  const [showPremiumOverlay, setShowPremiumOverlay] = useState(false);
  const [showUpcomingScheduleOverlay, setShowUpcomingScheduleOverlay] = useState(false);
  const [showAiOverview, setShowAiOverview] = useState(false);
  const [aiOverviewGeneratedAt, setAiOverviewGeneratedAt] = useState(() => Date.now());
  const [aiReadinessFocus, setAiReadinessFocus] = useState('');
  const [aiMonthView, setAiMonthView] = useState('upcoming');
  const [aiSelectedMonthKey, setAiSelectedMonthKey] = useState('');
  const [newShift, setNewShift] = useState(() => createBlankShift());
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [editingShiftLocation, setEditingShiftLocation] = useState('active');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [visibleShiftLimit, setVisibleShiftLimit] = useState(DEFAULT_VISIBLE_SHIFT_COUNT);
  const [isShiftTableCollapsed, setIsShiftTableCollapsed] = useState(false);
  const [selectedDetailShiftId, setSelectedDetailShiftId] = useState(null);
  const [detailReturnContext, setDetailReturnContext] = useState(null);
  const [movingShiftId, setMovingShiftId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [calendarAddingShiftId, setCalendarAddingShiftId] = useState('');
  const [calendarVerificationByShiftId, setCalendarVerificationByShiftId] = useState({});
  const [paychecks, setPaychecks] = useState(() => readStoredPaychecks());
  const [selectedPaidMonthKey, setSelectedPaidMonthKey] = useState('');
  const [selectedWeekKey, setSelectedWeekKey] = useState('');
  const toolbarImportInputRef = useRef(null);
  const completeBackupImportInputRef = useRef(null);
  const completeBackupDragDepthRef = useRef(0);
  const venueFilterRef = useRef(null);
  const shiftBrowserRef = useRef(null);
  const calendarAddLockRef = useRef(new Set());
  const calendarCleanupLockRef = useRef(false);
  const calendarVerificationSignatureRef = useRef('');
  const completedShiftMigrationRef = useRef(false);

  useEffect(() => {
    const hasOpenLayer =
      Boolean(deleteConfirm) ||
      showAiOverview ||
      showUpcomingScheduleOverlay ||
      showPremiumOverlay ||
      Boolean(selectedWeekKey) ||
      Boolean(selectedPaidMonthKey) ||
      Boolean(selectedDetailShiftId) ||
      showArchiveDrawer ||
      showScanDrawer ||
      showAddDrawer ||
      Boolean(calendarAuditReport) ||
      showDataScreen;
    if (!hasOpenLayer) return undefined;

    const closeTopLayer = (event) => {
      if (event.key !== 'Escape') return;
      if (deleteConfirm) setDeleteConfirm(null);
      else if (selectedDetailShiftId) {
        const returnContext = detailReturnContext || readCscShiftReturnContext();
        setSelectedDetailShiftId(null);
        setDetailReturnContext(null);
        clearCscShiftReturnContext();
        if (returnContext?.returnTab) {
          navigateToAppTab(returnContext.returnTab, returnContext.returnRecordId || '', {
            recordId: returnContext.returnRecordId || '',
          });
        }
      }
      else if (showAddDrawer) {
        setShowAddDrawer(false);
        setEditingShiftId(null);
        setEditingShiftLocation('active');
        setNewShift(createBlankShift());
      }
      else if (showAiOverview) setShowAiOverview(false);
      else if (showUpcomingScheduleOverlay) setShowUpcomingScheduleOverlay(false);
      else if (showPremiumOverlay) setShowPremiumOverlay(false);
      else if (selectedWeekKey) setSelectedWeekKey('');
      else if (selectedPaidMonthKey) setSelectedPaidMonthKey('');
      else if (showArchiveDrawer) setShowArchiveDrawer(false);
      else if (showScanDrawer) setShowScanDrawer(false);
      else if (calendarAuditReport) setCalendarAuditReport(null);
      else if (showDataScreen) setShowDataScreen(false);
    };

    document.addEventListener('keydown', closeTopLayer);
    return () => document.removeEventListener('keydown', closeTopLayer);
  }, [
    deleteConfirm,
    detailReturnContext,
    selectedDetailShiftId,
    selectedPaidMonthKey,
    selectedWeekKey,
    showAddDrawer,
    showArchiveDrawer,
    showDataScreen,
    calendarAuditReport,
    showPremiumOverlay,
    showScanDrawer,
    showUpcomingScheduleOverlay,
    showAiOverview,
  ]);

  const matchesArchivedShift = (candidateShift, archiveRecords = archivedShifts) => {
    if (!candidateShift?.id) return false;

    return archiveRecords.some((archivedShift) => {
      if (archivedShift.id === candidateShift.id) return true;
      if (areLikelyDuplicateShifts(archivedShift, candidateShift)) return true;

      return (
        shiftWindowsMatch(archivedShift, candidateShift) &&
        getScannedShiftMatchScore(archivedShift, candidateShift) >= 4
      );
    });
  };

  useEffect(() => {
    if (completedShiftMigrationRef.current) return;
    completedShiftMigrationRef.current = true;

    const completedShifts = shifts.filter(
      (shift) => normalizeShiftStatus(shift.shiftStatus) === 'Done'
    );
    if (!completedShifts.length) return;

    writeCscSafetySnapshot(
      'Before moving existing completed CSC shifts to archive',
      shifts,
      archivedShifts
    );

    const archivedAt = new Date().toISOString();
    const completedShiftIds = new Set(completedShifts.map((shift) => shift.id));

    setArchivedShifts((currentArchived) => {
      const archivedById = new Map(currentArchived.map((shift) => [shift.id, shift]));

      completedShifts.forEach((shift) => {
        if (archivedById.has(shift.id)) return;
        archivedById.set(
          shift.id,
          normalizeShift({
            ...shift,
            shiftStatus: 'Done',
            archivedAt: shift.archivedAt || archivedAt,
          })
        );
      });

      return Array.from(archivedById.values()).sort((a, b) =>
        String(b.archivedAt || '').localeCompare(String(a.archivedAt || ''))
      );
    });

    completedShifts.forEach((shift) => {
      if (seedShifts.some((seedShift) => seedShift.id === shift.id)) {
        saveDeletedSeedShiftId(shift.id);
      }
    });
    setShifts((currentShifts) =>
      currentShifts.filter((shift) => !completedShiftIds.has(shift.id))
    );

    setSaveMessage(
      `${completedShifts.length} completed CSC shift${completedShifts.length === 1 ? '' : 's'} moved to Archived Shifts.`
    );
    window.setTimeout(() => setSaveMessage(''), 3500);
  }, []);

  useEffect(() => {
    let rawDraft = '';

    try {
      rawDraft =
        sessionStorage.getItem(CSC_CREATE_DRAFT_STORAGE_KEY) ||
        localStorage.getItem(CSC_CREATE_DRAFT_STORAGE_KEY) ||
        '';
      sessionStorage.removeItem(CSC_CREATE_DRAFT_STORAGE_KEY);
      localStorage.removeItem(CSC_CREATE_DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to read CSC shift draft from opportunity:', error);
    }

    if (!rawDraft) return;

    try {
      const parsedDraft = JSON.parse(rawDraft);
      const blankShift = createBlankShift();
      setNewShift(
        normalizeShift({
          ...blankShift,
          ...parsedDraft,
          id: parsedDraft.id || blankShift.id,
          finishDate: parsedDraft.finishDate || parsedDraft.startDate || '',
        })
      );
      setEditingShiftId(null);
      setShowAddDrawer(true);
      setSaveMessage('CSC shift draft opened from CSC Opportunities.');
      window.setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Failed to open CSC shift draft from opportunity:', error);
      setSaveMessage('The CSC opportunity shift draft could not be opened.');
      window.setTimeout(() => setSaveMessage(''), 3000);
    }
  }, []);

  useEffect(() => {
    const openLinkedShift = (event) => {
      let shiftId = String(event?.detail?.shiftId || '').trim();

      if (!shiftId) {
        try {
          shiftId =
            sessionStorage.getItem(CSC_OPEN_SHIFT_STORAGE_KEY) ||
            localStorage.getItem(CSC_OPEN_SHIFT_STORAGE_KEY) ||
            '';
          sessionStorage.removeItem(CSC_OPEN_SHIFT_STORAGE_KEY);
          localStorage.removeItem(CSC_OPEN_SHIFT_STORAGE_KEY);
        } catch (error) {
          console.error('Failed to read linked CSC shift request:', error);
        }
      }

      if (!shiftId) return;

      const eventReturnContext = normalizeCscShiftReturnContext(event?.detail || null);
      const returnContext = eventReturnContext || readCscShiftReturnContext();
      const linkedShift =
        shifts.find((shift) => shift.id === shiftId) ||
        archivedShifts.find((shift) => shift.id === shiftId);

      if (!linkedShift) {
        setDetailReturnContext(null);
        clearCscShiftReturnContext();
        setSaveMessage('The linked CSC shift could not be found.');
        setTimeout(() => setSaveMessage(''), 3000);
        return;
      }

      setLocalSearch('');
      setExcludedVenues([]);
      setMonthFilter('All');
      setStatusFilter('All');
      setPaidFilter('All');
      setShowActiveOnly(false);
      setIsShiftTableCollapsed(false);
      setDetailReturnContext(returnContext);
      setSelectedDetailShiftId(shiftId);
      setSaveMessage('Linked CSC shift opened.');
      setTimeout(() => setSaveMessage(''), 2500);
    };

    openLinkedShift();
    window.addEventListener('csc-shifts:open-linked-shift', openLinkedShift);

    return () => {
      window.removeEventListener('csc-shifts:open-linked-shift', openLinkedShift);
    };
  }, [archivedShifts, shifts]);

  useEffect(() => {
    const archiveProtectedShifts = shifts.filter(
      (shift) => !matchesArchivedShift(shift, archivedShifts)
    );

    if (archiveProtectedShifts.length !== shifts.length) {
      setShifts(archiveProtectedShifts);
      return;
    }

    try {
      localStorage.setItem(CSC_STORAGE_KEY, JSON.stringify(archiveProtectedShifts));
      window.dispatchEvent(
        new CustomEvent(CSC_SHIFT_UPDATE_EVENT, {
          detail: { shifts: archiveProtectedShifts },
        })
      );
    } catch (error) {
      console.error('Failed to save CSC shifts:', error);
    }
  }, [archivedShifts, shifts]);

  useEffect(() => {
    try {
      localStorage.setItem(CSC_ARCHIVE_STORAGE_KEY, JSON.stringify(archivedShifts));
    } catch (error) {
      console.error('Failed to save archived CSC shifts:', error);
    }
  }, [archivedShifts]);

  useEffect(() => {
    syncOpportunityLinksFromShifts(shifts, archivedShifts);
  }, [archivedShifts, shifts]);

  useEffect(() => {
    const refreshPaychecks = () => setPaychecks(readStoredPaychecks());

    window.addEventListener('storage', refreshPaychecks);
    window.addEventListener(PAYCHECK_UPDATE_EVENT, refreshPaychecks);

    return () => {
      window.removeEventListener('storage', refreshPaychecks);
      window.removeEventListener(PAYCHECK_UPDATE_EVENT, refreshPaychecks);
    };
  }, []);

  useEffect(() => {
    const reconciliation = reconcileStoredCscShiftsWithPaychecks(paychecks);
    if (!reconciliation.changed) return;

    setShifts(reconciliation.activeShifts.map(normalizeShift));
    setArchivedShifts(reconciliation.archivedShifts.map(normalizeShift));
  }, [paychecks]);

  const getShiftCalendarVerificationState = (shift = {}) => {
    const remoteState = calendarVerificationByShiftId[shift.id];

    if (remoteState) return remoteState;

    // Calendar linkage is persisted on the shift and in the CSC calendar
    // registry. Treat that persisted linkage as calendared immediately after
    // a refresh. The background Google Calendar verification can still
    // downgrade the record to missing if the remote event no longer exists.
    return isShiftCalendared(shift) ? 'verified' : 'missing';
  };

  const isShiftCalendarVerified = (shift = {}) =>
    getShiftCalendarVerificationState(shift) === 'verified';

  const getShiftCalendarStatusLabel = (shift = {}) => {
    const state = getShiftCalendarVerificationState(shift);

    if (state === 'verified') return 'Added';
    if (state === 'checking') return 'Checking...';
    if (state === 'unverified') return 'Unverified';
    return 'Not added';
  };

  const getShiftCalendarStatusClass = (shift = {}) => {
    const state = getShiftCalendarVerificationState(shift);

    if (state === 'verified') return 'text-green-700';
    if (state === 'checking') return 'text-blue-700';
    if (state === 'unverified') return 'text-amber-700';
    return 'text-red-700';
  };

  useEffect(() => {
    const todayKey = toLocalDateKey(new Date());
    const candidates = shifts
      .filter((shift) => {
        const status = normalizeShiftStatus(shift.shiftStatus);

        return (
          shift?.id &&
          shift.startDate &&
          shift.startTime &&
          shift.finishTime &&
          shift.startDate >= todayKey &&
          !['Done', 'Cancelled'].includes(status)
        );
      })
      .sort((first, second) =>
        `${first.startDate}T${first.startTime}`.localeCompare(
          `${second.startDate}T${second.startTime}`
        )
      );

    if (!candidates.length) {
      calendarVerificationSignatureRef.current = '';
      setCalendarVerificationByShiftId({});
      return undefined;
    }

    const signature = candidates
      .map((shift) =>
        [
          shift.id,
          shift.startDate,
          shift.startTime,
          shift.finishDate || shift.startDate,
          shift.finishTime,
          normalizeCalendarVenueIdentity(shift.venue),
          normalizeShiftIdentityText(shift.event),
          normalizeShiftIdentityText(shift.jobName),
          normalizeShiftIdentityText(shift.shiftName),
          normalizeShiftIdentityText(shift.roleName),
        ].join('|')
      )
      .join('||');

    if (calendarVerificationSignatureRef.current === signature) {
      return undefined;
    }

    calendarVerificationSignatureRef.current = signature;
    let cancelled = false;

    setCalendarVerificationByShiftId((current) => {
      const next = { ...current };

      candidates.forEach((shift) => {
        // Preserve persisted calendar linkage across refresh. A shift that
        // already has an event id/link/registry entry should continue to show
        // as calendared while the background verification runs.
        next[shift.id] = isShiftCalendared(shift) ? 'verified' : 'checking';
      });

      return next;
    });

    const verifyUpcomingCscCalendarEvents = async () => {
      try {
        const rangeStart = new Date(`${todayKey}T00:00:00`);
        const lastCandidate = candidates[candidates.length - 1];
        const rangeEnd = new Date(
          `${lastCandidate.finishDate || lastCandidate.startDate}T23:59:59`
        );
        rangeEnd.setDate(rangeEnd.getDate() + 1);

        const remoteEvents = await listGoogleCalendarEvents({
          timeMin: rangeStart.toISOString(),
          timeMax: rangeEnd.toISOString(),
          query: 'CSC Shift',
          interactive: false,
        });
        const cscRemoteEvents = remoteEvents.filter(
          isCscManagedGoogleCalendarEvent
        );
        const calendarRegistry = readCalendarRegistry();
        const claimedEventIds = new Set();
        const matchedFieldsByShiftId = new Map();

        candidates.forEach((shift) => {
          const registryEntry = findCalendarRegistryEntry(
            shift,
            calendarRegistry
          );
          const availableEvents = cscRemoteEvents.filter(
            (event) => event?.id && !claimedEventIds.has(event.id)
          );
          const matchedEvent = findBestCscGoogleCalendarEventForShift(
            shift,
            availableEvents,
            registryEntry
          );

          if (!matchedEvent?.id) return;

          claimedEventIds.add(matchedEvent.id);
          matchedFieldsByShiftId.set(shift.id, {
            googleCalendarEventId: matchedEvent.id || '',
            googleCalendarEventLink: matchedEvent.htmlLink || '',
            googleCalendarAddedAt:
              shift.googleCalendarAddedAt ||
              registryEntry?.googleCalendarAddedAt ||
              matchedEvent.created ||
              new Date().toISOString(),
          });
        });

        if (cancelled) return;

        const candidateIds = new Set(candidates.map((shift) => shift.id));
        const candidateIdentityKeys = new Set(
          candidates.flatMap((shift) => getShiftCalendarIdentityKeys(shift))
        );

        const cleanedRegistry = readCalendarRegistry().filter((entry) => {
          if (candidateIds.has(entry.shiftId)) return false;

          return !(entry.identityKeys || []).some((identityKey) =>
            candidateIdentityKeys.has(identityKey)
          );
        });
        writeCalendarRegistry(cleanedRegistry);

        candidates.forEach((shift) => {
          const fields = matchedFieldsByShiftId.get(shift.id);

          if (fields) {
            saveCalendarRegistryEntry(
              normalizeShift({ ...shift, ...fields }),
              fields
            );
          }
        });

        setShifts((currentShifts) =>
          currentShifts.map((shift) => {
            if (!candidateIds.has(shift.id)) return shift;

            const fields = matchedFieldsByShiftId.get(shift.id);

            if (fields) {
              return normalizeShift({ ...shift, ...fields });
            }

            // Do not erase persisted calendar linkage merely because the broad
            // Calendar list scan did not rediscover the event. That was causing
            // a refresh to turn a previously calendared CSC shift back into the
            // "not calendared" state.
            return shift;
          })
        );

        setCalendarVerificationByShiftId((current) => {
          const next = { ...current };

          candidates.forEach((shift) => {
            if (matchedFieldsByShiftId.has(shift.id)) {
              next[shift.id] = 'verified';
              return;
            }

            // Persisted CSC calendar linkage remains authoritative for the icon
            // after refresh. Only shifts with no stored linkage are "missing".
            next[shift.id] = isShiftCalendared(shift)
              ? 'verified'
              : 'missing';
          });

          return next;
        });
        setAiOverviewGeneratedAt(Date.now());
      } catch (error) {
        if (cancelled) return;

        console.error('Failed to verify CSC shifts against Google Calendar:', error);
        setCalendarVerificationByShiftId((current) => {
          const next = { ...current };

          candidates.forEach((shift) => {
            // A temporary Google API/authentication problem must not erase the
            // app's persisted knowledge that this shift is already calendared.
            next[shift.id] = isShiftCalendared(shift)
              ? 'verified'
              : 'unverified';
          });

          return next;
        });
      }
    };

    verifyUpcomingCscCalendarEvents();

    return () => {
      cancelled = true;
    };
  }, [shifts]);

  const handleAddShiftToCalendar = async (shift) => {
    if (!shift?.id || calendarAddLockRef.current.size) return;

    if (!shift.startDate || !shift.startTime || !shift.finishTime) {
      window.alert(
        'Start date, start time, and finish time are required before adding this shift to Google Calendar.'
      );
      return;
    }

    const registryEntry = findCalendarRegistryEntry(shift);
    const linkedEventId = String(
      shift.googleCalendarEventId || registryEntry?.googleCalendarEventId || ''
    ).trim();

    try {
      calendarAddLockRef.current.add(shift.id);
      setCalendarAddingShiftId(shift.id);
      setCalendarVerificationByShiftId((current) => ({
        ...current,
        [shift.id]: 'checking',
      }));

      // If this shift already has a Google Calendar event ID, update that exact
      // event first. This is the safe path when CSC changes a shift time because
      // the existing Google event still contains the old time and cannot be
      // rediscovered by searching only the new time window.
      if (linkedEventId) {
        try {
          await ensureCscGoogleCalendarLabel();
          const updatedEvent = await updateGoogleCalendarEvent(
            linkedEventId,
            buildShiftCalendarEventPayload(shift)
          );
          const verifiedFields = {
            googleCalendarEventId: updatedEvent?.id || linkedEventId,
            googleCalendarEventLink:
              updatedEvent?.htmlLink ||
              shift.googleCalendarEventLink ||
              registryEntry?.googleCalendarEventLink ||
              '',
            googleCalendarAddedAt:
              shift.googleCalendarAddedAt ||
              registryEntry?.googleCalendarAddedAt ||
              updatedEvent?.created ||
              new Date().toISOString(),
          };

          saveCalendarRegistryEntry(shift, verifiedFields);
          updateShift(shift.id, verifiedFields);
          setCalendarVerificationByShiftId((current) => ({
            ...current,
            [shift.id]: 'verified',
          }));
          setSaveMessage('CSC shift updated and verified in Google Calendar.');
          window.setTimeout(() => setSaveMessage(''), 3500);

          if (verifiedFields.googleCalendarEventLink) {
            openCscGoogleCalendarEvent(
              verifiedFields.googleCalendarEventLink
            );
          }

          return;
        } catch (error) {
          const eventMissing = error?.status === 404 || error?.status === 410;

          if (!eventMissing) throw error;

          // The stored event ID points to an event that no longer exists.
          // Clear only that stale linkage, then safely search/create below.
          removeCalendarRegistryEntriesForShift(shift);
          updateShift(shift.id, {
            googleCalendarEventId: '',
            googleCalendarEventLink: '',
            googleCalendarAddedAt: '',
          });
        }
      }

      const dayBounds = getCscGoogleCalendarDayBounds(shift.startDate);
      if (!dayBounds) {
        throw new Error(
          'Could not determine the Google Calendar date range for this shift.'
        );
      }

      const remoteEvents = await listGoogleCalendarEvents({
        ...dayBounds,
        query: 'CSC Shift',
      });
      const remoteMatch = findBestCscGoogleCalendarEventForShift(
        shift,
        remoteEvents,
        registryEntry
      );

      if (remoteMatch) {
        const verifiedFields = {
          googleCalendarEventId: remoteMatch.id || '',
          googleCalendarEventLink: remoteMatch.htmlLink || '',
          googleCalendarAddedAt:
            shift.googleCalendarAddedAt ||
            registryEntry?.googleCalendarAddedAt ||
            remoteMatch.created ||
            new Date().toISOString(),
        };

        saveCalendarRegistryEntry(shift, verifiedFields);
        updateShift(shift.id, verifiedFields);
        setCalendarVerificationByShiftId((current) => ({
          ...current,
          [shift.id]: 'verified',
        }));
        setSaveMessage(
          'CSC shift verified in Google Calendar. No duplicate was created.'
        );
        window.setTimeout(() => setSaveMessage(''), 3500);

        if (verifiedFields.googleCalendarEventLink) {
          openCscGoogleCalendarEvent(
            verifiedFields.googleCalendarEventLink
          );
        }

        return;
      }

      removeCalendarRegistryEntriesForShift(shift);
      updateShift(shift.id, {
        googleCalendarEventId: '',
        googleCalendarEventLink: '',
        googleCalendarAddedAt: '',
      });
      setCalendarVerificationByShiftId((current) => ({
        ...current,
        [shift.id]: 'missing',
      }));

      await ensureCscGoogleCalendarLabel();
      const createdEvent = await createGoogleCalendarEvent(
        buildShiftCalendarEventPayload(shift)
      );
      const calendarFields = {
        googleCalendarEventId: createdEvent?.id || '',
        googleCalendarEventLink: createdEvent?.htmlLink || '',
        googleCalendarAddedAt: new Date().toISOString(),
      };

      saveCalendarRegistryEntry(shift, calendarFields);
      updateShift(shift.id, calendarFields);
      setCalendarVerificationByShiftId((current) => ({
        ...current,
        [shift.id]: 'verified',
      }));
      setSaveMessage('CSC shift added to Google Calendar and verified.');
      window.setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Could not verify or add CSC Google Calendar event:', error);
      setCalendarVerificationByShiftId((current) => ({
        ...current,
        [shift.id]: isShiftCalendared(shift) ? 'verified' : 'unverified',
      }));
      window.alert(
        error?.message ||
          'Could not verify or add this CSC shift in Google Calendar.'
      );
    } finally {
      calendarAddLockRef.current.delete(shift.id);
      setCalendarAddingShiftId('');
    }
  };

  const handlePlanOrOpenRide = (shift) => {
    const linkedRide = getLinkedRideForShift(shift);

    if (linkedRide) {
      navigateToAppTab('rides', linkedRide.id);
      return;
    }

    const rideDraft = {
      id: createRelatedRecordId('ride-csc-shift'),
      rideDate: shift.startDate || '',
      riderName: 'David Hallstrom',
      confirmationNumber: '',
      status: 'Pending',
      provider: '',
      notes: `Transportation plan for ${shift.event || shift.jobName || 'CSC shift'} at ${shift.venue || 'CSC venue'}.`,
      sourceText: '',
      sourceOpportunityId: shift.linkedOpportunityId || shift.createdFromOpportunityId || '',
      linkedCscShiftId: shift.id,
      returnContext: {
        returnTab: 'cscShifts',
        returnRecordId: '',
      },
      legs: [
        {
          id: createRelatedRecordId('ride-leg'),
          leg: 'Trip to Venue',
          confirmationNumber: '',
          pickupTime: '',
          appointmentTime: shift.startTime || '',
          pickupName: 'Pickup',
          pickupAddress: '',
          dropoffName: shift.venue || 'CSC Venue',
          dropoffAddress: shift.address || '',
          status: 'Pending',
          provider: '',
          notes: '',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      sessionStorage.setItem(RIDES_CREATE_DRAFT_STORAGE_KEY, JSON.stringify(rideDraft));
      navigateToAppTab('rides');
    } catch (error) {
      console.error('Failed to create ride plan from CSC shift:', error);
      setSaveMessage('The ride plan could not be opened.');
      setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleOpenPaychecks = () => {
    navigateToAppTab('paychecks');
  };

  const handleOpenLinkedOpportunity = (shift) => {
    const opportunityId = String(
      shift?.linkedOpportunityId || shift?.createdFromOpportunityId || ''
    ).trim();

    if (!opportunityId) {
      setSaveMessage('This CSC shift is not linked to an opportunity.');
      window.setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    try {
      sessionStorage.setItem(CSC_OPPORTUNITY_OPEN_STORAGE_KEY, opportunityId);
      navigateToAppTab('cscOpportunities', opportunityId);
    } catch (error) {
      console.error('Failed to open linked CSC opportunity:', error);
      setSaveMessage('The linked CSC opportunity could not be opened.');
      window.setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleToggleShiftListLength = () => {
    setVisibleShiftLimit((current) =>
      current >= filteredShifts.length ? DEFAULT_VISIBLE_SHIFT_COUNT : Number.MAX_SAFE_INTEGER
    );
    setIsShiftTableCollapsed(false);
  };

  const handleShowMoreShifts = () => {
    setVisibleShiftLimit((current) =>
      Math.min(current + DEFAULT_VISIBLE_SHIFT_COUNT, filteredShifts.length)
    );
    setIsShiftTableCollapsed(false);
  };

  const handleBackToShiftListTop = () => {
    shiftBrowserRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleExpandAllShifts = () => {
    setVisibleShiftLimit(Number.MAX_SAFE_INTEGER);
    setIsShiftTableCollapsed(false);
  };

  const handleExpandAllActiveShifts = () => {
    setShowActiveOnly(true);
    setStatusFilter('All');
    setVisibleShiftLimit(Number.MAX_SAFE_INTEGER);
    setIsShiftTableCollapsed(false);
  };

  const handleToggleShiftTable = () => {
    if (isShiftTableCollapsed) {
      handleExpandAllShifts();
      return;
    }

    setIsShiftTableCollapsed(true);
  };

  const updateShift = (id, updates) => {
    setShifts((currentShifts) =>
      currentShifts.map((shift) => {
        if (shift.id !== id) return shift;

        const nextShift = { ...shift, ...updates };

        if (updates.shiftStatus) {
          nextShift.shiftStatus = normalizeShiftStatus(updates.shiftStatus);
        }

        if (updates.shiftStatus === 'Done' && normalizeShiftStatus(shift.shiftStatus) !== 'Done') {
          nextShift.paidStatus = 'Unpaid';
          nextShift.paymentDate = '';
        }

        if (updates.shiftStatus === 'Scheduled' || updates.shiftStatus === 'Confirmed' || updates.shiftStatus === 'Cancelled') {
          if (nextShift.paidStatus === 'Paid') {
            nextShift.paidStatus = 'Unpaid';
            nextShift.paymentDate = '';
          }
        }

        if (updates.paidStatus === 'Paid') {
          nextShift.shiftStatus = nextShift.shiftStatus === 'Cancelled' ? 'Cancelled' : 'Done';
          nextShift.paymentDate = nextShift.paymentDate || new Date().toISOString().slice(0, 10);
        }

        if (updates.paidStatus === 'Unpaid' && shift.paidStatus === 'Paid') {
          nextShift.paymentDate = '';
        }

        return normalizeShift(nextShift);
      })
    );
  };

  const handleAddShift = async () => {
    let preparedShift = normalizeShift({
      ...newShift,
      id: editingShiftId || newShift.id,
      finishDate: newShift.finishDate || newShift.startDate,
    });

    if (!preparedShift.startDate || !preparedShift.startTime || !preparedShift.finishTime || !preparedShift.venue) {
      setSaveMessage('Save skipped. Start date, start time, finish time, and venue are required.');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    let calendarEditMessage = '';

    if (editingShiftId && editingShiftLocation === 'active') {
      const existingShift = shifts.find((shift) => shift.id === editingShiftId);
      const registryEntry = existingShift
        ? findCalendarRegistryEntry(existingShift)
        : null;
      const linkedEventId = String(
        existingShift?.googleCalendarEventId ||
          registryEntry?.googleCalendarEventId ||
          ''
      ).trim();
      const shouldSyncCalendar = Boolean(
        existingShift &&
          linkedEventId &&
          hasShiftCalendarPayloadChanged(existingShift, preparedShift)
      );

      if (shouldSyncCalendar) {
        try {
          calendarAddLockRef.current.add(editingShiftId);
          setCalendarAddingShiftId(editingShiftId);
          setCalendarVerificationByShiftId((current) => ({
            ...current,
            [editingShiftId]: 'checking',
          }));

          await ensureCscGoogleCalendarLabel();
          const updatedEvent = await updateGoogleCalendarEvent(
            linkedEventId,
            buildShiftCalendarEventPayload(preparedShift)
          );
          const calendarFields = {
            googleCalendarEventId: updatedEvent?.id || linkedEventId,
            googleCalendarEventLink:
              updatedEvent?.htmlLink ||
              existingShift.googleCalendarEventLink ||
              registryEntry?.googleCalendarEventLink ||
              '',
            googleCalendarAddedAt:
              existingShift.googleCalendarAddedAt ||
              registryEntry?.googleCalendarAddedAt ||
              new Date().toISOString(),
          };

          preparedShift = normalizeShift({
            ...preparedShift,
            ...calendarFields,
          });
          saveCalendarRegistryEntry(preparedShift, calendarFields);
          setCalendarVerificationByShiftId((current) => ({
            ...current,
            [editingShiftId]: 'verified',
          }));
          calendarEditMessage = ' Google Calendar updated.';
        } catch (error) {
          console.error('Failed to update Google Calendar after CSC shift edit:', error);
          setCalendarVerificationByShiftId((current) => ({
            ...current,
            [editingShiftId]: isShiftCalendared(existingShift)
              ? 'verified'
              : 'unverified',
          }));
          calendarEditMessage = ` Google Calendar update failed: ${
            error?.message || 'Unknown Google Calendar error'
          }`;
        } finally {
          calendarAddLockRef.current.delete(editingShiftId);
          setCalendarAddingShiftId('');
        }
      }
    }

    if (editingShiftId) {
      writeCscSafetySnapshot('Before CSC shift edit', shifts, archivedShifts);
      if (editingShiftLocation === 'archived') {
        if (preparedShift.shiftStatus === 'Scheduled') {
          const scheduledShift = normalizeShift({ ...preparedShift, archivedAt: '' });

          removeDeletedSeedShiftId(editingShiftId);
          setArchivedShifts((currentArchived) =>
            currentArchived.filter((shift) => shift.id !== editingShiftId)
          );
          setShifts((currentShifts) => {
            const currentById = new Map(currentShifts.map((shift) => [shift.id, shift]));
            currentById.set(editingShiftId, scheduledShift);
            return Array.from(currentById.values()).sort((a, b) =>
              `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`)
            );
          });
          setShowArchiveDrawer(false);
          setSelectedDetailShiftId(null);
          setLocalSearch('');
          setExcludedVenues([]);
          setMonthFilter('All');
          setStatusFilter('All');
          setPaidFilter('All');
          setShowActiveOnly(true);
          setVisibleShiftLimit(Number.MAX_SAFE_INTEGER);
          setIsShiftTableCollapsed(false);
          setSaveMessage(`CSC shift moved to Scheduled Shifts.${calendarEditMessage}`);
        } else {
          setArchivedShifts((currentArchived) =>
            currentArchived
              .map((shift) =>
                shift.id === editingShiftId
                  ? normalizeShift({
                      ...preparedShift,
                      archivedAt: shift.archivedAt || new Date().toISOString(),
                    })
                  : shift
              )
              .sort((a, b) => String(b.archivedAt || '').localeCompare(String(a.archivedAt || '')))
          );
          setSaveMessage(`Past CSC shift updated.${calendarEditMessage}`);
        }
      } else {
        setShifts((currentShifts) =>
          currentShifts
            .map((shift) => (shift.id === editingShiftId ? preparedShift : shift))
            .sort((a, b) => `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`))
        );
        setSaveMessage(`CSC shift updated.${calendarEditMessage}`);
      }
    } else {
      setShifts((currentShifts) =>
        [...currentShifts, preparedShift].sort((a, b) => `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`))
      );
      setSaveMessage('CSC shift added.');
    }

    setNewShift(createBlankShift());
    setEditingShiftId(null);
    setEditingShiftLocation('active');
    setShowAddDrawer(false);
    setTimeout(() => setSaveMessage(''), calendarEditMessage.includes('failed') ? 6000 : 3000);
  };

  const handleOpenAddShift = () => {
    setNewShift(createBlankShift());
    setEditingShiftId(null);
    setEditingShiftLocation('active');
    setShowAddDrawer(true);
  };

  const handleOpenEditShift = (shift, location = 'active') => {
    setNewShift(normalizeShift(shift));
    setEditingShiftId(shift.id);
    setEditingShiftLocation(location);
    setShowAddDrawer(true);
  };

  const handleRecoverSnapshotShift = (shift) => {
    if (!shift?.id) return;

    writeCscSafetySnapshot('Before recovering missing CSC shift', shifts, archivedShifts);

    const recoveredShift = normalizeShift({
      ...shift,
      shiftStatus: 'Done',
      paidStatus: shift.paidStatus || 'Unpaid',
      archivedAt: new Date().toISOString(),
    });

    removeDeletedSeedShiftId(recoveredShift.id);
    setArchivedShifts((currentArchived) => {
      const nextArchived = [
        recoveredShift,
        ...currentArchived.filter((item) => item.id !== recoveredShift.id),
      ];
      return nextArchived.sort((a, b) =>
        String(b.archivedAt || '').localeCompare(String(a.archivedAt || ''))
      );
    });
    setNewShift(recoveredShift);
    setEditingShiftId(recoveredShift.id);
    setEditingShiftLocation('archived');
    setShowArchiveDrawer(false);
    setShowAddDrawer(true);
    setSaveMessage('Missing CSC shift recovered. Correct the hours and save.');
  };

  const handleOpenShiftDetails = (shift) => {
    clearCscShiftReturnContext();
    setDetailReturnContext(null);
    setShowArchiveDrawer(false);
    setSelectedDetailShiftId(shift.id);
  };

  const handleCloseShiftDetails = () => {
    const returnContext = detailReturnContext || readCscShiftReturnContext();

    setSelectedDetailShiftId(null);
    setDetailReturnContext(null);
    clearCscShiftReturnContext();

    if (returnContext?.returnTab) {
      navigateToAppTab(returnContext.returnTab, returnContext.returnRecordId || '', {
        recordId: returnContext.returnRecordId || '',
      });
    }
  };

  const handleMoveShift = (id) => {
    setMovingShiftId((current) => (current === id ? null : id));
  };

  const moveShiftToVenue = (id, nextVenue) => {
    const shift = shifts.find((item) => item.id === id);

    if (!shift || !nextVenue) return;

    const matchingVenueShift = shifts.find((item) => item.venue === nextVenue);

    writeCscSafetySnapshot('Before CSC shift move', shifts, archivedShifts);
    updateShift(id, {
      venue: nextVenue,
      city: matchingVenueShift?.city || shift.city || '',
      address: matchingVenueShift?.address || shift.address || '',
    });
    setMovingShiftId(null);
    setSaveMessage('CSC shift moved.');
    setTimeout(() => setSaveMessage(''), 2500);
  };

  const handleClearShiftNotes = (id) => {
    const shift = shifts.find((item) => item.id === id);
    const label = shift?.jobName || shift?.event || 'this shift';
    const fieldsToClear = shouldOmitParkingForShift(shift)
      ? 'notes and supervisor'
      : 'notes, parking, and supervisor';

    if (!window.confirm(`Clear ${fieldsToClear} for ${label}?`)) return;

    writeCscSafetySnapshot('Before CSC shift clear', shifts, archivedShifts);
    updateShift(id, { notes: '', parking: '', supervisor: '' });
    setSaveMessage('CSC shift notes cleared.');
    setTimeout(() => setSaveMessage(''), 2500);
  };

  const commitShiftArchive = (activeShiftId, archivedShift, successMessage) => {
    if (!activeShiftId || !archivedShift?.id) return false;

    const nextArchived = [
      archivedShift,
      ...archivedShifts.filter((item) => item.id !== archivedShift.id),
    ].sort((a, b) =>
      String(b.archivedAt || '').localeCompare(String(a.archivedAt || ''))
    );
    const nextActive = shifts.filter(
      (item) => item.id !== activeShiftId && !matchesArchivedShift(item, nextArchived)
    );

    let previousActiveRaw = null;
    let previousArchivedRaw = null;
    let previousDeletedSeedRaw = null;

    const restoreStorageValue = (key, value) => {
      if (value === null) {
        localStorage.removeItem(key);
        return;
      }

      localStorage.setItem(key, value);
    };

    try {
      previousActiveRaw = localStorage.getItem(CSC_STORAGE_KEY);
      previousArchivedRaw = localStorage.getItem(CSC_ARCHIVE_STORAGE_KEY);
      previousDeletedSeedRaw = localStorage.getItem(CSC_DELETED_SEED_STORAGE_KEY);

      const deletedSeedIds = getDeletedSeedShiftIds();
      deletedSeedIds.add(activeShiftId);

      localStorage.setItem(CSC_ARCHIVE_STORAGE_KEY, JSON.stringify(nextArchived));
      localStorage.setItem(CSC_STORAGE_KEY, JSON.stringify(nextActive));
      localStorage.setItem(
        CSC_DELETED_SEED_STORAGE_KEY,
        JSON.stringify(Array.from(deletedSeedIds))
      );

      const persistedArchived = JSON.parse(
        localStorage.getItem(CSC_ARCHIVE_STORAGE_KEY) || '[]'
      );
      const persistedActive = JSON.parse(
        localStorage.getItem(CSC_STORAGE_KEY) || '[]'
      );

      const archiveWasPersisted =
        Array.isArray(persistedArchived) &&
        persistedArchived.some((item) => item?.id === archivedShift.id);
      const activeWasRemoved =
        Array.isArray(persistedActive) &&
        !persistedActive.some((item) => item?.id === activeShiftId);

      if (!archiveWasPersisted || !activeWasRemoved) {
        throw new Error('CSC archive persistence verification failed.');
      }

      const refreshedArchived = loadArchivedShifts();
      const refreshedActive = loadSavedShifts();
      const archiveWasReloaded = refreshedArchived.some(
        (item) => item.id === archivedShift.id
      );
      const activeStayedRemoved = !refreshedActive.some(
        (item) => item.id === activeShiftId
      );

      if (!archiveWasReloaded || !activeStayedRemoved) {
        throw new Error('CSC archive reload verification failed.');
      }

      setArchivedShifts(refreshedArchived);
      setShifts(refreshedActive);

      if (selectedDetailShiftId === activeShiftId) {
        setSelectedDetailShiftId(null);
      }

      // Never leave a newly archived shift hidden behind an old archive filter.
      setArchiveSearch('');
      setArchiveStatusFilter('All');

      setSaveMessage(successMessage);
      window.setTimeout(() => setSaveMessage(''), 3000);
      return true;
    } catch (error) {
      console.error('Failed to move CSC shift to archive:', error);

      try {
        restoreStorageValue(CSC_STORAGE_KEY, previousActiveRaw);
        restoreStorageValue(CSC_ARCHIVE_STORAGE_KEY, previousArchivedRaw);
        restoreStorageValue(CSC_DELETED_SEED_STORAGE_KEY, previousDeletedSeedRaw);

        setShifts(loadSavedShifts());
        setArchivedShifts(loadArchivedShifts());
      } catch (rollbackError) {
        console.error('Failed to roll back CSC archive transaction:', rollbackError);
      }

      setSaveMessage('CSC shift was not archived. The previous shift data was restored.');
      window.setTimeout(() => setSaveMessage(''), 4000);
      return false;
    }
  };

  const completeAndArchiveShift = (shift) => {
    if (!shift?.id) return;

    writeCscSafetySnapshot('Before CSC shift completed and archived', shifts, archivedShifts);

    const archivedShift = normalizeShift({
      ...shift,
      shiftStatus: 'Done',
      paidStatus: 'Unpaid',
      paymentDate: '',
      archivedAt: new Date().toISOString(),
    });

    commitShiftArchive(
      shift.id,
      archivedShift,
      'CSC shift marked Done and moved to Archived Shifts.'
    );
  };

  const handleShiftStatusChange = (shift, nextStatus) => {
    const normalizedStatus = normalizeShiftStatus(nextStatus);

    if (normalizedStatus === 'Done' && normalizeShiftStatus(shift.shiftStatus) !== 'Done') {
      completeAndArchiveShift(shift);
      return;
    }

    updateShift(shift.id, { shiftStatus: normalizedStatus });
  };

  const handleArchiveShift = (id) => {
    const shift = shifts.find((item) => item.id === id);
    const label = shift?.jobName || shift?.event || 'this shift';

    if (!shift || !window.confirm(`Archive ${label}?`)) return;

    writeCscSafetySnapshot('Before CSC shift archive', shifts, archivedShifts);

    const archivedShift = normalizeShift({
      ...shift,
      archivedAt: new Date().toISOString(),
    });

    commitShiftArchive(id, archivedShift, 'CSC shift archived.');
  };

  useEffect(() => {
    try {
      const recoveryState = localStorage.getItem(CSC_SEPT_1_2026_RECOVERY_STORAGE_KEY);

      // "complete" is not trusted as proof that the record still exists.
      // Only an intentional permanent delete sets "dismissed".
      if (recoveryState === 'dismissed') return;

      const matchesSeptember1SofiShift = (candidate = {}) => {
        const normalized = normalizeShift(candidate);
        const venueIdentity = normalizeShiftIdentityText(normalized.venue);

        return (
          normalized.startDate === '2026-09-01' &&
          normalized.startTime === '15:30' &&
          (normalized.finishDate || normalized.startDate) === '2026-09-02' &&
          normalized.finishTime === '00:00' &&
          venueIdentity.includes('sofi')
        );
      };

      const readStoredShiftArray = (key) => {
        try {
          const parsed = JSON.parse(localStorage.getItem(key) || '[]');
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      };

      const storedArchived = readStoredShiftArray(CSC_ARCHIVE_STORAGE_KEY);
      const storedActive = readStoredShiftArray(CSC_STORAGE_KEY);

      const persistedArchivedShift = storedArchived.find(matchesSeptember1SofiShift);

      if (persistedArchivedShift) {
        const refreshedArchived = loadArchivedShifts();

        if (!archivedShifts.some(matchesSeptember1SofiShift)) {
          setArchivedShifts(refreshedArchived);
        }

        localStorage.setItem(CSC_SEPT_1_2026_RECOVERY_STORAGE_KEY, 'complete');
        return;
      }

      const existingActiveShift =
        shifts.find(matchesSeptember1SofiShift) ||
        storedActive.find(matchesSeptember1SofiShift);

      const safetySnapshot = readCscSafetySnapshot();
      const snapshotShift = [
        ...(safetySnapshot?.activeShifts || []),
        ...(safetySnapshot?.archivedShifts || []),
      ].find(matchesSeptember1SofiShift);

      const sourceShift = existingActiveShift || snapshotShift || {};
      const recoveredShift = normalizeShift({
        ...sourceShift,
        id:
          sourceShift.id ||
          'csc-recovered-2026-09-01-sofi-bts-sec-main-day-1-1530',
        startDate: '2026-09-01',
        startTime: '15:30',
        finishDate: '2026-09-02',
        finishTime: '00:00',
        venue: sourceShift.venue || 'SoFi Stadium',
        city: sourceShift.city || 'Inglewood',
        address: sourceShift.address || '3883 W Century Blvd',
        event: sourceShift.event || 'BTS - Sec Main - Day 1',
        jobName: sourceShift.jobName || sourceShift.event || 'BTS - Sec Main - Day 1',
        shiftName: sourceShift.shiftName || 'Tc - Evolv (Entries)',
        roleName: sourceShift.roleName || 'Security Guard',
        shiftStatus: 'Done',
        hourlyRate: sourceShift.hourlyRate || DEFAULT_HOURLY_RATE,
        paidStatus: sourceShift.paidStatus || 'Unpaid',
        paymentDate: sourceShift.paymentDate || '',
        uniform: sourceShift.uniform || 'All black uniform',
        archivedAt: sourceShift.archivedAt || new Date().toISOString(),
      });

      writeCscSafetySnapshot(
        'Before restoring missing 09/01/2026 SoFi CSC shift',
        shifts,
        archivedShifts
      );

      const nextArchived = [
        recoveredShift,
        ...storedArchived.filter(
          (item) =>
            item?.id !== recoveredShift.id &&
            !matchesSeptember1SofiShift(item)
        ),
      ].sort((a, b) =>
        String(b.archivedAt || '').localeCompare(String(a.archivedAt || ''))
      );

      const nextActive = storedActive.filter(
        (item) =>
          item?.id !== recoveredShift.id &&
          item?.id !== existingActiveShift?.id &&
          !matchesSeptember1SofiShift(item)
      );

      const deletedSeedIds = getDeletedSeedShiftIds();
      deletedSeedIds.add(recoveredShift.id);
      if (existingActiveShift?.id) deletedSeedIds.add(existingActiveShift.id);

      localStorage.setItem(CSC_ARCHIVE_STORAGE_KEY, JSON.stringify(nextArchived));
      localStorage.setItem(CSC_STORAGE_KEY, JSON.stringify(nextActive));
      localStorage.setItem(
        CSC_DELETED_SEED_STORAGE_KEY,
        JSON.stringify(Array.from(deletedSeedIds))
      );

      const verifyArchived = readStoredShiftArray(CSC_ARCHIVE_STORAGE_KEY);
      const verifyActive = readStoredShiftArray(CSC_STORAGE_KEY);

      if (!verifyArchived.some(matchesSeptember1SofiShift)) {
        throw new Error('09/01/2026 recovery verification failed: archive record missing.');
      }

      if (verifyActive.some(matchesSeptember1SofiShift)) {
        throw new Error('09/01/2026 recovery verification failed: active duplicate remains.');
      }

      setArchivedShifts(loadArchivedShifts());
      setShifts(loadSavedShifts());
      setArchiveSearch('');
      setArchiveStatusFilter('All');
      localStorage.setItem(CSC_SEPT_1_2026_RECOVERY_STORAGE_KEY, 'complete');

      setSaveMessage(
        'Recovered the missing 09/01/2026 SoFi shift. Open Past Shifts to view it.'
      );
      window.setTimeout(() => setSaveMessage(''), 4000);
    } catch (error) {
      console.error('Failed to recover the missing 09/01/2026 SoFi CSC shift:', error);
      localStorage.removeItem(CSC_SEPT_1_2026_RECOVERY_STORAGE_KEY);
      setSaveMessage('The 09/01/2026 CSC shift recovery did not complete.');
      window.setTimeout(() => setSaveMessage(''), 4000);
    }
  }, []);

  const handleRestoreArchivedShift = (id) => {
    const shift = archivedShifts.find((item) => item.id === id);
    const label = shift?.jobName || shift?.event || 'this shift';

    if (!shift || !window.confirm(`Unarchive ${label} and edit it?`)) return;

    const restoredShift = normalizeShift({ ...shift, archivedAt: '' });

    writeCscSafetySnapshot('Before CSC shift restore', shifts, archivedShifts);

    removeDeletedSeedShiftId(id);
    setShifts((currentShifts) => {
      const currentById = new Map(currentShifts.map((item) => [item.id, item]));
      currentById.set(id, restoredShift);

      return Array.from(currentById.values()).sort((a, b) =>
        `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`)
      );
    });
    setArchivedShifts((currentArchived) => currentArchived.filter((item) => item.id !== id));
    if (selectedDetailShiftId === id) {
      setSelectedDetailShiftId(null);
    }
    setNewShift(restoredShift);
    setEditingShiftId(id);
    setEditingShiftLocation('active');
    setShowArchiveDrawer(false);
    setShowAddDrawer(true);
    setLocalSearch('');
    setExcludedVenues([]);
    setMonthFilter('All');
    setStatusFilter('All');
    setPaidFilter('All');
    setShowActiveOnly(true);
    setVisibleShiftLimit(Number.MAX_SAFE_INTEGER);
    setIsShiftTableCollapsed(false);
    setSaveMessage('CSC shift unarchived. Change the status if needed, then save.');
    setTimeout(() => setSaveMessage(''), 3500);
  };

  const updateArchivedShift = (id, updates) => {
    const existingShift = archivedShifts.find((item) => item.id === id);

    if (!existingShift) return;

    writeCscSafetySnapshot('Before archived CSC paid update', shifts, archivedShifts);

    setArchivedShifts((currentArchived) =>
      currentArchived.map((shift) => {
        if (shift.id !== id) return shift;

        const nextShift = { ...shift, ...updates };

        if (updates.paidStatus === 'Paid') {
          nextShift.paymentDate = nextShift.paymentDate || new Date().toISOString().slice(0, 10);
        }

        if (updates.paidStatus === 'Unpaid') {
          nextShift.paymentDate = '';
        }

        if (updates.paymentDate !== undefined) {
          nextShift.paymentDate = updates.paymentDate;
          nextShift.paidStatus = updates.paymentDate ? 'Paid' : 'Unpaid';
        }

        return normalizeShift(nextShift);
      })
    );

    setSaveMessage('Archived CSC paid status updated.');
    setTimeout(() => setSaveMessage(''), 2500);
  };

  const handleToggleArchivedPaidStatus = (shift) => {
    updateArchivedShift(shift.id, {
      paidStatus: shift.paidStatus === 'Paid' ? 'Unpaid' : 'Paid',
    });
  };

  const handleToggleActivePaidStatus = (shift) => {
    updateShift(shift.id, {
      paidStatus: shift.paidStatus === 'Paid' ? 'Unpaid' : 'Paid',
    });
  };

  const renderActivePaidControls = (shift) => shift.shiftStatus === 'Cancelled' ? null : (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={shift.paidStatus || 'Unpaid'}
          onChange={(event) => updateShift(shift.id, { paidStatus: event.target.value })}
          className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-slate-900 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
          title="Update paid status"
          aria-label="Update paid status"
        >
          {PAID_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={shift.paymentDate || ''}
          onChange={(event) =>
            updateShift(shift.id, {
              paymentDate: event.target.value,
              paidStatus: event.target.value ? 'Paid' : 'Unpaid',
            })
          }
          className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs font-bold text-slate-900 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
          title="Payment date"
          aria-label="Payment date"
        />
        <button
          type="button"
          onClick={() => handleToggleActivePaidStatus(shift)}
          className={`inline-flex h-8 items-center justify-center rounded-md px-2.5 text-xs font-extrabold text-white ${
            shift.paidStatus === 'Paid' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
          }`}
          title={shift.paidStatus === 'Paid' ? 'Mark shift unpaid' : 'Mark shift paid'}
          aria-label={shift.paidStatus === 'Paid' ? 'Mark shift unpaid' : 'Mark shift paid'}
        >
          {shift.paidStatus === 'Paid' ? 'Mark Unpaid' : 'Mark Paid'}
        </button>
      </div>
    </div>
  );

  const renderArchivedPaidControls = (shift, compact = false, recordSource = 'archived') => {
    if (shift.shiftStatus === 'Cancelled') return null;

    const updatePaidRecord = (updates) => {
      if (recordSource === 'archived') {
        updateArchivedShift(shift.id, updates);
        return;
      }

      updateShift(shift.id, updates);
    };

    const togglePaidRecord = () =>
      updatePaidRecord({
        paidStatus: shift.paidStatus === 'Paid' ? 'Unpaid' : 'Paid',
      });

    return (
    <div className={compact ? 'mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3' : 'mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3'}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={shift.paidStatus || 'Unpaid'}
          onChange={(event) => updatePaidRecord({ paidStatus: event.target.value })}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
          title="Update paid status"
          aria-label="Update paid status"
        >
          {PAID_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={shift.paymentDate || ''}
          onChange={(event) =>
            updatePaidRecord({
              paymentDate: event.target.value,
              paidStatus: event.target.value ? 'Paid' : 'Unpaid',
            })
          }
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
          title="Payment date"
          aria-label="Payment date"
        />
        <button
          type="button"
          onClick={togglePaidRecord}
          className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-extrabold text-white ${
            shift.paidStatus === 'Paid' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
          }`}
          title={shift.paidStatus === 'Paid' ? 'Mark shift unpaid' : 'Mark shift paid'}
          aria-label={shift.paidStatus === 'Paid' ? 'Mark shift unpaid' : 'Mark shift paid'}
        >
          {shift.paidStatus === 'Paid' ? 'Mark Unpaid' : 'Mark Paid'}
        </button>
      </div>
      {!compact ? (
        <p className="mt-2 text-xs font-semibold text-slate-800">
          Use this after the paycheck lands. This updates the saved shift and Monthly Pay Summary.
        </p>
      ) : null}
    </div>
    );
  };

  const handleDeleteArchivedShift = (id) => {
    const shift = archivedShifts.find((item) => item.id === id);
    setDeleteConfirm({
      id,
      type: 'archived',
      title: 'Delete archived shift?',
      label: shift?.jobName || shift?.event || shift?.venue || 'this shift',
      message: 'This will permanently delete the archived CSC shift. This cannot be undone unless you restore from a backup.',
    });
  };

  const handleDeleteShift = (id) => {
    const shift = shifts.find((item) => item.id === id);
    setDeleteConfirm({
      id,
      type: 'active',
      title: 'Delete shift?',
      label: shift?.jobName || shift?.event || shift?.venue || 'this shift',
      message: 'This will remove the CSC shift from your active schedule. This cannot be undone unless you restore from a backup.',
    });
  };

  const cancelDeleteShift = () => {
    setDeleteConfirm(null);
  };

  const confirmDeleteShift = () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === 'archived') {
      const archivedShiftToDelete = archivedShifts.find(
        (item) => item.id === deleteConfirm.id
      );
      const deletingRecoveredSeptember1Shift =
        archivedShiftToDelete?.startDate === '2026-09-01' &&
        archivedShiftToDelete?.startTime === '15:30' &&
        (archivedShiftToDelete?.finishDate || archivedShiftToDelete?.startDate) === '2026-09-02' &&
        archivedShiftToDelete?.finishTime === '00:00' &&
        normalizeShiftIdentityText(archivedShiftToDelete?.venue).includes('sofi');

      writeCscSafetySnapshot('Before archived CSC shift delete', shifts, archivedShifts);

      if (deletingRecoveredSeptember1Shift) {
        localStorage.setItem(CSC_SEPT_1_2026_RECOVERY_STORAGE_KEY, 'dismissed');
      }

      setArchivedShifts((currentArchived) =>
        currentArchived.filter((item) => item.id !== deleteConfirm.id)
      );
      if (selectedDetailShiftId === deleteConfirm.id) {
        setSelectedDetailShiftId(null);
      }
      setSaveMessage('Archived CSC shift permanently deleted.');
      setTimeout(() => setSaveMessage(''), 2500);
      setDeleteConfirm(null);
      return;
    }

    writeCscSafetySnapshot('Before CSC shift delete', shifts, archivedShifts);
    if (seedShifts.some((seedShift) => seedShift.id === deleteConfirm.id)) {
      saveDeletedSeedShiftId(deleteConfirm.id);
    }
    setShifts((currentShifts) => currentShifts.filter((item) => item.id !== deleteConfirm.id));
    if (selectedDetailShiftId === deleteConfirm.id) {
      setSelectedDetailShiftId(null);
    }
    setSaveMessage('CSC shift deleted.');
    setTimeout(() => setSaveMessage(''), 2500);
    setDeleteConfirm(null);
  };

  const handleTogglePremiumView = () => {
    setShowPremiumOverlay(true);
    setSaveMessage('CSC shifts list opened.');
    setTimeout(() => setSaveMessage(''), 2500);
  };

  const combinedSearch = [searchQuery, localSearch]
    .filter(Boolean)
    .join(' ')
    .trim()
    .toLowerCase();

  const venueOptions = useMemo(() => {
    const venues = Array.from(
      new Set([
        ...ADDED_VENUE_OPTIONS,
        ...shifts.map((shift) => shift.venue).filter(Boolean),
      ])
    ).sort((firstVenue, secondVenue) => firstVenue.localeCompare(secondVenue));
    return ['All', ...venues];
  }, [shifts]);

  const venueNames = useMemo(
    () => venueOptions.filter((venue) => venue !== 'All'),
    [venueOptions]
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

  const toggleVenue = (venue) => {
    setExcludedVenues((current) =>
      current.includes(venue)
        ? current.filter((item) => item !== venue)
        : [...current, venue]
    );
  };

  const handleStatusFilterChange = (nextStatus) => {
    setStatusFilter(nextStatus);
    setShowActiveOnly(nextStatus === 'All');
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
    const openAddShift = () => {
      setNewShift(createBlankShift());
      setEditingShiftId(null);
      setEditingShiftLocation('active');
      setShowAddDrawer(true);
    };

    const openArchiveDrawer = () => {
      setArchiveSearch('');
      setArchiveStatusFilter('All');
      setShowArchiveDrawer(true);
    };
    const openImport = () => toolbarImportInputRef.current?.click();
    const saveSnapshot = () => handleManualSafetySnapshot();
    const exportShifts = () => handleExportCsv();
    const openData = () => setShowDataScreen(true);
    const openUpcomingSchedules = () => setShowUpcomingScheduleOverlay(true);

    window.addEventListener('csc-toolbar:add', openAddShift);
    window.addEventListener('csc-toolbar:archive', openArchiveDrawer);
    window.addEventListener('csc-toolbar:snapshot', saveSnapshot);
    window.addEventListener('csc-toolbar:save', saveSnapshot);
    window.addEventListener('csc-toolbar:export', exportShifts);
    window.addEventListener('csc-toolbar:import', openImport);
    window.addEventListener('csc-toolbar:data', openData);
    window.addEventListener('csc-toolbar:upcoming-schedules', openUpcomingSchedules);

    return () => {
      window.removeEventListener('csc-toolbar:add', openAddShift);
      window.removeEventListener('csc-toolbar:archive', openArchiveDrawer);
      window.removeEventListener('csc-toolbar:snapshot', saveSnapshot);
      window.removeEventListener('csc-toolbar:save', saveSnapshot);
      window.removeEventListener('csc-toolbar:export', exportShifts);
      window.removeEventListener('csc-toolbar:import', openImport);
      window.removeEventListener('csc-toolbar:data', openData);
      window.removeEventListener('csc-toolbar:upcoming-schedules', openUpcomingSchedules);
    };
  }, [shifts, archivedShifts]);

  const shiftsMatchingNonMonthFilters = useMemo(() => {
    return shifts.filter((shift) => {
      const isActiveShift = !['Done', 'Cancelled'].includes(shift.shiftStatus);
      const activeMatches = !showActiveOnly || isActiveShift;
      const venueMatches = !excludedVenueSet.has(shift.venue);
      const statusMatches = statusFilter === 'All' || shift.shiftStatus === statusFilter;
      const paidMatches = paidFilter === 'All' || shift.paidStatus === paidFilter;
      if (!activeMatches || !venueMatches || !statusMatches || !paidMatches) return false;

      if (!combinedSearch) return true;

      const text = [
        shift.startDate,
        shift.startTime,
        shift.finishDate,
        shift.finishTime,
        shift.venue,
        shift.city,
        shift.address,
        shift.event,
        shift.jobName,
        shift.shiftName,
        shift.roleName,
        shift.shiftStatus,
        shift.paidStatus,
        shift.paymentDate,
        shift.notes,
        shift.parking,
        shift.uniform,
        shift.supervisor,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(combinedSearch);
    });
  }, [combinedSearch, excludedVenueSet, paidFilter, shifts, showActiveOnly, statusFilter]);

  const monthOptions = useMemo(() => {
    const counts = new Map();

    shiftsMatchingNonMonthFilters.forEach((shift) => {
      const monthKey = getMonthKey(shift.startDate);
      if (monthKey === 'No date') return;
      counts.set(monthKey, (counts.get(monthKey) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([monthKey, count]) => ({
        monthKey,
        count,
        label: getMonthLabel(monthKey),
      }))
      .sort((first, second) => first.monthKey.localeCompare(second.monthKey));
  }, [shiftsMatchingNonMonthFilters]);

  const monthlyShiftGroups = useMemo(() => {
    const groups = new Map();

    shiftsMatchingNonMonthFilters.forEach((shift) => {
      const monthKey = getMonthKey(shift.startDate);
      if (monthKey === 'No date') return;

      const current = groups.get(monthKey) || {
        monthKey,
        label: getMonthLabel(monthKey),
        shifts: [],
        venueCounts: new Map(),
      };
      const venue = shift.venue || 'Venue not entered';

      current.shifts.push(shift);
      current.venueCounts.set(venue, (current.venueCounts.get(venue) || 0) + 1);
      groups.set(monthKey, current);
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        venueCounts: Array.from(group.venueCounts.entries()).sort((first, second) =>
          first[0].localeCompare(second[0])
        ),
      }))
      .sort((first, second) => first.monthKey.localeCompare(second.monthKey));
  }, [shiftsMatchingNonMonthFilters]);

  const filteredShifts = useMemo(
    () =>
      shiftsMatchingNonMonthFilters.filter(
        (shift) => monthFilter === 'All' || getMonthKey(shift.startDate) === monthFilter
      ),
    [monthFilter, shiftsMatchingNonMonthFilters]
  );

  const upcomingScheduleShifts = useMemo(() => {
    const todayKey = toLocalDateKey(new Date());

    return shifts
      .filter((shift) => {
        const normalizedStatus = normalizeShiftStatus(shift.shiftStatus);
        const lastScheduleDate = shift.finishDate || shift.startDate;

        return (
          Boolean(shift.startDate) &&
          Boolean(lastScheduleDate) &&
          lastScheduleDate >= todayKey &&
          !['Done', 'Cancelled'].includes(normalizedStatus)
        );
      })
      .sort((first, second) =>
        `${first.startDate}T${first.startTime || '00:00'}`.localeCompare(
          `${second.startDate}T${second.startTime || '00:00'}`
        )
      );
  }, [shifts]);

  const nextActionShift = upcomingScheduleShifts[0] || null;
  const nextActionIsCalendared = nextActionShift
    ? isShiftCalendarVerified(nextActionShift)
    : false;
  const nextActionTravelReadiness = nextActionShift
    ? getShiftTravelReadiness(nextActionShift)
    : null;
  const nextActionMissingItems = nextActionShift
    ? [
        !nextActionShift.finishTime ? 'finish time' : '',
        !nextActionShift.address ? 'venue address' : '',
        !nextActionIsCalendared ? 'calendar event' : '',
        nextActionTravelReadiness?.needsAttention ? 'ride plan' : '',
      ].filter(Boolean)
    : [];

  const aiOverview = useMemo(() => {
    const now = new Date();
    const todayKey = toLocalDateKey(now);
    const upcoming = [...upcomingScheduleShifts].sort((first, second) =>
      `${first.startDate}T${first.startTime || '00:00'}`.localeCompare(
        `${second.startDate}T${second.startTime || '00:00'}`
      )
    );
    const totalHours = upcoming.reduce((sum, shift) => sum + getShiftHours(shift), 0);
    const estimatedPay = upcoming.reduce((sum, shift) => sum + getEstimatedPay(shift), 0);
    const firstShift = upcoming[0] || null;
    const lastShift = upcoming[upcoming.length - 1] || null;
    const nextShift = upcoming.find(
      (shift) => {
        const finishTimestamp = getAiShiftFinishTimestamp(shift);
        const startTimestamp = getAiShiftStartTimestamp(shift);
        const effectiveTimestamp = Number.isFinite(finishTimestamp)
          ? finishTimestamp
          : startTimestamp;
        return Number.isFinite(effectiveTimestamp) && effectiveTimestamp >= now.getTime();
      }
    ) || firstShift;

    const venueMap = new Map();
    upcoming.forEach((shift) => {
      const venue = cleanCscVenueDisplay(shift.venue) || 'Venue not entered';
      const current = venueMap.get(venue) || {
        venue,
        shiftCount: 0,
        hours: 0,
        estimatedPay: 0,
      };

      current.shiftCount += 1;
      current.hours += getShiftHours(shift);
      current.estimatedPay += getEstimatedPay(shift);
      venueMap.set(venue, current);
    });
    const venueBreakdown = Array.from(venueMap.values()).sort(
      (first, second) =>
        second.shiftCount - first.shiftCount ||
        second.hours - first.hours ||
        first.venue.localeCompare(second.venue)
    );

    const monthMap = new Map();
    upcoming.forEach((shift) => {
      const monthKey = getMonthKey(shift.startDate);
      if (monthKey === 'No date') return;
      const current = monthMap.get(monthKey) || {
        monthKey,
        label: getMonthLabel(monthKey),
        shifts: [],
        hours: 0,
        estimatedPay: 0,
      };
      current.shifts.push(shift);
      current.hours += getShiftHours(shift);
      current.estimatedPay += getEstimatedPay(shift);
      monthMap.set(monthKey, current);
    });
    const monthlyBreakdown = Array.from(monthMap.values())
      .map((month) => ({
        ...month,
        shifts: month.shifts.sort((first, second) =>
          `${first.startDate}T${first.startTime || '00:00'}`.localeCompare(
            `${second.startDate}T${second.startTime || '00:00'}`
          )
        ),
      }))
      .sort((first, second) => first.monthKey.localeCompare(second.monthKey));

    const allStoredShiftMap = new Map();
    [...archivedShifts, ...shifts].forEach((shift, index) => {
      const recordKey =
        String(shift?.id || '').trim() ||
        [
          shift?.startDate,
          shift?.startTime,
          shift?.venue,
          shift?.event,
          shift?.jobName,
          index,
        ].join('|');
      allStoredShiftMap.set(recordKey, shift);
    });

    const allMonthMap = new Map();
    Array.from(allStoredShiftMap.values()).forEach((shift) => {
      const monthKey = getMonthKey(shift.startDate);
      if (monthKey === 'No date') return;

      const current = allMonthMap.get(monthKey) || {
        monthKey,
        label: getMonthLabel(monthKey),
        shifts: [],
        hours: 0,
        estimatedPay: 0,
      };

      current.shifts.push(shift);
      current.hours += getShiftHours(shift);
      current.estimatedPay += getEstimatedPay(shift);
      allMonthMap.set(monthKey, current);
    });

    const allMonthlyBreakdown = Array.from(allMonthMap.values())
      .map((month) => ({
        ...month,
        shifts: month.shifts.sort((first, second) =>
          `${first.startDate}T${first.startTime || '00:00'}`.localeCompare(
            `${second.startDate}T${second.startTime || '00:00'}`
          )
        ),
      }))
      .sort((first, second) => first.monthKey.localeCompare(second.monthKey));

    const aiCurrentMonthKey = getMonthKey(todayKey);
    const priorMonthlyBreakdown = allMonthlyBreakdown.filter(
      (month) => month.monthKey < aiCurrentMonthKey
    );

    const currentWeekRange = getWeekRange(todayKey);
    const currentWeekStart = currentWeekRange
      ? toLocalDateKey(currentWeekRange.startDate)
      : todayKey;
    const currentWeekEnd = currentWeekRange
      ? toLocalDateKey(currentWeekRange.endDate)
      : todayKey;
    const thisWeekShifts = upcoming.filter(
      (shift) => shift.startDate >= currentWeekStart && shift.startDate <= currentWeekEnd
    );
    const thisWeek = {
      label: currentWeekRange
        ? formatWeekRange(currentWeekRange.startDate, currentWeekRange.endDate)
        : formatDate(todayKey),
      shiftCount: thisWeekShifts.length,
      hours: thisWeekShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0),
      estimatedPay: thisWeekShifts.reduce((sum, shift) => sum + getEstimatedPay(shift), 0),
      shifts: thisWeekShifts,
    };

    const uniqueWorkDates = Array.from(
      new Set(upcoming.map((shift) => shift.startDate).filter(Boolean))
    ).sort();
    let bestConsecutive = {
      count: 0,
      startDate: '',
      endDate: '',
    };
    let streakStart = '';
    let previousDate = '';

    uniqueWorkDates.forEach((dateValue) => {
      if (!streakStart) {
        streakStart = dateValue;
        previousDate = dateValue;
        if (bestConsecutive.count < 1) {
          bestConsecutive = { count: 1, startDate: dateValue, endDate: dateValue };
        }
        return;
      }

      const previous = parseLocalDate(previousDate);
      const current = parseLocalDate(dateValue);
      const dayDiff =
        previous && current
          ? Math.round((current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24))
          : Number.NaN;

      if (dayDiff === 1) {
        const start = parseLocalDate(streakStart);
        const count =
          start && current
            ? Math.round((current.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
            : 1;
        if (count > bestConsecutive.count) {
          bestConsecutive = { count, startDate: streakStart, endDate: dateValue };
        }
      } else {
        streakStart = dateValue;
        if (bestConsecutive.count < 1) {
          bestConsecutive = { count: 1, startDate: dateValue, endDate: dateValue };
        }
      }

      previousDate = dateValue;
    });

    let busiestStretch = null;
    uniqueWorkDates.forEach((startDate) => {
      const start = parseLocalDate(startDate);
      if (!start) return;
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const endDate = toLocalDateKey(end);
      const stretchShifts = upcoming.filter(
        (shift) => shift.startDate >= startDate && shift.startDate <= endDate
      );
      const hours = stretchShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0);
      const estimatedStretchPay = stretchShifts.reduce(
        (sum, shift) => sum + getEstimatedPay(shift),
        0
      );

      if (
        !busiestStretch ||
        hours > busiestStretch.hours ||
        (hours === busiestStretch.hours && stretchShifts.length > busiestStretch.shiftCount)
      ) {
        busiestStretch = {
          startDate,
          endDate,
          shiftCount: stretchShifts.length,
          hours,
          estimatedPay: estimatedStretchPay,
          shifts: stretchShifts,
        };
      }
    });

    const shortTurnarounds = [];
    const overlaps = [];
    for (let index = 1; index < upcoming.length; index += 1) {
      const previousShift = upcoming[index - 1];
      const currentShift = upcoming[index];
      const previousFinish = getAiShiftFinishTimestamp(previousShift);
      const currentStart = getAiShiftStartTimestamp(currentShift);

      if (!Number.isFinite(previousFinish) || !Number.isFinite(currentStart)) continue;

      const gapHours = (currentStart - previousFinish) / (1000 * 60 * 60);
      if (gapHours < 0) {
        overlaps.push({ previousShift, currentShift, gapHours });
      } else if (gapHours < 10) {
        shortTurnarounds.push({ previousShift, currentShift, gapHours });
      }
    }

    const longShifts = upcoming
      .filter((shift) => getShiftHours(shift) >= 10)
      .sort((first, second) => getShiftHours(second) - getShiftHours(first));
    const twelvePlusShifts = longShifts.filter((shift) => getShiftHours(shift) >= 12);

    const workloadAlerts = [];
    if (busiestStretch?.hours >= 50) {
      workloadAlerts.push({
        severity: busiestStretch.hours >= 60 ? 'high' : 'medium',
        title: 'Heavy 7-Day Stretch',
        detail: `${formatDate(busiestStretch.startDate)} - ${formatDate(busiestStretch.endDate)} has ${busiestStretch.hours.toFixed(1)} scheduled hours across ${busiestStretch.shiftCount} shifts.`,
      });
    }
    if (bestConsecutive.count >= 5) {
      workloadAlerts.push({
        severity: bestConsecutive.count >= 7 ? 'high' : 'medium',
        title: 'Consecutive Workdays',
        detail: `${bestConsecutive.count} consecutive scheduled workdays from ${formatDate(bestConsecutive.startDate)} through ${formatDate(bestConsecutive.endDate)}.`,
      });
    }
    overlaps.slice(0, 3).forEach(({ previousShift, currentShift }) => {
      workloadAlerts.push({
        severity: 'high',
        title: 'Schedule Overlap',
        detail: `${getAiShiftPrimaryTitle(previousShift)} and ${getAiShiftPrimaryTitle(currentShift)} overlap between ${formatDate(previousShift.startDate)} and ${formatDate(currentShift.startDate)}.`,
      });
    });
    shortTurnarounds.slice(0, 3).forEach(({ previousShift, currentShift, gapHours }) => {
      workloadAlerts.push({
        severity: gapHours < 6 ? 'high' : 'medium',
        title: 'Short Turnaround',
        detail: `${gapHours.toFixed(1)} hours between ${getAiShiftPrimaryTitle(previousShift)} ending and ${getAiShiftPrimaryTitle(currentShift)} starting on ${formatDate(currentShift.startDate)}.`,
      });
    });
    if (twelvePlusShifts.length) {
      const shift = twelvePlusShifts[0];
      workloadAlerts.push({
        severity: 'medium',
        title: '12+ Hour Shift',
        detail: `${getAiShiftPrimaryTitle(shift)} on ${formatDate(shift.startDate)} is scheduled for ${getShiftHours(shift).toFixed(1)} hours.`,
      });
    } else if (longShifts.length) {
      const shift = longShifts[0];
      workloadAlerts.push({
        severity: 'low',
        title: 'Long Shift',
        detail: `${getAiShiftPrimaryTitle(shift)} on ${formatDate(shift.startDate)} is scheduled for ${getShiftHours(shift).toFixed(1)} hours.`,
      });
    }

    const calendarMissing = upcoming.filter((shift) => !isShiftCalendarVerified(shift));
    const calendarReadyCount = upcoming.length - calendarMissing.length;
    const rideNeedsAttention = upcoming.filter(
      (shift) => getShiftTravelReadiness(shift).needsAttention
    );
    const missingInformation = upcoming
      .map((shift) => {
        const missing = [
          !shift.finishTime ? 'finish time' : '',
          !shift.address ? 'venue address' : '',
          !shift.shiftName ? 'shift name' : '',
          !shift.roleName ? 'role name' : '',
          !shift.event && !shift.jobName ? 'event/job name' : '',
        ].filter(Boolean);

        return missing.length ? { shift, missing } : null;
      })
      .filter(Boolean);

    const longestShift = upcoming
      .slice()
      .sort((first, second) => getShiftHours(second) - getShiftHours(first))[0] || null;
    const busiestMonth = monthlyBreakdown
      .slice()
      .sort((first, second) => second.hours - first.hours)[0] || null;
    const mostUsedVenue = venueBreakdown[0] || null;

    const eventTypeMap = new Map();
    upcoming.forEach((shift) => {
      const label = classifyAiShiftEventType(shift);
      const current = eventTypeMap.get(label) || {
        label,
        shiftCount: 0,
        hours: 0,
        estimatedPay: 0,
      };
      current.shiftCount += 1;
      current.hours += getShiftHours(shift);
      current.estimatedPay += getEstimatedPay(shift);
      eventTypeMap.set(label, current);
    });
    const eventTypeBreakdown = Array.from(eventTypeMap.values()).sort(
      (first, second) => second.shiftCount - first.shiftCount || second.hours - first.hours
    );

    const completedUnpaidShifts = archivedShifts.filter(
      (shift) =>
        normalizeShiftStatus(shift.shiftStatus) === 'Done' &&
        shift.paidStatus !== 'Paid'
    );
    const unpaidCompleted = {
      count: completedUnpaidShifts.length,
      hours: completedUnpaidShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0),
      amount: completedUnpaidShifts.reduce((sum, shift) => sum + getEstimatedPay(shift), 0),
      shifts: completedUnpaidShifts,
    };

    const safetySnapshot = readCscSafetySnapshot();
    const snapshotActive = new Map(
      (safetySnapshot?.activeShifts || [])
        .filter((shift) => shift?.id)
        .map((shift) => [shift.id, normalizeShift(shift)])
    );
    const recentChanges = [];

    shifts.forEach((shift) => {
      const previousShift = snapshotActive.get(shift.id);
      if (!previousShift) {
        if (shift.startDate >= todayKey && safetySnapshot?.createdAt) {
          recentChanges.push({
            title: 'New Scheduled Shift',
            detail: `${getAiShiftPrimaryTitle(shift)} on ${formatDate(shift.startDate)} at ${cleanCscVenueDisplay(shift.venue)}.`,
          });
        }
        return;
      }

      if (getShiftWindowKey(previousShift) !== getShiftWindowKey(shift)) {
        recentChanges.push({
          title: 'Schedule Time Changed',
          detail: `${getAiShiftPrimaryTitle(shift)} changed from ${formatDate(previousShift.startDate)} ${formatTime(previousShift.startTime)} - ${formatTime(previousShift.finishTime)} to ${formatDate(shift.startDate)} ${formatTime(shift.startTime)} - ${formatTime(shift.finishTime)}.`,
        });
      }
    });

    return {
      generatedAt: aiOverviewGeneratedAt,
      totalShifts: upcoming.length,
      totalHours,
      estimatedPay,
      firstShift,
      lastShift,
      nextShift,
      nextShiftCountdown: nextShift ? formatAiCountdown(nextShift, now) : '',
      thisWeek,
      venueBreakdown,
      monthlyBreakdown,
      allMonthlyBreakdown,
      priorMonthlyBreakdown,
      workloadAlerts,
      calendarMissing,
      calendarReadyCount,
      rideNeedsAttention,
      missingInformation,
      longestShift,
      busiestStretch,
      busiestMonth,
      mostUsedVenue,
      eventTypeBreakdown,
      bestConsecutive,
      shortTurnarounds,
      longShifts,
      unpaidCompleted,
      recentChanges: recentChanges.slice(0, 8),
      safetySnapshotLabel: safetySnapshot?.label || '',
      safetySnapshotCreatedAt: safetySnapshot?.createdAt || '',
    };
  }, [aiOverviewGeneratedAt, archivedShifts, shifts, upcomingScheduleShifts]);

  const aiMonthOptions = aiOverview.allMonthlyBreakdown || [];

  const visibleAiMonthlyBreakdown = useMemo(() => {
    if (aiMonthView === 'specific') {
      return aiMonthOptions.filter((month) => month.monthKey === aiSelectedMonthKey);
    }

    if (aiMonthView === 'prior') {
      return aiOverview.priorMonthlyBreakdown || [];
    }

    if (aiMonthView === 'all') {
      return aiMonthOptions;
    }

    return aiOverview.monthlyBreakdown || [];
  }, [
    aiMonthOptions,
    aiMonthView,
    aiOverview.monthlyBreakdown,
    aiOverview.priorMonthlyBreakdown,
    aiSelectedMonthKey,
  ]);

  const aiMonthlyViewLabel = useMemo(() => {
    if (aiMonthView === 'prior') return 'Prior Months';
    if (aiMonthView === 'all') return 'All Months';

    if (aiMonthView === 'specific') {
      return aiMonthOptions.find((month) => month.monthKey === aiSelectedMonthKey)?.label || 'Selected Month';
    }

    return 'Current + Future Months';
  }, [aiMonthOptions, aiMonthView, aiSelectedMonthKey, calendarVerificationByShiftId]);

  const selectedAiPrintMonth =
    aiMonthOptions.find((month) => month.monthKey === aiSelectedMonthKey) || null;

  const selectedAiPrintMonthShifts = selectedAiPrintMonth
    ? selectedAiPrintMonth.shifts.filter(
        (shift) => normalizeShiftStatus(shift.shiftStatus) !== 'Cancelled'
      )
    : [];

  const selectedAiPrintMonthHours = selectedAiPrintMonthShifts.reduce(
    (sum, shift) => sum + getShiftHours(shift),
    0
  );

  const handleOpenAiOverview = () => {
    setAiOverviewGeneratedAt(Date.now());
    setAiReadinessFocus('');
    setShowAiOverview(true);
  };

  const handleRefreshAiOverview = () => {
    setAiOverviewGeneratedAt(Date.now());
    setSaveMessage('AI Overview refreshed from current CSC shift data.');
    window.setTimeout(() => setSaveMessage(''), 2500);
  };

  const handleCopyAiOverview = async () => {
    const overviewText = buildCscAiOverviewText(
      aiOverview,
      visibleAiMonthlyBreakdown,
      aiMonthlyViewLabel
    );

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(overviewText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = overviewText;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setSaveMessage('AI Overview copied.');
      window.setTimeout(() => setSaveMessage(''), 2500);
    } catch (error) {
      console.error('Failed to copy CSC AI Overview:', error);
      setSaveMessage('AI Overview could not be copied.');
      window.setTimeout(() => setSaveMessage(''), 3000);
    }
  };

  const handleToggleAiReadinessFocus = (focusKey) => {
    setAiReadinessFocus((current) => (current === focusKey ? '' : focusKey));
  };

  const handleAiReadinessKeyDown = (event, focusKey) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    handleToggleAiReadinessFocus(focusKey);
  };

  const handleOpenAiShiftDetails = (shift) => {
    if (!shift?.id) return;
    setAiReadinessFocus('');
    handleOpenShiftDetails(shift);
  };

  const handleOpenAiShiftEdit = (shift) => {
    if (!shift?.id) return;
    setAiReadinessFocus('');
    handleOpenEditShift(shift);
  };

  const handleOpenAiRidePlan = (shift) => {
    if (!shift?.id) return;
    setShowAiOverview(false);
    setAiReadinessFocus('');
    handlePlanOrOpenRide(shift);
  };

  const handleAddMissingAiOverviewCalendarEvents = async () => {
    const missingCalendarShifts = aiOverview.calendarMissing.filter(
      (shift) => shift.startDate && shift.startTime && shift.finishTime
    );

    if (!missingCalendarShifts.length) {
      setSaveMessage('All upcoming CSC shifts are already linked to Google Calendar.');
      window.setTimeout(() => setSaveMessage(''), 2500);
      return;
    }

    const confirmed = window.confirm(
      `Add ${missingCalendarShifts.length} upcoming CSC shift${missingCalendarShifts.length === 1 ? '' : 's'} that are missing from Google Calendar?`
    );
    if (!confirmed) return;

    for (const shift of missingCalendarShifts) {
      await handleAddShiftToCalendar(shift);
    }

    setAiOverviewGeneratedAt(Date.now());
    setSaveMessage(
      `Calendar add process completed for ${missingCalendarShifts.length} upcoming CSC shift${missingCalendarShifts.length === 1 ? '' : 's'}.`
    );
    window.setTimeout(() => setSaveMessage(''), 3500);
  };

  const handleViewMonth = (monthKey) => {
    setMonthFilter(monthKey);
    setShowMonthOverview(false);
    setVisibleShiftLimit(Number.MAX_SAFE_INTEGER);
    setIsShiftTableCollapsed(false);
  };

  const displayedShifts = useMemo(
    () => filteredShifts.slice(0, visibleShiftLimit),
    [filteredShifts, visibleShiftLimit]
  );

  useEffect(() => {
    setVisibleShiftLimit(DEFAULT_VISIBLE_SHIFT_COUNT);
  }, [excludedVenues, localSearch, monthFilter, paidFilter, searchQuery, statusFilter]);

  const pastShiftRecords = useMemo(() => {
    const todayKey = toLocalDateKey(new Date());
    const recordsById = new Map();
    const currentRecordIds = new Set(
      [...shifts, ...archivedShifts]
        .map((shift) => shift?.id)
        .filter(Boolean)
    );

    archivedShifts.forEach((shift) => {
      if (!shift?.id) return;
      recordsById.set(shift.id, { ...shift, recordSource: 'archived' });
    });

    shifts.forEach((shift) => {
      if (!shift?.id) return;
      const normalizedStatus = normalizeShiftStatus(shift.shiftStatus);
      const isPast = Boolean(shift.startDate && shift.startDate < todayKey);
      if (!isPast && !['Done', 'Cancelled'].includes(normalizedStatus)) return;
      recordsById.set(shift.id, { ...shift, recordSource: 'active' });
    });

    const safetySnapshot = readCscSafetySnapshot();
    const snapshotRecords = [
      ...(safetySnapshot?.activeShifts || []),
      ...(safetySnapshot?.archivedShifts || []),
    ];

    snapshotRecords.forEach((rawShift) => {
      const shift = normalizeShift(rawShift);
      if (!shift?.id || currentRecordIds.has(shift.id) || recordsById.has(shift.id)) return;

      const normalizedStatus = normalizeShiftStatus(shift.shiftStatus);
      const isPast = Boolean(shift.startDate && shift.startDate < todayKey);
      if (!isPast && !['Done', 'Cancelled'].includes(normalizedStatus)) return;

      recordsById.set(shift.id, {
        ...shift,
        recordSource: 'snapshot',
        snapshotCreatedAt: safetySnapshot?.createdAt || '',
      });
    });

    return Array.from(recordsById.values()).sort((first, second) =>
      `${second.startDate || ''}T${second.startTime || ''}`.localeCompare(
        `${first.startDate || ''}T${first.startTime || ''}`
      )
    );
  }, [archivedShifts, shifts]);

  const filteredArchivedShifts = useMemo(() => {
    const query = archiveSearch.trim().toLowerCase();

    return pastShiftRecords.filter((shift) => {
      const statusMatches = archiveStatusFilter === 'All' || shift.shiftStatus === archiveStatusFilter;
      if (!statusMatches) return false;
      if (!query) return true;

      const text = [
        shift.startDate,
        shift.startTime,
        shift.finishDate,
        shift.finishTime,
        shift.venue,
        shift.city,
        shift.address,
        shift.event,
        shift.jobName,
        shift.shiftName,
        shift.roleName,
        shift.shiftStatus,
        shift.paidStatus,
        shift.paymentDate,
        shift.notes,
        shift.parking,
        shift.uniform,
        shift.supervisor,
        shift.archivedAt,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(query);
    });
  }, [archiveSearch, archiveStatusFilter, pastShiftRecords]);

  const summary = useMemo(() => {
    const scheduledShifts = filteredShifts.filter(
      (shift) => !['Done', 'Cancelled'].includes(normalizeShiftStatus(shift.shiftStatus))
    );
    const allShiftRecords = Array.from(
      new Map(
        [...shifts, ...archivedShifts].map((shift) => [
          shift.id || createShiftIdFromEmail(shift),
          shift,
        ])
      ).values()
    );
    const completedShifts = allShiftRecords.filter(
      (shift) => normalizeShiftStatus(shift.shiftStatus) === 'Done'
    );
    const paidShifts = allShiftRecords.filter(
      (shift) =>
        normalizeShiftStatus(shift.shiftStatus) !== 'Cancelled' &&
        shift.paidStatus === 'Paid'
    );
    const totalHours = scheduledShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0);
    const estimatedPay = scheduledShifts.reduce((sum, shift) => sum + getEstimatedPay(shift), 0);
    const paidAmount = paidShifts.reduce(
      (sum, shift) => sum + getShiftPaidGrossPay(shift),
      0
    );
    const owedAmount = completedShifts.reduce(
      (sum, shift) => sum + (shift.paidStatus !== 'Paid' ? getEstimatedPay(shift) : 0),
      0
    );
    const workedHours = completedShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0);
    const soFiCount = scheduledShifts.filter((shift) => /sofi/i.test(shift.venue)).length;
    const firstShift = scheduledShifts[0];
    const lastShift = scheduledShifts[scheduledShifts.length - 1];

    return {
      totalShifts: scheduledShifts.length,
      totalHours,
      workedHours,
      estimatedPay,
      paidAmount,
      unpaidAmount: owedAmount,
      owedAmount,
      soFiCount,
      firstShift,
      lastShift,
    };
  }, [archivedShifts, filteredShifts, shifts]);

  const monthlySummary = useMemo(() => {
    const grouped = new Map();
    const combinedShifts = [
      ...shifts.map((shift) => ({ ...shift, recordSource: 'active' })),
      ...archivedShifts.map((shift) => ({ ...shift, recordSource: 'archived' })),
    ];

    combinedShifts.forEach((shift) => {
      const key = getMonthKey(shift.startDate);
      const isArchivedRecord = shift.recordSource === 'archived';
      const isCancelled = shift.shiftStatus === 'Cancelled';
      const isDone = shift.shiftStatus === 'Done';
      const estimatedPay = isCancelled ? 0 : getEstimatedPay(shift);
      const hours = isCancelled ? 0 : getShiftHours(shift);
      const paidAmount = isDone && shift.paidStatus === 'Paid' ? getShiftPaidGrossPay(shift) : 0;
      const owedAmount = isDone && shift.paidStatus !== 'Paid' ? estimatedPay : 0;
      const current = grouped.get(key) || {
        monthKey: key,
        label: getMonthLabel(key),
        totalRecords: 0,
        activeRecords: 0,
        archivedRecords: 0,
        cancelledRecords: 0,
        payableRecords: 0,
        workedRecords: 0,
        hours: 0,
        workedHours: 0,
        projectedPay: 0,
        earnedPay: 0,
        paidAmount: 0,
        owedAmount: 0,
      };

      current.totalRecords += 1;
      current.activeRecords += isArchivedRecord ? 0 : 1;
      current.archivedRecords += isArchivedRecord ? 1 : 0;
      current.cancelledRecords += isCancelled ? 1 : 0;
      current.payableRecords += isCancelled ? 0 : 1;
      current.workedRecords += isDone ? 1 : 0;
      current.hours += hours;
      current.workedHours += isDone ? hours : 0;
      current.projectedPay += estimatedPay;
      current.earnedPay += paidAmount + owedAmount;
      current.paidAmount += paidAmount;
      current.owedAmount += owedAmount;

      grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [archivedShifts, shifts]);

  const dashboardMonthKey =
    monthFilter !== 'All' ? monthFilter : getMonthKey(toLocalDateKey(new Date()));
  const dashboardMonthSummary = useMemo(
    () =>
      monthlySummary.find((month) => month.monthKey === dashboardMonthKey) || {
        monthKey: dashboardMonthKey,
        label: getMonthLabel(dashboardMonthKey),
        totalRecords: 0,
        activeRecords: 0,
        archivedRecords: 0,
        cancelledRecords: 0,
        payableRecords: 0,
        workedRecords: 0,
        hours: 0,
        workedHours: 0,
        projectedPay: 0,
        earnedPay: 0,
        paidAmount: 0,
        owedAmount: 0,
      },
    [dashboardMonthKey, monthlySummary]
  );

  const hoursAnalytics = useMemo(() => {
    const combinedShifts = [
      ...shifts.map((shift) => ({ ...shift, recordSource: 'active' })),
      ...archivedShifts.map((shift) => ({ ...shift, recordSource: 'archived' })),
    ];
    const payableShifts = combinedShifts.filter(
      (shift) => shift.shiftStatus !== 'Cancelled' && parseLocalDate(shift.startDate)
    );
    const weeklyGroups = new Map();
    const annualGroups = new Map();

    payableShifts.forEach((shift) => {
      const hours = getShiftHours(shift);
      const workedHours = shift.shiftStatus === 'Done' ? hours : 0;
      const weekRange = getWeekRange(shift.startDate);
      const yearKey = shift.startDate.slice(0, 4);

      if (weekRange) {
        const currentWeek = weeklyGroups.get(weekRange.weekKey) || {
          weekKey: weekRange.weekKey,
          startDate: weekRange.startDate,
          endDate: weekRange.endDate,
          shiftCount: 0,
          workedShiftCount: 0,
          scheduledHours: 0,
          workedHours: 0,
          workedShifts: [],
        };

        currentWeek.shiftCount += 1;
        currentWeek.workedShiftCount += shift.shiftStatus === 'Done' ? 1 : 0;
        currentWeek.scheduledHours += hours;
        currentWeek.workedHours += workedHours;
        if (shift.shiftStatus === 'Done') {
          currentWeek.workedShifts.push(shift);
        }
        weeklyGroups.set(weekRange.weekKey, currentWeek);
      }

      const currentYear = annualGroups.get(yearKey) || {
        yearKey,
        shiftCount: 0,
        workedShiftCount: 0,
        scheduledHours: 0,
        workedHours: 0,
        scheduledMonths: new Set(),
        workedMonths: new Set(),
      };

      currentYear.shiftCount += 1;
      currentYear.workedShiftCount += shift.shiftStatus === 'Done' ? 1 : 0;
      currentYear.scheduledHours += hours;
      currentYear.workedHours += workedHours;
      currentYear.scheduledMonths.add(getMonthKey(shift.startDate));
      if (shift.shiftStatus === 'Done') {
        currentYear.workedMonths.add(getMonthKey(shift.startDate));
      }
      annualGroups.set(yearKey, currentYear);
    });

    const today = new Date();
    const todayKey = toLocalDateKey(today);
    const currentWeekRange = getWeekRange(todayKey);
    const currentWeekKey = currentWeekRange?.weekKey;

    if (currentWeekRange && currentWeekKey && !weeklyGroups.has(currentWeekKey)) {
      weeklyGroups.set(currentWeekKey, {
        weekKey: currentWeekKey,
        startDate: currentWeekRange.startDate,
        endDate: currentWeekRange.endDate,
        shiftCount: 0,
        workedShiftCount: 0,
        scheduledHours: 0,
        workedHours: 0,
        workedShifts: [],
      });
    }

    const weekly = Array.from(weeklyGroups.values()).sort((a, b) => {
      if (a.weekKey === currentWeekKey) return -1;
      if (b.weekKey === currentWeekKey) return 1;
      return b.weekKey.localeCompare(a.weekKey);
    });
    const monthly = monthlySummary
      .filter((month) => month.monthKey !== 'No date' && month.payableRecords > 0)
      .slice()
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
    const annual = Array.from(annualGroups.values())
      .map((year) => ({
        ...year,
        scheduledMonthCount: year.scheduledMonths.size,
        workedMonthCount: year.workedMonths.size,
        averageScheduledMonth:
          year.scheduledMonths.size > 0 ? year.scheduledHours / year.scheduledMonths.size : 0,
        averageWorkedMonth:
          year.workedMonths.size > 0 ? year.workedHours / year.workedMonths.size : 0,
      }))
      .sort((a, b) => b.yearKey.localeCompare(a.yearKey));

    const currentMonthKey = getMonthKey(todayKey);
    const currentYearKey = String(today.getFullYear());
    const currentWeek = weekly.find((week) => week.weekKey === currentWeekKey);
    const currentMonth = monthlySummary.find((month) => month.monthKey === currentMonthKey);
    const currentYear = annual.find((year) => year.yearKey === currentYearKey);
    const workedMonths = monthlySummary.filter((month) => month.workedHours > 0);
    const firstTrackedMonthKey = payableShifts
      .map((shift) => getMonthKey(shift.startDate))
      .filter((monthKey) => monthKey !== 'No date')
      .sort((a, b) => a.localeCompare(b))[0];
    const completedMonths = firstTrackedMonthKey
      ? monthlySummary.filter(
          (month) =>
            month.monthKey !== 'No date' &&
            month.monthKey > firstTrackedMonthKey &&
            month.monthKey < currentMonthKey
        )
      : [];

    return {
      weekly,
      monthly,
      annual,
      currentWeekKey,
      currentWeekLabel: currentWeekRange
        ? formatWeekRange(currentWeekRange.startDate, currentWeekRange.endDate)
        : '',
      currentWeekWorkedHours: currentWeek?.workedHours || 0,
      currentWeekScheduledHours: currentWeek?.scheduledHours || 0,
      currentMonthWorkedHours: currentMonth?.workedHours || 0,
      currentMonthScheduledHours: currentMonth?.hours || 0,
      currentYearWorkedHours: currentYear?.workedHours || 0,
      currentYearScheduledHours: currentYear?.scheduledHours || 0,
      allTimeWorkedHours: workedMonths.reduce((sum, month) => sum + month.workedHours, 0),
      averageWorkedMonth:
        completedMonths.length > 0
          ? completedMonths.reduce((sum, month) => sum + month.workedHours, 0) / completedMonths.length
          : 0,
      averageScheduledMonth:
        completedMonths.length > 0
          ? completedMonths.reduce((sum, month) => sum + month.hours, 0) / completedMonths.length
          : 0,
      completedMonthCount: completedMonths.length,
    };
  }, [archivedShifts, monthlySummary, shifts]);

  const selectedWorkedWeek = useMemo(() => {
    if (!selectedWeekKey) return null;

    const week = hoursAnalytics.weekly.find((item) => item.weekKey === selectedWeekKey);
    if (!week) return null;

    const workedShifts = [...(week.workedShifts || [])].sort((a, b) =>
      `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`)
    );

    return {
      ...week,
      label: formatWeekRange(week.startDate, week.endDate),
      workedShifts,
      activeCount: workedShifts.filter((shift) => shift.recordSource === 'active').length,
      archivedCount: workedShifts.filter((shift) => shift.recordSource === 'archived').length,
      earnedPay: workedShifts.reduce((sum, shift) => sum + getEstimatedPay(shift), 0),
    };
  }, [hoursAnalytics.weekly, selectedWeekKey]);

  const visibleMonthlySummary = useMemo(() => {
    const previousMonthKey = getMonthKeyWithOffset(-1);
    const currentMonthKey = getMonthKeyWithOffset(0);
    const nextMonthKey = getMonthKeyWithOffset(1);
    const currentYear = currentMonthKey.slice(0, 4);

    if (monthRangeMode === 'historical') return monthlySummary;

    if (monthRangeMode === 'prior') {
      return monthlySummary.filter((month) => month.monthKey < currentMonthKey);
    }

    if (monthRangeMode === 'currentYear') {
      return monthlySummary.filter((month) => month.monthKey.startsWith(currentYear));
    }

    return monthlySummary.filter((month) =>
      [previousMonthKey, currentMonthKey, nextMonthKey].includes(month.monthKey)
    );
  }, [monthRangeMode, monthlySummary]);

  const monthlySummaryDateLabel = useMemo(() => {
    if (!visibleMonthlySummary.length) return 'No months';

    const firstMonth = visibleMonthlySummary[0];
    const lastMonth = visibleMonthlySummary[visibleMonthlySummary.length - 1];

    return firstMonth.monthKey === lastMonth.monthKey
      ? firstMonth.label
      : `${firstMonth.label} to ${lastMonth.label}`;
  }, [visibleMonthlySummary]);

  const selectedPaidMonth = useMemo(() => {
    if (!selectedPaidMonthKey) return null;

    const monthSummary = monthlySummary.find((month) => month.monthKey === selectedPaidMonthKey);
    const allStoredShifts = [
      ...shifts.map((shift) => ({ ...shift, recordSource: 'active' })),
      ...archivedShifts.map((shift) => ({ ...shift, recordSource: 'archived' })),
    ];
    const monthShifts = allStoredShifts
      .filter((shift) => getMonthKey(shift.startDate) === selectedPaidMonthKey)
      .sort((a, b) => `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`));

    const payableShifts = monthShifts.filter((shift) => shift.shiftStatus !== 'Cancelled');
    const doneShifts = payableShifts.filter((shift) => shift.shiftStatus === 'Done');
    const allDoneShifts = allStoredShifts.filter((shift) => shift.shiftStatus === 'Done');
    const paidShifts = payableShifts.filter((shift) => shift.paidStatus === 'Paid');
    const owedShifts = doneShifts.filter((shift) => shift.paidStatus !== 'Paid');
    const openShifts = payableShifts.filter((shift) => !['Done', 'Cancelled'].includes(shift.shiftStatus));
    const cancelledShifts = monthShifts.filter((shift) => shift.shiftStatus === 'Cancelled');
    const reportStartDate = `${selectedPaidMonthKey}-01`;
    const [reportYear, reportMonth] = selectedPaidMonthKey.split('-').map(Number);
    const reportEndDate = toLocalDateKey(new Date(reportYear, reportMonth, 0));
    const actualPaychecks = getUniquePaychecksMatchingShifts(doneShifts, paychecks).map(
      (paycheck) =>
        getPaycheckReportAllocation(
          paycheck,
          doneShifts,
          allDoneShifts,
          reportStartDate,
          reportEndDate
        )
    );
    const weeklyGroups = new Map();

    monthShifts.forEach((shift) => {
      const weekRange = getWeekRange(shift.startDate);
      if (!weekRange) return;

      const isCancelled = shift.shiftStatus === 'Cancelled';
      const isDone = shift.shiftStatus === 'Done';
      const isPaid = shift.paidStatus === 'Paid' && !isCancelled;
      const hours = isCancelled ? 0 : getShiftHours(shift);
      const expectedPay = isCancelled ? 0 : getEstimatedPay(shift);
      const currentWeek = weeklyGroups.get(weekRange.weekKey) || {
        weekKey: weekRange.weekKey,
        startDate: weekRange.startDate,
        endDate: weekRange.endDate,
        shifts: [],
        payableCount: 0,
        workedCount: 0,
        hours: 0,
        workedHours: 0,
        expectedPay: 0,
        earnedPay: 0,
        paidAmount: 0,
        owedAmount: 0,
      };

      currentWeek.shifts.push(shift);
      currentWeek.payableCount += isCancelled ? 0 : 1;
      currentWeek.workedCount += isDone ? 1 : 0;
      currentWeek.hours += hours;
      currentWeek.workedHours += isDone ? hours : 0;
      currentWeek.expectedPay += expectedPay;
      currentWeek.earnedPay += isDone ? expectedPay : 0;
      currentWeek.paidAmount += isPaid ? getShiftPaidGrossPay(shift) : 0;
      currentWeek.owedAmount += isDone && !isPaid ? expectedPay : 0;
      weeklyGroups.set(weekRange.weekKey, currentWeek);
    });

    const weeklyBreakdown = Array.from(weeklyGroups.values())
      .map((week) => {
        const weekDoneShifts = week.shifts.filter((shift) => shift.shiftStatus === 'Done');
        const weekPaychecks = getUniquePaychecksMatchingShifts(
          weekDoneShifts,
          paychecks
        ).map((paycheck) =>
          getPaycheckReportAllocation(
            paycheck,
            weekDoneShifts,
            allDoneShifts,
            week.startDate,
            week.endDate
          )
        );

        return {
          ...week,
          label: formatWeekRange(week.startDate, week.endDate),
          shifts: week.shifts.sort((a, b) =>
            `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`)
          ),
          actualPaychecks: weekPaychecks,
          actualGrossPaid: weekPaychecks.reduce(
            (sum, paycheck) => sum + getReportPaycheckGross(paycheck),
            0
          ),
          actualNetReceived: weekPaychecks.reduce(
            (sum, paycheck) => sum + getReportPaycheckNet(paycheck),
            0
          ),
        };
      })
      .sort((a, b) => a.weekKey.localeCompare(b.weekKey));

    return {
      monthKey: selectedPaidMonthKey,
      label: monthSummary?.label || getMonthLabel(selectedPaidMonthKey),
      paidShifts: monthShifts,
      weeklyBreakdown,
      activeCount: monthShifts.filter((shift) => shift.recordSource === 'active').length,
      archivedCount: monthShifts.filter((shift) => shift.recordSource === 'archived').length,
      paidCount: paidShifts.length,
      owedCount: owedShifts.length,
      openCount: openShifts.length,
      cancelledCount: cancelledShifts.length,
      actualPaychecks,
      totalHours: payableShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0),
      workedHours: doneShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0),
      projectedPay: payableShifts.reduce((sum, shift) => sum + getEstimatedPay(shift), 0),
      earnedPay: doneShifts.reduce((sum, shift) => sum + getEstimatedPay(shift), 0),
      actualGrossPaid: actualPaychecks.reduce(
        (sum, paycheck) => sum + getReportPaycheckGross(paycheck),
        0
      ),
      actualNetReceived: actualPaychecks.reduce(
        (sum, paycheck) => sum + getReportPaycheckNet(paycheck),
        0
      ),
      owedAmount: owedShifts.reduce((sum, shift) => sum + getEstimatedPay(shift), 0),
    };
  }, [archivedShifts, monthlySummary, paychecks, selectedPaidMonthKey, shifts]);

  const activeShiftCount = useMemo(
    () => shifts.filter((shift) => !['Done', 'Cancelled'].includes(shift.shiftStatus)).length,
    [shifts]
  );

  const visibleShiftCount = displayedShifts.length;
  const allShiftRowsVisible = visibleShiftCount >= filteredShifts.length;
  const renderShiftListPagingControls = () => {
    const remainingShiftCount = Math.max(0, filteredShifts.length - visibleShiftCount);
    const nextShiftCount = Math.min(DEFAULT_VISIBLE_SHIFT_COUNT, remainingShiftCount);

    return (
      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        <button
          type="button"
          onClick={
            allShiftRowsVisible
              ? () => setVisibleShiftLimit(DEFAULT_VISIBLE_SHIFT_COUNT)
              : handleShowMoreShifts
          }
          style={{ backgroundColor: '#5b21b6', color: '#ffffff' }}
          className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-violet-900 px-3 text-sm font-extrabold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2"
          aria-expanded={visibleShiftCount > DEFAULT_VISIBLE_SHIFT_COUNT}
          aria-label={
            allShiftRowsVisible
              ? `Show only the first ${DEFAULT_VISIBLE_SHIFT_COUNT} shifts`
              : `Show the next ${nextShiftCount} shifts`
          }
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${allShiftRowsVisible ? '' : 'rotate-180'}`}
          />
          <span>{allShiftRowsVisible ? 'Show Less' : 'Show More'}</span>
        </button>

        <button
          type="button"
          onClick={handleBackToShiftListTop}
          style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}
          className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-blue-950 px-3 text-sm font-extrabold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
          aria-label="Back to the top of Scheduled Shifts"
        >
          <ChevronDown className="h-4 w-4 shrink-0 rotate-180" />
          <span>Back to Top</span>
        </button>
      </div>
    );
  };

  const handleManualSafetySnapshot = () => {
    const saved = writeCscSafetySnapshot('Manual CSC safety snapshot', shifts, archivedShifts);
    setSaveMessage(saved ? 'CSC safety snapshot saved.' : 'CSC safety snapshot failed.');
    setTimeout(() => setSaveMessage(''), 2500);
  };

  const handleVerifyCscDataAgainstGoogleCalendar = async () => {
    if (calendarAuditRunning || calendarCleanupLockRef.current || calendarAddLockRef.current.size) {
      setSaveMessage('A Google Calendar operation is already running.');
      window.setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    calendarCleanupLockRef.current = true;
    setCalendarAuditRunning(true);
    setCalendarAuditReport(null);
    setSaveMessage('Verifying CSC data against Google Calendar. No data will be changed...');

    try {
      const currentRecords = Array.from(
        new Map(
          [...shifts, ...archivedShifts]
            .filter((shift) => shift?.id)
            .map((shift) => [shift.id, shift])
        ).values()
      );
      const snapshotOnlyRecords = pastShiftRecords.filter(
        (shift) => shift?.recordSource === 'snapshot'
      );
      const allDateSources = [...currentRecords, ...snapshotOnlyRecords]
        .map((shift) => String(shift?.startDate || '').trim())
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value));
      const currentYear = new Date().getFullYear();
      const years = allDateSources
        .map((value) => Number(value.slice(0, 4)))
        .filter(Number.isFinite);
      const firstYear = years.length ? Math.min(...years, currentYear) : currentYear;
      const lastYear = years.length ? Math.max(...years, currentYear) : currentYear;
      const rangeStart = new Date(`${firstYear}-01-01T00:00:00`);
      const rangeEnd = new Date(`${lastYear + 2}-01-01T00:00:00`);

      const calendarEvents = await listGoogleCalendarEvents({
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
        query: 'CSC Shift',
      });
      const cscCalendarEvents = calendarEvents.filter(isCscManagedGoogleCalendarEvent);
      const calendarRegistry = readCalendarRegistry();
      const claimedEventIds = new Set();

      const currentComparable = dedupeShiftRecords(
        currentRecords.filter(
          (shift) =>
            shift.startDate &&
            shift.startTime &&
            shift.finishTime &&
            normalizeShiftStatus(shift.shiftStatus) !== 'Cancelled'
        )
      ).shifts;
      const currentCancelled = currentRecords.filter(
        (shift) => normalizeShiftStatus(shift.shiftStatus) === 'Cancelled'
      );

      const orderedCurrent = [...currentComparable].sort((first, second) => {
        const firstRegistry = findCalendarRegistryEntry(first, calendarRegistry);
        const secondRegistry = findCalendarRegistryEntry(second, calendarRegistry);
        const firstLinked = Boolean(
          first.googleCalendarEventId || firstRegistry?.googleCalendarEventId
        );
        const secondLinked = Boolean(
          second.googleCalendarEventId || secondRegistry?.googleCalendarEventId
        );

        if (firstLinked !== secondLinked) return firstLinked ? -1 : 1;

        return getCscShiftCalendarStartKey(first).localeCompare(
          getCscShiftCalendarStartKey(second)
        );
      });

      const matchedCurrent = [];
      orderedCurrent.forEach((shift) => {
        const registryEntry = findCalendarRegistryEntry(shift, calendarRegistry);
        const availableEvents = cscCalendarEvents.filter(
          (event) => event?.id && !claimedEventIds.has(event.id)
        );
        const matchedEvent = findBestCscGoogleCalendarEventForShift(
          shift,
          availableEvents,
          registryEntry
        );

        if (!matchedEvent?.id) return;

        claimedEventIds.add(matchedEvent.id);
        matchedCurrent.push({ shift, event: matchedEvent });
      });

      const matchedCurrentIds = new Set(
        matchedCurrent.map(({ shift }) => shift.id)
      );
      const missingCurrent = currentComparable.filter(
        (shift) => !matchedCurrentIds.has(shift.id)
      );

      const snapshotComparable = dedupeShiftRecords(
        snapshotOnlyRecords.filter(
          (shift) =>
            shift.startDate &&
            shift.startTime &&
            shift.finishTime &&
            normalizeShiftStatus(shift.shiftStatus) !== 'Cancelled'
        )
      ).shifts;
      const matchedSnapshotOnly = [];

      snapshotComparable.forEach((shift) => {
        const availableEvents = cscCalendarEvents.filter(
          (event) => event?.id && !claimedEventIds.has(event.id)
        );
        const matchedEvent = findBestCscGoogleCalendarEventForShift(
          shift,
          availableEvents,
          findCalendarRegistryEntry(shift, calendarRegistry)
        );

        if (!matchedEvent?.id) return;

        claimedEventIds.add(matchedEvent.id);
        matchedSnapshotOnly.push({ shift, event: matchedEvent });
      });

      const matchedSnapshotIds = new Set(
        matchedSnapshotOnly.map(({ shift }) => shift.id)
      );
      const unsupportedSnapshotOnly = snapshotComparable.filter(
        (shift) => !matchedSnapshotIds.has(shift.id)
      );

      const matchedGroups = new Set(
        [...matchedCurrent, ...matchedSnapshotOnly].map(({ shift }) =>
          [
            getCscShiftCalendarStartKey(shift),
            normalizeCalendarVenueIdentity(shift.venue),
          ].join('|')
        )
      );

      const unmatchedCalendarEvents = cscCalendarEvents
        .filter((event) => event?.id && !claimedEventIds.has(event.id))
        .map((event) => {
          const eventGroup = [
            getCscGoogleCalendarEventStartKey(event),
            getCscGoogleCalendarEventVenueIdentity(event),
          ].join('|');

          return {
            event,
            reason: matchedGroups.has(eventGroup) ? 'duplicate' : 'unmatched',
          };
        });

      const duplicateCalendarEvents = unmatchedCalendarEvents.filter(
        ({ reason }) => reason === 'duplicate'
      );
      const unlinkedCalendarEvents = unmatchedCalendarEvents.filter(
        ({ reason }) => reason === 'unmatched'
      );

      const archiveRecordIds = new Set(archivedShifts.map((shift) => shift?.id).filter(Boolean));
      const activePastRecords = pastShiftRecords.filter(
        (shift) => shift?.recordSource === 'active'
      );
      const snapshotPastRecords = pastShiftRecords.filter(
        (shift) => shift?.recordSource === 'snapshot'
      );
      const archivedPastRecords = pastShiftRecords.filter(
        (shift) => shift?.recordSource === 'archived' && archiveRecordIds.has(shift.id)
      );

      setShowDataScreen(false);
      setCalendarAuditReport({
        checkedAt: new Date().toISOString(),
        rangeStart: `${firstYear}-01-01`,
        rangeEnd: `${lastYear + 1}-12-31`,
        counts: {
          activeStored: shifts.length,
          archivedStored: archivedShifts.length,
          pastDrawer: pastShiftRecords.length,
          archivedPastRecords: archivedPastRecords.length,
          activePastRecords: activePastRecords.length,
          snapshotOnlyPast: snapshotPastRecords.length,
          cancelledStored: currentCancelled.length,
          calendarEvents: cscCalendarEvents.length,
          comparableCurrent: currentComparable.length,
          matchedCurrent: matchedCurrent.length,
          missingCurrent: missingCurrent.length,
          snapshotCalendarSupported: matchedSnapshotOnly.length,
          snapshotUnsupported: unsupportedSnapshotOnly.length,
          duplicateCalendarEvents: duplicateCalendarEvents.length,
          unlinkedCalendarEvents: unlinkedCalendarEvents.length,
        },
        missingCurrent,
        matchedSnapshotOnly,
        unsupportedSnapshotOnly,
        duplicateCalendarEvents,
        unlinkedCalendarEvents,
      });

      setSaveMessage(
        `CSC Calendar audit complete. ${matchedCurrent.length} current shift${
          matchedCurrent.length === 1 ? '' : 's'
        } matched; ${missingCurrent.length} missing from Calendar; ${
          matchedSnapshotOnly.length
        } snapshot-only record${matchedSnapshotOnly.length === 1 ? '' : 's'} supported by Calendar. No data changed.`
      );
      window.setTimeout(() => setSaveMessage(''), 9000);
    } catch (error) {
      console.error('CSC Google Calendar audit failed:', error);
      setSaveMessage(
        error?.message ||
          'CSC Google Calendar audit failed. No CSC or Calendar data was changed.'
      );
      window.setTimeout(() => setSaveMessage(''), 7000);
    } finally {
      setCalendarAuditRunning(false);
      calendarCleanupLockRef.current = false;
    }
  };

  const handleCleanGoogleCalendarDuplicates = async () => {
    if (calendarCleanupLockRef.current || calendarAddLockRef.current.size) {
      setSaveMessage('A Google Calendar operation is already running.');
      window.setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    calendarCleanupLockRef.current = true;
    setSaveMessage('Comparing Google Calendar against current CSC Shifts...');

    try {
      const todayKey = toLocalDateKey(new Date());
      const rangeStart = new Date(`${todayKey}T00:00:00`);
      const rangeEnd = new Date(rangeStart);
      rangeEnd.setFullYear(rangeEnd.getFullYear() + 1);

      const calendarEvents = await listGoogleCalendarEvents({
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
        query: 'CSC Shift',
      });
      const cscCalendarEvents = calendarEvents.filter(
        isCscManagedGoogleCalendarEvent
      );

      const sourceRecords = Array.from(
        new Map(
          [...shifts, ...archivedShifts]
            .filter((shift) => shift?.id)
            .map((shift) => [shift.id, shift])
        ).values()
      ).filter(
        (shift) =>
          shift.startDate &&
          shift.startTime &&
          shift.finishTime &&
          shift.startDate >= todayKey &&
          normalizeShiftStatus(shift.shiftStatus) !== 'Cancelled'
      );
      const canonicalShifts = dedupeShiftRecords(sourceRecords).shifts;
      const calendarRegistry = readCalendarRegistry();
      const claimedEventIds = new Set();
      const matchedPairs = [];

      const orderedShifts = [...canonicalShifts].sort((first, second) => {
        const firstRegistry = findCalendarRegistryEntry(first, calendarRegistry);
        const secondRegistry = findCalendarRegistryEntry(second, calendarRegistry);
        const firstLinked = Boolean(
          first.googleCalendarEventId || firstRegistry?.googleCalendarEventId
        );
        const secondLinked = Boolean(
          second.googleCalendarEventId || secondRegistry?.googleCalendarEventId
        );

        if (firstLinked !== secondLinked) return firstLinked ? -1 : 1;

        return getCscShiftCalendarStartKey(first).localeCompare(
          getCscShiftCalendarStartKey(second)
        );
      });

      orderedShifts.forEach((shift) => {
        const registryEntry = findCalendarRegistryEntry(shift, calendarRegistry);
        const availableEvents = cscCalendarEvents.filter(
          (event) => event?.id && !claimedEventIds.has(event.id)
        );
        const matchedEvent = findBestCscGoogleCalendarEventForShift(
          shift,
          availableEvents,
          registryEntry
        );

        if (!matchedEvent?.id) return;

        claimedEventIds.add(matchedEvent.id);
        matchedPairs.push({ shift, event: matchedEvent });
      });

      const matchedShiftGroups = new Set(
        matchedPairs.map(({ shift }) =>
          [
            getCscShiftCalendarStartKey(shift),
            normalizeCalendarVenueIdentity(shift.venue),
          ].join('|')
        )
      );

      const deleteCandidates = cscCalendarEvents
        .filter((event) => event?.id && !claimedEventIds.has(event.id))
        .map((event) => {
          const eventGroup = [
            getCscGoogleCalendarEventStartKey(event),
            getCscGoogleCalendarEventVenueIdentity(event),
          ].join('|');

          return {
            event,
            reason: matchedShiftGroups.has(eventGroup)
              ? 'duplicate'
              : 'stale',
          };
        });

      if (!deleteCandidates.length) {
        const matchedShiftIds = new Set(
          matchedPairs.map(({ shift }) => shift.id)
        );
        const canonicalShiftIds = new Set(
          canonicalShifts.map((shift) => shift.id)
        );

        const refreshedActive = shifts.map((shift) => {
          if (!canonicalShiftIds.has(shift.id)) return shift;

          const matchedPair = matchedPairs.find(
            (pair) => pair.shift.id === shift.id
          );

          if (matchedPair) {
            const calendarFields = {
              googleCalendarEventId: matchedPair.event.id || '',
              googleCalendarEventLink: matchedPair.event.htmlLink || '',
              googleCalendarAddedAt:
                shift.googleCalendarAddedAt ||
                matchedPair.event.created ||
                new Date().toISOString(),
            };

            saveCalendarRegistryEntry(shift, calendarFields);
            return normalizeShift({ ...shift, ...calendarFields });
          }

          removeCalendarRegistryEntriesForShift(shift);

          return normalizeShift({
            ...shift,
            googleCalendarEventId: '',
            googleCalendarEventLink: '',
            googleCalendarAddedAt: '',
          });
        });

        setShifts(refreshedActive);
        setCalendarVerificationByShiftId((current) => {
          const next = { ...current };

          canonicalShifts.forEach((shift) => {
            next[shift.id] = matchedShiftIds.has(shift.id)
              ? 'verified'
              : 'missing';
          });

          return next;
        });
        setAiOverviewGeneratedAt(Date.now());

        const missingRemoteCount =
          canonicalShifts.length - matchedShiftIds.size;
        setSaveMessage(
          `Google Calendar check complete. Verified ${matchedShiftIds.size} CSC shift${
            matchedShiftIds.size === 1 ? '' : 's'
          } and cleared ${missingRemoteCount} stale local calendar marker${
            missingRemoteCount === 1 ? '' : 's'
          }. No duplicate Google Calendar events needed deletion.`
        );
        window.setTimeout(() => setSaveMessage(''), 7000);
        return;
      }

      const duplicateCount = deleteCandidates.filter(
        (item) => item.reason === 'duplicate'
      ).length;
      const staleCount = deleteCandidates.length - duplicateCount;
      const confirmed = window.confirm(
        `Google Calendar cleanup found ${deleteCandidates.length} extra CSC event${
          deleteCandidates.length === 1 ? '' : 's'
        } when compared with current CSC Shifts: ${duplicateCount} duplicate${
          duplicateCount === 1 ? '' : 's'
        } and ${staleCount} stale event${
          staleCount === 1 ? '' : 's'
        }. Delete these extra CSC calendar events? Non-CSC calendar events will not be touched.`
      );

      if (!confirmed) {
        setSaveMessage('Google Calendar cleanup cancelled. No events were deleted.');
        window.setTimeout(() => setSaveMessage(''), 3500);
        return;
      }

      writeCscSafetySnapshot(
        'Before Google Calendar CSC duplicate cleanup',
        shifts,
        archivedShifts
      );

      const deletedEventIds = new Set();
      const deletionFailures = [];

      for (const { event, reason } of deleteCandidates) {
        try {
          await deleteGoogleCalendarEvent(event.id);
          deletedEventIds.add(event.id);
        } catch (error) {
          console.error(
            `Failed to delete ${reason} CSC Google Calendar event:`,
            error
          );
          deletionFailures.push(
            `${event?.summary || event?.id || 'CSC event'}: ${
              error?.message || 'Unknown Google Calendar error'
            }`
          );
        }
      }

      const linkageByShiftId = new Map(
        matchedPairs.map(({ shift, event }) => [
          shift.id,
          {
            googleCalendarEventId: event.id || '',
            googleCalendarEventLink: event.htmlLink || '',
            googleCalendarAddedAt:
              shift.googleCalendarAddedAt ||
              event.created ||
              new Date().toISOString(),
          },
        ])
      );

      const refreshCalendarFields = (records = []) =>
        records.map((shift) => {
          const matchedFields = linkageByShiftId.get(shift.id);

          if (matchedFields) {
            return normalizeShift({ ...shift, ...matchedFields });
          }

          if (
            shift.googleCalendarEventId &&
            deletedEventIds.has(shift.googleCalendarEventId)
          ) {
            return normalizeShift({
              ...shift,
              googleCalendarEventId: '',
              googleCalendarEventLink: '',
              googleCalendarAddedAt: '',
            });
          }

          return shift;
        });

      const nextActiveShifts = refreshCalendarFields(shifts);
      const nextArchivedShifts = refreshCalendarFields(archivedShifts);

      const cleanedRegistry = readCalendarRegistry().filter(
        (entry) =>
          !entry.googleCalendarEventId ||
          !deletedEventIds.has(entry.googleCalendarEventId)
      );
      writeCalendarRegistry(cleanedRegistry);

      matchedPairs.forEach(({ shift, event }) => {
        const fields = linkageByShiftId.get(shift.id);
        if (!fields) return;

        saveCalendarRegistryEntry(
          normalizeShift({ ...shift, ...fields }),
          fields
        );
      });

      setShifts(nextActiveShifts);
      setArchivedShifts(nextArchivedShifts);
      setAiOverviewGeneratedAt(Date.now());

      const deletedDuplicateCount = deleteCandidates.filter(
        ({ event, reason }) =>
          reason === 'duplicate' && deletedEventIds.has(event.id)
      ).length;
      const deletedStaleCount = deleteCandidates.filter(
        ({ event, reason }) =>
          reason === 'stale' && deletedEventIds.has(event.id)
      ).length;

      setSaveMessage(
        `Google Calendar cleanup complete. Deleted ${deletedDuplicateCount} duplicate CSC event${
          deletedDuplicateCount === 1 ? '' : 's'
        } and ${deletedStaleCount} stale CSC event${
          deletedStaleCount === 1 ? '' : 's'
        }.${
          deletionFailures.length
            ? ` ${deletionFailures.length} deletion${deletionFailures.length === 1 ? '' : 's'} failed; see the browser console.`
            : ''
        }`
      );
      window.setTimeout(
        () => setSaveMessage(''),
        deletionFailures.length ? 10000 : 6500
      );
    } catch (error) {
      console.error('Google Calendar CSC cleanup failed:', error);
      setSaveMessage(
        error?.message ||
          'Google Calendar cleanup failed before any unverified CSC event was deleted.'
      );
      window.setTimeout(() => setSaveMessage(''), 7000);
    } finally {
      calendarCleanupLockRef.current = false;
    }
  };

  const handleExportCompleteCscBackup = () => {
    try {
      const backup = {
        format: 'budget-dashboard-csc-backup',
        version: 1,
        createdAt: new Date().toISOString(),
        activeShifts: shifts,
        archivedShifts,
        metadata: {
          deletedSeedIds: JSON.parse(localStorage.getItem(CSC_DELETED_SEED_STORAGE_KEY) || '[]'),
          googleCalendarAdded: JSON.parse(localStorage.getItem(CSC_CALENDAR_ADDED_STORAGE_KEY) || '[]'),
          wishEssLatest: JSON.parse(localStorage.getItem(CSC_WISH_ESS_LATEST_STORAGE_KEY) || 'null'),
          september1RecoveryState: localStorage.getItem(CSC_SEPT_1_2026_RECOVERY_STORAGE_KEY),
        },
      };

      const dataBlob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json;charset=utf-8;',
      });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');

      link.href = url;
      link.download = `CSC_Complete_Backup_David_Hallstrom_${new Date().toISOString().slice(0, 10)}.json`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setSaveMessage(
        `Complete CSC backup exported: ${shifts.length} active, ${archivedShifts.length} archived.`
      );
      setTimeout(() => setSaveMessage(''), 3500);
    } catch (error) {
      console.error('Failed to export complete CSC backup:', error);
      setSaveMessage('Complete CSC backup export failed.');
      setTimeout(() => setSaveMessage(''), 3500);
    }
  };

  const restoreCompleteCscBackupFile = (file) => {
    if (!file) return;

    const fileName = String(file.name || '').trim();
    const fileType = String(file.type || '').toLowerCase();
    const looksLikeJson =
      fileName.toLowerCase().endsWith('.json') ||
      fileType === 'application/json' ||
      fileType === 'text/json';

    if (!looksLikeJson) {
      setSaveMessage('Choose or drop a JSON complete CSC backup file.');
      setTimeout(() => setSaveMessage(''), 5000);
      return;
    }

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(String(loadEvent.target?.result || ''));

        if (
          !parsed ||
          parsed.format !== 'budget-dashboard-csc-backup' ||
          parsed.version !== 1 ||
          !Array.isArray(parsed.activeShifts) ||
          !Array.isArray(parsed.archivedShifts)
        ) {
          throw new Error('Invalid CSC backup file.');
        }

        const nextActive = parsed.activeShifts.map(normalizeShift);
        const nextArchived = parsed.archivedShifts.map(normalizeShift);
        const combined = [...nextActive, ...nextArchived];
        const ids = combined.map((shift) => String(shift?.id || '').trim());

        if (ids.some((id) => !id)) {
          throw new Error('CSC backup contains a shift without an ID.');
        }

        if (new Set(ids).size !== ids.length) {
          throw new Error('CSC backup contains duplicate shift IDs across active and archived records.');
        }

        const snapshotSaved = writeCscSafetySnapshot(
          'Before complete CSC backup restore',
          shifts,
          archivedShifts
        );

        if (!snapshotSaved) {
          throw new Error('Could not save the pre-restore CSC safety snapshot. Restore cancelled.');
        }

        const metadata = parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : {};

        localStorage.setItem(CSC_STORAGE_KEY, JSON.stringify(nextActive));
        localStorage.setItem(CSC_ARCHIVE_STORAGE_KEY, JSON.stringify(nextArchived));
        localStorage.setItem(
          CSC_DELETED_SEED_STORAGE_KEY,
          JSON.stringify(Array.isArray(metadata.deletedSeedIds) ? metadata.deletedSeedIds : [])
        );
        localStorage.setItem(
          CSC_CALENDAR_ADDED_STORAGE_KEY,
          JSON.stringify(Array.isArray(metadata.googleCalendarAdded) ? metadata.googleCalendarAdded : [])
        );

        if (metadata.wishEssLatest == null) {
          localStorage.removeItem(CSC_WISH_ESS_LATEST_STORAGE_KEY);
        } else {
          localStorage.setItem(CSC_WISH_ESS_LATEST_STORAGE_KEY, JSON.stringify(metadata.wishEssLatest));
        }

        if (metadata.september1RecoveryState == null || metadata.september1RecoveryState === '') {
          localStorage.removeItem(CSC_SEPT_1_2026_RECOVERY_STORAGE_KEY);
        } else {
          localStorage.setItem(
            CSC_SEPT_1_2026_RECOVERY_STORAGE_KEY,
            String(metadata.september1RecoveryState)
          );
        }

        setShifts(nextActive);
        setArchivedShifts(nextArchived);
        syncOpportunityLinksFromShifts(nextActive, nextArchived);

        setSaveMessage(
          `Complete CSC backup restored exactly: ${nextActive.length} active, ${nextArchived.length} archived.`
        );
        setTimeout(() => setSaveMessage(''), 5000);
      } catch (error) {
        console.error('Failed to restore complete CSC backup:', error);
        setSaveMessage(error?.message || 'Complete CSC backup restore failed.');
        setTimeout(() => setSaveMessage(''), 5000);
      }
    };

    reader.onerror = () => {
      setSaveMessage('Complete CSC backup could not be read.');
      setTimeout(() => setSaveMessage(''), 5000);
    };

    reader.readAsText(file);
  };

  const handleRestoreCompleteCscBackup = (event) => {
    const input = event.target;
    const file = input.files?.[0];

    if (file) {
      restoreCompleteCscBackupFile(file);
    }

    input.value = '';
  };

  const handleCompleteBackupDragEnter = (event) => {
    if (!showDataScreen || !Array.from(event.dataTransfer?.types || []).includes('Files')) return;

    event.preventDefault();
    completeBackupDragDepthRef.current += 1;
    setIsCompleteBackupDragActive(true);
  };

  const handleCompleteBackupDragOver = (event) => {
    if (!showDataScreen || !Array.from(event.dataTransfer?.types || []).includes('Files')) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleCompleteBackupDragLeave = (event) => {
    if (!showDataScreen) return;

    event.preventDefault();
    completeBackupDragDepthRef.current = Math.max(completeBackupDragDepthRef.current - 1, 0);

    if (completeBackupDragDepthRef.current === 0) {
      setIsCompleteBackupDragActive(false);
    }
  };

  const handleCompleteBackupDrop = (event) => {
    if (!showDataScreen) return;

    event.preventDefault();
    event.stopPropagation();

    completeBackupDragDepthRef.current = 0;
    setIsCompleteBackupDragActive(false);

    const files = Array.from(event.dataTransfer?.files || []);
    const jsonFile = files.find((file) => {
      const fileName = String(file?.name || '').toLowerCase();
      const fileType = String(file?.type || '').toLowerCase();

      return (
        fileName.endsWith('.json') ||
        fileType === 'application/json' ||
        fileType === 'text/json'
      );
    });

    if (!jsonFile) {
      setSaveMessage('Drop a JSON complete CSC backup file.');
      setTimeout(() => setSaveMessage(''), 5000);
      return;
    }

    restoreCompleteCscBackupFile(jsonFile);
  };

  const handleExportCsv = () => {
    const csv = buildCsv(shifts);
    const dataBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `CSC_Shifts_David_Hallstrom_${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    setSaveMessage('CSC shifts exported.');
    setTimeout(() => setSaveMessage(''), 2500);
  };

  const handleImportCsv = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (loadEvent) => {
      try {
        const importedShifts = parseCsv(String(loadEvent.target?.result || ''));

        if (!importedShifts.length) {
          setSaveMessage('CSV import skipped. No rows found.');
          setTimeout(() => setSaveMessage(''), 3000);
          return;
        }

        writeCscSafetySnapshot('Before CSC CSV import', shifts, archivedShifts);

        const currentById = new Map(shifts.map((shift) => [shift.id, shift]));
        let addedCount = 0;
        let updatedCount = 0;
        let skippedArchivedCount = 0;
        let collisionSafeCount = 0;

        importedShifts.forEach((rawShift) => {
          const importedShift = normalizeShift(rawShift);

          if (matchesArchivedShift(importedShift, archivedShifts)) {
            skippedArchivedCount += 1;
            return;
          }

          const existingById = currentById.get(importedShift.id);
          const safeExistingMatch =
            existingById &&
            (shiftWindowsMatch(existingById, importedShift) ||
              areLikelyDuplicateShifts(existingById, importedShift));

          if (safeExistingMatch) {
            currentById.set(
              existingById.id,
              normalizeShift({ ...existingById, ...importedShift, id: existingById.id })
            );
            updatedCount += 1;
            return;
          }

          const matchingShiftId = Array.from(currentById.values()).find(
            (candidate) =>
              shiftWindowsMatch(candidate, importedShift) &&
              (areLikelyDuplicateShifts(candidate, importedShift) ||
                getScannedShiftMatchScore(candidate, importedShift) >= 4)
          )?.id;

          if (matchingShiftId) {
            const existingShift = currentById.get(matchingShiftId);
            currentById.set(
              matchingShiftId,
              normalizeShift({
                ...mergeScannedShiftWithExisting(existingShift, importedShift),
                id: matchingShiftId,
              })
            );
            updatedCount += 1;
            return;
          }

          const safeId = createUniqueScannedShiftId(currentById, importedShift);
          if (safeId !== importedShift.id) collisionSafeCount += 1;
          currentById.set(safeId, normalizeShift({ ...importedShift, id: safeId }));
          addedCount += 1;
        });

        const dedupeResult = dedupeShiftRecords(Array.from(currentById.values()));
        setShifts(dedupeResult.shifts);

        setSaveMessage(
          `CSV imported safely. Added ${addedCount}, updated ${updatedCount}, kept ${skippedArchivedCount} archived, prevented ${collisionSafeCount} ID collision${collisionSafeCount === 1 ? '' : 's'}${
            dedupeResult.removedIds.length
              ? `, removed ${dedupeResult.removedIds.length} duplicate${dedupeResult.removedIds.length === 1 ? '' : 's'}`
              : ''
          }.`
        );
        setTimeout(() => setSaveMessage(''), 3000);
      } catch (error) {
        console.error('Failed to import CSC shifts CSV:', error);
        setSaveMessage('CSV import failed.');
        setTimeout(() => setSaveMessage(''), 3000);
      }
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  const handleScanAcceptanceEmail = () => {
    const parsedShifts = parseAcceptanceEmails(shiftEmailText);

    if (!parsedShifts.length) {
      setScannedShifts([]);
      setSaveMessage('Scanner could not find a CSC email, schedule table, Kia Forum schedule, or Wish ESS Upcoming Schedules table. Paste the full text and try again.');
      setTimeout(() => setSaveMessage(''), 3500);
      return;
    }

    const missingFields = Array.from(new Set(parsedShifts.flatMap((parsedShift) => [
      !parsedShift.startDate ? 'start date' : '',
      !parsedShift.startTime ? 'start time' : '',
      !parsedShift.finishTime ? 'finish time' : '',
      !parsedShift.venue ? 'venue' : '',
    ].filter(Boolean))));

    const authoritativeScheduleUpdate = isAuthoritativeScheduleUpdateText(
      shiftEmailText,
      parsedShifts
    );

    setScannedShifts(parsedShifts);
    setSaveMessage(
      missingFields.length
        ? `Schedule scanned ${parsedShifts.length} shift${parsedShifts.length === 1 ? '' : 's'} with missing ${missingFields.join(', ')}. Review before updating.`
        : authoritativeScheduleUpdate
          ? `Wish ESS scanned ${parsedShifts.length} authoritative upcoming shift${parsedShifts.length === 1 ? '' : 's'}. Wish ESS will override conflicting CSC email data without deleting unlisted shifts automatically.`
          : `CSC email scanned ${parsedShifts.length} secondary shift record${parsedShifts.length === 1 ? '' : 's'}. Wish ESS-confirmed schedule fields will not be overwritten.`
    );
    setTimeout(() => setSaveMessage(''), 4000);
  };

  const handleAddScannedShift = async () => {
    if (!scannedShifts.length) {
      setSaveMessage('Scan a CSC schedule before updating shifts.');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    const wishEssImport = isWishEssScheduleUpdateText(shiftEmailText);
    const importedAt = new Date().toISOString();
    const wishEssSnapshotId = wishEssImport ? `wish-ess-${Date.now()}` : '';

    writeCscSafetySnapshot(
      wishEssImport
        ? 'Before authoritative Wish ESS schedule reconciliation'
        : 'Before secondary CSC email scan import',
      shifts,
      archivedShifts
    );

    const normalizedScannedShifts = scannedShifts.map((shift) =>
      normalizeShift({
        ...shift,
        scheduleSource: wishEssImport ? 'wish-ess' : shift.scheduleSource || 'csc-email',
        wishEssStatus: wishEssImport ? 'confirmed' : shift.wishEssStatus || 'email-only',
        wishEssVerifiedAt: wishEssImport ? importedAt : shift.wishEssVerifiedAt || '',
        wishEssSnapshotId: wishEssImport ? wishEssSnapshotId : shift.wishEssSnapshotId || '',
      })
    );
    const authoritativeScheduleUpdate = wishEssImport;
    const authoritativeKeepIds = new Set();

    let updatedCount = 0;
    let addedCount = 0;
    let collisionSafeCount = 0;
    let reconciledDuplicateCount = 0;
    let wishEssNotListedCount = 0;
    let skippedArchivedCount = 0;
    let calendarLinkWithoutIdCount = 0;
    const calendarSyncRequests = new Map();
    const scannerReplacementIds = new Map();
    const currentById = new Map(shifts.map((shift) => [shift.id, shift]));

    normalizedScannedShifts.forEach((normalizedScannedItem) => {
      if (matchesArchivedShift(normalizedScannedItem, archivedShifts)) {
        skippedArchivedCount += 1;
        return;
      }

      const currentValues = Array.from(currentById.values());
      const matchedShiftId = findMatchingShiftIdForScannedEmail(currentValues, normalizedScannedItem);

      if (matchedShiftId) {
        const existingShift = currentById.get(matchedShiftId);
        const registryEntry = findCalendarRegistryEntry(existingShift);
        const mergedShift = normalizeShift({
          ...mergeScannedShiftWithExisting(existingShift, normalizedScannedItem),
          googleCalendarEventId:
            existingShift.googleCalendarEventId || registryEntry?.googleCalendarEventId || '',
          googleCalendarEventLink:
            existingShift.googleCalendarEventLink || registryEntry?.googleCalendarEventLink || '',
          googleCalendarAddedAt:
            existingShift.googleCalendarAddedAt || registryEntry?.googleCalendarAddedAt || '',
        });

        currentById.set(matchedShiftId, mergedShift);
        authoritativeKeepIds.add(matchedShiftId);

        // Reconcile every active record that represents this same scanned assignment.
        // Keep the canonical matched record and preserve its Google Calendar linkage.
        Array.from(currentById.values())
          .filter(
            (candidateShift) =>
              candidateShift.id !== matchedShiftId &&
              isSafeScannedDuplicateForCleanup(candidateShift, normalizedScannedItem)
          )
          .forEach((duplicateShift) => {
            currentById.delete(duplicateShift.id);
            scannerReplacementIds.set(duplicateShift.id, matchedShiftId);
            reconciledDuplicateCount += 1;
          });

        if (hasShiftCalendarTimeChanged(existingShift, mergedShift)) {
          if (mergedShift.googleCalendarEventId) {
            calendarSyncRequests.set(mergedShift.googleCalendarEventId, {
              shiftId: matchedShiftId,
              shift: mergedShift,
            });
          } else if (mergedShift.googleCalendarEventLink) {
            calendarLinkWithoutIdCount += 1;
          }
        }

        if (normalizedScannedItem.id && normalizedScannedItem.id !== matchedShiftId) {
          const scannedWindowDuplicate = currentById.get(normalizedScannedItem.id);
          const duplicateMatchesScan =
            scannedWindowDuplicate &&
            shiftWindowsMatch(scannedWindowDuplicate, normalizedScannedItem) &&
            (areLikelyDuplicateShifts(scannedWindowDuplicate, normalizedScannedItem) ||
              getScannedShiftMatchScore(scannedWindowDuplicate, normalizedScannedItem) >= 4);

          if (duplicateMatchesScan) {
            currentById.delete(normalizedScannedItem.id);
            scannerReplacementIds.set(normalizedScannedItem.id, matchedShiftId);
            reconciledDuplicateCount += 1;
          }
        }

        updatedCount += 1;
        return;
      }

      const safeId = createUniqueScannedShiftId(currentById, normalizedScannedItem);
      if (safeId !== normalizedScannedItem.id) collisionSafeCount += 1;

      currentById.set(safeId, normalizeShift({ ...normalizedScannedItem, id: safeId }));
      authoritativeKeepIds.add(safeId);
      addedCount += 1;
    });

    /*
     * Wish ESS is authoritative for the upcoming schedule, but disappearance
     * from the list is not destructive. Keep unlisted future shifts and flag
     * them for review instead of deleting app records or calendar events.
     */
    if (wishEssImport) {
      const currentDate = new Date().toISOString().slice(0, 10);

      Array.from(currentById.entries()).forEach(([shiftId, candidateShift]) => {
        if (authoritativeKeepIds.has(shiftId)) return;
        if (!candidateShift.startDate || candidateShift.startDate < currentDate) return;

        const candidateStatus = normalizeShiftStatus(candidateShift.shiftStatus);
        if (candidateStatus === 'Done' || candidateStatus === 'Cancelled') return;

        currentById.set(
          shiftId,
          normalizeShift({
            ...candidateShift,
            wishEssStatus: 'not-listed',
            wishEssVerifiedAt: importedAt,
            wishEssSnapshotId,
          })
        );
        wishEssNotListedCount += 1;
      });

      try {
        localStorage.setItem(
          CSC_WISH_ESS_LATEST_STORAGE_KEY,
          JSON.stringify({
            id: wishEssSnapshotId,
            importedAt,
            source: 'Wish ESS Upcoming Schedules',
            rowCount: normalizedScannedShifts.length,
            shifts: normalizedScannedShifts,
          })
        );
      } catch (error) {
        console.error('Failed to save latest Wish ESS schedule snapshot:', error);
      }
    }

    const dedupeResult = dedupeShiftRecords(Array.from(currentById.values()));
    const removedDuplicateCount = dedupeResult.removedIds.length;

    dedupeResult.replacementIds.forEach((keptId, removedId) => {
      scannerReplacementIds.set(removedId, keptId);
    });

    // Repoint registry entries for scanner duplicates now. Authoritative stale
    // entries are removed after their Google Calendar deletion has been attempted.
    if (scannerReplacementIds.size) {
      const calendarRegistry = readCalendarRegistry();

      scannerReplacementIds.forEach((keptId, removedId) => {
        calendarRegistry.forEach((entry) => {
          if (
            entry.shiftId === removedId ||
            (entry.identityKeys || []).includes(`shift:${removedId}`)
          ) {
            entry.shiftId = keptId;
            entry.identityKeys = Array.from(
              new Set([
                ...(entry.identityKeys || []).filter(
                  (identityKey) => identityKey !== `shift:${removedId}`
                ),
                `shift:${keptId}`,
              ])
            );
          }
        });
      });

      writeCalendarRegistry(calendarRegistry);
    }

    let calendarCreatedCount = 0;
    let calendarUpdatedCount = 0;
    const calendarCreateFailures = [];
    const calendarUpdateFailures = [];

    setShifts(dedupeResult.shifts);

    setLocalSearch('');
    setExcludedVenues([]);
    setMonthFilter('All');
    setStatusFilter('All');
    setPaidFilter('All');
    setShowActiveOnly(true);
    setVisibleShiftLimit(Number.MAX_SAFE_INTEGER);
    setIsShiftTableCollapsed(false);

    setShiftEmailText('');
    setScannedShifts([]);
    setShowScanDrawer(false);

    const calendarCreateRequests = [];

    const needsCalendarLabel = calendarSyncRequests.size > 0;
    let calendarLabelReady = true;

    if (needsCalendarLabel) {
      try {
        await ensureCscGoogleCalendarLabel();
      } catch (error) {
        console.error('Failed to prepare the CSC Google Calendar background:', error);
        calendarLabelReady = false;
        const message = error?.message || 'Google Calendar background setup failed';
        if (calendarSyncRequests.size) calendarUpdateFailures.push(message);
      }
    }

    if (calendarLabelReady) {
      for (const [eventId, request] of calendarSyncRequests) {
        try {
          calendarAddLockRef.current.add(request.shiftId);
          setCalendarAddingShiftId(request.shiftId);

          const updatedEvent = await updateGoogleCalendarEvent(
            eventId,
            buildShiftCalendarEventPayload(request.shift)
          );
          const calendarFields = {
            googleCalendarEventId: updatedEvent?.id || eventId,
            googleCalendarEventLink:
              updatedEvent?.htmlLink || request.shift.googleCalendarEventLink || '',
            googleCalendarAddedAt:
              request.shift.googleCalendarAddedAt || new Date().toISOString(),
          };

          saveCalendarRegistryEntry(request.shift, calendarFields);
          setShifts((currentShifts) =>
            currentShifts.map((shift) =>
              shift.id === request.shiftId
                ? normalizeShift({ ...shift, ...calendarFields })
                : shift
            )
          );
          calendarUpdatedCount += 1;
        } catch (error) {
          console.error('Failed to update the linked Google Calendar event:', error);
          calendarUpdateFailures.push(error?.message || 'Unknown Google Calendar error');
        } finally {
          calendarAddLockRef.current.delete(request.shiftId);
          setCalendarAddingShiftId('');
        }
      }

      for (const replacementShift of calendarCreateRequests) {
        try {
          calendarAddLockRef.current.add(replacementShift.id);
          setCalendarAddingShiftId(replacementShift.id);

          const createdEvent = await createGoogleCalendarEvent(
            buildShiftCalendarEventPayload(replacementShift)
          );
          const calendarFields = {
            googleCalendarEventId: createdEvent?.id || '',
            googleCalendarEventLink: createdEvent?.htmlLink || '',
            googleCalendarAddedAt: new Date().toISOString(),
          };
          const savedShift = normalizeShift({ ...replacementShift, ...calendarFields });

          saveCalendarRegistryEntry(savedShift, calendarFields);
          setShifts((currentShifts) =>
            currentShifts.map((shift) =>
              shift.id === replacementShift.id
                ? normalizeShift({ ...shift, ...calendarFields })
                : shift
            )
          );
          calendarCreatedCount += 1;
        } catch (error) {
          console.error('Failed to add the replacement Google Calendar event:', error);
          calendarCreateFailures.push(error?.message || 'Unknown Google Calendar error');
        } finally {
          calendarAddLockRef.current.delete(replacementShift.id);
          setCalendarAddingShiftId('');
        }
      }
    }

    const details = [
      `Updated ${updatedCount}`,
      `added ${addedCount}`,
      calendarUpdatedCount
        ? `updated ${calendarUpdatedCount} Google Calendar event${calendarUpdatedCount === 1 ? '' : 's'}`
        : '',
      wishEssImport
        ? `Wish ESS confirmed ${authoritativeKeepIds.size} upcoming shift${authoritativeKeepIds.size === 1 ? '' : 's'}`
        : '',
      wishEssNotListedCount
        ? `flagged ${wishEssNotListedCount} future shift${wishEssNotListedCount === 1 ? '' : 's'} as not listed in the latest Wish ESS schedule`
        : '',
      removedDuplicateCount
        ? `removed ${removedDuplicateCount} duplicate${removedDuplicateCount === 1 ? '' : 's'}`
        : '',
      reconciledDuplicateCount
        ? `reconciled ${reconciledDuplicateCount} prior scan duplicate${reconciledDuplicateCount === 1 ? '' : 's'}`
        : '',
      skippedArchivedCount
        ? `kept ${skippedArchivedCount} completed shift${skippedArchivedCount === 1 ? '' : 's'} archived`
        : '',
      collisionSafeCount
        ? `prevented ${collisionSafeCount} ID collision${collisionSafeCount === 1 ? '' : 's'}`
        : '',
    ].filter(Boolean);

    const calendarWarnings = [
      calendarLinkWithoutIdCount
        ? `${calendarLinkWithoutIdCount} linked calendar event could not be updated because its Google event ID is missing`
        : '',
      calendarUpdateFailures.length
        ? `${calendarUpdateFailures.length} Google Calendar update${calendarUpdateFailures.length === 1 ? '' : 's'} failed: ${calendarUpdateFailures.join('; ')}`
        : '',
    ].filter(Boolean);

    setSaveMessage(
      `${wishEssImport ? 'Wish ESS reconciled safely' : 'CSC email imported as secondary data'}. ${details.join(', ')}.${
        calendarWarnings.length ? ` Calendar warning: ${calendarWarnings.join('. ')}.` : ''
      }`
    );
    setTimeout(() => setSaveMessage(''), calendarWarnings.length ? 10000 : 6500);
  };

  const handlePrintPremiumView = () => {
    window.print();
  };

  const handlePrintSection = (elementId, printTitle) => {
    const printTarget = document.getElementById(elementId);
    if (!printTarget) return;

    const previousTitle = document.title;
    const printAncestors = [];
    let printAncestor = printTarget.parentElement;

    while (printAncestor && printAncestor !== document.body) {
      printAncestor.classList.add('csc-print-ancestor');
      printAncestors.push(printAncestor);
      printAncestor = printAncestor.parentElement;
    }

    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      printTarget.classList.remove('csc-print-target');
      printAncestors.forEach((ancestor) => ancestor.classList.remove('csc-print-ancestor'));
      document.body.classList.remove('csc-section-printing');
      document.title = previousTitle;
      window.removeEventListener('afterprint', cleanup);
    };

    printTarget.classList.add('csc-print-target');
    document.body.classList.add('csc-section-printing');
    document.title = printTitle;
    window.addEventListener('afterprint', cleanup, { once: true });

    window.requestAnimationFrame(() => {
      window.print();
      window.setTimeout(cleanup, 1000);
    });
  };


  const handlePrintCalendarAudit = () => {
    if (!calendarAuditReport) return;

    const formatAuditShiftLine = (shift = {}) => {
      const title = shift.jobName || shift.event || shift.shiftName || shift.id || 'CSC Shift';
      const venue = shift.venue || 'Venue unknown';
      const date = formatShortDate(shift.startDate);
      const time = formatTime(shift.startTime);

      return {
        heading: `${date}${time ? ` ${time}` : ''} · ${venue}`,
        detail: title,
      };
    };

    const buildAuditShiftRows = (items = []) =>
      items.length
        ? items
            .map((shift) => {
              const line = formatAuditShiftLine(shift);
              return `<tr><td>${escapeHtml(line.heading)}</td><td>${escapeHtml(line.detail)}</td></tr>`;
            })
            .join('')
        : '<tr><td colspan="2" class="empty">None.</td></tr>';

    const buildAuditMatchedSnapshotRows = (items = []) =>
      items.length
        ? items
            .map(({ shift, event }) => {
              const line = formatAuditShiftLine(shift);
              return `<tr><td>${escapeHtml(line.heading)}</td><td>${escapeHtml(line.detail)}</td><td>${escapeHtml(
                event?.summary || event?.id || ''
              )}</td></tr>`;
            })
            .join('')
        : '<tr><td colspan="3" class="empty">None.</td></tr>';

    const extraCalendarEvents = [
      ...(calendarAuditReport.duplicateCalendarEvents || []),
      ...(calendarAuditReport.unlinkedCalendarEvents || []),
    ];

    const buildAuditCalendarRows = (items = []) =>
      items.length
        ? items
            .map(({ event, reason }) => {
              const start = event?.start?.dateTime || event?.start?.date || '';
              return `<tr><td>${escapeHtml(event?.summary || event?.id || 'CSC Calendar event')}</td><td>${escapeHtml(
                start
              )}</td><td>${escapeHtml(reason === 'duplicate' ? 'Likely duplicate' : 'No current CSC match')}</td></tr>`;
            })
            .join('')
        : '<tr><td colspan="3" class="empty">None.</td></tr>';

    const summaryCards = [
      ['Active stored', calendarAuditReport.counts.activeStored],
      ['Archived stored', calendarAuditReport.counts.archivedStored],
      ['Past Shifts badge', calendarAuditReport.counts.pastDrawer],
      ['Snapshot-only past', calendarAuditReport.counts.snapshotOnlyPast],
      ['CSC Calendar events', calendarAuditReport.counts.calendarEvents],
      ['Current shifts matched', calendarAuditReport.counts.matchedCurrent],
      ['Current missing Calendar', calendarAuditReport.counts.missingCurrent],
      ['Snapshot-only matched', calendarAuditReport.counts.snapshotCalendarSupported],
      ['Duplicate Calendar events', calendarAuditReport.counts.duplicateCalendarEvents],
      ['Unmatched Calendar events', calendarAuditReport.counts.unlinkedCalendarEvents],
      ['Active records in Past Shifts', calendarAuditReport.counts.activePastRecords],
      ['Cancelled stored', calendarAuditReport.counts.cancelledStored],
    ]
      .map(
        ([label, value]) =>
          `<div class="summary-card"><div class="summary-label">${escapeHtml(label)}</div><div class="summary-value">${escapeHtml(
            value
          )}</div></div>`
      )
      .join('');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setSaveMessage('Print window was blocked. Allow pop-ups for this site and try again.');
      window.setTimeout(() => setSaveMessage(''), 5000);
      return;
    }

    try {
      printWindow.opener = null;
    } catch (error) {
      console.warn('Could not clear audit print window opener:', error);
    }

    const auditHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>CSC Data vs Google Calendar Audit</title>
  <style>
    @page { size: portrait; margin: 0.45in; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; color: #0f172a; font-family: Arial, Helvetica, sans-serif; }
    body { font-size: 11px; line-height: 1.35; }
    h1, h2, p { margin: 0; }
    .report { width: 100%; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; }
    .header h1 { font-size: 21px; line-height: 1.15; }
    .subtitle { margin-top: 5px; font-size: 11px; font-weight: 700; color: #475569; }
    .range { margin-top: 3px; font-size: 10px; font-weight: 700; color: #64748b; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-bottom: 14px; }
    .summary-card { border: 1px solid #cbd5e1; border-radius: 7px; padding: 8px; break-inside: avoid; }
    .summary-label { font-size: 8px; font-weight: 800; text-transform: uppercase; color: #475569; }
    .summary-value { margin-top: 4px; font-size: 20px; line-height: 1; font-weight: 800; }
    .section { margin-top: 13px; break-inside: auto; }
    .section h2 { font-size: 13px; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 7px; vertical-align: top; word-wrap: break-word; }
    th { background: #f1f5f9; text-align: left; font-size: 9px; text-transform: uppercase; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    .empty { color: #047857; font-weight: 700; }
    .note { margin-top: 14px; border: 1px solid #bfdbfe; background: #eff6ff; padding: 9px; border-radius: 7px; font-weight: 700; break-inside: avoid; }
    @media print {
      html, body { width: auto !important; height: auto !important; overflow: visible !important; }
      .report { position: static !important; transform: none !important; }
    }
  </style>
</head>
<body>
  <main class="report">
    <header class="header">
      <h1>CSC Data vs Google Calendar Audit</h1>
      <p class="subtitle">Read-only comparison. No CSC data or Google Calendar events were changed.</p>
      <p class="range">Calendar range: ${escapeHtml(calendarAuditReport.rangeStart)} through ${escapeHtml(
        calendarAuditReport.rangeEnd
      )}</p>
    </header>

    <section class="summary-grid">${summaryCards}</section>

    <section class="section">
      <h2>Current CSC shifts missing from Calendar (${calendarAuditReport.missingCurrent.length})</h2>
      <table>
        <thead><tr><th style="width:42%">Shift</th><th>Event / Job</th></tr></thead>
        <tbody>${buildAuditShiftRows(calendarAuditReport.missingCurrent)}</tbody>
      </table>
    </section>

    <section class="section">
      <h2>Snapshot-only records supported by Calendar (${calendarAuditReport.matchedSnapshotOnly.length})</h2>
      <table>
        <thead><tr><th style="width:34%">Shift</th><th style="width:33%">Event / Job</th><th>Calendar Match</th></tr></thead>
        <tbody>${buildAuditMatchedSnapshotRows(calendarAuditReport.matchedSnapshotOnly)}</tbody>
      </table>
    </section>

    <section class="section">
      <h2>Snapshot-only records without Calendar support (${calendarAuditReport.unsupportedSnapshotOnly.length})</h2>
      <table>
        <thead><tr><th style="width:42%">Shift</th><th>Event / Job</th></tr></thead>
        <tbody>${buildAuditShiftRows(calendarAuditReport.unsupportedSnapshotOnly)}</tbody>
      </table>
    </section>

    <section class="section">
      <h2>Extra Calendar events (${extraCalendarEvents.length})</h2>
      <table>
        <thead><tr><th>Calendar Event</th><th style="width:29%">Start</th><th style="width:24%">Reason</th></tr></thead>
        <tbody>${buildAuditCalendarRows(extraCalendarEvents)}</tbody>
      </table>
    </section>

    <div class="note">
      The Past Shifts badge currently counts archived records, qualifying active past/Done/Cancelled records, and snapshot-only historical records. Use this audit to determine whether snapshot-only records are corroborated by Google Calendar before changing the badge logic or restoring records.
    </div>
  </main>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(auditHtml);
    printWindow.document.close();

    const triggerAuditPrint = () => {
      if (printWindow.closed) return;

      try {
        printWindow.focus();
        printWindow.print();
      } catch (error) {
        console.error('CSC audit print failed:', error);
      }
    };

    if (printWindow.document.readyState === 'complete') {
      window.setTimeout(triggerAuditPrint, 150);
    } else {
      printWindow.addEventListener('load', () => {
        window.setTimeout(triggerAuditPrint, 150);
      }, { once: true });
    }
  };

  const handlePrintSelectedAiMonthSchedule = () => {
    if (!selectedAiPrintMonth) {
      setSaveMessage('Select a specific month before printing the month schedule.');
      window.setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    handlePrintSection(
      'csc-ai-month-schedule-print',
      `CSC Schedule - ${selectedAiPrintMonth.label}`
    );
  };

  const handleDownloadPremiumView = () => {
    const html = buildPremiumScheduleHtml(filteredShifts, summary);
    const dataBlob = new Blob([html], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'CSC_Shifts_List_2026.html';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    setSaveMessage('CSC shifts list downloaded.');
    setTimeout(() => setSaveMessage(''), 2500);
  };

  const selectedDetailShift = selectedDetailShiftId
    ? shifts.find((shift) => shift.id === selectedDetailShiftId) || archivedShifts.find((shift) => shift.id === selectedDetailShiftId)
    : null;
  const selectedDetailShiftRoleFields = getShiftRoleDisplayFields(selectedDetailShift || {});
  const selectedDetailShiftPayDate = selectedDetailShift
    ? getCscPayDate(selectedDetailShift)
    : '';
  const selectedDetailShiftIsArchived = Boolean(
    selectedDetailShiftId && archivedShifts.some((shift) => shift.id === selectedDetailShiftId)
  );

  const renderShiftActions = (shift) => {
    const linkedRide = getLinkedRideForShift(shift);
    const matchingPaycheckCount = getPaychecksMatchingShift(shift, paychecks).length;
    const calendarAdded = isShiftCalendarVerified(shift);
    const calendarBusy = calendarAddingShiftId === shift.id;

    return (
    <div className="csc-shift-actions w-full sm:w-[154px] sm:max-w-[154px]">
      <div className="grid gap-1.5">
        <div className="grid grid-cols-[minmax(0,1fr)_38px] gap-1.5 sm:grid-cols-[110px_34px]">
          <select
            value={shift.shiftStatus}
            onChange={(event) => handleShiftStatusChange(shift, event.target.value)}
            className={`h-[30px] w-full rounded px-2 py-1 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-yellow-300 sm:w-[110px] ${getShiftStatusColorClass(shift.shiftStatus)}`}
            title="Update shift status"
            aria-label="Update shift status"
          >
            {SHIFT_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status} style={getShiftStatusOptionStyle(status)}>
                {status}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => handleArchiveShift(shift.id)}
            className="inline-flex h-[30px] w-full items-center justify-center rounded bg-purple-600 text-white hover:bg-purple-700 sm:w-[34px]"
            aria-label="Archive shift"
            title="Archive shift"
          >
            <Archive className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-[34px_42px_34px]">
          <button
            type="button"
            onClick={() => handleDeleteShift(shift.id)}
            className="inline-flex h-[30px] w-full items-center justify-center rounded bg-red-600 text-white hover:bg-red-700 sm:w-[34px]"
            aria-label="Delete shift"
            title="Delete shift"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleClearShiftNotes(shift.id)}
            className="inline-flex h-[30px] w-full items-center justify-center rounded bg-slate-400 text-xs font-semibold text-white hover:bg-slate-500 sm:w-[42px]"
            title="Clear shift notes"
            aria-label="Clear shift notes"
          >
            Clr
          </button>
          <button
            type="button"
            onClick={() => handleAddShiftToCalendar(shift)}
            disabled={calendarBusy}
            className={`inline-flex h-[30px] w-full items-center justify-center rounded text-white disabled:cursor-wait sm:w-[34px] ${
              calendarAdded
                ? 'bg-[#8E24AA] ring-2 ring-[#E1BEE7] hover:bg-[#7B1FA2]'
                : calendarBusy
                  ? 'bg-[#CE93D8]'
                  : 'bg-[#8E24AA] hover:bg-[#7B1FA2]'
            }`}
            aria-label={calendarAdded ? 'Open this shift in Google Calendar' : 'Add shift to Google Calendar'}
            title={calendarAdded ? 'Open in Google Calendar' : calendarBusy ? 'Adding to Google Calendar' : 'Add to Google Calendar'}
          >
            {calendarAdded ? <CheckCircle2 className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-[58px_34px_34px]">
          <button
            type="button"
            onClick={() => handleMoveShift(shift.id)}
            className="inline-flex h-[30px] w-full items-center justify-center rounded bg-amber-600 text-xs font-semibold text-white hover:bg-amber-700 sm:w-[58px]"
            title="Change shift venue"
            aria-label="Change shift venue"
          >
            Move
          </button>
          <button
            type="button"
            onClick={() => handleOpenShiftDetails(shift)}
            className="inline-flex h-[30px] w-full items-center justify-center rounded bg-cyan-700 text-white hover:bg-cyan-800 sm:w-[34px]"
            aria-label="Open shift detail drawer"
            title="Open shift detail drawer"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleOpenEditShift(shift)}
            className="inline-flex h-[30px] w-full items-center justify-center rounded bg-slate-700 text-white hover:bg-slate-800 sm:w-[34px]"
            aria-label="Edit shift"
            title="Edit shift"
          >
            <Edit3 className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => handlePlanOrOpenRide(shift)}
            className="inline-flex h-[30px] items-center justify-center gap-1 rounded bg-sky-700 px-2 text-[11px] font-extrabold text-white hover:bg-sky-800"
            title={linkedRide ? 'Open linked ride' : 'Plan a ride for this shift'}
            aria-label={linkedRide ? 'Open linked ride' : 'Plan a ride for this shift'}
          >
            <Car className="h-3.5 w-3.5" />
            {linkedRide ? 'Ride' : 'Plan Ride'}
          </button>
          <button
            type="button"
            onClick={handleOpenPaychecks}
            className="inline-flex h-[30px] items-center justify-center gap-1 rounded bg-amber-700 px-2 text-[11px] font-extrabold text-white hover:bg-amber-800"
            title="Open paychecks"
            aria-label="Open paychecks"
          >
            <DollarSign className="h-3.5 w-3.5" />
            Pay ({matchingPaycheckCount})
          </button>
        </div>
      </div>
      {movingShiftId === shift.id && (
        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2">
          <label className="block text-[11px] font-bold uppercase tracking-wide text-amber-900">Move to venue</label>
          <select
            value={shift.venue || ''}
            onChange={(event) => moveShiftToVenue(shift.id, event.target.value)}
            title="Select a new shift venue"
            className="mt-1 w-full rounded border border-amber-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900"
          >
            {venueOptions.filter((venue) => venue !== 'All').map((venue) => (
              <option key={venue} value={venue}>
                {venue}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
    );
  };

  const renderShiftDetailActions = (shift) => {
    const linkedRide = getLinkedRideForShift(shift);
    const matchingPaycheckCount = getPaychecksMatchingShift(shift, paychecks).length;
    const calendarAdded = isShiftCalendarVerified(shift);
    const calendarBusy = calendarAddingShiftId === shift.id;

    return (
      <div className="w-full">
        <div className="grid gap-3 md:grid-cols-[minmax(150px,0.8fr)_minmax(0,2fr)_minmax(180px,1.1fr)]">
          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-700">
              Shift Status
            </p>
            <select
              value={shift.shiftStatus}
              onChange={(event) => handleShiftStatusChange(shift, event.target.value)}
              className={`h-10 w-full rounded-lg px-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-yellow-300 ${getShiftStatusColorClass(shift.shiftStatus)}`}
              title="Update shift status"
              aria-label="Update shift status"
            >
              {SHIFT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status} style={getShiftStatusOptionStyle(status)}>
                  {status}
                </option>
              ))}
            </select>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-700">
              Shift Actions
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenEditShift(shift)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-white hover:bg-slate-800"
                aria-label="Edit shift"
                title="Edit shift"
              >
                <Edit3 className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => handleMoveShift(shift.id)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-600 text-white hover:bg-amber-700"
                title="Change shift venue"
                aria-label="Change shift venue"
              >
                <GripVertical className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => handleAddShiftToCalendar(shift)}
                disabled={calendarBusy}
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white disabled:cursor-wait ${
                  calendarAdded
                    ? 'bg-green-700 ring-2 ring-green-200 hover:bg-green-800'
                    : calendarBusy
                      ? 'bg-emerald-400'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
                aria-label={calendarAdded ? 'Open this shift in Google Calendar' : 'Add shift to Google Calendar'}
                title={calendarAdded ? 'Open in Google Calendar' : calendarBusy ? 'Adding to Google Calendar' : 'Add to Google Calendar'}
              >
                {calendarAdded ? <CheckCircle2 className="h-5 w-5" /> : <CalendarPlus className="h-5 w-5" />}
              </button>
              <button
                type="button"
                onClick={() => handlePlanOrOpenRide(shift)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-700 text-white hover:bg-sky-800"
                title={linkedRide ? 'Open linked ride' : 'Plan a ride for this shift'}
                aria-label={linkedRide ? 'Open linked ride' : 'Plan a ride for this shift'}
              >
                <Car className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleOpenPaychecks}
                className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-700 text-white hover:bg-amber-800"
                title={`Open paychecks${matchingPaycheckCount ? `, ${matchingPaycheckCount} matching` : ''}`}
                aria-label={`Open paychecks${matchingPaycheckCount ? `, ${matchingPaycheckCount} matching` : ''}`}
              >
                <DollarSign className="h-5 w-5" />
                {matchingPaycheckCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-black leading-[18px] text-amber-900 shadow">
                    {matchingPaycheckCount}
                  </span>
                ) : null}
              </button>
              {(shift.linkedOpportunityId || shift.createdFromOpportunityId) ? (
                <button
                  type="button"
                  onClick={() => handleOpenLinkedOpportunity(shift)}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-700 text-white hover:bg-violet-800"
                  title="Open linked CSC opportunity"
                  aria-label="Open linked CSC opportunity"
                >
                  <ExternalLink className="h-5 w-5" />
                </button>
              ) : null}
              {shift.address ? (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shift.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white hover:bg-blue-800"
                  title="Open directions to this shift"
                  aria-label="Open directions to this shift"
                >
                  <MapPin className="h-5 w-5" />
                </a>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-700">
              Record Actions
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleArchiveShift(shift.id)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-600 text-white hover:bg-purple-700"
                aria-label="Archive shift"
                title="Archive shift"
              >
                <Archive className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => handleClearShiftNotes(shift.id)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-400 text-white hover:bg-slate-500"
                title="Clear shift notes"
                aria-label="Clear shift notes"
              >
                <Eraser className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteShift(shift.id)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white hover:bg-red-700"
                aria-label="Delete shift"
                title="Delete shift"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </section>
        </div>

        {movingShiftId === shift.id && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <label className="block text-[11px] font-extrabold uppercase tracking-wide text-amber-900">
              Move to Venue
            </label>
            <select
              value={shift.venue || ''}
              onChange={(event) => moveShiftToVenue(shift.id, event.target.value)}
              title="Select a new shift venue"
              className="mt-2 h-10 w-full rounded-lg border border-amber-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              {venueOptions.filter((venue) => venue !== 'All').map((venue) => (
                <option key={venue} value={venue}>
                  {venue}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  };


  const renderArchivedShiftDetailActions = (shift) => {
    const matchingPaycheckCount = getPaychecksMatchingShift(shift, paychecks).length;

    return (
      <div className="w-full">
        {shift.shiftStatus !== 'Cancelled' ? (
          <div className="mb-3">
            {renderArchivedPaidControls(shift)}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedDetailShiftId(null);
              handleOpenEditShift(shift, 'archived');
            }}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-700 px-3 text-sm font-extrabold text-white hover:bg-slate-800"
            aria-label="Edit archived shift"
            title="Edit archived shift"
          >
            <Edit3 className="h-4 w-4" />
            Edit
          </button>

          <button
            type="button"
            onClick={handleOpenPaychecks}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-amber-700 px-3 text-sm font-extrabold text-white hover:bg-amber-800"
            title={`Open paychecks${matchingPaycheckCount ? `, ${matchingPaycheckCount} matching` : ''}`}
            aria-label={`Open paychecks${matchingPaycheckCount ? `, ${matchingPaycheckCount} matching` : ''}`}
          >
            <DollarSign className="h-4 w-4" />
            Pay ({matchingPaycheckCount})
          </button>

          {(shift.linkedOpportunityId || shift.createdFromOpportunityId) ? (
            <button
              type="button"
              onClick={() => handleOpenLinkedOpportunity(shift)}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-violet-700 px-3 text-sm font-extrabold text-white hover:bg-violet-800"
              aria-label="Open linked CSC opportunity"
              title="Open linked CSC opportunity"
            >
              <ExternalLink className="h-4 w-4" />
              Opportunity
            </button>
          ) : null}

          {shift.address ? (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shift.address)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 text-sm font-extrabold text-white hover:bg-blue-800"
              title="Open directions to this shift"
              aria-label="Open directions to this shift"
            >
              <MapPin className="h-4 w-4" />
              Directions
            </a>
          ) : null}

          <button
            type="button"
            onClick={() => handleRestoreArchivedShift(shift.id)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 text-sm font-extrabold text-white hover:bg-emerald-800"
            aria-label="Unarchive shift"
            title="Unarchive shift"
          >
            <RotateCcw className="h-4 w-4" />
            Unarchive
          </button>

          <button
            type="button"
            onClick={() => handleDeleteArchivedShift(shift.id)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-sm font-extrabold text-white hover:bg-red-700"
            aria-label="Delete archived shift"
            title="Delete archived shift"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>
    );
  };

  const renderMobileShiftCard = (shift, index) => (
    <article
      key={shift.id}
      className={`overflow-hidden rounded-xl border border-slate-300 shadow-sm ${
        index % 2 === 0 ? 'bg-white' : 'bg-blue-50'
      }`}
    >
      <div className="border-b border-amber-300 bg-amber-200 px-3 py-2.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="break-words text-base font-black text-slate-950">{shift.venue || 'CSC Shift'}</h3>
            <p className="csc-title-wrap mt-0.5 text-sm font-bold text-slate-700">{shift.event || shift.jobName || 'Event not entered'}</p>
          </div>
          <span className="shrink-0 rounded-full bg-blue-100 px-2 py-1 text-[11px] font-black text-blue-900">
            {shift.shiftStatus}
          </span>
        </div>
      </div>

      <div className="space-y-2 p-2.5">
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm text-slate-700">
          <p className="font-black text-slate-950">Location</p>
          <p className="mt-0.5 break-words">{shift.address || 'Address not shown'}</p>
          <p className="break-words">{shift.city || 'City not entered'}</p>
        </section>

        <section className="space-y-1 text-sm text-slate-700">
          {shouldShowDistinctJobName(shift) ? <p className="csc-title-wrap"><span className="font-black text-slate-900">Job:</span> {shift.jobName}</p> : null}
          {shift.shiftName ? <p className="csc-title-wrap"><span className="font-black text-slate-900">Shift Name:</span> {shift.shiftName}</p> : null}
          {shift.roleName ? <p className="csc-title-wrap"><span className="font-black text-slate-900">Role Name:</span> {shift.roleName}</p> : null}
          {shift.uniform ? <p className="break-words"><span className="font-black text-slate-900">Uniform:</span> {shift.uniform}</p> : null}
        </section>

        <section className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-blue-700">Start</p>
            <p className="mt-1 text-sm font-black text-slate-950">{formatDate(shift.startDate)}</p>
            <p className="text-sm font-bold text-blue-700">{formatTime(shift.startTime)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-800">Finish</p>
            <p className="mt-1 text-sm font-black text-slate-950">{formatDate(shift.finishDate)}</p>
            <p className="text-sm font-bold text-slate-700">{formatTime(shift.finishTime)}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Hours / Rate</p>
            <p className="mt-1 text-sm font-black text-slate-950">{getShiftHours(shift).toFixed(1)} hrs</p>
            <p className="text-xs font-bold text-emerald-800">{getShiftHourlyRateLabel(shift)} per hour</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">
              {hasReconciledPaycheck(shift) ? 'Actual Gross Pay' : 'Estimated Pay'}
            </p>
            <p className="mt-1 text-base font-black text-amber-950">
              {formatCurrency(hasReconciledPaycheck(shift) ? getShiftActualGrossPay(shift) : getEstimatedPay(shift))}
            </p>
            <p className="text-xs font-bold text-amber-800">
              {hasReconciledPaycheck(shift)
                ? `Net ${formatCurrency(getShiftActualNetPay(shift))}`
                : getShiftPaymentStatusLabel(shift)}
            </p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-700">
          <p className={getShiftCalendarStatusClass(shift)}>
            <span className="font-black text-slate-900">Calendar:</span>{' '}
            {getShiftCalendarStatusLabel(shift)}
          </p>
          <p><span className="font-black text-slate-900">Pay Date:</span> {getCscPayDate(shift) ? formatPayDate(getCscPayDate(shift)) : 'Not set'}</p>
          {hasReconciledPaycheck(shift) ? (
            <p className="col-span-2"><span className="font-black text-slate-900">Paycheck:</span> #{shift.reconciledCheckNumber || 'Linked'}</p>
          ) : null}
          {shift.supervisor ? <p className="col-span-2 break-words"><span className="font-black text-slate-900">Supervisor:</span> {shift.supervisor}</p> : null}
          {shift.parking ? <p className="col-span-2 break-words"><span className="font-black text-slate-900">Parking:</span> {shift.parking}</p> : null}
        </section>

      </div>

      <div className={`border-t border-slate-200 p-2.5 ${index % 2 === 0 ? 'bg-slate-50' : 'bg-blue-50'}`}>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-slate-700">Shift Actions</p>
        {renderShiftActions(shift)}
      </div>
    </article>
  );

  return (
    <PageContainer surfaceClassName="csc-shifts-page min-h-screen bg-amber-50">
      <style>{`
        .csc-shifts-page input::placeholder,
        .csc-shifts-page textarea::placeholder {
          color: #475569;
          opacity: 1;
        }

        .csc-title-wrap {
          min-width: 0;
          max-width: 100%;
          white-space: normal !important;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .csc-shift-filter-grid {
          display: grid;
          width: 100%;
          grid-template-columns:
            minmax(0, 1.22fr)
            minmax(0, 1.08fr)
            minmax(0, 0.82fr)
            minmax(0, 1fr)
            minmax(0, 1.35fr);
          align-items: stretch;
          gap: 0.5rem;
        }

        .csc-shift-filter-venue {
          width: 100%;
          min-width: 0;
        }

        .csc-shift-filter-month {
          width: 100%;
          min-width: 0;
        }

        .csc-shift-filter-status {
          width: 100%;
          min-width: 0;
        }

        .csc-shift-filter-month-button {
          width: 100%;
          min-width: 0;
          justify-content: center;
        }

        .csc-shift-filter-search {
          width: 100%;
          min-width: 0;
          flex: none;
        }

        .csc-shift-filter-search input {
          width: 100%;
          min-width: 0;
        }

        @media (min-width: 640px) {
          .csc-shift-actions > .grid {
            filter: saturate(0.38);
            opacity: 1;
            transition: filter 160ms ease, opacity 160ms ease;
          }

          .csc-shift-actions:hover > .grid,
          .csc-shift-actions:focus-within > .grid {
            filter: saturate(1);
            opacity: 1;
          }
        }

        @media (max-width: 639px) {
          .csc-monthly-report,
          .csc-monthly-report *,
          .csc-premium-print,
          .csc-premium-print *,
          #csc-shift-details-print,
          #csc-shift-details-print *,
          #csc-shift-archive-print,
          #csc-shift-archive-print * {
            min-width: 0;
            overflow-wrap: anywhere;
          }

          .csc-premium-shift-row {
            grid-template-columns: 90px minmax(0, 1fr) !important;
            gap: 0.5rem !important;
          }

          .csc-shift-browser {
            padding: 0.625rem;
            border-radius: 1rem;
          }

          .csc-shift-filter-grid {
            display: grid;
            width: 100%;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.375rem;
          }

          .csc-shift-filter-control {
            width: 100%;
            min-width: 0;
            height: 2.25rem;
            padding-left: 0.5rem;
            padding-right: 1.5rem;
            font-size: 0.6875rem;
          }

          .csc-shift-filter-venue,
          .csc-shift-filter-month,
          .csc-shift-filter-status {
            width: 100%;
            min-width: 0;
          }

          .csc-shift-filter-month-button {
            width: 2.25rem;
            min-width: 2.25rem;
            height: 2.25rem;
            justify-content: center;
            padding: 0;
          }

          .csc-shift-month-label {
            display: none;
          }

          .csc-shift-filter-search {
            grid-column: 2 / -1;
            width: 100%;
            min-width: 0;
            flex: none;
          }

          .csc-shift-filter-search input {
            width: 100%;
            height: 2.25rem;
          }
        }

        @media print {
          @page { margin: 0.3in; }
          @page csc-monthly-report-page { size: letter landscape; margin: 0.32in; }
          @page csc-ai-overview-page { size: letter portrait; margin: 0.22in; }
          @page csc-ai-month-schedule-page { size: letter portrait; margin: 0.32in; }
          html,
          body,
          body.csc-section-printing,
          body.csc-section-printing .csc-print-target,
          body.csc-section-printing .csc-print-target * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html,
          body,
          body.csc-section-printing {
            width: 100% !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          body.csc-section-printing * { visibility: hidden !important; }
          body.csc-section-printing .csc-print-ancestor,
          body.csc-section-printing .csc-print-ancestor > .csc-print-ancestor,
          body.csc-section-printing .csc-print-target,
          body.csc-section-printing .csc-print-target * { visibility: visible !important; }
          body.csc-section-printing .csc-print-ancestor {
            position: static !important;
            inset: auto !important;
            display: block !important;
            width: auto !important;
            max-width: none !important;
            height: auto !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: transparent !important;
          }
          body.csc-section-printing .csc-print-ancestor > *:not(.csc-print-ancestor):not(.csc-print-target) {
            display: none !important;
          }
          body.csc-section-printing .csc-print-target {
            position: static !important;
            display: block !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          body.csc-section-printing .csc-print-target .csc-print-scroll {
            display: block !important;
            flex: none !important;
            height: auto !important;
            max-height: none !important;
            padding: 0 !important;
            overflow: visible !important;
            background: white !important;
          }
          body.csc-section-printing .csc-print-target article {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          body.csc-section-printing #csc-worked-week-print {
            font-size: 12px !important;
            line-height: 1.25 !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-header {
            display: flex !important;
            flex-direction: row !important;
            align-items: flex-start !important;
            justify-content: space-between !important;
            gap: 6px !important;
            padding: 0 0 6px !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-header h2 {
            font-size: 22px !important;
            line-height: 1.1 !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-header p {
            margin-top: 3px !important;
            font-size: 11px !important;
            line-height: 1.2 !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-summary {
            padding: 6px 0 !important;
            background: white !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-summary > div {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 6px !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-summary > div > div {
            grid-column: auto !important;
            min-height: 0 !important;
            padding: 8px 10px !important;
            border-radius: 7px !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-summary p:first-child {
            font-size: 9px !important;
            line-height: 1 !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-summary p:last-child {
            margin-top: 4px !important;
            font-size: 18px !important;
            line-height: 1 !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-print-scroll {
            padding: 6px 0 0 !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-list {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-card {
            padding: 10px 11px !important;
            border-radius: 8px !important;
            box-shadow: none !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-card h3 {
            font-size: 17px !important;
            line-height: 1.1 !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-card h3 + p {
            margin-top: 3px !important;
            font-size: 12px !important;
            line-height: 1.15 !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-card h3 + p + p {
            margin-top: 3px !important;
            font-size: 11px !important;
            line-height: 1.15 !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-card span.rounded-full {
            padding: 3px 6px !important;
            font-size: 8px !important;
            line-height: 1 !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-fields {
            margin-top: 8px !important;
            gap: 0 !important;
            font-size: 11px !important;
            line-height: 1.2 !important;
          }
          body.csc-section-printing #csc-worked-week-print .csc-worked-week-fields > div {
            grid-template-columns: 70px minmax(0, 1fr) !important;
            gap: 6px !important;
            padding-top: 5px !important;
          }
          body.csc-section-printing .csc-monthly-report {
            page: csc-monthly-report-page;
            width: 100% !important;
            max-width: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          body.csc-section-printing .csc-monthly-report-header {
            padding-bottom: 10px !important;
            border-bottom-width: 3px !important;
          }
          body.csc-section-printing .csc-monthly-report-header > p:first-child {
            font-size: 12px !important;
            letter-spacing: 0.22em !important;
          }
          body.csc-section-printing .csc-monthly-report-header h1 {
            margin-top: 4px !important;
            font-size: 30px !important;
            line-height: 1.1 !important;
          }
          body.csc-section-printing .csc-monthly-report-header h1 + p {
            margin-top: 4px !important;
            font-size: 20px !important;
            line-height: 1.1 !important;
          }
          body.csc-section-printing .csc-monthly-report-header p:last-child {
            margin-top: 5px !important;
            font-size: 12px !important;
          }
          body.csc-section-printing .csc-monthly-summary {
            display: grid !important;
            grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
            gap: 6px !important;
            margin-top: 10px !important;
          }
          body.csc-section-printing .csc-monthly-summary > div {
            min-width: 0 !important;
            min-height: 54px !important;
            padding: 8px !important;
            border-radius: 9px !important;
          }
          body.csc-section-printing .csc-monthly-summary > div > p:first-child {
            font-size: 9px !important;
            line-height: 1.15 !important;
            overflow-wrap: normal !important;
          }
          body.csc-section-printing .csc-monthly-summary > div > p:last-child {
            margin-top: 5px !important;
            font-size: 20px !important;
            line-height: 1 !important;
            white-space: nowrap !important;
          }
          body.csc-section-printing .csc-monthly-status-strip {
            margin-top: 7px !important;
            gap: 3px 14px !important;
            padding: 5px 9px !important;
            font-size: 10px !important;
            line-height: 1.2 !important;
          }
          body.csc-section-printing .csc-monthly-paychecks {
            margin-top: 9px !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          body.csc-section-printing .csc-monthly-paychecks > div:first-child {
            padding: 6px 10px !important;
          }
          body.csc-section-printing .csc-monthly-paychecks > div:first-child h2 {
            font-size: 12px !important;
          }
          body.csc-section-printing .csc-monthly-weeks {
            margin-top: 12px !important;
          }
          body.csc-section-printing .csc-monthly-week {
            margin-top: 12px !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
            border-radius: 9px !important;
          }
          body.csc-section-printing .csc-monthly-week:first-child {
            margin-top: 0 !important;
          }
          body.csc-section-printing .csc-monthly-week-header {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 10px !important;
            padding: 8px 11px !important;
            color: white !important;
            background: #020617 !important;
            break-inside: avoid !important;
            break-after: avoid !important;
            page-break-inside: avoid !important;
            page-break-after: avoid !important;
          }
          body.csc-section-printing .csc-monthly-week-header h2 {
            font-size: 16px !important;
            line-height: 1.1 !important;
          }
          body.csc-section-printing .csc-monthly-week-header > div:last-child {
            display: grid !important;
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
            min-width: 55% !important;
            gap: 12px !important;
            font-size: 10px !important;
          }
          body.csc-section-printing .csc-monthly-week-header > div:last-child > div {
            grid-column: auto !important;
          }
          body.csc-section-printing .csc-monthly-week-header > div:last-child p:last-child {
            margin-top: 2px !important;
            font-size: 14px !important;
            line-height: 1 !important;
          }
          body.csc-section-printing .csc-monthly-week-table {
            display: block !important;
            overflow: visible !important;
          }
          body.csc-section-printing .csc-monthly-report table {
            width: 100% !important;
            table-layout: fixed !important;
          }
          body.csc-section-printing .csc-monthly-report thead {
            display: table-header-group !important;
          }
          body.csc-section-printing .csc-monthly-report tfoot {
            display: table-row-group !important;
          }
          body.csc-section-printing .csc-monthly-report tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          body.csc-section-printing .csc-monthly-report th:nth-child(1),
          body.csc-section-printing .csc-monthly-report td:nth-child(1) {
            width: 14% !important;
          }
          body.csc-section-printing .csc-monthly-report th:nth-child(2),
          body.csc-section-printing .csc-monthly-report td:nth-child(2) {
            width: 21% !important;
          }
          body.csc-section-printing .csc-monthly-report th:nth-child(3),
          body.csc-section-printing .csc-monthly-report td:nth-child(3) {
            width: 17% !important;
          }
          body.csc-section-printing .csc-monthly-report th:nth-child(4),
          body.csc-section-printing .csc-monthly-report td:nth-child(4) {
            width: 14% !important;
          }
          body.csc-section-printing .csc-monthly-report th:nth-child(5),
          body.csc-section-printing .csc-monthly-report td:nth-child(5) {
            width: 7% !important;
          }
          body.csc-section-printing .csc-monthly-report th:nth-child(6),
          body.csc-section-printing .csc-monthly-report td:nth-child(6) {
            width: 10% !important;
          }
          body.csc-section-printing .csc-monthly-report th:nth-child(7),
          body.csc-section-printing .csc-monthly-report td:nth-child(7) {
            width: 8% !important;
          }
          body.csc-section-printing .csc-monthly-report th:nth-child(8),
          body.csc-section-printing .csc-monthly-report td:nth-child(8) {
            width: 9% !important;
          }
          body.csc-section-printing .csc-monthly-report table.csc-paycheck-reconciliation th:nth-child(1),
          body.csc-section-printing .csc-monthly-report table.csc-paycheck-reconciliation td:nth-child(1) {
            width: 34% !important;
          }
          body.csc-section-printing .csc-monthly-report table.csc-paycheck-reconciliation th:nth-child(2),
          body.csc-section-printing .csc-monthly-report table.csc-paycheck-reconciliation td:nth-child(2) {
            width: 22% !important;
          }
          body.csc-section-printing .csc-monthly-report table.csc-paycheck-reconciliation th:nth-child(3),
          body.csc-section-printing .csc-monthly-report table.csc-paycheck-reconciliation td:nth-child(3),
          body.csc-section-printing .csc-monthly-report table.csc-paycheck-reconciliation th:nth-child(4),
          body.csc-section-printing .csc-monthly-report table.csc-paycheck-reconciliation td:nth-child(4) {
            width: 22% !important;
          }
          body.csc-section-printing .csc-monthly-report th,
          body.csc-section-printing .csc-monthly-report td {
            padding: 4px 6px !important;
            font-size: 11px !important;
            line-height: 1.2 !important;
            overflow-wrap: anywhere !important;
          }
          body.csc-section-printing .csc-monthly-report th {
            font-size: 9px !important;
          }
          body.csc-section-printing .csc-monthly-footer {
            margin-top: 12px !important;
            padding-top: 7px !important;
            font-size: 9px !important;
          }

          /* AI Overview: compact portrait printing. */
          body.csc-section-printing #csc-ai-overview-print {
            page: csc-ai-overview-page;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 11px !important;
            line-height: 1.15 !important;
            box-shadow: none !important;
          }
          body.csc-section-printing #csc-ai-overview-print > section {
            margin-top: 4px !important;
            padding: 5px !important;
            border-radius: 5px !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }
          body.csc-section-printing #csc-ai-overview-print > section:first-child {
            margin-top: 0 !important;
          }
          body.csc-section-printing #csc-ai-overview-print > section.grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 4px !important;
          }
          body.csc-section-printing #csc-ai-overview-print article {
            padding: 5px !important;
            border-radius: 5px !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }
          body.csc-section-printing #csc-ai-overview-print h1 {
            margin-top: 1px !important;
            font-size: 15pt !important;
            line-height: 1 !important;
          }
          body.csc-section-printing #csc-ai-overview-print h2 {
            margin-top: 1px !important;
            font-size: 16px !important;
            line-height: 1.08 !important;
          }
          body.csc-section-printing #csc-ai-overview-print h3 {
            font-size: 13px !important;
            line-height: 1.08 !important;
          }
          body.csc-section-printing #csc-ai-overview-print p,
          body.csc-section-printing #csc-ai-overview-print dt,
          body.csc-section-printing #csc-ai-overview-print dd,
          body.csc-section-printing #csc-ai-overview-print span {
            font-size: 11px !important;
            line-height: 1.15 !important;
          }
          body.csc-section-printing #csc-ai-overview-print .mt-5,
          body.csc-section-printing #csc-ai-overview-print .mt-4,
          body.csc-section-printing #csc-ai-overview-print .mt-3 {
            margin-top: 3px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .mt-2,
          body.csc-section-printing #csc-ai-overview-print .mt-1 {
            margin-top: 1px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .gap-4,
          body.csc-section-printing #csc-ai-overview-print .gap-3,
          body.csc-section-printing #csc-ai-overview-print .gap-2 {
            gap: 3px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .rounded-xl {
            border-radius: 4px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .p-4,
          body.csc-section-printing #csc-ai-overview-print .p-3 {
            padding: 4px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .p-2 {
            padding: 3px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-summary-grid {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 3px !important;
            margin-top: 4px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-summary-grid > div {
            min-height: 0 !important;
            padding: 4px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-summary-grid > div > p:first-child {
            font-size: 17px !important;
            line-height: 1 !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-summary-grid > div > p:last-child {
            margin-top: 2px !important;
            font-size: 9px !important;
            line-height: 1.08 !important;
            letter-spacing: 0 !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-week-stats {
            margin-top: 3px !important;
            gap: 3px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-venue-table-wrap {
            margin-top: 2px !important;
            overflow: visible !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-venue-table {
            min-width: 0 !important;
            table-layout: fixed !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-venue-table th,
          body.csc-section-printing #csc-ai-overview-print .csc-ai-venue-table td {
            padding: 3px 4px !important;
            font-size: 11px !important;
            line-height: 1.12 !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-venue-table th {
            font-size: 9px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-monthly-grid {
            margin-top: 3px !important;
            gap: 3px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-month-block {
            padding: 4px !important;
            break-inside: auto !important;
            page-break-inside: auto !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-month-block > div:first-child {
            padding-bottom: 2px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-month-shift-row {
            display: grid !important;
            grid-template-columns: 64px 126px 100px minmax(0, 1fr) 40px !important;
            gap: 4px !important;
            padding: 2px 0 !important;
            font-size: 11px !important;
            line-height: 1.12 !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-month-shift-row > div:nth-child(2) {
            white-space: nowrap !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-readiness-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 3px !important;
            margin-top: 3px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-readiness-card {
            min-height: 0 !important;
            padding: 4px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-readiness-card > p:first-child {
            font-size: 17px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-readiness-card > p:last-child {
            margin-top: 2px !important;
            font-size: 9px !important;
            line-height: 1.08 !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-missing-details {
            margin-top: 3px !important;
            padding: 4px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-missing-details > div {
            margin-top: 1px !important;
            gap: 1px !important;
          }
          body.csc-section-printing #csc-ai-overview-print .csc-ai-missing-details [role="button"] {
            padding: 2px 0 !important;
            font-size: 11px !important;
            line-height: 1.15 !important;
          }
          body.csc-section-printing #csc-ai-overview-print dl {
            margin-top: 3px !important;
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 3px !important;
          }
          body.csc-section-printing #csc-ai-overview-print dl > div {
            padding: 4px !important;
          }
          body.csc-section-printing #csc-ai-overview-print svg {
            width: 13px !important;
            height: 13px !important;
          }

          /* Specific-month CSC schedule print. Hours only, no financial information. */
          body.csc-section-printing #csc-ai-month-schedule-print {
            page: csc-ai-month-schedule-page;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: #0f172a !important;
            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 11px !important;
            line-height: 1.2 !important;
          }
          body.csc-section-printing #csc-ai-month-schedule-print h1 {
            margin: 0 !important;
            font-size: 22px !important;
            line-height: 1.05 !important;
          }
          body.csc-section-printing #csc-ai-month-schedule-print .csc-month-schedule-summary {
            margin: 5px 0 10px !important;
            font-size: 11px !important;
            font-weight: 700 !important;
            color: #334155 !important;
          }
          body.csc-section-printing #csc-ai-month-schedule-print table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
            font-size: 11px !important;
            line-height: 1.18 !important;
          }
          body.csc-section-printing #csc-ai-month-schedule-print thead {
            display: table-header-group !important;
          }
          body.csc-section-printing #csc-ai-month-schedule-print tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          body.csc-section-printing #csc-ai-month-schedule-print th,
          body.csc-section-printing #csc-ai-month-schedule-print td {
            border: 1px solid #94a3b8 !important;
            padding: 5px 5px !important;
            vertical-align: top !important;
            overflow-wrap: break-word !important;
            word-break: normal !important;
          }
          body.csc-section-printing #csc-ai-month-schedule-print th {
            background: #e2e8f0 !important;
            color: #0f172a !important;
            font-size: 10px !important;
            font-weight: 800 !important;
            text-transform: uppercase !important;
            letter-spacing: 0.02em !important;
          }
          body.csc-section-printing #csc-ai-month-schedule-print th:nth-child(1),
          body.csc-section-printing #csc-ai-month-schedule-print td:nth-child(1) {
            width: 9% !important;
            white-space: nowrap !important;
          }
          body.csc-section-printing #csc-ai-month-schedule-print th:nth-child(2),
          body.csc-section-printing #csc-ai-month-schedule-print td:nth-child(2),
          body.csc-section-printing #csc-ai-month-schedule-print th:nth-child(3),
          body.csc-section-printing #csc-ai-month-schedule-print td:nth-child(3) {
            width: 10% !important;
            white-space: nowrap !important;
          }
          body.csc-section-printing #csc-ai-month-schedule-print th:nth-child(4),
          body.csc-section-printing #csc-ai-month-schedule-print td:nth-child(4) {
            width: 13% !important;
          }
          body.csc-section-printing #csc-ai-month-schedule-print th:nth-child(5),
          body.csc-section-printing #csc-ai-month-schedule-print td:nth-child(5) {
            width: 22% !important;
          }
          body.csc-section-printing #csc-ai-month-schedule-print th:nth-child(6),
          body.csc-section-printing #csc-ai-month-schedule-print td:nth-child(6) {
            width: 13% !important;
          }
          body.csc-section-printing #csc-ai-month-schedule-print th:nth-child(7),
          body.csc-section-printing #csc-ai-month-schedule-print td:nth-child(7) {
            width: 15% !important;
          }
          body.csc-section-printing #csc-ai-month-schedule-print th:nth-child(8),
          body.csc-section-printing #csc-ai-month-schedule-print td:nth-child(8) {
            width: 8% !important;
            text-align: right !important;
            white-space: nowrap !important;
          }

          body.csc-section-printing .csc-no-print,
          body.csc-section-printing .csc-no-print *,
          body.csc-section-printing .csc-print-target button,
          body.csc-section-printing .csc-print-target input,
          body.csc-section-printing .csc-print-target select,
          body.csc-section-printing .csc-print-target textarea {
            display: none !important;
          }
        }
      `}</style>
      <div className="flex min-w-0 flex-col gap-3 overflow-x-clip bg-amber-50 py-3 sm:gap-4 sm:py-4">
        <TabPageHeader
          icon={BriefcaseBusiness}
          title="CSC Shifts"
          subtitle="Manage confirmed work schedules, pay status, calendar details, rides, and paycheck links."
          theme="amber"
          className="budget-mobile-header"
          actions={
            <div className="flex w-max flex-nowrap items-center gap-2">
              <button
                type="button"
                onClick={handleOpenAiOverview}
                title="Open CSC AI Overview"
                aria-label="Open CSC AI Overview"
                aria-haspopup="dialog"
                aria-expanded={showAiOverview}
                className={`${TAB_HEADER_ACTION_CLASS} !h-11 !w-auto !gap-2 !px-3 !text-sm border border-fuchsia-800 bg-fuchsia-700 text-white hover:bg-fuchsia-600`}
              >
                <Sparkles className="h-4 w-4" />
                <span>AI Overview</span>
              </button>

              <button
                type="button"
                onClick={() => setShowScanDrawer(true)}
                title="Scan CSC schedule"
                aria-label="Scan CSC schedule"
                className={`${TAB_HEADER_ACTION_CLASS} !h-11 !w-auto !gap-2 !px-3 !text-sm border border-blue-800 bg-blue-700 text-white hover:bg-blue-600`}
              >
                <StickyNote className="h-4 w-4" />
                <span>Scan Schedule</span>
              </button>

              <button
                type="button"
                onClick={handleTogglePremiumView}
                title="Print CSC events"
                aria-label="Print CSC events"
                className={`${TAB_HEADER_ACTION_CLASS} !h-11 !w-auto !gap-2 !px-3 !text-sm bg-violet-700 text-white hover:bg-violet-600`}
              >
                <ListChecks className="h-4 w-4" />
                <span>Print Events</span>
              </button>

              <button
                type="button"
                onClick={() => setShowUpcomingScheduleOverlay(true)}
                title="Preview and print CSC shifts list"
                aria-label="Preview and print CSC shifts list"
                className={`${TAB_HEADER_ACTION_CLASS} !h-11 !w-auto !gap-2 !px-3 !text-sm bg-cyan-800 text-white hover:bg-cyan-700`}
              >
                <Table2 className="h-4 w-4" />
                <span>Print List</span>
              </button>

              <button
                type="button"
                onClick={() => setShowDataScreen(true)}
                title="Open CSC shift data and backup tools"
                aria-label="Open CSC shift data and backup tools"
                aria-haspopup="dialog"
                aria-expanded={showDataScreen}
                className={`${TAB_HEADER_ACTION_CLASS} !h-11 !w-auto !gap-2 !px-3 !text-sm bg-white text-amber-950 hover:bg-amber-50`}
              >
                <FileUp className="h-4 w-4" />
                <span>Data</span>
              </button>
            </div>
          }
        />

        <input ref={toolbarImportInputRef} type="file" accept=".csv,text/csv" onChange={handleImportCsv} className="hidden" />
        <input
          ref={completeBackupImportInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleRestoreCompleteCscBackup}
          className="hidden"
        />

        {showDataScreen ? (
          <div
            onDragEnter={handleCompleteBackupDragEnter}
            onDragOver={handleCompleteBackupDragOver}
            onDragLeave={handleCompleteBackupDragLeave}
            onDrop={handleCompleteBackupDrop}
          >
            <DataToolsScreen
              title="CSC Shift Data and Backups"
              subtitle="Import or export CSC shift data, save a safety snapshot, restore a complete CSC backup by file picker or drag and drop, or reconcile Google Calendar against current CSC Shifts."
              onClose={() => {
                completeBackupDragDepthRef.current = 0;
                setIsCompleteBackupDragActive(false);
                setCalendarAuditReport(null);
                setShowDataScreen(false);
              }}
              tools={[
                {
                  key: 'complete-csc-export',
                  icon: Download,
                  tone: 'emerald',
                  title: 'Export Complete CSC Backup',
                  description: 'Download active and archived CSC shifts plus CSC restore metadata as one JSON backup.',
                  buttonLabel: 'Export Complete CSC Backup',
                  onClick: handleExportCompleteCscBackup,
                },
                {
                  key: 'complete-csc-restore',
                  icon: FileUp,
                  tone: 'amber',
                  title: 'Restore Complete CSC Backup',
                  description: 'Drag a complete CSC backup JSON file anywhere onto this screen, or choose a file. A safety snapshot is saved before active and archived CSC data are replaced.',
                  buttonLabel: 'Choose CSC Backup',
                  onClick: () => completeBackupImportInputRef.current?.click(),
                },
                {
                  key: 'export',
                  icon: Download,
                  tone: 'sky',
                  title: 'Export Active CSC Shifts (CSV)',
                  description: 'Download active CSC shifts only as a CSV file. Archived shifts are not included.',
                  buttonLabel: 'Export Active CSV',
                  onClick: handleExportCsv,
                },
                {
                  key: 'import',
                  icon: FileUp,
                  tone: 'indigo',
                  title: 'Import Active CSC Shifts (CSV)',
                  description: 'Add or update active CSC shifts from CSV. Existing archived shifts are preserved and skipped.',
                  buttonLabel: 'Choose CSV File',
                  onClick: () => toolbarImportInputRef.current?.click(),
                },
                {
                  key: 'snapshot',
                  icon: History,
                  tone: 'emerald',
                  title: 'Safety Snapshot',
                  description: 'Save active and archived CSC shifts locally before bulk imports or edits.',
                  buttonLabel: 'Save Safety Snapshot',
                  onClick: handleManualSafetySnapshot,
                },
                {
                  key: 'calendar-audit',
                  icon: Search,
                  tone: 'sky',
                  title: 'Verify CSC Data vs Google Calendar',
                  description: 'Run a read-only audit of active shifts, archived shifts, Past Shifts, snapshot-only records, and managed CSC Google Calendar events. Nothing is changed or deleted.',
                  buttonLabel: calendarAuditRunning ? 'Verifying...' : 'Verify CSC Data',
                  onClick: handleVerifyCscDataAgainstGoogleCalendar,
                },
                {
                  key: 'calendar-cleanup',
                  icon: Eraser,
                  tone: 'indigo',
                  title: 'Clean Google Calendar',
                  description: 'Compare future CSC calendar events against current CSC Shifts, keep one event per real shift, and remove only duplicate or stale CSC events.',
                  buttonLabel: 'Remove Calendar Duplicates',
                  onClick: handleCleanGoogleCalendarDuplicates,
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

            {isCompleteBackupDragActive ? (
              <div className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4">
                <div className="w-full max-w-xl rounded-3xl border-2 border-dashed border-amber-300 bg-amber-50 px-6 py-10 text-center shadow-2xl">
                  <FileUp className="mx-auto h-12 w-12 text-amber-700" />
                  <p className="mt-4 text-xl font-black text-slate-950">
                    Drop Complete CSC Backup
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    Release the JSON backup file to validate it, save a safety snapshot, and restore CSC data.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {calendarAuditReport ? createPortal((
              <div className="fixed inset-0 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6" style={{ zIndex: 10050 }}>
                <div
                  id="csc-calendar-audit-print"
                  className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-2xl"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-6 w-6 text-emerald-700" />
                        <h2 className="text-xl font-black text-slate-950">
                          CSC Data vs Google Calendar Audit
                        </h2>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        Read-only comparison. No CSC data or Google Calendar events were changed.
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        Calendar range: {calendarAuditReport.rangeStart} through {calendarAuditReport.rangeEnd}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrintCalendarAudit}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white shadow-sm hover:bg-emerald-600"
                        aria-label="Print CSC Data vs Google Calendar Audit"
                        title="Print CSC Data vs Google Calendar Audit"
                      >
                        <Printer className="h-4 w-4" />
                        Print Audit
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalendarAuditReport(null)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800"
                      >
                        <X className="h-4 w-4" />
                        Close
                      </button>
                    </div>
                  </div>

                  <div className="csc-print-scroll min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {[
                        ['Active stored', calendarAuditReport.counts.activeStored],
                        ['Archived stored', calendarAuditReport.counts.archivedStored],
                        ['Past Shifts badge', calendarAuditReport.counts.pastDrawer],
                        ['Snapshot-only past', calendarAuditReport.counts.snapshotOnlyPast],
                        ['CSC Calendar events', calendarAuditReport.counts.calendarEvents],
                        ['Current shifts matched', calendarAuditReport.counts.matchedCurrent],
                        ['Current missing Calendar', calendarAuditReport.counts.missingCurrent],
                        ['Snapshot-only matched', calendarAuditReport.counts.snapshotCalendarSupported],
                        ['Duplicate Calendar events', calendarAuditReport.counts.duplicateCalendarEvents],
                        ['Unmatched Calendar events', calendarAuditReport.counts.unlinkedCalendarEvents],
                        ['Active records in Past Shifts', calendarAuditReport.counts.activePastRecords],
                        ['Cancelled stored', calendarAuditReport.counts.cancelledStored],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <p className="text-xs font-black uppercase tracking-wide text-slate-600">
                            {label}
                          </p>
                          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <section className="rounded-2xl border border-red-200 bg-red-50 p-4">
                        <h3 className="font-black text-red-950">
                          Current CSC shifts missing from Calendar ({calendarAuditReport.missingCurrent.length})
                        </h3>
                        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                          {calendarAuditReport.missingCurrent.length ? (
                            calendarAuditReport.missingCurrent.map((shift) => (
                              <div key={shift.id} className="rounded-xl bg-white p-3 text-sm shadow-sm">
                                <p className="font-black text-slate-950">
                                  {formatShortDate(shift.startDate)} {formatTime(shift.startTime)} · {shift.venue || 'Venue unknown'}
                                </p>
                                <p className="mt-1 text-slate-700">
                                  {shift.jobName || shift.event || shift.shiftName || shift.id}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm font-bold text-emerald-800">None.</p>
                          )}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                        <h3 className="font-black text-amber-950">
                          Snapshot-only records supported by Calendar ({calendarAuditReport.matchedSnapshotOnly.length})
                        </h3>
                        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                          {calendarAuditReport.matchedSnapshotOnly.length ? (
                            calendarAuditReport.matchedSnapshotOnly.map(({ shift, event }) => (
                              <div key={shift.id} className="rounded-xl bg-white p-3 text-sm shadow-sm">
                                <p className="font-black text-slate-950">
                                  {formatShortDate(shift.startDate)} {formatTime(shift.startTime)} · {shift.venue || 'Venue unknown'}
                                </p>
                                <p className="mt-1 text-slate-700">
                                  {shift.jobName || shift.event || shift.shiftName || shift.id}
                                </p>
                                <p className="mt-1 text-xs font-bold text-emerald-700">
                                  Calendar match: {event.summary || event.id}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm font-bold text-slate-700">None.</p>
                          )}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="font-black text-slate-950">
                          Snapshot-only records without Calendar support ({calendarAuditReport.unsupportedSnapshotOnly.length})
                        </h3>
                        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                          {calendarAuditReport.unsupportedSnapshotOnly.length ? (
                            calendarAuditReport.unsupportedSnapshotOnly.map((shift) => (
                              <div key={shift.id} className="rounded-xl bg-white p-3 text-sm shadow-sm">
                                <p className="font-black text-slate-950">
                                  {formatShortDate(shift.startDate)} {formatTime(shift.startTime)} · {shift.venue || 'Venue unknown'}
                                </p>
                                <p className="mt-1 text-slate-700">
                                  {shift.jobName || shift.event || shift.shiftName || shift.id}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm font-bold text-emerald-800">None.</p>
                          )}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                        <h3 className="font-black text-violet-950">
                          Extra Calendar events ({calendarAuditReport.duplicateCalendarEvents.length + calendarAuditReport.unlinkedCalendarEvents.length})
                        </h3>
                        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                          {[...calendarAuditReport.duplicateCalendarEvents, ...calendarAuditReport.unlinkedCalendarEvents].length ? (
                            [...calendarAuditReport.duplicateCalendarEvents, ...calendarAuditReport.unlinkedCalendarEvents].map(
                              ({ event, reason }) => (
                                <div key={event.id} className="rounded-xl bg-white p-3 text-sm shadow-sm">
                                  <p className="font-black text-slate-950">
                                    {event.summary || event.id}
                                  </p>
                                  <p className="mt-1 text-xs font-black uppercase tracking-wide text-violet-700">
                                    {reason === 'duplicate' ? 'Likely duplicate' : 'No current CSC match'}
                                  </p>
                                </div>
                              )
                            )
                          ) : (
                            <p className="text-sm font-bold text-emerald-800">None.</p>
                          )}
                        </div>
                      </section>
                    </div>

                    <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-950">
                      The Past Shifts badge currently counts archived records, qualifying active past/Done/Cancelled records, and snapshot-only historical records. Use this audit to determine whether any snapshot-only records are corroborated by Google Calendar before changing the badge logic or restoring records.
                    </div>
                  </div>
                </div>
              </div>
            ), document.body) : null}

        <section aria-labelledby="csc-current-month-summary-title" className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-slate-700">Monthly Summary</p>
              <h2 id="csc-current-month-summary-title" className="text-lg font-black text-slate-950">
                {dashboardMonthSummary.label}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPaidMonthKey(dashboardMonthSummary.monthKey)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-extrabold text-slate-900 shadow-sm hover:bg-slate-50"
              title={`Open the full monthly report for ${dashboardMonthSummary.label}`}
              aria-label={`Open the full monthly report for ${dashboardMonthSummary.label}`}
            >
              <CalendarDays className="h-4 w-4" />
              View Report
            </button>
          </div>

          <div className="overflow-x-auto pb-1">
            <div className="grid min-w-[1040px] grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setSelectedPaidMonthKey(dashboardMonthSummary.monthKey)}
                className="min-w-0 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                title={`Open ${dashboardMonthSummary.label} shift report`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-amber-950">Scheduled Shifts</p>
                    <p className="mt-2 text-3xl font-black leading-none text-amber-950">
                      {dashboardMonthSummary.totalRecords}
                    </p>
                    <p className="mt-3 text-xs font-extrabold leading-5 text-amber-900">
                      {dashboardMonthSummary.activeRecords} active, {dashboardMonthSummary.archivedRecords} archived, {dashboardMonthSummary.payableRecords} payable
                      {dashboardMonthSummary.cancelledRecords
                        ? `, ${dashboardMonthSummary.cancelledRecords} cancelled`
                        : ''}
                    </p>
                  </div>
                  <BriefcaseBusiness className="h-9 w-9 shrink-0 text-amber-900" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPaidMonthKey(dashboardMonthSummary.monthKey)}
                className="min-w-0 rounded-2xl border border-blue-300 bg-blue-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                title={`Open ${dashboardMonthSummary.label} hours report`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-blue-950">Estimated Hours</p>
                    <p className="mt-2 text-3xl font-black leading-none text-blue-950">
                      {dashboardMonthSummary.hours.toFixed(1)}
                    </p>
                    <p className="mt-3 text-sm font-extrabold text-blue-800">
                      Done: {dashboardMonthSummary.workedHours.toFixed(1)}
                    </p>
                  </div>
                  <Clock className="h-9 w-9 shrink-0 text-blue-900" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPaidMonthKey(dashboardMonthSummary.monthKey)}
                className="min-w-0 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                title={`Open ${dashboardMonthSummary.label} pay report`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-emerald-950">Estimated Pay</p>
                    <p className="mt-2 text-3xl font-black leading-none text-emerald-950">
                      {formatCurrency(dashboardMonthSummary.projectedPay)}
                    </p>
                    <p className="mt-3 text-sm font-extrabold text-emerald-800">
                      Earned: {formatCurrency(dashboardMonthSummary.earnedPay)}
                    </p>
                  </div>
                  <DollarSign className="h-9 w-9 shrink-0 text-emerald-900" />
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedPaidMonthKey(dashboardMonthSummary.monthKey)}
                className="min-w-0 rounded-2xl border border-orange-300 bg-orange-50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                title={`Open ${dashboardMonthSummary.label} amount owed report`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-orange-950">Still Owed</p>
                    <p className="mt-2 text-3xl font-black leading-none text-orange-950">
                      {formatCurrency(dashboardMonthSummary.owedAmount)}
                    </p>
                    <p className="mt-3 text-sm font-extrabold text-orange-800">
                      Marked paid: {formatCurrency(dashboardMonthSummary.paidAmount)}
                    </p>
                  </div>
                  <CheckCircle2 className="h-9 w-9 shrink-0 text-orange-900" />
                </div>
              </button>
            </div>
          </div>
        </section>

        {nextActionShift ? (
          <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-amber-50 p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-wide text-blue-800">Next Shift Action Center</p>
                <h2 className="mt-1 break-words text-xl font-black text-slate-950">
                  {nextActionShift.event || nextActionShift.jobName || nextActionShift.venue || 'Upcoming CSC shift'}
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-700">
                  {formatDate(nextActionShift.startDate)} at {formatTime(nextActionShift.startTime)}
                  {nextActionShift.finishTime ? ` to ${formatTime(nextActionShift.finishTime)}` : ''}, {nextActionShift.venue}
                </p>
                <p className={`mt-2 text-xs font-extrabold ${nextActionMissingItems.length ? 'text-amber-800' : 'text-emerald-800'}`}>
                  {nextActionMissingItems.length
                    ? `Needs attention: ${nextActionMissingItems.join(', ')}`
                    : `Ready: schedule, address, calendar, and travel plan are confirmed. ${
                        nextActionTravelReadiness?.linkedRide ? 'Arranged ride.' : 'Using my car.'
                      }`}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                <button
                  type="button"
                  onClick={() => handleOpenShiftDetails(nextActionShift)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-extrabold text-white hover:bg-slate-800"
                >
                  <PanelRightOpen className="h-4 w-4" />
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => handleAddShiftToCalendar(nextActionShift)}
                  disabled={calendarAddingShiftId === nextActionShift.id}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold text-white disabled:cursor-wait ${
                    nextActionIsCalendared
                      ? 'bg-[#8E24AA] ring-2 ring-[#E1BEE7] hover:bg-[#7B1FA2]'
                      : calendarAddingShiftId === nextActionShift.id
                        ? 'bg-[#CE93D8]'
                        : 'bg-[#8E24AA] hover:bg-[#7B1FA2]'
                  }`}
                  title={
                    nextActionIsCalendared
                      ? 'Open this shift in Google Calendar'
                      : calendarAddingShiftId === nextActionShift.id
                        ? 'Adding to Google Calendar'
                        : 'Add this shift to Google Calendar'
                  }
                  aria-label={
                    nextActionIsCalendared
                      ? 'Calendared, open this shift in Google Calendar'
                      : 'Add this shift to Google Calendar'
                  }
                >
                  {nextActionIsCalendared ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <CalendarPlus className="h-4 w-4" />
                  )}
                  {nextActionIsCalendared ? 'Calendared' : 'Calendar'}
                </button>
                <button
                  type="button"
                  onClick={() => handlePlanOrOpenRide(nextActionShift)}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-extrabold text-white ${
                    nextActionTravelReadiness?.needsAttention
                      ? 'bg-amber-700 hover:bg-amber-800'
                      : 'bg-sky-700 hover:bg-sky-800'
                  }`}
                  title={nextActionTravelReadiness?.title || 'Open travel plan'}
                  aria-label={nextActionTravelReadiness?.title || 'Open travel plan'}
                >
                  <Car className="h-4 w-4" />
                  {nextActionTravelReadiness?.label || 'My Car'}
                </button>
                {nextActionShift.address ? (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(nextActionShift.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 text-sm font-extrabold text-white hover:bg-blue-800"
                  >
                    <MapPin className="h-4 w-4" />
                    Directions
                  </a>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        <section
          ref={shiftBrowserRef}
          className="csc-shift-browser min-w-0 scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
        >
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">Scheduled Shifts</h2>
              <p className="text-sm text-slate-800">
                Edit status, pay, payment date, and notes directly in the table. Changes save in this browser.
              </p>
            </div>

            <div className="grid w-full grid-cols-6 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
              <button
                type="button"
                onClick={handleToggleShiftListLength}
                disabled={filteredShifts.length <= DEFAULT_VISIBLE_SHIFT_COUNT}
                title={
                  filteredShifts.length > DEFAULT_VISIBLE_SHIFT_COUNT
                    ? allShiftRowsVisible
                      ? `Collapse to ${DEFAULT_VISIBLE_SHIFT_COUNT} shifts`
                      : `Show all ${filteredShifts.length} shifts`
                    : undefined
                }
                aria-label={
                  filteredShifts.length > DEFAULT_VISIBLE_SHIFT_COUNT
                    ? allShiftRowsVisible
                      ? `Collapse to ${DEFAULT_VISIBLE_SHIFT_COUNT} shifts`
                      : `Show all ${filteredShifts.length} shifts`
                    : 'All matching shifts are already visible'
                }
                aria-expanded={allShiftRowsVisible}
                className="col-span-2 inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg border border-amber-800 bg-amber-800 px-2 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 disabled:cursor-default disabled:opacity-50 sm:col-auto sm:h-10 sm:w-40 sm:shrink-0 sm:gap-2 sm:px-3 sm:text-sm"
              >
                <ListChecks className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {filteredShifts.length <= DEFAULT_VISIBLE_SHIFT_COUNT
                    ? `Scheduled ${filteredShifts.length}`
                    : allShiftRowsVisible
                      ? `Show ${DEFAULT_VISIBLE_SHIFT_COUNT}`
                      : `Show Scheduled ${filteredShifts.length}`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setArchiveSearch('');
                  setArchiveStatusFilter('All');
                  setShowArchiveDrawer(true);
                }}
                title={`Past Shifts (${pastShiftRecords.length})`}
                aria-label={`Open past shifts with ${pastShiftRecords.length} CSC shift${pastShiftRecords.length === 1 ? '' : 's'}`}
                className="relative inline-flex h-9 w-full items-center justify-center rounded-lg bg-orange-700 text-white shadow-sm hover:bg-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 sm:h-10 sm:w-10"
              >
                <Archive className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-400 px-1 text-[11px] font-black leading-none text-white">
                  {pastShiftRecords.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextShowActiveOnly = !showActiveOnly;
                  setShowActiveOnly(nextShowActiveOnly);
                  if (nextShowActiveOnly) setStatusFilter('All');
                }}
                title={showActiveOnly ? 'Show All' : 'Show Active'}
                aria-label={showActiveOnly ? 'Show all CSC shifts' : 'Show only active CSC shifts'}
                aria-pressed={showActiveOnly}
                className={`inline-flex h-9 w-full items-center justify-center rounded-lg text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:h-10 sm:w-10 ${
                  showActiveOnly ? 'bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-400' : 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-400'
                }`}
              >
                <Check className="h-5 w-5" />
              </button>
                <CollapseToggleButton
                  action="collapse"
                  onClick={() => setIsShiftTableCollapsed(true)}
                  title="Collapse all shifts"
                  ariaLabel="Collapse CSC shifts table"
                  className="h-9 w-full sm:h-10 sm:w-10"
                />
                <CollapseToggleButton
                  action="expand"
                  onClick={handleExpandAllShifts}
                  title={`Expand all ${filteredShifts.length} shifts`}
                  ariaLabel={`Expand all ${filteredShifts.length} CSC shifts`}
                  className="h-9 w-full sm:h-10 sm:w-10"
                />
                <CollapseToggleButton
                  action="expand"
                  onClick={handleExpandAllActiveShifts}
                  title={`Expand all ${activeShiftCount} active shifts`}
                  ariaLabel={`Expand all ${activeShiftCount} active CSC shifts`}
                  className="col-span-3 h-8 w-full sm:col-auto sm:h-10 sm:w-10"
                />
            </div>
          </div>

          <div className="csc-shift-filter-grid mb-3 flex flex-wrap gap-2">
            <div ref={venueFilterRef} className="csc-shift-filter-venue relative">
              <button
                type="button"
                onClick={() => setShowVenueFilter((current) => !current)}
                aria-haspopup="true"
                aria-expanded={showVenueFilter}
                className="csc-shift-filter-control flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-teal-700 bg-teal-700 px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-800 focus:border-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-300"
              >
                <span className="truncate">{venueFilterLabel}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${showVenueFilter ? '' : 'rotate-180'}`} />
              </button>

              {showVenueFilter ? (
                <div className="absolute left-0 top-full z-50 mt-1 w-[20rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-teal-200 bg-white shadow-xl">
                  <label className="flex cursor-pointer items-center gap-3 border-b border-teal-100 bg-teal-50 px-3 py-2.5 font-extrabold text-teal-950 hover:bg-teal-100">
                    <input
                      ref={(input) => {
                        if (input) input.indeterminate = someVenuesSelected;
                      }}
                      type="checkbox"
                      checked={allVenuesSelected}
                      onChange={(event) => setExcludedVenues(event.target.checked ? [] : venueNames)}
                      className="h-4 w-4 rounded border-teal-300 text-teal-700 focus:ring-teal-500"
                    />
                    <span>All venues</span>
                  </label>
                  <div className="max-h-72 overflow-y-auto py-1">
                    {venueNames.map((venue) => {
                      const eventCalendarUrl = VENUE_EVENT_CALENDAR_URLS[venue];

                      return (
                        <div
                          key={venue}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-teal-950 hover:bg-teal-50"
                        >
                          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-0.5">
                            <input
                              type="checkbox"
                              checked={!excludedVenueSet.has(venue)}
                              onChange={() => toggleVenue(venue)}
                              className="h-4 w-4 shrink-0 rounded border-teal-300 text-teal-700 focus:ring-teal-500"
                            />
                            <span className="min-w-0 break-words">{venue}</span>
                          </label>
                          {eventCalendarUrl ? (
                            <a
                              href={eventCalendarUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-teal-200 bg-white px-2 py-1 text-[11px] font-extrabold text-teal-800 no-underline shadow-sm hover:border-teal-400 hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-400"
                              aria-label={`Open ${venue} event calendar`}
                              title={`Open ${venue} event calendar`}
                            >
                              Events
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between border-t border-teal-100 bg-slate-50 px-3 py-2">
                    <span className="text-xs font-bold text-slate-800">{selectedVenueCount} selected</span>
                    <button
                      type="button"
                      onClick={() => setShowVenueFilter(false)}
                      className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-teal-800"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <select
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              className="csc-shift-filter-control csc-shift-filter-month h-10 rounded-lg border border-indigo-700 bg-indigo-700 px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-800 focus:border-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="All">All months</option>
              {monthOptions.map((month) => (
                <option key={month.monthKey} value={month.monthKey}>
                  {month.label} ({month.count})
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => handleStatusFilterChange(event.target.value)}
              className="csc-shift-filter-control csc-shift-filter-status h-10 rounded-lg border border-amber-700 bg-amber-700 px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-800 focus:border-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-300"
            >
              <option value="All">All statuses</option>
              {SHIFT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowMonthOverview((current) => !current)}
              aria-expanded={showMonthOverview}
              aria-controls="csc-shifts-month-overview"
              aria-label={showMonthOverview ? 'Hide shift month overview' : 'View shifts by month'}
              title={showMonthOverview ? 'Hide month overview' : 'View shifts by month'}
              className={`csc-shift-filter-month-button inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-extrabold transition ${
                showMonthOverview
                  ? 'border-fuchsia-800 bg-fuchsia-800 text-white shadow-sm hover:bg-fuchsia-900'
                  : 'border-fuchsia-700 bg-fuchsia-700 text-white shadow-sm hover:bg-fuchsia-800'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              <span className="csc-shift-month-label">{showMonthOverview ? 'Hide Months' : 'View by Month'}</span>
            </button>

            <label className="csc-shift-filter-search relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <input
                value={localSearch}
                onChange={(event) => setLocalSearch(event.target.value)}
                placeholder="Search shifts"
                className="h-10 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm"
              />
            </label>
          </div>

          {showMonthOverview ? (
            <div id="csc-shifts-month-overview" className="mb-5 rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 shadow-inner">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-black text-violet-950">Shifts by Month</h3>
                  <p className="text-sm font-medium text-slate-800">
                    {allVenuesSelected
                      ? 'Showing all venues.'
                      : `Showing ${selectedVenueCount} of ${venueNames.length} venues.`}{' '}
                    Choose a month to filter the Scheduled Shifts list below.
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

              {monthlyShiftGroups.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {monthlyShiftGroups.map((group) => (
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
                          <p className={`mt-1 text-sm font-bold ${monthFilter === group.monthKey ? 'text-violet-100' : 'text-slate-800'}`}>
                            {group.shifts.length} shift{group.shifts.length === 1 ? '' : 's'}
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
                <div className="mt-4 rounded-xl border border-dashed border-violet-300 bg-white/70 p-6 text-center text-sm font-bold text-slate-800">
                  No months match the current venue, status, or search filters.
                </div>
              )}
            </div>
          ) : null}

          <>

          <div className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-amber-200 bg-amber-100 px-3 py-3 text-amber-950 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <GripVertical className="hidden h-4 w-4 shrink-0 text-amber-700 sm:block" />
                <CollapseToggleButton
                  expanded={!isShiftTableCollapsed}
                  onClick={handleToggleShiftTable}
                  ariaLabel={isShiftTableCollapsed ? 'Expand CSC shifts' : 'Collapse CSC shifts'}
                  title={isShiftTableCollapsed ? 'Expand CSC shifts' : 'Collapse CSC shifts'}
                />
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-wrap">
                  <BriefcaseBusiness className="h-5 w-5 shrink-0 text-amber-800" />
                  <h3 className="whitespace-nowrap text-base font-extrabold text-slate-950 sm:text-lg">CSC Shifts</h3>
                  <CollapseToggleButton
                    action="expand"
                    onClick={handleExpandAllActiveShifts}
                    title={`Expand all ${activeShiftCount} active shifts`}
                    ariaLabel={`Expand all ${activeShiftCount} active CSC shifts`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 border-t border-amber-200 pt-2 sm:flex sm:shrink-0 sm:items-center sm:border-0 sm:pt-0">
                <button
                  type="button"
                  onClick={handleOpenAddShift}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-2 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 sm:h-10 sm:px-3 sm:text-sm"
                  title="Add CSC shift"
                  aria-label="Add CSC shift"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Shift</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddShift}
                  className="hidden h-10 w-10 items-center justify-center rounded-lg border border-amber-300 bg-white text-amber-950 shadow-sm transition-colors hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 sm:inline-flex"
                  aria-label="Edit CSC shifts"
                  title="Edit CSC shifts"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!isShiftTableCollapsed ? (
              <>
          {premiumView ? (            <div className="grid gap-4 xl:grid-cols-2">
              {displayedShifts.map((shift) => (
                <article key={shift.id} className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-yellow-950">
                        <Sparkles className="h-5 w-5" />
                        <h3 className="text-lg font-extrabold">{shift.venue || 'CSC Shift'}</h3>
                      </div>
                      <p className="csc-title-wrap mt-1 text-sm font-bold text-slate-800">{shift.event || 'Event not entered'}</p>
                      {shouldShowDistinctJobName(shift) ? <p className="csc-title-wrap mt-1 text-xs text-slate-800">{shift.jobName}</p> : null}
                      {shift.shiftName ? <p className="csc-title-wrap mt-1 text-xs text-slate-800">Shift Name: {shift.shiftName}</p> : null}
                      {shift.roleName ? <p className="csc-title-wrap mt-1 text-xs text-slate-800">Role Name: {shift.roleName}</p> : null}
                    </div>
                    {renderShiftActions(shift)}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-extrabold uppercase text-slate-700">Start</p>
                      <p className="mt-1 font-extrabold text-slate-950">{formatDate(shift.startDate)}</p>
                      <p className="text-sm text-slate-700">{formatTime(shift.startTime)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-extrabold uppercase text-slate-700">Finish</p>
                      <p className="mt-1 font-extrabold text-slate-950">{formatDate(shift.finishDate)}</p>
                      <p className="text-sm text-slate-700">{formatTime(shift.finishTime)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-extrabold uppercase text-slate-700">Hours</p>
                      <p className="mt-1 text-xl font-extrabold text-slate-950">{getShiftHours(shift).toFixed(1)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-extrabold uppercase text-slate-700">Estimated Pay</p>
                      <p className="mt-1 text-xl font-extrabold text-emerald-700">{formatCurrency(getEstimatedPay(shift))}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-extrabold uppercase text-slate-700">Pay Date</p>
                      <p className="mt-1 font-extrabold text-blue-700">
                        {getCscPayDate(shift) ? formatDate(getCscPayDate(shift)) : 'Not set'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <select
                      value={shift.shiftStatus}
                      onChange={(event) => handleShiftStatusChange(shift, event.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                    >
                      {SHIFT_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={shift.hourlyRate}
                      onChange={(event) => updateShift(shift.id, { hourlyRate: event.target.value })}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                    />
                    {shift.shiftStatus !== 'Cancelled' ? (
                      <>
                        <select
                          value={shift.paidStatus}
                          onChange={(event) => updateShift(shift.id, { paidStatus: event.target.value })}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                        >
                          {PAID_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                        <input
                          type="date"
                          value={shift.paymentDate}
                          onChange={(event) => updateShift(shift.id, { paymentDate: event.target.value })}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                        />
                      </>
                    ) : (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800 md:col-span-2">
                        Cancelled, no payment due
                      </div>
                    )}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl bg-white p-3 text-sm text-slate-700">
                      <p className="font-extrabold text-slate-950">Location</p>
                      <p>{shift.address || 'Address not shown'}</p>
                      <p>{shift.city}</p>
                    </div>
                    <textarea
                      value={shift.notes}
                      onChange={(event) => updateShift(shift.id, { notes: event.target.value })}
                      placeholder="Shift notes..."
                      rows={3}
                      className="resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                    />
                  </div>
                </article>
              ))}
              {filteredShifts.length > DEFAULT_VISIBLE_SHIFT_COUNT ? (
                <div className="flex justify-center xl:col-span-2">
                  {renderShiftListPagingControls()}
                </div>
              ) : null}
            </div>
          ) : (
          <>
          <div className="grid gap-3 p-2 sm:hidden">
            {displayedShifts.map((shift, index) => renderMobileShiftCard(shift, index))}
            {filteredShifts.length > DEFAULT_VISIBLE_SHIFT_COUNT ? (
              <div className="flex justify-center px-2 pb-2 pt-1">
                {renderShiftListPagingControls()}
              </div>
            ) : null}
          </div>
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 sm:block">
            <table className="min-w-[1000px] table-fixed divide-y divide-slate-200 text-left text-sm">
              <colgroup>
                <col className="w-[235px]" />
                <col className="w-[125px]" />
                <col className="w-[125px]" />
                <col className="w-[345px]" />
                <col className="w-[170px]" />
              </colgroup>
              <thead className="bg-amber-100 text-xs uppercase tracking-wide text-amber-950">
                <tr>
                  <th className="px-4 py-2.5 font-extrabold">Shift</th>
                  <th className="px-4 py-2.5 font-extrabold">Start</th>
                  <th className="px-4 py-2.5 font-extrabold">Finish</th>
                  <th className="px-4 py-2.5 font-extrabold">Details</th>
                  <th className="sticky right-0 z-10 w-[170px] min-w-[170px] border-l border-amber-200 bg-amber-100 px-3 py-2.5 font-extrabold shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.25)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayedShifts.map((shift, index) => (
                  <tr
                    key={shift.id}
                    className={`group ${index % 2 === 0 ? 'bg-white' : 'bg-amber-50/50'} hover:bg-amber-50`}
                  >
                    <td className="px-3 py-2 align-top">
                      <div className="font-bold text-slate-950">{shift.venue}</div>
                      <div className="text-slate-800">{shift.city}</div>
                      <div className="mt-1 text-xs text-slate-700">{shift.address || 'Address not shown'}</div>
                      {shouldShowDistinctJobName(shift) ? <div className="csc-title-wrap mt-2 text-xs font-semibold text-slate-700">{shift.jobName}</div> : null}
                      {shift.shiftName ? (
                        <div className="csc-title-wrap mt-1 text-xs text-slate-800">
                          <span className="font-bold text-slate-700">Shift Name:</span> {shift.shiftName}
                        </div>
                      ) : null}
                      {shift.roleName ? (
                        <div className="csc-title-wrap mt-1 text-xs text-slate-800">
                          <span className="font-bold text-slate-700">Role Name:</span> {shift.roleName}
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top font-bold text-blue-700">
                      <div>{formatDate(shift.startDate)}</div>
                      <div>{formatTime(shift.startTime)}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 align-top">
                      <div>{formatDate(shift.finishDate)}</div>
                      <div>{formatTime(shift.finishTime)}</div>
                    </td>
                    <td className="w-[345px] min-w-0 max-w-[345px] overflow-hidden whitespace-normal break-words px-4 py-2 align-top text-slate-900">
                      <div className="csc-title-wrap font-semibold leading-snug">{shift.event}</div>
                      <div className="mt-2 grid max-w-full grid-cols-2 gap-x-3 gap-y-1 overflow-hidden text-xs text-slate-800">
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Hours:</span> {getShiftHours(shift).toFixed(1)}</div>
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Rate:</span> {getShiftHourlyRateLabel(shift)}</div>
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Est. Pay:</span> {formatCurrency(getEstimatedPay(shift))}</div>
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Status:</span> {shift.shiftStatus}</div>
                        <div className="min-w-0 break-words">
                          <span className="font-bold text-slate-700">Pay Date:</span>{' '}
                          {getCscPayDate(shift) ? formatPayDate(getCscPayDate(shift)) : 'Not set'}
                        </div>
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Paid:</span> {getShiftPaymentStatusLabel(shift)}</div>
                        {hasReconciledPaycheck(shift) ? (
                          <>
                            <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Actual Gross:</span> {formatCurrency(getShiftActualGrossPay(shift))}</div>
                            <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Actual Net:</span> {formatCurrency(getShiftActualNetPay(shift))}</div>
                            <div className="col-span-2 min-w-0 break-words"><span className="font-bold text-slate-700">Paycheck:</span> #{shift.reconciledCheckNumber || 'Linked'}</div>
                          </>
                        ) : null}
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Uniform:</span> {shift.uniform || 'Not entered'}</div>
                        <div className={`min-w-0 break-words ${getShiftCalendarStatusClass(shift)}`}>
                          <span className="font-bold">Calendar:</span>{' '}
                          {getShiftCalendarStatusLabel(shift)}
                        </div>
                        {shift.parking ? <div className="col-span-2 min-w-0 break-words"><span className="font-bold text-slate-700">Parking:</span> {shift.parking}</div> : null}
                        {shift.supervisor ? <div className="col-span-2 min-w-0 break-words"><span className="font-bold text-slate-700">Supervisor:</span> {shift.supervisor}</div> : null}
                      </div>
                    </td>
                    <td
                      className={`sticky right-0 z-10 w-[170px] min-w-[170px] whitespace-nowrap border-l border-slate-200 px-2 py-2 align-top shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)] group-hover:bg-yellow-50 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-amber-50/50'
                      }`}
                    >
                      {renderShiftActions(shift)}
                    </td>
                  </tr>
                ))}
                {filteredShifts.length > DEFAULT_VISIBLE_SHIFT_COUNT ? (
                  <tr>
                    <td colSpan={5} className="bg-slate-50 px-4 py-4 text-center">
                      <div className="flex justify-center">
                        {renderShiftListPagingControls()}
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          </>
          )}
              </>
            ) : (
              <div className="border-t border-amber-200 bg-amber-50 px-4 py-6 text-sm font-semibold text-slate-800">
                CSC shifts are collapsed. Use the up chevron to show the shift table.
              </div>
            )}
          </div>

          {filteredShifts.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-800">
              No shifts match the current filters.
            </div>
          )}
          </>
        </section>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 text-black shadow-sm sm:p-4">
          <div className="mb-3">
            <h2 className="text-lg font-extrabold text-black">Hours Worked Summary</h2>
            <p className="text-xs text-black">
              Worked hours include shifts marked Done. Weeks run Saturday through Friday. Scheduled hours exclude cancelled shifts.
            </p>
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-2 text-black sm:grid-cols-2 sm:gap-3 xl:grid-cols-4">
            <div className="min-w-0 rounded-xl border border-blue-200 bg-blue-50 p-2.5 text-black sm:p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-black">This Week</p>
              <p className="mt-0.5 text-[11px] font-bold text-blue-900">
                {hoursAnalytics.currentWeekLabel}
              </p>
              <p className="mt-1 whitespace-nowrap text-xl font-extrabold sm:text-2xl">{hoursAnalytics.currentWeekWorkedHours.toFixed(1)} hrs</p>
              <p className="mt-1 text-xs font-bold text-black">
                Scheduled: {hoursAnalytics.currentWeekScheduledHours.toFixed(1)}
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-black sm:p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-black">This Month</p>
              <p className="mt-1 whitespace-nowrap text-xl font-extrabold sm:text-2xl">{hoursAnalytics.currentMonthWorkedHours.toFixed(1)} hrs</p>
              <p className="mt-1 text-xs font-bold text-black">
                Scheduled: {hoursAnalytics.currentMonthScheduledHours.toFixed(1)}
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-violet-200 bg-violet-50 p-2.5 text-black sm:p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-black">This Year</p>
              <p className="mt-1 whitespace-nowrap text-xl font-extrabold sm:text-2xl">{hoursAnalytics.currentYearWorkedHours.toFixed(1)} hrs</p>
              <p className="mt-1 text-xs font-bold text-black">
                Scheduled: {hoursAnalytics.currentYearScheduledHours.toFixed(1)}
              </p>
            </div>

            <div className="min-w-0 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-black sm:p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-black">Average Month</p>
              <p className="mt-1 whitespace-nowrap text-xl font-extrabold sm:text-2xl">{hoursAnalytics.averageWorkedMonth.toFixed(1)} hrs</p>
              <p className="mt-1 text-xs font-bold text-black">
                {hoursAnalytics.completedMonthCount} completed {hoursAnalytics.completedMonthCount === 1 ? 'month' : 'months'}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-black">
                Scheduled avg: {hoursAnalytics.averageScheduledMonth.toFixed(1)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 text-black lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-amber-200 bg-amber-100 px-3 py-2 text-amber-950">
                <h3 className="text-sm font-extrabold">Weekly Hours</h3>
                <span className="text-[11px] font-bold text-black">{hoursAnalytics.weekly.length} weeks</span>
              </div>
              <div className="max-h-[240px] overflow-auto sm:max-h-[198px]">
                <table className="csc-hours-table w-full min-w-0 table-fixed text-left text-xs text-black">
                  <thead className="sticky top-0 z-20 bg-amber-50 text-[10px] font-extrabold uppercase tracking-wide text-amber-950">
                    <tr>
                      <th className="w-[43%] px-2 py-2">Week</th>
                      <th className="w-[19%] border-l border-slate-200 px-2 py-2 text-right">Scheduled</th>
                      <th className="w-[17%] px-2 py-2 text-right">Worked</th>
                      <th className="w-[21%] px-2 py-2 text-right">Done Shifts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {hoursAnalytics.weekly.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-3 py-5 text-center font-semibold text-black">
                          No dated shifts are available.
                        </td>
                      </tr>
                    ) : hoursAnalytics.weekly.map((week) => (
                      <tr
                        key={week.weekKey}
                        className={
                          week.weekKey === hoursAnalytics.currentWeekKey
                            ? 'sticky top-8 z-10 bg-blue-50 shadow-sm'
                            : 'bg-white'
                        }
                      >
                        <td className="px-2 py-2 font-bold text-black">
                          <button
                            type="button"
                            onClick={() => setSelectedWeekKey(week.weekKey)}
                            className="-mx-1 inline-flex items-center rounded px-1 py-0.5 text-left font-bold text-black no-underline transition-colors hover:bg-amber-200 focus-visible:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                            aria-label={`Show shifts worked for ${formatWeekRange(week.startDate, week.endDate)}`}
                            title="Show shifts worked this week"
                          >
                            {formatWeekRange(week.startDate, week.endDate)}
                            {week.weekKey === hoursAnalytics.currentWeekKey ? (
                              <span className="ml-1.5 rounded-full bg-blue-700 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white">
                                Current
                              </span>
                            ) : null}
                          </button>
                        </td>
                        <td className="border-l border-slate-100 px-2 py-2 text-right font-bold text-black">
                          {week.scheduledHours.toFixed(1)}
                        </td>
                        <td className="px-2 py-2 text-right font-extrabold text-black">
                          {week.workedHours.toFixed(1)}
                        </td>
                        <td className="px-2 py-2 text-right font-bold text-black">
                          {week.workedShiftCount} / {week.shiftCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-amber-200 bg-amber-100 px-3 py-2 text-amber-950">
                <h3 className="text-sm font-extrabold">Monthly Hours</h3>
                <span className="text-[11px] font-bold text-black">{hoursAnalytics.monthly.length} months</span>
              </div>
              <div className="max-h-[240px] overflow-auto sm:max-h-[198px]">
                <table className="csc-hours-table w-full min-w-0 table-fixed text-left text-xs text-black">
                  <thead className="sticky top-0 bg-amber-50 text-[10px] font-extrabold uppercase tracking-wide text-amber-950">
                    <tr>
                      <th className="w-[43%] px-2 py-2">Month</th>
                      <th className="w-[19%] border-l border-slate-200 px-2 py-2 text-right">Scheduled</th>
                      <th className="w-[17%] px-2 py-2 text-right">Worked</th>
                      <th className="w-[21%] px-2 py-2 text-right">Done Shifts</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {hoursAnalytics.monthly.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-3 py-5 text-center font-semibold text-black">
                          No dated shifts are available.
                        </td>
                      </tr>
                    ) : hoursAnalytics.monthly.map((month) => (
                      <tr key={month.monthKey} className="bg-white">
                        <td className="px-2 py-2 font-bold text-black">{month.label}</td>
                        <td className="border-l border-slate-100 px-2 py-2 text-right font-bold text-black">
                          {month.hours.toFixed(1)}
                        </td>
                        <td className="px-2 py-2 text-right font-extrabold text-black">
                          {month.workedHours.toFixed(1)}
                        </td>
                        <td className="px-2 py-2 text-right font-bold text-black">
                          {month.workedRecords} / {month.payableRecords}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-950">Monthly Pay Summary</h2>
              <p className="text-xs text-slate-800">
                Past, current, and next month are shown by default. Historical All-Time includes active and archived records.
              </p>
            </div>

            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              <label className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-extrabold text-slate-800 shadow-sm sm:rounded-full sm:py-1.5">
                <span>View month range</span>
                <select
                  value={monthRangeMode}
                  onChange={(event) => setMonthRangeMode(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-right text-xs font-extrabold text-slate-900 outline-none sm:flex-none sm:text-left"
                  title="View month range"
                  aria-label="View month range"
                >
                  {MONTH_RANGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setMonthRangeMode('historical')}
                title="Show historical all-time monthly records"
                aria-label="Show historical all-time monthly records"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-slate-800 sm:rounded-full sm:py-1.5"
              >
                <History className="h-4 w-4" />
                Historical All-Time
              </button>
              <div className="break-words text-center text-xs font-bold text-slate-700 sm:text-left">{monthlySummaryDateLabel}</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visibleMonthlySummary.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs font-semibold text-slate-800 md:col-span-2 lg:col-span-3">
                No month records match this range. Use Historical All-Time to see every saved month.
              </div>
            ) : visibleMonthlySummary.map((month) => (
              <button
                key={month.monthKey}
                type="button"
                onClick={() => setSelectedPaidMonthKey(month.monthKey)}
                title={`Open monthly pay details for ${month.label}`}
                aria-label={`Open monthly pay details for ${month.label}`}
                className={`rounded-xl border p-3 text-left shadow-sm transition hover:shadow-md ${
                  selectedPaidMonthKey === month.monthKey
                    ? 'border-yellow-400 bg-yellow-50 text-yellow-950'
                    : 'border-slate-200 bg-slate-50 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold leading-tight">{month.label}</p>
                    <p className="mt-0.5 text-xs leading-tight text-slate-800">
                      {month.totalRecords} total, {month.activeRecords} active, {month.archivedRecords} archived
                    </p>
                    <p className="mt-0.5 text-[11px] font-bold leading-tight text-slate-700">
                      {month.payableRecords} payable{month.cancelledRecords ? `, ${month.cancelledRecords} cancelled` : ''}
                    </p>
                  </div>
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs leading-tight">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Hours</p>
                    <p className="text-sm font-extrabold">{month.hours.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Done</p>
                    <p className="text-sm font-extrabold">{month.workedHours.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Projected</p>
                    <p className="text-sm font-extrabold">{formatCurrency(month.projectedPay)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Earned</p>
                    <p className="text-sm font-extrabold">{formatCurrency(month.earnedPay)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Marked Paid</p>
                    <p className="text-sm font-extrabold">{formatCurrency(month.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Still Owed</p>
                    <p className="text-sm font-extrabold">{formatCurrency(month.owedAmount)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 sm:p-4">
            <div className="flex items-center gap-2 font-extrabold text-slate-950">
              <Building2 className="h-4 w-4" />
              <span>{CSC_COMPANY.shortName} Torrance</span>
            </div>
            <p className="mt-2">{CSC_COMPANY.name}</p>
            <p className="mt-1">{CSC_COMPANY.address}</p>
            <p className="mt-1 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              <a
                href={`tel:${CSC_COMPANY.phone.replace(/[^\d+]/g, '')}`}
                className="font-bold text-blue-700 underline"
              >
                {CSC_COMPANY.phone}
              </a>
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <a
                href={CSC_COMPANY.website}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-blue-700 underline"
              >
                CSC website
              </a>
              <a
                href={WISH_PORTAL_URL}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-blue-700 underline"
              >
                WISH employee portal
              </a>
            </div>
          </div>
        </section>
      </div>

        {deleteConfirm && (
          <div role="dialog" aria-modal="true" aria-labelledby="csc-delete-shift-title" className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-2 sm:px-4 sm:py-6">
            <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-4 shadow-2xl sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="csc-delete-shift-title" className="text-xl font-black text-slate-950">{deleteConfirm.title}</h3>
                  <p className="mt-2 text-sm text-slate-800">
                    Are you sure you want to delete <span className="font-bold text-slate-900">{deleteConfirm.label}</span>?
                  </p>
                </div>
                <CloseScreenButton onClick={cancelDeleteShift} />
              </div>

              <p className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
                {deleteConfirm.message}
              </p>

              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelDeleteShift}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteShift}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                  Yes, delete
                </button>
              </div>
            </div>
          </div>
        )}

        {showAiOverview && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="csc-ai-overview-title"
            className="fixed inset-0 z-[60] flex items-stretch justify-center overflow-hidden bg-slate-950/60 p-0 sm:p-4"
          >
            <div className="flex h-[100dvh] min-w-0 w-full max-w-7xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl">
              <div className="csc-no-print flex flex-col gap-3 border-b border-slate-200 bg-slate-950 px-3 py-3 text-white sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 shrink-0 text-fuchsia-300" />
                    <h2 id="csc-ai-overview-title" className="text-lg font-black sm:text-xl">
                      CSC AI Overview
                    </h2>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-300 sm:text-sm">
                    Generated from your current CSC Shifts data. Refreshes locally without changing shift records.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshAiOverview}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 text-xs font-extrabold text-white hover:bg-slate-700 sm:text-sm"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyAiOverview}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-500 bg-blue-700 px-3 text-xs font-extrabold text-white hover:bg-blue-600 sm:text-sm"
                  >
                    <ListChecks className="h-4 w-4" />
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintSection('csc-ai-overview-print', 'CSC AI Overview')}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-500 bg-emerald-700 px-3 text-xs font-extrabold text-white hover:bg-emerald-600 sm:text-sm"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                  <CloseScreenButton onClick={() => setShowAiOverview(false)} />
                </div>
              </div>

              <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-slate-100 p-3 sm:p-5">
                <main
                  id="csc-ai-overview-print"
                  className="csc-ai-overview-print mx-auto min-w-0 max-w-6xl space-y-5 bg-white p-3 text-slate-950 shadow-sm sm:p-6 print:max-w-none print:space-y-4 print:p-0 print:shadow-none"
                >
                  <section className="rounded-2xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 via-white to-blue-50 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-fuchsia-800">
                          Schedule Summary
                        </p>
                        <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl">
                          Upcoming CSC Work
                        </h1>
                        <p className="mt-2 text-sm font-semibold text-slate-700">
                          {aiOverview.firstShift && aiOverview.lastShift
                            ? `${formatDate(aiOverview.firstShift.startDate)} through ${formatDate(aiOverview.lastShift.startDate)}`
                            : 'No upcoming CSC shifts are currently scheduled.'}
                        </p>
                      </div>
                      <p className="text-xs font-bold text-slate-600">
                        Generated {new Date(aiOverview.generatedAt).toLocaleString('en-US', {
                          month: '2-digit',
                          day: '2-digit',
                          year: '2-digit',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    <div className="csc-ai-summary-grid mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-2xl font-black">{aiOverview.totalShifts}</p>
                        <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-slate-600">Upcoming Shifts</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-2xl font-black">{aiOverview.totalHours.toFixed(1)}</p>
                        <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-slate-600">Scheduled Hours</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-2xl font-black">{formatCurrency(aiOverview.estimatedPay)}</p>
                        <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-slate-600">Projected Gross</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-2xl font-black">{aiOverview.workloadAlerts.length}</p>
                        <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-slate-600">Workload Alerts</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-2xl font-black">{aiOverview.calendarReadyCount}/{aiOverview.totalShifts}</p>
                        <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-slate-600">Calendar Linked</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-3">
                        <p className="text-2xl font-black">{formatCurrency(aiOverview.unpaidCompleted.amount)}</p>
                        <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-slate-600">Completed, Unpaid</p>
                      </div>
                    </div>
                  </section>

                  <section className="grid gap-4 lg:grid-cols-2">
                    <article className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-black uppercase tracking-wide text-blue-800">Next Shift</p>
                          {aiOverview.nextShift ? (
                            <>
                              <h2 className="csc-title-wrap mt-1 text-xl font-black text-slate-950">
                                {getAiShiftPrimaryTitle(aiOverview.nextShift)}
                              </h2>
                              <p className="mt-2 text-sm font-bold text-slate-800">
                                {formatDate(aiOverview.nextShift.startDate)} at {formatTime(aiOverview.nextShift.startTime)}
                                {aiOverview.nextShift.finishTime ? ` to ${formatTime(aiOverview.nextShift.finishTime)}` : ''}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-slate-700">
                                {cleanCscVenueDisplay(aiOverview.nextShift.venue)} | {getShiftHours(aiOverview.nextShift).toFixed(1)} hours | {formatCurrency(getEstimatedPay(aiOverview.nextShift))}
                              </p>
                              <p className="mt-3 inline-flex rounded-full border border-blue-300 bg-white px-3 py-1 text-xs font-black text-blue-900">
                                {aiOverview.nextShiftCountdown}
                              </p>
                            </>
                          ) : (
                            <p className="mt-2 text-sm font-semibold text-slate-700">No upcoming shift.</p>
                          )}
                        </div>
                        <CalendarDays className="h-8 w-8 shrink-0 text-blue-700" />
                      </div>
                    </article>

                    <article className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wide text-emerald-800">This Week</p>
                          <h2 className="mt-1 text-xl font-black text-slate-950">{aiOverview.thisWeek.label}</h2>
                          <div className="csc-ai-week-stats mt-3 grid grid-cols-3 gap-2">
                            <div className="rounded-lg border border-emerald-200 bg-white p-2">
                              <p className="text-lg font-black">{aiOverview.thisWeek.shiftCount}</p>
                              <p className="text-[10px] font-black uppercase text-slate-600">Shifts</p>
                            </div>
                            <div className="rounded-lg border border-emerald-200 bg-white p-2">
                              <p className="text-lg font-black">{aiOverview.thisWeek.hours.toFixed(1)}</p>
                              <p className="text-[10px] font-black uppercase text-slate-600">Hours</p>
                            </div>
                            <div className="rounded-lg border border-emerald-200 bg-white p-2">
                              <p className="text-lg font-black">{formatCurrency(aiOverview.thisWeek.estimatedPay)}</p>
                              <p className="text-[10px] font-black uppercase text-slate-600">Gross</p>
                            </div>
                          </div>
                        </div>
                        <Clock className="h-8 w-8 shrink-0 text-emerald-700" />
                      </div>
                    </article>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide text-slate-600">Venue Breakdown</p>
                        <h2 className="mt-1 text-xl font-black text-slate-950">Where the Hours Are</h2>
                      </div>
                      <Building2 className="h-7 w-7 text-slate-700" />
                    </div>
                    <div className="csc-ai-venue-table-wrap mt-4 overflow-x-auto">
                      <table className="csc-ai-venue-table w-full min-w-[620px] border-collapse text-sm">
                        <thead>
                          <tr className="border-b-2 border-slate-300 text-left text-xs font-black uppercase tracking-wide text-slate-600">
                            <th className="px-2 py-2">Venue</th>
                            <th className="w-24 px-2 py-2 text-right">Shifts</th>
                            <th className="w-28 px-2 py-2 text-right">Hours</th>
                            <th className="w-32 px-2 py-2 text-right">Est. Gross</th>
                          </tr>
                        </thead>
                        <tbody>
                          {aiOverview.venueBreakdown.length ? (
                            aiOverview.venueBreakdown.map((venue) => (
                              <tr key={venue.venue} className="border-b border-slate-200">
                                <td className="px-2 py-2 font-bold text-slate-950">{venue.venue}</td>
                                <td className="px-2 py-2 text-right">{venue.shiftCount}</td>
                                <td className="px-2 py-2 text-right">{venue.hours.toFixed(1)}</td>
                                <td className="px-2 py-2 text-right">{formatCurrency(venue.estimatedPay)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-2 py-6 text-center font-semibold text-slate-600">
                                No upcoming venue data.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-600">Monthly Breakdown</p>
                        <h2 className="mt-1 text-xl font-black text-slate-950">{aiMonthlyViewLabel}</h2>
                      </div>

                      <div className="csc-no-print flex flex-wrap items-center gap-2">
                        {[
                          { value: 'upcoming', label: 'Current + Future' },
                          { value: 'prior', label: 'Prior Months' },
                          { value: 'all', label: 'All Months' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                              setAiMonthView(option.value);
                              setAiSelectedMonthKey('');
                            }}
                            className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-xs font-extrabold transition ${
                              aiMonthView === option.value
                                ? 'border-slate-950 bg-slate-950 text-white'
                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                            }`}
                            aria-pressed={aiMonthView === option.value}
                          >
                            {option.label}
                          </button>
                        ))}

                        <label className="relative">
                          <span className="sr-only">Select a specific CSC shift month</span>
                          <select
                            value={aiMonthView === 'specific' ? aiSelectedMonthKey : ''}
                            onChange={(event) => {
                              const monthKey = event.target.value;
                              setAiSelectedMonthKey(monthKey);
                              setAiMonthView(monthKey ? 'specific' : 'upcoming');
                            }}
                            className="h-9 min-w-[180px] appearance-none rounded-lg border border-slate-300 bg-white py-0 pl-3 pr-9 text-xs font-extrabold text-slate-800 outline-none hover:bg-slate-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                            title="Jump to a specific month"
                            aria-label="Jump to a specific month"
                          >
                            <option value="">Select month...</option>
                            {aiMonthOptions.map((month) => (
                              <option key={month.monthKey} value={month.monthKey}>
                                {month.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        </label>

                        <button
                          type="button"
                          onClick={handlePrintSelectedAiMonthSchedule}
                          disabled={!selectedAiPrintMonth}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-950 bg-slate-950 px-3 text-xs font-extrabold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500"
                          title={
                            selectedAiPrintMonth
                              ? `Print ${selectedAiPrintMonth.label} schedule with hours only`
                              : 'Select a specific month first'
                          }
                          aria-label={
                            selectedAiPrintMonth
                              ? `Print ${selectedAiPrintMonth.label} CSC schedule with hours only`
                              : 'Select a specific month before printing'
                          }
                        >
                          <Printer className="h-4 w-4" />
                          Print Month
                        </button>

                        <CalendarDays className="h-7 w-7 text-slate-700" />
                      </div>
                    </div>

                    <div className="csc-ai-monthly-grid mt-4 grid gap-4">
                      {visibleAiMonthlyBreakdown.length ? (
                        visibleAiMonthlyBreakdown.map((month) => (
                          <article key={month.monthKey} className="csc-ai-month-block rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                              <h3 className="text-base font-black text-slate-950">{month.label}</h3>
                              <p className="text-xs font-extrabold text-slate-700">
                                {month.shifts.length} shifts | {month.hours.toFixed(1)} hours | {formatCurrency(month.estimatedPay)}
                              </p>
                            </div>
                            <div className="mt-2 divide-y divide-slate-200">
                              {month.shifts.map((shift) => (
                                <div
                                  key={shift.id}
                                  className="csc-ai-month-shift-row grid min-w-0 gap-1 py-2 text-sm sm:grid-cols-[92px_150px_150px_minmax(0,1fr)_70px] sm:items-center sm:gap-3"
                                >
                                  <div className="font-black text-slate-950">{formatDate(shift.startDate)}</div>
                                  <div className="font-semibold text-slate-700">
                                    {formatTime(shift.startTime)} - {formatTime(shift.finishTime)}
                                  </div>
                                  <div className="font-semibold text-slate-700">{cleanCscVenueDisplay(shift.venue)}</div>
                                  <div className="csc-title-wrap font-bold text-slate-950">{getAiShiftPrimaryTitle(shift)}</div>
                                  <div className="text-right font-black text-slate-700">{getShiftHours(shift).toFixed(1)}h</div>
                                </div>
                              ))}
                            </div>
                          </article>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-700">
                          No CSC shift records are available for this month view.
                        </div>
                      )}
                    </div>
                  </section>

                  <section className="grid gap-4 lg:grid-cols-2">
                    <article className={`rounded-2xl border p-4 ${
                      aiOverview.workloadAlerts.length
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-emerald-200 bg-emerald-50'
                    }`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className={`text-xs font-black uppercase tracking-wide ${
                            aiOverview.workloadAlerts.length ? 'text-amber-800' : 'text-emerald-800'
                          }`}>
                            Workload Alerts
                          </p>
                          <h2 className="mt-1 text-xl font-black text-slate-950">
                            {aiOverview.workloadAlerts.length
                              ? `${aiOverview.workloadAlerts.length} item${aiOverview.workloadAlerts.length === 1 ? '' : 's'} to watch`
                              : 'Schedule looks manageable'}
                          </h2>
                        </div>
                        <Clock className={`h-7 w-7 ${
                          aiOverview.workloadAlerts.length ? 'text-amber-700' : 'text-emerald-700'
                        }`} />
                      </div>

                      <div className="mt-3 grid gap-2">
                        {aiOverview.workloadAlerts.length ? (
                          aiOverview.workloadAlerts.map((alert, index) => (
                            <div
                              key={`${alert.title}-${index}`}
                              className={`rounded-xl border p-3 ${
                                alert.severity === 'high'
                                  ? 'border-red-300 bg-red-50'
                                  : alert.severity === 'medium'
                                    ? 'border-amber-300 bg-white'
                                    : 'border-slate-200 bg-white'
                              }`}
                            >
                              <p className="text-sm font-black text-slate-950">{alert.title}</p>
                              <p className="mt-1 text-sm font-semibold leading-5 text-slate-700">{alert.detail}</p>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-xl border border-emerald-200 bg-white p-3 text-sm font-semibold text-emerald-900">
                            No 50+ hour seven-day stretch, five-day consecutive run, overlap, or short turnaround was detected.
                          </p>
                        )}
                      </div>
                    </article>

                    <article className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-blue-800">Operational Readiness</p>
                      <h2 className="mt-1 text-xl font-black text-slate-950">What Needs Attention</h2>
                      <div className="csc-ai-readiness-grid mt-4 grid gap-2 sm:grid-cols-2">
                        <div
                          role="button"
                          tabIndex={0}
                          aria-pressed={aiReadinessFocus === 'calendarMissing'}
                          onClick={() => handleToggleAiReadinessFocus('calendarMissing')}
                          onKeyDown={(event) => handleAiReadinessKeyDown(event, 'calendarMissing')}
                          className={`csc-ai-readiness-card cursor-pointer rounded-xl border bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            aiReadinessFocus === 'calendarMissing' ? 'border-blue-600 ring-2 ring-blue-200' : 'border-blue-200'
                          }`}
                        >
                          <p className="text-2xl font-black">{aiOverview.calendarMissing.length}</p>
                          <p className="mt-1 text-xs font-black uppercase text-slate-600">Missing Calendar</p>
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-pressed={aiReadinessFocus === 'missingInformation'}
                          onClick={() => handleToggleAiReadinessFocus('missingInformation')}
                          onKeyDown={(event) => handleAiReadinessKeyDown(event, 'missingInformation')}
                          className={`csc-ai-readiness-card cursor-pointer rounded-xl border bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            aiReadinessFocus === 'missingInformation' ? 'border-blue-600 ring-2 ring-blue-200' : 'border-blue-200'
                          }`}
                        >
                          <p className="text-2xl font-black">{aiOverview.missingInformation.length}</p>
                          <p className="mt-1 text-xs font-black uppercase text-slate-600">Missing Details</p>
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-pressed={aiReadinessFocus === 'rideNeedsAttention'}
                          onClick={() => handleToggleAiReadinessFocus('rideNeedsAttention')}
                          onKeyDown={(event) => handleAiReadinessKeyDown(event, 'rideNeedsAttention')}
                          className={`csc-ai-readiness-card cursor-pointer rounded-xl border bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            aiReadinessFocus === 'rideNeedsAttention' ? 'border-blue-600 ring-2 ring-blue-200' : 'border-blue-200'
                          }`}
                        >
                          <p className="text-2xl font-black">{aiOverview.rideNeedsAttention.length}</p>
                          <p className="mt-1 text-xs font-black uppercase text-slate-600">Ride Plans</p>
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-pressed={aiReadinessFocus === 'calendarReady'}
                          onClick={() => handleToggleAiReadinessFocus('calendarReady')}
                          onKeyDown={(event) => handleAiReadinessKeyDown(event, 'calendarReady')}
                          className={`csc-ai-readiness-card cursor-pointer rounded-xl border bg-white p-3 transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            aiReadinessFocus === 'calendarReady' ? 'border-blue-600 ring-2 ring-blue-200' : 'border-blue-200'
                          }`}
                        >
                          <p className="text-2xl font-black">
                            {aiOverview.calendarReadyCount}/{aiOverview.totalShifts}
                          </p>
                          <p className="mt-1 text-xs font-black uppercase text-slate-600">Calendar Linked</p>
                        </div>
                      </div>

                      {aiReadinessFocus ? (
                        <div className="csc-no-print mt-3 rounded-xl border border-blue-300 bg-white p-3 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-black uppercase tracking-wide text-blue-900">
                              {aiReadinessFocus === 'calendarMissing'
                                ? 'Missing Calendar'
                                : aiReadinessFocus === 'missingInformation'
                                  ? 'Missing Details'
                                  : aiReadinessFocus === 'rideNeedsAttention'
                                    ? 'Ride Plans'
                                    : 'Calendar Linked'}
                            </p>
                            <button type="button" onClick={() => setAiReadinessFocus('')} className="rounded-md px-2 py-1 text-xs font-extrabold text-slate-600 hover:bg-slate-100">
                              Close
                            </button>
                          </div>

                          <div className="mt-2 grid max-h-64 gap-2 overflow-y-auto pr-1">
                            {aiReadinessFocus === 'calendarMissing' ? (
                              aiOverview.calendarMissing.length ? (
                                aiOverview.calendarMissing.map((shift) => (
                                  <div key={shift.id} className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                                    <button type="button" onClick={() => handleOpenAiShiftDetails(shift)} className="min-w-0 flex-1 text-left">
                                      <span className="block truncate text-sm font-black text-slate-950">{getAiShiftPrimaryTitle(shift)}</span>
                                      <span className="mt-0.5 block text-xs font-semibold text-slate-600">
                                        {formatDate(shift.startDate)} | {cleanCscVenueDisplay(shift.venue)}
                                      </span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAddShiftToCalendar(shift)}
                                      disabled={calendarAddingShiftId === shift.id}
                                      className="shrink-0 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-extrabold text-white hover:bg-emerald-600 disabled:bg-slate-400"
                                    >
                                      {calendarAddingShiftId === shift.id ? 'Adding...' : 'Add Calendar'}
                                    </button>
                                  </div>
                                ))
                              ) : (
                                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">No upcoming shifts are missing from Google Calendar.</p>
                              )
                            ) : aiReadinessFocus === 'missingInformation' ? (
                              aiOverview.missingInformation.length ? (
                                aiOverview.missingInformation.map(({ shift, missing }) => (
                                  <button
                                    type="button"
                                    key={shift.id}
                                    onClick={() => handleOpenAiShiftEdit(shift)}
                                    className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-left hover:border-blue-300 hover:bg-blue-100"
                                    title="Edit this CSC shift and add the missing details"
                                    aria-label={`Edit ${getAiShiftPrimaryTitle(shift)} and add missing details`}
                                  >
                                    <span className="block text-sm font-black text-slate-950">{getAiShiftPrimaryTitle(shift)}</span>
                                    <span className="mt-0.5 block text-xs font-semibold text-slate-600">Missing: {missing.join(', ')}</span>
                                  </button>
                                ))
                              ) : (
                                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">No upcoming shifts are missing key details.</p>
                              )
                            ) : aiReadinessFocus === 'rideNeedsAttention' ? (
                              aiOverview.rideNeedsAttention.length ? (
                                aiOverview.rideNeedsAttention.map((shift) => (
                                  <button type="button" key={shift.id} onClick={() => handleOpenAiRidePlan(shift)} className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-left hover:border-blue-300 hover:bg-blue-100">
                                    <span className="block text-sm font-black text-slate-950">{getAiShiftPrimaryTitle(shift)}</span>
                                    <span className="mt-0.5 block text-xs font-semibold text-slate-600">
                                      {formatDate(shift.startDate)} | {cleanCscVenueDisplay(shift.venue)} | Open ride plan
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">No ride plans currently need attention.</p>
                              )
                            ) : (
                              upcomingScheduleShifts.filter((shift) => isShiftCalendarVerified(shift)).length ? (
                                upcomingScheduleShifts.filter((shift) => isShiftCalendarVerified(shift)).map((shift) => (
                                  <button
                                    type="button"
                                    key={shift.id}
                                    onClick={() => {
                                      const linkage = getShiftCalendarLinkage(shift);
                                      if (linkage?.googleCalendarEventLink) {
                                        openCscGoogleCalendarEvent(
                                          linkage.googleCalendarEventLink
                                        );
                                      } else {
                                        handleOpenAiShiftDetails(shift);
                                      }
                                    }}
                                    className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-left hover:border-blue-300 hover:bg-blue-100"
                                  >
                                    <span className="block text-sm font-black text-slate-950">{getAiShiftPrimaryTitle(shift)}</span>
                                    <span className="mt-0.5 block text-xs font-semibold text-slate-600">
                                      {formatDate(shift.startDate)} | {cleanCscVenueDisplay(shift.venue)} | Calendar linked
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">No upcoming shifts are currently linked to Google Calendar.</p>
                              )
                            )}
                          </div>
                        </div>
                      ) : null}

                      {aiOverview.missingInformation.length ? (
                        <div className="csc-ai-missing-details mt-3 rounded-xl border border-blue-200 bg-white p-3">
                          <p className="text-xs font-black uppercase tracking-wide text-slate-600">Missing Shift Details</p>
                          <div className="mt-2 grid gap-2">
                            {aiOverview.missingInformation.slice(0, 6).map(({ shift, missing }) => (
                              <button
                                type="button"
                                key={shift.id}
                                onClick={() => handleOpenAiShiftEdit(shift)}
                                className="w-full cursor-pointer rounded-md px-1 py-0.5 text-left text-sm font-semibold text-slate-700 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                                title="Edit this CSC shift and add the missing details"
                                aria-label={`Edit ${getAiShiftPrimaryTitle(shift)} and add missing details`}
                              >
                                <span className="font-black text-slate-950">{getAiShiftPrimaryTitle(shift)}</span>
                                {' - '}
                                {missing.join(', ')}
                              </button>
                            ))}
                            {aiOverview.missingInformation.length > 6 ? (
                              <p className="text-xs font-bold text-slate-600">
                                Plus {aiOverview.missingInformation.length - 6} more shift{aiOverview.missingInformation.length - 6 === 1 ? '' : 's'}.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  </section>

                  <section className="grid gap-4 lg:grid-cols-2">
                    <article className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-violet-800">Workload Highlights</p>
                      <h2 className="mt-1 text-xl font-black text-slate-950">Busiest and Longest</h2>
                      <dl className="mt-4 grid gap-3 text-sm">
                        <div className="rounded-xl border border-violet-200 bg-white p-3">
                          <dt className="text-xs font-black uppercase text-slate-600">Longest Shift</dt>
                          <dd className="mt-1 font-bold text-slate-950">
                            {aiOverview.longestShift
                              ? `${getAiShiftPrimaryTitle(aiOverview.longestShift)}, ${formatDate(aiOverview.longestShift.startDate)}, ${getShiftHours(aiOverview.longestShift).toFixed(1)} hours`
                              : 'No upcoming shifts'}
                          </dd>
                        </div>
                        <div className="rounded-xl border border-violet-200 bg-white p-3">
                          <dt className="text-xs font-black uppercase text-slate-600">Busiest 7-Day Stretch</dt>
                          <dd className="mt-1 font-bold text-slate-950">
                            {aiOverview.busiestStretch
                              ? `${formatDate(aiOverview.busiestStretch.startDate)} - ${formatDate(aiOverview.busiestStretch.endDate)}, ${aiOverview.busiestStretch.hours.toFixed(1)} hours across ${aiOverview.busiestStretch.shiftCount} shifts`
                              : 'No upcoming shifts'}
                          </dd>
                        </div>
                        <div className="rounded-xl border border-violet-200 bg-white p-3">
                          <dt className="text-xs font-black uppercase text-slate-600">Busiest Month</dt>
                          <dd className="mt-1 font-bold text-slate-950">
                            {aiOverview.busiestMonth
                              ? `${aiOverview.busiestMonth.label}, ${aiOverview.busiestMonth.hours.toFixed(1)} hours`
                              : 'No upcoming shifts'}
                          </dd>
                        </div>
                        <div className="rounded-xl border border-violet-200 bg-white p-3">
                          <dt className="text-xs font-black uppercase text-slate-600">Most-Used Venue</dt>
                          <dd className="mt-1 font-bold text-slate-950">
                            {aiOverview.mostUsedVenue
                              ? `${aiOverview.mostUsedVenue.venue}, ${aiOverview.mostUsedVenue.shiftCount} shifts, ${aiOverview.mostUsedVenue.hours.toFixed(1)} hours`
                              : 'No upcoming shifts'}
                          </dd>
                        </div>
                      </dl>
                    </article>

                    <article className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-cyan-800">Event Mix</p>
                      <h2 className="mt-1 text-xl font-black text-slate-950">What You Are Working</h2>
                      <div className="mt-4 grid gap-2">
                        {aiOverview.eventTypeBreakdown.length ? (
                          aiOverview.eventTypeBreakdown.map((item) => (
                            <div key={item.label} className="grid grid-cols-[minmax(0,1fr)_70px_80px] items-center gap-3 rounded-xl border border-cyan-200 bg-white p-3 text-sm">
                              <span className="font-black text-slate-950">{item.label}</span>
                              <span className="text-right font-bold text-slate-700">{item.shiftCount} shifts</span>
                              <span className="text-right font-bold text-slate-700">{item.hours.toFixed(1)}h</span>
                            </div>
                          ))
                        ) : (
                          <p className="rounded-xl border border-cyan-200 bg-white p-3 text-sm font-semibold text-slate-700">
                            No upcoming event mix available.
                          </p>
                        )}
                      </div>

                      <div className="mt-4 rounded-xl border border-cyan-200 bg-white p-3">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-600">Paycheck Outlook</p>
                        <p className="mt-1 text-lg font-black text-slate-950">
                          {aiOverview.unpaidCompleted.count} completed unpaid shift{aiOverview.unpaidCompleted.count === 1 ? '' : 's'}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-700">
                          {aiOverview.unpaidCompleted.hours.toFixed(1)} completed hours, approximately {formatCurrency(aiOverview.unpaidCompleted.amount)} gross still outstanding.
                        </p>
                      </div>
                    </article>
                  </section>

                  {aiOverview.recentChanges.length ? (
                    <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-orange-800">Recent Local Changes</p>
                      <h2 className="mt-1 text-xl font-black text-slate-950">Since Latest Safety Snapshot</h2>
                      <p className="mt-1 text-xs font-semibold text-slate-600">
                        {aiOverview.safetySnapshotLabel || 'Latest snapshot'}
                        {aiOverview.safetySnapshotCreatedAt
                          ? `, ${new Date(aiOverview.safetySnapshotCreatedAt).toLocaleString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: '2-digit',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}`
                          : ''}
                      </p>
                      <div className="mt-3 grid gap-2">
                        {aiOverview.recentChanges.map((change, index) => (
                          <div key={`${change.title}-${index}`} className="rounded-xl border border-orange-200 bg-white p-3">
                            <p className="text-sm font-black text-slate-950">{change.title}</p>
                            <p className="mt-1 text-sm font-semibold text-slate-700">{change.detail}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </main>

                {selectedAiPrintMonth ? (
                  <section
                    id="csc-ai-month-schedule-print"
                    className="hidden bg-white text-slate-950"
                    aria-label={`${selectedAiPrintMonth.label} CSC schedule print view`}
                  >
                    <h1>{selectedAiPrintMonth.label} CSC Schedule</h1>
                    <p className="csc-month-schedule-summary">
                      {selectedAiPrintMonthShifts.length} shift{selectedAiPrintMonthShifts.length === 1 ? '' : 's'} |{' '}
                      {selectedAiPrintMonthHours.toFixed(1)} total hours
                    </p>

                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Start</th>
                          <th>Finish</th>
                          <th>Venue</th>
                          <th>Event</th>
                          <th>Shift</th>
                          <th>Role</th>
                          <th>Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedAiPrintMonthShifts.map((shift) => (
                          <tr key={`month-print-${shift.id}`}>
                            <td>{formatDate(shift.startDate)}</td>
                            <td>{formatTime(shift.startTime)}</td>
                            <td>{formatTime(shift.finishTime)}</td>
                            <td>{cleanCscVenueDisplay(shift.venue) || 'Venue not entered'}</td>
                            <td>{getAiShiftPrimaryTitle(shift)}</td>
                            <td>{cleanCscDisplayTitle(shift.shiftName || '') || '-'}</td>
                            <td>
                              {cleanCscDisplayTitle(shift.roleName || '', {
                                stripNumericPrefix: false,
                              }) || '-'}
                            </td>
                            <td>{getShiftHours(shift).toFixed(1)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                ) : null}
              </div>

              <div className="csc-no-print flex flex-col gap-2 border-t border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-xs font-semibold text-slate-600">
                  AI Overview is calculated from saved CSC shift data. It does not modify shifts unless you use an action below.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAiOverview(false);
                      setShowScanDrawer(true);
                    }}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-3 text-xs font-extrabold text-blue-900 hover:bg-blue-100 sm:text-sm"
                  >
                    <StickyNote className="h-4 w-4" />
                    Scan CSC Email
                  </button>
                  <button
                    type="button"
                    onClick={handleAddMissingAiOverviewCalendarEvents}
                    disabled={!aiOverview.calendarMissing.length}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#8E24AA] bg-[#8E24AA] px-3 text-xs font-extrabold text-white hover:bg-[#7B1FA2] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 sm:text-sm"
                  >
                    <CalendarPlus className="h-4 w-4" />
                    Add Missing Calendar Events
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAiOverview(false)}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-xs font-extrabold text-slate-900 hover:bg-slate-50 sm:text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showUpcomingScheduleOverlay && (
          <div
            className="fixed inset-0 z-[75] flex items-center justify-center overflow-hidden bg-slate-950/70 p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="csc-upcoming-schedules-title"
          >
            <style>{`
              @media print {
                @page { size: landscape; margin: 0.35in; }
                body.csc-section-printing #csc-upcoming-schedules-print {
                  width: 100% !important;
                  max-width: none !important;
                  min-width: 0 !important;
                  padding: 0 !important;
                  overflow: visible !important;
                  font-family: Arial, Helvetica, sans-serif !important;
                }
                body.csc-section-printing #csc-upcoming-schedules-print h1 {
                  font-size: 15pt !important;
                  margin: 0 0 4pt !important;
                }
                body.csc-section-printing #csc-upcoming-schedules-print h2 {
                  font-size: 10pt !important;
                  margin: 0 0 8pt !important;
                }
                body.csc-section-printing #csc-upcoming-schedules-print table {
                  width: 100% !important;
                  table-layout: fixed !important;
                  border-collapse: collapse !important;
                  font-size: 7.5pt !important;
                  line-height: 1.18 !important;
                }
                body.csc-section-printing #csc-upcoming-schedules-print thead {
                  display: table-header-group !important;
                }
                body.csc-section-printing #csc-upcoming-schedules-print tr {
                  break-inside: avoid !important;
                  page-break-inside: avoid !important;
                }
                body.csc-section-printing #csc-upcoming-schedules-print th,
                body.csc-section-printing #csc-upcoming-schedules-print td {
                  border: 1px solid #64748b !important;
                  padding: 3pt 4pt !important;
                  vertical-align: top !important;
                  overflow-wrap: anywhere !important;
                }
                body.csc-section-printing #csc-upcoming-schedules-print th {
                  background: #e2e8f0 !important;
                  color: #0f172a !important;
                  font-weight: 700 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
            `}</style>

            <div className="flex h-[100dvh] w-full min-w-0 max-w-[1500px] flex-col overflow-hidden bg-white shadow-2xl sm:h-[92vh] sm:rounded-2xl">
              <div className="csc-no-print flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-3 py-3 sm:px-5">
                <CloseScreenButton onClick={() => setShowUpcomingScheduleOverlay(false)} />
                <button
                  type="button"
                  onClick={() => handlePrintSection('csc-upcoming-schedules-print', 'Your Upcoming Schedules')}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:bg-slate-800"
                >
                  <Printer className="h-4 w-4" />
                  Print Upcoming Schedules
                </button>
              </div>

              <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-slate-100 p-3 sm:overflow-auto sm:p-6">
                <section
                  id="csc-upcoming-schedules-print"
                  className="mx-auto w-full min-w-0 max-w-[1400px] bg-white p-4 font-sans text-slate-950 shadow-sm sm:min-w-[1100px] sm:p-5 print:min-w-0 print:max-w-none print:p-0 print:shadow-none"
                >
                  <h1 id="csc-upcoming-schedules-title" className="text-xl font-bold">
                    Welcome to Employee Portal
                  </h1>
                  <h2 className="mt-1 text-base font-bold">Your Upcoming Schedules</h2>

                  <div className="mt-4 space-y-3 sm:hidden print:hidden">
                    {upcomingScheduleShifts.length === 0 ? (
                      <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-8 text-center text-sm font-semibold text-slate-800">
                        No upcoming schedules.
                      </div>
                    ) : (
                      upcomingScheduleShifts.map((shift) => (
                        <article key={shift.id} className="min-w-0 overflow-hidden rounded-lg border border-slate-400 bg-white text-sm shadow-sm">
                          <div className="grid min-w-0 grid-cols-2 divide-x divide-slate-300 bg-slate-200">
                            <div className="min-w-0 p-2.5">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-800">Start Time</p>
                              <p className="mt-1 break-words text-xs font-bold leading-snug text-slate-950">
                                {formatEssStartDateTime(shift.startDate, shift.startTime)}
                              </p>
                            </div>
                            <div className="min-w-0 p-2.5">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-800">Finish Time</p>
                              <p className="mt-1 break-words text-xs font-bold leading-snug text-slate-950">
                                {formatEssFinishDateTime(shift.finishDate || shift.startDate, shift.finishTime)}
                              </p>
                            </div>
                          </div>

                          <dl className="min-w-0 divide-y divide-slate-200">
                            <div className="min-w-0 px-3 py-2.5">
                              <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Venue</dt>
                              <dd className="mt-0.5 break-words font-semibold text-slate-950">
                                {formatEssVenue(shift) || 'Venue not entered'}
                              </dd>
                            </div>
                            <div className="min-w-0 px-3 py-2.5">
                              <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Venue Address</dt>
                              <dd className="mt-0.5 break-words text-slate-800">
                                {shift.address || 'Address not entered'}
                              </dd>
                            </div>
                            <div className="min-w-0 px-3 py-2.5">
                              <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Event</dt>
                              <dd className="csc-title-wrap mt-0.5 text-slate-800">
                                {shift.event || 'Event not entered'}
                              </dd>
                            </div>
                            <div className="min-w-0 px-3 py-2.5">
                              <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-700">Job Name</dt>
                              <dd className="csc-title-wrap mt-0.5 text-slate-800">
                                {shift.jobName || shift.shiftName || shift.roleName || 'Job name not entered'}
                              </dd>
                            </div>
                          </dl>
                        </article>
                      ))
                    )}
                  </div>

                  <div className="mt-4 hidden overflow-x-auto sm:block print:block">
                    <table className="w-full table-fixed border-collapse text-left text-xs leading-snug">
                      <colgroup>
                        <col className="w-[13%]" />
                        <col className="w-[13%]" />
                        <col className="w-[19%]" />
                        <col className="w-[18%]" />
                        <col className="w-[18%]" />
                        <col className="w-[19%]" />
                      </colgroup>
                      <thead>
                        <tr className="bg-slate-200">
                          <th className="border border-slate-500 px-2 py-2 font-bold">Start Time</th>
                          <th className="border border-slate-500 px-2 py-2 font-bold">Finish Time</th>
                          <th className="border border-slate-500 px-2 py-2 font-bold">Venue</th>
                          <th className="border border-slate-500 px-2 py-2 font-bold">Venue Address</th>
                          <th className="border border-slate-500 px-2 py-2 font-bold">Event</th>
                          <th className="border border-slate-500 px-2 py-2 font-bold">Job Name</th>
                        </tr>
                      </thead>
                      <tbody>
                        {upcomingScheduleShifts.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="border border-slate-500 px-3 py-8 text-center font-semibold text-slate-800">
                              No upcoming schedules.
                            </td>
                          </tr>
                        ) : (
                          upcomingScheduleShifts.map((shift) => (
                            <tr key={shift.id} className="odd:bg-white even:bg-slate-50">
                              <td className="border border-slate-500 px-2 py-2 align-top font-semibold">
                                {formatEssStartDateTime(shift.startDate, shift.startTime)}
                              </td>
                              <td className="border border-slate-500 px-2 py-2 align-top font-semibold">
                                {formatEssFinishDateTime(shift.finishDate || shift.startDate, shift.finishTime)}
                              </td>
                              <td className="border border-slate-500 px-2 py-2 align-top">
                                {formatEssVenue(shift) || 'Venue not entered'}
                              </td>
                              <td className="border border-slate-500 px-2 py-2 align-top">
                                {shift.address || 'Address not entered'}
                              </td>
                              <td className="csc-title-wrap border border-slate-500 px-2 py-2 align-top">
                                {shift.event || 'Event not entered'}
                              </td>
                              <td className="csc-title-wrap border border-slate-500 px-2 py-2 align-top">
                                {shift.jobName || shift.shiftName || shift.roleName || 'Job name not entered'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}

        {showPremiumOverlay && (
          <div className="fixed inset-0 z-[70] overflow-x-hidden overflow-y-auto bg-slate-950/70 p-2 sm:px-4 sm:py-6 print:static print:overflow-visible print:bg-white print:p-0">
            <style>{`
              @media print {
                body * { visibility: hidden !important; }
                .csc-premium-print, .csc-premium-print * { visibility: visible !important; }
                .csc-premium-print { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: none !important; border-radius: 0 !important; box-shadow: none !important; padding: 14px !important; }
                .csc-premium-actions { display: none !important; }
                .csc-premium-shift-grid { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px !important; }
                .csc-premium-shift-card { break-inside: avoid !important; page-break-inside: avoid !important; padding: 10px !important; box-shadow: none !important; }
                .csc-premium-shift-title { font-size: 15px !important; line-height: 1.15 !important; }
                .csc-premium-shift-meta { font-size: 10px !important; line-height: 1.2 !important; }
                .csc-premium-shift-row { grid-template-columns: 92px 1fr !important; gap: 8px !important; padding-top: 4px !important; padding-bottom: 4px !important; font-size: 10px !important; line-height: 1.25 !important; }
              }
            `}</style>
            <div className="csc-premium-actions mx-auto mb-2 flex w-full max-w-6xl items-center justify-between gap-2 sm:mb-5 sm:gap-3">
              <CloseScreenButton onClick={() => setShowPremiumOverlay(false)} />
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={handlePrintPremiumView}
                  className="inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-xs font-extrabold text-white shadow-lg hover:bg-slate-800 sm:rounded-2xl sm:px-6 sm:py-3 sm:text-sm"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPremiumView}
                  className="inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-extrabold text-white shadow-lg hover:bg-emerald-700 sm:rounded-2xl sm:px-6 sm:py-3 sm:text-sm"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
              </div>
            </div>

            <div className="csc-premium-print mx-auto min-w-0 max-w-6xl rounded-2xl bg-white px-3 py-5 font-serif text-slate-950 shadow-2xl sm:rounded-3xl sm:px-10 sm:py-12">
              <header className="text-center">
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">CSC Shifts List</h1>
                <p className="mt-3 text-base font-semibold text-slate-800">
                  Structured shift schedule, generated {new Date().toISOString().slice(0, 10)}
                </p>
                <div className="mt-4 border-t-4 border-slate-950 sm:mt-6" />
              </header>

              <section className="mt-5 rounded-2xl border-l-4 border-yellow-600 bg-slate-50 p-3 sm:mt-8 sm:border-l-8 sm:p-5">
                <h2 className="text-xl font-extrabold text-slate-950">{CSC_COMPANY.name} - {CSC_COMPANY.branch}</h2>
                <p className="mt-2 text-sm font-semibold text-slate-700">{CSC_COMPANY.address}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{CSC_COMPANY.phone} | {CSC_COMPANY.website}</p>
              </section>

              <section className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:gap-3 md:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-2xl font-extrabold">{summary.totalShifts}</p>
                  <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-slate-700">Shifts</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-2xl font-extrabold">{summary.totalHours.toFixed(1)}</p>
                  <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-slate-700">Hours</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-2xl font-extrabold">{formatCurrency(summary.estimatedPay)}</p>
                  <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-slate-700">Estimated Pay</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-2xl font-extrabold">{formatCurrency(summary.owedAmount)}</p>
                  <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-slate-700">Still Owed</p>
                </div>
              </section>

              <section className="csc-premium-shift-grid mt-8 grid gap-4 lg:grid-cols-2 print:grid-cols-2 print:gap-3">
                {filteredShifts.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-800">
                    No shifts match the current filters.
                  </div>
                ) : (
                  filteredShifts.map((shift) => (
                    <article key={shift.id} className="csc-premium-shift-card min-w-0 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5 print:p-3 print:shadow-none">
                      <div className="grid min-w-0 grid-cols-[18px_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[18px_minmax(0,1fr)_auto] sm:gap-4">
                        <div className="mt-1 h-4 w-4 border-2 border-slate-950" />
                        <div className="min-w-0">
                          <h3 className="csc-premium-shift-title csc-title-wrap text-xl font-extrabold text-slate-950">{shift.venue || 'CSC Shift'}</h3>
                          <p className="csc-premium-shift-meta csc-title-wrap mt-1 text-sm font-bold text-slate-700">{shift.event || 'Event not entered'}</p>
                          {shouldShowDistinctJobName(shift) ? <p className="csc-premium-shift-meta csc-title-wrap mt-1 text-xs font-semibold text-slate-700">{shift.jobName}</p> : null}
                          {shift.shiftName ? <p className="csc-premium-shift-meta csc-title-wrap mt-1 text-xs font-semibold text-slate-700">Shift Name: {shift.shiftName}</p> : null}
                          {shift.roleName ? <p className="csc-premium-shift-meta csc-title-wrap mt-1 text-xs font-semibold text-slate-700">Role Name: {shift.roleName}</p> : null}
                        </div>
                        <div className="col-start-2 w-fit rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-extrabold text-yellow-900 sm:col-start-auto">
                          {shift.shiftStatus}
                        </div>
                      </div>

                      <div className="mt-4 divide-y divide-slate-200 text-sm">
                        <div className="csc-premium-shift-row grid min-w-0 grid-cols-[90px_minmax(0,1fr)] gap-2 py-2 sm:grid-cols-[135px_minmax(0,1fr)] sm:gap-4">
                          <div className="font-extrabold text-slate-700">Start</div>
                          <div>{formatDate(shift.startDate)} {formatTime(shift.startTime)}</div>
                        </div>
                        <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
                          <div className="font-extrabold text-slate-700">Finish</div>
                          <div>{formatDate(shift.finishDate)} {formatTime(shift.finishTime)}</div>
                        </div>
                        <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
                          <div className="font-extrabold text-slate-700">Venue Address</div>
                          <div>{shift.address || 'Address not shown'}{shift.city ? `, ${shift.city}` : ''}</div>
                        </div>
                        {shift.shiftName && (
                          <div className="csc-premium-shift-row grid grid-cols-[135px_minmax(0,1fr)] gap-4 py-2">
                            <div className="font-extrabold text-slate-700">Shift Name</div>
                            <div className="csc-title-wrap min-w-0">{shift.shiftName}</div>
                          </div>
                        )}
                        {shift.roleName && (
                          <div className="csc-premium-shift-row grid grid-cols-[135px_minmax(0,1fr)] gap-4 py-2">
                            <div className="font-extrabold text-slate-700">Role Name</div>
                            <div className="csc-title-wrap min-w-0">{shift.roleName}</div>
                          </div>
                        )}
                        <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
                          <div className="font-extrabold text-slate-700">Uniform</div>
                          <div>{shift.uniform || 'Not entered'}</div>
                        </div>
                        <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
                          <div className="font-extrabold text-slate-700">Hours</div>
                          <div>{getShiftHours(shift).toFixed(1)}</div>
                        </div>
                        <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
                          <div className="font-extrabold text-slate-700">Hourly Rate</div>
                          <div>{getShiftHourlyRateLabel(shift)}</div>
                        </div>
                        <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
                          <div className="font-extrabold text-slate-700">Estimated Pay</div>
                          <div>{formatCurrency(getEstimatedPay(shift))}</div>
                        </div>
                        <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
                          <div className="font-extrabold text-slate-700">Paid Status</div>
                          <div>
                            {getShiftPaymentStatusLabel(shift)}
                            {shift.shiftStatus !== 'Cancelled' && shift.paymentDate ? `, ${formatShortDate(shift.paymentDate)}` : ''}
                          </div>
                        </div>
                        {shift.parking && (
                          <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
                            <div className="font-extrabold text-slate-700">Parking</div>
                            <div>{shift.parking}</div>
                          </div>
                        )}
                        {shift.supervisor && (
                          <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
                            <div className="font-extrabold text-slate-700">Supervisor</div>
                            <div>{shift.supervisor}</div>
                          </div>
                        )}
                        {shift.notes && (
                          <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
                            <div className="font-extrabold text-slate-700">Notes</div>
                            <div>{shift.notes}</div>
                          </div>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </section>
            </div>
          </div>
        )}

        {selectedWorkedWeek && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/50 p-0 sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="worked-week-title"
          >
            <div
              id="csc-worked-week-print"
              className="flex h-[100dvh] min-w-0 w-full max-w-5xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl"
            >
              <div className="csc-worked-week-header flex min-w-0 flex-col gap-3 border-b border-slate-200 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <h2 id="worked-week-title" className="text-lg font-extrabold leading-tight text-slate-950 sm:text-xl">
                    Shifts Worked, {selectedWorkedWeek.label}
                  </h2>
                  <p className="mt-1 text-sm text-slate-800">
                    Only shifts marked Done are included.
                  </p>
                </div>
                <div className="csc-no-print flex w-full flex-shrink-0 items-center gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handlePrintSection('csc-worked-week-print', `CSC Shifts Worked - ${selectedWorkedWeek.label}`)}
                    className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white shadow-sm hover:bg-slate-800 sm:h-11 sm:flex-none"
                    aria-label={`Print shifts worked for ${selectedWorkedWeek.label}`}
                    title={`Print shifts worked for ${selectedWorkedWeek.label}`}
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedWeekKey('')}
                    className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border-2 border-slate-950 bg-white text-slate-950 shadow-sm hover:bg-slate-100 sm:hidden"
                    aria-label="Close shifts worked screen"
                    title="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="hidden sm:block">
                    <CloseScreenButton onClick={() => setSelectedWeekKey('')} />
                  </div>
                </div>
              </div>

              <div className="csc-worked-week-summary border-b border-slate-200 bg-slate-50 px-3 py-3 sm:px-5 sm:py-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                  <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 sm:col-span-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-700">Worked Shifts</p>
                    <p className="mt-1 text-xl font-extrabold text-slate-950">
                      {selectedWorkedWeek.workedShiftCount} out of {selectedWorkedWeek.shiftCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-700">Worked Hours</p>
                    <p className="mt-1 text-xl font-extrabold text-slate-950">{selectedWorkedWeek.workedHours.toFixed(1)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-700">Estimated Earned Pay</p>
                    <p className="mt-1 text-xl font-extrabold text-emerald-700">{formatCurrency(selectedWorkedWeek.earnedPay)}</p>
                  </div>
                </div>
              </div>

              <div className="csc-print-scroll min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5">
                {selectedWorkedWeek.workedShifts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <p className="text-sm font-bold text-slate-700">No shifts were marked Done for this week.</p>
                  </div>
                ) : (
                  <div className="csc-worked-week-list grid gap-4 lg:grid-cols-2">
                    {selectedWorkedWeek.workedShifts.map((shift) => (
                      <article
                        key={`${shift.recordSource}-${shift.id}`}
                        className="csc-worked-week-card min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="break-words text-base font-extrabold leading-tight text-slate-950 sm:text-lg">{shift.venue || 'CSC Shift'}</h3>
                            <p className="csc-title-wrap mt-0.5 text-sm font-bold text-slate-700">{shift.event || 'Event not entered'}</p>
                            {shouldShowDistinctJobName(shift) ? <p className="csc-title-wrap mt-0.5 text-xs font-semibold text-slate-700">{shift.jobName}</p> : null}
                          </div>
                          <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                            <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-green-800">
                              Done
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-700">
                              {shift.recordSource === 'archived' ? 'Archived' : 'Active'}
                            </span>
                          </div>
                        </div>

                        <div className="csc-worked-week-fields mt-4 grid gap-2 text-sm text-slate-700">
                          <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2 border-t border-slate-100 pt-2 sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-3">
                            <span className="font-extrabold text-slate-950">Start</span>
                            <span className="min-w-0 break-words">{formatDate(shift.startDate)} {formatTime(shift.startTime)}</span>
                          </div>
                          <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2 border-t border-slate-100 pt-2 sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-3">
                            <span className="font-extrabold text-slate-950">Finish</span>
                            <span className="min-w-0 break-words">{formatDate(shift.finishDate)} {formatTime(shift.finishTime)}</span>
                          </div>
                          <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2 border-t border-slate-100 pt-2 sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-3">
                            <span className="font-extrabold text-slate-950">Hours</span>
                            <span>{getShiftHours(shift).toFixed(1)}</span>
                          </div>
                          <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2 border-t border-slate-100 pt-2 sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-3">
                            <span className="font-extrabold text-slate-950">Uniform</span>
                            <span>{shift.uniform || 'Not entered'}</span>
                          </div>
                          <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2 border-t border-slate-100 pt-2 sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-3">
                            <span className="font-extrabold text-slate-950">Est. Pay</span>
                            <span>{formatCurrency(getEstimatedPay(shift))}</span>
                          </div>
                          <div className="grid min-w-0 grid-cols-[72px_minmax(0,1fr)] gap-2 border-t border-slate-100 pt-2 sm:grid-cols-[100px_minmax(0,1fr)] sm:gap-3">
                            <span className="font-extrabold text-slate-950">Paid Status</span>
                            <span>{getShiftPaymentStatusLabel(shift)}</span>
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWeekKey('');
                              handleOpenShiftDetails(shift);
                            }}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-800 hover:bg-cyan-100"
                          >
                            <PanelRightOpen className="h-4 w-4" />
                            Details
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedPaidMonth && (
          <div className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-slate-950/50 p-0 sm:p-3">
            <div
              id="csc-monthly-shifts-print"
              className="flex h-[100dvh] min-w-0 w-full max-w-7xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-full sm:rounded-2xl"
            >
              <div className="csc-no-print flex flex-col gap-3 border-b border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold text-slate-950 sm:text-xl">Monthly CSC Work Report</h2>
                  <p className="mt-1 text-sm text-slate-800">
                    {selectedPaidMonth.label}, monthly totals and Saturday-through-Friday weekly breakdowns.
                  </p>
                </div>
                <div className="csc-no-print flex w-full flex-shrink-0 items-center gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handlePrintSection('csc-monthly-shifts-print', `CSC Shifts - ${selectedPaidMonth.label}`)}
                    className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-extrabold text-white shadow-sm hover:bg-slate-800 sm:h-11 sm:flex-none sm:px-4"
                    aria-label={`Print CSC shifts for ${selectedPaidMonth.label}`}
                    title={`Print CSC shifts for ${selectedPaidMonth.label}`}
                  >
                    <Printer className="h-4 w-4" />
                    <span className="sm:hidden">Print Report</span>
                    <span className="hidden sm:inline">Print Monthly Report</span>
                  </button>
                  <CloseScreenButton onClick={() => setSelectedPaidMonthKey('')} />
                </div>
              </div>

              <div className="csc-print-scroll min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-slate-100 p-0 sm:p-6">
                <div className="csc-monthly-report mx-auto min-w-0 max-w-6xl rounded-none border-0 bg-white px-3 py-4 shadow-none sm:rounded-2xl sm:border sm:border-slate-200 sm:px-8 sm:py-8 sm:shadow-sm">
                  <header className="csc-monthly-report-header border-b-4 border-slate-950 pb-5 text-center">
                    <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-700">Contemporary Services Corporation</p>
                    <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Monthly Work and Pay Report</h1>
                    <p className="mt-2 text-xl font-extrabold text-slate-700">{selectedPaidMonth.label}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-700">
                      Generated {formatDate(toLocalDateKey(new Date()))}
                    </p>
                  </header>

                  <section className="csc-monthly-summary mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-700">Shifts Worked</p>
                      <p className="mt-1 text-[1.25rem] font-black leading-7 text-slate-950">{selectedPaidMonth.paidShifts.filter((shift) => shift.shiftStatus === 'Done').length}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-amber-700">Scheduled Hours</p>
                      <p className="mt-1 text-[1.25rem] font-black leading-7 text-amber-950">{selectedPaidMonth.totalHours.toFixed(1)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-700">Worked Hours</p>
                      <p className="mt-1 text-[1.25rem] font-black leading-7 text-slate-950">{selectedPaidMonth.workedHours.toFixed(1)}</p>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-blue-700">Expected Gross Pay</p>
                      <p className="mt-1 text-[1.25rem] font-black leading-7 text-blue-950">{formatCurrency(selectedPaidMonth.projectedPay)}</p>
                    </div>
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-violet-700">Actual Gross Pay</p>
                      <p className="mt-1 text-[1.25rem] font-black leading-7 text-violet-950">{formatCurrency(selectedPaidMonth.actualGrossPaid)}</p>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-red-700">Gross Still Owed</p>
                      <p className="mt-1 text-[1.25rem] font-black leading-7 text-red-950">{formatCurrency(selectedPaidMonth.owedAmount)}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-900 bg-emerald-800 p-3 shadow-sm">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-emerald-100">Actual Net Paid</p>
                      <p className="mt-1 text-[1.25rem] font-black leading-7 text-white">{formatCurrency(selectedPaidMonth.actualNetReceived)}</p>
                    </div>
                  </section>

                  <div className="csc-monthly-status-strip mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-800">
                    <span>{selectedPaidMonth.paidShifts.length} saved shifts</span>
                    <span>{selectedPaidMonth.paidCount} marked paid</span>
                    <span>{selectedPaidMonth.owedCount} completed and unpaid</span>
                    <span>{selectedPaidMonth.actualPaychecks.length} matching saved paychecks</span>
                    {selectedPaidMonth.openCount ? <span>{selectedPaidMonth.openCount} scheduled or approved</span> : null}
                    {selectedPaidMonth.cancelledCount ? <span>{selectedPaidMonth.cancelledCount} cancelled</span> : null}
                  </div>

                  <section className="csc-monthly-paychecks mt-4 overflow-hidden rounded-xl border border-slate-300">
                    <div className="bg-slate-100 px-4 py-2">
                      <h2 className="text-xs font-extrabold uppercase tracking-wide text-slate-700">
                        Saved Paychecks Used for Actual Gross and Net
                      </h2>
                    </div>
                    {selectedPaidMonth.actualPaychecks.length ? (
                      <>
                      <div className="grid gap-2 p-3 sm:hidden">
                        {selectedPaidMonth.actualPaychecks.map((paycheck, paycheckIndex) => (
                          <article
                            key={`mobile-${getPaycheckIdentity(paycheck, paycheckIndex)}`}
                            className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                          >
                            <div className="flex min-w-0 items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-700">Pay Period</p>
                                <p className="mt-0.5 break-words text-sm font-extrabold text-slate-900">
                                  {getPaycheckPeriodDisplay(paycheck)}
                                </p>
                                {paycheck.reportIsPartial ? (
                                  <p className="mt-1 text-[9px] font-extrabold uppercase tracking-wide text-amber-700">
                                    Selected work dates only
                                  </p>
                                ) : null}
                              </div>
                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-extrabold text-slate-700">
                                {paycheck.checkNumber ? `#${paycheck.checkNumber}` : formatShortDate(paycheck.checkDate) || 'Saved'}
                              </span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <div className="rounded-lg bg-violet-50 p-2">
                                <p className="text-[9px] font-extrabold uppercase tracking-wide text-violet-700">Actual Gross</p>
                                <p className="mt-0.5 text-sm font-black text-violet-900">{formatCurrency(getReportPaycheckGross(paycheck))}</p>
                              </div>
                              <div className="rounded-lg bg-emerald-50 p-2">
                                <p className="text-[9px] font-extrabold uppercase tracking-wide text-emerald-700">Actual Net</p>
                                <p className="mt-0.5 text-sm font-black text-emerald-900">{formatCurrency(getReportPaycheckNet(paycheck))}</p>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                      <div className="hidden overflow-x-auto sm:block print:block">
                        <table className="csc-paycheck-reconciliation w-full border-collapse text-left text-[11px] leading-tight">
                          <thead className="bg-white text-[9px] font-extrabold uppercase tracking-wide text-slate-800">
                            <tr>
                              <th className="px-3 py-2">Pay Period</th>
                              <th className="px-3 py-2">Check</th>
                              <th className="px-3 py-2 text-right">Actual Gross</th>
                              <th className="px-3 py-2 text-right">Actual Net</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {selectedPaidMonth.actualPaychecks.map((paycheck, paycheckIndex) => (
                              <tr key={getPaycheckIdentity(paycheck, paycheckIndex)}>
                                <td className="whitespace-nowrap px-3 py-2 font-bold text-slate-800">
                                  {getPaycheckPeriodDisplay(paycheck)}
                                  {paycheck.reportIsPartial ? (
                                    <div className="mt-0.5 text-[8px] font-extrabold uppercase tracking-wide text-amber-700">
                                      Selected work dates only
                                    </div>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2 text-slate-700">
                                  {paycheck.checkNumber ? `#${paycheck.checkNumber}` : formatShortDate(paycheck.checkDate) || 'Saved paycheck'}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-right font-extrabold text-violet-800">
                                  {formatCurrency(getReportPaycheckGross(paycheck))}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-right font-extrabold text-emerald-800">
                                  {formatCurrency(getReportPaycheckNet(paycheck))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      </>
                    ) : (
                      <p className="px-4 py-3 text-xs font-semibold text-slate-800">
                        No saved paycheck has a pay period matching a completed shift in this report.
                      </p>
                    )}
                  </section>

                  {selectedPaidMonth.weeklyBreakdown.length === 0 ? (
                    <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-800">
                      No CSC shifts are saved for {selectedPaidMonth.label}.
                    </div>
                  ) : (
                    <div className="csc-monthly-weeks mt-6 space-y-6">
                      {selectedPaidMonth.weeklyBreakdown.map((week, weekIndex) => (
                        <section
                          key={week.weekKey}
                          className="csc-monthly-week break-inside-avoid overflow-hidden rounded-xl border border-slate-300"
                        >
                          <div className="csc-monthly-week-header flex flex-col gap-2 border-b border-amber-200 bg-amber-100 px-4 py-3 text-slate-950 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-amber-800">Week {weekIndex + 1}</p>
                              <h2 className="mt-0.5 text-base font-black">{week.label}</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-right text-[10px] sm:grid-cols-5">
                              <div>
                                <p className="font-bold uppercase text-slate-800">Scheduled</p>
                                <p className="mt-0.5 text-sm font-black">{week.hours.toFixed(1)} hrs</p>
                              </div>
                              <div>
                                <p className="font-bold uppercase text-slate-800">Worked</p>
                                <p className="mt-0.5 text-sm font-black">{week.workedHours.toFixed(1)} hrs</p>
                              </div>
                              <div>
                                <p className="font-bold uppercase text-slate-800">Expected Pay</p>
                                <p className="mt-0.5 text-sm font-black">{formatCurrency(week.expectedPay)}</p>
                              </div>
                              <div>
                                <p className="font-bold uppercase text-slate-800">Actual Gross</p>
                                <p className="mt-0.5 text-sm font-black text-violet-800">{formatCurrency(week.actualGrossPaid)}</p>
                              </div>
                              <div className="col-span-2 sm:col-span-1">
                                <p className="font-bold uppercase text-slate-800">Actual Net</p>
                                <p className="mt-0.5 text-sm font-black text-emerald-800">{formatCurrency(week.actualNetReceived)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="grid gap-2 bg-slate-50 p-2.5 sm:hidden print:hidden">
                            {week.shifts.map((shift) => {
                              const expectedPay = shift.shiftStatus === 'Cancelled' ? 0 : getEstimatedPay(shift);
                              const matchingPaychecks = getPaychecksMatchingShift(shift, paychecks).filter(isCscPaycheck);

                              return (
                                <article
                                  key={`mobile-${shift.recordSource}-${shift.id}`}
                                  className={`min-w-0 rounded-xl border p-3 shadow-sm ${
                                    shift.shiftStatus === 'Cancelled'
                                      ? 'border-slate-200 bg-slate-100 text-slate-700'
                                      : 'border-slate-200 bg-white text-slate-800'
                                  }`}
                                >
                                  <div className="flex min-w-0 items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="csc-title-wrap text-sm font-black text-slate-950">
                                        {shift.event || shift.jobName || 'Event not entered'}
                                      </p>
                                      <p className="mt-0.5 break-words text-xs font-bold text-slate-800">
                                        {shift.venue || 'Venue not entered'}
                                      </p>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-extrabold uppercase ${
                                      shift.shiftStatus === 'Cancelled'
                                        ? 'bg-slate-200 text-slate-700'
                                        : shift.shiftStatus === 'Done'
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-blue-100 text-blue-800'
                                    }`}>
                                      {shift.shiftStatus}
                                    </span>
                                  </div>

                                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                                    <div className="col-span-2 rounded-lg bg-slate-50 p-2">
                                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-700">Date and Time</p>
                                      <p className="mt-0.5 font-extrabold text-slate-900">
                                        {formatShortDate(shift.startDate)}, {formatTime(shift.startTime)} - {formatTime(shift.finishTime)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-700">Shift Name</p>
                                      <p className="csc-title-wrap mt-0.5 font-bold">{shift.shiftName || 'Not entered'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-700">Hours</p>
                                      <p className="mt-0.5 font-bold">{shift.shiftStatus === 'Cancelled' ? '0.0' : getShiftHours(shift).toFixed(1)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-700">Expected</p>
                                      <p className="mt-0.5 font-black text-blue-800">{formatCurrency(expectedPay)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-700">Paycheck</p>
                                      <p className="mt-0.5 font-black text-emerald-800">
                                        {matchingPaychecks.length
                                          ? matchingPaychecks.map((paycheck) => paycheck.checkNumber ? `#${paycheck.checkNumber}` : 'Saved').join(', ')
                                          : 'Not saved'}
                                      </p>
                                    </div>
                                  </div>

                                  <div className={`mt-3 border-t pt-2 text-[10px] font-extrabold uppercase ${
                                    shift.paidStatus === 'Paid' ? 'text-emerald-700' : 'text-red-700'
                                  }`}>
                                    {getShiftPaymentStatusLabel(shift)}
                                  </div>
                                </article>
                              );
                            })}

                            <div className="grid grid-cols-2 gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-slate-900">
                              <div>
                                <p className="text-[9px] font-extrabold uppercase text-slate-700">Week Hours</p>
                                <p className="mt-0.5 font-black">{week.hours.toFixed(1)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-extrabold uppercase text-slate-700">Expected Pay</p>
                                <p className="mt-0.5 font-black">{formatCurrency(week.expectedPay)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-extrabold uppercase text-slate-700">Paychecks</p>
                                <p className="mt-0.5 font-black text-emerald-800">{week.actualPaychecks.length} saved</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-extrabold uppercase text-slate-700">Worked</p>
                                <p className="mt-0.5 font-black">{week.workedCount} shifts</p>
                              </div>
                            </div>
                          </div>

                          <div className="csc-monthly-week-table hidden overflow-x-auto sm:block print:block">
                            <table className="w-full table-fixed border-collapse text-left text-[11px] leading-tight">
                              <colgroup>
                                <col style={{ width: '14%' }} />
                                <col style={{ width: '21%' }} />
                                <col style={{ width: '17%' }} />
                                <col style={{ width: '14%' }} />
                                <col style={{ width: '7%' }} />
                                <col style={{ width: '10%' }} />
                                <col style={{ width: '8%' }} />
                                <col style={{ width: '9%' }} />
                              </colgroup>
                              <thead className="bg-slate-100 text-[9px] font-extrabold uppercase tracking-wide text-slate-800">
                                <tr>
                                  <th className="px-3 py-2">Date and Time</th>
                                  <th className="px-3 py-2">Event</th>
                                  <th className="px-3 py-2">Venue</th>
                                  <th className="px-3 py-2">Shift Name</th>
                                  <th className="px-3 py-2 text-right">Hours</th>
                                  <th className="px-3 py-2 text-right">Expected</th>
                                  <th className="px-3 py-2 text-right">Paycheck</th>
                                  <th className="px-3 py-2">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {week.shifts.map((shift) => {
                                  const expectedPay = shift.shiftStatus === 'Cancelled' ? 0 : getEstimatedPay(shift);
                                  const matchingPaychecks = getPaychecksMatchingShift(shift, paychecks).filter(isCscPaycheck);

                                  return (
                                    <tr key={`${shift.recordSource}-${shift.id}`} className={shift.shiftStatus === 'Cancelled' ? 'bg-slate-50 text-slate-700' : 'text-slate-800'}>
                                      <td className="whitespace-nowrap px-3 py-2 align-top font-bold">
                                        <div>{formatShortDate(shift.startDate)}</div>
                                        <div className="mt-0.5 font-semibold text-slate-800">
                                          {formatTime(shift.startTime)} - {formatTime(shift.finishTime)}
                                        </div>
                                      </td>
                                      <td className="csc-title-wrap px-3 py-2 align-top font-bold text-slate-950">
                                        {shift.event || shift.jobName || 'Event not entered'}
                                      </td>
                                      <td className="csc-title-wrap px-3 py-2 align-top">{shift.venue || 'Venue not entered'}</td>
                                      <td className="csc-title-wrap px-3 py-2 align-top">{shift.shiftName || 'Not entered'}</td>
                                      <td className="whitespace-nowrap px-3 py-2 text-right align-top">{shift.shiftStatus === 'Cancelled' ? '0.0' : getShiftHours(shift).toFixed(1)}</td>
                                      <td className="whitespace-nowrap px-3 py-2 text-right align-top font-bold">{formatCurrency(expectedPay)}</td>
                                      <td className="px-3 py-2 text-right align-top font-bold text-emerald-800">
                                        {matchingPaychecks.length
                                          ? matchingPaychecks.map((paycheck) => paycheck.checkNumber ? `#${paycheck.checkNumber}` : 'Saved').join(', ')
                                          : 'Not saved'}
                                      </td>
                                      <td className="px-3 py-2 align-top">
                                        <div className="font-bold">{shift.shiftStatus}</div>
                                        <div className={`mt-0.5 text-[9px] font-extrabold uppercase ${shift.paidStatus === 'Paid' ? 'text-emerald-700' : 'text-red-700'}`}>
                                          {getShiftPaymentStatusLabel(shift)}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot className="border-t-2 border-slate-300 bg-amber-50 font-extrabold text-slate-950">
                                <tr>
                                  <td colSpan={4} className="px-3 py-2">Week Total</td>
                                  <td className="whitespace-nowrap px-3 py-2 text-right">{week.hours.toFixed(1)}</td>
                                  <td className="whitespace-nowrap px-3 py-2 text-right">{formatCurrency(week.expectedPay)}</td>
                                  <td className="whitespace-nowrap px-3 py-2 text-right text-emerald-800">
                                    {week.actualPaychecks.length} saved
                                  </td>
                                  <td className="px-3 py-2">{week.workedCount} worked</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </section>
                      ))}
                    </div>
                  )}

                  <footer className="csc-monthly-footer mt-6 border-t border-slate-300 pt-3 text-[9px] leading-relaxed text-slate-700">
                    Estimated earned pay is calculated from completed shift hours and saved rates, including overtime and double time. Actual gross and net use saved CSC paychecks whose pay periods match completed shifts in this report. When a pay period crosses a month or report boundary, only the earnings tied to completed shifts inside this report are included, and net pay uses the same share. Each paycheck is counted once. Estimated still owed includes completed shifts not marked Paid.
                  </footer>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedDetailShift && (
          <div className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-slate-950/50 p-0 sm:p-4">
            <div
              id="csc-shift-details-print"
              className="flex h-[100dvh] min-w-0 w-full max-w-3xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-full sm:rounded-2xl"
            >
              <div className="flex flex-col gap-3 border-b border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold text-slate-950 sm:text-xl">CSC Shift Details</h2>
                  <p className="text-sm text-slate-800">Full shift record with restore, edit, archive, and delete actions.</p>
                </div>
                <div className="csc-no-print flex flex-shrink-0 items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrintSection('csc-shift-details-print', `CSC Shift Details - ${selectedDetailShift.venue || 'Shift'}`)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm hover:bg-slate-800 sm:h-11 sm:w-11"
                    aria-label="Print CSC shift details"
                    title="Print CSC shift details"
                  >
                    <Printer className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseShiftDetails}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-100 sm:h-11 sm:w-11"
                    aria-label="Close CSC shift details"
                    title="Close CSC shift details"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="csc-no-print border-b border-slate-200 bg-slate-50 px-3 py-3 sm:px-5">
                <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-700">
                  Actions
                </p>
                {selectedDetailShiftIsArchived
                  ? renderArchivedShiftDetailActions(selectedDetailShift)
                  : renderShiftDetailActions(selectedDetailShift)}
              </div>

              <div className="csc-print-scroll min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5">
                <div className="min-w-0 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 sm:p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="csc-title-wrap text-xl font-extrabold text-slate-950 sm:text-2xl">{selectedDetailShift.venue || 'CSC Shift'}</h3>
                      <p className="csc-title-wrap mt-1 font-bold text-slate-800">{selectedDetailShift.event || 'Event not entered'}</p>
                      {shouldShowDistinctJobName(selectedDetailShift) ? <p className="csc-title-wrap mt-1 text-sm text-slate-800">{selectedDetailShift.jobName}</p> : null}
                      {selectedDetailShift.shiftName ? <p className="csc-title-wrap mt-1 text-sm text-slate-800">Shift Name: {selectedDetailShift.shiftName}</p> : null}
                      {selectedDetailShift.roleName ? <p className="csc-title-wrap mt-1 text-sm text-slate-800">Role Name: {selectedDetailShift.roleName}</p> : null}
                    </div>
                    <div className="rounded-full border border-yellow-300 bg-white px-3 py-1 text-xs font-extrabold text-yellow-900">
                      {selectedDetailShift.shiftStatus}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-700">Start</p>
                    <p className="mt-1 font-bold text-slate-950">{formatDate(selectedDetailShift.startDate)} {formatTime(selectedDetailShift.startTime)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-700">Finish</p>
                    <p className="mt-1 font-bold text-slate-950">{formatDate(selectedDetailShift.finishDate)} {formatTime(selectedDetailShift.finishTime)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-700">Venue Address</p>
                    <p className="mt-1 font-bold text-slate-950">{selectedDetailShift.address || 'Address not shown'}</p>
                    <p className="text-sm text-slate-800">{selectedDetailShift.city}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-700">Shift / Role</p>
                    <p className="csc-title-wrap mt-1 text-sm text-slate-700">Shift Name: {selectedDetailShiftRoleFields.shiftName || 'Not entered'}</p>
                    <p className="csc-title-wrap text-sm text-slate-700">Role Name: {selectedDetailShiftRoleFields.roleName || 'Not entered'}</p>
                    <p className="text-sm text-slate-700">Uniform: {selectedDetailShift.uniform || 'Not entered'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-700">Pay</p>
                    <p className="mt-1 font-bold text-slate-950">{getShiftHours(selectedDetailShift).toFixed(1)} hours at {getShiftHourlyRateLabel(selectedDetailShift)}</p>
                    <p className="text-sm font-bold text-emerald-700">Estimated Pay: {formatCurrency(getEstimatedPay(selectedDetailShift))}</p>
                    {hasReconciledPaycheck(selectedDetailShift) ? (
                      <>
                        <p className="text-sm font-bold text-violet-700">Actual Gross: {formatCurrency(getShiftActualGrossPay(selectedDetailShift))}</p>
                        <p className="text-sm font-bold text-emerald-700">Actual Net: {formatCurrency(getShiftActualNetPay(selectedDetailShift))}</p>
                        <p className="text-xs font-semibold text-slate-800">Check #{selectedDetailShift.reconciledCheckNumber || 'Linked'}</p>
                      </>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-700">Paid Status</p>
                    <p className="mt-1 font-bold text-slate-950">{getShiftPaymentStatusLabel(selectedDetailShift)}</p>
                    <p className="text-sm text-slate-800">
                      {selectedDetailShift.shiftStatus === 'Cancelled'
                        ? 'No payment due'
                        : selectedDetailShiftPayDate
                          ? formatShortDate(selectedDetailShiftPayDate)
                          : 'No payment date entered'}
                    </p>
                    {selectedDetailShift.shiftStatus !== 'Cancelled'
                      ? renderArchivedPaidControls(
                          selectedDetailShift,
                          true,
                          selectedDetailShiftIsArchived ? 'archived' : 'active'
                        )
                      : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-700">
                      {shouldOmitParkingForShift(selectedDetailShift) ? 'Supervisor' : 'Supervisor / Parking'}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">Supervisor: {selectedDetailShift.supervisor || 'Not entered'}</p>
                    {!shouldOmitParkingForShift(selectedDetailShift) ? (
                      <p className="text-sm text-slate-700">Parking: {selectedDetailShift.parking || 'Not entered'}</p>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 md:col-span-2">
                    <p className="text-xs font-extrabold uppercase text-slate-700">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selectedDetailShift.notes || 'No notes entered.'}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {showArchiveDrawer && (
          <div role="dialog" aria-modal="true" aria-labelledby="csc-shift-archive-title" className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-slate-950/50 p-0 sm:p-4">
            <div
              id="csc-shift-archive-print"
              className="flex h-[100dvh] min-w-0 w-full max-w-5xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-full sm:rounded-2xl"
            >
              <div className="flex flex-col gap-3 border-b border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <h2 id="csc-shift-archive-title" className="text-lg font-extrabold text-slate-950 sm:text-xl">Past CSC Shifts</h2>
                  <p className="text-sm text-slate-800">All past, completed, archived, and recoverable shift records.</p>
                </div>
                <div className="csc-no-print flex w-full flex-shrink-0 items-center gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handlePrintSection('csc-shift-archive-print', 'CSC Shift Archive')}
                    className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white shadow-sm hover:bg-slate-800 sm:h-11 sm:flex-none"
                    aria-label="Print CSC shift archive"
                    title="Print CSC shift archive"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                  <CloseScreenButton onClick={() => setShowArchiveDrawer(false)} />
                </div>
              </div>

              <div className="border-b border-slate-200 bg-slate-50 px-3 py-3 sm:px-5 sm:py-4">
                <div className="csc-no-print grid gap-3 lg:grid-cols-[1fr_220px_auto]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                    <input
                      type="text"
                      value={archiveSearch}
                      onChange={(event) => setArchiveSearch(event.target.value)}
                      placeholder="Search past shifts, such as Karol G..."
                      className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                    />
                  </div>
                  <select
                    value={archiveStatusFilter}
                    onChange={(event) => setArchiveStatusFilter(event.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  >
                    <option value="All">All statuses</option>
                    {SHIFT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setArchiveSearch('');
                      setArchiveStatusFilter('All');
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
                  >
                    Clear
                  </button>
                </div>
                <p className="mt-3 text-xs font-bold text-slate-800">
                  Showing {filteredArchivedShifts.length} of {pastShiftRecords.length} past shifts.
                </p>
              </div>

              <div className="csc-print-scroll min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5">
                {filteredArchivedShifts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-800">
                    No past CSC shifts match the current filters.
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {filteredArchivedShifts.map((shift) => (
                      <article key={shift.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <h3 className="csc-title-wrap text-lg font-extrabold text-slate-950">{shift.venue || 'CSC Shift'}</h3>
                            <p className="csc-title-wrap mt-1 text-sm font-bold text-slate-700">{shift.event || 'Event not entered'}</p>
                            {shouldShowDistinctJobName(shift) ? <p className="csc-title-wrap mt-1 text-xs font-semibold text-slate-700">{shift.jobName}</p> : null}
                            {shift.shiftName ? <p className="csc-title-wrap mt-1 text-xs font-semibold text-slate-700">Shift Name: {shift.shiftName}</p> : null}
                            {shift.roleName ? <p className="csc-title-wrap mt-1 text-xs font-semibold text-slate-700">Role Name: {shift.roleName}</p> : null}
                          </div>
                          <span className="w-fit rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-extrabold text-yellow-900">
                            {shift.recordSource === 'snapshot' ? 'Recoverable' : shift.shiftStatus}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-2 text-sm text-slate-700">
                          <div className="grid min-w-0 grid-cols-[78px_minmax(0,1fr)] gap-2 border-t border-slate-100 pt-2 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
                            <span className="font-extrabold text-slate-950">Start</span>
                            <span>{formatDate(shift.startDate)} {formatTime(shift.startTime)}</span>
                          </div>
                          <div className="grid min-w-0 grid-cols-[78px_minmax(0,1fr)] gap-2 border-t border-slate-100 pt-2 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
                            <span className="font-extrabold text-slate-950">Finish</span>
                            <span>{formatDate(shift.finishDate)} {formatTime(shift.finishTime)}</span>
                          </div>
                          <div className="grid min-w-0 grid-cols-[78px_minmax(0,1fr)] gap-2 border-t border-slate-100 pt-2 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
                            <span className="font-extrabold text-slate-950">Hours</span>
                            <span>{getShiftHours(shift).toFixed(1)}</span>
                          </div>
                          <div className="grid min-w-0 grid-cols-[78px_minmax(0,1fr)] gap-2 border-t border-slate-100 pt-2 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
                            <span className="font-extrabold text-slate-950">Pay</span>
                            <span>
                              {formatCurrency(getEstimatedPay(shift))} - {getShiftPaymentStatusLabel(shift)}
                              {shift.shiftStatus !== 'Cancelled' && shift.paymentDate ? `, ${formatShortDate(shift.paymentDate)}` : ''}
                            </span>
                          </div>
                          {shift.recordSource !== 'snapshot' && shift.shiftStatus !== 'Cancelled' ? (
                            <div className="border-t border-slate-100 pt-2">
                              <span className="block font-extrabold text-slate-950">Paid Controls</span>
                              {renderArchivedPaidControls(shift, true, shift.recordSource)}
                            </div>
                          ) : null}
                          <div className="grid min-w-0 grid-cols-[78px_minmax(0,1fr)] gap-2 border-t border-slate-100 pt-2 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
                            <span className="font-extrabold text-slate-950">Record</span>
                            <span>
                              {shift.recordSource === 'snapshot'
                                ? 'Safety snapshot recovery'
                                : shift.recordSource === 'archived'
                                  ? 'Archived'
                                  : 'Past active record'}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
                          {shift.recordSource === 'snapshot' ? (
                            <button
                              type="button"
                              onClick={() => handleRecoverSnapshotShift(shift)}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
                              aria-label="Recover missing completed shift"
                              title="Recover missing completed shift and edit it"
                            >
                              <RotateCcw className="h-4 w-4" />
                              Recover & Edit
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setShowArchiveDrawer(false);
                                handleOpenEditShift(shift, shift.recordSource === 'archived' ? 'archived' : 'active');
                              }}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900 hover:bg-amber-100"
                              aria-label="Edit past shift"
                              title="Edit past shift"
                            >
                              <Edit3 className="h-4 w-4" />
                              Edit
                            </button>
                          )}
                          {shift.recordSource !== 'snapshot' ? (
                            <button
                              type="button"
                              onClick={() => handleOpenShiftDetails(shift)}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-800 hover:bg-cyan-100"
                              aria-label="Open past shift details"
                              title="Open past shift details"
                            >
                              <PanelRightOpen className="h-4 w-4" />
                              Details
                            </button>
                          ) : null}
                          {shift.recordSource === 'archived' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRestoreArchivedShift(shift.id)}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
                              >
                                <RotateCcw className="h-4 w-4" />
                                Unarchive
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteArchivedShift(shift.id)}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </button>
                            </>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showScanDrawer && (
          <div role="dialog" aria-modal="true" aria-labelledby="csc-shift-scan-title" className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-slate-950/50 p-0 sm:p-4">
            <div className="flex h-[100dvh] min-w-0 w-full max-w-3xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-3 py-3 sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <h2 id="csc-shift-scan-title" className="text-lg font-extrabold text-slate-950 sm:text-xl">Scan CSC Schedule</h2>
                  <p className="text-sm text-slate-800">Paste Wish ESS Upcoming Schedules or a CSC scheduling email. Wish ESS is authoritative. CSC email is secondary and cannot overwrite Wish ESS-confirmed schedule fields.</p>
                </div>
                <CloseScreenButton onClick={() => setShowScanDrawer(false)} />
              </div>

              <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5">
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Schedule text
                  <textarea
                    value={shiftEmailText}
                    onChange={(event) => {
                      setShiftEmailText(event.target.value);
                      setScannedShifts([]);
                    }}
                    rows={9}
                    placeholder={'Courtesy Shift Reminder & Important Info\n\nSchedule for : David Gregory Hallstrom II\nVenue: SoFi Stadium and Hollywood Park Shift No: 2 Shift: Vertical - Elevator and Escalator - TC Scheduled Start Time: 6/21/2026 5:30:00 AM Scheduled Finish: 6/21/2026 4:30:00 PM\n\nDNS ROSALIA N1\tThe Forum\t1ST RAMPS\tSecurity Guard\t6/29/2026 4:00:00 PM\t6/29/2026 11:30:00 PM\tENTRY POINT ADDRESS: 3600 Pincay Dr, Inglewood, CA, 90305 Parking will be at SoFi lot D.\tSIGN-IN IS NEXT TO THE BIG WHITE HOUSE ON THE SOUTHEAST CORNER OF THE PROPERTY.\tAll Black Everything.'}
                    className="min-w-0 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 font-normal text-slate-950 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
                  <button
                    type="button"
                    onClick={handleScanAcceptanceEmail}
                    className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-amber-700"
                  >
                    Scan & Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShiftEmailText('');
                      setScannedShifts([]);
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                  {scannedShifts.length > 0 ? (
                    <button
                      type="button"
                      onClick={handleAddScannedShift}
                      className="col-span-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-extrabold text-white shadow-sm hover:bg-emerald-800 sm:col-auto"
                    >
                      Update Shift Schedule ({scannedShifts.length})
                    </button>
                  ) : null}
                </div>

                {scannedShifts.length > 0 && (
                  <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-900">
                    <div className="mb-3 flex min-w-0 items-center justify-between gap-2">
                      <h3 className="min-w-0 text-base font-extrabold text-slate-950 sm:text-lg">Scanned Shift Preview</h3>
                      <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-extrabold text-amber-800">
                        {scannedShifts.length} shift{scannedShifts.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="grid gap-3">
                      {scannedShifts.map((item) => (
                        <article key={item.id} className="rounded-xl border border-amber-200 bg-white p-3">
                          <div className="grid gap-2 md:grid-cols-2">
                            <p><strong>Start:</strong> {formatDate(item.startDate)} {formatTime(item.startTime)}</p>
                            <p><strong>Finish:</strong> {formatDate(item.finishDate)} {formatTime(item.finishTime)}</p>
                            <p><strong>Venue:</strong> {item.venue || 'Needs venue'}</p>
                            <p><strong>Address:</strong> {[item.address, item.city].filter(Boolean).join(', ') || 'Needs address'}</p>
                            <p className="csc-title-wrap md:col-span-2"><strong>Event:</strong> {item.event || 'Not detected'}</p>
                            <p className="csc-title-wrap md:col-span-2"><strong>Job:</strong> {item.jobName || 'Not detected'}</p>
                            {item.shiftName ? <p className="csc-title-wrap md:col-span-2"><strong>Shift Name:</strong> {item.shiftName}</p> : null}
                            {item.roleName ? <p className="csc-title-wrap md:col-span-2"><strong>Role Name:</strong> {item.roleName}</p> : null}
                            {item.uniform ? <p className="md:col-span-2"><strong>Uniform:</strong> {item.uniform}</p> : null}
                            {item.parking ? (
                              <p className="md:col-span-2 whitespace-pre-wrap"><strong>Parking:</strong> {item.parking}</p>
                            ) : null}
                            {item.notes ? (
                              <p className="md:col-span-2 whitespace-pre-wrap"><strong>Notes:</strong> {item.notes}</p>
                            ) : null}
                            <p><strong>Hours:</strong> {getShiftHours(item).toFixed(1)}</p>
                            <p><strong>Estimated Pay:</strong> {formatCurrency(getEstimatedPay(item))}</p>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-slate-200 px-3 py-3 sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:px-5 sm:py-4">
                <button
                  type="button"
                  onClick={() => setShowScanDrawer(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddScannedShift}
                  disabled={!scannedShift}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {scannedShifts.length > 1
                    ? `Update Schedule with ${scannedShifts.length} Shifts`
                    : 'Update Shift Schedule'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddDrawer && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="csc-shift-form-title"
            className={`fixed inset-0 flex items-end justify-center overflow-hidden bg-slate-950/40 p-0 sm:items-center sm:p-4 ${
              showAiOverview ? 'z-[80]' : 'z-50'
            }`}
          >
            <div className="h-[100dvh] min-w-0 w-full max-w-5xl overflow-x-hidden overflow-y-auto rounded-none bg-white p-3 shadow-2xl sm:max-h-[92vh] sm:h-auto sm:rounded-2xl sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <h2 id="csc-shift-form-title" className="text-lg font-extrabold text-slate-950 sm:text-xl">{editingShiftId ? 'Edit CSC Shift' : 'Add CSC Shift'}</h2>
                  <p className="text-sm text-slate-800">
                    {editingShiftId
                      ? 'Update the shift details, then save your changes.'
                      : 'Create a new CSC shift and save it to this browser.'}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
                  {!editingShiftId && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddDrawer(false);
                        setEditingShiftId(null);
                        setEditingShiftLocation('active');
                        setNewShift(createBlankShift());
                        setShowScanDrawer(true);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-2.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 sm:gap-2 sm:px-4 sm:text-sm"
                      title="Scan CSC shift email"
                    >
                      <StickyNote className="h-4 w-4" />
                      <span className="hidden min-[360px]:inline">Scan Email</span>
                    </button>
                  )}
                  <CloseScreenButton onClick={() => { setShowAddDrawer(false); setEditingShiftId(null); setEditingShiftLocation('active'); setNewShift(createBlankShift()); }} />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Start Date
                  <input
                    type="date"
                    value={newShift.startDate}
                    onChange={(event) => setNewShift((current) => ({ ...current, startDate: event.target.value, finishDate: current.finishDate || event.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Start Time
                  <input
                    type="time"
                    value={newShift.startTime}
                    onChange={(event) => setNewShift((current) => ({ ...current, startTime: event.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Finish Date
                  <input
                    type="date"
                    value={newShift.finishDate}
                    onChange={(event) => setNewShift((current) => ({ ...current, finishDate: event.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Finish Time
                  <input
                    type="time"
                    value={newShift.finishTime}
                    onChange={(event) => setNewShift((current) => ({ ...current, finishTime: event.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700 md:col-span-2">
                  Venue
                  <input
                    type="text"
                    value={newShift.venue}
                    onChange={(event) => setNewShift((current) => ({ ...current, venue: event.target.value }))}
                    placeholder="SoFi Stadium"
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  City
                  <input
                    type="text"
                    value={newShift.city}
                    onChange={(event) => setNewShift((current) => ({ ...current, city: event.target.value }))}
                    placeholder="Inglewood"
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Hourly Rate
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newShift.hourlyRate}
                    onChange={(event) => setNewShift((current) => ({ ...current, hourlyRate: event.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700 md:col-span-2">
                  Venue Address
                  <input
                    type="text"
                    value={newShift.address}
                    onChange={(event) => setNewShift((current) => ({ ...current, address: event.target.value }))}
                    placeholder="3883 W Century Blvd"
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700 md:col-span-2">
                  Event
                  <input
                    type="text"
                    value={newShift.event}
                    onChange={(event) => setNewShift((current) => ({ ...current, event: event.target.value }))}
                    placeholder="2026 FIFA World Cup"
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700 md:col-span-2">
                  Job Name
                  <input
                    type="text"
                    value={newShift.jobName}
                    onChange={(event) => setNewShift((current) => ({ ...current, jobName: event.target.value }))}
                    placeholder="CSC job name"
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700 md:col-span-2">
                  <span>Shift Name <span className="font-semibold text-slate-600">(optional, editable)</span></span>
                  <input
                    type="text"
                    value={newShift.shiftName}
                    onChange={(event) => setNewShift((current) => ({ ...current, shiftName: event.target.value }))}
                    placeholder="Enter the actual shift name"
                    autoComplete="off"
                    className="rounded-lg border border-slate-400 bg-white px-3 py-2 font-normal text-slate-950 placeholder:text-slate-500 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700 md:col-span-2">
                  <span>Role Name <span className="font-semibold text-slate-600">(optional, editable)</span></span>
                  <input
                    type="text"
                    value={newShift.roleName}
                    onChange={(event) => setNewShift((current) => ({ ...current, roleName: event.target.value }))}
                    placeholder="Enter the actual role name"
                    autoComplete="off"
                    className="rounded-lg border border-slate-400 bg-white px-3 py-2 font-normal text-slate-950 placeholder:text-slate-500 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Status
                  <select
                    value={newShift.shiftStatus}
                    onChange={(event) => setNewShift((current) => ({ ...current, shiftStatus: event.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  >
                    {SHIFT_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Paid Status
                  <select
                    value={newShift.paidStatus}
                    onChange={(event) => setNewShift((current) => ({ ...current, paidStatus: event.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  >
                    {PAID_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Payment Date
                  <input
                    type="date"
                    value={newShift.paymentDate}
                    onChange={(event) => setNewShift((current) => ({ ...current, paymentDate: event.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Supervisor
                  <input
                    type="text"
                    value={newShift.supervisor}
                    onChange={(event) => setNewShift((current) => ({ ...current, supervisor: event.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                {!shouldOmitParkingForShift(newShift) ? (
                  <label className="grid gap-1 text-sm font-bold text-slate-700">
                    Parking
                    <input
                      type="text"
                      value={newShift.parking}
                      onChange={(event) => setNewShift((current) => ({ ...current, parking: event.target.value }))}
                      className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                    />
                  </label>
                ) : null}

                <label className="grid gap-1 text-sm font-bold text-slate-700 md:col-span-2 xl:col-span-4">
                  Notes
                  <textarea
                    value={newShift.notes}
                    onChange={(event) => setNewShift((current) => ({ ...current, notes: event.target.value }))}
                    rows={4}
                    placeholder="Shift notes..."
                    className="resize-y rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setNewShift(createBlankShift())}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAddDrawer(false); setEditingShiftId(null); setEditingShiftLocation('active'); setNewShift(createBlankShift()); }}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddShift}
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-extrabold text-white hover:bg-slate-800"
                >
                  Save CSC Shift
                </button>
              </div>
            </div>
          </div>
        )}
        {saveMessage ? (
          <div
            role="status"
            aria-live="polite"
            className="csc-no-print fixed bottom-4 left-1/2 z-[120] flex w-[calc(100%_-_2rem)] max-w-2xl -translate-x-1/2 items-start gap-3 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-2xl"
          >
            <span className="min-w-0 flex-1">{saveMessage}</span>
            <button
              type="button"
              onClick={() => setSaveMessage('')}
              className="rounded-md p-1 text-slate-300 hover:bg-white/10 hover:text-white"
              aria-label="Dismiss message"
              title="Dismiss message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
    </PageContainer>
  );
};

export default CscShiftsTab;
