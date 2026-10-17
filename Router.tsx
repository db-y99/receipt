import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import App from './App';
import DueSoonPage from './DueSoonPage';
import LoginPage from './components/LoginPage';
import { useAuth } from './context/AuthContext';
import { replacePath } from './navigation';

function getPathname(): string {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

function AuthSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  );
}

const Router: React.FC = () => {
  const { user, authReady } = useAuth();
  const [path, setPath] = useState(getPathname);

  useEffect(() => {
    const onPopState = () => setPath(getPathname());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (user && path === '/login') {
      replacePath('/');
      return;
    }
    if (!user && path !== '/login') {
      replacePath('/login');
    }
  }, [authReady, user, path]);

  if (!authReady) return <AuthSpinner />;

  if (path === '/login') {
    if (user) return <AuthSpinner />;
    return <LoginPage />;
  }

  if (!user) return <AuthSpinner />;
  if (path === '/due-soon') return <DueSoonPage />;
  return <App />;
};

export default Router;
