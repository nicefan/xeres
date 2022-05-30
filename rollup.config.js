import path from 'path'
// import { terser } from 'rollup-plugin-terser';
// import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import ts from '@rollup/plugin-typescript'

const pkg = require('./package.json')
const name = pkg.name
const dir = 'dist'
const banner = `/*!
  * ${pkg.name} v${pkg.version}
  * (c) ${new Date().getFullYear()} 范阳峰 covien@msn.com
  * @license MIT
  */`

const tsPlugin = ts({
  lib: ['esnext'],
  target: 'es2015',
  declaration: false,
  outDir: dir,
  // declarationDir: dir + '/types',
  // check: true,
  tsconfig: path.resolve(__dirname, 'tsconfig.json'),
  // cacheRoot: path.resolve(__dirname, 'node_modules/.rts2_cache'),
  // tsconfigOverride: { compilerOptions: { declaration: false,declarationMap: false } }
})
const mainFile = 'src/index.ts'
const mainConfig = [
  {
    input: mainFile,
    output: {
      banner,
      format: 'cjs',
      file: pkg.main,
    },
    plugins: [tsPlugin, commonjs()],
  },
  {
    input: mainFile,
    output: {
      banner,
      format: 'es',
      file: pkg.module,
    },
    plugins: [tsPlugin],
  },
]

export default mainConfig
const multi = {
  // input 是打包入口文件路径
  // input: 'src/uniRequest.ts',
  input: {
    [pkg.name]: 'src/index.ts',
    uniRequest: 'src/uniRequest.ts',
  },
  // 输出配置
  output: [
    {
      // 输出路径及文件名
      entryFileNames: '[name].es.js',
      dir: 'dist',
      // file: 'dist/index2.es.js',
      // 输出格式
      format: 'es',
    },
    // {
    //     // 输出路径及文件名
    //     file: 'dist/bundle.min.js',
    //     // 输出格式
    //     format: 'es',
    //     plugins: [terser()]
    //   },
    {
      entryFileNames: '[name].cjs.js',
      dir: 'dist',
      // 输出格式
      format: 'cjs',
      name: 'dataModal',
      // plugins: [terser()]
    },
  ],
}
