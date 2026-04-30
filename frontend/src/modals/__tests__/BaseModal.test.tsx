import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import BaseModal from '../BaseModal';

// ── useMediaQuery mock – default: Desktop (isMobile = false) ──────────────────
let mockIsMobile = false;
jest.mock('@mui/material/useMediaQuery', () => ({
  __esModule: true,
  default: jest.fn(() => mockIsMobile),
}));

// ── FabStackProvider mock ─────────────────────────────────────────────────────
jest.mock('../../components/FabStackProvider', () => ({
  useFabStack: () => ({
    hideForModal: jest.fn(),
    showAfterModal: jest.fn(),
    hidden: false,
    fabs: [],
    addFab: jest.fn(),
    removeFab: jest.fn(),
  }),
}));

// ── Hilfsfunktion ─────────────────────────────────────────────────────────────
const getActionsContainer = () =>
  screen.getByTestId('modal-actions').parentElement as HTMLElement;

const renderModal = (props: Partial<React.ComponentProps<typeof BaseModal>> = {}) =>
  render(
    <BaseModal
      open={true}
      onClose={jest.fn()}
      title="Testtitel"
      actions={<div data-testid="modal-actions">Aktionen</div>}
      {...props}
    >
      <p>Inhalt</p>
    </BaseModal>,
  );

// ── Hilfsfunktion: style des DialogActions-Elements auslesen ──────────────────
// MUI rendert DialogActions als <div class="MuiDialogActions-root ...">
// Der sx-Callback setzt position:fixed nur in bestimmten Kombinationen.
// Da jsdom keine echten CSS-Berechnungen kennt, prüfen wir den MUI sx-Output
// über den gerenderten style-Attribut (MUI schreibt inline-styles via emotion).
const getActionsEl = () =>
  screen.getByTestId('modal-actions').closest('.MuiDialogActions-root') as HTMLElement;

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockIsMobile = false;
  jest.clearAllMocks();
});

// ── Rendering ─────────────────────────────────────────────────────────────────

