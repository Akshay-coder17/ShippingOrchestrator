/**
 * Main App component with routing
 */

import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useShipMindStore } from "@/store/useShipMindStore.js";
import { AuthPage } from "@/pages/Auth.js";
import { NewShipmentPage } from "@/pages/NewShipment.js";
import { DashboardPage } from "@/pages/Dashboard.js";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const user = useShipMindStore((state) => state.user);

  if (!user) {
    return <Navigate to="/auth/login" />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  const { setUser } = useShipMindStore();

  // Restore auth from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setUser(user, token);
      } catch (err) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }
  }, [setUser]);

  return (
    <Router>
      <Routes>
        {/* Auth routes */}
        <Route path="/auth/login" element={<AuthPage isLogin={true} />} />
        <Route path="/auth/register" element={<AuthPage isLogin={false} />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shipment/new"
          element={
            <ProtectedRoute>
              <NewShipmentPage />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
};
