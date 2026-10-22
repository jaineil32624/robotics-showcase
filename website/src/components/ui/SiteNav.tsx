"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV, SITE } from "@/lib/site";

function Mark() {
  return (
    <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="3" fill="none" stroke="currentColor" strokeOpacity=".35" />
      <path d="M7 22 L12 10 L16 18 L20 10 L25 22" fill="none" stroke="#ff5a1f" strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx="16" cy="18" r="1.8" fill="#38d6ff" />
    </svg>
  );
}

export function SiteNav() {
  const path = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href.replace(/\/$/, "")));

  return (
    <header className="sticky top-0 z-40 border-b hairline bg-ink/85 backdrop-blur supports-[backdrop-filter]:bg-ink/70">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-fg">
          <Mark />
          <span className="font-display text-[15px] font-semibold tracking-[0.08em]" style={{ fontStretch: "112%" }}>
            {SITE.name}
          </span>
          <span className="label hidden sm:inline">Robotics Showcase</span>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Primary">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded px-3 py-1.5 text-sm transition-colors ${
                active(n.href) ? "bg-panel-2 text-fg" : "text-soft hover:text-fg"
              }`}
            >
              {n.label}
            </Link>
          ))}
          <a
            href={SITE.repo}
            target="_blank"
            rel="noreferrer"
            className="ml-2 rounded border border-line-2 px-3 py-1.5 font-mono text-xs text-soft hover:border-signal hover:text-fg"
          >
            GitHub ↗
          </a>
        </nav>
        <button
          className="ml-auto rounded border border-line-2 px-3 py-1.5 font-mono text-xs text-soft lg:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" className="border-t hairline bg-ink px-4 py-3 lg:hidden" aria-label="Mobile">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`block rounded px-3 py-2.5 text-[15px] ${active(n.href) ? "bg-panel-2 text-fg" : "text-soft"}`}
            >
              {n.label}
            </Link>
          ))}
          <a href={SITE.repo} target="_blank" rel="noreferrer" className="block px-3 py-2.5 font-mono text-sm text-soft">
            GitHub ↗
          </a>
        </nav>
      )}
    </header>
  );
}
