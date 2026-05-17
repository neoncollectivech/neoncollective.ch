import { Link, LinkProps } from "@heroui/link";
import { tv } from "tailwind-variants";

const neonLink = tv({
  base: "font-mono uppercase tracking-widest transition-all duration-300",
  variants: {
    neonStyle: {
      cta: "inline-block border border-neon/60 px-8 py-3 text-xs text-neon leading-none hover:bg-neon/10 hover:border-neon no-underline",
      footer: "text-[0.625rem] text-foreground/20 hover:text-neon",
      inline:
        "inline-flex items-center gap-3 text-xs text-neon/60 hover:text-neon no-underline",
    },
  },
  defaultVariants: {
    neonStyle: "cta",
  },
});

export type NeonLinkProps = LinkProps & {
  neonStyle?: "cta" | "footer" | "inline";
};

export function NeonLink({
  className,
  neonStyle = "cta",
  ...props
}: NeonLinkProps) {
  return <Link className={neonLink({ neonStyle, className })} {...props} />;
}
