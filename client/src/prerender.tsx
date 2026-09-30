import { createMemoryHistory } from '@tanstack/react-router'
import { attachRouterServerSsrUtils, RouterServer } from '@tanstack/react-router/ssr/server'
import { StrictMode } from 'react'
import { prerender } from 'react-dom/static'
import { Toasts } from './lib/toast.tsx'
import { makeRouter } from './router.tsx'

/** The home page's HTML, and the router state main.tsx hydrates it with; the tree must match main.tsx's. */
export async function renderHome(): Promise<{ html: string; state: string }> {
  const router = makeRouter(createMemoryHistory({ initialEntries: ['/'] }), 'http://localhost')
  attachRouterServerSsrUtils({ router, manifest: undefined })
  const ssr = router.serverSsr!
  await router.load()
  await ssr.dehydrate()
  const { prelude } = await prerender(
    <StrictMode>
      <RouterServer router={router} />
      <Toasts />
    </StrictMode>,
  )
  const html = await new Response(prelude).text()
  // Served as a file rather than inline, since the CSP allows scripts from the site only.
  const tags = ssr.takeInitialHydrationScriptTags()
  if (!tags) throw new Error('The router produced no hydration state')
  const state = [...tags.before, tags.boundary].map((tag) => tag.children ?? '').join(';\n')
  ssr.setRenderFinished()
  ssr.cleanup()
  return { html, state }
}
