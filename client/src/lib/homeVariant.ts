/** Which prerendered home page the server chose, from the cookies on the request. */
export type HomeVariant = { signedIn: boolean; seen: boolean }

export const HOME_VARIANTS: HomeVariant[] = [
  { signedIn: false, seen: false },
  { signedIn: false, seen: true },
  { signedIn: true, seen: false },
  { signedIn: true, seen: true },
]

/** The value of `data-home` on that page's root element, and part of its file name. */
export const variantName = ({ signedIn, seen }: HomeVariant) =>
  `${signedIn ? 'signed-in' : 'signed-out'} ${seen ? 'seen' : 'fresh'}`

let rendering: HomeVariant | null = null

/** Set by the prerender before each version, since it has no document to read. */
export function renderingHome(variant: HomeVariant | null) {
  rendering = variant
}

/** The version this page was prerendered as, so hydration starts from the same state; null on a page the browser renders. */
export function homeVariant(): HomeVariant | null {
  if (rendering) return rendering
  const value = typeof document === 'undefined' ? undefined : document.documentElement.dataset['home']
  if (!value) return null
  const words = value.split(' ')
  return { signedIn: words.includes('signed-in'), seen: words.includes('seen') }
}

// Read by the server to choose the home page; ends with the browser session, so the takeover plays once per visit.
const TAKEOVER_COOKIE = 'grimrepo_seen'

export const takeoverSeen = () => document.cookie.split('; ').includes(`${TAKEOVER_COOKIE}=1`)

export function markTakeoverSeen() {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${TAKEOVER_COOKIE}=1; Path=/; SameSite=Lax${secure}`
}
