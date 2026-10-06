import { card } from './cards.ts'

/** A fixed card, or one picked from a few for a little variation. */
export type Queued = { lane: number; card: string } | { lane: number; pick: string[] }

/** What P03 queues on each turn of a phase; turn 0 is queued before the first draw. */
export type Plan = Queued[][]

export type Encounter = {
  id: string
  name: string
  /** What P03 says as the battle starts. */
  intro: string
  /** 0 to 2: Localhost, Staging, Production. */
  stage: number
  boss: boolean
  /** A boss has two; tipping the scale in one starts the next. */
  phases: Plan[]
}

export const STAGES = ['Localhost', 'Staging', 'Production'] as const

const list: Encounter[] = [
  {
    id: 'localhost-hello',
    name: 'Hello, World',
    intro: "Your first real battle. I'll go easy on you. That was a lie.",
    stage: 0,
    boss: false,
    phases: [
      [
        [{ lane: 1, card: 'CopyPaste' }],
        [{ lane: 2, pick: ['CronJob', 'SpamBot'] }],
        [{ lane: 3, card: 'GrimRepo' }],
        [{ lane: 0, card: 'InfiniteLoop' }],
        [{ lane: 3, pick: ['Watchdog', 'CopyPaste'] }],
      ],
    ],
  },
  {
    id: 'localhost-cron',
    name: 'Scheduled Maintenance',
    intro: 'Everything here runs on a schedule. Unlike you.',
    stage: 0,
    boss: false,
    phases: [
      [
        [{ lane: 0, card: 'CronJob' }],
        [
          { lane: 3, card: 'GrimRepo' },
          { lane: 1, card: 'SpamBot' },
        ],
        [{ lane: 1, pick: ['GrimRepo', 'CopyPaste'] }],
        [{ lane: 2, card: 'ZeroDay' }],
        [{ lane: 2, card: 'Watchdog' }],
      ],
    ],
  },
  {
    id: 'localhost-boss',
    name: 'The Watchdog',
    intro: 'My watchdog never sleeps, and it never forgets a bad commit.',
    stage: 0,
    boss: true,
    phases: [
      [[{ lane: 1, card: 'Watchdog' }], [{ lane: 2, card: 'SpamBot' }], [], [{ lane: 3, card: 'Watchdog' }]],
      [
        [
          { lane: 1, card: 'Bug' },
          { lane: 2, card: 'OffCenterDiv' },
        ],
        [{ lane: 0, card: 'CopyPaste' }],
        [{ lane: 3, pick: ['CopyPaste', 'Watchdog'] }],
      ],
    ],
  },
  {
    id: 'staging-null',
    name: 'Null Reference',
    intro: 'Something in here points at nothing. Probably your strategy.',
    stage: 1,
    boss: false,
    phases: [
      [
        [{ lane: 1, card: 'CopyPaste' }],
        [{ lane: 3, pick: ['Firewall', 'Bug'] }],
        [{ lane: 0, card: 'NullPointer' }],
        [{ lane: 2, pick: ['Crawler', 'SQLInjection'] }],
      ],
    ],
  },
  {
    id: 'staging-legacy',
    name: 'Legacy Codebase',
    intro: 'Nobody knows how this works. Including me. Especially me.',
    stage: 1,
    boss: false,
    phases: [
      [
        [{ lane: 2, card: 'LegacyCode' }],
        [{ lane: 0, card: 'Watchdog' }],
        [{ lane: 1, pick: ['CronJob', 'MergeConflict'] }],
        [{ lane: 3, card: 'ZeroDay' }],
      ],
    ],
  },
  {
    id: 'staging-boss',
    name: 'The Sandbox Escape',
    intro: "Your sandbox has a hole in it. I'm coming through.",
    stage: 1,
    boss: true,
    phases: [
      [
        [{ lane: 0, card: 'Sandbox' }],
        [{ lane: 2, card: 'Crawler' }],
        [{ lane: 1, pick: ['SQLInjection', 'NullPointer'] }],
        [{ lane: 3, card: 'LegacyCode' }],
      ],
      [
        [{ lane: 1, pick: ['ForkBomb', 'Crawler'] }],
        [{ lane: 2, card: 'Sandbox' }],
        [{ lane: 0, pick: ['Crawler', 'ZeroDay'] }],
      ],
    ],
  },
  {
    id: 'production-outage',
    name: 'The Outage',
    intro: 'Production is down. The status page still says everything is fine.',
    stage: 2,
    boss: false,
    phases: [
      [
        [{ lane: 0, card: 'Crawler' }],
        [{ lane: 3, card: 'SQLInjection' }],
        [{ lane: 1, pick: ['Cookie', 'Sandbox'] }],
        [{ lane: 2, card: 'Documentation' }],
      ],
    ],
  },
  {
    id: 'production-hotfix',
    name: 'Friday Deploy',
    intro: 'A hotfix, on a Friday, straight to production. What could go wrong?',
    stage: 2,
    boss: false,
    phases: [
      [
        [{ lane: 2, card: 'JSONFoorhees' }],
        [{ lane: 1, card: 'CopyPaste' }],
        [{ lane: 0, pick: ['Firewall', 'Cookie'] }],
        [{ lane: 3, pick: ['DestroyEnemyYou', 'ForkBomb'] }],
      ],
    ],
  },
  {
    id: 'production-boss',
    name: 'The Postmortem',
    intro: "This is the postmortem. Yours. I've already written the root cause.",
    stage: 2,
    boss: true,
    phases: [
      [
        [{ lane: 1, card: 'Documentation' }],
        [{ lane: 2, card: 'ForkBomb' }],
        [{ lane: 0, pick: ['JSONFoorhees', 'DestroyEnemyYou'] }],
        [{ lane: 3, card: 'RubberDuck' }],
      ],
      [
        [
          { lane: 0, card: 'RubberDuck' },
          { lane: 3, card: 'Firewall' },
        ],
        [{ lane: 1, card: 'Cookie' }],
        [{ lane: 2, pick: ['Documentation', 'ForkBomb'] }],
      ],
    ],
  },
]

export const ENCOUNTERS: Record<string, Encounter> = Object.fromEntries(list.map((found) => [found.id, found]))

export function encounter(id: string): Encounter {
  const found = ENCOUNTERS[id]
  if (!found) throw new Error(`No such encounter: ${id}`)
  return found
}

/** Every card an encounter can queue, to check the data against the card table. */
export const cardsIn = (found: Encounter): string[] =>
  found.phases
    .flat(2)
    .flatMap((queued) => ('card' in queued ? [queued.card] : queued.pick))
    .map((id) => card(id).id)
