import React from 'react';
import { TenantUser } from '../types';

export type ActiveTab = 'connections' | 'contacts' | 'broadcast' | 'messages';

interface NavbarProps {
  user: TenantUser;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onLogout: () => void;
}

const NAV_ITEMS: { id: ActiveTab; label: string }[] = [
  { id: 'connections', label: 'Conexões' },
  { id: 'contacts', label: 'Contatos' },
  { id: 'broadcast', label: 'Novo Envio' },
  { id: 'messages', label: 'Histórico' },
];

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  onSelectTab,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-20 bg-white border-b border-zinc-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => onSelectTab('connections')}
            className="flex items-center gap-2 text-left cursor-pointer focus:outline-none"
          >
            <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-zinc-900 text-white text-[11px] font-bold tracking-tight">
              BM
            </span>
            <span className="font-semibold text-sm text-zinc-900 tracking-tight">
              Broadcast Message
            </span>
          </button>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-zinc-100 text-zinc-900'
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="hidden sm:inline-block text-zinc-500 truncate max-w-[180px]">
            {user.displayName || user.email}
          </span>
          <span className="hidden sm:inline-block text-zinc-300">|</span>
          <button
            type="button"
            onClick={onLogout}
            className="text-zinc-500 hover:text-zinc-900 font-medium transition-colors cursor-pointer"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
};
