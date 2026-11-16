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

const hydrate = () =>
  hydrateRoot(
    container,
    <StrictMode>
      <RouterClient router={router} />
      <Toaster />
    </StrictMode>,
  )

const prerenderedWithTerminal = homeVariant()?.seen

if (container.hasChildNodes()) void (prerenderedWithTerminal ? preloadTerminal().then(hydrate) : hydrate())
else
  createRoot(container).render(
    <StrictMode>
      <RouterProvider router={router} />
      <Toaster />
    </StrictMode>,
  )
