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
  | 'scale_out'
  | 'redundancy'

/** What a card is, for the sigils that count cards of their own type. */
export type CardType = 'bot' | 'exploit' | 'bug' | 'legacy' | 'dev'

export const CARD_TYPES: Record<CardType, { name: string; about: string }> = {
  bot: { name: 'Bot', about: 'Runs on its own.' },
  exploit: { name: 'Exploit', about: 'Attacks the system.' },
  bug: { name: 'Bug', about: 'A defect.' },
  legacy: { name: 'Legacy', about: 'Old code nobody dares touch.' },
  dev: { name: 'Dev', about: "The developer's own tools." },
}

export type CardDef = {
  id: string
  name: string
  tier: Tier
  attack: number
  health: number
  cost: number
  sigils: SigilId[]
  /** The card whose art it wears, for a death card; others wear their own. */
  art?: string
  /** None for Boilerplate, Out of Memory and the debug card. */
  type?: CardType
}

export const SIGILS: Record<SigilId, { name: string; text: string }> = {
  segfault: { name: 'Segfault', text: 'When played, destroys every card on the other side of the table.' },
  bypass: { name: 'Bypass', text: 'Attacks the opponent directly, over any card in the way.' },
  technical_debt: { name: 'Technical Debt', text: 'Worth 3 when sacrificed, but tips the scale 1 against you.' },
  try_catch: { name: 'try/catch', text: 'Survives being sacrificed.' },
  rate_limiter: { name: 'Rate Limiter', text: 'Deals 1 damage back to anything that attacks it.' },
  fork: {
    name: 'Fork',
    text: 'Attacks the lanes on either side instead of the one opposite. Never on the same card as Broadcast.',
  },
  hotfix: { name: 'Hotfix', text: 'Heals 1 at the end of each turn.' },
  fatal_error: { name: 'Fatal Error', text: 'Destroys any card it damages.' },
  rollback: { name: 'Rollback', text: 'Shrugs off the first damage it takes.' },
  tech_lead: { name: 'Tech Lead', text: 'Cards beside it get +1 attack.' },
  packet_loss: { name: 'Packet Loss', text: 'The card opposite it has 1 less attack.' },
  retry: { name: 'Retry', text: 'Attacks twice.' },
  deprecated: { name: 'Deprecated', text: 'Dies after it attacks, leaving a Boilerplate in its lane.' },
  scope_creep: { name: 'Scope Creep', text: 'Gains 1 attack each time it destroys a card.' },
  broadcast: {
    name: 'Broadcast',
    text: 'Attacks the lane opposite and both lanes beside it. Never on the same card as Fork.',
  },
  popup: { name: 'Pop-up', text: 'The card opposite it has 1 more attack.' },
  refactor: {
    name: 'Refactor',
    text: 'When sacrificed, gives its attack, health and Refactor to the card it pays for, and is gone for the battle.',
  },
  hot_reload: { name: 'Hot Reload', text: 'When it dies, a fresh copy comes back to its owner, once.' },
  beta: { name: 'Beta', text: 'After a round on the table, it ships as a stronger card.' },
  load_balancer: { name: 'Load Balancer', text: 'After it attacks, it moves to the next free lane.' },
  failover: { name: 'Failover', text: 'Moves to take an attack aimed at an empty lane.' },
  scale_out: { name: 'Scale Out', text: 'Gets +1 attack for each other card of its type on its side of the table.' },
  redundancy: {
    name: 'Redundancy',
    text: 'When it lands on the table, gains 1 health for each other card of its type on its side.',
  },
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
  // One for each type, each growing with the cards of its type beside it.
  ['Botnet', 'Botnet', 'C', 1, 2, 1, ['scale_out']],
  ['Heisenbug', 'Heisenbug', 'D', 1, 1, 0, ['scale_out']],
  ['Monolith', 'Monolith', 'C', 2, 2, 1, ['redundancy']],
  ['ExploitChain', 'Exploit Chain', 'C', 2, 1, 1, ['scale_out']],
  ['PairProgramming', 'Pair Programming', 'C', 2, 3, 1, ['redundancy']],
]

