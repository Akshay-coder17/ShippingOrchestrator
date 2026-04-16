/**
 * Custom hooks for ShipMind
 */

import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useShipMindStore } from "@/store/useShipMindStore.js";

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const { user, token, addProgressMessage } = useShipMindStore();

  useEffect(() => {
    if (!user || !token) return;

    socketRef.current = io("http://localhost:3001", {
      auth: {
        userId: user.id,
        token,
      },
    });

    socketRef.current.on("connect", () => {
      console.log("Socket connected");
      socketRef.current?.emit("user:authenticate", { userId: user.id, token });
    });

    socketRef.current.on("agent:progress", (data) => {
      addProgressMessage(data.message);
    });

    socketRef.current.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [user, token, addProgressMessage]);

  return socketRef.current;
};

export const useApi = () => {
  const { token } = useShipMindStore();

  const request = async (
    method: string,
    endpoint: string,
    data?: any
  ) => {
    const response = await fetch(`http://localhost:3001/api${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  };

  return {
    get: (endpoint: string) => request("GET", endpoint),
    post: (endpoint: string, data: any) => request("POST", endpoint, data),
    put: (endpoint: string, data: any) => request("PUT", endpoint, data),
    delete: (endpoint: string) => request("DELETE", endpoint),
  };
};
