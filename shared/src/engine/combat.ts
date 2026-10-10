import { BOILERPLATE, card } from '../cards.ts'
import { HAND_LIMIT, LANES, type GameEvent, type GameState, type Side, type Slot, type Unit } from './types.ts'
import { drawUnit, makeUnit } from './units.ts'

function remove(row: Slot[], uid: number): number {
  const lane = row.findIndex((slot) => slot?.uid === uid)
  if (lane >= 0) row[lane] = null
  return lane
}

/** A Hot Reload card that died or was sacrificed sends a fresh copy back: to the player's hand, or P03's queue. */
export function perish(state: GameState, side: Side, unit: Unit, lane: number, events: GameEvent[]): void {
  if (!unit.sigils.includes('hot_reload')) return
  if (side === 'player') {
    if (state.player.hand.length >= HAND_LIMIT) return
    const copy = once(unit.source === undefined ? makeUnit(state, unit.card) : drawUnit(state, unit.source))
    state.player.hand.push(copy)
    events.push({ type: 'reloaded', side, unit: copy, from: lane, lane: null })
  } else if (!state.opponent.back[lane]) {
    const copy = once(makeUnit(state, unit.card))
    state.opponent.back[lane] = copy
    events.push({ type: 'reloaded', side, unit: copy, from: lane, lane })
  }
}

/** A Hot Reload card comes back once: its copy reloads no more. */
const once = (copy: Unit): Unit => ({ ...copy, sigils: copy.sigils.filter((sigil) => sigil !== 'hot_reload') })

/** Which Failover card covers each empty lane: each moves to the attacked empty lane nearest where it stands. */
function failoverPlan(row: Slot[], attacked: number[]): Map<number, number> {
  const open = [...new Set(attacked)].filter((lane) => !row[lane]).sort((a, b) => a - b)
  const plan = new Map<number, number>()
  row.forEach((unit, from) => {
    if (!unit?.sigils.includes('failover')) return
    const to = open
      .filter((lane) => !plan.has(lane))
      .sort((a, b) => Math.abs(a - from) - Math.abs(b - from) || a - b)[0]
    if (to !== undefined) plan.set(to, from)
  })
  return plan
}

/** The Failover card planned for an empty lane, which moves in to take the attack. */
function failover(row: Slot[], lane: number, side: Side, plan: Map<number, number>, events: GameEvent[]): Unit | null {
  const from = plan.get(lane)
  if (from === undefined || !row[from]?.sigils.includes('failover') || row[lane]) return null
  plan.delete(lane)
  const unit = row[from] as Unit
  row[from] = null
  row[lane] = unit
  events.push({ type: 'moved', uid: unit.uid, side, from, to: lane })
  return unit
}

/** What a card hits for: its own attack, +1 for each Tech Lead beside it, and the Packet Loss or Pop-up opposite it. */
export function attackOf(state: GameState, side: Side, lane: number): number {
  const row = side === 'player' ? state.player.board : state.opponent.front
  const facing = side === 'player' ? state.opponent.front : state.player.board
  return attackIn(row, facing, lane)
}

/** What the card in a lane of an attacking row hits for, facing the other row. */
export function attackIn(row: Slot[], facing: Slot[], lane: number): number {
  const unit = row[lane]
  if (!unit) return 0
  const leads = [lane - 1, lane + 1].filter((beside) => row[beside]?.sigils.includes('tech_lead')).length
  const opposite = facing[lane]
  const loss = opposite?.sigils.includes('packet_loss') ? 1 : 0
  const popup = opposite?.sigils.includes('popup') ? 1 : 0
  const scale = unit.sigils.includes('scale_out') ? kin(row, lane) : 0
  return Math.max(0, unit.attack + leads - loss + popup + scale)
}

/** How many other cards on this row share the card's type. */
export function kin(row: Slot[], lane: number): number {
  const type = card((row[lane] as Unit).card).type
  if (!type) return 0
  return row.filter((other, index) => index !== lane && other && card(other.card).type === type).length
}

/** A Redundancy card landing on the table gains 1 health for each card of its type already on its side. */
export function reinforce(row: Slot[], lane: number, events: GameEvent[]): void {
  const unit = row[lane]
  if (!unit?.sigils.includes('redundancy')) return
  const gain = kin(row, lane)
  if (!gain) return
  unit.health += gain
  unit.maxHealth += gain
  events.push({ type: 'buffed', uid: unit.uid, attack: unit.attack, health: unit.health, sigils: [...unit.sigils] })
}

