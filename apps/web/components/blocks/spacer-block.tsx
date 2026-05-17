import type { SpacerBlock } from "@/lib/content/types";

const sizeMap: Record<string, string> = {
  sm: "h-8",
  md: "h-16",
  lg: "h-24 md:h-36",
};

export function SpacerBlockComponent({ size = "md" }: SpacerBlock) {
  return <div className={sizeMap[size]} />;
}
