import { useEffect } from 'react';

export function useDismiss(ref, onClose, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handlePointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ref, onClose, enabled]);
}
