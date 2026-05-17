import type { TextBlock } from "@/lib/content/types";

export function TextBlockComponent({ text, italic }: TextBlock) {
  return (
    <p
      className={`text-base md:text-lg text-foreground/50 leading-relaxed ${italic ? "italic" : ""}`.trim()}
    >
      {text}
    </p>
  );
}
