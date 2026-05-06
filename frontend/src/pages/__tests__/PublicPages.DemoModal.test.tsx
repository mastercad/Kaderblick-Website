/**
 * Tests für PricingOverview.tsx, FeaturesOverview.tsx, BenefitsOverview.tsx
 * Fokus: "Demo anfragen" öffnet DemoRequestModal, Modal kann geschlossen werden.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

// ── matchMedia ─────────────────────────────────────────────────────────────
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

// ── Mocks ──────────────────────────────────────────────────────────────────

// PublicSiteHeader: expose onOpenDemo as a button
jest.mock('../../components/public/PublicSiteHeader', () => ({
  __esModule: true,
  default: ({ onOpenDemo }: any) => (
    <div data-testid="public-site-header">
      <button data-testid="demo-btn" onClick={onOpenDemo}>Demo anfragen</button>
    </div>
  ),
}));

// DemoRequestModal: minimal open/close stub
jest.mock('../../modals/DemoRequestModal', () => ({
  __esModule: true,
  default: ({ open, onClose }: any) =>
    open ? (
      <div data-testid="demo-request-modal">
        <button data-testid="close-demo-modal" onClick={onClose}>Schließen</button>
      </div>
    ) : null,
}));

jest.mock('../../seo/Seo', () => ({
  __esModule: true,
  default: () => null,
}));

// Icon mocks
jest.mock('@mui/icons-material/ArrowForwardRounded',         () => () => null);
jest.mock('@mui/icons-material/CheckCircleOutlineRounded',   () => () => null);
jest.mock('@mui/icons-material/ArrowOutwardRounded',         () => () => null);
jest.mock('@mui/icons-material/InsightsOutlined',            () => () => null);
jest.mock('@mui/icons-material/MenuBookRounded',             () => () => null);
jest.mock('@mui/icons-material/TopicOutlined',               () => () => null);
jest.mock('@mui/icons-material/AccessTimeOutlined',          () => () => null);
jest.mock('@mui/icons-material/ForumOutlined',               () => () => null);
jest.mock('@mui/icons-material/Groups2Outlined',             () => () => null);
jest.mock('@mui/icons-material/ShieldOutlined',              () => () => null);
jest.mock('@mui/icons-material/LoginOutlined',               () => () => null);
jest.mock('@mui/icons-material/CalendarMonthOutlined',       () => () => null);
jest.mock('@mui/icons-material/ChecklistRtlOutlined',        () => () => null);
jest.mock('@mui/icons-material/QueryStatsOutlined',          () => () => null);
jest.mock('@mui/icons-material/AccountTreeOutlined',         () => () => null);
jest.mock('@mui/icons-material/BadgeOutlined',               () => () => null);
jest.mock('@mui/icons-material/CampaignOutlined',            () => () => null);

// marketing content (used by FeaturesOverview)
jest.mock('../../content/marketingContent', () => ({
  intentPages: [],
  marketingFeatures: [],
}));

// AuthModal (used by Home)
jest.mock('../../modals/AuthModal', () => ({
  __esModule: true,
  default: ({ open }: any) => open ? <div data-testid="auth-modal" /> : null,
}));

// HomeScrollContext (used by Home)
jest.mock('../../context/HomeScrollContext', () => ({
  useHomeScroll: () => ({ isOnHeroSection: false, setIsOnHeroSection: jest.fn() }),
}));

// ── Imports after mocks ────────────────────────────────────────────────────
import PricingOverview   from '../PricingOverview';
import FeaturesOverview  from '../FeaturesOverview';
import BenefitsOverview  from '../BenefitsOverview';
import Home              from '../Home';

// ── Helper ─────────────────────────────────────────────────────────────────
function renderInRouter(Component: React.ComponentType) {
  return render(
    <MemoryRouter>
      <Component />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PricingOverview – DemoRequestModal', () => {
  it('zeigt DemoRequestModal NICHT initial', () => {
    renderInRouter(PricingOverview);
    expect(screen.queryByTestId('demo-request-modal')).not.toBeInTheDocument();
  });

  it('öffnet DemoRequestModal wenn Demo-Button geklickt wird', async () => {
    renderInRouter(PricingOverview);
    fireEvent.click(screen.getByTestId('demo-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('demo-request-modal')).toBeInTheDocument();
    });
  });

  it('schließt DemoRequestModal wenn onClose aufgerufen wird', async () => {
    renderInRouter(PricingOverview);
    fireEvent.click(screen.getByTestId('demo-btn'));
    await waitFor(() => expect(screen.getByTestId('demo-request-modal')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('close-demo-modal'));
    await waitFor(() => {
      expect(screen.queryByTestId('demo-request-modal')).not.toBeInTheDocument();
    });
  });
});

describe('FeaturesOverview – DemoRequestModal', () => {
  it('zeigt DemoRequestModal NICHT initial', () => {
    renderInRouter(FeaturesOverview);
    expect(screen.queryByTestId('demo-request-modal')).not.toBeInTheDocument();
  });

  it('öffnet DemoRequestModal wenn Demo-Button geklickt wird', async () => {
    renderInRouter(FeaturesOverview);
    fireEvent.click(screen.getByTestId('demo-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('demo-request-modal')).toBeInTheDocument();
    });
  });

  it('schließt DemoRequestModal wenn onClose aufgerufen wird', async () => {
    renderInRouter(FeaturesOverview);
    fireEvent.click(screen.getByTestId('demo-btn'));
    await waitFor(() => expect(screen.getByTestId('demo-request-modal')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('close-demo-modal'));
    await waitFor(() => {
      expect(screen.queryByTestId('demo-request-modal')).not.toBeInTheDocument();
    });
  });
});

describe('BenefitsOverview – DemoRequestModal', () => {
  it('zeigt DemoRequestModal NICHT initial', () => {
    renderInRouter(BenefitsOverview);
    expect(screen.queryByTestId('demo-request-modal')).not.toBeInTheDocument();
  });

  it('öffnet DemoRequestModal wenn Demo-Button geklickt wird', async () => {
    renderInRouter(BenefitsOverview);
    fireEvent.click(screen.getByTestId('demo-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('demo-request-modal')).toBeInTheDocument();
    });
  });

  it('schließt DemoRequestModal wenn onClose aufgerufen wird', async () => {
    renderInRouter(BenefitsOverview);
    fireEvent.click(screen.getByTestId('demo-btn'));
    await waitFor(() => expect(screen.getByTestId('demo-request-modal')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('close-demo-modal'));
    await waitFor(() => {
      expect(screen.queryByTestId('demo-request-modal')).not.toBeInTheDocument();
    });
  });
});

describe('Home – DemoRequestModal', () => {
  it('zeigt DemoRequestModal NICHT initial', () => {
    renderInRouter(Home);
    expect(screen.queryByTestId('demo-request-modal')).not.toBeInTheDocument();
  });

  it('öffnet DemoRequestModal wenn Demo-Button geklickt wird', async () => {
    renderInRouter(Home);
    fireEvent.click(screen.getByTestId('demo-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('demo-request-modal')).toBeInTheDocument();
    });
  });

  it('schließt DemoRequestModal wenn onClose aufgerufen wird', async () => {
    renderInRouter(Home);
    fireEvent.click(screen.getByTestId('demo-btn'));
    await waitFor(() => expect(screen.getByTestId('demo-request-modal')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('close-demo-modal'));
    await waitFor(() => {
      expect(screen.queryByTestId('demo-request-modal')).not.toBeInTheDocument();
    });
  });
});
