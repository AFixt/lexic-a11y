// Jest config for the built-artifact smoke tests (`npm run test:dist`).
//
// Kept separate from `jest.config.js` because these tests require `dist/` to
// exist: the main suite runs before the build in `check:all`, so folding them
// in would fail on a clean checkout. No coverage is collected here — the
// bundles are minified, and `src/` coverage is the main suite's job.
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  roots: ['<rootDir>/test'],
  // The ESM bundle imports `./styles.css` so that a consumer's bundler loads
  // the stylesheet without being told to (see rollup.config.js). These tests
  // `require()` that bundle, and babel-jest rewrites the import to a
  // `require('./styles.css')` that Jest would then execute as JavaScript --
  // `:root { ... }` fails to parse on its first character. Map it to the same
  // stub `jest.config.js` uses; what these tests assert is that the import is
  // *present*, not what the CSS contains.
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/jest.styleMock.js',
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
};
