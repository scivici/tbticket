import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { auth as authApi } from '../api/client';

interface User {
  id: number;
  email: string;
  name: string;
  role: 'customer' | 'admin' | 'engineer';
  isAnonymous: boolean;
  engineerId?: number;
  isCompanyAdmin?: boolean;
  canCreateTickets?: boolean;
  companyTicketVisibility?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginAnonymous: (email: string, name?: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isEngineer: boolean;
  isStaff: boolean;
  isCompanyAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      authApi.me()
        .then(userData => setUser(userData))
        .catch(() => {
          localStorage.removeItem('token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const handleAuth = useCallback((response: { token: string; user: User }) => {
    localStorage.setItem('token', response.token);
    setToken(response.token);
    setUser(response.user);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    handleAuth(response);
    return response.user as User;
  }, [handleAuth]);

  const loginAnonymous = useCallback(async (email: string, name?: string) => {
    const response = await authApi.anonymous(email, name);
    handleAuth(response);
  }, [handleAuth]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      loginAnonymous,
      logout,
      isAdmin: user?.role === 'admin',
      isEngineer: user?.role === 'engineer',
      isStaff: user?.role === 'admin' || user?.role === 'engineer',
      isCompanyAdmin: !!user?.isCompanyAdmin,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
