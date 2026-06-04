import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthGuard } from "@/components/AuthGuard";
import { DoorAppShell } from "@/components/DoorAppShell";
import { PwaUpdateNotifier } from "@/components/PwaUpdateNotifier";
import { doorBasename } from "@/lib/door-base";
import { queryClient } from "@/lib/query-client";
import {
  getDoorApiKeyConfig,
  getDoorSessionConfig,
} from "@/lib/storage/session-config";
import { EventSelectPage } from "@/pages/EventSelectPage";
import { QueuePage } from "@/pages/QueuePage";
import { ScanPage } from "@/pages/ScanPage";
import { SetupPage } from "@/pages/SetupPage";

function SetupRedirect() {
  const session = getDoorSessionConfig();
  const keyConfig = getDoorApiKeyConfig();

  if (session) {
    return <Navigate replace to="/" />;
  }

  if (keyConfig) {
    return <Navigate replace to="/setup/event" />;
  }

  return <SetupPage />;
}

function EventSelectRedirect() {
  const session = getDoorSessionConfig();
  const keyConfig = getDoorApiKeyConfig();

  if (session) {
    return <Navigate replace to="/" />;
  }

  if (!keyConfig) {
    return <Navigate replace to="/setup" />;
  }

  return <EventSelectPage />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={doorBasename || undefined}>
        <DoorAppShell>
          <Routes>
            <Route element={<SetupRedirect />} path="/setup" />
            <Route element={<EventSelectRedirect />} path="/setup/event" />
            <Route element={<AuthGuard />}>
              <Route index element={<ScanPage />} />
              <Route element={<QueuePage />} path="queue" />
            </Route>
            <Route element={<Navigate replace to="/" />} path="*" />
          </Routes>
        </DoorAppShell>
        <PwaUpdateNotifier />
        <Toaster richColors theme="dark" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
