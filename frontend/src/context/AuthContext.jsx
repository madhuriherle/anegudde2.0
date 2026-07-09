import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axios';

const TIMEOUT_WARNING_MS = 3480000;
const TIMEOUT_LOGOUT_MS = 3600000;
const COUNTDOWN_SECONDS = 120;

const AuthContext = createContext(undefined);

const TimeoutModal = ({ countdown, onDismiss }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-8 text-center space-y-6">
      <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
        <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Session Expiring Soon</h3>
        <p className="text-gray-600">
          You'll be logged out in <span className="font-bold text-amber-600">{countdown}</span> second{countdown !== 1 ? 's' : ''} due to inactivity.
        </p>
      </div>
      <button
        onClick={onDismiss}
        className="w-full px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
      >
        Stay Logged In
      </button>
    </div>
  </div>
);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    let savedToken = null;
    try { 
      savedToken = localStorage.getItem('token'); 
      const lastActivity = localStorage.getItem('lastActivity');
      if (savedToken && lastActivity) {
        const inactiveTime = Date.now() - parseInt(lastActivity, 10);
        if (inactiveTime > TIMEOUT_LOGOUT_MS) {
          localStorage.removeItem('token');
          localStorage.removeItem('lastActivity');
          sessionStorage.setItem('sessionExpiredMessage', 'Session expired due to inactivity. Please login again.');
          return null;
        }
      }
    } catch {}
    return savedToken === 'null' || savedToken === 'undefined' ? null : savedToken;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeoutCountdown, setTimeoutCountdown] = useState(COUNTDOWN_SECONDS);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState(() => {
    try {
      return sessionStorage.getItem('sessionExpiredMessage') || '';
    } catch {
      return '';
    }
  });
  const logoutRef = useRef(null);

  const setSessionExpired = useCallback((message = 'Session expired. Please login again.') => {
    try {
      sessionStorage.setItem('sessionExpiredMessage', message);
    } catch {}
    setSessionExpiredMessage(message);
  }, []);

  const clearSessionExpired = useCallback(() => {
    try {
      sessionStorage.removeItem('sessionExpiredMessage');
    } catch {}
    setSessionExpiredMessage('');
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await api.post('/auth/logout');
      }
    } catch (e) {
      console.error('Logout log failed', e);
    } finally {
      try { 
        localStorage.removeItem('token'); 
        localStorage.removeItem('lastActivity');
      } catch {}
      setToken(null);
      setUser(null);
      setShowTimeoutWarning(false);
    }
  }, [token]);

  logoutRef.current = logout;

  useEffect(() => {
    if (!showTimeoutWarning) return;
    if (timeoutCountdown <= 0) {
      logoutRef.current();
      return;
    }
    const timer = setTimeout(() => {
      setTimeoutCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [showTimeoutWarning, timeoutCountdown]);

  useEffect(() => {
    const handleSessionExpired = () => {
      try {
        setSessionExpiredMessage(sessionStorage.getItem('sessionExpiredMessage') || 'Session expired. Please login again.');
      } catch {
        setSessionExpiredMessage('Session expired. Please login again.');
      }
      setToken(null);
      setUser(null);
      setShowTimeoutWarning(false);
    };

    window.addEventListener('session-expired', handleSessionExpired);
    return () => window.removeEventListener('session-expired', handleSessionExpired);
  }, []);

  const dismissTimeoutWarning = useCallback(() => {
    setShowTimeoutWarning(false);
    setTimeoutCountdown(COUNTDOWN_SECONDS);
    localStorage.setItem('lastActivity', Date.now().toString());
  }, []);

  useEffect(() => {
    if (!token) return;

    const updateActivity = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
      if (showTimeoutWarning) {
        dismissTimeoutWarning();
      }
    };

    const checkInactivity = () => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (lastActivity) {
        const inactiveTime = Date.now() - parseInt(lastActivity, 10);
        if (inactiveTime > TIMEOUT_LOGOUT_MS) {
          console.log('Session timed out due to inactivity');
          setSessionExpired('Session expired due to inactivity. Please login again.');
          logoutRef.current();
        } else if (inactiveTime > TIMEOUT_WARNING_MS && !showTimeoutWarning) {
          setShowTimeoutWarning(true);
          setTimeoutCountdown(COUNTDOWN_SECONDS);
        }
      }
    };

    updateActivity();

    window.addEventListener('mousedown', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('scroll', updateActivity);
    window.addEventListener('touchstart', updateActivity);

    const interval = setInterval(checkInactivity, 60000);

    return () => {
      window.removeEventListener('mousedown', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      clearInterval(interval);
    };
  }, [token, showTimeoutWarning, dismissTimeoutWarning]);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/get_current_user_profile');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user', error);
      if (error.response?.status === 401) {
        setSessionExpired();
        logout();
      } else {
        setUser(null);
      }
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      if (token) {
        await fetchUser();
      }
      setIsLoading(false);
    };
    initAuth();
  }, [token]);

  const login = async (newToken) => {
    try { 
      localStorage.setItem('token', newToken); 
      localStorage.setItem('lastActivity', Date.now().toString());
    } catch {}
    clearSessionExpired();
    setToken(newToken);
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, fetchUser, isLoading, sessionExpiredMessage, clearSessionExpired }}>
      {children}
      {showTimeoutWarning && (
        <TimeoutModal countdown={timeoutCountdown} onDismiss={dismissTimeoutWarning} />
      )}
    </AuthContext.Provider>);

};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
