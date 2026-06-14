/**
 * @typedef {Object} Job
 * @property {string} title
 * @property {string} company
 * @property {string} [location]
 * @property {boolean} [remote]
 * @property {string} [salary]
 * @property {string} [description]
 * @property {string[]} [requirements]
 * @property {string} url
 * @property {string} source
 * @property {string} foundAt
 */

/**
 * @typedef {Object} JobSearchFilters
 * @property {string} [position]
 * @property {string[]} [technologies]
 * @property {boolean} [remoteOnly]
 * @property {string} [location]
 */

/**
 * @typedef {Object} JobProvider
 * @property {string} id
 * @property {string} name
 * @property {boolean} requiresAuth
 * @property {() => boolean} isConfigured
 * @property {(filters: JobSearchFilters) => Promise<Job[]>} search
 */

export {};
