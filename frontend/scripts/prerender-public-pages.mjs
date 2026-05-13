import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const siteUrl = (process.env.VITE_SITE_URL || 'https://kaderblick.de').replace(/\/+$/, '');

const publicSiteData = JSON.parse(
  await readFile(path.join(projectRoot, 'src/content/publicSiteData.json'), 'utf8'),
);

const snapshotStyles = `
  <style data-prerender-snapshot>
    .seo-snapshot { max-width: 1100px; margin: 0 auto; padding: 32px 20px 72px; color: #17301a; font-family: Inter, system-ui, sans-serif; }
    .seo-nav { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 28px; font-weight: 600; }
    .seo-nav a { color: #056d13; text-decoration: none; }
    .seo-nav a:hover { text-decoration: underline; }
    .seo-eyebrow { letter-spacing: .18em; text-transform: uppercase; font-size: .78rem; color: #056d13; font-weight: 700; }
    .seo-snapshot h1 { font-size: clamp(2.2rem, 4vw, 4rem); line-height: 1.02; margin: 12px 0 18px; }
    .seo-snapshot p { line-height: 1.75; color: #425646; }
    .seo-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; margin-top: 28px; }
    .seo-card { border: 1px solid #d9e4d4; border-radius: 18px; padding: 18px; background: rgba(255,255,255,.96); box-shadow: 0 10px 28px rgba(23,48,26,.06); }
    .seo-card h2, .seo-card h3 { margin: 0 0 10px; line-height: 1.18; color: #17301a; }
    .seo-card p { margin: 0 0 12px; }
    .seo-list { padding-left: 1.2rem; }
    .seo-list li { margin-bottom: 10px; color: #425646; }
    .seo-cta { display: inline-flex; margin-top: 18px; padding: 10px 14px; border-radius: 999px; background: #056d13; color: #fff; text-decoration: none; font-weight: 700; }
  </style>
`;

const navigationLinks = [
  ['/', 'Startseite'],
  ['/funktionen', 'Funktionen'],
  ['/vorteile', 'Vorteile'],
  ['/preise', 'Preise'],
  ['/aktuelles', 'Aktuelles'],
  ['https://docs.kaderblick.de', 'Dokumentation'],
  ['/faq', 'FAQ'],
  ['/kontakt', 'Kontakt'],
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function getFaqQuestion(entry) {
  return entry.question ?? entry['qüstion'] ?? '';
}

function renderNav() {
  return `<nav class="seo-nav">${navigationLinks.map(([href, label]) => `<a href="${href}">${label}</a>`).join('')}</nav>`;
}

function renderHome() {
  const cards = publicSiteData.features.slice(0, 6).map((feature) => `
    <article class="seo-card">
      <h2>${escapeHtml(feature.name)}</h2>
      <p>${escapeHtml(feature.teaser)}</p>
      <a href="/funktionen/${feature.slug}">Mehr erfahren</a>
    </article>
  `).join('');

  return {
    route: '/',
    title: 'Kaderblick - Vereinssoftware für Fußballvereine, Trainer und Teams',
    description: 'Digitale Vereinssoftware für Fußballvereine mit Kalender, Spielanalyse, Aufstellungen, Kommunikation und Vereinsorganisation.',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Kaderblick',
        url: 'https://kaderblick.de/',
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Kaderblick',
        url: 'https://kaderblick.de/',
        logo: `${siteUrl}/images/kaderblick_website_appicon.png`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'Kaderblick',
        applicationCategory: 'SportsApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '10', priceCurrency: 'EUR', unitText: 'MONTH' },
        description: 'Vereinssoftware für Fußballvereine mit Kalender, Trainingsorganisation, Spielanalyse, Kommunikation und Berichten.',
        url: 'https://kaderblick.de/',
      },
    ],
    body: `
      <main class="seo-snapshot">
        ${renderNav()}
        <p class="seo-eyebrow">Statisch vorgerenderte Public Site</p>
        <h1>Kaderblick für Vereine, Trainer, Eltern und Jugendleitung</h1>
        <p>Kaderblick gibt einen kompakten Überblick über die wichtigsten Bereiche für den Vereinsalltag. Für Details gibt es die passende Dokumentation.</p>
        <a class="seo-cta" href="https://docs.kaderblick.de">Zur Dokumentation</a>
        <div class="seo-grid">${cards}</div>
      </main>
    `,
  };
}

