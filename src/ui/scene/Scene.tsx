import { OrbitControls } from '@react-three/drei'

/**
 * Placeholder scene. The real diorama (soil island, trunk, limbs, twigs,
 * leaves, flowers, fruit, buds) is built from a `TreeModel` in later tasks.
 */
export function Scene() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} />
      <mesh rotation={[0.4, 0.4, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#5b8c5a" />
      </mesh>
      <OrbitControls enablePan={false} />
    </>
  )
}
