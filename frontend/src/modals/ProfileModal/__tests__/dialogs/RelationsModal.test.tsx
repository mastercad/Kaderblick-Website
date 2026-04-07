import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RelationsModal } from '../../dialogs/RelationsModal';
import type { UserRelation } from '../../types';

const defaultProps = {
  open: true,
  relations: [] as UserRelation[],
  onClose: jest.fn(),
  onRequestNew: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('RelationsModal', () => {
  it('renders dialog title', () => {
    render(<RelationsModal {...defaultProps} />);
    expect(screen.getByText('Verknüpfte Profile')).toBeInTheDocument();
  });

  it('shows empty state message when no relations', () => {
    render(<RelationsModal {...defaultProps} relations={[]} />);
    expect(screen.getByText(/Keine Verknüpfungen vorhanden/i)).toBeInTheDocument();
  });

  it('renders relation cards', () => {
    const relations: UserRelation[] = [
      { id: 1, fullName: 'Max Muster', category: 'player', identifier: 'p1', name: 'FC Test' },
      { id: 2, fullName: 'Lisa Trainer', category: 'coach', identifier: 'c1', name: 'FC Test' },
    ];
    render(<RelationsModal {...defaultProps} relations={relations} />);
    expect(screen.getByText('Max Muster')).toBeInTheDocument();
    expect(screen.getByText('Lisa Trainer')).toBeInTheDocument();
  });

  it('shows "Spieler" for player category', () => {
    const relations: UserRelation[] = [
      { id: 1, fullName: 'Max Muster', category: 'player', identifier: 'p1', name: 'FC Test' },
    ];
    render(<RelationsModal {...defaultProps} relations={relations} />);
    expect(screen.getByText(/Spieler/)).toBeInTheDocument();
  });

  it('shows "Trainer" for coach category', () => {
    const relations: UserRelation[] = [
      { id: 1, fullName: 'Lisa Coach', category: 'coach', identifier: 'c1', name: 'FC Test' },
    ];
    render(<RelationsModal {...defaultProps} relations={relations} />);
    expect(screen.getByText(/Trainer/)).toBeInTheDocument();
  });

  it('calls onRequestNew when "Weitere Verknüpfung" is clicked', () => {
    const onRequestNew = jest.fn();
    render(<RelationsModal {...defaultProps} onRequestNew={onRequestNew} />);
    fireEvent.click(screen.getByRole('button', { name: /Weitere Verknüpfung/i }));
    expect(onRequestNew).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Schließen is clicked', () => {
    const onClose = jest.fn();
    render(<RelationsModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Schließen/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
