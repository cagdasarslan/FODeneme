import * as THREE from 'three';

// ── Yetenek (power-up) 3D modelleri ─────────────────────────────────────────
// Yolda beliren toplanabilirler (SuperNalSpawner) ve Garaj önizlemesi bu
// meshleri paylaşır. Tüm geometri/malzemeler modül seviyesinde tek sefer
// oluşturulur; low-poly + flatShading, mobil için az mesh.

const std = (o) => new THREE.MeshStandardMaterial({ flatShading: true, ...o });

// Ortak malzemeler
const goldMat   = std({ color: '#ffc83a', metalness: 0.85, roughness: 0.22, emissive: '#ffb020', emissiveIntensity: 0.6 });
const darkMat   = std({ color: '#7a4a10', emissive: '#3a2008', emissiveIntensity: 0.3 });
const woodMat   = std({ color: '#8a5a2b', roughness: 0.8 });
const leafMat   = std({ color: '#3fbf3f', emissive: '#1d6a1d', emissiveIntensity: 0.4 });

// ── Nal (magnet & turbo tabanı) ─────────────────────────────────────────────
const SHOE_ARC   = Math.PI * 1.45;
const torusGeo   = new THREE.TorusGeometry(0.5, 0.14, 6, 20, SHOE_ARC).rotateZ(Math.PI / 2 - SHOE_ARC / 2 + Math.PI);
const shoeEndGeo = new THREE.BoxGeometry(0.3, 0.14, 0.3);
const nailGeo    = new THREE.SphereGeometry(0.045, 6, 4);
const SHOE_ENDS  = [-1, 1].map(sgn => { const a = -Math.PI / 2 + sgn * SHOE_ARC / 2; return [Math.cos(a) * 0.5, Math.sin(a) * 0.5]; });
const SHOE_NAILS = [-0.55, -0.25, 0.25, 0.55].map(f => { const a = -Math.PI / 2 + f * SHOE_ARC * 0.6; return [Math.cos(a) * 0.5, Math.sin(a) * 0.5]; });
const magTipMat  = std({ color: '#00cfff', emissive: '#00a8ff', emissiveIntensity: 1.1, metalness: 0.4, roughness: 0.3 });
const sparkGeo   = new THREE.OctahedronGeometry(0.07, 0);

function Horseshoe({ tipMat = goldMat, nails = true }) {
  return (
    <group rotation={[0, 0, Math.PI]}>
      <mesh geometry={torusGeo} material={goldMat} />
      {SHOE_ENDS.map(([x, y], i) => <mesh key={i} geometry={shoeEndGeo} material={tipMat} position={[x, y, 0]} />)}
      {nails && SHOE_NAILS.map(([x, y], i) => <mesh key={'n' + i} geometry={nailGeo} material={darkMat} position={[x, y, 0.13]} />)}
    </group>
  );
}

// Süper Nal: altın nal + mavi mıknatıs uçları + çekim kıvılcımları
function MagnetMesh() {
  return (
    <group>
      <Horseshoe tipMat={magTipMat} />
      {[[-0.32, 0.72], [0, 0.85], [0.32, 0.72]].map(([x, y], i) => (
        <mesh key={i} geometry={sparkGeo} material={magTipMat} position={[x, y, 0]} />
      ))}
    </group>
  );
}

