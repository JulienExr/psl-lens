const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
export function validatePhoto(file: File) {
  if (!ALLOWED.includes(file.type))
    throw new Error('Format non pris en charge. Choisissez une image JPG, PNG ou WebP.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Image trop volumineuse (20 Mo maximum).');
  if (!file.size) throw new Error('Le fichier est vide.');
}
export async function decodePhoto(file: File): Promise<{ bitmap: ImageBitmap; preview: string }> {
  validatePhoto(file);
  const decoded = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    if (Math.min(decoded.width, decoded.height) < 256)
      throw new Error('Image trop petite : au moins 256 pixels de chaque côté.');
    if (decoded.width * decoded.height > 48_000_000)
      throw new Error('Image trop grande : 48 mégapixels maximum.');
    const scale = Math.min(1, 1600 / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(decoded.width * scale);
    canvas.height = Math.round(decoded.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D indisponible.');
    ctx.drawImage(decoded, 0, 0, canvas.width, canvas.height);
    return {
      bitmap: await createImageBitmap(canvas),
      preview: canvas.toDataURL('image/jpeg', 0.88),
    };
  } finally {
    decoded.close();
  }
}
