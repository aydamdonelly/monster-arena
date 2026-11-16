import type { Photo } from '@/lib/photo';

export type WebcamResult = { photo: Photo | null } | 'unavailable';

export function webcamSupported() {
  return false;
}

export async function captureWebcam(_chooseFile: () => Promise<Photo | null>): Promise<WebcamResult> {
  return 'unavailable';
}
