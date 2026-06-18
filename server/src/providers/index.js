import { adzunaProvider } from './adzuna-provider.js';
import { arbeitnowProvider } from './arbeitnow-provider.js';
import { jobicyProvider } from './jobicy-provider.js';
import { linkedinProvider } from './linkedin-provider.js';
import { remotiveProvider } from './remotive-provider.js';
import { remoteOkProvider } from './remoteok-provider.js';

/** @type {import('./provider.interface.js').JobProvider[]} */
export const jobProviders = [
  remoteOkProvider,
  remotiveProvider,
  arbeitnowProvider,
  jobicyProvider,
  adzunaProvider,
  linkedinProvider,
];
