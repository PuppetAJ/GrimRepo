import { lazy, Suspense } from 'react'
import { Link } from 'react-router'
import { Glass } from '../components/p03/Glass.tsx'
import { useP03Says } from '../components/p03/says.ts'

const FaultyScreen = lazy(() => import('../components/p03/FaultyScreen.tsx'))

export function NotFound() {
  useP03Says(['404. Even I could not find it, and I built this place.'])
  return (
    <div className="p03-screen relative flex max-w-xl flex-col gap-3 overflow-hidden rounded-md border border-[#2f6b3d] p-6 font-terminal text-2xl">
      <Suspense fallback={null}>
        <FaultyScreen bright={0.35} />
      </Suspense>
      <Glass />
      <h1 className="relative z-10 text-5xl text-p03">404</h1>
      <p className="relative z-10">P03&gt; There is nothing here. I checked twice.</p>
      <Link to="/" className="relative z-10 self-start text-p03 underline underline-offset-4">
        cd ~
      </Link>
    </div>
  )
}
