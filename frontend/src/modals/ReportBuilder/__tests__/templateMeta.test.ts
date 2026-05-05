/**
 * Tests für templateMeta.ts
 *
 * Geprüft werden:
 *  – goals_per_month enthält metrics: ['goals'] (fix für Y-Achse-Anzeige-Bug)
 *  – goals_per_month hat yField: 'goals' und diagramType: 'line'
 *  – andere Templates (bar-Typen) haben kein metrics-Array (nutzen effectiveMetricKeys-Fallback)
 *  – alle Templates haben die Pflichtfelder xField, yField und diagramType
 *  – jedes Template hat einen nicht-leeren title und emoji
 */

import { TEMPLATE_META } from '../templateMeta';

describe('TEMPLATE_META – goals_per_month (Saisonverlauf)', () => {
  const tmpl = TEMPLATE_META['goals_per_month'];

  it('ist im TEMPLATE_META-Objekt vorhanden', () => {
    expect(tmpl).toBeDefined();
  });

  it('enthält metrics: [\'goals\'] für korrekte Y-Achse-Anzeige im Autocomplete', () => {
    // Ohne metrics würde effectiveMetricKeys auf yField zurückfallen,
    // aber explizites metrics-Array stellt sicher, dass der Chip immer korrekt angezeigt wird.
    expect(tmpl.config.metrics).toEqual(['goals']);
  });

  it('hat yField: \'goals\'', () => {
    expect(tmpl.config.yField).toBe('goals');
  });

  it('hat diagramType: \'line\'', () => {
    expect(tmpl.config.diagramType).toBe('line');
  });

  it('hat xField: \'month\'', () => {
    expect(tmpl.config.xField).toBe('month');
  });

  it('hat einen nicht-leeren title', () => {
    expect(tmpl.title).toBeTruthy();
  });

  it('hat ein emoji', () => {
    expect(tmpl.emoji).toBeTruthy();
  });
});

describe('TEMPLATE_META – andere Templates: kein metrics-Array erforderlich', () => {
  it('goals_per_player hat kein metrics-Feld (nutzt effectiveMetricKeys-Fallback via yField)', () => {
    // Nur goals_per_month (line chart) braucht explizites metrics-Array für das Autocomplete.
    // Einfache bar-Charts nutzen den yField-Fallback in effectiveMetricKeys.
    const tmpl = TEMPLATE_META['goals_per_player'];
    // metrics ist undefined oder nicht gesetzt — das ist korrekt (Fallback greift)
    expect(tmpl.config.metrics === undefined || !tmpl.config.metrics?.length).toBe(true);
  });

  it('player_radar hat metrics gesetzt (multi-axis Radar braucht mehrere Metriken)', () => {
    const tmpl = TEMPLATE_META['player_radar'];
    expect(tmpl.config.metrics).toBeDefined();
    expect((tmpl.config.metrics ?? []).length).toBeGreaterThan(1);
  });
});

describe('TEMPLATE_META – Struktur-Invarianten aller Templates', () => {
  const allKeys = Object.keys(TEMPLATE_META);

  it('enthält mindestens 5 Templates', () => {
    expect(allKeys.length).toBeGreaterThanOrEqual(5);
  });

  allKeys.forEach((key) => {
    describe(`Template "${key}"`, () => {
      const tmpl = TEMPLATE_META[key];

      it('hat einen nicht-leeren title', () => {
        expect(typeof tmpl.title).toBe('string');
        expect(tmpl.title.length).toBeGreaterThan(0);
      });

      it('hat einen nicht-leeren emoji', () => {
        expect(typeof tmpl.emoji).toBe('string');
        expect(tmpl.emoji.length).toBeGreaterThan(0);
      });

      it('hat einen nicht-leeren diagramType in config', () => {
        expect(typeof tmpl.config.diagramType).toBe('string');
        expect((tmpl.config.diagramType ?? '').length).toBeGreaterThan(0);
      });

      it('hat ein xField in config', () => {
        expect(typeof tmpl.config.xField).toBe('string');
        expect((tmpl.config.xField ?? '').length).toBeGreaterThan(0);
      });

      it('hat ein yField in config', () => {
        expect(typeof tmpl.config.yField).toBe('string');
        expect((tmpl.config.yField ?? '').length).toBeGreaterThan(0);
      });

      it('metrics-Array enthält keine Duplikate (wenn vorhanden)', () => {
        if (!tmpl.config.metrics) return;
        const unique = new Set(tmpl.config.metrics);
        expect(unique.size).toBe(tmpl.config.metrics.length);
      });

      it('metrics-Array ist nicht leer wenn vorhanden', () => {
        if (tmpl.config.metrics === undefined) return;
        expect(tmpl.config.metrics.length).toBeGreaterThan(0);
      });
    });
  });
});
