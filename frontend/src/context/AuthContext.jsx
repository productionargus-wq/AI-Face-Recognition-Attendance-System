import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('argus_token');
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.get('/auth/me');
        setUser(res.data.user);
        setOrganization(res.data.organization);
      } catch (err) {
        console.error('Auth verification failed', err);
        localStorage.removeItem('argus_token');
        setUser(null);
        setOrganization(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (email, password = null) => {
    const payload = password ? { email, password } : { email };
    const res = await api.post('/auth/login', payload);
    localStorage.setItem('argus_token', res.data.access_token);
    setUser(res.data.user);
    setOrganization(res.data.organization);
    return res.data;
  };

  const registerOrg = async (formData) => {
    const res = await api.post('/auth/register-organization', formData);
    localStorage.setItem('argus_token', res.data.access_token);
    setUser(res.data.user);
    setOrganization(res.data.organization);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('argus_token');
    setUser(null);
    setOrganization(null);
  };

  return (
    <AuthContext.Provider value={{ user, organization, loading, login, registerOrg, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);