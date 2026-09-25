import { Linking, Platform } from 'react-native';

export const FEEDBACK_URL = 'https://forms.gle/NGM9MmfJ2y9hmstp6';

export function openFeedbackForm() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(FEEDBACK_URL, '_blank', 'noopener,noreferrer');
    return;
  }
  Linking.openURL(FEEDBACK_URL);
}
