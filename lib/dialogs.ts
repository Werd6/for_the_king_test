import { Alert, Platform, Share } from 'react-native';

/** Alerts that work on web (RN Alert is a no-op / broken in many browsers). */
export function showAlert(title: string, message?: string) {
  const text = message ? `${title}\n\n${message}` : title;
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(text);
    return;
  }
  Alert.alert(title, message);
}

/** Confirm dialogs that work on web. Returns true if the user confirmed. */
export async function confirmAction(
  title: string,
  message: string,
  confirmLabel = 'OK'
): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.confirm(`${title}\n\n${message}`);
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, onPress: () => resolve(true) },
    ]);
  });
}

/** Share with cancel handled (web throws AbortError when dismissed). */
export async function shareText(message: string): Promise<void> {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      // Prefer clipboard on web — Share API is flaky and aborts when dismissed
      await navigator.clipboard.writeText(message);
      showAlert('Copied', 'Invite text copied to clipboard.');
      return;
    }
    await Share.share({ message });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    const msg = e instanceof Error ? e.message : String(e);
    if (name === 'AbortError' || /cancel/i.test(msg)) {
      return; // user dismissed share sheet
    }
    throw e;
  }
}