function renderFeaturesOverview() {
  const cards = publicSiteData.features.map((feature) => `
    <article class="seo-card">
      <h2>${escapeHtml(feature.name)}</h2>
      <p>${escapeHtml(feature.teaser)}</p>
      <a href="/funktionen/${feature.slug}">Funktionsseite ansehen</a>
    </article>
  `).join('');

  return {
    route: '/funktionen',
    title: 'Funktionen für Fußballvereine | Kaderblick',
    description: 'Entdecke die wichtigsten Funktionen von Kaderblick für Fußballvereine: Kalender, Teilnahmen, Spielanalyse, Formationen, Kommunikation und Berichte.',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://kaderblick.de/' },
          { '@type': 'ListItem', position: 2, name: 'Funktionen', item: 'https://kaderblick.de/funktionen' },
        ],
      },
    ],
    body: `
      <main class="seo-snapshot">
        ${renderNav()}
        <p class="seo-eyebrow">Funktionsübersicht</p>
        <h1>Funktionen für Vereine, Trainer und Teams</h1>
        <p>Hier findest du die zentralen Bereiche von Kaderblick im kompakten Überblick. Für konkrete Abläufe und Funktionen gibt es die passende Dokumentation.</p>
        <div class="seo-grid">${cards}</div>
      </main>
    `,
  };
}

function renderFeaturePages() {
  return publicSiteData.features.map((feature) => ({
    route: `/funktionen/${feature.slug}`,
    title: feature.seoTitle,
    description: feature.seoDescription,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://kaderblick.de/' },
          { '@type': 'ListItem', position: 2, name: 'Funktionen', item: 'https://kaderblick.de/funktionen' },
          { '@type': 'ListItem', position: 3, name: feature.name, item: `https://kaderblick.de/funktionen/${feature.slug}` },
        ],
      },
    ],
    body: `
      <main class="seo-snapshot">
        ${renderNav()}
        <p class="seo-eyebrow">Themenseite</p>
        <h1>${escapeHtml(feature.name)}</h1>
        <p>${escapeHtml(feature.summary)}</p>
        <ul class="seo-list">${feature.benefits.map((benefit) => `<li>${escapeHtml(benefit)}</li>`).join('')}</ul>
        <div class="seo-grid">${feature.docsLinks.map((entry) => `<article class="seo-card"><h2>${escapeHtml(entry.label)}</h2><p>Vertiefende Beschreibung und konkrete Nutzung in der Dokumentation.</p><a href="${entry.url}">Zur Dokumentation</a></article>`).join('')}</div>
        ${(() => {
          const related = publicSiteData.features.filter((f) => f.slug !== feature.slug).slice(0, 3);
          if (!related.length) return '';
          return `<h2>Weitere Funktionen</h2><div class="seo-grid">${related.map((f) => `<article class="seo-card"><h3><a href="/funktionen/${f.slug}">${escapeHtml(f.name)}</a></h3><p>${escapeHtml(f.teaser)}</p></article>`).join('')}</div>`;
        })()}
        <a class="seo-cta" href="/kontakt">Kontakt aufnehmen</a>
      </main>
    `,
  }));
}

