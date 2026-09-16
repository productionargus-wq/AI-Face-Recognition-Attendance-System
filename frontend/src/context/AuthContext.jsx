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

  const googleLogin = async (googleUserData) => {
    const res = await api.post('/auth/google-login', googleUserData);
    localStorage.setItem('argus_token', res.data.access_token);
    setUser(res.data.user);
    setOrganization(res.data.organization);
    return res.data;
  };

  const googleRegisterOrg = async (formData) => {
    const res = await api.post('/auth/google-register-org', formData);
    localStorage.setItem('argus_token', res.data.access_token);
    setUser(res.data.user);
    setOrganization(res.data.organization);
    return res.data;
  };

  const updateOrganization = (newOrgData) => {
    setOrganization(prev => prev ? ({ ...prev, ...newOrgData }) : newOrgData);
  };

  const logout = () => {
    localStorage.removeItem('argus_token');
    localStorage.removeItem('argus_last_email');
    setUser(null);
    setOrganization(null);
  };

  return (
    <AuthContext.Provider value={{ user, organization, setOrganization, updateOrganization, loading, login, registerOrg, googleLogin, googleRegisterOrg, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);