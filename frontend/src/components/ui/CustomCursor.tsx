/**
 * CustomCursor — GSAP-powered glowing magnetic cursor
 *
 * Replaces the default OS cursor with a futuristic neon ring
 * that follows the mouse with a spring-like lag. Interactive
 * elements trigger a "magnetic" expansion effect.
 */

import { useEffect, useRef } from "react";
import { gsap } from "gsap";

export const CustomCursor: React.FC = () => {
  const cursorRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const pos = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const cursor = cursorRef.current!;
    const dot = dotRef.current!;

    const onMove = (e: MouseEvent) => {
      target.current = { x: e.clientX, y: e.clientY };
      // Dot follows instantly
      gsap.set(dot, { x: e.clientX - 4, y: e.clientY - 4 });
    };

    // Smooth ring lerp
    const tick = () => {
      pos.current.x += (target.current.x - pos.current.x) * 0.12;
      pos.current.y += (target.current.y - pos.current.y) * 0.12;
      gsap.set(cursor, {
        x: pos.current.x - 20,
        y: pos.current.y - 20,
      });
    };

    gsap.ticker.add(tick);
    window.addEventListener("mousemove", onMove);

    // Expand on interactive elements
    const interactives = document.querySelectorAll(
      "button, a, input, [data-cursor-expand]"
    );

    const expand = () =>
      gsap.to(cursor, { scale: 2.5, opacity: 0.5, duration: 0.3, ease: "power2.out" });
    const shrink = () =>
      gsap.to(cursor, { scale: 1, opacity: 1, duration: 0.3, ease: "power2.out" });

    interactives.forEach((el) => {
      el.addEventListener("mouseenter", expand);
      el.addEventListener("mouseleave", shrink);
    });

    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("mousemove", onMove);
      interactives.forEach((el) => {
        el.removeEventListener("mouseenter", expand);
        el.removeEventListener("mouseleave", shrink);
      });
    };
  }, []);

  return (
    <>
      {/* Outer glowing ring */}
      <div
        ref={cursorRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference"
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "2px solid #00d4ff",
          boxShadow: "0 0 12px #00d4ff, 0 0 30px rgba(0,212,255,0.3)",
          willChange: "transform",
        }}
      />
      {/* Inner dot */}
      <div
        ref={dotRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999]"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#00d4ff",
          boxShadow: "0 0 8px #00d4ff",
          willChange: "transform",
        }}
      />
    </>
  );
};
