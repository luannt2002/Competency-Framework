'use client';

/**
 * Confetti utility — fires a celebratory burst when a learner completes a node.
 *
 * Two intensities:
 *   - 'small' (default): a single 50-particle burst from the center. Used for
 *     leaf-node completions (lessons, labs).
 *   - 'big': 200 particles fired from both left/right edges, with a delayed
 *     second burst; uses the roadmap palette (coral / cyan / purple / pink)
 *     for milestone / phase / week completions.
 *
 * Lazy-imports canvas-confetti so we don't ship it in the initial bundle.
 */
import confetti from 'canvas-confetti';

export type ConfettiIntensity = 'small' | 'big';

const PALETTE = ['#ff6b6b', '#22d3ee', '#a78bfa', '#f472b6'];

export function fireConfetti(opts?: { intensity?: ConfettiIntensity }): void {
  const intensity = opts?.intensity ?? 'small';

  if (intensity === 'small') {
    confetti({
      particleCount: 50,
      spread: 60,
      startVelocity: 35,
      origin: { x: 0.5, y: 0.6 },
      disableForReducedMotion: true,
    });
    return;
  }

  // Big celebration: dual-side burst + delayed encore
  const fireSide = (originX: number, angle: number) =>
    confetti({
      particleCount: 100,
      spread: 70,
      startVelocity: 45,
      angle,
      origin: { x: originX, y: 0.65 },
      colors: PALETTE,
      disableForReducedMotion: true,
    });

  fireSide(0.1, 60);
  fireSide(0.9, 120);

  setTimeout(() => {
    confetti({
      particleCount: 80,
      spread: 100,
      startVelocity: 30,
      origin: { x: 0.5, y: 0.5 },
      colors: PALETTE,
      disableForReducedMotion: true,
    });
  }, 250);
}
