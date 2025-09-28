import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    // Set to false to prevent Vite from clearing the dist folder on every build.
    // This can be useful if you have other assets in there.
    emptyOutDir: true,
    
    rollupOptions: {
      input: {
        // Define all your entry points here
        popup: resolve(__dirname, 'src/main.js'),
        dashboard: resolve(__dirname, 'src/dashboard.js'),
        // **IMPORTANT**: Add the background script as an entry point
        background: resolve(__dirname, 'background/background.js') // Adjust path if it's in /src
      },
      output: {
        // Configure the output directory and file names
        dir: 'dist',
        // Use 'entryFileNames' to ensure consistent naming
        entryFileNames: '[name].bundle.js',
        // Set format to 'es' for modern modules, compatible with Manifest V3
        format: 'es',
      },
    },
    // Set minify to false. This often helps avoid 'unsafe-eval' errors
    // during development by keeping the code more readable.
    minify: false,
  },
});