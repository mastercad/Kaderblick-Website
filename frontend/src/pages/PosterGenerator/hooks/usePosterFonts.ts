import { useEffect } from 'react';

/**
 * Lädt alle Poster-spezifischen Google Fonts per dynamischem <link>-Element.
 *
 * Wird nur aufgerufen wenn der PosterGenerator oder PosterTemplateEditor
 * gemountet wird – nicht beim initialen Seitenaufruf der Public Site.
 *
 * Inter und Anton sind bereits in index.html geladen und werden hier
 * bewusst weggelassen.
 */
const POSTER_FONTS_URL =
  'https://fonts.googleapis.com/css2?'
  + 'family=Bebas+Neue'
  + '&family=Bangers'
  + '&family=Abril+Fatface'
  + '&family=Alfa+Slab+One'
  + '&family=Black+Ops+One'
  + '&family=Righteous'
  + '&family=Pacifico'
  + '&family=Lobster'
  + '&family=Permanent+Marker'
  + '&family=Oswald:wght@300;400;500;600;700'
  + '&family=Russo+One'
  + '&family=Exo+2:wght@400;500;600;700;800;900'
  + '&family=Barlow+Condensed:wght@400;500;600;700;800;900'
  + '&family=Archivo+Black'
  + '&family=Black+Han+Sans'
  + '&family=Rubik+Dirt'
  + '&family=Rock+Salt'
  + '&family=Caveat+Brush'
  + '&family=Rye'
  + '&display=swap';

const LINK_ID = 'poster-fonts-stylesheet';

export function usePosterFonts(): void {
  useEffect(() => {
    if (document.getElementById(LINK_ID)) {
      return;
    }

    const link = document.createElement('link');
    link.id = LINK_ID;
    link.rel = 'stylesheet';
    link.href = POSTER_FONTS_URL;
    document.head.appendChild(link);

    // Kein Cleanup: einmal geladen, für die gesamte Session gecacht.
  }, []);
}
