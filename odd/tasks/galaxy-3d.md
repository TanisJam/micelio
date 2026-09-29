# Feature: galaxy-3d

## Objective
Turn the colony from a flat disc seen by a 3D camera into a truly volumetric galaxy.

## Problem
Layout is effectively 2D: the only height is `Y_JITTER = 0.015` (zero at hypha ends), the swirl rotates X/Z only, and hyphae render as flat ribbons lying in the XZ plane. Orbiting reveals a sheet.

## Decision (user-approved 2026-09-29)
Height = lineage, shaped by a galactic envelope:
- Each hypha starts at its parent's exact height at the fork point and tilts up/down; deeper fork generation → larger departure from the plane.
- Galactic envelope: thick central bulge (old, dense history), disc thinning toward the rim (recent).
- Hyphae become tubes (readable from any angle), with LOD on mobile if needed.
- Default camera starts tilted (~35°) so the volume is visible on load.

## Constraints
- Domain stays pure and deterministic (seeded PRNG, no Math.random).
- No new GitHub data (22s fetch budget).
- Keep swirl, radial filaments, rim fixes (T10), fork lateral budget intact.
- Writers commit locally on `feat/galaxy-3d`, never push (main auto-deploys).
- Artifacts in English. TDD off; ordinary checks: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, visual check via `pnpm shot`.

## Tasks
- [x] G1 Domain: lineage elevation + galactic envelope in `colonyLayout.ts`; nodes/hairs/mushrooms/growth follow 3D positions; swirl/relax/collision stay correct with Y. Tests for determinism, fork continuity (child starts at parent height), bulge > rim thickness. Route: delegated (writer trigger, preparation trigger).
- [x] G2 Render: tube hyphae (radial segments, mobile LOD), soil/glow/dust with depth, tilted default camera. Visual check via shots. Route: delegated (same writer, sequential).

## Acceptance
- Side/oblique view shows clear vertical structure: bulge in the center, thin disc at rim, branches in separate layers.
- Top view still reads as the spiral galaxy with radial filaments.
- All checks green; mobile frame time not visibly worse.

## Progress
- 2026-09-29: branch `feat/galaxy-3d` created from main 38e18af.
- 2026-09-29: G1 committed `931a855` (feat(network): lineage elevation). Separate `:network-colony-elevation` PRNG stream so X/Z are byte-identical to before; generation = parent's + 1 (spore-started = 0); normalized height eases (sine) from the parent's exact h0 to a seeded h1 inside a Gaussian bulge envelope (0.32R at the spore -> 0.03R at the rim), rise slope-limited (p99 segment slope ~55deg). Fusion anchors now use true 3D distance (bridges <= 0.25 in 3D). Measured on fixtures: max |y| ~0.85-1.0 at r 1-2 (~15-18% of radius), ~0.16 at the rim (~3%). Tests added: envelope monotonic, tilt grows with generation, 3D determinism, fork starts on parent polyline in 3D (pre-swirl), swirl preserves Y, bulge > 3x rim, 3D bridge length, no NaN.
- 2026-09-29: G2 committed `7d7a81e` (feat(scene): tube hyphae + 3D picking). Tubes 6 radial segments (4 when `(max-width: 640px)`), front faces only, glow profile from per-vertex `tubeNormal`/`tubeTangent` (signed sideways component, so few segments still interpolate a bright core). Picking walks the pointer ray through the colony's height slab (`queryNearestAlongRay`). Default pitch 35deg landscape / 45deg portrait. `shot.ts`: `-top` (?pitch=89) and `-side` (?pitch=8) shots + `SHOT_FILTER`. No soil/dust/haze meshes exist (only bloom), so nothing else flattened the look.
- Checks after G2: `pnpm typecheck` clean, `pnpm lint` clean, `pnpm test` 46 files / 513 tests passed, `pnpm build` OK, `pnpm shot` all shots saved with no console errors.
- Findings / follow-ups: (1) pre-existing (verified on the pre-G1 code): after the T10 rigid swirl, a branch-from-branch child whose parent is short is rotated by the swirl angle at ITS OWN start radius while the parent is rotated by the angle at the PARENT's start radius, so post-swirl the child detaches from its topology parent in XZ (express: 79/89 such children, up to ~1.9 units). Growth invariants hold pre-swirl; not changed here because the T10 tests lock the current rigid-angle rule. (2) Vertex budget: express hyphae 46k verts/44k tris (ribbon) -> 139k verts/268k tris (desktop) / 93k/178k (mobile); no real-device frame-time measurement done. (3) Portrait framing still crops the disc's left/right edges (also true before). (4) A selected heavy hypha renders as a solid bright tube (same width as the old ribbon, reads more like a "worm" in 3D).
