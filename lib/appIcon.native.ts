type AltIconsModule = typeof import('expo-alternate-app-icons');

/** Must match the `name`s in the expo-alternate-app-icons plugin config in app.json. */
const BUNDLED_ICONS = new Set(['ForTheKing']);

let altIcons: AltIconsModule | null | undefined;

function loadModule(): AltIconsModule | null {
  if (altIcons !== undefined) return altIcons;
  try {
    // Missing in Expo Go and in builds made before the module was added.
    altIcons = require('expo-alternate-app-icons') as AltIconsModule;
  } catch {
    altIcons = null;
  }
  return altIcons;
}

/**
 * Switches the home-screen icon to the pathway's bundled icon, or the default.
 * No-ops when already correct, since iOS shows a system alert on every switch.
 */
export async function applyAppIcon(iconKey: string | null): Promise<void> {
  const mod = loadModule();
  if (!mod?.supportsAlternateIcons) return;
  const target = iconKey && BUNDLED_ICONS.has(iconKey) ? iconKey : null;
  try {
    if (mod.getAppIconName() === target) return;
    await mod.setAlternateAppIcon(target);
  } catch (e) {
    console.warn('Could not change app icon', e);
  }
}
