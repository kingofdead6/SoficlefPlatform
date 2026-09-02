import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './AuthContext.jsx';
import { can } from '../lib/permissions.js';

/**
 * The client-side guard, mirroring the source app's `(app)/layout.tsx`:
 *   1. No session -> /login
 *   2. PENDING_ASSIGNMENT -> /pending (unless the route itself is /pending)
 *   3. Not permitted -> redirect to /app/me (the closest thing to a safe home)
 *
 * This is a courtesy for the UI; the Express API re-checks every request.
 */
export function ProtectedRoute({ requires }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="p-8 text-text-dim">Chargement…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  if (user.lifecycleState === 'PENDING_ASSIGNMENT' && location.pathname !== '/pending') {
    return <Navigate to="/pending" replace />;
  }

  if (requires && !can(user, requires.action, requires.resource)) {
    return <Navigate to="/app/me" replace />;
  }

  return <Outlet />;
}
