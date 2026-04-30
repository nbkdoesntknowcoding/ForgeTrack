import React, { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';
import Dialog from './Dialog';

// Wraps a marking-style view; pops a confirmation modal when the user tries to
// navigate away (in-app via useBlocker, browser-level via beforeunload) while
// `dirty` is true. Optional `onSave` runs the save and proceeds.
export default function UnsavedChangesGuard({ dirty, onSave, children }) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (!dirty) return;
    const onBefore = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBefore);
    return () => window.removeEventListener('beforeunload', onBefore);
  }, [dirty]);

  const blocking = blocker.state === 'blocked';

  return (
    <>
      {children}
      {blocking && (
        <Dialog
          open
          title="Unsaved changes"
          subtitle="You have unsaved attendance edits. Save before leaving?"
          onClose={() => blocker.reset?.()}
          maxWidth="max-w-md"
          footer={
            <>
              <button className="btn-secondary" onClick={() => blocker.reset?.()}>
                Stay
              </button>
              <button
                className="btn-secondary"
                onClick={() => blocker.proceed?.()}
              >
                Discard
              </button>
              {onSave && (
                <button
                  className="btn-primary"
                  onClick={async () => {
                    try {
                      await onSave();
                      blocker.proceed?.();
                    } catch {
                      blocker.reset?.();
                    }
                  }}
                >
                  Save & exit
                </button>
              )}
            </>
          }
        >
          <p className="text-body text-secondary">
            Discarding will lose any toggles since your last save.
          </p>
        </Dialog>
      )}
    </>
  );
}
