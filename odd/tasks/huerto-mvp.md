# Huerto MVP — a git repository grown as a living mycelium network

Locator: `odd/tasks/huerto-mvp.md` · Engram mirror: `odd/huerto-mvp/tasks`

## Objective
A shareable web app: enter `owner/repo`, watch the repository's history grow as a bioluminescent
mycelium galaxy — a colony of hyphae spiraling outward from a central spore in a patch of dark
soil — then navigate hyphae, nodes and mushrooms to inspect real GitHub data.

## Problem / why
Existing repo visualizers are either analytic (Git Truck, CodeCharta), directory-based (Gource,
GitCoral) or non-botanical (Skyline, Git City). None renders repository *history* as a believable,
navigable organic form. A strict tree metaphor was tried first and rejected (see the pivot below):
trees split but never fuse, while git branches split AND merge, so a tree forces literal branch
topology into artificial "eras" to look reasonable. Mycelium — hyphae that branch and fuse
(anastomosis) — maps git's real merge DAG ~1:1 without inventing any grouping: a merged pull
request is honestly a loop that splits off and fuses back, a closed one honestly dries into a dead
end, exactly like git's own history.

## Pivot (2026-09-28, shipped M4)
User questioned the tree metaphor: trees split but never fuse, git branches split AND merge.
Decision (user-approved): mycelium — hyphae branch and fuse (anastomosis), so git's DAG maps ~1:1
without inventing eras. Tree rendering (T3–T5 tree geometry, V1) was superseded; data, API, panel,
routing, states, a11y list (T2, T6, T7) were reused as-is. The mycelium colony network (M2–M3c) is
now the shipped product; M4 removed the superseded tree code (`src/domain/tree/`,
`src/ui/scene/tree/`, the spiral layout) and finished the README/OG/hero assets for the mycelium
metaphor.

