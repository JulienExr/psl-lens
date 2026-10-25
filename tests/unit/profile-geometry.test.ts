import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProfileResult } from '../../src/components/ProfileResult';
import { analyzeProfile } from '../../src/morphometry/profile';
import { buildProfileGeometry } from '../../src/morphometry/profile/geometry';
import type { ProfileAnalysis, ProfilePoint, ProfilePointId } from '../../src/types/v2';

const raw: Record<ProfilePointId, [number, number]> = {
  nasion: [0.45, 0.2],
  pronasale: [0.68, 0.38],
  subnasale: [0.5, 0.45],
  upperLip: [0.55, 0.5],
  lowerLip: [0.55, 0.56],
  pogonion: [0.58, 0.65],
  menton: [0.45, 0.72],
  cervical: [0.28, 0.75],
};
function profile(
  transform = (x: number, y: number) => ({ x, y }),
  width = 1000,
  height = 1000,
): ProfileAnalysis {
  const points = Object.fromEntries(
    Object.entries(raw).map(([id, [x, y]]) => [
      id,
      { ...transform(x, y), confirmed: true, source: 'manual' },
    ]),
  ) as Record<ProfilePointId, ProfilePoint>;
  return analyzeProfile({
    points,
    width,
    height,
    strictProfileConfirmed: true,
    side: 'right',
    source: 'import',
  });
}
const length = (segment: { from: { x: number; y: number }; to: { x: number; y: number } }) =>
  Math.hypot(segment.to.x - segment.from.x, segment.to.y - segment.from.y);

