import {
  CircleHelp,
  Flame,
  Gem,
  Layers,
  type LucideIcon,
  MessageSquareText,
  Skull,
  Store,
  Swords,
  Wrench,
} from 'lucide-react'
import { card, encounter, type MapNode, type NodeKind, type RunCard, type Unit } from 'shared'

export const NODE_ICONS: Record<NodeKind, LucideIcon> = {
  battle: Swords,
  card: Layers,
  campfire: Flame,
  stones: Gem,
  event: MessageSquareText,
  shop: Store,
  item: Wrench,
  boss: Skull,
}

export const nodeIcon = (node: Pick<MapNode, 'kind'> & Partial<Pick<MapNode, 'blind'>>): LucideIcon =>
  node.kind === 'card' && node.blind ? CircleHelp : NODE_ICONS[node.kind]

const NAMES: Record<NodeKind, string> = {
  battle: 'Battle',
  card: 'Card choice',
  campfire: 'Campfire',
  stones: 'Sigil stones',
  event: 'Event',
  shop: 'Package Registry',
  item: 'Tool rack',
  boss: 'Boss',
}

export const boostText = (boost: 'attack' | 'health' | undefined) => (boost === 'attack' ? '+1 attack' : '+2 health')

export function nodeName(
  node: Pick<MapNode, 'kind'> & Partial<Pick<MapNode, 'boost' | 'encounter' | 'blind'>>,
): string {
  if (node.kind === 'card' && node.blind) return `${NAMES.card}, face down`
  if (node.kind === 'campfire' && node.boost) return `${NAMES.campfire}: ${boostText(node.boost)}`
  if (node.kind === 'boss' && node.encounter) {
    const boss = encounter(node.encounter)
    return `${NAMES.boss}: ${boss.name}, ${boss.phases.length} phases`
  }
  return NAMES[node.kind]
}

export function asUnit(entry: RunCard | string, uid = 0): Unit {
  if (typeof entry === 'string') {
    const def = card(entry)
    return { uid, card: entry, attack: def.attack, health: def.health, maxHealth: def.health, sigils: [...def.sigils] }
  }
  return {
    uid: entry.id,
    card: entry.card,
    attack: entry.attack,
    health: entry.health,
    maxHealth: entry.health,
    sigils: entry.sigils,
  }
}
