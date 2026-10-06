export type Tier = 'E' | 'D' | 'C' | 'B' | 'A' | 'S'

export type SigilId =
  | 'segfault'
  | 'bypass'
  | 'technical_debt'
  | 'try_catch'
  | 'rate_limiter'
  | 'fork'
  | 'hotfix'
  | 'fatal_error'
  | 'rollback'
  | 'tech_lead'
  | 'packet_loss'
  | 'retry'
  | 'deprecated'
  | 'scope_creep'
  | 'broadcast'
  | 'popup'
  | 'refactor'
  | 'hot_reload'
  | 'beta'
  | 'load_balancer'
  | 'failover'

export type CardDef = {
  id: string
  name: string
  tier: Tier
  attack: number
  health: number
  cost: number
  sigils: SigilId[]
}

export const SIGILS: Record<SigilId, { name: string; text: string }> = {
  segfault: { name: 'Segfault', text: 'When played, destroys every card on the other side of the table.' },
  bypass: { name: 'Bypass', text: 'Attacks the opponent directly, over any card in the way.' },
  technical_debt: { name: 'Technical Debt', text: 'Worth 3 when sacrificed, but tips the scale 1 against you.' },
  try_catch: { name: 'try/catch', text: 'Survives being sacrificed.' },
  rate_limiter: { name: 'Rate Limiter', text: 'Deals 1 damage back to anything that attacks it.' },
  fork: { name: 'Fork', text: 'Attacks the lanes on either side instead of the one opposite.' },
  hotfix: { name: 'Hotfix', text: 'Heals 1 at the end of each turn.' },
  fatal_error: { name: 'Fatal Error', text: 'Destroys any card it damages.' },
  rollback: { name: 'Rollback', text: 'Shrugs off the first damage it takes.' },
  tech_lead: { name: 'Tech Lead', text: 'Cards beside it get +1 attack.' },
  packet_loss: { name: 'Packet Loss', text: 'The card opposite it has 1 less attack.' },
  retry: { name: 'Retry', text: 'Attacks twice.' },
  deprecated: { name: 'Deprecated', text: 'Dies after it attacks, leaving a Boilerplate in its lane.' },
  scope_creep: { name: 'Scope Creep', text: 'Gains 1 attack each time it destroys a card.' },
  broadcast: { name: 'Broadcast', text: 'Attacks the lane opposite and both lanes beside it.' },
  popup: { name: 'Pop-up', text: 'The card opposite it has 1 more attack.' },
  refactor: {
    name: 'Refactor',
    text: 'When sacrificed, gives its attack, health and Refactor to the card it pays for.',
  },
  hot_reload: { name: 'Hot Reload', text: 'When it dies, a fresh copy comes back to its owner, once.' },
  beta: { name: 'Beta', text: 'After a round on the table, it ships as a stronger card.' },
  load_balancer: { name: 'Load Balancer', text: 'After it attacks, it moves to the next free lane.' },
  failover: { name: 'Failover', text: 'Moves to take an attack aimed at an empty lane.' },
}