// ── Pegasus Kanatları: tüy dizili iki kanat + ortada hale ───────────────────
const featherGeo = new THREE.BoxGeometry(1, 0.15, 0.06).translate(0.5, 0, 0); // kök orijinde, +x uzanır
const featherMat = std({ color: '#ffffff', emissive: '#cfe8ff', emissiveIntensity: 0.55, roughness: 0.5 });
const haloGeo    = new THREE.TorusGeometry(0.2, 0.035, 4, 16);
const coreGeo    = new THREE.IcosahedronGeometry(0.15, 0);
// [uzunluk, açı(rad, yukarı doğru)] — üstten alta yelpaze
const FEATHERS   = [[0.95, 0.75], [0.88, 0.5], [0.78, 0.25], [0.64, 0.02], [0.48, -0.22]];
function Wing({ side }) {
  return (
    <group position={[side * 0.12, 0.05, 0]} scale={[side, 1, 1]} rotation={[0, side * 0.25, 0]}>
      {FEATHERS.map(([len, ang], i) => (
        <mesh key={i} geometry={featherGeo} material={featherMat}
          position={[0, -i * 0.03, -i * 0.01]} rotation={[0, 0, ang]} scale={[len, 1, 1]} />
      ))}
    </group>
  );
}
function WingsMesh() {
  return (
    <group position={[0, -0.25, 0]}>
      <Wing side={1} /><Wing side={-1} />
      <mesh geometry={coreGeo} material={goldMat} />
      <mesh geometry={haloGeo} material={goldMat} position={[0, 0.32, 0]} rotation={[Math.PI / 2.3, 0, 0]} />
    </group>
  );
}

// ── Şimşek Nalı: kanatlı nal içinden geçen ExtrudeGeometry yıldırım ─────────
const boltShape = new THREE.Shape();
[[0.12, 0.62], [-0.22, 0.02], [0.02, 0.02], [-0.14, -0.62], [0.26, 0.1], [0.02, 0.1], [0.2, 0.62]]
  .forEach(([x, y], i) => (i ? boltShape.lineTo(x, y) : boltShape.moveTo(x, y)));
const boltGeo = new THREE.ExtrudeGeometry(boltShape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 }).center();
const boltMat = std({ color: '#ffe03a', emissive: '#ffb000', emissiveIntensity: 0.8, metalness: 0.2, roughness: 0.3 });
const miniFeatherGeo = new THREE.BoxGeometry(0.4, 0.1, 0.05).translate(0.2, 0, 0);
function TurboMesh() {
  return (
    <group>
      <group scale={0.85}><Horseshoe nails={false} /></group>
      <mesh geometry={boltGeo} material={boltMat} scale={1.15} position={[0, 0.02, 0.05]} />
      {[-1, 1].map(s => (
        <group key={s} position={[s * 0.5, 0.15, 0]} scale={[s, 1, 1]}>
          {[0, 1, 2].map(i => (
            <mesh key={i} geometry={miniFeatherGeo} material={featherMat}
              position={[0, -i * 0.11, 0]} rotation={[0, 0, 0.55 - i * 0.28]} scale={[1 - i * 0.2, 1, 1]} />
          ))}
        </group>
      ))}
    </group>
  );
}

