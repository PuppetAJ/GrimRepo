export {
  BOILERPLATE,
  CARDS,
  DEBUG_CARD,
  OPPONENT_POOL,
  PLAYER_DECK,
  SIGILS,
  card,
  type CardDef,
  type SigilId,
  type Tier,
} from './cards.ts'
export { deadLane, nextBotAction, playOut, type Strategy } from './engine/bot.ts'
export { apply, createGame, legalActions, replay, summary, type GameOptions, type Replay } from './engine/game.ts'
export {
  HAND_LIMIT,
  LANES,
  RULES_VERSION,
  TIP,
  TURN_LIMIT,
  type Action,
  type GameEvent,
  type GameState,
  type Result,
  type Side,
  type Slot,
  type Unit,
} from './engine/types.ts'
export { costOf, worthOf } from './engine/units.ts'
export { Rng } from './rng.ts'
export { SCORE_TURN_BASELINE, scoreBattle, type Outcome } from './scoring.ts'
