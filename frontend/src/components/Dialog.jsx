import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Dialog({ open = true, onClose, title, subtitle, children, footer, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-void/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-surface-raised border border-border-default rounded-[24px] shadow-raised w-full ${maxWidth} max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start p-6 border-b border-border-subtle">
          <div>
            {title && <h2 className="text-h2 text-primary">{title}</h2>}
            {subtitle && <p className="text-body-sm text-secondary mt-1">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="text-secondary hover:text-primary transition-colors">
            <X size={22} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="p-6 border-t border-border-subtle flex justify-end gap-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
