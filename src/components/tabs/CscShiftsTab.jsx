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
import { createGoogleCalendarEvent } from '../../utils/googleCalendarApi';

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

const SHIFT_STATUS_OPTIONS = ['Scheduled', 'Approved', 'Cancelled', 'Done'];

const getShiftStatusColorClass = (status) => {
  if (status === 'Done') return 'bg-green-600 hover:bg-green-700';
  if (status === 'Approved') return 'bg-blue-600 hover:bg-blue-700';
  if (status === 'Cancelled') return 'bg-red-600 hover:bg-red-700';
  return 'bg-slate-600 hover:bg-slate-700';
};

const getShiftStatusOptionStyle = (status) => {
  if (status === 'Done') return { backgroundColor: '#16a34a', color: '#ffffff' };
  if (status === 'Approved') return { backgroundColor: '#2563eb', color: '#ffffff' };
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
    /\bcoat\s*(?:&|and)\s*tie\b/i.test(text) ||
    /\bsuit\s*(?:&|and)\s*tie\b/i.test(text) ||
    /\bdress\s+shirt\b/i.test(text) ||
    /\bdress\s+pants\b/i.test(text) ||
    /\bblack\s+suit\b/i.test(text)
  ) {
    return 'Coat & tie';
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
    .replace(/\bUniform\s*:\s*(?:All\s+black\s+uniform|Coat\s*&\s*tie)\.?\s*/gi, '')
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
  if (status === 'Confirmed') return 'Approved';
  if (status === 'Paid') return 'Done';
  if (status === 'Complete' || status === 'Completed') return 'Done';

  return SHIFT_STATUS_OPTIONS.includes(status) ? status : 'Scheduled';
};

