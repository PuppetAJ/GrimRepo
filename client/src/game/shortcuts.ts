import { useEffect, useRef } from 'react'

/** Single-key shortcuts act only while focus is in the table (WCAG 2.1.4), never elsewhere on the page. */
export const forTable = (event: KeyboardEvent) =>
  !event.metaKey &&
  !event.ctrlKey &&
  !event.altKey &&
  event.target instanceof Element &&
  event.target.closest('[data-table]') !== null

/** When the control holding focus in the table is disabled or removed, focus returns to the table, so its shortcuts keep working. */
export function useKeepTableFocus() {
  useEffect(() => {
    let held: HTMLElement | null = null
    let frame: HTMLElement | null = null
    // Browsers differ on firing blur for a disabled or removed element, so this watches the table instead.
    const observer = new MutationObserver(() => {
      if (!held || !frame?.isConnected) return
      const gone = !held.isConnected || (held instanceof HTMLButtonElement && held.disabled)
      const dropped = document.activeElement === document.body || document.activeElement === held
      if (!gone || !dropped) return
      held = frame
      frame.focus({ preventScroll: true })
    })
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      const table = target?.closest<HTMLElement>('[data-table]') ?? null
      held = table ? target : null
      if (!table || table === frame) return
      observer.disconnect()
      frame = table
      observer.observe(frame, { subtree: true, childList: true, attributes: true, attributeFilter: ['disabled'] })
    }
    // Choosing somewhere else on the page lets focus go.
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element && event.target.closest('[data-table]'))) held = null
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      observer.disconnect()
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [])
}

/** Escape calls off the card being placed and its sacrifice marks; in full screen the browser keeps Escape for leaving it. */
export function useEscapeCancel(canCancel: boolean, cancel: () => void) {
  const latest = useRef(cancel)
  useEffect(() => {
    latest.current = cancel
  })
  useEffect(() => {
    if (!canCancel) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || document.querySelector('[role="dialog"]')) return
      latest.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canCancel])
}
