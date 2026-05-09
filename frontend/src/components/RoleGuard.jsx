import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleGuard({ allowedRoles }) {
  const { session, userRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-void text-primary">
        <div className="text-secondary text-body">Loading workspace...</div>
      </div>
    );
  }

  // Not logged in -> send to login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Unauthorized role -> send to 403 Forbidden
  if (allowedRoles && userRole && !allowedRoles.includes(userRole)) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}

// Redirects users visiting the root ('/') to their default dashboards
export function RoleRedirect() {
  const { session, userRole, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-void"></div>;
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (userRole === 'mentor') {
    return <Navigate to="/dashboard" replace />;
  } else if (userRole === 'student') {
    return <Navigate to="/me" replace />;
  }

  return <Navigate to="/login" replace />;
}
