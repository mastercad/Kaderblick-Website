import { CODE_STYLE, DEFAULT_CODE_STYLE, getCodeStyle } from '../codeStyle';
import SportsSoccerIcon from '@mui/icons-material/SportsSoccer';
import type { CodeStyleEntry } from '../codeStyle';

describe('codeStyle', () => {
  it('CODE_STYLE contains expected event type codes', () => {
    expect(CODE_STYLE).toHaveProperty('goal');
    expect(CODE_STYLE).toHaveProperty('yellow_card');
    expect(CODE_STYLE).toHaveProperty('substitution');
    expect(CODE_STYLE).toHaveProperty('foul');
    expect(CODE_STYLE).toHaveProperty('own_goal');
  });

  it('each entry has color and Icon', () => {
    Object.entries(CODE_STYLE).forEach(([_code, entry]: [string, CodeStyleEntry]) => {
      expect(typeof entry.color).toBe('string');
      expect(entry.color).toMatch(/^#/);
      expect(entry.Icon).toBeDefined();
    });
  });

  it('getCodeStyle returns the correct entry for a known code', () => {
    const result = getCodeStyle('goal');
    expect(result.color).toBe('#4ade80');
    expect(result.Icon).toBeDefined();
  });

  it('getCodeStyle returns DEFAULT_CODE_STYLE for an unknown code', () => {
    const result = getCodeStyle('unknown_event_xyz');
    expect(result).toEqual(DEFAULT_CODE_STYLE);
  });

  it('DEFAULT_CODE_STYLE has a fallback color and Icon', () => {
    expect(DEFAULT_CODE_STYLE.color).toBe('#94a3b8');
    expect(DEFAULT_CODE_STYLE.Icon).toBe(SportsSoccerIcon);
  });

  it('own_goal is red, not green', () => {
    expect(getCodeStyle('own_goal').color).toBe('#f87171');
    expect(getCodeStyle('goal').color).toBe('#4ade80');
  });

  it('yellow_card has a yellow color', () => {
    expect(getCodeStyle('yellow_card').color).toBe('#fbbf24');
  });

  it('red_card has a red color', () => {
    expect(getCodeStyle('red_card').color).toBe('#f87171');
  });
});
