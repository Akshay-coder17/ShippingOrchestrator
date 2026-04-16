/**
 * Layout component with sidebar
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  BarChart3,
  Packages,
  Plus,
  Settings,
  LogOut,
} from "lucide-react";
import { useShipMindStore } from "@/store/useShipMindStore.js";
import { Button } from "@/components/ui/index.js";
import clsx from "clsx";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { sidebarOpen, setSidebarOpen, user, logout } = useShipMindStore();

  const handleLogout = () => {
    logout();
    navigate("/auth/login");
  };

  const navItems = [
    { label: "Dashboard", href: "/", icon: BarChart3 },
    { label: "New Shipment", href: "/shipment/new", icon: Plus },
    { label: "My Shipments", href: "/shipments", icon: Packages },
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-bg-primary text-text-primary">
      {/* Sidebar */}
      <aside
        className={clsx(
          "fixed lg:relative z-40 w-64 h-screen bg-bg-card border-r border-border transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full p-6">
          {/* Logo / Branding */}
          <div className="mb-8 text-2xl font-bold glow-text">
            🚀 ShipMind
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    navigate(item.href);
                    setSidebarOpen(false);
                  }}
                  className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-accent/10 transition-colors text-left group"
                >
                  <Icon className="w-5 h-5 group-hover:text-accent transition-colors" />
                  <span className="group-hover:text-accent transition-colors">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* User Profile / Logout */}
          <div className="border-t border-border pt-4 space-y-3">
            {user && (
              <div className="px-4 py-2 text-sm">
                <p className="font-semibold">{user.name}</p>
                <p className="text-text-primary/60 text-xs">{user.email}</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute top-4 left-4 z-50 lg:hidden"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
};
