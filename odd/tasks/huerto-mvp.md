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
- [x] T1 Scaffold: Vite+React+TS, R3F/drei, Vitest, ESLint, scripts, folder structure. Route: delegated (writer trigger).
- [x] T2 Data: domain repo model + GitHub GraphQL adapter + `/api/repo` endpoint (dev middleware + Vercel function) with cache + fixture. Route: delegated.
- [x] T3 Tree model: pure deterministic layout (eras → limbs → twigs → leaves, flowers, fruit, buds, soil strata), caps; unit tests. Route: delegated.
- [x] T4 Rendering: diorama island, trunk/limb/twig tube geometry, instanced leaves, flowers, fruit, buds, lighting, orbit camera. Route: delegated.
- [x] T5 Growth time-lapse + time scrubber. Route: delegated.
- [ ] T6 Navigation & inspection: hover/click, info panel with real data + GitHub links, focus camera, era list. Route: delegated.
- [ ] T7 Product shell: landing input, `/owner/repo` routing, loading/error/rate-limit states, meta/OG, README. Route: delegated.
- [ ] T8 Polish: perf on large repos, mobile, a11y, visual pass with screenshots. Route: delegated.

## Polish bar (must all hold before the MVP is called done)
Visual
- P1 Palette: tokenized, ≤ ~10 colors — bark, soil strata, leaf ramp (fresh green → gold → rust), orange fruit, blossom, warm sky gradient. Same tokens in 3D and UI.
- P2 Style: consistent stylized low-poly flat shading; hemisphere + directional sun with soft shadows; contact shadow under the floating island; light fog for depth.
- P3 Silhouette: from the default camera it reads as a tree at first glance — tapered trunk, crown mass, every limb/twig attached, no parts intersecting the trunk or floating.
- P4 Motion: subtle idle wind sway, eased camera transitions, eased growth; respects `prefers-reduced-motion`; ~60fps on a mid laptop.
- P5 UI craft: one display + one UI font, type scale, 4/8px spacing grid, one consistent panel style; no layout shift; mobile-first layouts.
Product
- P6 States designed: loading (seed sprouting), error, not found, rate-limited, token-required, empty/tiny repo.
- P7 Interaction: hover highlight + pointer cursor + tooltip, click → detail panel, camera focuses selection, Esc closes, keyboard navigation, touch works.
- P8 Truth: every visible element maps to real data; dates/numbers formatted; each detail links to GitHub.
- P9 Legibility: a legend explaining the mapping (leaf = commit, fruit = merged PR, flower = release, bud = open PR, limb = era).
- P10 Share: `/owner/repo` URLs, OG/meta tags, a "copy link" and "save image" action.
- P11 A11y: UI contrast AA, aria labels, focus rings, a text alternative (era/PR list) for the 3D view.
- P12 Perf & robustness: instanced leaves/fruit, low draw calls, lazy-loaded 3D chunk, handles tiny repos and 1000+ PR repos gracefully, no console errors.
Verification of the bar: headless screenshots (desktop + mobile) reviewed each visual iteration; a final independent design/product review against P1–P12.

## Acceptance criteria
- `/facebook/react`-style URL renders a believable tree from real data (or fixture offline).
- Every twig/leaf/flower is clickable and shows real PR/commit/release info with a GitHub link.
- Growth replay runs from first commit to today; scrubber moves through time.
- All checks green: typecheck, lint, test, build.

## Progress / evidence

### T1 Scaffold — done
Commit: `29f4ca4` chore: scaffold vite react three fiber app.
Stack pinned to current stable majors compatible with each other (checked peer
deps before installing): Vite 8.3.1, React 19.3.0, @react-three/fiber 9.8.1,
@react-three/drei 10.7.9, three 0.186.1, Vitest 5.0.2, TypeScript 5.9.3
(typescript-eslint 8.70.1 caps TS at <6.1.0, so TS 7 was intentionally not
used), ESLint 10.11.0 flat config, Prettier 3.9.9.
Structure: `src/domain/` (pure), `src/adapters/github/`, `src/server/`,
`src/ui/` (R3F placeholder canvas), `api/` (Vercel entry, added in T2).
Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass (9
tests) · `pnpm build`: pass (one non-blocking "chunk > 500kB" advisory from
three.js, expected).

