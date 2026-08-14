'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: 'Volume Gap', href: '/' },
  { label: 'Alt Performance', href: '/alt-performance' },
  { label: 'L/S Tracker', href: '/longshort' },
  { label: '실거래 내역', href: '/longshort/real-trades' },
  { label: '통계', href: '/statistics' },
];

export default function Navigation() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[#1F2937] bg-[#0D1120]/95 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-xs font-bold select-none">
              C
            </div>
            <span className="font-semibold text-sm tracking-tight text-gray-100">
              Crypto Dashboard
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={pathname === item.href}
              />
            ))}
          </nav>

          {/* Mobile Hamburger */}
          <button
            aria-label="Toggle menu"
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-gray-100 hover:bg-[#1F2937] transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[#1F2937] py-2 pb-3 space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={pathname === item.href}
                mobile
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

function NavLink({
  item,
  active,
  mobile = false,
  onClick,
}: {
  item: (typeof NAV_ITEMS)[number];
  active: boolean;
  mobile?: boolean;
  onClick?: () => void;
}) {
  const desktopClass = `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
    active ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:text-gray-100 hover:bg-[#1F2937]'
  }`;

  const mobileClass = `flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
    active ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:text-gray-100 hover:bg-[#1F2937]'
  }`;

  return (
    <Link href={item.href} className={mobile ? mobileClass : desktopClass} onClick={onClick}>
      <span>{item.label}</span>
    </Link>
  );
}
