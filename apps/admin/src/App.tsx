import { QueryClientProvider } from "@tanstack/react-query";
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
import { MaintenancePage } from "@/pages/maintenance-page";
import { PersonDetailPage } from "@/pages/person-detail-page";
import { queryClient } from "@/lib/query-client";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={adminBasename || undefined}>
        <Routes>
          <Route element={<LoginPage />} path="/login" />
          <Route
            element={
              <AuthGuard>
                <AdminLayout />
              </AuthGuard>
            }
          >
            <Route index element={<Navigate replace to="/events" />} />
            <Route element={<EventsPage />} path="events" />
            <Route element={<EventFormPage />} path="events/new" />
            <Route element={<EventDetailPage />} path="events/:id" />
            <Route element={<OrdersPage />} path="orders" />
            <Route element={<OrderDetailPage />} path="orders/:id" />
            <Route element={<PeoplePage />} path="people" />
            <Route element={<PersonDetailPage />} path="people/:id" />
            <Route element={<MaintenancePage />} path="maintenance" />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors theme="dark" />
    </QueryClientProvider>
  );
}