function renderIntentPages() {
  return publicSiteData.intentPages.map((page) => ({
    route: page.path,
    title: page.seoTitle,
    description: page.seoDescription,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://kaderblick.de/' },
          { '@type': 'ListItem', position: 2, name: page.headline, item: `https://kaderblick.de${encodeURI(page.path)}` },
        ],
      },
    ],
    body: `
      <main class="seo-snapshot">
        ${renderNav()}
        <p class="seo-eyebrow">Suchintention</p>
        <h1>${escapeHtml(page.headline)}</h1>
        <p>${escapeHtml(page.intro)}</p>
        <ul class="seo-list">${page.benefits.map((benefit) => `<li>${escapeHtml(benefit)}</li>`).join('')}</ul>
        <div class="seo-grid">
          ${page.docsLinks.map((entry) => `<article class="seo-card"><h2>${escapeHtml(entry.label)}</h2><p>Weiterführende Erklärung in der Dokumentation.</p><a href="${entry.url}">Zur Dokumentation</a></article>`).join('')}
          ${page.linkedFeatures.map((slug) => {
            const feature = publicSiteData.features.find((entry) => entry.slug === slug);
            if (!feature) {
              return '';
            }

            return `<article class="seo-card"><h2>${escapeHtml(feature.name)}</h2><p>${escapeHtml(feature.teaser)}</p><a href="/funktionen/${feature.slug}">Mehr erfahren</a></article>`;
          }).join('')}
        </div>
      </main>
    `,
  }));
}

function renderFaq() {
  const faqSchemaJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: publicSiteData.faqEntries.map((entry) => ({
      '@type': 'Question',
      name: getFaqQuestion(entry),
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    })),
  };

  return {
    route: '/faq',
    title: 'FAQ zur Vereinssoftware Kaderblick',
    description: 'Antworten auf häufige Fragen zu Kaderblick, zur Vereinsorganisation und zur Nutzung im Amateurfußball.',
    jsonLd: [
      faqSchemaJsonLd,
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://kaderblick.de/' }, { '@type': 'ListItem', position: 2, name: 'FAQ', item: 'https://kaderblick.de/faq' }] },
    ],
    body: `
      <main class="seo-snapshot">
        ${renderNav()}
        <p class="seo-eyebrow">FAQ</p>
        <h1>FAQ zu Kaderblick</h1>
        <p>Antworten auf häufige Fragen rund um Nutzung, Zielgruppen und Einsatz von Kaderblick im Vereinsalltag.</p>
        <div class="seo-grid">
          ${publicSiteData.faqEntries.map((entry) => `<article class="seo-card"><h2>${escapeHtml(getFaqQuestion(entry))}</h2><p>${escapeHtml(entry.answer)}</p></article>`).join('')}
        </div>
      </main>
    `,
  };
}

function renderImprint() {
  return {
    route: '/imprint',
    title: 'Impressum | Kaderblick',
    description: 'Impressum von Kaderblick mit Anbieterangaben, Kontaktinformationen und rechtlichen Hinweisen.',
    body: `
      <main class="seo-snapshot">
        ${renderNav()}
        <p class="seo-eyebrow">Rechtliches</p>
        <h1>Impressum</h1>
        <div class="seo-grid">
          <article class="seo-card">
            <h2>Angaben gemäß § 5 TMG</h2>
            <p>Andreas Kempe<br>Glück-Auf-Straße 11c<br>01705 Freital<br>Deutschland</p>
          </article>
          <article class="seo-card">
            <h2>Kontakt</h2>
            <p><a href="mailto:andreas.kempe@kaderblick.de">andreas.kempe@kaderblick.de</a></p>
          </article>
        </div>
      </main>
    `,
  };
}

function renderPrivacy() {
  return {
    route: '/privacy',
    title: 'Datenschutz | Kaderblick',
    description: 'Datenschutzhinweise von Kaderblick zu Verarbeitung, Google-SSO, Cookies und den Rechten betroffener Personen.',
    body: `
      <main class="seo-snapshot">
        ${renderNav()}
        <p class="seo-eyebrow">Datenschutz</p>
        <h1>Datenschutzerklärung</h1>
        <div class="seo-grid">
          <article class="seo-card">
            <h2>Verantwortlicher</h2>
            <p>Andreas Kempe<br><a href="mailto:andreas.kempe@kaderblick.de">andreas.kempe@kaderblick.de</a></p>
          </article>
          <article class="seo-card">
            <h2>Verarbeitungszwecke</h2>
            <p>Bereitstellung der Webseite, Authentifizierung, Organisation, Kommunikation, Feedback und statistische Analysen.</p>
          </article>
        </div>
      </main>
    `,
  };
}

