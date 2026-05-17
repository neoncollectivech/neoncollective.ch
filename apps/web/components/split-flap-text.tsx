"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:/°-–,";
const TICK_MS = 40;
const CYCLES_PER_CHAR = 8;
const STAGGER_MS = 30;

function randomChar(): string {
  return CHARS[Math.floor(Math.random() * CHARS.length)]!;
}

interface SplitFlapTextProps {
  /** The final text to resolve to. */
  text: string;
  /** Extra delay (ms) before this instance starts — use for card-level staggering. */
  delay?: number;
  className?: string;
}

/**
 * Animates text character-by-character like a Solari split-flap display.
 *
 * Each character starts as a random glyph, cycles through several random
 * characters, and settles left-to-right with a stagger. Spaces resolve
 * instantly. Triggered by IntersectionObserver on scroll-into-view.
 *
 * Designed for monospace contexts — all characters are the same width,
 * so the text length stays constant throughout the animation.
 */
export function SplitFlapText({
  text,
  delay = 0,
  className,
}: SplitFlapTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const hasTriggered = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Initialize as non-breaking spaces to hold layout while staying invisible.
  // Content only appears when the IntersectionObserver triggers the animation.
  const [display, setDisplay] = useState(() =>
    Array.from(text, (ch) => (ch === " " ? " " : "\u00A0")).join(""),
  );

  const animate = useCallback(() => {
    const chars = Array.from(text);
    const total = chars.length;

    const slotTimelines = chars.map((ch, i) => {
      if (ch === " ") return { start: 0, end: 0, isSpace: true, final: " " };
      const start = i * STAGGER_MS;
      const end = start + CYCLES_PER_CHAR * TICK_MS;

      return { start, end, isSpace: false, final: ch };
    });

    const totalDuration =
      Math.max(...slotTimelines.map((s) => s.end)) + TICK_MS;
    let elapsed = 0;
    let frameId: ReturnType<typeof setTimeout>;

    const tick = () => {
      const next: string[] = [];

      for (let i = 0; i < total; i++) {
        const slot = slotTimelines[i]!;

        if (slot.isSpace) {
          next.push(" ");
        } else if (elapsed >= slot.end) {
          next.push(slot.final);
        } else if (elapsed >= slot.start) {
          next.push(randomChar());
        } else {
          next.push("\u00A0");
        }
      }

      setDisplay(next.join(""));
      elapsed += TICK_MS;

      if (elapsed > totalDuration) {
        setDisplay(text);
      } else {
        frameId = setTimeout(tick, TICK_MS);
      }
    };

    frameId = setTimeout(tick, delay);
    cleanupRef.current = () => clearTimeout(frameId);
  }, [text, delay]);

  // Trigger on scroll-into-view.
  useEffect(() => {
    const el = containerRef.current;

    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !hasTriggered.current) {
          hasTriggered.current = true;
          animate();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      cleanupRef.current?.();
    };
  }, [animate]);

  return (
    <span ref={containerRef} className={className}>
      {display}
    </span>
  );
}
