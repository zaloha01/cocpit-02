/**
 * App Shell Component
 * 
 * Main layout wrapper with sidebar navigation.
 * Provides consistent layout across all pages.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useScope } from '../contexts/ScopeContext';
import type { AppScope } from '@/src/storage/schema';

type NavItem = {
  label: string;
  href: string;
  icon?: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Trvalé platby', href: '/trvale-platby' },
  { label: 'Očekávané platby', href: '/ocekavane-platby' },
  { label: 'Cashflow prognóza', href: '/cashflow-prognoza' },
  { label: 'Pohyblivé náklady', href: '/pohyblive-vydaje' },
  { label: 'Projekty (deník)', href: '/projekty' },
  { label: 'Majetek', href: '/majetek' },
  { label: 'Cíle & pasiva', href: '/cile-a-pasiva' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { scope, setScope } = useScope();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const scopes: AppScope[] = ['rodina', 'ico', 'sro_karin', 'weecon'];

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static
          top-0 left-0
          h-full
          w-64 md:w-72
          bg-white border-r border-gray-200
          z-50
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-800">FinanceOS</h1>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="lg:hidden text-gray-600 hover:text-gray-800"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Scope Selector */}
          <div className="p-4 border-b border-gray-200">
            <label className="block text-sm font-medium text-gray-700 mb-2">Scope</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as AppScope)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {scopes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`
                        block px-4 py-2 rounded-lg
                        transition-colors duration-150
                        ${
                          isActive
                            ? 'bg-blue-100 text-blue-700 font-semibold'
                            : 'text-gray-700 hover:bg-gray-100'
                        }
                      `}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Footer links */}
          <div className="p-4 border-t border-gray-200">
            <ul className="space-y-1">
              <li>
                <Link
                  href="/prijmy"
                  className={`
                    block px-4 py-2 rounded-lg
                    transition-colors duration-150
                    ${
                      pathname === '/prijmy'
                        ? 'bg-blue-100 text-blue-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Příjmy
                </Link>
              </li>
              <li>
                <Link
                  href="/dluhy"
                  className={`
                    block px-4 py-2 rounded-lg
                    transition-colors duration-150
                    ${
                      pathname === '/dluhy'
                        ? 'bg-blue-100 text-blue-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Dluhy
                </Link>
              </li>
              <li>
                <Link
                  href="/penezenka"
                  className={`
                    block px-4 py-2 rounded-lg
                    transition-colors duration-150
                    ${
                      pathname === '/penezenka'
                        ? 'bg-blue-100 text-blue-700 font-semibold'
                        : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Peněženka
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Mobile header with hamburger */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-gray-600 hover:text-gray-800"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="ml-4 text-lg font-semibold text-gray-800">FinanceOS</h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
