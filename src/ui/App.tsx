import { Canvas } from '@react-three/fiber'
import { Scene } from './scene/Scene'

export function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Canvas camera={{ position: [4, 3, 6], fov: 50 }}>
        <Scene />
      </Canvas>
    </div>
  )
}
