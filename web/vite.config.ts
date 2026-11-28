import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
    plugins: [preact()],
    build: {
        rollupOptions: {
            input: [
                fileURLToPath(new URL('./index.html', import.meta.url)),
                fileURLToPath(new URL('./demos/study-home/index.html', import.meta.url)),
            ],
        },
    },
});
