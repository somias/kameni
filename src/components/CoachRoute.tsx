import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function CoachRoute({ children }: { children: React.ReactNode }) {
  const { user, userData, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (userData?.role !== 'coach') return <Navigate to="/schedule" replace />;

  return <>{children}</>;
}
