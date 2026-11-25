import * as THREE from 'three';
import { IS_MOBILE } from '@/utils/device';

// Kodla üretilen dekor için ortak parçalar. GLB modeller yerine birkaç temel
// gövde (kutu, silindir, koni, kaya) paylaşılan geometri/malzemeyle kullanılır;
// her öğe onlarca üçgen. Tabanlar y=0'dadır, çağıran ölçekler.
export const G = {
  box: new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  cyl8: new THREE.CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0),
  cyl12: new THREE.CylinderGeometry(1, 1, 1, 12).translate(0, 0.5, 0),
  cone8: new THREE.ConeGeometry(1, 1, 8).translate(0, 0.5, 0),
  dome: new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
  rock: new THREE.DodecahedronGeometry(1, 0),
  plane: new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0),
  // Ek gövdeler (eklemeli; yukarıdakiler değişmedi)
  cyl6: new THREE.CylinderGeometry(1, 1, 1, 6).translate(0, 0.5, 0),
  cone4: new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0), // 1×1 tabanlı piramit
  cone6: new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0),
  blob: new THREE.IcosahedronGeometry(1, 0),            // merkezli yaprak/çalı kümesi
  ball: new THREE.SphereGeometry(1, 8, 6),              // merkezli küre
  prism: makePrism(),                                   // üçgen çatı: x -0.5..0.5, y 0..1, z -0.5..0.5
  wheel: new THREE.CylinderGeometry(1, 1, 1, 10).rotateZ(Math.PI / 2), // x eksenli, merkezli
  halfCylZ: new THREE.CylinderGeometry(1, 1, 1, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2), // z eksenli yarım silindir (tonoz), taban y=0
};

function makePrism() {
  const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0.99) pos.setX(i, 0);
  g.computeVertexNormals();
  return g;
}

// Satranç/desen dokusu (bayrak, afiş vb.)
export function makeCheckerTex(n = 4, a = '#111111', b = '#f4f4f4') {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  const s = 64 / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    g.fillStyle = (x + y) % 2 ? a : b;
    g.fillRect(x * s, y * s, s, s);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  return t;
}

export function makeMats(colors) {
  const out = {};
  for (const [k, v] of Object.entries(colors)) {
    out[k] = typeof v === 'string'
      ? new THREE.MeshStandardMaterial({ color: v, roughness: 0.85, flatShading: true })
      : new THREE.MeshStandardMaterial({ roughness: 0.85, flatShading: true, ...v });
  }
  return out;
}

const SHADOW = !IS_MOBILE;
export function makeP(MAT) {
  return function P({ g, m, p, s, r }) {
    return <mesh geometry={G[g]} material={MAT[m]} position={p} scale={s} rotation={r}
      castShadow={SHADOW} receiveShadow={SHADOW} />;
  };
}
