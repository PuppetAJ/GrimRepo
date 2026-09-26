import { LANES, type GameEvent, type GameState, type Side, type Slot, type Unit } from './types.ts'

function remove(row: Slot[], uid: number): number {
  const lane = row.findIndex((slot) => slot?.uid === uid)
  if (lane >= 0) row[lane] = null
  return lane
}

/** Every card on one side attacks, lane by lane, left to right. */
export function attack(state: GameState, side: Side, events: GameEvent[]): void {
  const attackers = side === 'player' ? state.player.board : state.opponent.front
  const defenders = side === 'player' ? state.opponent.front : state.player.board
  // The player's hits tip the scale their way; P03's tip it back.
  const toward = side === 'player' ? 1 : -1

  for (let lane = 0; lane < LANES; lane++) {
    const attacker = attackers[lane]
    if (!attacker || attacker.attack <= 0) continue
    const lanes = attacker.sigils.includes('fork') ? [lane - 1, lane + 1].filter((l) => l >= 0 && l < LANES) : [lane]

    for (const aimed of lanes) {
      // A Rate Limiter can kill an attacker partway through a Fork.
      if (attackers[lane]?.uid !== attacker.uid) break
      const defender = attacker.sigils.includes('bypass') ? null : defenders[aimed]
      events.push({ type: 'attacked', side, lane, target: defender ? aimed : 'face' })

      if (!defender) {
        state.scale += toward * attacker.attack
        events.push({
          type: 'hit',
          side: side === 'player' ? 'opponent' : 'player',
          amount: attacker.attack,
          scale: state.scale,
        })
        continue
      }

      const left = defender.health - attacker.attack
      defender.health = Math.max(0, left)
      events.push({ type: 'damaged', uid: defender.uid, amount: attacker.attack, health: defender.health })

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
        // Overkill carries into the queued card behind, and never reaches a player.
        const behind = side === 'player' ? state.opponent.back[aimed] : null
        if (left < 0 && behind) overkill(state, aimed, behind, -left, events)
      }
    }
  }
}

function strikeBack(state: GameState, side: Side, attacker: Unit, events: GameEvent[]): void {
  attacker.health = Math.max(0, attacker.health - 1)
  events.push({ type: 'struckBack', uid: attacker.uid, amount: 1 })
  if (attacker.health > 0) return
  const row = side === 'player' ? state.player.board : state.opponent.front
  const lane = remove(row, attacker.uid)
  events.push({ type: 'killed', uid: attacker.uid, side, lane, row: 'front' })
}

function overkill(state: GameState, lane: number, unit: Unit, amount: number, events: GameEvent[]): void {
  events.push({ type: 'overkill', lane, amount })
  unit.health = Math.max(0, unit.health - amount)
  events.push({ type: 'damaged', uid: unit.uid, amount, health: unit.health })
  if (unit.health > 0) return
  state.opponent.back[lane] = null
  events.push({ type: 'killed', uid: unit.uid, side: 'opponent', lane, row: 'back' })
}
