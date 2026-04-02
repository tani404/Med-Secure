import { useEffect, useRef, useCallback } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

type CursorState = "default" | "hover" | "click" | "text" | "disabled";

const CURSOR_SIZE = { default: 12, hover: 44, click: 8, text: 4, disabled: 12 };
const RING_SIZE = { default: 40, hover: 60, click: 32, text: 40, disabled: 40 };

export function CustomCursor() {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const state = useRef<CursorState>("default");
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  /* Smooth spring follow — the ring lags behind the dot */
  const springX = useSpring(cursorX, { stiffness: 150, damping: 20, mass: 0.5 });
  const springY = useSpring(cursorY, { stiffness: 150, damping: 20, mass: 0.5 });

  /* rAF-based mouse tracking */
  const onMouseMove = useCallback((e: MouseEvent) => {
    cursorX.set(e.clientX);
    cursorY.set(e.clientY);
  }, [cursorX, cursorY]);

  const applyState = useCallback((s: CursorState) => {
    state.current = s;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const ds = CURSOR_SIZE[s];
    const rs = RING_SIZE[s];

    dot.style.width = `${ds}px`;
    dot.style.height = `${ds}px`;
    ring.style.width = `${rs}px`;
    ring.style.height = `${rs}px`;

    /* Colors */
    if (s === "hover") {
      dot.style.background = "rgba(0, 74, 198, 0.9)";
      dot.style.boxShadow = "0 0 20px 4px rgba(0, 74, 198, 0.3)";
      ring.style.borderColor = "rgba(0, 74, 198, 0.4)";
      ring.style.background = "rgba(0, 74, 198, 0.04)";
    } else if (s === "click") {
      dot.style.background = "rgba(0, 74, 198, 1)";
      dot.style.boxShadow = "0 0 30px 8px rgba(0, 74, 198, 0.4)";
      ring.style.borderColor = "rgba(0, 74, 198, 0.6)";
      ring.style.background = "transparent";
    } else if (s === "text") {
      dot.style.background = "rgba(0, 74, 198, 0.7)";
      dot.style.boxShadow = "none";
      ring.style.borderColor = "rgba(0, 74, 198, 0.2)";
      ring.style.background = "transparent";
    } else if (s === "disabled") {
      dot.style.background = "rgba(115, 118, 134, 0.5)";
      dot.style.boxShadow = "none";
      ring.style.borderColor = "rgba(115, 118, 134, 0.3)";
      ring.style.background = "transparent";
    } else {
      dot.style.background = "rgba(19, 27, 46, 0.8)";
      dot.style.boxShadow = "0 0 8px 2px rgba(0, 74, 198, 0.15)";
      ring.style.borderColor = "rgba(0, 74, 198, 0.15)";
      ring.style.background = "transparent";
    }
  }, []);

  useEffect(() => {
    /* Only show custom cursor on non-touch devices */
    if (window.matchMedia("(pointer: coarse)").matches) return;

    document.documentElement.style.cursor = "none";

    const onDown = () => applyState("click");
    const onUp = () => {
      const el = document.elementFromPoint(cursorX.get(), cursorY.get());
      applyState(getStateForEl(el));
    };

    const onOver = (e: MouseEvent) => {
      applyState(getStateForEl(e.target as Element));
    };

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

  /* Hide on touch devices */
  if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[99999]" aria-hidden="true">
      {/* Dot — follows cursor exactly */}
      <motion.div
        ref={dotRef}
        className="fixed top-0 left-0 rounded-full"
        style={{
          x: cursorX,
          y: cursorY,
          translateX: "-50%",
          translateY: "-50%",
          width: 12,
          height: 12,
          background: "rgba(19, 27, 46, 0.8)",
          boxShadow: "0 0 8px 2px rgba(0, 74, 198, 0.15)",
          transition: "width 0.25s cubic-bezier(0.22,1,0.36,1), height 0.25s cubic-bezier(0.22,1,0.36,1), background 0.25s, box-shadow 0.3s",
          willChange: "transform",
        }}
      />
      {/* Ring — follows with spring delay */}
      <motion.div
        ref={ringRef}
        className="fixed top-0 left-0 rounded-full border-[1.5px]"
        style={{
          x: springX,
          y: springY,
          translateX: "-50%",
          translateY: "-50%",
          width: 40,
          height: 40,
          borderColor: "rgba(0, 74, 198, 0.15)",
          transition: "width 0.35s cubic-bezier(0.22,1,0.36,1), height 0.35s cubic-bezier(0.22,1,0.36,1), border-color 0.25s, background 0.25s",
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
