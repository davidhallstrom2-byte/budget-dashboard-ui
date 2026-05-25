// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\components\statements\StatementScanner.jsx
import React, { useRef, useState } from 'react';
import { Upload, FileText, Camera, Image as ImageIcon, X, Check, ClipboardList, Copy, ListChecks, UserPlus, RefreshCw } from 'lucide-react';
import { extractTextFromFile, providerLabel } from '../../utils/ocr/index.js';
import { parseStatementText, transactionsToBudgetItems } from '../../utils/statements/statementParser';
import CameraCapture from '../receipts/CameraCapture';

function canvasToFile(canvas, filename = 'camera-scan.png') {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Could not read camera image.'));
          return;
        }
        resolve(new File([blob], filename, { type: blob.type || 'image/png' }));
      }, 'image/png');
    } catch (err) {
      reject(err);
    }
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function cleanText(text = '') {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function firstUsefulLine(text = '') {
  const lines = cleanText(text)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.length >= 3);

  return lines[0] || '';
}

function guessDocumentTitle(text = '', sourceLabel = '') {
  const source = String(sourceLabel || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim();
  const firstLine = firstUsefulLine(text);
  const candidate = firstLine || source || 'Scanned Document';
  return candidate.length > 70 ? `${candidate.slice(0, 67).trim()}...` : candidate;
}

function guessTodoType(text = '') {
  const value = String(text || '').toLowerCase();
  if (/insurance|member id|health net|medi-cal|medical|coverage|policy|cin\b/.test(value)) return 'Insurance';
  if (/dpss|calfresh|benefits|medi-cal|lifeline|case #|case number/.test(value)) return 'DPSS / Benefits';
  if (/dmv|registration|license plate|vin|vehicle/.test(value)) return 'DMV / Vehicle';
  if (/court|attorney|legal|citation|notice/.test(value)) return 'Legal';
  if (/dental|dentist/.test(value)) return 'Dental';
  if (/doctor|clinic|appointment|prescription|lab|test|patient/.test(value)) return 'Medical';
  return 'General';
}

const CONTACT_CATEGORIES = [
  'General',
  'Medical',
  'DMV / Vehicle',
  'Insurance',
  'DPSS / Benefits',
  'Legal',
  'Moving',
  'Work',
  'Dental',
  'Phone / Lifeline',
];

function firstMatch(text = '', regex) {
  const match = String(text || '').match(regex);
  return match ? String(match[1] || match[0] || '').trim() : '';
}

function extractPhone(text = '') {
  return firstMatch(text, /(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/);
}

function extractWebsite(text = '') {
  return firstMatch(text, /\b(?:https?:\/\/)?(?:www\.)?[a-z0-9.-]+\.(?:com|org|net|gov|edu)\b/i);
}

function extractMemberId(text = '') {
  return firstMatch(text, /\b(?:member\s*(?:id|no\.?|number)|subscriber\s*(?:id|no\.?|number)|cin|policy\s*(?:no\.?|number|#))\s*[:#-]?\s*([A-Z0-9-]{4,})\b/i);
}

function guessOrganization(text = '', title = '') {
  const value = `${title}\n${text}`;
  const known = [
    'Health Net',
    'Medi-Cal',
    'Medicare',
    'DPSS',
    'California DMV',
    'DMV',
    'Lifeline',
    'Quest Diagnostics',
    'Mayflower Medical Group',
    'SuperCare',
    'Motivcare',
    'Western Drug Medical Supplies',
    'Sun Clinical Labs',
  ];
  const lower = value.toLowerCase();
  const found = known.find((name) => lower.includes(name.toLowerCase()));
  if (found) return found;

  const first = firstUsefulLine(value);
  return first.length <= 60 ? first : '';
}

function buildContactDraftFromText(text = '', sourceLabel = '', title = '') {
  const cleaned = cleanText(text);
  const category = guessTodoType(`${title}\n${cleaned}`);
  const organization = guessOrganization(cleaned, title);
  const phone = extractPhone(cleaned);
  const website = extractWebsite(cleaned);
  const memberId = extractMemberId(cleaned);
  const source = sourceLabel || 'Scanned document';
  const fallbackName = title || organization || guessDocumentTitle(cleaned, source);
  const name = category === 'Insurance' && organization
    ? `${organization} Card`
    : fallbackName || 'Scanned Card';

  const noteParts = [
    `Saved from scanner on ${todayISO()}.`,
    source ? `Source: ${source}` : '',
    memberId ? `Member / ID: ${memberId}` : '',
    cleaned ? `OCR text:\n${cleaned}` : '',
  ].filter(Boolean);

  return {
    name,
    category: CONTACT_CATEGORIES.includes(category) ? category : 'General',
    phone,
    directPhone: '',
    website,
    address: '',
    organization,
    company: organization,
    person: '',
    notes: noteParts.join('\n'),
  };
}

function buildParsedDataFromText(text, sourceLabel = 'OCR', mode = 'document') {
  const cleanedText = cleanText(text);

  if (mode === 'document') {
    return {
      mode: 'document',
      transactions: [],
      errors: cleanedText ? [] : [`${sourceLabel} did not return readable text.`],
      summary: {
        totalTransactions: 0,
        totalAmount: 0,
        categories: [],
      },
      rawText: cleanedText,
      sourceLabel,
      documentTitle: guessDocumentTitle(cleanedText, sourceLabel),
    };
  }

  if (!cleanedText) {
    return {
      mode: 'budget',
      transactions: [],
      errors: [`${sourceLabel} did not return readable text.`],
      summary: {
        totalTransactions: 0,
        totalAmount: 0,
        categories: [],
      },
      rawText: '',
      sourceLabel,
    };
  }

  const parsed = parseStatementText(cleanedText);
  return {
    ...parsed,
    mode: 'budget',
    rawText: cleanedText,
    sourceLabel,
  };
}

export default function StatementScanner({ isOpen, onClose, onImport, onCreateTodo, onSaveContact }) {
  const [activeTab, setActiveTab] = useState('paste');
  const [scanMode, setScanMode] = useState('document');
  const [pastedText, setPastedText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [contactDraft, setContactDraft] = useState(() => buildContactDraftFromText('', '', ''));
  const [editableOcrText, setEditableOcrText] = useState('');
  const [showCamera, setShowCamera] = useState(false);

  const fileInputRef = useRef(null);
  const pasteAreaRef = useRef(null);

  if (!isOpen && !parsedData) return null;

  const parseTextForReview = (text, sourceLabel = 'Pasted text', modeOverride = scanMode) => {
    const parsed = buildParsedDataFromText(text, sourceLabel, modeOverride);
    const title = parsed.documentTitle || guessDocumentTitle(parsed.rawText, sourceLabel);
    setParsedData(parsed);
    setEditableOcrText(parsed.rawText || '');
    setDocumentTitle(title);
    if (parsed.mode === 'document') {
      setContactDraft(buildContactDraftFromText(parsed.rawText || '', sourceLabel, title));
    }

    if (parsed.mode === 'budget' && parsed.rawText && parsed.transactions.length === 0) {
      setPastedText(parsed.rawText);
      setActiveTab('paste');
    }
  };

  const handlePasteText = () => {
    if (!pastedText.trim()) {
      alert(scanMode === 'budget' ? 'Please paste statement text first.' : 'Please paste document text first.');
      return;
    }

    setProcessing(true);
    setProcessingMessage(scanMode === 'budget' ? 'Parsing transactions...' : 'Reviewing document text...');
    try {
      parseTextForReview(pastedText, 'Pasted text');
    } catch (err) {
      alert('Failed to process text: ' + (err?.message || String(err)));
      console.error(err);
    } finally {
      setProcessing(false);
      setProcessingMessage('');
    }
  };

  const processFileWithOcr = async (file, sourceLabel = 'OCR') => {
    if (!file) return;

    setProcessing(true);
    setProcessingMessage('Reading file with OCR...');
    try {
      const result = await extractTextFromFile(file, {
        onProgress: (message) => setProcessingMessage(message),
      });

      const text = result?.text || '';
      parseTextForReview(text, sourceLabel);

      if (!text.trim()) {
        alert('OCR did not find readable text. Try a clearer file, a closer photo, or paste the text directly.');
      }
    } catch (err) {
      alert('Failed to process file: ' + (err?.message || String(err)));
      console.error(err);
    } finally {
      setProcessing(false);
      setProcessingMessage('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (file) => {
    await processFileWithOcr(file, file?.name || 'Uploaded file');
  };

  const handleImagePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        if (!blob) {
          alert('Could not read pasted image.');
          return;
        }

        const file = new File([blob], 'pasted-scan-image.png', {
          type: blob.type || 'image/png',
        });
        await processFileWithOcr(file, 'Pasted image');
        return;
      }
    }
  };

  const handleCameraCapture = async (canvas) => {
    setShowCamera(false);
    try {
      const file = await canvasToFile(canvas, 'camera-scan.png');
      await processFileWithOcr(file, 'Camera photo');
    } catch (err) {
      alert('Failed to read camera photo: ' + (err?.message || String(err)));
      console.error(err);
    }
  };

  const handleApproveTransactions = () => {
    if (!parsedData || parsedData.mode !== 'budget' || parsedData.transactions.length === 0) return;

    const budgetItems = transactionsToBudgetItems(parsedData.transactions);
    onImport(budgetItems);
    handleClose();
  };

  const handleCopyText = async () => {
    const text = editableOcrText.trim();
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      alert('OCR text copied.');
    } catch {
      alert('Copy failed. Select the text and copy it manually.');
    }
  };

  const refreshContactDraft = () => {
    const text = editableOcrText.trim();
    const title = documentTitle.trim() || guessDocumentTitle(text, parsedData?.sourceLabel || 'Scanned document');
    setContactDraft(buildContactDraftFromText(text, parsedData?.sourceLabel || 'Scanned document', title));
  };

  const updateContactDraft = (field, value) => {
    setContactDraft((current) => ({ ...current, [field]: value }));
  };

  const handleSaveContact = () => {
    const text = editableOcrText.trim();
    const name = String(contactDraft.name || '').trim();

    if (!name) {
      alert('Add a contact or card name before saving.');
      return;
    }

    const source = parsedData?.sourceLabel || 'Scanned document';
    const nextContact = {
      ...contactDraft,
      name,
      notes: contactDraft.notes || [
        `Saved from scanner on ${todayISO()}.`,
        source ? `Source: ${source}` : '',
        text ? `OCR text:\n${text}` : '',
      ].filter(Boolean).join('\n'),
    };

    onSaveContact?.(nextContact);
    handleClose();
  };

  const handleCreateTodo = () => {
    const text = editableOcrText.trim();
    if (!text) {
      alert('No OCR text available to create a task.');
      return;
    }

    const title = documentTitle.trim() || guessDocumentTitle(text, parsedData?.sourceLabel || 'Scanned document');
    const source = parsedData?.sourceLabel || 'Scanned document';
    const type = guessTodoType(`${title}\n${text}`);

    onCreateTodo?.({
      taskName: title,
      details: text,
      type,
      typeOverride: type,
      date: todayISO(),
      documents: source,
      notes: `Created from scanner on ${todayISO()}.\nSource: ${source}`,
      completed: false,
    });

    handleClose();
  };

  const handleClose = () => {
    setPastedText('');
    setProcessing(false);
    setProcessingMessage('');
    setParsedData(null);
    setDocumentTitle('');
    setContactDraft(buildContactDraftFromText('', '', ''));
    setEditableOcrText('');
    setShowCamera(false);
    setActiveTab('paste');
    setScanMode('document');
    onClose();
  };

  const switchBudgetResultToDocument = () => {
    const text = parsedData?.rawText || '';
    const source = parsedData?.sourceLabel || 'OCR';
    setScanMode('document');
    parseTextForReview(text, source, 'document');
  };

  if (parsedData) {
    const isBudgetReview = parsedData.mode === 'budget';
    const isDocumentReview = parsedData.mode === 'document';
    const hasTransactions = isBudgetReview && parsedData.transactions.length > 0;

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isDocumentReview ? 'Review Document Text' : 'Review Transactions'}
              </h2>
              {isDocumentReview ? (
                <p className="text-sm text-gray-600 mt-1">
                  Extracted {editableOcrText.trim().length} characters
                </p>
              ) : (
                <p className="text-sm text-gray-600 mt-1">
                  Found {parsedData.transactions.length} transactions
                  {hasTransactions ? ` • Total: $${parsedData.summary.totalAmount.toFixed(2)}` : ''}
                </p>
              )}
              {parsedData.sourceLabel && (
                <p className="text-xs text-gray-500 mt-1">Source: {parsedData.sourceLabel}</p>
              )}
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded" aria-label="Close scanner">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {isBudgetReview && parsedData.errors.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800 font-medium">
                  {parsedData.errors.length} lines could not be parsed.
                </p>
              </div>
            )}

            {isBudgetReview && !hasTransactions && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-semibold text-red-800">No transactions were found.</p>
                <p className="text-sm text-red-700 mt-1">
                  The scanner found text, but the statement parser could not identify transaction rows. Use Document / Card Text for insurance cards, IDs, letters, forms, and notices.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {parsedData.rawText && (
                    <button
                      onClick={() => {
                        setPastedText(parsedData.rawText);
                        setParsedData(null);
                        setActiveTab('paste');
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Edit OCR Text
                    </button>
                  )}
                  {parsedData.rawText && (
                    <button
                      onClick={switchBudgetResultToDocument}
                      className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900"
                    >
                      Use as Document / Card Text
                    </button>
                  )}
                </div>
              </div>
            )}

            {isBudgetReview && hasTransactions && (
              <div className="space-y-2">
                {parsedData.transactions.map((t, idx) => (
                  <div key={`${t.id || 'transaction'}-${idx}`} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{t.merchant}</span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                            {t.categoryLabel}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{t.transactionType}</p>
                        <p className="text-xs text-gray-400 mt-1">{t.date}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-lg font-bold ${t.amount < 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {t.amount < 0 ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isDocumentReview && (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Save card or contact</h3>
                      <p className="text-sm text-slate-600">Use this for insurance cards, ID cards, provider cards, letters, and scanned contact records.</p>
                    </div>
                    <button
                      type="button"
                      onClick={refreshContactDraft}
                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Re-read fields
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Name
                      <input
                        value={contactDraft.name}
                        onChange={(e) => updateContactDraft('name', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Health Net Card"
                      />
                    </label>
                    <label className="text-sm font-semibold text-gray-700">
                      Category
                      <select
                        value={contactDraft.category}
                        onChange={(e) => updateContactDraft('category', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      >
                        {CONTACT_CATEGORIES.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-gray-700">
                      Phone
                      <input
                        value={contactDraft.phone}
                        onChange={(e) => updateContactDraft('phone', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Phone number"
                      />
                    </label>
                    <label className="text-sm font-semibold text-gray-700">
                      Website
                      <input
                        value={contactDraft.website}
                        onChange={(e) => updateContactDraft('website', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Website"
                      />
                    </label>
                    <label className="text-sm font-semibold text-gray-700">
                      Organization
                      <input
                        value={contactDraft.organization}
                        onChange={(e) => updateContactDraft('organization', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Organization"
                      />
                    </label>
                    <label className="text-sm font-semibold text-gray-700">
                      Person
                      <input
                        value={contactDraft.person}
                        onChange={(e) => updateContactDraft('person', e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Person"
                      />
                    </label>
                    <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
                      Address
                      <textarea
                        value={contactDraft.address}
                        onChange={(e) => updateContactDraft('address', e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Address"
                      />
                    </label>
                    <label className="text-sm font-semibold text-gray-700 sm:col-span-2">
                      Contact notes
                      <textarea
                        value={contactDraft.notes}
                        onChange={(e) => updateContactDraft('notes', e.target.value)}
                        rows={5}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        placeholder="Card details, member IDs, OCR text, notes"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Optional To-Do title</label>
                  <input
                    value={documentTitle}
                    onChange={(e) => setDocumentTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Only needed if you create a To-Do"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Extracted text</label>
                  <textarea
                    value={editableOcrText}
                    onChange={(e) => setEditableOcrText(e.target.value)}
                    className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm"
                    placeholder="OCR text will appear here."
                  />
                </div>
              </div>
            )}

            {isBudgetReview && parsedData.rawText && (
              <details className="mt-6 border border-gray-200 rounded-lg">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-gray-700 bg-gray-50 rounded-lg">
                  View OCR text
                </summary>
                <pre className="p-4 text-xs whitespace-pre-wrap text-gray-700 max-h-64 overflow-y-auto">
                  {parsedData.rawText}
                </pre>
              </details>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>

            {isDocumentReview ? (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={handleCopyText}
                  disabled={!editableOcrText.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Copy className="w-4 h-4" />
                  Copy Text
                </button>
                <button
                  onClick={handleSaveContact}
                  disabled={!editableOcrText.trim() || !String(contactDraft.name || '').trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <UserPlus className="w-4 h-4" />
                  Save Card / Contact
                </button>
                <button
                  onClick={handleCreateTodo}
                  disabled={!editableOcrText.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  Create To-Do
                </button>
              </div>
            ) : (
              <button
                onClick={handleApproveTransactions}
                disabled={!hasTransactions}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-4 h-4" />
                Import {parsedData.transactions.length} Transactions
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (showCamera) {
    return (
      <CameraCapture
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Scanner</h2>
            <p className="text-xs text-gray-500 mt-1">OCR provider: {providerLabel}</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded" aria-label="Close scanner">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setScanMode('document')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${
                scanMode === 'document'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Document / Card Text
            </button>
            <button
              onClick={() => setScanMode('budget')}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold ${
                scanMode === 'budget'
                  ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListChecks className="w-4 h-4" />
              Budget Transactions
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {scanMode === 'document'
              ? 'Use this for insurance cards, IDs, letters, forms, notices, and medical documents.'
              : 'Use this for bank or credit-card statements with transaction rows.'}
          </p>
        </div>

        <div className="border-b border-gray-200 mt-4">
          <div className="flex">
            <button
              onClick={() => setActiveTab('paste')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === 'paste'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Paste Text
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === 'upload'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Upload File
            </button>
            <button
              onClick={() => setActiveTab('image')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === 'image'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ImageIcon className="w-4 h-4 inline mr-2" />
              Paste Image
            </button>
            <button
              onClick={() => setActiveTab('camera')}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === 'camera'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Camera className="w-4 h-4 inline mr-2" />
              Camera
            </button>
          </div>
        </div>

        {processing && (
          <div className="mx-6 mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            {processingMessage || 'Processing...'}
          </div>
        )}

        <div className="p-6">
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {scanMode === 'budget'
                  ? 'Copy transaction lines from your statement and paste below.'
                  : 'Paste text from a card, notice, form, letter, or document below.'}
              </p>
              <textarea
                ref={pasteAreaRef}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder={scanMode === 'budget'
                  ? '8/1 Monthly Service Fee 25.00 463.27\n8/4 Recurring Payment Spectrum Mobile 64.99'
                  : 'Paste document, card, notice, or form text here...'}
                className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm"
              />
              <button
                onClick={handlePasteText}
                disabled={processing || !pastedText.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processing ? 'Processing...' : scanMode === 'budget' ? 'Parse Transactions' : 'Review Text'}
              </button>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {scanMode === 'budget'
                  ? 'Upload a PDF or image of your statement. PDFs with selectable text will parse fastest. Scanned PDFs and images use OCR.'
                  : 'Upload a PDF or image of a card, notice, form, letter, or document. OCR will extract readable text.'}
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Choose File
                </button>
                <p className="text-xs text-gray-500 mt-2">PDF, JPG, PNG, HEIC, or WebP</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
              />
            </div>
          )}

          {activeTab === 'image' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Take a screenshot, click the box, then press Ctrl+V to paste the image.
              </p>
              <div
                onPaste={handleImagePaste}
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                tabIndex={0}
              >
                <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <p className="text-sm text-gray-600">Click here and press Ctrl+V to paste screenshot</p>
                <p className="text-xs text-gray-500 mt-2">
                  {scanMode === 'budget' ? 'Screenshot will be parsed as statement transactions' : 'Screenshot will be extracted as document text'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'camera' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {scanMode === 'budget'
                  ? 'Use your device camera to capture a statement page.'
                  : 'Use your device camera to capture a card, notice, form, letter, or document.'}
              </p>
              <button
                onClick={() => setShowCamera(true)}
                disabled={processing}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Open Camera
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
