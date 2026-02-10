import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useToast } from './context/ToastContext';
import { onForegroundMessage } from './lib/messaging';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import CoachRoute from './components/CoachRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WeeklySchedule from './pages/WeeklySchedule';
import MyBookings from './pages/MyBookings';
import CoachDashboard from './pages/CoachDashboard';
import ManageSlots from './pages/ManageSlots';
import MembersList from './pages/MembersList';
import SettingsPage from './pages/SettingsPage';

function DashboardRedirect() {
  const { userData, loading } = useAuth();
  if (loading) return null;
  if (userData?.role === 'coach') return <Navigate to="/coach" replace />;
  return <Navigate to="/schedule" replace />;
}

export default function App() {
  const { addToast } = useToast();

  useEffect(() => {
    return onForegroundMessage((payload) => {
      if (payload.title) {
        addToast(`${payload.title}: ${payload.body || ''}`, 'info');
      }
    });
  }, [addToast]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedule"
          element={
            <ProtectedRoute>
              <Layout><WeeklySchedule /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-bookings"
          element={
            <ProtectedRoute>
              <Layout><MyBookings /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/coach"
          element={
            <CoachRoute>
              <Layout><CoachDashboard /></Layout>
            </CoachRoute>
          }
        />
        <Route
          path="/coach/slots"
          element={
            <CoachRoute>
              <Layout><ManageSlots /></Layout>
            </CoachRoute>
          }
        />
        <Route
          path="/coach/members"
          element={
            <CoachRoute>
              <Layout><MembersList /></Layout>
            </CoachRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Layout><SettingsPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
