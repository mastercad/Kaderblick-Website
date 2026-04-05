/**
 * Unit tests for TrainingEditScopeModal (2-step wizard)
 *
 * Step 1 – scope selector:
 *  - "Nur dieses Training" → calls onConfirm('single') immediately (no step 2)
 *  - all other scope buttons → navigate to step 2
 *  - "Abbrechen" → calls onClose
 *  - weekdayLabel controls visibility of weekday-specific buttons
 *  - all buttons disabled when loading=true
 *
 * Step 2 – until-date picker:
 *  - default radio is "Bis Ende der Serie"
 *  - "Speichern" with default → onConfirm(scope, undefined)
 *  - selecting "Bis einschließlich" shows date input
 *  - "Speichern" with date → onConfirm(scope, 'YYYY-MM-DD')
 *  - "Speichern" disabled when mode=date but no date entered
 *  - "Zurück" → back to step 1
 *
 * State reset:
 *  - wizard resets to step 1 when modal is closed/reopened
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TrainingEditScopeModal, TrainingEditScope } from '../TrainingEditScopeModal';

function renderModal(props: Partial<React.ComponentProps<typeof TrainingEditScopeModal>> = {}) {
  const onClose = jest.fn();
  const onConfirm = jest.fn();

  const result = render(
    <TrainingEditScopeModal
      open={props.open ?? true}
      onClose={props.onClose ?? onClose}
      onConfirm={props.onConfirm ?? onConfirm}
      loading={props.loading ?? false}
      weekdayLabel={props.weekdayLabel}
    />
  );

  return { ...result, onClose, onConfirm };
}

describe('TrainingEditScopeModal', () => {
  // ─── Visibility ──────────────────────────────────────────────────────────

  it('does not render dialog content when open=false', () => {
    renderModal({ open: false });
    expect(screen.queryByText('Nur dieses Training')).not.toBeInTheDocument();
  });

  it('renders dialog title when open=true', () => {
    renderModal({ open: true });
    expect(screen.getByText('Training bearbeiten')).toBeInTheDocument();
  });

  // ─── Step 1: button presence ──────────────────────────────────────────────

  it('shows 5 scope buttons (step 1) when weekdayLabel is provided', () => {
    renderModal({ weekdayLabel: 'Dienstag' });

    expect(screen.getByText('Nur dieses Training')).toBeInTheDocument();
    expect(screen.getByText('Alle Dienstag-Trainings ab diesem')).toBeInTheDocument();
    expect(screen.getByText('Dieses und alle folgenden Trainings')).toBeInTheDocument();
    expect(screen.getByText('Alle Dienstag-Trainings dieser Serie')).toBeInTheDocument();
    expect(screen.getByText('Die gesamte Trainingsserie')).toBeInTheDocument();
  });

  it('shows 3 scope buttons (step 1) when weekdayLabel is absent', () => {
    renderModal({ weekdayLabel: undefined });

    expect(screen.getByText('Nur dieses Training')).toBeInTheDocument();
    expect(screen.queryByText(/ab diesem/)).not.toBeInTheDocument();
    expect(screen.getByText('Dieses und alle folgenden Trainings')).toBeInTheDocument();
    expect(screen.queryByText(/dieser Serie/)).not.toBeInTheDocument();
    expect(screen.getByText('Die gesamte Trainingsserie')).toBeInTheDocument();
  });

  it('shows cancel button in step 1', () => {
    renderModal();
    expect(screen.getByText('Abbrechen')).toBeInTheDocument();
  });

  // ─── Step 1: "single" confirms immediately ────────────────────────────────

  it('calls onConfirm("single", undefined) immediately for "Nur dieses Training"', () => {
    const { onConfirm } = renderModal({ weekdayLabel: 'Dienstag' });
    fireEvent.click(screen.getByText('Nur dieses Training'));
    expect(onConfirm).toHaveBeenCalledWith('single', undefined);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does NOT show step 2 after clicking "Nur dieses Training"', () => {
    renderModal({ weekdayLabel: 'Dienstag' });
    fireEvent.click(screen.getByText('Nur dieses Training'));
    // step 2 indicator not visible
    expect(screen.queryByText('Bis wann soll die Änderung gelten?')).not.toBeInTheDocument();
  });

  // ─── Step 1: non-single scopes navigate to step 2 ────────────────────────

  it.each([
    ['Alle Dienstag-Trainings ab diesem',    'same_weekday_from_here'],
    ['Dieses und alle folgenden Trainings',  'from_here'],
    ['Alle Dienstag-Trainings dieser Serie', 'same_weekday'],
    ['Die gesamte Trainingsserie',           'series'],
  ] as [string, TrainingEditScope][])(
    '"%s" navigates to step 2 (not calling onConfirm yet)',
    (label, _scope) => {
      const { onConfirm } = renderModal({ weekdayLabel: 'Dienstag' });
      fireEvent.click(screen.getByText(label));

      expect(screen.getByText('Bis wann soll die Änderung gelten?')).toBeInTheDocument();
      expect(onConfirm).not.toHaveBeenCalled();
    }
  );

  // ─── Step 1: cancel ───────────────────────────────────────────────────────

  it('calls onClose when "Abbrechen" is clicked', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onConfirm when cancel is clicked', () => {
    const { onConfirm } = renderModal();
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // ─── Step 1: loading state ────────────────────────────────────────────────

  it('disables all step-1 buttons when loading=true', () => {
    renderModal({ loading: true, weekdayLabel: 'Montag' });

    [
      'Nur dieses Training',
      'Alle Montag-Trainings ab diesem',
      'Dieses und alle folgenden Trainings',
      'Alle Montag-Trainings dieser Serie',
      'Die gesamte Trainingsserie',
      'Abbrechen',
    ].forEach(label => {
      expect(screen.getByText(label)).toBeDisabled();
    });
  });

  it('does not disable buttons when loading=false', () => {
    renderModal({ loading: false, weekdayLabel: 'Montag' });
    expect(screen.getByText('Nur dieses Training')).not.toBeDisabled();
    expect(screen.getByText('Die gesamte Trainingsserie')).not.toBeDisabled();
  });

  // ─── Step 1: weekdayLabel content ────────────────────────────────────────

  it.each([
    ['Montag'], ['Dienstag'], ['Mittwoch'],
    ['Donnerstag'], ['Freitag'], ['Samstag'], ['Sonntag'],
  ])('shows correct weekday "%s" in weekday scope buttons', (weekday) => {
    renderModal({ weekdayLabel: weekday });
    expect(screen.getByText(`Alle ${weekday}-Trainings ab diesem`)).toBeInTheDocument();
    expect(screen.getByText(`Alle ${weekday}-Trainings dieser Serie`)).toBeInTheDocument();
  });

  // ─── Step 2: default state ────────────────────────────────────────────────

  it('shows "Bis Ende der Serie" pre-selected in step 2', () => {
    renderModal({ weekdayLabel: 'Dienstag' });
    fireEvent.click(screen.getByText('Dieses und alle folgenden Trainings'));

    const radio = screen.getByRole('radio', { name: 'Bis Ende der Serie' });
    expect(radio).toBeChecked();
  });

  it('hides date input by default in step 2', () => {
    renderModal({ weekdayLabel: 'Dienstag' });
    fireEvent.click(screen.getByText('Die gesamte Trainingsserie'));
    expect(screen.queryByLabelText('Enddatum')).not.toBeInTheDocument();
  });

  it('shows "Zurück" and "Speichern" buttons in step 2', () => {
    renderModal();
    fireEvent.click(screen.getByText('Dieses und alle folgenden Trainings'));
    expect(screen.getByText('Zurück')).toBeInTheDocument();
    expect(screen.getByText('Speichern')).toBeInTheDocument();
  });

  // ─── Step 2: confirm with "Bis Ende der Serie" ────────────────────────────

  it.each([
    ['Alle Dienstag-Trainings ab diesem',    'same_weekday_from_here'],
    ['Dieses und alle folgenden Trainings',  'from_here'],
    ['Alle Dienstag-Trainings dieser Serie', 'same_weekday'],
    ['Die gesamte Trainingsserie',           'series'],
  ] as [string, TrainingEditScope][])(
    'clicking "Speichern" in step 2 calls onConfirm(%s, undefined) when "Bis Ende der Serie"',
    (label, scope) => {
      const { onConfirm } = renderModal({ weekdayLabel: 'Dienstag' });
      fireEvent.click(screen.getByText(label));
      fireEvent.click(screen.getByText('Speichern'));
      expect(onConfirm).toHaveBeenCalledWith(scope, undefined);
    }
  );

  // ─── Step 2: confirm with a specific date ────────────────────────────────

  it('shows date input when "Bis einschließlich" is selected', () => {
    renderModal();
    fireEvent.click(screen.getByText('Dieses und alle folgenden Trainings'));
    fireEvent.click(screen.getByRole('radio', { name: 'Bis einschließlich:' }));
    expect(screen.getByLabelText('Enddatum')).toBeInTheDocument();
  });

  it('"Speichern" is disabled when date mode selected but no date entered', () => {
    renderModal();
    fireEvent.click(screen.getByText('Dieses und alle folgenden Trainings'));
    fireEvent.click(screen.getByRole('radio', { name: 'Bis einschließlich:' }));
    expect(screen.getByText('Speichern')).toBeDisabled();
  });

  it('calls onConfirm with untilDate when date mode + date entered', () => {
    const { onConfirm } = renderModal({ weekdayLabel: 'Donnerstag' });
    fireEvent.click(screen.getByText('Alle Donnerstag-Trainings ab diesem'));
    fireEvent.click(screen.getByRole('radio', { name: 'Bis einschließlich:' }));
    fireEvent.change(screen.getByLabelText('Enddatum'), { target: { value: '2026-09-30' } });
    fireEvent.click(screen.getByText('Speichern'));
    expect(onConfirm).toHaveBeenCalledWith('same_weekday_from_here', '2026-09-30');
  });

  // ─── Step 2: "Zurück" navigation ──────────────────────────────────────────

  it('"Zurück" returns to step 1', () => {
    renderModal();
    fireEvent.click(screen.getByText('Dieses und alle folgenden Trainings'));
    expect(screen.getByText('Bis wann soll die Änderung gelten?')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Zurück'));
    expect(screen.getByText('Diese Änderung gilt für …')).toBeInTheDocument();
    expect(screen.queryByText('Bis wann soll die Änderung gelten?')).not.toBeInTheDocument();
  });

  // ─── Step 2: loading state ────────────────────────────────────────────────

  it('disables step-2 buttons and radios when loading=true', () => {
    // We need to start with loading=false to click through to step 2, then rerender with loading=true
    const { rerender, onConfirm } = renderModal({ loading: false });
    fireEvent.click(screen.getByText('Dieses und alle folgenden Trainings'));

    rerender(
      <TrainingEditScopeModal
        open={true}
        onClose={jest.fn()}
        onConfirm={onConfirm}
        loading={true}
      />
    );

    expect(screen.getByText('Zurück')).toBeDisabled();
    expect(screen.getByText('Speichern')).toBeDisabled();
  });

  // ─── State reset on close/reopen ─────────────────────────────────────────

  it('resets to step 1 when modal is closed and reopened', async () => {
    const { rerender, onConfirm } = renderModal({ open: true });
    // Go to step 2
    fireEvent.click(screen.getByText('Dieses und alle folgenden Trainings'));
    expect(screen.getByText('Bis wann soll die Änderung gelten?')).toBeInTheDocument();

    // Close modal
    rerender(
      <TrainingEditScopeModal open={false} onClose={jest.fn()} onConfirm={onConfirm} />
    );

    // Reopen
    rerender(
      <TrainingEditScopeModal open={true} onClose={jest.fn()} onConfirm={onConfirm} />
    );

    await waitFor(() => {
      expect(screen.getByText('Diese Änderung gilt für …')).toBeInTheDocument();
    });
    expect(screen.queryByText('Bis wann soll die Änderung gelten?')).not.toBeInTheDocument();
  });
});
