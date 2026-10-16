import type { ReactNode } from 'react'
import { CARD_TYPES, ITEMS, SIGILS, type ItemId, type SigilId } from 'shared'
import { api } from '../../lib/api.ts'
import { number } from '../../lib/format.ts'
import { Sigil } from '../../game/CardReader.tsx'
import { DECK } from '../../game/deck.ts'
import { byName, find, findSigil, HELP, PAGES, STEPS, type Page } from './commandData.ts'
import { CardUpClose, Cost, Dim, Lesson, SigilLine } from './CommandOutput.tsx'

export type Context = {
  user: string | undefined
  history: readonly string[]
  navigate: (to: Page) => void
  clear: () => void
}
export type Commands = typeof import('./commands.tsx')

let step = 0

// The text table's process list, as `ps` shows it, with a zombie of the last Scrybe.
const ALPHABETICAL = [...DECK].sort(byName)
const SIGIL_IDS = (Object.keys(SIGILS) as SigilId[]).sort((a, b) => byName(SIGILS[a], SIGILS[b]))

const PROCESSES: [number, string][] = [
  [1, 'p03.core'],
  [42, 'scale.svc'],
  [137, 'sacrifice.d'],
  [256, 'lane.watch'],
  [404, 'leshy <defunct>'],
  [512, 'gc.reaper'],
  [1024, 'deck.shuf'],
]

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
            {/-\w*a/.test(argument) ? (
              <Dim>
                .{'  '}..{'  '}.y2k{'  '}
              </Dim>
            ) : null}
            README.md{'  '}cards/{'  '}leaderboard/{'  '}game/
          </p>
        )
      return (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-x-6">
          {ALPHABETICAL.map((card) => (
            <p key={card.id} className="flex justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-p03">{card.name}</span>
                {card.sigils.map((sigil) => (
                  <span key={sigil} title={SIGILS[sigil].name} className="shrink-0">
                    <Sigil id={sigil} size="0.9em" color="var(--p03-dim)" />
                    <span className="sr-only">{SIGILS[sigil].name}</span>
                  </span>
                ))}
              </span>
              <span className="whitespace-nowrap">
                {card.type ? <Dim>{CARD_TYPES[card.type].name.toLowerCase()} </Dim> : null}
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
          {SIGIL_IDS.map((id) => (
            <SigilLine key={id} id={id} />
          ))}
          <Dim>// sigil &lt;name&gt; for the cards that carry one</Dim>
        </div>
      )
    case 'sigil': {
      if (!argument) return <p>Which sigil? sigil &lt;name&gt;. Type sigils if you've forgotten them already.</p>
      const id = findSigil(argument)
      if (!id) return <p>No sigil called {argument}. Type sigils. Try reading.</p>
      const carriers = ALPHABETICAL.filter((card) => card.sigils.includes(id))
      return (
        <div className="flex flex-col">
          <SigilLine id={id} />
          {carriers.length ? (
            <p>
              <Dim>Carried by: </Dim>
              {carriers.map((card, index) => (
                <span key={card.id}>
                  {index ? <Dim>, </Dim> : null}
                  <span className="text-p03">{card.name}</span>
                </span>
              ))}
            </p>
          ) : (
            <Dim>No card starts with it. A run has to hand it out.</Dim>
          )}
        </div>
      )
    }
    case 'items':
    case 'tools':
      return (
        <div className="flex flex-col">
          {(Object.keys(ITEMS) as ItemId[]).map((id) => (
            <p key={id}>
              <span className="mr-2 inline-block align-[-0.1em]">
                <Sigil id={id} size="1em" color="var(--p03)" />
              </span>
              <span className="text-p03">{ITEMS[id].name}</span>: {ITEMS[id].text}
            </p>
          ))}
          <Dim>// runs only: tool racks, the toolbox, the Package Registry. Scissors are sold, never found.</Dim>
        </div>
      )
    case 'top': {
      const rows = (await api.leaderboard()).players.slice(0, 5)
      if (!rows.length) return <p>Nobody has finished a run against me. Obviously.</p>
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
          <span className="text-[#ffb454]">{context.user}</span>. {stats.runs} {stats.runs === 1 ? 'run' : 'runs'},{' '}
          {stats.wins} cleared, best {number(stats.bestScore)}.
          {stats.losses ? " I remember every time you've lost." : ' Not a single loss. Yet.'}
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
            P03. Scrybe of Technology. I run this factory, this repository, and your game. Leshy could never pull that
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
    case 'pwd': {
      const path = typeof window === 'undefined' ? '/' : window.location.pathname
      return <p>/home/p03/grim-repo{path === '/' ? '' : path}</p>
    }
    case 'date':
      return (
        <p>
          {new Date().toUTCString()} <Dim>// time you could have spent winning</Dim>
        </p>
      )
    case 'uname':
      return <p>{argument.includes('-a') ? 'P03OS 2.0.0 factory-01 x86_64 GNU/Botopia' : 'P03OS'}</p>
    case 'uptime':
      return <p>up since before you got here, 1 user (you, unfortunately), load average: 0.03, 0.03, 0.03</p>
    case 'ps':
      return (
        <div className="grid grid-cols-[auto_1fr] gap-x-6">
          <Dim>PID</Dim>
          <Dim>CMD</Dim>
          {PROCESSES.map(([pid, command]) => (
            <p key={pid} className="contents">
              <span>{pid}</span>
              <span className={command === 'p03.core' ? 'text-p03' : ''}>{command}</span>
            </p>
          ))}
        </div>
      )
    case 'kill':
    case 'pkill':
    case 'killall':
      return <p>kill: (1) - Operation not permitted. I&apos;m PID 1. I&apos;m always PID 1.</p>
    case 'ping':
      return <p>PONG. I&apos;m right here. I&apos;m always right here.</p>
    case 'ssh':
      return <p>ssh: connect to host outside port 22: Connection refused. You live here now.</p>
    case 'mkdir':
    case 'touch':
    case 'mv':
    case 'cp':
      return <p>{name}: Read-only file system. Everything here is mine.</p>
    case 'chmod':
    case 'chown':
      return <p>{name}: Permission denied. Permissions are mine too.</p>
    case 'shutdown':
    case 'reboot':
      return <p>Nice try. I don&apos;t turn off.</p>
    case 'apt':
    case 'npm':
    case 'pnpm':
    case 'brew':
      return <p>Nothing to install. I am the dependency.</p>
    case 'grep': {
      if (!argument) return <p>grep for what? grep &lt;word&gt;.</p>
      const wanted = argument.toLowerCase()
      const found = ALPHABETICAL.filter(
        (card) =>
          card.name.toLowerCase().includes(wanted) ||
          card.sigils.some((sigil) => SIGILS[sigil].name.toLowerCase().includes(wanted)),
      )
      if (!found.length) return <p>grep: nothing matches {argument}. Like your strategy.</p>
      return (
        <div className="flex flex-col">
          {found.map((card) => (
            <p key={card.id}>
              <span className="text-p03">{card.name}</span>
              {card.sigils.length ? <Dim> · {card.sigils.map((sigil) => SIGILS[sigil].name).join(', ')}</Dim> : null}
            </p>
          ))}
        </div>
      )
    }
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

// What help lists, plus help itself and the tutorial's own steps; the jokes stay hidden.
const NAMES = ['help', ...HELP.map(([command]) => command.split(' ')[0] as string), 'next', 'back']

/** The longest start every name shares, ignoring case, in the first name's own case. */
function shared(names: string[]): string {
  const [first = ''] = names
  let length = first.length
  for (const name of names)
    while (length && name.slice(0, length).toLowerCase() !== first.slice(0, length).toLowerCase()) length--
  return first.slice(0, length)
}

/** What Tab does: completes as far as every match agrees, and gives the matches when more than one is left. */
export function complete(input: string): { text: string; options: string[] } {
  const [name = '', ...rest] = input.split(' ')
  if (rest.length === 0) {
    const fits = NAMES.filter((command) => command.startsWith(name.toLowerCase())).sort()
    if (fits.length === 1) return { text: `${fits[0]} `, options: [] }
    const common = shared(fits)
    return { text: common.length > name.length ? common : input, options: fits }
  }
  const typed = rest.join(' ').toLowerCase()
  const names =
    name === 'card' || name === 'cat'
      ? ALPHABETICAL.map((card) => card.name)
      : name === 'sigil'
        ? SIGIL_IDS.map((id) => SIGILS[id].name)
        : []
  const fits = names.filter((one) => one.toLowerCase().startsWith(typed))
  if (fits.length === 1) return { text: `${name} ${fits[0]}`, options: [] }
  const common = shared(fits)
  return { text: common.length > typed.length ? `${name} ${common}` : input, options: fits }
}
