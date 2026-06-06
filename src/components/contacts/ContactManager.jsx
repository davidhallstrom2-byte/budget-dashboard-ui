import React, { useState } from "react";
import { X } from "lucide-react";
import { parseContactCandidatesFromText, parseContactText } from "../../utils/contactsStore";

const NativeTextarea = ({ value, onChange, minRows = 2, maxRows = 8, className = "" }) => (
  <textarea
    value={value}
    onChange={(event) => onChange(event.target.value)}
    rows={minRows}
    className={className}
    style={{ minHeight: `${minRows * 1.5}rem`, maxHeight: `${maxRows * 1.5}rem` }}
  />
);

function loadScriptOnce(src, globalName) {
  return new Promise((resolve, reject) => {
    if (globalName && window[globalName]) {
      resolve(window[globalName]);
      return;
    }

    const existing = document.querySelector(`script[data-contact-scan-src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(globalName ? window[globalName] : true), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.contactScanSrc = src;
    script.onload = () => resolve(globalName ? window[globalName] : true);
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.appendChild(script);
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read file."));
    reader.readAsArrayBuffer(file);
  });
}

async function getTesseract() {
  return loadScriptOnce("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js", "Tesseract");
}

async function getPdfJs() {
  const pdfjsLib = await loadScriptOnce("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js", "pdfjsLib");
  if (pdfjsLib?.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }
  return pdfjsLib;
}

async function ocrImageDataUrl(dataUrl) {
  const Tesseract = await getTesseract();
  const result = await Tesseract.recognize(dataUrl, "eng");
  return result?.data?.text || "";
}

async function ocrPdfFile(file) {
  const [pdfjsLib, arrayBuffer] = await Promise.all([getPdfJs(), readFileAsArrayBuffer(file)]);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: context, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");
    const text = await ocrImageDataUrl(dataUrl);
    pageTexts.push(text);
  }

  return pageTexts.join("\n\n");
}

function joinAddressFields(contact = {}) {
  const officeLocations = getVisibleOfficeLocations(contact);
  if (officeLocations.length) {
    return officeLocations.map((location) => location.address).filter(Boolean).join("\n");
  }
  return [contact.address, contact.address2, contact.address3].filter(Boolean).join("\n");
}

function getOfficeLocationsForForm(contact = {}) {
  const currentLocations = Array.isArray(contact.officeLocations) ? contact.officeLocations : [];
  const fallbacks = [
    { label: "Office 1", address: contact.address || "", phone: contact.phone || "", fax: contact.fax || "" },
    { label: "Office 2", address: contact.address2 || "", phone: "", fax: "" },
    { label: "Office 3", address: contact.address3 || "", phone: "", fax: "" },
  ];

  return [0, 1, 2].map((index) => ({
    label: currentLocations[index]?.label || fallbacks[index].label,
    address: currentLocations[index]?.address || fallbacks[index].address,
    phone: currentLocations[index]?.phone || fallbacks[index].phone,
    fax: currentLocations[index]?.fax || fallbacks[index].fax,
  }));
}

function getVisibleOfficeLocations(contact = {}) {
  return getOfficeLocationsForForm(contact).filter(
    (location) => location.address || location.phone || location.fax
  );
}

function updateContactOfficeField(setContactForm, officeIndex, field, value) {
  setContactForm((current) => {
    const nextLocations = getOfficeLocationsForForm(current);
    nextLocations[officeIndex] = {
      ...nextLocations[officeIndex],
      [field]: value,
    };

    const next = {
      ...current,
      officeLocations: nextLocations.filter(
        (location) => location.address || location.phone || location.fax
      ),
    };

    if (officeIndex === 0) {
      if (field === "address") next.address = value;
      if (field === "phone") next.phone = value;
      if (field === "fax") next.fax = value;
    }
    if (officeIndex === 1 && field === "address") next.address2 = value;
    if (officeIndex === 2 && field === "address") next.address3 = value;

    return next;
  });
}

function applyScanMetadata(contact, metadata) {
  return {
    ...contact,
    scannedDocumentName: metadata.scannedDocumentName || contact.scannedDocumentName || "",
    scannedDocumentType: metadata.scannedDocumentType || contact.scannedDocumentType || "",
    scannedDocumentDataUrl: metadata.scannedDocumentDataUrl || contact.scannedDocumentDataUrl || "",
    scannedDocumentText: metadata.scannedDocumentText || contact.scannedDocumentText || "",
    scannedAt: metadata.scannedAt || contact.scannedAt || "",
  };
}

export default function ContactManager({
  isOpen,
  onClose,
  contactApplyTarget,
  selectedTask,
  contactForm,
  setContactForm,
  editingContactId,
  saveContact,
  resetContactForm,
  contactSearch,
  setContactSearch,
  replaceExistingContactFields,
  setReplaceExistingContactFields,
  filteredContacts,
  applyContactToTarget,
  editContact,
  deleteContact,
  taskTypes,
  AutoResizeTextarea = NativeTextarea,
}) {
  const [scanText, setScanText] = useState("");
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [scanError, setScanError] = useState("");
  const [scanCandidates, setScanCandidates] = useState([]);
  const [scanMetadata, setScanMetadata] = useState({
    scannedDocumentName: "",
    scannedDocumentType: "",
    scannedDocumentDataUrl: "",
    scannedDocumentText: "",
    scannedAt: "",
  });

  if (!isOpen) return null;

  const fillContactForm = (contact) => {
    const withMetadata = applyScanMetadata(contact, scanMetadata);
    setContactForm((current) => ({
      ...current,
      ...withMetadata,
      id: current.id || withMetadata.id,
      createdAt: current.createdAt || withMetadata.createdAt,
    }));
  };

  const scanContact = () => {
    const candidates = parseContactCandidatesFromText(scanText).map((candidate) => applyScanMetadata(candidate, {
      ...scanMetadata,
      scannedDocumentText: scanText || scanMetadata.scannedDocumentText,
      scannedAt: scanMetadata.scannedAt || new Date().toISOString(),
    }));

    if (!candidates.length) {
      const parsedContact = parseContactText(scanText);
      fillContactForm(parsedContact);
      setScanCandidates([]);
      setIsScanOpen(false);
      return;
    }

    setScanCandidates(candidates);
    fillContactForm(candidates[0]);
    setScanStatus(`Scan complete. Found ${candidates.length} contact candidate${candidates.length === 1 ? "" : "s"}.`);
  };

  const scanFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setScanError("");
    setScanStatus(`Scanning ${file.name}...`);
    setScanCandidates([]);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      let text = "";

      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        text = await ocrPdfFile(file);
      } else if (file.type.startsWith("image/")) {
        text = await ocrImageDataUrl(dataUrl);
      } else if (/\.txt$/i.test(file.name)) {
        text = await file.text();
      } else {
        throw new Error("Use an image, PDF, or text file.");
      }

      const metadata = {
        scannedDocumentName: file.name,
        scannedDocumentType: file.type || "application/octet-stream",
        scannedDocumentDataUrl: dataUrl,
        scannedDocumentText: text,
        scannedAt: new Date().toISOString(),
      };

      setScanMetadata(metadata);
      setScanText(text);

      const candidates = parseContactCandidatesFromText(text).map((candidate) => applyScanMetadata(candidate, metadata));
      setScanCandidates(candidates);
      if (candidates[0]) fillContactForm(candidates[0]);

      setScanStatus(`Scan complete. Found ${candidates.length} contact candidate${candidates.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setScanError(error?.message || "Scan failed.");
      setScanStatus("");
    } finally {
      event.target.value = "";
    }
  };

  const openScannedDocument = (contact = contactForm) => {
    if (!contact?.scannedDocumentDataUrl) return;
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;
    win.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${contact.scannedDocumentName || "Scanned document"}</title>
          <style>
            body { margin: 0; background: #0f172a; display: grid; place-items: center; min-height: 100vh; }
            iframe, img { width: 100vw; height: 100vh; border: 0; object-fit: contain; background: white; }
          </style>
        </head>
        <body>
          ${String(contact.scannedDocumentType || "").includes("pdf")
            ? `<iframe src="${contact.scannedDocumentDataUrl}"></iframe>`
            : `<img src="${contact.scannedDocumentDataUrl}" alt="Scanned document" />`}
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/50 px-4 py-4 backdrop-blur-sm sm:px-6">
      <div className="flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">Manage Contacts</h3>
            <p className="text-sm font-semibold text-slate-600">Add, edit, delete, search, scan, and use saved contacts.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close contacts"
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[390px_1fr]">
          <div className="overflow-y-auto border-r border-slate-200 px-4 py-5">
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-blue-900">
              {contactApplyTarget === "selectedTask" && selectedTask
                ? `Use applies to: ${selectedTask.taskName || "selected task"}`
                : "Use applies to the Add Task form."}
            </div>

            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-black text-blue-950">Scan Contact</div>
                  <div className="text-xs font-semibold text-blue-800">Upload an image/PDF or paste raw contact info, then review before saving.</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsScanOpen((current) => !current)}
                  className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800"
                >
                  {isScanOpen ? "Hide" : "Scan"}
                </button>
              </div>

              {isScanOpen && (
                <div className="mt-3 grid gap-2">
                  <label className="text-xs font-black text-blue-950">
                    Scan image/PDF
                    <input
                      type="file"
                      accept="image/*,.pdf,.txt"
                      onChange={scanFile}
                      className="mt-1 block w-full text-xs text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-700 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-blue-800"
                    />
                  </label>

                  {scanMetadata.scannedDocumentName && (
                    <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-900">
                      File: {scanMetadata.scannedDocumentName}
                    </div>
                  )}

                  <textarea
                    value={scanText}
                    onChange={(event) => setScanText(event.target.value)}
                    placeholder="Paste contact text, for example: Bhakta Dental&#10;Phone: (323) 235-5892&#10;Dentist"
                    rows={5}
                    className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
                  />

                  <button
                    type="button"
                    onClick={scanContact}
                    disabled={!scanText.trim()}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Fill Contact Form
                  </button>

                  {scanStatus && <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-900">{scanStatus}</div>}
                  {scanError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-900">{scanError}</div>}

                  {scanCandidates.length > 0 && (
                    <div className="mt-2 rounded-xl border border-blue-200 bg-white p-2">
                      <div className="mb-2 text-xs font-black uppercase tracking-wide text-blue-950">Detected Contacts</div>
                      <div className="grid gap-2">
                        {scanCandidates.map((candidate) => (
                          <button
                            key={candidate.id}
                            type="button"
                            onClick={() => fillContactForm(candidate)}
                            className="rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-blue-300 hover:bg-blue-50"
                          >
                            <div className="font-black text-slate-900">{candidate.name}</div>
                            <div className="text-sm font-semibold text-slate-700">
                              {candidate.phone}
                              {candidate.fax ? ` | Fax: ${candidate.fax}` : ""}
                            </div>
                            <div className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-700">{joinAddressFields(candidate)}</div>
                            {candidate.officeLocations?.length > 1 && (
                              <div className="mt-2 rounded-lg bg-slate-50 p-2 text-xs font-semibold text-slate-600">
                                {candidate.officeLocations.length} office addresses saved into this contact.
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid gap-3">
              <label className="text-sm font-bold text-slate-800">
                Name
                <input
                  value={contactForm.name || ""}
                  onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="text-sm font-bold text-slate-800">
                Category
                <select
                  value={contactForm.category || "General"}
                  onChange={(event) => setContactForm((current) => ({ ...current, category: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {taskTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>

              <label className="text-sm font-bold text-slate-800">
                Website
                <input
                  value={contactForm.website || ""}
                  onChange={(event) => setContactForm((current) => ({ ...current, website: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <div className="grid gap-3">
                {getOfficeLocationsForForm(contactForm).map((location, index) => (
                  <div key={`contact-form-office-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 text-sm font-black text-slate-900">{location.label || `Office ${index + 1}`}</div>
                    <div className="grid gap-2">
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                        Address
                        <AutoResizeTextarea
                          value={location.address || ""}
                          onChange={(value) => updateContactOfficeField(setContactForm, index, "address", value)}
                          minRows={1}
                          maxRows={4}
                          compactOnChange
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-900"
                        />
                      </label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                          Phone
                          <input
                            value={location.phone || ""}
                            onChange={(event) => updateContactOfficeField(setContactForm, index, "phone", event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-900"
                          />
                        </label>
                        <label className="text-xs font-bold uppercase tracking-wide text-slate-600">
                          Fax
                          <input
                            value={location.fax || ""}
                            onChange={(event) => updateContactOfficeField(setContactForm, index, "fax", event.target.value)}
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-900"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <label className="text-sm font-bold text-slate-800">
                Organization
                <input
                  value={contactForm.organization || ""}
                  onChange={(event) => setContactForm((current) => ({ ...current, organization: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="text-sm font-bold text-slate-800">
                Company
                <input
                  value={contactForm.company || ""}
                  onChange={(event) => setContactForm((current) => ({ ...current, company: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="text-sm font-bold text-slate-800">
                Person
                <input
                  value={contactForm.person || ""}
                  onChange={(event) => setContactForm((current) => ({ ...current, person: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="text-sm font-bold text-slate-800">
                Notes
                <AutoResizeTextarea
                  value={contactForm.notes || ""}
                  onChange={(value) => setContactForm((current) => ({ ...current, notes: value }))}
                  minRows={1}
                  maxRows={8}
                  compactOnChange
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              {contactForm.scannedDocumentDataUrl && (
                <button
                  type="button"
                  onClick={() => openScannedDocument(contactForm)}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-800 hover:bg-blue-100"
                >
                  Open Scan: {contactForm.scannedDocumentName || "Scanned document"}
                </button>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveContact}
                title={editingContactId ? "Save contact changes" : "Add saved contact"}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
              >
                {editingContactId ? "Save Contact" : "Add Contact"}
              </button>
              <button
                type="button"
                onClick={resetContactForm}
                title="Clear contact form"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden px-4 py-5">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input
                value={contactSearch}
                onChange={(event) => setContactSearch(event.target.value)}
                placeholder="Search contacts..."
                className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                <input
                  type="checkbox"
                  checked={replaceExistingContactFields}
                  onChange={(event) => setReplaceExistingContactFields(event.target.checked)}
                />
                Replace filled fields when using
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200">
              {filteredContacts.length ? (
                <div className="divide-y divide-slate-200">
                  {filteredContacts.map((contact) => (
                    <div key={contact.id} className="bg-white p-4 hover:bg-slate-50">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-base font-black text-slate-900">{contact.name}</div>
                          <div className="mt-1 text-xs font-black uppercase tracking-wide text-slate-500">{contact.category}</div>
                          <div className="mt-2 grid gap-1 text-sm text-slate-700 md:grid-cols-2">
                            {contact.website && <div className="truncate"><span className="font-bold">Website:</span> {contact.website}</div>}
                            {contact.organization && <div><span className="font-bold">Organization:</span> {contact.organization}</div>}
                            {contact.company && <div><span className="font-bold">Company:</span> {contact.company}</div>}
                            {contact.person && <div><span className="font-bold">Person:</span> {contact.person}</div>}
                            {getVisibleOfficeLocations(contact).length > 0 && (
                              <div className="whitespace-pre-wrap md:col-span-2">
                                <div className="mt-1 grid gap-2">
                                  {getVisibleOfficeLocations(contact).map((location, index) => (
                                    <div key={`${contact.id}-office-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                      <div className="font-bold text-slate-900">{location.label || `Office ${index + 1}`}</div>
                                      {location.address && <div>{location.address}</div>}
                                      {(location.phone || location.fax) && (
                                        <div className="text-xs text-slate-600">
                                          {location.phone ? `Phone: ${location.phone}` : ""}
                                          {location.phone && location.fax ? " | " : ""}
                                          {location.fax ? `Fax: ${location.fax}` : ""}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {contact.notes && <div className="whitespace-pre-wrap md:col-span-2"><span className="font-bold">Notes:</span> {contact.notes}</div>}
                            {contact.scannedDocumentDataUrl && (
                              <button
                                type="button"
                                onClick={() => openScannedDocument(contact)}
                                className="w-fit rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 hover:bg-blue-100 md:col-span-2"
                              >
                                Open Scan: {contact.scannedDocumentName || "Scanned document"}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => applyContactToTarget(contact)}
                            title="Use this contact"
                            className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800"
                          >
                            Use
                          </button>
                          <button
                            type="button"
                            onClick={() => editContact(contact)}
                            title="Edit this contact"
                            className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white hover:bg-slate-900"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteContact(contact.id)}
                            title="Delete this contact"
                            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-sm font-semibold text-slate-500">No contacts found.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
