import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TaskDeletionModal } from '../TaskDeletionModal';

const noop = () => {};

describe('TaskDeletionModal', () => {
  // ── visibility ──────────────────────────────────────────────────────────────

  it('does not render when open=false', () => {
    render(
      <TaskDeletionModal
        open={false}
        onClose={noop}
        onDeleteSingle={noop}
        onDeleteSeries={noop}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders title and message when open=true', () => {
    render(
      <TaskDeletionModal
        open={true}
        onClose={noop}
        onDeleteSingle={noop}
        onDeleteSeries={noop}
        title="Training löschen"
        message="Welche Termine möchten Sie löschen?"
      />
    );
    expect(screen.getByText('Training löschen')).toBeInTheDocument();
    expect(screen.getByText('Welche Termine möchten Sie löschen?')).toBeInTheDocument();
  });

  // ── default two-button mode (task / no fromHereLabel) ──────────────────────

  it('shows single- and series-button but NOT from-here button when onDeleteFromHere is absent', () => {
    render(
      <TaskDeletionModal
        open={true}
        onClose={noop}
        onDeleteSingle={noop}
        onDeleteSeries={noop}
        singleLabel="Nur dieses Event"
        seriesLabel="Gesamte Serie"
      />
    );
    expect(screen.getByText('Nur dieses Event')).toBeInTheDocument();
    expect(screen.getByText('Gesamte Serie')).toBeInTheDocument();
    // "from here" button must not appear when prop is absent
    expect(screen.queryByText(/folgenden/i)).not.toBeInTheDocument();
  });

  it('shows from-here button when both onDeleteFromHere and fromHereLabel are provided', () => {
    render(
      <TaskDeletionModal
        open={true}
        onClose={noop}
        onDeleteSingle={noop}
        onDeleteFromHere={noop}
        onDeleteSeries={noop}
        singleLabel="Nur diesen Termin"
        fromHereLabel="Diesen und alle folgenden"
        seriesLabel="Gesamte Serie"
      />
    );
    expect(screen.getByText('Nur diesen Termin')).toBeInTheDocument();
    expect(screen.getByText('Diesen und alle folgenden')).toBeInTheDocument();
    expect(screen.getByText('Gesamte Serie')).toBeInTheDocument();
  });

  it('does NOT show from-here button when onDeleteFromHere is provided but fromHereLabel is absent', () => {
    render(
      <TaskDeletionModal
        open={true}
        onClose={noop}
        onDeleteSingle={noop}
        onDeleteFromHere={noop}
        onDeleteSeries={noop}
        singleLabel="Nur diesen Termin"
        seriesLabel="Gesamte Serie"
        // fromHereLabel intentionally absent
      />
    );
    // Only two action buttons besides "Abbrechen"
    expect(screen.getByText('Nur diesen Termin')).toBeInTheDocument();
    expect(screen.getByText('Gesamte Serie')).toBeInTheDocument();
    // No third button label
    expect(screen.queryByText(/folgenden/i)).not.toBeInTheDocument();
  });

  // ── callbacks ────────────────────────────────────────────────────────────────

  it('calls onClose when Abbrechen is clicked', () => {
    const onClose = jest.fn();
    render(
      <TaskDeletionModal
        open={true}
        onClose={onClose}
        onDeleteSingle={noop}
        onDeleteSeries={noop}
      />
    );
    fireEvent.click(screen.getByText('Abbrechen'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onDeleteSingle when single button is clicked', () => {
    const onDeleteSingle = jest.fn();
    render(
      <TaskDeletionModal
        open={true}
        onClose={noop}
        onDeleteSingle={onDeleteSingle}
        onDeleteSeries={noop}
        singleLabel="Nur diesen Termin"
      />
    );
    fireEvent.click(screen.getByText('Nur diesen Termin'));
    expect(onDeleteSingle).toHaveBeenCalledTimes(1);
  });

  it('calls onDeleteSeries when series button is clicked', () => {
    const onDeleteSeries = jest.fn();
    render(
      <TaskDeletionModal
        open={true}
        onClose={noop}
        onDeleteSingle={noop}
        onDeleteSeries={onDeleteSeries}
        seriesLabel="Gesamte Serie"
      />
    );
    fireEvent.click(screen.getByText('Gesamte Serie'));
    expect(onDeleteSeries).toHaveBeenCalledTimes(1);
  });

  it('calls onDeleteFromHere when from-here button is clicked', () => {
    const onDeleteFromHere = jest.fn();
    render(
      <TaskDeletionModal
        open={true}
        onClose={noop}
        onDeleteSingle={noop}
        onDeleteFromHere={onDeleteFromHere}
        onDeleteSeries={noop}
        fromHereLabel="Diesen und alle folgenden"
      />
    );
    fireEvent.click(screen.getByText('Diesen und alle folgenden'));
    expect(onDeleteFromHere).toHaveBeenCalledTimes(1);
  });

  // ── loading state ─────────────────────────────────────────────────────────

  it('disables all buttons when loading=true', () => {
    render(
      <TaskDeletionModal
        open={true}
        onClose={noop}
        onDeleteSingle={noop}
        onDeleteFromHere={noop}
        onDeleteSeries={noop}
        singleLabel="Nur diesen Termin"
        fromHereLabel="Diesen und alle folgenden"
        seriesLabel="Gesamte Serie"
        loading={true}
      />
    );
    expect(screen.getByText('Abbrechen')).toBeDisabled();
    expect(screen.getByText('Nur diesen Termin')).toBeDisabled();
    expect(screen.getByText('Diesen und alle folgenden')).toBeDisabled();
    expect(screen.getByText('Gesamte Serie')).toBeDisabled();
  });

  it('enables all buttons when loading=false', () => {
    render(
      <TaskDeletionModal
        open={true}
        onClose={noop}
        onDeleteSingle={noop}
        onDeleteFromHere={noop}
        onDeleteSeries={noop}
        singleLabel="Nur diesen Termin"
        fromHereLabel="Diesen und alle folgenden"
        seriesLabel="Gesamte Serie"
        loading={false}
      />
    );
    expect(screen.getByText('Abbrechen')).not.toBeDisabled();
    expect(screen.getByText('Nur diesen Termin')).not.toBeDisabled();
    expect(screen.getByText('Diesen und alle folgenden')).not.toBeDisabled();
    expect(screen.getByText('Gesamte Serie')).not.toBeDisabled();
  });

  // ── default labels ────────────────────────────────────────────────────────

  it('uses default labels when none are provided', () => {
    render(
      <TaskDeletionModal
        open={true}
        onClose={noop}
        onDeleteSingle={noop}
        onDeleteSeries={noop}
      />
    );
    expect(screen.getByText('Task löschen')).toBeInTheDocument();
    expect(screen.getByText('Möchten Sie nur dieses Event oder die gesamte Task-Serie löschen?')).toBeInTheDocument();
    expect(screen.getByText('Nur dieses Event')).toBeInTheDocument();
    expect(screen.getByText('Gesamte Serie')).toBeInTheDocument();
  });
});
