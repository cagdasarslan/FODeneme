import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { BOX, BALL, HALF_BALL, cyl, cone, mat, P } from './procParts';

// ── Prosedürel binici ────────────────────────────────────────────────────────
// Koordinat: orijin eyer oturma noktası, +z ileri (atın başı), +y yukarı.
// Gövde: pelvis, gövde, baş (0.28), 2 üst kol + 2 ön kol (dizgine uzanır),
// 2 uyluk + 2 baldır/çizme (atın yanından aşağı). Aksesuar karakter id'sine göre.

const SKIN = '#e0ac7e';

const LOOKS = {
  cowboy: { skin: SKIN, shirt: '#c8881b', pants: '#3b4f7a', boots: '#5a3418', glove: '#8a5a2b' },
  casual: { skin: SKIN, shirt: '#4a90d9', pants: '#2d3a4a', boots: '#eeeeee', glove: SKIN },
  ninja:  { skin: '#222222', shirt: '#222222', pants: '#222222', boots: '#1a1a1a', glove: '#222222' },
  viking: { skin: SKIN, shirt: '#6b4a2e', pants: '#4a3a2a', boots: '#3a2a1a', glove: '#5a3a22' },
  pirate: { skin: '#d49a6a', shirt: '#f0ead8', pants: '#2a2a2a', boots: '#1a1a1a', glove: '#d49a6a' },
  zombie: { skin: '#7aa05a', shirt: '#6d7f5a', pants: '#4a3f35', boots: '#3a3028', glove: '#7aa05a' },
  knight: { skin: '#d4a017', shirt: '#d4a017', pants: '#d4a017', boots: '#b8890f', glove: '#d4a017', metal: true },
  wizard: { skin: SKIN, shirt: '#3a2a7a', pants: '#3a2a7a', boots: '#2a1f4a', glove: SKIN },
};

function mats(id) {
  const L = LOOKS[id] ?? LOOKS.cowboy;
  const o = L.metal ? { m: 0.8, r: 0.3 } : {};
  return {
    skin: mat(L.skin, L.metal ? o : { r: 0.7 }),
    shirt: mat(L.shirt, o),
    pants: mat(L.pants, o),
    boots: mat(L.boots, L.metal ? { m: 0.8, r: 0.35 } : { r: 0.6 }),
    glove: mat(L.glove, o),
    eye: mat('#151515', { r: 0.4 }),
  };
}

// İki nokta arası uzuv (kutu): y ekseni a→b yönüne hizalanır
const _up = new THREE.Vector3(0, 1, 0);
function Limb({ a, b, w, m }) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const dir = vb.clone().sub(va); const len = dir.length();
  const q = new THREE.Quaternion().setFromUnitVectors(_up, dir.normalize());
  const mid = va.add(vb).multiplyScalar(0.5);
  return <mesh geometry={BOX} material={m} position={mid} quaternion={q} scale={[w, len + w * 0.4, w]} castShadow />;
}

const RED = () => mat('#c62828', { r: 0.7 });

