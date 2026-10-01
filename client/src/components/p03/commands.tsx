import type { ReactNode } from 'react'
import { SIGILS } from 'shared'
import { api } from '../../lib/api.ts'
import { number } from '../../lib/format.ts'
import { DECK } from '../../game/deck.ts'
import { find, HELP, PAGES, STEPS, type Page } from './commandData.ts'
import { CardUpClose, Cost, Dim, Lesson } from './CommandOutput.tsx'

export type Context = {
  user: string | undefined
  history: readonly string[]
  navigate: (to: Page) => void
  clear: () => void
}
export type Commands = typeof import('./commands.tsx')

let step = 0

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
            // The face textures are stored upside down.
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

/** Completes a command or card name when exactly one matches. */
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
