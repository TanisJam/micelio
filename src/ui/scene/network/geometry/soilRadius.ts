import type { NetworkModel } from '../../../../domain/network'

/** The soil disc's own rendered radius -- slightly larger than the model's tightest bounding radius so hyphae never visually spill past the soil's edge. Shared by `SoilDisc` (the mesh itself) and `CameraRig` (framing). */
export const SOIL_DISC_MARGIN = 1.12

export function soilRadiusFor(model: NetworkModel): number {
  return Math.max(model.bounds.radius, 0.5) * SOIL_DISC_MARGIN
}
