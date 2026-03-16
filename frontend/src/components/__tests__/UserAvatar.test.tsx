/**
 * Tests for the UserAvatar component.
 *
 * Covers the full-URL handling change: when the `icon` prop begins with
 * "http", it is used directly as the <img src> instead of being prefixed
 * with the backend upload path.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Suppress noisy MUI / SVG stuff
jest.mock('../UserAvatar', () => {
  // We test the REAL implementation – just re-export it while mocking its deps
  return jest.requireActual('../UserAvatar');
});

jest.mock('../../utils/avatarFrame', () => ({
  getAvatarFrameUrl: () => undefined,
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { UserAvatar } from '../UserAvatar';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('UserAvatar – icon prop', () => {
  it('renders an img with the exact URL when icon starts with https', () => {
    const url = 'https://lh3.googleusercontent.com/a/photo.jpg';
    render(<UserAvatar icon={url} name="Max Muster" />);

    const img = screen.getByAltText('Avatar');
    expect(img).toHaveAttribute('src', url);
  });

  it('renders an img with the exact URL when icon starts with http', () => {
    const url = 'http://localhost/some-photo.jpg';
    render(<UserAvatar icon={url} name="Test User" />);

    const img = screen.getByAltText('Avatar');
    expect(img).toHaveAttribute('src', url);
  });

  it('prefixes the backend upload path when icon is a plain filename', () => {
    render(<UserAvatar icon="avatar_42_1234567890.png" name="Plain Filename" />);

    const img = screen.getByAltText('Avatar');
    expect(img.getAttribute('src')).toMatch(/\/uploads\/avatar\/avatar_42_1234567890\.png$/);
  });

  it('renders a fallback icon when icon is an empty string', () => {
    const { container } = render(<UserAvatar icon="" name="No Avatar" />);
    // No img with a real src; the MUI Avatar renders a fallback SVG/icon
    const imgs = container.querySelectorAll('img[src]');
    expect(imgs).toHaveLength(0);
  });

  it('renders a fallback icon when icon is undefined', () => {
    // icon accepts React.ReactNode | string, passing undefined forces the else branch
    const { container } = render(<UserAvatar icon={undefined as any} name="No Avatar" />);
    const imgs = container.querySelectorAll('img[src]');
    expect(imgs).toHaveLength(0);
  });

  it('does not add the upload prefix for a full URL (regression)', () => {
    const fullUrl = 'https://google.com/photo.jpg';
    render(<UserAvatar icon={fullUrl} name="Google User" />);

    const img = screen.getByAltText('Avatar');
    expect(img.getAttribute('src')).not.toContain('/uploads/avatar/');
    expect(img.getAttribute('src')).toBe(fullUrl);
  });
});
