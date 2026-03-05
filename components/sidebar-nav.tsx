"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/control", label: "Control" },
  { href: "/board", label: "Tasks" },
  { href: "/calendar", label: "Calendar" },
  { href: "/projects", label: "Projects" },
  { href: "/team", label: "Team" },
  { href: "/office", label: "Office" },
  { href: "/memory", label: "Memory" },
  { href: "/docs", label: "Docs" },
];

interface SidebarNavProps {
  mobile?: boolean;
}

function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ mobile = false }: SidebarNavProps) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <nav className="flex flex-wrap gap-2">
        {NAV_ITEMS.map((item) => {
          const isActive = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                isActive
                  ? "border-sky-300/30 bg-sky-400/15 text-sky-200"
                  : "border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20 hover:bg-white/[0.05]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const isActive = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
              isActive
                ? "border-sky-300/30 bg-sky-400/15 text-sky-100"
                : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
