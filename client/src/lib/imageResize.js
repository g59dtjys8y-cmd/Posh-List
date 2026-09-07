// Shrinks a photo before it goes over the WebSocket as a data URL — the
// server enforces a 1MB frame cap and a phone camera photo is routinely
// 3-5MB, so this has to happen before send, not after a rejection. A
// loyalty card only ever needs to be big enough to fill a phone screen for
// a self-checkout scanner to read, so downscaling hard here costs nothing
// real.
const MAX_DIMENSION = 1000;
const JPEG_QUALITY = 0.75;

export function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the photo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read the photo'));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
