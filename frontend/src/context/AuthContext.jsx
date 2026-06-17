import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';




















const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    let savedToken = null;
    try { 
      savedToken = localStorage.getItem('token'); 
      // Check for inactivity on startup
      const lastActivity = localStorage.getItem('lastActivity');
      if (savedToken && lastActivity) {
        const inactiveTime = Date.now() - parseInt(lastActivity, 10);
        if (inactiveTime > 3600000) { // 1 hour
          localStorage.removeItem('token');
          localStorage.removeItem('lastActivity');
          return null;
        }
      }
    } catch {}
    return savedToken === 'null' || savedToken === 'undefined' ? null : savedToken;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Inactivity tracking
  useEffect(() => {
    if (!token) return;

    const updateActivity = () => {
      localStorage.setItem('lastActivity', Date.now().toString());
    };

    const checkInactivity = () => {
      const lastActivity = localStorage.getItem('lastActivity');
      if (lastActivity) {
        const inactiveTime = Date.now() - parseInt(lastActivity, 10);
        if (inactiveTime > 3600000) { // 1 hour
          console.log('Session timed out due to inactivity');
          logout();
        }
      }
    };

    // Initial activity set
    updateActivity();

    // Listeners for user activity
    window.addEventListener('mousedown', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('scroll', updateActivity);
    window.addEventListener('touchstart', updateActivity);

    // Periodic check
    const interval = setInterval(checkInactivity, 60000); // Every minute

    return () => {
      window.removeEventListener('mousedown', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
      clearInterval(interval);
    };
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/get_current_user_profile');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user', error);
      if (error.response?.status === 401) {
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
    setToken(newToken);
    await fetchUser();
  };

  const logout = async () => {
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
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, fetchUser, isLoading }}>
      {children}
    </AuthContext.Provider>);

};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