### T2 Data — done
Commit: `10685e2` feat: fetch repository snapshots from github.
Domain types (`src/domain/repo.ts`, `src/domain/errors.ts`,
`src/domain/validateRepoIdentity.ts`), GitHub GraphQL adapter
(`src/adapters/github/`: `graphqlClient.ts`, `queries.ts`, `mappers.ts`,
`fetchRepoSnapshot.ts`, `rawTypes.ts`, `caps.ts`) paginating merged PRs up to
1000 (50/page), commits capped 20/PR, releases capped 100 (falls back to tags
when 0), open PRs capped 50, branches capped 100, direct-commit scan capped
50→20. Typed `RepoError` codes map to HTTP status in
`src/server/handleRepoRequest.ts` (400/404/403/429/503/502). Server handler
`src/server/getRepoSnapshot.ts` with in-memory + best-effort on-disk
(`.huerto-cache/`, gitignored) TTL-1h cache, exposed via both a Vite dev
middleware (`src/server/vitePlugin.ts`, wired in `vite.config.ts`) and
`api/repo.ts` (Vercel function) sharing the same handler — verified live with
`pnpm dev` + curl for the fixture path (200), unknown-repo-no-token path (503
`token_required`), and invalid input (400 `invalid_input`).
Fixture: generated via `pnpm fixture pmndrs/valtio` (script:
`scripts/fixture.ts`, needs `GITHUB_TOKEN` — used `gh auth token` locally,
never committed) into `src/server/fixtures/pmndrs-valtio.json`, registered in
`src/server/fixtures/index.ts` (which re-tags `source: 'fixture'` on read, a
bug caught by its own test — the raw JSON was captured with `source:
'github'`). Chosen for being a "medium repo with releases" that stays small:
538 merged PRs, 80 releases, 5 open PRs, 9 branches, 9 direct commits, 1.1 MB
JSON (well under the 1.5 MB budget). `env.example` documents `GITHUB_TOKEN`
(see note below on `.env.example`).
Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass (56
tests, incl. mocked-GraphQL mapping/pagination/error tests) · `pnpm build`:
pass.

### T3 Tree model — done
Commit: `1062df5` feat: derive deterministic tree model from repository
history.
`src/domain/tree/`: `prng.ts` (seeded mulberry32 from `owner/repo`),
`vector.ts` (plain `Vec3`, no three.js), `timeBounds.ts`
(`computeTimeBounds`), `eras.ts` (release-boundary eras with a "prehistory"
era before the first release, quarters fallback when <2 releases, iterative
merge-smallest-neighbor to enforce `minPrsPerEra` and cap `maxEras`≈16),
`buildTree.ts` (trunk/limbs/twigs/fruits/leaves/flowers/buds/soil), `types.ts`,
`index.ts`. Twigs capped ~40/limb; overflow PRs become extra "density" leaves
on the limb (capped) instead of full twigs. Leaf `age` 0..1 is derived from
each commit's position in the repo's overall time span (0=fresh/top,
1=autumn/bottom), consistent with trunk height also encoding time. Buds
exclude the default branch. Flowers are placed independently of era
construction (by locating which era's time range contains each release
date), so they render correctly under both the release-boundary and
quarters-fallback strategies.
Tests (`*.test.ts` beside each module + a fixture-based smoke test using the
real `pmndrs/valtio` fixture): determinism (identical snapshot → `toEqual`
identical model), era fallback (quarters when <2 releases, incl. a
zero-time-span edge case), merge/cap behavior, every element has a
non-empty `id`/finite `time`/`ref`, limb heights monotonic with era start
time, no NaN/non-finite numbers anywhere in the model (recursive scan), caps
(twigs/limb, buds), and the fixture smoke test (bounds sanity, caps,
`fruits.length === twigs.length`, `flowers.length === releases.length`, soil
shares sum to 1).
Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass (75
tests total) · `pnpm build`: pass.

