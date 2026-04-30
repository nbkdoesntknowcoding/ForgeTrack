import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, LogOut, User as UserIcon, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useDismiss } from '../lib/useDismiss';
import Breadcrumbs from './Breadcrumbs';

export default function TopBar() {
  const { userData, logout } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ students: [], sessions: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const searchRef = useRef(null);
  const menuRef = useRef(null);

  useDismiss(searchRef, () => setSearchOpen(false), searchOpen);
  useDismiss(menuRef, () => setMenuOpen(false), menuOpen);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults({ students: [], sessions: [] });
      return;
    }
    const timer = setTimeout(async () => {
      const [studentsRes, sessionsRes] = await Promise.all([
        supabase.from('students').select('id, name, usn, branch_code').or(`name.ilike.%${q}%,usn.ilike.%${q}%`).limit(5),
        supabase.from('sessions').select('id, date, topic').ilike('topic', `%${q}%`).limit(5),
      ]);
      setResults({ students: studentsRes.data || [], sessions: sessionsRes.data || [] });
      setSearchOpen(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const initial = userData?.display_name?.charAt(0) || '?';

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className="h-16 flex items-center justify-between px-8 lg:px-14 xl:px-20 z-20 relative border-b border-border-subtle">
      <Breadcrumbs />

      <div className="flex items-center gap-4">
        <div ref={searchRef} className="relative w-72 hidden sm:block">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim().length >= 2 && setSearchOpen(true)}
            className="input w-full pl-10 h-10 text-body"
            placeholder="Search students, sessions…"
          />
          {searchOpen && (results.students.length > 0 || results.sessions.length > 0) && (
            <div className="absolute top-12 left-0 right-0 bg-surface-raised border border-border-default rounded-xl shadow-raised overflow-hidden">
              {results.students.length > 0 && (
                <div className="py-2">
                  <p className="px-4 py-1 text-label text-tertiary uppercase">Students</p>
                  {results.students.map((s) => (
                    <Link
                      key={`stu-${s.id}`}
                      to={`/history?student=${s.id}`}
                      onClick={() => { setSearchOpen(false); setQuery(''); }}
                      className="block px-4 py-2 hover:bg-surface text-body text-primary"
                    >
                      <span>{s.name}</span>
                      <span className="text-caption text-tertiary ml-2">{s.usn} · {s.branch_code}</span>
                    </Link>
                  ))}
                </div>
              )}
              {results.sessions.length > 0 && (
                <div className="py-2 border-t border-border-subtle">
                  <p className="px-4 py-1 text-label text-tertiary uppercase">Sessions</p>
                  {results.sessions.map((s) => (
                    <Link
                      key={`ses-${s.id}`}
                      to={`/attendance?date=${s.date}`}
                      onClick={() => { setSearchOpen(false); setQuery(''); }}
                      className="block px-4 py-2 hover:bg-surface text-body text-primary"
                    >
                      <span>{s.topic}</span>
                      <span className="text-caption text-tertiary ml-2">{s.date}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 hover:bg-surface rounded-md py-1.5 px-2 transition-colors"
          >
            <span className="text-body-sm text-secondary hidden sm:block">{userData?.display_name || '?'}</span>
            <div className="w-8 h-8 rounded-full bg-surface-raised border border-border-subtle flex items-center justify-center text-body-sm text-primary font-medium">
              {initial}
            </div>
            <ChevronDown size={14} className="text-tertiary hidden sm:block" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 w-64 bg-surface-raised border border-border-default rounded-xl shadow-raised overflow-hidden">
              <div className="p-4 border-b border-border-subtle">
                <p className="text-body text-primary font-medium">{userData?.display_name}</p>
                <p className="text-caption text-tertiary mt-0.5">{userData?.email}</p>
                <p className="text-caption text-tertiary mt-1 capitalize">{userData?.role}</p>
              </div>
              <Link
                to="/me/account"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2.5 text-body text-primary hover:bg-surface"
              >
                <UserIcon size={16} className="text-tertiary" /> Account settings
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-body text-primary hover:bg-surface text-left"
              >
                <LogOut size={16} className="text-tertiary" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