// ── Baş aksesuarları (baş grubu içinde; baş merkezi y=0.15) ─────────────────
function HeadGear({ id, R }) {
  switch (id) {
    case 'cowboy': return (
      <group position={[0, 0.27, 0]} rotation={[-0.12, 0, 0]}>
        <P g={cyl(0.27, 0.27, 0.03, 8)} m={mat('#7a4a1f')} p={[0, 0, 0]} />
        <P g={cyl(0.12, 0.14, 0.15, 8)} m={mat('#7a4a1f')} p={[0, 0.08, 0]} />
        <P m={mat('#3a2410')} p={[0, 0.03, 0]} s={[0.29, 0.03, 0.29]} r={[0, Math.PI / 8, 0]} />
      </group>
    );
    case 'casual': return (
      <group position={[0, 0.24, 0]}>
        <P g={HALF_BALL} m={mat('#e53935')} s={[0.3, 0.26, 0.3]} p={[0, -0.02, 0]} />
        <P m={mat('#e53935')} p={[0, -0.01, 0.17]} s={[0.22, 0.025, 0.14]} />
        {/* kapüşon (ensede) */}
        <P m={mat('#3f7fc4')} p={[0, -0.16, -0.15]} s={[0.26, 0.2, 0.08]} r={[0.3, 0, 0]} />
      </group>
    );
    case 'ninja': return (
      <group>
        {/* göz yarığı */}
        <P m={mat(SKIN, { r: 0.7 })} p={[0, 0.17, 0.122]} s={[0.2, 0.05, 0.03]} />
        <P m={RED()} p={[0, 0.24, 0]} s={[0.29, 0.05, 0.29]} />
        <group ref={(e) => { R.rib0 = e; }} position={[0.04, 0.24, -0.14]}>
          <P m={RED()} p={[0, -0.12, -0.03]} s={[0.04, 0.26, 0.015]} />
        </group>
        <group ref={(e) => { R.rib1 = e; }} position={[-0.04, 0.24, -0.14]}>
          <P m={RED()} p={[0, -0.1, -0.03]} s={[0.04, 0.22, 0.015]} />
        </group>
      </group>
    );
    case 'viking': return (
      <group position={[0, 0.2, 0]}>
        <P g={HALF_BALL} m={mat('#8f9499', { m: 0.6, r: 0.4 })} s={[0.34, 0.34, 0.34]} />
        <P m={mat('#6b6f74', { m: 0.6, r: 0.4 })} p={[0, 0.01, 0]} s={[0.33, 0.04, 0.33]} />
        {[-1, 1].map((sd) => (
          <P key={sd} g={cone(0.04, 0.2, 6)} m={mat('#e8dcc0')} p={[sd * 0.17, 0.1, 0]} r={[0, 0, -sd * 0.75]} />
        ))}
        {/* sakal + örgüler */}
        <P m={mat('#c8742a')} p={[0, -0.16, 0.1]} s={[0.18, 0.12, 0.06]} />
        {[-1, 1].map((sd) => (
          <P key={sd} m={mat('#c8742a')} p={[sd * 0.05, -0.27, 0.11]} s={[0.035, 0.14, 0.035]} />
        ))}
      </group>
    );
    case 'pirate': return (
      <group>
        <group position={[0, 0.27, 0]}>
          <P g={cyl(0.24, 0.24, 0.04, 3)} m={mat('#1a1a4a')} r={[0, Math.PI, 0]} />
          <P g={cyl(0.12, 0.14, 0.12, 6)} m={mat('#1a1a4a')} p={[0, 0.07, 0]} />
          <P m={mat('#d4a017', { m: 0.6, r: 0.4 })} p={[0, 0.03, 0.11]} s={[0.06, 0.04, 0.02]} />
        </group>
        <P m={mat('#111111')} p={[0.05, 0.17, 0.125]} s={[0.07, 0.06, 0.02]} />
        <P m={mat('#111111')} p={[0, 0.2, 0]} s={[0.285, 0.015, 0.285]} r={[0, 0, -0.3]} />
      </group>
    );
    case 'zombie': return (
      <group>
        <P m={mat('#4a6a34')} p={[0.05, 0.26, 0.03]} s={[0.1, 0.04, 0.1]} />
        <P m={mat('#5a1a1a')} p={[-0.02, 0.08, 0.12]} s={[0.1, 0.02, 0.03]} />
      </group>
    );
    case 'knight': return (
      <group>
        <P m={mat('#d4a017', { m: 0.8, r: 0.3 })} p={[0, 0.16, 0]} s={[0.31, 0.33, 0.31]} />
        <P m={mat('#111111')} p={[0, 0.18, 0.157]} s={[0.22, 0.03, 0.01]} />
        <P m={mat('#b8890f', { m: 0.8, r: 0.3 })} p={[0, 0.34, 0]} s={[0.04, 0.05, 0.3]} />
        <group ref={(e) => { R.plume = e; }} position={[0, 0.36, -0.02]}>
          <P m={RED()} p={[0, 0.07, -0.08]} s={[0.05, 0.12, 0.26]} r={[-0.3, 0, 0]} />
        </group>
      </group>
    );
    case 'wizard': return (
      <group>
        <group position={[0, 0.26, 0]} rotation={[-0.15, 0, 0]}>
          <P g={cyl(0.25, 0.25, 0.03, 8)} m={mat('#3a2a7a')} />
          <P g={cone(0.15, 0.5, 8)} m={mat('#3a2a7a')} p={[0, 0.26, 0]} />
          {[[0.08, 0.12, 0.09], [-0.09, 0.2, 0.05], [0.03, 0.33, 0.06], [-0.05, 0.1, -0.1]].map((q, i) => (
            <P key={i} m={mat('#ffe680', { e: '#ffd84a', ei: 1.2 })} p={q} s={[0.035, 0.035, 0.035]} r={[0.6, 0.6, 0]} shadow={false} />
          ))}
        </group>
        <P g={cone(0.11, 0.26, 6)} m={mat('#eeeeee')} p={[0, -0.02, 0.1]} r={[Math.PI + 0.25, 0, 0]} />
      </group>
    );
    default: return null;
  }
}

