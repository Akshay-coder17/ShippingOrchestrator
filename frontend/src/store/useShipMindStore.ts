/**
 * Global Zustand store for ShipMind
 */

import { create } from "zustand";

export interface User {
  id: string;
  name: string;
  email: string;
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
}

interface ShipMindStore {
  // Auth
  user: User | null;
  token: string | null;
  setUser: (user: User | null, token: string | null) => void;
  logout: () => void;

  // Orchestration
  orchestration: OrchestrationState;
  setOrchestration: (state: OrchestrationState) => void;
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
  // Auth state
  user: null,
  token: null,
  setUser: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null }),

  // Orchestration state
  orchestration: {
    status: "idle",
    progress: [],
  },
  setOrchestration: (state) => set({ orchestration: state }),
  addProgressMessage: (message) =>
    set((state) => ({
      orchestration: {
        ...state.orchestration,
        progress: [...state.orchestration.progress, message],
      },
    })),

  // Shipment plan state
  currentPlan: { status: "idle" },
  setCurrentPlan: (plan) => set({ currentPlan: plan }),

  // UI state
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  chatOpen: false,
  setChatOpen: (open) => set({ chatOpen: open }),
}));
