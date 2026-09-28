# Huerto

Every repository grows a living history. Enter a GitHub `owner/repo` and explore
its releases, pull requests and commits as a navigable, deterministic 3D
scene — the same repository always grows the same shape, seeded from its name.

<!-- TODO(visual metaphor): a screenshot goes here once the scene's visual
     metaphor is finalized (in progress -- see `odd/tasks/huerto-mvp.md`). -->

## Mapping

<!-- TODO(visual metaphor): the repository-history -> scene mapping table
     used to live here (trunk/limbs/twigs/etc.), but the scene's visual
     metaphor is being redesigned (see `odd/tasks/huerto-mvp.md`'s V2
     entry). Re-add a mapping table once the new metaphor lands: which real
     data (eras between releases, merged PRs, commits, open PRs/live
     branches, releases, language byte shares) drives which visual element.
     Until then, the shape stays: `src/domain` derives a deterministic model
     from a `RepoSnapshot`, and the UI layer renders it -- see
     `src/domain/tree/buildTree.ts` and `src/ui/scene/`. -->

## Try it

- Enter any `owner/repo` on the landing page, or paste a full GitHub URL.
- The bundled sample repository (`pmndrs/valtio`) always works, even with no
  `GITHUB_TOKEN` configured (see [GitHub API](#github-api) below).
- `?sel=<id>` in a viewer URL deep-links to a selected element -- "Copy
  link" in the viewer header copies a shareable URL that includes it.

## Stack

Vite, React, TypeScript (strict), React Three Fiber + drei, [wouter](https://github.com/molefrog/wouter)
(routing), Vitest, ESLint (flat config).

## Architecture

```
src/domain/     pure domain logic: repository model, tree model, formatting,
                request/error-state mapping (no React, no three.js, no fetch)
src/adapters/   outbound adapters, e.g. the GitHub GraphQL client
src/server/     the repo-snapshot request handler shared by dev and prod
src/ui/         React / React Three Fiber presentation layer
  pages/        route-level components (landing, viewer, 404)
  components/   shared UI (detail panel, header, states, ...)
  scene/        the lazy-loaded 3D chunk
api/            Vercel serverless function entry points
scripts/        one-off scripts (fixture generation, visual QA screenshots)
```

## Getting started

```bash
pnpm install
cp .env.example .env   # add a GITHUB_TOKEN to raise the API rate limit
pnpm dev
```

## Scripts

| Script          | Purpose                               |
| --------------- | -------------------------------------- |
| `pnpm dev`       | Start the Vite dev server             |
| `pnpm build`     | Typecheck and build for production    |
| `pnpm preview`   | Preview the production build          |
| `pnpm typecheck` | Run the TypeScript compiler (no emit) |
| `pnpm lint`      | Run ESLint                            |
| `pnpm test`      | Run the Vitest suite                  |
| `pnpm shot`      | Headless visual QA screenshots (`.shots/`, gitignored) |

## GitHub API

Without a `GITHUB_TOKEN`, GitHub limits unauthenticated requests to 60/hour,
and only the bundled sample repository renders (any other repo shows a
"token required" state explaining this). Set `GITHUB_TOKEN` (copy
`.env.example` to `.env`) to a personal access token with no special scopes
for public repositories to browse any public GitHub repository. Real
credentials are never committed; only `.env.example` is tracked.

## Deploy on Vercel

This is a standard Vite app with a Vercel serverless function
(`api/repo.ts`) for the same repo-snapshot handler the dev server uses.

1. Import the repository into Vercel (framework preset: Vite).
2. Set the `GITHUB_TOKEN` environment variable in the Vercel project
   settings (optional -- without it, only the bundled sample repo works).
3. Deploy. `vercel.json` rewrites unmatched paths to `index.html` so
   client-side routes (`/owner/repo`) resolve correctly on a hard
   refresh/deep link.

## Credits

Built by [TanisJam](https://github.com/TanisJam) · [mnr.ar](https://mnr.ar)

## Status

Work in progress. See `odd/tasks/huerto-mvp.md` for the current task list and
progress.
