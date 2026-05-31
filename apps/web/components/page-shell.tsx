import type { ElementType, ReactNode } from "react";

import clsx from "clsx";

import {
  pageShellClassNames,
  pageShellInnerClass,
  type PageShellWidth,
} from "@/config/page-shell";

type PageShellProps = {
  width: PageShellWidth;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  as?: ElementType;
};

export function PageShell({
  width,
  children,
  className,
  innerClassName,
  as: Component = "article",
}: PageShellProps) {
  return (
    <Component className={clsx(pageShellClassNames.outer, className)}>
      <div className={clsx(pageShellInnerClass(width), innerClassName)}>
        {children}
      </div>
    </Component>
  );
}
