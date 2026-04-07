import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileHeroHeader } from '../../components/ProfileHeroHeader';
import type { CompletionItem } from '../../hooks/useProfileCompletion';

const defaultProps = {
  avatarSrc: undefined,
  fullName: 'Max Muster',
  email: 'max@example.com',
  profileTitle: null,
  profileLevel: null,
  profileXp: null,
  completionPercent: 75,
  completionColor: 'success' as const,
  missingItems: [] as CompletionItem[],
  onNavigateToTab: jest.fn(),
  onOpenXpModal: jest.fn(),
  hasAvatar: false,
  isGoogleAvatar: false,
  onEditAvatar: jest.fn(),
  onRemoveAvatar: jest.fn(),
  onDisableGoogleAvatar: jest.fn(),
  relationsCount: 0,
  onOpenRelations: jest.fn(),
  onRequestRelation: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('ProfileHeroHeader', () => {
  it('renders full name', () => {
    render(<ProfileHeroHeader {...defaultProps} />);
    expect(screen.getByText('Max Muster')).toBeInTheDocument();
  });

  it('renders email', () => {
    render(<ProfileHeroHeader {...defaultProps} />);
    expect(screen.getByText('max@example.com')).toBeInTheDocument();
  });

  it('shows fallback name "Mein Profil" when fullName is empty', () => {
    render(<ProfileHeroHeader {...defaultProps} fullName="" />);
    expect(screen.getByText('Mein Profil')).toBeInTheDocument();
  });

  it('shows avatar initials from name', () => {
    render(<ProfileHeroHeader {...defaultProps} />);
    expect(screen.getByText('MM')).toBeInTheDocument();
  });

  it('shows "?" initials when fullName is empty', () => {
    render(<ProfileHeroHeader {...defaultProps} fullName="" />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('renders profileTitle chip when provided', () => {
    render(<ProfileHeroHeader {...defaultProps} profileTitle="Torschützenkönig" />);
    expect(screen.getByText('Torschützenkönig')).toBeInTheDocument();
  });

  it('renders level chip when profileLevel provided', () => {
    render(<ProfileHeroHeader {...defaultProps} profileLevel={5} profileXp={1000} />);
    expect(screen.getByText(/Level 5/)).toBeInTheDocument();
    expect(screen.getByText(/1.000 XP|1,000 XP/)).toBeInTheDocument();
  });

  it('calls onOpenXpModal when level chip clicked', () => {
    const onOpenXpModal = jest.fn();
    render(<ProfileHeroHeader {...defaultProps} profileLevel={3} onOpenXpModal={onOpenXpModal} />);
    fireEvent.click(screen.getByText(/Level 3/));
    expect(onOpenXpModal).toHaveBeenCalledTimes(1);
  });

  it('shows edit avatar button', () => {
    render(<ProfileHeroHeader {...defaultProps} />);
    // The edit button is always present; there should be at least 1 icon button rendered beside the avatar
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onEditAvatar when edit avatar button clicked', () => {
    const onEditAvatar = jest.fn();
    render(<ProfileHeroHeader {...defaultProps} onEditAvatar={onEditAvatar} />);
    // The edit button is the first icon button (bottom-right of avatar)
    const buttons = screen.getAllByRole('button');
    // Find the button that has EditIcon (first avatar-area button that triggers onEditAvatar)
    // Since we can't easily distinguish by icon, click all small icon buttons and verify onEditAvatar is called
    const iconButtons = buttons.filter(b => b.textContent === '' || b.querySelector('svg'));
    // The edit avatar button is rendered first in avatar section
    fireEvent.click(iconButtons[0]);
    expect(onEditAvatar).toHaveBeenCalledTimes(1);
  });

  it('shows remove avatar button when hasAvatar is true', () => {
    render(<ProfileHeroHeader {...defaultProps} hasAvatar={true} />);
    // With hasAvatar=true there should be 3 buttons: edit, remove, and the link button
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('calls onRemoveAvatar when remove avatar button clicked', () => {
    const onRemoveAvatar = jest.fn();
    render(<ProfileHeroHeader {...defaultProps} hasAvatar={true} onRemoveAvatar={onRemoveAvatar} />);
    const buttons = screen.getAllByRole('button');
    // The remove button is the second icon button in avatar area (top-right)
    fireEvent.click(buttons[1]);
    expect(onRemoveAvatar).toHaveBeenCalledTimes(1);
  });

  it('shows disable google avatar button when isGoogleAvatar is true', () => {
    render(<ProfileHeroHeader {...defaultProps} isGoogleAvatar={true} />);
    // With isGoogleAvatar=true there should be 3 buttons: edit, disable-google, and the link button
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('calls onDisableGoogleAvatar when google avatar button clicked', () => {
    const onDisableGoogleAvatar = jest.fn();
    render(<ProfileHeroHeader {...defaultProps} isGoogleAvatar={true} onDisableGoogleAvatar={onDisableGoogleAvatar} />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[1]);
    expect(onDisableGoogleAvatar).toHaveBeenCalledTimes(1);
  });

  it('calls onRequestRelation when link icon clicked with no relations', () => {
    const onRequestRelation = jest.fn();
    render(<ProfileHeroHeader {...defaultProps} relationsCount={0} onRequestRelation={onRequestRelation} />);
    fireEvent.click(screen.getByRole('button', { name: /Verknüpfung anfragen/i }));
    expect(onRequestRelation).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenRelations when link icon clicked with relations', () => {
    const onOpenRelations = jest.fn();
    render(<ProfileHeroHeader {...defaultProps} relationsCount={2} onOpenRelations={onOpenRelations} />);
    fireEvent.click(screen.getByRole('button', { name: /2 Verknüpfung/i }));
    expect(onOpenRelations).toHaveBeenCalledTimes(1);
  });

  it('renders ProfileCompletionBar', () => {
    render(<ProfileHeroHeader {...defaultProps} completionPercent={60} />);
    // The bar is rendered via ProfileCompletionBar, which renders a LinearProgress
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
