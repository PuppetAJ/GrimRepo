import { Link } from 'react-router'

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 whitespace-nowrap sm:gap-3" aria-label="p03 / grim-repo, home">
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="max-[22.5rem]:hidden"
        aria-hidden
      >
        <circle cx="12" cy="9" r="6" />
        <path d="M9 9h.01M15 9h.01M9 15v5M12 15v6M15 15v5" />
      </svg>
      <span className="font-terminal text-[26px] leading-none text-p03 [text-shadow:0_0_8px_rgb(125_255_154/0.45)]">
        p03
      </span>
      <span className="font-mono text-muted-foreground">/</span>
      <span className="font-mono font-medium">grim-repo</span>
    </Link>
  )
}
