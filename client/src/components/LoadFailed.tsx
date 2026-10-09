import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button.tsx'
import { Failure } from './States.tsx'

type Fallback = ReactNode | ((error: unknown) => ReactNode)

/** Catches a part of the page that fails to load or draw, most often code gone after a deploy; a function fallback is given the error. */
export class LoadFailed extends Component<
  { fallback: Fallback; children: ReactNode },
  { error: unknown; failed: boolean }
> {
  state = { error: null as unknown, failed: false }
  static getDerivedStateFromError(error: unknown) {
    return { error, failed: true }
  }
  render() {
    const { fallback } = this.props
    if (!this.state.failed) return this.props.children
    return typeof fallback === 'function' ? fallback(this.state.error) : fallback
  }
}

export function ReloadPage() {
  return (
    <Failure
      title="This page didn't load"
      detail="The site may have just been updated. Reloading gets the new version."
    >
      <Button className="self-start" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </Failure>
  )
}
