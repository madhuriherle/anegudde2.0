import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogOut, Home } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { hasMainAccess } from '../utils/navigation';

const NoAccessPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const hasAccessToAnything = hasMainAccess(user) || (user?.privileges?.length > 0) || user?.is_all_access;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-border-temple bg-white p-8 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-error/10 text-error">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-bold text-text-main">Access Denied</h1>
        <p className="mt-3 text-base font-medium text-text-main/60">
          {!hasAccessToAnything 
            ? "You don't have access to any modules yet. Please contact your administrator to assign privileges."
            : "You do not have permission to view this specific page."}
        </p>
        
        <div className="mt-8 flex flex-col gap-3">
          {hasAccessToAnything ? (
            <Button 
              type="button" 
              className="w-full flex items-center justify-center gap-2 h-11" 
              onClick={() => navigate('/')}>
              <Home className="h-4 w-4" />
              Go to Home
            </Button>
          ) : (
            <Button 
              type="button" 
              variant="outline"
              className="w-full flex items-center justify-center gap-2 h-11 border-error/20 text-error hover:bg-error/5 hover:text-error" 
              onClick={() => {
                logout();
                navigate('/login');
              }}>
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoAccessPage;
