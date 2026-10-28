import { Linking, Platform } from 'react-native';

export const FEEDBACK_URL = 'https://forms.gle/NGM9MmfJ2y9hmstp6';
export const PRIVACY_POLICY_URL = 'https://goandmake.online/privacy';

function openExternal(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }
  Linking.openURL(url);
}

export function openFeedbackForm() {
  openExternal(FEEDBACK_URL);
}

export function openPrivacyPolicy() {
  openExternal(PRIVACY_POLICY_URL);
}
