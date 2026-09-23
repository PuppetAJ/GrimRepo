import type { AddressInfo } from 'node:net'
import { createApp } from '../app.ts'

export type Reply = { status: number; body: any; cookie: string }

/** Starts the real app on a spare port; the returned client carries cookies the way a browser would. */
export async function startApp() {
  const server = createApp({ production: false }).listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  async function call(
    method: string,
    path: string,
    {
      body,
      cookie = '',
      raw,
      headers = {},
    }: { body?: unknown; cookie?: string; raw?: string; headers?: Record<string, string> } = {},
  ): Promise<Reply> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json', cookie, origin: base, ...headers },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    })
    const set = response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ')
    const text = await response.text()
    return { status: response.status, body: text ? JSON.parse(text) : null, cookie: set || cookie }
  }

  return { base, call, close: () => new Promise<void>((resolve) => server.close(() => resolve())) }
}

let counter = 0

/** A fresh player's details; the counter keeps names unique within a run. */
export function newPlayer(prefix = 'player') {
  counter += 1
  const username = `${prefix}_${counter}`
  return { name: username, username, email: `${username}@grimrepo.test`, password: 'a-long-enough-password' }
}
