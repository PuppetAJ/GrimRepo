export type HomeVariant = { signedIn: boolean; seen: boolean }

export const HOME_VARIANTS: HomeVariant[] = [
  { signedIn: false, seen: false },
  { signedIn: false, seen: true },
  { signedIn: true, seen: false },
  { signedIn: true, seen: true },
]

export const variantName = ({ signedIn, seen }: HomeVariant) =>
  `${signedIn ? 'signed-in' : 'signed-out'} ${seen ? 'seen' : 'fresh'}`

let prerenderVariant: HomeVariant | null = null

export function setPrerenderVariant(variant: HomeVariant | null) {
  prerenderVariant = variant
}

export function homeVariant(): HomeVariant | null {
  if (prerenderVariant) return prerenderVariant
  const value = typeof document === 'undefined' ? undefined : document.documentElement.dataset['home']
  if (!value) return null
  const words = value.split(' ')
  return { signedIn: words.includes('signed-in'), seen: words.includes('seen') }
}

const TAKEOVER_COOKIE = 'grimrepo_seen'

export const takeoverSeen = () => document.cookie.split('; ').includes(`${TAKEOVER_COOKIE}=1`)

export function markTakeoverSeen() {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${TAKEOVER_COOKIE}=1; Path=/; SameSite=Lax${secure}`
}
