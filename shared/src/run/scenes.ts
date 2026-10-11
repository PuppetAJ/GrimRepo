import type { SigilId } from '../cards.ts'
import type { Trial } from './types.ts'

/** Effects that need a card pick one at random, so an event is a single choice. */
export type Effect =
  | { type: 'addCard'; card: string }
  | { type: 'removeCard' }
  | { type: 'boost'; attack: number; health: number }
  | { type: 'addSigil'; sigil: SigilId }
  | { type: 'duplicate' }
  /** Opens the linter, where the player deletes one sigil from one card. */
  | { type: 'lint' }
  /** Opens the merge request, where two copies of a card become one. */
  | { type: 'fuse' }
  /** Draws three cards from the deck; a rare if their total meets the trial's bar. */
  | { type: 'trial'; trial: Trial }
  /** A random item, if there's a slot free. */
  | { type: 'item' }
  /** Repairs the run's integrity, or wears it down, but never to 0: an event doesn't end a run. */
  | { type: 'integrity'; amount: number }

/** An event node's text and its choices; `code` is a snippet shown under the text, and `says` P03's word on a choice. */
export type Scene = {
  id: string
  title: string
  text: string
  code?: string[]
  options: { label: string; effects: Effect[]; says?: string }[]
}

/** A bug hunt's choices: the broken line repairs integrity, any other costs some, and blaming the intern does nothing. */
const hunt = (lines: number, broken: number, fixed: string): Scene['options'] => [
  ...Array.from({ length: lines }, (_, index) =>
    index + 1 === broken
      ? { label: `Line ${index + 1}`, effects: [{ type: 'integrity', amount: 3 } as const], says: fixed }
      : {
          label: `Line ${index + 1}`,
          effects: [{ type: 'integrity', amount: -1 } as const],
          says: 'Wrong line. It shipped anyway.',
        },
  ),
  { label: 'Blame the intern', effects: [], says: 'The intern quit. The bug stayed.' },
]

