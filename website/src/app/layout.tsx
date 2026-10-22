import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { SiteNav } from "@/components/ui/SiteNav";
import { SiteFooter } from "@/components/ui/SiteFooter";
import { SITE } from "@/lib/site";

const archivo = Archivo({ subsets: ["latin"], variable: "--font-archivo", display: "swap", axes: ["wdth"] });
const plex = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${SITE.name} — Robotics Showcase`, template: `%s · ${SITE.name}` },
  description:
    "ARGO-Q4 is a hydraulic quadruped robot designed and animated procedurally in Blender, with an interactive Three.js viewer, engineering specifications and an Android app.",
  openGraph: {
    title: `${SITE.name} — Robotics Showcase`,
    description: SITE.tagline,
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#07090c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${plex.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <SiteNav />
        <main className="flex-1 flex flex-col">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
