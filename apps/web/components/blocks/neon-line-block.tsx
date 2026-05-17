import type { NeonLineBlock } from "@/lib/content/types";

export function NeonLineBlockComponent({ width = "w-12" }: NeonLineBlock) {
  return <div className={`neon-line ${width}`} />;
}
