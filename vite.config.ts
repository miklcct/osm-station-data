import { resolve } from 'node:path';
import {type UserConfig} from "vite";
import dts from 'vite-plugin-dts';

export default {
    build: {
        lib: {
            entry: resolve(import.meta.dirname, 'src/index.ts'),
            formats: ['es'],
            // Without this the bundle is named after the package, giving
            // dist/osm-station-data.js while package.json points main at
            // dist/index.js. It also matches the index.d.ts that types
            // already points at.
            fileName: 'index',
        }
    },
    plugins: [dts()],
} satisfies UserConfig