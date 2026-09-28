// ESFS runtime facade. ESTC owns source linting, ES3 normalization, and the
// final static gate; File/Folder remain host APIs rather than global shims.
export default {
  host: 'illustrator',
  hostTypes: 'Illustrator/2022',
  entry: 'src/jsx-entry.ts',
  outfile: 'dist/ESFS.jsx',
  globalName: '__ESFS_ENTRY__',
  target: 'illustrator',
  requireTarget: false,
  sourceLint: true,
  typecheck: true,
  normalize: true,
  compatibilityTransforms: ['esbuild'],
  compatibilityShims: [],
  allowedMissingBuiltins: [],
  allowedGlobalPatches: [],
  prelude: [],
  footer: [],
  allowJson: false,
  allowIncludes: false,
  live: false,
  liveLaunch: false
};