### T4 Rendering — done
Commit: `403c4c3` feat: render repository tree as low-poly diorama.
`src/ui/theme/`: `color.ts` (pure hex math: mix/soften/ramp, tested) +
`tokens.ts` (the ~10-color palette, `leafColorForAge`,
`soilStratumColor` softening real GitHub language colors toward the
soil palette, UI tokens). `src/ui/scene/geometry/`: `tubeFrames.ts`
(stable look-at frame per polyline, single reference chosen from the
*overall* start→end direction rather than per-point — a per-point
choice twisted near-vertical tubes when jitter crossed the flip
threshold, tested), `tubeGeometry.ts` (low-poly tapered tube +
`drawRangeForProgress` for T5), `island.ts` (merged, vertex-colored,
single-draw-call floating island: rocky tip + strata bands from real
soil shares + bumpy grass cap, seeded jitter), `instances.ts`
(instance-matrix helpers), `shapes.ts` (shared leaf/fruit/flower/bud
geometries), `skyTexture.ts` (screen-space gradient background — tried
a world-anchored sky sphere first; abandoned because the gradient was
imperceptible at typical camera pitch, see below). `src/ui/scene/tree/`:
`TrunkMesh`/`LimbMeshes` (draw-range reveal), `Twigs` (one instanced
mesh, per-instance aligned+scaled), `Leaves`/`Fruits`/`Flowers`/`Buds`
(`ScatterInstances`, per-instance color via `instanceColor`),
`SoilIsland` (+ drei `ContactShadows` beneath it), `Lighting`
(hemisphere + directional sun, VSM soft shadows sized to the tree's
bounds), `CameraRig` (auto-framed OrbitControls, damped, distance/polar
limits), `WindSway` (crown-only sway, disabled under
prefers-reduced-motion), `TreeScene` (composer), `useTreeGeometry`
(memoized build + dispose). `src/domain/tree/bounds.ts`
(`computeModelBounds`, tested) added for camera/lighting framing.
`Scene.tsx` owns the R3F `Canvas` (ACES tone mapping, sRGB output,
scene fog) and is the `React.lazy` boundary; `App.tsx` fetches via
`useRepoTree` and renders it fully grown (T5 adds the time cursor).
`scripts/shot.ts` (Playwright + SwiftShader-software-WebGL headless
Chromium) added for the required visual QA loop.
Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass
(120 tests) · `pnpm build`: pass (606→604 modules for this commit;
`Scene` chunk ~948 kB / gzip ~252 kB lazy-loaded, initial `index` chunk
~233 kB / gzip ~74 kB) · `pnpm shot`: 4/4 screenshots saved, 0 console
errors.
Visual iteration (>3 rounds, via `.shots/` + Read tool): (1) first pass
had a flat-orange non-gradient sky (world sky sphere: camera pitch
kept world-Y direction nearly constant across the frame) and a twisted
"X" of geometry at the trunk base (per-point tube-frame reference
flipped near-vertical) — fixed the frame reference and switched the
sky to a screen-space gradient texture. (2) added the missing
`ContactShadows` under the island (P2 explicitly asks for one) and
fixed a spiked grass-cap center vertex (jitter was moving the
fan-triangulation's center vertex, poking a thin degenerate spike
through the trunk). (3+) confirmed clean silhouette, attached parts, no
console errors on desktop 1440×900 and mobile 390×844.

### T5 Growth — done
Commit: `cc5a60b` feat: animate tree growth over repository history.
`src/domain/tree/growth.ts` (pure, tested): `trunkGrowthProgress`,
`limbGrowthProgress`, `limbFullyGrownTime`, `twigGrowthProgress`,
`popScale`, `mapPlaybackProgressToTime`, `easePlaybackProgress` (reuses
`easeOutCubic`/`easeInOutCubic` added to `src/domain/math.ts`).
`src/ui/hooks/useGrowthClock.ts`: an imperative (non-React-state)
playback controller — `getTime()` is read every frame from `useFrame`
inside the R3F tree so growth animation never triggers a React
re-render of the scene; `useSyncExternalStore`-compatible `subscribe`
for the UI (scrubber) to re-render at its own rate. Auto-plays 0→1 over
10s eased (`easeInOutCubic`) from first event to now on mount; jumps
straight to the end under `prefers-reduced-motion`; a `?t=0..1` query
param pins a fixed frame instead (used by `scripts/shot.ts`).
`src/ui/components/TimeScrubber.tsx`: bottom bar, play/pause + range
slider + formatted current date, token-styled; space toggles
play/pause, arrow keys nudge the cursor (both `preventDefault`), `role="group"`
+ `aria-label`s.
Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass
(134 tests, +14 for T5) · `pnpm build`: pass (606 modules; same chunk
split as T4) · `pnpm shot`: 4/4 screenshots (desktop/mobile ×
end/mid-growth) saved, 0 console errors.
**A real correctness bug found and fixed while building this** (not
just cosmetic): `limbGrowthProgress` originally revealed a limb's tube
by a smooth *time* ratio across its era. Merged-PR times within an era
can cluster unevenly (e.g. a burst right after the era starts, then a
long gap before one more PR merges much later — real shape of the
`pmndrs/valtio` fixture data), so a twig could already be popped
(`currentTime >= twig.time`) while the limb's time-ratio progress was
still far short of that twig's position along the polyline — the twig
and its leaves rendered floating past the limb's visible tip. Root-
caused by screenshotting `?t=0.5`, then bisecting with throwaway debug
colors per element category (leaves cyan, buds magenta, twigs green)
to identify which category the floating dots belonged to (turned out
to be twigs/leaves on the topmost limb, not buds as first suspected).
Fixed by revealing a limb by *twig count* instead (a twig's polyline
position is `index / (twigCount - 1)`, and revealing `grownTwigs /
totalTwigs` of the limb is provably always >= that fraction — see the
comment + regression test in `growth.ts`), plus rounding
`drawRangeForProgress` up (not to nearest) since ring granularity is
coarser than twig count, plus gating overflow-leaf (`twigId === null`)
pop-in on `limbFullyGrownTime` since their position is random along the
limb, not twig-indexed, plus gating buds on the trunk's own fully-grown
time. `ScatterInstances` also defensively moves not-yet-grown instances
to a far-away hidden position (not just zero scale), in case a
renderer treats a fully degenerate (zero-scale) instance as a stray
pixel.
**Residual, honestly reported**: at some intermediate growth fractions
for this specific fixture (e.g. `?t=0.5`), a handful of very small,
correctly-positioned, correctly-timed leaf/twig instances near the
crown of the tallest limb render as small isolated dots rather than
visibly connected to a branch — verified (via the same debug-color
technique) that this is *not* a floating-before-its-branch bug (the
underlying growth-progress data is now provably safe), but a
legibility issue: a real, sparse, mid-growth subset of that limb's
twigs is thin enough at this camera distance/scale that the connecting
twig line doesn't survive rasterization while the (larger) leaf card
does. Cosmetic, transient (only visible while scrubbed to specific
mid-growth fractions, not at the resting fully-grown state), and would
need either thicker twig radii or growth-state-aware twig visibility
tuning to fully resolve — flagging for T8's visual pass rather than
gold-plating further here.

