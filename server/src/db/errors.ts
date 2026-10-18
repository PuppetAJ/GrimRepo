/** A refusal the API answers with its own status and body, rather than a 500. */
export class GameError extends Error {
  readonly status: number
  readonly body: Record<string, unknown>
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body['error']))
    this.status = status
    this.body = body
  }
}
