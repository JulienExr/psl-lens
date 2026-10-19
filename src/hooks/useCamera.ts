import { useCallback, useEffect, useRef, useState } from 'react';
import type { CaptureQuality, FaceDetectionResult, ScanObservation } from '../types';
import { openCamera, stopStream, cameraError } from '../vision/camera';
import { visionClient } from '../vision/client';
import { assessQuality } from '../vision/quality';
import { measure } from '../morphometry/metrics';

export function useCamera(onObservation?: (observation: ScanObservation) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const frame = useRef(0);
  const pausedRef = useRef(false);
  const observerRef = useRef(onObservation);
  useEffect(() => {
    observerRef.current = onObservation;
  }, [onObservation]);
  const [status, setStatus] = useState<'off' | 'starting' | 'loading' | 'active'>('off');
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [detection, setDetection] = useState<FaceDetectionResult | null>(null);
  const [quality, setQuality] = useState<CaptureQuality | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const stop = useCallback(() => {
    generation.current++;
    cancelAnimationFrame(frame.current);
    stopStream(stream.current);
    stream.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('off');
    setDetection(null);
    setQuality(null);
    setPaused(false);
    pausedRef.current = false;
  }, []);
  const start = useCallback(
    async (selectedDevice?: string) => {
      stop();
      const token = generation.current;
      setError('');
      setStatus('starting');
      let acquired: MediaStream | null = null;
      try {
        acquired = await openCamera(selectedDevice);
        if (token !== generation.current) {
          stopStream(acquired);
          return;
        }
        stream.current = acquired;
        const video = videoRef.current;
        if (!video) {
          stopStream(acquired);
          return;
        }
        video.srcObject = acquired;
        await video.play();
        if (token !== generation.current) return;
        setStatus('loading');
        const cameras = await navigator.mediaDevices.enumerateDevices();
        if (token !== generation.current) return;
        setDevices(cameras.filter((d) => d.kind === 'videoinput'));
        setDeviceId(acquired.getVideoTracks()[0]?.getSettings().deviceId ?? selectedDevice ?? '');
        acquired.getVideoTracks()[0]?.addEventListener('ended', () => {
          if (token === generation.current) {
            stop();
            setError('Le flux caméra a été interrompu. Réactivez la caméra.');
          }
        });
        await visionClient.init();
        if (token !== generation.current) return;
        setStatus('active');
        let lastVideoTime = -1;
        let lastInference = -Infinity;
        let previous: FaceDetectionResult | undefined;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const loop = async () => {
          if (token !== generation.current) return;
          const interval = Math.max(
            visionClient.modeLabel.startsWith('CPU') ? 180 : 100,
            (previous?.inferenceMs ?? 0) * 1.5,
          );
          if (
            !pausedRef.current &&
            ctx &&
            video.readyState >= 2 &&
            video.currentTime !== lastVideoTime &&
            performance.now() - lastInference >= interval
          ) {
            lastVideoTime = video.currentTime;
            lastInference = performance.now();
            const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            try {
              const bitmap = await createImageBitmap(canvas);
              if (token !== generation.current) {
                bitmap.close();
                return;
              }
              const result = await visionClient.detect(bitmap, 'VIDEO', performance.now());
              if (token !== generation.current) return;
              if (!pausedRef.current) {
                const q = assessQuality(result, result.pixels ?? null, previous);
                previous = result;
                setDetection(result);
                setQuality(q);
                observerRef.current?.({
                  detection: result,
                  quality: q,
                  measurements: measure(result, q),
                  stage: 'front',
                });
              }
            } catch (e) {
              if (token === generation.current) {
                stop();
                setError(cameraError(e));
              }
              return;
            }
          }
          if (token === generation.current)
            frame.current = requestAnimationFrame(() => {
              void loop();
            });
        };
        void loop();
      } catch (e) {
        stopStream(acquired);
        if (token === generation.current) {
          stop();
          setError(cameraError(e));
        }
      }
    },
    [stop],
  );
  const togglePause = useCallback(() => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  }, []);
  useEffect(() => {
    const shutdown = () => stop();
    const visibility = () => {
      if (document.visibilityState === 'hidden') stop();
    };
    window.addEventListener('pagehide', shutdown);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      shutdown();
      window.removeEventListener('pagehide', shutdown);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [stop]);
  return {
    videoRef,
    start,
    stop,
    status,
    error,
    paused,
    togglePause,
    detection,
    quality,
    devices,
    deviceId,
  };
}
