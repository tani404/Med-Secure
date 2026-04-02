import React, { useRef } from "react";
import { cn } from "@/lib/utils";
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useAnimationFrame,
  useSpring,
} from "framer-motion";

export interface InfiniteGridProps {
  className?: string;
  children?: React.ReactNode;
  speedX?: number;
  speedY?: number;
  spotlightRadius?: number;
}

export const InfiniteGrid = ({
  className,
  children,
  speedX = 0.5,
  speedY = 0.5,
  spotlightRadius = 400,
}: InfiniteGridProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const rawMouseX = useMotionValue(0);
  const rawMouseY = useMotionValue(0);
  const mouseX = useSpring(rawMouseX, { stiffness: 200, damping: 30 });
  const mouseY = useSpring(rawMouseY, { stiffness: 200, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { left, top } = e.currentTarget.getBoundingClientRect();
    rawMouseX.set(e.clientX - left);
    rawMouseY.set(e.clientY - top);
  };

  const gridOffsetX = useMotionValue(0);
  const gridOffsetY = useMotionValue(0);

  useAnimationFrame(() => {
    gridOffsetX.set((gridOffsetX.get() + speedX) % 40);
    gridOffsetY.set((gridOffsetY.get() + speedY) % 40);
  });

  const maskImage = useMotionTemplate`radial-gradient(${spotlightRadius}px circle at ${mouseX}px ${mouseY}px, black 0%, transparent 100%)`;
  const glowBg = useMotionTemplate`radial-gradient(600px circle at ${mouseX}px ${mouseY}px, rgba(0, 74, 198, 0.07) 0%, transparent 70%)`;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={cn("relative overflow-hidden", className)}
    >
      {/* Base grid — subtle always-on */}
      <div className="absolute inset-0 z-0 opacity-[0.06]">
        <GridPattern id="grid-base" offsetX={gridOffsetX} offsetY={gridOffsetY} />
      </div>

      {/* Mouse-reveal grid — follows cursor */}
      <motion.div
        className="absolute inset-0 z-0 opacity-40"
        style={{ maskImage, WebkitMaskImage: maskImage }}
      >
        <GridPattern id="grid-active" offsetX={gridOffsetX} offsetY={gridOffsetY} />
      </motion.div>

      {/* Cursor glow blob */}
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ background: glowBg }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

const GridPattern = ({
  id,
  offsetX,
  offsetY,
}: {
  id: string;
  offsetX: ReturnType<typeof useMotionValue<number>>;
  offsetY: ReturnType<typeof useMotionValue<number>>;
}) => (
  <svg className="w-full h-full">
    <defs>
      <motion.pattern
        id={id}
        width="40"
        height="40"
        patternUnits="userSpaceOnUse"
        x={offsetX}
        y={offsetY}
      >
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary/50" />
      </motion.pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);
