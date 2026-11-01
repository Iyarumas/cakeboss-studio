import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Scroll progress of the page (0 at the top, 1 after scrolling ~1.2 viewports). */
const scrollProgress = () => Math.min(1, window.scrollY / (window.innerHeight * 1.2));

const C = {
  mousse: '#A36C46',
  sponge: '#3B2014',
  ganache: '#2A130A',
  rosette: '#8C5634',
  raspberry: '#C42A45',
  blueberry: '#2D3A66',
  blackberry: '#1B1320',
  gold: '#DCC08A',
};

const R = 1.45; // cake radius
const H = 1.45; // cake height
const CUT = Math.PI / 3.2; // missing slice
const START = Math.PI * 0.15; // where the cake body starts (the slice sits between START - CUT and START)
const ARC = Math.PI * 2 - CUT;

/** Inside of the cake as seen on the cut: mousse and sponge layers, ganache on top. */
function useLayersTexture() {
  return useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 256;
    const g = cv.getContext('2d')!;
    // from the bottom up: [color, share of height]
    const bands: [string, number][] = [
      [C.sponge, 0.2],
      [C.mousse, 0.2],
      [C.sponge, 0.08],
      [C.mousse, 0.2],
      [C.sponge, 0.08],
      [C.mousse, 0.2],
      [C.ganache, 0.04],
    ];
    let y = cv.height;
    for (const [color, share] of bands) {
      const h = share * cv.height;
      g.fillStyle = color;
      g.fillRect(0, y - h, cv.width, h + 1);
      y -= h;
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

/** One flat face of the cut, from the center out to the rim at angle `a`. */
function CutFace({ a, map }: { a: number; map: THREE.Texture }) {
  return (
    <mesh position={[(Math.sin(a) * R) / 2, 0, (Math.cos(a) * R) / 2]} rotation={[0, a - Math.PI / 2, 0]}>
      <planeGeometry args={[R, H]} />
      <meshStandardMaterial map={map} roughness={0.75} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** Points spread along the cake's arc (skipping the cut), `inset` from the rim. */
const arcPoints = (n: number, inset: number, pad = 0.12) =>
  Array.from({ length: n }, (_, i) => {
    const a = START + pad + (i / (n - 1)) * (ARC - pad * 2);
    return [Math.sin(a) * (R - inset), Math.cos(a) * (R - inset), a] as const;
  });

function Berry({ kind, position }: { kind: 'raspberry' | 'blueberry' | 'blackberry'; position: [number, number, number] }) {
  const size = kind === 'blueberry' ? 0.1 : 0.14;
  return (
    <mesh position={position} scale={kind === 'blueberry' ? 1 : [1, 1.15, 1]}>
      <icosahedronGeometry args={[size, kind === 'blueberry' ? 3 : 1]} />
      <meshStandardMaterial color={C[kind]} roughness={kind === 'blueberry' ? 0.35 : 0.6} flatShading={kind !== 'blueberry'} />
    </mesh>
  );
}

function Cake() {
  const g = useRef<THREE.Group>(null);
  const layers = useLayersTexture();
  const drips = useMemo(() => arcPoints(22, 0, 0.06).map(([x, z], i) => ({ x, z, len: 0.18 + ((i * 37) % 10) / 22 })), []);
  const rim = useMemo(() => arcPoints(11, 0.28), []);
  useFrame((state, dt) => {
    const p = scrollProgress();
    if (!g.current) return;
    const targetY = state.clock.elapsedTime * 0.35 + p * Math.PI * 1.6;
    g.current.rotation.y += (targetY - g.current.rotation.y) * Math.min(1, dt * 4);
    g.current.rotation.x += (0.18 + state.pointer.y * 0.15 - g.current.rotation.x) * Math.min(1, dt * 3);
    g.current.rotation.z += (-state.pointer.x * 0.1 - g.current.rotation.z) * Math.min(1, dt * 3);
    g.current.position.y = -0.15 + Math.sin(state.clock.elapsedTime * 1.2) * 0.05 - p * 0.6;
    g.current.scale.setScalar(1 - p * 0.15);
  });
  const top = H / 2;
  return (
    <group ref={g}>
      {/* golden cake stand */}
      <mesh position={[0, -top - 0.05, 0]}>
        <cylinderGeometry args={[1.85, 1.8, 0.08, 64]} />
        <meshStandardMaterial color={C.gold} metalness={0.45} roughness={0.3} />
      </mesh>
      <mesh position={[0, -top - 0.5, 0]}>
        <cylinderGeometry args={[0.22, 0.42, 0.85, 40]} />
        <meshStandardMaterial color={C.gold} metalness={0.45} roughness={0.32} />
      </mesh>
      <mesh position={[0, -top - 0.95, 0]}>
        <cylinderGeometry args={[0.75, 0.85, 0.1, 48]} />
        <meshStandardMaterial color={C.gold} metalness={0.45} roughness={0.3} />
      </mesh>

      {/* body: mousse with a dark sponge base, a slice cut out */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[R, R, H - 0.2, 72, 1, false, START, ARC]} />
        <meshStandardMaterial color={C.mousse} roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -top + 0.1, 0]}>
        <cylinderGeometry args={[R + 0.01, R + 0.01, 0.2, 72, 1, false, START, ARC]} />
        <meshStandardMaterial color={C.sponge} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <CutFace a={START} map={layers} />
      <CutFace a={START + ARC} map={layers} />

      {/* glossy ganache on top, dripping down the side */}
      <mesh position={[0, top + 0.02, 0]}>
        <cylinderGeometry args={[R + 0.02, R + 0.02, 0.06, 72, 1, false, START, ARC]} />
        <meshStandardMaterial color={C.ganache} roughness={0.12} metalness={0.15} />
      </mesh>
      {drips.map((d, i) => (
        <mesh key={i} position={[d.x * 1.005, top - d.len / 2, d.z * 1.005]}>
          <capsuleGeometry args={[0.05, d.len, 4, 10]} />
          <meshStandardMaterial color={C.ganache} roughness={0.12} metalness={0.15} />
        </mesh>
      ))}

      {/* chocolate rosettes with berries, as in the photo */}
      {rim.map(([x, z, a], i) => (
        <group key={i} position={[x, top + 0.1, z]} rotation={[0, a, 0]}>
          <mesh scale={[1, 0.55, 1]}>
            <torusKnotGeometry args={[0.1, 0.05, 48, 8, 2, 3]} />
            <meshStandardMaterial color={C.rosette} roughness={0.7} />
          </mesh>
          <Berry kind={(['raspberry', 'blackberry', 'raspberry', 'blueberry'] as const)[i % 4]} position={[0, 0.16, 0]} />
        </group>
      ))}
      {/* chocolate shards scattered on top */}
      {arcPoints(7, 0.75).map(([x, z, a], i) => (
        <mesh key={i} position={[x, top + 0.09, z]} rotation={[0.5, a + i, 0.3]}>
          <boxGeometry args={[0.22, 0.015, 0.09]} />
          <meshStandardMaterial color={C.sponge} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

type Kind = 'choco' | 'raspberry' | 'blueberry' | 'curl';

function Floater({ kind, base, speed, phase }: { kind: Kind; base: [number, number, number]; speed: number; phase: number }) {
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
      {kind === 'choco' && (
        <group>
          {/* a square of chocolate bar with its grooves */}
          {[-0.12, 0.12].flatMap((x) =>
            [-0.12, 0.12].map((y) => (
              <mesh key={`${x}${y}`} position={[x, y, 0]}>
                <boxGeometry args={[0.22, 0.22, 0.1]} />
                <meshStandardMaterial color="#4A2616" roughness={0.45} />
              </mesh>
            )),
          )}
        </group>
      )}
      {kind === 'raspberry' && <Berry kind="raspberry" position={[0, 0, 0]} />}
      {kind === 'blueberry' && <Berry kind="blueberry" position={[0, 0, 0]} />}
      {kind === 'curl' && (
        <mesh>
          <torusGeometry args={[0.2, 0.05, 12, 40, Math.PI * 1.4]} />
          <meshStandardMaterial color="#6B3E24" roughness={0.5} />
        </mesh>
      )}
    </group>
  );
}

export default function Hero3D({ still }: { still: boolean }) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 1.2, 7.4], fov: 38 }}
      frameloop={still ? 'demand' : 'always'}
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent' }}
      aria-label="Bolo de chocolate com frutas vermelhas girando em 3D"
    >
      <hemisphereLight args={['#fff4e6', '#7a4a30', 1.3]} />
      <directionalLight position={[3, 5, 4]} intensity={2} color="#fff1e0" />
      <directionalLight position={[-4, 2, -2]} intensity={0.7} color="#f6b8c4" />
      <Cake />
      <Floater kind="choco" base={[-2.2, 1.3, -0.5]} speed={0.9} phase={0} />
      <Floater kind="raspberry" base={[2.1, 1.7, -0.3]} speed={1.1} phase={1.5} />
      <Floater kind="curl" base={[-2.0, -0.7, 0.4]} speed={0.8} phase={3} />
      <Floater kind="choco" base={[2.05, -0.5, 0.2]} speed={1} phase={2.2} />
      <Floater kind="blueberry" base={[-1.1, 2.1, -1]} speed={1.4} phase={0.7} />
      <Floater kind="raspberry" base={[1.3, 2.2, -1.2]} speed={1.2} phase={2.6} />
    </Canvas>
  );
}
