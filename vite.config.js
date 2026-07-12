import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'maplibre': ['maplibre-gl'],
          'turf': [
            '@turf/helpers',
            '@turf/bbox',
            '@turf/distance',
            '@turf/clusters-dbscan',
            '@turf/point-grid',
            '@turf/isobands',
            '@turf/polygon-smooth'
          ]
        }
      }
    }
  }
});
