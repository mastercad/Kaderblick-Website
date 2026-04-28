import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DetailSectionHeader from '../DetailSectionHeader';

// ── matchMedia mock (required by MUI useMediaQuery) ───────────────────────────
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const noop = jest.fn();

const defaultProps = {
  icon: <span data-testid="test-icon">⚽</span>,
  label: 'Spielereignisse',
  color: '#1976d2',
  open: true,
  onToggle: noop,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DetailSectionHeader', () => {
  beforeEach(() => {
    noop.mockReset();
  });

  it('renders the label', () => {
    render(<DetailSectionHeader {...defaultProps} />);
    expect(screen.getByText('Spielereignisse')).toBeInTheDocument();
  });

  it('renders the icon', () => {
    render(<DetailSectionHeader {...defaultProps} />);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('renders the count chip when count is provided as a number', () => {
    render(<DetailSectionHeader {...defaultProps} count={5} />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders the count chip when count is a string', () => {
    render(<DetailSectionHeader {...defaultProps} count="45 min" />);
    expect(screen.getByText('45 min')).toBeInTheDocument();
  });

  it('does not render a count chip when count is undefined', () => {
    const { container } = render(<DetailSectionHeader {...defaultProps} count={undefined} />);
    // Chip has role="presentation" by MUI — ensure the count value is not rendered
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('does not render a count chip when count is null', () => {
    render(<DetailSectionHeader {...defaultProps} count={null as any} />);
    // No numeric label should appear
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('renders the action slot when action is provided', () => {
    render(
      <DetailSectionHeader
        {...defaultProps}
        action={<button data-testid="custom-action">Add</button>}
      />
    );
    expect(screen.getByTestId('custom-action')).toBeInTheDocument();
  });

  it('does not render an action slot when action is absent', () => {
    render(<DetailSectionHeader {...defaultProps} />);
    expect(screen.queryByTestId('custom-action')).not.toBeInTheDocument();
  });

  it('applies the testId to the header container', () => {
    render(<DetailSectionHeader {...defaultProps} testId="my-section-header" />);
    expect(screen.getByTestId('my-section-header')).toBeInTheDocument();
  });

  it('calls onToggle when the header container is clicked', () => {
    render(<DetailSectionHeader {...defaultProps} testId="hdr" />);
    fireEvent.click(screen.getByTestId('hdr'));
    expect(noop).toHaveBeenCalledTimes(1);
  });

  it('calls onToggle when the expand icon button is clicked', () => {
    render(<DetailSectionHeader {...defaultProps} />);
    // Both the container and the button call onToggle; click only the button
    const btn = screen.getByRole('button');
    fireEvent.click(btn);
    // onToggle called once (button stopPropagation prevents second call from container)
    expect(noop).toHaveBeenCalledTimes(1);
  });

  it('shows aria-label "zuklappen" when open=true', () => {
    render(<DetailSectionHeader {...defaultProps} open={true} />);
    expect(screen.getByRole('button', { name: /zuklappen/i })).toBeInTheDocument();
  });

  it('shows aria-label "aufklappen" when open=false', () => {
    render(<DetailSectionHeader {...defaultProps} open={false} />);
    expect(screen.getByRole('button', { name: /aufklappen/i })).toBeInTheDocument();
  });

  it('does NOT call onToggle when the action area is clicked (stopPropagation)', () => {
    render(
      <DetailSectionHeader
        {...defaultProps}
        action={<button data-testid="action-btn">Action</button>}
      />
    );
    fireEvent.click(screen.getByTestId('action-btn'));
    expect(noop).not.toHaveBeenCalled();
  });
});
