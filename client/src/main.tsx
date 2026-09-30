import { RouterProvider } from '@tanstack/react-router'
import { RouterClient } from '@tanstack/react-router/ssr/client'
import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { Toasts } from './lib/toast.tsx'
import { makeRouter } from './router.tsx'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('index.html is missing its #root element')

const router = makeRouter()

// Only the home page is prerendered; it hydrates from the router state prerender.tsx saved, and must match its tree.
if (container.hasChildNodes())
  hydrateRoot(
    container,
    <StrictMode>
      <RouterClient router={router} />
      <Toasts />
    </StrictMode>,
  )
else
  createRoot(container).render(
    <StrictMode>
      <RouterProvider router={router} />
      <Toasts />
    </StrictMode>,
  )
