import * as SecureStore from 'expo-secure-store';

export async function getItem(key: string): Promise<string | null> {
  return await SecureStore.getItemAsync(key).catch(() => null);
}

export async function setItem(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value).catch((e) => console.warn('SecureStore write failed', e));
}
