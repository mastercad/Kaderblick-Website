/**
 * Tests for the UserAvatar component.
 *
 * Covers:
 * - Full-URL handling: icon starting with "http" is used directly as src
 * - Plain filename is prefixed with the backend upload path
 * - alt attribute uses name prop (fallback: "Avatar")
 * - Initials derived from name when no icon is present
 * - showLabel prop controls visibility of the name Typography label
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../utils/avatarFrame', () => ({
  getAvatarFrameUrl: () => undefined,
}));

import { UserAvatar } from '../UserAvatar';

// ─── icon prop ────────────────────────────────────────────────────────────────

describe('UserAvatar – icon prop', () => {
  it('renders an img with the exact URL when icon starts with https', () => {
    const url = 'https://lh3.googleusercontent.com/a/photo.jpg';
    render(<UserAvatar icon={url} name="Max Muster" />);

    const img = screen.getByAltText('Max Muster');
    expect(img).toHaveAttribute('src', url);
  });

  it('renders an img with the exact URL when icon starts with http', () => {
    const url = 'http://localhost/some-photo.jpg';
    render(<UserAvatar icon={url} name="Test User" />);

    const img = screen.getByAltText('Test User');
    expect(img).toHaveAttribute('src', url);
  });

  it('prefixes the backend upload path when icon is a plain filename', () => {
    render(<UserAvatar icon="avatar_42_1234567890.png" name="Plain Filename" />);

    const img = screen.getByAltText('Plain Filename');
    expect(img.getAttribute('src')).toMatch(/\/uploads\/avatar\/avatar_42_1234567890\.png$/);
  });

  it('renders fallback (no img src) when icon is an empty string', () => {
    const { container } = render(<UserAvatar icon="" name="No Avatar" showLabel={false} />);
    const imgs = container.querySelectorAll('img[src]');
    expect(imgs).toHaveLength(0);
  });

  it('renders fallback (no img src) when icon is undefined', () => {
    const { container } = render(<UserAvatar icon={undefined as any} name="No Avatar" showLabel={false} />);
    const imgs = container.querySelectorAll('img[src]');
    expect(imgs).toHaveLength(0);
  });

  it('does not add the upload prefix for a full URL (regression)', () => {
    const fullUrl = 'https://google.com/photo.jpg';
    render(<UserAvatar icon={fullUrl} name="Google User" />);

    const img = screen.getByAltText('Google User');
    expect(img.getAttribute('src')).not.toContain('/uploads/avatar/');
    expect(img.getAttribute('src')).toBe(fullUrl);
  });
});

// ─── alt text ─────────────────────────────────────────────────────────────────

describe('UserAvatar – alt text', () => {
  it('uses name as img alt text when name is provided', () => {
    render(<UserAvatar icon="photo.jpg" name="Anna Schmidt" />);
    expect(screen.getByAltText('Anna Schmidt')).toBeInTheDocument();
  });

  it('falls back to "Avatar" as alt text when name is an empty string', () => {
    render(<UserAvatar icon="photo.jpg" name="" />);
    expect(screen.getByAltText('Avatar')).toBeInTheDocument();
  });
});

// ─── initials ─────────────────────────────────────────────────────────────────

describe('UserAvatar – initials fallback', () => {
  it('shows initials inside Avatar when icon is empty and name has two words', () => {
    render(<UserAvatar icon="" name="Max Muster" showLabel={false} />);
    expect(screen.getByText('MM')).toBeInTheDocument();
  });

  it('shows single initial when name has one word', () => {
    render(<UserAvatar icon="" name="Max" showLabel={false} />);
    expect(screen.getByText('M')).toBeInTheDocument();
  });

  it('limits initials to two characters for names with more than two words', () => {
    render(<UserAvatar icon="" name="Max Paul Muster" showLabel={false} />);
    expect(screen.getByText('MP')).toBeInTheDocument();
  });

  it('renders initials in uppercase', () => {
    render(<UserAvatar icon="" name="anna böhm" showLabel={false} />);
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('renders no initials text when name is empty (falls back to icon)', () => {
    const { container } = render(<UserAvatar icon="" name="" />);
    // No initials text and no img src – only the fallback icon is rendered
    const imgs = container.querySelectorAll('img[src]');
    expect(imgs).toHaveLength(0);
  });
});

// ─── showLabel ────────────────────────────────────────────────────────────────

describe('UserAvatar – showLabel prop', () => {
  it('shows the name label by default (showLabel defaults to true)', () => {
    render(<UserAvatar icon="photo.jpg" name="Max Muster" />);
    expect(screen.getByText('Max Muster')).toBeInTheDocument();
  });

  it('shows the name label when showLabel is explicitly true', () => {
    render(<UserAvatar icon="photo.jpg" name="Max Muster" showLabel={true} />);
    expect(screen.getByText('Max Muster')).toBeInTheDocument();
  });

  it('hides the name label when showLabel is false', () => {
    render(<UserAvatar icon="photo.jpg" name="Max Muster" showLabel={false} />);
    // The alt text still has the name on the img element, but no visible Typography text
    expect(screen.queryByText('Max Muster')).toBeNull();
  });

  it('does not render a label when name is an empty string even if showLabel is true', () => {
    const { container } = render(<UserAvatar icon="photo.jpg" name="" showLabel={true} />);
    // No Typography element with empty text expected
    const typographies = container.querySelectorAll('.MuiTypography-root');
    expect(typographies).toHaveLength(0);
  });
});
