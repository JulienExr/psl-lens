export function cameraError(error: unknown): string {
  const name =
    typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
    return 'Permission caméra refusée. Autorisez la caméra dans votre navigateur ou importez une photo.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
    return 'Aucune caméra trouvée. Vous pouvez importer une photo.';
  if (name === 'NotReadableError' || name === 'TrackStartError')
    return 'Caméra occupée ou inaccessible. Fermez les autres applications qui l’utilisent.';
  if (name === 'OverconstrainedError')
    return 'Cette caméra n’est plus disponible. Essayez une autre caméra.';
  return error instanceof Error ? error.message : 'Impossible d’activer la caméra.';
}
export async function openCamera(deviceId?: string): Promise<MediaStream> {
  if (!window.isSecureContext)
    throw new Error('La caméra nécessite HTTPS ou localhost. L’analyse photo reste disponible.');
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error('Caméra non prise en charge par ce navigateur. Importez une photo.');
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }),
      width: { ideal: 960 },
      height: { ideal: 720 },
    },
  });
}
export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}
