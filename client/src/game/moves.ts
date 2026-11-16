import type { MotionProps } from 'motion/react'

export type Move = Pick<MotionProps, 'initial' | 'animate' | 'exit' | 'transition'>

// Filters keep the same functions throughout, so Motion can blend between them.
const PLAIN = 'brightness(1) sepia(0) hue-rotate(0deg) saturate(1)'
const CAUGHT = 'brightness(1.4) sepia(1) hue-rotate(-30deg) saturate(3)'
const CHARRED = 'brightness(0.3) sepia(1) hue-rotate(-30deg) saturate(3)'
const GLOW = 'brightness(1) drop-shadow(0 0 0px rgb(255 180 84 / 0))'
const GLOWING = 'brightness(1.35) drop-shadow(0 0 10px rgb(255 180 84 / 0.8))'

const GONE: Move = { initial: { opacity: 0 }, animate: { opacity: 0 }, transition: { duration: 0 } }

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

export const kindle: Move = {
  initial: { scale: 0.3, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { delay: 0.1, duration: 0.6, ease: 'easeOut' },
}

export const mergeIn = (side: 'left' | 'right', still: boolean): Move => {
  if (still) return GONE
  const from = side === 'left' ? '-70%' : '70%'
  return {
    initial: { x: from, scale: 1, opacity: 1 },
    animate: { x: [from, '0%', '0%'], scale: [1, 1, 0.4], opacity: [1, 1, 0] },
    transition: { delay: 0.15, duration: 0.6, ease: 'easeInOut', times: [0, 0.6, 1] },
  }
}

export const mergeOut: Move = {
  initial: { scale: 0.4, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { delay: 0.7, duration: 0.3, ease: 'easeOut' },
}

export const pop = (duration = 0.45): Move => ({
  initial: { scale: 1, filter: GLOW },
  animate: { scale: [1, 1.08, 1], filter: [GLOW, GLOWING, GLOW] },
  transition: { duration, ease: 'easeOut', times: [0, 0.4, 1] },
})
export const warmPop = pop()

export const fadeIn = (duration = 0.2): Move => ({
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration, ease: 'easeOut' },
})

export const growIn = (duration = 0.25, delay = 0): Move => ({
  initial: { scale: 0.4, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { delay, duration, ease: 'easeOut' },
})

export const pageIn: Move = {
  initial: { x: '1.5rem', opacity: 0 },
  animate: { x: 0, opacity: 1 },
  transition: { duration: 0.18, ease: 'easeOut' },
}

export const fill = (duration: number): Move => ({
  initial: { scaleX: 0 },
  animate: { scaleX: 1 },
  transition: { duration, ease: 'easeInOut' },
})

export const flipIn = (delay = 0): Move => ({
  initial: { rotateY: 90, transformPerspective: 600, filter: 'brightness(0.4)' },
  animate: { rotateY: 0, transformPerspective: 600, filter: 'brightness(1)' },
  transition: { delay, duration: 0.3, ease: 'easeOut' },
})

export const tearTop = (still: boolean): Move =>
  still
    ? { initial: { opacity: 1 }, animate: { opacity: 0 }, transition: { duration: 0.2 } }
    : {
        initial: { x: 0, y: 0, rotate: 0, opacity: 1 },
        animate: { x: [0, -2, 24], y: [0, 3, -70], rotate: [0, -3, 18], opacity: [1, 1, 0] },
        transition: { duration: 0.55, ease: 'easeOut', times: [0, 0.3, 1] },
      }

export const tearBody = (still: boolean): Move =>
  still
    ? { initial: { opacity: 1 }, animate: { opacity: 0 }, transition: { duration: 0.2, delay: 0.1 } }
    : {
        initial: { x: 0, y: 0, opacity: 1 },
        animate: { x: [0, 2, -2, 0, 0], y: [0, 0, 0, 0, 60], opacity: [1, 1, 1, 1, 0] },
        transition: { duration: 0.8, ease: 'easeIn', times: [0, 0.1, 0.2, 0.4, 1] },
      }

export const shrinkAway: Move = {
  initial: { scale: 1, opacity: 1 },
  animate: { scale: 0.4, opacity: 0 },
  transition: { duration: 0.4, ease: 'easeIn' },
}

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

export const shake = (still: boolean) =>
  still
    ? { keyframes: { opacity: [1, 0.6, 1] }, options: { duration: 0.45, times: [0, 0.5, 1] } }
    : {
        keyframes: { x: [0, -6, 5, -3, 2, 0], rotate: [0, -2, 2, 0, 0, 0] },
        options: { duration: 0.45, times: [0, 0.2, 0.4, 0.6, 0.8, 1] },
      }

export const strike = (row: 'board' | 'front' | 'back', duration: number, still: boolean, across = 0): Move =>
  still
    ? { initial: { opacity: 1 }, animate: { opacity: [1, 0.6, 1] }, transition: { duration, ease: 'easeInOut' } }
    : {
        initial: { y: '0%', x: '0%' },
        animate: { y: ['0%', row === 'board' ? '-38%' : '38%', '0%'], x: ['0%', `${across * 52}%`, '0%'] },
        transition: { duration, ease: 'easeInOut' },
      }

export const arrive = (row: 'board' | 'front' | 'back' | 'hand'): Move => {
  const ours = row === 'board' || row === 'hand'
  return {
    initial: { opacity: 0, y: ours ? '40%' : '-60%', scale: ours ? 0.9 : 1 },
    animate: { opacity: 1, y: '0%', scale: 1 },
    transition: { duration: 0.28, ease: 'easeOut' },
  }
}

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

export const rise = (still: boolean): Move => ({
  initial: { x: '-50%', y: '-50%', opacity: 1 },
  animate: { x: '-50%', y: still ? '-50%' : '-160%', opacity: 0 },
  transition: { duration: 1, ease: 'easeOut' },
})

export const drift: Move = {
  initial: { y: 0, opacity: 1 },
  animate: { y: '-0.75rem', opacity: 0 },
  transition: { duration: 1.2, ease: 'easeOut' },
}

export const dropIn: Move = {
  initial: { opacity: 0, y: -8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.15, ease: 'easeOut' },
}
