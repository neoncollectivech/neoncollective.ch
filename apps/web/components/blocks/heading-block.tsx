import type { HeadingBlock } from "@/lib/content/types";

const variantStyles: Record<string, string> = {
  default: "font-bold tracking-tight",
  mono: "text-xs font-mono text-foreground/20 uppercase tracking-widest mb-8 md:mb-12",
  semibold: "text-lg font-semibold mt-10 mb-3 text-foreground/90",
};

const levelStyles: Record<number, string> = {
  1: "text-3xl md:text-4xl lg:text-5xl mb-8",
  2: "text-xl md:text-2xl mt-14 mb-5",
  3: "text-lg mt-10 mb-3",
};

export function HeadingBlockComponent({
  text,
  level,
  variant = "default",
}: HeadingBlock) {
  const Tag = `h${level}` as const;

  const classes =
    variant === "mono"
      ? variantStyles.mono
      : `${variantStyles[variant]} ${levelStyles[level] ?? ""}`;

  return <Tag className={classes}>{text}</Tag>;
}
