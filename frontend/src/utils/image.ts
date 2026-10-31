/**
 * Reduce la imagen antes de enviarla: menos datos por la red móvil y tiempos
 * de respuesta más cortos. El análisis sigue haciéndose en el backend.
 */
export async function prepareImage(source: Blob, maxSide = 1600, quality = 0.9): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
  } catch {
    return source; // formato que el navegador no decodifica: se envía tal cual
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && source.type === 'image/jpeg') {
    bitmap.close();
    return source;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? source), 'image/jpeg', quality));
}
