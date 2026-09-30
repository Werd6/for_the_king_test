import * as ImagePicker from 'expo-image-picker';

type Scanner = typeof import('react-native-document-scanner-plugin').default;

// The scanner's native module is missing in Expo Go and throws on import there.
let scanner: Scanner | null = null;
try {
  scanner = require('react-native-document-scanner-plugin').default as Scanner;
} catch {
  scanner = null;
}

/** Whether a document scanner (edge detection + crop) is available on this platform. */
export const canScan = scanner != null;

/** Opens the camera. Returns the photo URI, or null if cancelled or permission was denied. */
export async function takePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

/** Opens the photo library. Returns the photo URI, or null if cancelled. */
export async function choosePhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0].uri;
}

/** Scans pages. Falls back to a plain camera photo where no scanner exists. */
export async function scanPages(): Promise<string[]> {
  if (!scanner) {
    const uri = await takePhoto();
    return uri ? [uri] : [];
  }
  const result = await scanner.scanDocument({ croppedImageQuality: 90, maxNumDocuments: 5 });
  if (result.status !== 'success') return [];
  return result.scannedImages ?? [];
}
