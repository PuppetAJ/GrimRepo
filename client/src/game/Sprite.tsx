import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion.ts'
import { iconArt, SPRITE_FPS, type IconId } from './art.ts'

/**
 * An animated icon: its art is a strip of square frames side by side, played in a loop. A single frame still flickers
 * between poses, so a fire drawn once isn't frozen; with reduced motion it holds the first frame.
 */
export function Sprite({ id, size, color }: { id: IconId; size: number; color: string }) {
  const url = iconArt(id)
  const [frames, setFrames] = useState(1)
  useEffect(() => {
    const image = new Image()
    image.src = url
    let live = true
    void image
      .decode()
      .then(() => live && setFrames(Math.max(1, Math.round(image.naturalWidth / image.naturalHeight))))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [url])
  const still = prefersReducedMotion()
  return (
    <span
      aria-hidden
      className={`pixel-art inline-block origin-bottom ${frames < 2 && !still ? 'animate-[flame_0.45s_step-end_infinite]' : ''}`}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        maskImage: `url(${url})`,
        maskSize: `${frames * 100}% 100%`,
        maskRepeat: 'no-repeat',
        animation:
          frames > 1 && !still
            ? `sprite-strip ${frames / SPRITE_FPS}s steps(${frames}, jump-none) infinite`
            : undefined,
      }}
    />
  )
}
