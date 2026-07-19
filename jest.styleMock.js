// Stub for CSS imports under Jest (see `moduleNameMapper` in jest.config.js).
//
// Behaves like `identity-obj-proxy`: any property lookup returns the property
// name, so a component reading `styles.toolbar` gets the string 'toolbar'. That
// package was referenced by the config but never installed, so the mapping
// threw the moment a test imported a module that pulls in CSS (e.g. src/lib.js).
// Implemented locally to keep the dependency surface flat.
module.exports = new Proxy(
  {},
  {
    get: (target, key) => (key === '__esModule' ? false : key),
  },
);
