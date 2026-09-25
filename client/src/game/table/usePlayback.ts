import { useCallback, useEffect, useRef, useState } from 'react'
import type { GameEvent, GameState } from 'shared'
import { advance, holdsTheTable, LEAVE_MS, pace, POPUP_MS, settle, start, tidy, type Playback } from './playback.ts'

type Source = {
  state: GameState
  subscribe: (listener: (events: GameEvent[]) => void) => () => void
}

// Past this many waiting events the table plays faster, so it never falls far behind the game.
const BACKLOG = 12

/** Plays each move's events back one at a time; `busy` holds the table while P03 takes its turn. */
export function usePlayback({ state, subscribe }: Source) {
  const [playback, setPlayback] = useState(() => start(state))
  const [busy, setBusy] = useState(false)
  const queue = useRef<GameEvent[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(state)
  useEffect(() => {
    latest.current = state
  })

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    queue.current = []
    setBusy(false)
  }, [])

  const tick = useCallback(function tick() {
    const event = queue.current.shift()
    const now = performance.now()
    if (!event) {
      timer.current = null
      setBusy(false)
      setPlayback((current) => settle(current, latest.current, now))
      // Nothing more is coming, so clear away what is still leaving once it has gone.
      setTimeout(() => setPlayback((current) => tidy(current, performance.now())), Math.max(LEAVE_MS, POPUP_MS) + 50)
      return
    }
    setPlayback((current) => advance(current, event, now))
    const speed = queue.current.length > BACKLOG ? 3 : 1
    timer.current = setTimeout(tick, pace(event) / speed)
  }, [])

  useEffect(
    () =>
      subscribe((events) => {
        queue.current.push(...events)
        if (holdsTheTable(events)) setBusy(true)
        if (!timer.current) timer.current = setTimeout(tick, 0)
      }),
    [subscribe, tick],
  )

  useEffect(() => stop, [stop])

  /** Jumps to the end of whatever is playing. */
  const skip = useCallback(() => {
    stop()
    setPlayback((current) => settle(current, latest.current, performance.now()))
  }, [stop])

  return { playback, busy, skip } as { playback: Playback; busy: boolean; skip: () => void }
}
