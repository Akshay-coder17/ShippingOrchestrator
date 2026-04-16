/**
 * Custom hooks for ShipMind frontend
 *
 * Changes vs original:
 *  - useSocket / useApi now read URL from env vars (VITE_API_URL / VITE_SOCKET_URL)
 *    instead of hardcoded http://localhost:3001 — works correctly in Docker prod
 *  - useApi now auto-refreshes token on 401 and retries once
 *
 * @module hooks/index
 */

import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useShipMindStore } from "@/store/useShipMindStore.js";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";
const API_BASE   = import.meta.env.VITE_API_URL   || "http://localhost:3001";

// ── useSocket ──────────────────────────────────────────────────────────────────
/**
 * Establishes a persistent Socket.io connection tied to the authenticated user.
 * Joins the user's room so the server can push orchestration events directly.
 */
export const useSocket = (): Socket | null => {
  const socketRef = useRef<Socket | null>(null);
  const { user, token, addProgressMessage } = useShipMindStore();

  useEffect(() => {
    if (!user || !token) return;

    socketRef.current = io(SOCKET_URL, {
      withCredentials: true,
    });

    socketRef.current.on("connect", () => {
      console.log("[Socket] Connected:", socketRef.current?.id);
      // Authenticate and join user room so worker events reach this client
      socketRef.current?.emit("user:authenticate", { userId: user.id, token });
    });

    socketRef.current.on("agent:progress", (data: { message: string }) => {
      addProgressMessage(data.message);
    });

    socketRef.current.on("disconnect", (reason: string) => {
      console.log("[Socket] Disconnected:", reason);
    });

    socketRef.current.on("connect_error", (err: Error) => {
      console.error("[Socket] Connection error:", err.message);
    });

    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, token]); // Only re-run if user identity or token changes

  return socketRef.current;
};

// ── useApi ─────────────────────────────────────────────────────────────────────
/**
 * Typed HTTP client that injects the JWT Bearer token on every request.
 * Auto-retries once on 401 after attempting a token refresh.
 */
export const useApi = () => {
  const { token, setToken, logout } = useShipMindStore();

  const request = useCallback(
    async (method: string, endpoint: string, data?: unknown): Promise<any> => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api${endpoint}`, {
        method,
        headers,
        credentials: "include",
        body: data ? JSON.stringify(data) : undefined,
      });

      // Auto-refresh on 401
      if (res.status === 401) {
        try {
          const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
            method: "POST",
            credentials: "include",
          });
          if (refreshRes.ok) {
            const { accessToken } = await refreshRes.json();
            setToken(accessToken);

            // Retry original request with new token
            const retryRes = await fetch(`${API_BASE}/api${endpoint}`, {
              method,
              headers: { ...headers, Authorization: `Bearer ${accessToken}` },
              credentials: "include",
              body: data ? JSON.stringify(data) : undefined,
            });
            if (!retryRes.ok) throw new Error(await retryRes.text());
            return retryRes.json();
          } else {
            // Refresh failed — force logout
            logout();
            throw new Error("Session expired — please log in again");
          }
        } catch {
          logout();
          throw new Error("Session expired — please log in again");
        }
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body?.error || res.statusText);
      }

      return res.json();
    },
    [token, setToken, logout]
  );

  return {
    get:    (endpoint: string)              => request("GET",    endpoint),
    post:   (endpoint: string, data: any)   => request("POST",   endpoint, data),
    put:    (endpoint: string, data: any)   => request("PUT",    endpoint, data),
    delete: (endpoint: string)              => request("DELETE", endpoint),
  };
};
