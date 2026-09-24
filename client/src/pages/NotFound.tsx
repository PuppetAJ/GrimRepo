import { Link } from 'react-router'

export function NotFound() {
  return (
    <div className="p03-screen flex max-w-xl flex-col gap-3 rounded-md border border-[#2f6b3d] p-6 font-terminal text-2xl">
      <h1 className="text-5xl text-p03">404</h1>
      <p>P03&gt; There is nothing here. I checked twice.</p>
      <Link to="/" className="text-p03 underline underline-offset-4">
        cd ~
      </Link>
    </div>
  )
}
