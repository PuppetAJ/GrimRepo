import { useState } from 'react'
import { findNode, reachable, type MapNode } from 'shared'
import { NODE_ICONS, nodeName } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'

type Mark = 'here' | 'visited' | 'next' | 'lit' | 'ahead' | 'behind'

const STYLE: Record<Mark, string> = {
  here: 'border-p03 bg-[#13261a] text-p03',
  visited: 'border-p03-dim bg-[#0d1a10] text-p03-dim',
  next: 'border-p03 text-p03 hover:bg-[#13261a] focus-visible:bg-[#13261a]',
  lit: 'border-p03 border-dashed text-p03',
  // Names keep full contrast; only the icons fade.
  ahead: 'border-p03-edge border-dashed text-p03-dim',
  behind: 'border-transparent text-p03-dim [&>svg]:opacity-40',
}

const WORDS: Partial<Record<Mark, string>> = { here: 'you are here', visited: 'visited', behind: 'passed by' }

function Node({
  node,
  mark,
  onPeek,
  onGo,
}: {
  node: MapNode
  mark: Mark
  onPeek: (id: string | null) => void
  onGo: () => void
}) {
  const Icon = NODE_ICONS[node.kind]
  const name = nodeName(node)
  const face = (
    <>
      <Icon aria-hidden className={node.kind === 'boss' ? 'size-10' : 'size-7'} />
      <span className="text-center text-lg leading-none">{name}</span>
    </>
  )
  const box = `flex w-[min(6rem,25vw)] flex-col items-center gap-1 rounded-md border-2 px-1 py-2 sm:w-28 ${STYLE[mark]}`
  if (mark === 'next')
    return (
      <button
        type="button"
        data-action="go"
        data-node={node.id}
        onClick={onGo}
        onPointerEnter={() => onPeek(node.id)}
        onPointerLeave={() => onPeek(null)}
        onFocus={() => onPeek(node.id)}
        onBlur={() => onPeek(null)}
        className={`${box} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03`}
      >
        {face}
      </button>
    )
  const words = WORDS[mark]
  return (
    <span className={box}>
      {face}
      {words ? <span className="sr-only">, {words}</span> : null}
    </span>
  )
}

/** The stage's map, start at the bottom and boss at the top; only the nodes in reach are buttons. */
export function RunMap({ run }: { run: RunReady }) {
  const { state, path } = run
  const [peek, setPeek] = useState<string | null>(null)
  const open = reachable(state)
  const row = state.at === null ? -1 : (findNode(state.map, state.at)?.row ?? -1)
  const lit = new Set(peek ? (findNode(state.map, peek)?.next ?? []) : [])
  const markOf = (node: MapNode): Mark =>
    node.id === state.at
      ? 'here'
      : path.includes(node.id)
        ? 'visited'
        : open.includes(node.id)
          ? 'next'
          : lit.has(node.id)
            ? 'lit'
            : node.row <= row
              ? 'behind'
              : 'ahead'
  const choices = open.map((id) => findNode(state.map, id)).filter((node): node is MapNode => Boolean(node))
  const last = state.map.rows.length - 1

  return (
    <div className="flex flex-col gap-4">
      {/* In reading order from the start; shown with the boss at the top, as the run climbs toward it. */}
      <ol aria-label="The map, from the start to the boss" className="flex flex-col-reverse gap-3">
        {state.map.rows.map((nodes, index) => (
          <li key={index} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-right text-lg text-p03-dim sm:w-8" aria-hidden>
              {index + 1}
            </span>
            <span className="sr-only">{index === last ? 'The boss: ' : `Step ${index + 1}: `}</span>
            <ul className="flex flex-1 justify-around gap-1 sm:gap-2">
              {nodes.map((node) => (
                <li key={node.id}>
                  <Node
                    node={node}
                    mark={markOf(node)}
                    onPeek={setPeek}
                    onGo={() => run.act({ type: 'go', node: node.id })}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <p className="text-p03">
        {choices.length ? `From here: ${choices.map(nodeName).join(' or ')}.` : 'Nowhere to go from here.'}
      </p>
    </div>
  )
}
