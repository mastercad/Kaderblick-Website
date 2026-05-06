/**
 * Tests für UserRelations/index.tsx
 * Fokus: Tab 3 "Demo-Anfragen" (neue Ergänzung), Badge mit pending-Count,
 *        URL-Parameter-Auflösung für tab=demo-requests.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

// ── matchMedia ────────────────────────────────────────────────────────────────
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

// ── Icon mocks ────────────────────────────────────────────────────────────────
jest.mock('@mui/icons-material/ManageAccounts', () => () => null);

// ── Sub-component mocks ───────────────────────────────────────────────────────
jest.mock('../UsersTab', () => ({
  __esModule: true,
  default: () => <div data-testid="users-tab" />,
}));

jest.mock('../RequestsTab', () => ({
  __esModule: true,
  default: ({ onCountsChange }: any) => {
    React.useEffect(() => {
      onCountsChange?.({ pending: 0, approved: 0, rejected: 0 });
    }, []);
    return <div data-testid="requests-tab" />;
  },
}));

jest.mock('../SupporterRequestsTab', () => ({
  __esModule: true,
  default: ({ onCountsChange }: any) => {
    React.useEffect(() => {
      onCountsChange?.({ pending: 0, approved: 0, rejected: 0 });
    }, []);
    return <div data-testid="supporter-requests-tab" />;
  },
}));

jest.mock('../DemoRequestsTab', () => ({
  __esModule: true,
  default: ({ onCountsChange }: any) => {
    React.useEffect(() => {
      onCountsChange?.({ pending: 3, contacted: 1, rejected: 0 });
    }, []);
    return <div data-testid="demo-requests-tab" />;
  },
}));

jest.mock('../../../components/AdminPageLayout', () => ({
  AdminPageLayout: ({ children, filterControls }: any) => (
    <div data-testid="admin-page-layout">
      <div data-testid="filter-controls">{filterControls}</div>
      <div data-testid="layout-children">{children}</div>
    </div>
  ),
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import UserRelations from '../index';

function renderPage(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/admin/user-relations${search}`]}>
      <UserRelations />
    </MemoryRouter>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('UserRelations – Tab 3 Demo-Anfragen', () => {
  it('zeigt den "Demo-Anfragen" Tab', () => {
    renderPage();
    expect(screen.getByText('Demo-Anfragen')).toBeInTheDocument();
  });

  it('aktiviert Tab 3 wenn URL ?tab=demo-requests enthält', () => {
    renderPage('?tab=demo-requests');
    expect(screen.getByTestId('demo-requests-tab')).toBeInTheDocument();
  });

  it('zeigt DemoRequestsTab wenn Tab 3 angeklickt wird', async () => {
    renderPage();
    // Default ist Tab 0 (Benutzer & Zuordnungen)
    expect(screen.queryByTestId('demo-requests-tab')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Demo-Anfragen'));
    await waitFor(() => {
      expect(screen.getByTestId('demo-requests-tab')).toBeInTheDocument();
    });
  });

  it('zeigt pending-Badge für Demo-Anfragen wenn Anzahl > 0', async () => {
    renderPage('?tab=demo-requests');
    // DemoRequestsTab mock ruft onCountsChange({ pending: 3, ... }) auf
    await waitFor(() => {
      // Badge-Content "3" soll sichtbar sein
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('zeigt DemoRequestsTab NICHT wenn Tab 0 aktiv ist', () => {
    renderPage();
    expect(screen.queryByTestId('demo-requests-tab')).not.toBeInTheDocument();
  });
});

describe('UserRelations – Standard-Tabs', () => {
  it('zeigt UsersTab standardmäßig (Tab 0)', () => {
    renderPage();
    expect(screen.getByTestId('users-tab')).toBeInTheDocument();
  });

  it('zeigt alle vier Tab-Labels', () => {
    renderPage();
    expect(screen.getByText('Benutzer & Zuordnungen')).toBeInTheDocument();
    expect(screen.getByText('Registrierungsanfragen')).toBeInTheDocument();
    expect(screen.getByText('Supporter-Anfragen')).toBeInTheDocument();
    expect(screen.getByText('Demo-Anfragen')).toBeInTheDocument();
  });
});
