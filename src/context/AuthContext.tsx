import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { AuthUser, AuthSessionState } from '../types';

interface AuthContextType extends AuthSessionState {
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  authFetch: (url: string, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'cg_pds_auth_token';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY) || null;
  });
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Authenticated fetch wrapper
  const authFetch = useCallback(async (url: string, init?: RequestInit): Promise<Response> => {
    const currentToken = token || localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    const headers = new Headers(init?.headers || {});

    if (currentToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${currentToken}`);
    }

    const response = await fetch(url, {
      ...init,
      headers
    });

    // Auto-handle 401 Unauthorized (session expired)
    if (response.status === 401 && !url.includes('/api/auth/login')) {
      // Check if it's an auth error response
      const clone = response.clone();
      try {
        const body = await clone.json();
        if (body.authRequired || body.status === 'unauthorized') {
          console.warn('[Auth] Session invalidated or unauthorized access.');
          setToken(null);
          setUser(null);
          localStorage.removeItem(STORAGE_KEY);
          sessionStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        // Ignore json parse error on 401
      }
    }

    return response;
  }, [token]);

  // Verify active token on mount
  useEffect(() => {
    let isMounted = true;
    const verifyExistingToken = async () => {
      const storedToken = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      if (!storedToken) {
        if (isMounted) {
          setIsLoading(false);
          setToken(null);
          setUser(null);
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${storedToken}`
          }
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.authenticated && data.user) {
            setToken(storedToken);
            setUser(data.user);
          }
        } else {
          if (isMounted) {
            localStorage.removeItem(STORAGE_KEY);
            sessionStorage.removeItem(STORAGE_KEY);
            setToken(null);
            setUser(null);
          }
        }
      } catch (err) {
        console.error('[Auth] Failed to verify session on startup:', err);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    verifyExistingToken();

    const handleUnauthorizedEvent = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('auth:unauthorized', handleUnauthorizedEvent);

    return () => {
      isMounted = false;
      window.removeEventListener('auth:unauthorized', handleUnauthorizedEvent);
    };
  }, []);

  // Login handler
  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok && data.success && data.token) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem(STORAGE_KEY, data.token);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed. Please check your credentials.' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Network connection failed while attempting login.' };
    }
  };

  // Logout handler
  const logout = async (): Promise<void> => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (err) {
      console.error('[Auth] Logout error:', err);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  // Change password handler
  const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Failed to update password' };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Request failed' };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: Boolean(token && user),
        token,
        user,
        isLoading,
        login,
        logout,
        changePassword,
        authFetch
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
