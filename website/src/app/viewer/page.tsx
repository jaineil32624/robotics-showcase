import type { Metadata } from "next";
import { Suspense } from "react";
import { ViewerWorkspace } from "./ViewerWorkspace";

export const metadata: Metadata = {
  title: "3D Viewer",
  description: "Inspect every mechanical component of ARGO-Q4 and play its animation sequences.",
};

export default function ViewerPage() {
  return (
    <Suspense>
      <ViewerWorkspace />
    </Suspense>
  );
}
