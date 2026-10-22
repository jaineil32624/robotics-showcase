"use client";

import { usePathname } from "next/navigation";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  const path = usePathname() ?? "";
  if (path.startsWith("/viewer")) return null; // full-bleed workspace
  return (
    <footer className="border-t hairline">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-8 text-sm text-mute sm:flex-row sm:items-center sm:px-6">
        <p>
          <span className="text-soft">{SITE.name}</span> — designed, modelled and animated by {SITE.author}.
        </p>
        <div className="flex gap-4 sm:ml-auto">
          <a className="hover:text-fg" href={SITE.repo} target="_blank" rel="noreferrer">
            Source
          </a>
          <a className="hover:text-fg" href={SITE.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="hover:text-fg" href={SITE.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
          <span className="font-mono text-xs">MIT License</span>
        </div>
      </div>
    </footer>
  );
}
