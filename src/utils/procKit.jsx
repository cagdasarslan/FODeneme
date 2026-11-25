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
};

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
