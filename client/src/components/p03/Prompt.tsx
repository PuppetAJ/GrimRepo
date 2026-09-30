export function Prompt({ who, path }: { who: string; path: string }) {
  const p03 = who === 'p03'
  return (
    <span className="whitespace-nowrap">
      <span className={p03 ? 'text-p03' : 'text-[#ffb454]'}>{who}</span>
      <span className="text-p03-dim">@</span>
      <span className="text-p03">{p03 ? 'factory' : 'grim-repo'}</span>
      <span className="text-p03-dim">:{path}$</span>
    </span>
  )
}

/** "~" for the home page, "~/leaderboard" for the rest. */
export const pathOf = (pathname: string) => `~${pathname === '/' ? '' : pathname.replace(/\/$/, '')}`
