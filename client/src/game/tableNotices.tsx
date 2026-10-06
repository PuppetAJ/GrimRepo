import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button.tsx'

/** Shown when a model fails to load or the WebGL context is lost. */
export function TableFailed({ onText }: { onText: () => void }) {
  return (
    <div role="alert" className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-terminal text-2xl text-p03">The 3D table could not be set.</p>
      <p className="text-sm text-muted-foreground">The game is saved; the text table plays the same one.</p>
      <Button onClick={onText}>Play the text version</Button>
    </div>
  )
}

export function TurnSideways({ onText }: { onText: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
      <RotateCw className="size-10 text-p03" aria-hidden />
      <p className="font-terminal text-2xl text-p03">The 3D table needs your phone on its side.</p>
      <p className="text-sm text-muted-foreground">Or play the same game as text, held upright.</p>
      <Button onClick={onText}>Play the text version</Button>
    </div>
  )
}
