/**
 * Berechnet die initiale Vorschau-Breite des SharePosterDialog-Preview-Containers.
 *
 * Layout-Kette:
 *   Dialog (position:fixed, volle Viewport-Breite)
 *   → Paper (MUI maxWidth="sm" fullWidth: max 600px)
 *     – Desktop (>768px) : MUI-Standard margin 32px pro Seite → Paper = min(600, vw − 64)
 *     – Mobile  (≤768px) : mobile-responsive.css setzt margin: 16px !important
 *                          → Paper = min(600, vw − 32)
 *   → DialogContent (padding: 20px 24px → 24px pro Seite links/rechts)
 *   → PreviewContainer (width: 100%)
 *
 *   Nutzbreite = Paper − 48px  (DialogContent-Padding links + rechts)
 *   Minimum   : 200px (Fallback für sehr schmale Viewports)
 *
 * Diese Funktion liefert nur einen Anfangswert. Der echte Wert wird nach dem
 * Rendern per ResizeObserver / useLayoutEffect (mit isLoading-Dependency)
 * gemessen und überschrieben, sodass der Poster den Container pixelgenau füllt.
 *
 * @see SharePosterDialog – dort wird der Wert als useState-Initializer verwendet.
 */
export function getInitialPreviewWidth(): number {
  // mobile-responsive.css: auf ≤768px Margin 16px pro Seite (statt 32px Standard)
  const totalMargin = window.innerWidth <= 768 ? 32 : 64;
  const paper = Math.min(600, window.innerWidth - totalMargin);
  return Math.max(200, paper - 48);
}
