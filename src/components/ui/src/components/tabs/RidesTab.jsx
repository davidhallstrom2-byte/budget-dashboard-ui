import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  CalendarDays,
  CalendarPlus,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Download,
  DollarSign,
  FileUp,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import PageContainer from '../common/PageContainer.jsx';
import TabPageHeader, { TAB_HEADER_ACTION_CLASS } from '../common/TabPageHeader.jsx';
import CloseScreenButton from '../common/CloseScreenButton.jsx';
import { createGoogleCalendarEvent } from '../../utils/googleCalendarApi';
import { formatPhoneInput, formatPhoneNumber } from '../../utils/phone';

const RIDES_STORAGE_KEY = 'modivcareRides.v1';
const RIDES_ARCHIVE_STORAGE_KEY = 'modivcareRides.archived.v1';
const RIDES_SNAPSHOT_KEY = 'modivcareRides.safetySnapshot.v1';
const RIDES_STORAGE_EVENT = 'modivcareRides:updated';
const RIDES_GOOGLE_CALENDAR_ADDED_STORAGE_KEY = 'modivcareRides.googleCalendar.addedIds.v1';
const RIDES_CREATE_DRAFT_STORAGE_KEY = 'modivcareRides.createDraftFromOpportunity.v1';
const RIDES_OPEN_LINKED_RIDE_STORAGE_KEY = 'modivcareRides.openLinkedRideId.v1';
const CSC_OPPORTUNITIES_STORAGE_KEY = 'cscOpportunities.v1';
const CSC_OPPORTUNITIES_UPDATE_EVENT = 'cscOpportunities:updated';
const RIDE_STATUS_OPTIONS = ['Confirmed', 'Completed', 'Canceled', 'Pending', 'Paid'];
const LEG_STATUS_OPTIONS = ['Confirmed', 'Completed', 'Canceled', 'Pending', 'Request Pickup'];

const createRideId = (prefix = 'ride') => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const formatDateForInput = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return '';

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return '';

  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-');
};

const formatDateForDisplay = (value = '') => {
  const isoDate = formatDateForInput(value);
  if (!isoDate) return 'No date';

  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
};

