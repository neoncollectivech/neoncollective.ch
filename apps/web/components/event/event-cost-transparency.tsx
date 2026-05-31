type EventCostTransparencyProps = {
  title: string;
  bullets: string[];
};

export function EventCostTransparency({
  title,
  bullets,
}: EventCostTransparencyProps) {
  if (bullets.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 pb-8 border-b border-foreground/10">
      <p className="neon-label mb-2">{title}</p>
      <ul className="space-y-1.5">
        {bullets.map((bullet) => (
          <li
            key={bullet}
            className="text-xs text-foreground/45 leading-relaxed pl-3 relative before:content-['·'] before:absolute before:left-0 before:text-foreground/30"
          >
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}
