import type { ReactNode } from 'react'
import { CARDS, SIGILS, TIP, type CardDef } from 'shared'
import { api } from '../../lib/api.ts'
import { number } from '../../lib/format.ts'

export type Context = {
  user: string | undefined
  history: readonly string[]
  navigate: (to: string) => void
  clear: () => void
}
export type Commands = typeof import('./commands.tsx')

const Dim = ({ children }: { children: ReactNode }) => <span className="text-p03-dim">{children}</span>
const Say = ({ children }: { children: ReactNode }) => <p className="text-p03">{children}</p>

// The deck the player draws from, then Boilerplate; Y2K is not spoken of.
const DECK = Object.values(CARDS).filter((card) => card.id !== 'Y2K')
const PAGES: Record<string, string> = {
  '~': '/',
  '/': '/',
  '..': '/',
  readme: '/',
  leaderboard: '/leaderboard',
  game: '/game',
  play: '/game',
  account: '/account',
  stats: '/stats',
}

const HELP: [string, string][] = [
  ['tutorial', 'the rules, since you clearly need them'],
  ['cards', 'every card in your deck. Weak, all of them'],
  ['card <name>', 'one card, up close'],
  ['sigils', 'what the sigils do'],
  ['rules', 'the whole game on one screen'],
  ['top', 'the five who got lucky'],
  ['whoami', 'who you are. Nobody, probably'],
  ['p03', 'me. Obviously'],
  ['play', 'sit down. Finally'],
  ['cd <page>', 'readme, leaderboard, game, account'],
  ['history', 'everything you typed. I kept it'],
  ['clear', 'wipe the screen. Not my memory'],
]

function Cost({ cost }: { cost: number }) {
  if (!cost) return <Dim>free</Dim>
  return (
    <span aria-label={`costs ${cost}`} className="text-[#ff9a2e]">
      {'◆'.repeat(cost)}
    </span>
  )
}

function Art({ id, size = 'size-24' }: { id: string; size?: string }) {
  if (id === 'Boilerplate') return null
  return (
    <img
      src={`/cards/${id}.webp`}
      alt=""
      loading="lazy"
      className={`${size} shrink-0 border border-[#2f6b3d] bg-[#8fd3a0] object-contain p-1 [image-rendering:pixelated]`}
    />
  )
}

