import { resolve } from 'node:path';
import {type UserConfig} from "vite";
import dts from 'vite-plugin-dts';

export default {
    build: {
        lib: {
            entry: resolve(import.meta.dirname, 'src/index.ts'),
            formats: ['es'],
        }
    },
    plugins: [dts()],
} satisfies UserConfig