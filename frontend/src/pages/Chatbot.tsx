/**
 * Chatbot page — Claude-powered shipping assistant
 *
 * Real-time streaming chat that uses the ShipMind Claude backend.
 * Messages persist in DB via /api/chat endpoint.
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "../components/dashboard/Layout.js";
import { useApi } from "../hooks/index.js";
import { Bot, User, Send, Sparkles } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  "What's the cheapest route from Mumbai to Rotterdam?",
  "Compare DHL vs Maersk for electronics from Shenzhen",
  "What documentation do I need for hazardous materials?",
  "Estimate carbon footprint for 2 tons Mumbai → NY",
];

const TypingIndicator = () => (
  <div className="flex gap-1 p-4">
    {[0, 1, 2].map((i) => (
      <motion.div
        key={i}
        className="w-2 h-2 rounded-full bg-cyan-400"
        animate={{ y: [-3, 3, -3] }}
        transition={{ duration: 0.8, delay: i * 0.2, repeat: Infinity }}
      />
    ))}
  </div>
);

export const ChatbotPage: React.FC = () => {
  const api = useApi();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hello! I'm ShipMind AI, your intelligent shipping assistant. I can help you plan routes, compare carriers, check compliance requirements, and optimize your logistics. What can I help you with today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: "user", content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { reply } = await api.post("/analytics/chat", {
        message: text,
        history,
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, timestamp: new Date() },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I'm having trouble connecting to my AI backend. Please ensure the server is running.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 mb-6"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Bot className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">ShipMind AI Assistant</h1>
            <p className="text-white/40 text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              Powered by Claude · Always on
            </p>
          </div>
        </motion.div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 scrollbar-thin scrollbar-thumb-white/10">
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                    msg.role === "assistant"
                      ? "bg-cyan-500/20 border border-cyan-500/30"
                      : "bg-violet-500/20 border border-violet-500/30"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                  ) : (
                    <User className="w-4 h-4 text-violet-400" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "assistant"
                      ? "rounded-tl-none"
                      : "rounded-tr-none"
                  }`}
                  style={{
                    background:
                      msg.role === "assistant"
                        ? "rgba(0,212,255,0.08)"
                        : "rgba(139,92,246,0.12)",
                    border: `1px solid ${msg.role === "assistant" ? "rgba(0,212,255,0.15)" : "rgba(139,92,246,0.2)"}`,
                    color: "rgba(255,255,255,0.85)",
                  }}
                >
                  {msg.content}
                  <div className="text-[10px] text-white/20 mt-2">
                    {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
              <div
                className="rounded-2xl rounded-tl-none border border-cyan-500/15"
                style={{ background: "rgba(0,212,255,0.06)" }}
              >
                <TypingIndicator />
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="px-3 py-1.5 rounded-xl text-xs border border-white/10 text-white/50 hover:text-white/80 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div
          className="flex gap-3 p-3 rounded-2xl border border-white/10"
          style={{ background: "rgba(255,255,255,0.03)" }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(input)}
            placeholder="Ask anything about shipping, routes, compliance..."
            className="flex-1 bg-transparent text-white/80 placeholder-white/25 text-sm focus:outline-none"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all flex-shrink-0"
            style={{
              background: input.trim() && !loading
                ? "linear-gradient(135deg, #00d4ff, #0066ff)"
                : "rgba(255,255,255,0.05)",
              opacity: !input.trim() || loading ? 0.4 : 1,
            }}
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </Layout>
  );
};
