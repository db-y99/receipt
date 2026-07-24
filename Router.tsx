import React, { useEffect, useState } from 'react';
import App from './App';
import DueSoonPage from './DueSoonPage';

function getPathname(): string {
  return window.location.pathname.replace(/\/+$/, '') || '/';
}

const Router: React.FC = () => {
  const [path, setPath] = useState(getPathname);

  useEffect(() => {
    const onPopState = () => setPath(getPathname());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  if (path === '/due-soon') {
    return <DueSoonPage />;
  }

  return <App />;
};

export default Router;
