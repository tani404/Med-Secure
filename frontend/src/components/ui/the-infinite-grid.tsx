import React, { useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  useAnimationFrame,
  useSpring,
  useTransform,
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
  const mouseX = useSpring(rawMouseX, { stiffness: 150, damping: 25 });
  const mouseY = useSpring(rawMouseY, { stiffness: 150, damping: 25 });

  // Track if mouse is over the grid
  const isHovering = useMotionValue(0);
  const hoverOpacity = useSpring(isHovering, { stiffness: 200, damping: 30 });

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const { left, top } = e.currentTarget.getBoundingClientRect();
      rawMouseX.set(e.clientX - left);
      rawMouseY.set(e.clientY - top);
    },
    [rawMouseX, rawMouseY]
  );

  const handleMouseEnter = useCallback(() => isHovering.set(1), [isHovering]);
  const handleMouseLeave = useCallback(() => isHovering.set(0), [isHovering]);

  const gridOffsetX = useMotionValue(0);
  const gridOffsetY = useMotionValue(0);

  useAnimationFrame(() => {
    gridOffsetX.set((gridOffsetX.get() + speedX) % 40);
    gridOffsetY.set((gridOffsetY.get() + speedY) % 40);
  });

  // Primary spotlight — bright white reveal
  const maskImage = useMotionTemplate`radial-gradient(${spotlightRadius}px circle at ${mouseX}px ${mouseY}px, black 0%, transparent 100%)`;

  // Larger soft blue glow behind cursor
  const glowBg = useMotionTemplate`radial-gradient(700px circle at ${mouseX}px ${mouseY}px, rgba(0, 74, 198, 0.08) 0%, transparent 60%)`;

  // Inner hot glow — tighter, brighter
  const innerGlow = useMotionTemplate`radial-gradient(250px circle at ${mouseX}px ${mouseY}px, rgba(0, 74, 198, 0.15) 0%, transparent 70%)`;

  // Darkening vignette that follows the cursor (inverted — darkens edges)
  const darkMask = useMotionTemplate`radial-gradient(500px circle at ${mouseX}px ${mouseY}px, transparent 30%, rgba(0, 0, 0, 0.04) 100%)`;

  // Grid line color shift near cursor
  const activeGridOpacity = useTransform(hoverOpacity, [0, 1], [0.25, 0.55]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn("relative overflow-hidden", className)}
    >
      {/* Base grid — subtle always-on with slight pulse */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{ opacity: useTransform(hoverOpacity, [0, 1], [0.15, 0.10]) }}
      >
        <GridPattern id="grid-base" offsetX={gridOffsetX} offsetY={gridOffsetY} color="text-slate-300" />
      </motion.div>

      {/* Mouse-reveal grid — crisp bright lines follow cursor */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{
          maskImage,
          WebkitMaskImage: maskImage,
          opacity: activeGridOpacity,
        }}
      >
        <GridPattern id="grid-active" offsetX={gridOffsetX} offsetY={gridOffsetY} color="text-blue-400" />
      </motion.div>

      {/* Secondary reveal — slightly larger, dimmer grid for depth */}
      <motion.div
        className="absolute inset-0 z-0 opacity-[0.12]"
        style={{
          maskImage: useMotionTemplate`radial-gradient(${spotlightRadius * 1.8}px circle at ${mouseX}px ${mouseY}px, black 0%, transparent 100%)`,
          WebkitMaskImage: useMotionTemplate`radial-gradient(${spotlightRadius * 1.8}px circle at ${mouseX}px ${mouseY}px, black 0%, transparent 100%)`,
        }}
      >
        <GridPattern id="grid-outer" offsetX={gridOffsetX} offsetY={gridOffsetY} color="text-blue-300" />
      </motion.div>

      {/* Cursor inner hot glow */}
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ background: innerGlow, opacity: hoverOpacity }}
      />

      {/* Cursor outer soft glow blob */}
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ background: glowBg }}
      />

      {/* Dark vignette around cursor — makes the bright area pop */}
      <motion.div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ background: darkMask, opacity: hoverOpacity }}
      />

      {/* Dot grid under cursor for sparkle effect */}
      <motion.div
        className="absolute inset-0 z-0"
        style={{
          maskImage: useMotionTemplate`radial-gradient(200px circle at ${mouseX}px ${mouseY}px, black 0%, transparent 100%)`,
          WebkitMaskImage: useMotionTemplate`radial-gradient(200px circle at ${mouseX}px ${mouseY}px, black 0%, transparent 100%)`,
          opacity: useTransform(hoverOpacity, [0, 1], [0, 0.4]),
        }}
      >
        <DotPattern id="dots-active" offsetX={gridOffsetX} offsetY={gridOffsetY} />
      </motion.div>

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

const GridPattern = ({
  id,
  offsetX,
  offsetY,
  color = "text-slate-400",
}: {
  id: string;
  offsetX: ReturnType<typeof useMotionValue<number>>;
  offsetY: ReturnType<typeof useMotionValue<number>>;
  color?: string;
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
        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" className={color} />
      </motion.pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);

const DotPattern = ({
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
        <circle cx="20" cy="20" r="1" fill="currentColor" className="text-blue-500" />
      </motion.pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
);
