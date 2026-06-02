import type { ReactNode } from "react";

type EventDetailLayoutProps = {
  header: ReactNode;
  /** Hero block: left column on desktop checkout grid; full-width above checkout on mobile. */
  mainLead?: ReactNode | null;
  main?: ReactNode | null;
  /**
   * With `mainAfterAside` + `aside`: stacks hero → prefix → aside → suffix on mobile;
   * desktop keeps aside in the right column (e.g. extend contribution after registration card).
   */
  mainBeforeAside?: ReactNode | null;
  mainAfterAside?: ReactNode | null;
  aside: ReactNode | null;
  stickyBarPadding?: boolean;
  /** Side-by-side grid when main has content; stacked checkout when not. */
  twoColumn?: boolean;
};

export function EventDetailLayout({
  header,
  mainLead,
  main,
  mainBeforeAside,
  mainAfterAside,
  aside,
  stickyBarPadding,
  twoColumn = true,
}: EventDetailLayoutProps) {
  const splitMainAside =
    aside != null &&
    twoColumn &&
    mainBeforeAside != null &&
    mainAfterAside != null;

  return (
    <div className={stickyBarPadding ? "pb-24 lg:pb-0" : undefined}>
      {header}

      {splitMainAside ? (
        <div className="flex w-full min-w-0 flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_min(26rem,38vw)] lg:gap-10 lg:items-start">
          {mainLead ? (
            <div className="min-w-0 lg:col-start-1 lg:row-start-1">
              {mainLead}
            </div>
          ) : null}
          <div
            className={
              mainLead
                ? "min-w-0 lg:col-start-1 lg:row-start-2"
                : "min-w-0 lg:col-start-1 lg:row-start-1"
            }
          >
            {mainBeforeAside}
          </div>
          <aside
            className={
              mainLead
                ? "min-w-0 w-full max-w-full lg:col-start-2 lg:row-start-1 lg:row-span-3 lg:self-start"
                : "min-w-0 w-full max-w-full lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:self-start"
            }
          >
            {aside}
          </aside>
          <div
            className={
              mainLead
                ? "min-w-0 lg:col-start-1 lg:row-start-3"
                : "min-w-0 lg:col-start-1 lg:row-start-2"
            }
          >
            {mainAfterAside}
          </div>
        </div>
      ) : aside != null && twoColumn ? (
        <>
          {mainLead ? (
            <div className="lg:hidden min-w-0">{mainLead}</div>
          ) : null}
          <div className="flex w-full min-w-0 flex-col gap-10 lg:grid lg:grid-cols-[minmax(0,1fr)_min(26rem,38vw)] lg:gap-10 lg:items-start">
            <div className="order-2 lg:order-1 min-w-0">
              {mainLead ? (
                <div className="hidden lg:block min-w-0">{mainLead}</div>
              ) : null}
              {main}
            </div>
            <aside className="order-1 lg:order-2 min-w-0 w-full max-w-full">
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
