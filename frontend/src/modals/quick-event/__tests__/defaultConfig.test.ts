import { DEFAULT_QUICK_EVENT_CONFIG } from '../defaultConfig';

describe('DEFAULT_QUICK_EVENT_CONFIG', () => {
  it('has a buttons array', () => {
    expect(DEFAULT_QUICK_EVENT_CONFIG).toHaveProperty('buttons');
    expect(Array.isArray(DEFAULT_QUICK_EVENT_CONFIG.buttons)).toBe(true);
  });

  it('has at least 7 buttons', () => {
    expect(DEFAULT_QUICK_EVENT_CONFIG.buttons.length).toBeGreaterThanOrEqual(7);
  });

  it('every button has eventTypeCode and label', () => {
    for (const btn of DEFAULT_QUICK_EVENT_CONFIG.buttons) {
      expect(typeof btn.eventTypeCode).toBe('string');
      expect(btn.eventTypeCode.length).toBeGreaterThan(0);
      expect(typeof btn.label).toBe('string');
      expect(btn.label.length).toBeGreaterThan(0);
    }
  });

  it('goal button exists and has radialItems', () => {
    const goal = DEFAULT_QUICK_EVENT_CONFIG.buttons.find((b) => b.eventTypeCode === 'goal');
    expect(goal).toBeDefined();
    expect(goal?.radialItems).toBeDefined();
    expect((goal?.radialItems ?? []).length).toBeGreaterThan(0);
  });

  it('substitution button exists and has radialItems', () => {
    const sub = DEFAULT_QUICK_EVENT_CONFIG.buttons.find((b) => b.eventTypeCode === 'substitution');
    expect(sub).toBeDefined();
    expect(sub?.radialItems).toBeDefined();
    expect((sub?.radialItems ?? []).length).toBeGreaterThan(0);
  });

  it('yellow_card button has radialItems', () => {
    const card = DEFAULT_QUICK_EVENT_CONFIG.buttons.find((b) => b.eventTypeCode === 'yellow_card');
    expect(card).toBeDefined();
    expect(card?.radialItems).toBeDefined();
    expect((card?.radialItems ?? []).length).toBeGreaterThan(0);
  });

  it('all radialItems have eventTypeCode and label', () => {
    for (const btn of DEFAULT_QUICK_EVENT_CONFIG.buttons) {
      for (const item of btn.radialItems ?? []) {
        expect(typeof item.eventTypeCode).toBe('string');
        expect(item.eventTypeCode.length).toBeGreaterThan(0);
        expect(typeof item.label).toBe('string');
        expect(item.label.length).toBeGreaterThan(0);
      }
    }
  });
});
