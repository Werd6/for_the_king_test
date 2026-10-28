import * as ImagePicker from 'expo-image-picker';

/** Whether a document scanner (edge detection + crop) is available on this platform. */
export const canScan = false;

/** Opens the camera. Returns the photo URI, or null if cancelled. */
export async function takePhoto(): Promise<string | null> {
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
  const uri = await takePhoto();
  return uri ? [uri] : [];
}