// ── Gövde aksesuarları (gövde grubu içinde; gövde y 0.02..0.46) ─────────────
function TorsoGear({ id, R }) {
  switch (id) {
    case 'cowboy': return (
      <P g={cone(0.13, 0.14, 4)} m={RED()} p={[0, 0.42, 0.1]} r={[Math.PI - 0.5, Math.PI / 4, 0]} />
    );
    case 'casual': return (
      <P m={mat('#3f7fc4')} p={[0, 0.15, 0.13]} s={[0.22, 0.1, 0.02]} />
    );
    case 'viking': return (
      <P g={cyl(0.22, 0.27, 0.12, 8)} m={mat('#7a5530', { r: 1 })} p={[0, 0.47, 0]} s={[1, 1, 0.8]} />
    );
    case 'pirate': return (
      <group>
        <P m={RED()} p={[0, 0.06, 0]} s={[0.42, 0.09, 0.27]} />
        <P m={RED()} p={[0, 0.25, 0]} s={[0.07, 0.5, 0.265]} r={[0, 0, 0.7]} />
      </group>
    );
    case 'zombie': return (
      <group>
        {/* yırtık gömlek: deri yamaları görünür */}
        <P m={mat('#7aa05a', { r: 0.7 })} p={[0.08, 0.12, 0.128]} s={[0.12, 0.1, 0.01]} r={[0, 0, 0.5]} />
        <P m={mat('#7aa05a', { r: 0.7 })} p={[-0.1, 0.3, 0.128]} s={[0.08, 0.12, 0.01]} r={[0, 0, -0.3]} />
        <P m={mat('#4f5c40')} p={[0, 0.02, 0]} s={[0.42, 0.05, 0.27]} />
      </group>
    );
    case 'knight': return (
      <P m={mat('#b8890f', { m: 0.8, r: 0.3 })} p={[0, 0.44, 0]} s={[0.5, 0.09, 0.29]} />
    );
    case 'wizard': return (
      <group ref={(e) => { R.cape = e; }} position={[0, 0.44, -0.14]}>
        <P m={mat('#2a1f5c')} p={[0, -0.28, -0.02]} s={[0.4, 0.58, 0.025]} />
      </group>
    );
    case 'ninja': return (
      <P m={mat('#333333')} p={[0, 0.06, 0]} s={[0.42, 0.06, 0.27]} />
    );
    default: return null;
  }
}