describe('BaseModal – Rendering', () => {
  it('rendert Titel wenn title-Prop gesetzt', () => {
    renderModal({ title: 'Mein Titel' });
    expect(screen.getByText('Mein Titel')).toBeInTheDocument();
  });

  it('rendert keinen DialogTitle wenn title fehlt', () => {
    renderModal({ title: undefined });
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('rendert children', () => {
    renderModal();
    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });

  it('rendert actions wenn übergeben', () => {
    renderModal();
    expect(screen.getByTestId('modal-actions')).toBeInTheDocument();
  });

  it('rendert keine actions wenn nicht übergeben', () => {
    renderModal({ actions: undefined });
    expect(screen.queryByTestId('modal-actions')).not.toBeInTheDocument();
  });

  it('rendert Close-Button wenn showCloseButton=true (Default)', () => {
    renderModal();
    expect(screen.getByLabelText('close')).toBeInTheDocument();
  });

  it('rendert keinen Close-Button wenn showCloseButton=false', () => {
    renderModal({ showCloseButton: false });
    expect(screen.queryByLabelText('close')).not.toBeInTheDocument();
  });

  it('ruft onClose beim Klick auf Close-Button auf', async () => {
    const onClose = jest.fn();
    renderModal({ onClose });
    await userEvent.click(screen.getByLabelText('close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ── DialogActions: fixed vs. inline ──────────────────────────────────────────

describe('BaseModal – DialogActions Position', () => {
  // ── fullScreen=true ───────────────────────────────────────────────────────

  describe('fullScreen=true', () => {
    it('setzt position:fixed auf DialogActions', () => {
      mockIsMobile = false;
      renderModal({ fullScreen: true });
      const el = getActionsEl();
      expect(el).toHaveStyle({ position: 'fixed' });
    });

    it('setzt position:fixed auch auf Mobile', () => {
      mockIsMobile = true;
      renderModal({ fullScreen: true });
      const el = getActionsEl();
      expect(el).toHaveStyle({ position: 'fixed' });
    });
  });

  // ── Mobile + maxWidth='lg' (wird automatisch fullscreen) ──────────────────

  describe('Mobile + maxWidth="lg"', () => {
    it('setzt position:fixed auf DialogActions', () => {
      mockIsMobile = true;
      renderModal({ maxWidth: 'lg', fullScreen: false });
      const el = getActionsEl();
      expect(el).toHaveStyle({ position: 'fixed' });
    });
  });

  // ── Kleine Dialoge auf Mobile dürfen KEIN fixed bekommen ─────────────────

  describe('Mobile + kleine maxWidth (xs, sm, md) → kein fixed', () => {
    it('setzt kein position:fixed für maxWidth="xs" auf Mobile', () => {
      mockIsMobile = true;
      renderModal({ maxWidth: 'xs', fullScreen: false });
      const el = getActionsEl();
      expect(el).not.toHaveStyle({ position: 'fixed' });
    });

    it('setzt kein position:fixed für maxWidth="sm" auf Mobile', () => {
      mockIsMobile = true;
      renderModal({ maxWidth: 'sm', fullScreen: false });
      const el = getActionsEl();
      expect(el).not.toHaveStyle({ position: 'fixed' });
    });

    it('setzt kein position:fixed für maxWidth="md" auf Mobile', () => {
      mockIsMobile = true;
      renderModal({ maxWidth: 'md', fullScreen: false });
      const el = getActionsEl();
      expect(el).not.toHaveStyle({ position: 'fixed' });
    });
  });

  // ── Desktop: niemals fixed, egal welche maxWidth ──────────────────────────

  describe('Desktop → niemals position:fixed', () => {
    it('kein fixed für maxWidth="lg" auf Desktop', () => {
      mockIsMobile = false;
      renderModal({ maxWidth: 'lg', fullScreen: false });
      const el = getActionsEl();
      expect(el).not.toHaveStyle({ position: 'fixed' });
    });

    it('kein fixed für maxWidth="xs" auf Desktop', () => {
      mockIsMobile = false;
      renderModal({ maxWidth: 'xs', fullScreen: false });
      const el = getActionsEl();
      expect(el).not.toHaveStyle({ position: 'fixed' });
    });
  });
});

// ── DialogContent padding-bottom ──────────────────────────────────────────────

describe('BaseModal – DialogContent padding-bottom', () => {
  it('ist 84px wenn fullScreen=true und actions vorhanden', () => {
    renderModal({ fullScreen: true });
    const content = document.querySelector('.MuiDialogContent-root') as HTMLElement;
    expect(content).toHaveStyle({ paddingBottom: '84px' });
  });

  it('ist 84px wenn Mobile + maxWidth="lg" und actions vorhanden', () => {
    mockIsMobile = true;
    renderModal({ maxWidth: 'lg', fullScreen: false });
    const content = document.querySelector('.MuiDialogContent-root') as HTMLElement;
    expect(content).toHaveStyle({ paddingBottom: '84px' });
  });

  it('ist 16px (2 * 8px) wenn maxWidth="xs" auf Mobile (kein fixed)', () => {
    mockIsMobile = true;
    renderModal({ maxWidth: 'xs', fullScreen: false });
    const content = document.querySelector('.MuiDialogContent-root') as HTMLElement;
    expect(content).not.toHaveStyle({ paddingBottom: '84px' });
  });

  it('ist 16px wenn Desktop + maxWidth="lg" (kein fixed)', () => {
    mockIsMobile = false;
    renderModal({ maxWidth: 'lg', fullScreen: false });
    const content = document.querySelector('.MuiDialogContent-root') as HTMLElement;
    expect(content).not.toHaveStyle({ paddingBottom: '84px' });
  });

  it('ist nicht 84px wenn kein actions-Prop übergeben', () => {
    renderModal({ fullScreen: true, actions: undefined });
    const content = document.querySelector('.MuiDialogContent-root') as HTMLElement;
    expect(content).not.toHaveStyle({ paddingBottom: '84px' });
  });
});
