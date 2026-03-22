// Liefert ein DataURL des gecroppten Bildes als JPEG.
// imageSrc: string (URL oder DataURL), crop: { x, y, width, height }
// maxOutputWidth: Breite wird auf diesen Wert begrenzt (Standard 2048 px)
// jpegQuality: JPEG-Qualität 0–1 (Standard 0.88 – visuell verlustfrei, deutlich kleiner als PNG)
export default function getCroppedImg(
  imageSrc: string,
  crop: { x: number; y: number; width: number; height: number },
  maxOutputWidth = 2048,
  jpegQuality = 0.88,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      // Scale output to maxOutputWidth while keeping aspect ratio
      const scale =
        maxOutputWidth > 0 && crop.width > maxOutputWidth
          ? maxOutputWidth / crop.width
          : 1;
      const outW = Math.round(crop.width * scale);
      const outH = Math.round(crop.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No 2d context');
      ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, outW, outH);
      resolve(canvas.toDataURL('image/jpeg', jpegQuality));
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}
