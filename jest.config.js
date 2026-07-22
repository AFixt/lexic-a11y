module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Playwright owns everything under e2e/; test/ holds the built-artifact
  // smoke tests, which need `dist/` and run separately (jest.dist.config.js)
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/e2e/', '<rootDir>/test/'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/jest.styleMock.js',
  },
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  // The @afixt packages (and their uuid dependency) ship ESM only —
  // let babel-jest transpile them
  transformIgnorePatterns: ['/node_modules/(?!(@afixt/|uuid/))'],
  collectCoverage: true,
  coverageReporters: ['text', 'lcov'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/index.js',
    '!src/lib.js',
    '!src/tests/**/*.{js,jsx}',
  ],
};
