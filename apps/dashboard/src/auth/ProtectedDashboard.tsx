import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export function ProtectedDashboard({ children }: { children: ReactNode }) {
  const { status, profile } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div className="auth-loading" role="status">Checking your BopIt session…</div>;
  if (status !== 'authenticated' || !profile) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (location.pathname.startsWith('/creator') && profile.role !== 'creator') return <Navigate to="/retail" replace />;
  if (location.pathname.startsWith('/retail') && profile.role !== 'retailer') return <Navigate to="/creator" replace />;
  return children;
}
import type { ReactNode } from 'react';
