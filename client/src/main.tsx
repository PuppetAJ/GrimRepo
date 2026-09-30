import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { Toaster } from '@/components/ui/sonner.tsx'
import App from './App.tsx'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('index.html is missing its #root element')

// Must match the tree prerender.tsx renders, so the prerendered home page hydrates cleanly.
const app = (
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster />
    </BrowserRouter>
  </StrictMode>
)

// Only the home page is prerendered; every other route starts empty.
if (container.hasChildNodes()) hydrateRoot(container, app)
else createRoot(container).render(app)
