import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RecommendationsPanel } from '../../src/components/RecommendationsPanel';
import { DEFAULT_PREFERENCES } from '../../src/recommendations/v2';
import type { StylePreferences } from '../../src/types/v2';

describe('controlled recommendations panel', () => {
  it('keeps presentation optional and does not invent a capture issue when there is no analysis', () => {
    render(
      <RecommendationsPanel
        frontal={null}
        profiles={[]}
        preferences={DEFAULT_PREFERENCES}
        onPreferencesChange={() => {}}
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Coiffure' })).not.toBeChecked();
    expect(screen.getByText(/Aucune difficulté de capture identifiée/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Explorer une coiffure' }),
    ).not.toBeInTheDocument();
  });

  it('reflects controlled prop updates and preserves other preference fields', () => {
    function Harness() {
      const [preferences, setPreferences] = useState<StylePreferences>({
        ...DEFAULT_PREFERENCES,
        style: 'creative',
        beard: 'without',
        topics: ['photo'],
      });
      return (
        <RecommendationsPanel
          frontal={null}
          profiles={[]}
          preferences={preferences}
          onPreferencesChange={setPreferences}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Coiffure' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Longueur de cheveux souhaitée' }), {
      target: { value: 'long' },
    });
    expect(screen.getByRole('heading', { name: 'Explorer une coiffure' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Style souhaité' })).toHaveValue('creative');
    expect(screen.getByRole('combobox', { name: 'Préférence de barbe' })).toHaveValue('without');
    expect(screen.getByRole('checkbox', { name: 'Photo' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Coiffure' }));
    expect(
      screen.queryByRole('heading', { name: 'Explorer une coiffure' }),
    ).not.toBeInTheDocument();
  });

  it('does not keep private preference state when its parent declines an update', () => {
    render(
      <RecommendationsPanel
        frontal={null}
        profiles={[]}
        preferences={DEFAULT_PREFERENCES}
        onPreferencesChange={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Coiffure' }));
    expect(screen.getByRole('checkbox', { name: 'Coiffure' })).not.toBeChecked();
  });

  it('shows objective, declared evidence, rationale and limits of opted-in suggestions', () => {
    render(
      <RecommendationsPanel
        frontal={null}
        profiles={[]}
        preferences={{ ...DEFAULT_PREFERENCES, topics: ['beard'], beard: 'with' }}
        onPreferencesChange={() => {}}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Explorer une présentation avec ou sans barbe' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Objectif')).toBeInTheDocument();
    expect(screen.getByText('Éléments utilisés')).toBeInTheDocument();
    expect(screen.getByText('Pourquoi essayer')).toBeInTheDocument();
    expect(screen.getByText('Limites')).toBeInTheDocument();
  });
});
