import { defineConfig } from 'vite';

export default defineConfig({
  // Utiliser './' permet à ton build d'être entièrement portable sur GitHub Pages 
  // sans même avoir à spécifier le nom exact de ton dépôt Git !
  base: './',
  server: {
    port: 8000,
    open: true
  }
});