describe('formula constructions for the assisted profile', () => {
  it.each([
    ['nose-projection', { x: 680, y: 450 }, 180 / 520],
    ['chin-projection', { x: 580, y: 450 }, 80 / 520],
  ] as const)(
    'shows the actual horizontal projection for %s rather than joining dependencies',
    (id, foot, value) => {
      const geometry = buildProfileGeometry(profile(), id)!;
      expect(geometry.value).toBeCloseTo(value, 12);
      const numerator = geometry.segments.find((segment) => segment.role === 'numerator')!;
      const denominator = geometry.segments.find((segment) => segment.role === 'denominator')!;
      expect(numerator.from).toEqual({ x: 500, y: 450 });
      expect(numerator.to).toEqual(foot);
      expect(denominator.from).toEqual({ x: 450, y: 200 });
      expect(denominator.to).toEqual({ x: 450, y: 720 });
      expect(length(numerator) / length(denominator)).toBeCloseTo(value, 12);
      const connector = geometry.segments.find((segment) => segment.role === 'projection')!;
      expect(connector.to).toEqual(foot);
      expect(connector.from.x).toBeCloseTo(connector.to.x);
    },
  );

  it.each(['upper-lip-offset', 'lower-lip-offset'])(
    'constructs an actual perpendicular foot on the E-line for %s',
    (id) => {
      const analysis = profile();
      const geometry = buildProfileGeometry(analysis, id)!;
      const line = geometry.segments.find((segment) => segment.role === 'reference')!;
      const perpendicular = geometry.segments.find((segment) => segment.role === 'numerator')!;
      const denominator = geometry.segments.find((segment) => segment.role === 'denominator')!;
      const dx = line.to.x - line.from.x,
        dy = line.to.y - line.from.y;
      const foot = geometry.points.find((point) => point.role === 'projection')!.point;
      expect((foot.x - line.from.x) * dy - (foot.y - line.from.y) * dx).toBeCloseTo(0, 7);
      expect(
        (perpendicular.to.x - perpendicular.from.x) * dx +
          (perpendicular.to.y - perpendicular.from.y) * dy,
      ).toBeCloseTo(0, 7);
      expect(length(perpendicular) / length(denominator)).toBeCloseTo(
        Math.abs(analysis.measurements.find((measurement) => measurement.id === id)!.value!),
        12,
      );
      expect(geometry.value).toBeLessThan(0);
    },
  );

  it.each(['profile-angle', 'chin-neck-angle'])(
    'shows rays and the correct minor arc for %s',
    (id) => {
      const analysis = profile();
      const geometry = buildProfileGeometry(analysis, id)!;
      const arc = geometry.arcs[0];
      const rays = geometry.segments.filter((segment) => segment.role === 'ray');
      expect(rays).toHaveLength(2);
      expect(rays.every((ray) => ray.from.x === arc.center.x && ray.from.y === arc.center.y)).toBe(
        true,
      );
      expect((Math.abs(arc.endAngle - arc.startAngle) * 180) / Math.PI).toBeCloseTo(
        analysis.measurements.find((measurement) => measurement.id === id)!.value!,
        12,
      );
      for (const [ray, angle] of [
        [rays[0], arc.startAngle],
        [rays[1], arc.endAngle],
      ] as const) {
        expect((ray.to.x - ray.from.x) / length(ray)).toBeCloseTo(Math.cos(angle), 12);
        expect((ray.to.y - ray.from.y) / length(ray)).toBeCloseTo(Math.sin(angle), 12);
      }
    },
  );

  it('shows Sn–Me over N–Me for the lower share', () => {
    const geometry = buildProfileGeometry(profile(), 'lower-profile-share')!;
    const numerator = geometry.segments.find((segment) => segment.role === 'numerator')!;
    const denominator = geometry.segments.find((segment) => segment.role === 'denominator')!;
    expect(numerator.from).toEqual({ x: 500, y: 450 });
    expect(numerator.to).toEqual({ x: 450, y: 720 });
    expect(geometry.value).toBeCloseTo(Math.hypot(50, 270) / 520, 12);
    expect(length(numerator) / length(denominator)).toBeCloseTo(geometry.value, 12);
  });

  it('keeps signed backward projections and does not substitute their absolute distance', () => {
    const analysis = profile();
    analysis.points.pogonion!.x = 0.46;
    const geometry = buildProfileGeometry(analysis, 'chin-projection')!;
    expect(geometry.value).toBeCloseTo(-40 / 520, 12);
    const numerator = geometry.segments.find((segment) => segment.role === 'numerator')!;
    expect(numerator.to.x).toBeLessThan(numerator.from.x);
  });

  it('matches every engine value under rotations, mirroring, resolution and image aspect changes', () => {
    const base = profile();
    const transforms = [
      profile(),
      profile((x, y) => ({ x: 1 - x, y })),
      profile((x, y) => ({ x: x / 2, y }), 2000, 1000),
      profile((x, y) => ({
        x: 0.5 + (x - 0.5) * Math.cos(0.25) - (y - 0.5) * Math.sin(0.25),
        y: 0.5 + (x - 0.5) * Math.sin(0.25) + (y - 0.5) * Math.cos(0.25),
      })),
      profile((x, y) => ({ x, y }), 2000, 2000),
    ];
    for (const analysis of transforms)
      for (const metric of analysis.measurements) {
        const geometry = buildProfileGeometry(analysis, metric.id)!;
        expect(geometry.value).toBeCloseTo(metric.value!, 10);
        expect(geometry.value).toBeCloseTo(
          base.measurements.find((measurement) => measurement.id === metric.id)!.value!,
          10,
        );
        expect(geometry.formula).toEqual(metric.formula);
      }
  });

  it('rejects missing, unconfirmed, outside-image and degenerate geometry even on stale reports', () => {
    for (const mutate of [
      (p: ProfileAnalysis) => {
        p.width = 0;
      },
      (p: ProfileAnalysis) => {
        p.height = Infinity;
      },
      (p: ProfileAnalysis) => {
        delete p.points.nasion;
      },
      (p: ProfileAnalysis) => {
        p.points.nasion!.confirmed = false;
      },
      (p: ProfileAnalysis) => {
        p.points.nasion!.x = NaN;
      },
      (p: ProfileAnalysis) => {
        p.points.nasion!.x = 1.1;
      },
      (p: ProfileAnalysis) => {
        p.points.menton = { ...p.points.nasion! };
      },
      (p: ProfileAnalysis) => {
        p.orientation.strictProfileConfirmed = false;
      },
      (p: ProfileAnalysis) => {
        p.quality.valid = false;
      },
    ]) {
      const analysis = profile();
      mutate(analysis);
      expect(buildProfileGeometry(analysis, 'nose-projection')).toBeNull();
    }
  });

  it('does not draw an unavailable optional measure or unknown formula', () => {
    const analysis = profile();
    delete analysis.points.cervical;
    expect(buildProfileGeometry(analysis, 'chin-neck-angle')).toBeNull();
    expect(buildProfileGeometry(analysis, 'unknown')).toBeNull();
    analysis.measurements[0].value = null;
    expect(buildProfileGeometry(analysis, 'nose-projection')).toBeNull();
    expect(buildProfileGeometry(analysis, 'profile-angle')).not.toBeNull();
  });

  it('leaves the analysis and confirmed points untouched', () => {
    const analysis = profile();
    const before = JSON.stringify(analysis);
    buildProfileGeometry(analysis, 'lower-lip-offset');
    expect(JSON.stringify(analysis)).toEqual(before);
  });

  it('fits the diagram around real points and restores full framing only when the photo is shown', () => {
    const analysis = profile();
    analysis.preview = 'data:image/png;base64,dGVzdA==';
    render(createElement(ProfileResult, { profile: analysis }));
    const diagram = screen.getByRole('img', {
      name: 'Construction géométrique du profil confirmé',
    });
    expect(diagram.getAttribute('viewBox')).not.toBe('0 0 1000 1000');
    const numerator = diagram.querySelector('[data-role="numerator"]')!;
    expect(numerator.getAttribute('x1')).toBe('500');
    expect(numerator.getAttribute('y1')).toBe('450');
    expect(numerator.getAttribute('x2')).toBe('680');
    expect(numerator.getAttribute('y2')).toBe('450');
    expect(diagram.querySelector('polyline')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Afficher cette photo de profil' }));
    expect(diagram.getAttribute('viewBox')).toBe('0 0 1000 1000');
    expect(diagram.querySelector('image')?.getAttribute('href')).toBe(analysis.preview);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Afficher cette photo de profil' }));
    expect(diagram.querySelector('image')).toBeNull();
    expect(diagram.getAttribute('viewBox')).not.toBe('0 0 1000 1000');
  });

  it('anchors long labels on the left of points near the right image edge', () => {
    const analysis = profile((x, y) => ({ x: x + 0.3, y }));
    render(createElement(ProfileResult, { profile: analysis }));
    expect(screen.getByText('Pointe du nez', { selector: 'text' })).toHaveAttribute(
      'text-anchor',
      'end',
    );
  });
});
