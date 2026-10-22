import type { Metadata } from "next";
import { AnimationShowcase } from "./AnimationShowcase";

export const metadata: Metadata = {
  title: "Animation Showcase",
  description: "Ten baked animation sequences, from power-on to the exploded assembly view.",
};

export default function AnimationsPage() {
  return <AnimationShowcase />;
}
