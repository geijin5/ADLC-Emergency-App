import React, { createContext, useState, useContext, useEffect } from 'react';
import { verifyAuth } from '../api/api';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      
      if (token && userData) {
        try {
          // Validate token with server
          const response = await verifyAuth();
          if (response.data) {
            // Token is valid, update user data
            setUser(response.data);
            localStorage.setItem('user', JSON.stringify(response.data));
          }
        } catch (err) {
          // Token is invalid or expired
          console.log('Token validation failed, clearing auth data');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();

    // Listen for storage changes (e.g., when token is cleared by interceptor)
    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'user') {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        if (token && userData) {
          setUser(JSON.parse(userData));
        } else {
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = {
    user,
    login,
    logout,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

