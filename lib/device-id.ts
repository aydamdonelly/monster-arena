import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY = 'monster-arena.deviceId';

export async function getDeviceId(): Promise<string> {
  try {
    const existing = await SecureStore.getItemAsync(KEY);
    if (existing) return existing;
  } catch (e) {
    console.warn('SecureStore read failed', e);
  }
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(KEY, id).catch((e) => console.warn('SecureStore write failed', e));
  return id;
}
