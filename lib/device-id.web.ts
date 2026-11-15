import * as Crypto from 'expo-crypto';

const KEY = 'monster-arena.deviceId';

export async function getDeviceId(): Promise<string> {
  const existing = localStorage.getItem(KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  localStorage.setItem(KEY, id);
  return id;
}
