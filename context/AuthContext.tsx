import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthUser } from '../navigation';

type AuthContextType = {
  user: AuthUser | null;
  authReady: boolean;
  signIn: (user: AuthUser) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  authReady: false,
  signIn: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const LEGACY_KEYS = ['user_id', 'userId', 'userInfo', 'token', 'isAuthenticated'];

function userFromPayload(data: { id?: unknown; username?: unknown; fullname?: unknown; display_name?: unknown }): AuthUser | null {
  if (data.id == null || data.id === '') return null;
  const fullname =
    typeof data.fullname === 'string' && data.fullname.trim()
      ? data.fullname
      : typeof data.display_name === 'string'
        ? data.display_name
        : undefined;
  return {
    id: String(data.id),
    username: typeof data.username === 'string' ? data.username : undefined,
    fullname,
  };
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);

    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (response.ok && data.success && data.data?.id) {
          setUser(userFromPayload(data.data));
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setAuthReady(true);
      }
    };

    void checkAuth();
  }, []);

  const signIn = (next: AuthUser) => {
    setUser(next);
  };

  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout API call failed:', error);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, authReady, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
