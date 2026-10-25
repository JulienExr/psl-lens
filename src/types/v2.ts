import type { AggregatedAnalysis, FacePose, FrontalPSLResult } from './index';

export type ProfilePointId =
  | 'nasion'
  | 'pronasale'
  | 'subnasale'
  | 'upperLip'
  | 'lowerLip'
  | 'pogonion'
  | 'menton'
  | 'cervical';
export interface ProfilePoint {
  x: number;
  y: number;
  source: 'manual' | 'automatic-proposal';
  confirmed: boolean;
}
export interface ProfileMeasurement {
  id: string;
  name: string;
  value: number | null;
  unit: 'ratio' | '°';
  formula: string;
  landmarks: ProfilePointId[];
  method: 'assisted';
  version: string;
  quality: 'limited' | 'unavailable';
  reason?: string;
  samples: number;
  spread?: number;
  uncertainties: string[];
}
export interface ProfileAnalysis {
  id: string;
  createdAt: string;
  side: 'left' | 'right' | 'unknown';
  facing: 'image-left' | 'image-right' | 'undetermined';
  width: number;
  height: number;
  preview?: string;
  points: Partial<Record<ProfilePointId, ProfilePoint>>;
  measurements: ProfileMeasurement[];
  quality: { valid: boolean; warnings: string[]; completeness: number };
  method: 'assisted';
  algorithm: 'profile-2d-2.0.0';
  source: 'import' | 'live-capture';
  orientation: { method: 'user-declared'; strictProfileConfirmed: boolean };
}
export type ViewKind =
  | 'front'
  | 'oblique-left'
  | 'oblique-right'
  | 'non-frontal'
  | 'orientation-unknown'
  | 'mixed-orientations'
  | 'profile-left'
  | 'profile-right'
  | 'profile-unknown';
export interface ViewSummary {
  id: string;
  view: ViewKind;
  method: 'automatic' | 'assisted';
  source: string;
  observationCount: number;
  validatedFrontal?: boolean;
  pose?: FacePose;
  quality: string;
  warnings: string[];
  algorithm: string;
}
export interface MeasurementProvenance {
  view: ViewKind;
  method: 'automatic' | 'assisted';
  algorithm: string;
  source: string;
  observations: number;
  observedViews?: ViewKind[];
  validatedFrontal?: boolean;
  orientation?: FacePose;
}
export interface StylePreferences {
  hairLength: 'unspecified' | 'short' | 'medium' | 'long';
  beard: 'unspecified' | 'with' | 'without';
  style: 'unspecified' | 'classic' | 'modern' | 'creative';
  topics: ('hair' | 'beard' | 'photo')[];
}
export interface Recommendation {
  id: string;
  kind: 'capture' | 'presentation';
  title: string;
  objective: string;
  evidence: string[];
  rationale: string;
  limits: string;
}
export interface MultiViewScore extends FrontalPSLResult {
  profileSourceId?: string;
}
export interface ViewAssociation {
  frontalId: string;
  profileIds: string[];
  confirmedAt: string;
}
export interface ReportData {
  association?: ViewAssociation | null;
  frontal: AggregatedAnalysis | null;
  profiles: ProfileAnalysis[];
  multiview: MultiViewScore;
  recommendations: Recommendation[];
  views: ViewSummary[];
}
export interface PDFOptions {
  includePhotos: boolean;
  includeScores: boolean;
  includeTechnical: boolean;
}
