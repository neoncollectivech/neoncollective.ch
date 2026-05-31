import type { ReactNode } from "react";

import clsx from "clsx";

type PageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  showNeonLine?: boolean;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  showNeonLine = false,
  className,
}: PageHeaderProps) {
  return (
    <header className={clsx("mb-10 md:mb-12", className)}>
      {showNeonLine ? <div className="neon-line w-12 mb-6" /> : null}
      <h1 className="neon-title-page mb-3">{title}</h1>
      {subtitle ? <p className="neon-body max-w-2xl">{subtitle}</p> : null}
    </header>
  );
}
