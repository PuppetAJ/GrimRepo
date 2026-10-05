import { useCallback, useState } from 'react'

/** A pen stroke as x, y pairs in fractions of the map, so it stays put when the map is resized. */
export type Stroke = number[]
export type Plan = { strokes: Stroke[]; marks: string[] }

const EMPTY: Plan = { strokes: [], marks: [] }
const keyFor = (seed: number, stage: number) => `grimrepo:plan:${seed}:${stage}`

function load(key: string): Plan {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<Plan> | null
    if (!saved || !Array.isArray(saved.strokes) || !Array.isArray(saved.marks)) return EMPTY
    return {
      strokes: saved.strokes.filter((stroke) => Array.isArray(stroke) && stroke.every(Number.isFinite)),
      marks: saved.marks.filter((mark) => typeof mark === 'string'),
    }
  } catch {
    return EMPTY
  }
}

/** A route planned on one stage's map, kept in this browser only; each run and stage has its own. */
export function usePlan(seed: number, stage: number) {
  const key = keyFor(seed, stage)
  const [state, setState] = useState(() => ({ key, plan: load(key) }))
  // A new stage starts a new plan.
  const plan = state.key === key ? state.plan : load(key)
  const save = useCallback(
    (next: Plan) => {
      setState({ key, plan: next })
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // Storage can be refused in a private window; the plan then lasts until the page closes.
      }
    },
    [key],
  )
  return {
    plan,
    addStroke: (stroke: Stroke) => save({ ...plan, strokes: [...plan.strokes, stroke] }),
    undo: () => save({ ...plan, strokes: plan.strokes.slice(0, -1) }),
    toggleMark: (id: string) =>
      save({
        ...plan,
        marks: plan.marks.includes(id) ? plan.marks.filter((mark) => mark !== id) : [...plan.marks, id],
      }),
    clear: () => save(EMPTY),
  }
}
