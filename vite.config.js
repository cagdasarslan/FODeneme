import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
  build: {
    target: 'es2015',
    chunkSizeWarningLimit: 2000,
    // Tek parça 3,5 MB paket yerine büyük kütüphaneler ayrı parçalarda:
    // tarayıcı/WebView bunları paralel indirir ve önbellekte tutar; oyun kodu
    // değişince yalnızca küçük uygulama parçası yeniden indirilir.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@dimforge') || id.includes('@react-three/rapier')) return 'physics';
          if (id.includes('three-stdlib') || id.includes('@react-three')) return 'r3f';
          if (id.includes('/three/')) return 'three';
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react';
        },
      },
    },
  },
});