const normalizeShift = (shift = {}) => {
  const rawNotes = shift.notes || '';
  const uniform = normalizeCscUniformType(shift.uniform || rawNotes || '');
  const shiftName = shift.shiftName || getShiftNameFromCscNotes(rawNotes);
  const roleName = shift.roleName || getRoleNameFromCscNotes(rawNotes);

  return {
    id: shift.id || `csc-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    startDate: shift.startDate || '',
    startTime: shift.startTime || '',
    finishDate: shift.finishDate || shift.startDate || '',
    finishTime: shift.finishTime || '',
    venue: shift.venue || '',
    city: shift.city || '',
    address: shift.address || '',
    event: shift.event || '',
    jobName: shift.jobName || '',
    shiftName,
    roleName,
    shiftStatus: normalizeShiftStatus(shift.shiftStatus),
    hourlyRate: normalizeHourlyRate(shift.hourlyRate),
    paidStatus: shift.paidStatus || 'Unpaid',
    paymentDate: shift.paymentDate || '',
    notes: cleanCscShiftNotes(rawNotes, uniform),
    parking: cleanCscParkingText(shift.parking || ''),
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

      const nextStatus = linkedShift.shiftStatus === 'Cancelled' ? 'Cancelled' : 'Scheduled';
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

const getEstimatedPay = (shift) => {
  if (shift?.shiftStatus === 'Cancelled') return 0;

  const rate = Number.parseFloat(shift.hourlyRate);
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
    startDate: existingShift.startDate || incomingShift.startDate,
    startTime: existingShift.startTime || incomingShift.startTime,
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

      const calendarSaved = localStorage.getItem(CSC_CALENDAR_ADDED_STORAGE_KEY);
      const calendarIds = calendarSaved ? JSON.parse(calendarSaved) : [];

      if (Array.isArray(calendarIds)) {
        const nextCalendarIds = new Set(calendarIds);
        dedupeResult.replacementIds.forEach((keptId, removedId) => {
          if (nextCalendarIds.has(removedId)) nextCalendarIds.add(keptId);
          nextCalendarIds.delete(removedId);
        });
        localStorage.setItem(CSC_CALENDAR_ADDED_STORAGE_KEY, JSON.stringify(Array.from(nextCalendarIds)));
      }
    }

    return dedupeResult.shifts;
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

    return parsed
      .filter((shift) => shift?.id)
      .map((shift) => normalizeShift(shift))
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
        shiftStatus: 'Approved',
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
        shiftStatus: 'Approved',
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
    shiftStatus: 'Approved',
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

const findMatchingShiftIdForScannedEmail = (currentShifts = [], scannedShift = {}) => {
  if (!scannedShift?.startDate || !scannedShift?.startTime) return '';

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
              <tr><th>Job Name</th><td>${escapeHtml(shift.jobName || 'Job name not entered')}</td></tr>
              ${shift.shiftName ? `<tr><th>Shift Name</th><td>${escapeHtml(shift.shiftName)}</td></tr>` : ''}
              ${shift.roleName ? `<tr><th>Role Name</th><td>${escapeHtml(shift.roleName)}</td></tr>` : ''}
              <tr><th>Hours</th><td>${getShiftHours(shift).toFixed(1)}</td></tr>
              <tr><th>Hourly Rate</th><td>${escapeHtml(formatCurrency(Number(shift.hourlyRate) || 0))}</td></tr>
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

  const dayOffset = (date.getDay() + 6) % 7;
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

const getLinkedRideForShift = (shift = {}) =>
  readStoredRides().find((ride) => ride.linkedCscShiftId === shift.id) || null;

const getPaychecksMatchingShift = (shift = {}, paychecks = []) => {
  const shiftDate = String(shift.startDate || '').slice(0, 10);
  if (!shiftDate) return [];

  return paychecks.filter((paycheck) => {
    const periodStart = String(paycheck.payPeriodStart || '').slice(0, 10);
    const periodEnd = String(paycheck.payPeriodEnd || '').slice(0, 10);
    return Boolean(periodStart && periodEnd && shiftDate >= periodStart && shiftDate <= periodEnd);
  });
};

const buildShiftCalendarEventPayload = (shift = {}) => {
  const description = [
    `CSC shift status: ${shift.shiftStatus || 'Scheduled'}`,
    `Paid status: ${getShiftPaymentStatusLabel(shift)}`,
    `Hours: ${getShiftHours(shift).toFixed(1)}`,
    `Hourly rate: ${formatCurrency(Number(shift.hourlyRate) || 0)}`,
    `Estimated pay: ${formatCurrency(getEstimatedPay(shift))}`,
    shift.jobName ? `Job: ${shift.jobName}` : '',
    shift.shiftName ? `Shift Name: ${shift.shiftName}` : '',
    shift.roleName ? `Role Name: ${shift.roleName}` : '',
    shift.parking ? `Parking: ${shift.parking}` : '',
    shift.supervisor ? `Supervisor: ${shift.supervisor}` : '',
    shift.notes ? `Notes: ${shift.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';

  return {
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

const CscShiftsTab = ({ searchQuery = '' }) => {
  const [shifts, setShifts] = useState(() => loadSavedShifts());
  const [localSearch, setLocalSearch] = useState('');
  const [venueFilter, setVenueFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paidFilter, setPaidFilter] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [monthRangeMode, setMonthRangeMode] = useState('focus');
  const [saveMessage, setSaveMessage] = useState('');
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
  const [isShiftTableCollapsed, setIsShiftTableCollapsed] = useState(false);
  const [selectedDetailShiftId, setSelectedDetailShiftId] = useState(null);
  const [detailReturnContext, setDetailReturnContext] = useState(null);
  const [movingShiftId, setMovingShiftId] = useState(null);
  const [expandedNoteIds, setExpandedNoteIds] = useState(() => new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [calendarAddingShiftId, setCalendarAddingShiftId] = useState('');
  const [paychecks, setPaychecks] = useState(() => readStoredPaychecks());
  const [selectedPaidMonthKey, setSelectedPaidMonthKey] = useState('');
  const toolbarImportInputRef = useRef(null);

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
      setVenueFilter('All');
      setStatusFilter('All');
      setPaidFilter('All');
      setSelectedMonth('All');
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
    if (!shift?.id || calendarAddingShiftId) return;

    if (shift.googleCalendarEventLink) {
      window.open(shift.googleCalendarEventLink, '_blank', 'noopener,noreferrer');
      return;
    }

    if (shift.googleCalendarEventId) {
      window.alert('This shift is already linked to Google Calendar, but its calendar link is unavailable.');
      return;
    }

    if (!shift.startDate || !shift.startTime || !shift.finishTime) {
      window.alert('Start date, start time, and finish time are required before adding this shift to Google Calendar.');
      return;
    }

    try {
      setCalendarAddingShiftId(shift.id);
      const createdEvent = await createGoogleCalendarEvent(buildShiftCalendarEventPayload(shift));
      updateShift(shift.id, {
        googleCalendarEventId: createdEvent?.id || '',
        googleCalendarEventLink: createdEvent?.htmlLink || '',
        googleCalendarAddedAt: new Date().toISOString(),
      });
      setSaveMessage('CSC shift added to Google Calendar.');
      setTimeout(() => setSaveMessage(''), 2500);
    } catch (error) {
      window.alert(error?.message || 'Could not add this CSC shift to Google Calendar.');
    } finally {
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

  const handleShowFullShiftList = () => {
    setSelectedMonth('All');
    setVenueFilter('All');
    setStatusFilter('All');
    setPaidFilter('All');
    setLocalSearch('');
    setShowActiveOnly(false);
    setIsShiftTableCollapsed(false);
  };

  const toggleShiftNotes = (id) => {
    setExpandedNoteIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const shouldShowMoreNotes = (notes = '') => {
    const normalizedNotes = String(notes || '').trim();
    if (!normalizedNotes) return false;
    const lineCount = normalizedNotes.split(/\r?\n/).length;
    return lineCount > 2 || normalizedNotes.length > 76;
  };

  const getCollapsedNotesText = (notes = '') => {
    const normalizedNotes = String(notes || '').replace(/\s+/g, ' ').trim();
    if (normalizedNotes.length <= 76) return normalizedNotes;
    return `${normalizedNotes.slice(0, 70).trimEnd()}...`;
  };

  const updateShift = (id, updates) => {
    setShifts((currentShifts) =>
      currentShifts.map((shift) => {
        if (shift.id !== id) return shift;

        const nextShift = { ...shift, ...updates };

        if (updates.shiftStatus) {
          nextShift.shiftStatus = normalizeShiftStatus(updates.shiftStatus);
        }

        if (updates.shiftStatus === 'Scheduled' || updates.shiftStatus === 'Approved' || updates.shiftStatus === 'Confirmed' || updates.shiftStatus === 'Cancelled') {
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

    if (!window.confirm(`Clear notes, parking, and supervisor for ${label}?`)) return;

    writeCscSafetySnapshot('Before CSC shift clear', shifts, archivedShifts);
    updateShift(id, { notes: '', parking: '', supervisor: '' });
    setSaveMessage('CSC shift notes cleared.');
    setTimeout(() => setSaveMessage(''), 2500);
  };

  const handleToggleShiftDone = (shift) => {
    const isDone = shift.shiftStatus === 'Done';

    writeCscSafetySnapshot(
      isDone ? 'Before CSC shift changed back to scheduled' : 'Before CSC shift marked done',
      shifts,
      archivedShifts
    );

    updateShift(shift.id, {
      shiftStatus: isDone ? 'Scheduled' : 'Done',
      ...(isDone ? { paidStatus: 'Unpaid', paymentDate: '' } : {}),
    });

    setSaveMessage(isDone ? 'CSC shift changed back to scheduled.' : 'CSC shift marked done.');
    setTimeout(() => setSaveMessage(''), 2500);
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
            shift.paidStatus === 'Paid' ? 'bg-slate-700 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700'
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
            shift.paidStatus === 'Paid' ? 'bg-slate-700 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700'
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
    const venues = Array.from(new Set(shifts.map((shift) => shift.venue).filter(Boolean))).sort();
    return ['All', ...venues];
  }, [shifts]);

  const monthOptions = useMemo(() => {
    const months = Array.from(new Set(shifts.map((shift) => getMonthKey(shift.startDate)))).sort();
    return ['All', ...months];
  }, [shifts]);


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

  const filteredShifts = useMemo(() => {
    return shifts.filter((shift) => {
      const isActiveShift = !['Done', 'Cancelled'].includes(shift.shiftStatus);
      const activeMatches = !showActiveOnly || isActiveShift;
      const venueMatches = venueFilter === 'All' || shift.venue === venueFilter;
      const statusMatches = statusFilter === 'All' || shift.shiftStatus === statusFilter;
      const paidMatches = paidFilter === 'All' || shift.paidStatus === paidFilter;
      const monthMatches = selectedMonth === 'All' || getMonthKey(shift.startDate) === selectedMonth;

      if (!activeMatches || !venueMatches || !statusMatches || !paidMatches || !monthMatches) return false;

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
  }, [combinedSearch, paidFilter, selectedMonth, shifts, showActiveOnly, statusFilter, venueFilter]);

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
        };

        currentWeek.shiftCount += 1;
        currentWeek.workedShiftCount += shift.shiftStatus === 'Done' ? 1 : 0;
        currentWeek.scheduledHours += hours;
        currentWeek.workedHours += workedHours;
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

    const weekly = Array.from(weeklyGroups.values())
      .sort((a, b) => b.weekKey.localeCompare(a.weekKey));
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

    const today = new Date();
    const todayKey = toLocalDateKey(today);
    const currentWeekKey = getWeekRange(todayKey)?.weekKey;
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
    const monthShifts = [
      ...shifts.map((shift) => ({ ...shift, recordSource: 'active' })),
      ...archivedShifts.map((shift) => ({ ...shift, recordSource: 'archived' })),
    ]
      .filter((shift) => getMonthKey(shift.startDate) === selectedPaidMonthKey)
      .sort((a, b) => `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`));

    const payableShifts = monthShifts.filter((shift) => shift.shiftStatus !== 'Cancelled');
    const doneShifts = payableShifts.filter((shift) => shift.shiftStatus === 'Done');
    const paidShifts = payableShifts.filter((shift) => shift.paidStatus === 'Paid');
    const owedShifts = doneShifts.filter((shift) => shift.paidStatus !== 'Paid');
    const openShifts = payableShifts.filter((shift) => !['Done', 'Cancelled'].includes(shift.shiftStatus));
    const cancelledShifts = monthShifts.filter((shift) => shift.shiftStatus === 'Cancelled');

    return {
      monthKey: selectedPaidMonthKey,
      label: monthSummary?.label || getMonthLabel(selectedPaidMonthKey),
      paidShifts: monthShifts,
      activeCount: monthShifts.filter((shift) => shift.recordSource === 'active').length,
      archivedCount: monthShifts.filter((shift) => shift.recordSource === 'archived').length,
      paidCount: paidShifts.length,
      owedCount: owedShifts.length,
      openCount: openShifts.length,
      cancelledCount: cancelledShifts.length,
      totalHours: payableShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0),
      workedHours: doneShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0),
      projectedPay: payableShifts.reduce((sum, shift) => sum + getEstimatedPay(shift), 0),
      earnedPay: doneShifts.reduce((sum, shift) => sum + getEstimatedPay(shift), 0),
      totalPay: paidShifts.reduce((sum, shift) => sum + getEstimatedPay(shift), 0),
      owedAmount: owedShifts.reduce((sum, shift) => sum + getEstimatedPay(shift), 0),
    };
  }, [archivedShifts, monthlySummary, selectedPaidMonthKey, shifts]);

  const activeShiftCount = useMemo(
    () => shifts.filter((shift) => !['Done', 'Cancelled'].includes(shift.shiftStatus)).length,
    [shifts]
  );

  const visibleShiftCount = filteredShifts.length;

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

  const handleAddScannedShift = () => {
    if (!scannedShifts.length) {
      setSaveMessage('Scan a CSC email before adding shifts.');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    writeCscSafetySnapshot('Before CSC email scan import', shifts, archivedShifts);

    let updatedCount = 0;
    let addedCount = 0;
    let collisionSafeCount = 0;
    const currentById = new Map(shifts.map((shift) => [shift.id, shift]));

    scannedShifts.forEach((scannedItem) => {
      const normalizedScannedItem = normalizeShift(scannedItem);
      const currentValues = Array.from(currentById.values());
      const matchedShiftId = findMatchingShiftIdForScannedEmail(currentValues, normalizedScannedItem);

      if (matchedShiftId) {
        const existingShift = currentById.get(matchedShiftId);
        currentById.set(matchedShiftId, mergeScannedShiftWithExisting(existingShift, normalizedScannedItem));
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

    const details = [
      `Updated ${updatedCount}`,
      `added ${addedCount}`,
      removedDuplicateCount ? `removed ${removedDuplicateCount} duplicate${removedDuplicateCount === 1 ? '' : 's'}` : '',
      collisionSafeCount ? `prevented ${collisionSafeCount} ID collision${collisionSafeCount === 1 ? '' : 's'}` : '',
    ].filter(Boolean);

    setSaveMessage(`CSC email imported safely. ${details.join(', ')}.`);
    setTimeout(() => setSaveMessage(''), 4000);
  };

  const handlePrintPremiumView = () => {
    window.print();
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
      <div className="grid gap-2">
        <div className="grid grid-cols-[minmax(0,1fr)_38px] gap-2 sm:grid-cols-[110px_34px]">
          <select
            value={shift.shiftStatus}
            onChange={(event) => updateShift(shift.id, { shiftStatus: event.target.value })}
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

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-[34px_42px_34px]">
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

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-[58px_34px_34px]">
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

        <div className="grid grid-cols-2 gap-2">
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

  const renderMobileShiftCard = (shift) => (
    <article key={shift.id} className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-amber-300 bg-amber-200 px-3 py-3">
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

      <div className="space-y-3 p-3">
        <section className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-700">
          <p className="font-black text-slate-950">Location</p>
          <p className="mt-0.5 break-words">{shift.address || 'Address not shown'}</p>
          <p className="break-words">{shift.city || 'City not entered'}</p>
        </section>

        <section className="space-y-1 text-sm text-slate-700">
          {shift.jobName ? <p className="break-words"><span className="font-black text-slate-900">Job:</span> {shift.jobName}</p> : null}
          {shift.shiftName ? <p className="break-words"><span className="font-black text-slate-900">Shift Name:</span> {shift.shiftName}</p> : null}
          {shift.roleName ? <p className="break-words"><span className="font-black text-slate-900">Role Name:</span> {shift.roleName}</p> : null}
        </section>

        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
            <p className="text-[10px] font-black uppercase tracking-wide text-blue-700">Start</p>
            <p className="mt-1 text-sm font-black text-slate-950">{formatDate(shift.startDate)}</p>
            <p className="text-sm font-bold text-blue-700">{formatTime(shift.startTime)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-600">Finish</p>
            <p className="mt-1 text-sm font-black text-slate-950">{formatDate(shift.finishDate)}</p>
            <p className="text-sm font-bold text-slate-700">{formatTime(shift.finishTime)}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
            <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700">Hours / Rate</p>
            <p className="mt-1 text-sm font-black text-slate-950">{getShiftHours(shift).toFixed(1)} hrs</p>
            <p className="text-xs font-bold text-emerald-800">{formatCurrency(Number(shift.hourlyRate) || 0)} per hour</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5">
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

        {shift.notes ? (
          <section className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs leading-relaxed text-slate-700">
            <span className="font-black text-slate-900">Notes:</span>{' '}
            <span className="break-words" style={{ overflowWrap: 'anywhere' }}>
              {expandedNoteIds.has(shift.id) ? shift.notes : getCollapsedNotesText(shift.notes)}
            </span>
            {shouldShowMoreNotes(shift.notes) ? (
              <button
                type="button"
                onClick={() => toggleShiftNotes(shift.id)}
                className="ml-1 text-xs text-blue-700 underline underline-offset-2"
              >
                {expandedNoteIds.has(shift.id) ? 'less' : 'more'}
              </button>
            ) : null}
          </section>
        ) : null}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-[10px] font-black uppercase tracking-wide text-slate-500">Shift Actions</p>
        {renderShiftActions(shift)}
      </div>
    </article>
  );

  return (
    <PageContainer surfaceClassName="min-h-screen bg-amber-50">
      <div className="flex flex-col gap-3 bg-amber-50 py-3 sm:gap-6 sm:py-6">
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

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">Scheduled Shifts</h2>
              <p className="text-sm text-slate-600">
                Edit status, pay, payment date, and notes directly in the table. Changes save in this browser.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleShowFullShiftList}
                title="Show full CSC shift list"
                aria-label="Show full CSC shift list"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-black px-4 text-sm font-extrabold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              >
                <ListChecks className="h-4 w-4" />
                <span>Show Full List</span>
              </button>
              <button
                type="button"
                onClick={() => setShowArchiveDrawer(true)}
                title={`Archive Drawer (${archivedShifts.length})`}
                aria-label={`Open archive drawer with ${archivedShifts.length} archived CSC shift${archivedShifts.length === 1 ? '' : 's'}`}
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg bg-violet-700 text-white shadow-sm hover:bg-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2"
              >
                <Archive className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-400 px-1 text-[11px] font-black leading-none text-white">
                  {archivedShifts.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowActiveOnly((current) => !current)}
                title={showActiveOnly ? 'Show All' : 'Show Active'}
                aria-label={showActiveOnly ? 'Show all CSC shifts' : 'Show only active CSC shifts'}
                aria-pressed={showActiveOnly}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  showActiveOnly ? 'bg-blue-700 hover:bg-blue-800 focus:ring-blue-400' : 'bg-slate-600 hover:bg-slate-700 focus:ring-slate-400'
                }`}
              >
                <Check className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setIsShiftTableCollapsed(true)}
                title="Collapse All"
                aria-label="Collapse CSC shifts table"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-600 text-white shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setIsShiftTableCollapsed(false)}
                title="Expand All"
                aria-label="Expand CSC shifts table"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-600 text-white shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="rounded-full bg-blue-700 px-3 py-2 text-xs font-extrabold text-white shadow-sm">
                Active {activeShiftCount}
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-extrabold text-slate-700">
                Showing {visibleShiftCount}
              </div>
            </div>
          </div>

          <>

          <div className="overflow-hidden rounded-lg border-2 border-black">
            <div className="flex flex-col gap-2 bg-black px-3 py-3 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
              <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                <GripVertical className="hidden h-4 w-4 shrink-0 text-slate-400 sm:block" />
                <button
                  type="button"
                  onClick={() => setIsShiftTableCollapsed((current) => !current)}
                  className="rounded p-1 text-white transition-colors hover:bg-slate-800"
                  aria-label={isShiftTableCollapsed ? 'Expand CSC Shifts' : 'Collapse CSC Shifts'}
                  title={isShiftTableCollapsed ? 'Expand CSC Shifts' : 'Collapse CSC Shifts'}
                >
                  {isShiftTableCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-wrap">
                  <BriefcaseBusiness className="h-5 w-5 shrink-0 text-yellow-300" />
                  <h3 className="whitespace-nowrap text-base font-semibold text-white sm:text-lg">CSC Shifts</h3>
                  <span
                    className="inline-flex shrink-0 items-center rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-black text-white shadow-sm sm:px-3 sm:py-1 sm:text-xs sm:uppercase sm:tracking-wide"
                    title={`${activeShiftCount} active CSC shifts`}
                  >
                    Active {activeShiftCount}
                  </span>
                  <span className="hidden text-xs font-semibold text-slate-400 sm:inline">Showing {visibleShiftCount}</span>
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
              {filteredShifts.map((shift) => (
                <article key={shift.id} className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-yellow-950">
                        <Sparkles className="h-5 w-5" />
                        <h3 className="text-lg font-extrabold">{shift.venue || 'CSC Shift'}</h3>
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-800">{shift.event || 'Event not entered'}</p>
                      <p className="mt-1 text-xs text-slate-600">{shift.jobName || 'Job name not entered'}</p>
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
                      onChange={(event) => updateShift(shift.id, { shiftStatus: event.target.value })}
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
            </div>
          ) : (
          <>
          <div className="grid gap-3 p-2 sm:hidden">
            {filteredShifts.map((shift) => renderMobileShiftCard(shift))}
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
                  <th className="px-4 py-3 font-extrabold">Shift</th>
                  <th className="px-4 py-3 font-extrabold">Start</th>
                  <th className="px-4 py-3 font-extrabold">Finish</th>
                  <th className="px-4 py-3 font-extrabold">Details</th>
                  <th className="sticky right-0 z-10 w-[170px] min-w-[170px] border-l border-slate-200 bg-slate-100 px-3 py-3 font-extrabold shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredShifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-yellow-50/60">
                    <td className="px-3 py-3 align-top">
                      <div className="font-bold text-slate-950">{shift.venue}</div>
                      <div className="text-slate-600">{shift.city}</div>
                      <div className="mt-1 text-xs text-slate-500">{shift.address || 'Address not shown'}</div>
                      <div className="mt-2 text-xs font-semibold text-slate-500">{shift.jobName}</div>
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
                    <td className="whitespace-nowrap px-3 py-3 align-top font-bold text-blue-700">
                      <div>{formatDate(shift.startDate)}</div>
                      <div>{formatTime(shift.startTime)}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 align-top">
                      <div>{formatDate(shift.finishDate)}</div>
                      <div>{formatTime(shift.finishTime)}</div>
                    </td>
                    <td className="w-[345px] min-w-0 max-w-[345px] overflow-hidden whitespace-normal break-words px-4 py-3 align-top text-slate-900">
                      <div className="max-w-full overflow-hidden whitespace-normal break-words font-semibold leading-snug">{shift.event}</div>
                      <div className="mt-2 grid max-w-full grid-cols-2 gap-x-3 gap-y-1 overflow-hidden text-xs text-slate-600">
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Hours:</span> {getShiftHours(shift).toFixed(1)}</div>
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Rate:</span> {formatCurrency(Number(shift.hourlyRate) || 0)}</div>
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Est. Pay:</span> {formatCurrency(getEstimatedPay(shift))}</div>
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Status:</span> {shift.shiftStatus}</div>
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Paid:</span> {getShiftPaymentStatusLabel(shift)}</div>
                        {shift.googleCalendarEventId || shift.googleCalendarEventLink ? (
                          <div className="min-w-0 break-words text-green-700">
                            <span className="font-bold">Calendar:</span> Added
                          </div>
                        ) : null}
                        {shift.paymentDate ? <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Pay Date:</span> {formatDate(shift.paymentDate)}</div> : null}
                        {shift.parking ? <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Parking:</span> {shift.parking}</div> : null}
                        {shift.supervisor ? <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Supervisor:</span> {shift.supervisor}</div> : null}
                      </div>
                      {shift.notes ? (
                        <div className="mt-2 box-border w-[315px] max-w-[315px] overflow-hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs leading-relaxed text-slate-700">
                          <div
                            className="min-w-0 whitespace-normal break-words"
                            style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
                          >
                            <span className="font-bold">Notes:</span>{' '}
                            {expandedNoteIds.has(shift.id) ? shift.notes : getCollapsedNotesText(shift.notes)}
                            {shouldShowMoreNotes(shift.notes) ? (
                              <>
                                {' '}
                                <button
                                  type="button"
                                  onClick={() => toggleShiftNotes(shift.id)}
                                  className="inline text-xs font-normal text-blue-700 underline decoration-1 underline-offset-2 hover:text-blue-900"
                                  title={expandedNoteIds.has(shift.id) ? 'Show less notes' : 'Show more notes'}
                                  aria-label={expandedNoteIds.has(shift.id) ? 'Show less notes' : 'Show more notes'}
                                >
                                  {expandedNoteIds.has(shift.id) ? 'less' : 'more'}
                                </button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </td>
                    <td className="sticky right-0 z-10 w-[170px] min-w-[170px] whitespace-nowrap border-l border-slate-200 bg-white px-2 py-3 align-top shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.45)]">
                      {renderShiftActions(shift)}
                    </td>
                  </tr>
                ))}
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

        <section className="grid grid-cols-4 gap-3">
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-950 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">Scheduled Shifts</p>
                <p className="mt-1 text-2xl font-extrabold">{summary.totalShifts}</p>
              </div>
              <BriefcaseBusiness className="h-8 w-8 opacity-80" />
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">Estimated Hours</p>
                <p className="mt-1 text-2xl font-extrabold">{summary.totalHours.toFixed(1)}</p>
                <p className="mt-1 text-xs font-bold text-blue-800">Done: {summary.workedHours.toFixed(1)}</p>
              </div>
              <Clock className="h-8 w-8 opacity-80" />
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">Estimated Pay</p>
                <p className="mt-1 text-2xl font-extrabold">{formatCurrency(summary.estimatedPay)}</p>
                <p className="mt-1 text-xs font-bold text-emerald-800">Paid: {formatCurrency(summary.paidAmount)}</p>
              </div>
              <DollarSign className="h-8 w-8 opacity-80" />
            </div>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-950 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">Still Owed</p>
                <p className="mt-1 text-2xl font-extrabold">{formatCurrency(summary.owedAmount)}</p>
                <p className="mt-1 text-xs font-bold text-red-800">Done and unpaid only</p>
              </div>
              <CheckCircle2 className="h-8 w-8 opacity-80" />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 text-black shadow-sm">
          <div className="mb-3">
            <h2 className="text-lg font-extrabold text-black">Hours Worked Summary</h2>
            <p className="text-xs text-black">
              Worked hours include shifts marked Done. Weeks run Monday through Sunday. Scheduled hours exclude cancelled shifts.
            </p>
          </div>

          <div className="grid gap-3 text-black sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-black">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-black">This Week</p>
              <p className="mt-1 text-2xl font-extrabold">{hoursAnalytics.currentWeekWorkedHours.toFixed(1)} hrs</p>
              <p className="mt-1 text-xs font-bold text-black">
                Scheduled: {hoursAnalytics.currentWeekScheduledHours.toFixed(1)}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-black">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-black">This Month</p>
              <p className="mt-1 text-2xl font-extrabold">{hoursAnalytics.currentMonthWorkedHours.toFixed(1)} hrs</p>
              <p className="mt-1 text-xs font-bold text-black">
                Scheduled: {hoursAnalytics.currentMonthScheduledHours.toFixed(1)}
              </p>
            </div>

            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-black">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-black">This Year</p>
              <p className="mt-1 text-2xl font-extrabold">{hoursAnalytics.currentYearWorkedHours.toFixed(1)} hrs</p>
              <p className="mt-1 text-xs font-bold text-black">
                Scheduled: {hoursAnalytics.currentYearScheduledHours.toFixed(1)}
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-black">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-black">Average Month</p>
              <p className="mt-1 text-2xl font-extrabold">{hoursAnalytics.averageWorkedMonth.toFixed(1)} hrs</p>
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
              <div className="max-h-[198px] overflow-x-hidden overflow-y-auto">
                <table className="w-full table-fixed text-left text-xs text-black">
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
                      <tr key={week.weekKey} className="bg-white">
                        <td className="px-2 py-2 font-bold text-black">
                          {formatWeekRange(week.startDate, week.endDate)}
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
              <div className="max-h-[198px] overflow-x-hidden overflow-y-auto">
                <table className="w-full table-fixed text-left text-xs text-black">
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

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-950">Monthly Pay Summary</h2>
              <p className="text-xs text-slate-600">
                Past, current, and next month are shown by default. Historical All-Time includes active and archived records.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-800 shadow-sm">
                <span>View month range</span>
                <select
                  value={monthRangeMode}
                  onChange={(event) => setMonthRangeMode(event.target.value)}
                  className="bg-transparent text-xs font-extrabold text-slate-900 outline-none"
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
                onClick={() => {
                  setMonthRangeMode('historical');
                  setSelectedMonth('All');
                }}
                title="Show historical all-time monthly records"
                aria-label="Show historical all-time monthly records"
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-slate-800"
              >
                <History className="h-4 w-4" />
                Historical All-Time
              </button>
              <button
                type="button"
                onClick={() => setSelectedMonth('All')}
                title="Show all months in the shift table"
                aria-label="Show all CSC shift months in the shift table"
                className={`rounded-full px-3 py-1.5 text-xs font-extrabold shadow-sm transition ${
                  selectedMonth === 'All'
                    ? 'bg-black text-white'
                    : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                }`}
              >
                All Months
              </button>
              <div className="text-xs font-bold text-slate-700">{monthlySummaryDateLabel}</div>
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
                onClick={() => {
                  setSelectedMonth(month.monthKey);
                  setSelectedPaidMonthKey(month.monthKey);
                }}
                title={`Show CSC shifts for ${month.label}`}
                aria-label={`Show CSC shifts for ${month.label}`}
                className={`rounded-xl border p-3 text-left shadow-sm transition hover:shadow-md ${
                  selectedMonth === month.monthKey || selectedPaidMonthKey === month.monthKey
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

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
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
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 px-4 py-6">
            <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-5 shadow-2xl">
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
          <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/70 px-4 py-6 print:static print:overflow-visible print:bg-white print:p-0">
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
            <div className="csc-premium-actions mx-auto mb-5 flex w-full max-w-6xl items-center justify-between gap-3">
              <CloseScreenButton onClick={() => setShowPremiumOverlay(false)} />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrintPremiumView}
                  className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-extrabold text-white shadow-lg hover:bg-slate-800"
                >
                  <Printer className="h-4 w-4" />
                  Print
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPremiumView}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-extrabold text-white shadow-lg hover:bg-emerald-700"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
              </div>
            </div>

            <div className="csc-premium-print mx-auto max-w-6xl rounded-3xl bg-white px-10 py-12 font-serif text-slate-950 shadow-2xl">
              <header className="text-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-950">CSC Shifts List</h1>
                <p className="mt-3 text-base font-semibold text-slate-600">
                  Structured shift schedule, generated {new Date().toISOString().slice(0, 10)}
                </p>
                <div className="mt-6 border-t-4 border-slate-950" />
              </header>

              <section className="mt-8 rounded-2xl border-l-8 border-yellow-600 bg-slate-50 p-5">
                <h2 className="text-xl font-extrabold text-slate-950">{CSC_COMPANY.name} - {CSC_COMPANY.branch}</h2>
                <p className="mt-2 text-sm font-semibold text-slate-700">{CSC_COMPANY.address}</p>
                <p className="mt-1 text-sm font-semibold text-slate-700">{CSC_COMPANY.phone} | {CSC_COMPANY.website}</p>
              </section>

              <section className="mt-6 grid gap-3 md:grid-cols-4">
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
                    <article key={shift.id} className="csc-premium-shift-card break-inside-avoid rounded-2xl border border-slate-200 bg-white p-5 shadow-sm print:p-3 print:shadow-none">
                      <div className="grid grid-cols-[18px_1fr_auto] items-start gap-4">
                        <div className="mt-1 h-4 w-4 border-2 border-slate-950" />
                        <div>
                          <h3 className="csc-premium-shift-title text-xl font-extrabold text-slate-950">{shift.venue || 'CSC Shift'}</h3>
                          <p className="csc-premium-shift-meta mt-1 text-sm font-bold text-slate-700">{shift.event || 'Event not entered'}</p>
                          <p className="csc-premium-shift-meta mt-1 text-xs font-semibold text-slate-500">{shift.jobName || 'Job name not entered'}</p>
                          {shift.shiftName ? <p className="csc-premium-shift-meta mt-1 text-xs font-semibold text-slate-500">Shift Name: {shift.shiftName}</p> : null}
                          {shift.roleName ? <p className="csc-premium-shift-meta mt-1 text-xs font-semibold text-slate-500">Role Name: {shift.roleName}</p> : null}
                        </div>
                        <div className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-extrabold text-yellow-900">
                          {shift.shiftStatus}
                        </div>
                      </div>

                      <div className="mt-4 divide-y divide-slate-200 text-sm">
                        <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
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
                          <div className="font-extrabold text-slate-700">Hours</div>
                          <div>{getShiftHours(shift).toFixed(1)}</div>
                        </div>
                        <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
                          <div className="font-extrabold text-slate-700">Hourly Rate</div>
                          <div>{formatCurrency(Number(shift.hourlyRate) || 0)}</div>
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

        {selectedPaidMonth && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 p-3">
            <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-950">CSC Shifts - {selectedPaidMonth.label}</h2>
                  <p className="text-xs text-slate-600">
                    {selectedPaidMonth.paidShifts.length} shifts, {selectedPaidMonth.paidCount} paid, {selectedPaidMonth.owedCount} still owed, {selectedPaidMonth.activeCount} active, {selectedPaidMonth.archivedCount} archived.
                  </p>
                </div>
                <CloseScreenButton onClick={() => setSelectedPaidMonthKey('')} />
              </div>

              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div className="grid gap-2 md:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Month Shifts</p>
                    <p className="mt-0.5 text-lg font-extrabold text-slate-950">{selectedPaidMonth.paidShifts.length}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Worked Hours</p>
                    <p className="mt-0.5 text-lg font-extrabold text-slate-950">{selectedPaidMonth.workedHours.toFixed(1)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Paid Amount</p>
                    <p className="mt-0.5 text-lg font-extrabold text-emerald-700">{formatCurrency(selectedPaidMonth.totalPay)}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <p className="text-[10px] font-extrabold uppercase tracking-wide text-slate-500">Still Owed</p>
                    <p className="mt-0.5 text-lg font-extrabold text-red-700">{formatCurrency(selectedPaidMonth.owedAmount)}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {selectedPaidMonth.paidShifts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-xs font-semibold text-slate-600">
                    No CSC shifts are saved for {selectedPaidMonth.label}.
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {selectedPaidMonth.paidShifts.map((shift) => (
                      <article
                        key={`${shift.recordSource}-${shift.id}`}
                        className="rounded-xl border border-emerald-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-base font-extrabold leading-tight text-slate-950">{shift.venue || 'CSC Shift'}</h3>
                            <p className="mt-0.5 text-xs font-bold leading-tight text-slate-700">{shift.event || 'Event not entered'}</p>
                            <p className="mt-0.5 text-[11px] font-semibold leading-tight text-slate-500">{shift.jobName || 'Job name not entered'}</p>
                            {shift.shiftName ? <p className="mt-0.5 text-[11px] font-semibold leading-tight text-slate-500">Shift Name: {shift.shiftName}</p> : null}
                            {shift.roleName ? <p className="mt-0.5 text-[11px] font-semibold leading-tight text-slate-500">Role Name: {shift.roleName}</p> : null}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`w-fit rounded-full border px-2 py-0.5 text-[11px] font-extrabold ${
                                shift.paidStatus === 'Paid'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : 'border-red-200 bg-red-50 text-red-800'
                              }`}
                            >
                              {getShiftPaymentStatusLabel(shift)}
                            </span>
                            {shift.shiftStatus === 'Done' && shift.paidStatus !== 'Paid' ? (
                              <span className="w-fit rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-extrabold text-red-800">
                                Still Owed
                              </span>
                            ) : null}
                            <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-extrabold text-slate-700">
                              {shift.recordSource === 'archived' ? 'Archived' : 'Active'}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 grid gap-1 text-xs leading-tight text-slate-700">
                          <div className="grid grid-cols-[94px_1fr] gap-2 border-t border-slate-100 pt-1.5">
                            <span className="font-extrabold text-slate-950">Start</span>
                            <span>{formatDate(shift.startDate)} {formatTime(shift.startTime)}</span>
                          </div>
                          <div className="grid grid-cols-[94px_1fr] gap-2 border-t border-slate-100 pt-1.5">
                            <span className="font-extrabold text-slate-950">Finish</span>
                            <span>{formatDate(shift.finishDate)} {formatTime(shift.finishTime)}</span>
                          </div>
                          {shift.roleName ? (
                            <div className="grid grid-cols-[94px_1fr] gap-2 border-t border-slate-100 pt-1.5">
                              <span className="font-extrabold text-slate-950">Role Name</span>
                              <span>{shift.roleName}</span>
                            </div>
                          ) : null}
                          {shift.shiftName ? (
                            <div className="grid grid-cols-[94px_1fr] gap-2 border-t border-slate-100 pt-1.5">
                              <span className="font-extrabold text-slate-950">Shift Name</span>
                              <span>{shift.shiftName}</span>
                            </div>
                          ) : null}
                          {shift.uniform ? (
                            <div className="grid grid-cols-[94px_1fr] gap-2 border-t border-slate-100 pt-1.5">
                              <span className="font-extrabold text-slate-950">Uniform</span>
                              <span>{shift.uniform}</span>
                            </div>
                          ) : null}
                          <div className="grid grid-cols-[94px_1fr] gap-2 border-t border-slate-100 pt-1.5">
                            <span className="font-extrabold text-slate-950">Hours</span>
                            <span>{getShiftHours(shift).toFixed(1)}</span>
                          </div>
                          <div className="grid grid-cols-[94px_1fr] gap-2 border-t border-slate-100 pt-1.5">
                            <span className="font-extrabold text-slate-950">Pay</span>
                            <span>{formatCurrency(getEstimatedPay(shift))}</span>
                          </div>
                          <div className="grid grid-cols-[94px_1fr] gap-2 border-t border-slate-100 pt-1.5">
                            <span className="font-extrabold text-slate-950">Payment Date</span>
                            <span>{shift.shiftStatus === 'Cancelled' ? 'Not applicable' : shift.paymentDate ? formatShortDate(shift.paymentDate) : 'No payment date entered'}</span>
                          </div>
                          <div className="grid grid-cols-[94px_1fr] gap-2 border-t border-slate-100 pt-1.5">
                            <span className="font-extrabold text-slate-950">Paid Status</span>
                            <span>{getShiftPaymentStatusLabel(shift)}</span>
                          </div>
                          <div className="grid grid-cols-[94px_1fr] gap-2 border-t border-slate-100 pt-1.5">
                            <span className="font-extrabold text-slate-950">Status</span>
                            <span>{shift.shiftStatus}</span>
                          </div>
                          <div className="grid grid-cols-[94px_1fr] gap-2 border-t border-slate-100 pt-1.5">
                            <span className="font-extrabold text-slate-950">Location</span>
                            <span>{[shift.address, shift.city].filter(Boolean).join(', ') || 'Address not shown'}</span>
                          </div>
                          {shift.parking ? (
                            <div className="grid grid-cols-[94px_1fr] gap-2 border-t border-slate-100 pt-1.5">
                              <span className="font-extrabold text-slate-950">Parking</span>
                              <span className="whitespace-pre-wrap">{shift.parking}</span>
                            </div>
                          ) : null}
                          {shift.notes ? (
                            <div className="grid grid-cols-[94px_1fr] gap-2 border-t border-slate-100 pt-1.5">
                              <span className="font-extrabold text-slate-950">Notes</span>
                              <span className="whitespace-pre-wrap">{shift.notes}</span>
                            </div>
                          ) : null}
                        </div>

                        {shift.shiftStatus !== 'Cancelled' ? (
                          shift.recordSource === 'archived' ? renderArchivedPaidControls(shift, true) : renderActivePaidControls(shift)
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenShiftDetails(shift)}
                            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1.5 text-xs font-bold text-cyan-800 hover:bg-cyan-100"
                            aria-label="Open shift details"
                            title="Open shift details"
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

        {selectedDetailShift && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 p-4">
            <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-950">CSC Shift Details</h2>
                  <p className="text-sm text-slate-600">Full shift record with restore, edit, archive, and delete actions.</p>
                </div>
                <CloseScreenButton onClick={handleCloseShiftDetails} />
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-2xl font-extrabold text-slate-950">{selectedDetailShift.venue || 'CSC Shift'}</h3>
                      <p className="mt-1 font-bold text-slate-800">{selectedDetailShift.event || 'Event not entered'}</p>
                      <p className="mt-1 text-sm text-slate-600">{selectedDetailShift.jobName || 'Job name not entered'}</p>
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
                    <p className="mt-1 font-bold text-slate-950">{getShiftHours(selectedDetailShift).toFixed(1)} hours at {formatCurrency(Number(selectedDetailShift.hourlyRate) || 0)}</p>
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
                    <p className="text-xs font-extrabold uppercase text-slate-500">Supervisor / Parking</p>
                    <p className="mt-1 text-sm text-slate-700">Supervisor: {selectedDetailShift.supervisor || 'Not entered'}</p>
                    <p className="text-sm text-slate-700">Parking: {selectedDetailShift.parking || 'Not entered'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 md:col-span-2">
                    <p className="text-xs font-extrabold uppercase text-slate-500">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selectedDetailShift.notes || 'No notes entered.'}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50 p-4">
                {selectedDetailShiftIsArchived ? (
                  <div className="grid gap-3">
                    {selectedDetailShift.shiftStatus !== 'Cancelled'
                      ? renderArchivedPaidControls(selectedDetailShift)
                      : null}
                    <div className="flex flex-wrap items-center justify-end gap-2">
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
                  renderShiftActions(selectedDetailShift)
                )}
              </div>
            </div>
          </div>
        )}

        {showArchiveDrawer && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 p-4">
            <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-950">CSC Shift Archive</h2>
                  <p className="text-sm text-slate-600">Restore archived shifts or permanently delete old records.</p>
                </div>
                <CloseScreenButton onClick={() => setShowArchiveDrawer(false)} />
              </div>

              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
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

              <div className="flex-1 overflow-y-auto p-5">
                {filteredArchivedShifts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                    No archived CSC shifts match the current filters.
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {filteredArchivedShifts.map((shift) => (
                      <article key={shift.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-lg font-extrabold text-slate-950">{shift.venue || 'CSC Shift'}</h3>
                            <p className="mt-1 text-sm font-bold text-slate-700">{shift.event || 'Event not entered'}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{shift.jobName || 'Job name not entered'}</p>
                            {shift.shiftName ? <p className="mt-1 text-xs font-semibold text-slate-500">Shift Name: {shift.shiftName}</p> : null}
                            {shift.roleName ? <p className="mt-1 text-xs font-semibold text-slate-500">Role Name: {shift.roleName}</p> : null}
                          </div>
                          <span className="w-fit rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-extrabold text-yellow-900">
                            {shift.shiftStatus}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-2 text-sm text-slate-700">
                          <div className="grid grid-cols-[110px_1fr] gap-3 border-t border-slate-100 pt-2">
                            <span className="font-extrabold text-slate-950">Start</span>
                            <span>{formatDate(shift.startDate)} {formatTime(shift.startTime)}</span>
                          </div>
                          <div className="grid grid-cols-[110px_1fr] gap-3 border-t border-slate-100 pt-2">
                            <span className="font-extrabold text-slate-950">Finish</span>
                            <span>{formatDate(shift.finishDate)} {formatTime(shift.finishTime)}</span>
                          </div>
                          <div className="grid grid-cols-[110px_1fr] gap-3 border-t border-slate-100 pt-2">
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
                          <div className="grid grid-cols-[110px_1fr] gap-3 border-t border-slate-100 pt-2">
                            <span className="font-extrabold text-slate-950">Archived</span>
                            <span>{shift.archivedAt ? new Date(shift.archivedAt).toLocaleString() : 'Date not saved'}</span>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
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
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 p-4">
            <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-950">Scan CSC Email</h2>
                  <p className="text-sm text-slate-600">Paste a CSC schedule update, acceptance, courtesy reminder, or Kia Forum schedule email. The scanner fills known fields and saves extra details to notes.</p>
                </div>
                <CloseScreenButton onClick={() => setShowScanDrawer(false)} />
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  CSC email text
                  <textarea
                    value={shiftEmailText}
                    onChange={(event) => {
                      setShiftEmailText(event.target.value);
                      setScannedShift(null);
                    }}
                    rows={9}
                    placeholder={'Courtesy Shift Reminder & Important Info\n\nSchedule for : David Gregory Hallstrom II\nVenue: SoFi Stadium and Hollywood Park Shift No: 2 Shift: Vertical - Elevator and Escalator - TC Scheduled Start Time: 6/21/2026 5:30:00 AM Scheduled Finish: 6/21/2026 4:30:00 PM\n\nDNS ROSALIA N1\tThe Forum\t1ST RAMPS\tSecurity Guard\t6/29/2026 4:00:00 PM\t6/29/2026 11:30:00 PM\tENTRY POINT ADDRESS: 3600 Pincay Dr, Inglewood, CA, 90305 Parking will be at SoFi lot D.\tSIGN-IN IS NEXT TO THE BIG WHITE HOUSE ON THE SOUTHEAST CORNER OF THE PROPERTY.\tAll Black Everything.'}
                    className="resize-y rounded-xl border border-slate-300 px-3 py-2 font-normal text-slate-950 focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

                <div className="mt-4 flex flex-wrap items-center gap-3">
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
                      setScannedShift(null);
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 hover:bg-slate-50"
                  >
                    Clear
                  </button>
                </div>

                {scannedShifts.length > 0 && (
                  <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-900">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-lg font-extrabold text-slate-950">Scanned Shift Preview</h3>
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

              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
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
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-4 sm:items-center">
            <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-950">{editingShiftId ? 'Edit CSC Shift' : 'Add CSC Shift'}</h2>
                  <p className="text-sm text-slate-600">Create a new CSC shift and save it to this browser.</p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {!editingShiftId && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddDrawer(false);
                        setEditingShiftId(null);
                        setNewShift(createBlankShift());
                        setShowScanDrawer(true);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
                      title="Scan CSC shift email"
                    >
                      <StickyNote className="h-4 w-4" />
                      Scan Email
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

                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Parking
                  <input
                    type="text"
                    value={newShift.parking}
                    onChange={(event) => setNewShift((current) => ({ ...current, parking: event.target.value }))}
                    className="rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200"
                  />
                </label>

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
