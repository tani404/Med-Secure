import { useState, useEffect, useRef } from "react";
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

/* ── DNA Helix Progress Bar ── */
const HELIX_W = 480;
const HELIX_H = 80;
const TOTAL_PAIRS = 20;        // number of base-pair rungs
const TURNS = 2;               // full helix turns across the width
const AMP = 16;                // vertical amplitude of each strand
const PROGRESS_DURATION = 2.0; // seconds to fill the helix

// Base-pair color pairs (A-T = blue/cyan, G-C = indigo/violet) for realism
const BP_COLORS: [string, string][] = [
  ["59,130,246", "34,211,238"], // A-T  blue  / cyan
  ["99,102,241", "168,85,247"], // G-C  indigo / purple
];

function DnaHelix() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const progressRef = useRef(0);
  const startRef = useRef(0);

  useAnimationFrame((timestamp, delta) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (startRef.current === 0) startRef.current = timestamp;
    timeRef.current += delta * 0.0018;          // helix rotation speed
    progressRef.current = Math.min((timestamp - startRef.current) / (PROGRESS_DURATION * 1000), 1);

    const t = timeRef.current;
    const progress = progressRef.current;
    const w = HELIX_W;
    const h = HELIX_H;
    const midY = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Helpers: strand Y positions at a given x
    const angle = (x: number) => (x / w) * Math.PI * 2 * TURNS + t;
    const strandA = (x: number) => midY + Math.sin(angle(x)) * AMP;
    const strandB = (x: number) => midY + Math.sin(angle(x) + Math.PI) * AMP; // 180-deg offset
    const depth   = (x: number) => Math.cos(angle(x)); // +1 = front, -1 = back

    // ── 1. Draw base-pair rungs (back half first, then front half for depth) ──
    const pairSpacing = w / (TOTAL_PAIRS + 1);
    const drawRungs = (isFront: boolean) => {
      for (let i = 1; i <= TOTAL_PAIRS; i++) {
        const x = i * pairSpacing;
        const d = depth(x);
        const front = d > 0;
        if (front !== isFront) continue;

        const yA = strandA(x);
        const yB = strandB(x);
        const midPairX = x;
        const midPairY = (yA + yB) / 2;

        // Progress: only pairs to the left of the progress line are "filled"
        const filled = x / w <= progress;
        const baseAlpha = 0.12 + Math.abs(d) * 0.35;
        const colorIdx = i % 2;
        const [cA, cB] = BP_COLORS[colorIdx];

        // Hydrogen bonds (dashed center)
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(x, yA);
        ctx.lineTo(x, yB);
        ctx.strokeStyle = filled
          ? `rgba(${cA},${baseAlpha + 0.25})`
          : `rgba(148,163,184,${baseAlpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        // Nucleotide on strand A
        const rA = 2.5 + Math.abs(d) * 1.5;
        ctx.beginPath();
        ctx.arc(x, yA, rA, 0, Math.PI * 2);
        ctx.fillStyle = filled ? `rgba(${cA},${baseAlpha + 0.35})` : `rgba(148,163,184,${baseAlpha * 0.4})`;
        ctx.fill();

        // Nucleotide on strand B
        const rB = 2.5 + Math.abs(d) * 1.5;
        ctx.beginPath();
        ctx.arc(x, yB, rB, 0, Math.PI * 2);
        ctx.fillStyle = filled ? `rgba(${cB},${baseAlpha + 0.35})` : `rgba(148,163,184,${baseAlpha * 0.4})`;
        ctx.fill();

        // Tiny label letters for filled pairs
        if (filled && Math.abs(d) > 0.5) {
          const label = colorIdx === 0 ? ["A", "T"] : ["G", "C"];
          ctx.font = "bold 6px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = `rgba(255,255,255,${Math.abs(d) * 0.9})`;
          ctx.fillText(label[0], x, yA);
          ctx.fillText(label[1], x, yB);
        }
      }
    };

    // ── 2. Draw back rungs ──
    drawRungs(false);

    // ── 3. Draw backbone strands ──
    // Each strand is drawn with variable thickness for 3D feel
    for (let strand = 0; strand < 2; strand++) {
      const yFn = strand === 0 ? strandA : strandB;
      const baseColor = strand === 0 ? "59,130,246" : "99,102,241";

      ctx.beginPath();
      for (let x = 0; x <= w; x += 1) {
        const y = yFn(x);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }

      // Progress-aware coloring: filled portion is bright, rest is gray
      const progressX = progress * w;
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, `rgba(${baseColor},0.8)`);
      if (progress < 1) {
        grad.addColorStop(Math.max(0.001, progress - 0.01), `rgba(${baseColor},0.8)`);
        grad.addColorStop(Math.min(0.999, progress + 0.01), `rgba(148,163,184,0.25)`);
        grad.addColorStop(1, `rgba(148,163,184,0.2)`);
      } else {
        grad.addColorStop(1, `rgba(${baseColor},0.8)`);
      }
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // ── 4. Draw front rungs (on top of backbones) ──
    drawRungs(true);

    // ── 5. Progress glow sweep ──
    if (progress < 1) {
      const gx = progress * w;
      const glow = ctx.createRadialGradient(gx, midY, 0, gx, midY, 30);
      glow.addColorStop(0, "rgba(59,130,246,0.25)");
      glow.addColorStop(1, "rgba(59,130,246,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(gx - 30, 0, 60, h);
    }
  });

  return (
    <canvas
      ref={canvasRef}
      width={HELIX_W}
      height={HELIX_H}
      className="mx-auto"
      style={{ width: HELIX_W / 2, height: HELIX_H / 2 }}
    />
  );
}

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
              <div className="w-20 h-20 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 p-3">
                <img src="/logo-white.svg" alt="MedSecure" className="w-full h-full drop-shadow-md" />
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

            {/* DNA Helix Progress */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              <DnaHelix />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
