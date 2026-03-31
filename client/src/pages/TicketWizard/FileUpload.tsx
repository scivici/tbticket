import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WizardData } from './WizardContainer';
import { Upload, X, FileText, Image, Info, AlertTriangle, Clipboard } from 'lucide-react';

interface Props {
  data: WizardData;
  onUpdate: (partial: Partial<WizardData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const MAX_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_FILES = 10;

export default function FileUpload({ data, onUpdate, onNext, onPrev }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [showNoFilesWarning, setShowNoFilesWarning] = useState(false);
  const [pasteFlash, setPasteFlash] = useState(false);
  const pasteCountRef = useRef(0);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    setError('');
    const arr = Array.from(newFiles);
    if (data.files.length + arr.length > MAX_FILES) { setError(`Maximum ${MAX_FILES} files allowed`); return; }
    for (const file of arr) { if (file.size > MAX_SIZE) { setError(`"${file.name}" exceeds 100MB limit`); return; } }
    onUpdate({ files: [...data.files, ...arr] });
  }, [data.files, onUpdate]);

  const removeFile = (index: number) => { onUpdate({ files: data.files.filter((_, i) => i !== index) }); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  // Clipboard paste support for screenshots
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          pasteCountRef.current += 1;
          const ext = file.type.split('/')[1] || 'png';
          const named = new File([file], `screenshot-${pasteCountRef.current}.${ext}`, { type: file.type });
          imageFiles.push(named);
        }
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      addFiles(imageFiles);
      setPasteFlash(true);
      setTimeout(() => setPasteFlash(false), 1500);
    }
  }, [addFiles]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const productName = (data.product?.name || '').toLowerCase();

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Attach Files</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Upload screenshots, logs, or SIP traces. Max 100MB per file, up to 10 files.</p>

      {/* Log collection help */}
      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">Attaching logs helps us resolve your issue faster.</p>
            <ul className="list-disc ml-4 space-y-1 text-xs">
              {(productName.includes('tmg') || productName.includes('tsg')) && (
                <>
                  <li><strong>tbreport</strong> &mdash; Run <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-800 rounded">tbreport</code> from the unit CLI. This collects system logs, configuration, and diagnostic data into a single archive.</li>
                  <li><strong>PCAP trace</strong> &mdash; Use <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-800 rounded">tcpdump</code> or the web interface to capture network traffic relevant to the issue.</li>
                </>
              )}
              {productName.includes('prosbc') && (
                <>
                  <li><strong>Diagnostic bundle</strong> &mdash; Go to <em>System &gt; Diagnostics &gt; Download Report</em> in the ProSBC web interface.</li>
                  <li><strong>SIP/PCAP trace</strong> &mdash; Enable SIP trace capture under <em>Troubleshooting &gt; Packet Capture</em> and download the .pcap file.</li>
                </>
              )}
              {!productName.includes('tmg') && !productName.includes('tsg') && !productName.includes('prosbc') && (
                <>
                  <li><strong>Log files</strong> &mdash; Collect any relevant log files from the system.</li>
                  <li><strong>Screenshots</strong> &mdash; Capture screenshots showing the issue or error messages.</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div onDragOver={e => { e.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
          pasteFlash ? 'border-green-500 bg-green-500/10' :
          dragActive ? 'border-primary-500 bg-primary-500/10' : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
        }`}>
        {pasteFlash ? (
          <>
            <Clipboard className="w-10 h-10 text-green-500 mx-auto mb-3" />
            <p className="text-green-600 dark:text-green-400 font-medium">Screenshot pasted!</p>
          </>
        ) : (
          <>
            <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 mb-2">Drag and drop files here, or</p>
            <label className="inline-flex items-center px-4 py-2 bg-white dark:bg-tb-card border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors">
              Browse Files
              <input type="file" multiple className="hidden" accept="image/*,.pdf,.txt,.csv,.log,.json,.zip,.pcap,.xls,.xlsx,.tar.gz,.tgz,.tar,.gz"
                onChange={e => e.target.files && addFiles(e.target.files)} />
            </label>
            <p className="text-xs text-gray-500 mt-2">PDF, images, text, log, JSON, PCAP, ZIP, Excel, tar.gz</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center justify-center gap-1">
              <Clipboard className="w-3 h-3" /> You can also paste screenshots with <kbd className="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-[0.65rem] font-mono">Ctrl+V</kbd>
            </p>
          </>
        )}
      </div>

      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}

      {data.files.length > 0 && (
        <div className="mt-4 space-y-2">
          {data.files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-[#f2f2f2] dark:bg-tb-bg rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                {file.type.startsWith('image/') ? <Image className="w-5 h-5 text-accent-blue" /> : <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400" />}
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate max-w-xs">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatSize(file.size)}</p>
                </div>
              </div>
              <button onClick={() => removeFile(index)} className="p-1 text-gray-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Warning when no files attached */}
      {showNoFilesWarning && data.files.length === 0 && (
        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">No files attached</p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                Attaching log files (tbreport, pcap, screenshots) significantly speeds up issue resolution.
                Are you sure you want to continue without attaching any files?
              </p>
              <button
                onClick={onNext}
                className="mt-2 px-4 py-1.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded hover:bg-yellow-200 dark:hover:bg-yellow-700 transition-colors"
              >
                Continue without files
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-6">
        <button onClick={onPrev} className="tb-btn-secondary">Back</button>
        <button
          onClick={() => {
            if (data.files.length === 0 && !showNoFilesWarning) {
              setShowNoFilesWarning(true);
              return;
            }
            onNext();
          }}
          className="tb-btn-primary px-6"
        >
          Next
        </button>
      </div>
    </div>
  );
}
