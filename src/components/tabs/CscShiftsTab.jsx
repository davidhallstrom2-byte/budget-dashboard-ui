import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CalendarPlus,
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

const CSC_STORAGE_KEY = 'cscShifts.v1';
const CSC_ARCHIVE_STORAGE_KEY = 'cscShifts.archived.v1';
const CSC_DELETED_SEED_STORAGE_KEY = 'cscShifts.deletedSeedIds.v1';
const CSC_SNAPSHOT_STORAGE_KEY = 'cscShifts.safetySnapshot.v1';
const CSC_CALENDAR_ADDED_STORAGE_KEY = 'cscShifts.googleCalendarAdded.v1';
const CSC_SHIFT_UPDATE_EVENT = 'cscShifts:updated';
const DEFAULT_HOURLY_RATE = '20.50';
const OLD_DEFAULT_HOURLY_RATE = '15.50';

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

const SHIFT_STATUS_OPTIONS = ['Scheduled', 'Confirmed', 'Cancelled', 'Done'];

const getShiftStatusColorClass = (status) => {
  if (status === 'Done') return 'bg-green-600 hover:bg-green-700';
  if (status === 'Confirmed') return 'bg-blue-600 hover:bg-blue-700';
  if (status === 'Cancelled') return 'bg-red-600 hover:bg-red-700';
  return 'bg-slate-600 hover:bg-slate-700';
};

const getShiftStatusOptionStyle = (status) => {
  if (status === 'Done') return { backgroundColor: '#16a34a', color: '#ffffff' };
  if (status === 'Confirmed') return { backgroundColor: '#2563eb', color: '#ffffff' };
  if (status === 'Cancelled') return { backgroundColor: '#dc2626', color: '#ffffff' };
  return { backgroundColor: '#475569', color: '#ffffff' };
};
const PAID_STATUS_OPTIONS = ['Unpaid', 'Paid'];

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

  if (!rate || rate === OLD_DEFAULT_HOURLY_RATE) return DEFAULT_HOURLY_RATE;

  return rate;
};

const normalizeShiftStatus = (value) => {
  const status = String(value || '').trim();

  if (!status) return 'Scheduled';
  if (status === 'Worked') return 'Scheduled';
  if (status === 'Paid') return 'Done';
  if (status === 'Complete' || status === 'Completed') return 'Done';

  return SHIFT_STATUS_OPTIONS.includes(status) ? status : 'Scheduled';
};

const normalizeShift = (shift = {}) => ({
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
  shiftStatus: normalizeShiftStatus(shift.shiftStatus),
  hourlyRate: normalizeHourlyRate(shift.hourlyRate),
  paidStatus: shift.paidStatus || 'Unpaid',
  paymentDate: shift.paymentDate || '',
  notes: shift.notes || '',
  parking: shift.parking || '',
  uniform: shift.uniform || '',
  supervisor: shift.supervisor || '',
});

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
  const rate = Number.parseFloat(shift.hourlyRate);
  if (!Number.isFinite(rate) || rate <= 0) return 0;

  return Math.round(getShiftHours(shift) * rate * 100) / 100;
};

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

    return [...mergedSeeds, ...imported].sort((a, b) => `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`));
  } catch {
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
  const slug = [shift.venue, shift.jobName, shift.startDate, shift.startTime]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);

  return `csc-email-${slug || Date.now()}`;
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
  'Event Date',
  'Job Name',
  'Event Name',
  'Venue Name',
  'Venue Address',
  'Shift Name',
  'Role Name',
  'Job Start Time',
  'Job End Time',
  'Special Notes',
  'Job',
  'Role',
];

