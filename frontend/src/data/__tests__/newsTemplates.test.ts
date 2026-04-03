import { NEWS_TEMPLATES, NewsTemplate } from '../newsTemplates';

// ──────────────────────────────────────────────────────────────────────────────
// Hilfsfunktionen
// ──────────────────────────────────────────────────────────────────────────────

/** Gibt alle Template-IDs zurück, die mit </blockquote> enden (ohne nachfolgendes <p>). */
function templatesEndingWithBlockquote(): string[] {
  return NEWS_TEMPLATES
    .filter((t) => /(<\/blockquote>)\s*$/.test(t.html))
    .map((t) => t.id);
}

/** Sucht Blockquotes, die direkt von einem Heading gefolgt werden ohne ein <p> dazwischen. */
function blockquoteDirectlyBeforeHeading(html: string): boolean {
  return /<\/blockquote>\s*<h[1-6]/.test(html);
}

// ──────────────────────────────────────────────────────────────────────────────
// Allgemeine Struktur
// ──────────────────────────────────────────────────────────────────────────────

describe('NEWS_TEMPLATES – Allgemeine Struktur', () => {
  it('enthält mindestens ein Template', () => {
    expect(NEWS_TEMPLATES.length).toBeGreaterThan(0);
  });

  it('jedes Template hat alle Pflichtfelder', () => {
    const requiredKeys: (keyof NewsTemplate)[] = ['id', 'name', 'description', 'icon', 'color', 'html'];
    NEWS_TEMPLATES.forEach((t) => {
      requiredKeys.forEach((key) => {
        expect(t[key]).toBeTruthy(); // nicht leer / undefined
      });
    });
  });

  it('alle Template-IDs sind eindeutig', () => {
    const ids = NEWS_TEMPLATES.map((t) => t.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('alle Templates haben nicht-leeres HTML', () => {
    NEWS_TEMPLATES.forEach((t) => {
      expect(t.html.trim().length).toBeGreaterThan(0);
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Blockquote-Bleed-Fix: kein Template endet auf </blockquote>
// ──────────────────────────────────────────────────────────────────────────────

describe('NEWS_TEMPLATES – Blockquote-Trailing-Fix (Bleed-Schutz)', () => {
  it('kein Template endet direkt mit </blockquote> ohne nachfolgendes <p>', () => {
    const offending = templatesEndingWithBlockquote();
    expect(offending).toEqual([]);
  });

  it.each(NEWS_TEMPLATES)(
    'Template "$id": enthält nach jedem </blockquote> einen Cursor-Escape-Knoten (<p> oder Heading)',
    ({ id, html }) => {
      // Alle Blockquotes müssen von einem Element gefolgt werden
      const allBlockquotes = [...html.matchAll(/<\/blockquote>/g)];
      allBlockquotes.forEach((match) => {
        const afterClose = html.slice((match.index ?? 0) + match[0].length);
        // Entweder folgt direkt ein HTML-Tag (p, h1-h6, ul, ol, hr, etc.) oder das Template endet
        const startsWithTag = /^\s*</.test(afterClose);
        const isEndOfTemplate = afterClose.trim() === '';
        // isEndOfTemplate darf NICHT sein (wäre der Bleed-Fall)
        expect(isEndOfTemplate).toBe(false); // muss von einem Element gefolgt werden
        expect(startsWithTag).toBe(true);
      });
    },
  );

  it.each(NEWS_TEMPLATES)(
    'Template "$id": </blockquote> steht nie unmittelbar vor einem <h1>-<h6> (würde Cursor einsperren)',
    ({ id, html }) => {
      expect(blockquoteDirectlyBeforeHeading(html)).toBe(false);
    },
  );
});

// ──────────────────────────────────────────────────────────────────────────────
// Konkrete Template-Checks
// ──────────────────────────────────────────────────────────────────────────────

describe('NEWS_TEMPLATES – Bekannte Templates', () => {
  const byId = (id: string) => NEWS_TEMPLATES.find((t) => t.id === id)!;

  it('platform-update endet auf <p></p>', () => {
    expect(byId('platform-update').html.endsWith('<p></p>')).toBe(true);
  });

  it('match-preview endet auf <p></p>', () => {
    expect(byId('match-preview').html.endsWith('<p></p>')).toBe(true);
  });

  it('announcement endet auf <p></p>', () => {
    expect(byId('announcement').html.endsWith('<p></p>')).toBe(true);
  });

  it('tournament endet auf <p></p>', () => {
    expect(byId('tournament').html.endsWith('<p></p>')).toBe(true);
  });

  it('feature-spotlight endet auf eines der erlaubten Elemente (p, hr, a)', () => {
    const html = byId('feature-spotlight').html;
    expect(html.endsWith('</p>') || html.endsWith('<p></p>')).toBe(true);
  });

  it('update-with-images endet auf <p></p>', () => {
    expect(byId('update-with-images').html.endsWith('<p></p>')).toBe(true);
  });

  it('match-report endet mit einem normalen <p>-Block (kein Blockquote)', () => {
    const html = byId('match-report').html;
    expect(html.endsWith('</blockquote>')).toBe(false);
    expect(html.endsWith('</p>')).toBe(true);
  });

  it('new-feature endet mit einem normalen Element (kein Blockquote)', () => {
    const html = byId('new-feature').html;
    expect(html.endsWith('</blockquote>')).toBe(false);
  });
});
