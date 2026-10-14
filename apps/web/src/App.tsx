import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useCurrentUser } from './hooks/useCurrentUser';
import AppShell from './components/AppShell';
import AuthScreen from './features/auth/AuthScreen';
import InviteFlow from './features/invites/InviteFlow';
import Spinner from './components/ui/Spinner';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--canvas, #0B0D0E)',
        }}
      >
        <Spinner size={32} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function RootRedirect() {
  const { isAuthenticated, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: 'var(--canvas, #0B0D0E)',
        }}
      >
        <Spinner size={32} />
      </div>
    );
  }

  return <Navigate to={isAuthenticated ? '/app' : '/auth'} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/auth" element={<AuthScreen />} />
      <Route path="/invite/:token" element={<InviteFlow />} />

      {/* Protected App Routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/spaces/:spaceId"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/spaces/:spaceId/channels/:channelId"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
