import type { MotionProps } from 'motion/react'

// The game's 2D animations, as props for Motion's `m` elements; reduced motion keeps the fades and drops the movement.

export type Move = Pick<MotionProps, 'initial' | 'animate' | 'exit' | 'transition'>

// Filters keep the same functions throughout, so Motion can blend between them.
const PLAIN = 'brightness(1) sepia(0) hue-rotate(0deg) saturate(1)'
const CAUGHT = 'brightness(1.4) sepia(1) hue-rotate(-30deg) saturate(3)'
const CHARRED = 'brightness(0.3) sepia(1) hue-rotate(-30deg) saturate(3)'
const GLOW = 'brightness(1) drop-shadow(0 0 0px rgb(255 180 84 / 0))'
const GLOWING = 'brightness(1.35) drop-shadow(0 0 10px rgb(255 180 84 / 0.8))'

/** Gone at once, for reduced motion where a card would otherwise fly off. */
const GONE: Move = { initial: { opacity: 0 }, animate: { opacity: 0 }, transition: { duration: 0 } }

/** A card the fire takes: it catches, tips over sideways and falls out of sight. */
export const burnFall = (still: boolean, delay = 0.2, duration = 0.8): Move =>
  still
    ? GONE
    : {
        initial: { rotate: 0, x: '0%', y: '0%', opacity: 1, filter: PLAIN },
        animate: {
          rotate: [0, -6, 80],
          x: ['0%', '0%', '40%'],
          y: ['0%', '0%', '60%'],
          opacity: [1, 1, 0],
          filter: [PLAIN, CAUGHT, CHARRED],
        },
        transition: { delay, duration, ease: 'easeIn', times: [0, 0.3, 1] },
      }

/** A sacrificed card: it falls as a burned one does, then folds its place away so what's left slides to the middle. */
export const sacrificed = (still: boolean): Move => {
  if (still)
    return {
      initial: { opacity: 0, width: 0, marginRight: '-1.5rem' },
      animate: { opacity: 0, width: 0, marginRight: '-1.5rem' },
      transition: { duration: 0 },
    }
  const fall = burnFall(false, 0.2, 0.7)
  return {
    ...fall,
    animate: { ...(fall.animate as object), width: 0, marginRight: '-1.5rem' },
    transition: {
      default: fall.transition,
      width: { delay: 0.9, duration: 0.3, ease: 'easeInOut' },
      marginRight: { delay: 0.9, duration: 0.3, ease: 'easeInOut' },
    },
  }
}

