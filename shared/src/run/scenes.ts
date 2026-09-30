import type { SigilId } from '../cards.ts'

/** Effects that need a card pick one at random, so an event is a single choice. */
export type Effect =
  | { type: 'addCard'; card: string }
  | { type: 'removeCard' }
  | { type: 'boost'; attack: number; health: number }
  | { type: 'addSigil'; sigil: SigilId }

/** An event node's text and its choices. */
export type Scene = { id: string; title: string; text: string; options: { label: string; effects: Effect[] }[] }

const list: Scene[] = [
  {
    id: 'rubber-duck',
    title: 'A rubber duck',
    text: 'A rubber duck sits on the conveyor, waiting for you to explain your deck to it.',
    options: [
      { label: 'Explain it line by line', effects: [{ type: 'addSigil', sigil: 'hotfix' }] },
      { label: 'Ask it for a code review', effects: [{ type: 'boost', attack: 0, health: 2 }] },
    ],
  },
  {
    id: 'force-push',
    title: 'Force push?',
    text: 'Main is protected, but the override is right there.',
    options: [
      {
        label: 'Force push',
        effects: [{ type: 'removeCard' }, { type: 'boost', attack: 2, health: 0 }],
      },
      { label: 'Open a pull request', effects: [] },
    ],
  },
  {
    id: 'stack-overflow',
    title: 'Stack Overflow is down',
    text: 'The answer you need is on a page that will not load.',
    options: [
      { label: 'Write it yourself', effects: [{ type: 'addCard', card: 'HelloWorld' }] },
      { label: 'Copy it from an old project', effects: [{ type: 'addCard', card: 'CopyPaste' }] },
    ],
  },
  {
    id: 'cors',
    title: 'A CORS error',
    text: 'A request is blocked. P03 offers a header that lets anything through.',
    options: [
      { label: 'Allow every origin', effects: [{ type: 'addSigil', sigil: 'bypass' }] },
      { label: 'Configure it properly', effects: [{ type: 'addSigil', sigil: 'rate_limiter' }] },
    ],
  },
]

export const SCENES: Record<string, Scene> = Object.fromEntries(list.map((scene) => [scene.id, scene]))

export function scene(id: string): Scene {
  const found = SCENES[id]
  if (!found) throw new Error(`No such event: ${id}`)
  return found
}
