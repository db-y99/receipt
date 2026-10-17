import React from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { displayName, navigate } from '../navigation';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const SessionMenu: React.FC = () => {
  const { user, signOut } = useAuth();
  const label = displayName(user);

  const onLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex items-center gap-1.5 border-l border-gray-200 pl-2">
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-600 text-[10px] font-semibold text-white"
        aria-hidden="true"
      >
        {initials(label)}
      </span>
      {label && (
        <span className="hidden max-w-[7rem] truncate text-sm text-gray-800 xl:inline" title={label}>
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={() => void onLogout()}
        className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden xl:inline">Đăng xuất</span>
      </button>
    </div>
  );
};

export default SessionMenu;
