/**
 * New Shipment page - Main query input and orchestration UI
 */

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useApi, useSocket } from "@/hooks/index.js";
import { useShipMindStore } from "@/store/useShipMindStore.js";
import { Layout } from "@/components/dashboard/Layout.js";
import { Card, Button, Input, Badge, LoadingSpinner } from "@/components/ui/index.js";
import { InteractiveMap } from "@/components/map/InteractiveMap.js";
import { Zap } from "lucide-react";

export const NewShipmentPage: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const api = useApi();
  const socket = useSocket();
  const {
    orchestration,
    setOrchestration,
    currentPlan,
    setCurrentPlan,
    setCurrentPlan: setPlan,
  } = useShipMindStore();

  const suggestinChips = [
    "Ship 500kg electronics from Chennai to Berlin",
    "Send 1 ton machinery from Shanghai to Rotterdam",
    "Deliver documents urgently from NYC to Tokyo",
    "Cost-optimized consignment Mumbai to Amsterdam",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsSubmitting(true);
    setOrchestration({
      status: "loading",
      progress: ["🚀 Initiating orchestration..."],
    });

    try {
      const response = await api.post("/shipments/orchestrate", { prompt });

      setCurrentPlan(response.plan);
      setOrchestration({
        status: "complete",
        progress: [
          ...orchestration.progress,
          "✅ Orchestration complete!",
        ],
      });
    } catch (error) {
      setOrchestration({
        status: "error",
        error: (error as Error).message,
        progress: [
          ...orchestration.progress,
          `❌ Error: ${(error as Error).message}`,
        ],
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Listen for Socket.io events
  useEffect(() => {
    if (!socket) return;

    socket.on("agent:progress", (data) => {
      setOrchestration((prev) => ({
        ...prev,
        progress: [...prev.progress, data.message],
      }));
    });

    socket.on("orchestration:complete", (data) => {
      setCurrentPlan(data.plan);
      setOrchestration({
        status: "complete",
        progress: [...orchestration.progress, "✅ Complete!"],
      });
    });

    return () => {
      socket.off("agent:progress");
      socket.off("orchestration:complete");
    };
  }, [socket, orchestration, setOrchestration, setCurrentPlan]);

  return (
    <Layout>
      <div className="space-y-8">
        {/* Hero Section */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold glow-text mb-2">
              Intelligent Shipping Orchestration
            </h1>
            <p className="text-text-primary/60">
              Describe your shipping need in natural language
            </p>
          </div>

          {/* Main input form */}
          <Card className="p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  placeholder="E.g., Ship 500kg electronics from Chennai to Berlin by next Friday, cost-optimized"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isSubmitting}
                  className="text-lg"
                />
              </div>

              {/* Suggestion chips */}
              <div className="flex flex-wrap gap-2">
                {suggestinChips.map((chip) => (
                  <button
                    key={chip}
                    onClick={() => setPrompt(chip)}
                    className="px-3 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-border text-text-primary/70 hover:text-accent transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !prompt.trim()}
                className="w-full py-3 text-lg"
              >
                {isSubmitting ? (
                  <>
                    <LoadingSpinner />
                    <span className="ml-2">Orchestrating...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2 inline" />
                    Get Shipping Plan
                  </>
                )}
              </Button>
            </form>
          </Card>
        </motion.div>

        {/* Orchestration UI - split view */}
        {orchestration.status !== "idle" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid lg:grid-cols-2 gap-8"
          >
            {/* Progress feed */}
            <Card className="p-6 h-96 overflow-y-auto">
               <h3 className="text-lg font-semibold mb-4">Agent Activity</h3>
              <div className="space-y-2">
                {orchestration.progress.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-start space-x-3 text-sm"
                  >
                    <div className="w-2 h-2 rounded-full bg-accent mt-1 flex-shrink-0" />
                    <span className="text-text-primary/80">{msg}</span>
                  </motion.div>
                ))}
              </div>
            </Card>

            {/* Results preview */}
            <Card className="p-6 h-96 overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4">Shipment Plan</h3>
              {orchestration.status === "complete" && currentPlan.id ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-text-primary/60 uppercase">ID</label>
                    <p className="text-sm font-mono">{currentPlan.id}</p>
                  </div>
                  <div>
                    <label className="text-xs text-text-primary/60 uppercase">Status</label>
                    <Badge variant="success">{currentPlan.status}</Badge>
                  </div>
                  {currentPlan.route && (
                    <div>
                      <label className="text-xs text-text-primary/60 uppercase">Route</label>
                      <p className="text-sm">{currentPlan.route.totalDistanceKm}km total</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-text-primary/60">Awaiting results...</p>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Map display */}
        {currentPlan.id && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="text-lg font-semibold mb-4">Route Visualization</h3>
            <InteractiveMap shipmentPlan={currentPlan as any} />
          </motion.div>
        )}
      </div>
    </Layout>
  );
};
