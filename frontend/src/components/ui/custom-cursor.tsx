import { useEffect, useRef, useCallback } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

type CursorState = "default" | "hover" | "click" | "text" | "disabled";

const CURSOR_SIZE = { default: 10, hover: 44, click: 6, text: 3, disabled: 10 };
const RING_SIZE = { default: 38, hover: 58, click: 30, text: 38, disabled: 38 };

export function CustomCursor() {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const state = useRef<CursorState>("default");
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  const springX = useSpring(cursorX, { stiffness: 150, damping: 20, mass: 0.5 });
  const springY = useSpring(cursorY, { stiffness: 150, damping: 20, mass: 0.5 });

  // Slow trailing glow — merges into grid
  const glowX = useSpring(cursorX, { stiffness: 60, damping: 35, mass: 1.2 });
  const glowY = useSpring(cursorY, { stiffness: 60, damping: 35, mass: 1.2 });

  const onMouseMove = useCallback((e: MouseEvent) => {
    cursorX.set(e.clientX);
    cursorY.set(e.clientY);
  }, [cursorX, cursorY]);

  const applyState = useCallback((s: CursorState) => {
    state.current = s;
    const dot = dotRef.current;
    const ring = ringRef.current;
    const glow = glowRef.current;
    if (!dot || !ring || !glow) return;

    dot.style.width = `${CURSOR_SIZE[s]}px`;
    dot.style.height = `${CURSOR_SIZE[s]}px`;
    ring.style.width = `${RING_SIZE[s]}px`;
    ring.style.height = `${RING_SIZE[s]}px`;

    if (s === "hover") {
      dot.style.background = "rgba(10, 18, 40, 0.9)";
      dot.style.boxShadow = "0 0 20px 5px rgba(0, 74, 198, 0.3)";
      ring.style.borderColor = "rgba(0, 74, 198, 0.35)";
      ring.style.background = "rgba(0, 74, 198, 0.04)";
      glow.style.opacity = "0.18";
      glow.style.width = "140px";
      glow.style.height = "140px";
    } else if (s === "click") {
      dot.style.background = "rgba(0, 74, 198, 1)";
      dot.style.boxShadow = "0 0 35px 10px rgba(0, 74, 198, 0.4)";
      ring.style.borderColor = "rgba(0, 74, 198, 0.6)";
      ring.style.background = "transparent";
      glow.style.opacity = "0.25";
      glow.style.width = "100px";
      glow.style.height = "100px";
    } else if (s === "text") {
      dot.style.background = "rgba(0, 74, 198, 0.7)";
      dot.style.boxShadow = "none";
      ring.style.borderColor = "rgba(0, 74, 198, 0.15)";
      ring.style.background = "transparent";
      glow.style.opacity = "0.06";
      glow.style.width = "60px";
      glow.style.height = "60px";
    } else if (s === "disabled") {
      dot.style.background = "rgba(115, 118, 134, 0.4)";
      dot.style.boxShadow = "none";
      ring.style.borderColor = "rgba(115, 118, 134, 0.2)";
      ring.style.background = "transparent";
      glow.style.opacity = "0";
    } else {
      // Default — dark dot, subtle glow blends into grid
      dot.style.background = "rgba(10, 18, 40, 0.85)";
      dot.style.boxShadow = "0 0 10px 2px rgba(0, 74, 198, 0.15)";
      ring.style.borderColor = "rgba(0, 74, 198, 0.12)";
      ring.style.background = "transparent";
      glow.style.opacity = "0.08";
      glow.style.width = "100px";
      glow.style.height = "100px";
    }
  }, []);

  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    document.documentElement.style.cursor = "none";

    const onDown = () => applyState("click");
    const onUp = () => {
      const el = document.elementFromPoint(cursorX.get(), cursorY.get());
      applyState(getStateForEl(el));
    };
    const onOver = (e: MouseEvent) => applyState(getStateForEl(e.target as Element));

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mousedown", onDown, { passive: true });
    window.addEventListener("mouseup", onUp, { passive: true });
    window.addEventListener("mouseover", onOver, { passive: true });
    applyState("default");

    return () => {
      document.documentElement.style.cursor = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mouseover", onOver);
    };
  }, [onMouseMove, applyState, cursorX, cursorY]);

  if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[99999]" aria-hidden="true">
      {/* Ambient glow — slowest layer, blends into the grid */}
      <motion.div
        ref={glowRef}
        className="fixed top-0 left-0 rounded-full"
        style={{
          x: glowX, y: glowY,
          translateX: "-50%", translateY: "-50%",
          width: 100, height: 100,
          background: "radial-gradient(circle, rgba(0, 74, 198, 0.6) 0%, rgba(59, 130, 246, 0.15) 40%, transparent 70%)",
          opacity: 0.08,
          transition: "width 0.6s ease, height 0.6s ease, opacity 0.5s ease",
          willChange: "transform",
        }}
      />
      {/* Ring — follows with spring delay */}
      <motion.div
        ref={ringRef}
        className="fixed top-0 left-0 rounded-full border-[1.5px]"
        style={{
          x: springX, y: springY,
          translateX: "-50%", translateY: "-50%",
          width: 38, height: 38,
          borderColor: "rgba(0, 74, 198, 0.12)",
          transition: "width 0.3s cubic-bezier(0.22,1,0.36,1), height 0.3s cubic-bezier(0.22,1,0.36,1), border-color 0.2s, background 0.2s",
          willChange: "transform",
        }}
      />
      {/* Dot — precise, dark, solid */}
      <motion.div
        ref={dotRef}
        className="fixed top-0 left-0 rounded-full"
        style={{
          x: cursorX, y: cursorY,
          translateX: "-50%", translateY: "-50%",
          width: 10, height: 10,
          background: "rgba(10, 18, 40, 0.85)",
          boxShadow: "0 0 10px 2px rgba(0, 74, 198, 0.15)",
          transition: "width 0.2s cubic-bezier(0.22,1,0.36,1), height 0.2s cubic-bezier(0.22,1,0.36,1), background 0.2s, box-shadow 0.25s",
          willChange: "transform",
        }}
      />
    </div>
  );
}

function getStateForEl(el: Element | null): CursorState {
  if (!el) return "default";
  const node = el.closest("a, button, [role='button'], input, textarea, select, [data-cursor]");
  if (!node) return "default";
  if ((node as HTMLButtonElement).disabled) return "disabled";
  if (node.matches("input, textarea, select")) return "text";
  return "hover";
}