function renderContact() {
  return {
    route: '/kontakt',
    title: 'Kontakt zu Kaderblick',
    description: 'Kontaktseite für Kaderblick. Austausch zu Vereinsorganisation, Trainer-Workflows, Produktfragen und Einsatz im Fußballverein.',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://kaderblick.de/' }, { '@type': 'ListItem', position: 2, name: 'Kontakt', item: 'https://kaderblick.de/kontakt' }] },
    ],
    body: `
      <main class="seo-snapshot">
        ${renderNav()}
        <p class="seo-eyebrow">Kontakt</p>
        <h1>Austausch zu Kaderblick</h1>
        <p>Wenn du Kaderblick für deinen Verein einordnen möchtest, ist diese statisch vorgerenderte Kontaktseite der öffentliche Einstiegspunkt.</p>
        <article class="seo-card">
          <h2>Direkter Kontakt</h2>
          <p>Andreas Kempe</p>
          <p><a href="mailto:andreas.kempe@kaderblick.de">andreas.kempe@kaderblick.de</a></p>
          <a class="seo-cta" href="mailto:andreas.kempe@kaderblick.de">E-Mail schreiben</a>
        </article>
      </main>
    `,
  };
}

function renderVorteile() {
  return {
    route: '/vorteile',
    title: 'Vorteile für Fußballvereine | Kaderblick',
    description: 'Warum Kaderblick für Fußballvereine relevant ist: weniger Abstimmungschaos, klarere Kommunikation, mehr Verbindlichkeit und besserer Überblick im Vereinsalltag.',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://kaderblick.de/' }, { '@type': 'ListItem', position: 2, name: 'Vorteile', item: 'https://kaderblick.de/vorteile' }] },
    ],
    body: `
      <main class="seo-snapshot">
        ${renderNav()}
        <p class="seo-eyebrow">Vorteile</p>
        <h1>Weniger Aufwand. Mehr Überblick. Mehr Verbindlichkeit.</h1>
        <p>Kaderblick bündelt Kalender, Teilnahmen, Kommunikation und Spielbetrieb an einem Ort – damit Vereine klarer organisiert sind und Trainer mehr Zeit für das Wesentliche haben.</p>
        <div class="seo-grid">
          <article class="seo-card"><h2>Weniger Abstimmungsaufwand</h2><p>Chatgruppen, Tabellen und parallele Kanäle werden durch einen gemeinsamen Ort ersetzt, an dem alle relevanten Informationen verfügbar sind.</p></article>
          <article class="seo-card"><h2>Klarere Kommunikation</h2><p>Änderungen, Rückmeldungen und Entscheidungen kommen verlässlich an – ohne Medienbrüche und unnötige Wiederholungen.</p></article>
          <article class="seo-card"><h2>Mehr Verbindlichkeit</h2><p>Zusagen, Absagen und offene Rückmeldungen sind jederzeit sichtbar, damit Planung auf einer echten Grundlage basiert.</p></article>
          <article class="seo-card"><h2>Datenschutz und Sicherheit</h2><p>Sensible Vereinsdaten gehören nicht in private Chats – Kaderblick bietet einen sicheren, zentralen Rahmen gemäß DSGVO.</p></article>
        </div>
        <a class="seo-cta" href="/kontakt">Kontakt aufnehmen</a>
      </main>
    `,
  };
}

