import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { captureWebcam, webcamSupported } from '@/lib/webcam';

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
  if (source === 'camera' && Platform.OS === 'web' && webcamSupported()) {
    const webcam = await captureWebcam(async () => toPhoto(await ImagePicker.launchImageLibraryAsync(options)));
    if (webcam !== 'unavailable') return webcam.photo;
  }
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera' && Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    result = permission.granted
      ? await ImagePicker.launchCameraAsync(options).catch(() => ImagePicker.launchImageLibraryAsync(options))
      : await ImagePicker.launchImageLibraryAsync(options);
  } else if (source === 'camera') {
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  return toPhoto(result);
}

function toPhoto(result: ImagePicker.ImagePickerResult): Photo | null {
  const asset = result.canceled ? null : result.assets[0];
  return asset ? { uri: asset.uri, width: asset.width, height: asset.height } : null;
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
