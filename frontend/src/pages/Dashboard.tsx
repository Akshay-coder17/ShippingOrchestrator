/**
 * Dashboard page
 */

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useApi } from "@/hooks/index.js";
import { Layout } from "@/components/dashboard/Layout.js";
import { Card, Badge } from "@/components/ui/index.js";
import { TrendingDown, TrendingUp, Package, Zap } from "lucide-react";

export const DashboardPage: React.FC = () => {
  const api = useApi();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.get("/analytics/overview");
      setStats(data);
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const metrics = [
    {
      label: "Total Shipments",
      value: stats?.totalShipments || 0,
      icon: Package,
      color: "accent",
    },
    {
      label: "Avg Rating",
      value: stats?.avgRating ? stats.avgRating.toFixed(1) : "—",
      icon: TrendingUp,
      color: "accent-green",
    },
    {
      label: "Queries",
      value: stats?.userQueries || 0,
      icon: Zap,
      color: "accent-orange",
    },
  ];

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-text-primary/60">
            Overview of your shipping operations
          </p>
        </motion.div>

        {/* Metrics grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ staggerChildren: 0.1 }}
        >
          {metrics.map((metric, idx) => {
            const Icon = metric.icon;
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-text-primary/60 text-sm mb-2">
                        {metric.label}
                      </p>
                      <p className="text-3xl font-bold">{metric.value}</p>
                    </div>
                    <Icon className={`w-8 h-8 text-${metric.color}`} />
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Recent shipments */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <Card className="p-6">
            <div className="space-y-4">
              <p className="text-text-primary/60 text-sm">
                Ready to create your next shipment? Use the powerful NLP interface to describe your shipping needs.
              </p>
              <button
                onClick={() => window.location.href = "/shipment/new"}
                className="px-4 py-2 bg-accent text-black rounded-lg font-semibold hover:bg-opacity-90 transition-all"
              >
                Create New Shipment →
              </button>
            </div>
          </Card>
        </motion.div>

        {/* Agent performance */}
        {stats?.agentPerformance && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h2 className="text-xl font-semibold mb-4">Agent Performance</h2>
            <Card className="p-6">
              <div className="space-y-4">
                {Object.entries(stats.agentPerformance).map(
                  ([agentName, agentData]: any) => (
                    <div key={agentName} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div>
                        <p className="font-semibold">{agentData.name}</p>
                        <p className="text-sm text-text-primary/60">
                          {agentData.actionCount} actions | Avg reward:{" "}
                          {agentData.avgReward.toFixed(2)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          agentData.avgReward > 0.5 ? "success" : "default"
                        }
                      >
                        {(agentData.avgReward * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  )
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </Layout>
  );
};
