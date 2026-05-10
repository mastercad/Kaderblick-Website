/**
 * SVG-Export-Hilfsfunktionen
 *
 * Für den PNG-Export müssen alle externen Ressourcen (Fonts, Bilder) als
 * Base64-Data-URIs in das SVG eingebettet werden, da der Browser beim
 * Rendern eines SVG-Blobs via drawImage() keine externen Requests erlaubt.
 */

// ─── Lokale Custom-Fonts ──────────────────────────────────────────────────────

const LOCAL_FONT_SOURCES = [
  { family: 'ImpactWeb',    url: '/fonts/ImpactLTStd.woff2',                    format: 'woff2' },
  { family: 'Bambe',        url: '/fonts/Bambe.ttf',                            format: 'truetype' },
  { family: 'Bambe Swash',  url: '/fonts/Bambe Swash.ttf',                      format: 'truetype' },
  { family: 'Grindy Brush', url: '/fonts/Grindy Brush.otf',                     format: 'opentype' },
  { family: 'Larthez',      url: '/fonts/Larthez.otf',                          format: 'opentype' },
  { family: 'RetroBrush',   url: '/fonts/RetroBrushPersonalUseOnly-Regular.otf', format: 'opentype' },
  { family: 'Storm Gust',   url: '/fonts/Storm Gust.otf',                       format: 'opentype' },
] as const;

// ─── Caches ───────────────────────────────────────────────────────────────────

const dataUriCache = new Map<string, string>();

// ─── Fetch → Base64 Data-URI ──────────────────────────────────────────────────

async function fetchAsDataUri(url: string): Promise<string | null> {
  if (dataUriCache.has(url)) return dataUriCache.get(url)!;

  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise<string | null>(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        dataUriCache.set(url, result);
        resolve(result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Lokale Font-@font-face-Regeln als Base64 ─────────────────────────────────

async function buildLocalFontCss(): Promise<string> {
  const rules: string[] = [];
  for (const font of LOCAL_FONT_SOURCES) {
    const dataUri = await fetchAsDataUri(font.url);
    if (dataUri) {
      rules.push(
        `@font-face { font-family: '${font.family}'; src: url('${dataUri}') format('${font.format}'); font-weight: normal; font-style: normal; }`,
      );
    }
  }
  return rules.join('\n');
}

// ─── Google Fonts als Base64 inlinen ─────────────────────────────────────────

/** Liest die Google-Fonts-URL aus dem <head> der aktuellen Seite. */
function getGoogleFontsUrl(): string | null {
  if (typeof document === 'undefined') return null;
  const links = document.head.querySelectorAll('link[href*="fonts.googleapis.com"]');
  for (const link of Array.from(links)) {
    const href = (link as HTMLLinkElement).href;
    if (href.includes('fonts.googleapis.com/css')) return href;
  }
  return null;
}

/** Parst alle @font-face-Blöcke aus einem CSS-String. */
function parseFontFaceBlocks(css: string): string[] {
  const blocks: string[] = [];
  let i = 0;
  while (i < css.length) {
    const start = css.indexOf('@font-face', i);
    if (start === -1) break;
    const open = css.indexOf('{', start);
    if (open === -1) break;
    let depth = 0;
    let j = open;
    while (j < css.length) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') {
        depth--;
        if (depth === 0) { blocks.push(css.slice(start, j + 1)); break; }
      }
      j++;
    }
    i = j + 1;
  }
  return blocks;
}

async function buildGoogleFontCss(): Promise<string> {
  const gfontsUrl = getGoogleFontsUrl();
  if (!gfontsUrl) return '';

  try {
    // Fetch the Google Fonts CSS (CORS is allowed by Google)
    const cssResp = await fetch(gfontsUrl);
    if (!cssResp.ok) return '';
    const cssText = await cssResp.text();

    const blocks = parseFontFaceBlocks(cssText);
    const inlinedBlocks: string[] = [];

    for (const block of blocks) {
      // Find the font URL in the block
      const urlMatch = block.match(/url\(([^)]+)\)\s+format\('?([^')]+)'?\)/);
      if (!urlMatch) {
        inlinedBlocks.push(block);
        continue;
      }
      const fontUrl = urlMatch[1].replace(/['"]/g, '');
      const fmt    = urlMatch[2];
      const dataUri = await fetchAsDataUri(fontUrl);
      if (dataUri) {
        inlinedBlocks.push(block.replace(urlMatch[0], `url('${dataUri}') format('${fmt}')`));
      } else {
        inlinedBlocks.push(block);
      }
    }

    return inlinedBlocks.join('\n');
  } catch {
    return '';
  }
}

// ─── Alle verwendeten Schriften inlinen ───────────────────────────────────────

let cachedFontCss: string | null = null;

export async function buildInlineFontCss(): Promise<string> {
  if (cachedFontCss !== null) return cachedFontCss;

  const [localCss, googleCss] = await Promise.all([
    buildLocalFontCss(),
    buildGoogleFontCss(),
  ]);

  cachedFontCss = [localCss, googleCss].filter(Boolean).join('\n');
  return cachedFontCss;
}

// ─── Bilder im SVG durch Base64 ersetzen ─────────────────────────────────────

async function inlineImagesInSvgString(svgString: string): Promise<string> {
  // Alle href="…" auf <image>-Elementen finden (keine data:-URIs)
  const hrefRegex = /(<image[^>]*\s)href="([^"]+)"/g;
  const matches = [...svgString.matchAll(hrefRegex)];

  let result = svgString;
  for (const match of matches) {
    const url = match[2];
    if (url.startsWith('data:')) continue;
    const dataUri = await fetchAsDataUri(url);
    if (dataUri) {
      result = result.replace(match[0], `${match[1]}href="${dataUri}"`);
    }
  }
  return result;
}