export default function ProcRider({ characterId = 'cowboy', leanRef }) {
  const id = LOOKS[characterId] ? characterId : 'cowboy';
  const M = mats(id);
  const R = useRef({}).current;
  const zombie = id === 'zombie';

  // Aksesuar salınımı (kurdele, pelerin, sorguç)
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (R.rib0) R.rib0.rotation.x = 0.6 + Math.sin(t * 9) * 0.35;
    if (R.rib1) R.rib1.rotation.x = 0.5 + Math.sin(t * 9 + 1.3) * 0.4;
    if (R.cape) R.cape.rotation.x = -0.35 - Math.abs(Math.sin(t * 5)) * 0.25;
    if (R.plume) R.plume.rotation.x = Math.sin(t * 7) * 0.12;
  });

  const arm = (sd) => {
    const forward = zombie && sd > 0; // zombi: bir kol ileri uzanmış
    return (
      <group key={sd} position={[sd * 0.215, 0.43, 0]} rotation={forward ? [-1.75, 0, -sd * 0.05] : [-0.55, 0, sd * 0.12]}>
        <P m={M.shirt} p={[0, -0.13, 0]} s={[0.1, 0.28, 0.1]} />
        <group position={[0, -0.27, 0]} rotation={forward ? [-0.05, 0, 0] : [-0.95, 0, -sd * 0.2]}>
          <P m={id === 'casual' || id === 'wizard' ? M.shirt : id === 'knight' ? M.shirt : M.skin} p={[0, -0.12, 0]} s={[0.085, 0.25, 0.085]} />
          <P m={M.glove} p={[0, -0.27, 0]} s={[0.09, 0.08, 0.09]} />
        </group>
      </group>
    );
  };

  // Bacaklar eğilme grubunun DIŞINDA: binici eğilse de bacaklar atın
  // yanında kalır (uyluk öne-dışa, baldır aşağı, çizme üzengide)
  const leg = (sd) => {
    const hip = [sd * 0.14, 0.03, 0.02], knee = [sd * 0.37, -0.13, 0.26], ankle = [sd * 0.4, -0.47, 0.1];
    return (
      <group key={sd}>
        <Limb a={hip} b={knee} w={0.15} m={M.pants} />
        <Limb a={knee} b={ankle} w={0.12} m={id === 'wizard' ? M.boots : M.pants} />
        <P m={M.boots} p={[ankle[0], ankle[1] - 0.03, ankle[2] + 0.04]} s={[0.12, 0.12, 0.23]} />
      </group>
    );
  };

  return (
    <group>
      {/* pelvis */}
      <P m={M.pants} p={[0, 0.06, 0]} s={[0.34, 0.16, 0.26]} />
      {leg(-1)}{leg(1)}
      {/* üst gövde: eğilme pivotu (ProcHorse sürer) + zombi kamburu */}
      <group ref={leanRef} position={[0, 0.1, 0]}>
      <group rotation={[zombie ? 0.45 : 0, 0, 0]}>
        <P m={M.shirt} p={[0, 0.24, 0]} s={[0.4, 0.45, 0.25]} />
        <P m={M.shirt} p={[0, 0.03, 0]} s={[0.34, 0.08, 0.23]} />
        <TorsoGear id={id} R={R} />
        {arm(-1)}{arm(1)}
        {/* boyun + baş */}
        <P g={cyl(0.06, 0.07, 0.08, 6)} m={M.skin} p={[0, 0.5, 0]} />
        <group position={[0, 0.5, zombie ? 0.05 : 0]} rotation={[zombie ? 0.2 : -0.15, 0, 0]}>
          <P g={BALL} m={M.skin} p={[0, 0.15, 0]} s={[0.25, 0.28, 0.25]} />
          {id !== 'knight' && id !== 'ninja' && [-1, 1].map((sd) => (
            <P key={sd} m={M.eye} p={[sd * 0.055, 0.17, 0.118]} s={[0.035, 0.04, 0.02]} shadow={false} />
          ))}
          {id === 'ninja' && [-1, 1].map((sd) => (
            <P key={sd} m={M.eye} p={[sd * 0.05, 0.17, 0.138]} s={[0.03, 0.03, 0.01]} shadow={false} />
          ))}
          <HeadGear id={id} R={R} />
        </group>
      </group>
      </group>
    </group>
  );
}

