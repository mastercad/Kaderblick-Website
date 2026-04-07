import React from 'react';
import { render, screen } from '@testing-library/react';
import { TabPanel } from '../../components/TabPanel';

describe('TabPanel', () => {
  it('renders children when value matches index', () => {
    render(<TabPanel value={1} index={1}><span>visible content</span></TabPanel>);
    expect(screen.getByText('visible content')).toBeInTheDocument();
  });

  it('does not render children when value does not match index', () => {
    render(<TabPanel value={0} index={1}><span>hidden content</span></TabPanel>);
    expect(screen.queryByText('hidden content')).not.toBeInTheDocument();
  });

  it('renders the container element with role=tabpanel regardless of match', () => {
    const { container } = render(<TabPanel value={0} index={1}><span>x</span></TabPanel>);
    // The outer Box has role="tabpanel" and is hidden
    expect(container.querySelector('[role="tabpanel"]')).toBeInTheDocument();
  });

  it('is visible when value === index and hidden when value !== index', () => {
    const { rerender } = render(<TabPanel value={0} index={0}><span>tab</span></TabPanel>);
    const panel = screen.getByRole('tabpanel');
    // hidden attribute should not be set when visible
    expect(panel).not.toHaveAttribute('hidden');

    rerender(<TabPanel value={1} index={0}><span>tab</span></TabPanel>);
    expect(screen.getByRole('tabpanel', { hidden: true })).toHaveAttribute('hidden');
  });
});
