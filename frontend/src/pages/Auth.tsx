/**
 * Authentication pages - Login and Register
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useShipMindStore } from "@/store/useShipMindStore.js";
import { Card, Button, Input } from "@/components/ui/index.js";
import { Mail, Lock, User } from "lucide-react";

interface AuthPageProps {
  isLogin?: boolean;
}

export const AuthPage: React.FC<AuthPageProps> = ({ isLogin = true }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });
  const setUser = useShipMindStore((state) => state.setUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      setUser(data.user, data.token);
      localStorage.setItem("token", data.token);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold glow-text mb-2">🚀 ShipMind</h1>
          <p className="text-text-primary/60">
            {isLogin ? "Welcome back" : "Create your account"}
          </p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm mb-2">Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4 h-4 text-accent" />
                  <Input
                    type="text"
                    placeholder="Your name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="pl-10"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-4 h-4 text-accent" />
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-accent" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="pl-10"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-2"
            >
              {loading ? "Processing..." : isLogin ? "Login" : "Register"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-text-primary/60">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() =>
                navigate(isLogin ? "/auth/register" : "/auth/login")
              }
              className="text-accent hover:underline"
            >
              {isLogin ? "Register" : "Login"}
            </button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};
