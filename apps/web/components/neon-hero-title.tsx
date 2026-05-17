"use client";

import { useEffect, useRef, useCallback } from "react";

const LETTERS = ["N", "E", "O", "N"] as const;

/* ── Organic glow ─────────────────────────────────────────────
 *  Layer several sine waves whose periods are mutually irrational
 *  (or close to it). The combined signal never truly repeats,
 *  creating a slow, breathing, unpredictable glow.
 * ──────────────────────────────────────────────────────────── */
const WAVES = [
  { freq: 0.17, amp: 0.35 }, // ~37 s period  – dominant slow drift
  { freq: 0.29, amp: 0.25 }, // ~21.7 s        – medium sway
  { freq: 0.07, amp: 0.2 }, // ~89.8 s        – very slow undertow
  { freq: 0.53, amp: 0.12 }, // ~11.9 s        – gentle ripple
  { freq: 0.037, amp: 0.08 }, // ~170 s         – glacial drift
];

function glowAtTime(t: number): number {
  let sum = 0;

  for (const { freq, amp } of WAVES) {
    sum += amp * Math.sin(2 * Math.PI * freq * t);
  }

  // Normalise into a 0 → 1 range then map to a pleasant opacity band
  // sum range is roughly –1 … +1 (amplitudes add to 1.0)
  return 0.78 + 0.22 * sum; // output ~0.56 … 1.0
}

function buildGlowFilter(intensity: number): string {
  const a = intensity;

  return [
    `drop-shadow(0 0 ${8 * a}px rgb(var(--neon) / ${(0.8 * a).toFixed(2)}))`,
    `drop-shadow(0 0 ${30 * a}px rgb(var(--neon) / ${(0.5 * a).toFixed(2)}))`,
    `drop-shadow(0 0 ${60 * a}px rgb(var(--neon) / ${(0.25 * a).toFixed(2)}))`,
  ].join(" ");
}

/**
 * Hero title where individual letters sporadically flicker or briefly
 * go dark — like a real neon sign with aging gas tubes.
 */
export function NeonHeroTitle() {
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const lettersRef = useRef<(HTMLSpanElement | null)[]>([]);

  /* ── Sporadic per-letter flicker ──────────────── */

  const flicker = useCallback(() => {
    const idx = Math.floor(Math.random() * LETTERS.length);
    const el = lettersRef.current[idx];

    if (!el || el.classList.contains("neon-letter-out")) return;

    const goDark = Math.random() < 0.3;
    const cls = goDark ? "neon-letter-out" : "neon-letter-flicker";

    el.classList.add(cls);
    const duration = goDark
      ? 800 + Math.random() * 600
      : 150 + Math.random() * 200;

    setTimeout(() => el.classList.remove(cls), duration);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const delay = 2000 + Math.random() * 4000;

      timer = setTimeout(() => {
        flicker();
        schedule();
      }, delay);
    };

    schedule();

    return () => clearTimeout(timer);
  }, [flicker]);

  /* ── Organic overall glow (rAF driven) ────────── */

  useEffect(() => {
    let frameId: number;
    const start = performance.now();

    const tick = () => {
      const t = (performance.now() - start) / 1000;
      const g = glowAtTime(t);
      const el = h1Ref.current;

      if (el) {
        el.style.opacity = g.toFixed(3);
        el.style.filter = buildGlowFilter(g);
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <h1
      ref={h1Ref}
      aria-label="NEON"
      className="text-7xl md:text-8xl lg:text-[10rem] font-display font-black tracking-display leading-none text-transparent"
      style={{
        WebkitTextStroke: "1.5px rgb(var(--neon))",
        textIndent: "0.25em",
        willChange: "opacity, filter",
      }}
    >
      {LETTERS.map((letter, i) => (
        <span
          key={i}
          ref={(el) => {
            lettersRef.current[i] = el;
          }}
          className="neon-letter"
        >
          {letter}
        </span>
      ))}
    </h1>
  );
}
