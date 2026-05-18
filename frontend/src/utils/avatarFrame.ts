/**
 * Gibt die URL für den Avatar-Frame zurück, wenn ein Titel vorhanden ist.
 * @param titleObj Ein Objekt mit hasTitle (boolean) und avatarFrame (string)
 * @returns Die URL zum Frame (avatarFrame + '.svg') oder undefined
 */
export function getAvatarFrameUrl(titleObj?: { hasTitle?: boolean; avatarFrame?: string }): string | undefined {
  if (!titleObj?.hasTitle || !titleObj.avatarFrame) return undefined;
  // cup nutzt denselben Rahmen wie league
  const frame = titleObj.avatarFrame.replace(/^cup_/, 'league_');
  return "/images/avatar/" + frame + '.svg';
}
