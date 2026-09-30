import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button.tsx'
import { Failure } from './States.tsx'

/** Catches a part of the page that fails to load or draw, most often code gone after a deploy. */
export class LoadFailed extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
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
