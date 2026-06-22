import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeContext';
import * as storage from '../../services/localStorageService';

jest.mock('../ConsentContext', () => ({
  useConsent: () => ({ functionalAllowed: true }),
}));

jest.mock('../../services/cookieConsentService', () => ({
  isFunctionalAllowed: () => true,
}));

jest.mock('../../services/localStorageService', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const mockGetItem = storage.getItem as jest.MockedFunction<typeof storage.getItem>;
const mockSetItem = storage.setItem as jest.MockedFunction<typeof storage.setItem>;

let systemIsDark = true;
let systemListener: ((event: MediaQueryListEvent) => void) | undefined;

function Consumer() {
  const { mode, preference, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <span data-testid="preference">{preference}</span>
      <button onClick={() => setPreference('dark')}>Dunkel erzwingen</button>
    </div>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  systemIsDark = true;
  systemListener = undefined;
  mockGetItem.mockReturnValue(null);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: jest.fn(() => ({
      matches: systemIsDark,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => { systemListener = listener; },
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

describe('ThemeContext', () => {
  it('uses the operating-system mode by default', () => {
    render(<ThemeProvider><Consumer /></ThemeProvider>);
    expect(screen.getByTestId('preference')).toHaveTextContent('system');
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
    expect(mockSetItem).toHaveBeenCalledWith('theme-mode', 'system');
  });

  it('follows live operating-system changes while preference is system', () => {
    render(<ThemeProvider><Consumer /></ThemeProvider>);
    act(() => systemListener?.({ matches: false } as MediaQueryListEvent));
    expect(screen.getByTestId('mode')).toHaveTextContent('light');
  });

  it('keeps an explicit override when the operating system changes', () => {
    render(<ThemeProvider><Consumer /></ThemeProvider>);
    fireEvent.click(screen.getByText('Dunkel erzwingen'));
    act(() => systemListener?.({ matches: false } as MediaQueryListEvent));
    expect(screen.getByTestId('preference')).toHaveTextContent('dark');
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
  });
});