function renderPreise() {
  return {
    route: '/preise',
    title: 'Preise | Kaderblick – Vereinssoftware für Fußballvereine',
    description: 'Kaderblick kostet 10 € pro Team und Monat. Alle Funktionen inklusive, keine versteckten Kosten – faire Preise für jeden Fußballverein.',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://kaderblick.de/' }, { '@type': 'ListItem', position: 2, name: 'Preise', item: 'https://kaderblick.de/preise' }] },
    ],
    body: `
      <main class="seo-snapshot">
        ${renderNav()}
        <p class="seo-eyebrow">Transparente Preise</p>
        <h1>Ein Plan. Alles inklusive.</h1>
        <p>10 € pro Team und Monat. Alle Funktionen ohne Einschränkung – faire und transparente Preisgestaltung für Fußballvereine jeder Größe.</p>
        <div class="seo-grid">
          <article class="seo-card"><h2>10 € / Team / Monat</h2><p>Alle Funktionen inklusive. Keine versteckten Kosten, kein Kleingedrucktes. Kaderblick für den gesamten Vereinsbetrieb.</p></article>
          <article class="seo-card"><h2>Alle Funktionen enthalten</h2><p>Kalender, Teilnahmen, Spielanalyse, Formationen, Kommunikation, Berichte, Videoanalyse, Umfragen und mehr – alles in einem Plan.</p></article>
          <article class="seo-card"><h2>DSGVO-konform · Deutsche Server</h2><p>Datenschutzkonforme Infrastruktur in Deutschland. Kein Tracking, keine Weitergabe an Dritte.</p></article>
        </div>
        <a class="seo-cta" href="/kontakt">Demo anfragen</a>
      </main>
    `,
  };
}

function renderUeberUns() {
  return {
    route: '/ueber-uns',
    title: 'Über Kaderblick | Vereinssoftware für den Amateurfußball',
    description: 'Kaderblick entstand nicht aus einer Marktanalyse, sondern aus konkreten Problemen im eigenen Vereinsleben. Erfahre mehr über Hintergrund und Mission.',
    jsonLd: [
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Startseite', item: 'https://kaderblick.de/' }, { '@type': 'ListItem', position: 2, name: 'Über uns', item: 'https://kaderblick.de/ueber-uns' }] },
    ],
    body: `
      <main class="seo-snapshot">
        ${renderNav()}
        <p class="seo-eyebrow">Über Kaderblick</p>
        <h1>Entstanden aus dem Vereinsalltag.</h1>
        <p>Kaderblick entstand nicht aus einer Marktanalyse, sondern aus konkreten, wiederkehrenden Problemen im eigenen Vereinsleben – zu viele parallele Kanäle, keine Übersicht, keine eigenen Statistiken und kein vernünftiges Werkzeug für Videoanalyse.</p>
        <div class="seo-grid">
          <article class="seo-card"><h2>Aus der Praxis für die Praxis</h2><p>Jede Funktion in Kaderblick löst ein echtes Problem, das im eigenen Verein erlebt wurde – kein Feature um des Features willen.</p></article>
          <article class="seo-card"><h2>Unabhängig und transparent</h2><p>Kaderblick ist kein Konzernprodukt. Direkte Ansprechbarkeit, ehrliche Kommunikation und ein offenes Ohr für Feedback.</p></article>
        </div>
        <a class="seo-cta" href="/kontakt">Kontakt aufnehmen</a>
      </main>
    `,
  };
}

function updateTag(html, pattern, replacement) {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }

  return html;
}

