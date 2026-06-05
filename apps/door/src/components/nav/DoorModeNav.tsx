import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

const modes = [
  { to: "/", label: "Scan" },
  { to: "/pos", label: "POS" },
] as const;

export function DoorModeNav() {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Door mode"
      className="border-border/60 bg-background/95 flex shrink-0 border-t px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
    >
      <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-2">
        {modes.map((mode) => {
          const active =
            mode.to === "/"
              ? pathname === "/" || pathname === ""
              : pathname.startsWith(mode.to);

          return (
            <Link
              key={mode.to}
              className={cn(
                "rounded-lg px-4 py-3 text-center text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
              to={mode.to}
            >
              {mode.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
