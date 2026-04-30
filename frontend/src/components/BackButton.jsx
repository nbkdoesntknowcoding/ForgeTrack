import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function BackButton({ fallback = '/attendance', label = 'Back' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const target = location.state?.from || fallback;

  return (
    <button
      type="button"
      onClick={() => navigate(target)}
      className="inline-flex items-center gap-2 text-secondary hover:text-primary text-body-sm transition-colors"
    >
      <ArrowLeft size={16} /> {label}
    </button>
  );
}