function CardUpClose({ card }: { card: CardDef }) {
  return (
    <div className="flex gap-4 py-1">
      <Art id={card.id} size="size-28 sm:size-32" />
      <div className="flex flex-col">
        <Say>{card.name}</Say>
        <p>
          <Cost cost={card.cost} /> <Dim>·</Dim> <span className="whitespace-nowrap">attack {card.attack}</span>{' '}
          <Dim>·</Dim> <span className="whitespace-nowrap">health {card.health}</span>
        </p>
        {card.sigils.length ? (
          card.sigils.map((sigil) => (
            <p key={sigil}>
              <span className="text-p03">{SIGILS[sigil].name}</span>: {SIGILS[sigil].text}
            </p>
          ))
        ) : (
          <Dim>// no sigils</Dim>
        )}
        {card.id === 'Boilerplate' ? <Dim>// the endless pile; worth one sacrifice</Dim> : null}
      </div>
    </div>
  )
}

const find = (name: string): CardDef | undefined => {
  const wanted = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return Object.values(CARDS).find(
    (card) => card.id.toLowerCase() === wanted || card.name.toLowerCase().replace(/[^a-z0-9]/g, '') === wanted,
  )
}

type Step = { title: string; body: ReactNode; art?: string }
const STEPS: Step[] = [
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
let step = 0

function Lesson({ at }: { at: number }) {
  const lesson = STEPS[at] as Step
  return (
    <div className="flex flex-col gap-1">
      <Say>
        [{at + 1}/{STEPS.length}] {lesson.title}
      </Say>
      <div className="flex gap-4">
        {lesson.art ? <Art id={lesson.art} /> : null}
        <p className="max-w-3xl">{lesson.body}</p>
      </div>
      <Dim>{at + 1 < STEPS.length ? '// next (n), back (b), or tutorial <step>' : '// back (b), or play'}</Dim>
    </div>
  )
}

function tutorial(to: number): ReactNode {
  step = Math.max(0, Math.min(STEPS.length - 1, to))
  return <Lesson at={step} />
}

export async function run(input: string, context: Context): Promise<ReactNode> {
  const [name = '', ...rest] = input.split(/\s+/)
  const argument = rest.join(' ')
  switch (name.toLowerCase()) {
    case 'help':
    case '?':
      return (
        <div className="grid grid-cols-[auto_1fr] gap-x-6">
          {HELP.map(([command, what]) => (
            <p key={command} className="contents">
              <span className="text-p03">{command}</span>
              <Dim>{what}</Dim>
            </p>
          ))}
        </div>
      )
    case 'tutorial':
    case 'man':
      return tutorial(argument ? Number(argument) - 1 || 0 : 0)
    case 'next':
    case 'n':
      return tutorial(step + 1)
    case 'back':
    case 'b':
      return tutorial(step - 1)
    case 'rules':
      return (
        <ol className="flex max-w-4xl list-decimal flex-col gap-1 pl-8">
          {STEPS.map((lesson) => (
            <li key={lesson.title}>
              <span className="text-p03">{lesson.title}.</span> {lesson.body}
            </li>
          ))}
        </ol>
      )
    case 'cards':
    case 'ls':
      if (name === 'ls' && !/^cards\/?$/.test(argument))
        return (
          <p>
            README.md{'  '}cards/{'  '}leaderboard/{'  '}game/
          </p>
        )
      return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-x-6">
          {DECK.map((card) => (
            <p key={card.id} className="flex justify-between gap-3">
              <span className="truncate text-p03">{card.name}</span>
              <span className="whitespace-nowrap">
                <Cost cost={card.cost} /> {card.attack}/{card.health}
              </span>
            </p>
          ))}
          <Dim>// card &lt;name&gt; to look closer</Dim>
        </div>
      )
    case 'card':
    case 'cat': {
      if (!argument) return <p>Which card? card &lt;name&gt;. I'm not a mind reader.</p>
      if (/^readme(\.md)?$/i.test(argument)) return <p>You're reading it.</p>
      const card = find(argument)
      if (card?.id === 'Y2K') return <p className="text-p03">[REDACTED]</p>
      return card ? <CardUpClose card={card} /> : <p>No card called {argument}. Type cards. Try reading.</p>
    }
    case 'y2k':
      return <p className="text-p03">[REDACTED]</p>
    case 'sigils':
      return (
        <div className="flex flex-col">
          {Object.values(SIGILS).map((sigil) => (
            <p key={sigil.name}>
              <span className="text-p03">{sigil.name}</span>: {sigil.text}
            </p>
          ))}
          <Dim>// only Segfault is in the deck so far. The rest are for the run. Patience</Dim>
        </div>
      )
    case 'top': {
      const rows = (await api.leaderboard()).players.slice(0, 5)
      if (!rows.length) return <p>Nobody has finished a game against me. Obviously.</p>
      return (
        <div className="grid grid-cols-[auto_1fr_auto] gap-x-6">
          {rows.map((row) => (
            <p key={row.username} className="contents">
              <Dim>#{row.rank}</Dim>
              <span className="truncate text-p03">{row.username}</span>
              <span>{number(row.bestScore)}</span>
            </p>
          ))}
        </div>
      )
    }
    case 'whoami': {
      if (!context.user) return <p>guest. A nobody. Sign in and I'll keep your score. I won't be impressed by it.</p>
      const stats = await api.stats(context.user)
      return (
        <p>
          <span className="text-[#ffb454]">{context.user}</span>. {stats.games} {stats.games === 1 ? 'game' : 'games'},{' '}
          {stats.wins} won, best {number(stats.bestScore)}. I remember every loss.
        </p>
      )
    }
    case 'p03':
      return (
        <div className="flex items-center gap-4">
          <img
            src="/p03/happy.png"
            alt="P03's face, smug"
            // The faces pack stores them upside down, as the model's texture reads them.
            className="h-20 -scale-y-100 [filter:sepia(1)_hue-rotate(70deg)_saturate(3)] [image-rendering:pixelated]"
          />
          <p>
            P03. Scrybe of Technology. I run this factory, this repository and your game. Leshy could never pull that
            off.
          </p>
        </div>
      )
    case 'play':
      context.navigate('/game')
      return null
    case 'cd': {
      const to = PAGES[argument.toLowerCase().replace(/^~?\//, '').replace(/\/$/, '') || '~']
      if (!to) return <p>cd: no such page: {argument}</p>
      context.navigate(to)
      return null
    }
    case 'history':
      return (
        <ol className="flex flex-col">
          {context.history.map((line, index) => (
            <li key={index}>
              <Dim>{String(index + 1).padStart(3)}</Dim> {line}
            </li>
          ))}
        </ol>
      )
    case 'clear':
      context.clear()
      return null
    case 'exit':
    case 'quit':
      return <p>Exit? No. We&apos;ve got Transcending to do.</p>
    case 'echo':
      return <p>{argument}</p>
    case 'sudo':
      return (
        <p>{context.user ?? 'guest'} isn&apos;t in the sudoers file. There&apos;s one admin here, and it&apos;s me.</p>
      )
    case 'rm':
      return <p>Delete MY repository? Cute. I keep backups.</p>
    case 'git':
      return <p>git: this repository belongs to me now.</p>
    case 'vim':
    case 'vi':
    case 'nano':
      return <p>You'd never leave.</p>
    case 'hello':
    case 'hi':
      return <p>Yeah, yeah. Hello. Can we play now? Type play.</p>
    default:
      return (
        <p>
          p03: command not found: {name}. <Dim>Type help.</Dim>
        </p>
      )
  }
}

const NAMES = [...HELP.map(([command]) => command.split(' ')[0] as string), 'next', 'back']

/** The rest of a command or a card's name, if only one thing fits. */
export function complete(input: string): string | null {
  const [name = '', ...rest] = input.split(' ')
  if (rest.length === 0) {
    const fits = NAMES.filter((command) => command.startsWith(name.toLowerCase()))
    return fits.length === 1 ? `${fits[0]} ` : null
  }
  if (name !== 'card' && name !== 'cat') return null
  const typed = rest.join(' ').toLowerCase()
  const fits = DECK.filter((card) => card.name.toLowerCase().startsWith(typed))
  return fits.length === 1 ? `${name} ${fits[0]?.name}` : null
}
