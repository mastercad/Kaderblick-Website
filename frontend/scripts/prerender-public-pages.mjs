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
  ['https://docs.kaderblick.de', 'Dokumentation'],
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
    body: `
      <main class="seo-snapshot">
        ${renderNav()}
        <p class="seo-eyebrow">Themenseite</p>
        <h1>${escapeHtml(feature.name)}</h1>
        <p>${escapeHtml(feature.summary)}</p>
        <ul class="seo-list">${feature.benefits.map((benefit) => `<li>${escapeHtml(benefit)}</li>`).join('')}</ul>
        <div class="seo-grid">${feature.docsLinks.map((entry) => `<article class="seo-card"><h2>${escapeHtml(entry.label)}</h2><p>Vertiefende Beschreibung und konkrete Nutzung in der Dokumentation.</p><a href="${entry.url}">Zur Dokumentation</a></article>`).join('')}</div>
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
  return {
    route: '/faq',
    title: 'FAQ zur Vereinssoftware Kaderblick',
    description: 'Antworten auf häufige Fragen zu Kaderblick, zur Vereinsorganisation und zur Nutzung im Amateurfußball.',
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
  html = html.replace('</head>', `${snapshotStyles}</head>`);
  html = html.replace(/<body[^>]*>/, '<body>');
  html = html.replace(/<div id="preload-fallback"[\s\S]*?<div id="root" style="display:none;">[\s\S]*?<\/div>/, `<div id="root">${page.body}</div>`);
  return html;
}

const routes = [
  renderHome(),
  renderFeaturesOverview(),
  ...renderFeaturePages(),
  ...renderIntentPages(),
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