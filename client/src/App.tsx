import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button.tsx'

type Status = 'checking' | 'up' | 'down'

export default function App() {
  const [api, setApi] = useState<Status>('checking')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/health', { signal: controller.signal })
      .then((response) => setApi(response.ok ? 'up' : 'down'))
      .catch(() => {
        if (!controller.signal.aborted) setApi('down')
      })
    return () => controller.abort()
  }, [])

  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-5xl font-semibold tracking-tight">Grim Repo</h1>
      <p className="max-w-md text-muted-foreground">
        A card game of sacrifices, played by candlelight against a robot. Being rebuilt.
      </p>
      <Button disabled>Play</Button>
      <p className="text-sm text-muted-foreground" role="status">
        API {api === 'checking' ? 'checking…' : api}
      </p>
    </main>
  )
}
