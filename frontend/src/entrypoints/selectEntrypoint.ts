import { isPublicSeoPath } from '../seo/siteConfig';

export function shouldUsePublicEntrypoint(pathname: string, search = ''): boolean {
  const requestedModal = new URLSearchParams(search).get('modal');
  return isPublicSeoPath(pathname) && requestedModal !== 'messages';
}
