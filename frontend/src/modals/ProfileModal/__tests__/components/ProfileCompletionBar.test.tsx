import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileCompletionBar } from '../../components/ProfileCompletionBar';
import type { CompletionItem } from '../../hooks/useProfileCompletion';

const noMissing: CompletionItem[] = [];

const threeMissing: CompletionItem[] = [
  { key: 'shirtSize', label: 'Trikotnummer', weight: 12, done: false, tab: 1 },
  { key: 'avatar',    label: 'Profilbild',   weight: 15, done: false, tab: 0 },
  { key: 'push',      label: 'Push-Benachrichtigungen', weight: 10, done: false, tab: 2 },
];

const fourMissing: CompletionItem[] = [
  ...threeMissing,
  { key: 'height', label: 'Körpergröße', weight: 8, done: false, tab: 0 },
];

describe('ProfileCompletionBar', () => {
  it('renders the completion percentage', () => {
    render(<ProfileCompletionBar percent={72} color="warning" missing={noMissing} onNavigateToTab={jest.fn()} />);
    expect(screen.getByText('72%')).toBeInTheDocument();
  });

  it('shows "Profil vollständig" when there are no missing items', () => {
    render(<ProfileCompletionBar percent={100} color="success" missing={noMissing} onNavigateToTab={jest.fn()} />);
    expect(screen.getByText('Profil vollständig')).toBeInTheDocument();
  });

  it('shows missing item labels when items are missing', () => {
    render(<ProfileCompletionBar percent={30} color="error" missing={threeMissing} onNavigateToTab={jest.fn()} />);
    expect(screen.getByText('Trikotnummer')).toBeInTheDocument();
    expect(screen.getByText('Profilbild')).toBeInTheDocument();
  });

  it('shows "+N weitere" when more than 3 items are missing', () => {
    render(<ProfileCompletionBar percent={10} color="error" missing={fourMissing} onNavigateToTab={jest.fn()} />);
    expect(screen.getByText(/\+1 weitere/)).toBeInTheDocument();
  });

  it('calls onNavigateToTab with the correct tab when a missing item is clicked', () => {
    const onNavigateToTab = jest.fn();
    render(<ProfileCompletionBar percent={30} color="error" missing={threeMissing} onNavigateToTab={onNavigateToTab} />);
    // 'Profilbild' → tab 0
    fireEvent.click(screen.getByText('Profilbild'));
    expect(onNavigateToTab).toHaveBeenCalledWith(0);
  });
});
