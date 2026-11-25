// Rapier'in kinematik gövdesinin yerini tutan hafif sarmalayıcı.
//
// Oyunda hiçbir fizik simülasyonu yok: tüm gövdeler "kinematicPosition" idi,
// çarpışmalar obstacleRegistry ile elle hesaplanıyor. Rapier yalnızca konum
// taşıyıcı olarak kullanıldığı halde paketin ~2 MB'ını (WASM) oluşturuyordu.
//
// Aynı API (translation / setTranslation) korunur ki çağıran kod değişmesin:
//  - translation() konumun ANLIK KOPYASINI döner (Rapier gibi). Kod kare
//    içinde setTranslation'dan sonra da eski konumla çalışmaya devam eder.
//  - Başlangıç konumu yalnızca nesne ilk bağlandığında verilir. JSX'te
//    `position` özelliği KULLANILMAZ: bileşen yeniden çizilince R3F onu
//    yeniden uygular ve at/engel başlangıç noktasına ışınlanırdı.
export function makeKinematicBody(object3d, initial) {
  if (initial && !object3d.userData.__kbInit) {
    object3d.position.set(initial[0], initial[1], initial[2]);
    object3d.userData.__kbInit = true;
  }
  const snap = { x: 0, y: 0, z: 0 };
  return {
    object3d,
    translation() {
      const p = object3d.position;
      snap.x = p.x; snap.y = p.y; snap.z = p.z;
      return snap;
    },
    setTranslation(t) {
      object3d.position.set(t.x, t.y, t.z);
    },
  };
}