// Order matters: reordering changes what every seed deals.
const table: [string, string, Tier, number, number, number, SigilId[]?][] = [
  ['OffCenterDiv', 'OffCenterDiv', 'E', 0, 6, 0, ['refactor']],
  ['HelloWorld', 'Hello World', 'E', 1, 1, 0, ['broadcast']],
  ['CronJob', 'Cron Job', 'E', 1, 2, 0, ['try_catch']],
  ['InfiniteLoop', 'Infinite Loop', 'D', 1, 2, 0, ['retry']],
  ['SpamBot', 'Spam Bot', 'D', 2, 1, 0, ['packet_loss']],
  ['Watchdog', 'Watchdog', 'D', 2, 3, 0, ['rate_limiter']],
  ['CopyPaste', 'Copy Paste', 'D', 3, 1, 0],
  ['ZeroDay', 'Zero Day', 'C', 4, 1, 0, ['load_balancer']],
  ['GrimRepo', 'GrimRepo', 'C', 3, 2, 0, ['tech_lead']],
  ['MergeConflict', 'Merge Conflict', 'C', 2, 4, 1, ['failover']],
  ['Firewall', 'Firewall', 'C', 2, 6, 1, ['rate_limiter']],
  ['SQLInjection', 'SQL Injection', 'C', 4, 2, 1, ['bypass']],
  ['NullPointer', 'NullPointer', 'C', 4, 2, 1, ['fatal_error']],
  ['Bug', 'Bug', 'C', 0, 8, 1, ['hot_reload']],
  ['LegacyCode', 'Legacy Code', 'C', 3, 4, 1, ['technical_debt']],
  ['Cookie', 'Cookie', 'C', 3, 4, 1, ['popup']],
  ['Crawler', 'Crawler', 'C', 5, 2, 1, ['scope_creep']],
  ['Sandbox', 'Sandbox', 'C', 2, 5, 1, ['hotfix']],
  ['DestroyEnemyYou', 'destroyEnemy(you)', 'B', 8, 2, 1, ['deprecated']],
  ['ForkBomb', 'Fork Bomb', 'B', 7, 3, 2, ['fork']],
  ['JSONFoorhees', 'JSONFoorhees', 'B', 5, 8, 2, ['rollback']],
  ['Documentation', 'Documentation', 'B', 7, 7, 2],
  ['FourOhFour', 'FourOhFour', 'A', 4, 0, 4, ['segfault']],
  ['RubberDuck', 'RubberDuck', 'A', 4, 12, 3, ['hotfix']],
  ['Mainframe', 'Mainframe', 'A', 13, 13, 3],
  // Debug card: it ends any game in one turn, so it is in no deck.
  ['Y2K', 'Y2K', 'S', 2000, 2000, 0],
  // Free fuel for sacrifices, drawn from a pile that never runs out.
  ['Boilerplate', 'Boilerplate', 'E', 0, 1, 0],
  // P03's answer to a run's empty deck; it grows each time, so it is in no deck.
  ['OutOfMemory', 'Out of Memory', 'E', 1, 1, 0],
  // A Beta card's two forms: it ships as the second after a round on the table, so only the first is dealt.
  ['Prototype', 'Prototype', 'D', 1, 2, 0, ['beta']],
  ['ShippedFeature', 'Shipped Feature', 'B', 4, 5, 0],
  // Found only at events, so they are in no deck and never offered.
  ['Regex', 'Regex', 'C', 1, 1, 1, ['fatal_error']],
  ['SeniorDev', 'Senior Dev', 'B', 3, 4, 2, ['tech_lead']],
  ['Daemon', 'Daemon', 'C', 2, 2, 1, ['hot_reload']],
]

export const CARDS: Record<string, CardDef> = Object.fromEntries(
  table.map(([id, name, tier, attack, health, cost, sigils = []]) => [
    id,
    { id, name, tier, attack, health, cost, sigils },
  ]),
)

export const BOILERPLATE = 'Boilerplate'
export const DEBUG_CARD = 'Y2K'
export const OUT_OF_MEMORY = 'OutOfMemory'

/** What a Beta card ships as. */
export const SHIPS_AS: Record<string, string> = { Prototype: 'ShippedFeature' }

/** Cards a run gains only from events. */
export const EVENT_ONLY = ['Regex', 'SeniorDev', 'Daemon']

export const PLAYER_DECK: string[] = Object.keys(CARDS).filter(
  (id) =>
    id !== DEBUG_CARD &&
    id !== BOILERPLATE &&
    id !== OUT_OF_MEMORY &&
    !Object.values(SHIPS_AS).includes(id) &&
    !EVENT_ONLY.includes(id),
)

/** No board wipe, or P03 could clear the player's side on a whim. */
export const OPPONENT_POOL: string[] = PLAYER_DECK.filter((id) => !CARDS[id]?.sigils.includes('segfault'))

export function card(id: string): CardDef {
  const found = CARDS[id]
  if (!found) throw new Error(`No such card: ${id}`)
  return found
}
