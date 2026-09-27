import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { Commands } from './commands.tsx'
import { Glass } from './Glass.tsx'
import { pathOf, Prompt } from './Prompt.tsx'

// WebGL and the commands load after the terminal, so it appears at once.
const FaultyScreen = lazy(() => import('./FaultyScreen.tsx'))
const loadCommands = () => import('./commands.tsx')

type Entry =
  | { id: number; kind: 'motd'; path: string; lines: readonly string[] }
  | { id: number; kind: 'input'; who: string; path: string; text: string }
  | { id: number; kind: 'output'; node: ReactNode }
  | { id: number; kind: 'hint' }

const TYPE_MS = 28
const KEEP = 200
let nextId = 0

const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** P03's terminal: it reads out its lines once, then takes commands. */
export default function Terminal({ lines, user }: { lines: readonly string[]; user: string | undefined }) {
  const key = lines.join('\n')
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [entries, setEntries] = useState<Entry[]>([])
  const [typing, setTyping] = useState<{ id: number; count: number; total: number } | null>(null)
  const [text, setText] = useState('')
  // Where the cursor sits in the text, and whether the prompt has focus, for the drawn cursor.
  const [caret, setCaret] = useState(0)
  const [focused, setFocused] = useState(false)
  const mirror = useRef<HTMLParagraphElement>(null)
  const history = useRef<string[]>([])
  const recall = useRef(0)
  const commands = useRef<Commands | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const who = user ?? 'guest'

  const add = (...added: Entry[]) => setEntries((list) => [...list, ...added].slice(-KEEP))

  // The lines arrive as P03 reading out his motd, typed out once, then a hint of what to type.
  useEffect(() => {
    const id = nextId++
    setEntries([
      { id, kind: 'motd', path: pathOf(pathname), lines: key.split('\n') },
      { id: nextId++, kind: 'hint' },
    ])
    if (!still()) setTyping({ id, count: 0, total: key.length })
    // Only new lines are read out again; moving away unmounts the terminal anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const typingId = typing?.id
  useEffect(() => {
    if (typingId === undefined) return
    const timer = window.setInterval(
      () =>
        setTyping((now) =>
          !now || now.id !== typingId || now.count >= now.total ? null : { ...now, count: now.count + 2 },
        ),
      TYPE_MS,
    )
    return () => window.clearInterval(timer)
  }, [typingId])

  // The newest line is always in view.
  useEffect(() => {
    const element = scroller.current
    if (element) element.scrollTop = element.scrollHeight
  }, [entries, typing])

  async function execute(raw: string) {
    const command = raw.trim()
    setTyping(null)
    add({ id: nextId++, kind: 'input', who, path: pathOf(pathname), text: raw })
    if (!command) return
    history.current = [...history.current, command].slice(-50)
    recall.current = history.current.length
    try {
      const loaded = (commands.current ??= await loadCommands())
      const node = await loaded.run(command, {
        user,
        history: history.current,
        navigate: (to) => void navigate(to),
        clear: () => setEntries([]),
      })
      if (node !== null) add({ id: nextId++, kind: 'output', node })
    } catch (error) {
      add({ id: nextId++, kind: 'output', node: `p03: that went wrong (${(error as Error).message})` })
    }
  }

  // Text set from here leaves the cursor at its end, as the browser does.
  function type(next: string) {
    setText(next)
    setCaret(next.length)
  }

  // The drawn text follows the input as it scrolls sideways under a long command.
  function follow(field: HTMLInputElement) {
    setCaret(field.selectionStart ?? field.value.length)
    if (mirror.current) mirror.current.scrollLeft = field.scrollLeft
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void execute(text)
    type('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const past = history.current
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      recall.current = Math.max(0, Math.min(past.length, recall.current + (event.key === 'ArrowUp' ? -1 : 1)))
      type(past[recall.current] ?? '')
    } else if (
      event.key === 'Home' ||
      event.key === 'End' ||
      (event.ctrlKey && (event.key === 'a' || event.key === 'e'))
    ) {
      // To the start or the end, as a shell does; a Mac text field otherwise ignores Home and End.
      event.preventDefault()
      const to = event.key === 'Home' || event.key === 'a' ? 0 : text.length
      event.currentTarget.setSelectionRange(to, to)
      follow(event.currentTarget)
    } else if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault()
      setEntries([])
    } else if (event.key === 'Tab' && text.trim()) {
      // Completes a command or a card's name; with nothing to complete, Tab moves on as usual.
      const completed = commands.current?.complete(text)
      if (completed && completed !== text) {
        event.preventDefault()
        type(completed)
      }
    }
  }

  return (
    <section
      aria-label="P03's terminal"
      className="relative flex h-full flex-col overflow-hidden bg-p03-ground font-terminal text-[#b8f5c4] [text-shadow:0_0_8px_rgb(125_255_154/0.35)]"
    >
      <Suspense fallback={null}>
        <FaultyScreen />
      </Suspense>
      <Glass />
      <div className="relative z-10 border-b border-[#2f6b3d]/70 bg-p03-ground/80 px-4 py-1 text-lg text-p03-dim sm:px-6">
        p03@factory: ~/grim-repo
      </div>
      <div
        ref={scroller}
        // A click on the screen puts the cursor back in the prompt, unless it was choosing text or pressing something.
        onClick={(event) => {
          const target = event.target as HTMLElement
          if (!window.getSelection()?.toString() && !target.closest('button, a, input')) input.current?.focus()
        }}
        className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 py-2 text-xl leading-snug sm:px-6"
      >
        <div role="log" aria-label="P03's terminal output" className="flex flex-col gap-1">
          {entries.map((entry) => (
            <Line key={entry.id} entry={entry} typed={typing?.id === entry.id ? typing.count : null} run={execute} />
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex items-baseline gap-2">
          <label htmlFor="p03-command" className="shrink-0">
            <Prompt who={who} path={pathOf(pathname)} />
            <span className="sr-only">Command for P03</span>
          </label>
          {/* The input takes the typing, invisibly; the text and a thick block cursor are drawn over it. */}
          <div className="relative min-w-0 flex-1">
            <p ref={mirror} aria-hidden className="overflow-hidden whitespace-pre text-[#e6ffe9]">
              <span className="relative">
                {text || ' '}
                {focused ? (
                  <span
                    // Typing restarts the blink, so the cursor stays lit while keys are going.
                    key={`${text}:${caret}`}
                    className="absolute top-[0.21em] h-[0.64em] w-[0.55ch] animate-[blink_1.06s_steps(1)_infinite] bg-p03 motion-reduce:animate-none"
                    style={{ left: `${caret}ch` }}
                  />
                ) : null}
              </span>
            </p>
            <input
              id="p03-command"
              ref={input}
              value={text}
              onChange={(event) => {
                setText(event.target.value)
                follow(event.target)
              }}
              // Select alone misses some moves, such as Home and End, so key-ups and clicks are followed too.
              onSelect={(event) => follow(event.currentTarget)}
              onKeyUp={(event) => follow(event.currentTarget)}
              onMouseUp={(event) => follow(event.currentTarget)}
              onKeyDown={onKeyDown}
              onFocus={() => {
                setFocused(true)
                // The commands start loading as soon as someone means to type.
                void loadCommands().then((loaded) => (commands.current = loaded))
              }}
              onBlur={() => setFocused(false)}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              className="absolute inset-0 w-full bg-transparent text-transparent caret-transparent outline-none selection:bg-p03/30"
            />
          </div>
        </form>
      </div>
    </section>
  )
}

function Line({ entry, typed, run }: { entry: Entry; typed: number | null; run: (command: string) => void }) {
  if (entry.kind === 'input')
    return (
      <p>
        <Prompt who={entry.who} path={entry.path} /> <span className="text-[#e6ffe9]">{entry.text}</span>
      </p>
    )
  if (entry.kind === 'output') return <div className="pb-1">{entry.node}</div>
  if (entry.kind === 'hint')
    return (
      <p className="flex flex-wrap items-baseline gap-x-2 pb-1 text-p03-dim">
        <span>// type help, or try</span>
        {['tutorial', 'cards', 'top'].map((command) => (
          <button
            key={command}
            type="button"
            onClick={() => run(command)}
            className="border border-[#2f6b3d] px-2 leading-tight text-p03 hover:border-p03 focus-visible:outline-2 focus-visible:outline-p03"
          >
            {command}
          </button>
        ))}
      </p>
    )
  // Each line shows as much as has been typed so far: what was typed, less the lines before it.
  const before = entry.lines.map((_, index) =>
    entry.lines.slice(0, index).reduce((sum, line) => sum + line.length + 1, 0),
  )
  return (
    <div className="pb-1">
      <p>
        <Prompt who="p03" path={entry.path} /> <span className="text-[#e6ffe9]">cat motd</span>
      </p>
      {entry.lines.map((line, index) => {
        const shown = typed === null ? line : line.slice(0, Math.max(0, typed - (before[index] ?? 0)))
        return (
          <p key={index} className="text-p03">
            <span className="sr-only">{line}</span>
            <span aria-hidden>{shown}</span>
          </p>
        )
      })}
    </div>
  )
}
