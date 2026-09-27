import { Maximize2, Minimize2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { Commands } from './commands.tsx'
import { Glass } from './Glass.tsx'
import { pathOf, Prompt } from './Prompt.tsx'
import { useP03Lines } from './says.ts'

// WebGL and the commands load after the page, so the first load stays light.
const FaultyScreen = lazy(() => import('./FaultyScreen.tsx'))
const loadCommands = () => import('./commands.tsx')

type Entry =
  | { id: number; kind: 'motd'; path: string; lines: readonly string[] }
  | { id: number; kind: 'input'; who: string; path: string; text: string }
  | { id: number; kind: 'output'; node: ReactNode }
  | { id: number; kind: 'hint' }

const OPEN_KEY = 'grimrepo:console'
const TYPE_MS = 28
const KEEP = 200
let nextId = 0

function startsOpen(): boolean {
  try {
    const saved = localStorage.getItem(OPEN_KEY)
    if (saved) return saved === 'open'
  } catch {
    // Storage refused in a private window; fall back to the screen size.
  }
  // Open on a laptop, tucked away on a phone, where it would take a fifth of the screen.
  return window.matchMedia('(min-width: 640px)').matches
}

const still = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** P03's terminal docked under the page: it greets each page, takes commands, and folds down to a button. */
export function Console({ user, onHeight }: { user: string | undefined; onHeight: (height: number) => void }) {
  const said = useP03Lines()
  const key = said.lines.join('\n')
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(startsOpen)
  const [tall, setTall] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [unread, setUnread] = useState(0)
  const [typing, setTyping] = useState<{ id: number; count: number; total: number } | null>(null)
  const [text, setText] = useState('')
  const history = useRef<string[]>([])
  const recall = useRef(0)
  const commands = useRef<Commands | null>(null)
  const greeted = useRef(false)
  const lastGreeting = useRef('')
  const opened = useRef(open)
  const box = useRef<HTMLElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const who = user ?? 'guest'

  const add = (...added: Entry[]) => setEntries((list) => [...list, ...added].slice(-KEEP))

  // Each page's lines arrive as P03 reading out its motd; typed out if the console is open to see it.
  useEffect(() => {
    // The same page saying the same again (a page setting its lines twice) is not a new greeting.
    if (!key || lastGreeting.current === `${said.path}\n${key}`) return
    lastGreeting.current = `${said.path}\n${key}`
    const id = nextId++
    const lines = key.split('\n')
    const hint: Entry[] = greeted.current ? [] : [{ id: nextId++, kind: 'hint' }]
    greeted.current = true
    setEntries((list) => [...list, { id, kind: 'motd' as const, path: pathOf(said.path), lines }, ...hint].slice(-KEEP))
    if (!opened.current) setUnread((count) => count + lines.length)
    else if (!still()) setTyping({ id, count: 0, total: key.length })
  }, [key, said.path])

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
  }, [entries, typing, open, tall])

  const silent = said.lines.length === 0 && entries.length === 0
  useEffect(() => {
    const element = box.current
    if (!element) return onHeight(0)
    const observer = new ResizeObserver(() => onHeight(element.offsetHeight))
    observer.observe(element)
    return () => {
      observer.disconnect()
      onHeight(0)
    }
  }, [onHeight, open, silent])

  const toggle = (next: boolean) => {
    setOpen(next)
    opened.current = next
    if (next) setUnread(0)
    try {
      localStorage.setItem(OPEN_KEY, next ? 'open' : 'closed')
    } catch {
      // Remembered until the page closes.
    }
  }

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
        fold: () => toggle(false),
        tall: setTall,
      })
      if (node !== null) add({ id: nextId++, kind: 'output', node })
    } catch (error) {
      add({ id: nextId++, kind: 'output', node: `p03: that went wrong (${(error as Error).message})` })
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void execute(text)
    setText('')
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const past = history.current
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      recall.current = Math.max(0, Math.min(past.length, recall.current + (event.key === 'ArrowUp' ? -1 : 1)))
      setText(past[recall.current] ?? '')
    } else if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault()
      setEntries([])
    } else if (event.key === 'Tab' && text.trim()) {
      // Completes a command or a card's name; with nothing to complete, Tab moves on as usual.
      const completed = commands.current?.complete(text)
      if (completed && completed !== text) {
        event.preventDefault()
        setText(completed)
      }
    }
  }

  if (silent) return null

  if (!open)
    return (
      <aside ref={box} aria-label="P03's console" className="fixed right-4 bottom-4 z-30 sm:right-8 sm:bottom-6">
        <button
          type="button"
          aria-expanded={false}
          onClick={() => toggle(true)}
          className="p03-screen relative overflow-hidden border border-[#2f6b3d] px-4 py-2 font-terminal text-xl text-p03 hover:border-p03 focus-visible:outline-2 focus-visible:outline-p03"
        >
          P03 &gt; {unread ? `${unread} new ${unread === 1 ? 'message' : 'messages'}` : 'console'}
          <Glass />
        </button>
      </aside>
    )

  return (
    <aside
      ref={box}
      aria-label="P03's console"
      className="fixed inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden border-t border-[#2f6b3d] bg-p03-ground font-terminal text-[#b8f5c4] [text-shadow:0_0_8px_rgb(125_255_154/0.35)]"
    >
      <Suspense fallback={null}>
        <FaultyScreen />
      </Suspense>
      <Glass />
      <div className="relative z-10 flex items-center justify-between gap-3 border-b border-[#2f6b3d]/70 bg-p03-ground/80 px-4 py-1 sm:px-12">
        <span className="truncate text-lg text-p03-dim">p03@factory: ~/grim-repo</span>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={tall ? 'Make the console smaller' : 'Make the console taller'}
            onClick={() => setTall(!tall)}
            className="flex size-7 items-center justify-center border border-[#2f6b3d] text-p03 hover:border-p03 focus-visible:outline-2 focus-visible:outline-p03"
          >
            {tall ? <Minimize2 className="size-3.5" aria-hidden /> : <Maximize2 className="size-3.5" aria-hidden />}
          </button>
          <button
            type="button"
            aria-expanded
            aria-label="Fold P03's console away"
            onClick={() => toggle(false)}
            className="flex size-7 items-center justify-center border border-[#2f6b3d] leading-none text-p03 hover:border-p03 focus-visible:outline-2 focus-visible:outline-p03"
          >
            _
          </button>
        </div>
      </div>
      <div
        ref={scroller}
        // A click on the screen puts the cursor back in the prompt, unless it was choosing text or pressing something.
        onClick={(event) => {
          const target = event.target as HTMLElement
          if (!window.getSelection()?.toString() && !target.closest('button, a, input')) input.current?.focus()
        }}
        className={`relative z-10 overflow-y-auto overscroll-contain px-4 py-2 text-xl leading-snug sm:px-12 sm:text-2xl ${tall ? 'h-[70dvh]' : 'max-h-[min(19rem,38dvh)]'}`}
      >
        <div role="log" aria-label="P03's console output" className="flex flex-col gap-1">
          {entries.map((entry) => (
            <Line key={entry.id} entry={entry} typed={typing?.id === entry.id ? typing.count : null} run={execute} />
          ))}
        </div>
        <form
          onSubmit={onSubmit}
          className="flex items-baseline gap-2 border-b border-transparent focus-within:border-[#2f6b3d]"
        >
          <label htmlFor="p03-command" className="shrink-0">
            <Prompt who={who} path={pathOf(pathname)} />
            <span className="sr-only">Command for P03</span>
          </label>
          <input
            id="p03-command"
            ref={input}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            // The commands start loading as soon as someone means to type.
            onFocus={() => void loadCommands().then((loaded) => (commands.current = loaded))}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            className="min-w-0 flex-1 bg-transparent text-[#e6ffe9] caret-p03 outline-none"
          />
        </form>
      </div>
    </aside>
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
