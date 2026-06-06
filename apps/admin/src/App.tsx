import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthGuard } from "@/components/auth-guard";
import { AdminLayout } from "@/components/layout/admin-layout";
import { EventWorkspaceOutlet } from "@/components/layout/event-workspace-outlet";
import { PwaUpdateNotifier } from "@/components/pwa-update-notifier";
import { adminBasename } from "@/lib/admin-base";
import { EventFormPage } from "@/pages/event-form-page";
import { EventInviteesPage } from "@/pages/event-invitees-page";
import { EventOrdersPage } from "@/pages/event-orders-page";
import { EventOverviewPage } from "@/pages/event-overview-page";
import { EventPromotionsPage } from "@/pages/event-promotions-page";
import { EventSettingsPage } from "@/pages/event-settings-page";
import { EventTiersPage } from "@/pages/event-tiers-page";
import { EventAdmissionsPage } from "@/pages/event-admissions-page";
import { AdmissionDetailPage } from "@/pages/admission-detail-page";
import { EventApiKeysPage } from "@/pages/event-api-keys-page";
import { EventsPage } from "@/pages/events-page";
import { LoginPage } from "@/pages/login-page";
import { OrderDetailPage } from "@/pages/order-detail-page";
import { PeoplePage } from "@/pages/people-page";
import { MaintenancePage } from "@/pages/maintenance-page";
import { ApiKeysPage } from "@/pages/api-keys-page";
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
            <Route element={<EventWorkspaceOutlet />} path="events/:eventId">
              <Route index element={<Navigate replace to="overview" />} />
              <Route element={<EventOverviewPage />} path="overview" />
              <Route element={<EventSettingsPage />} path="settings" />
              <Route element={<EventTiersPage />} path="tiers" />
              <Route element={<EventPromotionsPage />} path="promotions" />
              <Route element={<EventApiKeysPage />} path="api-keys" />
              <Route element={<EventInviteesPage />} path="invitees" />
              <Route element={<EventOrdersPage />} path="orders" />
              <Route element={<EventAdmissionsPage />} path="admissions" />
              <Route
                element={<AdmissionDetailPage />}
                path="admissions/:admissionId"
              />
              <Route element={<OrderDetailPage />} path="orders/:orderId" />
            </Route>
            <Route element={<PeoplePage />} path="people" />
            <Route element={<PersonDetailPage />} path="people/:id" />
            <Route element={<ApiKeysPage />} path="api-keys" />
            <Route element={<MaintenancePage />} path="maintenance" />
          </Route>
        </Routes>
      </BrowserRouter>
      <PwaUpdateNotifier />
      <Toaster richColors theme="dark" />
    </QueryClientProvider>
  );
}
