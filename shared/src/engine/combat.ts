import { LANES, type GameEvent, type GameState, type Side, type Slot, type Unit } from './types.ts'

function remove(row: Slot[], uid: number): number {
  const lane = row.findIndex((slot) => slot?.uid === uid)
  if (lane >= 0) row[lane] = null
  return lane
}

/** What a card hits for: its own attack, +1 for each Tech Lead beside it, and the Code Smell or Pop-up opposite it. */
export function attackOf(state: GameState, side: Side, lane: number): number {
  const row = side === 'player' ? state.player.board : state.opponent.front
  const facing = side === 'player' ? state.opponent.front : state.player.board
  const unit = row[lane]
  if (!unit) return 0
  const leads = [lane - 1, lane + 1].filter((beside) => row[beside]?.sigils.includes('tech_lead')).length
  const opposite = facing[lane]
  const smell = opposite?.sigils.includes('code_smell') ? 1 : 0
  const popup = opposite?.sigils.includes('popup') ? 1 : 0
  return Math.max(0, unit.attack + leads - smell + popup)
}

/** Deals damage to a card: a Rollback card shrugs off the first, and Fatal Error makes any damage deadly. */
function damage(unit: Unit, amount: number, fatal: boolean, events: GameEvent[]): number {
  if (unit.sigils.includes('rollback') && !unit.rolledBack) {
    unit.rolledBack = true
    events.push({ type: 'shielded', uid: unit.uid })
    return unit.health
  }
  const left = unit.health - (fatal ? Math.max(amount, unit.health) : amount)
  unit.health = Math.max(0, left)
  events.push({ type: 'damaged', uid: unit.uid, amount, health: unit.health })
  return left
}

export function attack(state: GameState, side: Side, events: GameEvent[]): void {
  const attackers = side === 'player' ? state.player.board : state.opponent.front
  const defenders = side === 'player' ? state.opponent.front : state.player.board
  // A positive scale favors the player.
  const toward = side === 'player' ? 1 : -1
  const within = (lanes: number[]) => lanes.filter((lane) => lane >= 0 && lane < LANES)

  for (let lane = 0; lane < LANES; lane++) {
    const attacker = attackers[lane]
    if (!attacker) continue
    const lanes = attacker.sigils.includes('broadcast')
      ? within([lane - 1, lane, lane + 1])
      : attacker.sigils.includes('fork')
        ? within([lane - 1, lane + 1])
        : [lane]
    const strikes = attacker.sigils.includes('retry') ? 2 : 1
    let struck = false

    for (let strike = 0; strike < strikes; strike++) {
      for (const aimed of lanes) {
        // A Rate Limiter can kill an attacker partway through its attacks.
        if (attackers[lane]?.uid !== attacker.uid) break
        const power = attackOf(state, side, lane)
        if (power <= 0) break
        struck = true
        const defender = attacker.sigils.includes('bypass') ? null : defenders[aimed]
        events.push({ type: 'attacked', side, lane, target: defender ? aimed : 'face' })

        if (!defender) {
          state.scale += toward * power
          events.push({
            type: 'hit',
            side: side === 'player' ? 'opponent' : 'player',
            amount: power,
            scale: state.scale,
          })
          continue
        }

        const left = damage(defender, power, attacker.sigils.includes('fatal_error'), events)
        if (defender.sigils.includes('rate_limiter')) strikeBack(state, side, attacker, events)

        if (left <= 0) {
          remove(defenders, defender.uid)
          events.push({
            type: 'killed',
            uid: defender.uid,
            side: side === 'player' ? 'opponent' : 'player',
            lane: aimed,
            row: 'front',
          })
          // Scope Creep grows with every card it takes down.
          if (attacker.sigils.includes('scope_creep') && attackers[lane]?.uid === attacker.uid) {
            attacker.attack += 1
            events.push({ type: 'buffed', uid: attacker.uid, attack: attacker.attack, health: attacker.health })
          }
          // Overkill carries into the queued card behind, never to a player.
          const behind = side === 'player' ? state.opponent.back[aimed] : null
          if (left < 0 && behind) overkill(state, aimed, behind, -left, events)
        }
      }
    }

    // Deprecated code runs once, then it's gone.
    if (struck && attacker.sigils.includes('deprecated') && attackers[lane]?.uid === attacker.uid) {
      remove(attackers, attacker.uid)
      events.push({ type: 'killed', uid: attacker.uid, side, lane, row: 'front' })
    }
  }
}

function strikeBack(state: GameState, side: Side, attacker: Unit, events: GameEvent[]): void {
  if (attacker.sigils.includes('rollback') && !attacker.rolledBack) {
    attacker.rolledBack = true
    events.push({ type: 'shielded', uid: attacker.uid })
    return
  }
  attacker.health = Math.max(0, attacker.health - 1)
  events.push({ type: 'struckBack', uid: attacker.uid, amount: 1 })
  if (attacker.health > 0) return
  const row = side === 'player' ? state.player.board : state.opponent.front
  const lane = remove(row, attacker.uid)
  events.push({ type: 'killed', uid: attacker.uid, side, lane, row: 'front' })
}

function overkill(state: GameState, lane: number, unit: Unit, amount: number, events: GameEvent[]): void {
  events.push({ type: 'overkill', lane, amount })
  if (damage(unit, amount, false, events) > 0) return
  state.opponent.back[lane] = null
  events.push({ type: 'killed', uid: unit.uid, side: 'opponent', lane, row: 'back' })
}
