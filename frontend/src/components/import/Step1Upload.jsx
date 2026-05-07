import React, { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet } from 'lucide-react';
import { peekFile } from '../../lib/importParse';

export default function Step1Upload({ onPicked }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handle = async (file) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const peek = await peekFile(file);
      onPicked({ file, peek });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-h2 text-primary">Upload spreadsheet</h2>
        <p className="text-body-sm text-secondary">
          .xlsx or .csv, up to 5 MB. Libraries handle parsing; AI only fills in ambiguous columns.
        </p>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handle(e.dataTransfer.files?.[0]);
        }}
        className={`block border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
          drag ? 'border-accent-glow bg-accent-glow/5' : 'border-border-subtle hover:border-accent-glow'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={(e) => handle(e.target.files?.[0])}
        />
        <UploadCloud className="mx-auto text-accent-glow mb-3" size={36} />
        <p className="text-body text-primary mb-1">
          {busy ? 'Reading file…' : 'Click to choose or drag a file here'}
        </p>
        <p className="text-caption text-tertiary">.xlsx or .csv · max 5 MB</p>
      </label>

      {error && (
        <div className="card p-4 rounded-xl border border-danger-fg/40 bg-danger-fg/10 flex items-start gap-3">
          <FileSpreadsheet className="text-danger-fg shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-body-sm text-primary font-medium">Couldn't read this file</p>
            <p className="text-caption text-secondary mt-1">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
