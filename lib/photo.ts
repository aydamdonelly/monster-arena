import * as Device from 'expo-device';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

const MAX_SIDE = 1024;

export type Photo = { uri: string; width: number; height: number };

let photoFlowUntil = 0;

export function photoFlowActive() {
  return Date.now() < photoFlowUntil;
}

export async function pickPhoto(source: 'camera' | 'library'): Promise<Photo | null> {
  photoFlowUntil = Date.now() + 5 * 60 * 1000;
  const photo = await launchPicker(source).catch(() => null);
  photoFlowUntil = photo ? Date.now() + 20 * 1000 : 0;
  return photo;
}

async function launchPicker(source: 'camera' | 'library'): Promise<Photo | null> {
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result = source === 'camera' ? await launchCamera(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets[0];
  return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
}

async function launchCamera(options: ImagePicker.ImagePickerOptions): Promise<ImagePicker.ImagePickerResult> {
  if (Platform.OS === 'web') return ImagePicker.launchCameraAsync(options);
  if (Device.isDevice === false) return ImagePicker.launchImageLibraryAsync(options);
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.granted) return await ImagePicker.launchCameraAsync(options);
  } catch {}
  return ImagePicker.launchImageLibraryAsync(options);
}

export async function toUploadJpeg(photo: Photo): Promise<string> {
  let { width, height } = photo;
  if (!width || !height) ({ width, height } = await ImageManipulator.manipulate(photo.uri).renderAsync());
  const context = ImageManipulator.manipulate(photo.uri);
  if (Math.max(width, height) > MAX_SIDE) {
    context.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
  return saved.uri;
}

// Kleines Vorschaubild für Listen und die Arena (rund 10 KB statt 150 KB pro Anzeige)
export async function toThumbJpeg(photo: Photo): Promise<string> {
  const context = ImageManipulator.manipulate(photo.uri);
  const landscape = !photo.width || !photo.height || photo.width >= photo.height;
  context.resize(landscape ? { width: 256 } : { height: 256 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.6 });
  return saved.uri;
}

export async function uploadJpeg(uploadUrl: string, uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
  const { storageId } = (await response.json()) as { storageId: string };
  return storageId;
}
