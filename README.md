# Huerto

A git repository, grown as a stylized low-poly 3D tree.

Enter an `owner/repo`, watch the repository's history grow into a navigable
tree on a floating soil island, then inspect limbs, twigs and leaves to see
the real GitHub data (releases, merged PRs, commits) behind them.

## Mapping

- **Trunk** — time. Height grows with the repository's age.
- **Limbs** — eras between releases (or quarters, if there are fewer than two
  releases). A limb emerges at the trunk height matching the era's start.
- **Twigs** — merged pull requests within an era. Fruit at the tip marks a
  merge.
- **Leaves** — commits belonging to a PR, colored by age (fresh green to
  autumn).
- **Flowers** — releases/tags, at the base of the limb they open.
- **Buds** — currently open PRs and live branches, at the crown.
- **Soil strata** — language byte shares.

Shape is deterministic: the same `owner/repo` always grows the same tree,
seeded from its name.

## Stack

Vite, React, TypeScript (strict), React Three Fiber + drei, Vitest, ESLint
(flat config).

## Architecture

```
src/domain/     pure domain logic: repository model, tree model (no React,
                no three.js, no fetch)
src/adapters/   outbound adapters, e.g. the GitHub GraphQL client
src/server/     the repo-snapshot request handler shared by dev and prod
src/ui/         React / React Three Fiber presentation layer
api/            Vercel serverless function entry points
scripts/        one-off scripts (e.g. fixture generation)
```

## Getting started

```bash
pnpm install
cp env.example .env   # add a GITHUB_TOKEN to raise the API rate limit
pnpm dev
```

## Scripts

| Script             | Purpose                                   |
| ------------------ | ------------------------------------------ |
| `pnpm dev`          | Start the Vite dev server                 |
| `pnpm build`        | Typecheck and build for production        |
| `pnpm preview`      | Preview the production build              |
| `pnpm typecheck`    | Run the TypeScript compiler (no emit)     |
| `pnpm lint`         | Run ESLint                                |
| `pnpm test`         | Run the Vitest suite                      |

## GitHub API

Without a `GITHUB_TOKEN`, GitHub limits unauthenticated requests to 60/hour.
Set `GITHUB_TOKEN` (see `env.example`) to a personal access token with no
special scopes for public repositories. Real credentials are never
committed; only `env.example` is tracked.

## Status

Work in progress. See `odd/tasks/huerto-mvp.md` for the current task list and
progress.
