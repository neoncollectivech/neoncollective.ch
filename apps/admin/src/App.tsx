import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthGuard } from "@/components/auth-guard";
import { AdminLayout } from "@/components/layout/admin-layout";
import { adminBasename } from "@/lib/admin-base";
import { EventDetailPage } from "@/pages/event-detail-page";
import { EventFormPage } from "@/pages/event-form-page";
import { EventsPage } from "@/pages/events-page";
import { LoginPage } from "@/pages/login-page";
import { OrderDetailPage } from "@/pages/order-detail-page";
import { OrdersPage } from "@/pages/orders-page";
import { PeoplePage } from "@/pages/people-page";
import { PersonDetailPage } from "@/pages/person-detail-page";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={adminBasename || undefined}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <AuthGuard>
                <AdminLayout />
              </AuthGuard>
            }
          >
            <Route index element={<Navigate to="/events" replace />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="events/new" element={<EventFormPage />} />
            <Route path="events/:id" element={<EventDetailPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailPage />} />
            <Route path="people" element={<PeoplePage />} />
            <Route path="people/:id" element={<PersonDetailPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster theme="dark" richColors />
    </QueryClientProvider>
  );
}
