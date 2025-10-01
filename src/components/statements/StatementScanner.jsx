// src/components/statements/StatementScanner.jsx
import React, { useState, useRef } from 'react';
import { Upload, FileText, Camera, Image as ImageIcon, X, Check } from 'lucide-react';
import { parseStatementText, transactionsToBudgetItems } from '../../utils/statements/statementParser';
import CameraCapture from '../receipts/CameraCapture';

export default function StatementScanner({ isOpen, onClose, onImport }) {
  const [activeTab, setActiveTab] = useState('paste');
  const [pastedText, setPastedText] = useState('');
  const [processing, setProcessing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  
  const fileInputRef = useRef(null);
  const pasteAreaRef = useRef(null);

  if (!isOpen && !parsedData) return null;

  const handlePasteText = () => {
    if (!pastedText.trim()) {
      alert('Please paste statement text first');
      return;
    }

    setProcessing(true);
    try {
      const result = parseStatementText(pastedText);
      setParsedData(result);
    } catch (err) {
      alert('Failed to parse statement: ' + err.message);
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    
    setProcessing(true);
    try {
      // Try to import OCR utilities
      let text = '';
      
      if (file.type === 'application/pdf') {
        // Use existing PDF OCR
        const ocrModule = await import('../../utils/receipts/ocr.js');
        const canvases = await ocrModule.pdfFileToCanvases(file, { scale: 2 });
        
        // For now, alert user to paste text instead (full OCR requires Tesseract setup)
        alert('PDF detected. Please copy text from PDF and use "Paste Text" tab for now.');
        setProcessing(false);
        return;
      } else {
        // Image file - would need Tesseract
        alert('Image detected. Please copy text from image and use "Paste Text" tab for now.');
        setProcessing(false);
        return;
      }
    } catch (err) {
      alert('Failed to process file: ' + err.message);
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  const handleImagePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const blob = item.getAsFile();
        
        // Would need Tesseract OCR here
        alert('Image pasted! OCR from images requires Tesseract.js setup. Please paste as text for now.');
        return;
      }
    }
  };

  const handleCameraCapture = (canvas) => {
    setShowCamera(false);
    alert('Photo captured! OCR from images requires Tesseract.js setup. Please paste as text for now.');
  };

  const handleApprove = () => {
    if (!parsedData || parsedData.transactions.length === 0) return;

    const budgetItems = transactionsToBudgetItems(parsedData.transactions);
    onImport(budgetItems);
    handleClose();
  };

  const handleClose = () => {
    setPastedText('');
    setParsedData(null);
    setActiveTab('paste');
    onClose();
  };

  // Review Modal
  if (parsedData) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Review Transactions</h2>
              <p className="text-sm text-gray-600 mt-1">
                Found {parsedData.transactions.length} transactions • 
                Total: ${parsedData.summary.totalAmount.toFixed(2)}
              </p>
            </div>
            <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Transaction List */}
          <div className="flex-1 overflow-y-auto p-6">
            {parsedData.errors.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-sm text-yellow-800 font-medium">
                  {parsedData.errors.length} lines could not be parsed
                </p>
              </div>
            )}

            <div className="space-y-2">
              {parsedData.transactions.map((t, idx) => (
                <div key={idx} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-900">{t.merchant}</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                          {t.categoryLabel}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{t.transactionType}</p>
                      <p className="text-xs text-gray-400 mt-1">{t.date}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${t.amount < 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {t.amount < 0 ? '+' : '-'}${Math.abs(t.amount).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleApprove}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              <Check className="w-4 h-4" />
              Import {parsedData.transactions.length} Transactions
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Camera Modal
  if (showCamera) {
    return (
      <CameraCapture
        onClose={() => setShowCamera(false)}
        onCapture={handleCameraCapture}
      />
    );
  }

  // Main Scanner Modal
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Scan Statement</h2>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
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

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Copy transaction lines from your statement and paste below:
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
                Upload a PDF or image of your statement
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Choose File
                </button>
                <p className="text-xs text-gray-500 mt-2">PDF or Image (JPG, PNG)</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files[0])}
              />
            </div>
          )}

          {activeTab === 'image' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Take a screenshot (Win+Shift+S or Cmd+Shift+4) and paste here
              </p>
              <div
                onPaste={handleImagePaste}
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-400"
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
                Use your device camera to capture statement
              </p>
              <button
                onClick={() => setShowCamera(true)}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
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