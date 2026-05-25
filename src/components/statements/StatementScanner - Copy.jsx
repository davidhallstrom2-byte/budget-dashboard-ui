// C:\Users\david\Local Sites\main-dashboard\app\public\budget-dashboard-fs\ui\src\components\statements\StatementScanner.jsx
import React, { useRef, useState } from 'react';
import { Upload, FileText, Camera, Image as ImageIcon, X, Check } from 'lucide-react';
import { extractTextFromFile, providerLabel } from '../../utils/ocr/index.js';
import { parseStatementText, transactionsToBudgetItems } from '../../utils/statements/statementParser';
import CameraCapture from '../receipts/CameraCapture';

function canvasToFile(canvas, filename = 'camera-statement.png') {
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

function buildParsedDataFromText(text, sourceLabel = 'OCR') {
  const cleanedText = String(text || '').replace(/\r/g, '').trim();
  if (!cleanedText) {
    return {
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
    rawText: cleanedText,
    sourceLabel,
  };
}

export default function StatementScanner({ isOpen, onClose, onImport }) {
  const [activeTab, setActiveTab] = useState('paste');
  const [pastedText, setPastedText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  const fileInputRef = useRef(null);
  const pasteAreaRef = useRef(null);

  if (!isOpen && !parsedData) return null;

  const parseTextForReview = (text, sourceLabel = 'Pasted text') => {
    const parsed = buildParsedDataFromText(text, sourceLabel);
    setParsedData(parsed);

    if (parsed.rawText && parsed.transactions.length === 0) {
      setPastedText(parsed.rawText);
      setActiveTab('paste');
    }
  };

  const handlePasteText = () => {
    if (!pastedText.trim()) {
      alert('Please paste statement text first.');
      return;
    }

    setProcessing(true);
    setProcessingMessage('Parsing transactions...');
    try {
      parseTextForReview(pastedText, 'Pasted text');
    } catch (err) {
      alert('Failed to parse statement: ' + (err?.message || String(err)));
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
        alert('OCR did not find readable text. Try a clearer file, a closer photo, or paste the statement text directly.');
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

        const file = new File([blob], 'pasted-statement-image.png', {
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
      const file = await canvasToFile(canvas, 'camera-statement.png');
      await processFileWithOcr(file, 'Camera photo');
    } catch (err) {
      alert('Failed to read camera photo: ' + (err?.message || String(err)));
      console.error(err);
    }
  };

  const handleApprove = () => {
    if (!parsedData || parsedData.transactions.length === 0) return;

    const budgetItems = transactionsToBudgetItems(parsedData.transactions);
    onImport(budgetItems);
    handleClose();
  };

  const handleClose = () => {
    setPastedText('');
    setProcessing(false);
    setProcessingMessage('');
    setParsedData(null);
    setShowCamera(false);
    setActiveTab('paste');
    onClose();
  };

  if (parsedData) {
    const hasTransactions = parsedData.transactions.length > 0;

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Review Transactions</h2>
              <p className="text-sm text-gray-600 mt-1">
                Found {parsedData.transactions.length} transactions
                {hasTransactions ? ` • Total: $${parsedData.summary.totalAmount.toFixed(2)}` : ''}
              </p>
              {parsedData.sourceLabel && (
                <p className="text-xs text-gray-500 mt-1">Source: {parsedData.sourceLabel}</p>
              )}
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded" aria-label="Close scanner">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {parsedData.errors.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800 font-medium">
                  {parsedData.errors.length} lines could not be parsed.
                </p>
              </div>
            )}

            {!hasTransactions && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-semibold text-red-800">No transactions were found.</p>
                <p className="text-sm text-red-700 mt-1">
                  The scanner found text, but the statement parser could not identify transaction rows. Review the OCR text below, edit it if needed, then parse again from the Paste Text tab.
                </p>
                {parsedData.rawText && (
                  <button
                    onClick={() => {
                      setPastedText(parsedData.rawText);
                      setParsedData(null);
                      setActiveTab('paste');
                    }}
                    className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Edit OCR Text
                  </button>
                )}
              </div>
            )}

            {hasTransactions && (
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

            {parsedData.rawText && (
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

          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              disabled={!hasTransactions}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4" />
              Import {parsedData.transactions.length} Transactions
            </button>
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
            <h2 className="text-xl font-bold text-gray-900">Scan Statement</h2>
            <p className="text-xs text-gray-500 mt-1">OCR provider: {providerLabel}</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded" aria-label="Close scanner">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-b border-gray-200">
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
                Copy transaction lines from your statement and paste below.
              </p>
              <textarea
                ref={pasteAreaRef}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="8/1 Purchase Return Authorized On 07/31 WWW Costco Com 800-955-2292 WA S585212469081510 Card 7515 457.99&#10;8/1 Monthly Service Fee 25.00 463.27&#10;8/4 Recurring Payment Authorized On 08/02 Spectrum Mobile..."
                className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm"
              />
              <button
                onClick={handlePasteText}
                disabled={processing || !pastedText.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Parse Transactions'}
              </button>
            </div>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Upload a PDF or image of your statement. PDFs with selectable text will parse fastest. Scanned PDFs and images use OCR.
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
                <p className="text-xs text-gray-500 mt-2">Screenshot will be processed with OCR</p>
              </div>
            </div>
          )}

          {activeTab === 'camera' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Use your device camera to capture a statement page.
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
