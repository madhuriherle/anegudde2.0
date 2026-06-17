import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';
import NoAccessPage from '../pages/NoAccessPage';

const ProtectedRoute = ({ children, requiredPermission, requiredRank }) => {
  const { token, user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>);

  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredPermission) {
    const requiredPermissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const hasPermission =
      user.is_all_access ||
      requiredPermissions.some((permission) => user.privileges?.includes(permission));
    if (!hasPermission) {
      return <NoAccessPage />;
    }
  }

  if (requiredRank && (user.role_rank_level ?? 99) > requiredRank) {
    return <NoAccessPage />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
