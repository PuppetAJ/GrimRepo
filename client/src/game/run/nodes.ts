import { Flame, Gem, Layers, type LucideIcon, MessageSquareText, Skull, Swords } from 'lucide-react'
import { card, encounter, type MapNode, type NodeKind, type RunCard, type Unit } from 'shared'

// Placeholders until Adrian's pixel icons replace them.
export const NODE_ICONS: Record<NodeKind, LucideIcon> = {
  battle: Swords,
  card: Layers,
  campfire: Flame,
  stones: Gem,
  event: MessageSquareText,
  boss: Skull,
}

const NAMES: Record<NodeKind, string> = {
  battle: 'Battle',
  card: 'Card choice',
  campfire: 'Campfire',
  stones: 'Sigil stones',
  event: 'Event',
  boss: 'Boss',
}

export const boostText = (boost: 'attack' | 'health' | undefined) => (boost === 'attack' ? '+1 attack' : '+2 health')

export function nodeName(node: Pick<MapNode, 'kind' | 'boost' | 'encounter'>): string {
  if (node.kind === 'campfire') return `${NAMES.campfire}: ${boostText(node.boost)}`
  if (node.kind === 'boss' && node.encounter) return `${NAMES.boss}: ${encounter(node.encounter).phases.length} phases`
  return NAMES[node.kind]
}

/** A deck card, or a card on offer, in the shape the card components draw. */
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
