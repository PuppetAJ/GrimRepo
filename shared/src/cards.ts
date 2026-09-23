export type Tier = 'E' | 'D' | 'C' | 'B' | 'A' | 'S'

export type SigilId = 'segfault' | 'bypass' | 'technical_debt' | 'try_catch' | 'rate_limiter' | 'fork' | 'hotfix'

export type CardDef = {
  id: string
  name: string
  tier: Tier
  attack: number
  health: number
  cost: number
  sigils: SigilId[]
}

/** What each sigil does, for the card face and the rules page. */
export const SIGILS: Record<SigilId, { name: string; text: string }> = {
  segfault: { name: 'Segfault', text: 'When played, destroys every card on the other side of the table.' },
  bypass: { name: 'Bypass', text: 'Attacks the opponent directly, over any card in the way.' },
  technical_debt: { name: 'Technical Debt', text: 'Worth 3 when sacrificed.' },
  try_catch: { name: 'try/catch', text: 'Survives being sacrificed.' },
  rate_limiter: { name: 'Rate Limiter', text: 'Deals 1 damage back to anything that attacks it.' },
  fork: { name: 'Fork', text: 'Attacks the lanes on either side instead of the one opposite.' },
  hotfix: { name: 'Hotfix', text: 'Heals 1 at the end of each turn.' },
}

// The 2022 game's cards and stats, unchanged; sigils beyond Segfault are for later content.
const table: [string, string, Tier, number, number, number, SigilId[]?][] = [
  ['OffCenterDiv', 'OffCenterDiv', 'E', 0, 6, 0],
  ['HelloWorld', 'Hello World', 'E', 1, 1, 0],
  ['SyntaxErr', 'Syntax Err', 'E', 1, 2, 0],
  ['Loop', 'Loop', 'D', 1, 2, 0],
  ['IfLosing', 'if(losing)', 'D', 2, 1, 0],
  ['RobloxDevOps', 'RobloxDevOps', 'D', 2, 3, 0],
  ['GoogleFu', 'GoogleFu', 'D', 3, 1, 0],
  ['GitSome', 'GitSome', 'C', 4, 1, 0],
  ['GrimRepo', 'GrimRepo', 'C', 3, 2, 0],
  ['GitBasher', 'GitBasher', 'C', 2, 4, 1],
  ['Firewall', 'Firewall', 'C', 2, 6, 1],
  ['SQLSyntaxErr', 'SQLSyntaxErr', 'C', 4, 2, 1],
  ['NullPointer', 'NullPointer', 'C', 4, 2, 1],
  ['Bug', 'Bug', 'C', 0, 8, 1],
  ['BrokenCode', 'BrokenCode', 'C', 3, 4, 1],
  ['Cookie', 'Cookie', 'C', 3, 4, 1],
  ['Iterator', 'Iterator', 'C', 5, 2, 1],
  ['BootStrapped', 'BootStrapped', 'C', 2, 5, 1],
  ['DestroyEnemyYou', 'destroyEnemy(you)', 'B', 8, 2, 2],
  ['DeathNode', 'DeathNode', 'B', 7, 3, 2],
  ['JSONFoorhees', 'JSONFoorhees', 'B', 5, 8, 2],
  ['Documentation', 'Documentation', 'B', 7, 7, 2],
  ['FourOhFour', 'FourOhFour', 'A', 4, 0, 4, ['segfault']],
  ['RubberDuck', 'RubberDuck', 'A', 4, 12, 3],
  ['JACK', 'JACK', 'A', 13, 13, 3],
  // A debug card from 2022: it ends any game in one turn, so it is in no deck.
  ['Y2K', 'Y2K', 'S', 2000, 2000, 0],
  // The squirrel: free fuel for sacrifices, drawn from a pile that never runs out.
  ['Boilerplate', 'Boilerplate', 'E', 0, 1, 0],
]

export const CARDS: Record<string, CardDef> = Object.fromEntries(
  table.map(([id, name, tier, attack, health, cost, sigils = []]) => [
    id,
    { id, name, tier, attack, health, cost, sigils },
  ]),
)

export const BOILERPLATE = 'Boilerplate'
export const DEBUG_CARD = 'Y2K'

/** The player's deck: every card but the debug card and the side pile's. */
export const PLAYER_DECK: string[] = Object.keys(CARDS).filter((id) => id !== DEBUG_CARD && id !== BOILERPLATE)

/** The opponent never gets the board wipe, or it could clear the player's side on a whim. */
export const OPPONENT_POOL: string[] = PLAYER_DECK.filter((id) => !CARDS[id]?.sigils.includes('segfault'))

export function card(id: string): CardDef {
  const found = CARDS[id]
  if (!found) throw new Error(`No such card: ${id}`)
  return found
}
