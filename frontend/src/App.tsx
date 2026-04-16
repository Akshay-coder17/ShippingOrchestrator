/**
 * Main App component with routing
 *
 * Routes:
 *  /auth/login        — Login page
 *  /auth/register     — Register page
 *  /auth/callback     — Google OAuth redirect handler (REQUIRED — was missing)
 *  /                  — Dashboard (protected)
 *  /shipment/new      — New shipment NL prompt (protected)
 *  /chat              — AI chatbot (protected)
 *
 * @module App
 */

import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useSearchParams,
  useNavigate,
} from "react-router-dom";
import { useShipMindStore } from "@/store/useShipMindStore.js";
import { AuthPage } from "@/pages/Auth.js";
import { NewShipmentPage } from "@/pages/NewShipment.js";
import { DashboardPage } from "@/pages/Dashboard.js";
import { ChatbotPage } from "@/pages/Chatbot.js";
import { CustomCursor } from "@/components/ui/CustomCursor.js";

// ── Protected Route wrapper ────────────────────────────────────────────────────
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useShipMindStore((s) => s.user);
  if (!user) return <Navigate to="/auth/login" replace />;
  return <>{children}</>;
};

// ── Google OAuth callback handler ─────────────────────────────────────────────
/**
 * Handles the redirect from the backend after Google OAuth:
 *   /auth/callback?token=xxx&name=xxx&role=xxx
 *
 * Stores credentials in the Zustand store (which persists to localStorage)
 * then redirects to the dashboard.
 */
const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useShipMindStore();

  useEffect(() => {
    const token = searchParams.get("token");
    const name  = searchParams.get("name");
    const role  = searchParams.get("role") || "USER";

    if (token && name) {
      setUser(
        { id: "oauth-pending", name: decodeURIComponent(name), email: "", role },
        token
      );
      navigate("/", { replace: true });
    } else {
      navigate("/auth/login?error=oauth_failed", { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-[#050510] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-white/60 text-sm">Completing sign-in…</p>
      </div>
    </div>
  );
};

// ── App ────────────────────────────────────────────────────────────────────────
export const App: React.FC = () => {
  const { setUser } = useShipMindStore();

  // Restore auth from localStorage on hard reload
  useEffect(() => {
    const token   = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setUser(user, token);
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Router>
      {/* Custom glowing cursor across all pages */}
      <CustomCursor />

      <Routes>
        {/* Auth routes */}
        <Route path="/auth/login"    element={<AuthPage isLogin={true}  />} />
        <Route path="/auth/register" element={<AuthPage isLogin={false} />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />

        {/* Protected routes */}
        <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/shipment/new" element={<ProtectedRoute><NewShipmentPage /></ProtectedRoute>} />
        <Route path="/chat"         element={<ProtectedRoute><ChatbotPage /></ProtectedRoute>} />

        {/* Catch-all → dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};
