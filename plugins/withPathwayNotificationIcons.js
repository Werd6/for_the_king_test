const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * Bundles each pathway's Android notification icon as `notification_icon_<pathway id>`
 * (dashes become underscores). Pushes pick one by the huddle's pathway; see
 * supabase/migrations/005_push_notifications.sql. Icons are white on transparent, 96×96.
 *
 * Usage in app.json: ["./plugins/withPathwayNotificationIcons", { "<pathway id>": "<png path>" }]
 */
module.exports = function withPathwayNotificationIcons(config, icons = {}) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const { projectRoot, platformProjectRoot } = config.modRequest;
      const res = path.join(platformProjectRoot, 'app/src/main/res');
      const names = Object.keys(icons).map((id) => `notification_icon_${id.replace(/-/g, '_')}`);

      await fs.promises.mkdir(path.join(res, 'drawable-xxxhdpi'), { recursive: true });
      await Promise.all(
        Object.values(icons).map((file, i) =>
          fs.promises.copyFile(
            path.join(projectRoot, file),
            path.join(res, 'drawable-xxxhdpi', `${names[i]}.png`)
          )
        )
      );

      // Only referenced by name at runtime, so resource shrinking must not drop them.
      await fs.promises.mkdir(path.join(res, 'raw'), { recursive: true });
      await fs.promises.writeFile(
        path.join(res, 'raw', 'pathway_notification_icons_keep.xml'),
        `<?xml version="1.0" encoding="utf-8"?>\n<resources xmlns:tools="http://schemas.android.com/tools" tools:keep="${names
          .map((n) => `@drawable/${n}`)
          .join(',')}" />\n`
      );
      return config;
    },
  ]);
};
