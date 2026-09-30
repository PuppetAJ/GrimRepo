import { card } from './cards.ts'

/** A fixed card, or one picked from a few for a little variation. */
export type Queued = { lane: number; card: string } | { lane: number; pick: string[] }

/** What P03 queues on each turn of a phase; turn 0 is queued before the first draw. */
export type Plan = Queued[][]

export type Encounter = {
  id: string
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
    stage: 0,
    boss: false,
    phases: [
      [
        [{ lane: 1, card: 'HelloWorld' }],
        [{ lane: 2, pick: ['CronJob', 'SpamBot'] }],
        [],
        [{ lane: 0, card: 'InfiniteLoop' }],
        [{ lane: 3, pick: ['Watchdog', 'CopyPaste'] }],
      ],
    ],
  },
  {
    id: 'localhost-cron',
    stage: 0,
    boss: false,
    phases: [
      [
        [{ lane: 0, card: 'CronJob' }],
        [{ lane: 3, card: 'CronJob' }],
        [{ lane: 1, pick: ['SpamBot', 'HelloWorld'] }],
        [],
        [{ lane: 2, card: 'Watchdog' }],
      ],
    ],
  },
  {
    id: 'localhost-boss',
    stage: 0,
    boss: true,
    phases: [
      [
        [{ lane: 1, card: 'Watchdog' }],
        [{ lane: 2, card: 'SpamBot' }],
        [{ lane: 0, pick: ['CopyPaste', 'InfiniteLoop'] }],
        [{ lane: 3, card: 'Firewall' }],
      ],
      [
        [
          { lane: 1, card: 'Bug' },
          { lane: 2, card: 'Bug' },
        ],
        [{ lane: 0, card: 'ZeroDay' }],
        [{ lane: 3, pick: ['Crawler', 'NullPointer'] }],
      ],
    ],
  },
  {
    id: 'staging-null',
    stage: 1,
    boss: false,
    phases: [
      [
        [{ lane: 1, card: 'NullPointer' }],
        [{ lane: 3, pick: ['Firewall', 'Bug'] }],
        [{ lane: 0, card: 'CopyPaste' }],
        [{ lane: 2, pick: ['Crawler', 'SQLInjection'] }],
      ],
    ],
  },
  {
    id: 'staging-legacy',
    stage: 1,
    boss: false,
    phases: [
      [
        [{ lane: 2, card: 'LegacyCode' }],
        [{ lane: 0, card: 'Cookie' }],
        [{ lane: 1, pick: ['Sandbox', 'MergeConflict'] }],
        [{ lane: 3, card: 'ZeroDay' }],
      ],
    ],
  },
  {
    id: 'staging-boss',
    stage: 1,
    boss: true,
    phases: [
      [
        [{ lane: 0, card: 'Firewall' }],
        [{ lane: 2, card: 'Crawler' }],
        [{ lane: 1, pick: ['SQLInjection', 'NullPointer'] }],
        [{ lane: 3, card: 'LegacyCode' }],
      ],
      [[{ lane: 1, card: 'ForkBomb' }], [{ lane: 2, card: 'Sandbox' }], [{ lane: 0, pick: ['Crawler', 'ZeroDay'] }]],
    ],
  },
  {
    id: 'production-outage',
    stage: 2,
    boss: false,
    phases: [
      [
        [{ lane: 0, card: 'Crawler' }],
        [{ lane: 3, card: 'SQLInjection' }],
        [{ lane: 1, pick: ['ForkBomb', 'DestroyEnemyYou'] }],
        [{ lane: 2, card: 'Documentation' }],
      ],
    ],
  },
  {
    id: 'production-hotfix',
    stage: 2,
    boss: false,
    phases: [
      [
        [{ lane: 2, card: 'JSONFoorhees' }],
        [{ lane: 1, card: 'NullPointer' }],
        [{ lane: 0, pick: ['Firewall', 'Cookie'] }],
        [{ lane: 3, pick: ['DestroyEnemyYou', 'ForkBomb'] }],
      ],
    ],
  },
  {
    id: 'production-boss',
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
          { lane: 0, card: 'Mainframe' },
          { lane: 3, card: 'Firewall' },
        ],
        [{ lane: 1, card: 'DestroyEnemyYou' }],
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
