import { useState, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useMotionTemplate,
  useAnimationFrame,
} from "framer-motion";

const GridPattern = ({
  offsetX,
  offsetY,
}: {
  offsetX: ReturnType<typeof useMotionValue<number>>;
  offsetY: ReturnType<typeof useMotionValue<number>>;
}) => (
  <svg className="w-full h-full">
    <defs>
      <motion.pattern
        id="splash-grid"
        width="40"
        height="40"
        patternUnits="userSpaceOnUse"
        x={offsetX}
        y={offsetY}
      >
        <path
          d="M 40 0 L 0 0 0 40"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-blue-400/40"
        />
      </motion.pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#splash-grid)" />
  </svg>
);

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<"loading" | "reveal" | "done">("loading");

  const gridX = useMotionValue(0);
  const gridY = useMotionValue(0);

  useAnimationFrame(() => {
    if (phase === "done") return;
    gridX.set((gridX.get() + 0.8) % 40);
    gridY.set((gridY.get() + 0.8) % 40);
  });

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("reveal"), 2200);
    const t2 = setTimeout(() => {
      setPhase("done");
      onComplete();
    }, 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      {phase !== "done" && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: "linear-gradient(160deg, #ffffff 0%, #f0f6ff 60%, #e8f2ff 100%)" }}
          initial={{ y: 0 }}
          animate={phase === "reveal" ? { y: "-100%" } : { y: 0 }}
          exit={{ y: "-100%" }}
          transition={
            phase === "reveal"
              ? { duration: 0.9, ease: [0.76, 0, 0.24, 1] }
              : { duration: 0.3 }
          }
        >
          {/* Grid background */}
          <div className="absolute inset-0 opacity-[0.08]">
            <GridPattern offsetX={gridX} offsetY={gridY} />
          </div>

          {/* Glow orbs */}
          <div className="absolute inset-0 pointer-events-none">
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[120px]"
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute top-[30%] right-[20%] w-[200px] h-[200px] rounded-full bg-primary/15 blur-[80px]"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            />
          </div>

          {/* Logo + content */}
          <div className="relative z-10 flex flex-col items-center gap-8">
            {/* Animated logo mark */}
            <motion.div
              className="relative"
              initial={{ scale: 0, opacity: 0, rotateY: -90 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            >
              <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
                <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  verified
                </span>
              </div>
              {/* Pulse ring */}
              <motion.div
                className="absolute inset-0 rounded-2xl border-2 border-primary/40"
                animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
              />
            </motion.div>

            {/* Logo text */}
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <h1 className="text-3xl font-bold font-headline text-slate-900 tracking-tight">
                Med<span className="text-primary italic">Secure</span>
              </h1>
              <motion.p
                className="text-sm text-slate-400 font-label tracking-widest uppercase mt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.5 }}
              >
                Pharmaceutical Ledger
              </motion.p>
            </motion.div>

            {/* Progress bar */}
            <motion.div
              className="w-48 h-[3px] bg-slate-200/60 rounded-full overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 1.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              />
            </motion.div>

            {/* Loading dots */}
            <motion.div
              className="flex items-center gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-primary/50"
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
