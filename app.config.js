const fs = require('fs');

// EAS builds get google-services.json from the GOOGLE_SERVICES_JSON file variable; it's
// gitignored because the repo is public. Without it, Android builds have no push.
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ??
  (fs.existsSync('./google-services.json') ? './google-services.json' : undefined);

module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, ...(googleServicesFile && { googleServicesFile }) },
});
