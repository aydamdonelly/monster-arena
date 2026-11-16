import { Fonts, Palette } from '@/lib/theme';
import type { Photo } from '@/lib/photo';

export type WebcamResult = { photo: Photo | null } | 'unavailable';

export function webcamSupported() {
  return !window.matchMedia('(pointer: coarse)').matches && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg(size: number, viewBox: string, shapes: [string, Record<string, string>][]) {
  const root = document.createElementNS(SVG_NS, 'svg');
  root.setAttribute('width', String(size));
  root.setAttribute('height', String(size));
  root.setAttribute('viewBox', viewBox);
  for (const [tag, attrs] of shapes) {
    const shape = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) shape.setAttribute(key, value);
    root.appendChild(shape);
  }
  return root;
}

export function captureWebcam(chooseFile: () => Promise<Photo | null>): Promise<WebcamResult> {
  return new Promise((resolve) => {
    let stream: MediaStream | null = null;
    let done = false;

    const style = document.createElement('style');
    style.textContent = `
      .snappy-webcam-shutter:active .snappy-webcam-face { transform: translate(5px, 5px); }
      .snappy-webcam-shutter:focus-visible .snappy-webcam-face { outline: 3px solid ${Palette.ground}; outline-offset: 3px; }
      .snappy-webcam-link:hover { text-decoration-thickness: 3px; }
    `;

    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Webcam');
    Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '2147483647', background: Palette.ink, overflow: 'hidden' });

    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    Object.assign(video.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' });

    const close = document.createElement('button');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close camera');
    Object.assign(close.style, {
      position: 'absolute', top: '24px', right: '24px', width: '52px', height: '52px', borderRadius: '50%',
      background: Palette.ground, border: `2px solid ${Palette.ink}`, boxShadow: `4px 4px 0 ${Palette.ink}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: '0',
    });
    close.appendChild(
      svg(22, '0 0 24 24', [['path', { d: 'M5 5l14 14M19 5L5 19', stroke: Palette.ink, 'stroke-width': '3', 'stroke-linecap': 'round' }]]),
    );

    const controls = document.createElement('div');
    Object.assign(controls.style, {
      position: 'absolute', left: '0', right: '0', bottom: '40px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
    });

    const size = 96;
    const shutter = document.createElement('button');
    shutter.type = 'button';
    shutter.className = 'snappy-webcam-shutter';
    shutter.setAttribute('aria-label', 'Take a photo');
    Object.assign(shutter.style, {
      position: 'relative', width: `${size + 10}px`, height: `${size + 10}px`, padding: '0', border: 'none', background: 'transparent', cursor: 'pointer',
    });
    const shadow = document.createElement('div');
    Object.assign(shadow.style, {
      position: 'absolute', left: '10px', top: '10px', width: `${size}px`, height: `${size}px`, borderRadius: '50%', background: Palette.ink,
    });
    const face = document.createElement('div');
    face.className = 'snappy-webcam-face';
    Object.assign(face.style, {
      position: 'absolute', left: '0', top: '0', width: `${size}px`, height: `${size}px`, borderRadius: '50%', boxSizing: 'border-box',
      background: Palette.primary, border: `2px solid ${Palette.ink}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
    });
    face.appendChild(
      svg(Math.round(size * 0.44), '0 0 76 76', [
        ['path', { d: 'M10 26a6 6 0 0 1 6-6h8l4-7h20l4 7h8a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6z', fill: 'none', stroke: Palette.ink, 'stroke-width': '5', 'stroke-linejoin': 'round' }],
        ['circle', { cx: '38', cy: '40', r: '11', fill: 'none', stroke: Palette.ink, 'stroke-width': '5' }],
      ]),
    );
    shutter.append(shadow, face);

    const link = document.createElement('button');
    link.type = 'button';
    link.className = 'snappy-webcam-link';
    link.textContent = 'Choose a file instead';
    Object.assign(link.style, {
      background: 'transparent', border: 'none', padding: '4px 8px', cursor: 'pointer', color: Palette.ground,
      fontFamily: `${Fonts.bold}, system-ui, sans-serif`, fontSize: '16px', textDecoration: 'underline', textUnderlineOffset: '4px',
      textShadow: `0 1px 3px ${Palette.ink}`,
    });

    controls.append(shutter, link);
    overlay.append(style, video, close, controls);

    const cleanup = () => {
      done = true;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      video.srcObject = null;
      window.removeEventListener('keydown', onKey, true);
      overlay.remove();
    };
    const finish = (result: WebcamResult) => {
      if (done) return;
      cleanup();
      resolve(result);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      finish({ photo: null });
    };

    close.addEventListener('click', () => finish({ photo: null }));
    link.addEventListener('click', () => {
      if (done) return;
      cleanup();
      chooseFile().then(
        (photo) => resolve({ photo }),
        () => resolve({ photo: null }),
      );
    });
    shutter.addEventListener('click', () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (done || !stream || !width || !height) return;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(video, 0, 0, width, height);
      cleanup();
      canvas.toBlob(
        (blob) => resolve({ photo: blob ? { uri: URL.createObjectURL(blob), width, height } : null }),
        'image/jpeg',
        0.9,
      );
    });
    window.addEventListener('keydown', onKey, true);
    document.body.appendChild(overlay);
    shutter.focus();

    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }).then(
      (media) => {
        if (done) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        video.srcObject = media;
        video.play().catch(() => {});
      },
      () => finish('unavailable'),
    );
  });
}
