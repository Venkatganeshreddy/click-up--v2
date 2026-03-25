import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Board from './pages/Board';
import MyTasks from './pages/MyTasks';
import Calendar from './pages/Calendar';
import Settings from './pages/Settings';
import Timeline from './pages/Timeline';
import Reports from './pages/Reports';
import TeamMembers from './pages/TeamMembers';
import Workspace from './pages/Workspace';
import Integrations from './pages/Integrations';
import SprintBoard from './pages/SprintBoard';
import SprintReports from './pages/SprintReports';
import Docs from './pages/Docs';
import Forms from './pages/Forms';
import FormView from './pages/FormView';
import DocView from './pages/DocView';
import DocLinkView from './pages/DocLinkView';
import PublicDocView from './pages/PublicDocView';
import PublicFormView from './pages/PublicFormView';
import AcceptInvite from './pages/AcceptInvite';
import Login from './pages/Login';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-[#0f1012]" />;
  }

  if (!user || !session) {
    const redirectTo = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTo)}`} replace />;
  }

  return children;
}

// Pages that guests/limited members are NOT allowed to access
const RESTRICTED_PATHS = ['/projects', '/timeline', '/reports', '/sprint-reports', '/integrations', '/team', '/settings'];

function GuestGuard({ children }: { children: JSX.Element }) {
  const { isGuest, isLimitedMember } = useAuth();
  const location = useLocation();

  if ((isGuest || isLimitedMember) && RESTRICTED_PATHS.some(p => location.pathname.startsWith(p))) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  return (
    <Routes>
      {/* Standalone pages (no layout) */}
      <Route path="/login" element={<Login />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />

      {/* Direct access to forms and docs (standalone, no sidebar) */}
      <Route path="/forms/public/:formId" element={<PublicFormView />} />
      <Route path="/form/:formId" element={<PublicFormView />} />
      <Route path="/forms/:formId" element={
        <ProtectedRoute>
          <FormView />
        </ProtectedRoute>
      } />
      <Route path="/docs/public/:docId" element={<PublicDocView />} />
      <Route path="/doc/:docId" element={<DocLinkView />} />
      <Route path="/docs/:docId" element={
        <ProtectedRoute>
          <DocView />
        </ProtectedRoute>
      } />

      {/* All Routes - No Auth Required */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="projects" element={<GuestGuard><Projects /></GuestGuard>} />
        <Route path="projects/:projectId" element={<GuestGuard><Board /></GuestGuard>} />
        <Route path="my-tasks" element={<MyTasks />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="timeline" element={<GuestGuard><Timeline /></GuestGuard>} />
        <Route path="reports" element={<GuestGuard><Reports /></GuestGuard>} />
        <Route path="team" element={<GuestGuard><TeamMembers /></GuestGuard>} />
        <Route path="workspace" element={<Workspace />} />
        <Route path="docs" element={<Docs />} />
        <Route path="forms" element={<Forms />} />
        <Route path="integrations" element={<GuestGuard><Integrations /></GuestGuard>} />
        <Route path="sprints" element={<SprintBoard />} />
        <Route path="sprint-reports" element={<GuestGuard><SprintReports /></GuestGuard>} />
        <Route path="settings" element={<GuestGuard><Settings /></GuestGuard>} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
