import type { ReactNode } from 'react'
import { CARDS, TIP, type CardDef } from 'shared'

export type Page = '/' | '/leaderboard' | '/cards' | '/game' | '/account' | '/stats'

export const PAGES: Record<string, Page> = {
  '~': '/',
  '/': '/',
  '..': '/',
  readme: '/',
  leaderboard: '/leaderboard',
  cards: '/cards',
  game: '/game',
  play: '/game',
  account: '/account',
  stats: '/stats',
}

export const HELP: [string, string][] = [
  ['tutorial', 'A walkthrough of the rules, since you clearly need them'],
  ['cards', 'Every card in your deck. Weak, all of them'],
  ['card <name>', 'One card up close'],
  ['sigils', 'What the sigils do'],
  ['rules', 'All of the rules in one command'],
  ['top', 'The five who got lucky'],
  ['whoami', 'Who you are. Nobody, probably'],
  ['p03', 'Me. Obviously'],
  ['play', 'Sit down. Finally'],
  ['grep <word>', 'Cards by name or sigil'],
  ['ps', 'What runs here. Me, mostly'],
  ['cd <page>', 'Readme, leaderboard, cards, game, account'],
  ['history', 'Everything you typed. I kept it'],
  ['clear', 'Wipe the screen. Not my memory'],
]

export const find = (name: string): CardDef | undefined => {
  const wanted = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return Object.values(CARDS).find(
    (card) => card.id.toLowerCase() === wanted || card.name.toLowerCase().replace(/[^a-z0-9]/g, '') === wanted,
  )
}

export type Step = { title: string; body: ReactNode; art?: string }
export const STEPS: Step[] = [
  {
    title: 'The goal',
    body: `Listen up, I'm only explaining this once. There's a scale between us. Your damage tips it your way, mine tips it mine. First to tip it to ${TIP} wins. Win fast and it scores more, but I won't let you win quickly.`,
  },
  {
    title: 'Draw',
    body: "Every turn starts with one draw. Your deck, or a Boilerplate from the pile that never runs out. Filler, but you'll need it. If your hand is full with 7 cards, you can't draw anymore.",
  },
  {
    title: 'Free cards',
    art: 'HelloWorld',
    body: "You can play a card with no cost whenever you want into one of the four lanes. I'll be playing across from you.",
  },
  {
    title: 'Sacrifices',
    art: 'DestroyEnemyYou',
    body: "A card with a cost needs sacrifices. Pick it, then mark your cards on the table until they cover the cost. Each card is worth its own cost. Cards with no cost are still worth 1. They die when the new card lands, and it can take a lane they emptied. Leshy invented this. It's the one good idea he ever had.",
  },
  {
    title: 'EXECUTE',
    body: "Press EXECUTE, or E, to end your turn. Your cards attack left to right. Each hits the card across from it, or me if the lane's open. Don't get used to that.",
  },
  {
    title: 'My queue',
    art: 'Firewall',
    body: "My cards queue in my back row and step up when the lane in front clears. Overkill carries into the card behind. It never reaches the scale. I designed it that way. You're welcome.",
  },
  {
    title: 'Sigils',
    art: 'FourOhFour',
    body: "Some cards carry sigils. FourOhFour deletes the opposing side every time it's played. Cheap, I'd never use something like that. Type sigils for a list of the rest of them.",
  },
  {
    title: 'Reading the table',
    body: "Hold left click on a card or monitor to read it up close. Click a monitor to pin it. That's everything. Type play. We've got Transcending to do.",
  },
]
