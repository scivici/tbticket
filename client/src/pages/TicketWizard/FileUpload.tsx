import React, { useCallback, useState } from 'react';
import { WizardData } from './WizardContainer';
import { Upload, X, FileText, Image } from 'lucide-react';

interface Props {
  data: WizardData;
  onUpdate: (partial: Partial<WizardData>) => void;
  onNext: () => void;
  onPrev: () => void;
}

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

export default function FileUpload({ data, onUpdate, onNext, onPrev }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    setError('');
    const arr = Array.from(newFiles);
    if (data.files.length + arr.length > MAX_FILES) { setError(`Maximum ${MAX_FILES} files allowed`); return; }
    for (const file of arr) { if (file.size > MAX_SIZE) { setError(`"${file.name}" exceeds 10MB limit`); return; } }
    onUpdate({ files: [...data.files, ...arr] });
  }, [data.files, onUpdate]);

  const removeFile = (index: number) => { onUpdate({ files: data.files.filter((_, i) => i !== index) }); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragActive(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Attach Files (Optional)</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Upload screenshots, logs, or SIP traces. Max 10MB per file, up to 5 files.</p>

      <div onDragOver={e => { e.preventDefault(); setDragActive(true); }} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragActive ? 'border-primary-500 bg-primary-500/10' : 'border-gray-300 dark:border-gray-600 hover:border-primary-400'
        }`}>
        <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
        <p className="text-gray-500 dark:text-gray-400 mb-2">Drag and drop files here, or</p>
        <label className="inline-flex items-center px-4 py-2 bg-white dark:bg-tb-card border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors">
          Browse Files
          <input type="file" multiple className="hidden" accept="image/*,.pdf,.txt,.csv,.log,.json,.zip,.pcap"
            onChange={e => e.target.files && addFiles(e.target.files)} />
        </label>
        <p className="text-xs text-gray-500 mt-2">PDF, images, text, log, JSON, PCAP, ZIP</p>
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

      <div className="flex justify-between mt-6">
        <button onClick={onPrev} className="tb-btn-secondary">Back</button>
        <button onClick={onNext} className="tb-btn-primary px-6">Next</button>
      </div>
    </div>
  );
}
