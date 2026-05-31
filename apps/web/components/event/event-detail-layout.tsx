import type { ReactNode } from "react";

type EventDetailLayoutProps = {
  header: ReactNode;
  /** Hero block: left column on desktop checkout grid; full-width above checkout on mobile. */
  mainLead?: ReactNode | null;
  main: ReactNode;
  aside: ReactNode | null;
  stickyBarPadding?: boolean;
  /** Side-by-side grid when main has content; stacked checkout when not. */
  twoColumn?: boolean;
};

export function EventDetailLayout({
  header,
  mainLead,
  main,
  aside,
  stickyBarPadding,
  twoColumn = true,
}: EventDetailLayoutProps) {
  return (
    <div className={stickyBarPadding ? "pb-24 lg:pb-0" : undefined}>
      {header}

      {aside != null && twoColumn ? (
        <>
          {mainLead ? (
            <div className="lg:hidden min-w-0">{mainLead}</div>
          ) : null}
          <div className="flex w-full min-w-0 flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_min(22rem,36vw)] lg:gap-10 lg:items-start">
            <div className="order-2 lg:order-1 min-w-0">
              {mainLead ? (
                <div className="hidden lg:block min-w-0">{mainLead}</div>
              ) : null}
              {main}
            </div>
            <aside className="order-1 lg:order-2 min-w-0 w-full max-w-full lg:sticky lg:top-24 lg:mb-0">
              {aside}
            </aside>
          </div>
        </>
      ) : aside != null ? (
        <div className="w-full min-w-0 sm:max-w-xl mx-auto">{aside}</div>
      ) : (
        <div>
          {mainLead}
          {main}
        </div>
      )}
    </div>
  );
}
