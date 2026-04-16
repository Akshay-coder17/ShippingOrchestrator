/**
 * Dashboard — Mission Control Center
 *
 * Premium dark UI with:
 * - Three.js animated 3D globe
 * - Live agent activity feed
 * - Animated KPI metric cards (GSAP counters)
 * - Q-value performance bar charts
 * - Quick actions panel
 */

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { useNavigate } from "react-router-dom";
import { useApi } from "../hooks/index.js";
import { useShipMindStore } from "../store/useShipMindStore.js";
import { Layout } from "../components/dashboard/Layout.js";
import { GlobeScene } from "../components/ui/GlobeScene.js";
import {
  Package, Zap, TrendingUp, BarChart3, Activity,
  ArrowRight, Shield, Bot, Cpu, Globe2
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

interface MetricCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  suffix?: string;
  delay?: number;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, icon: Icon, color, suffix = "", delay = 0 }) => {
  const numRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (typeof value === "number" && numRef.current) {
      gsap.fromTo(numRef.current, { innerText: 0 }, {
        innerText: value,
        duration: 1.5,
        delay,
        ease: "power2.out",
        snap: { innerText: 1 },
        roundProps: "innerText",
      });
    }
  }, [value, delay]);

  return (
    <motion.div variants={itemVariants}>
      <div
        className="relative rounded-2xl p-6 border overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
        style={{
          background: "rgba(255,255,255,0.02)",
          borderColor: `${color}20`,
          backdropFilter: "blur(12px)",
          boxShadow: `0 0 30px ${color}08, inset 0 1px 0 rgba(255,255,255,0.05)`,
        }}
      >
        {/* Glow corner */}
        <div
          className="absolute -top-4 -right-4 w-24 h-24 rounded-full opacity-20 group-hover:opacity-30 transition-opacity"
          style={{ background: color, filter: "blur(20px)" }}
        />

        <div className="flex items-start justify-between relative z-10">
          <div>
            <p className="text-white/40 text-xs uppercase tracking-wider mb-2">{label}</p>
            <p className="text-3xl font-bold text-white">
              {typeof value === "number" ? (
                <span ref={numRef}>0</span>
              ) : (
                <span>{value}</span>
              )}
              {suffix && <span className="text-lg font-normal text-white/50 ml-1">{suffix}</span>}
            </p>
          </div>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${color}20`, border: `1px solid ${color}30` }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

/** Agent performance bar */
const AgentBar: React.FC<{ name: string; qValue: number; color: string }> = ({ name, qValue, color }) => {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (barRef.current) {
      gsap.fromTo(barRef.current, { width: "0%" }, {
        width: `${(qValue * 100).toFixed(0)}%`,
        duration: 1.2,
        ease: "power3.out",
        delay: 0.3,
      });
    }
  }, [qValue]);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-white/60">{name}</span>
        <span style={{ color }}>{(qValue * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          ref={barRef}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, ${color}80)` }}
        />
      </div>
    </div>
  );
};

export const DashboardPage: React.FC = () => {
  const api = useApi();
  const navigate = useNavigate();
  const { user, orchestration } = useShipMindStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/analytics/overview")
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  const agentColors: Record<string, string> = {
    RouteOptimizer: "#00d4ff",
    CarrierSelection: "#8b5cf6",
    Compliance: "#10b981",
    RiskAssessment: "#f59e0b",
    CarbonFootprint: "#22c55e",
    Pricing: "#f97316",
  };

  const metrics = [
    { label: "Total Shipments", value: stats?.totalShipments ?? 0, icon: Package, color: "#00d4ff" },
    { label: "Queries Processed", value: stats?.userQueries ?? 0, icon: Zap, color: "#8b5cf6", delay: 0.1 },
    { label: "Avg Rating", value: stats?.avgRating?.toFixed(1) ?? "—", icon: TrendingUp, color: "#10b981", delay: 0.2 },
    { label: "Active Routes", value: stats?.activeRoutes ?? 0, icon: Globe2, color: "#f59e0b", delay: 0.3 },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-start justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">
              Mission Control{" "}
              <span className="text-cyan-400">Center</span>
            </h1>
            <p className="text-white/40 text-sm">
              Welcome back, {user?.name || "Commander"} · AI agents are standing by
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/shipment/new")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-black"
            style={{ background: "linear-gradient(135deg, #00d4ff, #0066ff)", boxShadow: "0 0 25px rgba(0,212,255,0.35)" }}
          >
            <Zap className="w-4 h-4" />
            New Shipment
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </motion.div>

        {/* 2-column hero layout */}
        <div className="grid lg:grid-cols-5 gap-6">
          {/* Metric cards */}
          <div className="lg:col-span-3 space-y-4">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 gap-4"
            >
              {metrics.map((m) => (
                <MetricCard key={m.label} {...m} />
              ))}
            </motion.div>

            {/* Quick action banner */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="rounded-2xl p-5 border border-violet-500/20 relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.1), rgba(0,102,255,0.05))" }}
            >
              <div className="absolute inset-0 opacity-5"
                style={{ backgroundImage: "radial-gradient(circle at 20% 50%, #8b5cf6, transparent 60%)" }}
              />
              <div className="relative flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-6 h-6 text-violet-400" />
                </div>
                <div>
                  <p className="text-white font-semibold">AI Agents Ready</p>
                  <p className="text-white/40 text-sm">6 sub-agents • Q-learning RL engine • Claude claude-3.5-sonnet</p>
                </div>
                <button
                  onClick={() => navigate("/shipment/new")}
                  className="ml-auto px-4 py-2 rounded-lg border border-violet-500/30 text-violet-400 text-sm hover:bg-violet-500/10 transition-colors flex-shrink-0"
                >
                  Orchestrate →
                </button>
              </div>
            </motion.div>
          </div>

          {/* 3D Globe */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="lg:col-span-2 rounded-2xl border border-white/5 overflow-hidden relative"
            style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", minHeight: 300 }}
          >
            <div className="absolute top-4 left-4 z-10">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-cyan-400 text-xs font-medium">Live Route Globe</span>
              </div>
            </div>
            <GlobeScene />
          </motion.div>
        </div>

        {/* Agent Performance */}
        {stats?.agentPerformance && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-2xl p-6 border border-white/5"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <h2 className="text-white font-semibold">Agent Q-Value Performance</h2>
              <span className="ml-auto text-white/30 text-xs">Last 30 days · Q-learning RL</span>
            </div>

            <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
              {Object.entries(stats.agentPerformance).map(
                ([name, data]: any) => (
                  <AgentBar
                    key={name}
                    name={data.name || name}
                    qValue={Math.max(0, Math.min(1, (data.avgReward + 1) / 2))}
                    color={agentColors[name] || "#00d4ff"}
                  />
                )
              )}
            </div>
          </motion.div>
        )}

        {/* Last orchestration feed */}
        {orchestration.progress.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="rounded-2xl p-6 border border-white/5"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Activity className="w-5 h-5 text-violet-400" />
              <h2 className="text-white font-semibold">Last Agent Activity</h2>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {orchestration.progress.slice(-8).map((msg, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 flex-shrink-0" />
                  <span className="text-white/50">{msg}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </Layout>
  );
};
