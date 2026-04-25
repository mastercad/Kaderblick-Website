import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeamBriefing } from '../TeamBriefing';

// ─────────────────────────────────────────────────────────────────────────────
// TeamBriefing
// ─────────────────────────────────────────────────────────────────────────────

describe('TeamBriefing – trigger button', () => {
  it('renders the "Team-Briefing" trigger button initially', () => {
    render(<TeamBriefing />);
    expect(screen.getByLabelText('Team-Briefing öffnen')).toBeInTheDocument();
  });

  it('does not show the full-screen overlay before clicking', () => {
    render(<TeamBriefing />);
    expect(screen.queryByText('Los geht\u2019s! \u26a1')).not.toBeInTheDocument();
  });
});

describe('TeamBriefing – full-screen overlay', () => {
  it('opens the overlay when the trigger button is clicked', () => {
    render(<TeamBriefing />);
    fireEvent.click(screen.getByLabelText('Team-Briefing öffnen'));
    expect(screen.getByText(/Los geht/i)).toBeInTheDocument();
  });

  it('hides the trigger button while the overlay is open', () => {
    render(<TeamBriefing />);
    fireEvent.click(screen.getByLabelText('Team-Briefing öffnen'));
    expect(screen.queryByLabelText('Team-Briefing öffnen')).not.toBeInTheDocument();
  });

  it('closes the overlay when "Los geht\'s!" is clicked', () => {
    render(<TeamBriefing />);
    fireEvent.click(screen.getByLabelText('Team-Briefing öffnen'));
    fireEvent.click(screen.getByText(/Los geht/i));
    expect(screen.queryByText(/Los geht/i)).not.toBeInTheDocument();
  });

  it('restores the trigger button after closing the overlay', () => {
    render(<TeamBriefing />);
    fireEvent.click(screen.getByLabelText('Team-Briefing öffnen'));
    fireEvent.click(screen.getByText(/Los geht/i));
    expect(screen.getByLabelText('Team-Briefing öffnen')).toBeInTheDocument();
  });

  it('renders reminder items inside the overlay', () => {
    render(<TeamBriefing />);
    fireEvent.click(screen.getByLabelText('Team-Briefing öffnen'));
    // At least one reminder text is shown
    expect(screen.getByText(/Schulterblick/i)).toBeInTheDocument();
  });

  it('renders motivational header text inside the overlay', () => {
    render(<TeamBriefing />);
    fireEvent.click(screen.getByLabelText('Team-Briefing öffnen'));
    expect(screen.getByText('Fokus. Wille. Vollgas.')).toBeInTheDocument();
  });
});

describe('TeamBriefing – onLosgehts callback', () => {
  it('calls onLosgehts when "Los geht\'s!" is clicked', () => {
    const onLosgehts = jest.fn();
    render(<TeamBriefing onLosgehts={onLosgehts} />);
    fireEvent.click(screen.getByLabelText('Team-Briefing öffnen'));
    fireEvent.click(screen.getByText(/Los geht/i));
    expect(onLosgehts).toHaveBeenCalledTimes(1);
  });

  it('closes the overlay AND calls onLosgehts', () => {
    const onLosgehts = jest.fn();
    render(<TeamBriefing onLosgehts={onLosgehts} />);
    fireEvent.click(screen.getByLabelText('Team-Briefing öffnen'));
    fireEvent.click(screen.getByText(/Los geht/i));

    expect(onLosgehts).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Los geht/i)).not.toBeInTheDocument();
  });

  it('does not throw when onLosgehts is not provided', () => {
    render(<TeamBriefing />);
    fireEvent.click(screen.getByLabelText('Team-Briefing öffnen'));
    expect(() => fireEvent.click(screen.getByText(/Los geht/i))).not.toThrow();
  });

  it('can be opened again after onLosgehts closes it', () => {
    const onLosgehts = jest.fn();
    render(<TeamBriefing onLosgehts={onLosgehts} />);

    // first cycle
    fireEvent.click(screen.getByLabelText('Team-Briefing öffnen'));
    fireEvent.click(screen.getByText(/Los geht/i));

    // second cycle – trigger must be visible again
    expect(screen.getByLabelText('Team-Briefing öffnen')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Team-Briefing öffnen'));
    expect(screen.getByText(/Los geht/i)).toBeInTheDocument();
  });
});