/** The fire rising as it takes the card. */
export const kindle: Move = {
  initial: { scale: 0.3, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { delay: 0.1, duration: 0.6, ease: 'easeOut' },
}

/** One of a merge request's two copies sliding in from its side, then shrinking away as they meet. */
export const mergeIn = (side: 'left' | 'right', still: boolean): Move => {
  if (still) return GONE
  const from = side === 'left' ? '-70%' : '70%'
  return {
    initial: { x: from, scale: 1, opacity: 1 },
    animate: { x: [from, '0%', '0%'], scale: [1, 1, 0.4], opacity: [1, 1, 0] },
    transition: { delay: 0.15, duration: 0.6, ease: 'easeInOut', times: [0, 0.6, 1] },
  }
}

/** The card the two copies made, growing in where they vanished. */
export const mergeOut: Move = {
  initial: { scale: 0.4, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { delay: 0.7, duration: 0.3, ease: 'easeOut' },
}

/** A card swelling and glowing for a moment, as when the campfire warms it. */
export const pop = (duration = 0.45): Move => ({
  initial: { scale: 1, filter: GLOW },
  animate: { scale: [1, 1.08, 1], filter: [GLOW, GLOWING, GLOW] },
  transition: { duration, ease: 'easeOut', times: [0, 0.4, 1] },
})
export const warmPop = pop()

/** Something appearing: a fade with a small rise. */
export const fadeIn = (duration = 0.2): Move => ({
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration, ease: 'easeOut' },
})

/** Something growing in from small, as a check mark does once an upload is done. */
export const growIn = (duration = 0.25, delay = 0): Move => ({
  initial: { scale: 0.4, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { delay, duration, ease: 'easeOut' },
})

/** A page of a step-by-step box sliding in as the last step is locked in. */
export const pageIn: Move = {
  initial: { x: '1.5rem', opacity: 0 },
  animate: { x: 0, opacity: 1 },
  transition: { duration: 0.18, ease: 'easeOut' },
}

/** An upload bar filling from the left. */
export const fill = (duration: number): Move => ({
  initial: { scaleX: 0 },
  animate: { scaleX: 1 },
  transition: { duration, ease: 'easeInOut' },
})

/** A face-down card turning over to show what it is; `delay` staggers a row of them. */
export const flipIn = (delay = 0): Move => ({
  initial: { rotateY: 90, transformPerspective: 600, filter: 'brightness(0.4)' },
  animate: { rotateY: 0, transformPerspective: 600, filter: 'brightness(1)' },
  transition: { delay, duration: 0.3, ease: 'easeOut' },
})

/** An uninstalled card shrinking out of its slot. */
export const shrinkAway: Move = {
  initial: { scale: 1, opacity: 1 },
  animate: { scale: 0.4, opacity: 0 },
  transition: { duration: 0.4, ease: 'easeIn' },
}

/** A slot turning over: its face turns edge on and goes, then its back turns up from edge on. */
export const turnAway = (delay: number): Move => ({
  initial: { rotateY: 0, transformPerspective: 600 },
  animate: { rotateY: 90, transformPerspective: 600, transitionEnd: { visibility: 'hidden' } },
  transition: { delay, duration: 0.225, ease: 'easeIn' },
})
export const turnUp = (delay: number): Move => ({
  initial: { rotateY: -90, transformPerspective: 600, visibility: 'hidden' },
  animate: { rotateY: 0, transformPerspective: 600, visibility: 'visible' },
  transition: {
    delay: delay + 0.225,
    duration: 0.225,
    ease: 'easeOut',
    visibility: { delay: delay + 0.225, duration: 0 },
  },
})

/** A refused move: the card or place shivers; with reduced motion it dims for a moment instead. */
export const shake = (still: boolean) =>
  still
    ? { keyframes: { opacity: [1, 0.6, 1] }, options: { duration: 0.45, times: [0, 0.5, 1] } }
    : {
        keyframes: { x: [0, -6, 5, -3, 2, 0], rotate: [0, -2, 2, 0, 0, 0] },
        options: { duration: 0.45, times: [0, 0.2, 0.4, 0.6, 0.8, 1] },
      }

/** A card striking: it lunges toward the other side and back; with reduced motion it dims for a moment instead. */
export const strike = (row: 'board' | 'front' | 'back', duration: number, still: boolean): Move =>
  still
    ? { initial: { opacity: 1 }, animate: { opacity: [1, 0.6, 1] }, transition: { duration, ease: 'easeInOut' } }
    : {
        initial: { y: '0%' },
        animate: { y: ['0%', row === 'board' ? '-38%' : '38%', '0%'] },
        transition: { duration, ease: 'easeInOut' },
      }

/** A card arriving in a lane or the hand: up from below for the player's, down from above for P03's. */
export const arrive = (row: 'board' | 'front' | 'back' | 'hand'): Move => {
  const ours = row === 'board' || row === 'hand'
  return {
    initial: { opacity: 0, y: ours ? '40%' : '-60%', scale: ours ? 0.9 : 1 },
    animate: { opacity: 1, y: '0%', scale: 1 },
    transition: { duration: 0.28, ease: 'easeOut' },
  }
}

/** A card leaving the board: a sacrifice is offered up and shrinks away, a dead card folds and drops; reduced, both fade. */
export const leave = (how: 'sacrificed' | 'died', row: 'board' | 'front' | 'back', still: boolean): Move => {
  const transition = { duration: 0.55, ease: 'easeIn' } as const
  if (still) return { initial: { opacity: 1 }, animate: { opacity: 0 }, transition }
  if (how === 'sacrificed')
    return {
      initial: { y: '0%', rotate: 0, scale: 1, opacity: 1 },
      animate: { y: '-40%', rotate: 25, scale: 0.3, opacity: 0 },
      transition,
    }
  const away = row === 'board' ? '60%' : '-60%'
  return {
    initial: { scaleY: 1, y: '0%', opacity: 1 },
    animate: { scaleY: [1, 0.68, 0.68], y: ['0%', '0%', away], opacity: [1, 1, 0] },
    transition: { ...transition, times: [0, 0.45, 1] },
  }
}

/** A number rising off a card and fading; with reduced motion it fades where it appeared. */
export const rise = (still: boolean): Move => ({
  initial: { x: '-50%', y: '-50%', opacity: 1 },
  animate: { x: '-50%', y: still ? '-50%' : '-160%', opacity: 0 },
  transition: { duration: 1, ease: 'easeOut' },
})

/** A change to the scale's weight, drifting up as it fades. */
export const drift: Move = {
  initial: { y: 0, opacity: 1 },
  animate: { y: '-0.75rem', opacity: 0 },
  transition: { duration: 1.2, ease: 'easeOut' },
}

/** A menu dropping open. */
export const dropIn: Move = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.15, ease: 'easeOut' },
}
