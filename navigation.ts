export type AuthUser = {
  id: string;
  username?: string;
  fullname?: string;
};

export function displayName(user: AuthUser | null): string {
  if (!user) return '';
  return user.fullname?.trim() || user.username?.trim() || '';
}

export function navigate(path: string) {
  const next = path.startsWith('/') ? path : `/${path}`;
  if (`${window.location.pathname}${window.location.search}` === next) return;
  window.history.pushState({}, '', next);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function replacePath(path: string) {
  const next = path.startsWith('/') ? path : `/${path}`;
  if (window.location.pathname === next) return;
  window.history.replaceState({}, '', next);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