// ── Nal Zırhı: altın çerçeveli arma kalkanı + parlak koruma balonu ──────────
const crestShape = new THREE.Shape();
crestShape.moveTo(0, 0.6);
crestShape.quadraticCurveTo(0.3, 0.52, 0.48, 0.58);
crestShape.lineTo(0.46, 0.05);
crestShape.quadraticCurveTo(0.4, -0.38, 0, -0.62);
crestShape.quadraticCurveTo(-0.4, -0.38, -0.46, 0.05);
crestShape.lineTo(-0.48, 0.58);
crestShape.quadraticCurveTo(-0.3, 0.52, 0, 0.6);
const crestGeo = new THREE.ExtrudeGeometry(crestShape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.04, bevelSegments: 1, curveSegments: 4 }).center();
const crestInnerGeo = crestGeo.clone().scale(0.78, 0.78, 1.25);
const crestRedMat = std({ color: '#b3262b', emissive: '#5a0d10', emissiveIntensity: 0.4, roughness: 0.5 });
const bubbleGeo = new THREE.IcosahedronGeometry(0.85, 1);
const bubbleMat = new THREE.MeshStandardMaterial({ color: '#9fe8ff', emissive: '#4fc8ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.22, flatShading: true, depthWrite: false, side: THREE.DoubleSide });
function ShieldMesh() {
  return (
    <group>
      <mesh geometry={crestGeo} material={goldMat} />
      <mesh geometry={crestInnerGeo} material={crestRedMat} />
      <group scale={0.42} position={[0, 0.03, 0.1]}><Horseshoe nails={false} /></group>
      <mesh geometry={bubbleGeo} material={bubbleMat} />
    </group>
  );
}

// ── Zaman Büyüsü: ahşap çerçeveli kum saati, mor cam + akan kum ────────────
const glassGeo = new THREE.ConeGeometry(0.36, 0.55, 8, 1, true);
const glassMat = new THREE.MeshStandardMaterial({ color: '#d7c4ff', emissive: '#8a5cff', emissiveIntensity: 0.5, transparent: true, opacity: 0.38, flatShading: true, depthWrite: false, side: THREE.DoubleSide });
const sandGeo  = new THREE.ConeGeometry(0.24, 0.3, 8);
const sandMat  = std({ color: '#ffd27a', emissive: '#ff9f2a', emissiveIntensity: 0.6 });
const streamGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4);
const capGeo   = new THREE.CylinderGeometry(0.46, 0.46, 0.09, 8);
const postGeo  = new THREE.CylinderGeometry(0.035, 0.035, 1.18, 5);
const runeMat  = std({ color: '#c9a2ff', emissive: '#a070ff', emissiveIntensity: 1.2 });
const runeGeo  = new THREE.TorusGeometry(0.62, 0.025, 4, 24);
function SlowmoMesh() {
  return (
    <group>
      <mesh geometry={glassGeo} material={glassMat} position={[0, 0.28, 0]} rotation={[Math.PI, 0, 0]} />
      <mesh geometry={glassGeo} material={glassMat} position={[0, -0.28, 0]} />
      <mesh geometry={sandGeo} material={sandMat} position={[0, 0.2, 0]} rotation={[Math.PI, 0, 0]} scale={0.7} />
      <mesh geometry={sandGeo} material={sandMat} position={[0, -0.4, 0]} />
      <mesh geometry={streamGeo} material={sandMat} />
      {[1, -1].map(s => <mesh key={s} geometry={capGeo} material={woodMat} position={[0, s * 0.6, 0]} />)}
      {[0, 1, 2].map(i => {
        const a = (i / 3) * Math.PI * 2;
        return <mesh key={i} geometry={postGeo} material={woodMat} position={[Math.cos(a) * 0.38, 0, Math.sin(a) * 0.38]} />;
      })}
      <mesh geometry={runeGeo} material={runeMat} rotation={[Math.PI / 2.4, 0, 0]} />
    </group>
  );
}

// ── Altın Havuç: çapraz iki altın havuç (×2) + altın para halkası ──────────
const carrotGeo = new THREE.ConeGeometry(0.17, 0.9, 7).rotateZ(Math.PI); // uç aşağı
const leafGeo   = new THREE.ConeGeometry(0.06, 0.3, 4).translate(0, 0.15, 0);
const goldCarrotMat = std({ color: '#ffb300', metalness: 0.8, roughness: 0.25, emissive: '#ff8a00', emissiveIntensity: 0.7 });
const coinGeo   = new THREE.CylinderGeometry(0.14, 0.14, 0.04, 10).rotateX(Math.PI / 2);
function GoldCarrot({ x, rz }) {
  return (
    <group position={[x, 0, 0]} rotation={[0, 0, rz]}>
      <mesh geometry={carrotGeo} material={goldCarrotMat} />
      {[-0.5, 0, 0.5].map((r, i) => (
        <mesh key={i} geometry={leafGeo} material={leafMat} position={[0, 0.45, 0]} rotation={[0, i, r]} />
      ))}
    </group>
  );
}
function GoldenMesh() {
  return (
    <group>
      <GoldCarrot x={-0.2} rz={0.4} />
      <GoldCarrot x={0.2} rz={-0.4} />
      {[0, 1, 2, 3].map(i => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return <mesh key={i} geometry={coinGeo} material={goldMat} position={[Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0]} />;
      })}
    </group>
  );
}

const MESHES = {
  magnet: MagnetMesh, wings: WingsMesh, turbo: TurboMesh,
  shield: ShieldMesh, slowmo: SlowmoMesh, golden: GoldenMesh,
};

export function PowerupMesh({ type }) {
  const M = MESHES[type] ?? MagnetMesh;
  return <M />;
}

export default PowerupMesh;
