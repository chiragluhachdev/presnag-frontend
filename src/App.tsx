import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Spinner } from "@/components/ui";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Home stays eager (most-visited entry — no suspense flash on first paint).
import Home from "@/customer/Home";

// Everything else is code-split so the customer bundle stays small (admin,
// vendor dashboards and recharts-heavy pages load only when visited).
const Shops = lazy(() => import("@/customer/Shops"));
const VendorPage = lazy(() => import("@/customer/VendorPage"));
const Checkout = lazy(() => import("@/customer/Checkout"));
const OrderConfirmation = lazy(() => import("@/customer/OrderConfirmation"));
const OrderTracking = lazy(() => import("@/customer/OrderTracking"));
const Maintenance = lazy(() => import("@/customer/Maintenance"));
const Partner = lazy(() => import("@/customer/Partner"));
const About = lazy(() => import("@/customer/StaticPages").then((m) => ({ default: m.About })));
const Terms = lazy(() => import("@/customer/StaticPages").then((m) => ({ default: m.Terms })));
const Privacy = lazy(() => import("@/customer/StaticPages").then((m) => ({ default: m.Privacy })));

const VendorLogin = lazy(() => import("@/vendor/VendorLogin"));
const VendorRegister = lazy(() => import("@/vendor/VendorRegister"));
const VendorLayout = lazy(() => import("@/vendor/VendorLayout"));
const VendorDashboard = lazy(() => import("@/vendor/Dashboard"));
const VendorOrders = lazy(() => import("@/vendor/Orders"));
const VendorPayments = lazy(() => import("@/vendor/Payments"));
const VendorMenu = lazy(() => import("@/vendor/Menu"));
const VendorSettings = lazy(() => import("@/vendor/Settings"));
const VendorQR = lazy(() => import("@/vendor/QR"));
const VendorCoupons = lazy(() => import("@/vendor/Coupons"));
const VendorReports = lazy(() => import("@/vendor/Reports"));

const AdminLogin = lazy(() => import("@/admin/AdminLogin"));
const AdminLayout = lazy(() => import("@/admin/AdminLayout"));
const AdminOverview = lazy(() => import("@/admin/Overview"));
const AdminVendors = lazy(() => import("@/admin/Vendors"));
const AdminOrders = lazy(() => import("@/admin/Orders"));
const AdminFinance = lazy(() => import("@/admin/Finance"));
const AdminAnalytics = lazy(() => import("@/admin/Analytics"));
const AdminActivity = lazy(() => import("@/admin/Activity"));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export default function App() {
  const location = useLocation();
  // Admin area stays reachable during maintenance so the owner can toggle it off.
  const isAdminArea = location.pathname.startsWith("/admin");

  const { data: settings } = useQuery({
    queryKey: ["public-settings"],
    queryFn: () => api<{ maintenanceMode: boolean }>("/api/public/settings"),
    refetchInterval: 30000,
    staleTime: 15000,
  });

  if (settings?.maintenanceMode && !isAdminArea) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Maintenance />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ---------------- Customer (public) ---------------- */}
          <Route path="/" element={<Home />} />
          <Route path="/shops" element={<Shops />} />
          <Route path="/track/:orderNumber" element={<OrderTracking />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/order/:orderNumber" element={<OrderConfirmation />} />
          <Route path="/partner" element={<Partner />} />
          <Route path="/about" element={<About />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          {/* ---------------- Vendor ----------------
              Static /vendor/* routes outrank the dynamic /vendor/:slug store page. */}
          <Route path="/vendor/login" element={<VendorLogin />} />
          <Route path="/vendor/register" element={<VendorRegister />} />
          <Route
            path="/vendor"
            element={
              <ProtectedRoute roles={["VENDOR"]} redirect="/vendor/login">
                <VendorLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/vendor/dashboard" replace />} />
            <Route path="dashboard" element={<VendorDashboard />} />
            <Route path="orders" element={<VendorOrders />} />
            <Route path="payments" element={<VendorPayments />} />
            <Route path="menu" element={<VendorMenu />} />
            <Route path="settings" element={<VendorSettings />} />
            <Route path="qr" element={<VendorQR />} />
            <Route path="coupons" element={<VendorCoupons />} />
            <Route path="reports" element={<VendorReports />} />
          </Route>
          {/* Public vendor store page (dynamic slug) */}
          <Route path="/vendor/:slug" element={<VendorPage />} />

          {/* ---------------- Admin ---------------- */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]} redirect="/admin/login">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminOverview />} />
            <Route path="vendors" element={<AdminVendors />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="finance" element={<AdminFinance />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="activity" element={<AdminActivity />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
