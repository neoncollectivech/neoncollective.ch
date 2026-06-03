import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthGuard } from "@/components/AuthGuard";
import { doorBasename } from "@/lib/door-base";
import { queryClient } from "@/lib/query-client";
import { getDoorSessionConfig } from "@/lib/storage/session-config";
import { QueuePage } from "@/pages/QueuePage";
import { ScanPage } from "@/pages/ScanPage";
import { SetupPage } from "@/pages/SetupPage";

function SetupRedirect() {
  const session = getDoorSessionConfig();

  if (session) {
    return <Navigate replace to="/" />;
  }

  return <SetupPage />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={doorBasename || undefined}>
        <Routes>
          <Route element={<SetupRedirect />} path="/setup" />
          <Route element={<AuthGuard />}>
            <Route index element={<ScanPage />} />
            <Route element={<QueuePage />} path="queue" />
          </Route>
          <Route element={<Navigate replace to="/" />} path="*" />
        </Routes>
        <Toaster richColors theme="dark" />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