const parseMoneyAmount = (value = 0) => {
  const match = String(value ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : 0;
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

const formatRideCurrency = (value = 0) =>
  `$${parseMoneyAmount(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatLocalIsoDate = (date = new Date()) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

const getDefaultRideReportRange = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);

  return {
    start: formatLocalIsoDate(start),
    end: formatLocalIsoDate(today),
  };
};

const normalizeTime = (value = '') => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (/request pickup/i.test(text)) return 'Request Pickup';
  if (/none/i.test(text)) return 'None';

  return text.replace(/\b(am|pm)\b/i, (match) => match.toUpperCase());
};

const normalizeAddress = (parts = []) =>
  parts
    .map((part) => String(part || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(', ');

const normalizeLineBreaks = (value = '') =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(Leg\s+[A-Z])/gi, '\n$1\n')
    .replace(/(Confirmed\s+#\d+)/gi, '\n$1\n')
    .replace(/(PICKUP TIME)/gi, '\n$1\n')
    .replace(/(APPOINTMENT TIME)/gi, '\n$1\n')
    .replace(/(Clock icon\s*)?Pickup Window:/gi, '\nPickup Window:')
    .replace(/(Ride confirmed and expected on time\.)/gi, '\n$1\n')
    .replace(/(Pick up location)(?=\S)/gi, '$1\n')
    .replace(/(Drop off location)(?=\S)/gi, '$1\n')
    .replace(/(LYFT Healthcare Inc)/gi, '\n$1\n')
    .replace(/(Trip too close to trip date\.)/gi, '\n$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const getCleanLines = (value = '') =>
  normalizeLineBreaks(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(x|edit|cancel)$/i.test(line));

const isSectionBoundary = (line = '') =>
  /^(Leg\s+[A-Z]|PICKUP TIME|APPOINTMENT TIME|Pickup Window:|Ride confirmed|Pick up location|Drop off location|LYFT Healthcare Inc|Trip too close)/i.test(
    line
  );

const parseLocationBlock = (lines = [], labelPattern) => {
  const labelIndex = lines.findIndex((line) => labelPattern.test(line));
  if (labelIndex === -1) {
    return {
      name: '',
      address: '',
    };
  }

  const labelLine = lines[labelIndex];
  const inlineName = labelLine.replace(labelPattern, '').trim();
  const startIndex = inlineName ? labelIndex : labelIndex + 1;
  const name = inlineName || lines[startIndex] || '';
  const addressParts = [];

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (isSectionBoundary(line)) break;
    addressParts.push(line);
    if (addressParts.length >= 2) break;
  }

  return {
    name,
    address: normalizeAddress(addressParts),
  };
};

const findNextLineValue = (lines = [], labelPattern) => {
  const index = lines.findIndex((line) => labelPattern.test(line));
  if (index === -1) return '';

  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (!line || labelPattern.test(line)) continue;
    return line;
  }

  return '';
};

const parseRideDate = (text = '') => {
  const datedMatch = text.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}\b/i);
  if (datedMatch) return formatDateForInput(datedMatch[0]);

  const noCommaDateMatch = text.match(
    /\b(?:(?:Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)[a-z]*\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\s+(\d{4})\b/i
  );
  if (noCommaDateMatch) return formatDateForInput(`${noCommaDateMatch[1]} ${noCommaDateMatch[2]}, ${noCommaDateMatch[3]}`);

  const titleMatch = text.match(/RIDE DETAIL:\s*([A-Za-z]+\s+\d{1,2})/i);
  if (titleMatch) {
    const currentYear = new Date().getFullYear();
    return formatDateForInput(`${titleMatch[1]}, ${currentYear}`);
  }

  return '';
};

const parseRiderName = (text = '') => {
  const lines = getCleanLines(text);
  const fullNameLine = lines.find((line) => /^[A-Z]+(?:\s+[A-Z]+){1,3}$/.test(line) && !/^RIDE DETAIL/i.test(line));
  return fullNameLine || 'David Hallstrom';
};

const parseProvider = (lines = []) => {
  const providerLine = lines.find((line) => /healthcare|lyft|uber|transport|taxi|cab/i.test(line));
  return providerLine || '';
};

const getUberReceiptLines = (value = '') =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t+/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((line) => !/^(switch|download pdf)$/i.test(line));

const isUberReceiptText = (rawText = '') =>
  /trip details/i.test(rawText) && /(uberx|uber comfort|uberxl|trip fare|you rode with|your trip|view receipt|resend receipt)/i.test(rawText);

const findUberMoneyValue = (lines = [], labelPattern) => {
  const inlineLine = lines.find((line) => labelPattern.test(line) && /\$\d/.test(line));
  if (inlineLine) {
    const match = inlineLine.match(/\$\s*\d+(?:\.\d{2})?/);
    if (match) return match[0].replace(/\s+/g, '');
  }

  const labelIndexes = lines.reduce((indexes, line, index) => {
    if (labelPattern.test(line)) indexes.push(index);
    return indexes;
  }, []);

  for (const labelIndex of [...labelIndexes].reverse()) {
    for (let index = labelIndex + 1; index < Math.min(lines.length, labelIndex + 4); index += 1) {
      if (/thanks|hope|total|trip details|payments/i.test(lines[index])) break;
      const match = lines[index].match(/\$\s*\d+(?:\.\d{2})?/);
      if (match) return match[0].replace(/\s+/g, '');
    }
  }

  return '';
};

const parseUberPayment = (lines = []) => {
  const paymentLine = lines.find((line) => /visa|mastercard|amex|discover|paypal|apple pay|google pay/i.test(line));
  if (!paymentLine) return '';

  const cardMatch = paymentLine.match(/\b(Visa|Mastercard|Amex|Discover)\b.*?(\d{4})/i);
  if (cardMatch) return `${cardMatch[1]} ending ${cardMatch[2]}`;

  return paymentLine.replace(/\$\s*\d+(?:\.\d{2})?.*$/, '').trim();
};

const parseUberTripDetails = (lines = []) => {
  const tripDetailsIndex = lines.findIndex((line) => /^trip details$/i.test(line));
  const tripLines = tripDetailsIndex >= 0 ? lines.slice(tripDetailsIndex + 1) : lines;
  const rideType = tripLines.find((line) => /^uber/i.test(line)) || 'Uber';
  const rideTypeIndex = tripLines.findIndex((line) => line === rideType);
  const detailStartIndex = rideTypeIndex >= 0 ? rideTypeIndex + 1 : 0;
  const distanceDuration = tripLines.slice(detailStartIndex).find((line) => /\b\d+(?:\.\d+)?\s*miles?\b/i.test(line) || /\b\d+\s*minutes?\b/i.test(line)) || '';
  const timePattern = /^\d{1,2}:\d{2}\s*(?:AM|PM)$/i;
  const firstTimeIndex = tripLines.findIndex((line, index) => index >= detailStartIndex && timePattern.test(line));
  const secondTimeIndex =
    firstTimeIndex >= 0
      ? tripLines.findIndex((line, index) => index > firstTimeIndex && timePattern.test(line))
      : -1;

  const pickupAddress = firstTimeIndex >= 0 ? tripLines[firstTimeIndex + 1] || '' : '';
  const dropoffParts = [];

  if (secondTimeIndex >= 0) {
    for (let index = secondTimeIndex + 1; index < tripLines.length; index += 1) {
      const line = tripLines[index];
      if (/^you rode with/i.test(line) || /^driver/i.test(line) || /^receipt/i.test(line)) break;
      if (timePattern.test(line)) break;
      dropoffParts.push(line);
      if (dropoffParts.length >= 3) break;
    }
  }

  const dropoffName = dropoffParts[0] || '';
  const dropoffAddress = dropoffParts.length > 1 ? normalizeAddress(dropoffParts.slice(1)) : '';

  return {
    rideType,
    distanceDuration,
    pickupTime: firstTimeIndex >= 0 ? tripLines[firstTimeIndex] : '',
    pickupAddress,
    dropoffTime: secondTimeIndex >= 0 ? tripLines[secondTimeIndex] : '',
    dropoffName,
    dropoffAddress,
  };
};

const parseUberTripSummaryDetails = (lines = []) => {
  const text = lines.join('\n');
  const routeIndex = lines.findIndex((line) => /^route$/i.test(line));
  const routeLines = routeIndex >= 0 ? lines.slice(routeIndex + 1) : [];
  const timePattern = /^\d{1,2}:\d{2}\s*(?:AM|PM)$/i;
  const pickupTimeIndex = routeLines.findIndex((line, index) => index > 0 && timePattern.test(line));
  const dropoffTimeIndex =
    pickupTimeIndex >= 0
      ? routeLines.findIndex((line, index) => index > pickupTimeIndex && timePattern.test(line))
      : -1;
  const pickupAddress = pickupTimeIndex > 0 ? routeLines[pickupTimeIndex - 1] || '' : '';
  const dropoffParts = [];

  if (pickupTimeIndex >= 0) {
    const stopIndex = dropoffTimeIndex >= 0 ? dropoffTimeIndex : routeLines.length;
    for (let index = pickupTimeIndex + 1; index < stopIndex; index += 1) {
      const line = routeLines[index];
      if (timePattern.test(line)) break;
      dropoffParts.push(line);
    }
  }

  const pickupTime =
    pickupTimeIndex >= 0
      ? routeLines[pickupTimeIndex]
      : text.match(/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/i)?.[0] || '';
  const distance = lines.find((line) => /\b\d+(?:\.\d+)?\s*miles?\b/i.test(line)) || '';
  const duration = lines.find((line) => /^\d+\s*minutes?$/i.test(line)) || '';

  return {
    rideType: 'Uber',
    distanceDuration: [distance, duration].filter(Boolean).join(', '),
    pickupTime,
    pickupAddress,
    dropoffTime: dropoffTimeIndex >= 0 ? routeLines[dropoffTimeIndex] : '',
    dropoffName: dropoffParts[0] || '',
    dropoffAddress: dropoffParts.length > 1 ? normalizeAddress(dropoffParts.slice(1)) : '',
  };
};

const parseUberReceipt = (rawText = '') => {
  const lines = getUberReceiptLines(rawText);
  const text = lines.join('\n');
  const rideDate = parseRideDate(text);
  const isTripSummary = /^your trip$/im.test(text) || /view receipt/i.test(text);
  const tripDetails = isTripSummary ? parseUberTripSummaryDetails(lines) : parseUberTripDetails(lines);
  const total = findUberMoneyValue(lines, /^total\b/i);
  const tripFare = findUberMoneyValue(lines, /^trip fare\b/i);
  const tip = findUberMoneyValue(lines, /^tip\b/i);
  const waitTime = findUberMoneyValue(lines, /^wait time\b/i);
  const summaryTotal = lines.find((line) => /^\$\s*\d+(?:\.\d{2})?$/.test(line)) || '';
  const paymentMethod = parseUberPayment(lines);
  const driverMatch = text.match(/You rode with\s+([^\n]+)/i) || text.match(/\bwith\s+([^\n]+)/i);
  const driverName = driverMatch
    ? driverMatch[1]
        .replace(/\btrip\s+(?:route|rating|details)\b.*$/i, '')
        .replace(/\s+\d+(?:\.\d+)?$/, '')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
  const receiptId = [
    'UBER',
    rideDate || 'NO-DATE',
    normalizeRideCalendarTime(tripDetails.pickupTime).replace(/:/g, ''),
  ]
    .filter(Boolean)
    .join('-');

  const totalAmount = parseMoneyAmount(total || summaryTotal);
  const fareAmount = parseMoneyAmount(tripFare);
  const tipAmount = parseMoneyAmount(tip);
  const waitTimeAmount = parseMoneyAmount(waitTime);
  const feeAmount = Math.max(
    waitTimeAmount,
    Math.round(Math.max(totalAmount - fareAmount - tipAmount, 0) * 100) / 100
  );

  const notes = [
    total || summaryTotal ? `Total: ${total || summaryTotal}` : '',
    tripFare ? `Trip fare: ${tripFare}` : '',
    tip ? `Tip: ${tip}` : '',
    waitTime ? `Wait time: ${waitTime}` : '',
    tripDetails.distanceDuration,
    paymentMethod ? `Payment: ${paymentMethod}` : '',
    driverName ? `Driver: ${driverName}` : '',
  ]
    .filter(Boolean)
    .join('. ');

  return normalizeRide({
    confirmationNumber: receiptId,
    rideDate,
    riderName: 'David Hallstrom',
    status: 'Completed',
    provider: 'Uber',
    fareAmount,
    tipAmount,
    feeAmount,
    totalAmount,
    sourceType: 'Uber Receipt',
    notes,
    sourceText: rawText,
    legs: [
      {
        leg: 'Uber Trip',
        confirmationNumber: receiptId,
        pickupTime: tripDetails.pickupTime,
        appointmentTime: tripDetails.dropoffTime,
        pickupName: 'Pickup',
        pickupAddress: tripDetails.pickupAddress,
        dropoffName: tripDetails.dropoffName || 'Dropoff Location',
        dropoffAddress: tripDetails.dropoffAddress,
        status: 'Completed',
        provider: tripDetails.rideType || 'Uber',
        notes,
      },
    ],
  });
};

const UBER_ACTIVITY_MONTHS = {
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

const isUberActivityHistoryText = (rawText = '') => {
  const lines = getUberReceiptLines(rawText);
  const hasActivityDate = lines.some((line) =>
    /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\s*[•·]\s*\d{1,2}:\d{2}\s*(?:AM|PM)$/i.test(
      line
    )
  );
  const hasActivityAmount = lines.some((line) => /^\$\s*\d+(?:\.\d{2})?(?:\s*[•·]\s*Canceled)?$/i.test(line));

  return hasActivityDate && hasActivityAmount;
};

const parseUberActivityHistory = (rawText = '') => {
  const lines = getUberReceiptLines(rawText).filter((line) => !/^help$/i.test(line));
  const dateTimePattern =
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\s*[•·]\s*(\d{1,2}:\d{2}\s*(?:AM|PM))$/i;
  const amountPattern = /^\$\s*\d+(?:\.\d{2})?(?:\s*[•·]\s*Canceled)?$/i;
  const now = new Date();
  let inferredYear = now.getFullYear();
  let lastMonth = now.getMonth() + 1;
  const parsedRides = [];

  for (let index = 0; index < lines.length; index += 1) {
    const dateMatch = lines[index].match(dateTimePattern);
    if (!dateMatch) continue;

    const month = UBER_ACTIVITY_MONTHS[dateMatch[1].toLowerCase()];
    const day = Number(dateMatch[2]);
    const pickupTime = normalizeTime(dateMatch[3]);
    const location = String(lines[index - 1] || '').trim();
    const amountLine = String(lines[index + 1] || '').trim();

    if (!month || !day || !amountPattern.test(amountLine)) continue;

    if (month > lastMonth) inferredYear -= 1;
    lastMonth = month;

    const rideDate = `${inferredYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const amount = parseMoneyAmount(amountLine);
    const isCanceled = /canceled/i.test(amountLine);
    const timeId = normalizeRideCalendarTime(pickupTime).replace(/:/g, '').slice(0, 4);
    const receiptId = `UBER-ACTIVITY-${rideDate.replace(/-/g, '')}-${timeId || String(index).padStart(4, '0')}`;
    const notes = isCanceled
      ? 'Imported from Uber Activity. This canceled ride amount is stored as a fee because the activity log does not provide a separate breakdown.'
      : 'Imported from Uber Activity. Tip and fee breakdown were not listed, so the displayed amount is stored as the ride fare until a receipt or manual edit provides more detail.';

    parsedRides.push(
      normalizeRide({
        confirmationNumber: receiptId,
        rideDate,
        riderName: 'David Hallstrom',
        status: isCanceled ? 'Canceled' : 'Completed',
        provider: 'Uber',
        fareAmount: isCanceled ? 0 : amount,
        tipAmount: 0,
        feeAmount: isCanceled ? amount : 0,
        totalAmount: amount,
        sourceType: 'Uber Activity',
        notes,
        sourceText: [location, lines[index], amountLine].filter(Boolean).join('\n'),
        legs: [
          {
            leg: 'Uber Trip',
            confirmationNumber: receiptId,
            pickupTime,
            appointmentTime: '',
            pickupName: '',
            pickupAddress: '',
            dropoffName: location || 'Destination not listed',
            dropoffAddress: '',
            status: isCanceled ? 'Canceled' : 'Completed',
            provider: 'Uber',
            notes,
          },
        ],
      })
    );
  }

  return parsedRides;
};

const parseModivcareConfirmation = (rawText = '') => {
  const text = normalizeLineBreaks(rawText);
  const lines = getCleanLines(text);
  const confirmationMatch = text.match(/Confirmed\s+#(\d+)/i);
  const confirmationNumber = confirmationMatch ? confirmationMatch[1] : '';
  const rideDate = parseRideDate(text);
  const riderName = parseRiderName(text);
  const provider = parseProvider(lines);
  const legMatches = [...text.matchAll(/(^|\n)(Leg\s+[A-Z])\b/gi)];

  const legs = legMatches.map((match, index) => {
    const legStart = match.index + match[1].length;
    const nextStart = legMatches[index + 1]?.index ?? text.length;
    const legText = text.slice(legStart, nextStart).trim();
    const legLines = getCleanLines(legText);
    const pickupLocation = parseLocationBlock(legLines, /^Pick up location/i);
    const dropoffLocation = parseLocationBlock(legLines, /^Drop off location/i);
    const pickupWindowMatch = legText.match(/Pickup Window:\s*([^\n]+)/i);
    const legConfirmationMatch = legText.match(/Confirmed\s+#(\d+)/i);

    return {
      id: createRideId('leg'),
      leg: match[2].replace(/\s+/g, ' ').trim(),
      confirmationNumber: legConfirmationMatch ? legConfirmationMatch[1] : confirmationNumber,
      pickupTime: normalizeTime(findNextLineValue(legLines, /^PICKUP TIME$/i)),
      appointmentTime: normalizeTime(findNextLineValue(legLines, /^APPOINTMENT TIME$/i)),
      pickupWindow: pickupWindowMatch ? pickupWindowMatch[1].trim() : '',
      pickupName: pickupLocation.name,
      pickupAddress: pickupLocation.address,
      dropoffName: dropoffLocation.name,
      dropoffAddress: dropoffLocation.address,
      status: /Ride confirmed/i.test(legText) ? 'Confirmed' : '',
      provider: parseProvider(legLines) || provider,
      notes: /Trip too close/i.test(legText)
        ? 'Trip too close to trip date. Changes cannot be made online. Call Modivcare to make changes to this trip.'
        : '',
    };
  });

  return normalizeRide({
    confirmationNumber,
    rideDate,
    riderName,
    provider,
    status: legs.some((leg) => leg.status === 'Confirmed') ? 'Confirmed' : '',
    sourceText: rawText,
    legs,
  });
};

const parseRideScanEntries = (rawText = '') => {
  if (isUberReceiptText(rawText)) return [parseUberReceipt(rawText)];
  if (isUberActivityHistoryText(rawText)) return parseUberActivityHistory(rawText);
  return [parseModivcareConfirmation(rawText)];
};

const normalizeLeg = (leg = {}) => ({
  id: leg.id || createRideId('leg'),
  leg: String(leg.leg || '').trim() || 'Leg',
  confirmationNumber: String(leg.confirmationNumber || '').trim(),
  pickupTime: normalizeTime(leg.pickupTime),
  appointmentTime: normalizeTime(leg.appointmentTime),
  pickupWindow: String(leg.pickupWindow || '').trim(),
  pickupName: String(leg.pickupName || '').trim(),
  pickupAddress: String(leg.pickupAddress || '').trim(),
  pickupPhone: formatPhoneNumber(String(leg.pickupPhone || '').trim()),
  dropoffName: String(leg.dropoffName || '').trim(),
  dropoffAddress: String(leg.dropoffAddress || '').trim(),
  dropoffPhone: formatPhoneNumber(String(leg.dropoffPhone || '').trim()),
  status: String(leg.status || '').trim(),
  provider: String(leg.provider || '').trim(),
  notes: String(leg.notes || '').trim(),
});

function normalizeRide(ride = {}) {
  const now = new Date().toISOString();
  const legs = Array.isArray(ride.legs) ? ride.legs.map(normalizeLeg) : [];
  const fareAmount = parseMoneyAmount(ride.fareAmount);
  const tipAmount = parseMoneyAmount(ride.tipAmount);
  let feeAmount = parseMoneyAmount(ride.feeAmount);
  const explicitTotal = parseMoneyAmount(ride.totalAmount);
  const itemizedTotal = fareAmount + tipAmount + feeAmount;

  if (explicitTotal > itemizedTotal) {
    feeAmount = Math.round((feeAmount + explicitTotal - itemizedTotal) * 100) / 100;
  }

  const totalAmount =
    explicitTotal > 0
      ? explicitTotal
      : Math.round((fareAmount + tipAmount + feeAmount) * 100) / 100;

  return {
    id: ride.id || createRideId(),
    rideDate: formatDateForInput(ride.rideDate),
    riderName: String(ride.riderName || '').trim() || 'David Hallstrom',
    confirmationNumber: String(ride.confirmationNumber || legs[0]?.confirmationNumber || '').trim(),
    status: String(ride.status || legs[0]?.status || '').trim() || 'Confirmed',
    provider: String(ride.provider || legs[0]?.provider || '').trim(),
    fareAmount,
    tipAmount,
    feeAmount,
    totalAmount,
    sourceType: String(ride.sourceType || '').trim(),
    notes: String(ride.notes || '').trim(),
    sourceText: String(ride.sourceText || '').trim(),
    legs,
    createdAt: ride.createdAt || now,
    updatedAt: ride.updatedAt || now,
    archivedAt: ride.archivedAt || '',
    completedAt: ride.completedAt || '',
    restoredAt: ride.restoredAt || '',
    googleCalendarEventId: ride.googleCalendarEventId || '',
    googleCalendarEventLink: ride.googleCalendarEventLink || '',
    googleCalendarAddedAt: ride.googleCalendarAddedAt || '',
    sourceOpportunityId: ride.sourceOpportunityId || '',
    linkedCscShiftId: ride.linkedCscShiftId || '',
  };
}

const getRideFinancials = (ride = {}) => {
  const fare = parseMoneyAmount(ride.fareAmount);
  const tip = parseMoneyAmount(ride.tipAmount);
  const fees = parseMoneyAmount(ride.feeAmount);
  const itemizedTotal = Math.round((fare + tip + fees) * 100) / 100;
  const storedTotal = parseMoneyAmount(ride.totalAmount);
  const total = storedTotal > 0 ? storedTotal : itemizedTotal;
  const fareAndFees = Math.max(
    Math.round((total - tip) * 100) / 100,
    Math.round((fare + fees) * 100) / 100
  );

  return {
    fare,
    tip,
    fees,
    fareAndFees,
    total,
  };
};

const updateOpportunityRideLink = (opportunityId, rideId) => {
  if (!opportunityId || !rideId) return;

  try {
    const opportunities = JSON.parse(localStorage.getItem(CSC_OPPORTUNITIES_STORAGE_KEY) || '[]');
    if (!Array.isArray(opportunities)) return;

    let changed = false;
    const nextOpportunities = opportunities.map((opportunity) => {
      if (opportunity.id !== opportunityId || opportunity.linkedRideId === rideId) return opportunity;
      changed = true;
      return {
        ...opportunity,
        linkedRideId: rideId,
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
    console.error('Failed to link ride to CSC opportunity:', error);
  }
};

const clearOpportunityRideLink = (rideId) => {
  if (!rideId) return;

  try {
    const opportunities = JSON.parse(localStorage.getItem(CSC_OPPORTUNITIES_STORAGE_KEY) || '[]');
    if (!Array.isArray(opportunities)) return;

    let changed = false;
    const nextOpportunities = opportunities.map((opportunity) => {
      if (opportunity.linkedRideId !== rideId) return opportunity;
      changed = true;
      return {
        ...opportunity,
        linkedRideId: '',
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
    console.error('Failed to clear ride link from CSC opportunity:', error);
  }
};

const isGenericDropoffName = (value = '') => /^(dropoff location|drop off location|n\/a)$/i.test(String(value || '').trim());

const mergeTextValue = (existingValue = '', incomingValue = '', options = {}) => {
  const existingText = String(existingValue || '').trim();
  const incomingText = String(incomingValue || '').trim();
  if (!incomingText) return existingText;
  if (!existingText) return incomingText;
  if (options.replaceGenericDropoff && isGenericDropoffName(existingText) && !isGenericDropoffName(incomingText)) return incomingText;
  return existingText;
};

const combineRideNotes = (existingNotes = '', incomingNotes = '') => {
  const existingText = String(existingNotes || '').trim();
  const incomingText = String(incomingNotes || '').trim();
  if (!existingText) return incomingText;
  if (!incomingText || existingText === incomingText || existingText.includes(incomingText)) return existingText;
  if (incomingText.includes(existingText)) return incomingText;

  const noteParts = [existingText, incomingText]
    .flatMap((text) => text.split(/\n|\. (?=[A-Z0-9])/))
    .map((part) => part.replace(/\.$/, '').trim())
    .filter(Boolean);
  const seen = new Set();
  const uniqueParts = noteParts.filter((part) => {
    const key = part.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueParts.join('. ');
};

const combineRideSourceText = (existingText = '', incomingText = '') => {
  const existing = String(existingText || '').trim();
  const incoming = String(incomingText || '').trim();
  if (!existing) return incoming;
  if (!incoming || existing.includes(incoming)) return existing;
  return `${existing}\n\n--- Additional scan ---\n\n${incoming}`;
};

const mergeScannedLeg = (existingLeg = {}, incomingLeg = {}) =>
  normalizeLeg({
    ...existingLeg,
    confirmationNumber: mergeTextValue(existingLeg.confirmationNumber, incomingLeg.confirmationNumber),
    pickupTime: mergeTextValue(existingLeg.pickupTime, incomingLeg.pickupTime),
    appointmentTime: mergeTextValue(existingLeg.appointmentTime, incomingLeg.appointmentTime),
    pickupWindow: mergeTextValue(existingLeg.pickupWindow, incomingLeg.pickupWindow),
    pickupName: mergeTextValue(existingLeg.pickupName, incomingLeg.pickupName),
    pickupAddress: mergeTextValue(existingLeg.pickupAddress, incomingLeg.pickupAddress),
    pickupPhone: mergeTextValue(existingLeg.pickupPhone, incomingLeg.pickupPhone),
    dropoffName: mergeTextValue(existingLeg.dropoffName, incomingLeg.dropoffName, { replaceGenericDropoff: true }),
    dropoffAddress: mergeTextValue(existingLeg.dropoffAddress, incomingLeg.dropoffAddress),
    dropoffPhone: mergeTextValue(existingLeg.dropoffPhone, incomingLeg.dropoffPhone),
    status: mergeTextValue(existingLeg.status, incomingLeg.status),
    provider: mergeTextValue(existingLeg.provider, incomingLeg.provider),
    notes: combineRideNotes(existingLeg.notes, incomingLeg.notes),
  });

const mergeScannedMoneyValue = (existingValue, incomingValue) => {
  const incoming = parseMoneyAmount(incomingValue);
  const existing = parseMoneyAmount(existingValue);
  return incoming > 0 ? incoming : existing;
};

const mergeScannedRide = (existingRide = {}, incomingRide = {}) => {
  const existingLegs = Array.isArray(existingRide.legs) ? existingRide.legs : [];
  const incomingLegs = Array.isArray(incomingRide.legs) ? incomingRide.legs : [];
  const mergedLegs = incomingLegs.length
    ? incomingLegs.map((incomingLeg, index) => mergeScannedLeg(existingLegs[index], incomingLeg))
    : existingLegs;

  if (existingLegs.length > incomingLegs.length) {
    mergedLegs.push(...existingLegs.slice(incomingLegs.length).map(normalizeLeg));
  }

  return normalizeRide({
    ...existingRide,
    rideDate: mergeTextValue(existingRide.rideDate, incomingRide.rideDate),
    riderName: mergeTextValue(existingRide.riderName, incomingRide.riderName),
    confirmationNumber: mergeTextValue(existingRide.confirmationNumber, incomingRide.confirmationNumber),
    status: mergeTextValue(existingRide.status, incomingRide.status),
    provider: mergeTextValue(existingRide.provider, incomingRide.provider),
    fareAmount: mergeScannedMoneyValue(existingRide.fareAmount, incomingRide.fareAmount),
    tipAmount: mergeScannedMoneyValue(existingRide.tipAmount, incomingRide.tipAmount),
    feeAmount: mergeScannedMoneyValue(existingRide.feeAmount, incomingRide.feeAmount),
    totalAmount: mergeScannedMoneyValue(existingRide.totalAmount, incomingRide.totalAmount),
    sourceType: mergeTextValue(existingRide.sourceType, incomingRide.sourceType),
    notes: combineRideNotes(existingRide.notes, incomingRide.notes),
    sourceText: combineRideSourceText(existingRide.sourceText, incomingRide.sourceText),
    legs: mergedLegs,
    updatedAt: new Date().toISOString(),
  });
};

const normalizeMatchText = (value = '') => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const findMatchingRideIndex = (rides = [], parsedRide = {}) => {
  const parsedFirstLeg = parsedRide.legs?.[0] || {};
  const parsedPickupTime = normalizeRideCalendarTime(parsedFirstLeg.pickupTime);
  const parsedPickupAddress = normalizeMatchText(parsedFirstLeg.pickupAddress);
  const parsedDropoffName = normalizeMatchText(parsedFirstLeg.dropoffName);

  return rides.findIndex((ride) => {
    if (
      ride.confirmationNumber &&
      parsedRide.confirmationNumber &&
      ride.confirmationNumber === parsedRide.confirmationNumber &&
      ride.rideDate === parsedRide.rideDate
    ) {
      return true;
    }

    if (!/uber/i.test(`${ride.provider} ${parsedRide.provider}`) || ride.rideDate !== parsedRide.rideDate) return false;

    const rideFirstLeg = ride.legs?.[0] || {};
    const ridePickupTime = normalizeRideCalendarTime(rideFirstLeg.pickupTime);
    const ridePickupAddress = normalizeMatchText(rideFirstLeg.pickupAddress);
    const rideDropoffName = normalizeMatchText(rideFirstLeg.dropoffName);

    return (
      parsedPickupTime &&
      ridePickupTime === parsedPickupTime &&
      ((parsedPickupAddress && ridePickupAddress && parsedPickupAddress === ridePickupAddress) ||
        (parsedDropoffName && rideDropoffName && parsedDropoffName === rideDropoffName))
    );
  });
};

const readRideGoogleCalendarAddedIds = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RIDES_GOOGLE_CALENDAR_ADDED_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const writeRideGoogleCalendarAddedIds = (ids = []) => {
  try {
    localStorage.setItem(
      RIDES_GOOGLE_CALENDAR_ADDED_STORAGE_KEY,
      JSON.stringify(Array.from(new Set(ids)).filter(Boolean))
    );
  } catch (error) {
    console.error('Failed to save ride Google Calendar IDs:', error);
  }
};

const readStoredRides = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RIDES_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeRide) : [];
  } catch {
    return [];
  }
};

const readArchivedRides = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(RIDES_ARCHIVE_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map(normalizeRide) : [];
  } catch {
    return [];
  }
};

const writeStoredRides = (rides = []) => {
  try {
    localStorage.setItem(RIDES_STORAGE_KEY, JSON.stringify(rides.map(normalizeRide)));
  } catch (error) {
    console.error('Failed to save Modivcare rides:', error);
  }
};

const writeArchivedRides = (rides = []) => {
  try {
    localStorage.setItem(RIDES_ARCHIVE_STORAGE_KEY, JSON.stringify(rides.map(normalizeRide)));
  } catch (error) {
    console.error('Failed to save archived Modivcare rides:', error);
  }
};

const dispatchRidesStorageEvent = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(RIDES_STORAGE_EVENT));
};

const sortRides = (rides = []) =>
  [...rides].sort((a, b) => String(a.rideDate || '9999-12-31').localeCompare(String(b.rideDate || '9999-12-31')));

const formatRideForSearch = (ride = {}) =>
  [
    ride.rideDate,
    ride.riderName,
    ride.confirmationNumber,
    ride.status,
    ride.provider,
    ride.fareAmount,
    ride.tipAmount,
    ride.feeAmount,
    ride.totalAmount,
    ride.sourceType,
    ride.notes,
    ...ride.legs.flatMap((leg) => [
      leg.leg,
      leg.pickupTime,
      leg.appointmentTime,
      leg.pickupWindow,
      leg.pickupName,
      leg.pickupAddress,
      leg.pickupPhone,
      leg.dropoffName,
      leg.dropoffAddress,
      leg.dropoffPhone,
      leg.status,
      leg.provider,
      leg.notes,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const escapeHtml = (value = '') =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const downloadTextFile = (filename, content, type = 'application/json') => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const getRideDateGroup = (ride = {}) => ride.rideDate || 'No date';

const isPastRide = (ride = {}) => {
  const isoDate = formatDateForInput(ride.rideDate);
  if (!isoDate) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, month, day] = isoDate.split('-').map(Number);
  const rideDate = new Date(year, month - 1, day);
  rideDate.setHours(0, 0, 0, 0);

  return rideDate < today;
};

const normalizeRideCalendarTime = (value = '') => {
  const text = String(value || '').trim();
  if (!text || /request pickup|none/i.test(text)) return '';

  const browserTimeMatch = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (browserTimeMatch) {
    const hour = Number(browserTimeMatch[1]);
    const minute = Number(browserTimeMatch[2]);
    const second = Number(browserTimeMatch[3] || 0);
    if (hour > 23 || minute > 59 || second > 59) return '';
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
  }

  const meridiemMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (!meridiemMatch) return '';

  const hour = Number(meridiemMatch[1]);
  const minute = Number(meridiemMatch[2] || 0);
  const meridiem = meridiemMatch[3].toUpperCase();

  if (!hour || hour > 12 || minute > 59) return '';

  const hour24 =
    meridiem === 'PM' && hour !== 12
      ? hour + 12
      : meridiem === 'AM' && hour === 12
        ? 0
        : hour;

  return `${String(hour24).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
};

const getRideCalendarStartTime = (ride = {}) => {
  for (const leg of ride.legs || []) {
    const pickupWindowStart = String(leg.pickupWindow || '').split(/\s*-\s*/)[0] || '';
    const timeValue =
      normalizeRideCalendarTime(pickupWindowStart) ||
      normalizeRideCalendarTime(leg.pickupTime) ||
      normalizeRideCalendarTime(leg.appointmentTime);

    if (timeValue) return timeValue;
  }

  return '';
};

const addHoursToRideCalendarDateTime = (dateValue, timeValue, hours = 3) => {
  const date = new Date(`${dateValue}T${timeValue}`);
  if (Number.isNaN(date.getTime())) return `${dateValue}T${timeValue}`;

  date.setHours(date.getHours() + hours);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-') + `T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
};

const addDaysToRideCalendarDate = (dateValue, days = 1) => {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateValue;

  date.setDate(date.getDate() + days);

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const buildRideGoogleCalendarEventPayload = (ride = {}) => {
  const dateValue = formatDateForInput(ride.rideDate);
  if (!dateValue) {
    throw new Error('Add a ride date before sending this ride to Google Calendar.');
  }

  const timeValue = getRideCalendarStartTime(ride);
  const firstLeg = ride.legs?.[0] || {};
  const description = [
    ride.confirmationNumber ? `Confirmation #: ${ride.confirmationNumber}` : '',
    ride.status ? `Status: ${ride.status}` : '',
    ride.provider ? `Provider: ${ride.provider}` : '',
    ride.riderName ? `Rider: ${ride.riderName}` : '',
    (ride.legs || [])
      .map((leg) =>
        [
          leg.leg || 'Leg',
          leg.pickupTime ? `Pickup: ${leg.pickupTime}` : '',
          leg.pickupWindow ? `Pickup window: ${leg.pickupWindow}` : '',
          leg.appointmentTime ? `Appointment: ${leg.appointmentTime}` : '',
          leg.pickupName || leg.pickupAddress ? `From: ${[leg.pickupName, leg.pickupAddress].filter(Boolean).join(', ')}` : '',
          leg.pickupPhone ? `Pickup phone: ${leg.pickupPhone}` : '',
          leg.dropoffName || leg.dropoffAddress ? `To: ${[leg.dropoffName, leg.dropoffAddress].filter(Boolean).join(', ')}` : '',
          leg.dropoffPhone ? `Dropoff phone: ${leg.dropoffPhone}` : '',
          leg.provider ? `Provider: ${leg.provider}` : '',
          leg.notes ? `Notes: ${leg.notes}` : '',
        ]
          .filter(Boolean)
          .join('\n')
      )
      .filter(Boolean)
      .join('\n\n'),
    ride.notes ? `Ride notes:\n${ride.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const payload = {
    summary: `${ride.provider || 'Ride'}${ride.confirmationNumber ? ` #${ride.confirmationNumber}` : ''}`,
    location: [firstLeg.pickupName, firstLeg.pickupAddress].filter(Boolean).join(', '),
    description,
  };

  if (timeValue) {
    payload.start = {
      dateTime: `${dateValue}T${timeValue}`,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles',
    };
    payload.end = {
      dateTime: addHoursToRideCalendarDateTime(dateValue, timeValue, 3),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles',
    };
  } else {
    payload.start = { date: dateValue };
    payload.end = { date: addDaysToRideCalendarDate(dateValue, 1) };
  }

  return payload;
};

const getRideListFileDate = () => formatLocalIsoDate(new Date());

const buildPrintableRidesHtml = (rides = []) => {
  const sortedRides = sortRides(rides);
  const rideSections = sortedRides
    .map((ride) => {
      const financials = getRideFinancials(ride);
      const hasFinancials = financials.fare > 0 || financials.fees > 0 || financials.tip > 0 || financials.total > 0;
      const legs = (ride.legs || [])
        .map(
          (leg) => `
            <section class="leg-card">
              <div class="leg-heading">
                <h3>${escapeHtml(leg.leg || 'Leg')}</h3>
                <span>${escapeHtml(leg.status || ride.status || 'Status unknown')}</span>
              </div>
              <div class="time-grid">
                <div><strong>Pickup</strong><span>${escapeHtml(leg.pickupTime || 'N/A')}</span></div>
                <div><strong>Pickup Window</strong><span>${escapeHtml(leg.pickupWindow || 'N/A')}</span></div>
                <div><strong>Appointment / Dropoff</strong><span>${escapeHtml(leg.appointmentTime || 'N/A')}</span></div>
              </div>
              <div class="route-grid">
                <div class="route-card pickup">
                  <strong>Pick Up</strong>
                  <span>${escapeHtml(leg.pickupName || 'Location not listed')}</span>
                  ${leg.pickupAddress ? `<span>${escapeHtml(leg.pickupAddress)}</span>` : ''}
                  ${leg.pickupPhone ? `<span>Phone: ${escapeHtml(leg.pickupPhone)}</span>` : ''}
                </div>
                <div class="route-card dropoff">
                  <strong>Drop Off</strong>
                  <span>${escapeHtml(leg.dropoffName || 'Location not listed')}</span>
                  ${leg.dropoffAddress ? `<span>${escapeHtml(leg.dropoffAddress)}</span>` : ''}
                  ${leg.dropoffPhone ? `<span>Phone: ${escapeHtml(leg.dropoffPhone)}</span>` : ''}
                </div>
              </div>
              ${leg.provider ? `<p><strong>Leg Provider:</strong> ${escapeHtml(leg.provider)}</p>` : ''}
              ${leg.confirmationNumber ? `<p><strong>Leg Confirmation #:</strong> ${escapeHtml(leg.confirmationNumber)}</p>` : ''}
              ${leg.notes ? `<p class="notes"><strong>Leg Notes:</strong> ${escapeHtml(leg.notes)}</p>` : ''}
            </section>
          `
        )
        .join('');

      return `
        <article class="ride-card">
          <div class="ride-heading">
            <div>
              <h2>${escapeHtml(formatDateForDisplay(ride.rideDate))}</h2>
              <p>${escapeHtml(ride.provider || 'Provider not listed')}</p>
            </div>
            <span class="status">${escapeHtml(ride.status || 'Status unknown')}</span>
          </div>
          <div class="ride-meta">
            <div><strong>Confirmation #</strong><span>${escapeHtml(ride.confirmationNumber || 'N/A')}</span></div>
            <div><strong>Rider</strong><span>${escapeHtml(ride.riderName || 'David Hallstrom')}</span></div>
            <div><strong>Legs</strong><span>${ride.legs?.length || 0}</span></div>
          </div>
          ${
            hasFinancials
              ? `
                <div class="financial-grid">
                  <div><strong>Fare</strong><span>${escapeHtml(formatRideCurrency(financials.fare))}</span></div>
                  <div><strong>Fees</strong><span>${escapeHtml(formatRideCurrency(financials.fees))}</span></div>
                  <div><strong>Tip</strong><span>${escapeHtml(formatRideCurrency(financials.tip))}</span></div>
                  <div><strong>Total</strong><span>${escapeHtml(formatRideCurrency(financials.total))}</span></div>
                </div>
              `
              : ''
          }
          <div class="legs">${legs || '<p>No ride legs listed.</p>'}</div>
          ${ride.notes ? `<p class="ride-notes"><strong>Ride Notes:</strong> ${escapeHtml(ride.notes)}</p>` : ''}
        </article>
      `;
    })
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Hallstrom Rides List</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px; font-family: Cambria, Georgia, serif; color: #0f172a; background: #f8fafc; }
    .page { max-width: 900px; margin: 0 auto; background: #fff; padding: 36px; border: 1px solid #dbe4f0; border-radius: 22px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08); }
    .title { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px solid #0f172a; text-align: center; }
    .title h1 { margin: 0; font-size: 32px; font-weight: 800; }
    .title p { margin: 8px 0 0; color: #475569; font-size: 15px; }
    .ride-card { margin-bottom: 18px; padding: 16px; border: 1px solid #dbe4f0; border-radius: 16px; break-inside: avoid; }
    .ride-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
    .ride-heading h2 { margin: 0; font-size: 20px; }
    .ride-heading p { margin: 4px 0 0; color: #475569; font-weight: 700; }
    .status { padding: 5px 10px; border-radius: 999px; background: #dbeafe; color: #1e3a8a; font-size: 12px; font-weight: 800; white-space: nowrap; }
    .ride-meta, .financial-grid, .time-grid { display: grid; gap: 10px; }
    .ride-meta { grid-template-columns: repeat(3, minmax(0, 1fr)); margin-bottom: 12px; }
    .financial-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 12px; padding: 10px; border-radius: 12px; background: #f1f5f9; }
    .time-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 10px 0; }
    .ride-meta div, .financial-grid div, .time-grid div { min-width: 0; }
    .ride-meta strong, .financial-grid strong, .time-grid strong { display: block; margin-bottom: 3px; color: #475569; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
    .ride-meta span, .financial-grid span, .time-grid span { display: block; font-size: 13px; font-weight: 700; overflow-wrap: anywhere; }
    .leg-card { margin-top: 12px; padding: 12px; border-left: 5px solid #2563eb; border-radius: 0 12px 12px 0; background: #f8fafc; break-inside: avoid; }
    .leg-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .leg-heading h3 { margin: 0; font-size: 16px; }
    .leg-heading span { color: #475569; font-size: 12px; font-weight: 800; }
    .route-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .route-card { min-width: 0; padding: 10px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; }
    .route-card strong, .route-card span { display: block; }
    .route-card strong { margin-bottom: 5px; font-size: 13px; }
    .route-card span { margin-top: 3px; font-size: 12.5px; line-height: 1.35; overflow-wrap: anywhere; }
    .pickup { border-top: 4px solid #16a34a; }
    .dropoff { border-top: 4px solid #dc2626; }
    .leg-card p, .ride-notes { margin: 8px 0 0; font-size: 12.5px; line-height: 1.4; white-space: pre-wrap; }
    .ride-notes { padding: 10px; border-radius: 10px; background: #fff7ed; }
    .empty { padding: 32px; border: 1px dashed #cbd5e1; border-radius: 14px; color: #64748b; text-align: center; }
    @media print {
      body { padding: 0; background: #fff; }
      .page { max-width: none; padding: 0; border: 0; border-radius: 0; box-shadow: none; }
      @page { size: Letter; margin: 0.5in; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="title">
      <h1>Hallstrom Rides List</h1>
      <p>${sortedRides.length} ride${sortedRides.length === 1 ? '' : 's'}, generated ${getRideListFileDate()}</p>
    </header>
    ${rideSections || '<div class="empty">No rides available.</div>'}
  </main>
</body>
</html>`;
};

const PremiumRidesListView = ({ rides = [], onClose }) => {
  const sortedRides = useMemo(() => sortRides(rides), [rides]);

  const handlePrint = () => window.print();

  const handleDownload = () => {
    downloadTextFile(
      `Hallstrom_Rides_List_${getRideListFileDate()}.html`,
      buildPrintableRidesHtml(sortedRides),
      'text/html;charset=utf-8'
    );
  };

  return (
    <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/70 px-2 py-4 sm:px-4 sm:py-6 print:static print:bg-white print:p-0">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }

          .premium-rides-print-root,
          .premium-rides-print-root * {
            visibility: visible !important;
          }

          .premium-rides-print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: none !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }

          .premium-rides-no-print {
            display: none !important;
          }

          @page {
            size: Letter;
            margin: 0.5in;
          }
        }
      `}</style>

      <div className="premium-rides-no-print mx-auto mb-4 flex max-w-[900px] items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm hover:bg-slate-100"
        >
          Close
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-sky-700"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
        </div>
      </div>

      <main className="premium-rides-print-root mx-auto max-w-[900px] rounded-[22px] border border-slate-200 bg-white p-4 font-serif text-slate-900 shadow-2xl sm:p-9 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="mb-6 border-b-[3px] border-slate-900 pb-4 text-center">
          <h1 className="m-0 text-[28px] font-extrabold leading-tight sm:text-[32px]">Hallstrom Rides List</h1>
          <p className="mt-2 text-[15px] text-slate-600">
            {sortedRides.length} ride{sortedRides.length === 1 ? '' : 's'}, generated {getRideListFileDate()}
          </p>
        </header>

        {sortedRides.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-600">
            No rides available.
          </div>
        ) : (
          <div className="space-y-4">
            {sortedRides.map((ride) => {
              const financials = getRideFinancials(ride);
              const hasFinancials =
                financials.fare > 0 || financials.fees > 0 || financials.tip > 0 || financials.total > 0;

              return (
                <article key={ride.id} className="break-inside-avoid rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
                    <div>
                      <h2 className="m-0 text-xl font-extrabold">{formatDateForDisplay(ride.rideDate)}</h2>
                      <p className="mt-1 font-bold text-slate-600">{ride.provider || 'Provider not listed'}</p>
                    </div>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-900">
                      {ride.status || 'Status unknown'}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-[13px] sm:grid-cols-3">
                    <div><span className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Confirmation #</span><strong>{ride.confirmationNumber || 'N/A'}</strong></div>
                    <div><span className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Rider</span><strong>{ride.riderName || 'David Hallstrom'}</strong></div>
                    <div><span className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500">Legs</span><strong>{ride.legs?.length || 0}</strong></div>
                  </div>

                  {hasFinancials && (
                    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-3 text-[13px] sm:grid-cols-4">
                      <div><span className="block text-[11px] font-extrabold uppercase text-slate-500">Fare</span><strong>{formatRideCurrency(financials.fare)}</strong></div>
                      <div><span className="block text-[11px] font-extrabold uppercase text-slate-500">Fees</span><strong>{formatRideCurrency(financials.fees)}</strong></div>
                      <div><span className="block text-[11px] font-extrabold uppercase text-slate-500">Tip</span><strong>{formatRideCurrency(financials.tip)}</strong></div>
                      <div><span className="block text-[11px] font-extrabold uppercase text-slate-500">Total</span><strong>{formatRideCurrency(financials.total)}</strong></div>
                    </div>
                  )}

                  <div className="mt-3 space-y-3">
                    {(ride.legs || []).length === 0 ? (
                      <p className="text-sm text-slate-500">No ride legs listed.</p>
                    ) : (
                      ride.legs.map((leg) => (
                        <section key={leg.id} className="break-inside-avoid rounded-r-xl border-l-[5px] border-blue-600 bg-slate-50 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="m-0 text-base font-extrabold">{leg.leg || 'Leg'}</h3>
                            <span className="text-xs font-extrabold text-slate-600">{leg.status || ride.status || 'Status unknown'}</span>
                          </div>

                          <div className="mt-2 grid gap-2 text-[13px] sm:grid-cols-3">
                            <div><span className="block text-[11px] font-extrabold uppercase text-slate-500">Pickup</span><strong>{leg.pickupTime || 'N/A'}</strong></div>
                            <div><span className="block text-[11px] font-extrabold uppercase text-slate-500">Pickup Window</span><strong>{leg.pickupWindow || 'N/A'}</strong></div>
                            <div><span className="block text-[11px] font-extrabold uppercase text-slate-500">Appointment / Dropoff</span><strong>{leg.appointmentTime || 'N/A'}</strong></div>
                          </div>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <div className="rounded-xl border border-slate-200 border-t-4 border-t-green-600 bg-white p-3 text-[13px]">
                              <strong className="block">Pick Up</strong>
                              <span className="mt-1 block font-bold">{leg.pickupName || 'Location not listed'}</span>
                              {leg.pickupAddress && <span className="mt-1 block text-slate-700">{leg.pickupAddress}</span>}
                              {leg.pickupPhone && <span className="mt-1 block text-slate-700">Phone: {leg.pickupPhone}</span>}
                            </div>
                            <div className="rounded-xl border border-slate-200 border-t-4 border-t-red-600 bg-white p-3 text-[13px]">
                              <strong className="block">Drop Off</strong>
                              <span className="mt-1 block font-bold">{leg.dropoffName || 'Location not listed'}</span>
                              {leg.dropoffAddress && <span className="mt-1 block text-slate-700">{leg.dropoffAddress}</span>}
                              {leg.dropoffPhone && <span className="mt-1 block text-slate-700">Phone: {leg.dropoffPhone}</span>}
                            </div>
                          </div>

                          {leg.provider && <p className="mt-2 text-[13px]"><strong>Leg Provider:</strong> {leg.provider}</p>}
                          {leg.confirmationNumber && <p className="mt-1 text-[13px]"><strong>Leg Confirmation #:</strong> {leg.confirmationNumber}</p>}
                          {leg.notes && <p className="mt-2 whitespace-pre-wrap text-[13px]"><strong>Leg Notes:</strong> {leg.notes}</p>}
                        </section>
                      ))
                    )}
                  </div>

                  {ride.notes && (
                    <p className="mt-3 whitespace-pre-wrap rounded-xl bg-orange-50 p-3 text-[13px]">
                      <strong>Ride Notes:</strong> {ride.notes}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

const RidesTab = ({ searchQuery = '' }) => {
  const [rides, setRides] = useState(readStoredRides);
  const [archivedRides, setArchivedRides] = useState(readArchivedRides);
  const [scanText, setScanText] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [expandedRideIds, setExpandedRideIds] = useState({});
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [editingRide, setEditingRide] = useState(null);
  const [calendarAddingRideId, setCalendarAddingRideId] = useState('');
  const [calendarAddedIds, setCalendarAddedIds] = useState(readRideGoogleCalendarAddedIds);
  const [reportRange, setReportRange] = useState(getDefaultRideReportRange);
  const [isRideImportOpen, setIsRideImportOpen] = useState(false);
  const [isRideReportOpen, setIsRideReportOpen] = useState(false);
  const [showPremiumRidesView, setShowPremiumRidesView] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    let rawDraft = '';

    try {
      rawDraft =
        sessionStorage.getItem(RIDES_CREATE_DRAFT_STORAGE_KEY) ||
        localStorage.getItem(RIDES_CREATE_DRAFT_STORAGE_KEY) ||
        '';
      sessionStorage.removeItem(RIDES_CREATE_DRAFT_STORAGE_KEY);
      localStorage.removeItem(RIDES_CREATE_DRAFT_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to read ride draft from CSC opportunity:', error);
    }

    if (!rawDraft) return;

    try {
      setEditingRide(normalizeRide(JSON.parse(rawDraft)));
      setStatusMessage('Ride plan opened from CSC Opportunities.');
      window.setTimeout(() => setStatusMessage(''), 3000);
    } catch (error) {
      console.error('Failed to open ride draft from CSC opportunity:', error);
      setStatusMessage('The CSC opportunity ride plan could not be opened.');
      window.setTimeout(() => setStatusMessage(''), 3000);
    }
  }, []);

  useEffect(() => {
    let rideId = '';

    try {
      rideId =
        sessionStorage.getItem(RIDES_OPEN_LINKED_RIDE_STORAGE_KEY) ||
        localStorage.getItem(RIDES_OPEN_LINKED_RIDE_STORAGE_KEY) ||
        '';
      sessionStorage.removeItem(RIDES_OPEN_LINKED_RIDE_STORAGE_KEY);
      localStorage.removeItem(RIDES_OPEN_LINKED_RIDE_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to read linked ride request:', error);
    }

    if (!rideId) return;

    const activeRide = rides.find((ride) => ride.id === rideId);
    const archivedRide = archivedRides.find((ride) => ride.id === rideId);

    if (activeRide) {
      setExpandedRideIds((current) => ({ ...current, [rideId]: true }));
      setStatusMessage('Linked ride opened.');
      window.setTimeout(() => setStatusMessage(''), 2500);
      return;
    }

    if (archivedRide) {
      setIsArchiveOpen(true);
      setStatusMessage('Linked ride is in the archive.');
      window.setTimeout(() => setStatusMessage(''), 2500);
    }
  }, [archivedRides, rides]);

  const filteredRides = useMemo(() => {
    const query = String(searchQuery || '').trim().toLowerCase();
    if (!query) return sortRides(rides);
    return sortRides(rides).filter((ride) => formatRideForSearch(ride).includes(query));
  }, [rides, searchQuery]);

  const groupedRides = useMemo(() => {
    return filteredRides.reduce((groups, ride) => {
      const key = getRideDateGroup(ride);
      if (!groups[key]) groups[key] = [];
      groups[key].push(ride);
      return groups;
    }, {});
  }, [filteredRides]);

  const reportRidePool = useMemo(() => {
    const byId = new Map();
    [...rides, ...archivedRides].forEach((ride) => byId.set(ride.id, normalizeRide(ride)));
    return sortRides(Array.from(byId.values()));
  }, [rides, archivedRides]);

  const reportRides = useMemo(
    () =>
      reportRidePool.filter((ride) => {
        const rideDate = formatDateForInput(ride.rideDate);
        if (!rideDate) return false;
        if (reportRange.start && rideDate < reportRange.start) return false;
        if (reportRange.end && rideDate > reportRange.end) return false;
        return true;
      }),
    [reportRange, reportRidePool]
  );

  const reportSummary = useMemo(
    () =>
      reportRides.reduce(
        (totals, ride) => {
          const financials = getRideFinancials(ride);
          totals.rideCount += 1;
          totals.fare += financials.fare;
          totals.tip += financials.tip;
          totals.fees += financials.fees;
          totals.fareAndFees += financials.fareAndFees;
          totals.total += financials.total;
          if (financials.total > 0) totals.ridesWithCost += 1;
          return totals;
        },
        {
          rideCount: 0,
          ridesWithCost: 0,
          fare: 0,
          tip: 0,
          fees: 0,
          fareAndFees: 0,
          total: 0,
        }
      ),
    [reportRides]
  );

  const summary = useMemo(() => {
    const legCount = rides.reduce((sum, ride) => sum + ride.legs.length, 0);
    const requestPickupCount = rides.reduce(
      (sum, ride) => sum + ride.legs.filter((leg) => /request pickup/i.test(leg.pickupTime)).length,
      0
    );
    const confirmedCount = rides.filter((ride) => /confirmed/i.test(ride.status)).length;

    return {
      rideCount: rides.length,
      legCount,
      requestPickupCount,
      confirmedCount,
      archivedCount: archivedRides.length,
    };
  }, [rides, archivedRides]);

  const saveRides = (nextRides, message = 'Rides saved.') => {
    const normalized = sortRides(nextRides.map(normalizeRide));
    setRides(normalized);
    writeStoredRides(normalized);
    dispatchRidesStorageEvent();
    if (message !== false) {
      setStatusMessage(message);
      window.setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const saveArchivedRides = (nextArchivedRides, message = 'Rides archive updated.') => {
    const normalized = sortRides(nextArchivedRides.map(normalizeRide));
    setArchivedRides(normalized);
    writeArchivedRides(normalized);
    dispatchRidesStorageEvent();
    if (message !== false) {
      setStatusMessage(message);
      window.setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  const startEditRide = (ride = {}) => {
    setEditingRide(normalizeRide(ride));
  };

  const updateEditingRideField = (field, value) => {
    setEditingRide((current) =>
      current
        ? {
            ...current,
            [field]: value,
            updatedAt: new Date().toISOString(),
          }
        : current
    );
  };

  const updateEditingLegField = (legId, field, value) => {
    setEditingRide((current) =>
      current
        ? {
            ...current,
            updatedAt: new Date().toISOString(),
            legs: current.legs.map((leg) => (leg.id === legId ? { ...leg, [field]: value } : leg)),
          }
        : current
    );
  };

  const addLegToEditingRide = () => {
    setEditingRide((current) => {
      if (!current) return current;

      const nextLegLetter = String.fromCharCode(65 + current.legs.length);
      const baseProvider = current.provider || current.legs[0]?.provider || '';

      return {
        ...current,
        updatedAt: new Date().toISOString(),
        legs: [
          ...current.legs,
          normalizeLeg({
            leg: `Leg ${nextLegLetter}`,
            status: current.status || 'Confirmed',
            provider: baseProvider,
          }),
        ],
      };
    });
  };

  const deleteLegFromEditingRide = (legId) => {
    setEditingRide((current) => {
      if (!current || current.legs.length <= 1) return current;
      return {
        ...current,
        updatedAt: new Date().toISOString(),
        legs: current.legs.filter((leg) => leg.id !== legId),
      };
    });
  };

  const saveEditedRide = () => {
    if (!editingRide) return;

    const normalized = normalizeRide({
      ...editingRide,
      updatedAt: new Date().toISOString(),
    });
    const existingRide = rides.some((ride) => ride.id === normalized.id);
    const nextRides = existingRide
      ? rides.map((ride) => (ride.id === normalized.id ? normalized : ride))
      : [...rides, normalized];

    saveRides(nextRides, existingRide ? 'Ride changes saved.' : 'Ride plan saved.');
    updateOpportunityRideLink(normalized.sourceOpportunityId, normalized.id);
    setExpandedRideIds((current) => ({ ...current, [normalized.id]: true }));
    setEditingRide(null);
  };

  const duplicateRide = (ride = {}) => {
    const copyConfirmationNumber = ride.confirmationNumber ? `${ride.confirmationNumber}-COPY` : '';
    const copiedLegs = (ride.legs || []).map((leg) =>
      normalizeLeg({
        ...leg,
        id: createRideId('leg'),
        confirmationNumber: copyConfirmationNumber || leg.confirmationNumber,
      })
    );
    const copy = normalizeRide({
      ...ride,
      id: createRideId(),
      confirmationNumber: copyConfirmationNumber,
      status: ride.status === 'Completed' ? 'Confirmed' : ride.status,
      legs: copiedLegs,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archivedAt: '',
      completedAt: '',
      restoredAt: '',
      googleCalendarEventId: '',
      googleCalendarEventLink: '',
      googleCalendarAddedAt: '',
      sourceOpportunityId: '',
      linkedCscShiftId: '',
    });

    saveRides([...rides, copy], 'Ride copied.');
    setExpandedRideIds((current) => ({ ...current, [copy.id]: true }));
  };

  const archiveRide = (rideId, message = 'Ride marked complete and archived.') => {
    const ride = rides.find((item) => item.id === rideId);
    if (!ride) return;

    const archivedRide = normalizeRide({
      ...ride,
      status: 'Completed',
      archivedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      legs: ride.legs.map((leg) => ({
        ...leg,
        status: leg.status || 'Completed',
      })),
    });

    saveRides(rides.filter((item) => item.id !== rideId), false);
    saveArchivedRides([archivedRide, ...archivedRides.filter((item) => item.id !== rideId)], message);
  };

  const restoreRide = (rideId) => {
    const ride = archivedRides.find((item) => item.id === rideId);
    if (!ride) return;

    const restoredRide = normalizeRide({
      ...ride,
      status: ride.status === 'Completed' ? 'Confirmed' : ride.status,
      restoredAt: new Date().toISOString(),
    });

    saveArchivedRides(archivedRides.filter((item) => item.id !== rideId), false);
    saveRides([...rides, restoredRide], 'Ride restored to active list.');
  };

  const deleteArchivedRide = (rideId) => {
    if (!window.confirm('Delete this archived ride permanently?')) return;
    clearOpportunityRideLink(rideId);
    saveArchivedRides(archivedRides.filter((ride) => ride.id !== rideId), 'Archived ride deleted.');
  };

  const addRideToGoogleCalendar = async (ride) => {
    if (!ride?.id || calendarAddingRideId) return;

    try {
      setCalendarAddingRideId(ride.id);
      const eventPayload = buildRideGoogleCalendarEventPayload(ride);
      const createdEvent = await createGoogleCalendarEvent(eventPayload);

      setCalendarAddedIds((current) => {
        const nextIds = Array.from(new Set([...current, ride.id]));
        writeRideGoogleCalendarAddedIds(nextIds);
        return nextIds;
      });

      saveRides(
        rides.map((item) =>
          item.id === ride.id
            ? {
                ...item,
                googleCalendarEventId: createdEvent?.id || item.googleCalendarEventId || '',
                googleCalendarEventLink: createdEvent?.htmlLink || item.googleCalendarEventLink || '',
                googleCalendarAddedAt: new Date().toISOString(),
              }
            : item
        ),
        'Ride added to Google Calendar.'
      );
    } catch (error) {
      window.alert(error?.message || 'Could not add this ride to Google Calendar.');
    } finally {
      setCalendarAddingRideId('');
    }
  };

  const addRideFromScan = () => {
    const parsedRides = parseRideScanEntries(scanText).filter((ride) => ride.legs.length);

    if (!parsedRides.length) {
      setStatusMessage('No ride details found. Paste a Modivcare/Lyft confirmation, Uber receipt, or Uber Activity history list and try again.');
      return;
    }

    let nextRides = [...rides];
    let addedCount = 0;
    let updatedCount = 0;
    const openedRideIds = [];

    parsedRides.forEach((parsedRide) => {
      const existingIndex = findMatchingRideIndex(nextRides, parsedRide);

      if (existingIndex >= 0) {
        const mergedRide = mergeScannedRide(nextRides[existingIndex], parsedRide);
        nextRides = nextRides.map((ride, index) => (index === existingIndex ? mergedRide : ride));
        openedRideIds.push(mergedRide.id);
        updatedCount += 1;
        return;
      }

      const nextRide = normalizeRide({
        ...parsedRide,
        updatedAt: new Date().toISOString(),
      });
      nextRides.push(nextRide);
      openedRideIds.push(nextRide.id);
      addedCount += 1;
    });

    const messageParts = [];
    if (addedCount) messageParts.push(`${addedCount} ride${addedCount === 1 ? '' : 's'} added`);
    if (updatedCount) messageParts.push(`${updatedCount} ride${updatedCount === 1 ? '' : 's'} updated`);

    saveRides(nextRides, `${messageParts.join(' and ')} from scan.`);
    setExpandedRideIds((current) => {
      const next = { ...current };
      openedRideIds.forEach((rideId) => {
        next[rideId] = true;
      });
      return next;
    });
    setScanText('');
  };

  const addBlankRide = () => {
    const ride = normalizeRide({
      rideDate: formatDateForInput(new Date().toISOString()),
      riderName: 'David Hallstrom',
      status: 'Confirmed',
      provider: 'LYFT Healthcare Inc',
      legs: [
        {
          leg: 'Leg A',
          pickupTime: '',
          appointmentTime: '',
          pickupName: '',
          pickupAddress: '',
          pickupPhone: '',
          dropoffName: '',
          dropoffAddress: '',
          dropoffPhone: '',
          status: 'Confirmed',
          provider: 'LYFT Healthcare Inc',
        },
      ],
    });

    saveRides([...rides, ride], 'Blank ride added.');
    setExpandedRideIds((current) => ({ ...current, [ride.id]: true }));
  };

  const deleteRide = (rideId) => {
    if (!window.confirm('Delete this ride?')) return;
    clearOpportunityRideLink(rideId);
    saveRides(rides.filter((ride) => ride.id !== rideId), 'Ride deleted.');
  };

  const exportRides = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadTextFile(`rides-${stamp}.json`, JSON.stringify({ rides, archivedRides }, null, 2));
    setStatusMessage('Rides exported.');
  };

  const saveSnapshot = () => {
    const snapshot = {
      createdAt: new Date().toISOString(),
      type: 'modivcare-rides-safety-snapshot',
      rides,
      archivedRides,
    };
    localStorage.setItem(RIDES_SNAPSHOT_KEY, JSON.stringify(snapshot));
    downloadTextFile(`modivcare-rides-safety-snapshot-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(snapshot, null, 2));
    setStatusMessage('Rides safety snapshot downloaded.');
  };

  const importRides = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const parsed = JSON.parse(loadEvent.target.result);
        const importedRides = Array.isArray(parsed) ? parsed : parsed.rides;
        const importedArchivedRides = Array.isArray(parsed?.archivedRides) ? parsed.archivedRides : [];
        if (!Array.isArray(importedRides)) throw new Error('Invalid rides file.');
        saveRides(importedRides, 'Rides imported.');
        if (importedArchivedRides.length) saveArchivedRides(importedArchivedRides, 'Rides and archive imported.');
      } catch (error) {
        setStatusMessage(`Import failed: ${error.message}`);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const applyRideReportPreset = (preset) => {
    const today = new Date();
    let start = new Date(today);
    let end = new Date(today);

    if (preset === 'week') {
      const dayOfWeek = today.getDay();
      const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start.setDate(today.getDate() - daysSinceMonday);
    } else if (preset === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (preset === 'last30') {
      start.setDate(today.getDate() - 29);
    } else if (preset === 'all') {
      const datedRides = reportRidePool
        .map((ride) => formatDateForInput(ride.rideDate))
        .filter(Boolean)
        .sort();
      setReportRange({
        start: datedRides[0] || '',
        end: datedRides[datedRides.length - 1] || formatLocalIsoDate(today),
      });
      return;
    }

    setReportRange({
      start: formatLocalIsoDate(start),
      end: formatLocalIsoDate(end),
    });
  };

  const exportRideExpenseReport = () => {
    const headers = ['Date', 'Provider', 'Status', 'Route', 'Fare', 'Fees', 'Tip', 'Total'];
    const rows = reportRides.map((ride) => {
      const financials = getRideFinancials(ride);
      const firstLeg = ride.legs?.[0] || {};
      const route = [
        firstLeg.pickupName || firstLeg.pickupAddress || 'Pickup not listed',
        firstLeg.dropoffName || firstLeg.dropoffAddress || 'Dropoff not listed',
      ].join(' to ');

      return [
        ride.rideDate || '',
        ride.provider || '',
        ride.status || '',
        route,
        financials.fare.toFixed(2),
        financials.fees.toFixed(2),
        financials.tip.toFixed(2),
        financials.total.toFixed(2),
      ];
    });

    const csv = [
      headers,
      ...rows,
      [],
      ['Totals', '', '', '', reportSummary.fare.toFixed(2), reportSummary.fees.toFixed(2), reportSummary.tip.toFixed(2), reportSummary.total.toFixed(2)],
    ]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    downloadTextFile(
      `ride-expense-report-${reportRange.start || 'start'}-to-${reportRange.end || 'end'}.csv`,
      csv,
      'text/csv;charset=utf-8'
    );
    setStatusMessage('Ride expense report exported.');
    window.setTimeout(() => setStatusMessage(''), 3000);
  };

  const printRideExpenseReport = () => {
    const printWindow = window.open('', '_blank');

    if (!printWindow) {
      setStatusMessage('Popup blocked. Allow popups to print the ride expense report.');
      return;
    }

    const reportRows = reportRides
      .map((ride) => {
        const financials = getRideFinancials(ride);
        const firstLeg = ride.legs?.[0] || {};
        const from = firstLeg.pickupName || firstLeg.pickupAddress || 'Pickup not listed';
        const to = firstLeg.dropoffName || firstLeg.dropoffAddress || 'Dropoff not listed';

        return `
          <tr>
            <td>${escapeHtml(formatDateForDisplay(ride.rideDate))}</td>
            <td>${escapeHtml(ride.provider || 'Provider not listed')}</td>
            <td>${escapeHtml(ride.status || '')}</td>
            <td>${escapeHtml(`${from} to ${to}`)}</td>
            <td class="money">${escapeHtml(formatRideCurrency(financials.fare))}</td>
            <td class="money">${escapeHtml(formatRideCurrency(financials.fees))}</td>
            <td class="money">${escapeHtml(formatRideCurrency(financials.tip))}</td>
            <td class="money total">${escapeHtml(formatRideCurrency(financials.total))}</td>
          </tr>
        `;
      })
      .join('');

    printWindow.document.write(`
      <!doctype html>
      <html>
      <head>
        <title>Ride Fare and Tip Report</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 24px; }
          h1 { margin: 0; font-size: 24px; }
          .meta { color: #475569; margin: 6px 0 18px; }
          .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px; }
          .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; }
          .card span { display: block; color: #64748b; font-size: 12px; }
          .card strong { display: block; margin-top: 4px; font-size: 18px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #e2e8f0; }
          .money { text-align: right; white-space: nowrap; }
          .total { font-weight: 700; }
          tfoot td { background: #f8fafc; font-weight: 700; }
          @media print {
            body { margin: 12mm; }
            .summary { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <h1>Ride Fare and Tip Report</h1>
        <div class="meta">
          ${escapeHtml(formatDateForDisplay(reportRange.start))} through ${escapeHtml(formatDateForDisplay(reportRange.end))}
          | ${reportSummary.rideCount} ride${reportSummary.rideCount === 1 ? '' : 's'}
          | Printed ${escapeHtml(new Date().toLocaleString())}
        </div>
        <div class="summary">
          <div class="card"><span>Fares</span><strong>${escapeHtml(formatRideCurrency(reportSummary.fare))}</strong></div>
          <div class="card"><span>Fees</span><strong>${escapeHtml(formatRideCurrency(reportSummary.fees))}</strong></div>
          <div class="card"><span>Tips</span><strong>${escapeHtml(formatRideCurrency(reportSummary.tip))}</strong></div>
          <div class="card"><span>Total</span><strong>${escapeHtml(formatRideCurrency(reportSummary.total))}</strong></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Provider</th>
              <th>Status</th>
              <th>Route</th>
              <th>Fare</th>
              <th>Fees</th>
              <th>Tip</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${reportRows || '<tr><td colspan="8">No rides found for this date range.</td></tr>'}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4">Totals</td>
              <td class="money">${escapeHtml(formatRideCurrency(reportSummary.fare))}</td>
              <td class="money">${escapeHtml(formatRideCurrency(reportSummary.fees))}</td>
              <td class="money">${escapeHtml(formatRideCurrency(reportSummary.tip))}</td>
              <td class="money">${escapeHtml(formatRideCurrency(reportSummary.total))}</td>
            </tr>
          </tfoot>
        </table>
        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const printRides = () => setShowPremiumRidesView(true);

  useEffect(() => {
    const handlers = {
      'rides-toolbar:add': addBlankRide,
      'rides-toolbar:print': printRides,
      'rides-toolbar:export': exportRides,
      'rides-toolbar:import': () => fileInputRef.current?.click(),
      'rides-toolbar:snapshot': saveSnapshot,
      'rides-toolbar:archive': () => setIsArchiveOpen(true),
    };

    Object.entries(handlers).forEach(([eventName, handler]) => window.addEventListener(eventName, handler));
    return () => Object.entries(handlers).forEach(([eventName, handler]) => window.removeEventListener(eventName, handler));
  });

  return (
    <PageContainer surfaceClassName="min-h-screen bg-sky-100/70" className="rides-mobile-page flex flex-col gap-1.5 bg-sky-100/70 py-1.5 sm:gap-3 sm:bg-sky-50 sm:py-3">
      <style>{`
        .rides-summary-title-mobile {
          display: none;
        }

        @media (max-width: 639px) {
          .rides-mobile-page {
            font-size: 0.875rem;
          }

          .rides-summary-grid {
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 0.375rem;
          }

          .rides-summary-card {
            min-width: 0;
            padding: 0.3125rem 0.125rem;
            border-radius: 0.625rem;
            text-align: center;
            box-shadow: none;
          }

          .rides-summary-title-desktop {
            display: none;
          }

          .rides-summary-title-mobile {
            display: inline;
          }

          .rides-summary-title {
            overflow: hidden;
            font-size: 0.625rem;
            line-height: 0.75rem;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .rides-summary-count {
            margin-top: 0;
            font-size: 1rem;
            line-height: 1.125rem;
          }

          .rides-mobile-page input,
          .rides-mobile-page select,
          .rides-mobile-page textarea {
            font-size: 16px;
          }

          .rides-mobile-page textarea {
            line-height: 1.35;
          }
        }
      `}</style>
      <input ref={fileInputRef} type="file" accept=".json" onChange={importRides} className="hidden" />

      <TabPageHeader
        icon={Car}
        title="Rides"
        subtitle="Scan Modivcare and Lyft confirmations or Uber receipts, then manage ride details and calendar status."
        theme="sky"
        message={statusMessage}
        className="budget-mobile-header"
        actions={
          <div className="grid w-full grid-cols-3 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:gap-2">
            <button type="button" onClick={addBlankRide} title="Add a new ride" aria-label="Add a new ride" className={`${TAB_HEADER_ACTION_CLASS} !h-9 !min-w-0 !gap-1 !px-1.5 !text-[10px] sm:!h-10 sm:!gap-2 sm:!px-4 sm:!text-sm bg-slate-950 text-white hover:bg-slate-800`}>
              <Plus className="h-4 w-4" />
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">Add Ride</span>
            </button>
            <button type="button" onClick={printRides} title="Print the rides list" aria-label="Print the rides list" className={`${TAB_HEADER_ACTION_CLASS} !h-9 !min-w-0 !gap-1 !px-1.5 !text-[10px] sm:!h-10 sm:!gap-2 sm:!px-4 sm:!text-sm bg-blue-600 text-white hover:bg-blue-500`}>
              <Printer className="h-4 w-4" />
              <span className="sm:hidden">Print</span>
              <span className="hidden sm:inline">Print Rides</span>
            </button>
            <button type="button" onClick={() => setIsArchiveOpen(true)} title="Open the rides archive" aria-label={`Open the rides archive with ${summary.archivedCount} rides`} className={`${TAB_HEADER_ACTION_CLASS} !h-9 !min-w-0 !gap-1 !px-1.5 !text-[10px] sm:!h-10 sm:!gap-2 sm:!px-4 sm:!text-sm bg-violet-600 text-white hover:bg-violet-500`}>
              <Archive className="h-4 w-4" />
              <span className="sm:hidden">Archive {summary.archivedCount}</span>
              <span className="hidden sm:inline">Archive ({summary.archivedCount})</span>
            </button>
            <button type="button" onClick={exportRides} title="Export rides as JSON" aria-label="Export rides as JSON" className={`${TAB_HEADER_ACTION_CLASS} !h-9 !min-w-0 !gap-1 !px-1.5 !text-[10px] sm:!h-10 sm:!gap-2 sm:!px-4 sm:!text-sm border border-white/30 bg-white/15 text-white hover:bg-white/25`}>
              <Download className="h-4 w-4" />
              Export
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} title="Import rides from JSON" aria-label="Import rides from JSON" className={`${TAB_HEADER_ACTION_CLASS} !h-9 !min-w-0 !gap-1 !px-1.5 !text-[10px] sm:!h-10 sm:!gap-2 sm:!px-4 sm:!text-sm bg-white text-sky-900 hover:bg-sky-50`}>
              <FileUp className="h-4 w-4" />
              Import
            </button>
          </div>
        }
      />

      <section className="rides-summary-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Ride summary">
        <div className="rides-summary-card rounded-2xl border border-sky-200 bg-white p-4 shadow-sm">
          <p className="rides-summary-title text-xs font-black uppercase tracking-wide text-sky-700">
            <span className="rides-summary-title-desktop">Rides</span>
            <span className="rides-summary-title-mobile">Rides</span>
          </p>
          <p className="rides-summary-count mt-1 text-3xl font-black text-slate-950">{summary.rideCount}</p>
        </div>
        <div className="rides-summary-card rounded-2xl border border-cyan-200 bg-white p-4 shadow-sm">
          <p className="rides-summary-title text-xs font-black uppercase tracking-wide text-cyan-700">
            <span className="rides-summary-title-desktop">Legs</span>
            <span className="rides-summary-title-mobile">Legs</span>
          </p>
          <p className="rides-summary-count mt-1 text-3xl font-black text-slate-950">{summary.legCount}</p>
        </div>
        <div className="rides-summary-card rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
          <p className="rides-summary-title text-xs font-black uppercase tracking-wide text-emerald-700">
            <span className="rides-summary-title-desktop">Confirmed</span>
            <span className="rides-summary-title-mobile">Set</span>
          </p>
          <p className="rides-summary-count mt-1 text-3xl font-black text-slate-950">{summary.confirmedCount}</p>
        </div>
        <div className="rides-summary-card rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <p className="rides-summary-title text-xs font-black uppercase tracking-wide text-amber-700">
            <span className="rides-summary-title-desktop">Request Pickup</span>
            <span className="rides-summary-title-mobile">Pickup</span>
          </p>
          <p className="rides-summary-count mt-1 text-3xl font-black text-slate-950">{summary.requestPickupCount}</p>
        </div>
        <div className="rides-summary-card rounded-2xl border border-violet-200 bg-white p-4 shadow-sm">
          <p className="rides-summary-title text-xs font-black uppercase tracking-wide text-violet-700">
            <span className="rides-summary-title-desktop">Archived</span>
            <span className="rides-summary-title-mobile">Past</span>
          </p>
          <p className="rides-summary-count mt-1 text-3xl font-black text-slate-950">{summary.archivedCount}</p>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:rounded-2xl">
        <button
          type="button"
          onClick={() => setIsRideImportOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50 sm:gap-3 sm:px-5 sm:py-3"
          aria-expanded={isRideImportOpen}
          aria-controls="ride-import-section"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 shrink-0 text-blue-700" />
            <span className="text-base font-black leading-tight text-slate-900 sm:text-lg">Import Ride Email or Uber Activity</span>
          </span>
          {isRideImportOpen ? <ChevronDown className="h-5 w-5 shrink-0 text-slate-600" /> : <ChevronRight className="h-5 w-5 shrink-0 text-slate-600" />}
        </button>

        {isRideImportOpen && (
          <div id="ride-import-section" className="border-t border-slate-200 p-3 sm:p-5">
            <textarea
              value={scanText}
              onChange={(event) => setScanText(event.target.value)}
              rows={6}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder={"Paste a Modivcare/Lyft confirmation, Uber receipt, or Uber Activity history list here.\n\nExample:\nPincay Dr & Kareem Ct\nJul 3 • 12:55 PM\n$13.74\nHelp"}
            />
            <div className="mt-2 flex flex-wrap gap-2 sm:mt-3">
              <button type="button" onClick={addRideFromScan} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 sm:px-4 sm:py-2 sm:text-sm">
                Import Ride Text
              </button>
              <button type="button" onClick={() => setScanText('')} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 sm:px-4 sm:py-2 sm:text-sm">
                Clear
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-sky-200 bg-gradient-to-br from-white to-sky-50 shadow-sm sm:rounded-2xl">
        <button
          type="button"
          onClick={() => setIsRideReportOpen((current) => !current)}
          className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left hover:bg-sky-50 sm:gap-3 sm:px-5 sm:py-3"
          aria-expanded={isRideReportOpen}
          aria-controls="ride-fare-report-section"
        >
          <span>
            <span className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-sky-700" />
              <span className="text-base font-black leading-tight text-slate-900 sm:text-lg">Ride Fare and Tip Report</span>
            </span>
            <span className="mt-0.5 block text-xs leading-4 text-slate-600 sm:mt-1 sm:text-sm">
              Includes active and archived rides. Choose a weekly, monthly, all-time, or custom date range.
            </span>
          </span>
          {isRideReportOpen ? <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" /> : <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" />}
        </button>

        {isRideReportOpen && (
          <div id="ride-fare-report-section" className="border-t border-sky-200 p-3 sm:p-5">
            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
              <button type="button" onClick={() => applyRideReportPreset('week')} className="rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-xs font-black text-sky-800 hover:bg-sky-100 sm:px-3 sm:py-2">
                This Week
              </button>
              <button type="button" onClick={() => applyRideReportPreset('month')} className="rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-xs font-black text-sky-800 hover:bg-sky-100 sm:px-3 sm:py-2">
                This Month
              </button>
              <button type="button" onClick={() => applyRideReportPreset('last30')} className="rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-xs font-black text-sky-800 hover:bg-sky-100 sm:px-3 sm:py-2">
                Last 30 Days
              </button>
              <button type="button" onClick={() => applyRideReportPreset('all')} className="rounded-lg border border-sky-200 bg-white px-2 py-1.5 text-xs font-black text-sky-800 hover:bg-sky-100 sm:px-3 sm:py-2">
                All Rides
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:mt-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
              <label className="text-sm font-bold text-slate-700">
                Start Date
                <input
                  type="date"
                  value={reportRange.start}
                  onChange={(event) => setReportRange((current) => ({ ...current, start: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                />
              </label>
              <label className="text-sm font-bold text-slate-700">
                End Date
                <input
                  type="date"
                  value={reportRange.end}
                  onChange={(event) => setReportRange((current) => ({ ...current, end: event.target.value }))}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                />
              </label>
              <button type="button" onClick={printRideExpenseReport} className="mt-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-2 text-xs font-black text-white hover:bg-blue-800 sm:h-10 sm:gap-2 sm:px-4 sm:text-sm">
                <Printer className="h-4 w-4" />
                Print Report
              </button>
              <button type="button" onClick={exportRideExpenseReport} className="mt-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-2 text-xs font-black text-white hover:bg-emerald-800 sm:h-10 sm:gap-2 sm:px-4 sm:text-sm">
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3 xl:grid-cols-5">
              <div className="col-span-2 rounded-xl border border-slate-200 bg-white p-2 sm:col-span-1 sm:p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-slate-500 sm:text-xs">Rides</p>
                <p className="mt-1 text-lg font-black text-slate-950 sm:text-2xl">{reportSummary.rideCount}</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-2 sm:p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-blue-700 sm:text-xs">Fares</p>
                <p className="mt-1 text-lg font-black text-blue-950 sm:text-2xl">{formatRideCurrency(reportSummary.fare)}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 sm:p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-amber-700 sm:text-xs">Fees</p>
                <p className="mt-1 text-lg font-black text-amber-950 sm:text-2xl">{formatRideCurrency(reportSummary.fees)}</p>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-2 sm:p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-violet-700 sm:text-xs">Tips</p>
                <p className="mt-1 text-lg font-black text-violet-950 sm:text-2xl">{formatRideCurrency(reportSummary.tip)}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 sm:p-3">
                <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700 sm:text-xs">Total</p>
                <p className="mt-1 text-lg font-black text-emerald-950 sm:text-2xl">{formatRideCurrency(reportSummary.total)}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm sm:rounded-2xl">
        <div className="flex flex-row items-center justify-between gap-2 border-b border-slate-200 p-2.5 sm:p-4">
          <div>
            <h2 className="text-base font-black text-slate-900 sm:text-lg">Ride List</h2>
            <p className="text-xs text-slate-600 sm:text-sm">
              {filteredRides.length} ride{filteredRides.length === 1 ? '' : 's'} shown
            </p>
          </div>
          {searchQuery && (
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              <Search className="h-3.5 w-3.5" />
              Filtered by search
            </div>
          )}
        </div>

        {filteredRides.length === 0 ? (
          <div className="p-5 text-center text-sm font-semibold text-slate-500 sm:p-8">
            No rides saved yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {Object.entries(groupedRides).map(([dateKey, dateRides]) => (
              <div key={dateKey} className="p-2.5 sm:p-4">
                <div className="mb-2 flex items-center gap-1.5 text-slate-900 sm:mb-3 sm:gap-2">
                  <CalendarDays className="h-4 w-4 text-blue-700 sm:h-5 sm:w-5" />
                  <h3 className="text-sm font-black sm:text-base">{formatDateForDisplay(dateKey)}</h3>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  {dateRides.map((ride) => {
                    const isExpanded = expandedRideIds[ride.id] !== false;
                    const pastRide = isPastRide(ride);
                    const rideFinancials = getRideFinancials(ride);

                    return (
                      <article key={ride.id} className="rounded-lg border border-slate-200 bg-slate-50 sm:rounded-xl">
                        <div className="flex flex-col gap-2 p-2.5 sm:p-4 md:flex-row md:items-start md:justify-between">
                          <button
                            type="button"
                            onClick={() => setExpandedRideIds((current) => ({ ...current, [ride.id]: !isExpanded }))}
                            className="text-left"
                          >
                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-black text-blue-800 sm:px-3 sm:py-1 sm:text-xs">
                                Confirmation #{ride.confirmationNumber || 'N/A'}
                              </span>
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-black text-green-800 sm:px-3 sm:py-1 sm:text-xs">
                                {ride.status || 'Status unknown'}
                              </span>
                              {ride.provider && (
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-black text-slate-700 sm:px-3 sm:py-1 sm:text-xs">
                                  {ride.provider}
                                </span>
                              )}
                              {(rideFinancials.total > 0 || ride.sourceType) && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black text-emerald-800 sm:px-3 sm:py-1 sm:text-xs">
                                  Total {formatRideCurrency(rideFinancials.total)}
                                </span>
                              )}
                              {rideFinancials.tip > 0 && (
                                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-black text-violet-800 sm:px-3 sm:py-1 sm:text-xs">
                                  Tip {formatRideCurrency(rideFinancials.tip)}
                                </span>
                              )}
                            </div>
                            <p className="mt-1.5 text-xs font-bold text-slate-900 sm:mt-2 sm:text-sm">
                              {ride.riderName}, {ride.legs.length} leg{ride.legs.length === 1 ? '' : 's'}
                            </p>
                          </button>

                          <div className="grid w-full grid-cols-2 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:gap-2">
                            <button
                              type="button"
                              onClick={() => addRideToGoogleCalendar(ride)}
                              disabled={calendarAddingRideId === ride.id}
                              className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm ${
                                calendarAddedIds.includes(ride.id) || ride.googleCalendarEventId
                                  ? 'bg-blue-700'
                                  : 'bg-blue-600'
                              }`}
                              title={calendarAddedIds.includes(ride.id) || ride.googleCalendarEventId ? 'Added to Google Calendar' : 'Add to Google Calendar'}
                              aria-label="Add ride to Google Calendar"
                            >
                              {calendarAddedIds.includes(ride.id) || ride.googleCalendarEventId ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                <CalendarPlus className="h-4 w-4" />
                              )}
                              Calendar
                            </button>

                            <button
                              type="button"
                              onClick={() => startEditRide(ride)}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => duplicateRide(ride)}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-50 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
                            >
                              <Copy className="h-4 w-4" />
                              Copy
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteRide(ride.id)}
                              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-2 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="space-y-2 border-t border-slate-200 p-2.5 sm:space-y-3 sm:p-4">
                            {pastRide && (
                              <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:p-3">
                                <div>
                                  <p className="text-sm font-black text-amber-950">Past ride</p>
                                  <p className="text-sm font-semibold text-amber-900">Review it, then mark complete to move it to the archive.</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => archiveRide(ride.id)}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-bold text-white hover:bg-green-700"
                                >
                                  <Archive className="h-4 w-4" />
                                  Mark Complete
                                </button>
                              </div>
                            )}

                            {!pastRide && (
                              <div className="flex justify-end">
                                <button
                                  type="button"
                                  onClick={() => archiveRide(ride.id)}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-bold text-green-700 hover:bg-green-50"
                                >
                                  <Archive className="h-4 w-4" />
                                  Mark Complete
                                </button>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
                              <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 sm:rounded-xl sm:p-3">
                                <p className="text-[10px] font-black uppercase tracking-wide text-blue-700 sm:text-xs">Fare</p>
                                <p className="mt-0.5 text-base font-black text-blue-950 sm:mt-1 sm:text-lg">{formatRideCurrency(rideFinancials.fare)}</p>
                              </div>
                              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 sm:rounded-xl sm:p-3">
                                <p className="text-[10px] font-black uppercase tracking-wide text-amber-700 sm:text-xs">Fees</p>
                                <p className="mt-0.5 text-base font-black text-amber-950 sm:mt-1 sm:text-lg">{formatRideCurrency(rideFinancials.fees)}</p>
                              </div>
                              <div className="rounded-lg border border-violet-200 bg-violet-50 p-2 sm:rounded-xl sm:p-3">
                                <p className="text-[10px] font-black uppercase tracking-wide text-violet-700 sm:text-xs">Tip</p>
                                <p className="mt-0.5 text-base font-black text-violet-950 sm:mt-1 sm:text-lg">{formatRideCurrency(rideFinancials.tip)}</p>
                              </div>
                              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 sm:rounded-xl sm:p-3">
                                <p className="text-[10px] font-black uppercase tracking-wide text-emerald-700 sm:text-xs">Total</p>
                                <p className="mt-0.5 text-base font-black text-emerald-950 sm:mt-1 sm:text-lg">{formatRideCurrency(rideFinancials.total)}</p>
                              </div>
                            </div>

                            {ride.legs.map((leg) => (
                              <div key={leg.id} className="rounded-lg border border-slate-200 bg-white p-2.5 sm:rounded-xl sm:p-4">
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 sm:mb-3">
                                  <h4 className="text-sm font-black text-slate-900 sm:text-base">{leg.leg}</h4>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-700 sm:px-3 sm:py-1 sm:text-xs">
                                    {leg.status || ride.status || 'Status unknown'}
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
                                  <div className="rounded-lg bg-blue-50 p-2 sm:p-3">
                                    <div className="flex items-center gap-2 text-xs font-black uppercase text-blue-700">
                                      <Clock className="h-4 w-4" />
                                      Pickup
                                    </div>
                                    <p className="mt-0.5 text-sm font-bold text-slate-900 sm:mt-1 sm:text-base">{leg.pickupTime || 'N/A'}</p>
                                    {leg.pickupWindow && <p className="text-xs text-slate-600 sm:text-sm">Window: {leg.pickupWindow}</p>}
                                  </div>

                                  <div className="rounded-lg bg-purple-50 p-2 sm:p-3">
                                    <div className="text-xs font-black uppercase text-purple-700">Appointment</div>
                                    <p className="mt-0.5 text-sm font-bold text-slate-900 sm:mt-1 sm:text-base">{leg.appointmentTime || 'N/A'}</p>
                                  </div>

                                  <div className="col-span-2 rounded-lg bg-green-50 p-2 md:col-span-1 sm:p-3">
                                    <div className="text-xs font-black uppercase text-green-700">Provider</div>
                                    <p className="mt-0.5 text-sm font-bold text-slate-900 sm:mt-1 sm:text-base">{leg.provider || ride.provider || 'N/A'}</p>
                                  </div>
                                </div>

                                <div className="mt-2 grid gap-2 sm:mt-4 sm:gap-3 md:grid-cols-2">
                                  <div className="rounded-lg border border-slate-200 p-2 sm:p-3">
                                    <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-600">
                                      <MapPin className="h-4 w-4" />
                                      Pick Up
                                    </div>
                                    <p className="mt-0.5 text-sm font-bold text-slate-900 sm:mt-1 sm:text-base">{leg.pickupName || 'N/A'}</p>
                                    <p className="text-xs leading-4 text-slate-600 sm:text-sm">{leg.pickupAddress || 'Address not listed'}</p>
                                    {leg.pickupPhone && (
                                      <a
                                        href={`tel:${leg.pickupPhone}`}
                                        className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 hover:underline sm:mt-2 sm:text-sm"
                                      >
                                        <Phone className="h-3.5 w-3.5" />
                                        {leg.pickupPhone}
                                      </a>
                                    )}
                                  </div>

                                  <div className="rounded-lg border border-slate-200 p-2 sm:p-3">
                                    <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-600">
                                      <MapPin className="h-4 w-4" />
                                      Drop Off
                                    </div>
                                    <p className="mt-0.5 text-sm font-bold text-slate-900 sm:mt-1 sm:text-base">{leg.dropoffName || 'N/A'}</p>
                                    <p className="text-xs leading-4 text-slate-600 sm:text-sm">{leg.dropoffAddress || 'Address not listed'}</p>
                                    {leg.dropoffPhone && (
                                      <a
                                        href={`tel:${leg.dropoffPhone}`}
                                        className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-800 hover:underline sm:mt-2 sm:text-sm"
                                      >
                                        <Phone className="h-3.5 w-3.5" />
                                        {leg.dropoffPhone}
                                      </a>
                                    )}
                                  </div>
                                </div>

                                {leg.notes && (
                                  <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-900 sm:mt-3 sm:px-3 sm:py-2 sm:text-sm">
                                    {leg.notes}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editingRide && (
        <div className="fixed inset-0 z-[9998]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setEditingRide(null)}
            aria-label="Close Ride Editor"
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 sm:px-5 sm:py-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 sm:text-xl">Edit Ride</h2>
                <p className="text-xs leading-4 text-slate-600 sm:text-sm">Update ride details, leg times, locations, phone numbers, provider, and notes.</p>
              </div>
              <CloseScreenButton onClick={() => setEditingRide(null)} />
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-5">
              <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                <label className="text-sm font-bold text-slate-700">
                  Ride Date
                  <input
                    type="date"
                    value={editingRide.rideDate || ''}
                    onChange={(event) => updateEditingRideField('rideDate', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Rider
                  <input
                    value={editingRide.riderName || ''}
                    onChange={(event) => updateEditingRideField('riderName', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Confirmation / Receipt #
                  <input
                    value={editingRide.confirmationNumber || ''}
                    onChange={(event) => updateEditingRideField('confirmationNumber', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Provider
                  <input
                    value={editingRide.provider || ''}
                    onChange={(event) => updateEditingRideField('provider', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Status
                  <select
                    value={editingRide.status || ''}
                    onChange={(event) => updateEditingRideField('status', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Status unknown</option>
                    {RIDE_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Fare
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingRide.fareAmount ?? 0}
                    onChange={(event) => updateEditingRideField('fareAmount', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Tip
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingRide.tipAmount ?? 0}
                    onChange={(event) => updateEditingRideField('tipAmount', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Fees
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingRide.feeAmount ?? 0}
                    onChange={(event) => updateEditingRideField('feeAmount', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="text-sm font-bold text-slate-700">
                  Total
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editingRide.totalAmount ?? 0}
                    onChange={(event) => updateEditingRideField('totalAmount', event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>

                <label className="md:col-span-2 text-sm font-bold text-slate-700">
                  Ride Notes
                  <textarea
                    value={editingRide.notes || ''}
                    onChange={(event) => updateEditingRideField('notes', event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2 sm:mt-6 sm:gap-3">
                <h3 className="text-base font-black text-slate-900 sm:text-lg">Ride Legs</h3>
                <button
                  type="button"
                  onClick={addLegToEditingRide}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Leg
                </button>
              </div>

              <div className="mt-2 space-y-3 sm:mt-3 sm:space-y-4">
                {editingRide.legs.map((leg, index) => (
                  <div key={leg.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:rounded-xl sm:p-4">
                    <div className="mb-2 flex items-center justify-between gap-2 sm:mb-3 sm:gap-3">
                      <h4 className="text-base font-black text-slate-900">Leg {index + 1}</h4>
                      <button
                        type="button"
                        onClick={() => deleteLegFromEditingRide(leg.id)}
                        disabled={editingRide.legs.length <= 1}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Leg
                      </button>
                    </div>

                    <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
                      <label className="text-sm font-bold text-slate-700">
                        Leg Label
                        <input
                          value={leg.leg || ''}
                          onChange={(event) => updateEditingLegField(leg.id, 'leg', event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="text-sm font-bold text-slate-700">
                        Status
                        <select
                          value={leg.status || ''}
                          onChange={(event) => updateEditingLegField(leg.id, 'status', event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">Status unknown</option>
                          {LEG_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="text-sm font-bold text-slate-700">
                        Provider
                        <input
                          value={leg.provider || ''}
                          onChange={(event) => updateEditingLegField(leg.id, 'provider', event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="text-sm font-bold text-slate-700">
                        Pickup Time
                        <input
                          value={leg.pickupTime || ''}
                          onChange={(event) => updateEditingLegField(leg.id, 'pickupTime', event.target.value)}
                          placeholder="1:35 PM or Request Pickup"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="text-sm font-bold text-slate-700">
                        Appointment / Dropoff Time
                        <input
                          value={leg.appointmentTime || ''}
                          onChange={(event) => updateEditingLegField(leg.id, 'appointmentTime', event.target.value)}
                          placeholder="2:00 PM, None, or dropoff time"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="text-sm font-bold text-slate-700">
                        Pickup Window
                        <input
                          value={leg.pickupWindow || ''}
                          onChange={(event) => updateEditingLegField(leg.id, 'pickupWindow', event.target.value)}
                          placeholder="1:20 PM - 1:50 PM"
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="text-sm font-bold text-slate-700">
                        Pickup Name
                        <input
                          value={leg.pickupName || ''}
                          onChange={(event) => updateEditingLegField(leg.id, 'pickupName', event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="md:col-span-2 text-sm font-bold text-slate-700">
                        Pickup Address
                        <input
                          value={leg.pickupAddress || ''}
                          onChange={(event) => updateEditingLegField(leg.id, 'pickupAddress', event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="text-sm font-bold text-slate-700">
                        Dropoff Name
                        <input
                          value={leg.dropoffName || ''}
                          onChange={(event) => updateEditingLegField(leg.id, 'dropoffName', event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <label className="md:col-span-2 text-sm font-bold text-slate-700">
                        Dropoff Address
                        <input
                          value={leg.dropoffAddress || ''}
                          onChange={(event) => updateEditingLegField(leg.id, 'dropoffAddress', event.target.value)}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>

                      <div className="grid gap-3 sm:gap-4 md:col-span-3 md:grid-cols-2">
                        <label className="text-sm font-bold text-slate-700">
                          Pick Up Phone Number
                          <input
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            value={leg.pickupPhone || ''}
                            onChange={(event) => updateEditingLegField(leg.id, 'pickupPhone', formatPhoneInput(event.target.value))}
                            placeholder="(213) 555-1234"
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </label>

                        <label className="text-sm font-bold text-slate-700">
                          Drop Off Phone Number
                          <input
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            value={leg.dropoffPhone || ''}
                            onChange={(event) => updateEditingLegField(leg.id, 'dropoffPhone', formatPhoneInput(event.target.value))}
                            placeholder="(213) 555-1234"
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </label>
                      </div>

                      <label className="md:col-span-3 text-sm font-bold text-slate-700">
                        Leg Notes
                        <textarea
                          value={leg.notes || ''}
                          onChange={(event) => updateEditingLegField(leg.id, 'notes', event.target.value)}
                          rows={2}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <label className="mt-3 block text-sm font-bold text-slate-700 sm:mt-5">
                Original Scan Text
                <textarea
                  value={editingRide.sourceText || ''}
                  onChange={(event) => updateEditingRideField('sourceText', event.target.value)}
                  rows={5}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-3 py-2.5 sm:px-5 sm:py-4">
              <button
                type="button"
                onClick={() => setEditingRide(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditedRide}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
              >
                <Check className="h-4 w-4" />
                Save Changes
              </button>
            </div>
          </aside>
        </div>
      )}

      {isArchiveOpen && (
        <div className="fixed inset-0 z-[9998]">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setIsArchiveOpen(false)}
            aria-label="Close Rides Archive"
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 sm:px-5 sm:py-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 sm:text-xl">Rides Archive</h2>
                <p className="text-xs text-slate-600 sm:text-sm">{archivedRides.length} completed ride{archivedRides.length === 1 ? '' : 's'}</p>
              </div>
              <CloseScreenButton onClick={() => setIsArchiveOpen(false)} />
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-5">
              {archivedRides.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm font-semibold text-slate-500 sm:p-8">
                  No completed rides archived yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {sortRides(archivedRides).map((ride) => (
                    <article key={ride.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-black text-slate-700">
                              {formatDateForDisplay(ride.rideDate)}
                            </span>
                            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-black text-green-800">
                              {ride.status || 'Completed'}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-bold text-slate-900">
                            Confirmation #{ride.confirmationNumber || 'N/A'} · {ride.legs.length} leg{ride.legs.length === 1 ? '' : 's'}
                          </p>
                          <p className="text-sm text-slate-600">{ride.provider || 'Provider not listed'}</p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => restoreRide(ride.id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-50"
                          >
                            <RotateCcw className="h-4 w-4" />
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteArchivedRide(ride.id)}
                            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {ride.legs.map((leg) => (
                          <div key={leg.id} className="rounded-lg bg-white p-3 text-sm">
                            <p className="font-black text-slate-900">{leg.leg}</p>
                            <p className="text-slate-700">
                              Pickup: {leg.pickupTime || 'N/A'}{leg.pickupWindow ? `, window ${leg.pickupWindow}` : ''}
                            </p>
                            <p className="text-slate-600">
                              {leg.pickupName || 'N/A'} to {leg.dropoffName || 'N/A'}
                            </p>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {showPremiumRidesView && (
        <PremiumRidesListView
          rides={filteredRides}
          onClose={() => setShowPremiumRidesView(false)}
        />
      )}
    </PageContainer>
  );
};

export default RidesTab;