const escapeRegExp = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getAcceptanceField = (source = '', labels = []) => {
  const lines = String(source || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const label of labels) {
    const pattern = new RegExp(`^${escapeRegExp(label)}\\s*:?\\s*(.*)$`, 'i');
    const line = lines.find((candidate) => pattern.test(candidate));
    const value = line?.match(pattern)?.[1]?.trim() || '';

    if (value) return value.replace(/^[-:]+\s*/, '').trim();
  }

  const compact = String(source || '').replace(/\r/g, '\n');

  for (const label of labels) {
    const startPattern = new RegExp(`${escapeRegExp(label)}\\s*:?\\s*`, 'i');
    const startMatch = startPattern.exec(compact);
    if (!startMatch) continue;

    const startIndex = startMatch.index + startMatch[0].length;
    const remaining = compact.slice(startIndex);
    const nextIndexes = ACCEPTANCE_EMAIL_LABELS
      .filter((nextLabel) => nextLabel.toLowerCase() !== label.toLowerCase())
      .map((nextLabel) => {
        const nextMatch = new RegExp(`(?:\\n|\\s{2,})${escapeRegExp(nextLabel)}\\s*:?`, 'i').exec(remaining);
        return nextMatch ? nextMatch.index : -1;
      })
      .filter((index) => index >= 0);
    const endIndex = nextIndexes.length ? Math.min(...nextIndexes) : remaining.length;
    const value = remaining.slice(0, endIndex).trim();

    if (value) return value.replace(/^[-:]+\s*/, '').trim();
  }

  return '';
};

const parseDateTimeText = (value = '') => {
  const match = String(value || '').trim().match(
    /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})\s*(AM|PM)?/i
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

