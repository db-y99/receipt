import React from 'react';
import { CalendarClock, FileText } from 'lucide-react';
import SessionMenu from './SessionMenu';

const logo = new URL('../logo.png', import.meta.url).href;

type AppNavbarProps = {
  current: 'slip' | 'due';
  toolbar?: React.ReactNode;
};

const links = [
  { id: 'slip' as const, href: '/', label: 'Phiếu thu', icon: FileText },
  { id: 'due' as const, href: '/due-soon', label: 'Đến hạn 3 ngày', icon: CalendarClock },
];

const AppNavbar: React.FC<AppNavbarProps> = ({ current, toolbar }) => {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white print:hidden">
      <div className="mx-auto flex h-11 max-w-7xl items-center gap-2 px-3">
        <a href="/" className="flex min-w-0 shrink-0 items-center gap-2">
          <img src={logo} alt="Y99" className="h-7 w-7 object-contain" />
          <span className="hidden truncate text-sm font-semibold text-gray-900 lg:inline">
            Y99 Generator
          </span>
        </a>

        <nav className="flex shrink-0 items-center gap-1" aria-label="Trang">
          {links.map((link) => {
            const active = link.id === current;
            const Icon = link.icon;
            return (
              <a
                key={link.id}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className={active ? 'inline' : 'hidden xl:inline'}>{link.label}</span>
              </a>
            );
          })}
        </nav>

        {toolbar && <div className="flex min-w-0 items-center gap-2">{toolbar}</div>}

        <div className="ml-auto shrink-0">
          <SessionMenu />
        </div>
      </div>
    </header>
  );
};

export default AppNavbar;
