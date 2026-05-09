import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, CheckSquare, Users, BookOpen, Upload,
  UserCheck, Calendar, LogOut, Hexagon, ClipboardList, Award, Trophy
} from 'lucide-react';

export default function Sidebar() {
  const { userRole, logout } = useAuth();

  const mentorNav = [
    { label: 'Overview', items: [{ name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }] },
    { label: 'Activity', items: [
      { name: 'Mark Attendance', path: '/attendance', icon: CheckSquare },
      { name: 'Student History', path: '/history', icon: Users },
      { name: 'Materials', path: '/materials', icon: BookOpen },
      { name: 'Assignments', path: '/assignments', icon: ClipboardList },
      { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
    ]},
    { label: 'Data', items: [{ name: 'Upload CSV', path: '/upload', icon: Upload }] }
  ];

  const studentNav = [
    { label: 'My Portal', items: [
      { name: 'Overview', path: '/me', icon: LayoutDashboard, exact: true },
      { name: 'My Attendance', path: '/me/attendance', icon: UserCheck },
      { name: 'Upcoming', path: '/me/upcoming', icon: Calendar },
      { name: 'Assignments', path: '/me/assignments', icon: ClipboardList },
      { name: 'Materials', path: '/me/materials', icon: BookOpen },
      { name: 'Results', path: '/me/results', icon: Award },
      { name: 'Leaderboard', path: '/leaderboard', icon: Trophy },
    ]}
  ];

  const sections = userRole === 'mentor' ? mentorNav : studentNav;
  const tag = userRole === 'mentor' ? 'MENTOR' : 'STUDENT';

  return (
    <div className="w-[260px] h-screen fixed left-0 top-0 border-r-3 border-border-strong bg-canvas hidden md:flex flex-col z-20">
      {/* Logo */}
      <div className="p-5 border-b-3 border-border-strong flex items-center gap-3">
        <div className="w-9 h-9 bg-accent-glow border-3 border-black shadow-brut-sm flex items-center justify-center">
          <Hexagon className="text-void" size={20} strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <span className="text-h2 text-primary tracking-tight">FORGE</span>
          <span className="text-h2 text-accent-glow tracking-tight">TRACK</span>
        </div>
      </div>

      {/* Role tag */}
      <div className="px-5 py-3 border-b-3 border-border-strong">
        <span className="pill text-caption text-accent-glow border-accent-glow">{tag}</span>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {sections.map((sec, idx) => (
          <div key={idx}>
            <p className="text-label text-tertiary mb-2 px-2">{sec.label}</p>
            <div className="space-y-1">
              {sec.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.exact}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 text-body transition-colors border-l-3 ${
                        isActive
                          ? 'bg-accent-glow/10 text-primary border-accent-glow'
                          : 'text-secondary hover:bg-surface-raised hover:text-primary border-transparent'
                      }`
                    }
                  >
                    <Icon size={18} strokeWidth={2} />
                    <span className={`text-body-sm`}>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Logout */}
      <div className="p-3 border-t-3 border-border-strong">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-body-sm text-secondary hover:bg-surface-raised hover:text-danger-fg transition-colors border-l-3 border-transparent"
        >
          <LogOut size={18} strokeWidth={2} />
          Logout
        </button>
      </div>
    </div>
  );
}