const TYPE_OF: Record<string, CardType> = {
  SpamBot: 'bot',
  Crawler: 'bot',
  CronJob: 'bot',
  Watchdog: 'bot',
  Daemon: 'bot',
  Botnet: 'bot',
  SQLInjection: 'exploit',
  ZeroDay: 'exploit',
  ForkBomb: 'exploit',
  DestroyEnemyYou: 'exploit',
  GrimRepo: 'exploit',
  ExploitChain: 'exploit',
  Bug: 'bug',
  InfiniteLoop: 'bug',
  NullPointer: 'bug',
  OffCenterDiv: 'bug',
  MergeConflict: 'bug',
  FourOhFour: 'bug',
  Regex: 'bug',
  Heisenbug: 'bug',
  LegacyCode: 'legacy',
  Mainframe: 'legacy',
  Documentation: 'legacy',
  JSONFoorhees: 'legacy',
  Prototype: 'legacy',
  Monolith: 'legacy',
  HelloWorld: 'dev',
  Cookie: 'dev',
  RubberDuck: 'dev',
  SeniorDev: 'dev',
  CopyPaste: 'dev',
  ShippedFeature: 'dev',
  Firewall: 'dev',
  Sandbox: 'dev',
  PairProgramming: 'dev',
}

export const CARDS: Record<string, CardDef> = Object.fromEntries(
  table.map(([id, name, tier, attack, health, cost, sigils = []]) => [
    id,
    { id, name, tier, attack, health, cost, sigils, ...(TYPE_OF[id] ? { type: TYPE_OF[id] } : {}) },
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

/** A death card's id carries the whole card, so battles, offers and replays need no catalog entry for it. */
export const DEATH_PREFIX = 'death:'
export const isDeathCard = (id: string): boolean => id.startsWith(DEATH_PREFIX)
/** At most this long, so the name fits on one line on the card and on the profile. */
export const DEATH_NAME_LIMIT = 16
export const DEATH_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._'!?-]*$/

export type DeathCardDef = {
  name: string
  cost: number
  attack: number
  health: number
  art: string
  sigils: SigilId[]
}

export const deathCardId = ({ name, cost, attack, health, art, sigils }: DeathCardDef): string =>
  `${DEATH_PREFIX}${[cost, attack, health, art, sigils.join(','), encodeURIComponent(name)].join(':')}`

const parsed = new Map<string, CardDef | null>()

/** The card a death card's id describes, or null if it isn't a well-formed one. */
export function parseDeathCard(id: string): CardDef | null {
  if (!isDeathCard(id)) return null
  if (parsed.has(id)) return parsed.get(id) ?? null
  const parts = id.slice(DEATH_PREFIX.length).split(':')
  const [cost, attack, health] = parts.slice(0, 3).map((part) => (/^\d{1,3}$/.test(part ?? '') ? Number(part) : NaN))
  const [, , , art = '', sigilList = '', encoded = ''] = parts
  let name = ''
  try {
    name = decodeURIComponent(encoded)
  } catch {
    // A malformed name falls through to null below.
  }
  const sigils = sigilList ? (sigilList.split(',') as SigilId[]) : []
  const base = CARDS[art]
  const valid =
    parts.length === 6 &&
    [cost, attack, health].every((value) => Number.isInteger(value)) &&
    base !== undefined &&
    sigils.length <= 3 &&
    sigils.every((sigil) => sigil in SIGILS) &&
    new Set(sigils).size === sigils.length &&
    name.length > 0 &&
    name.length <= DEATH_NAME_LIMIT &&
    DEATH_NAME_PATTERN.test(name) &&
    deathCardId({ name, cost: cost as number, attack: attack as number, health: health as number, art, sigils }) === id
  const def: CardDef | null = valid
    ? {
        id,
        name,
        tier: base.tier,
        attack: attack as number,
        health: health as number,
        cost: cost as number,
        sigils,
        art,
        // A death card is the type of the card whose stats and art it took.
        ...(base.type ? { type: base.type } : {}),
      }
    : null
  parsed.set(id, def)
  return def
}

export function card(id: string): CardDef {
  const found = CARDS[id] ?? parseDeathCard(id)
  if (!found) throw new Error(`No such card: ${id}`)
  return found
}
