import { Link } from '@tanstack/react-router'
import logo from './logo.svg'

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 whitespace-nowrap sm:gap-3" aria-label="p03 / grim-repo, home">
      <img src={logo} alt="" width={26} height={26} className="max-[22.5rem]:hidden" />
      <span className="p03-text-glow font-terminal text-[26px] leading-none text-p03">p03</span>
      <span className="font-mono text-muted-foreground">/</span>
      <span className="font-mono font-medium">grim-repo</span>
    </Link>
  )
}
