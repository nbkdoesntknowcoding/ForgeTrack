import React from 'react';
import { AuthProvider } from './context/AuthContext';
import {
  createBrowserRouter,
  RouterProvider,
  createRoutesFromElements,
  Route,
} from 'react-router-dom';
import { format } from 'date-fns';

import RoleGuard, { RoleRedirect } from './components/RoleGuard';
import Layout from './components/Layout';

import Login from './pages/Login';
import Forbidden from './pages/Forbidden';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Materials from './pages/Materials';
import Upload from './pages/Upload';
import Assignments from './pages/Assignments';
import AssignmentDetail from './pages/AssignmentDetail';
import SessionsHub from './pages/SessionsHub';
import MarkingView from './pages/MarkingView';
import CreateSessionDialog from './components/CreateSessionDialog';
import StudentAttendance from './pages/StudentAttendance';
import StudentUpcoming from './pages/StudentUpcoming';
import StudentMaterials from './pages/StudentMaterials';
import StudentAssignments from './pages/StudentAssignments';
import Account from './pages/Account';

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route path="/login" element={<Login />} />
      <Route path="/403" element={<Forbidden />} />

      <Route path="/" element={<RoleGuard />}>
        <Route index element={<RoleRedirect />} />

        <Route element={<Layout />}>
          {/* Mentor */}
          <Route element={<RoleGuard allowedRoles={['mentor']} />}>
            <Route
              path="dashboard"
              element={<Dashboard />}
              handle={{ crumb: () => ({ group: 'Overview', label: 'Dashboard' }) }}
            />
            <Route
              path="attendance"
              element={<SessionsHub />}
              handle={{ crumb: () => ({ group: 'Activity', label: 'Mark Attendance' }) }}
            >
              <Route path="new" element={<CreateSessionDialog />} />
            </Route>
            <Route
              path="attendance/:date"
              element={<MarkingView />}
              handle={{
                crumb: (m) => ({
                  group: 'Activity',
                  label: m.params.date ? format(new Date(m.params.date), 'MMM d, yyyy') : 'Session',
                }),
              }}
            />
            <Route
              path="history"
              element={<History />}
              handle={{ crumb: () => ({ group: 'Activity', label: 'Student History' }) }}
            />
            <Route
              path="materials"
              element={<Materials />}
              handle={{ crumb: () => ({ group: 'Activity', label: 'Materials' }) }}
            />
            <Route
              path="upload"
              element={<Upload />}
              handle={{ crumb: () => ({ group: 'Data', label: 'Upload CSV' }) }}
            />
            <Route
              path="assignments"
              element={<Assignments />}
              handle={{ crumb: () => ({ group: 'Activity', label: 'Assignments' }) }}
            />
            <Route
              path="assignments/:id"
              element={<AssignmentDetail />}
              handle={{ crumb: () => ({ group: 'Activity', label: 'Assignment' }) }}
            />
          </Route>

          {/* Student */}
          <Route element={<RoleGuard allowedRoles={['student']} />}>
            <Route
              path="me/attendance"
              element={<StudentAttendance />}
              handle={{ crumb: () => ({ group: 'My Portal', label: 'My Attendance' }) }}
            />
            <Route
              path="me/upcoming"
              element={<StudentUpcoming />}
              handle={{ crumb: () => ({ group: 'My Portal', label: 'Upcoming' }) }}
            />
            <Route
              path="me/materials"
              element={<StudentMaterials />}
              handle={{ crumb: () => ({ group: 'My Portal', label: 'Materials' }) }}
            />
            <Route
              path="me/assignments"
              element={<StudentAssignments />}
              handle={{ crumb: () => ({ group: 'My Portal', label: 'Assignments' }) }}
            />
          </Route>

          <Route
            path="me/account"
            element={<Account />}
            handle={{ crumb: () => ({ group: 'Account', label: 'Account' }) }}
          />
        </Route>
      </Route>
    </Route>
  )
);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
