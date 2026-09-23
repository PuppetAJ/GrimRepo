/** Where to go after signing in: a path on this site, or home. Anything else is an open redirect. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return '/'
  return value
}