const parseAcceptanceEmail = (text) => {
  const source = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .trim();

  if (!source) return null;

  const eventDateText = getAcceptanceField(source, ['Event Date']);
  const oldJobText = getAcceptanceField(source, ['Job']);
  const oldRoleText = getAcceptanceField(source, ['Role']);
  const jobNameText = getAcceptanceField(source, ['Job Name']);
  const eventNameText = getAcceptanceField(source, ['Event Name']);
  const venueNameText = getAcceptanceField(source, ['Venue Name']);
  const venueAddressText = getAcceptanceField(source, ['Venue Address']);
  const shiftNameText = getAcceptanceField(source, ['Shift Name']);
  const roleNameText = getAcceptanceField(source, ['Role Name']);
  const jobStartText = getAcceptanceField(source, ['Job Start Time']);
  const jobEndText = getAcceptanceField(source, ['Job End Time']);
  const specialNotesText = getAcceptanceField(source, ['Special Notes']);
  const titleMatch = source.match(/APPROVED\s*[–-]\s*Schedule\s+Update/i);

  const jobText = jobNameText || oldJobText || '';
  const eventText = eventNameText || cleanEventNameFromJob(oldJobText || jobNameText || '');
  const roleText = oldRoleText || roleNameText || '';
  const eventDate = slashDateToIso(eventDateText || '');
  const startDateTime = parseDateTimeText(jobStartText);
  const finishDateTime = parseDateTimeText(jobEndText);
  const timeMatch = roleText.match(
    /(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})\s*(AM|PM)?\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})\s*(AM|PM)?/i
  );

  if (!jobText && !eventText && !roleText && !eventDate && !startDateTime.date) return null;

  const inferredFromFields = inferVenueCityFromFields(venueNameText, venueAddressText);
  const inferredFromText = inferVenueFromAcceptanceEmail(jobText, roleText || `${eventText} ${venueNameText}`);
  const venueInfo = inferredFromFields.venue || inferredFromFields.address ? inferredFromFields : inferredFromText;
  const startDate = startDateTime.date || slashDateToIso(timeMatch?.[1] || '') || eventDate;
  const startTime = startDateTime.time || normalizeTimeValue(timeMatch?.[2] || '', timeMatch?.[3] || '');
  const finishDate = finishDateTime.date || slashDateToIso(timeMatch?.[4] || '') || startDate;
  const finishTime = finishDateTime.time || normalizeTimeValue(timeMatch?.[5] || '', timeMatch?.[6] || '');
  const parsedRoleName = roleNameText || roleText.split(/\s+[–-]\s+\d{1,2}\/\d{1,2}\/\d{4}\s+/i)[0]?.trim() || '';
  const parsedShift = normalizeShift({
    ...venueInfo,
    startDate,
    startTime,
    finishDate,
    finishTime,
    event: eventText || cleanEventNameFromJob(jobText),
    jobName: jobText || shiftNameText || parsedRoleName || 'Accepted CSC shift',
    shiftStatus: 'Confirmed',
    hourlyRate: DEFAULT_HOURLY_RATE,
    paidStatus: 'Unpaid',
    notes: [
      titleMatch ? 'Accepted shift email: APPROVED - Schedule Update.' : 'Accepted shift email imported.',
      shiftNameText ? `Shift: ${shiftNameText}.` : '',
      parsedRoleName ? `Role: ${parsedRoleName}.` : '',
      specialNotesText || '',
    ]
      .filter(Boolean)
      .join('\n'),
  });

  return normalizeShift({
    ...parsedShift,
    id: createShiftIdFromEmail(parsedShift),
  });
};

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
      shiftStatus: row.shiftStatus,
      hourlyRate: row.hourlyRate,
      paidStatus: row.paidStatus,
      paymentDate: row.paymentDate,
      notes: row.notes,
      parking: row.parking,
      uniform: row.uniform,
      supervisor: row.supervisor,
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
  ];

  const rows = shifts.map((shift) => ({
    ...shift,
    hours: getShiftHours(shift).toFixed(2),
    estimatedPay: getEstimatedPay(shift).toFixed(2),
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
              <tr><th>Hours</th><td>${getShiftHours(shift).toFixed(1)}</td></tr>
              <tr><th>Hourly Rate</th><td>${escapeHtml(formatCurrency(Number(shift.hourlyRate) || 0))}</td></tr>
              <tr><th>Estimated Pay</th><td>${escapeHtml(formatCurrency(getEstimatedPay(shift)))}</td></tr>
              <tr><th>Paid Status</th><td>${escapeHtml(shift.paidStatus)}${shift.paymentDate ? `, ${escapeHtml(formatShortDate(shift.paymentDate))}` : ''}</td></tr>
              ${shift.parking ? `<tr><th>Parking</th><td>${escapeHtml(shift.parking)}</td></tr>` : ''}
              ${shift.uniform ? `<tr><th>Uniform</th><td>${escapeHtml(shift.uniform)}</td></tr>` : ''}
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
  <title>Hallstrom Premium CSC Shifts</title>
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
    <h1>Hallstrom Premium CSC Shifts</h1>
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
      <div class="summary-card"><strong>${escapeHtml(formatCurrency(summary.unpaidAmount))}</strong><span>Unpaid</span></div>
    </section>
    ${rows ? `<section class="shifts-grid">${rows}</section>` : '<p>No shifts match the current filters.</p>'}
  </main>
</body>
</html>`;
};

const getMonthKey = (dateValue) => (dateValue ? dateValue.slice(0, 7) : 'No date');

const getMonthLabel = (monthKey) => {
  if (monthKey === 'No date') return monthKey;

  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  return date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
};

const toGoogleCalendarDateTime = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return '';
  return `${dateValue.replaceAll('-', '')}T${String(timeValue).replace(':', '')}00`;
};

const getGoogleCalendarUrl = (shift) => {
  const startDateTime = toGoogleCalendarDateTime(shift.startDate, shift.startTime);
  const finishDateTime = toGoogleCalendarDateTime(shift.finishDate, shift.finishTime);

  if (!startDateTime || !finishDateTime) return '#';

  const details = [
    `CSC shift status: ${shift.shiftStatus || 'Scheduled'}`,
    `Paid status: ${shift.paidStatus || 'Unpaid'}`,
    `Hours: ${getShiftHours(shift).toFixed(1)}`,
    `Hourly rate: ${formatCurrency(Number(shift.hourlyRate) || 0)}`,
    `Estimated pay: ${formatCurrency(getEstimatedPay(shift))}`,
    shift.jobName ? `Job: ${shift.jobName}` : '',
    shift.parking ? `Parking: ${shift.parking}` : '',
    shift.uniform ? `Uniform: ${shift.uniform}` : '',
    shift.supervisor ? `Supervisor: ${shift.supervisor}` : '',
    shift.notes ? `Notes: ${shift.notes}` : '',
  ].filter(Boolean).join('\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `CSC Shift - ${shift.venue || 'Shift'}${shift.event ? ` - ${shift.event}` : ''}`,
    dates: `${startDateTime}/${finishDateTime}`,
    location: [shift.venue, shift.address, shift.city].filter(Boolean).join(', '),
    details,
    ctz: 'America/Los_Angeles',
    color: '#F4B400',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const loadCalendarAddedIds = () => {
  try {
    const saved = localStorage.getItem(CSC_CALENDAR_ADDED_STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to load CSC Google Calendar added ids:', error);
    return [];
  }
};

const CscShiftsTab = ({ searchQuery = '' }) => {
  const [shifts, setShifts] = useState(() => loadSavedShifts());
  const [localSearch, setLocalSearch] = useState('');
  const [venueFilter, setVenueFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [paidFilter, setPaidFilter] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [saveMessage, setSaveMessage] = useState('');
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showScanDrawer, setShowScanDrawer] = useState(false);
  const [showArchiveDrawer, setShowArchiveDrawer] = useState(false);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [archiveStatusFilter, setArchiveStatusFilter] = useState('All');
  const [shiftEmailText, setShiftEmailText] = useState('');
  const [scannedShift, setScannedShift] = useState(null);
  const [archivedShifts, setArchivedShifts] = useState(() => loadArchivedShifts());
  const [premiumView] = useState(false);
  const [showPremiumOverlay, setShowPremiumOverlay] = useState(false);
  const [newShift, setNewShift] = useState(() => createBlankShift());
  const [editingShiftId, setEditingShiftId] = useState(null);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [isShiftTableCollapsed, setIsShiftTableCollapsed] = useState(false);
  const [selectedDetailShiftId, setSelectedDetailShiftId] = useState(null);
  const [movingShiftId, setMovingShiftId] = useState(null);
  const [expandedNoteIds, setExpandedNoteIds] = useState(() => new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [calendarAddedIds, setCalendarAddedIds] = useState(() => new Set(loadCalendarAddedIds()));
  const toolbarImportInputRef = useRef(null);

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
    try {
      localStorage.setItem(CSC_CALENDAR_ADDED_STORAGE_KEY, JSON.stringify(Array.from(calendarAddedIds)));
    } catch (error) {
      console.error('Failed to save CSC Google Calendar added ids:', error);
    }
  }, [calendarAddedIds]);

  const handleGoogleCalendarClick = (id) => {
    setCalendarAddedIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
    setSaveMessage('Google Calendar opened. Shift marked as calendar added.');
    setTimeout(() => setSaveMessage(''), 2500);
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
    setSelectedDetailShiftId(shift.id);
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

    if (!window.confirm(`Clear notes, parking, uniform, and supervisor for ${label}?`)) return;

    writeCscSafetySnapshot('Before CSC shift clear', shifts, archivedShifts);
    updateShift(id, { notes: '', parking: '', uniform: '', supervisor: '' });
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
    setCalendarAddedIds((current) => {
      const next = new Set(current);
      next.delete(deleteConfirm.id);
      return next;
    });
    if (selectedDetailShiftId === deleteConfirm.id) {
      setSelectedDetailShiftId(null);
    }
    setSaveMessage('CSC shift deleted.');
    setTimeout(() => setSaveMessage(''), 2500);
    setDeleteConfirm(null);
  };

  const handleTogglePremiumView = () => {
    setShowPremiumOverlay(true);
    setSaveMessage('Premium CSC shift view opened.');
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
    const totalHours = filteredShifts.reduce((sum, shift) => sum + getShiftHours(shift), 0);
    const estimatedPay = filteredShifts.reduce((sum, shift) => sum + getEstimatedPay(shift), 0);
    const paidAmount = filteredShifts.reduce(
      (sum, shift) => sum + (shift.paidStatus === 'Paid' ? getEstimatedPay(shift) : 0),
      0
    );
    const unpaidAmount = filteredShifts.reduce(
      (sum, shift) => sum + (shift.paidStatus !== 'Paid' && shift.shiftStatus !== 'Cancelled' ? getEstimatedPay(shift) : 0),
      0
    );
    const workedHours = filteredShifts.reduce(
      (sum, shift) => sum + (shift.shiftStatus === 'Done' ? getShiftHours(shift) : 0),
      0
    );
    const soFiCount = filteredShifts.filter((shift) => /sofi/i.test(shift.venue)).length;
    const firstShift = filteredShifts[0];
    const lastShift = filteredShifts[filteredShifts.length - 1];

    return {
      totalShifts: filteredShifts.length,
      totalHours,
      workedHours,
      estimatedPay,
      paidAmount,
      unpaidAmount,
      soFiCount,
      firstShift,
      lastShift,
    };
  }, [filteredShifts]);

  const monthlySummary = useMemo(() => {
    const grouped = new Map();

    shifts.forEach((shift) => {
      const key = getMonthKey(shift.startDate);
      const current = grouped.get(key) || {
        monthKey: key,
        label: getMonthLabel(key),
        shifts: 0,
        hours: 0,
        workedHours: 0,
        estimatedPay: 0,
        unpaidAmount: 0,
      };

      current.shifts += 1;
      current.hours += getShiftHours(shift);
      current.workedHours += shift.shiftStatus === 'Done' ? getShiftHours(shift) : 0;
      current.estimatedPay += getEstimatedPay(shift);
      current.unpaidAmount += shift.paidStatus !== 'Paid' && shift.shiftStatus !== 'Cancelled' ? getEstimatedPay(shift) : 0;

      grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [shifts]);

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
    const parsedShift = parseAcceptanceEmail(shiftEmailText);

    if (!parsedShift || !parsedShift.startDate || !parsedShift.startTime || !parsedShift.finishTime) {
      setScannedShift(null);
      setSaveMessage('Email scan needs Event Date, Job, and Role time range.');
      setTimeout(() => setSaveMessage(''), 3500);
      return;
    }

    setScannedShift(parsedShift);
    setSaveMessage('Acceptance email scanned. Review the preview, then add shift.');
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleAddScannedShift = () => {
    if (!scannedShift) {
      setSaveMessage('Scan an acceptance email before adding the shift.');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    setShifts((currentShifts) => {
      const currentById = new Map(currentShifts.map((shift) => [shift.id, shift]));
      currentById.set(scannedShift.id, normalizeShift({ ...(currentById.get(scannedShift.id) || {}), ...scannedShift }));

      return Array.from(currentById.values()).sort((a, b) =>
        `${a.startDate}T${a.startTime}`.localeCompare(`${b.startDate}T${b.startTime}`)
      );
    });

    setShiftEmailText('');
    setScannedShift(null);
    setShowScanDrawer(false);
    setSaveMessage('Accepted CSC shift added from email.');
    setTimeout(() => setSaveMessage(''), 3000);
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
    link.download = 'CSC_Shifts_David_Hallstrom_Premium_2026.html';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
    setSaveMessage('Premium CSC shifts file downloaded.');
    setTimeout(() => setSaveMessage(''), 2500);
  };

  const selectedDetailShift = selectedDetailShiftId
    ? shifts.find((shift) => shift.id === selectedDetailShiftId) || archivedShifts.find((shift) => shift.id === selectedDetailShiftId)
    : null;
  const selectedDetailShiftIsArchived = Boolean(
    selectedDetailShiftId && archivedShifts.some((shift) => shift.id === selectedDetailShiftId)
  );

  const renderShiftActions = (shift) => (
    <div className="w-[154px] max-w-[154px]">
      <div className="grid gap-2">
        <div className="grid grid-cols-[110px_34px] gap-2">
          <select
            value={shift.shiftStatus}
            onChange={(event) => updateShift(shift.id, { shiftStatus: event.target.value })}
            className={`h-[30px] w-[110px] rounded px-2 py-1 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-yellow-300 ${getShiftStatusColorClass(shift.shiftStatus)}`}
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
            className="inline-flex h-[30px] w-[34px] items-center justify-center rounded bg-purple-600 text-white hover:bg-purple-700"
            aria-label="Archive shift"
            title="Archive shift"
          >
            <Archive className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-[34px_42px_34px] gap-2">
          <button
            type="button"
            onClick={() => handleDeleteShift(shift.id)}
            className="inline-flex h-[30px] w-[34px] items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
            aria-label="Delete shift"
            title="Delete shift"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleClearShiftNotes(shift.id)}
            className="inline-flex h-[30px] w-[42px] items-center justify-center rounded bg-slate-400 text-xs font-semibold text-white hover:bg-slate-500"
            title="Clear shift notes"
            aria-label="Clear shift notes"
          >
            Clr
          </button>
          <a
            href={getGoogleCalendarUrl(shift)}
            target="_blank"
            rel="noreferrer"
            onClick={() => handleGoogleCalendarClick(shift.id)}
            className={`inline-flex h-[30px] w-[34px] items-center justify-center rounded text-white ${
              calendarAddedIds.has(shift.id)
                ? 'bg-green-700 ring-2 ring-green-200 hover:bg-green-800'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
            aria-label={calendarAddedIds.has(shift.id) ? 'Google Calendar opened for this shift' : 'Add shift to Google Calendar'}
            title={calendarAddedIds.has(shift.id) ? 'Google Calendar opened for this shift' : 'Add to Google Calendar'}
          >
            {calendarAddedIds.has(shift.id) ? <CheckCircle2 className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}
          </a>
        </div>

        <div className="grid grid-cols-[58px_34px_34px] gap-2">
          <button
            type="button"
            onClick={() => handleMoveShift(shift.id)}
            className="inline-flex h-[30px] w-[58px] items-center justify-center rounded bg-amber-600 text-xs font-semibold text-white hover:bg-amber-700"
            title="Change shift venue"
            aria-label="Change shift venue"
          >
            Move
          </button>
          <button
            type="button"
            onClick={() => handleOpenShiftDetails(shift)}
            className="inline-flex h-[30px] w-[34px] items-center justify-center rounded bg-cyan-700 text-white hover:bg-cyan-800"
            aria-label="Open shift detail drawer"
            title="Open shift detail drawer"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleOpenEditShift(shift)}
            className="inline-flex h-[30px] w-[34px] items-center justify-center rounded bg-slate-700 text-white hover:bg-slate-800"
            aria-label="Edit shift"
            title="Edit shift"
          >
            <Edit3 className="h-4 w-4" />
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

  return (
    <PageContainer>
      <div className="space-y-6 py-6">
        <section className="rounded-xl border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-yellow-100 px-6 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold text-slate-800">CSC Shifts</h2>
              <p className="mt-1 text-sm font-medium text-slate-600">
                Manage CSC shifts here. Pay details stay on the CSC Shifts tab.
              </p>
              {saveMessage && (
                <p className="mt-3 inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-bold text-yellow-900">
                  {saveMessage}
                </p>
              )}
            </div>

            <div className="flex flex-shrink-0 flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowScanDrawer(true)}
                title="Scan CSC shift acceptance email"
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700"
              >
                <StickyNote className="h-4 w-4" />
                Scan Email
              </button>

              <label
                title="Import CSC shifts from CSV"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
              >
                <FileUp className="h-4 w-4" />
                Import
                <input ref={toolbarImportInputRef} type="file" accept=".csv,text/csv" onChange={handleImportCsv} className="hidden" />
              </label>

              <button
                type="button"
                onClick={handleExportCsv}
                title="Export CSC shifts"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
              >
                <Download className="h-4 w-4" />
                Export
              </button>

              <button
                type="button"
                onClick={handleTogglePremiumView}
                title="View premium CSC shift schedule"
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
              >
                <ListChecks className="h-4 w-4" />
                Premium View
              </button>
            </div>
          </div>
        </section>

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
            <div className="flex items-center justify-between gap-3 bg-black px-4 py-3 text-white">
              <div className="flex min-w-0 items-center gap-3">
                <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />
                <button
                  type="button"
                  onClick={() => setIsShiftTableCollapsed((current) => !current)}
                  className="rounded p-1 text-white transition-colors hover:bg-slate-800"
                  aria-label={isShiftTableCollapsed ? 'Expand CSC Shifts' : 'Collapse CSC Shifts'}
                  title={isShiftTableCollapsed ? 'Expand CSC Shifts' : 'Collapse CSC Shifts'}
                >
                  {isShiftTableCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <BriefcaseBusiness className="h-5 w-5 shrink-0 text-yellow-300" />
                  <h3 className="truncate text-base font-semibold text-white sm:text-lg">CSC Shifts</h3>
                  <span
                    className="inline-flex items-center rounded-full bg-blue-600 px-3 py-1 text-xs font-black uppercase tracking-wide text-white shadow-sm"
                    title={`${activeShiftCount} active CSC shifts`}
                  >
                    Active {activeShiftCount}
                  </span>
                  <span className="hidden text-xs font-semibold text-slate-400 sm:inline">Showing {visibleShiftCount}</span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenAddShift}
                  className="flex items-center gap-1.5 rounded bg-blue-600 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 sm:px-3 sm:text-sm"
                  title="Add CSC shift"
                  aria-label="Add CSC shift"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Task</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="rounded p-1.5 text-white transition-colors hover:bg-slate-800"
                  aria-label="Download CSC shifts"
                  title="Download CSC shifts"
                >
                  <Download className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleOpenAddShift}
                  className="rounded p-1.5 text-white transition-colors hover:bg-slate-800"
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
          <div className="overflow-x-auto rounded-xl border border-slate-200">
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
                        <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Paid:</span> {shift.paidStatus}</div>
                        {calendarAddedIds.has(shift.id) ? (
                          <div className="min-w-0 break-words text-green-700">
                            <span className="font-bold">Calendar:</span> Added
                          </div>
                        ) : null}
                        {shift.paymentDate ? <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Pay Date:</span> {formatDate(shift.paymentDate)}</div> : null}
                        {shift.parking ? <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Parking:</span> {shift.parking}</div> : null}
                        {shift.uniform ? <div className="min-w-0 break-words"><span className="font-bold text-slate-700">Uniform:</span> {shift.uniform}</div> : null}
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
                <p className="text-sm font-bold">Unpaid Amount</p>
                <p className="mt-1 text-2xl font-extrabold">{formatCurrency(summary.unpaidAmount)}</p>
                <p className="mt-1 text-xs font-bold text-red-800">SoFi shifts: {summary.soFiCount}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 opacity-80" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">Monthly Summary</h2>
              <p className="text-sm text-slate-600">
                Compact monthly view for scheduled hours, worked hours, estimated pay, and unpaid pay.
              </p>
            </div>

            <div className="text-sm font-bold text-slate-700">
              {summary.firstShift && summary.lastShift
                ? `${formatShortDate(summary.firstShift.startDate)} to ${formatShortDate(summary.lastShift.startDate)}`
                : 'No shifts'}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {monthlySummary.map((month) => (
              <button
                key={month.monthKey}
                type="button"
                onClick={() => setSelectedMonth(month.monthKey)}
                className={`rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md ${
                  selectedMonth === month.monthKey
                    ? 'border-yellow-400 bg-yellow-50 text-yellow-950'
                    : 'border-slate-200 bg-slate-50 text-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-extrabold">{month.label}</p>
                    <p className="mt-1 text-sm text-slate-600">{month.shifts} shifts</p>
                  </div>
                  <CalendarDays className="h-6 w-6" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Hours</p>
                    <p className="font-extrabold">{month.hours.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Done</p>
                    <p className="font-extrabold">{month.workedHours.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Pay</p>
                    <p className="font-extrabold">{formatCurrency(month.estimatedPay)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-500">Unpaid</p>
                    <p className="font-extrabold">{formatCurrency(month.unpaidAmount)}</p>
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
                <button
                  type="button"
                  onClick={cancelDeleteShift}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  aria-label="Close delete confirmation"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
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
              <button
                type="button"
                onClick={() => setShowPremiumOverlay(false)}
                className="rounded-2xl bg-white px-6 py-3 text-sm font-extrabold text-slate-950 shadow-lg hover:bg-slate-100"
              >
                Close
              </button>
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
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-950">Hallstrom Premium CSC Shifts</h1>
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
                  <p className="text-2xl font-extrabold">{formatCurrency(summary.unpaidAmount)}</p>
                  <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-slate-500">Unpaid</p>
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
                          <div>{shift.paidStatus}{shift.paymentDate ? `, ${formatShortDate(shift.paymentDate)}` : ''}</div>
                        </div>
                        {shift.parking && (
                          <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
                            <div className="font-extrabold text-slate-700">Parking</div>
                            <div>{shift.parking}</div>
                          </div>
                        )}
                        {shift.uniform && (
                          <div className="csc-premium-shift-row grid grid-cols-[135px_1fr] gap-4 py-2">
                            <div className="font-extrabold text-slate-700">Uniform</div>
                            <div>{shift.uniform}</div>
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

        {selectedDetailShift && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 p-4">
            <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h2 className="text-xl font-extrabold text-slate-950">CSC Shift Details</h2>
                  <p className="text-sm text-slate-600">Full shift record with restore, edit, archive, and delete actions.</p>
                </div>
                <button type="button" onClick={() => setSelectedDetailShiftId(null)} className="rounded-xl border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-2xl font-extrabold text-slate-950">{selectedDetailShift.venue || 'CSC Shift'}</h3>
                      <p className="mt-1 font-bold text-slate-800">{selectedDetailShift.event || 'Event not entered'}</p>
                      <p className="mt-1 text-sm text-slate-600">{selectedDetailShift.jobName || 'Job name not entered'}</p>
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
                    <p className="text-xs font-extrabold uppercase text-slate-500">Pay</p>
                    <p className="mt-1 font-bold text-slate-950">{getShiftHours(selectedDetailShift).toFixed(1)} hours at {formatCurrency(Number(selectedDetailShift.hourlyRate) || 0)}</p>
                    <p className="text-sm font-bold text-emerald-700">Estimated Pay: {formatCurrency(getEstimatedPay(selectedDetailShift))}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-500">Paid Status</p>
                    <p className="mt-1 font-bold text-slate-950">{selectedDetailShift.paidStatus}</p>
                    <p className="text-sm text-slate-600">{selectedDetailShift.paymentDate ? formatShortDate(selectedDetailShift.paymentDate) : 'No payment date entered'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-extrabold uppercase text-slate-500">Supervisor / Parking / Uniform</p>
                    <p className="mt-1 text-sm text-slate-700">Supervisor: {selectedDetailShift.supervisor || 'Not entered'}</p>
                    <p className="text-sm text-slate-700">Parking: {selectedDetailShift.parking || 'Not entered'}</p>
                    <p className="text-sm text-slate-700">Uniform: {selectedDetailShift.uniform || 'Not entered'}</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 md:col-span-2">
                    <p className="text-xs font-extrabold uppercase text-slate-500">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{selectedDetailShift.notes || 'No notes entered.'}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 bg-slate-50 p-4">
                {selectedDetailShiftIsArchived ? (
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
                <button
                  type="button"
                  onClick={() => setShowArchiveDrawer(false)}
                  className="rounded-xl border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50"
                  aria-label="Close CSC shift archive drawer"
                >
                  <X className="h-5 w-5" />
                </button>
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
                            <span>{formatCurrency(getEstimatedPay(shift))} - {shift.paidStatus}</span>
                          </div>
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
                  <h2 className="text-xl font-extrabold text-slate-950">Scan Acceptance Email</h2>
                  <p className="text-sm text-slate-600">Paste the APPROVED schedule update email text, scan it, then add the shift.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScanDrawer(false)}
                  className="rounded-xl border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50"
                  aria-label="Close scan email drawer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5">
                <label className="grid gap-2 text-sm font-bold text-slate-700">
                  Acceptance email text
                  <textarea
                    value={shiftEmailText}
                    onChange={(event) => {
                      setShiftEmailText(event.target.value);
                      setScannedShift(null);
                    }}
                    rows={9}
                    placeholder={'APPROVED - Schedule Update\n\nEvent Date: 06/13/2026\nJob: FIFA World Cup 2026 - Watch Party-6/13/2026 - Morning Shift\nRole: Event Staff - 06/13/2026 08:00 to 06/13/2026 16:00'}
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

                {scannedShift && (
                  <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-900">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-lg font-extrabold text-slate-950">Scanned Shift Preview</h3>
                      <span className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-extrabold text-amber-800">
                        {scannedShift.shiftStatus}
                      </span>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <p><strong>Start:</strong> {formatDate(scannedShift.startDate)} {formatTime(scannedShift.startTime)}</p>
                      <p><strong>Finish:</strong> {formatDate(scannedShift.finishDate)} {formatTime(scannedShift.finishTime)}</p>
                      <p><strong>Venue:</strong> {scannedShift.venue || 'Needs venue'}</p>
                      <p><strong>Address:</strong> {[scannedShift.address, scannedShift.city].filter(Boolean).join(', ') || 'Needs address'}</p>
                      <p className="md:col-span-2"><strong>Event:</strong> {scannedShift.event || 'Not detected'}</p>
                      <p className="md:col-span-2"><strong>Job:</strong> {scannedShift.jobName || 'Not detected'}</p>
                      <p><strong>Hours:</strong> {getShiftHours(scannedShift).toFixed(1)}</p>
                      <p><strong>Estimated Pay:</strong> {formatCurrency(getEstimatedPay(scannedShift))}</p>
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
                  Add Scanned Shift
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
                      title="Scan CSC shift acceptance email"
                    >
                      <StickyNote className="h-4 w-4" />
                      Scan Email
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setShowAddDrawer(false); setEditingShiftId(null); setNewShift(createBlankShift()); }}
                    className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
                    aria-label="Close add shift drawer"
                  >
                    <X className="h-5 w-5" />
                  </button>
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

                <label className="grid gap-1 text-sm font-bold text-slate-700">
                  Uniform
                  <input
                    type="text"
                    value={newShift.uniform}
                    onChange={(event) => setNewShift((current) => ({ ...current, uniform: event.target.value }))}
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