/** The bug hunts, which share one place among the events so they turn up no more often than any other. */
export const BUG_HUNTS = ['bug-off-by-one', 'bug-assignment', 'bug-await']

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
      { label: 'Configure it properly', effects: [{ type: 'addSigil', sigil: 'backtrace' }] },
    ],
  },
  {
    id: 'regex',
    title: 'A regular expression',
    text: 'Someone left a regex in the codebase. Nobody can read it, but everything it touches stops working.',
    options: [
      { label: 'Keep it', effects: [{ type: 'addCard', card: 'Regex' }] },
      { label: 'Rewrite it as a loop', effects: [{ type: 'boost', attack: 0, health: 1 }] },
    ],
  },
  {
    id: 'code-review',
    title: 'A senior developer',
    text: 'A senior developer offers to join your team, if you let one of your cards go to make room.',
    options: [
      { label: 'Hire them', effects: [{ type: 'removeCard' }, { type: 'addCard', card: 'SeniorDev' }] },
      { label: 'Merge without review', effects: [{ type: 'boost', attack: 1, health: 0 }] },
    ],
  },
  {
    id: 'daemon',
    title: 'A background process',
    text: 'Something is still running after you closed everything. It restarts every time you kill it.',
    options: [
      { label: 'Let it run', effects: [{ type: 'addCard', card: 'Daemon' }] },
      { label: 'Reboot', effects: [] },
    ],
  },
  {
    id: 'fork-repo',
    title: 'Fork the repository',
    text: 'Your deck is open source. Anyone could fork it, including you.',
    options: [
      { label: 'Fork it', effects: [{ type: 'duplicate' }] },
      { label: 'Star it and move on', effects: [{ type: 'boost', attack: 0, health: 1 }] },
    ],
  },
  {
    id: 'red-pipeline',
    title: 'The pipeline is red',
    text: 'One test fails about half the time. Nobody remembers what it was testing.',
    options: [
      { label: 'Rerun it until it passes', effects: [{ type: 'addSigil', sigil: 'retry' }] },
      { label: 'Delete the test', effects: [{ type: 'removeCard' }] },
    ],
  },
  {
    id: 'npm-install',
    title: 'npm install',
    text: 'You need one small package. It needs four hundred more.',
    options: [
      {
        label: 'Install it anyway',
        effects: [
          { type: 'addCard', card: 'SpamBot' },
          { type: 'addCard', card: 'SpamBot' },
        ],
      },
      { label: 'Write it yourself', effects: [{ type: 'boost', attack: 1, health: 1 }] },
    ],
  },
  {
    id: 'cleanup',
    title: 'A cleanup ticket',
    text: 'The code works. It would work just as well with less of it.',
    options: [
      { label: 'Refactor', effects: [{ type: 'removeCard' }, { type: 'boost', attack: 1, health: 1 }] },
      { label: "If it works, don't touch it", effects: [{ type: 'addSigil', sigil: 'try_catch' }] },
    ],
  },
  {
    id: 'coffee',
    title: 'The coffee machine works',
    text: 'For the first time this sprint, the coffee machine is fixed.',
    options: [
      { label: 'A double espresso', effects: [{ type: 'boost', attack: 2, health: 0 }] },
      { label: 'Decaf', effects: [{ type: 'boost', attack: 0, health: 3 }] },
    ],
  },
  {
    id: 'hackathon',
    title: 'A hackathon',
    text: 'Twenty-four hours, free pizza and no tests.',
    options: [
      { label: 'Ship a prototype', effects: [{ type: 'addCard', card: 'Prototype' }] },
      { label: 'Go home and sleep', effects: [{ type: 'boost', attack: 0, health: 2 }] },
    ],
  },
  {
    id: 'migration',
    title: 'A legacy migration',
    text: 'The old system still runs payroll. Nobody wants to be the one who turns it off.',
    options: [
      { label: 'Bring it along', effects: [{ type: 'addCard', card: 'LegacyCode' }] },
      { label: 'Leave a TODO', effects: [{ type: 'addSigil', sigil: 'technical_debt' }] },
    ],
  },
  {
    id: 'linter',
    title: 'The linter',
    text: 'The linter has opinions about your deck. Hundreds of them. One is even right.',
    options: [
      { label: 'Fix one warning', effects: [{ type: 'lint' }] },
      { label: 'Suppress them all', effects: [{ type: 'boost', attack: 0, health: 1 }] },
    ],
  },
  {
    id: 'merge-request',
    title: 'A merge request',
    text: 'Two branches of the same card, drifted apart. Someone could merge them, if anyone ever reviewed anything.',
    options: [
      { label: 'Approve the merge', effects: [{ type: 'fuse' }] },
      { label: 'Close it as stale', effects: [{ type: 'boost', attack: 0, health: 1 }] },
    ],
  },
  {
    id: 'review-trial',
    title: 'A code review',
    text: 'P03 will review three random cards from your deck. Pick what it judges them on. Pass, and it grudgingly hands over a rare.',
    options: [
      { label: 'Throughput: 6 or more attack between them', effects: [{ type: 'trial', trial: 'attack' }] },
      { label: 'Stability: 10 or more health between them', effects: [{ type: 'trial', trial: 'health' }] },
      { label: 'Coverage: 2 or more sigils between them', effects: [{ type: 'trial', trial: 'sigils' }] },
    ],
  },
  {
    id: 'toolbox',
    title: 'An unattended toolbox',
    text: 'Someone left their toolbox open by the conveyor. P03 is pretending not to have seen it.',
    options: [
      { label: 'Borrow something', effects: [{ type: 'item' }] },
      { label: 'Leave it be', effects: [{ type: 'boost', attack: 0, health: 1 }] },
    ],
  },
  {
    id: 'bug-off-by-one',
    title: 'Production is down',
    text: 'Every attack crashes the board. P03 pulls up the diff and waits. Which line is broken?',
    code: ['const lanes = 4', 'for (let lane = 0; lane <= lanes; lane++) {', '  attack(board[lane])', '}'],
    options: hunt(3, 2, 'Five lanes? We have four. Fixed, somehow.'),
  },
  {
    id: 'bug-assignment',
    title: 'Production is down',
    text: 'Every card that takes a hit dies, whatever its health. Which line is broken?',
    code: ['function onHit(card, damage) {', '  card.health -= damage', '  if (card.health = 0) destroy(card)', '}'],
    options: hunt(3, 3, "You didn't check its health. You set it. Fixed."),
  },
  {
    id: 'bug-await',
    title: 'Production is down',
    text: 'The deck deals in the same order every time, and the logs say it was shuffled. Which line is broken?',
    code: ['async function deal() {', '  const deck = loadDeck()', '  deck.shuffle()', '}'],
    options: hunt(3, 2, 'It shuffled a promise. Awaited now.'),
  },
]

export const SCENES: Record<string, Scene> = Object.fromEntries(list.map((scene) => [scene.id, scene]))

export function scene(id: string): Scene {
  const found = SCENES[id]
  if (!found) throw new Error(`No such event: ${id}`)
  return found
}
