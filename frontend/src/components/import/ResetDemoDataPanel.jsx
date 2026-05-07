import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Dialog from '../Dialog';
import { resetData } from '../../lib/importWriter';

export default function ResetDemoDataPanel() {
  const [open, setOpen] = useState(false);
  const [scopes, setScopes] = useState({
    students: true, sessions: true, importLog: false, materials: false,
  });
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const canRun = confirm.trim().toUpperCase() === 'RESET' && Object.values(scopes).some(Boolean);

  const run = async () => {
    setBusy(true);
    try {
      const summary = await resetData(scopes);
      setResult(summary);
    } catch (err) {
      alert('Reset failed: ' + (err.message || String(err)));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setOpen(false);
    setConfirm('');
    setResult(null);
  };

  return (
    <details className="card rounded-2xl p-4 border border-danger-fg/30">
      <summary className="cursor-pointer text-body text-danger-fg inline-flex items-center gap-2">
        <AlertTriangle size={16} /> Danger zone
      </summary>
      <div className="pt-4 space-y-3">
        <p className="text-body-sm text-secondary">
          Wipe demo / seeded data. Use this once after your first real import.
        </p>
        <button
          onClick={() => setOpen(true)}
          className="btn-secondary inline-flex items-center gap-2 border-danger-fg/40 text-danger-fg hover:bg-danger-fg/10"
        >
          <Trash2 size={14} /> Reset demo data
        </button>
      </div>

      {open && (
        <Dialog
          open
          onClose={busy ? undefined : close}
          title="Reset demo data"
          subtitle="This permanently deletes the selected data. Cannot be undone."
          maxWidth="max-w-md"
          footer={
            result ? (
              <button onClick={close} className="btn-primary">Done</button>
            ) : (
              <>
                <button onClick={close} className="btn-secondary" disabled={busy}>Cancel</button>
                <button
                  onClick={run}
                  disabled={!canRun || busy}
                  className="btn-primary !bg-danger-fg !text-void hover:opacity-90"
                >
                  {busy ? 'Wiping…' : 'Wipe selected'}
                </button>
              </>
            )
          }
        >
          {result ? (
            <div className="space-y-2">
              <p className="text-body text-primary">Done.</p>
              <ul className="text-body-sm text-secondary space-y-1">
                {Object.entries(result).map(([k, v]) => (
                  <li key={k}>• {v} {k} rows deleted</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-label text-tertiary mb-2">SCOPE</legend>
                {[
                  ['students', 'Students (and their attendance)'],
                  ['sessions', 'Sessions'],
                  ['importLog', 'Import log (audit trail)'],
                  ['materials', 'Materials'],
                ].map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-body-sm text-primary">
                    <input
                      type="checkbox"
                      checked={scopes[k]}
                      onChange={(e) => setScopes({ ...scopes, [k]: e.target.checked })}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>

              <div>
                <label className="text-label text-tertiary block mb-1">
                  TYPE "RESET" TO CONFIRM
                </label>
                <input
                  type="text"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="input w-full"
                  autoFocus
                />
              </div>
            </div>
          )}
        </Dialog>
      )}
    </details>
  );
}
