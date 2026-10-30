import { useLayoutEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Scroll progress of the page (0 at the top, 1 after scrolling ~1.2 viewports). */
const scrollProgress = () => Math.min(1, window.scrollY / (window.innerHeight * 1.2));

function Sprinkles({ radius, y, count }: { radius: number; y: number; count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const colors = ['#FDE047', '#67E8F9', '#ffffff', '#86EFAC', '#C4B5FD'];
  useLayoutEffect(() => {
    {
      const m = ref.current;
      if (!m) return;
      const o = new THREE.Object3D();
      const c = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * radius * 0.9;
        o.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
        o.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI);
        o.updateMatrix();
        m.setMatrixAt(i, o.matrix);
        m.setColorAt(i, c.set(colors[i % colors.length]));
      }
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, y, count]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <capsuleGeometry args={[0.018, 0.07, 4, 8]} />
      <meshStandardMaterial roughness={0.4} />
    </instancedMesh>
  );
}

function Tier({ r, h, y, color, drip = '#FFF7ED' }: { r: number; h: number; y: number; color: string; drip?: string }) {
  return (
    <group position={[0, y, 0]}>
      <mesh>
        <cylinderGeometry args={[r, r, h, 64]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      {/* frosting rim and drips */}
      <mesh position={[0, h / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[r * 0.98, 0.07, 16, 64]} />
        <meshStandardMaterial color={drip} roughness={0.35} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const len = 0.12 + ((i * 37) % 10) / 40;
        return (
          <mesh key={i} position={[Math.cos(a) * r, h / 2 - len / 2, Math.sin(a) * r]}>
            <capsuleGeometry args={[0.055, len, 4, 8]} />
            <meshStandardMaterial color={drip} roughness={0.35} />
          </mesh>
        );
      })}
    </group>
  );
}

function Cake() {
  const g = useRef<THREE.Group>(null);
  useFrame((state, dt) => {
    const p = scrollProgress();
    if (!g.current) return;
    const targetY = state.clock.elapsedTime * 0.25 + p * Math.PI * 1.6;
    g.current.rotation.y += (targetY - g.current.rotation.y) * Math.min(1, dt * 4);
    g.current.rotation.x += (state.pointer.y * 0.18 - g.current.rotation.x) * Math.min(1, dt * 3);
    g.current.rotation.z += (-state.pointer.x * 0.12 - g.current.rotation.z) * Math.min(1, dt * 3);
    g.current.position.y = -0.4 + Math.sin(state.clock.elapsedTime * 1.2) * 0.05 - p * 0.6;
    const s = 1 - p * 0.15;
    g.current.scale.setScalar(s);
  });
  return (
    <group ref={g}>
      <mesh position={[0, -0.72, 0]}>
        <cylinderGeometry args={[1.85, 1.75, 0.08, 64]} />
        <meshStandardMaterial color="#ffffff" roughness={0.2} metalness={0.05} />
      </mesh>
      <Tier r={1.4} h={0.9} y={-0.23} color="#F9A8D4" />
      <Tier r={1.02} h={0.75} y={0.6} color="#FFE4E6" drip="#F472B6" />
      <Tier r={0.66} h={0.6} y={1.27} color="#EC4899" />
      <Sprinkles radius={0.66} y={1.58} count={60} />
      {[
        [0, 0],
        [0.32, 0.18],
        [-0.3, 0.16],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 1.72, z]}>
          <mesh>
            <sphereGeometry args={[0.14, 24, 24]} />
            <meshStandardMaterial color="#DC2626" roughness={0.25} metalness={0.1} />
          </mesh>
          <mesh position={[0.03, 0.17, 0]} rotation={[0, 0, -0.3]}>
            <cylinderGeometry args={[0.012, 0.012, 0.22, 6]} />
            <meshStandardMaterial color="#15803D" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Floater({ kind, base, speed, phase }: { kind: 'donut' | 'macaron' | 'bala'; base: [number, number, number]; speed: number; phase: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + phase;
    const p = scrollProgress();
    if (!g.current) return;
    // spread out and rise as the page scrolls
    g.current.position.set(base[0] * (1 + p * 0.8), base[1] + Math.sin(t) * 0.18 + p * 1.4 * Math.sign(base[1] || 1), base[2]);
    g.current.rotation.set(t * 0.6, t * 0.8, Math.sin(t) * 0.4);
  });
  return (
    <group ref={g}>
      {kind === 'donut' && (
        <>
          <mesh>
            <torusGeometry args={[0.32, 0.15, 24, 48]} />
            <meshStandardMaterial color="#D9A066" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.03]}>
            <torusGeometry args={[0.32, 0.135, 24, 48, Math.PI * 2]} />
            <meshStandardMaterial color="#F472B6" roughness={0.3} />
          </mesh>
        </>
      )}
      {kind === 'macaron' && (
        <>
          <mesh position={[0, 0.1, 0]} scale={[1, 0.45, 1]}>
            <sphereGeometry args={[0.32, 32, 16]} />
            <meshStandardMaterial color="#C4B5FD" roughness={0.5} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.28, 0.28, 0.09, 32]} />
            <meshStandardMaterial color="#FFF7ED" roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.1, 0]} scale={[1, 0.45, 1]}>
            <sphereGeometry args={[0.32, 32, 16]} />
            <meshStandardMaterial color="#C4B5FD" roughness={0.5} />
          </mesh>
        </>
      )}
      {kind === 'bala' && (
        <mesh>
          <sphereGeometry args={[0.18, 24, 24]} />
          <meshStandardMaterial color="#5B3A29" roughness={0.7} />
        </mesh>
      )}
    </group>
  );
}

export default function Hero3D({ still }: { still: boolean }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 1.0, 7.4], fov: 38 }}
      frameloop={still ? 'demand' : 'always'}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
      aria-label="Bolo de três andares em 3D"
    >
      <hemisphereLight args={['#fff1f7', '#e9d5ff', 0.9]} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <directionalLight position={[-4, 2, -2]} intensity={0.5} color="#C4B5FD" />
      <Cake />
      <Floater kind="donut" base={[-2.2, 1.3, -0.5]} speed={0.9} phase={0} />
      <Floater kind="macaron" base={[2.1, 1.7, -0.3]} speed={1.1} phase={1.5} />
      <Floater kind="macaron" base={[-2.0, -0.7, 0.4]} speed={0.8} phase={3} />
      <Floater kind="donut" base={[2.05, -0.5, 0.2]} speed={1} phase={2.2} />
      <Floater kind="bala" base={[-1.1, 2.1, -1]} speed={1.4} phase={0.7} />
      <Floater kind="bala" base={[1.3, 2.2, -1.2]} speed={1.2} phase={2.6} />
    </Canvas>
  );
}
