import { useDynamicCamera } from '@/hooks/useDynamicCamera';

// Canvas içinde çalışan, useFrame kullanan ince sarmalayıcı
export default function CameraRig() {
  useDynamicCamera();
  return null;
}
