// Prosedürel engel kiti — paylaşılan birim geometriler + materyaller.
// HER ŞEY modül seviyesinde BİR KEZ üretilir; engel bileşenleri yalnızca bu
// nesneleri ölçek/konum ile yeniden kullanır (spawn başına allocation yok).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// ── Birim geometriler (ölçek ile boyutlandırılır) ─────────────────────────────
export const G = {
  box:    new THREE.BoxGeometry(1, 1, 1),
  rbox:   new RoundedBoxGeometry(1, 1, 1, 2, 0.12),
  cyl8:   new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl12:  new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cone6:  new THREE.ConeGeometry(0.5, 1, 6),
  cone4:  new THREE.ConeGeometry(0.5, 1, 4),
  cone8:  new THREE.ConeGeometry(0.5, 1, 8),
  ico:    new THREE.IcosahedronGeometry(0.5, 0),     // çap 1 (bbox ≈ ±0.425)
  oct:    new THREE.OctahedronGeometry(0.5, 0),
  sph:    new THREE.SphereGeometry(0.5, 10, 8),
  cap:    new THREE.CapsuleGeometry(0.5, 1, 3, 8),   // r=0.5, toplam boy 2
  torus:  new THREE.TorusGeometry(0.5, 0.12, 6, 14),
};
// Bayrakçık: üçgen (direğe asılı, +x yönüne uzanır)
const _pen = new THREE.BufferGeometry();
_pen.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, -0.42, 0, 0.62, -0.21, 0], 3));
_pen.computeVertexNormals();
G.pennant = _pen;

// Telegraf ok başı (zemin decal'i): XZ düzleminde, -z yönünü (ileriyi) gösterir
function chevronGeo() {
  const s = new THREE.Shape();
  s.moveTo(-0.8, 0.0); s.lineTo(0, 0.7); s.lineTo(0.8, 0.0);
  s.lineTo(0.8, -0.38); s.lineTo(0, 0.32); s.lineTo(-0.8, -0.38); s.closePath();
  const g = new THREE.ShapeGeometry(s);
  g.scale(1.25, 1.25, 1);
  g.rotateX(-Math.PI / 2); // shape +y → dünya -z
  return g;
}
G.chevUp = chevronGeo();
G.chevDown = chevronGeo().rotateY(Math.PI);
G.plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

// ── Materyaller ───────────────────────────────────────────────────────────────
const cache = new Map();
/** Paylaşılan standart materyal (renk+emissive anahtarıyla önbellekli). */
export function mat(color, { e = 0.22, emissive = null, rough = 0.75, metal = 0 } = {}) {
  const key = `${color}|${e}|${emissive}|${rough}|${metal}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color, roughness: rough, metalness: metal,
      emissive: emissive ?? color, emissiveIntensity: e, flatShading: true,
    });
    cache.set(key, m);
  }
  return m;
}
export const CREAM = '#fff1d0';
export const HAZARD = mat(CREAM, { e: 0.55 });
export const BANNER_RED = mat('#c0392b', { e: 0.35 });
export const BANNER_CREAM = mat(CREAM, { e: 0.45 });
export const SHADOW_MAT = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.42, depthWrite: false });
export const GLASS = mat('#1c2a3a', { e: 0.15, rough: 0.2, metal: 0.4 });
export const TAIL = mat('#ff3020', { e: 1.6, emissive: '#ff3020' });
export const HEAD = mat('#fff6d8', { e: 1.2 });
export const TIRE = mat('#1e1e22', { e: 0.05, rough: 0.9 });

// ── Kısa mesh yardımcısı: <P g={G.box} m={..} p={[x,y,z]} s={[w,h,d]} r={[..]} />
export function P({ g = G.box, m, p, s, r, shadow = true, ...rest }) {
  return <mesh geometry={g} material={m} position={p} scale={s} rotation={r} castShadow={shadow} {...rest} />;
}

/** Zıplama engelleri için düz üst + krem tehlike şeridi (y = üst yüzey). */
export function HazardTop({ y, w, d = 0.24, z = 0 }) {
  return <P m={HAZARD} p={[0, y + 0.02, z]} s={[w, 0.04, d]} shadow={false} />;
}