/** How much integrity one Uptime card repairs a battle. */
export const UPTIME_LIMIT = 3

/** A run's card destroyed by P03 costs 1 integrity; a Boilerplate costs nothing. */
function lost(state: GameState, unit: Unit, events: GameEvent[]): void {
  const integrity = state.integrity
  if (!integrity || unit.card === BOILERPLATE || integrity.left <= 0) return
  integrity.left -= 1
  events.push({ type: 'integrity', uid: unit.uid, change: -1, left: integrity.left })
}

/** An Uptime card that blocks an attack repairs 1 integrity, up to its limit a battle. */
function uptime(state: GameState, unit: Unit, events: GameEvent[]): void {
  const integrity = state.integrity
  if (!integrity || !unit.sigils.includes('uptime') || (unit.repaired ?? 0) >= UPTIME_LIMIT) return
  if (integrity.left >= integrity.max) return
  unit.repaired = (unit.repaired ?? 0) + 1
  integrity.left += 1
  events.push({ type: 'integrity', uid: unit.uid, change: 1, left: integrity.left })
}

/** Whether the run's integrity has run out, which loses the battle and the run. */
export const broken = (state: GameState): boolean => state.integrity !== undefined && state.integrity.left <= 0

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

  // The lanes this side's cards aim at, so each Failover card can pick the empty one nearest it.
  const aims = attackers.flatMap((unit, lane) =>
    !unit || unit.sigils.includes('bypass')
      ? []
      : unit.sigils.includes('broadcast')
        ? within([lane - 1, lane, lane + 1])
        : unit.sigils.includes('fork')
          ? within([lane - 1, lane + 1])
          : [lane],
  )
  const covers = failoverPlan(defenders, aims)

  // Each card attacks once, in the lane order it began in, even if a Load Balancer moves on into a later lane.
  for (const attacker of attackers.slice()) {
    if (!attacker) continue
    const lane = attackers.findIndex((slot) => slot?.uid === attacker.uid)
    if (lane < 0) continue
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
        const defended = attacker.sigils.includes('bypass')
          ? null
          : (defenders[aimed] ?? failover(defenders, aimed, side === 'player' ? 'opponent' : 'player', covers, events))
        const defender = defended
        events.push({ type: 'attacked', side, lane, target: defender ? aimed : 'face', aimed })

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
        if (side === 'opponent') uptime(state, defender, events)
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
          if (side === 'opponent') lost(state, defender, events)
          perish(state, side === 'player' ? 'opponent' : 'player', defender, aimed, events)
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
      perish(state, side, attacker, lane, events)
      // It leaves a Boilerplate behind: a blocker, and something to sacrifice.
      const left = makeUnit(state, BOILERPLATE)
      attackers[lane] = left
      events.push({ type: 'leftBehind', side, lane, unit: left })
    }
    // A Load Balancer moves on after attacking, turning back at the edge or a taken lane.
    if (struck && attacker.sigils.includes('load_balancer') && attackers[lane]?.uid === attacker.uid) {
      const ahead = lane + (attacker.heading ?? 1)
      const back = lane - (attacker.heading ?? 1)
      const free = (to: number) => to >= 0 && to < LANES && !attackers[to]
      const to = free(ahead) ? ahead : free(back) ? back : null
      if (to !== null) {
        attackers[lane] = null
        attackers[to] = attacker
        attacker.heading = to > lane ? 1 : -1
        events.push({ type: 'moved', uid: attacker.uid, side, from: lane, to, heading: attacker.heading })
      }
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
  if (side === 'player') lost(state, attacker, events)
  perish(state, side, attacker, lane, events)
}

function overkill(state: GameState, lane: number, unit: Unit, amount: number, events: GameEvent[]): void {
  events.push({ type: 'overkill', lane, amount })
  if (damage(unit, amount, false, events) > 0) return
  state.opponent.back[lane] = null
  events.push({ type: 'killed', uid: unit.uid, side: 'opponent', lane, row: 'back' })
  perish(state, 'opponent', unit, lane, events)
}
