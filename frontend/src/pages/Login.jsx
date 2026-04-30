import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hexagon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [isMentor, setIsMentor] = useState(true);
  const [identifier, setIdentifier] = useState(''); // Email or USN
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const email = isMentor ? identifier.trim() : `${identifier.trim()}@forge.local`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      // If successful, the AuthContext listener updates the user session 
      // and RoleGuard/RoleRedirect handles routing. But as a fallback we could redirect manually.
      // Wait for session. RoleRedirect is preferred if we navigate to "/".
      navigate('/');
      
    } catch (err) {
      setErrorMsg(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-void flex items-center justify-center relative">
      <div className="absolute top-0 w-full h-[400px] pointer-events-none" style={{ backgroundImage: 'var(--glow-cosmic)' }}></div>
      
      <div className="w-full max-w-[440px] z-10 px-6">
        <div className="flex flex-col items-center mb-8">
          <Hexagon className="text-accent-glow mb-4" size={40} strokeWidth={1.5} />
          <h2 className="text-h2 text-primary">Sign in to ForgeTrack</h2>
        </div>

        <div className="card p-8 bg-surface rounded-2xl">
          <div className="flex bg-surface-inset p-1 rounded-lg mb-8 border border-border-default">
            <button
              type="button"
              onClick={() => setIsMentor(true)}
              className={`flex-1 py-2 text-body-sm font-medium rounded-md transition-colors ${
                isMentor ? 'bg-surface-raised text-primary shadow-sm' : 'text-secondary hover:text-primary'
              }`}
            >
              Mentor Login
            </button>
            <button
              type="button"
              onClick={() => setIsMentor(false)}
              className={`flex-1 py-2 text-body-sm font-medium rounded-md transition-colors ${
                !isMentor ? 'bg-surface-raised text-primary shadow-sm' : 'text-secondary hover:text-primary'
              }`}
            >
              Student Login
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-label text-secondary mb-2 block tracking-wider">
                {isMentor ? 'EMAIL ADDRESS' : 'UNIVERSITY SEAT NUMBER (USN)'}
              </label>
              <input
                type={isMentor ? 'email' : 'text'}
                className={`input w-full ${errorMsg ? 'border-danger-border' : ''}`}
                placeholder={isMentor ? 'mentor@theboringpeople.in' : '4SH24CS001'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>

            <div>
              <div className="flex justify-between items-end mb-2">
                <label className="text-label text-secondary tracking-wider">PASSWORD</label>
                {isMentor && (
                  <button type="button" className="text-caption text-accent-glow hover:underline">
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                type="password"
                className={`input w-full ${errorMsg ? 'border-danger-border' : ''}`}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {errorMsg && (
              <p className="text-caption text-danger-fg text-center">{errorMsg}</p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
