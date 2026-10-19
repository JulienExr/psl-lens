export interface Landmark {
  x: number;
  y: number;
  z: number;
}
export interface FacePose {
  yaw: number;
  pitch: number;
  roll: number;
  source: 'matrix' | 'unavailable';
}
export interface FaceDetectionResult {
  faces: Landmark[][];
  pose: FacePose;
  blendshapes: Record<string, number>;
  matrix: number[];
  width: number;
  height: number;
  timestamp: number;
  inferenceMs: number;
  pixels?: PixelQuality | null;
}
export interface PixelQuality {
  brightness: number;
  sharpness: number;
}
export interface CaptureQuality {
  valid: boolean;
  frontal: boolean;
  issues: string[];
  brightness: number | null;
  sharpness: number | null;
  faceSize: number;
  stability: number | null;
  label: 'ready' | 'adjust' | 'no-face';
}
export type MeasurementConfidence = 'moderate' | 'low' | 'unavailable';
export type Region = 'all' | 'face' | 'eyes' | 'brows' | 'nose' | 'mouth' | 'jaw';
export interface Measurement {
  id: string;
  name: string;
  region: Region;
  description: string;
  landmarks: number[];
  formula: string;
  unit: 'ratio' | '°';
  value: number | null;
  confidence: MeasurementConfidence;
  limitation: string;
  reason?: string;
  spread?: number;
  samples?: number;
}
export interface ScanObservation {
  detection: FaceDetectionResult;
  quality: CaptureQuality;
  measurements: Measurement[];
  stage: 'front' | 'left' | 'right';
}
export interface ScoreCategory {
  id: string;
  name: string;
  weight: number;
  score: number | null;
  contribution: number | null;
  reason?: string;
  inputs: { id: string; value: number; target: number; tolerance: number; score: number }[];
}
export interface PSLResult {
  version: string;
  score: number | null;
  categories: ScoreCategory[];
  missing: string[];
  disclaimer: string;
}
export interface AggregatedAnalysis {
  id: string;
  createdAt: string;
  source: 'photo' | 'live' | 'guided';
  measurements: Measurement[];
  score: PSLResult;
  observationCount: number;
  morphometryCount: number;
  rejectedCount: number;
  quality: CaptureQuality;
  representative: FaceDetectionResult;
  preview?: string;
  profileProvided?: boolean;
}
