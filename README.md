# Grim Repo

A card game of sacrifices, played by candlelight against a robot. Inspired by [Inscryption](https://www.inscryption.com/), with a deck of programming jokes.

Grim Repo started in 2022 as a bootcamp group project (Express, Handlebars, MySQL and a single three.js script) and is being rebuilt. The original is tagged `v1-legacy`.

## What it is built on

| Area     | Choice                                                                          |
| -------- | ------------------------------------------------------------------------------- |
| Client   | Vite, React 19, Tailwind v4 and shadcn/ui; React Three Fiber for the table      |
| Server   | Express 5 on Node 24, which runs its TypeScript directly                        |
| Rules    | A `shared` package of plain TypeScript used by both sides                       |
| Database | Postgres 18                                                                     |
| Tooling  | pnpm workspaces, TypeScript 7, oxlint, Prettier, Node's test runner, Playwright |
| Hosting  | Railway, described in code in `.railway/railway.ts`                             |

## Running it

You need Node 24 (`.node-version`), pnpm, and Docker for the database.

```sh
pnpm install
cp .env.example .env      # then put a real secret in BETTER_AUTH_SECRET: openssl rand -base64 32
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

The seed creates a demo account anyone can use, `demo` with the password `demo-password`, and the three original players with some games behind them.

The client is at http://localhost:3000 and proxies `/api` and `/health` to the API on port 3001. The database listens on 5433 so it can run beside another project's Postgres on 5432.

## Scripts

| Script                              | Does                                                                                                                                            |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | Client and API together, reloading on change                                                                                                    |
| `pnpm build`                        | Builds the client into `client/dist`                                                                                                            |
| `pnpm start`                        | The API, serving the built client when `NODE_ENV=production`                                                                                    |
| `pnpm lint` / `pnpm format`         | oxlint / Prettier                                                                                                                               |
| `pnpm typecheck`                    | TypeScript across every package                                                                                                                 |
| `pnpm test`                         | Unit tests in every package                                                                                                                     |
| `pnpm test:e2e`                     | The browser suites (smoke, auth, leaderboard, game, table) against `E2E_BASE_URL`, default http://localhost:3000; `pnpm test:e2e game` runs one |
| `pnpm db:up` / `pnpm db:down`       | Start and stop the local Postgres                                                                                                               |
| `pnpm db:migrate`                   | Apply the migrations in `server/migrations`                                                                                                     |
| `pnpm db:seed`                      | Wipe the database and reseed the demo state                                                                                                     |
| `pnpm db:seed:empty`                | Seed only if there are no players yet; Railway runs this on every boot                                                                          |
| `pnpm db:cleanup`                   | The nightly clean-up, by hand                                                                                                                   |
| `pnpm moderate`                     | Rename, remove, list or scan accounts; see Looking after the live site                                                                          |
| `pnpm --filter client render:cards` | Renders the art out of the 2022 card models into `client/public/cards`; run once, the images are committed                                      |

## How the code is arranged

```
client/   the web app
server/   the API
shared/   game rules and data, imported by both
e2e/      browser suites, plain Playwright scripts
```

Imports run one way, and oxlint enforces it: the client and the server may use `shared`, `shared` uses neither, and neither imports the other.

## The table

The game is played on a 3D table by default: the 2022 room, P03 and board, rebuilt with React Three Fiber in `client/src/game/table`. Every card is one mesh whose face is drawn from the card data on a canvas, so a card's numbers change on the table as they change in the rules. The rules engine reports what each move did as a list of events, and the table plays them back one at a time, so a card lunges, a number rises off what it hit, and the dead sink away. A unit test folds the events of whole games and checks the table always lands on the rules' own state.

The same game can be played as text, which reads well on a phone held upright and works with a screen reader. The switch is on both tables and is remembered per browser; an upright phone is offered the text table rather than a sideways one. On a phone held sideways the 3D table takes the whole screen.

In development, `window.__game` exposes the table's state and where things are on screen, which the `table` browser suite uses to click the models.

## The API

| Route                              | Does                                                                                                  |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/api/auth/*`                      | Sign up, sign in by email or username, rename, delete the account, sign out; handled by Better Auth   |
| `GET /api/me`                      | The signed-in player, their best score and games played                                               |
| `POST /api/games`                  | Starts a game with a seed the server picks, or resumes the unfinished one                             |
| `POST /api/games/:id/moves`        | Saves the moves since the last save; the server replays the whole game, and scores it once it is over |
| `POST /api/games/:id/forfeit`      | Walks away: a loss on the turn reached                                                                |
| `GET /api/leaderboard`             | Players ranked by their best game                                                                     |
| `GET /api/players/:username/stats` | A player's record: wins, losses, best score, recent games                                             |

A score is never sent, only moves: the server replays them with the same rules engine the browser plays with, refuses any illegal one, and scores only a finished game. Every figure is computed from the stored games, and a player can only ever be shown under their own username. Sign-in attempts are rate limited by the client's real address and game submissions per player; the browser suite clears the counters first when it runs against a local database. The tests run against a real Postgres database whose name must end in `_test`.

## Looking after the live site

Names are filtered when they are chosen: profanity from the [obscenity](https://github.com/jo3-l/obscenity) dataset and the [List of Dirty, Naughty, Obscene and Otherwise Bad Words](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words), playground words those lists leave out, and names that would pass for the game or its staff. It sees through underscores, camelCase, digits in place of letters and doubled letters. Anything that slips through is fixed from the command line. Locally:

```sh
pnpm moderate recent 7              # accounts made in the last 7 days
pnpm moderate rename <username>     # rename to a neutral player_####, and lock the name
pnpm moderate remove <username>     # delete the account and its games
pnpm moderate scan                  # existing names the filter would refuse today
```

Against the live site, the same commands run inside the app's container:

```sh
pnpm exec railway ssh --service GrimRepo -- pnpm moderate rename <username>
```

A clean-up runs every night at 04:00 UTC as its own Railway service. It clears the shared demo account's open game, drops games abandoned for a month, and sweeps expired sessions and old rate-limit rows. `pnpm db:cleanup` runs it by hand. Scores are kept: every one is a replayed game, so there is nothing to reset.

## Credits

The original team: Adrian Jimenez, Kenan McKenzie and Johan Herrera ([original repository](https://github.com/kwm0304/Boss-fight)). Kenan built the health overlay; Johan built the leaderboard and the first login page.

- **The room:** [Fantasy interior items](https://sketchfab.com/3d-models/fantasy-interior-items-6542c39c66394888994d7343fd03fdef) by Tedium Interactive.
- **The robot:** P03 from Inscryption, animated by Adrian Jimenez.
- **The bell:** [Table bell](https://sketchfab.com/3d-models/table-bell-77f2ea17b4c84fe1a8d2aec02caa9de3) on Sketchfab, edited by Adrian Jimenez.
- **The board and the deck:** made by Adrian Jimenez, with Inscryption's textures on the deck.
- **The candle:** [The lonely candle](https://discourse.threejs.org/t/the-lonely-candle/4097) by prisoner849, using noise from [The Book of Shaders](https://thebookofshaders.com/11/) and [Morgan McGuire](https://www.shadertoy.com/view/4dS3Wd) and a [heatmap gradient](https://www.shadertoy.com/view/4dsSzr) from Shadertoy.
- **The cards:** Adrian Jimenez's art from the 2022 card models, rendered out once, on Inscryption's card frame and back.
- **The name filter:** word lists from [obscenity](https://github.com/jo3-l/obscenity) (MIT) and [LDNOOBW](https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words) (CC BY 4.0).
- **The game** is a tribute to Inscryption by Daniel Mullins Games.

## License

MIT. See [LICENSE](./LICENSE).