function buildHtml(baseHtml, page) {
  const canonicalUrl = page.route === '/' ? `${siteUrl}/` : `${siteUrl}${page.route}`;
  let html = baseHtml;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(page.title)}</title>`);
  html = updateTag(html, /<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(page.description)}" />`);
  html = updateTag(html, /<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${canonicalUrl}" />`);
  html = updateTag(html, /<meta property="og:title" content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(page.title)}" />`);
  html = updateTag(html, /<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(page.description)}" />`);
  html = updateTag(html, /<meta property="og:url" content="[^"]*"\s*\/>/, `<meta property="og:url" content="${canonicalUrl}" />`);
  html = updateTag(html, /<meta name="twitter:title" content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`);
  html = updateTag(html, /<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`);
  const pageJsonLdEntries = page.jsonLd ? (Array.isArray(page.jsonLd) ? page.jsonLd : [page.jsonLd]) : [];
  const pageJsonLdHtml = pageJsonLdEntries.length > 0
    ? pageJsonLdEntries.map(entry => `\n    <script type="application/ld+json">${JSON.stringify(entry)}</script>`).join('')
    : '';
  html = html.replace('</head>', `${pageJsonLdHtml}\n${snapshotStyles}</head>`);
  html = html.replace(/<body[^>]*>/, '<body>');
  html = html.replace(/<div id="preload-fallback"[\s\S]*?<div id="root" style="display:none;">[\s\S]*?<\/div>/, `<div id="root">${page.body}</div>`);
  return html;
}

const routes = [
  renderHome(),
  renderFeaturesOverview(),
  ...renderFeaturePages(),
  ...renderIntentPages(),
  renderVorteile(),
  renderPreise(),
  renderUeberUns(),
  renderFaq(),
  renderContact(),
  renderImprint(),
  renderPrivacy(),
];

const baseHtml = await readFile(path.join(distDir, 'index.html'), 'utf8');

for (const page of routes) {
  const outputPath = page.route === '/'
    ? path.join(distDir, 'index.html')
    : path.join(distDir, page.route.replace(/^\//, ''), 'index.html');

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, buildHtml(baseHtml, page), 'utf8');
}

// Generate sitemap.xml from rendered routes
function getSitemapPriority(route) {
  if (route === '/') return '1.0';
  if (route === '/funktionen') return '0.9';
  if (['/vorteile', '/preise', '/ueber-uns'].includes(route)) return '0.8';
  if (route.startsWith('/für-') || route === '/spielanalyse-software') return '0.8';
  if (route.startsWith('/funktionen/')) return '0.7';
  if (route === '/faq' || route === '/kontakt') return '0.6';
  return '0.3';
}

function getSitemapChangefreq(route) {
  if (route === '/' || route === '/funktionen') return 'weekly';
  if (route === '/imprint' || route === '/privacy') return 'yearly';
  return 'monthly';
}

const buildDate = new Date().toISOString().split('T')[0];

const sitemapEntries = routes.map((page) => {
  const encodedRoute = encodeURI(page.route);
  const priority = getSitemapPriority(page.route);
  const changefreq = getSitemapChangefreq(page.route);
  return `  <url>\n    <loc>${siteUrl}${encodedRoute}</loc>\n    <lastmod>${buildDate}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}).join('\n');

const aktuellesEntry = `  <url>\n    <loc>${siteUrl}/aktuelles</loc>\n    <lastmod>${buildDate}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`;

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n${aktuellesEntry}\n</urlset>\n`;

await writeFile(path.join(distDir, 'sitemap.xml'), sitemapXml, 'utf8');
// Keep frontend/public/sitemap.xml in sync so dev-mode always matches the build output.
await writeFile(path.join(projectRoot, 'public', 'sitemap.xml'), sitemapXml, 'utf8');

// Generate a static 404.html so nginx can serve it with HTTP 404 status for unknown routes
const notFoundHtml = buildHtml(baseHtml, {
  route: '/404',
  title: 'Seite nicht gefunden | Kaderblick',
  description: 'Die angeforderte Seite wurde nicht gefunden.',
  htmlContent: `
    <div class="seo-snapshot">
      ${renderNav()}
      <p class="seo-eyebrow">404 – Nicht gefunden</p>
      <h1>Diese Seite gibt es nicht</h1>
      <p>Die angeforderte URL existiert nicht. Bitte prüfe die Adresse oder kehre zur Startseite zurück.</p>
      <a href="/" class="seo-cta">Zur Startseite</a>
    </div>`,
});
await writeFile(path.join(distDir, '404.html'), notFoundHtml, 'utf8');

console.log(`Prerender complete: ${routes.length} pages + sitemap.xml + 404.html generated.`);