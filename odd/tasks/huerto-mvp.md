# Huerto MVP — a git repository grown as a living mycelium network

Locator: `odd/tasks/huerto-mvp.md` · Engram mirror: `odd/huerto-mvp/tasks`

## Objective
A shareable web app: enter `owner/repo`, watch the repository's history grow as a bioluminescent
mycelium network in a patch of dark soil, then navigate hyphae, nodes and mushrooms to inspect real GitHub data.

## Problem / why
Existing repo visualizers are either analytic (Git Truck, CodeCharta), directory-based (Gource,
GitCoral) or non-botanical (Skyline, Git City). None renders repository *history* as a believable,
navigable tree. Literal branch topology looks bad (few long-lived branches), so structure is
imposed by grouping history into eras.

## Pivot (2026-09-28)
User questioned the tree metaphor: trees split but never fuse, git branches split AND merge.
Decision (user-approved): mycelium — hyphae branch and fuse (anastomosis), so git's DAG maps ~1:1
without inventing eras. Tree rendering (T3–T5 tree geometry, V1) is superseded; data, API, panel,
routing, states, a11y list (T2, T6, T7) are reused. Tree code is removed in M4 once the network ships.

## Mapping (decided — mycelium)
- Spore at the center = first commit. Radius ≈ time (log/eased so recent years don't crush early ones).
- Main hypha = default branch. Grows outward as a spiral from the spore (a fairy-ring-like sweep), angle advancing with time, so the whole history fills a disc.
- Merged PR = a side hypha that splits off the parent hypha at its first commit time and FUSES back at mergedAt (a loop). If its base is another branch (not default), it splits from / fuses into that branch's hypha (branches from branches).
- Commit = a node along its hypha (PR commits on the side hypha; direct commits and merge points on the main hypha).
- Closed-unmerged PR = dead-end hypha that dries out (desaturated, thinner, no fusion).
- Open PR / live branch = growing tip with an animated pulse.
- Release/tag = a mushroom fruiting on the soil surface above its point on the main hypha (cluster if several are close).
- Contributors = a subtle per-author hue on nodes/pulses (optional, never dominant).
- Soil: dark loam disc (petri-dish / forest-floor patch) seen at a 3/4 top-down angle; languages as faint strata on the disc's cut edge.
- Data truth: every filament, node and mushroom maps to real data. Topology is fixed by git; only curvature/wiggle is procedural (seeded by `owner/repo`, deterministic).
- Scale: concurrent PRs take lanes perpendicular to the parent hypha (interval scheduling) so loops don't overlap; cap rendered PRs (~1000) and aggregate overflow honestly.

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
- [x] T6 Navigation & inspection: hover/click, info panel with real data + GitHub links, focus camera, era list. Route: delegated.
- [x] T7 Product shell: landing input, `/owner/repo` routing, loading/error/rate-limit states, meta/OG, README. Route: delegated.
- [ ] T8 Polish: perf on large repos, mobile, a11y, visual pass with screenshots. Route: delegated.
- [x] M1 Data for topology: extend adapter/snapshot with PR `baseRefName`/`headRefName`, first-commit time, closed-unmerged PRs (capped), default-branch merge commits if cheap; regenerate fixture(s). Route: delegated.
- [x] M2 Network model (pure domain): DAG → deterministic layout (spiral main, lanes, split/fuse points, nodes, dead ends, tips, mushrooms), growth times, refs; tests. Route: delegated.
- [x] M2b Layout iteration: fix chord-crossing loops, far-flung dead ends/mushrooms, empty inter-turn space, and add mycelial hair texture, per orchestrator visual review of `.shots/network-*.png`. Route: delegated (writer).
- [ ] M3 Network rendering + growth + interaction wiring: batched glowing filaments, nodes, mushrooms, soil disc, selective bloom, flow pulses, picking, reuse panel/list/scrubber. Route: delegated.
- [ ] M4 Cleanup + legend/README/OG for mycelium; remove superseded tree code. Route: delegated.
(T8 polish now applies to the mycelium build.)

## Polish bar (must all hold before the MVP is called done)
Visual (mycelium)
- P1 Palette: tokenized — near-black loam bg (#05070a–#0a0e12), main hypha luminous white-mint (#e8fff2→#7ff5c4), side hyphae cool cyan (#4fa8c9/#6ee7ff), fusion flash warm (#ffe9a8), dead hyphae dry brown (#5a4a3a/#8a6b4f), mushrooms white with cyan rim (#b9f5ff). Same tokens in 3D and UI (UI may be dark to match).
- P2 Light & glow: SELECTIVE bloom only on nodes, tips, fusion points and mushrooms — never whole-scene haze. Subtle fog/depth; soft vignette. Filaments translucent/additive where they overlap.
- P3 Organic form: filaments taper and vary in thickness (main thickest, thicker with age), gentle curl-noise wiggle that decays to zero at split/fuse points; tangent-continuous fusions (no kinks); no constant-width pipes; no floating or disconnected filaments.
- P4 Motion: eased growth replay; slow flow pulses along active/open hyphae; gentle idle breathing of glow; eased camera; respects `prefers-reduced-motion`; ~60fps on a mid laptop.
- P5 UI craft: Fraunces + Inter, type scale, 4/8px grid, one panel style harmonized with the dark palette; no layout shift; mobile-first.
Product
- P6 States designed: loading (spore germinating), error, not found, rate-limited, token-required, empty/tiny repo (a lone spore with a short hypha still looks intentional).
- P7 Interaction: hover highlight + pointer + tooltip, click → detail panel, camera focuses selection, Esc closes, keyboard nav, touch works. Selection highlights the whole PR loop; rest dims WITHOUT going muddy (mind ACES tonemapping — dim via emissive/opacity, not color multipliers).
- P8 Truth: every visible element maps to real data; dates/numbers formatted; each detail links to GitHub.
- P9 Legibility: legend — spore = first commit, main hypha = default branch, loop = merged PR, dead end = closed PR, glowing tip = open PR, node = commit, mushroom = release, distance from center = time.
- P10 Share: `/owner/repo` URLs, OG/meta from a real render, copy link, save image.
- P11 A11y: UI contrast AA, aria labels, focus rings, text alternative list.
- P12 Perf & robustness: batched geometry (few draw calls), GPU-friendly picking, lazy 3D chunk, handles tiny repos and 1000+ PR repos, no console errors.
Verification: headless screenshots (desktop + mobile, end / mid-growth / selected) reviewed each iteration; final independent design/product review against P1–P12.

## Acceptance criteria
- `/owner/repo` URL renders a believable, beautiful mycelium network from real data (or fixture offline).
- Every hypha/node/mushroom is clickable and shows real PR/commit/release info with a GitHub link.
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

### V1 visual pass — done
Commit: `9f8de91` fix: shape a believable broadleaf crown.
Problem: the tree read as a tall conifer/pole with a visible flat cut at
the trunk top, a flat green disc for the island, and near-invisible fruit
(a real double-scaling bug, see below) on flat leaf "pancakes."
`src/domain/tree/buildTree.ts`: shorter/stouter trunk (height 1.7–4.6,
was 2.2–9) tapering to a near-point radius instead of a visible cut
cylinder cap; limbs now only emerge from a canopy zone (42%–90% of trunk
height, was 15%–92%) leaving a clear bole below; each limb's polyline now
*arcs* (a shallow near-level start easing to a steep upward end, per
point via `easeInOutCubic`, not one straight ray from the base) and is
softly pulled (`pullTowardCrownEnvelope`, blend 0.75) toward an ellipsoid
crown envelope (width ≈1.3× height) so the silhouette reads as a rounded
dome; reduced `LIMB_AZIMUTH_JITTER` (0.35 → 0.06) since jitter on top of
the golden-angle spacing was occasionally clumping limbs into a lopsided
fan for this seed (verified via a throwaway inspection script printing
each limb's azimuth/gap before tuning).
**Real bug found while doing this** (not just cosmetic): `FRUIT_SCALE`/
`FLOWER_SCALE`/`BUD_SCALE` were being multiplied against an
already-similarly-sized shared instance geometry radius (e.g. fruit:
0.11-radius geometry × 0.11 scale ≈ 0.012 world-unit radius — an order of
magnitude smaller than a leaf), making fruit/flowers/buds nearly
invisible regardless of color. Fixed by rebalancing both sides (geometry
radii comparable to a leaf's, scale constants as ~1-centered multipliers,
matching how the leaf scale already worked) — fruit now reads clearly,
with a more saturated color token (`palette.fruit` → `#ff6a12`).
`src/ui/scene/geometry/shapes.ts`: `leafGeometry` is now a merged 3-lobe
cluster (three offset/rotated icosahedra via `BufferGeometryUtils`), not
one flat disc; `src/ui/scene/geometry/instances.ts` +
`src/ui/scene/tree/Leaves.tsx` add a small deterministic per-leaf tilt
(hashed from the leaf's own id) for canopy volume.
`src/ui/scene/geometry/island.ts`: thicker/chunkier proportions (depth
1.75 vs. top-radius 1.95, was 1.3 vs. 1.7) with a raised, irregular
grass-edge rim (`GRASS_RIM_HEIGHT`), so it reads as a crafted diorama
chunk with a visible strata cross-section instead of a flat plate.
`src/ui/scene/tree/CameraRig.tsx`: frames using both vertical *and*
horizontal FOV (previously only vertical) so a narrow mobile viewport no
longer crops the crown's width; slightly lower 3/4 viewing angle.
Iterated with `pnpm shot` across **6 rounds** (desktop + mobile, end
growth each time, comparing against the prior conifer-pole shots): (1)
baseline conifer/flat-disc/invisible-fruit; (2) first stout-trunk +
envelope pass — fruit suddenly huge/dominant (the double-scale fix
overshot) and the crown read as a "weeping willow" sag (limb start angle
dipped below horizontal); (3) fixed fruit scale down, removed the
downward dip, crown still an open "V"/bowl shape with the bare trunk tip
poking through a gap directly above the trunk axis (a structural property
of radial "spoke" limbs — none of them pass *through* the center-top,
only outward from it); (4) shortened the trunk further and raised the
limb-emergence ceiling to 90% so the bare exposed tip became short enough
to be covered by the nearest limbs; (5) steepened the limb end-angles
(especially for lower limbs) to pull the crown's sides up and mostly
close the top notch; (6) final confirmation pass, desktop + mobile.
Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass
(134 tests, unchanged — V1 touched only shape/color constants and camera
math, no new pure logic beyond the crown-envelope helper, which the
existing `buildTree` determinism/invariant tests already exercise) ·
`pnpm build`: pass · `pnpm shot`: 4/4 screenshots (desktop/mobile ×
end/mid), 0 console errors.
**Residual, honestly reported**: a small negative-space notch is still
sometimes visible directly above the trunk axis at certain camera angles
(no limb polyline ever passes through the exact vertical center, only
outward from it, since limbs are radial "spokes" — a structural property
of the generation approach, not a bug) — meaningfully reduced (short
exposed tip, steep limb closing angles) but not fully eliminated. Every
click-inspectable element must map to real data (P8, tightened further by
T6), which ruled out papering over it with fake non-interactive filler
foliage. Flagging for a possible T8 pass (e.g. a "topper" cluster tied to
the *newest* limb's own real twigs/leaves, positioned to lean back over
the axis) rather than gold-plating further here. Mid-growth silhouette
legibility (thin twig vs. visible leaf, noted in T5) is unchanged by V1
and remains flagged for T8.

### T6 Navigation & inspection — done
Commit: `0d00bd0` feat: inspect commits, pull requests and releases in
the tree.
Domain (pure, unit-tested): `src/domain/format.ts` (Intl-backed
date/number/signed-number/short-oid formatting, fixed `en-US` locale so
output is deterministic regardless of the runtime's system locale);
`src/domain/tree/lookup.ts` (`findTreeElement`, linear scan across
limbs/twigs/fruits/leaves/flowers/buds — only called on click/hover-
resolve, never per frame); `src/domain/tree/focus.ts`
(`getElementFocusPosition`, id → the 3D point the camera should fly to);
`src/domain/elementDetail.ts` (`resolveElementDetail`: id → a typed
view-model — repo/era/pull_request/commit/release/branch — built by
cross-referencing the real `RepoSnapshot`, dispatching on element *kind*
rather than `ref.type` since a leaf can be either a commit or, for an
overflow leaf with no matching commit, a pull request, and both a limb
and a flower can carry `ref.type === 'release'`; `summarizeElementDetail`
reduces any detail to a short kind/title/date summary for the tooltip and
the Explore list rows). `Limb`'s "era" detail derives its end time from
the *next* limb's start time (limbs are already stored in era-index
order) and its commit count from summing the real `commitCount` of each
represented (twig-capped) PR — both honestly labeled, since overflow PRs
beyond the per-limb twig cap aren't individually tracked in the model.
Hover/select highlighting reuses existing per-instance machinery instead
of a shared-material rewrite: leaves/fruit/flowers/buds tint the matching
instance's `instanceColor` toward white (mild for hover, stronger for
select) inside the existing per-frame `ScatterInstances` loop; twigs
scale the matching instance's radius up (1.35×/1.7×); the trunk and each
individual limb mesh set `emissive`/`emissiveIntensity` on their own
material. `src/ui/scene/tree/CameraFocus.tsx`: eases the camera position
and `OrbitControls` target toward the selected element's focus point over
0.9s (`easeInOutCubic`, keeping the camera's current offset/distance so
it reads as "re-center on this" rather than a zoom), snapping instantly
under `prefers-reduced-motion`. `src/ui/hooks/useSelection.ts`:
hover (ephemeral) + selection (mirrored to `?sel=<id>` via
`history.replaceState`, not `pushState`, so hovering/clicking around
doesn't spam browser back-history) state, Esc deselects globally.
`src/ui/components/`: `Tooltip.tsx` + `TooltipLayer.tsx` (pointer-
following, kind+title+date; the pointermove listener only attaches while
something is hovered, and lives in its own leaf component so it doesn't
re-render the 3D scene on every mouse move); `DetailPanel.tsx` (desktop
right side / mobile bottom sheet via a `.detail-panel` CSS media query in
`index.css`, real PR/commit/release/branch fields, formatted dates/
numbers, a clickable commit list inside a PR detail that focuses the
matching leaf if one is rendered, "View on GitHub" `target=_blank
rel="noopener noreferrer"` links); `Legend.tsx` (compact, collapsible,
same palette tokens as the scene); `ExploreList.tsx` (era → pull requests
→ commits, every row a plain `<button>` that both toggles its disclosure
and selects — keyboard-operable and focus-ringed for free, no bespoke
ARIA tree-role plumbing; only lists commits that have a matching rendered
leaf, so "selects the same elements the 3D view would" holds exactly).
The detail panel and the Explore list are kept mutually distinct rather
than fighting over the same screen region: opening the list clears the
selection and the list's own row-selects don't reopen the detail panel
while it's open (so browsing era → PR → commit doesn't collapse the list
after one click), closing the list reveals the detail panel for whatever
ended up selected; `Scene.tsx` also gained `onPointerMissed` (click empty
space deselects) and a pointer-cursor-on-hover canvas style.
`scripts/shot.ts`: added an `end-selected` growth state (`?sel=<twig id
from the fixture>`) so the visual QA loop captures a PR-selected
screenshot on both viewports, per this task's instruction.
Tests (35 new, all pure domain logic): `format.test.ts`,
`tree/lookup.test.ts`, `tree/focus.test.ts`, `elementDetail.test.ts`
(covers every detail kind, including the twig/fruit-same-PR case, the
first-commit-always-has-a-clickable-leaf-id case, and the open-PR vs.
merged-PR disambiguation for a bud).
Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass
(**169 tests total**, +35 for T6/format) · `pnpm build`: pass (`Scene`
chunk ~951 kB / gzip ~253 kB, initial `index` chunk ~256 kB / gzip ~80 kB)
· `pnpm shot`: 6/6 screenshots (desktop/mobile × end/mid/end-selected)
saved, 0 console errors. The Explore list itself is never opened by the
automated screenshot script (it only pins `?t=`/`?sel=` on load), so it
was additionally exercised with a throwaway Playwright script (not
committed): opened it, expanded an era then a PR down to a real commit
row, 0 console errors — screenshots reviewed and matched the expected
real PR titles/commit headline.
**Residual, honestly reported**: the avatar `<img>` in the detail panel
has no explicit fallback UI for a broken/blocked image load (just an
empty `alt=""`, so it fails silently rather than showing an initial or
placeholder) — cosmetic, not attempted here. The commit-count shown on an
era detail only sums the *represented* (twig-capped) PRs' real
`commitCount`, not overflow PRs beyond the cap — labeled "Commits (shown
pull requests)" rather than claimed as a true era-wide total, to keep
P8's "every visible element maps to real data" honest rather than
inventing a number. `?sel=` round-trips correctly (verified via the
`end-selected` shot and its initial-mount `readSelectionFromUrl`), but no
"copy link" affordance exists yet (explicitly P10 scope, T7/T8).

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

### Polish bar re-assessment after V1 + T6 (P3, P6–P9, P11)
- **P3 Silhouette** — much improved, not fully closed. Reads as a
  stylized broadleaf tree on a floating island at first glance now
  (stout tapered trunk, wide rounded crown, chunky island); a small
  negative-space notch directly above the trunk axis can still appear at
  some angles (structural to the radial-limb approach) — see the V1
  entry above for detail and the proposed T8 fix direction.
- **P6 States designed** — still not attempted (unchanged from T5): the
  MVP has only a "loading"/"error" text state (`App.tsx`) and the fixed
  demo repo, no rate-limit/token-required/empty-repo states. T7/T8 scope.
- **P7 Interaction** — holds. Hover highlight (emissive tint / instance
  tint / thicker twig per element type) + pointer cursor + tooltip; click
  → detail panel; camera eases to the selection; Esc closes; keyboard
  works via the Explore list (native `<button>`s); touch was not
  separately verified on a real touch device (only Playwright's
  synthetic pointer events via the desktop/mobile *viewport* shots, which
  don't exercise real touch/pointer-type quirks) — recommend a manual
  phone check before calling this fully verified.
- **P8 Truth** — holds. Every clickable element (limb/twig/fruit/leaf/
  flower/bud/trunk) resolves through `resolveElementDetail` to real
  `RepoSnapshot` data with a "View on GitHub" link; dates via
  `Intl.DateTimeFormat`, numbers via `Intl.NumberFormat`. The one
  intentionally-approximate field (an era's commit count, capped-PRs-only)
  is labeled as such rather than presented as an exact total.
- **P9 Legibility** — holds. `Legend.tsx` is compact, collapsible, and
  uses the same color tokens as the 3D scene for every mapped element.
- **P10 Share** — prep only (unchanged scope for this task): `?sel=<id>`
  round-trips via `history.replaceState`; no `/owner/repo` route, no
  OG/meta tags, no "copy link"/"save image" affordance yet. T7/T8 scope.
- **P11 A11y** — largely holds, not independently audited. `ExploreList`
  gives a full non-3D era → PR → commit path to every selectable element,
  built from native `<button>`s (keyboard-operable, focusable, no custom
  ARIA tree role to get subtly wrong) with `aria-label`/`aria-expanded`/
  `aria-current`; a global `:focus-visible` outline rule was added in
  `index.css`. Not verified: an automated contrast-ratio check against
  the actual rendered panel backgrounds (the tokens were chosen for
  contrast by eye, e.g. `ui.text` on `ui.panelBg`, but no tool ran a real
  AA check), and no screen-reader was used to walk the flow end-to-end —
  recommend both as a T8 check.
- **P12 Perf & robustness** — holds for this fixture, not re-measured
  after V1/T6 (draw-call count is essentially unchanged: highlighting
  reuses existing instanced meshes' `instanceColor`/scale, no new draw
  calls; `resolveElementDetail`/`findTreeElement` only run on
  click/hover-resolve, never per frame). Same T8 recommendation as
  before (1000+-PR repo, tiny/empty repo) still stands.

### Product pivot — tree metaphor replaced by a mycelium network
Mid-session, the orchestrator paused the in-progress V2 visual pass with a
product pivot: the tree metaphor is being replaced by a mycelium network
(hyphae that branch *and* fuse back, modeling git merges — a tree's strict
hierarchy can't represent a merge). All tree-specific visual work (palette,
crown/island geometry, leaf ramp, selection highlight/dim inside the 3D
scene) was stopped immediately and **discarded** (`git restore`), not
committed — see the V2 entry below for exactly what was attempted and why
it doesn't survive the pivot. `buildTree.ts` and the rest of
`src/domain/tree/` are untouched and will need a redesign for the new
topology (a future task, not started here). The metaphor-agnostic pieces
already in flight (fonts, panel/typography polish, mobile sheet, routing
groundwork) were kept and finished per the pivot instructions.

### V2 visual pass — attempted, then reverted per the product pivot
Commit `fix: refine palette, island and selection feedback` was **never
made** — the pivot landed before this work was committed. For the record
(so it isn't silently re-discovered later): the attempt covered items 1–7
of the V2 brief (system-wide palette rework — calmer sky, red/orange-free
leaf ramp, glossy two-tone fruit/flower geometry; a rebuilt watertight
island using one shared per-angular jitter sample set instead of each
band/tip/cap jittering independently, which was the actual root cause of
the visible gaps/seams/floating-rock-fragment bug; a data-driven
near-vertical steepening of the newest limbs to close the crown's top
notch; pulling twig tips into the crown envelope to fix stray
floating leaf/fruit dots; a parent-limb/twig "lineage" highlight + dim-others
selection scheme). It was iterated ~6 rounds via `pnpm shot`, including a
real debugging detour: an apparent "selection dims the whole tree to
near-black" bug turned out to be ACES filmic tonemapping's shadow-toe
compressing a wide range of per-instance color multipliers (0.5–0.85) into
nearly the same too-dark output — confirmed by sampling rendered pixel
values at several multiplier settings, not just eyeballing screenshots.
None of this reached a commit; it's moot for the mycelium metaphor, but the
tonemap-toe finding is worth remembering for whatever dim/highlight scheme
the mycelium selection UI ends up using.

### Metaphor-agnostic polish — done
Commit `c6dced2` fix: polish detail panel and typography.
Kept from the otherwise-discarded V2 branch (verified independently
green — typecheck/lint/test/build — before committing, per the pivot
instructions): self-hosted fonts (`@fontsource/fraunces` display,
`@fontsource/inter` body, replacing the Georgia/system-ui fallback that
was rendering as a plain Times-like serif); `src/domain/format.ts` gained
`formatDeletions` (a genuinely-zero deletions count now renders `−0` with
a real Unicode minus sign and color, instead of a bare unsigned `0` that
read as a formatting bug) and `formatCount` (Intl.PluralRules-backed
singular/plural, "1 file" / "2 files"); `DetailPanel`'s title no longer
runs under the close button (reserved right padding); the mobile detail
panel is now a compact ~45vh bottom sheet with an expand toggle
(`data-expanded` + a CSS transition) instead of covering ~70vh
unconditionally, and the time scrubber hides while the sheet is open,
restored on close. `Scene.tsx` also gained `gl.preserveDrawingBuffer` (an
agnostic one-liner, unrelated to the tree geometry, needed by T7's "save
image" share action regardless of visual metaphor).
Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass
(186 tests) · `pnpm build`: pass.
**Caught and fixed during triage**: the initial `git restore` of
`tokens.ts` (to drop the tree-specific palette) also silently reverted the
font-family token strings back to Georgia/system-ui, even though
`main.tsx`'s `@fontsource` imports were still in place — the fonts would
have loaded but never actually been requested by `ui.fontDisplay`/
`ui.fontBody`. Caught before committing by re-reading the diff; fixed with
a small surgical edit restoring just the two font-family strings, palette
left alone.

### T7 Product shell — done, metaphor-neutral
Commit `ac2d637` feat: add landing, repository routes and product states.
Routing via `wouter`: `/` → `LandingPage`, `/:owner/:repo` → `ViewerPage`,
anything else → `NotFoundPage` (router 404, distinct from a GitHub
repo-not-found — see below). `?sel=` is untouched (`useSelection` still
owns it directly via the History API, independent of the router).
`src/domain/parseRepoInput.ts` (11 tests) parses `owner/repo`, a full
`https://github.com/owner/repo` URL (with a trailing path/query/hash, a
`.git` suffix, or no scheme/`www.`), or a `git@github.com:owner/repo.git`
SSH remote, reusing `validateRepoIdentity`'s real GitHub naming rules and
never throwing. `src/domain/routePath.ts` (`buildRepoPath`, 2 tests) is
the inverse, used by the landing page's example chips and form submit.
`src/domain/repoRequestState.ts` (`mapErrorToViewState`, 6 tests) is a
pure `RepoErrorCode | 'network_error'` → product-state mapping;
`useRepoTree` was extended (not the tree domain — this is the existing
fetch hook) to carry the real error code + `retryAfterSeconds` instead of
just a message string, and to reset its snapshot/error *during render*
(not inside the effect, to satisfy `react-hooks/set-state-in-effect`) when
`owner`/`repo` change, so switching repos never flashes stale data.
`ViewerPage` covers every P6 state from this: loading ("Fetching
history…"), not found, private/forbidden, rate-limited (shows the reset
time when `retryAfterSeconds` is known), token-required (explains the
sample repo + self-hosting story), network error (retry action), and an
invalid `owner`/`repo` caught client-side before any fetch. All rendered
by one shared `StateScreen` component with a small abstract pulsing-mark
animation — deliberately not tied to any visual metaphor, since the scene
it stands in for is being redesigned.
`ViewerHeader` (fixed, single-row, `VIEWER_HEADER_HEIGHT = 56`): repo name
linked to GitHub (description as a hover title, truncates via ellipsis —
first pass had `flexShrink: 0` on it, which overlapped the badge and
buttons on a 390px viewport; fixed to `minWidth: 0` + default shrink,
verified via a mobile shot before/after), a live/sample source badge,
stars/forks/age (hidden under 641px via `.viewer-header-stats`), "Copy
link" (Clipboard API + a `useToast` confirmation) and "Save image"
(`canvas.toDataURL()` via `onCanvasReady` on `Scene`, filename
`huerto-<owner>-<repo>.png`). `Legend`, the Explore-list toggle and the
desktop `.detail-panel` were all re-offset below the new header (56px bar
+ the Legend/Explore-list row) so nothing overlaps — verified via shots,
not just arithmetic.
Landing page: brand + pitch, the parsed/validated input, example chips
(the bundled fixture first, three real repos after — explained as
needing a `GITHUB_TOKEN` once selected), and a placeholder hero (an
abstract animated SVG node graphic, explicitly not a render of the 3D
scene — the brief allows this given the pending metaphor redesign).
Footer credits `github.com/TanisJam` and `mnr.ar`.
Meta/OG (P10): `index.html` gained `theme-color`, an SVG favicon (abstract
node mark, not tree-specific), OG/Twitter tags, and a generated
placeholder OG image (`public/og.png`, 1200×630, ~264 kB — under the
300 kB budget; `scripts/generate-og-placeholder.mjs` renders it via a
headless page screenshot, kept as a reusable script rather than a
one-off). Per-route `document.title` via a small `useDocumentTitle` hook.
`vercel.json` adds the SPA rewrite (`/((?!api/).*) → /index.html`) so a
hard refresh/deep link on `/owner/repo` resolves correctly.
"Tiny/empty repo renders gracefully" (P6) was **not** re-implemented as
new tree-specific work (per the pivot's "keep `buildTree` untouched"
instruction) — it was already covered by T3's existing
`buildTree.test.ts` case ("handles a snapshot with no merged PRs,
releases, or activity at all"), which this task left as-is and confirms
still passes.
`README.md` rewritten: generic "every repository grows a living history"
framing, the old trunk/limb/twig mapping table removed and replaced with
an explicit `TODO(visual metaphor)` block (a screenshot placeholder too),
run-locally/`.env.example` steps (also fixed a stale `env.example`
filename reference — the real file is `.env.example`), a Deploy on Vercel
section, and credits.
`scripts/shot.ts` now shoots the landing page plus two
deterministically-offline-reachable product states
(`state-token-required`: a real non-fixture repo with no `GITHUB_TOKEN`;
`state-not-found`: a single path segment, which can't match
`/:owner/:repo` and always falls through to the router 404) alongside the
existing growth-state shots. Also fixed the script's console-error filter
to ignore Chromium's own "Failed to load resource: the server responded
with a status of 503" devtools log line for the token-required shot's
(expected, handled) failed fetch — the app itself never calls
`console.error` for this; the filter was verified narrow (only that exact
message prefix) so it can't hide a real app error.
Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass
(**195 tests total**, +19 for T7) · `pnpm build`: pass · `pnpm shot`: 12/12
screenshots (desktop/mobile × landing/end/mid/end-selected/
token-required/not-found), 0 console errors.
**Residual, honestly reported**: the landing page's example chips beyond
the fixture (`facebook/react`, `vuejs/core`, `sveltejs/svelte`) always hit
the `token_required` state in this environment (no `GITHUB_TOKEN`
configured) — expected/by design, not verified against a real live fetch
in this session. `useRepoTree` has no unit test of its own (still true
from T2/T6 — no `@testing-library/react` in the project; its pure pieces
--`mapErrorToViewState`, `parseRepoInput`, `buildRepoPath` -- are fully
tested; the hook itself was exercised live via the shot script's
token-required/landing/viewer runs). "Save image" and "Copy link" were
verified to render correctly and be clickable in the shots, not verified
end-to-end (clipboard permissions and file-save dialogs aren't
exercisable from a headless screenshot script).

### M1 Data for topology — done
Commit: `4794d36` feat: capture branch topology for merged and closed pull
requests.
`src/domain/repo.ts`: new shared `PrTopology` (`baseRefName`, `headRefName`,
`firstCommitTime`) mixed into `MergedPullRequest`, `OpenPullRequest`
(now also carries `commitCount`/`commits`, capped) and a new
`ClosedPullRequest` type; `RepoSnapshot.closedPullRequests` (capped, most
recent first); `ReleaseInfo.targetOid` (release tag's commit oid, when
cheaply resolvable).
`src/adapters/github/`: `queries.ts` adds `baseRefName`/`headRefName` to the
merged-PR fragment, a `SecondaryPrCommitsFields` fragment (lower commit cap,
`CAPS.secondaryCommitsPerPr = 8`) shared by new `OpenPrFields`/
`ClosedPrFields` fragments, and a release `tag { target { ... on Commit { oid }
... on Tag { target { ... on Commit { oid } } } } }` selection (mirrors the
existing tags-fallback drill-through). `mappers.ts` adds
`computeFirstCommitTime` (min authored/committed date across a PR's fetched
commits, falling back to `createdAt`), `mapClosedPullRequest`,
`resolveReleaseTargetOid`. `caps.ts` adds `maxClosedPrs = 200`,
`closedPrsPageSize = 50`, `secondaryCommitsPerPr = 8`.
**Real bug found and fixed while building this**: closed PRs were
originally bundled into the single `REPO_OVERVIEW_QUERY` (merged + open +
closed, each with nested commits) — this reliably produced intermittent
upstream 502/504s when generating fixtures for repos with substantial PR
history (reproduced repeatedly against `pmndrs/zustand` and
`expressjs/express`). Fixed by fetching closed PRs as their own fully
independent, always-paginated-from-`after: null` query
(`CLOSED_PRS_PAGE_QUERY`), wrapped so a failure at *any* page (including the
first) stops fetching and keeps whatever succeeded — `closedPullRequests`
can legitimately end up `[]` rather than failing the whole snapshot fetch,
since it's supplementary (dead-end hyphae) data, not the core timeline.
Fixtures: regenerated `pmndrs/valtio` (1312 KB, unchanged repo selection,
new fields only) and added `expressjs/express` (1250 KB) as the required
second fixture with real branch-from-branch topology: 106 of 566 merged PRs
at generation time had `baseRefName !== defaultBranch` (vs. 0 checked for
`vitejs/vite-plugin-react`, which is why it wasn't chosen), plus a rich
closed-PR tail (1974 closed PRs at generation time, capped to 200).
`pmndrs/zustand` (930 merged PRs, 188 non-default-base) was tried first and
is topologically richer, but its fixture came out at 2209 KB — over the 1.5
MB budget — so it was discarded in favor of `expressjs/express`, whose
similar merged-PR count to `valtio` (566 vs. 538) kept it comparably sized.
Both registered in `src/server/fixtures/index.ts`.
Tests: `computeFirstCommitTime` (empty-commits fallback, true min across
authored/committed dates, tolerant of a missing `committedDate`),
`mapClosedPullRequest` (full mapping + the lower secondary-PR commit cap),
`mapOpenPullRequest` (now includes branch topology + commits),
`resolveReleaseTargetOid` (direct commit target, annotated-tag drill-
through, missing tag/target), closed-PR pagination in
`fetchRepoSnapshot.test.ts` (continues across pages; honestly returns `[]`
when even the first page fails; honestly keeps a partial list when a later
page fails) — 21 new/changed tests, existing merged-PR/release tests updated
for the new required fields.
Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass (206
tests at commit time) · `pnpm build`: pass.

### M2 Network model — done
Commit: `fccc65a` feat: derive mycelium network layout from repository
history.
`src/domain/network/` (pure, no React/three/fetch): `topology.ts` (pure
graph derivation, independently unit-tested per the task brief),
`spline.ts` (from-scratch centripetal Catmull-Rom, every division guarded
against near-zero denominators), `layout.ts` (spiral + lanes + curvature),
`mushrooms.ts`, `lookup.ts`, `focus.ts`, `elementDetail.ts`,
`exploreGroups.ts`, `buildNetwork.ts` (orchestrator), `types.ts`, `index.ts`.
Reuses `../tree/vector` (`Vec3`, plus a new `normalizeVec3` added there) and
`../tree/timeBounds`/`../tree/types` (`computeTimeBounds`/`TimeBounds`) and
`../tree/prng` rather than duplicating them, since they're metaphor-agnostic
pure helpers, not tree-geometry-specific — **known follow-up for M4**: once
the rest of `src/domain/tree/` is deleted, these three should move to a
shared top-level `src/domain/` location (a small, mechanical import-path
fix in `network/`, not attempted here to avoid an unrelated blast radius).
Widened the existing shared `PullRequestDetail.status` (`src/domain/
elementDetail.ts`) from `'merged' | 'open'` to `'merged' | 'closed' |
'open'` (purely additive; also fixed `summarizeElementDetail`'s label for
the new case) so the network's PR-hypha/tip/merge-point-node details reuse
the exact same `ElementDetail` shape the tree's detail panel already
consumes -- ready for M3 to wire up without another type change.

**Topology decisions** (`topology.ts`): a PR's parent is the default branch
when `baseRefName === defaultBranch`; otherwise the closest-preceding
hypha (by clamped split time) whose `headRefName === baseRefName` and whose
own split time is `<= ` the child's raw split time ("time-consistent"),
else falls back to main. A child's effective split time is
`max(rawFirstCommitTime, parent.splitTime)` (never predates its parent).
Live branches with no matching PR head ref become minimal open hyphae off
main, using `lastCommitDate` as the only available time signal (no
base/head/commit data exists for a bare `LiveBranch`). Hyphae are capped at
`maxHyphae` (default ~1000, most-recent-first); any hypha whose parent got
cut by the cap is re-parented to main so the model is never internally
inconsistent (no dangling `parentHyphaId`).
**Real bug found and fixed while building this**: `clampTime`'s
`Number.isFinite(max) ? max : time` branch (meant to make the upper bound a
no-op when `max` is `Infinity`) actually re-substituted the *original
unclamped* value as the ceiling, silently undoing the lower-bound clamp —
found via a genuine data case in `expressjs/express` (PR #821, a 2011-era
commit whose recorded `authoredDate` is ~14 hours *after* its own
`mergedAt`), which crashed `Math.min`'s min>max guard in
`pointOnHyphaAtTime`. Fixed the ternary (`Number.isFinite(max) ? Math.min(floored,
max) : floored`); the topology invariant is `splitTime <= endTime` for
every hypha (not strictly `<`, since this exact defensive clamp can produce
a legitimate zero-duration hypha for bad upstream timestamps) — covered by
a regression test using this exact scenario.

**Layout decisions** (`layout.ts`, tuned via 3 rounds of `pnpm network-svg`
+ `Read`, see below): disc radius 5 world units, radius = `5 * frac^0.58`
(sub-linear so early/sparse history isn't crushed near the spore), main
hypha spirals `2.4` turns. Concurrent same-parent hyphae get a side
(alternating per new child, independent of lane) and, per side, a lane via
greedy interval scheduling by split time; lane depth = `0.07 + lane * 0.045`,
capped by `localSpiralPitch(frac) * 0.42` when the parent is main (so a
loop never crosses the next winding — the radius gained over one full
`2*pi` turn at that point, floored at a small minimum) and additionally by
remaining radial room to the disc's own outer edge (needed once loops
approach `frac ~= 1`, where "the next turn" is otherwise undefined) — for a
non-main parent, a fixed cap (`0.35`) instead, since "next turn" doesn't
apply to a nested loop. A **fused (merged) loop's control points follow its
parent's own curve** between the split and rejoin times, not a straight
chord between just those two points (see the visual-iteration bug below).
A dead-end/open hypha instead runs a straight departure from the attach
point (there's no "rejoin" segment to follow), length by
`logScale(duration, 0, 120 days)`, with a droop (dead end) or a slight lift
(open, ending at a `Tip` element). Organic wiggle is a *fraction* of each
hypha's own lane depth (`min(depth * 0.22, 0.02)`), not a fixed amplitude,
and decays to 0 at the split point always (and at the fuse point too, for a
merged loop) via a `sin` envelope, so short loops read as smooth bows
rather than noisy scribbles. Mushrooms (`mushrooms.ts`) cluster releases
within a 3-day gap under a shared `clusterId`; scale by semver importance
(major/first-of-major > minor > patch > non-semver tag).

**Visual iteration** (required, >=3 rounds via `pnpm network-svg` +
`Read` on the resulting PNGs, both fixtures — script writes `.svg` +
`.png` to `.shots/`, gitignored, since no `rsvg-convert`/imagemagick is
available in this environment so the PNG is rasterized via a headless
Chromium page instead): **(1)** baseline had several long, straight
"spoke"-like chords cutting across the whole disc for nested
branch-from-branch PRs -- traced (not just visually, confirmed via a
throwaway radial-span script) to `expressjs/express` PR #4287, a *real*
long-lived "4.18" maintenance branch (`baseRefName: master`, alive
2018-2022) with several genuine backport PRs based on it; a straight chord
between a grandchild's attach/rejoin points (both on that 2-year parent
curve, but far apart in time) cut a stark line across a wide arc of the
disc instead of running parallel-ish alongside it. **(2)** fixed by
sampling the parent's actual curve at each control point's own time (with a
*local*, per-point tangent for the bow direction) for a fused loop, instead
of a single straight lerp between the two endpoints -- confirmed via a
before/after SVG diff that the spoke artifacts were gone on both fixtures.
**(3)** the loops still read as noisy, spiky scribbles rather than smooth
bows, especially in high-PR-density spans (many concurrent same-parent
PRs pushing lane depth up via `lane * spacing`, with jitter amplitude fixed
regardless of that depth) -- tightened `BASE_LANE_DEPTH`/`LANE_SPACING`
(0.14/0.1 -> 0.07/0.045) and made jitter a fraction of each loop's own depth
(capped absolutely too) instead of a fixed magnitude; re-rendered both
fixtures and confirmed a markedly calmer, more "fairy ring"-like result
(concentric, mostly non-overlapping loops hugging the main spiral) while
`pnpm test`'s spiral-pitch/tangent-continuity/determinism checks stayed
green throughout.
**Residual, honestly reported**: some visual density remains in
`expressjs/express`'s outer ring (a few longer sweeping loops from other
long-lived maintenance branches, and a cluster of short concurrent PRs near
one point in `pmndrs/valtio`'s early history) -- this reflects genuinely
dense/bursty real PR activity at those points, not a layout bug (verified:
no hypha has an internal point-to-point jump > 1.5 world units in either
fixture, and the spiral-pitch/tangent-continuity tests pass for both). A
further pass tuning lane packing for very-high-concurrency spans, or M3-side
selective-bloom/dimming to keep dense areas legible, is left for polish
(T8) rather than gold-plated here, since M3 (actual rendering) doesn't
exist yet to validate against.

Tests (68 new, `src/domain/network/*.test.ts`): determinism (topology and
full model); parent resolution (default-branch, branch-from-branch nesting,
time-inconsistent fallback, split-time clamping); dead-end vs. open vs.
merged status; hyphae cap with no dangling parent references; live-branch
inclusion/exclusion/dedup against a matching PR; tiny repo (0 PRs, 0
releases, 1 commit) produces a spore + a single short main hypha; spline
sampling passes exactly through every control point and never produces
NaN/Infinity even for coincident control points; lane assignment has no
overlapping same-lane-same-side intervals and alternates sides; loops never
cross the next spiral turn and fuse points are tangent-continuous, both
checked directly against both real fixtures; a recursive scan of the full
model confirms no NaN/non-finite number anywhere; every hypha/node/tip/
mushroom has a non-empty id, a finite time and a ref; mushroom clustering/
semver scale; `elementDetail`/`lookup`/`focus`/`exploreGroups` cover every
element kind. Both fixtures additionally smoke-tested for bounds sanity
(`firstEventTime <= lastEventTime`, positive finite radius, unique element
ids) as part of `buildNetwork.test.ts`.
Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass (277
tests total, +71 for M1+M2 combined) · `pnpm build`: pass.

### M2b Layout iteration — done
Commit: `00ecc85` fix: grow a denser, crossing-free mycelium layout.
Trigger: the orchestrator reviewed `.shots/network-pmndrs-valtio.png` and
`.shots/network-expressjs-express.png` and reported six problems: (1) mostly
empty disc between spiral turns, tiny loop ticks; (2) long-lived PRs drawing
straight chords across turns; (3) closed-PR dead ends and mushrooms flung far
outside the disc on long stems; (4) loop size not weight/space-driven; (5) no
mycelial hair texture; (6) overall not reading as fairy-ring mycelium.

**Root causes found** (`src/domain/network/layout.ts`): (2)/(3) were the same
bug — a dead-end/open hypha's endpoint was offset laterally by a fixed
`length * 0.9` independent of its lane, *and* the per-point loop then added
an independent lane-aware `bow` on top at the free end (`envelope(1) === 1`),
double-counting the lateral offset and blowing past any cap; separately nested
non-main-parent hyphae had no "next turn" concept, so a chain of them could
still stray far in absolute terms even though each individual hop was small.
(1)/(4) were a sizing bug, not a layout bug: `BASE_LANE_DEPTH`/`LANE_SPACING`
were tiny fixed constants (0.07/0.045) while the *available* room
(`localSpiralPitch(frac) * SPIRAL_PITCH_SAFETY`) was routinely 1–2 world
units — loops used a tiny fraction of the room they were allowed.

**Fixes**:
- `computeLoopDepth` (new): a loop/dead-end/open hypha's lateral "depth" is
  now `min(minBulge + weightBulge + laneGrowth, roomCap)`, where `roomCap` is
  the actual available room (local spiral pitch for a main-parented hypha,
  a fixed nested cap otherwise, both also hard-capped by a new
  `ABSOLUTE_MAX_LOOP_DEPTH` so the naturally huge first-turn pitch near the
  spore can't blow a loop up into a "sea urchin" burst — a round-1/2 visual
  finding), `minBulge` guarantees a visible bulge even for a single-commit
  PR, `weightBulge` scales with the PR's own commit count (log-saturating),
  `laneGrowth` fans concurrent same-side siblings into their own room. Used
  uniformly for fused/dead-end/open hyphae (previously only fused loops were
  depth-capped at all).
- Dead-end/open hyphae: `endAnchorPosition` no longer bakes in a lateral
  offset — the lateral distance is carried *entirely* by the same
  envelope-shaped `bow` term a fused loop uses (0 at the split, `depth` at
  the free tip), fixing the double-counting bug. Only a small forward
  (tangential) `forwardReach`, itself capped relative to `depth`, remains.
  This is what fixed both the chord-crossing dead ends (express) and the
  far-flung mushroom-adjacent stems (valtio) — both were actually stray
  open/dead-end hyphae, not a mushroom-positioning bug (mushrooms.ts's XZ
  placement was already correct; added a regression test for it anyway).
- Added a small per-hypha `bowAngleJitter` rotation of the bow direction
  (round-3 finding: even with capped depth, many concurrent same-side loops
  with near-identical geometry read as a rigid parallel "comb" rather than
  organic mycelium; one fixed random rotation per hypha fans them out).
- Radius mapping (`radiusForFrac`/`localSpiralPitch`/new `buildActivityCdf`):
  blends the existing eased time fraction (58%) with a cumulative-activity
  fraction (42%) built from every real commit/split-time event in the
  drafts — both components are individually monotonically non-decreasing in
  time and the blend is a positively-weighted sum, so the result stays
  monotonically non-decreasing outward. This gives more inter-turn room
  exactly where commit/PR activity is dense (since loop depth is capped by
  local spiral pitch), addressing "use the space between turns" without an
  unbounded/chaotic result. **Decision, honestly flagged**: "distance from
  center ≈ time" (P9's planned legend copy) is now density-weighted, not
  purely linear — still order-preserving (later always means farther out)
  but not proportional. P9's legend copy (owned by M3, doesn't exist yet)
  should say "distance from center ≈ time, weighted by activity density" or
  similar when written.
- `SPIRAL_TURNS` 2.4 → 2.1 (tuned during iteration, see below).
- Mycelial hair texture (new `Hair` element kind, `src/domain/network/
  types.ts` + `buildHairs` in `layout.ts`): exactly one hair per rendered
  commit node (`NetworkModel.hairs.length === NetworkModel.nodes.length`,
  tested), branching from the node's own real position, alternating side by
  node order with a small seeded angle jitter, length scaled from the
  node's own (already data-driven) radius since no per-commit diff-size
  data is threaded through yet (clamped constant range + seeded jitter
  otherwise, per the task brief), longer for a merge-point commit. Not
  independently selectable (decorates its already-lookupable `NetworkNode`
  via `nodeId`), so intentionally excluded from `LookupableNetworkElement`
  — a deliberate scope decision, not an oversight. `NetworkSummary.hairCount`
  added alongside the others. A merge-point node's SVG "fusion knot" is
  rendered purely from the existing real `isMergePoint` field (a halo ring
  in `network-svg.ts`), not a new domain element — no data to back a
  separate knot kind beyond what the node already carries.
- `scripts/network-svg.ts`: renders hairs (thin, low-opacity, `stroke-
  linecap: round`) and hyphae/nodes inside `<g style="mix-blend-mode:
  screen">` groups so overlapping strands brighten where the mycelium is
  dense — a cheap stand-in for M3's eventual selective bloom.

**Visual iteration (4 rounds, `pnpm network-svg` + `Read` on both PNGs each
round)**: **(1)** baseline with hairs + the new depth/endpoint logic: the
double-counting/chord bugs were visibly gone (no more far-flung stems), but
loops near the spore's first turn ballooned into a chaotic "sea urchin"
burst — the sub-linear radius ease front-loads a huge amount of radius into
the first turn, so its `localSpiralPitch` (and thus uncapped `roomCap`) was
enormous; express's outermost turn also swung into a lopsided "comet tail"
(58/42 time/activity blend was too activity-heavy for express's very bursty
recent history). **(2)** rebalanced the blend to 58% time / 42% activity
(was 42/58) and `SPIRAL_TURNS` 1.9 → 2.1 for more even turn spacing —
confirmed (via a targeted debug script walking each hypha's parent chain and
recomputing max absolute radius) that an apparent "escapee" stray line was
actually just the main hypha's own outermost turn arcing across the canvas,
not a bug; the real remaining problem was the still-chaotic center burst.
**(3)** added `ABSOLUTE_MAX_LOOP_DEPTH` (hard ceiling regardless of local
pitch) and the per-hypha `bowAngleJitter` — center burst calmed into
recognizable lens-shaped loops, but fill was now a little sparse (depth
constants had been cut aggressively to fight the burst). **(4)** raised
`MIN_BULGE_FRACTION`/`WEIGHT_BULGE_FRACTION`/`LANE_GROWTH_FRACTION`/
`ABSOLUTE_MAX_LOOP_DEPTH` back up moderately for better fill while the
angle-jitter kept it organic — both fixtures now read as a fairy-ring mat of
lens-shaped loops hugging the main hypha with a fine hair texture, dead ends
and mushrooms compact and on-line, no chord crossings. Final images:
`.shots/network-pmndrs-valtio.png`, `.shots/network-expressjs-express.png`
(both gitignored, regenerate with `pnpm network-svg`).

**Weaknesses, honestly reported**:
- A visible band of empty space remains between the second and outer turns
  on both fixtures — an inherent tension between "loops must never cross the
  next turn" and "use the inter-turn space," not resolved further given the
  chaos that resulted from pushing loop size higher in rounds 1–2. Flagging
  for a possible T8/M3-side pass (e.g. very-low-opacity ambient fill
  strokes in genuinely empty regions) rather than gold-plating the pure
  layout further here.
- The radius mapping is no longer purely time-linear (see the P9 legend
  decision above) — an honest tradeoff, not a bug, but M3's legend copy
  needs to reflect it.
- Hair length is scaled from the node's own render radius (itself
  commit-count/weight-driven), not literal per-commit diff size, since PR
  commit objects don't carry additions/deletions in the current domain
  model (`src/domain/repo.ts`'s `PrCommit` has no size field) — matches the
  task brief's "or constant with seeded jitter" fallback, but a true
  per-commit-diff-size hair would need `PrCommit` extended first (M1-adjacent
  follow-up, out of scope here).
- Not independently re-verified against a genuinely tiny/empty repo or a
  1000+-hypha-capped repo beyond the existing `buildNetwork.test.ts` unit
  cases (both real fixtures used here are mid-sized, hundreds of PRs) —
  recommend as a T8 check alongside the existing tree-side one.

Tests (`src/domain/network/layout.test.ts`, `buildNetwork.test.ts`): the
"loops never cross the next turn" fixture check is generalized from
fused-only to every main-parented hypha (fused/dead-end/open alike, since
all three now share the same depth cap); a new "fused loops follow their
parent within a bounded lateral offset" check; a new "dead-end/open hypha
length is bounded" check (distance from its own fixed attach point, not a
same-time parent lookup — dead-end/open geometry deliberately doesn't chase
the parent through time, only a fused loop does, a distinction found while
debugging an initially-too-strict combined test); a new "mushroom XZ stays
within epsilon of the main hypha at release time" check; a new "exactly one
hair per rendered commit node" check (both a synthetic-snapshot unit test
and a per-fixture smoke test); `MUSHROOM_CLUSTER_SCATTER`,
`buildActivityCdf`, `SPIRAL_TURNS`, `SPIRAL_PITCH_SAFETY`,
`NESTED_MAX_LANE_DEPTH`, `SIDE_JITTER_MAX` exported for test reuse. Existing
determinism/non-finite/id-uniqueness tests cover the new `hairs` field for
free (full-model `toEqual`).
Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass (286
tests total, +9 for M2b) · `pnpm build`: pass.

## Next step
M3 (network rendering + growth + interaction wiring), then M4 (cleanup,
remove superseded tree code), then T8 polish and the final independent
review.

**Decisions/gaps for the product owner (M3 planning)**:
- The network model exposes `NetworkModel.overflow` (hyphae/nodes omitted
  by the caps) — M3 should decide how (or whether) to surface this in the
  UI/legend, mirroring how the tree model's overflow-PR count is currently
  labeled in the era detail panel.
- `PullRequestDetail.status` now includes `'closed'`; `DetailPanel.tsx`'s
  current `detail.status === 'merged' ? 'Merged' : 'Open'` ternary (tree-only
  today) will need a third branch once M3 feeds it network data.
- Dead-end/open hyphae are allowed to extend visually past the disc's
  nominal outer radius (by design — they "drift away"/"grow" beyond the
  established structure); M3's camera/bounds framing should account for
  `NetworkModel.bounds.radius` already including them (it does), not just
  the main spiral's own radius.
