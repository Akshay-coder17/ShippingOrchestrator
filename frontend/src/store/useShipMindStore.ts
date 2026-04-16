/**
 * Global Zustand store for ShipMind
 *
 * Changes vs original:
 *  - Added `setToken` action (used by Auth.tsx OAuth callback)
 *  - `setUser` now persists to localStorage for session restoration
 *  - `logout` now clears localStorage
 *  - Added `role` to User interface
 *
 * @module store/useShipMindStore
 */

import { create } from "zustand";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface OrchestrationState {
  queryId?: string;
  status: "idle" | "loading" | "complete" | "error";
  progress: string[];
  error?: string;
}

export interface ShipmentPlanStore {
  id?: string;
  status: string;
  route?: any;
  carrier?: any;
  cost?: any;
  compliance?: any;
  risk?: any;
  carbon?: any;
  agentRewards?: Record<string, number>;
  eta?: string;
  query?: string;
}

interface ShipMindStore {
  // Auth
  user: User | null;
  token: string | null;
  setUser: (user: User | null, token: string | null) => void;
  setToken: (token: string) => void;
  logout: () => void;

  // Orchestration
  orchestration: OrchestrationState;
  setOrchestration: (state: Partial<OrchestrationState>) => void;
  addProgressMessage: (message: string) => void;

  // Shipment Plan
  currentPlan: ShipmentPlanStore;
  setCurrentPlan: (plan: ShipmentPlanStore) => void;

  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
}

export const useShipMindStore = create<ShipMindStore>((set) => ({
  // ── Auth state ─────────────────────────────────────────────────────────────
  user: null,
  token: null,

  setUser: (user, token) => {
    // Persist to localStorage for session restoration on page reload
    if (user && token) {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
    }
    set({ user, token });
  },

  setToken: (token) => {
    localStorage.setItem("token", token);
    set({ token });
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ user: null, token: null });
  },

  // ── Orchestration state ────────────────────────────────────────────────────
  orchestration: { status: "idle", progress: [] },

  /** Merges partial state so callers only need to specify changing fields */
  setOrchestration: (partial) =>
    set((state) => ({ orchestration: { ...state.orchestration, ...partial } })),

  addProgressMessage: (message) =>
    set((state) => ({
      orchestration: {
        ...state.orchestration,
        progress: [...state.orchestration.progress, message],
      },
    })),

  // ── Shipment plan state ────────────────────────────────────────────────────
  currentPlan: { status: "idle" },
  setCurrentPlan: (plan) => set({ currentPlan: plan }),

  // ── UI state ───────────────────────────────────────────────────────────────
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  chatOpen: false,
  setChatOpen: (open) => set({ chatOpen: open }),
}));
