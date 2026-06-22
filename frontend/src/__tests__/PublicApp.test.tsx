import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PublicApp from '../PublicApp';
import { useAuth } from '../context/AuthContext';

jest.mock('../context/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../components/CookieBanner', () => ({
  __esModule: true,
  default: () => <div data-testid="cookie-banner" />,
}));
jest.mock('../pages/Home', () => ({
  __esModule: true,
  default: () => <div data-testid="home-page" />,
}));
jest.mock('../modals/AuthModal', () => ({
  __esModule: true,
  default: ({ open, initialTab }: { open: boolean; initialTab: string }) => open
    ? <div data-testid="auth-modal" data-tab={initialTab} />
    : null,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('PublicApp', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: null } as ReturnType<typeof useAuth>);
    window.history.replaceState({}, '', '/');
  });

  it('rendert die Homepage ohne den privaten App-Baum', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <PublicApp />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('home-page')).toBeInTheDocument();
    expect(screen.getByTestId('cookie-banner')).toBeInTheDocument();
  });

  it('oeffnet die Registrierung ueber den bestehenden Deep-Link', async () => {
    window.history.replaceState({}, '', '/?modal=register');

    render(
      <MemoryRouter initialEntries={['/?modal=register']}>
        <PublicApp />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('auth-modal')).toHaveAttribute('data-tab', 'register'));
  });
});
