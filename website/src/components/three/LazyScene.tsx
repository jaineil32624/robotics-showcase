"use client";

import dynamic from "next/dynamic";

/** WebGL scene, loaded only in the browser (static export safe). */
export const LazyScene = dynamic(() => import("./Scene"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full w-full place-items-center">
      <p className="label animate-pulse">Initialising renderer…</p>
    </div>
  ),
});
