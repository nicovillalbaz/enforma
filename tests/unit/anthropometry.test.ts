import { describe, expect, it } from 'vitest';
import {
  anthropometrySites,
  calculateAnthropometry,
  isakRestrictedSites,
  validAnthropometryInput,
  type AnthropometryInput,
} from '@forma/shared';

const base: AnthropometryInput = {
  protocol: 'isak-restricted',
  assessedOn: '2026-10-20',
  instrument: 'Calibre ficticio',
  notes: '',
  equationPopulation: 'male',
  ageYears: 25,
  externalBodyFatPercent: null,
  externalDevice: '',
  externalAlgorithm: '',
  observations: ['biceps', 'triceps', 'subscapular', 'iliac_crest'].map((site) => ({
    site,
    label: site,
    unit: 'mm' as const,
    readings: [10, 10],
  })),
};

describe('anthropometry calculation and scope', () => {
  it('calculates the published four-site age-band equation and Siri conversion', () => {
    expect(validAnthropometryInput(base)).toBe(true);
    const result = calculateAnthropometry(base);
    expect(result.sum4Mm).toBe(40);
    expect(result.sum8Mm).toBeNull();
    expect(result.estimate?.bodyDensity).toBeCloseTo(1.06185, 5);
    expect(result.estimate?.bodyFatPercent).toBe(16.2);
    expect(result.protocolComplete).toBe(false);
  });
  it('withholds the estimate for missing, discordant or out-of-range evidence', () => {
    expect(
      calculateAnthropometry({ ...base, observations: base.observations.slice(1) }).estimate,
    ).toBeNull();
    expect(
      calculateAnthropometry({
        ...base,
        observations: base.observations.map((o, i) =>
          i === 0 ? { ...o, readings: [10, 30, 50] } : o,
        ),
      }).estimate,
    ).toBeNull();
    expect(calculateAnthropometry({ ...base, ageYears: 16 }).estimate).toBeNull();
    expect(
      calculateAnthropometry({ ...base, equationPopulation: 'female', ageYears: 69 }).estimate,
    ).toBeNull();
  });
  it('keeps device estimates separate and rejects falsified units', () => {
    const bia: AnthropometryInput = {
      ...base,
      protocol: 'bia',
      observations: [],
      externalBodyFatPercent: 24.3,
      externalDevice: 'Equipo ficticio',
      equationPopulation: null,
      ageYears: null,
    };
    expect(calculateAnthropometry(bia).estimate?.method).toBe('external-bia');
    expect(calculateAnthropometry(bia).sum4Mm).toBeNull();
    expect(
      validAnthropometryInput({ ...base, observations: [{ ...base.observations[0], unit: 'cm' }] }),
    ).toBe(false);
  });
  it('marks a profile complete only with all named sites and consistent repeats', () => {
    const full: AnthropometryInput = {
      ...base,
      observations: isakRestrictedSites.map((site) => ({
        site,
        label: anthropometrySites[site].label,
        unit: anthropometrySites[site].unit,
        readings: [10, 10],
      })),
    };
    expect(isakRestrictedSites).toHaveLength(21);
    expect(validAnthropometryInput(full)).toBe(true);
    expect(calculateAnthropometry(full).protocolComplete).toBe(true);
    expect(calculateAnthropometry(full).sum8Mm).toBe(80);
  });
});
