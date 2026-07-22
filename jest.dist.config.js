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
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
};
