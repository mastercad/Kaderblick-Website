/**
 * PNG-Export via html2canvas.
 *
 * Das Poster wird als HTML/CSS-Div gerendert (HtmlPosterRenderer).
 * html2canvas liest die gerenderten DOM-Styles direkt – dieselbe Engine
 * wie die In-Browser-Vorschau – und erzeugt damit ein pixel-identisches PNG.
 */
import html2canvas from 'html2canvas';

// ─── Cache ────────────────────────────────────────────────────────────────────

const dataUriCache = new Map<string, string>();

// ─── Fetch → Base64 Data-URI ──────────────────────────────────────────────────

async function fetchAsDataUri(url: string): Promise<string | null> {
  if (url.startsWith('data:')) return url;
  if (dataUriCache.has(url)) return dataUriCache.get(url)!;

  // Absolute URLs von anderem Origin in relative Pfade umwandeln,
  // damit der Vite-Dev-Proxy sie ausliefern kann.
  let fetchUrl = url;
  try {
    const parsed = new URL(url, window.location.href);
    if (parsed.origin !== window.location.origin) {
      fetchUrl = parsed.pathname + parsed.search + parsed.hash;
    }
  } catch { /* ungültige URL – unveränderter Fallback */ }

  try {
    const resp = await fetch(fetchUrl);
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

// ─── Preprocessing: <img>-Quellen inlinen ────────────────────────────────────

async function inlineImagesInElement(root: HTMLElement): Promise<void> {
  const imgs = root.querySelectorAll<HTMLImageElement>('img');
  await Promise.all(Array.from(imgs).map(async img => {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) return;
    const dataUri = await fetchAsDataUri(src);
    if (dataUri) img.src = dataUri;
  }));
}

// ─── Preprocessing: CSS background-image-URLs inlinen ────────────────────────

/**
 * Ersetzt inline-style background-image: url(...) durch Data-URIs.
 * Nötig, weil das Hintergrundbild als CSS-background-div eingebaut ist
 * (statt <img>), damit html2canvas background-size:cover korrekt rendert.
 */
async function inlineCssBackgroundImages(root: HTMLElement): Promise<void> {
  const elements = root.querySelectorAll<HTMLElement>('*');
  await Promise.all(Array.from(elements).map(async el => {
    const bgImage = el.style.backgroundImage;
    if (!bgImage || bgImage === 'none' || bgImage.includes('gradient')) return;

    const urlMatch = bgImage.match(/url\(['"]?([^'")\s]+)['"]?\)/);
    if (!urlMatch) return;

    const url = urlMatch[1];
    if (url.startsWith('data:')) return;

    const dataUri = await fetchAsDataUri(url);
    if (dataUri) {
      el.style.backgroundImage = bgImage.replace(urlMatch[0], `url('${dataUri}')`);
    }
  }));
}

// ─── Preprocessing: Gradient-Text → Canvas-Bild ──────────────────────────────

/**
 * Parst linear-gradient / radial-gradient (Formate von buildTextGradientCss)
 * in ein CanvasGradient-Objekt.  w/h entsprechen der Span-Bounding-Box.
 */
function cssBgImageToCanvasGradient(
  ctx: CanvasRenderingContext2D,
  bgImage: string,
  w: number,
  h: number,
): CanvasGradient | null {
  const addStops = (stopsStr: string, grad: CanvasGradient): void => {
    const stopRx = /((?:rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}|[a-z]+))\s+([\d.]+)%/g;
    let m: RegExpExecArray | null;
    while ((m = stopRx.exec(stopsStr)) !== null) {
      try { grad.addColorStop(parseFloat(m[2]) / 100, m[1].trim()); } catch { /* ignore */ }
    }
  };

  // radial-gradient(circle at X% Y%, stops)
  const rm = bgImage.match(/radial-gradient\(\s*circle\s+at\s+([\d.]+)%\s+([\d.]+)%\s*,\s*(.+)\)$/s);
  if (rm) {
    const cx = (parseFloat(rm[1]) / 100) * w;
    const cy = (parseFloat(rm[2]) / 100) * h;
    const r  = Math.sqrt(w * w + h * h) / 2;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    addStops(rm[3], grad);
    return grad;
  }

  // linear-gradient(Ndeg, stops)
  const lm = bgImage.match(/linear-gradient\(\s*([\d.]+)deg\s*,\s*(.+)\)$/s);
  if (lm) {
    const rad = ((parseFloat(lm[1]) - 90) * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const grad = ctx.createLinearGradient(
      w / 2 - (cos * w) / 2, h / 2 - (sin * h) / 2,
      w / 2 + (cos * w) / 2, h / 2 + (sin * h) / 2,
    );
    addStops(lm[2], grad);
    return grad;
  }

  return null;
}

/**
 * html2canvas unterstützt kein -webkit-background-clip:text / background-clip:text.
 *
 * Findet alle mit data-gradient-text markierten Spans im Klon, rendert den Text
 * mit Farbverlauf auf einem Canvas und ersetzt den Span durch ein <img>.
 *
 * Der Gradient wird relativ zur SPAN-Bounding-Box berechnet (span.offsetWidth/Height)
 * – exakt wie der Browser das CSS macht.
 */
async function preRenderGradientTextSpans(root: HTMLElement): Promise<void> {
  const spans = root.querySelectorAll<HTMLElement>('[data-gradient-text]');
  if (typeof document !== 'undefined' && document.fonts) {
    await document.fonts.ready;
  }

  for (const span of Array.from(spans)) {
    const bgImage = span.style.backgroundImage;
    if (!bgImage || bgImage === 'none') continue;

    const rawText = span.textContent ?? '';
    if (!rawText.trim()) continue;

    const w = span.offsetWidth;
    const h = span.offsetHeight;
    if (w <= 0 || h <= 0) continue;

    const textDiv = span.parentElement as HTMLElement | null;
    if (!textDiv) continue;

    const cs              = window.getComputedStyle(textDiv);
    const fontFamily      = cs.fontFamily;
    const fontSizePx      = parseFloat(cs.fontSize) || 16;
    const fontWeight      = cs.fontWeight;
    const textTransform   = cs.textTransform;
    const lsRaw           = cs.letterSpacing;
    const letterSpacingPx = /^-?[\d.]+/.test(lsRaw) ? parseFloat(lsRaw) : 0;
    const lhRaw           = cs.lineHeight;
    const lineHeightPx    = /^[\d.]+px$/.test(lhRaw) ? parseFloat(lhRaw) : fontSizePx * 1.2;

    let displayText = rawText;
    if (textTransform === 'uppercase') displayText = rawText.toUpperCase();
    else if (textTransform === 'lowercase') displayText = rawText.toLowerCase();

    const cvs = document.createElement('canvas');
    cvs.width  = w;
    cvs.height = h;
    const ctx = cvs.getContext('2d');
    if (!ctx) continue;

    const gradient = cssBgImageToCanvasGradient(ctx, bgImage, w, h);
    if (!gradient) continue;

    ctx.font         = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'left';
    ctx.fillStyle    = gradient;

    const lines  = displayText.split('\n');
    const totalH = lines.length * lineHeightPx;
    let   y      = (h - totalH) / 2 + lineHeightPx / 2;

    for (const line of lines) {
      if (letterSpacingPx !== 0 && line.length > 0) {
        let cx = 0;
        for (const ch of line) {
          ctx.fillText(ch, cx, y);
          cx += ctx.measureText(ch).width + letterSpacingPx;
        }
      } else {
        ctx.fillText(line, 0, y);
      }
      y += lineHeightPx;
    }

    const img         = document.createElement('img');
    img.src           = cvs.toDataURL('image/png');
    img.style.display = 'inline-block';
    img.style.width   = `${w}px`;
    img.style.height  = `${h}px`;
    span.replaceWith(img);
  }
}

// ─── Haupt-Export ─────────────────────────────────────────────────────────────

/**
 * Rendert ein HTML-Element als PNG-Blob.
 *
 * Das Element wird geklont und in einen off-screen Wrapper-Div gehängt.
 * Wichtig: KEIN position:fixed mit negativem Y – html2canvas berechnet
 * die Capture-Region über getBoundingClientRect() und schneidet bei
 * position:fixed / top:-99999px den unteren Teil des Posters ab.
 * Stattdessen: Wrapper position:absolute bei top:0, weit links → Y-Koordinate
 * ist 0 und html2canvas erfasst die volle Höhe korrekt.
 */
export async function htmlToPngBlob(element: HTMLElement): Promise<Blob> {
  const nativeW = element.offsetWidth;
  const nativeH = element.offsetHeight;

  const clone = element.cloneNode(true) as HTMLElement;

  // Wrapper positioniert den Klon weit links außerhalb des Viewports,
  // aber vertikal bei top:0 – html2canvas kann die volle Höhe erfassen.
  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:absolute',
    'top:0',
    'left:-999999px',
    'overflow:hidden',
    'pointer-events:none',
    `width:${nativeW}px`,
    `height:${nativeH}px`,
  ].join(';');
  document.body.appendChild(wrapper);
  wrapper.appendChild(clone);

  try {
    await inlineImagesInElement(clone);
    await inlineCssBackgroundImages(clone);
    await preRenderGradientTextSpans(clone);

    const canvas = await html2canvas(clone, {
      useCORS:         true,
      allowTaint:      false,
      scale:           1,
      backgroundColor: null,
      logging:         false,
      width:           nativeW,
      height:          nativeH,
    });

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('html2canvas toBlob lieferte null'));
      }, 'image/png');
    });
  } finally {
    document.body.removeChild(wrapper);
  }
}