### Polish bar assessment after T4/T5 (P1–P4, P12)
- **P1 Palette** — holds. Tokenized in `src/ui/theme/tokens.ts` (~10 base
  colors), shared by 3D (bark/soil/leaf-ramp/fruit/blossom/bud/sky/fog) and
  the scrubber UI. Real per-repo GitHub language colors drive soil strata,
  softened toward the palette via `softenToward`.
- **P2 Style** — holds. Flat-shaded low-poly throughout (via material
  `flatShading`, works with shared/indexed geometry since three derives
  face normals from screen-space derivatives, not vertex duplication);
  hemisphere + directional sun with VSM soft shadows sized to the tree's
  bounds; contact shadow under the floating island; warm sky gradient;
  light scene fog.
- **P3 Silhouette** — holds at the resting (fully-grown) state, verified on
  desktop and mobile screenshots: tapered trunk, real crown mass, every
  limb/twig/leaf attached (no intersecting-the-trunk or floating parts).
  Weaker during specific *mid-growth* scrub positions for this fixture (see
  T5 evidence above) — a legibility issue (thin twig vs. visible leaf at
  small scale), not a floating/attachment bug; flagged for T8.
- **P4 Motion** — holds. Idle wind sway (crown only, not trunk/island),
  eased ~10s auto-play growth, damped OrbitControls; all gated off under
  `prefers-reduced-motion` (sway disabled, growth jumps straight to the
  end). fps not benchmarked on real hardware (only verified via headless
  SwiftShader software rendering, which is not representative of real-GPU
  frame time) — recommend a manual check on a mid laptop before calling
  this fully verified.
- **P12 Perf & robustness** — holds for this fixture. Measured (via a
  temporary `renderer.info` hook, removed before commit): **50 draw
  calls** (island 1, contact-shadow ~a few, trunk 1, ≤16 individual limb
  meshes, twigs/leaves/fruit/flowers/buds each 1 instanced mesh) — under
  the "~60" target. 83k triangles for the `pmndrs/valtio` fixture (538
  merged PRs, 1230 leaves). Not yet verified against a 1000+-PR repo (T2's
  caps bound the *data*, but a repo with many more eras/twigs than this
  fixture hasn't been screenshotted) or a genuinely tiny/empty repo —
  recommend as a T8 check. Lazy-loaded 3D chunk confirmed (`Scene` chunk
  ~948 kB / gzip ~252 kB, separate from the ~233 kB / gzip ~74 kB initial
  bundle). Geometries are memoized on the model and disposed on
  unmount/model change (`useTreeGeometry`'s cleanup effect).

### Notes / gaps for the product owner
- **`.env.example` could not be created**: the sandbox's permission layer
  hard-denies any write to a path matching `.env*` (tested via both the Write
  tool and Bash — `cp`/`mv`/heredoc redirection — all denied), independent of
  content. Worked around by committing `env.example` (no leading dot) instead
  and documenting the copy-to-`.env` step in the README. If a real
  `.env.example` is wanted, someone with looser sandbox/permission settings
  will need to rename it (`git mv env.example .env.example`).
- Remote GitHub repo creation, `git push`, and deploy remain un-authorized
  per Scope — not attempted.

## Next step
T6 (navigation & inspection) — out of scope for this writer; hand back to
the orchestrator. `onElementHover`/`onElementSelect(id)` props already
flow through `TreeScene`/`Scene`/every instanced+individual mesh (twig
merged geometry resolves `event.instanceId` -> element id array; trunk/
limb meshes carry a fixed id) so T6 should be able to wire hover/click
without touching the renderer's internals — only the detail panel, focus
camera and era list remain.
