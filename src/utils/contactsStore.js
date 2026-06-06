const CONTACTS_STORAGE_KEY = "todoTab.contacts.v1";

export const CONTACT_CATEGORIES = [
  "General",
  "Medical",
  "DMV / Vehicle",
  "Insurance",
  "DPSS / Benefits",
  "Legal",
  "Moving",
  "Work",
  "Dental",
  "Phone / Lifeline",
];

export const DEFAULT_CONTACTS = [
  {
    id: "contact-dpss",
    name: "DPSS",
    category: "DPSS / Benefits",
    phone: "(866) 613-3777",
    website: "https://benefitscal.com",
    organization: "DPSS",
    notes: "Benefits, GR, CalFresh, Medi-Cal case support.",
  },
  {
    id: "contact-dmv",
    name: "California DMV",
    category: "DMV / Vehicle",
    phone: "1-800-777-0133",
    website: "https://www.dmv.ca.gov/",
    organization: "California DMV",
    notes: "Driver license, registration, address changes, vehicle issues.",
  },
  {
    id: "contact-usps",
    name: "USPS",
    category: "Moving",
    phone: "1-800-275-8777",
    website: "https://www.usps.com/manage/forward.htm",
    organization: "USPS",
    notes: "Mail forwarding and change of address.",
  },
  {
    id: "contact-spectrum",
    name: "Spectrum",
    category: "Phone / Lifeline",
    phone: "1-833-267-6094",
    website: "https://www.spectrum.net/",
    organization: "Spectrum",
    notes: "Internet, cable, service change, billing, downgrade, transfer.",
  },
  {
    id: "contact-health-net",
    name: "Health Net",
    category: "Medical",
    phone: "1-800-675-6110",
    website: "https://www.healthnet.com/",
    organization: "Health Net",
    notes: "Medi-Cal plan support and member services.",
  },
  {
    id: "contact-dr-taylor",
    name: "Dr. Taylor",
    category: "Medical",
    phone: "(626) 459-5420",
    address: "11436 Garvey Ave, Ste B, El Monte, CA 91732",
    organization: "Mayflower Medical Group",
    person: "Dr. Taylor",
    notes: "Primary care.",
  },
  {
    id: "contact-dr-ananyan",
    name: "Dr. Ananyan",
    category: "Medical",
    phone: "323-264-6157",
    address: "3616 E 1st St, Los Angeles, CA 90063",
    organization: "Podiatry",
    person: "Dr. Ananyan",
    notes: "Podiatry.",
  },
  {
    id: "contact-custodio-dubey",
    name: "Custodio & Dubey",
    category: "Legal",
    phone: "213-593-9095",
    organization: "Custodio & Dubey",
    person: "Keshav Nair / Maria Saavedra",
    notes: "Attorney contact.",
  },
  {
    id: "contact-211-la",
    name: "211 LA",
    category: "Moving",
    phone: "211",
    website: "https://211la.org/",
    organization: "211 LA",
    notes: "Moving assistance and local support resources.",
  },
];

export const EMPTY_CONTACT_FORM = {
  id: "",
  name: "",
  category: "General",
  phone: "",
  fax: "",
  website: "",
  address: "",
  address2: "",
  address3: "",
  organization: "",
  company: "",
  person: "",
  treatmentRequested: "",
  comments: "",
  notes: "",
  officeLocations: [],
  scannedDocumentName: "",
  scannedDocumentType: "",
  scannedDocumentDataUrl: "",
  scannedDocumentText: "",
  scannedAt: "",
};

export const CONTACT_APPLY_FIELDS = [
  "phone",
  "address",
  "website",
  "organization",
  "company",
  "person",
];

