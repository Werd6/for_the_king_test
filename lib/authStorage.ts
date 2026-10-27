import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const isServer = Platform.OS === 'web' && typeof window === 'undefined';

type Manifest = { generation: string; count: number };
const secureOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
const queues = new Map<string, Promise<unknown>>();

function serialize<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const result = (queues.get(key) ?? Promise.resolve()).then(operation, operation);
  const settled = result.then(() => {}, () => {});
  queues.set(key, settled);
  void settled.then(() => { if (queues.get(key) === settled) queues.delete(key); });
  return result;
}

function secureKey(key: string): string {
  return `ftk.secure.${Array.from(key).map((char) => char.codePointAt(0)!.toString(16)).join('_')}`;
}

async function readManifest(key: string): Promise<Manifest | null> {
  const raw = await SecureStore.getItemAsync(key, secureOptions);
  if (!raw) return null;
  const value = JSON.parse(raw) as Manifest;
  if (!/^[a-z0-9-]+$/.test(value.generation) || !Number.isInteger(value.count) || value.count < 0) {
    throw new Error('Saved sign-in data could not be read.');
  }
  return value;
}

async function removeChunks(key: string, manifest: Manifest | null): Promise<void> {
  if (!manifest) return;
  await Promise.all(Array.from({ length: manifest.count }, (_, index) =>
    SecureStore.deleteItemAsync(`${key}.${manifest.generation}.${index}`, secureOptions)
  ));
}

async function writeSecure(key: string, value: string): Promise<void> {
  const previous = await readManifest(key);
  // Unicode code points keep every chunk below the historical 2 KB Keychain limit.
  const characters = Array.from(value);
  const next: Manifest = {
    generation: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    count: Math.ceil(characters.length / 400),
  };
  try {
    for (let index = 0; index < next.count; index++) {
      await SecureStore.setItemAsync(
        `${key}.${next.generation}.${index}`,
        characters.slice(index * 400, (index + 1) * 400).join(''),
        secureOptions
      );
    }
    // Commit only after all chunks exist, retaining the old value on write failure.
    await SecureStore.setItemAsync(key, JSON.stringify(next), secureOptions);
  } catch (error) {
    await removeChunks(key, next).catch(() => {});
    throw error;
  }
  await removeChunks(key, previous).catch(() => {});
}

/** Native credentials live in Keychain/Keystore; web keeps the existing browser storage. */
export const authStorage = {
  getItem(key: string): Promise<string | null> {
    if (isServer) return Promise.resolve(null);
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    return serialize(key, async () => {
      const nativeKey = secureKey(key);
      const manifest = await readManifest(nativeKey);
      if (manifest) {
        const chunks = await Promise.all(Array.from({ length: manifest.count }, (_, index) =>
          SecureStore.getItemAsync(`${nativeKey}.${manifest.generation}.${index}`, secureOptions)
        ));
        if (chunks.some((chunk) => chunk === null)) throw new Error('Saved sign-in data is incomplete.');
        return chunks.join('');
      }
      // Migrate existing app sessions without asking existing users to sign in again.
      const legacy = await AsyncStorage.getItem(key);
      if (legacy !== null) {
        await writeSecure(nativeKey, legacy);
        await AsyncStorage.removeItem(key);
      }
      return legacy;
    });
  },
  setItem(key: string, value: string): Promise<void> {
    if (isServer) return Promise.resolve();
    if (Platform.OS === 'web') return AsyncStorage.setItem(key, value);
    return serialize(key, async () => {
      await writeSecure(secureKey(key), value);
      await AsyncStorage.removeItem(key);
    });
  },
  removeItem(key: string): Promise<void> {
    if (isServer) return Promise.resolve();
    if (Platform.OS === 'web') return AsyncStorage.removeItem(key);
    return serialize(key, async () => {
      const nativeKey = secureKey(key);
      const manifest = await readManifest(nativeKey);
      await AsyncStorage.removeItem(key);
      await SecureStore.deleteItemAsync(nativeKey, secureOptions);
      await removeChunks(nativeKey, manifest).catch(() => {});
    });
  },
};
