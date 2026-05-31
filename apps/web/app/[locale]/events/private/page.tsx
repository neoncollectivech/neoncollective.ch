import { Suspense } from "react";

import { PageShell } from "@/components/page-shell";

import { PrivateEventClient } from "./private-event-client";

export default function PrivateEventPage() {
  return (
    <PageShell width="eventDetail">
      <Suspense fallback={<p className="neon-meta">…</p>}>
        <PrivateEventClient />
      </Suspense>
    </PageShell>
  );
}
