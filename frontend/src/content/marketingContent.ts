import publicSiteData from './publicSiteData.json';

export interface DocumentationLink {
  label: string;
  url: string;
}

export interface MarketingFeature {
  slug: string;
  name: string;
  teaser: string;
  summary: string;
  summaryTitle?: string;
  valueTitle?: string;
  valueIntro?: string;
  galleryTitle?: string;
  galleryIntro?: string;
  imageCaptions?: string[];
  seoTitle: string;
  seoDescription: string;
  image: string;
  additionalImages?: string[];
  benefits: string[];
  suitableFor: string[];
  docsLinks: DocumentationLink[];
}

export interface FaqEntry {
  question: string;
  answer: string;
}

export interface IntentLandingPage {
  slug: string;
  path: string;
  label: string;
  seoTitle: string;
  seoDescription: string;
  headline: string;
  intro: string;
  summary: string;
  summaryTitle?: string;
  valueTitle?: string;
  valueIntro?: string;
  docsTitle?: string;
  docsIntro?: string;
  benefits: string[];
  linkedFeatures: string[];
  docsLinks: DocumentationLink[];
}

export const marketingFeatures = publicSiteData.features as MarketingFeature[];
export const faqEntries = publicSiteData.faqEntries as FaqEntry[];
export const intentPages = publicSiteData.intentPages as IntentLandingPage[];

export const publicSitePaths = [
  '/',
  '/funktionen',
  ...marketingFeatures.map((feature) => `/funktionen/${feature.slug}`),
  ...intentPages.map((page) => page.path),
  '/vorteile',
  '/preise',
  '/ueber-uns',
  '/faq',
  '/kontakt',
  '/imprint',
  '/privacy',
];