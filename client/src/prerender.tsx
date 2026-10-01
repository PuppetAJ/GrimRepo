import { createMemoryHistory } from '@tanstack/react-router'
import { attachRouterServerSsrUtils, RouterServer } from '@tanstack/react-router/ssr/server'
import { StrictMode } from 'react'
import { prerender } from 'react-dom/static'
import { Toaster } from '@/components/ui/sonner.tsx'
import { renderingHome, type HomeVariant } from './lib/homeVariant.ts'
import { makeRouter } from './router.tsx'

export { HOME_VARIANTS, variantName } from './lib/homeVariant.ts'

/** One version of the home page's HTML, and the router state main.tsx hydrates it with; the tree must match main.tsx's. */
export async function renderHome(variant: HomeVariant): Promise<{ html: string; state: string }> {
  renderingHome(variant)
  const router = makeRouter(createMemoryHistory({ initialEntries: ['/'] }), 'http://localhost')
  attachRouterServerSsrUtils({ router, manifest: undefined })
  const ssr = router.serverSsr!
  await router.load()
  await ssr.dehydrate()
  const { prelude } = await prerender(
    <StrictMode>
      <RouterServer router={router} />
      <Toaster />
    </StrictMode>,
    // React otherwise moves a large section out to be filled in by an inline script, which the CSP blocks.
    { progressiveChunkSize: Number.POSITIVE_INFINITY },
  )
  const html = await new Response(prelude).text()
  if (/<script|<!--\$[?!]-->/.test(html))
    throw new Error('The prerendered home page needs an inline script, which the CSP blocks')
  // Served as a file rather than inline, since the CSP allows scripts from the site only.
  const tags = ssr.takeInitialHydrationScriptTags()
  if (!tags) throw new Error('The router produced no hydration state')
  const state = [...tags.before, tags.boundary].map((tag) => tag.children ?? '').join(';\n')
  ssr.setRenderFinished()
  ssr.cleanup()
  renderingHome(null)
  return { html, state }
}