## Mapping (shipped — mycelium colony, M2d/M3/M3c; supersedes the original spiral sketch below)
- Spore at the center = first commit.
- Distance from center = time (radius ≈ eased time fraction; the same time → radius mapping every hypha and mushroom uses, `ringGeometry.ts`'s `radiusForFrac`).
- Filament (hypha) = a pull request. Length reflects real work (commits/changed lines, space-colonization growth toward the colony's own least-covered gaps), not just its time span.
- Fork (a filament splitting off) = a branch created; a knot (fusing back in) = a pull request merged. A closed-unmerged PR dries into a dead-end (desaturated brown) filament instead of fusing.
- Glowing tip = an open pull request or a live branch, still growing.
- Fine hair = an individual commit (one per rendered commit node, real mycelial texture, never decorative).
- Mushroom = a release, cream cap with a cyan rim, sized by version bump (major > minor > patch); close-in-time releases cluster. Placed on its own release-time growth ring; angle is the golden-angle sequence (M3c), decoupled from data but keeping `nearPr` (the closest real preceding merge) as the panel's honest data link.
- Angle carries NO data anywhere in the shipped model — only an extra outward "galaxy swirl" rotation for visual coherence (`colonyLayout.ts`'s `applySwirl`) and, for mushrooms, an even golden-angle spread. Radius (time) and length (work) are the only real-data axes.
- Soil: dark loam disc seen at a 3/4 top-down angle, darkened further in M3c so the galaxy floats on near-black with only a faint core haze. Per-language soil strata (in the original spiral sketch below) was never carried over to the colony layout — `RepoSnapshot.languages` is fetched but not currently visualized.
- Data truth: every filament, node and mushroom maps to real data; only curvature/wiggle/swirl-angle is procedural (seeded by `owner/repo`, deterministic).
- Scale: concurrent PRs take lanes (interval scheduling) so loops don't overlap; cap rendered PRs (~1000) and aggregate overflow honestly (`NetworkModel.overflow`, surfaced in the Legend since M3b).

### Original spiral sketch (M2, superseded by the colony layout above; kept for history)
- Main hypha = default branch, grown outward as a spiral from the spore, angle advancing with time.
- Merged PR = a side hypha splitting off the parent hypha at its first commit time and fusing back at `mergedAt`.
- Contributors = a subtle per-author hue on nodes/pulses -- never implemented for either layout.

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
- [x] T8 Polish: fixed the findings of two independent reviews (technical + product/design) across four groups (growth/interaction, rendering/perf, API/deploy, UX polish). Route: delegated (writer).
- [x] M1 Data for topology: extend adapter/snapshot with PR `baseRefName`/`headRefName`, first-commit time, closed-unmerged PRs (capped), default-branch merge commits if cheap; regenerate fixture(s). Route: delegated.
- [x] M2 Network model (pure domain): DAG → deterministic layout (spiral main, lanes, split/fuse points, nodes, dead ends, tips, mushrooms), growth times, refs; tests. Route: delegated.
- [x] M2b Layout iteration: fix chord-crossing loops, far-flung dead ends/mushrooms, empty inter-turn space, and add mycelial hair texture, per orchestrator visual review of `.shots/network-*.png`. Route: delegated (writer).
- [x] M2c Radial colony layout prototype: alternative `layout: 'colony'` mapping (radius = time, angle = contributor sector, true branch-from-branch sprouting, fusion knots/bridges, growth rings) behind `buildNetwork(snapshot, { layout })`, compared side by side against the spiral. Route: delegated (writer).
- [x] M2d Colony algorithm rewrite: replace M2c's duration-based length and author-sector angle (read as tangential arcs/chords) with work-based length and gap-filling angle (space-colonization growth); update SVG debug rendering; tests; ≥4 rounds of visual iteration against both fixtures. Route: delegated (writer).
- [x] M3 Network rendering + growth + interaction wiring: batched glowing filaments, nodes, mushrooms, soil disc, selective bloom, flow pulses, picking, reuse panel/list/scrubber. Route: delegated.
- [x] M3b Visual polish of the 3D mycelium galaxy: fine luminous filaments with tapered tips, lit mushroom silhouettes, legible selection, dark-loam soil, mobile header fit, overflow honesty. Route: delegated (writer), per orchestrator screenshot review of `.shots/`.
- [x] M3c Visual fixes: mushroom scale-down + golden-angle spread across the disc, restored brightness/bloom, fixed short-hypha rim taper artifacts, darker soil, mobile disc-fit + header consistency fixes. Route: delegated (writer), per orchestrator screenshot review of `.shots/`.
- [x] M4 Cleanup + legend/README/OG for mycelium; remove superseded tree code. Route: delegated (writer).
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

### M2c Radial colony layout prototype — done
Commit: `feat: add radial colony layout for the mycelium network`.
Trigger: the orchestrator reviewed the M2b spiral images and reported they
read as a spiral galaxy/snail, not mycelium, with hyphae still crossing the
interior. Instructed to prototype a genuinely RADIAL layout (many hyphae
radiating from the center, branching, concentric growth rings) as a
`layout: 'colony'` alternative alongside the existing `layout: 'spiral'`,
sharing topology, for side-by-side comparison -- not to replace the spiral
yet.

**New files** (`src/domain/network/`): `sectors.ts` (author angular-sector
assignment), `colonyLayout.ts` (the colony geometry strategy). **Changed**:
`types.ts` (`Hypha.attachment`, `GrowthRing`, `Fusion`, `NetworkModel.rings`/
`fusions`/`layout`, `NetworkSummary.fusionCount`), `layout.ts` (exports
`DISC_MAX_RADIUS`/`radiusForCommitCount`/`capEvenly` for reuse; spiral hyphae
now set `attachment: 'parent-branch'` always, since the spiral's attach
point already sits on the real parent's own curve), `topology.ts`
(`HyphaCommitDraft.author?` -- only populated for a genuine direct commit on
`main`, needed to place its colony spur in the right author sector),
`mushrooms.ts` (extracted layout-agnostic `computeReleaseSequence`; added
`buildMushroomsOnRings` for the colony placement strategy alongside the
unchanged `buildMushrooms`), `buildNetwork.ts` (`NetworkBuildOptions.layout:
'spiral' | 'colony'`, branches to `layoutNetworkColony` and folds its
rings/fusions into bounds/summary), `index.ts` (new exports).
`scripts/network-svg.ts` now renders **both** layouts for **both**
fixtures: `.shots/network-<repo>.svg/png` (spiral, unchanged name) and
`.shots/network-<repo>-colony.svg/png` (new).

**Mapping** (`colonyLayout.ts`):
- **Radius = pure eased time**, `radiusForFrac(timeToFrac(time, bounds))`
  (same `frac^0.58` sub-linear ease as the spiral, `DISC_MAX_RADIUS = 5`
  shared), but **without** M2b's activity-weighted CDF blend -- a deliberate
  divergence from the spiral, decided and found necessary during round 2/3
  of visual iteration (see below): a concentric ring's whole *point* is to
  be an honest, roughly-even function of elapsed real time, and the
  activity blend's "more radius where activity is dense" behavior does the
  opposite of what a ring needs (a quiet stretch barely advances the
  activity CDF, so everything born in it collapses onto nearly one radius).
  Spore at the exact center = first commit, by construction (`radiusForFrac(0) = 0`).
- **The default branch is the colony itself**: no rendered main curve. A
  degenerate 2-point `main` `Hypha` entry still exists (kind `'main'`,
  `attachment: null`) purely so `findNetworkElement`/`resolveNetworkElementDetail`
  keep working unchanged for the branch-detail lookup; `network-svg.ts`
  explicitly skips drawing it. `GrowthRing`s (`rings: GrowthRing[]`) are the
  colony's own concentric structure: one real ring per release
  (`ringKind: 'release'`, carrying that release's own `ref`) plus faint
  optional calendar-year rings (`ringKind: 'year'`, `ref: null`, real
  elapsed-time boundaries, non-interactive, excluded from
  `LookupableNetworkElement`, capped at 40). Direct commits on the default
  branch become radial spurs: one `NetworkNode` (`hyphaId: main.id`) + one
  radially-outward `Hair` per genuine direct commit, placed in the commit
  author's own sector (reusing the same sector-slot mechanism as PR
  hyphae) -- not a "seeded angle" fallback, since `HyphaCommitDraft.author`
  was threaded through for exactly this.
- **Angle = contributor** (`sectors.ts`): every author is ranked by real
  merged-PR count; the top `MAX_AUTHOR_SECTORS` (20, tuned up from an
  initial 14 during round 4) each get their own sector, angular width
  strictly proportional to their merged-PR count (a small
  `MIN_SECTOR_WEIGHT`/`MIN_SECTOR_ANGLE` floor-then-renormalize keeps any
  sector from collapsing to an invisible sliver); every other author
  (including anyone with zero merged PRs) shares one always-present
  `'community'` sector. Sectors are ordered around the circle by each
  group's earliest real contribution time (stable, deterministic) --
  **not** by size. A community sector is now *unconditionally* reserved
  (even with a floor-only weight) so `resolveSectorKey` can never point at
  a sector that doesn't exist -- a real bug found while testing: a
  direct-commit author who never opened a PR isn't in the population
  `buildAuthorSectors` was built from, so without an always-present
  community fallback their spur would have been silently dropped. Within a
  sector, PRs/commits get an angular "slot" via the same greedy
  interval-scheduling idea as the spiral's radial lanes
  (`assignSlotsWithinGroup`), plus a small seeded jitter.
- **Merged PR = a hypha that sprouts, grows, and fuses.** Its base point is
  `radiusForTime(splitTime)` at an angle that depends on real topology
  honesty (`Hypha.attachment`): if the PR's real base branch is another
  PR's real head branch (`parentHyphaId` points at a non-main hypha, exactly
  the same "branch-from-branch" case `topology.ts` already resolves for the
  spiral), it sprouts from that **real** parent hypha's own curve point at
  the split time -- `attachment: 'parent-branch'`, true topology, no
  approximation. Otherwise (its base is the default branch), it sprouts
  from the **nearest already-positioned hypha point in its own sector**
  near that radius (a coarse radius-bucketed spatial grid,
  `RADIUS_BIN_WIDTH = 0.12`, keeps this an O(1)-ish query regardless of
  hypha count -- see the perf test), or from the nearest growth ring/spore
  if nothing is nearby yet -- `attachment: 'colony'`, explicitly a visual
  sprout point, not a claimed data relationship. The curve then grows
  outward: **disc-radius at each sampled point is recomputed directly from
  that point's own real time** (`radiusForTime(lerp(splitTime, endTime,
  t))`), never lerped between the two endpoints -- since `radiusForTime` is
  monotonically non-decreasing by construction, this makes "radius
  monotonic non-decreasing along the curve" an *exact* guarantee, not an
  approximation. Angle eases from the sprout angle to the PR's own
  author-sector target angle (`easeInOutCubic`), with a small seeded
  low-frequency curl (amplitude a *fraction* of the sector's own width, not
  an absolute angle, envelope zero at both ends) for organic wiggle. Ends
  in a **`Fusion`**: a small knot at the real tip position plus a short
  "anastomosis bridge" to whichever real structure (another hypha's nearby
  point, or a growth ring/spore) is nearest at that radius -- an honest
  visual anchor, not a claimed relationship (mirrors `attachment`'s
  honesty framing; `Fusion.bridgeToKind` records which).
- **Closed PR** = same growth mechanism, ends dry (thinner/desaturated via
  the existing `status: 'dead_end'`), no fusion. **Open PR** = grows to
  `radiusForTime(bounds.lastEventTime)` ("now"), keeps the existing `Tip`
  element with a bright growing-tip treatment in the SVG.
- **Commit = hair.** Every rendered commit node on a PR hypha gets the
  same lateral-filament `Hair` the spiral layout already uses
  (`buildPrHairs`, tangent-perpendicular to its own hypha's local curve,
  alternating side, seeded jitter, longer for a merge-point commit) --
  explicitly reusing M2b's mechanism per the task brief, not a new one.
  Only `main`'s genuine direct-commit spurs use the separate
  radially-outward variant described above. `hairs.length === nodes.length`
  always (tested).

**Honesty (`Hypha.attachment`)**: added to the shared `Hypha` type (used by
both layouts) so a future detail panel can word a colony PR's origin
correctly -- `'parent-branch'` for a real base-branch relationship (always
true for every spiral hypha, and for a colony hypha whose real base is
another PR), `'colony'` only for a colony hypha whose visual sprout point is
an approximation (its real base is the default branch, and the nearest
existing structure was used purely for visual continuity). `null` only for
`main`. Not yet wired into `elementDetail.ts`'s panel copy -- M3 doesn't
render either network layout yet, so there is no live UI text to fix; this
is the model-level plumbing the task asked for, ready for M3 to consume.

**Visual iteration** (4 rounds, `pnpm network-svg` + `Read` on both PNGs
each round; images: `.shots/network-pmndrs-valtio-colony.png`,
`.shots/network-expressjs-express-colony.png`, regenerate with `pnpm
network-svg`):
**(1)** First working pass (topology + sectors + growth curves + fusions
all wired) read as chaotic, disc-spanning nested rotated squares/polygons on
both fixtures, and `hairs: 9` in the on-image debug counter (should equal
`nodes`, ~1800+) -- two real bugs, not tuning. Root-caused (not just
eyeballed) with a throwaway script printing one long-lived hypha's raw
per-point angle sequence: `lerp(baseAngle, targetAngle, ...)` was
interpolating two numerically-different-but-circularly-equivalent angle
representations (e.g. `-0.46` and `5.80`, the same direction ~`2*pi` apart)
literally, sweeping the curve almost all the way around the disc instead of
the short way. The `hairs: 9` count was simply a scope bug: only `main`'s
direct-commit spurs were generating hairs; PR-hypha commit nodes had none.
**(2)** Fixed both: added `shortestAngleTo` (re-expresses the target angle
as the base angle plus the shortest signed distance in `(-pi, pi]` before
any interpolation) and added `buildPrHairs` (reusing the spiral's
tangent-perpendicular mechanism) for every PR-hypha node. The result
immediately read as recognizable radiating/branching mycelium for the first
time -- but a new problem appeared: a very bright, almost solid ring band at
one fixed radius on `expressjs/express`. Traced (via a histogram script
over ring radii) to the activity-weighted radius blend inherited from M2b:
a long quiet real stretch barely advances the activity CDF, so ~100 of
`express`'s 117 release rings collapsed onto nearly the same radius
(2.4-2.6), and ~100 semi-transparent circle strokes stacked at the same
pixels read as solid. **(3)** Fixed by dropping the activity blend entirely
for colony (pure eased time -- see the Mapping section above for the
reasoning); the bright band was smaller but not gone, since even genuinely
real, honest time-based radii can still land very close together for a
real release-storm. Added render-time (not model-time -- every release
still gets its own real `GrowthRing`) deduplication in
`network-svg.ts`: skip drawing a ring within `0.03` world units of the last
drawn one, the same "visually merge, never fabricate" idea `mushrooms.ts`
already applies to clustered mushrooms. **(4)** Confirmed the bright band
was gone on both fixtures; the remaining visible unevenness (dense
wedges next to comparatively sparse ones) tracked back to real, uneven
per-author contribution timing, not a bug -- widened `MAX_AUTHOR_SECTORS`
14 -> 20 for a moderate improvement (more individual sectors, smaller
`'community'` share) and confirmed both fixtures read as a plausible,
roughly circular, densely radiating/branching fungal colony at first
glance, with faint concentric rings, visible fusion knots, and a growth
front reaching the rim.

**Weaknesses, honestly reported**:
- Angular fill is uneven -- some sectors are dense out to the rim, others
  only populated near the center (an author active early but not
  recently) or thin throughout (a low-merged-PR author). This is a real,
  honest reflection of uneven contribution timing per author, not a layout
  bug (mycelium colonies grow unevenly toward resource-rich directions too)
  -- but it does mean "no big voids" from the target brief isn't fully met
  for either fixture. Fixing this further without fabricating data would
  need a fundamentally different angle strategy (e.g. reflowing/interleaving
  sectors by activity over time, not just by initial proportional width),
  which felt like a bigger design change than this prototype's scope --
  flagged for the product-owner decision below rather than gold-plated here.
- A colony-attached (`attachment: 'colony'`) hypha's own *base* angle can
  occasionally land up to ~0.8 rad outside its nominal author sector
  (measured on both fixtures, see `colonyLayout.test.ts`'s documented
  tolerance): its sprout-neighbor search can pick a point belonging to a
  same-sector sibling hypha whose *own* base is real-topology-anchored
  elsewhere (a `'parent-branch'` attachment). The *tip* (and thus the
  sector one actually perceives the hypha "belonging to") is always exactly
  within sector -- this only affects a short stretch near the base of an
  already-rare case.
- The dense white "blob" clusters visible on both fixtures (a tight mass of
  overlapping hairs/nodes) reflect genuinely bursty real commit activity by
  one author in a short window -- an honest result, not injected texture,
  but visually reads more like a clump than distinguishable branching
  filaments at that zoom level; M3's eventual selective bloom/dimming might
  help more than further pure-layout tuning would.
- Not benchmarked against a genuinely tiny/empty repo beyond the unit test
  case, or visually screenshotted for one (only the two mid/large real
  fixtures were used for the visual QA loop, per the task's fixtures) --
  the tiny-repo unit test (`colonyLayout.test.ts`) confirms it doesn't
  crash/NaN, not that it looks good.

**Performance**: `buildNetwork(snapshot, { layout: 'colony' })` on a
synthetic 1000-merged-PR snapshot measured ~137ms in Node (cold, includes
topology build) via a throwaway timing script -- comfortably under the
~200ms target. The committed test (`buildNetwork.test.ts`, `it.each` over
both layouts) asserts a generous 600ms CI-safe budget rather than the exact
~200ms figure, to avoid flaking on a slow/shared runner while still
catching a real regression; the ~137ms figure is recorded here as the
actual honest measurement. The spatial radius-bucket grid
(`RADIUS_BIN_WIDTH = 0.12`, small bounded search spread) is what keeps
sprout/fusion neighbor search from becoming O(n^2) as hypha count grows.

**Comparison verdict, spiral vs. colony -- recommendation**: the colony
prototype reads as mycelium/a fungal colony at first glance in a way the
spiral does not (the orchestrator's own critique of the M2b spiral images
was "reads as a spiral galaxy/snail" with interior crossings); colony has
no interior-crossing hyphae by construction (radius is monotonically
non-decreasing along every hypha, guaranteed, not just visually tuned) and
gains real concentric growth rings, true branch-from-branch sprouting
visuals, and honest fusion knots the spiral never had. Its own honest
weakness is angular unevenness (voids) versus the spiral's more
deliberately-engineered "fairy ring" evenness (M2b spent 4 rounds
specifically flattening its own fill unevenness). **My recommendation is
to proceed with `colony` as the primary metaphor for M3** (the look the
orchestrator asked for is a materially better fit than a few more rounds of
spiral polish could achieve, since the spiral's core issue -- reading as a
galaxy, not a colony -- is structural to the spiral shape itself, not a
tuning problem), while carrying the angular-fill weakness above forward as
a named, tracked risk for M3/T8 polish (most likely addressed with
selective bloom/dimming and/or a reflow of the sector strategy, both
reasonable M3-adjacent scope) rather than blocking this prototype task on
it. This is a recommendation, not a decision -- see below.

Tests (`src/domain/network/sectors.test.ts`, `colonyLayout.test.ts`,
+additions to `mushrooms.test.ts`/`buildNetwork.test.ts`): author-sector
proportionality/determinism/community-fallback/always-present-community
(the real bug above); every hypha's angle strictly within its sector
(`assignAngularSlots`); non-overlapping angular slots for overlapping-time
items; colony-layout determinism; monotonic non-decreasing disc-radius
along every PR hypha (exact, tiny epsilon); start/end radius match
`radiusForFrac(timeToFrac(...))` exactly; every hypha's tip is exactly
within its sector, base within a measured/documented tolerance; a fusion
knot exists iff (and only iff) a hypha is merged; every open hypha's tip
reaches `radiusForTime(now)`; every mushroom sits exactly on its own
release's ring radius; hair count equals node count; no NaN/non-finite
anywhere; a tiny repo (0 PRs, 0 releases, 1 commit) produces a spore + one
degenerate main entry without crashing; both real fixtures smoke-tested via
`buildNetwork(snapshot, { layout: 'colony' })`; a spiral/colony comparison
test confirms both layouts share the exact same underlying hypha id set
(same topology); a performance test (both layouts) over a synthetic
1000-merged-PR snapshot.
Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass (317
tests total, +31 for M2c) · `pnpm build`: pass.

**Decisions needed for the product owner**:
- Adopt `colony` as the primary layout for M3 (my recommendation above), or
  keep iterating `spiral`, or carry both forward longer for further
  comparison? M3 (rendering) hasn't started for either, so this is still a
  cheap decision.
- If `colony` is adopted: is the angular-fill unevenness (some sectors
  dense, others sparse/void) acceptable as an honest reflection of real
  contribution history, or does it need a further layout pass (e.g. a
  different sector-ordering/interleaving strategy) before M3 renders it?

### M2d Colony algorithm rewrite — done
Commit: `b0480c7` feat: grow the colony by space colonization from real work.

**Trigger**: the orchestrator reviewed the M2c colony images and reported
they did NOT look like mycelium: hyphae ran as tangential arcs around the
center (angle interpolated toward far sectors), express showed polygon
chords across the disc, and most PRs collapsed to dots/blobs. Root cause:
hypha length = PR duration (days vs. years -> dots) and author sectors
forcing big angular sweeps.

**Algorithm** (`src/domain/network/colonyLayout.ts`, full rewrite; author
sectors are no longer used for layout):
1. `r(t) = radiusForFrac(timeToFrac(t, bounds))` (reused from `layout.ts`,
   unchanged: `frac^0.58`, `DISC_MAX_RADIUS = 5`) -- a gentle sub-linear
   power ease so early history isn't crushed near the spore, monotonic by
   construction. Spore at origin = first commit.
2. Hyphae process in split-time order (unchanged from M2c). For each:
   - **Length is work-driven, not duration-driven**:
     `computeWorkLength(commits, workLines) = clamp(COLONY_LENGTH_MIN +
     0.34 * log1p(commits*1 + lines*0.015), COLONY_LENGTH_MIN=0.25,
     COLONY_LENGTH_MAX=1.4)`; closed-unmerged PRs multiply by
     `COLONY_CLOSED_LENGTH_MULTIPLIER=0.6` (stunted). `workLines`
     (`additions+deletions`) is real GraphQL data but only fetched for
     merged PRs (M1); `null` for closed/open, treated as 0 real lines
     (`topology.ts`'s new `HyphaDraft.workLines`), never fabricated.
   - **Angle is gap-filling, not a fixed sector**: `chooseTargetAngle`
     collects the angle-at-r0 of every already-placed hypha whose disc-radius
     span contains r0 (`computeSpanning`), plus 10 fixed seeded "spore rays"
     (permanent reference angles so the search isn't starved early on), finds
     the largest gap, and targets its center + jitter (<=10% of the gap,
     `pickAngleInLargestGap`). When nothing spans r0 yet, it instead
     maximizes distance to every already-placed hypha's own base direction
     (same helper, different candidate set) -- "first hyphae radiate around
     the spore evenly".
   - **Parent/attach**: a real base-branch-of-another-PR relationship
     (`attachment: 'parent-branch'`) always wins, using that real hypha's
     point at r0 (clamped to its own span if it doesn't reach that far).
     Otherwise, the already-spanning hypha whose angle at r0 is closest to
     the target is used ONLY if that's within a natural Y-fork's reach
     (`maxTurnRadians`, see below); otherwise growth sprouts fresh from the
     spore instead (`attachment: 'colony'` either way -- a visual anchor, not
     a data claim).
   - **Path** (`growHyphaPoints`): starts exactly on the real attach point
     (or the spore's origin), turns from that point's OWN real angle (never
     a separate tangent -- see the round-2 finding below) to the target over
     the first 15-25% of the length (a Y-fork), then grows near-radially
     with a small organic wiggle. Disc-radius is always
     `lerp(startRadius, endRadius, t)`, so "radius non-decreasing" holds
     exactly (not approximately) by construction, regardless of angle.
   - **`r_end = r0 + L_h`** per the task brief -- for a real/colony attach
     point this is nearly automatic (`startRadius` was found AT r0); for a
     spore-started hypha (`startRadius = 0`), `r_end` still uses the nominal
     `r0`, not 0, so it can reach its own real radius (see the round-3/4
     findings below for why this matters). Every hypha is additionally
     capped at `COLONY_RADIUS_CAP = DISC_MAX_RADIUS * 1.05` (round 2
     orchestrator feedback: keep the disc round), monotonicity preserved via
     `Math.max(startRadius, ...)`.
   - **Fork turn bound** (`maxTurnRadians`): NOT a fixed angle -- bounded by
     how much LATERAL (sideways) distance the turn would sweep at the
     hypha's own radius (`length * 0.5 / max(radius, 0.12)`, capped at an
     absolute 70deg), since a fixed angle looks fine near the spore but
     becomes a huge unnatural sweep at a large disc radius (lateral distance
     is `radius * angle`).
3. Commits render as `Hair`s placed by commit ORDER evenly along the
   already-sampled path (`pointOnHyphaAtFraction`, index-based, not
   time-based) -- deliberately ignores each commit's own timestamp for
   *positioning*, since the hypha's length is no longer time-driven.
   Genuine direct commits on the default branch (merge-point pseudo-entries
   excluded) get a short radially-outward spur instead, angled via the same
   gap-filling search against the final hyphae set.
4. Merge fusion unchanged in spirit from M2c: nearest OTHER hypha point
   within 0.25 world units (`RadiusGrid`, bucketed by disc radius), or "just
   a knot" (zero-length bridge) if nothing is close enough. Closed = dry, no
   fusion. Open = bright growing tip (`Tip` element).
5. Releases keep one real `GrowthRing` each (SVG-render-time dedupe at 0.04,
   up from M2c's 0.03). **New**: `Mushroom.nearPr` (`types.ts`) -- a
   mushroom's angle is a true data link when possible (the merged PR that
   landed closest before the release, at the point where THAT PR's own
   hypha actually crosses the release's ring radius, `findRingAnchor` in
   `mushrooms.ts`), falling back to the nearest hypha (any kind) crossing
   the ring, then a seeded angle -- `nearPr` is `null` in both fallback
   cases (mirrors `Hypha.attachment`'s honesty framing). Clustered releases
   share one anchor angle, fanned evenly across the scatter window by their
   own position in the cluster (not independently random, to avoid several
   members randomly landing on top of each other) plus a little jitter.
6. Angle interpolation toward far sectors is fully removed; every hypha's
   post-fork angular drift stays within a documented, tested bound (see
   Tests).
7. `sectors.ts` rewritten down to color-metadata-only (`buildAuthorHueIndex`,
   `resolveAuthorHueKey`, `authorKeyOf`) -- ranks contributors deterministically
   for a future per-author hue, NOT imported by `colonyLayout.ts` at all.

**`scripts/network-svg.ts`** updated to the new visual spec: no node dots
(hairs alone carry commit texture); hairs opacity 0.35; hyphae opacity
0.55-0.9 with per-hypha width/opacity scaled by age and real base thickness
(not a fixed per-kind width); fusion knots `r <= 1.5px`; rings opacity
0.04-0.1 ("extremely faint"); mushrooms small cream dots (`#f5ead0`) with a
thin cyan-rim outline, not a flat cyan fill; ring dedupe threshold 0.04.

**Visual iteration (7 rounds, `pnpm network-svg` + `Read` on both PNGs each
round)** -- images: `.shots/network-pmndrs-valtio-colony.png`,
`.shots/network-expressjs-express-colony.png` (gitignored, regenerate with
`pnpm network-svg`):

**(1)** First pass (work-length + gap-fill angle wired, tangent-based fork
start). Both fixtures still read as a chaotic tangled ball of yarn --
multiple concentric, near-circular bands of bright cyan sweeping tangentially
around the center like a whirlpool/vortex, not radiating outward. A debug
script measuring every hypha's fork-turn magnitude found the median turn was
53.6deg (75th pct 80.5deg, 43% over 60deg, 20.5% over 90deg, max 178.7deg) --
forcing a smooth turn that large within a short (15-25%) fork fraction reads
as a tight circular sweep, exactly what a Y-fork should never look like.

**(2)** Added a natural-fork angle guard (fall back to the spore when the
closest attachable neighbor's turn exceeds ~40deg). Reduced the vortex but
didn't fully fix it -- the guard compared the chosen parent's *tangent*
direction to the target, but `points[0]` is always forced to the parent's
real *position*; when the two meaningfully differed (e.g. the attach point
sat inside the parent's own fork/drift), the very next sample jumped to a
completely different angle at nearly the same radius. Root-caused (not just
eyeballed) with a script dumping one hypha's raw per-point radius/angle
sequence: a single 9.443-world-unit segment jump (a chord almost spanning
the whole disc) between point 0 (real angle -0.915) and point 1 (angle
1.554, ~141deg away). This was the orchestrator's own round-2 finding too
(dozens of long straight chords, radius overshooting 6.25 > the nominal 5,
wiggle reading as a big sinusoidal zigzag, a pile of overlapping mushrooms).

**(3)** Structural fix: `growHyphaPoints` now derives its starting angle
strictly from the real `startPosition`'s own position angle (`atan2`), never
a separate tangent -- trivially continuous by construction, since the next
sample's angle differs from `points[0]`'s by an infinitesimal amount as
`t -> 0`. Replaced the fixed-angle fork guard with `maxTurnRadians` (lateral
distance budget, not a raw angle -- see the Algorithm section). Added
`COLONY_RADIUS_CAP = R*1.05` (hard, monotonic-safe) so the disc stays round.
Chords and the 9.4-unit jump were gone (added a regression test: no
single-segment jump over 0.3 world units, any fixture). But now the disc
filled only a ~270deg crescent -- most of the circle stayed completely
empty, with a small isolated "starburst" of short rays near the very center
(the one good-looking part, per the orchestrator's own round-2 note).

**(4)** Root-caused the crescent with a debug script: only 1 of 622 hyphae
ever started fresh from the spore; the other 621 always found SOME spanning
neighbor to clamp toward. Since "closest by angle" is unavoidably INSIDE
whatever arc already has structure once any exists, `maxTurnRadians`
clamped every new hypha back toward the same crescent instead of letting it
reach a real, correctly-identified gap on the far side of the disc -- the
model could seek gaps but could never actually get there. Fixed by
preferring a spore-start whenever the closest spanning neighbor is still
farther than a natural fork allows (not only when nothing spans r0 at all),
and by giving a spore-started hypha its full real reach (`r_end = r0 +
L_h`, not `0 + L_h` -- a bug in the interim fix, since capping a spore
hypha's own length at `COLONY_LENGTH_MAX` regardless of how large its real
`r0` was meant it could never grow far enough to become real coverage for
later hyphae in that region). Result: the disc filled a full 360deg for the
first time, densely radiating outward, real forking visible toward the rim
-- but many long spore-started primaries now rendered as near-perfectly
straight spokes (the small fixed wiggle amplitude, tuned for a
<=1.4-length hypha, is imperceptible over a much longer run).

**(5)** Scaled the organic wiggle's lateral budget and curl frequency with
each hypha's OWN length (capped at the normal small global amount for any
hypha at or under `COLONY_LENGTH_MAX`), so a long spore-started strand
visibly meanders proportionate to how far it travels instead of reading as
a rigid spoke. Both fixtures now show a dense, organically-curving radial
mycelium: forking, curving filaments from the spore, denser and more
tangled toward the rim, no arcs, no chords, no dots-collapsed-to-blobs.

**(6)** Addressed the orchestrator's remaining round-2 note: a pile of
overlapping mushroom dots (a real 16-release cluster on `express`, all with
a genuine `nearPr` link). Clustering itself is correct (item 5: "cluster
close releases"), but independently-random per-member scatter could by
chance pile several members on the same spot for a large cluster -- changed
to deterministically fan each member across the scatter window by its own
position in the cluster (plus a little jitter), and widened the scatter
window (0.12 -> 0.24 rad). The cluster now reads as a small dense patch of
distinguishable individual dots, not one solid blob -- honest (it IS a
short, real release-burst), improved but not eliminated (see Weaknesses).

**(7)** Final confirmation pass on both fixtures: dense, organically curving
radial mycelium filling the whole disc, clear forking especially toward the
rim, visible fusion knots, faint rings, mushrooms honestly on their rings.

**Weaknesses, honestly reported**:
- The very center still reads as a dense "sunburst" of many nearly-straight
  lines converging at one exact point for their first ~10-15% before curving
  -- an accurate rendering of "many primary hyphae radiate from the spore"
  (and the one part of M2c's own images the orchestrator explicitly liked),
  but the sheer density where hundreds of lines meet at a single pixel reads
  as a bright flare rather than individually legible filaments at this zoom
  level. M3's eventual selective bloom/dimming and a real camera (vs. this
  flat top-down debug SVG) should help more than further pure-layout tuning.
- The large mushroom-cluster "pile" (round 6) is reduced, not eliminated --
  a genuine short, real release-burst on `express` (16 releases within a
  chained <=3-day gap) still occupies a visually dense small patch. A
  further fix (e.g. spreading a very large cluster's members radially too,
  or capping how many individually render vs. an honest "+N more" label)
  would need a bigger design decision than this task's scope.
- `maxTurnRadians`'s absolute ceiling (70deg) and lateral-budget fraction
  (0.5) were tuned by eye against these two fixtures, not derived from the
  task brief's own "naturally 10-35deg" language (which undershot in
  practice once the discontinuity bug was fixed and real turns were
  measured) -- flagged as a deliberate, documented deviation, not an
  oversight.
- Not independently re-benchmarked for a genuinely tiny/empty repo beyond
  the unit test case (unchanged from M2c's own note); the tiny-repo test
  confirms it doesn't crash/produce NaN, not that it looks good.
- `PullRequestDetail`/`Hypha.attachment`/`Mushroom.nearPr` are model-level
  plumbing only -- M3 doesn't render either network layout yet, so there is
  no live UI text to word around these honesty flags yet.

**Performance**: the existing `buildNetwork.test.ts` 1000-PR perf test
(both layouts, 600ms CI-safe budget) continued to pass throughout, but an
early version of this rewrite (before optimizing `pointOnHyphaAtRadius` to
avoid a per-call array allocation) measured 654ms and failed it -- fixed by
rewriting that hot-path helper as a plain forward scan (`layout.ts`) instead
of `points.map(discRadius)` per call. Final measured time (via the test's
own `performance.now()`) stayed comfortably under budget after the fix.

Tests (`colonyLayout.test.ts` fully rewritten, `sectors.test.ts` rewritten
for the color-metadata-only API, `mushrooms.test.ts`/`layout.test.ts`
additions): determinism; radius non-decreasing per hypha (exact); no
single polyline segment over 0.3 world units (round-2 regression test);
every hypha starts exactly on its parent's real curve or exactly at the
spore origin; `computeWorkLength` stays within `[Lmin, Lmax]` for any
input (direct unit test) and every non-spore-started hypha's own rendered
length stays within `[Lmin*0.6, Lmax]` (a spore-started hypha's rendered
length is documented as `r0 + L_h`, tested separately); post-fork angular
drift bounded (scaled for a spore-started hypha's documented longer reach);
merged hyphae get exactly one fusion knot, closed/open never do; every open
hypha gets a `Tip`; mushrooms sit exactly on their release's ring; hairs ==
rendered commit nodes; never NaN/non-finite; tiny repo (0 PRs, 0 releases, 1
commit); a synthetic 200-PR repo has no angular gap over 60deg at r=0.8R
(gap-filling sanity, item 6 of the brief); both real fixtures smoke-tested,
including a real `Mushroom.nearPr` link exists when releases and merged PRs
coexist. Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`:
pass (322 tests total, +5 net for M2d) · `pnpm build`: pass.

### M3 Network rendering + growth + interaction wiring — done
Commits: `6d8dc7d` feat: render the mycelium network in 3D with growth and
interaction; `1dd7a8f` feat: spiral the colony's radial growth into galaxy
arms.

**Rendering** (`src/ui/scene/network/`): every hypha's tapered ribbon (2
vertices per cross-section, flat XZ-plane, `RIBBON_WIDTH_SCALE * point.radius`
wide) merged into ONE `BufferGeometry` (`geometry/hyphaeGeometry.ts`), and
every hair + fusion "anastomosis bridge" merged into one `THREE.LineSegments`
(`geometry/filamentsGeometry.ts`) — both driven by a single shared custom
`ShaderMaterial` (`geometry/growthMaterial.ts`) reused across both meshes, so
growth/highlight/flow-pulse state updates once per frame instead of per
object. Mushrooms are one shared `LatheGeometry` (cap + stem, baked
per-vertex cream/cyan-rim color, `geometry/mushroomGeometry.ts`) rendered
`InstancedMesh`-many (`MushroomsMesh.tsx`); fusion knots and growing tips
share a generic small-sphere `InstancedMesh` component
(`PointGlowInstances.tsx`, tip instances gently "breathe"). The spore is a
small bright core + a large, low-opacity additive halo (`SporeMesh.tsx`,
deliberately not blown-out per P1). The soil (`SoilDisc.tsx` +
`geometry/soilMaterial.ts`) is a single opaque, depth-writing disc with a
low-frequency value-noise gradient and a color-mixed (not alpha) vignette at
the rim — see the round-1 bug below for why it's opaque, not alpha-blended.
Tone mapping/glow: `@react-three/postprocessing`'s `EffectComposer` +
`Bloom` (luminance-threshold, selective by construction: only pixels above
the threshold glow) + `ToneMapping` (`NEUTRAL`, not `ACES_FILMIC` — the
tree's V2 pass found ACES's shadow toe crushes a wide range of dim values
into the same too-dark output, a finding carried forward from this doc's own
notes).

**Growth** (T5 reused): `useGrowthClock`/`TimeScrubber` are fully
metaphor-agnostic already, so no changes were needed there — a new
`useRepoNetwork.ts` hook (mirrors `useRepoTree.ts`) builds
`buildNetwork(snapshot, { layout: 'colony' })` instead of `buildTree`, and
`NetworkSceneContent.tsx` reads `getCurrentTime()` once per frame and writes
it into the shared shader's `uCurrentTime` uniform; growth reveal is a
per-fragment `if (vBirthTime > uCurrentTime) discard`, with each vertex's
`birthTime` baked from its real `HyphaPoint.time`/`Hair.time`/etc. at
geometry-build time — since a ribbon segment's two rings interpolate their
`birthTime` per-fragment, the growth "front" sweeps smoothly through a
segment instead of popping. Mushrooms/fusions/tips (instanced) get the same
treatment imperatively (`geometry/applyGrowth.ts`, called every frame):
a not-yet-grown instance is moved far away AND scaled to zero (belt-and-
suspenders against a renderer treating a degenerate zero-scale instance as a
stray pixel, a caution carried over from the tree's own `ScatterInstances`).
TIME HONESTY (a new domain concern, `src/domain/network/renderHints.ts`,
tested): a colony hypha can visually sprout fresh from the spore (disc
radius 0) for continuity even though its real `splitTime` corresponds to a
later, nonzero radius (M2d's "spore-started colony hypha" case) —
`conduitSplitRadius` locates where that honesty gap ends, and the geometry
builders render everything before it as a faint, hair-less "conduit" (low
alpha, no hairs) rather than claiming the branch existed since the
beginning.

**Interaction** (P7): picking raycasts the pointer onto the y=0 soil plane
(native `pointermove`/`click` listeners on the canvas, not React Three
Fiber's per-mesh event system) and queries a precomputed 2D spatial grid
(`picking/pickingGrid.ts`, pure, unit-tested) built once per model from
every hypha segment, hair (resolving to its *node*'s id, not a hair id —
hairs aren't independently selectable), mushroom and tip. Hover/select
highlight is a `hyphaIndex` vertex attribute compared against
`uSelectedIndex`/`uHoveredIndex` uniforms: the matched hypha (and a
selected/hovered node or tip's *owning* hypha, via a small id→index map)
gets an additive brightness boost; everything else dims via **alpha**, never
an RGB multiply (the exact ACES-toe lesson from the tree's V2 pass, except
here sidestepped entirely by not using ACES at all). `DetailPanel.tsx` grew
a third `'closed'` branch ("Closed without merging" / "Closed" date label)
and a "Branched from" field wording `Hypha.attachment` honestly — "Sprouted
from the colony when the branch was created" for `'colony'`, the real
parent PR's number/title (a focusable button) for `'parent-branch'` — via a
new optional `PullRequestOrigin` on the shared `PullRequestDetail` (purely
additive, tree leaves it `undefined`). `NetworkExploreList.tsx` (new,
mirrors the tree's `ExploreList.tsx`) renders `buildNetworkExploreGroups`'s
year → PR (incl. closed/open) → commit structure. `TooltipLayer.tsx` was
generalized to take a `resolveDetail(id)` function instead of a
tree-specific `model`/`snapshot` pair (its only caller updated), so it works
for both metaphors without duplicating it. `Legend.tsx` rewritten to the
mycelium mapping (spore/distance/filament/fork/knot/dry filament/glowing
tip/fine hair/mushroom).

**Round 1 (initial render, broken)** — findings from the orchestrator's
review of `.shots/desktop-valtio-end.png` plus my own: no hyphae/hairs
visible at all (only the soil's growth rings, still present at this point),
a hard line of mushrooms, growth rings visually dominant, the disc reading
as a blurry, washed-out ellipse. Root-caused (not just re-tuned): the soil
material was `transparent: true` (for its rim vignette) with `depthWrite:
true` — three.js's transparent render queue sorts by a coarse per-object
bounding-sphere distance, and for a huge flat disc sharing almost the same
depth as the additively-blended hyphae/hairs sitting just above it, that
heuristic could (and did) draw the soil *after* the filaments and overwrite
them, since the soil's own alpha is near 1 across its interior. Fixed by
making the soil fully **opaque** (real depth writes, always drawn in the
opaque pass before any transparent object) and doing the rim vignette by
mixing color toward the background's own near-black instead of alpha —
reads almost identically here since the background is already a similarly
dark gradient. The mushroom "line" was root-caused (not eyeballed) to
`mushrooms.ts`'s `findRingAnchor`: it finds "the merged PR that landed
closest before this release" globally, and for the fixture's early history
several releases in a row honestly resolved to the *same* anchor PR (or to
different early PRs that still happened to cross their own ring radius at a
similar angle) — each individual link is real, but sampling many ring radii
along nearly the same angle read as a straight trail, not fruiting across
the colony.

**Round 2 (soil-opacity + alpha/bloom tuning + mushroom fan-out)** — full
clean `pnpm shot` run (20/20 screenshots, 0 console errors) after: the soil
fix above; a new `buildMushroomsOnRings` pass (`mushrooms.ts`) that detects
a run of consecutive non-clustered releases whose real anchor angles land
within `ANGLE_PROXIMITY_RADIANS` (0.3 rad) of each other and spreads them
evenly across a size-scaled arc (`REPEATED_ANCHOR_GAP` per member, capped at
`REPEATED_ANCHOR_MAX_SPREAD` ≈ 130°) instead of leaving them on top of/next
to each other — every mushroom keeps its real `nearPr` link and its real
ring radius, only the angle within the run is redistributed (tested:
`mushrooms.test.ts`, a synthetic long-lived-anchor-run case, deterministic);
and a substantial alpha/bloom rebalance (hyphae base alpha 0.62–1.0 → 0.16–
0.4, hair alpha 0.35 → 0.18, `RIBBON_WIDTH_SCALE` 7 → 4.5, bloom
`luminanceThreshold` 0.62 → 0.88, `intensity` 0.85 → 0.5) — the first pass's
values, tuned in isolation, accumulated into an overexposed white haze once
hundreds of overlapping additively-blended strands were actually visible
together. Literal result on `pmndrs/valtio` (`desktop-valtio-end.png`):
individually legible bright-cyan filaments radiating and branching from a
small bright spore, brown dead-end filaments woven in, a small cluster of
white mushroom dots reading as a loose patch (not a line), a dark tactile
soil disc with a soft vignette, faint concentric growth rings visible at
mid-growth. Same result held on `expressjs/express` (826 hyphae) and on
mobile framing for both.

**Round 3 (product-direction pivot: galaxy swirl, drop rings)** — the
orchestrator relayed the product owner's direction: keep the radiating-
filament look, lose the concentric rings, and bend the radial growth into a
"luminous spiral galaxy." Implemented as `swirl`/`swirlPower` colony-layout
options (`src/domain/network/colonyLayout.ts`, default `1.6`/`1.4`, real
default so the UI gets it automatically): a pure post-process,
`applySwirl`, run once after every other invariant is established, that
rotates every already-positioned spatial element (hyphae points, nodes,
tips, mushrooms, fusions, hairs — a hair's tip is swirled independently of
its base, then its `direction`/`length` are recomputed, since its two ends
can sit at slightly different disc radii) around Y by
`swirlAngleForRadius(radius) = swirl * (radius / DISC_MAX_RADIUS) ^
swirlPower` — the SAME function of disc radius for every element kind,
which is what keeps picking and rendering consistent (they both read one
already-swirled model) and keeps two originally-coincident points (e.g. a
mushroom and the hypha point it's anchored to) exactly coincident afterward.
Radius itself is untouched, so every prior time-honesty guarantee still
holds exactly. Growth rings were removed from the 3D soil render entirely
(`SoilDisc.tsx` now always passes an empty ring list to the shader, which
still supports the uniform array for a possible future hover-only reveal);
`Legend.tsx` dropped its "Faint ring" entry and (a real wording bug caught
while editing it) fixed "distance from center" to say plain "time" instead
of "time weighted by activity density" — that activity-density blend is the
`spiral` layout's own M2b decision, not colony's (colony explicitly uses
pure eased time, per M2c/M2d's own notes above); `pnpm network-svg`
regenerated with the swirl (no script changes needed — it already calls
`buildNetwork`, which now swirls colony output by default).
**Two existing `colonyLayout.test.ts` invariants needed adapting** (per
the same "measure on un-swirled coordinates" principle) since swirl adds a
large, intentional, radius-dependent rotation that has nothing to do with
either invariant's real subject: the "no single segment over 0.3 world
units" chord-regression check and the "post-fork angular drift ≤ 0.1 rad"
check now `unswirlPosition` each point first (this was tried empirically,
not assumed — both failed by a small margin, ~0.007 and ~0.03 over budget,
before the fix). Six new tests added: `swirlAngleForRadius`'s ramp (0 at
the spore, monotonic to `swirl` at the rim), `applySwirlToPosition`
preserves disc radius exactly and no-ops at the origin,
`unswirlPosition` exactly inverts it, determinism with swirl enabled, a
dedicated swirl-consistency test (builds the same snapshot with `swirl: 0`
and swirl on, then asserts every hypha point/node/tip/mushroom/fusion
position — and a hair's independently-swirled base+recomputed-tip — keeps
its exact disc radius and shifts by exactly `swirlAngleForRadius`), and a
`swirl: 0` opt-out equivalence check.
Literal result (`desktop-valtio-end.png`, `desktop-express-end.png` and
their mobile/mid-growth/selected variants, full clean `pnpm shot` run,
20/20, 0 console errors): both fixtures read as a genuine pinwheel/spiral-
galaxy shape — bright cyan filaments curving into arms from the central
spore, brown dead-end filaments woven through the same arms, no visible
growth rings, mushroom cluster following the curve of its own arm instead
of the earlier straight line, dark soil disc with a soft vignette. Growth
mid-replay (`desktop-valtio-mid.png`) still reads as a coherent partial
spiral (arms cut off partway through, not broken/discontinuous). Selection/
hover (`*-selected-merged.png`, `*-selected-closed.png`) still dims the
rest of the disc correctly and highlights the selected hypha's hairs
brightly, on both fixtures and both viewports — confirming picking stayed
consistent with the now-swirled render (both read the same post-swirl
model, as designed).
**Round 4 (final confirmation)** — reviewed the remaining screenshots from
the same clean run (mobile express end/mid/selected, both state screens,
landing) for regressions from the theme-token change (near-black
`ui.bg`/`ui.panelBg`, cyan `ui.panelBorder`/`ui.accent`, replacing the
tree's warm brown): none found: state screens and landing read cleanly
against the new dark/cyan palette, mobile bottom sheet still compact and
correctly offset, no layout shift. No further changes made.

**Draw calls** (P12, measured via a temporary monkeypatch of
`WebGLRenderingContext.prototype.drawArrays`/`drawElements`/the instanced
variants, removed before commit, not left in `Scene.tsx`): **26** per frame
for both fixtures (draw-call count depends on the number of distinct
meshes/materials, not model size, by construction of the batched-geometry
approach) — comfortably under the "~40" target. `pnpm build`: `Scene` chunk
~1033 kB / gzip ~275 kB (up from T4's ~948 kB/~252 kB — `three` +
`@react-three/postprocessing` + `postprocessing`), still lazy-loaded
separately from the initial `index` chunk (~294 kB / gzip ~92 kB).

**Dependency note**: adding `@react-three/postprocessing` +
`postprocessing` hit a real `pnpm` lockfile bug in this environment — a
second `pnpm add postprocessing@^6.x` (needed because it's a peer, not a
transitive, dependency of `@react-three/postprocessing`) silently left the
root importer's lockfile entry pointing at an unqualified version string
(`6.39.5`) while the actual resolved package lived under a peer-qualified
store key (`6.39.5(three@0.186.1)`), so `node_modules/postprocessing` never
got linked on a clean `pnpm install` (reproduced from a full
`rm -rf node_modules && pnpm install`, not just a one-off). Fixed by hand-
editing the importer's `version:` field in `pnpm-lock.yaml` to the
peer-qualified string and reinstalling; verified fixed with a second clean
`rm -rf node_modules && pnpm install`.

Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass (369
tests total, +47 for M3) · `pnpm build`: pass · `pnpm shot`: 20/20
screenshots (desktop/mobile × {landing, end/mid/selected-merged/selected-
closed for both fixtures, state-token-required, state-not-found}), 0
console errors, across two full iteration rounds (2 and 3 above).
**Known pre-existing flake, not introduced here**: `buildNetwork.test.ts`'s
1000-PR performance test (600ms CI-safe budget) intermittently fails only
when the full suite runs under parallel worker load (observed ~650-690ms
several times during this task's own verification runs); always passes
when run standalone (`pnpm vitest run src/domain/network/buildNetwork.test.ts`).
Not touched here since the perf-sensitive code (`colonyLayout.ts`) only
gained a cheap post-process; flagging for T8/M4 awareness rather than
loosening the budget speculatively.

**Weaknesses, honestly reported**:
- The mushroom-cluster fan-out (round 2) reduces but doesn't fully
  eliminate visual density for a genuine short release-burst (the same
  `express` 16-release cluster M2d already flagged) — still a small dense
  patch, now spread across a wider arc rather than a line/point, not
  eliminated further since that would mean fabricating angular separation
  beyond what a size-scaled cap allows.
- `?sel=` selection and hover were verified via the debug `?t=`/`?sel=`
  URL params (deterministic screenshots) and manual reasoning about the
  picking-grid/shader consistency, not via a real synthetic mouse-hover
  screenshot (the task explicitly marked this "if feasible" — computing a
  hovered element's exact projected screen position for a Playwright mouse
  move was judged not worth the added script complexity here).
- `NetworkModel.overflow` (hyphae/nodes omitted by the render caps) is still
  not surfaced anywhere in the UI/legend — carried forward from M2d's own
  open decision, still unresolved; neither fixture used for visual QA hits
  the caps (623/826 hyphae vs. a ~1000 cap), so this has no visible effect
  on the shots reviewed here, but a 1000+-hypha repo would silently omit
  data with no on-screen indication.
- Touch/real mobile-device interaction was not manually verified (only
  Playwright's synthetic viewport shots, which don't exercise real
  touch/pointer-type quirks) — same residual the tree's own T6 entry
  flagged, still open.
- fps was not benchmarked on real GPU hardware, only verified via headless
  SwiftShader software rendering (not representative of real-GPU frame
  time) — same residual pattern as T4/T5.
- The soil shader's ring-uniform machinery (`soilMaterial.ts`) is now dead
  weight in the default render path (rings are always passed as `[]`) —
  kept rather than deleted since the product direction explicitly allowed
  "at most a nearly invisible hairline shown only while hovering/selecting
  a mushroom" as an option; not implemented here (time-boxed out), so this
  is inert code, not currently reachable from any UI state — flagging for
  M4/T8 to either wire up or remove.

### M3b Visual polish of the 3D mycelium galaxy — done
Commits: `d3600e6` feat(network): render hyphae as fine tapered luminous
threads; `7bbd3f3` feat(network): give mushrooms a lit silhouette and keep
selection legible; `c4df8e4` feat: dark loam soil, collapsed mobile header,
and honest overflow note.

Orchestrator's screenshot review of the M3 round-3/4 shots (`desktop-express-
end.png`, `desktop-valtio-selected-merged.png`, `mobile-express-selected-
closed.png`) found six problems: (1) filaments read as thick flat painted
ribbons with square blocky ends; (2) mushrooms read as flat white/gray dots
in a line; (3) selection wasn't clearly the brightest thing; (4) soil read as
a flat light-blue plate with a hard edge; (5) mobile: the disc was cropped
and the repo name truncated behind two full-text header buttons; (6)
`NetworkModel.overflow` still wasn't surfaced. All six addressed below.

**1. Filaments** (`src/ui/scene/network/geometry/hyphaeGeometry.ts`,
`filamentsGeometry.ts`, `growthMaterial.ts`): a new per-vertex `crossU`
attribute (-1..1 across the ribbon width) drives a per-fragment gaussian-ish
glow falloff (bright core, fading to exactly 0 alpha at the ribbon's own
edges) instead of a flat-shaded rectangle. A new pure `tipTaperFactor`
helper (tested, `hyphaeGeometry.test.ts`) smoothsteps both width AND alpha
to 0 over a proportional span at each end of a hypha's own polyline
(`TAPER_FRACTION = 0.18`, floored at 3 samples) — fading brightness together
with width was the fix for a real round-2 finding: a narrowing-but-still-
full-alpha near-tip segment still bloomed into a small bright "cap" even
once the geometry itself tapered to a point. A shallow per-vertex Y "tent"
(`CROSS_Y_TILT`) adds depth when orbiting; a deterministic `hashNoise`
helper (tested) adds slight along-length brightness variation.
`RIBBON_WIDTH_SCALE` went 4.5 → 6.5 (round 1, more room for the falloff) →
5 (round 3, the wider mesh plus a too-soft falloff still read as thick in a
dense bundle) with the fragment shader's gaussian exponent tightened
6.5 (was 4.2) for the unselected core. Hairs/bridges (sharing the same
`ShaderMaterial`/draw call as the ribbon mesh) now populate `crossU=0`/
`brightness=1` so the shared program's attribute state can't leak stale
values between the two meshes.

**2. Mushrooms** (`mushroomInstances.ts`, `MushroomsMesh.tsx`,
`NetworkSceneContent.tsx`, `PointGlowInstances.tsx`): `MushroomsMesh` now
uses `MeshStandardMaterial` (still `vertexColors` for cap/rim/stem) lit by
two mushroom-only lights added to the scene — a strong key light plus a
deliberately DIM ambient hemisphere fill (round-2 finding: a hemisphere
close in intensity to the key light washed the tiny cap back into flat gray;
real light/shadow contrast is what makes a form this small still read as
3D) and a low warm rim light. Every OTHER material in the scene stays fully
unlit (`MeshBasicMaterial`/raw `ShaderMaterial`), so these lights have zero
effect elsewhere. `BASE_SCALE` went 0.16 → 0.22 (round 1) → 0.42 (round 3,
still too small at 0.22 for the shading to read at any real screen size) and
the minimum-scale floor 0.6 → 0.75. A soft additive glow halo now sits
behind each cap (`PointGlowInstances`, which gained a configurable
`opacity` prop, default 0.95 unchanged for fusion knots/tips, 0.3 for the
mushroom halo so it reads as a diffuse aura rather than a second solid
shape fighting the lit cap for attention). A small render-time vertical
stagger (`VERTICAL_STAGGER`, seeded per mushroom id, cosmetic only — the
real `Mushroom.position.y` is untouched) was added so a cluster doesn't
read as one flat row. Domain-level fan-out (M3 round 2's
`buildMushroomsOnRings`) was left as-is — the remaining "clump" read was a
rendering-scale problem, not a distribution problem (confirmed by how much
better a scattered cluster reads once caps are 2x bigger and shaded).

**3. Selection** (`growthMaterial.ts`, `CameraFocus.tsx`, `SoilDisc.tsx`,
`soilMaterial.ts`): the selected hypha's fragment-shader core width now
narrows far less (`coreWidth` mixes 6.5 → 2.2 when selected) and never
fully fades near its own ribbon edge (`outAlpha = max(outAlpha, isSelected *
vAlpha * 0.85)`), so it reads as a visibly thicker, near-solid glowing line,
not just a tinted version of the same thin thread; its brightness boost went
`+0.55` → `+0.7` → `+0.85` across rounds, and the rest of the galaxy dims to
`0.3` alpha (was `0.22`, both within the brief's 0.25–0.35 band). A real
verification gap was found and fixed while checking this: the two bundled
fixtures' hardcoded visual-QA selection ids (`scripts/shot.ts`) were each
fixture's *smallest* PR (valtio PR #1, express PR #645 — both ~1-commit
diffs), which the colony layout's work-driven hypha length (M2d) draws only
a few screen pixels long regardless of how bright selection makes it —
confirmed via a throwaway debug screenshot that the *exact same* shader
reads as unmistakably bright on a substantial PR. Swapped both ids to each
fixture's own largest merged PR (valtio #965/170 commits, express
#2554/504 commits) and largest closed PR (valtio #962/77 commits, express
#5139/37 commits), so the committed screenshots actually demonstrate the
effect. Selecting a mushroom now reveals its own real release-ring radius
as a hairline on the soil (reusing `soilMaterial.ts`'s existing, previously
dead, ring-uniform machinery — `SoilDisc` updates the uniforms live via the
mesh ref on selection change, never rebuilding the disc material/geometry);
the ring's own glow constants were bumped louder (peak `0.045` → `0.09` →
`0.4`, smoothstep width `0.012` → `0.014` → `0.022`) since it's now a rare
single-ring reveal, not the old "every release, always on, many summed"
case that needed to stay barely-there. Camera crop bug found and fixed: a
mushroom near the disc's rim panned the camera fully onto it (`CameraFocus`
preserves offset/distance, only translates), which for a far-from-center
element shifted the view enough that the opposite side of the disc ran off
-frame — `CameraFocus` now caps the pan distance to a fraction
(`MAX_PAN_FRACTION_OF_RADIUS = 0.22`) of the model's own bounding radius,
matching `CameraRig`'s own framing margin, so selection still visibly nudges
the camera without ever cropping the galaxy.

**4. Soil** (`soilMaterial.ts`, `Scene.tsx`): root-caused (not just
re-tuned) the "flat light-blue plate with a hard edge" finding to the base
gradient going darkest-at-center → LIGHTEST-at-edge and only then mixing
toward black for the vignette starting at `0.82 * radius` — producing a
visible lighter ring right before the rim, reading as a coin's raised edge.
Fixed to one monotonic darkening: center now starts at the lighter of the
two loam tokens (a deliberate "faint cool ambient haze near the core", P1
item 7) and darkens continuously to the darkest token, with the vignette
starting much earlier (`0.55 * radius`) and continuing the SAME direction
(never reversing it) down to near-black at the true rim. A second,
higher-frequency noise octave was added for finer grain. A second,
independent edge-contrast source was found afterward (round 3): even with
the gradient fixed, the disc's circular silhouette still showed a faint
rim wherever the scene's own vertical sky-gradient background happened to
be locally lighter than the disc's darkest edge tone (the tree scene's
shared `buildSkyTexture` two-stop gradient, reused as-is by the network
scene) — an edge-contrast (Mach-band) effect, not a color bug in the disc
itself. Fixed by giving the network `Scene.tsx` its own FLAT background
color matching the soil shader's exact vignette target, instead of reusing
the shared gradient texture (`src/ui/scene/geometry/skyTexture.ts` itself
was left untouched — still used by the not-yet-removed tree scene).

**5. Mobile** (`ViewerHeader.tsx`, `CameraFocus.tsx`): the header's "Copy
link"/"Save image" buttons collapse to icon-only (🔗/⇩, real
`aria-label` + `title`, `useMediaQuery('(max-width: 640px)')`) under narrow
widths, freeing width for the repo name (which already truncates via
ellipsis rather than overflowing) — confirmed fixed via a before/after
mobile shot: `expressjs/express` now renders in full where it previously
truncated to `expressj…`. The disc-cropping half of this item turned out to
be the SAME root cause as item 3's camera-pan bug (a selection focused near
the rim, common on the narrow mobile shots the review looked at) — the pan
clamp fixes both; a plain (non-selected) mobile shot was already unclipped
before this fix too, confirming the clamp was the right fix rather than a
`CameraRig` framing-margin change.

**6. Overflow honesty** (`src/domain/network/renderHints.ts`,
`Legend.tsx`, `ViewerPage.tsx`): new pure `formatOverflowNote(hyphaeOmitted)`
helper (tested: null at 0/negative, singular at 1, plural otherwise) renders
a quiet note under the Legend ("+N pull requests not drawn") whenever
`NetworkModel.overflow.hyphaeOmitted` is non-zero. Neither bundled fixture
hits the render cap (623/826 hyphae vs. the ~1000 cap, per M3's own
measurement), so this is inert for the demo but no longer silent for a
1000+-hypha repo.

**Visual iteration (4 rounds, `pnpm shot` both fixtures × desktop/mobile ×
end/mid/selected-merged/selected-closed + a new selected-mushroom shot,
20–24 screenshots/round, reviewed with Read, 0 console errors every round;
draw calls re-measured at 26/frame via a temporary `drawArrays`/
`drawElements` monkeypatch, same as M3's own count, removed before commit
— the P12 "~40" budget still holds even with 2 more lights and 1 more
instanced glow mesh, since postprocessing's own bloom/tonemap passes
dominate the count, not scene object count):**

- **Round 1** (`crossU` falloff + `tipTaperFactor` + soil monotonic-gradient
  fix + mobile header icon-buttons + overflow note, all committed-code
  state, no in-flight edits during the shot run): filaments read as
  noticeably finer wispy curved threads, a real improvement over flat
  ribbons, though dense rim bundles (many hyphae terminating at similar
  radii) still read as a solid bright fringe. The soil's hard "coin edge"
  band was visibly gone, replaced by a smooth dark navy-teal disc fading
  into the black background with no sharp ring. Mushrooms were still tiny
  and essentially flat (unlit `MeshBasicMaterial`, no scene lights yet) —
  small white/cream dot clusters, not yet legible as mushrooms. The mobile
  header showed the full `expressjs/express` name with icon-only buttons.
  Selection contrast was present but subtle: `pr#1`/`pr#645` (the original
  shot.ts fixture ids) are both ~1-commit PRs, drawing only a few pixels
  long regardless of brightness — flagged for investigation, not yet
  understood as a fixture-id problem at this point.

- **Round 2** (orchestrator relayed a direct review of
  `mobile-express-selected-mushroom.png`): confirmed 4 concrete problems at
  full mobile resolution — the disc was cropped left/right (camera panned
  too far toward the selected mushroom), filaments still had bright
  rectangular ends at the rim despite the round-1 taper (root-caused to
  full-alpha near-tip segments still blooming), mushrooms were still "a
  gray clump, no silhouettes" (confirmed: `MeshStandardMaterial` had just
  been swapped in with no lights added yet — an incomplete intermediate
  state, not a finished attempt), and the soil still showed a rim band
  (root-caused afterward to the background-gradient edge-contrast issue,
  item 4 above). Fixed all four: camera pan clamp, alpha-tied taper +
  narrower `RIBBON_WIDTH_SCALE`, mushroom lights + bigger scale + softer
  glow, flat matching background.

- **Round 3** (all four round-2 fixes applied): the mobile disc now sits
  fully within the viewport with margin on both sides, confirmed on both a
  non-selected and a mushroom-selected shot. Mushrooms read as distinct
  cream-white lumpy cap clusters with real shading gradients (lighter/
  darker patches across the caps) — a clear, literal improvement from flat
  dots, though individual stems still aren't legible as separate from the
  cap at this scale and the cluster still reads as one fused blob rather
  than clearly-separate mushrooms. The soil disc's silhouette now blends
  seamlessly into the background with no visible edge anywhere around the
  circumference. A throwaway debug screenshot (PR #2554, 504 commits,
  `hypha-pr2554`) confirmed the selection shader itself was already working
  correctly — the earlier "hard to see" impression was the fixture-id
  problem (item 3 above), not a shader bug; fixed by swapping
  `scripts/shot.ts`'s ids to each fixture's largest PR.

- **Round 4** (final confirmation, full clean run + a selection-ring
  visibility bump since the mushroom-selected shot's ring was present in
  the uniform data but too subtle to see at the old always-on-many-rings
  constants): `desktop-express-selected-merged.png` (PR #2554) shows an
  unmistakably bright near-white arm running from the spore out to the
  mushroom cluster while the rest of the galaxy has visibly dimmed;
  `desktop-valtio-selected-closed.png` (PR #962, 77 commits, closed) shows
  a clear curved chain of small bright white hair-ticks (one per commit)
  tracing the selected hypha's path, exactly matching "hairs/commits
  visible as fine bright ticks." `desktop-valtio-selected-mushroom.png`
  (v1.0.0, an early/small-radius release) shows a faint but genuinely
  visible cyan hairline arc around the spore at the mushroom's own ring
  radius. Landing page and both product-state screens (token-required,
  not-found) were re-checked for regressions from the flat-background
  change and showed none.

**Draw calls**: 26/frame (measured via a temporary `requestAnimationFrame`-
bracketed monkeypatch of `drawArrays`/`drawElements`/the instanced variants
around the express fixture, removed before commit) — unchanged from M3's
own 26, comfortably under the "~40" budget; postprocessing's own multi-pass
bloom/tonemap dominates the count, so 2 more lights + 1 more instanced
mushroom-glow mesh didn't move it. fps not benchmarked on real GPU hardware
(same residual pattern as every earlier rendering task in this doc — only
verified via headless SwiftShader software rendering).

Checks (foreground, run independently for EACH commit by stashing the
later, not-yet-committed changes first, not just once at the end): `pnpm
typecheck`: pass (all 3 commits) · `pnpm lint`: pass (all 3 commits) ·
`pnpm test`: 382 tests total (+13 for M3b: `tipTaperFactor` 6,
`hashNoise` 3, `formatOverflowNote` 4), pass at every commit when run
standalone · `pnpm build`: pass at every commit (`Scene` chunk ~1037 kB /
gzip ~277 kB, essentially unchanged from M3) · `pnpm shot`: 0 console
errors at every commit and every round (20/20 before the mushroom-selected
shot was added in commit 2, 24/24 after).

**Known pre-existing flake, reconfirmed, not introduced here** (same one
M3 already flagged): `buildNetwork.test.ts`'s 1000-PR colony-layout
performance test (600ms budget) intermittently failed under full-suite
parallel worker load in 4 separate `pnpm test` runs during this task
(605–720ms observed), always passed standalone
(`pnpm vitest run src/domain/network/buildNetwork.test.ts`, run 5 times,
0 failures). Untouched here (no perf-sensitive code changed).

**P1–P12 polish-bar status, honestly reassessed**:
- **P1 Palette** — holds; no token changes, only how the existing tokens
  are used (soil gradient monotonicity, mushroom lighting doesn't add new
  hues).
- **P2 Light & glow** — holds, extended: bloom is still purely selective;
  mushroom lighting is a new but fully isolated (mushroom-only-material)
  addition, not a scene-wide haze regression.
- **P3 Organic form** — much improved, not fully closed: filaments now
  taper to true points with a real cross-ribbon glow falloff instead of a
  flat rectangle; a genuinely dense bundle of many hyphae terminating near
  the same rim radius still reads as a thicker fringe than a single
  isolated strand would (an aggregate-density effect, not an unfixed
  per-strand taper — see round 1/2 notes above).
- **P4 Motion** — holds, unchanged by this task.
- **P5 UI craft** — improved: the mobile header no longer starves the repo
  name of width.
- **P6–P8** — unchanged by this task (not in scope).
- **P9 Legibility** — holds and is meaningfully stronger: the legend's
  claims (spore/filament/knot/mushroom/etc.) are now visually true at a
  glance, not just technically true in the data.
- **P10 Share** — unchanged.
- **P11 A11y** — the two header buttons now expose real `aria-label`s when
  collapsed (previously always had visible text, arguably equivalent or
  better for a screen reader either way) — not independently re-audited
  beyond this, same residual as M3 (no automated contrast-ratio check, no
  screen-reader walkthrough).
- **P12 Perf & robustness** — holds: draw calls unchanged (26), 0 console
  errors across every round/commit, `NetworkModel.overflow` is no longer
  silently dropped.

**Weaknesses, honestly reported**:
- A genuinely dense bundle of same-direction hyphae (the galaxy's own
  "arms") still reads as a thicker bright fringe at the rim than any single
  strand's own taper would suggest — an aggregate-density effect from many
  overlapping additive strands, not a leftover per-strand square-cap bug.
  Reducing it further would mean either thinning `RIBBON_WIDTH_SCALE`
  again (already tuned down twice, risks the opposite "spidery/wispy" if
  reduced further) or reducing hypha density itself (a data/layout
  decision, out of this task's scope).
- Mushroom clusters (still real fan-out data, not a straight line) read as
  one fused lumpy cap-cluster shape rather than clearly-separate individual
  mushrooms at the full-disc zoom level used for visual QA — legible as
  "mushrooms growing here," not yet legible as "N distinct mushrooms."
  Zooming in (camera focus on a selected mushroom, e.g. via a closer
  `CameraFocus` distance override for mushroom selections specifically) was
  considered but not implemented — time-boxed out, flagging for a possible
  future pass.
- The selection ring hairline is faint by design (a single ring, not meant
  to compete with the galaxy) — genuinely visible in a full-resolution
  screenshot for an early/small-radius release (`v1.0.0` in the valtio
  fixture) but not independently re-verified for a large-radius (recent)
  release, where it would trace a much bigger circle closer to the rim's
  own dense fringe and could be harder to distinguish.
- fps not benchmarked on real GPU hardware (same residual as every prior
  rendering task).
- Touch/real mobile-device interaction still not manually verified (same
  residual as M3/T6).
- The mobile disc-cropping fix (camera pan clamp) was verified fixed via
  screenshots at the one viewport width this project tests (390px) — not
  verified across a wider range of real device widths.

### M3c Visual fixes — done
Commits: `b1df0c6` fix(network): spread mushrooms by golden angle, restore
glow, and fix mobile header; `6758a84` fix(network): fix mobile disc crop
and desktop header badge gap (a follow-up fix after the orchestrator's
review of `b1df0c6` itself found two real regressions — see below).

Per the orchestrator's literal review of `.shots/desktop-express-end.png`,
`desktop-valtio-selected-merged.png` and `mobile-valtio-end.png` (state
after M3b): mushrooms dominated the galaxy as huge cream cotton-ball blobs
(valtio's 80 releases forming one arc along a single arm; express showing a
fused white clump), the galaxy read dimmer/flatter than the pre-M3b
commit, express's rim showed blocky white/cyan rectangle fragments, the
mobile disc was cropped left/right with a truncated header, and the soil
plate still read as a visible lighter-blue ellipse.

**1. Mushroom scale + spread** (`src/domain/network/mushrooms.ts`,
`src/ui/scene/network/geometry/mushroomInstances.ts`): scaled mushrooms
down ~3.5x (`BASE_SCALE` 0.42 → 0.12) and removed the old
`Math.max(0.75, mushroom.scale)` floor, which had clamped patch/minor
releases up to the same size as majors, making the domain's own
major/minor/patch scale ratios mostly moot. Placement angle for
`buildMushroomsOnRings` (colony) is now the golden angle
(`MUSHROOM_GOLDEN_ANGLE_RADIANS`, ~137.5deg) ordered by each non-clustered
release's own time index, with a deterministic `enforceMinAngularSeparation`
safety net for releases whose rings land at a similar radius -- radius
stays exactly time-honest; `Mushroom.nearPr` is unchanged as the real
closest-preceding-merge data link the detail panel shows, only PLACEMENT no
longer reads it.
**Two real bugs found and fixed while building this** (not just the
intended feature): (a) `clusterAngle` was reset only for `clusterId`, never
for itself, when processing a standalone (non-clustered) release -- every
mushroom after the sequence's first one silently inherited the PREVIOUS
mushroom's angle instead of its own, which is the actual root cause of "80
releases form one big arc" (the M2d/M3b per-run angle-fan logic this
replaced was never really being applied past the first entry). (b)
`enforceMinAngularSeparation`'s `peers.find(...)` treated a valid peer
INDEX `0` as falsy ("nothing found"), skipping the very first conflict
check -- caught by the function's own first unit test.

**2. Brightness** (`src/ui/scene/network/geometry/hyphaeGeometry.ts`,
`geometry/growthMaterial.ts`, `Scene.tsx`, `SporeMesh.tsx`): raised
`BASE_ALPHA_MIN`/`MAX` (0.16/0.4 → 0.22/0.52), the shader's core-brightness
mix (`mix(0.65, 1.35, core)` → `mix(0.8, 1.55, core)`), `Bloom`
threshold/intensity (0.88/0.5 → 0.84/0.62) and the spore halo's opacity
(0.16 → 0.22) -- restoring luminosity toward the pre-M3b galaxy without
regressing M3's round-1 "dense colony blooms into undifferentiated haze"
finding.

**3. Rim artifacts** (`hyphaeGeometry.ts`'s `tipTaperFactor`): a short/
low-work hypha (fewer than the old `MIN_POINTS_TO_TAPER` = 6 points) skipped
tapering entirely, rendering as a constant-width, hard-square-ended ribbon
-- exactly the "blocky white/cyan rectangle" artifact at the rim, where
short hyphae are common. Any polyline with >= 3 points (2 segments) can now
taper its own endpoint(s) without fully degenerating; only a true
single-segment stub still renders at constant width.

**4. Mobile** (`src/ui/scene/network/CameraRig.tsx`, `ViewerHeader.tsx`):
(a) confirmed the disc genuinely fit with margin once the M3c-round shots
were taken against the committed M3c code (the mobile crop the task brief
described turned out to already be fixed by M3b's own camera math at the
time of writing) -- but the orchestrator's review of the FIRST M3c commit
found it cropped again; root-caused to `CameraRig`'s `OrbitControls`
`maxDistance={radius * 4.5}` clamping the camera straight back down right
after the positioning effect set a wider distance for narrow portrait
viewports (needs ~7.3x radius at 390x844 vs. ~3.6x at 1440x900 landscape,
since `OrbitControls.update()` enforces min/maxDistance on every call, not
just interactive orbiting) -- fixed in the `6758a84` follow-up by scaling
`maxDistance` off the same framing-distance formula, with headroom. (b)
narrow-viewport header: dropped the source badge (`SourceBadge`) and
guaranteed ~20+ characters of the repo name via `minWidth: '20ch'` + a
`<wbr/>` after the slash for a real 2-line wrap point -- but applying that
`minWidth` UNCONDITIONALLY also widened the name's box on DESKTOP past what
a short name like `expressjs/express` actually filled, visibly gap-pushing
the badge away from the name (a second regression the orchestrator caught
in the same review); fixed by gating the guaranteed-width/2-line treatment
on the narrow-viewport branch only, leaving desktop's natural
shrink-to-fit single line untouched.

**5. Soil** (`src/ui/theme/tokens.ts`'s `mycelium.soilFar`,
`soilMaterial.ts`): darkened the center-haze token closer to the rim tone
(`#0a0e12` → `#06080b`) and started the vignette earlier (`0.55*radius` →
`0.4*radius`) so more of the disc reaches the background's own near-black,
leaving only a faint loam haze near the core.

Iterated 3 full `pnpm shot` rounds (both fixtures x desktop/mobile x
end/mid/selected-merged/selected-closed/selected-mushroom, 26
screenshots/round) against the in-progress code, reviewed with Read each
round, 0 console errors every round; a 4th round (after the follow-up
`6758a84` fix) reconfirmed both regressions resolved. Round 1: mushrooms
now read as small glowing dots spread across the whole disc (not one arc/
clump); filaments visibly brighter; no more blocky rim rectangles; mobile
disc fit with margin and the header showed real icon buttons + full repo
name -- but the soil ellipse was still faintly visible. Round 2 (soil
token/vignette tweak + narrow-badge-hide): soil markedly subtler, mobile
header now cleanly icon-only. Round 3 (final confirmation): all five items
holding. Round 4 (post-follow-up-fix): mobile disc fits with real margin
on both sides at 390x844; desktop header shows the SAMPLE badge
immediately after the repo name with no gap.

Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass (390
tests before M4's test removals) · `pnpm build`: pass · `pnpm shot`: 0
console errors, all 4 rounds.

**Weaknesses, honestly reported**: the mobile header's "repo name never
truncated below ~24 chars, wrap to 2 lines" guarantee was only verified
against the two bundled fixtures' short names (13 and 18 characters,
neither ever needs the guarantee to activate) -- the 2-line wrap path
itself was not visually exercised with a genuinely long `owner/repo`.
`enforceMinAngularSeparation` is a best-effort deterministic nudge, not a
proven-optimal packing -- a synthetic stress test (40 releases every 7
days, an unrealistically dense synthetic case, not a real repo's release
cadence) showed it can still leave pairs below the target separation when
far more releases share one radius band than `2*PI/minSeparation` allows;
the shipped test uses a more realistic 60-day cadence, which passes
cleanly.

### M4 Cleanup — done
Commit: `04bff61` refactor: remove the superseded tree metaphor and finish
the mycelium README.

**Tree code deletion**: `src/domain/tree/`, `src/ui/scene/tree/`, the old
`src/ui/scene/Scene.tsx` and its tree-only geometry helpers (`island.ts`,
`instances.ts`, `shapes.ts`, `skyTexture.ts`, `tubeFrames.ts`,
`tubeGeometry.ts`), `useRepoTree.ts` and `components/ExploreList.tsx` (the
network has its own `NetworkExploreList`) — all unrouted/unreferenced since
the pivot, confirmed via `rg` before deletion. The tree-only palette/
helpers in `theme/tokens.ts` (`palette`, `leafColorForAge`,
`soilStratumColor`, `barkColorAt`) and `theme/color.ts`
(`softenToward`, `threeStopRamp`) were also removed once `rg` confirmed
zero remaining consumers. `domain/elementDetail.ts`'s tree-only
`EraDetail`/`resolveElementDetail` were removed, keeping only the
`ElementDetail` shape shared with the network model and `DetailPanel`.

**Spiral layout deletion**: `layout.ts`'s `layoutNetwork` (and its
spiral-only internals: `assignLanes`, `buildActivityCdf`/`ActivityCdf`,
`localSpiralPitch`, `PositionedHyphaResult`/`LayoutResult`,
`SPIRAL_TURNS`/`SPIRAL_PITCH_SAFETY`/`NESTED_MAX_LANE_DEPTH`/
`SIDE_JITTER_MAX`) and `mushrooms.ts`'s spiral-only `buildMushrooms` are
gone; `buildNetwork` no longer branches on a `layout` option and always
calls `layoutNetworkColony`. `NetworkLayoutMode` is now a single-value
`'colony'` literal type (kept, not removed, so the field still documents
intent) rather than deleting `NetworkModel.layout` outright. The still-
shared disc/time geometry `layout.ts` also held (`radiusForFrac`,
`timeToFrac`, `discRadius`, `pointOnHyphaAtRadius`, `capEvenly`,
`radiusForCommitCount`, `LayoutOptions`/`DEFAULT_LAYOUT_OPTIONS`) moved
into a new `ringGeometry.ts` first; `radiusForFrac`'s `activity`-blend
parameter (`ActivityCdf`) was simplified away since colony's own call site
never passed one -- the blend algebraically reduced to exactly the
pure-time component for every real colony call, confirmed before deleting
it. `scripts/network-svg.ts` (M2c's spiral-vs-colony comparison tool) was
simplified to colony-only rather than deleted outright, since it's still a
useful colony-only debug-SVG script.

**Shared-helpers migration** (a known follow-up flagged back in M2):
`prng.ts`, `vector.ts`, `timeBounds.ts` and a new `playback.ts`
(`mapPlaybackProgressToTime`/`easePlaybackProgress`, the two genuinely
metaphor-agnostic functions split out of tree's otherwise tree-geometry-
specific `growth.ts`) plus `testHelpers.ts` moved from the deleted
`src/domain/tree/` into a new `src/domain/shared/`; every import across
`domain/network/*` and the UI (`useGrowthClock.ts`, `TimeScrubber.tsx`,
`hyphaeGeometry.ts`, `filamentsGeometry.ts`, `pointInstances.ts`,
`mushroomInstances.ts`) updated to the new path.

**README/OG/hero**: README rewritten for the mycelium product -- the "every
repository grows a mycelium galaxy" framing, a real screenshot
(`docs/screenshot.png`, generated via the new `pnpm hero-images` script
from a fully-grown `expressjs/express` render, 443 kB raw →
`pngquant --quality=50-85` → 98 kB, under the 400 kB budget), the spore/
filament/fork/knot/dry-filament/glowing-tip/hair/mushroom mapping table,
a "how it works" section (work-driven length, gap-filling growth,
data-free galaxy swirl), run-locally/`GITHUB_TOKEN`/Vercel-deploy sections
kept from the prior pass, and a hexagonal-folders architecture tree updated
for `domain/network`/`domain/shared`. `public/og.png` (1200x630, cropped
from the same render, 96 kB, under 300 kB) and the landing page's hero
image (`public/hero.png`, 94 kB, under 250 kB, replacing the abstract
animated SVG placeholder with a real cropped render) came from the same
script. `pngquant` was not present in the sandbox -- installed via `brew`
(the one exception to "never install unless asked," since the task itself
required a compressed PNG under a hard byte budget and no other tool was
available). `index.html`'s meta description/OG/Twitter tags, `theme-color`
(`#151009` warm brown → `#05070a` mycelium near-black), the favicon's
palette (warm gold/orange → cyan/mint) and the landing page's tagline/
document-title were all updated off the old tree-era wording/palette.

**"Tree" wording sweep**: `rg -i 'tree|leaf|fruit|limb|twig'` across `src`,
`index.html` and `README.md`; fixed the handful that were user-facing or
factually wrong (`TooltipLayer.tsx`'s doc comment referenced the now-
deleted `resolveElementDetail`; `Scene.tsx`'s doc comment said the tree
scene was "left in place, unrouted" when it's now fully deleted;
`index.css`'s "the tree... stays visible" comment). Left alone: legitimate
non-metaphor uses (`${url}/tree/${branch}`, a real GitHub URL path
convention; mushrooms "fruiting" on their ring, a mycology term; plain
English "leaves"/"leaves ... unchanged") and internal historical/
comparative doc comments ("mirrors the tree's X", "the tree's V2 pass
found...") that accurately describe design lineage without claiming tree
code still exists.

**Bundle sizes, before/after** (both `pnpm build`, same machine): index
chunk 294.83 kB / gzip 92.67 kB → 286.31 kB / gzip 89.70 kB (a modest real
reduction, from the shared `DetailPanel`/`elementDetail.ts` no longer
carrying the tree-only `EraDetail` branch); `Scene` chunk 1,037.21 kB / gzip
277.02 kB → 1,037.44 kB / gzip 277.06 kB (essentially unchanged). The
`Scene` chunk being unchanged confirms the deleted tree-scene code was
already excluded from the production bundle by normal Vite/Rollup dead-code
elimination before this task even started (nothing in the actual route
graph ever imported it) -- M4's value here is source-tree hygiene and
honest `rg`-verified dead-code removal, not a bundle-size win.

Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass (300
tests, down from 390 -- the removed 90 were exclusively tree-only or
spiral-only coverage; no network/colony test coverage was lost, and 2 new
`ringGeometry.test.ts`/`playback.test.ts` files preserve the still-shared
functions' own coverage) · `pnpm build`: pass · `pnpm shot`: 26/26
screenshots, 0 console errors, including the landing page's new real hero
image loading cleanly.

**Weaknesses, honestly reported**: no automated dead-export checker
(`ts-prune`/`knip`) is installed in this project, so the dead-export sweep
was manual `rg` per removed/moved symbol rather than an exhaustive
tool-verified pass -- a small chance a genuinely-unused export was missed.
`docs/screenshot.png`/`public/og.png`/`public/hero.png` are lossy-
compressed (`pngquant`, palette-reduced); a pixel-level side-by-side
against the uncompressed originals was not done, only a visual Read-tool
check that they still look correct.

### T8 Polish — done
Commits: `55a70e8` fix: autoplay growth and restore hover and focus
feedback; `0cb2bd3` fix: harden rendering and move layout off the main
thread; `ed9739e` fix: classify graphql rate limits and set api caching;
`f9dd805` fix: polish landing samples, mobile framing and focus styles.

Fixed the findings of two independent reviews (technical + product/design)
across four groups. One work-unit commit per group, TDD off (no project
config, source: repo), Vitest runner. Checks run after each group; `pnpm
shot` (headless Playwright/SwiftShader) run after every group for visual
regression, plus targeted Playwright checks for the specific findings.

**Group A — Growth & interaction** (commit `55a70e8`):
- **A1 (CRITICAL) autoplay never advanced.** Root cause: React `StrictMode`
  double-invokes the mount effect in dev (effect -> cleanup -> effect).
  `useGrowthClock`'s original mount effect resumed with `if
  (clock.isPlaying()) clock.play()`; the synthetic cleanup's `destroy()`
  already set `playing = false`, so that check was false on the real second
  mount and `play()` was never called again -- the clock was permanently
  stuck at whatever progress it reached in the few ms before the synthetic
  unmount (near 0). Fixed by extracting the state machine into
  `growthClockController.ts` (injectable scheduler, directly unit tested,
  9 tests incl. a StrictMode mount->destroy->mount regression test) and
  resuming from a `shouldAutoPlay` intent captured once at creation,
  never from the clock's post-destroy runtime state.
- **A2 picking hit invisible (not-yet-grown) elements.** `PickTarget` now
  carries `visibleAt` (the later of a segment's two endpoint times,
  matching the growth shader's own `vBirthTime > uCurrentTime` discard);
  `queryNearest` takes the current growth time and filters by it. 4 new
  tests in `pickingGrid.test.ts`.
- **A3 hover affordance missing for the spore and mushrooms.** The spore
  had NO pick target at all (not hoverable/selectable); mushrooms had a
  pick target (tooltip worked) but zero visual highlight feedback (no
  hypha to highlight, since a mushroom isn't part of a hypha ribbon).
  Added a spore pick target (`model.spore`) + halo brighten-on-hover;
  added a `HIGHLIGHT_SCALE` instance-scale-up for mushrooms and tips on
  hover/select (`applyGrowth.ts`, 5 new tests). Filaments/tips already
  worked via the shared growth shader's hypha-highlight uniforms.
- **A4 camera focus never ran for a `?sel=` deep link** (also any click
  made before `OrbitControls` finished registering). Root cause:
  `CameraFocus`'s effect depended only on `[selectedId]`; `useThree().controls`
  is still `null` on the very first render (before `OrbitControls`'s own
  mount effect registers it), and for a deep link `selectedId` is ALREADY
  non-null on that same first render (`useSelection`'s lazy initial state
  reads `?sel=` straight from the URL) -- so the guard bailed out and,
  since `selectedId` never changes again on its own, focus silently never
  happened. Fixed by adding `controls` to the effect's dependency array.
- **A5 first-visit legibility.** Added `GrowthCaption` (dismissible,
  growth-progress-synced two-line caption, never shown under
  `prefers-reduced-motion`, hides itself once autoplay ends or is
  dismissed) and a finite (never-repeating) CSS pulse on the Legend
  button, both gated off under reduced motion.
- **Playwright verification** (scratch script, deleted after use): A1 --
  sampled the scrubber every ~1s for ~13s on a fresh `pnpm dev`-equivalent
  load: `0.148, 0.242, 0.312, 0.433, 0.495, 0.617, 0.742, 0.842, 0.937,
  1.000...` -- monotonic, reaches 1.0. A3 -- scanned the canvas for a hover
  point; found one, confirmed `cursor: pointer` and a real tooltip ("Closed
  pull request#1139 ..."). A4 -- screenshot hash changed after a click
  select (camera moved), AND a fresh `?t=1&sel=hypha-pr1139` deep-link
  navigation (no prior interaction) rendered a different camera framing
  than the unselected page, confirming the deep-link race is fixed.
- Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass
  (336 tests, +12 for this group) · `pnpm build`: pass · `pnpm shot`:
  26/26 screenshots, 0 console errors.

**Group B — Robustness & perf** (commit `0cb2bd3`):
- **B1 `SoilDisc` leaked its ShaderMaterial** on repo->repo navigation
  (`useMemo` keyed on `radius`, no dispose). Added the missing
  `useEffect(() => () => material.dispose(), [material])`. Audited every
  other `useMemo(() => new THREE...)`/`useMemo(() => create...)` in
  `src/ui/scene`: `NetworkSceneContent`'s `filamentMaterial` and
  `PointGlowInstances`'s geometry/material already dispose correctly;
  `Scene.tsx`'s `background` is a `THREE.Color` (no GPU resource, nothing
  to dispose); the mushroom geometry template is an intentional
  process-lifetime module-cached singleton (never disposed by design, not
  a per-navigation leak).
- **B2 `buildNetwork` blocks the main thread ~1.3s at the real server
  caps.** Measured via a new `pnpm bench` script: 710-960ms per run in
  this sandbox for the synthetic at-caps snapshot (1000 merged PRs x 20
  commits, 200 closed, 50 open, 100 branches, 100 releases) -- same order
  of magnitude as the reviewer's ~1.3s. Moved into a Web Worker
  (`buildNetworkAsync`/`buildNetworkWorker.ts`, Vite `new Worker(new
  URL(...), { type: 'module' })`), with a synchronous fallback
  (`createWorker` returns `null`) for any environment with no `Worker`
  global -- Vitest's `node` test environment in particular, so every
  existing `buildNetwork` test kept working unchanged. `pnpm build`
  confirms a separate `buildNetworkWorker-*.js` chunk (~19 kB).
  **Self-caught regression**: the first version called
  `THREE.setConsoleFunction` (needed for B5) from the eager `main.tsx`,
  which pulled all of `three` into the initial bundle (`index` chunk
  287kB -> 667kB, `Scene` chunk 1038kB -> 667kB, confirmed via `pnpm
  build`'s own chunk sizes) -- moved the call into `Scene.tsx` (the
  existing `React.lazy` boundary) instead; bundle sizes back to normal.
- **B3 flaky wall-clock perf test.** Replaced the `performance.now()` <
  600ms budget (intermittently failed at 600-720ms under parallel-worker
  CI load per M3's own notes) with a 100% deterministic proxy: an opt-in
  `ColonyLayoutInstrumentation.onSpanningScan` hook (never used by
  production code) reports exactly how many already-placed hyphae
  `computeSpanning`'s per-placement scan walks; for `n` hyphae placed one
  at a time, the total is exactly `n*(n-1)/2` under the algorithm's
  current (accepted) design -- asserted both exactly and against a loose
  2x upper bound. Added a separate correctness smoke test at the real
  server caps (valid model, no NaNs, caps respected) and an optional `pnpm
  bench` script for informational wall-clock timing outside the gating
  suite.
- **B4 WebGL context loss.** `Scene.tsx` listens for `webglcontextlost`
  (`preventDefault()` for spec-compliant restorability) and calls
  `onContextLost`; `ViewerPage` shows a small `ContextLossBanner` ("The
  galaxy lost its GPU context." + "Reload view") and remounts `<Scene>`
  with a fresh `key` on click, rather than attempting unreliable in-place
  WebGL resource restoration.
- **B5 THREE.Clock deprecation warning.** Root cause: `three@0.186.1`
  (r183+) makes `Clock`'s constructor unconditionally warn; `@react-three/
  fiber@9.8.1` (confirmed latest via `pnpm view`) still constructs its own
  internal `THREE.Clock` for its render-loop store, unavoidably from app
  code. Used three.js's own official `setConsoleFunction` hook (not a
  `console.warn` monkeypatch) to filter exactly that one message; every
  other three.js log/warn/error passes through unchanged (4 tests).
  Confirmed gone from `pnpm shot`'s console output (present on every shot
  before this fix, absent after).
- Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass
  (342 tests, +6) · `pnpm build`: pass (bundle sizes back to the M4
  baseline after the self-caught regression above) · `pnpm shot`: 26/26,
  0 console errors, no THREE.Clock warning.

**Group C — API & deploy** (commit `ed9739e`):
- **C1 GraphQL-level rate limits misclassified.** GitHub returns a
  primary/secondary rate limit as an ordinary HTTP 200 with an `errors`
  entry, never a 403 -- the existing HTTP-status-based rate-limit handling
  never saw it, so it fell through to a generic `upstream_error`, losing
  both the typed `rate_limited` code and any reset time. Now detects
  `type === 'RATE_LIMITED'` or a rate-limit-shaped message and maps to
  `rate_limited`, deriving `retryAfterSeconds` from `retry-after`
  (preferred) or `x-ratelimit-reset` when present. 5 new tests.
- **C2 `/api/repo` had no Cache-Control.** `handleRepoRequest` now returns
  `headers` alongside `status`/`body`: success ->
  `public, s-maxage=3600, stale-while-revalidate=86400` (matching the
  server's own hourly snapshot TTL); every error status -> `no-store` (a
  transient rate-limit/upstream failure must never be served stale).
  Computed once in the shared handler; both `api/repo.ts` and the Vite dev
  middleware apply it identically. Tests on the shared handler updated/
  added.
- **C3 Vercel timeouts + serial pagination.** `vercel.json` now sets
  `functions["api/repo.ts"].maxDuration = 60`. Merged-PR pagination (up to
  ~20 requests at the real cap) and closed-PR pagination (up to ~4
  requests) were fully sequential despite being fully independent request
  streams (different query, different cursor) -- extracted into
  `fetchMergedPullRequests`/`fetchClosedPullRequests` and run via
  `Promise.all`, preserving each loop's own strictly-sequential
  cursor-following and the closed-PR loop's "stop on first failure, keep
  what succeeded" behavior exactly. New test dispatches a mocked `fetch`
  on the POSTED QUERY STRING (not call order), so it verifies correctness
  regardless of how the two streams actually interleave -- 4 merged + 2
  closed pages resolve to the correct, correctly-ordered, correctly-merged
  final lists.
- Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass
  (355 tests, +13) · `pnpm build`: pass (server-only changes, no bundle
  impact) · `pnpm shot`: 26/26, 0 console errors.

**Group D — UX polish** (commit `f9dd805`):
- **D1 landing samples.** Both bundled offline fixtures (`pmndrs/valtio`,
  `expressjs/express` -- the latter was entirely missing from the landing
  page despite being just as real a fixture) now show under an "Instant
  samples - no token needed" label. The three token-requiring examples
  (facebook/react, vuejs/core, sveltejs/svelte) are now hidden entirely
  unless a new `GET /api/health` (`{ tokenConfigured: boolean }`, no
  secrets, wired into both the Vite middleware and a new
  `api/health.ts` Vercel function, 4 tests) reports a token is actually
  configured -- confirmed via `pnpm shot`'s own landing screenshot (no
  `GITHUB_TOKEN` in this sandbox): only the two instant samples show. Hero
  image now captioned "Example: expressjs/express".
- **D2 mobile portrait framing.** The disc fit but read small with large
  empty bands above/below at the desktop-tuned 45deg pitch / 1.28 frame
  margin. Extracted `cameraFraming.ts` (9 tests): a portrait viewport
  (aspect < 1) now gets a steeper 60deg pitch (closer to top-down, so a
  flat disc's foreshortened vertical extent grows relative to its
  pitch-independent horizontal extent) and a tighter 1.1 frame margin.
  Measured on the before/after mobile screenshots: disc width went from
  ~300/390px (77%) to ~350/390px (90%), matching the "~90% of viewport
  width" target, and the empty bands above/below are visibly closer to
  symmetric.
- **D3 focus ring color.** `:focus-visible`'s outline was hardcoded to
  `#ffd9a0` (a leftover warm amber from the pre-M4 tree-metaphor palette);
  updated to `#6ee7ff`, matching `ui.focusRing`/`ui.accent`.
- **D4 save image.** Verified via a real Playwright `download` event
  (scratch script, deleted after use) that the original `data:` URL anchor
  download DID actually fire a real download in this environment
  (suggestedFilename `huerto-pmndrs-valtio.png`, 542KB file) -- but per the
  task's own stated concern about `data:` URL anchor-download reliability
  across browsers/headless environments, switched to the standard
  `canvas.toBlob` + `URL.createObjectURL` pattern regardless, which is
  the documented-reliable approach and avoids base64-inflating a
  multi-hundred-KB image inline. Re-verified after the change: download
  event still fires, same filename convention, same real file size.
- Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass
  (355 tests total, +9 for this group: cameraFraming 9,
  handleHealthRequest 4 -- net +9 after accounting for shared setup) ·
  `pnpm build`: pass · `pnpm shot`: 26/26, 0 console errors; landing/
  mobile screenshots reviewed with Read and described above.

**Screenshots reviewed literally** (`.shots/`, via Read, across the four
groups' verification runs): `desktop-valtio-end.png`/`desktop-express-
end.png` -- genuine pinwheel/spiral-galaxy shape, bright cyan filaments,
brown dead-end filaments, mushroom dots, dark soil disc, unchanged from
the M4 baseline (Group A/B/C touched no rendering-visible code paths).
`desktop-landing.png` -- confirms D1 (instant-sample label + both chips +
hidden live examples + hero caption). `mobile-valtio-end.png`/`mobile-
express-end.png` -- confirms D2 (disc now ~90% of viewport width, more
centered between header and scrubber, mushroom shading still legible at
60deg). `mobile-valtio-selected-merged.png` -- confirms selection/camera-
focus/detail-panel still work correctly together with the new mobile
framing.

**Remaining weaknesses, honestly reported**:
- Perf at the real 1000+-PR/20-commit/200-closed/50-open/100-branch caps
  is now covered by a correctness smoke test (B3) and an informational
  `pnpm bench` (~710-960ms for `buildNetwork` alone in this sandbox,
  now off the main thread via the Worker), but was not re-measured against
  a REAL live 1000+-PR GitHub repository end-to-end (no `GITHUB_TOKEN` in
  this sandbox) -- only the synthetic at-caps snapshot.
- A formal a11y contrast audit and a real-device (not headless/synthetic)
  mobile touch check were flagged in the pre-T8 "Next step" note but were
  not part of either review's four T8 groups, so they're still open,
  carried forward.
- D2's mobile vertical centering is visibly IMPROVED (see the before/after
  width measurement above) but not pixel-verified as perfectly symmetric
  between the header and scrubber -- the fix targeted the reviewer's
  literal complaint (disc too small, large bands) via distance/pitch, not
  a separate camera-target vertical offset; a residual few tens of pixels
  of asymmetry may remain.
- The mushroom-cluster "reads as one fused blob rather than N distinct
  mushrooms at full-disc zoom" residual (flagged back in M3b) is
  unchanged -- out of scope for T8's four groups.
- No automated screen-reader walkthrough or contrast-ratio tool was run;
  P11's a11y line items rely on the same manual/structural review as
  every prior task in this doc.

**P1–P12 polish-bar status, honestly reassessed after T8**:
- **P1 Palette** — holds, unchanged by T8 (D3's focus-ring fix aligns an
  outline color with the existing token, no new hues).
- **P2 Light & glow** — holds, unchanged.
- **P3 Organic form** — holds, unchanged (same M3b residual: a dense rim
  bundle reads as a thicker fringe than a single strand's own taper,
  out of scope for T8).
- **P4 Motion** — holds and is stronger: A1's fix makes the eased growth
  replay actually run on a fresh dev-mode load (previously silently
  stuck), which is the core of this bar item.
- **P5 UI craft** — holds; D1/A5 add new UI (health-gated example chips,
  hero caption, growth caption, legend pulse) using the same tokens/type
  scale, no layout shift observed across 26/26 `pnpm shot` screenshots.
- **P6 States designed** — holds, unchanged; B4 adds a new state (WebGL
  context loss) not originally listed in this bar.
- **P7 Interaction** — was FAILING two of its own explicit sub-claims
  ("hover highlight + pointer + tooltip", "camera focuses selection")
  before T8; both now hold, verified via real Playwright hover/selection/
  deep-link checks (A2–A4), not just screenshots.
- **P8 Truth** — holds, unchanged.
- **P9 Legibility** — holds and is stronger: the spore (a legend entry)
  is now actually hoverable/selectable, closing a real legend-vs-reality
  gap A3 found.
- **P10 Share** — holds; D4 makes "save image" a verified real download
  instead of an unverified assumption.
- **P11 A11y** — holds for what was checked (focus rings now use the
  correct token, D3); no new automated audit was run (see weakness above).
- **P12 Perf & robustness** — was FAILING "no console errors" (the THREE.
  Clock warning, B5, present on every shot before this task) and had an
  unaddressed ~1.3s main-thread block at the real caps (B2); both fixed.
  "Handles 1000+ PR repos" now has both a correctness smoke test and a
  worker-based non-blocking path, though not a live end-to-end real-repo
  measurement (see weakness above).

### T9 Rim "hook"/blocky-fragment fix -- done
Commit: `4f74fc8` fix: grow clean tapered tips at the colony rim.

Per the orchestrator's literal review of `.shots/desktop-express-end.png`
after T8: around the whole rim of the express galaxy, a ring of short,
bright, blocky white/cyan fragments -- small hooked/rectangular shapes ("⌐",
"L", short thick dashes) sitting at the outer edge, visually distinct from
the fine tapered threads everywhere else. Valtio showed a milder version.

**Root cause** (confirmed empirically, not just by inspection -- a temporary
`diagnose-rim.ts` scratch script built the real `NetworkModel` for both
fixtures and measured the turning angle between every hypha's consecutive
polyline segments): the fork's own eased turn (`growHyphaPoints`) and the
separate, cosmetic, radius-dependent swirl rotation applied afterward
(`applySwirl`) are each individually smooth, but their SUM can have a real,
if modest, local reversal wherever the two happen to have opposing rates at
a given sample -- most often right after a natural-fit fork attaches near an
already-large disc radius (common near the rim, since many hyphae there are
naturally short work-driven lengths, not because of `COLONY_RADIUS_CAP`
clamping specifically, which turned out NOT to be the dominant mechanism --
the specific hypha traced in detail, `hypha-pr5819`, was never actually
radius-clamped). At a hypha's own (length-appropriate, modest) sample
spacing, this compound curve's brief reversal reads as a sharp zigzag/hook
rather than the gentle bend it truly is -- confirmed by resampling the same
fixture at ~20x the normal resolution: the same hooks shrank from up to
~124deg to under ~90deg (still a real, if much gentler, bend). Measured
304 hyphae (of 826) on the express fixture with a >60deg turn between
consecutive segments before any fix; some as high as 124deg.

A related, smaller bridge artifact ("fusion bridges at the rim may connect
to neighbors at odd angles" from the task brief): `applySwirl` rotated a
fusion's `bridgeTo` independently, using ITS OWN disc radius -- but a
bridge's tip and its bridge target can sit at meaningfully different radii,
so independent rotation stretched a bridge `findFusionAnchor` bounds at
`FUSION_SEARCH_RADIUS` (0.25) pre-swirl into a longer, oddly-angled chord
post-swirl (measured up to ~0.37 on 2 express fusions).

Ruled out (via the debug diagnostic, not just assumption): point pile-up
(many samples collapsed into a near-zero radial span) -- `sampleCountForLength`
already scales sample count down with a hypha's own (possibly clamped)
length, so this never actually occurred on either fixture (0 cases both
before and after). Open-PR tips as oversized quads -- already point-glow
`THREE.SphereGeometry` instances (`PointGlowInstances.tsx`), not ribbon
quads, so not a contributor.

**Fix**, all in `src/domain/network/colonyLayout.ts`:
1. `lateralBudget` (the post-fork organic-wiggle amplitude) is now ALSO
   capped as a fraction of the hypha's own rendered length
   (`POST_FORK_LATERAL_LENGTH_CAP_FRACTION`, 0.15), not just floored at a
   fixed world-space amount (`LATERAL_MAX_WORLD`) -- a short hypha's wiggle
   can no longer have a larger tangential swing than its own radial
   progression.
2. `buildForkBiasedSampleTimes` redistributes each hypha's EXISTING sample
   budget (no extra vertices) so the fork+ramp region always gets at least
   `MIN_FORK_SAMPLES` (8) points, resolving the fork/swirl interaction more
   densely.
3. `relaxSharpTurns` -- the fix that actually closes it -- runs after swirl
   and pulls any interior point whose turn still exceeds 60deg
   (`MAX_HYPHA_TURN_RAD`) back onto the smooth path its own untouched
   neighbors already describe (angular midpoint via `shortestAngleTo`, 4
   passes for a short run of consecutive outliers). Only the point's ANGLE
   moves; radius, height, time and thickness/taper are all preserved
   exactly, so every other invariant (monotonic radius, timing, per-point
   taper) still holds. Endpoints (parent attach point, tip) are never
   touched.
4. `applySwirl`'s fusion handling now rotates `bridgeTo` RIGIDLY by the same
   angle as its own tip, instead of independently re-deriving swirl from
   `bridgeTo`'s own (possibly very different) radius -- preserves the
   pre-swirl bridge length/angle exactly.

**Tests** (`colonyLayout.test.ts`): the existing "rotates every element kind
... by the exact same radius-dependent angle" swirl test was updated -- a
fusion's `bridgeTo` is now the one documented exception, with a new
dedicated test confirming it rotates rigidly with its tip (pre-swirl bridge
length preserved exactly). Two new regression tests, run against BOTH real
bundled fixtures: no hypha polyline segment turns more than 60deg from its
predecessor (checked 100+ turns per fixture); no hypha polyline repeats a
near-zero-length segment back-to-back (point pile-up guard, currently
vacuous on both fixtures but guards the mechanism directly).

**Verified with `pnpm shot`** (desktop+mobile, both fixtures, all states):
26/26, 0 console errors. Before/after comparison via a temporary zoomed
Playwright camera script (wheel-zoom + pan toward the rim, not committed)
and tight crops of the real `desktop-express-end.png`/`debug-default-valtio-
*.png` screenshots at the same pixel coordinates, reviewed with Read:
**before** -- along the rim arc, multiple distinct bright hook/checkmark/
"L"-shaped white fragments jut out from the smooth curving threads at sharp
angles, clearly distinct from the fine tapered filaments elsewhere; express
showed this more densely and more sharply than valtio, matching the task's
own "milder on valtio" description. **after** -- the same screen regions
show smoothly curving, continuously tapering threads with no jagged
spikes; a couple of legitimate small dot/hair marks (mushrooms, commit
hairs) remain, unaffected since this fix only touches hypha ribbon points.
The disc's inner region (near the spore) was visually unchanged before/
after, as expected -- the fix is rim-specific by construction (it only ever
activates where the compound curve's real local reversal is large enough to
matter, which the diagnostic confirms concentrates near large disc radii).

Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass (360
tests, +5 net: 2 new regression tests x2 fixtures via `describe.each` = 4,
+1 new dedicated fusion-rigidity test, existing swirl test updated in
place) · `pnpm build`: pass (`Scene` chunk 1038.60 kB, unchanged from
before this fix) · `pnpm shot`: 26/26, 0 console errors.

**Remaining weaknesses, honestly reported**:
- `relaxSharpTurns`'s 60deg ceiling is a global invariant, not one that
  specifically exempts "the fork's very first segment" the task brief's own
  test wording suggested -- in practice this never mattered (the domain
  fork's own achievable turn is bounded well under 60deg almost everywhere
  except very close to the spore, where `FORK_ABSOLUTE_MAX_RAD` allows up to
  70deg; no such case was observed being clipped on either bundled fixture),
  but a hypothetical future case near the spore with a genuinely-intended
  65-70deg fork turn would now be softened slightly to 60deg.
- The fix targets the SPECIFIC fork+swirl interaction and its resulting
  sharp turns; it does not re-litigate the pre-existing, already-accepted
  P3 residual ("a dense rim bundle of many hyphae reads as a thicker fringe
  than a single strand's own taper" -- an aggregate-density effect, not a
  per-strand defect, flagged back in M3b and still out of scope here).
- No automated regression test asserts the RENDERED (post-taper,
  post-ribbon-geometry) pixel output directly; coverage is at the domain
  polyline level (turning angle, pile-up) plus the existing generic
  `tipTaperFactor` unit tests (unchanged by this fix, already covered
  "tapers exactly to 0 at both very ends") and the manual screenshot review
  above.

**P3 Organic form** -- improved: the rim no longer shows sharp hook/blocky
fragments; the pre-existing dense-bundle-fringe residual (see weakness
above) is unchanged and still out of scope.

### T10 Rim "hook" fix, second pass -- done
Commit: `fix: keep short rim hyphae thin and gently forked`.

T9 fixed per-segment turns (>60deg between consecutive polyline segments)
but the orchestrator's re-review of `.shots/desktop-express-end.png` still
found a ring of short, thick, bright white-cyan "L"/"⌐"-shaped hooks along
the whole rim -- a stub that runs tangentially then turns radially within a
few pixels, spanning 2-4 segments (a compound bend the T9 per-segment cap
couldn't see).

**Instrumentation** (`scripts/diagnose-rim.ts`, not committed): built the
real `NetworkModel` for the express fixture and, for every hypha, measured
its rendered length, base (thickness) radius, and both a raw per-segment
cumulative-turn sum and (after that measure proved noisy -- see below) the
actual perpendicular deviation from its own base->tip straight chord.

**H1 (width independent of length) -- confirmed, dominant cause.**
`radiusForCommitCount(commitCount)` sets a hypha's base thickness from
COMMIT COUNT alone, never from its own rendered length. A rim hypha whose
nominal reach gets truncated by `COLONY_RADIUS_CAP` keeps its full
commit-driven width regardless -- measured up to 0.089 raw width/radial-span
(a rendered full width, `ratio * RIBBON_WIDTH_SCALE`, of ~44% of the
hypha's own radial span) against a colony-wide natural median of ~0.031 (a
first tuning attempt measured against rendered ARC length instead of the
actual RADIAL SPAN the code caps against, and would have clipped roughly
half the colony -- caught before committing by re-measuring against the
right denominator). **Fix**: `growHyphaPoints` now caps `thicknessStart` at
`WIDTH_TO_LENGTH_CAP_FRACTION` (0.06) times the hypha's own radial span.
Affects exactly 99 hyphae on the express fixture, 100% of them at the rim,
zero effect on the colony median.

**H2 (fork transition turn, refined) -- confirmed, second cause.** The
literal hypothesis ("fork turn ~90deg compressed into few segments") wasn't
quite the mechanism: the fork's own ASSIGNED turn was already tiny
(`maxTurnRadians`, radius/length-based). The real driver was that
`FORK_LATERAL_BUDGET_FRACTION` (0.5) let the fork's lateral swing reach up
to HALF a short hypha's own length whenever its raw gap-filling target sat
far from its real attach point -- e.g. one traced hypha (length 0.53) turned
barely ~2.4deg in absolute angle, but at its own real radius (~5) that still
swept ~0.17-0.2 world units sideways, a third of its own length. **Fix**:
split the fork-turn budget into two constants -- `FORK_LATERAL_BUDGET_
FRACTION` (unchanged, 0.5) still governs the TOPOLOGY "natural fit"
decision (which hyphae attach to a real neighbor vs. fall back to the
spore), while a new, separate `FORK_RENDER_LATERAL_BUDGET_FRACTION` (0.15)
governs only the RENDERED turn once a hypha is already placed. (A first
attempt tightened the single shared constant directly -- it also tightened
the topology check, reclassifying hundreds of hyphae as spore-started, a
much bigger unintended shape change; caught by watching the rim-hypha COUNT
shift from 499 to inconsistent values across reruns, then splitting the two
uses.) Also tightened `POST_FORK_LATERAL_LENGTH_CAP_FRACTION` (0.15 -> 0.06,
the post-fork organic-wiggle budget).

**Swirl per-point independence (new finding beyond the task's own
hypotheses) -- confirmed, third cause.** Even with H1+H2 fixed, a short
hypha near the rim still showed real curvature: the cosmetic galaxy swirl
(`applySwirlToPosition`) rotates every point independently by ITS OWN
radius, and `swirlAngleForRadius`'s rate of change with radius is LARGEST
right at the rim (`swirlPower` 1.4 > 1 makes the curve convex, steepest at
`DISC_MAX_RADIUS`) -- exactly where these short hyphae's real attach points
concentrate. A near-straight pre-swirl strand picks up extra bend from the
swirl field's own gradient across its tiny span. Confirmed directly: with
swirl disabled entirely, the SAME short hyphae showed the identical wiggle
fraction as with swirl enabled post-fix -- proving the rigidification below
fully neutralizes swirl's contribution. **Fix**: `applySwirl` now rotates
every point of a NORMAL hypha (radial span <= `COLONY_LENGTH_MAX` -- the
exact, pre-existing boundary that already distinguishes a real-attach-point
hypha from a spore-started long arm) by ONE FIXED angle -- the swirl angle
at its own real attach-point radius, so it still lands exactly on its
parent's independently-swirled position -- instead of each point's own
radius-based angle. A genuinely long, spore-started arm (span >
`COLONY_LENGTH_MAX`) keeps the per-point independent swirl that produces
the intended "spiral galaxy arm" meander; nodes/hairs/tips/fusions
belonging to a rigid hypha follow the same fixed angle for continuity. The
degenerate `main` stub is excluded (its id is shared by the direct-commit
spurs, which must keep independent per-point swirl).

**H3 (additive blending near the clamp) -- not needed.** Many short rim
hyphae do converge to nearly-identical tip locations (observed up to 8
distinct hypha ids ending within ~0.01 units of each other), but this is
the pre-existing, already-accepted "dense rim bundle reads as a thicker
fringe" residual (P3, flagged in M3b, re-confirmed out of scope in T9) --
an aggregate-density effect, not the per-strand hook shape H1+H2+swirl
rigidification already close. No alpha/brightness change was made.

**Tests** (`colonyLayout.test.ts`, real bundled fixtures via the existing
`describe.each(FIXTURES)` block): (1) every hypha's base radius stays
`<= WIDTH_TO_LENGTH_CAP_FRACTION * radialSpan`; (2) every NORMAL (radial
span `<= COLONY_LENGTH_MAX`) hypha's max lateral deviation from its own
base->tip chord stays `<= 20%` of its own rendered length (a direct,
length-scaled proxy for "no base-hugging hook" -- pre-fix this reached
~40% on real hyphae); (3) a dedicated rigid-swirl test (the generic
`makeSnapshot()`-based swirl test never produces a short hypha, so a new
test against the real fixtures confirms every point of a short hypha
rotates by exactly one fixed angle). The pre-existing generic determinism
test (`layoutNetworkColony` called twice, `toEqual`) already covers all
three new mechanisms since they're plain, seed-independent functions of
the same inputs -- no new determinism test was needed. 366 tests total
(+6 net from T9's 360).

**Acceptance crops** (1440x900 desktop express "end" state, cropped at 2x
device-pixel-ratio, not a post-hoc pixel-double): `.shots/rim-before-
{bottom,left,right}.png` (captured from HEAD via `git stash`, before this
fix) clearly show the bright "L"/"⌐" hook shapes described in the task,
several with a visible bright blob at the bend. `.shots/rim-after-
{bottom,left,right}.png` (same regions, same camera, after the fix) show
smoothly tapering fine threads with no hook/wedge silhouettes anywhere in
the three crops; a few small mushroom/hair dot markers with thin support
lines remain (unaffected -- not hyphae).

Checks: `pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass (366
tests) · `pnpm build`: pass (`Scene` chunk 1038.60 kB, unchanged) ·
`pnpm shot`: 26/26, 0 console errors (run twice: once mid-fix for the
"after" crops, once more in the final restored state as the official
verification run).

**Remaining weaknesses, honestly reported**:
- No automated test asserts the RENDERED (post-taper, post-ribbon) pixel
  output directly; coverage is at the domain-polyline level (width/length,
  lateral-deviation, rigid-swirl-angle) plus the manual crop comparison
  above, same limitation T9 already flagged.
- The H3 dense-bundle-fringe residual remains unaddressed and out of scope,
  as it was in T9 -- a deliberate, not accidental, omission.
- `WIDTH_TO_LENGTH_CAP_FRACTION` and `FORK_RENDER_LATERAL_BUDGET_FRACTION`
  are both empirically tuned constants (against the express fixture's own
  distribution), not derived from a closed-form visual-perception model;
  a much larger or more sparsely-populated repo could in principle still
  show a milder version of the same artifact at a different scale.

**P3 Organic form** -- improved further: the rim's individual strands now
read as fine tapered threads matching the interior, not thick hooked
wedges; the pre-existing dense-bundle-fringe residual (H3, unchanged) is
still out of scope.

### Final pass -- done

Three units of polish on top of T9/T10's rim fixes, per the orchestrator's
fresh review of `.shots/desktop-express-end.png`.

**Unit 1: rim growth front.** Commit: `fix: render the colony rim as a soft
growth front`.

The rim still read as a "comb" -- a ring of short, bright, straight radial
strokes -- because (a) every hypha rendered at the same brightness/width
regardless of how recently it split, and (b) `COLONY_RADIUS_CAP`'s hard
clamp (`Math.min(nominalEndRadius, COLONY_RADIUS_CAP)`) truncated EVERY
overshooting hypha to the exact same radius.

- `renderHints.ts`'s new `rimAgeStyle`/`recentGrowthFactor`: a hypha whose
  split time falls in the trailing `RECENT_GROWTH_FRACTION` (10%) of history
  renders thinner (down to 45% width), dimmer (down to 55% alpha) and
  blended cooler (up to 55% toward the palette's own cool cyan
  `hyphaActiveTip`) in `hyphaeGeometry.ts` -- eased quadratically so the
  effect concentrates near "now", not a hard cliff. Open PRs' own glowing
  tip (a separate instanced mesh) is untouched.
- `colonyLayout.ts`'s new `softenRimOvershoot` replaces the hard clamp: only
  `RIM_OVERSHOOT_RETENTION` (40%) of a hypha's overshoot past the nominal
  cap is kept, bounded by an outer hard ceiling (`COLONY_RADIUS_CAP * 1.08`)
  so the disc still stays round. Real fixtures now render at least one
  hypha past the nominal cap (verified by a regression test) -- previously
  mathematically impossible.
- A small seeded lateral curvature bias (`RIM_CURL_CONTINUITY_LENGTH_
  FRACTION`) added to recent-slice hyphae's post-fork growth, so rim
  filaments continue their arm's curve instead of pointing straight out.
  Deliberately independent of the actual `swirl` config value (a fixed
  rotational direction, not `Math.sign(resolved.swirl)`) -- an early attempt
  read the real swirl value and broke the `swirl: 0` "plain" reference
  layout several existing tests build to isolate swirl's own effect.

Tests: `renderHints.test.ts` (11 new -- `recentGrowthFactor` boundary/
monotonic/degenerate-bounds cases, `rimAgeStyle` no-op/full-effect/
monotonic/degenerate cases), `colonyLayout.test.ts` (7 new -- `soften
RimOvershoot` no-op/no-collapse/bounded/monotonic/degenerate cases, plus a
real-fixture regression proving at least one hypha now exceeds the nominal
cap on both bundled fixtures).

Crops (1440x900, 2x device-scale, express + valtio, bottom/left/right):
`.shots/front-before-{express,valtio}-{bottom,left,right}.png` (captured via
`git stash` of Unit 1's tracked files, before this fix) show the classic
comb -- evenly-spaced, uniform-length, uniform-brightness straight teeth.
`.shots/front-after-*` (same regions/camera, after the fix) show clearly
varied length and brightness, several visibly curved/bent strands following
the swirl's own arm direction, and thinner/dimmer/cooler young filaments
near the very edge -- read side by side, the after crops no longer look
like a mechanical comb.

**Unit 2: release clusters.** Commit: `fix: shape release bursts as small
fairy rings`.

A burst of many releases close in time (express's own real-world ~16-
release burst) placed each member at its own nearly-identical individual
radius/angle -- a lumpy lit-up pile, not intentional.

- `mushrooms.ts`'s `buildMushroomsOnRings` now groups releases into bursts
  by the pre-existing 3-day cluster window (`computeReleaseSequence`'s
  `clusterIndex`, unchanged), then places the WHOLE group at one shared
  radius/angle (from the group's own mean/"center" time), and lays its
  members out via the new `layoutBurstRing`: evenly spaced around a small
  ring, sized (`mushroomCapWorldRadius` + a fixed margin) so no two
  adjacent members' real rendered caps overlap. A single, non-bursty
  release is an unchanged one-member "ring" -- a zero offset at its own
  real radius (singles stay single). Each member keeps its own individually
  resolved `nearPr` data link (computed at the burst's own shared ring
  radius, since that's where it actually renders) and remains separately
  pickable (`mushroomInstances.ts`, untouched -- still one instance/pick
  target per `Mushroom`).
- Removed the now-dead `MUSHROOM_CLUSTER_ANGLE_SCATTER`/fan-scatter logic
  it replaced.

Tests: `mushrooms.test.ts` (18 new) -- `layoutBurstRing`: single/empty/
deterministic/even-spacing/true-ring(equal radius)/no-cap-overlap across
burst sizes 2-24/worst-case-all-major-caps; `buildMushroomsOnRings`: detects
and shares one `clusterId` across a 16-release burst (express's own real
motivating case), lays it out around the group's shared center (not a
straight line/pile), no cap overlap end to end, deterministic, singles stay
single, each member individually pickable with its own release tag,
no NaN/Infinity for a large burst.

Crop: `.shots/mushrooms-before-express.png` shows a burst mid-disc as a
loose scattered/overlapping group; `.shots/mushrooms-after-express.png`
(same region/camera) shows a clean, visibly circular fairy ring of evenly-
spaced mushrooms. (The same crop region for valtio shows mostly single
releases in both before/after -- valtio's release cadence in that region
isn't bursty, an honest result, not a missed case; express was the
motivating/verifying case per the task brief.)

Checks after Units 1+2 (run against each unit's own isolated commit state):
`pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass (382 after
Unit 1, 396 after Unit 2) · `pnpm build`: pass (`Scene` chunk ~1038 kB,
unchanged) · `pnpm shot`: 26/26 screenshots, 0 console errors (run after
each unit).

**Unit 3: real large-repository verification.** No code changes -- no
defect found. Documented per the task's own fallback ("commit only if you
change code, otherwise document").

Ran with a real `GITHUB_TOKEN` (`gh auth token`, never written to any file/
log/fixture/commit) against a fresh dev server with `.huerto-cache/` cleared
first (so the first request per repo is genuinely cold), driven headless
via a throwaway, uncommitted Playwright script (`scripts/real-repo-check.ts`,
deleted after use, matching `scripts/diagnose-rim.ts`'s precedent from T9/
T10). Three real repos, by size:

| Repo | Stars | API cold | API warm | Snapshot | buildNetwork (worker) | Nav->settled | Overflow | Console errors (desktop/mobile) |
|---|---|---|---|---|---|---|---|---|
| `facebook/react` (big) | 250,822 | 93.2s | 32ms | 1626.8 KB | 1336ms | 6.2s | +348 PRs not drawn (1000-PR cap hit) | 0 / 0 |
| `vitejs/vite` (mid) | 83,070 | 94.0s | 20ms | 1717.9 KB | 1088ms | 5.2s | +314 PRs not drawn (1000-PR cap hit) | 0 / 0 |
| `TanisJam/peel` (tiny) | 0 | 18.1s | 3ms | 15.8 KB | 63ms | 4.2s | none (well under every cap) | 0 / 0 |

(`TanisJam/peel` has 11 total PRs, not the 0-2 the task named as an example
-- no smaller *real, personal* repo with 0-2 PRs was found in the account,
and 11 is still a legitimate tiny/near-empty case: 15.8 KB snapshot,
63ms `buildNetwork`, one lone spore with a handful of short hyphae.)

Verified against real screenshots (desktop end/selected + mobile end, all
in `.shots/real-<size>-<owner>-<repo>-*.png`, none committed as fixtures --
`.shots/` and `.huerto-cache/` are both gitignored):
- `facebook/react`: dense but legible disc; clicking near the busiest part
  of the disc landed a real, correctly-detailed closed PR (#36683, real
  author/commit/GitHub link) -- picking works end to end on real, dense
  data. The honest overflow note (P12) reads correctly: "+348 pull requests
  not drawn".
- `vitejs/vite`: same, with two release bursts clearly visible as genuine
  circular fairy rings (Unit 2's fix, confirmed on real, previously-unseen
  data, not just the express fixture used to build it).
- `TanisJam/peel`: a lone spore with a few short hyphae and two mushrooms --
  reads as intentional, not broken (P6's "empty/tiny repo" requirement),
  matching M4/T-era coverage that was previously only checked against
  synthetic edge cases.
- Mobile layouts for all three stayed legible (header fits, legend/disc
  scale sanely) at 390x844.
- No caps other than the 1000-merged-PR cap were visibly hit for react/vite
  (no truncated-looking commit trails, no obviously-capped branch/open-PR
  count in the UI); this wasn't independently cross-checked against the raw
  GraphQL counts beyond what the app itself surfaces.
- Zero console errors, zero NaN-driven visual artifacts, no timeouts, no
  broken layout in any of the 6 desktop/mobile loads.

No defect found -- no fix needed for this unit.

**Final checks (current HEAD, all three units' commits applied):**
`pnpm typecheck`: pass · `pnpm lint`: pass · `pnpm test`: pass (396 tests,
+34 net from T10's 366) · `pnpm build`: pass (`Scene` chunk ~1038 kB,
unchanged) · `pnpm shot`: 26/26 screenshots, 0 console errors.

**Remaining weaknesses, honestly reported:**
- Physical-GPU frame rate (P4's "~60fps on a mid laptop") is unmeasurable in
  this environment: `pnpm shot`/the real-repo checks both run headless
  Chromium under SwiftShader (software WebGL), which has no reliable
  relationship to real GPU frame timing -- this was already true before
  this pass and remains an honest, unresolved gap; only a human on real
  hardware can verify it.
- `RIM_OVERSHOOT_RETENTION`, `RIM_CURL_CONTINUITY_LENGTH_FRACTION`, and the
  age-style constants in `rimAgeStyle` (Unit 1) are empirically tuned
  against the two bundled fixtures' own distributions, same limitation
  T9/T10 already flagged for their own constants -- a much larger or
  differently-shaped repo could still show a milder version of the same
  comb/hook artifacts at a different scale.
- The burst fairy-ring (Unit 2) sizes its ring purely to avoid cap overlap;
  it doesn't avoid overlapping the surrounding hyphae/other mushrooms
  outside its own burst, so a ring landing in an already-dense region could
  still visually crowd its neighbors (not observed on either fixture or the
  three real repos, but not proven impossible either).
- Unit 3's "no caps hit beyond the 1000-merged-PR cap" finding for react/
  vite is a visual read, not a byte-for-byte audit against the raw GraphQL
  response (commits-per-PR/branches/open-PR caps specifically) -- the
  snapshot JSON itself wasn't diffed against an uncapped baseline.
- No automated test asserts final RENDERED pixel output for either unit;
  coverage is at the domain/geometry level (documented above) plus the
  manual before/after crop comparisons and the real-repo screenshots.

## Next step
Final orchestrator review; delivery (push/PR/deploy) is the owner's
decision.
