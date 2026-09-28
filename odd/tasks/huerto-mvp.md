# Huerto MVP — a git repository grown as a 3D tree

Locator: `odd/tasks/huerto-mvp.md` · Engram mirror: `odd/huerto-mvp/tasks`

## Objective
A shareable web app: enter `owner/repo`, watch the repository grow as a stylized low-poly 3D tree
on a floating soil island, then navigate limbs, twigs and leaves to inspect real GitHub data.

## Problem / why
Existing repo visualizers are either analytic (Git Truck, CodeCharta), directory-based (Gource,
GitCoral) or non-botanical (Skyline, Git City). None renders repository *history* as a believable,
navigable tree. Literal branch topology looks bad (few long-lived branches), so structure is
imposed by grouping history into eras.

## Mapping (decided)
- Trunk = time (height ∝ repo age). Lower = older.
- Main limbs = eras between releases (fallback: quarters when no releases). Limb emerges at the era's height; length/density ∝ activity.
- Twigs = merged PRs within the era. Fruit at twig tip = merged.
- Leaves = commits of each PR. Color by age (fresh green → autumn; oldest eras sparse).
- Flower at limb base = release/tag.
- Buds at crown = currently open PRs / live branches.
- Soil island cross-section strata = languages. Roots: out of MVP.
- Style: stylized low-poly diorama. Deterministic shape seeded by `owner/repo`.
- Data drives parameters; the growth algorithm drives shape. Cap twigs per limb; overflow becomes leaf density.

## Scope (authorized)
Standalone app in this repo. Local work-unit commits on `feat/mvp`. Remote repo creation, push, deploy: user decision (not authorized yet).

## Constraints
- Stack: Vite + React + TypeScript + React Three Fiber (+ drei), Vitest.
- Hexagonal: `src/domain` pure (no React/three/fetch), adapters for GitHub, UI separate.
- GitHub data via server endpoint using `GITHUB_TOKEN` (never committed; unauthenticated limit is 60 req/h) + cache + bundled fixture so the demo works offline.
- Artifacts in English. Shell: bat/rg/fd/sd/eza, not cat/grep/find/sed/ls.

## TDD
Mode: off (source: no project/session configuration; new repo). Runner: Vitest. Ordinary functional checks still run: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.

## Delivery
Strategy: ask-on-risk. Forecast > 400 lines → chain strategy to ask before push/PR (not needed for local commits).

## Tasks
- [ ] T1 Scaffold: Vite+React+TS, R3F/drei, Vitest, ESLint, scripts, folder structure. Route: delegated (writer trigger).
- [ ] T2 Data: domain repo model + GitHub GraphQL adapter + `/api/repo` endpoint (dev middleware + Vercel function) with cache + fixture. Route: delegated.
- [ ] T3 Tree model: pure deterministic layout (eras → limbs → twigs → leaves, flowers, fruit, buds, soil strata), caps; unit tests. Route: delegated.
- [ ] T4 Rendering: diorama island, trunk/limb/twig tube geometry, instanced leaves, flowers, fruit, buds, lighting, orbit camera. Route: delegated.
- [ ] T5 Growth time-lapse + time scrubber. Route: delegated.
- [ ] T6 Navigation & inspection: hover/click, info panel with real data + GitHub links, focus camera, era list. Route: delegated.
- [ ] T7 Product shell: landing input, `/owner/repo` routing, loading/error/rate-limit states, meta/OG, README. Route: delegated.
- [ ] T8 Polish: perf on large repos, mobile, a11y, visual pass with screenshots. Route: delegated.

## Acceptance criteria
- `/facebook/react`-style URL renders a believable tree from real data (or fixture offline).
- Every twig/leaf/flower is clickable and shows real PR/commit/release info with a GitHub link.
- Growth replay runs from first commit to today; scrubber moves through time.
- All checks green: typecheck, lint, test, build.

## Progress / evidence
(updated per task with commit hashes and check results)

## Next step
T1.
