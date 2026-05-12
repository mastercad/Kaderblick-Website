import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ButtonEditor } from '../ButtonEditor';
import type { QuickEventButton } from '../../../../modals/quick-event/types';

function makeButton(overrides: Partial<QuickEventButton> = {}): QuickEventButton {
  return {
    eventTypeCode: 'goal',
    label: 'Tor',
    radialItems: [],
    ...overrides,
  };
}

describe('ButtonEditor', () => {
  const noop = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it('renders label value in the TextField', () => {
    render(
      <ButtonEditor
        button={makeButton({ label: 'Mein Button' })}
        index={0}
        total={1}
        onChange={noop}
        onMoveUp={noop}
        onMoveDown={noop}
        onRemove={noop}
      />
    );
    expect(screen.getByDisplayValue('Mein Button')).toBeInTheDocument();
  });

  it('renders label text field with current value', () => {
    render(
      <ButtonEditor
        button={makeButton({ label: 'Freistoß' })}
        index={0}
        total={1}
        onChange={noop}
        onMoveUp={noop}
        onMoveDown={noop}
        onRemove={noop}
      />
    );
    expect(screen.getByDisplayValue('Freistoß')).toBeInTheDocument();
  });

  it('calls onChange when label is edited', () => {
    const onChange = jest.fn();
    render(
      <ButtonEditor
        button={makeButton({ label: 'Alt' })}
        index={0}
        total={1}
        onChange={onChange}
        onMoveUp={noop}
        onMoveDown={noop}
        onRemove={noop}
      />
    );
    const field = screen.getByDisplayValue('Alt');
    fireEvent.change(field, { target: { value: 'Neu' } });
    expect(onChange).toHaveBeenCalled();
    const updated: QuickEventButton = onChange.mock.calls[0][0];
    expect(updated.label).toBe('Neu');
  });

  it('calls onMoveUp when move-up button is clicked', () => {
    const onMoveUp = jest.fn();
    render(
      <ButtonEditor
        button={makeButton()}
        index={1}
        total={3}
        onChange={noop}
        onMoveUp={onMoveUp}
        onMoveDown={noop}
        onRemove={noop}
      />
    );
    // MUI Tooltip title is on the wrapping span, not the button — use the button title via Tooltip title text
    const allButtons = screen.getAllByRole('button');
    // First two buttons are up/down (icon buttons in that order)
    fireEvent.click(allButtons[0]); // ArrowUpward
    expect(onMoveUp).toHaveBeenCalledTimes(1);
  });

  it('calls onMoveDown when move-down button is clicked', () => {
    const onMoveDown = jest.fn();
    render(
      <ButtonEditor
        button={makeButton()}
        index={0}
        total={3}
        onChange={noop}
        onMoveUp={noop}
        onMoveDown={onMoveDown}
        onRemove={noop}
      />
    );
    const allButtons = screen.getAllByRole('button');
    // Second button is ArrowDownward
    fireEvent.click(allButtons[1]); // ArrowDownward
    expect(onMoveDown).toHaveBeenCalledTimes(1);
  });

  it('calls onRemove when remove button is clicked', () => {
    const onRemove = jest.fn();
    render(
      <ButtonEditor
        button={makeButton()}
        index={0}
        total={1}
        onChange={noop}
        onMoveUp={noop}
        onMoveDown={noop}
        onRemove={onRemove}
      />
    );
    // Remove button is the 3rd icon button (up, down, remove)
    const allButtons = screen.getAllByRole('button');
    fireEvent.click(allButtons[2]);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders radial items when present', () => {
    const button = makeButton({
      radialItems: [
        { eventTypeCode: 'header_goal', label: 'Kopfball' },
      ],
    });
    render(
      <ButtonEditor
        button={button}
        index={0}
        total={1}
        onChange={noop}
        onMoveUp={noop}
        onMoveDown={noop}
        onRemove={noop}
      />
    );
    expect(screen.getByDisplayValue('Kopfball')).toBeInTheDocument();
  });

  it('calls onChange with new radial item when "Long-Press-Option" is clicked', () => {
    const onChange = jest.fn();
    render(
      <ButtonEditor
        button={makeButton({ radialItems: [] })}
        index={0}
        total={1}
        onChange={onChange}
        onMoveUp={noop}
        onMoveDown={noop}
        onRemove={noop}
      />
    );
    // The Long-Press-Option button is the last button rendered (4th)
    const allButtons = screen.getAllByRole('button');
    fireEvent.click(allButtons[allButtons.length - 1]);
    expect(onChange).toHaveBeenCalled();
    const updated: QuickEventButton = onChange.mock.calls[0][0];
    expect(updated.radialItems).toHaveLength(1);
  });
});
