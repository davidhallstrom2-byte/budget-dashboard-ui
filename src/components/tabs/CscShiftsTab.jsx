import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  ChevronRight,
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
  Trash2,
  X
} from 'lucide-react';
import PageContainer from '../common/PageContainer.jsx';
import TabPageHeader, { TAB_HEADER_ACTION_CLASS } from '../common/TabPageHeader.jsx';
import CloseScreenButton from '../common/CloseScreenButton.jsx';
import {
  createGoogleCalendarEvent,
  ensureGoogleCalendarEventLabel,
  updateGoogleCalendarEvent,
} from '../../utils/googleCalendarApi';

const CSC_STORAGE_KEY = 'cscShifts.v1';
const CSC_ARCHIVE_STORAGE_KEY = 'cscShifts.archived.v1';
const CSC_DELETED_SEED_STORAGE_KEY = 'cscShifts.deletedSeedIds.v1';
const CSC_SNAPSHOT_STORAGE_KEY = 'cscShifts.safetySnapshot.v1';
const CSC_CALENDAR_ADDED_STORAGE_KEY = 'cscShifts.googleCalendarAdded.v1';
const CSC_SHIFT_UPDATE_EVENT = 'cscShifts:updated';
const CSC_OPEN_SHIFT_STORAGE_KEY = 'cscShifts.openLinkedShiftId.v1';
const CSC_RETURN_CONTEXT_STORAGE_KEY = 'cscShifts.returnContext.v1';
const CSC_CREATE_DRAFT_STORAGE_KEY = 'cscShifts.createDraftFromOpportunity.v1';
const CSC_OPPORTUNITIES_STORAGE_KEY = 'cscOpportunities.v1';
const CSC_OPPORTUNITIES_UPDATE_EVENT = 'cscOpportunities:updated';
const RIDES_STORAGE_KEY = 'modivcareRides.v1';
const RIDES_ARCHIVE_STORAGE_KEY = 'modivcareRides.archived.v1';
const RIDES_CREATE_DRAFT_STORAGE_KEY = 'modivcareRides.createDraftFromOpportunity.v1';
const PAYCHECK_STORAGE_KEY = 'paychecksTab.paychecks.v1';
const PAYCHECK_UPDATE_EVENT = 'paychecksChanged';
const APP_NAVIGATE_EVENT = 'app:navigate';
const DEFAULT_HOURLY_RATE = '19.50';
const OLD_DEFAULT_HOURLY_RATES = ['15.50', '20.50'];
const OVERTIME_HOUR_THRESHOLD = 8;
const DOUBLE_TIME_HOUR_THRESHOLD = 12;
const OVERTIME_RATE_MULTIPLIER = 1.5;
const DOUBLE_TIME_RATE_MULTIPLIER = 2;
const DEFAULT_VISIBLE_SHIFT_COUNT = 5;
const CSC_GOOGLE_CALENDAR_LABEL_ID = 'c5c5c5c5-5c5c-4c5c-8c5c-c5c5c5c5c5c5';
const CSC_GOOGLE_CALENDAR_LABEL_NAME = 'CSC Shifts';
const CSC_GOOGLE_CALENDAR_BACKGROUND_COLOR = '#B8860B';

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
    venue: 'SoFi Stadium and Hollywood Park',
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
    venue: 'SoFi Stadium and Hollywood Park',
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
    venue: 'SoFi Stadium and Hollywood Park',
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
    venue: 'SoFi Stadium and Hollywood Park',
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
    venue: 'SoFi Stadium and Hollywood Park',
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
    venue: 'SoFi Stadium and Hollywood Park',
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
    venue: 'SoFi Stadium and Hollywood Park',
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

const normalizeShiftStatus = (value) => {
  const status = String(value || '').trim();

  if (!status) return 'Scheduled';
  if (status === 'Worked') return 'Scheduled';
  if (status === 'Approved' || status === 'Confirmed') return 'Scheduled';
  if (status === 'Paid') return 'Done';
  if (status === 'Complete' || status === 'Completed') return 'Done';

  return SHIFT_STATUS_OPTIONS.includes(status) ? status : 'Scheduled';
};

const cleanCscEventTitle = (value = '') =>
  String(value || '')
    .replace(/[([{]\s*DNS\s*[)\]}]/gi, ' ')
    .replace(/\bDNS\b/gi, ' ')
    .replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, ' ')
    .replace(/(?:\s*[-–—:|/]\s*){2,}/g, ' - ')
    .replace(/\s*([-–—:|/])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-–—:|/]+|[\s\-–—:|/]+$/g, '')
    .trim();

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

