import React from 'react';
import { Helmet } from 'react-helmet-async';
import {
  buildCanonicalUrl,
  DEFAULT_SEO_DESCRIPTION,
  DEFAULT_SEO_TITLE,
  DEFAULT_SHARE_IMAGE_URL,
  SITE_NAME,
} from './siteConfig';

type JsonLdValue = Record<string, unknown> | Array<Record<string, unknown>>;

interface SeoProps {
  title?: string;
  description?: string;
  canonicalPath?: string;
  image?: string;
  imageAlt?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
  keywords?: string[];
  jsonLd?: JsonLdValue;
  publishedTime?: string;
  modifiedTime?: string;
}

function normalizeJsonLd(jsonLd?: JsonLdValue): Array<Record<string, unknown>> {
  if (!jsonLd) {
    return [];
  }

  return Array.isArray(jsonLd) ? jsonLd : [jsonLd];
}

export function Seo({
  title = DEFAULT_SEO_TITLE,
  description = DEFAULT_SEO_DESCRIPTION,
  canonicalPath = '/',
  image = DEFAULT_SHARE_IMAGE_URL,
  imageAlt,
  type = 'website',
  noindex = false,
  keywords,
  jsonLd,
  publishedTime,
  modifiedTime,
}: SeoProps) {
  const canonicalUrl = buildCanonicalUrl(canonicalPath);
  const robotsContent = noindex
    ? 'noindex, nofollow, noarchive'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  return (
    <Helmet prioritizeSeoTags>
      <html lang="de" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robotsContent} />
      <meta name="googlebot" content={robotsContent} />
      {keywords && keywords.length > 0 && (
        <meta name="keywords" content={keywords.join(', ')} />
      )}
      <link rel="canonical" href={canonicalUrl} />
      <meta name="author" content="Andreas Kempe" />

      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="de_DE" />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={image} />
      <meta property="og:image:secure_url" content={image} />
      <meta property="og:image:type" content="image/jpeg" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={imageAlt ?? title} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@kaderblick" />
      <meta name="twitter:creator" content="@kaderblick" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}

      {normalizeJsonLd(jsonLd).map((entry, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(entry)}
        </script>
      ))}
    </Helmet>
  );
}

export default Seo;