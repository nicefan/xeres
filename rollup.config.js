// import path from 'path'
// import { terser } from 'rollup-plugin-terser';
// import resolve from '@rollup/plugin-node-resolve'
// import commonjs from '@rollup/plugin-commonjs'
import { readFileSync } from 'node:fs'
import ts from '@rollup/plugin-typescript'
import dts from 'rollup-plugin-dts'
// const global = readFileSync(new URL('./src/types.d.ts', import.meta.url))

const pkg = require('./package.json')
// const name = pkg.name
const dir = 'dist'
const banner = `/*!
  * ${pkg.name} v${pkg.version}
  * (c) ${new Date().getFullYear()} 范阳峰 covien@msn.com
  * @license MIT
  */`

const tsPlugin = ts({
  compilerOptions:{
    lib: ['esnext'],
    target: 'es2015',
    outDir: dir,
    declaration: false,
    declarationDir: 'dist_types',
  },
  // check: true,
  tsconfig: './tsconfig.json',
  include: ['src/*'],
})
const mainFile = 'src/index.ts'
const mainConfig = {
  input: mainFile,
  output: [
    {
      banner,
      format: 'cjs',
      dir: '.',
      entryFileNames: dir + '/[name].cjs.js',
    },
    {
      banner,
      format: 'es',
      dir: '.',
      entryFileNames: dir + '/[name].js',
    },
  ],
  plugins: [tsPlugin],
}

const types = {
  input: mainFile,
  output: {
    // intro: global,
    format: 'es',
    dir: '.',
    entryFileNames: dir + '/[name].d.ts',
  },
  plugins: [dts()],
}
export default [mainConfig, types]