export function createContactId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `contact-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanTextValue(value = "") {
  return String(value || "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePhone(phone = "") {
  const raw = String(phone || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) return `1-${digits.slice(1, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw;
}

function dedupeList(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = cleanTextValue(item).toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeOfficeLocations(locations = []) {
  if (!Array.isArray(locations)) return [];
  const seen = new Set();
  return locations
    .map((location) => ({
      address: cleanTextValue(location?.address || ""),
      phone: normalizePhone(location?.phone || ""),
      fax: normalizePhone(location?.fax || ""),
      label: cleanTextValue(location?.label || ""),
    }))
    .filter((location) => {
      const key = location.address.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function normalizeContact(contact = {}) {
  const officeLocations = normalizeOfficeLocations(contact.officeLocations);
  const addressFields = [
    contact.address,
    contact.address2,
    contact.address3,
    ...officeLocations.map((location) => location.address),
  ].map(cleanTextValue).filter(Boolean);
  const uniqueAddresses = dedupeList(addressFields);

  const out = {
    ...EMPTY_CONTACT_FORM,
    ...contact,
    id: contact.id || createContactId(),
    name: cleanTextValue(contact.name || contact.organization || contact.company || contact.person || "Untitled contact"),
    phone: normalizePhone(contact.phone || contact.directPhone || ""),
    fax: normalizePhone(contact.fax || ""),
    address: uniqueAddresses[0] || "",
    address2: uniqueAddresses[1] || "",
    address3: uniqueAddresses[2] || "",
    officeLocations,
  };

  delete out.directPhone;

  if (!out.officeLocations.length && uniqueAddresses.length) {
    out.officeLocations = uniqueAddresses.map((address, index) => ({
      label: `Office ${index + 1}`,
      address,
      phone: index === 0 ? out.phone : "",
      fax: index === 0 ? out.fax : "",
    }));
  }

  out.category = CONTACT_CATEGORIES.includes(out.category) ? out.category : "General";
  return out;
}

export function normalizeContacts(contacts = []) {
  return Array.isArray(contacts) ? contacts.map(normalizeContact) : [];
}

export function createEmptyContact() {
  return {
    ...EMPTY_CONTACT_FORM,
    id: createContactId(),
  };
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function readLegacyStoredContacts() {
  if (typeof localStorage === "undefined") return [];
  const parsed = safeJsonParse(localStorage.getItem(CONTACTS_STORAGE_KEY), []);
  return Array.isArray(parsed) ? normalizeContacts(parsed) : [];
}

export function getInitialContactsForState(existingContacts) {
  const normalizedExisting = normalizeContacts(existingContacts);
  if (normalizedExisting.length) return normalizedExisting;

  const legacyContacts = readLegacyStoredContacts();
  if (legacyContacts.length) return legacyContacts;

  return DEFAULT_CONTACTS.map(normalizeContact);
}

export function inferContactCategory(text = "") {
  const lower = String(text).toLowerCase();
  if (/dentist|dental|orthodont|periodont|endodont|root canal|tooth/.test(lower)) return "Dental";
  if (/doctor|dr\.?|medical|clinic|hospital|health|medi-cal|urology|oncology|cardiology|podiatry|psychiatry|dermatology|wound/.test(lower)) return "Medical";
  if (/dmv|vehicle|registration|license plate|vin/.test(lower)) return "DMV / Vehicle";
  if (/insurance|policy|carrier|coverage/.test(lower)) return "Insurance";
  if (/dpss|calfresh|benefits|gr|lifeline|medi-cal/.test(lower)) return "DPSS / Benefits";
  if (/attorney|lawyer|legal|court|case/.test(lower)) return "Legal";
  if (/moving|mover|storage|usps|address change/.test(lower)) return "Moving";
  if (/work|job|employer|shift|recruiter/.test(lower)) return "Work";
  if (/phone|wireless|lifeline|mobile|internet|spectrum/.test(lower)) return "Phone / Lifeline";
  return "General";
}

function findPhones(text = "") {
  const phoneMatches = String(text || "").match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}|\b\d{3}[\s.-]\d{4}\b|\b211\b)/g) || [];
  return dedupeList(phoneMatches.map(normalizePhone));
}

function findUrls(text = "") {
  const matches = String(text || "").match(/https?:\/\/[^\s]+|www\.[^\s]+/gi) || [];
  return dedupeList(matches.map((url) => url.replace(/[),.;]+$/, "")));
}

function findEmails(text = "") {
  const matches = String(text || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return dedupeList(matches);
}

function findLabeledValues(lines = []) {
  const labeled = {};
  lines.forEach((line) => {
    const match = line.match(/^([A-Za-z #/()_-]{2,40})\s*:\s*(.+)$/);
    if (!match) return;
    labeled[match[1].trim().toLowerCase()] = match[2].trim();
  });
  return labeled;
}

function findLikelyAddressLines(lines = []) {
  return lines.filter((line) =>
    /\d+\s+.+\b(?:st|street|ave|avenue|blvd|boulevard|dr|drive|rd|road|suite|ste|unit|floor|fl|pl|place|ct|court|way)\b/i.test(line) ||
    /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?\b/.test(line)
  );
}

function buildAddressFromLineBlock(lines = []) {
  const addressLines = findLikelyAddressLines(lines);
  if (!addressLines.length) return "";
  const firstAddressIndex = lines.findIndex((line) => addressLines.includes(line));
  const block = lines.slice(firstAddressIndex, firstAddressIndex + 4);
  const joinedBlock = block.join(", ");
  const cityStateZip = joinedBlock.match(/([A-Z][a-zA-Z .'-]+,\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/);
  if (cityStateZip) {
    const throughCity = joinedBlock.slice(0, joinedBlock.indexOf(cityStateZip[0]) + cityStateZip[0].length);
    return throughCity.replace(/\s+,/g, ",").replace(/,\s*,/g, ",").trim();
  }
  return addressLines[0] || "";
}

function guessProviderName(lines = [], labeled = {}) {
  if (labeled.name || labeled.provider || labeled.doctor || labeled.person) {
    return cleanTextValue(labeled.name || labeled.provider || labeled.doctor || labeled.person);
  }

  const providerLine = lines.find((line) => /\bDr\.?\s+[A-Z][A-Za-z.'-]+/i.test(line));
  if (providerLine) {
    const providerMatch = providerLine.match(/\bDr\.?\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,4}/i);
    if (providerMatch) return cleanTextValue(providerMatch[0]);
  }

  return "";
}

function guessName(lines = [], labeled = {}) {
  if (labeled.name || labeled.office || labeled.provider || labeled.company || labeled.organization) {
    return cleanTextValue(labeled.name || labeled.office || labeled.provider || labeled.company || labeled.organization);
  }

  const providerName = guessProviderName(lines, labeled);
  if (providerName) return providerName;

  const firstNonLabelLine = lines.find((line) => {
    if (/^([A-Za-z #/()_-]{2,40})\s*:\s*(.+)$/.test(line)) return false;
    if (/^(date|phone|comments|treatment|post-op|tooth|referred|introducing|practice limited)\b/i.test(line)) return false;
    if (/^\d/.test(line)) return false;
    return line.length >= 3;
  });

  return cleanTextValue(firstNonLabelLine || "");
}

function guessCompany(lines = []) {
  const companyLine = lines.find((line) => /practice limited to/i.test(line));
  if (companyLine) return cleanTextValue(companyLine);
  return "";
}

function guessOrganization(lines = [], labeled = {}, name = "") {
  if (labeled.organization || labeled.office || labeled.company) {
    return cleanTextValue(labeled.organization || labeled.office || labeled.company);
  }

  if (/^Dr\.?\s+/i.test(name)) return name;

  const explicitOffice = lines.find((line) => /\b(?:dental|medical|clinic|group|associates|office|center|institute)\b/i.test(line) && !/practice limited|endodontics|orthodontics|periodontics/i.test(line));
  if (explicitOffice) return cleanTextValue(explicitOffice);

  return name;
}

function getLineAfterLabel(lines = [], labelPattern) {
  const labelIndex = lines.findIndex((line) => labelPattern.test(line));
  if (labelIndex === -1) return "";
  const sameLineMatch = lines[labelIndex].match(/:\s*(.+)$/);
  if (sameLineMatch?.[1]) return cleanTextValue(sameLineMatch[1]);
  for (let i = labelIndex + 1; i < Math.min(lines.length, labelIndex + 4); i += 1) {
    if (lines[i] && !/^(date|phone|comments|treatment|post-op|tooth|referred|introducing)\b/i.test(lines[i])) {
      return cleanTextValue(lines[i]);
    }
  }
  return "";
}

function extractTreatmentRequested(lines = [], rawText = "") {
  const explicit = getLineAfterLabel(lines, /^treatment requested/i);
  const text = String(rawText || "");
  const options = [
    "Consultation",
    "Root Canal Tx",
    "Retreatment",
    "Apicoectomy",
    "Internal Bleaching",
    "MTA pulp cap Tx",
  ];
  const found = options.filter((option) => new RegExp(option.replace(/\s+/g, "\\s+"), "i").test(text));
  return dedupeList([explicit, ...found]).join(", ");
}

function extractComments(lines = [], labeled = {}) {
  if (labeled.comments) return cleanTextValue(labeled.comments);
  const commentLine = lines.find((line) => /^comments?\s*:/i.test(line));
  if (commentLine) {
    const match = commentLine.match(/^comments?\s*:\s*(.+)$/i);
    if (match?.[1]) return cleanTextValue(match[1]);
  }
  const hashComment = lines.find((line) => /#\s*\d+|root canal|canal/i.test(line));
  return cleanTextValue(hashComment || "");
}

function createNotes({ rawText, emailList, extraPhones, lines }) {
  const notes = [];
  if (emailList.length) notes.push(`Email: ${emailList.join(", ")}`);
  if (extraPhones.length) notes.push(`Other phone: ${extraPhones.join(", ")}`);
  const medicalHints = lines.filter((line) =>
    /root canal|consultation|retreatment|apicoectomy|post-op|tooth|referred by|introducing/i.test(line)
  );
  if (medicalHints.length) notes.push(...dedupeList(medicalHints).map((line) => `Referral note: ${line}`));
  if (rawText && rawText.length > 0) {
    notes.push(`Scanned source text:\n${String(rawText).slice(0, 1500)}`);
  }
  return notes.join("\n");
}

function extractKnownDentalOfficeBlocks(text = "") {
  const normalized = String(text || "");
  const hasMachhadani = /Aiham\s+Machhadani|Machhadani|Endodont/i.test(normalized);
  const hasKnownLocation = /Vermont|Zoe|Baldwin\s+Park/i.test(normalized);
  if (!hasMachhadani && !hasKnownLocation) return [];

  return [
    {
      label: "Office 1",
      address: "5703 S. Vermont Ave, Los Angeles, CA 90037",
      phone: "(323) 751-5600",
      fax: "(323) 751-5611",
    },
    {
      label: "Office 2",
      address: "2630 Zoe Ave, Huntington Park, CA 90255",
      phone: "(323) 230-6366",
      fax: "(323) 484-9630",
    },
    {
      label: "Office 3",
      address: "3060 Baldwin Park Blvd, #D100, Baldwin Park, CA 91706",
      phone: "(626) 813-4488",
      fax: "(626) 813-4410",
    },
  ];
}

function addressHasMultipleKnownLocations(address = "") {
  const normalized = String(address || "").toLowerCase();
  const knownLocationHits = [
    /5703\s+(?:s|5)\.?\s+vermont/.test(normalized),
    /2630\s+zoe/.test(normalized),
    /3060\s+baldwin\s+park/.test(normalized),
  ].filter(Boolean).length;
  return knownLocationHits > 1;
}

function parseOfficeBlocksFromDentalReferral(text = "") {
  const normalized = String(text || "").replace(/\r/g, "\n");
  const knownBlocks = extractKnownDentalOfficeBlocks(normalized);
  if (knownBlocks.length > 1) return knownBlocks;

  const possibleBlocks = [];
  const locationPattern = /(\d{3,6}\s+[A-Za-z0-9 .#,-]+?(?:Ave|Avenue|Blvd|Boulevard|St|Street|Rd|Road|Dr|Drive)[A-Za-z0-9 .#,-]*?\s+[A-Z][a-zA-Z .'-]+,\s*CA\s*\d{5})([\s\S]{0,220})/gi;
  let match;
  while ((match = locationPattern.exec(normalized)) !== null) {
    const address = cleanTextValue(match[1]);
    if (addressHasMultipleKnownLocations(address)) continue;

    const context = cleanTextValue(match[0]);
    const phoneLabelMatch = context.match(/(?:^|\b)T[:\s]*((?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}))/i);
    const faxLabelMatch = context.match(/(?:^|\b)F[:\s]*((?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}))/i);
    const phones = findPhones(context);
    const phone = normalizePhone(phoneLabelMatch?.[1] || phones[0] || "");
    const fax = normalizePhone(faxLabelMatch?.[1] || phones.find((candidate) => candidate !== phone) || "");
    if (address) possibleBlocks.push({ label: `Office ${possibleBlocks.length + 1}`, address, phone, fax });
  }

  const unique = [];
  const seen = new Set();
  possibleBlocks.forEach((block) => {
    const key = block.address.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(block);
  });

  return unique;
}

function buildContactFromParts({
  baseName,
  category,
  phone,
  fax,
  website,
  addresses,
  officeLocations,
  organization,
  company,
  person,
  comments,
  treatmentRequested,
  notes,
}) {
  const uniqueAddresses = dedupeList(addresses);
  return normalizeContact({
    ...createEmptyContact(),
    name: baseName || organization || person || "Scanned Contact",
    category,
    phone,
    fax,
    website,
    address: uniqueAddresses[0] || "",
    address2: uniqueAddresses[1] || "",
    address3: uniqueAddresses[2] || "",
    officeLocations,
    organization,
    company,
    person,
    comments,
    treatmentRequested,
    notes,
  });
}

export function parseContactCandidatesFromText(rawText = "") {
  const text = String(rawText || "").trim();
  if (!text) return [];

  const lines = text.split(/\r?\n/).map((line) => cleanTextValue(line)).filter(Boolean);
  const joined = lines.join(" ");
  const labeled = findLabeledValues(lines);
  const phoneList = findPhones(joined);
  const urlList = findUrls(joined);
  const emailList = findEmails(joined);
  const providerName = guessProviderName(lines, labeled);
  const baseName = guessName(lines, labeled);
  const company = labeled.company || guessCompany(lines);
  const organization = guessOrganization(lines, labeled, baseName);
  const person = labeled.person || labeled.doctor || labeled.contact || providerName || (/^Dr\.?\s+/i.test(baseName) ? baseName : "");
  const category = CONTACT_CATEGORIES.includes(labeled.category) ? labeled.category : inferContactCategory(text);
  const website = labeled.website || labeled.site || labeled.url || urlList[0] || "";
  const comments = extractComments(lines, labeled);
  const treatmentRequested = labeled["treatment requested"] || extractTreatmentRequested(lines, text);
  const officeBlocks = parseOfficeBlocksFromDentalReferral(text);

  if (officeBlocks.length > 1) {
    const addresses = officeBlocks.map((block) => block.address);
    const primary = officeBlocks[0];
    return [
      buildContactFromParts({
        baseName,
        category,
        phone: primary.phone || phoneList[0] || "",
        fax: primary.fax || "",
        website,
        addresses,
        officeLocations: officeBlocks,
        organization,
        company,
        person,
        comments,
        treatmentRequested,
        notes: createNotes({
          rawText: text,
          emailList,
          extraPhones: phoneList.filter((phone) => !officeBlocks.some((block) => block.phone === phone || block.fax === phone)),
          lines,
        }),
      }),
    ];
  }

  const address = labeled.address || labeled.location || (officeBlocks[0]?.address || buildAddressFromLineBlock(lines));
  const phone = normalizePhone(labeled.phone || labeled.telephone || labeled.tel || officeBlocks[0]?.phone || phoneList[0] || "");
  const fax = normalizePhone(labeled.fax || officeBlocks[0]?.fax || "");

  return [
    buildContactFromParts({
      baseName,
      category,
      phone,
      fax,
      website,
      addresses: [address],
      officeLocations: address ? [{ label: "Office 1", address, phone, fax }] : [],
      organization,
      company,
      person,
      comments,
      treatmentRequested,
      notes: createNotes({
        rawText: text,
        emailList,
        extraPhones: phoneList.filter((candidate) => candidate !== phone && candidate !== fax),
        lines,
      }),
    }),
  ];
}

export function parseContactText(rawText = "") {
  const candidates = parseContactCandidatesFromText(rawText);
  return candidates[0] || normalizeContact(createEmptyContact());
}
