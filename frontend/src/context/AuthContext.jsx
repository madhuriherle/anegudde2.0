import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';




















const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    let savedToken = null;
    try { savedToken = localStorage.getItem('token'); } catch {}
    return savedToken === 'null' || savedToken === 'undefined' ? null : savedToken;
  });
  const [isLoading, setIsLoading] = useState(true);

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
    try { localStorage.setItem('token', newToken); } catch {}
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
      try { localStorage.removeItem('token'); } catch {}
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