const normalizeShift = (shift = {}) => {
  const rawNotes = shift.notes || '';
  const shiftName = shift.shiftName || getShiftNameFromCscNotes(rawNotes);
  const roleName = shift.roleName || getRoleNameFromCscNotes(rawNotes);
  const uniform = deriveCscUniformFromRoleName(roleName, shift.venue);

  return {
    id: shift.id || `csc-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    startDate: shift.startDate || '',
    startTime: shift.startTime || '',
    finishDate: shift.finishDate || shift.startDate || '',
    finishTime: shift.finishTime || '',
    venue: shift.venue || '',
    city: shift.city || '',
    address: shift.address || '',
    event: cleanCscEventTitle(shift.event),
    jobName: cleanCscEventTitle(shift.jobName),
    shiftName,
    roleName,
    shiftStatus: normalizeShiftStatus(shift.shiftStatus),
    hourlyRate: normalizeHourlyRate(shift.hourlyRate),
    paidStatus: shift.paidStatus || 'Unpaid',
    paymentDate: shift.paymentDate || '',
    notes: cleanCscShiftNotes(rawNotes, uniform),
    parking: shouldOmitParkingForShift(shift) ? '' : cleanCscParkingText(shift.parking || ''),
    uniform,
    supervisor: shift.supervisor || '',
    createdFromOpportunityId: shift.createdFromOpportunityId || shift.linkedOpportunityId || '',
    linkedOpportunityId: shift.linkedOpportunityId || shift.createdFromOpportunityId || '',
    googleCalendarEventId: shift.googleCalendarEventId || '',
    googleCalendarEventLink: shift.googleCalendarEventLink || '',
    googleCalendarAddedAt: shift.googleCalendarAddedAt || '',
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

const formatDate = (value) => {
  if (!value) return '';

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatShortDate = (value) => {
  if (!value) return '';

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
};

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

const dedupeShiftRecords = (records = []) => {
  const deduped = [];
  const removedIds = [];
  const replacementIds = new Map();

  records.forEach((rawShift) => {
    const shift = normalizeShift(rawShift);
    const duplicateIndex = deduped.findIndex((existingShift) => areLikelyDuplicateShifts(existingShift, shift));

    if (duplicateIndex < 0) {
      deduped.push(shift);
      return;
    }

    const existingShift = deduped[duplicateIndex];
    deduped[duplicateIndex] = mergeDuplicateShiftRecords(existingShift, shift, false);

    if (shift.id && shift.id !== existingShift.id) {
      removedIds.push(shift.id);
      replacementIds.set(shift.id, existingShift.id);
    }
  });

  return {
    shifts: deduped.sort((first, second) =>
      `${first.startDate}T${first.startTime}`.localeCompare(`${second.startDate}T${second.startTime}`)
    ),
    removedIds,
    replacementIds,
  };
};

const loadSavedShifts = () => {
  try {
    const saved = localStorage.getItem(CSC_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : null;

    if (!Array.isArray(parsed)) return seedShifts;

    const deletedSeedIds = getDeletedSeedShiftIds();
    const savedById = new Map(parsed.map((shift) => [shift.id, normalizeShift(shift)]));
    const mergedSeeds = seedShifts
      .filter((shift) => !deletedSeedIds.has(shift.id))
      .map((shift) => ({ ...shift, ...(savedById.get(shift.id) || {}) }));
    const seedIds = new Set(seedShifts.map((shift) => shift.id));
    const imported = parsed.filter((shift) => shift?.id && !seedIds.has(shift.id)).map(normalizeShift);
    const mergedShifts = [...mergedSeeds, ...imported].sort((first, second) =>
      `${first.startDate}T${first.startTime}`.localeCompare(`${second.startDate}T${second.startTime}`)
    );
    const dedupeResult = dedupeShiftRecords(mergedShifts);

    if (dedupeResult.removedIds.length) {
      const archivedSaved = localStorage.getItem(CSC_ARCHIVE_STORAGE_KEY);
      const archivedParsed = archivedSaved ? JSON.parse(archivedSaved) : [];
      const snapshot = {
        id: `csc-snapshot-${Date.now()}`,
        label: 'Before automatic CSC duplicate cleanup',
        createdAt: new Date().toISOString(),
        activeShifts: mergedShifts,
        archivedShifts: Array.isArray(archivedParsed) ? archivedParsed : [],
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
      venue: 'SoFi Stadium and Hollywood Park',
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

  if (/kia\s+forum|the\s+forum|3600\s+pincay/i.test(combined)) {
    return {
      venue: venueText || 'The Kia Forum',
      city: 'Inglewood',
      address: addressText || '3600 Pincay Dr, Inglewood, CA 90305',
    };
  }

  if (/sofi|hollywood\s+park|3883\s+w\s+century/i.test(combined)) {
    return {
      venue: venueText || 'SoFi Stadium and Hollywood Park',
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

const getScheduleTableCell = (cells = [], index = 0) => String(cells[index] || '').trim();

const normalizeScheduleVenueName = (value = '') => {
  const venueText = cleanScannedTextBlock(value);

  if (/^(the\s+forum|forum)$/i.test(venueText)) return 'The Kia Forum';
  if (/^sofi\s+stadium\s+and\s+hollywood\s+park$/i.test(venueText)) return 'SoFi Stadium and Hollywood Park';

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

  if (headerIndex < 0) return [];

  const emailMatch = source.match(/\b[A-Z0-9._%+-]+@csc-usa\.com\b/i);
  const scheduleForText = source.match(/Dear\s+([^,\n]+),/i)?.[1]?.trim() || '';
  const titleText = source.match(/Your Scheduling Details/i)?.[0] || 'CSC schedule table';
  const dataLines = lines.slice(headerIndex + 1);

  return dataLines
    .map((line) => {
      const cells = line.split('\t').map((cell) => cell.trim());

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

      if (!startDateTime.date || !startDateTime.time || !finishDateTime.time) return null;

      const venueName = normalizeScheduleVenueName(venueCell);
      const entryAddress = extractScheduleEntryAddress(parkingCell);
      const venueInfoFromFields = inferVenueCityFromFields(venueName, entryAddress);
      const venueInfoFromText = inferVenueFromAcceptanceEmail(`${jobNameCell} ${shiftNameCell}`, venueCell);
      const venueInfo = venueInfoFromFields.venue || venueInfoFromFields.address ? venueInfoFromFields : venueInfoFromText;
      const cleanedJobName = cleanScannedInlineText(jobNameCell);
      const cleanedShiftName = cleanScannedInlineText(shiftNameCell);
      const cleanedRoleName = cleanScannedInlineText(roleNameCell);
      const cleanedSignIn = cleanKiaForumSignIn(signInCell);
      const parking = extractScheduleParking(parkingCell);
      const uniform = normalizeCscUniformType(`${uniformCell} ${line}`);
      const eventText = /fifa|world\s*cup/i.test(cleanedJobName) ? '2026 FIFA World Cup' : cleanEventNameFromJob(cleanedJobName);
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

const parseAcceptanceEmails = (text) => {
  const tableShifts = parseSchedulingDetailsTableEmail(text);

  if (tableShifts.length) return tableShifts;

  const kiaForumShifts = parseKiaForumScheduleEmail(text);

  if (kiaForumShifts.length) return kiaForumShifts;

  const singleShift = parseAcceptanceEmail(text);

  return singleShift ? [singleShift] : [];
};

const normalizeForScanCompare = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

const getScannedShiftMatchScore = (existingShift = {}, scannedShift = {}) => {
  let score = 0;

  if (scanTextIncludes(existingShift.venue, scannedShift.venue)) score += 2;
  if (scanTextIncludes(existingShift.address, scannedShift.address)) score += 2;
  if (scanTextIncludes(existingShift.jobName, scannedShift.jobName)) score += 2;
  if (scanTextIncludes(existingShift.shiftName, scannedShift.shiftName)) score += 2;
  if (scanTextIncludes(existingShift.roleName, scannedShift.roleName)) score += 1;
  if (scanTextIncludes(existingShift.event, scannedShift.event)) score += 1;
  if (scanTextIncludes(existingShift.city, scannedShift.city)) score += 1;

  return score;
};

const isScannedScheduleChangeMatch = (existingShift = {}, scannedShift = {}) => {
  if (!hasCompleteShiftWindow(existingShift) || !hasCompleteShiftWindow(scannedShift)) return false;
  if (existingShift.startDate !== scannedShift.startDate) return false;

  const startTimeMatches = existingShift.startTime === scannedShift.startTime;
  const finishWindowMatches =
    (existingShift.finishDate || existingShift.startDate) ===
      (scannedShift.finishDate || scannedShift.startDate) &&
    existingShift.finishTime === scannedShift.finishTime;

  // A safe schedule-change match requires one stable end of the shift window.
  // If both ends changed, the scanner refuses to guess and adds a separate shift.
  if (startTimeMatches === finishWindowMatches) return false;

  const venueOrAddressMatches =
    scanTextIncludes(existingShift.venue, scannedShift.venue) ||
    scanTextIncludes(existingShift.address, scannedShift.address);
  const eventIdentityMatches =
    scanTextIncludes(existingShift.jobName, scannedShift.jobName) ||
    scanTextIncludes(existingShift.shiftName, scannedShift.shiftName) ||
    scanTextIncludes(existingShift.event, scannedShift.event);

  return venueOrAddressMatches && eventIdentityMatches && getScannedShiftMatchScore(existingShift, scannedShift) >= 5;
};

const findMatchingShiftIdForScannedEmail = (currentShifts = [], scannedShift = {}) => {
  if (!scannedShift?.startDate || !scannedShift?.startTime) return '';

  const scheduleChangeMatches = currentShifts.filter((shift) =>
    isScannedScheduleChangeMatch(shift, scannedShift)
  );

  if (scheduleChangeMatches.length === 1) return scheduleChangeMatches[0].id;

  const exactIdMatch = currentShifts.find((shift) => shift.id === scannedShift.id);
  if (exactIdMatch && areLikelyDuplicateShifts(exactIdMatch, scannedShift)) return exactIdMatch.id;

  if (hasCompleteShiftWindow(scannedShift)) {
    const sameWindowShifts = currentShifts.filter((shift) => shiftWindowsMatch(shift, scannedShift));
    const strongWindowMatch = sameWindowShifts.find(
      (shift) => areLikelyDuplicateShifts(shift, scannedShift) || getScannedShiftMatchScore(shift, scannedShift) >= 4
    );

    if (strongWindowMatch) return strongWindowMatch.id;
  }

  const sameStartDuplicate = currentShifts.find((shift) => areLikelyDuplicateShifts(shift, scannedShift));

  return sameStartDuplicate?.id || '';
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

const mergeScannedShiftWithExisting = (existingShift = {}, scannedShift = {}) =>
  mergeDuplicateShiftRecords(existingShift, scannedShift, true);

const hasShiftCalendarTimeChanged = (existingShift = {}, updatedShift = {}) =>
  hasCompleteShiftWindow(existingShift) &&
  hasCompleteShiftWindow(updatedShift) &&
  getShiftWindowKey(existingShift) !== getShiftWindowKey(updatedShift);

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
            <div>
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
    .summary-card span { display: block; margin-top: 3px; color: #64748b; font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .company { border-left: 8px solid #d97706; background: #f8fafc; border-radius: 14px; padding: 14px 18px; margin-bottom: 18px; }
    .company strong { display: block; font-size: 18px; }
    .company p { margin: 4px 0 0; color: #334155; }
    .shifts-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
    .shift-card { border: 1px solid #dbe4ee; border-radius: 14px; padding: 12px 14px; break-inside: avoid; page-break-inside: avoid; }
    .shift-title-row { display: grid; grid-template-columns: 15px 1fr auto; gap: 9px; align-items: start; }
    .checkbox { width: 12px; height: 12px; border: 2px solid #0f172a; margin-top: 4px; }
    h2 { margin: 0; font-size: 16px; line-height: 1.15; }
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

const formatWeekRange = (startDate, endDate) => {
  const start = startDate.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  });
  const end = endDate.toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: '2-digit',
  });

  return `${start} - ${end}`;
};

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

const getPaychecksMatchingShift = (shift = {}, paychecks = []) => {
  const shiftDate = normalizePaycheckDate(shift.startDate);
  if (!shiftDate) return [];

  return paychecks.filter((paycheck) => {
    const periodRange = getPaycheckPeriodRange(paycheck);
    const matchesPayPeriod = Boolean(
      periodRange &&
      shiftDate >= periodRange.startDate &&
      shiftDate <= periodRange.endDate
    );
    const matchesScannedWorkDate = getPaycheckWorkDates(paycheck).has(shiftDate);

    return matchesPayPeriod || matchesScannedWorkDate;
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
  const [recentAutoArchive, setRecentAutoArchive] = useState(null);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showScanDrawer, setShowScanDrawer] = useState(false);
  const [showArchiveDrawer, setShowArchiveDrawer] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveStatusFilter, setArchiveStatusFilter] = useState('All');
  const [shiftEmailText, setShiftEmailText] = useState('');
  const [scannedShifts, setScannedShifts] = useState([]);
  const scannedShift = scannedShifts[0] || null;
  const setScannedShift = (nextShift) => setScannedShifts(nextShift ? [nextShift] : []);
  const [archivedShifts, setArchivedShifts] = useState(() => loadArchivedShifts());
  const [premiumView] = useState(false);
  const [showPremiumOverlay, setShowPremiumOverlay] = useState(false);
  const [newShift, setNewShift] = useState(() => createBlankShift());
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [visibleShiftLimit, setVisibleShiftLimit] = useState(DEFAULT_VISIBLE_SHIFT_COUNT);
  const [isShiftTableCollapsed, setIsShiftTableCollapsed] = useState(false);
  const [selectedDetailShiftId, setSelectedDetailShiftId] = useState(null);
  const [detailReturnContext, setDetailReturnContext] = useState(null);
  const [movingShiftId, setMovingShiftId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [calendarAddingShiftId, setCalendarAddingShiftId] = useState('');
  const [paychecks, setPaychecks] = useState(() => readStoredPaychecks());
  const [selectedPaidMonthKey, setSelectedPaidMonthKey] = useState('');
  const [selectedWeekKey, setSelectedWeekKey] = useState('');
  const toolbarImportInputRef = useRef(null);
  const venueFilterRef = useRef(null);
  const shiftBrowserRef = useRef(null);
  const calendarAddLockRef = useRef(new Set());
  const autoArchiveUndoTimerRef = useRef(null);
  const completedShiftMigrationRef = useRef(false);

  useEffect(() => () => {
    if (autoArchiveUndoTimerRef.current) {
      window.clearTimeout(autoArchiveUndoTimerRef.current);
    }
  }, []);

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
    try {
      localStorage.setItem(CSC_STORAGE_KEY, JSON.stringify(shifts));
      window.dispatchEvent(new CustomEvent(CSC_SHIFT_UPDATE_EVENT, { detail: { shifts } }));
    } catch (error) {
      console.error('Failed to save CSC shifts:', error);
    }
  }, [shifts]);

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

  const handleAddShiftToCalendar = async (shift) => {
    if (!shift?.id || calendarAddLockRef.current.size) return;

    if (shift.googleCalendarEventLink) {
      window.open(shift.googleCalendarEventLink, '_blank', 'noopener,noreferrer');
      return;
    }

    if (shift.googleCalendarEventId) {
      window.alert('This shift is already linked to Google Calendar, but its calendar link is unavailable.');
      return;
    }

    const registryEntry = findCalendarRegistryEntry(shift);
    const linkedShift = [...shifts, ...archivedShifts].find((candidate) => {
      if (candidate.id === shift.id) return false;
      if (!candidate.googleCalendarEventId && !candidate.googleCalendarEventLink) return false;

      const candidateKeys = new Set(getShiftCalendarIdentityKeys(candidate));
      return getShiftCalendarIdentityKeys(shift).some((identityKey) =>
        candidateKeys.has(identityKey)
      );
    });
    const existingCalendarFields = registryEntry || linkedShift || null;

    if (existingCalendarFields) {
      const restoredFields = {
        googleCalendarEventId: existingCalendarFields.googleCalendarEventId || '',
        googleCalendarEventLink: existingCalendarFields.googleCalendarEventLink || '',
        googleCalendarAddedAt: existingCalendarFields.googleCalendarAddedAt || '',
      };

      saveCalendarRegistryEntry(shift, restoredFields);
      updateShift(shift.id, restoredFields);

      if (restoredFields.googleCalendarEventLink) {
        window.open(restoredFields.googleCalendarEventLink, '_blank', 'noopener,noreferrer');
      } else {
        window.alert(
          'This shift is already marked as added to Google Calendar. No duplicate event was created.'
        );
      }
      return;
    }

    if (!shift.startDate || !shift.startTime || !shift.finishTime) {
      window.alert('Start date, start time, and finish time are required before adding this shift to Google Calendar.');
      return;
    }

    try {
      calendarAddLockRef.current.add(shift.id);
      setCalendarAddingShiftId(shift.id);
      await ensureCscGoogleCalendarLabel();
      const createdEvent = await createGoogleCalendarEvent(buildShiftCalendarEventPayload(shift));
      const calendarFields = {
        googleCalendarEventId: createdEvent?.id || '',
        googleCalendarEventLink: createdEvent?.htmlLink || '',
        googleCalendarAddedAt: new Date().toISOString(),
      };
      saveCalendarRegistryEntry(shift, calendarFields);
      updateShift(shift.id, calendarFields);
      setSaveMessage('CSC shift added to Google Calendar.');
      setTimeout(() => setSaveMessage(''), 2500);
    } catch (error) {
      window.alert(error?.message || 'Could not add this CSC shift to Google Calendar.');
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

  const handleAddShift = () => {
    const preparedShift = normalizeShift({
      ...newShift,
      id: editingShiftId || newShift.id,
      finishDate: newShift.finishDate || newShift.startDate,
    });

    if (!preparedShift.startDate || !preparedShift.startTime || !preparedShift.finishTime || !preparedShift.venue) {
      setSaveMessage('Save skipped. Start date, start time, finish time, and venue are required.');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    if (editingShiftId) {
      writeCscSafetySnapshot('Before CSC shift edit', shifts, archivedShifts);
      setShifts((currentShifts) =>
        currentShifts
          .map((shift) => (shift.id === editingShiftId ? preparedShift : shift))
          .sort((a, b) => `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`))
      );
      setSaveMessage('CSC shift updated.');
    } else {
      setShifts((currentShifts) =>
        [...currentShifts, preparedShift].sort((a, b) => `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`))
      );
      setSaveMessage('CSC shift added.');
    }

    setNewShift(createBlankShift());
    setEditingShiftId(null);
    setShowAddDrawer(false);
    setTimeout(() => setSaveMessage(''), 2500);
  };

  const handleOpenAddShift = () => {
    setNewShift(createBlankShift());
    setEditingShiftId(null);
    setShowAddDrawer(true);
  };

  const handleOpenEditShift = (shift) => {
    setNewShift(normalizeShift(shift));
    setEditingShiftId(shift.id);
    setShowAddDrawer(true);
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

  const completeAndArchiveShift = (shift) => {
    if (!shift?.id) return;

    writeCscSafetySnapshot('Before CSC shift completed and archived', shifts, archivedShifts);

    const originalShift = normalizeShift(shift);
    const archivedShift = normalizeShift({
      ...shift,
      shiftStatus: 'Done',
      paidStatus: 'Unpaid',
      paymentDate: '',
      archivedAt: new Date().toISOString(),
    });

    setArchivedShifts((currentArchived) => {
      const nextArchived = [
        archivedShift,
        ...currentArchived.filter((item) => item.id !== archivedShift.id),
      ];
      return nextArchived.sort((a, b) =>
        String(b.archivedAt || '').localeCompare(String(a.archivedAt || ''))
      );
    });
    if (seedShifts.some((seedShift) => seedShift.id === shift.id)) {
      saveDeletedSeedShiftId(shift.id);
    }
    setShifts((currentShifts) => currentShifts.filter((item) => item.id !== shift.id));

    if (autoArchiveUndoTimerRef.current) {
      window.clearTimeout(autoArchiveUndoTimerRef.current);
    }
    setRecentAutoArchive({
      archivedShiftId: archivedShift.id,
      originalShift,
    });
    autoArchiveUndoTimerRef.current = window.setTimeout(() => {
      setRecentAutoArchive((current) =>
        current?.archivedShiftId === archivedShift.id ? null : current
      );
      autoArchiveUndoTimerRef.current = null;
    }, 10000);

    setSaveMessage('CSC shift marked Done and moved to Archived Shifts.');
    window.setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleShiftStatusChange = (shift, nextStatus) => {
    const normalizedStatus = normalizeShiftStatus(nextStatus);

    if (normalizedStatus === 'Done' && normalizeShiftStatus(shift.shiftStatus) !== 'Done') {
      completeAndArchiveShift(shift);
      return;
    }

    updateShift(shift.id, { shiftStatus: normalizedStatus });
  };

  const handleUndoAutoArchive = () => {
    if (!recentAutoArchive) return;

    const { archivedShiftId, originalShift } = recentAutoArchive;

    if (autoArchiveUndoTimerRef.current) {
      window.clearTimeout(autoArchiveUndoTimerRef.current);
      autoArchiveUndoTimerRef.current = null;
    }

    writeCscSafetySnapshot('Before undoing CSC shift completion', shifts, archivedShifts);
    removeDeletedSeedShiftId(archivedShiftId);
    setArchivedShifts((currentArchived) =>
      currentArchived.filter((item) => item.id !== archivedShiftId)
    );
    setShifts((currentShifts) => {
      const currentById = new Map(currentShifts.map((item) => [item.id, item]));
      currentById.set(archivedShiftId, normalizeShift(originalShift));
      return Array.from(currentById.values()).sort((a, b) =>
        `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`)
      );
    });
    setRecentAutoArchive(null);
    setSaveMessage('Done was undone. CSC shift restored to Active Shifts.');
    window.setTimeout(() => setSaveMessage(''), 3000);
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

    setArchivedShifts((currentArchived) => {
      const nextArchived = [archivedShift, ...currentArchived.filter((item) => item.id !== id)];
      return nextArchived.sort((a, b) => String(b.archivedAt || '').localeCompare(String(a.archivedAt || '')));
    });
    if (seedShifts.some((seedShift) => seedShift.id === id)) {
      saveDeletedSeedShiftId(id);
    }
    setShifts((currentShifts) => currentShifts.filter((item) => item.id !== id));
    setSaveMessage('CSC shift archived.');
    setTimeout(() => setSaveMessage(''), 2500);
  };

  const handleRestoreArchivedShift = (id) => {
    const shift = archivedShifts.find((item) => item.id === id);
    const label = shift?.jobName || shift?.event || 'this shift';

    if (!shift || !window.confirm(`Restore ${label}?`)) return;

    const { archivedAt, ...restoredShift } = shift;

    writeCscSafetySnapshot('Before CSC shift restore', shifts, archivedShifts);

    removeDeletedSeedShiftId(id);
    setShifts((currentShifts) => {
      const currentById = new Map(currentShifts.map((item) => [item.id, item]));
      currentById.set(id, normalizeShift(restoredShift));

      return Array.from(currentById.values()).sort((a, b) =>
        `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`)
      );
    });
    setArchivedShifts((currentArchived) => currentArchived.filter((item) => item.id !== id));
    if (selectedDetailShiftId === id) {
      setSelectedDetailShiftId(null);
    }
    setSaveMessage('CSC shift unarchived.');
    setTimeout(() => setSaveMessage(''), 2500);
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

  const renderArchivedPaidControls = (shift, compact = false) => shift.shiftStatus === 'Cancelled' ? null : (
    <div className={compact ? 'mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3' : 'mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3'}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={shift.paidStatus || 'Unpaid'}
          onChange={(event) => updateArchivedShift(shift.id, { paidStatus: event.target.value })}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
          title="Update archived paid status"
          aria-label="Update archived paid status"
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
          onChange={(event) => updateArchivedShift(shift.id, { paymentDate: event.target.value })}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
          title="Archived payment date"
          aria-label="Archived payment date"
        />
        <button
          type="button"
          onClick={() => handleToggleArchivedPaidStatus(shift)}
          className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-extrabold text-white ${
            shift.paidStatus === 'Paid' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
          }`}
          title={shift.paidStatus === 'Paid' ? 'Mark archived shift unpaid' : 'Mark archived shift paid'}
          aria-label={shift.paidStatus === 'Paid' ? 'Mark archived shift unpaid' : 'Mark archived shift paid'}
        >
          {shift.paidStatus === 'Paid' ? 'Mark Unpaid' : 'Mark Paid'}
        </button>
      </div>
      {!compact ? (
        <p className="mt-2 text-xs font-semibold text-slate-600">
          Use this after the paycheck lands. This updates archived records and the Monthly Pay Summary.
        </p>
      ) : null}
    </div>
  );

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
      writeCscSafetySnapshot('Before archived CSC shift delete', shifts, archivedShifts);
      setArchivedShifts((currentArchived) => currentArchived.filter((item) => item.id !== deleteConfirm.id));
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
      setShowAddDrawer(true);
    };

    const openArchiveDrawer = () => setShowArchiveDrawer(true);
    const openImport = () => toolbarImportInputRef.current?.click();
    const saveSnapshot = () => handleManualSafetySnapshot();
    const exportShifts = () => handleExportCsv();

    window.addEventListener('csc-toolbar:add', openAddShift);
    window.addEventListener('csc-toolbar:archive', openArchiveDrawer);
    window.addEventListener('csc-toolbar:snapshot', saveSnapshot);
    window.addEventListener('csc-toolbar:save', saveSnapshot);
    window.addEventListener('csc-toolbar:export', exportShifts);
    window.addEventListener('csc-toolbar:import', openImport);

    return () => {
      window.removeEventListener('csc-toolbar:add', openAddShift);
      window.removeEventListener('csc-toolbar:archive', openArchiveDrawer);
      window.removeEventListener('csc-toolbar:snapshot', saveSnapshot);
      window.removeEventListener('csc-toolbar:save', saveSnapshot);
      window.removeEventListener('csc-toolbar:export', exportShifts);
      window.removeEventListener('csc-toolbar:import', openImport);
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

  const filteredArchivedShifts = useMemo(() => {
    const query = archiveSearch.trim().toLowerCase();

    return archivedShifts.filter((shift) => {
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
  }, [archiveSearch, archiveStatusFilter, archivedShifts]);

  const summary = useMemo(() => {
    const payableShifts = filteredShifts.filter((shift) => shift.shiftStatus !== 'Cancelled');
    const doneShifts = payableShifts.filter((shift) => shift.shiftStatus === 'Done');
    const totalHours = payableShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0);
    const estimatedPay = payableShifts.reduce((sum, shift) => sum + getEstimatedPay(shift), 0);
    const paidAmount = payableShifts.reduce(
      (sum, shift) => sum + (shift.paidStatus === 'Paid' ? getEstimatedPay(shift) : 0),
      0
    );
    const owedAmount = doneShifts.reduce(
      (sum, shift) => sum + (shift.paidStatus !== 'Paid' ? getEstimatedPay(shift) : 0),
      0
    );
    const workedHours = doneShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0);
    const soFiCount = filteredShifts.filter((shift) => /sofi/i.test(shift.venue)).length;
    const firstShift = filteredShifts[0];
    const lastShift = filteredShifts[filteredShifts.length - 1];

    return {
      totalShifts: filteredShifts.length,
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
  }, [filteredShifts]);

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
      current.earnedPay += isDone ? estimatedPay : 0;
      current.paidAmount += shift.paidStatus === 'Paid' && !isCancelled ? estimatedPay : 0;
      current.owedAmount += isDone && shift.paidStatus !== 'Paid' ? estimatedPay : 0;

      grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [archivedShifts, shifts]);

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
    const scheduledMonths = monthlySummary.filter((month) => month.hours > 0);

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
        workedMonths.length > 0
          ? workedMonths.reduce((sum, month) => sum + month.workedHours, 0) / workedMonths.length
          : 0,
      averageScheduledMonth:
        scheduledMonths.length > 0
          ? scheduledMonths.reduce((sum, month) => sum + month.hours, 0) / scheduledMonths.length
          : 0,
      workedMonthCount: workedMonths.length,
      scheduledMonthCount: scheduledMonths.length,
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
      currentWeek.paidAmount += isPaid ? expectedPay : 0;
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
            className={`h-4 w-4 shrink-0 transition-transform ${allShiftRowsVisible ? 'rotate-180' : ''}`}
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

  const handleExportCsv = () => {
    const csv = buildCsv(shifts);
    const dataBlob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'CSC_Shifts_David_Hallstrom_2026.csv';

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

        setShifts((currentShifts) => {
          const currentById = new Map(currentShifts.map((shift) => [shift.id, shift]));

          importedShifts.forEach((shift) => {
            currentById.set(shift.id, normalizeShift({ ...(currentById.get(shift.id) || {}), ...shift }));
          });

          return Array.from(currentById.values()).sort((a, b) =>
            `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`)
          );
        });

        setSaveMessage(`Imported ${importedShifts.length} CSC shift rows.`);
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
      setSaveMessage('Email scan could not find CSC shift or Kia Forum schedule details. Paste the full email text and try again.');
      setTimeout(() => setSaveMessage(''), 3500);
      return;
    }

    const missingFields = Array.from(new Set(parsedShifts.flatMap((parsedShift) => [
      !parsedShift.startDate ? 'start date' : '',
      !parsedShift.startTime ? 'start time' : '',
      !parsedShift.finishTime ? 'finish time' : '',
      !parsedShift.venue ? 'venue' : '',
    ].filter(Boolean))));

    setScannedShifts(parsedShifts);
    setSaveMessage(
      missingFields.length
        ? `Email scanned ${parsedShifts.length} shift${parsedShifts.length === 1 ? '' : 's'} with missing ${missingFields.join(', ')}. Review before adding or updating.`
        : `CSC email scanned ${parsedShifts.length} shift${parsedShifts.length === 1 ? '' : 's'}. Review the preview, then import.`
    );
    setTimeout(() => setSaveMessage(''), 4000);
  };

  const handleAddScannedShift = async () => {
    if (!scannedShifts.length) {
      setSaveMessage('Scan a CSC email before adding shifts.');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    writeCscSafetySnapshot('Before CSC email scan import', shifts, archivedShifts);

    let updatedCount = 0;
    let addedCount = 0;
    let collisionSafeCount = 0;
    let reconciledDuplicateCount = 0;
    let calendarLinkWithoutIdCount = 0;
    const calendarSyncRequests = new Map();
    const currentById = new Map(shifts.map((shift) => [shift.id, shift]));

    scannedShifts.forEach((scannedItem) => {
      const normalizedScannedItem = normalizeShift(scannedItem);
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
            reconciledDuplicateCount += 1;
          }
        }

        updatedCount += 1;
        return;
      }

      const safeId = createUniqueScannedShiftId(currentById, normalizedScannedItem);
      if (safeId !== normalizedScannedItem.id) collisionSafeCount += 1;

      currentById.set(safeId, normalizeShift({ ...normalizedScannedItem, id: safeId }));
      addedCount += 1;
    });

    const dedupeResult = dedupeShiftRecords(Array.from(currentById.values()));
    const removedDuplicateCount = dedupeResult.removedIds.length;
    setShifts(dedupeResult.shifts);

    setShiftEmailText('');
    setScannedShifts([]);
    setShowScanDrawer(false);

    let calendarUpdatedCount = 0;
    const calendarUpdateFailures = [];

    if (calendarSyncRequests.size) {
      try {
        await ensureCscGoogleCalendarLabel();
      } catch (error) {
        console.error('Failed to prepare the CSC Google Calendar background:', error);
        calendarUpdateFailures.push(
          error?.message || 'Google Calendar background setup failed'
        );
        calendarSyncRequests.clear();
      }
    }

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
          googleCalendarAddedAt: request.shift.googleCalendarAddedAt || '',
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

    const details = [
      `Updated ${updatedCount}`,
      `added ${addedCount}`,
      calendarUpdatedCount
        ? `updated ${calendarUpdatedCount} Google Calendar event${calendarUpdatedCount === 1 ? '' : 's'}`
        : '',
      removedDuplicateCount ? `removed ${removedDuplicateCount} duplicate${removedDuplicateCount === 1 ? '' : 's'}` : '',
      reconciledDuplicateCount
        ? `reconciled ${reconciledDuplicateCount} prior scan duplicate${reconciledDuplicateCount === 1 ? '' : 's'}`
        : '',
      collisionSafeCount ? `prevented ${collisionSafeCount} ID collision${collisionSafeCount === 1 ? '' : 's'}` : '',
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
      `CSC email imported safely. ${details.join(', ')}.${
        calendarWarnings.length ? ` Calendar warning: ${calendarWarnings.join('. ')}.` : ''
      }`
    );
    setTimeout(() => setSaveMessage(''), calendarWarnings.length ? 8000 : 5000);
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
  const selectedDetailShiftIsArchived = Boolean(
    selectedDetailShiftId && archivedShifts.some((shift) => shift.id === selectedDetailShiftId)
  );

  const renderShiftActions = (shift) => {
    const linkedRide = getLinkedRideForShift(shift);
    const matchingPaycheckCount = getPaychecksMatchingShift(shift, paychecks).length;
    const calendarAdded = Boolean(shift.googleCalendarEventId || shift.googleCalendarEventLink);
    const calendarBusy = calendarAddingShiftId === shift.id;

    return (
    <div className="w-full sm:w-[154px] sm:max-w-[154px]">
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
                ? 'bg-green-700 ring-2 ring-green-200 hover:bg-green-800'
                : calendarBusy
                  ? 'bg-emerald-400'
                  : 'bg-emerald-600 hover:bg-emerald-700'
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
    const calendarAdded = Boolean(shift.googleCalendarEventId || shift.googleCalendarEventLink);
    const calendarBusy = calendarAddingShiftId === shift.id;

    return (
      <div className="w-full">
        <div className="grid gap-3 lg:grid-cols-[minmax(180px,0.8fr)_minmax(0,2fr)_minmax(220px,1.1fr)]">
          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
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
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              Shift Actions
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <button
                type="button"
                onClick={() => handleOpenEditShift(shift)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-slate-700 px-3 text-xs font-extrabold text-white hover:bg-slate-800"
                aria-label="Edit shift"
                title="Edit shift"
              >
                <Edit3 className="h-4 w-4" />
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleMoveShift(shift.id)}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-amber-600 px-3 text-xs font-extrabold text-white hover:bg-amber-700"
                title="Change shift venue"
                aria-label="Change shift venue"
              >
                Move
              </button>
              <button
                type="button"
                onClick={() => handleAddShiftToCalendar(shift)}
                disabled={calendarBusy}
                className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-extrabold text-white disabled:cursor-wait ${
                  calendarAdded
                    ? 'bg-green-700 ring-2 ring-green-200 hover:bg-green-800'
                    : calendarBusy
                      ? 'bg-emerald-400'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
                aria-label={calendarAdded ? 'Open this shift in Google Calendar' : 'Add shift to Google Calendar'}
                title={calendarAdded ? 'Open in Google Calendar' : calendarBusy ? 'Adding to Google Calendar' : 'Add to Google Calendar'}
              >
                {calendarAdded ? <CheckCircle2 className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}
                Calendar
              </button>
              <button
                type="button"
                onClick={() => handlePlanOrOpenRide(shift)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-sky-700 px-3 text-xs font-extrabold text-white hover:bg-sky-800"
                title={linkedRide ? 'Open linked ride' : 'Plan a ride for this shift'}
                aria-label={linkedRide ? 'Open linked ride' : 'Plan a ride for this shift'}
              >
                <Car className="h-4 w-4" />
                {linkedRide ? 'Ride' : 'Plan Ride'}
              </button>
              <button
                type="button"
                onClick={handleOpenPaychecks}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-amber-700 px-3 text-xs font-extrabold text-white hover:bg-amber-800"
                title="Open paychecks"
                aria-label="Open paychecks"
              >
                <DollarSign className="h-4 w-4" />
                Pay ({matchingPaycheckCount})
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
              Record Actions
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleArchiveShift(shift.id)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-2 text-xs font-extrabold text-white hover:bg-purple-700"
                aria-label="Archive shift"
                title="Archive shift"
              >
                <Archive className="h-4 w-4" />
                Archive
              </button>
              <button
                type="button"
                onClick={() => handleClearShiftNotes(shift.id)}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-400 px-2 text-xs font-extrabold text-white hover:bg-slate-500"
                title="Clear shift notes"
                aria-label="Clear shift notes"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handleDeleteShift(shift.id)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-2 text-xs font-extrabold text-white hover:bg-red-700"
                aria-label="Delete shift"
                title="Delete shift"
              >
                <Trash2 className="h-4 w-4" />
                Delete
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
            <p className="mt-0.5 break-words text-sm font-bold text-slate-700">{shift.event || shift.jobName || 'Event not entered'}</p>
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
          {shouldShowDistinctJobName(shift) ? <p className="break-words"><span className="font-black text-slate-900">Job:</span> {shift.jobName}</p> : null}
          {shift.shiftName ? <p className="break-words"><span className="font-black text-slate-900">Shift Name:</span> {shift.shiftName}</p> : null}
          {shift.roleName ? <p className="break-words"><span className="font-black text-slate-900">Role Name:</span> {shift.roleName}</p> : null}
          {shift.uniform ? <p className="break-words"><span className="font-black text-slate-900">Uniform:</span> {shift.uniform}</p> : null}
        </section>

        <section className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-blue-700">Start</p>
            <p className="mt-1 text-sm font-black text-slate-950">{formatDate(shift.startDate)}</p>
            <p className="text-sm font-bold text-blue-700">{formatTime(shift.startTime)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-600">Finish</p>
            <p className="mt-1 text-sm font-black text-slate-950">{formatDate(shift.finishDate)}</p>
            <p className="text-sm font-bold text-slate-700">{formatTime(shift.finishTime)}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Hours / Rate</p>
            <p className="mt-1 text-sm font-black text-slate-950">{getShiftHours(shift).toFixed(1)} hrs</p>
            <p className="text-xs font-bold text-emerald-800">{getShiftHourlyRateLabel(shift)} per hour</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">Estimated Pay</p>
            <p className="mt-1 text-base font-black text-amber-950">{formatCurrency(getEstimatedPay(shift))}</p>
            <p className="text-xs font-bold text-amber-800">{getShiftPaymentStatusLabel(shift)}</p>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-700">
          <p><span className="font-black text-slate-900">Calendar:</span> {shift.googleCalendarEventId || shift.googleCalendarEventLink ? 'Added' : 'Not added'}</p>
          <p><span className="font-black text-slate-900">Pay Date:</span> {shift.paymentDate ? formatDate(shift.paymentDate) : 'Not set'}</p>
          {shift.supervisor ? <p className="col-span-2 break-words"><span className="font-black text-slate-900">Supervisor:</span> {shift.supervisor}</p> : null}
          {shift.parking ? <p className="col-span-2 break-words"><span className="font-black text-slate-900">Parking:</span> {shift.parking}</p> : null}
        </section>

      </div>

      <div className={`border-t border-slate-200 p-2.5 ${index % 2 === 0 ? 'bg-slate-50' : 'bg-blue-50'}`}>
        <p className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500">Shift Actions</p>
        {renderShiftActions(shift)}
      </div>
    </article>
  );

  return (
    <PageContainer surfaceClassName="min-h-screen bg-amber-50">
      <style>{`
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
          @page { margin: 0.45in; }
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
            overflow: visible !important;
          }
          body.csc-section-printing .csc-print-target article {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          body.csc-section-printing .csc-monthly-report {
            max-width: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          body.csc-section-printing .csc-monthly-week {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          body.csc-section-printing .csc-monthly-report table {
            width: 100% !important;
            table-layout: fixed !important;
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
            padding: 5px 7px !important;
            font-size: 9px !important;
            overflow-wrap: anywhere !important;
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
      <div className="flex min-w-0 flex-col gap-3 overflow-x-hidden bg-amber-50 py-3 sm:gap-6 sm:py-6">
        <TabPageHeader
          icon={BriefcaseBusiness}
          title="CSC Shifts"
          subtitle="Manage confirmed work schedules, pay status, calendar details, rides, and paycheck links."
          theme="amber"
          message={saveMessage}
          className="budget-mobile-header"
          actions={
            <div className="grid w-full grid-cols-4 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:gap-2">
              <button
                type="button"
                onClick={() => setShowScanDrawer(true)}
                title="Scan CSC shift email"
                className={`${TAB_HEADER_ACTION_CLASS} !h-9 !min-w-0 !gap-1 !px-1 !text-[10px] sm:!h-10 sm:!gap-2 sm:!px-4 sm:!text-sm border border-white/30 bg-white/15 text-white hover:bg-white/25`}
              >
                <StickyNote className="h-4 w-4" />
                <span className="sm:hidden">Scan</span>
                <span className="hidden sm:inline">Scan Email</span>
              </button>

              <label
                title="Import CSC shifts from CSV"
                className={`${TAB_HEADER_ACTION_CLASS} !h-9 !min-w-0 !gap-1 !px-1 !text-[10px] sm:!h-10 sm:!gap-2 sm:!px-4 sm:!text-sm cursor-pointer bg-white text-amber-900 hover:bg-amber-50`}
              >
                <FileUp className="h-4 w-4" />
                Import
                <input ref={toolbarImportInputRef} type="file" accept=".csv,text/csv" onChange={handleImportCsv} className="hidden" />
              </label>

              <button
                type="button"
                onClick={handleExportCsv}
                title="Export CSC shifts"
                className={`${TAB_HEADER_ACTION_CLASS} !h-9 !min-w-0 !gap-1 !px-1 !text-[10px] sm:!h-10 sm:!gap-2 sm:!px-4 sm:!text-sm bg-indigo-600 text-white hover:bg-indigo-500`}
              >
                <Download className="h-4 w-4" />
                Export
              </button>

              <button
                type="button"
                onClick={handleTogglePremiumView}
                title="Print CSC shifts list"
                className={`${TAB_HEADER_ACTION_CLASS} !h-9 !min-w-0 !gap-1 !px-1 !text-[10px] sm:!h-10 sm:!gap-2 sm:!px-4 sm:!text-sm bg-violet-600 text-white hover:bg-violet-500`}
              >
                <ListChecks className="h-4 w-4" />
                <span>Print List</span>
              </button>
            </div>
          }
        />

        {recentAutoArchive ? (
          <div
            className="csc-no-print fixed bottom-4 left-4 right-4 z-[70] flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-slate-950 px-4 py-3 text-white shadow-2xl sm:left-auto sm:max-w-md"
            role="status"
            aria-live="polite"
          >
            <div className="min-w-0">
              <p className="text-sm font-extrabold">Shift completed and archived</p>
              <p className="truncate text-xs text-slate-300">
                {recentAutoArchive.originalShift.event ||
                  recentAutoArchive.originalShift.jobName ||
                  'CSC shift'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleUndoAutoArchive}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-extrabold text-slate-950 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              aria-label="Undo completed shift archive"
              title="Undo completed shift archive"
            >
              <RotateCcw className="h-4 w-4" />
              Undo
            </button>
          </div>
        ) : null}

        <section
          ref={shiftBrowserRef}
          className="csc-shift-browser min-w-0 scroll-mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5"
        >
          <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">Scheduled Shifts</h2>
              <p className="text-sm text-slate-600">
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
                className="col-span-2 inline-flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg bg-black px-2 text-xs font-extrabold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-default disabled:opacity-50 sm:col-auto sm:h-10 sm:w-40 sm:shrink-0 sm:gap-2 sm:px-3 sm:text-sm"
              >
                <ListChecks className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {filteredShifts.length <= DEFAULT_VISIBLE_SHIFT_COUNT
                    ? `All ${filteredShifts.length}`
                    : allShiftRowsVisible
                      ? `Show ${DEFAULT_VISIBLE_SHIFT_COUNT}`
                      : `Show All ${filteredShifts.length}`}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowArchiveDrawer(true)}
                title={`Archive Drawer (${archivedShifts.length})`}
                aria-label={`Open archive drawer with ${archivedShifts.length} archived CSC shift${archivedShifts.length === 1 ? '' : 's'}`}
                className="relative inline-flex h-9 w-full items-center justify-center rounded-lg bg-orange-700 text-white shadow-sm hover:bg-orange-800 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 sm:h-10 sm:w-10"
              >
                <Archive className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-400 px-1 text-[11px] font-black leading-none text-white">
                  {archivedShifts.length}
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
              <button
                type="button"
                onClick={() => setIsShiftTableCollapsed(true)}
                title="Collapse All"
                aria-label="Collapse CSC shifts table"
                className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-slate-600 text-white shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 sm:h-10 sm:w-10"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleExpandAllShifts}
                title="Expand All"
                aria-label={`Expand all ${filteredShifts.length} CSC shifts`}
                className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-cyan-700 text-white shadow-sm hover:bg-cyan-800 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 sm:h-10 sm:w-10"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={handleExpandAllActiveShifts}
                title={`Expand all ${activeShiftCount} active CSC shifts`}
                aria-label={`Expand all ${activeShiftCount} active CSC shifts`}
                className="col-span-3 inline-flex h-8 items-center justify-center rounded-lg bg-blue-700 px-2 text-xs font-extrabold text-white shadow-sm transition-colors hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 sm:col-auto sm:h-10 sm:px-3"
              >
                Active {activeShiftCount}
              </button>
              <div className="col-span-3 inline-flex h-8 min-w-0 items-center justify-center rounded-lg bg-slate-100 px-2 text-center text-[11px] font-extrabold tabular-nums text-slate-700 sm:col-auto sm:h-10 sm:w-32 sm:px-3 sm:text-xs">
                Showing {visibleShiftCount} of {filteredShifts.length}
              </div>
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
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${showVenueFilter ? 'rotate-180' : ''}`} />
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
                    <span className="text-xs font-bold text-slate-600">{selectedVenueCount} selected</span>
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
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                  <p className="text-sm font-medium text-slate-600">
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
                          <p className={`mt-1 text-sm font-bold ${monthFilter === group.monthKey ? 'text-violet-100' : 'text-slate-600'}`}>
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
                <div className="mt-4 rounded-xl border border-dashed border-violet-300 bg-white/70 p-6 text-center text-sm font-bold text-slate-600">
                  No months match the current venue, status, or search filters.
                </div>
              )}
            </div>
          ) : null}

          <>

          <div className="overflow-hidden rounded-lg border-2 border-black">
            <div className="flex flex-col gap-2 bg-black px-3 py-3 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <GripVertical className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" />
                <button
                  type="button"
                  onClick={handleToggleShiftTable}
                  className="rounded p-1 text-white transition-colors hover:bg-slate-800"
                  aria-label={isShiftTableCollapsed ? 'Expand CSC Shifts' : 'Collapse CSC Shifts'}
                  title={isShiftTableCollapsed ? 'Expand CSC Shifts' : 'Collapse CSC Shifts'}
                >
                  {isShiftTableCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-wrap">
                  <BriefcaseBusiness className="h-5 w-5 shrink-0 text-yellow-300" />
                  <h3 className="whitespace-nowrap text-base font-semibold text-white sm:text-lg">CSC Shifts</h3>
                  <button
                    type="button"
                    onClick={handleExpandAllActiveShifts}
                    className="inline-flex shrink-0 items-center rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-black text-white shadow-sm sm:px-3 sm:py-1 sm:text-xs sm:uppercase sm:tracking-wide"
                    title={`Expand all ${activeShiftCount} active CSC shifts`}
                    aria-label={`Expand all ${activeShiftCount} active CSC shifts`}
                  >
                    Active {activeShiftCount}
                  </button>
                  <span className="hidden w-32 shrink-0 text-xs font-semibold tabular-nums text-slate-400 sm:inline-block">
                    Showing {visibleShiftCount} of {filteredShifts.length}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-2 sm:flex sm:shrink-0 sm:items-center sm:border-0 sm:pt-0">
                <button
                  type="button"
                  onClick={handleOpenAddShift}
                  className="flex h-9 items-center justify-center gap-1.5 rounded bg-blue-600 px-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 sm:h-auto sm:py-1.5 sm:px-3 sm:text-sm"
                  title="Add CSC shift"
                  aria-label="Add CSC shift"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Shift</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="flex h-9 items-center justify-center gap-1.5 rounded bg-slate-800 px-2 text-white transition-colors hover:bg-slate-700 sm:h-auto sm:bg-transparent sm:p-1.5 sm:hover:bg-slate-800"
                  aria-label="Download CSC shifts"
                  title="Download CSC shifts"
                >
                  <Download className="h-4 w-4" />
                  <span className="text-xs font-medium sm:hidden">Download</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddShift}
                  className="hidden rounded p-1.5 text-white transition-colors hover:bg-slate-800 sm:block"
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
                    <div>
                      <div className="flex items-center gap-2 text-yellow-950">
                        <Sparkles className="h-5 w-5" />
                        <h3 className="text-lg font-extrabold">{shift.venue || 'CSC Shift'}</h3>
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-800">{shift.event || 'Event not entered'}</p>
                      {shouldShowDistinctJobName(shift) ? <p className="mt-1 text-xs text-slate-600">{shift.jobName}</p> : null}
                      {shift.shiftName ? <p className="mt-1 text-xs text-slate-600">Shift Name: {shift.shiftName}</p> : null}
                      {shift.roleName ? <p className="mt-1 text-xs text-slate-600">Role Name: {shift.roleName}</p> : null}
                    </div>
                    {renderShiftActions(shift)}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-extrabold uppercase text-slate-500">Start</p>
                      <p className="mt-1 font-extrabold text-slate-950">{formatDate(shift.startDate)}</p>
                      <p className="text-sm text-slate-700">{formatTime(shift.startTime)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-extrabold uppercase text-slate-500">Finish</p>
                      <p className="mt-1 font-extrabold text-slate-950">{formatDate(shift.finishDate)}</p>
                      <p className="text-sm text-slate-700">{formatTime(shift.finishTime)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-extrabold uppercase text-slate-500">Hours</p>
                      <p className="mt-1 text-xl font-extrabold text-slate-950">{getShiftHours(shift).toFixed(1)}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <p className="text-xs font-extrabold uppercase text-slate-500">Estimated Pay</p>
                      <p className="mt-1 text-xl font-extrabold text-emerald-700">{formatCurrency(getEstimatedPay(shift))}</p>
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
              <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-2.5 font-extrabold">Shift</th>
                  <th className="px-4 py-2.5 font-extrabold">Start</th>
                  <th className="px-4 py-2.5 font-extrabold">Finish</th>
                  <th className="px-4 py-2.5 font-extrabold">Details</th>
                  <th className="sticky right-0 z-10 w-[170px] min-w-[170px] border-l border-slate-200 bg-slate-100 px-3 py-2.5 font-extrabold shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayedShifts.map((shift, index) => (
                  <tr
                    key={shift.id}
                    className={`group ${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'} hover:bg-yellow-50/60`}
                  >
                    <td className="px-3 py-2 align-top">
                      <div className="font-bold text-slate-950">{shift.venue}</div>
                      <div className="text-slate-600">{shift.city}</div>
                      <div className="mt-1 text-xs text-slate-500">{shift.address || 'Address not shown'}</div>
                      {shouldShowDistinctJobName(shift) ? <div className="mt-2 text-xs font-semibold text-slate-500">{shift.jobName}</div> : null}
                      {shift.shiftName ? (
                        <div className="mt-1 text-xs text-slate-600">
                          <span className="font-bold text-slate-700">Shift Name:</span> {shift.shiftName}
                        </div>
                      ) : null}
                      {shift.roleName ? (
                        <div className="mt-1 text-xs text-slate-600">
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
                      <div className="max-w-full overflow-hidden whitespace-normal break-words font-semibold leading-snug">{shift.event}</div>
                      <div className="mt-2 grid max-w-full grid-cols-2 gap-x-3 gap-y-1 overflow-hidden text-xs text-slate-600">
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Hours:</span> {getShiftHours(shift).toFixed(1)}</div>
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Rate:</span> {getShiftHourlyRateLabel(shift)}</div>
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Est. Pay:</span> {formatCurrency(getEstimatedPay(shift))}</div>
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Status:</span> {shift.shiftStatus}</div>
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Paid:</span> {getShiftPaymentStatusLabel(shift)}</div>
                        {shift.uniform ? <div className="col-span-2 min-w-0 break-words"><span className="font-bold text-slate-700">Uniform:</span> {shift.uniform}</div> : null}
                        {shift.googleCalendarEventId || shift.googleCalendarEventLink ? (
                          <div className="min-w-0 break-words text-green-700">
                            <span className="font-bold">Calendar:</span> Added
                          </div>
                        ) : null}
                        {shift.paymentDate ? <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Pay Date:</span> {formatDate(shift.paymentDate)}</div> : null}
                        {shift.parking ? <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Parking:</span> {shift.parking}</div> : null}
                        {shift.supervisor ? <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Supervisor:</span> {shift.supervisor}</div> : null}
                      </div>
                    </td>
                    <td
                      className={`sticky right-0 z-10 w-[170px] min-w-[170px] whitespace-nowrap border-l border-slate-200 px-2 py-2 align-top shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)] group-hover:bg-yellow-50 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-blue-50'
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
              <div className="rounded-b-lg border-t-2 border-black bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-600">
                CSC shifts are collapsed. Click Expand All or the chevron to show the shift table.
              </div>
            )}
          </div>

          {filteredShifts.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
              No shifts match the current filters.
            </div>
          )}
          </>
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 text-yellow-950 shadow-sm sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">Scheduled Shifts</p>
                <p className="mt-1 whitespace-nowrap text-2xl font-extrabold">{summary.totalShifts}</p>
              </div>
              <BriefcaseBusiness className="hidden h-8 w-8 shrink-0 opacity-80 sm:block" />
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-blue-950 shadow-sm sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">Estimated Hours</p>
                <p className="mt-1 whitespace-nowrap text-2xl font-extrabold">{summary.totalHours.toFixed(1)}</p>
                <p className="mt-1 text-xs font-bold text-blue-800">Done: {summary.workedHours.toFixed(1)}</p>
              </div>
              <Clock className="hidden h-8 w-8 shrink-0 opacity-80 sm:block" />
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950 shadow-sm sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">Estimated Pay</p>
                <p className="mt-1 break-words text-xl font-extrabold sm:text-2xl">{formatCurrency(summary.estimatedPay)}</p>
                <p className="mt-1 text-xs font-bold text-emerald-800">Paid: {formatCurrency(summary.paidAmount)}</p>
              </div>
              <DollarSign className="hidden h-8 w-8 shrink-0 opacity-80 sm:block" />
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border border-red-200 bg-red-50 p-3 text-red-950 shadow-sm sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold">Still Owed</p>
                <p className="mt-1 break-words text-xl font-extrabold sm:text-2xl">{formatCurrency(summary.owedAmount)}</p>
                <p className="mt-1 text-xs font-bold text-red-800">Done and unpaid only</p>
              </div>
              <CheckCircle2 className="hidden h-8 w-8 shrink-0 opacity-80 sm:block" />
            </div>
          </div>
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
                {hoursAnalytics.workedMonthCount} worked {hoursAnalytics.workedMonthCount === 1 ? 'month' : 'months'}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-black">
                Scheduled avg: {hoursAnalytics.averageScheduledMonth.toFixed(1)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 text-black lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex items-center justify-between bg-slate-100 px-3 py-2 text-black">
                <h3 className="text-sm font-extrabold">Weekly Hours</h3>
                <span className="text-[11px] font-bold text-black">{hoursAnalytics.weekly.length} weeks</span>
              </div>
              <div className="max-h-[240px] overflow-auto sm:max-h-[198px]">
                <table className="min-w-[500px] table-fixed text-left text-xs text-black sm:w-full sm:min-w-0">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wide text-black">
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
                            ? 'bg-blue-50'
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
              <div className="flex items-center justify-between bg-slate-100 px-3 py-2 text-black">
                <h3 className="text-sm font-extrabold">Monthly Hours</h3>
                <span className="text-[11px] font-bold text-black">{hoursAnalytics.monthly.length} months</span>
              </div>
              <div className="max-h-[240px] overflow-auto sm:max-h-[198px]">
                <table className="min-w-[500px] table-fixed text-left text-xs text-black sm:w-full sm:min-w-0">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wide text-black">
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
              <p className="text-xs text-slate-600">
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
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs font-semibold text-slate-600 md:col-span-2 lg:col-span-3">
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
                    <p className="mt-0.5 text-xs leading-tight text-slate-600">
                      {month.totalRecords} total, {month.activeRecords} active, {month.archivedRecords} archived
                    </p>
                    <p className="mt-0.5 text-[11px] font-bold leading-tight text-slate-500">
                      {month.payableRecords} payable{month.cancelledRecords ? `, ${month.cancelledRecords} cancelled` : ''}
                    </p>
                  </div>
                  <CalendarDays className="h-5 w-5" />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs leading-tight">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Hours</p>
                    <p className="text-sm font-extrabold">{month.hours.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Done</p>
                    <p className="text-sm font-extrabold">{month.workedHours.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Projected</p>
                    <p className="text-sm font-extrabold">{formatCurrency(month.projectedPay)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Earned</p>
                    <p className="text-sm font-extrabold">{formatCurrency(month.earnedPay)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Marked Paid</p>
                    <p className="text-sm font-extrabold">{formatCurrency(month.paidAmount)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Still Owed</p>
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
              {CSC_COMPANY.phone}
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
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-2 sm:px-4 sm:py-6">
            <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-4 shadow-2xl sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-black text-slate-950">{deleteConfirm.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">
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
                <p className="mt-3 text-base font-semibold text-slate-600">
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
                  <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">Shifts</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-2xl font-extrabold">{summary.totalHours.toFixed(1)}</p>
                  <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">Hours</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-2xl font-extrabold">{formatCurrency(summary.estimatedPay)}</p>
                  <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">Estimated Pay</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-2xl font-extrabold">{formatCurrency(summary.owedAmount)}</p>
                  <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">Still Owed</p>
                </div>
              </section>

              <section className="csc-premium-shift-grid mt-8 grid gap-4 lg:grid-cols-2 print:grid-cols-2 print:gap-3">
                {filteredShifts.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-600">
                    No shifts match the current filters.
                  </div>
                ) : (
                  filteredShifts.map((shift) => (
                    <article key={shift.id} className="csc-premium-shift-card min-w-0 break-inside-avoid rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5 print:p-3 print:shadow-none">
                      <div className="grid min-w-0 grid-cols-[18px_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[18px_minmax(0,1fr)_auto] sm:gap-4">
                        <div className="mt-1 h-4 w-4 border-2 border-slate-950" />
                        <div>
                          <h3 className="csc-premium-shift-title text-xl font-extrabold text-slate-950">{shift.venue || 'CSC Shift'}</h3>
                          <p className="csc-premium-shift-meta mt-1 text-sm font-bold text-slate-700">{shift.event || 'Event not entered'}</p>
                          {shouldShowDistinctJobName(shift) ? <p className="csc-premium-shift-meta mt-1 text-xs font-semibold text-slate-500">{shift.jobName}</p> : null}
                          {shift.shiftName ? <p className="csc-premium-shift-meta mt-1 text-xs font-semibold text-slate-500">Shift Name: {shift.shiftName}</p> : null}
                          {shift.roleName ? <p className="csc-premium-shift-meta mt-1 text-xs font-semibold text-slate-500">Role Name: {shift.roleName}</p> : null}
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
                          <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
                            <div className="font-extrabold text-slate-700">Shift Name</div>
                            <div>{shift.shiftName}</div>
                          </div>
                        )}
                        {shift.roleName && (
                          <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
                            <div className="font-extrabold text-slate-700">Role Name</div>
                            <div>{shift.roleName}</div>
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
              <div className="flex min-w-0 flex-col gap-3 border-b border-slate-200 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <h2 id="worked-week-title" className="text-lg font-extrabold leading-tight text-slate-950 sm:text-xl">
                    Shifts Worked, {selectedWorkedWeek.label}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
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

              <div className="border-b border-slate-200 bg-slate-50 px-3 py-3 sm:px-5 sm:py-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                  <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 sm:col-span-1">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Worked Shifts</p>
                    <p className="mt-1 text-xl font-extrabold text-slate-950">
                      {selectedWorkedWeek.workedShiftCount} out of {selectedWorkedWeek.shiftCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Worked Hours</p>
                    <p className="mt-1 text-xl font-extrabold text-slate-950">{selectedWorkedWeek.workedHours.toFixed(1)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Estimated Earned Pay</p>
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
                  <div className="grid gap-4 lg:grid-cols-2">
                    {selectedWorkedWeek.workedShifts.map((shift) => (
                      <article
                        key={`${shift.recordSource}-${shift.id}`}
                        className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="break-words text-base font-extrabold leading-tight text-slate-950 sm:text-lg">{shift.venue || 'CSC Shift'}</h3>
                            <p className="mt-0.5 text-sm font-bold text-slate-700">{shift.event || 'Event not entered'}</p>
                            {shouldShowDistinctJobName(shift) ? <p className="mt-0.5 text-xs font-semibold text-slate-500">{shift.jobName}</p> : null}
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

                        <div className="mt-4 grid gap-2 text-sm text-slate-700">
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
                  <p className="mt-1 text-sm text-slate-600">
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
                  <header className="border-b-4 border-slate-950 pb-5 text-center">
                    <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-700">Contemporary Services Corporation</p>
                    <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Monthly Work and Pay Report</h1>
                    <p className="mt-2 text-xl font-extrabold text-slate-700">{selectedPaidMonth.label}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      Generated {formatDate(toLocalDateKey(new Date()))}
                    </p>
                  </header>

                  <section className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500">Shifts Worked</p>
                      <p className="mt-1 text-xl font-black text-slate-950">{selectedPaidMonth.paidShifts.filter((shift) => shift.shiftStatus === 'Done').length}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-amber-700">Scheduled Hours</p>
                      <p className="mt-1 text-xl font-black text-amber-950">{selectedPaidMonth.totalHours.toFixed(1)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500">Worked Hours</p>
                      <p className="mt-1 text-xl font-black text-slate-950">{selectedPaidMonth.workedHours.toFixed(1)}</p>
                    </div>
                    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-blue-700">Expected Gross Pay</p>
                      <p className="mt-1 text-xl font-black text-blue-950">{formatCurrency(selectedPaidMonth.projectedPay)}</p>
                    </div>
                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-violet-700">Actual Gross Pay</p>
                      <p className="mt-1 text-xl font-black text-violet-950">{formatCurrency(selectedPaidMonth.actualGrossPaid)}</p>
                    </div>
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-red-700">Gross Still Owed</p>
                      <p className="mt-1 text-xl font-black text-red-950">{formatCurrency(selectedPaidMonth.owedAmount)}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-900 bg-emerald-800 p-3 shadow-sm">
                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-emerald-100">Actual Net Paid</p>
                      <p className="mt-1 text-xl font-black text-white">{formatCurrency(selectedPaidMonth.actualNetReceived)}</p>
                    </div>
                  </section>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600">
                    <span>{selectedPaidMonth.paidShifts.length} saved shifts</span>
                    <span>{selectedPaidMonth.paidCount} marked paid</span>
                    <span>{selectedPaidMonth.owedCount} completed and unpaid</span>
                    <span>{selectedPaidMonth.actualPaychecks.length} matching saved paychecks</span>
                    {selectedPaidMonth.openCount ? <span>{selectedPaidMonth.openCount} scheduled or approved</span> : null}
                    {selectedPaidMonth.cancelledCount ? <span>{selectedPaidMonth.cancelledCount} cancelled</span> : null}
                  </div>

                  <section className="mt-4 overflow-hidden rounded-xl border border-slate-300">
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
                                <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Pay Period</p>
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
                          <thead className="bg-white text-[9px] font-extrabold uppercase tracking-wide text-slate-600">
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
                      <p className="px-4 py-3 text-xs font-semibold text-slate-600">
                        No saved paycheck has a pay period matching a completed shift in this report.
                      </p>
                    )}
                  </section>

                  {selectedPaidMonth.weeklyBreakdown.length === 0 ? (
                    <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-600">
                      No CSC shifts are saved for {selectedPaidMonth.label}.
                    </div>
                  ) : (
                    <div className="mt-6 space-y-6">
                      {selectedPaidMonth.weeklyBreakdown.map((week, weekIndex) => (
                        <section
                          key={week.weekKey}
                          className="csc-monthly-week break-inside-avoid overflow-hidden rounded-xl border border-slate-300"
                        >
                          <div className="flex flex-col gap-2 bg-slate-950 px-4 py-3 text-white sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-amber-300">Week {weekIndex + 1}</p>
                              <h2 className="mt-0.5 text-base font-black">{week.label}</h2>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-right text-[10px] sm:grid-cols-5">
                              <div>
                                <p className="font-bold uppercase text-slate-300">Scheduled</p>
                                <p className="mt-0.5 text-sm font-black">{week.hours.toFixed(1)} hrs</p>
                              </div>
                              <div>
                                <p className="font-bold uppercase text-slate-300">Worked</p>
                                <p className="mt-0.5 text-sm font-black">{week.workedHours.toFixed(1)} hrs</p>
                              </div>
                              <div>
                                <p className="font-bold uppercase text-slate-300">Expected Pay</p>
                                <p className="mt-0.5 text-sm font-black">{formatCurrency(week.expectedPay)}</p>
                              </div>
                              <div>
                                <p className="font-bold uppercase text-slate-300">Actual Gross</p>
                                <p className="mt-0.5 text-sm font-black text-violet-300">{formatCurrency(week.actualGrossPaid)}</p>
                              </div>
                              <div className="col-span-2 sm:col-span-1">
                                <p className="font-bold uppercase text-slate-300">Actual Net</p>
                                <p className="mt-0.5 text-sm font-black text-emerald-300">{formatCurrency(week.actualNetReceived)}</p>
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
                                      ? 'border-slate-200 bg-slate-100 text-slate-500'
                                      : 'border-slate-200 bg-white text-slate-800'
                                  }`}
                                >
                                  <div className="flex min-w-0 items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="break-words text-sm font-black text-slate-950">
                                        {shift.event || shift.jobName || 'Event not entered'}
                                      </p>
                                      <p className="mt-0.5 break-words text-xs font-bold text-slate-600">
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
                                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500">Date and Time</p>
                                      <p className="mt-0.5 font-extrabold text-slate-900">
                                        {formatShortDate(shift.startDate)}, {formatTime(shift.startTime)} - {formatTime(shift.finishTime)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500">Shift Name</p>
                                      <p className="mt-0.5 break-words font-bold">{shift.shiftName || 'Not entered'}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500">Hours</p>
                                      <p className="mt-0.5 font-bold">{shift.shiftStatus === 'Cancelled' ? '0.0' : getShiftHours(shift).toFixed(1)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500">Expected</p>
                                      <p className="mt-0.5 font-black text-blue-800">{formatCurrency(expectedPay)}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] font-extrabold uppercase tracking-wide text-slate-500">Paycheck</p>
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
                                <p className="text-[9px] font-extrabold uppercase text-slate-500">Week Hours</p>
                                <p className="mt-0.5 font-black">{week.hours.toFixed(1)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-extrabold uppercase text-slate-500">Expected Pay</p>
                                <p className="mt-0.5 font-black">{formatCurrency(week.expectedPay)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-extrabold uppercase text-slate-500">Paychecks</p>
                                <p className="mt-0.5 font-black text-emerald-800">{week.actualPaychecks.length} saved</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-extrabold uppercase text-slate-500">Worked</p>
                                <p className="mt-0.5 font-black">{week.workedCount} shifts</p>
                              </div>
                            </div>
                          </div>

                          <div className="hidden overflow-x-auto sm:block print:block">
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
                              <thead className="bg-slate-100 text-[9px] font-extrabold uppercase tracking-wide text-slate-600">
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
                                    <tr key={`${shift.recordSource}-${shift.id}`} className={shift.shiftStatus === 'Cancelled' ? 'bg-slate-50 text-slate-500' : 'text-slate-800'}>
                                      <td className="whitespace-nowrap px-3 py-2 align-top font-bold">
                                        <div>{formatShortDate(shift.startDate)}</div>
                                        <div className="mt-0.5 font-semibold text-slate-600">
                                          {formatTime(shift.startTime)} - {formatTime(shift.finishTime)}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 align-top font-bold text-slate-950">
                                        {shift.event || shift.jobName || 'Event not entered'}
                                      </td>
                                      <td className="px-3 py-2 align-top">{shift.venue || 'Venue not entered'}</td>
                                      <td className="px-3 py-2 align-top">{shift.shiftName || 'Not entered'}</td>
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

                  <footer className="mt-6 border-t border-slate-300 pt-3 text-[9px] leading-relaxed text-slate-500">
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
                  <p className="text-sm text-slate-600">Full shift record with restore, edit, archive, and delete actions.</p>
                </div>
                <div className="csc-no-print flex w-full flex-shrink-0 items-center gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handlePrintSection('csc-shift-details-print', `CSC Shift Details - ${selectedDetailShift.venue || 'Shift'}`)}
                    className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-extrabold text-white shadow-sm hover:bg-slate-800 sm:h-11 sm:flex-none"
                    aria-label="Print CSC shift details"
                    title="Print CSC shift details"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </button>
                  <CloseScreenButton onClick={handleCloseShiftDetails} />
                </div>
              </div>

              <div className="csc-print-scroll min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5">
                <div className="min-w-0 rounded-2xl border border-yellow-200 bg-yellow-50 p-3 sm:p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="break-words text-xl font-extrabold text-slate-950 sm:text-2xl">{selectedDetailShift.venue || 'CSC Shift'}</h3>
                      <p className="mt-1 font-bold text-slate-800">{selectedDetailShift.event || 'Event not entered'}</p>
                      {shouldShowDistinctJobName(selectedDetailShift) ? <p className="mt-1 text-sm text-slate-600">{selectedDetailShift.jobName}</p> : null}
                      {selectedDetailShift.shiftName ? <p className="mt-1 text-sm text-slate-600">Shift Name: {selectedDetailShift.shiftName}</p> : null}
                      {selectedDetailShift.roleName ? <p className="mt-1 text-sm text-slate-600">Role Name: {selectedDetailShift.roleName}</p> : null}
                    </div>
                    <div className="rounded-full border border-yellow-300 bg-white px-3 py-1 text-xs font-extrabold text-yellow-900">
                      {selectedDetailShift.shiftStatus}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-500">Start</p>
                    <p className="mt-1 font-bold text-slate-950">{formatDate(selectedDetailShift.startDate)} {formatTime(selectedDetailShift.startTime)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-500">Finish</p>
                    <p className="mt-1 font-bold text-slate-950">{formatDate(selectedDetailShift.finishDate)} {formatTime(selectedDetailShift.finishTime)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-500">Venue Address</p>
                    <p className="mt-1 font-bold text-slate-950">{selectedDetailShift.address || 'Address not shown'}</p>
                    <p className="text-sm text-slate-600">{selectedDetailShift.city}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-500">Shift / Role</p>
                    <p className="mt-1 text-sm text-slate-700">Shift Name: {selectedDetailShift.shiftName || 'Not entered'}</p>
                    <p className="text-sm text-slate-700">Role Name: {selectedDetailShift.roleName || 'Not entered'}</p>
                    <p className="text-sm text-slate-700">Uniform: {selectedDetailShift.uniform || 'Not entered'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-500">Pay</p>
                    <p className="mt-1 font-bold text-slate-950">{getShiftHours(selectedDetailShift).toFixed(1)} hours at {getShiftHourlyRateLabel(selectedDetailShift)}</p>
                    <p className="text-sm font-bold text-emerald-700">Estimated Pay: {formatCurrency(getEstimatedPay(selectedDetailShift))}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-500">Paid Status</p>
                    <p className="mt-1 font-bold text-slate-950">{getShiftPaymentStatusLabel(selectedDetailShift)}</p>
                    <p className="text-sm text-slate-600">
                      {selectedDetailShift.shiftStatus === 'Cancelled'
                        ? 'No payment due'
                        : selectedDetailShift.paymentDate
                          ? formatShortDate(selectedDetailShift.paymentDate)
                          : 'No payment date entered'}
                    </p>
                    {selectedDetailShiftIsArchived && selectedDetailShift.shiftStatus !== 'Cancelled'
                      ? renderArchivedPaidControls(selectedDetailShift, true)
                      : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-500">
                      {shouldOmitParkingForShift(selectedDetailShift) ? 'Supervisor' : 'Supervisor / Parking'}
                    </p>
                    <p className="mt-1 text-sm text-slate-700">Supervisor: {selectedDetailShift.supervisor || 'Not entered'}</p>
                    {!shouldOmitParkingForShift(selectedDetailShift) ? (
                      <p className="text-sm text-slate-700">Parking: {selectedDetailShift.parking || 'Not entered'}</p>
                    ) : null}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 md:col-span-2">
                    <p className="text-xs font-extrabold uppercase text-slate-500">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selectedDetailShift.notes || 'No notes entered.'}</p>
                  </div>
                </div>
              </div>

              <div className="csc-no-print border-t border-slate-200 bg-slate-50 p-3 sm:p-4">
                {selectedDetailShiftIsArchived ? (
                  <div className="grid gap-3">
                    {selectedDetailShift.shiftStatus !== 'Cancelled'
                      ? renderArchivedPaidControls(selectedDetailShift)
                      : null}
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
                    <button
                      type="button"
                      onClick={() => handleRestoreArchivedShift(selectedDetailShift.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-100"
                      aria-label="Unarchive shift"
                      title="Unarchive shift"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Unarchive
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteArchivedShift(selectedDetailShift.id)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
                      aria-label="Delete archived shift"
                      title="Delete archived shift"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                    </div>
                  </div>
                ) : (
                  renderShiftDetailActions(selectedDetailShift)
                )}
              </div>
            </div>
          </div>
        )}

        {showArchiveDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-slate-950/50 p-0 sm:p-4">
            <div
              id="csc-shift-archive-print"
              className="flex h-[100dvh] min-w-0 w-full max-w-5xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-full sm:rounded-2xl"
            >
              <div className="flex flex-col gap-3 border-b border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold text-slate-950 sm:text-xl">CSC Shift Archive</h2>
                  <p className="text-sm text-slate-600">Restore archived shifts or permanently delete old records.</p>
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
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={archiveSearch}
                      onChange={(event) => setArchiveSearch(event.target.value)}
                      placeholder="Search archived shifts..."
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
                <p className="mt-3 text-xs font-bold text-slate-600">
                  Showing {filteredArchivedShifts.length} of {archivedShifts.length} archived shifts.
                </p>
              </div>

              <div className="csc-print-scroll min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5">
                {filteredArchivedShifts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                    No archived CSC shifts match the current filters.
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {filteredArchivedShifts.map((shift) => (
                      <article key={shift.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-lg font-extrabold text-slate-950">{shift.venue || 'CSC Shift'}</h3>
                            <p className="mt-1 text-sm font-bold text-slate-700">{shift.event || 'Event not entered'}</p>
                            {shouldShowDistinctJobName(shift) ? <p className="mt-1 text-xs font-semibold text-slate-500">{shift.jobName}</p> : null}
                            {shift.shiftName ? <p className="mt-1 text-xs font-semibold text-slate-500">Shift Name: {shift.shiftName}</p> : null}
                            {shift.roleName ? <p className="mt-1 text-xs font-semibold text-slate-500">Role Name: {shift.roleName}</p> : null}
                          </div>
                          <span className="w-fit rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-extrabold text-yellow-900">
                            {shift.shiftStatus}
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
                            <span className="font-extrabold text-slate-950">Pay</span>
                            <span>
                              {formatCurrency(getEstimatedPay(shift))} - {getShiftPaymentStatusLabel(shift)}
                              {shift.shiftStatus !== 'Cancelled' && shift.paymentDate ? `, ${formatShortDate(shift.paymentDate)}` : ''}
                            </span>
                          </div>
                          {shift.shiftStatus !== 'Cancelled' ? (
                            <div className="border-t border-slate-100 pt-2">
                              <span className="block font-extrabold text-slate-950">Paid Controls</span>
                              {renderArchivedPaidControls(shift, true)}
                            </div>
                          ) : null}
                          <div className="grid min-w-0 grid-cols-[78px_minmax(0,1fr)] gap-2 border-t border-slate-100 pt-2 sm:grid-cols-[110px_minmax(0,1fr)] sm:gap-3">
                            <span className="font-extrabold text-slate-950">Archived</span>
                            <span>{shift.archivedAt ? new Date(shift.archivedAt).toLocaleString() : 'Date not saved'}</span>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
                          <button
                            type="button"
                            onClick={() => handleOpenShiftDetails(shift)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-bold text-cyan-800 hover:bg-cyan-100"
                            aria-label="Open archived shift details"
                            title="Open archived shift details"
                          >
                            <PanelRightOpen className="h-4 w-4" />
                            Details
                          </button>
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
          <div className="fixed inset-0 z-50 flex justify-end overflow-hidden bg-slate-950/50 p-0 sm:p-4">
            <div className="flex h-[100dvh] min-w-0 w-full max-w-3xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-full sm:rounded-2xl">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-3 py-3 sm:px-5 sm:py-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold text-slate-950 sm:text-xl">Scan CSC Email</h2>
                  <p className="text-sm text-slate-600">Paste a CSC schedule update, acceptance, courtesy reminder, or Kia Forum schedule email. The scanner fills known fields and saves extra details to notes.</p>
                </div>
                <CloseScreenButton onClick={() => setShowScanDrawer(false)} />
              </div>

              <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5">
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  CSC email text
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
                    Scan Email
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
                            <p className="md:col-span-2"><strong>Event:</strong> {item.event || 'Not detected'}</p>
                            <p className="md:col-span-2"><strong>Job:</strong> {item.jobName || 'Not detected'}</p>
                            {item.shiftName ? <p className="md:col-span-2"><strong>Shift Name:</strong> {item.shiftName}</p> : null}
                            {item.roleName ? <p className="md:col-span-2"><strong>Role Name:</strong> {item.roleName}</p> : null}
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
                  Import Scanned Shift
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddDrawer && (
          <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-slate-950/40 p-0 sm:items-center sm:p-4">
            <div className="h-[100dvh] min-w-0 w-full max-w-5xl overflow-x-hidden overflow-y-auto rounded-none bg-white p-3 shadow-2xl sm:max-h-[92vh] sm:h-auto sm:rounded-2xl sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold text-slate-950 sm:text-xl">{editingShiftId ? 'Edit CSC Shift' : 'Add CSC Shift'}</h2>
                  <p className="text-sm text-slate-600">Create a new CSC shift and save it to this browser.</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
                  {!editingShiftId && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddDrawer(false);
                        setEditingShiftId(null);
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
                  <CloseScreenButton onClick={() => { setShowAddDrawer(false); setEditingShiftId(null); setNewShift(createBlankShift()); }} />
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
                    placeholder="SoFi Stadium and Hollywood Park"
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
                  Shift Name
                  <input
                    type="text"
                    value={newShift.shiftName}
                    onChange={(event) => setNewShift((current) => ({ ...current, shiftName: event.target.value }))}
                    placeholder="FloorXStage, Vertical - Elevator and Escalator"
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <label className="grid gap-1 text-sm font-bold text-slate-700 md:col-span-2">
                  Role Name
                  <input
                    type="text"
                    value={newShift.roleName}
                    onChange={(event) => setNewShift((current) => ({ ...current, roleName: event.target.value }))}
                    placeholder="Security Guard, Event Staff, Workers"
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
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
                  onClick={() => { setShowAddDrawer(false); setEditingShiftId(null); setNewShift(createBlankShift()); }}
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
    </PageContainer>
  );
};

export default CscShiftsTab;
