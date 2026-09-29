import { StrictMode } from 'react'
import { prerender } from 'react-dom/static'
import { StaticRouter } from 'react-router'
import { Toaster } from '@/components/ui/sonner.tsx'
import App from './App.tsx'

/** The home page's first view as HTML, for the build to put in index.html; it must match main.tsx's tree. */
export async function renderHome(): Promise<string> {
  const { prelude } = await prerender(
    <StrictMode>
      <StaticRouter location="/">
        <App />
        <Toaster />
      </StaticRouter>
    </StrictMode>,
  )
  return new Response(prelude).text()
}
