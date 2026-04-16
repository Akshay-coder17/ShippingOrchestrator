/**
 * NewShipment page — Mission-Control Orchestration UI
 *
 * User types a natural-language shipping prompt → backend dispatches BullMQ job →
 * Socket.io streams real-time agent progress → final plan shown with animated Google Map.
 *
 * Fixes vs original:
 *  - setOrchestration now uses partial merge (accepts Partial<OrchestrationState>)
 *  - Socket events wired correctly without stale-closure bugs
 *  - Full results panel with cost, route, ETA, risk, carbon breakdown
 *  - RL/Meta-RL reward summary shown below plan
 *
 * @module pages/NewShipment
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useApi, useSocket } from "@/hooks/index.js";
import { useShipMindStore } from "@/store/useShipMindStore.js";
import { Layout } from "@/components/dashboard/Layout.js";
import { InteractiveMap } from "@/components/map/InteractiveMap.js";
import {
  Zap, Send, Activity, Package, Clock, DollarSign,
  Shield, Leaf, AlertTriangle, Route, Star, ChevronRight,
} from "lucide-react";

const SUGGESTION_CHIPS = [
  "Ship 500kg electronics from Chennai to Berlin by next Friday, cost-optimized",
  "Send 1 ton machinery from Shanghai to Rotterdam, fastest route",
  "Deliver pharma samples urgently from NYC to Tokyo, full compliance",
  "Eco-friendly consignment Mumbai to Amsterdam, 200kg textiles",
];

// ── Sub-components ─────────────────────────────────────────────────────────────

const AgentLogItem: React.FC<{ message: string; index: number }> = ({ message, index }) => (
  <motion.div
    initial={{ opacity: 0, x: -16 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.04 }}
    className="flex items-start gap-3 text-sm"
  >
    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 flex-shrink-0 animate-pulse" />
    <span className="text-white/70 font-mono text-xs leading-relaxed">{message}</span>
  </motion.div>
);

const PlanCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  color?: string;
}> = ({ icon: Icon, label, value, color = "#00d4ff" }) => (
  <div
    className="rounded-xl p-4 border flex items-center gap-3"
    style={{
      background: "rgba(255,255,255,0.03)",
      borderColor: `${color}20`,
    }}
  >
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: `${color}15` }}
    >
      <Icon className="w-4 h-4" style={{ color }} />
    </div>
    <div>
      <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-white">{value}</p>
    </div>
  </div>
);

// ── Page ───────────────────────────────────────────────────────────────────────

export const NewShipmentPage: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const api    = useApi();
  const socket = useSocket();
  const { orchestration, setOrchestration, addProgressMessage, currentPlan, setCurrentPlan } =
    useShipMindStore();

  // Auto-scroll agent feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [orchestration.progress]);

  // Wire Socket.io events
  useEffect(() => {
    if (!socket) return;

    const onProgress = (data: { queryId: string; message: string }) => {
      addProgressMessage(data.message);
    };

    const onComplete = (data: { queryId: string; shipmentId: string; plan: any }) => {
      setCurrentPlan({ ...data.plan, id: data.shipmentId });
      setOrchestration({ status: "complete" });
      addProgressMessage("✅ Orchestration complete! Shipment plan ready.");
      setIsSubmitting(false);
    };

    const onError = (data: { queryId: string; error: string }) => {
      setOrchestration({ status: "error", error: data.error });
      addProgressMessage(`❌ Error: ${data.error}`);
      setIsSubmitting(false);
    };

    socket.on("agent:progress", onProgress);
    socket.on("orchestration:complete", onComplete);
    socket.on("orchestration:error", onError);
    socket.on("orchestration:started", () =>
      addProgressMessage("🔌 Connected to orchestration worker...")
    );

    return () => {
      socket.off("agent:progress", onProgress);
      socket.off("orchestration:complete", onComplete);
      socket.off("orchestration:error", onError);
      socket.off("orchestration:started");
    };
  }, [socket, addProgressMessage, setCurrentPlan, setOrchestration]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setOrchestration({ status: "loading", progress: ["🚀 Dispatching orchestration job..."], error: undefined });
    setCurrentPlan({ status: "idle" });

    try {
      const response = await api.post("/shipments/orchestrate", { prompt });
      setCurrentQueryId(response.queryId);
      addProgressMessage(`📋 Query ID: ${response.queryId}`);
      addProgressMessage("⏳ Waiting for worker to pick up job…");
    } catch (err: any) {
      setOrchestration({ status: "error", error: err.message });
      addProgressMessage(`❌ Dispatch failed: ${err.message}`);
      setIsSubmitting(false);
    }
  };

  const plan = currentPlan as any;
  const hasPlan = orchestration.status === "complete" && plan?.route;

  return (
    <Layout>
      <div className="space-y-8 max-w-7xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-white mb-1">
            Intelligent Shipping{" "}
            <span className="text-cyan-400">Orchestration</span>
          </h1>
          <p className="text-white/40 text-sm">
            Describe your shipment in natural language — 6 AI agents + RL engine will plan it
          </p>
        </motion.div>

        {/* Prompt card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-6 border border-white/5"
          style={{ background: "rgba(255,255,255,0.02)", backdropFilter: "blur(12px)" }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <textarea
                rows={3}
                placeholder="E.g., Ship 500kg electronics from Chennai to Berlin by next Friday, cost-optimized…"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all resize-none text-sm leading-relaxed"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) handleSubmit(e as any);
                }}
              />
              <p className="absolute bottom-3 right-3 text-white/20 text-xs">⌘↵ to send</p>
            </div>

            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setPrompt(chip)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-white/10 bg-white/5 hover:bg-cyan-500/10 hover:border-cyan-500/30 text-white/50 hover:text-cyan-400 transition-all"
                >
                  {chip.slice(0, 48)}…
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !prompt.trim()}
              className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all"
              style={{
                background: isSubmitting || !prompt.trim()
                  ? "rgba(0,212,255,0.1)"
                  : "linear-gradient(135deg, #00d4ff, #0066ff)",
                color: isSubmitting || !prompt.trim() ? "rgba(255,255,255,0.3)" : "white",
                boxShadow: isSubmitting || !prompt.trim()
                  ? "none"
                  : "0 0 30px rgba(0,212,255,0.3)",
                cursor: isSubmitting || !prompt.trim() ? "not-allowed" : "pointer",
              }}
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Orchestrating agents…
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Get AI Shipping Plan
                  <Send className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Orchestration feed + results */}
        <AnimatePresence>
          {orchestration.status !== "idle" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="grid lg:grid-cols-2 gap-6"
            >
              {/* Agent activity feed */}
              <div
                className="rounded-2xl p-6 border border-white/5"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Activity className="w-5 h-5 text-violet-400" />
                  <h2 className="text-white font-semibold">Agent Activity Feed</h2>
                  {isSubmitting && (
                    <div className="ml-auto flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-cyan-400 text-xs">LIVE</span>
                    </div>
                  )}
                </div>
                <div
                  ref={feedRef}
                  className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
                >
                  {orchestration.progress.map((msg, i) => (
                    <AgentLogItem key={i} message={msg} index={i} />
                  ))}
                  {isSubmitting && (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce" />
                      <span className="text-white/30 text-xs">Processing…</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Shipment plan preview */}
              <div
                className="rounded-2xl p-6 border border-white/5"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Package className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-white font-semibold">Shipment Plan</h2>
                  {hasPlan && (
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                      Ready
                    </span>
                  )}
                </div>

                {hasPlan ? (
                  <div className="grid grid-cols-2 gap-3">
                    <PlanCard
                      icon={Route}
                      label="Route"
                      value={`${plan.route?.totalDistanceKm?.toFixed(0) ?? "—"} km`}
                      color="#00d4ff"
                    />
                    <PlanCard
                      icon={Clock}
                      label="ETA"
                      value={plan.eta ? new Date(plan.eta).toLocaleDateString() : "—"}
                      color="#8b5cf6"
                    />
                    <PlanCard
                      icon={DollarSign}
                      label="Total Cost"
                      value={
                        plan.cost?.total
                          ? `${plan.cost.currency || "$"}${plan.cost.total.toLocaleString()}`
                          : "—"
                      }
                      color="#10b981"
                    />
                    <PlanCard
                      icon={Shield}
                      label="Risk Level"
                      value={plan.risk?.level || "—"}
                      color={
                        plan.risk?.level === "low"
                          ? "#10b981"
                          : plan.risk?.level === "medium"
                          ? "#f59e0b"
                          : "#ef4444"
                      }
                    />
                    <PlanCard
                      icon={Leaf}
                      label="CO₂"
                      value={`${plan.carbon?.totalCO2_kg?.toFixed(1) ?? "—"} kg`}
                      color="#22c55e"
                    />
                    <PlanCard
                      icon={Package}
                      label="Carrier"
                      value={plan.carrier?.name || "—"}
                      color="#f97316"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-center">
                    {orchestration.status === "loading" ? (
                      <>
                        <div className="w-12 h-12 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-3" />
                        <p className="text-white/40 text-sm">Agents are working…</p>
                      </>
                    ) : orchestration.status === "error" ? (
                      <>
                        <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
                        <p className="text-red-400 text-sm">{orchestration.error}</p>
                      </>
                    ) : (
                      <p className="text-white/30 text-sm">Awaiting results…</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Agent RL reward summary */}
        {hasPlan && plan.agentRewards && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl p-6 border border-white/5"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Star className="w-5 h-5 text-amber-400" />
              <h2 className="text-white font-semibold">Agent Q-Value Rewards (RL)</h2>
              <span className="ml-auto text-white/30 text-xs">Q-learning Meta-RL</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(plan.agentRewards).map(([name, val]: [string, any]) => (
                <div
                  key={name}
                  className="rounded-xl p-3 border border-white/5"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <p className="text-white/40 text-xs mb-1">{name}</p>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(Number(val) * 100).toFixed(0)}%`,
                        background: "linear-gradient(90deg, #00d4ff, #0066ff)",
                      }}
                    />
                  </div>
                  <p className="text-cyan-400 text-xs mt-1 text-right">{(Number(val) * 100).toFixed(0)}%</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Animated Google Map */}
        {hasPlan && plan.route && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Route className="w-5 h-5 text-cyan-400" />
              <h2 className="text-white font-semibold">Route Visualization</h2>
              <span className="text-white/30 text-sm ml-2">
                {plan.route.origin?.name} → {plan.route.destination?.name}
              </span>
              <ChevronRight className="w-4 h-4 text-white/20" />
            </div>
            <InteractiveMap shipmentPlan={plan} />
          </motion.div>
        )}
      </div>
    </Layout>
  );
};
