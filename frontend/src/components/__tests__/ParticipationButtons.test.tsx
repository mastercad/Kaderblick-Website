import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ParticipationButtons } from '../ParticipationButtons';
import type { ParticipationStatus, CurrentParticipation } from '../../types/participation';

const STATUSES: ParticipationStatus[] = [
  { id: 1, name: 'Zugesagt', code: 'yes', color: '#4caf50', sort_order: 1 },
  { id: 2, name: 'Abgesagt', code: 'no', color: '#f44336', sort_order: 2 },
  { id: 3, name: 'Vielleicht', code: 'maybe', color: '#ff9800', sort_order: 3 },
];

describe('ParticipationButtons (shared component)', () => {
  const onStatusClick = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when statuses is empty', () => {
    const { container } = render(
      <ParticipationButtons
        statuses={[]}
        currentParticipation={null}
        saving={false}
        onStatusClick={onStatusClick}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders one button per status', () => {
    render(
      <ParticipationButtons
        statuses={STATUSES}
        currentParticipation={null}
        saving={false}
        onStatusClick={onStatusClick}
      />,
    );
    expect(screen.getByRole('button', { name: 'Zugesagt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abgesagt' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vielleicht' })).toBeInTheDocument();
  });

  it('respects sort_order when rendering buttons', () => {
    const unordered: ParticipationStatus[] = [
      { id: 3, name: 'Vielleicht', sort_order: 3 },
      { id: 1, name: 'Zugesagt', sort_order: 1 },
      { id: 2, name: 'Abgesagt', sort_order: 2 },
    ];
    render(
      <ParticipationButtons
        statuses={unordered}
        currentParticipation={null}
        saving={false}
        onStatusClick={onStatusClick}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveAttribute('aria-label', 'Zugesagt');
    expect(buttons[1]).toHaveAttribute('aria-label', 'Abgesagt');
    expect(buttons[2]).toHaveAttribute('aria-label', 'Vielleicht');
  });

  it('calls onStatusClick with the correct status id when clicked', () => {
    render(
      <ParticipationButtons
        statuses={STATUSES}
        currentParticipation={null}
        saving={false}
        onStatusClick={onStatusClick}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Abgesagt' }));
    expect(onStatusClick).toHaveBeenCalledWith(2);
  });

  it('disables all buttons while saving', () => {
    render(
      <ParticipationButtons
        statuses={STATUSES}
        currentParticipation={null}
        saving={true}
        onStatusClick={onStatusClick}
      />,
    );
    screen.getAllByRole('button').forEach(btn => expect(btn).toBeDisabled());
  });

  it('does not disable buttons when not saving', () => {
    render(
      <ParticipationButtons
        statuses={STATUSES}
        currentParticipation={null}
        saving={false}
        onStatusClick={onStatusClick}
      />,
    );
    screen.getAllByRole('button').forEach(btn => expect(btn).not.toBeDisabled());
  });

  it('clicking an active status button still calls onStatusClick', () => {
    const current: CurrentParticipation = {
      statusId: 1,
      statusName: 'Zugesagt',
      color: '#4caf50',
    };
    render(
      <ParticipationButtons
        statuses={STATUSES}
        currentParticipation={current}
        saving={false}
        onStatusClick={onStatusClick}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zugesagt' }));
    expect(onStatusClick).toHaveBeenCalledWith(1);
  });

  it('works with statuses that have no code or sort_order', () => {
    const minimal: ParticipationStatus[] = [
      { id: 1, name: 'Ja' },
      { id: 2, name: 'Nein' },
    ];
    render(
      <ParticipationButtons
        statuses={minimal}
        currentParticipation={null}
        saving={false}
        onStatusClick={onStatusClick}
      />,
    );
    expect(screen.getByRole('button', { name: 'Ja' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nein' })).toBeInTheDocument();
  });
});
