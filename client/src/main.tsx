import { RouterProvider } from '@tanstack/react-router'
import { RouterClient } from '@tanstack/react-router/ssr/client'
import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { Toaster } from '@/components/ui/sonner.tsx'
import { preloadTerminal } from './components/p03/Infected.tsx'
import { homeVariant } from './lib/homeVariant.ts'
import { makeRouter } from './router.tsx'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('index.html is missing its #root element')

const router = makeRouter()

// Only the home page is prerendered; it hydrates from the router state prerender.tsx saved, and must match its tree.
const hydrate = () =>
  hydrateRoot(
    container,
    <StrictMode>
      <RouterClient router={router} />
      <Toaster />
    </StrictMode>,
  )

// A page prerendered with P03's terminal loads it first, so hydration adopts the terminal instead of rebuilding it.
if (container.hasChildNodes()) void (homeVariant()?.seen ? preloadTerminal().then(hydrate) : hydrate())
else
  createRoot(container).render(
    <StrictMode>
      <RouterProvider router={router} />
      <Toaster />
    </StrictMode>,
  )
