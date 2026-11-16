export type ItemId = 'hammer' | 'pliers' | 'hourglass' | 'hook' | 'bottle' | 'scissors'

export type ItemTarget = 'own' | 'opponent' | 'none'

export const ITEMS: Record<ItemId, { name: string; text: string; target: ItemTarget }> = {
  hammer: { name: 'Hammer', text: 'Destroy one of your own cards.', target: 'own' },
  pliers: {
    name: 'Pliers',
    text: "Pull every sigil off one of P03's cards for the rest of the battle.",
    target: 'opponent',
  },
  hourglass: { name: 'Hourglass', text: 'Ctrl+Z: P03 skips its next turn.', target: 'none' },
  hook: {
    name: 'Hook',
    text: "git cherry-pick: take P03's front card into your empty lane opposite.",
    target: 'opponent',
  },
  bottle: { name: 'Bottled Boilerplate', text: 'npm install: two Boilerplates into your hand.', target: 'none' },
  scissors: { name: 'Scissors', text: "Cut one of P03's cards, front or queued.", target: 'opponent' },
}

export const ITEM_SLOTS = 3

export const FOUND_ITEMS: ItemId[] = ['hammer', 'pliers', 'hourglass', 'hook', 'bottle']
