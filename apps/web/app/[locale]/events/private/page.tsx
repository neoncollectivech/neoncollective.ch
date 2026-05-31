import { Suspense } from "react";

import { PrivateEventClient } from "./private-event-client";

export default function PrivateEventPage() {
  return (
    <article className="py-16 md:py-28 px-6">
      <div className="max-w-3xl lg:max-w-5xl mx-auto">
        <Suspense
          fallback={<p className="text-sm text-foreground/40 font-mono">…</p>}
        >
          <PrivateEventClient />
        </Suspense>
      </div>
    </article>
  );
}
