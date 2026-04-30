import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, CheckSquare, Users, BookOpen, Upload,
  UserCheck, Calendar, LogOut, Hexagon, ClipboardList
} from 'lucide-react';

export default function Sidebar() {
  const { userRole, logout, userData } = useAuth();
  
  const mentorNav = [
    { label: 'Overview', items: [{ name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }] },
    { label: 'Activity', items: [
      { name: 'Mark Attendance', path: '/attendance', icon: CheckSquare },
      { name: 'Student History', path: '/history', icon: Users },
      { name: 'Materials', path: '/materials', icon: BookOpen },
      { name: 'Assignments', path: '/assignments', icon: ClipboardList },
    ]},
    { label: 'Data', items: [{ name: 'Upload CSV', path: '/upload', icon: Upload }] }
  ];

  const studentNav = [
    { label: 'My Portal', items: [
      { name: 'My Attendance', path: '/me/attendance', icon: UserCheck },
      { name: 'Upcoming', path: '/me/upcoming', icon: Calendar },
      { name: 'Materials', path: '/me/materials', icon: BookOpen },
      { name: 'Assignments', path: '/me/assignments', icon: ClipboardList },
    ]}
  ];

  const sections = userRole === 'mentor' ? mentorNav : studentNav;

  return (
    <div className="w-[260px] h-screen fixed left-0 top-0 border-r border-border-subtle bg-canvas hidden md:flex flex-col z-20">
      <div className="p-6 pb-2 border-b border-border-subtle flex items-center gap-3">
        <Hexagon className="text-accent-glow" size={24} />
        <span className="text-h2 text-primary">ForgeTrack</span>
      </div>
      
      <div className="p-4 border-b border-border-subtle">
        <p className="text-body-sm text-secondary">Welcome Back,</p>
        <p className="text-body font-medium text-primary mt-1">{userData?.display_name || 'Loading...'}</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {sections.map((sec, idx) => (
          <div key={idx}>
            <p className="text-label text-tertiary mb-3 px-2">{sec.label}</p>
            <div className="space-y-1">
              {sec.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-lg text-body transition-colors ${
                        isActive
                          ? 'bg-surface-raised text-primary border-l-2 border-accent-glow'
                          : 'text-secondary hover:bg-surface hover:text-primary border-l-2 border-transparent'
                      }`
                    }
                  >
                    <Icon size={20} strokeWidth={1.75} />
                    {item.name}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border-subtle">
        <p className="text-label text-tertiary mb-3 px-2">ACCOUNT</p>
        <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-body text-secondary hover:bg-surface hover:text-primary transition-colors">
          <LogOut size={20} strokeWidth={1.75} />
          Logout
        </button>
      </div>
    </div>
  );
}
