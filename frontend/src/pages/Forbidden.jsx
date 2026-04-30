import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

export default function Forbidden() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-void flex flex-col items-center justify-center p-6 text-center">
      <div className="absolute top-0 w-full h-[400px] pointer-events-none" style={{ backgroundImage: 'var(--glow-cosmic)' }}></div>
      
      <div className="z-10 max-w-md card bg-surface p-10 rounded-2xl flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-danger-bg flex items-center justify-center mb-6">
          <ShieldAlert className="text-danger-fg" size={32} />
        </div>
        
        <h1 className="text-h1 text-primary mb-3">403 Forbidden</h1>
        <p className="text-body text-secondary mb-8 leading-relaxed">
          You don't have access to this page. This could be because your role does not permit access or the address is incorrect.
        </p>
        
        <button className="btn-primary w-full" onClick={() => navigate('/')}>
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