// ─── SVGSVGElement → PNG Blob ─────────────────────────────────────────────────

/**
 * Rendert ein SVGSVGElement als PNG-Blob.
 *
 * Strategie:
 * 1. SVG serialisieren
 * 2. Alle Fonts als Base64 einbetten (lokal + Google Fonts)
 * 3. Alle <image>-hrefs als Base64 einbetten
 * 4. SVG als Blob-URL in ein <img> laden
 * 5. Per Canvas.drawImage() → toBlob()
 */
export async function svgToPngBlob(svgElement: SVGSVGElement): Promise<Blob> {
  // ── 1. SVG serialisieren ──────────────────────────────────────────────────
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgElement);

  // SVG-Namespace sicherstellen
  if (!svgString.includes('xmlns=')) {
    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // ── 2. Fonts inlinen ─────────────────────────────────────────────────────
  const fontCss = await buildInlineFontCss();
  if (fontCss) {
    // Vorhandenes <style>-Tag in <defs> ergänzen oder neues einfügen
    const existingStyle = /<style[^>]*>([\s\S]*?)<\/style>/;
    if (existingStyle.test(svgString)) {
      svgString = svgString.replace(existingStyle, (_, content) =>
        `<style>${fontCss}\n${content}</style>`,
      );
    } else {
      svgString = svgString.replace('<defs>', `<defs><style>${fontCss}</style>`);
    }
  }

  // ── 3. Bilder inlinen ────────────────────────────────────────────────────
  svgString = await inlineImagesInSvgString(svgString);

  // ── 4. SVG als Blob laden ────────────────────────────────────────────────
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl  = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = svgUrl;
    });

    // ── 5. Canvas rendern ────────────────────────────────────────────────
    const viewBox = svgElement.viewBox.baseVal;
    const canvasW = viewBox.width  || svgElement.width.baseVal.value  || 1080;
    const canvasH = viewBox.height || svgElement.height.baseVal.value || 1080;

    const canvas = document.createElement('canvas');
    canvas.width  = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');

    ctx.drawImage(img, 0, 0, canvasW, canvasH);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob produced null'));
      }, 'image/png');
    });
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
