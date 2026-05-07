import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Step5Done({ result, onAnother }) {
  const ok = result?.status === 'completed';
  return (
    <div className="card rounded-2xl p-10 text-center max-w-xl mx-auto space-y-4">
      {ok ? (
        <CheckCircle2 className="mx-auto text-success-fg" size={42} />
      ) : (
        <AlertTriangle className="mx-auto text-warning-fg" size={42} />
      )}
      <h2 className="text-h2 text-primary">
        {ok ? 'Import complete' : 'Import partially completed'}
      </h2>
      <div className="text-body-sm text-secondary space-y-1">
        <p>{result.imported_students} students upserted</p>
        <p>{result.imported_attendance} attendance records written</p>
        <p className="text-caption text-tertiary">Import log id: {result.import_id}</p>
      </div>

      {result.warnings?.length > 0 && (
        <details className="text-left">
          <summary className="text-body-sm text-tertiary cursor-pointer">
            {result.warnings.length} warnings
          </summary>
          <ul className="mt-2 space-y-1 text-caption text-secondary">
            {result.warnings.map((w, i) => <li key={i}>• {w}</li>)}
          </ul>
        </details>
      )}

      <div className="flex gap-3 justify-center pt-2">
        <Link to="/dashboard" className="btn-secondary">Go to dashboard</Link>
        <button onClick={onAnother} className="btn-primary">Import another</button>
      </div>
    </div>
  );
}
