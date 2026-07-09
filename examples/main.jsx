// main.jsx
// Single entry point for the feature-tour example. Mounts FeatureTour into the
// #root element defined in index.html. Served by Vite via `npm run example`.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import FeatureTour from './FeatureTour';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FeatureTour />
  </StrictMode>,
);
