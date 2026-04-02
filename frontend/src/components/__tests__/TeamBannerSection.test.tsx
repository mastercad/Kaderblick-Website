import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── MUI component stubs ──────────────────────────────────────────────────────
// Lightweight stubs let us query by text/role/title without a full MUI setup.

jest.mock('@mui/material/styles', () => ({
  alpha: (_color: string, _opacity: number) => 'rgba(0,0,0,0.1)',
  useTheme: () => ({
    palette: { primary: { main: '#1976d2' }, background: { default: '#fff', paper: '#fff' } },
    breakpoints: { down: (key: string) => `(max-width:${key})` },
  }),
}));

jest.mock('@mui/material/Box', () => ({
  __esModule: true,
  default: ({ children, sx: _sx, ref: _ref, onDragOver, onDragLeave, onDrop, ...rest }: any) =>
    <div onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} {...rest}>{children}</div>,
}));

jest.mock('@mui/material/Button', () => ({
  __esModule: true,
  default: ({ children, onClick, disabled, startIcon: _si, ...rest }: any) =>
    <button onClick={onClick} disabled={disabled} {...rest}>{children}</button>,
}));

jest.mock('@mui/material/IconButton', () => ({
  __esModule: true,
  default: ({ children, onClick, disabled, 'aria-label': ariaLabel, ...rest }: any) =>
    <button onClick={onClick} disabled={!!disabled} aria-label={ariaLabel} {...rest}>{children}</button>,
}));

jest.mock('@mui/material/Tooltip', () => ({
  __esModule: true,
  // Expose title as HTML title so getByTitle() works
  default: ({ children, title }: any) => <span title={title}>{children}</span>,
}));

jest.mock('@mui/material/Alert', () => ({
  __esModule: true,
  default: ({ children, onClose }: any) =>
    <div role="alert">{children}{onClose && <button onClick={onClose}>×</button>}</div>,
}));

jest.mock('@mui/material/CircularProgress', () => ({
  __esModule: true,
  default: () => <span data-testid="spinner" />,
}));

jest.mock('@mui/material/Slider', () => ({
  __esModule: true,
  default: ({ value, onChange, ...rest }: any) =>
    <input type="range" value={value} onChange={(e) => onChange?.(e, Number(e.target.value))} {...rest} />,
}));

jest.mock('@mui/material/Typography', () => ({
  __esModule: true,
  default: ({ children }: any) => <span>{children}</span>,
}));

jest.mock('@mui/material/Dialog', () => ({
  __esModule: true,
  default: ({ open, children, onClose }: any) =>
    open ? <div role="dialog" onClick={onClose}>{children}</div> : null,
}));
jest.mock('@mui/material/DialogTitle',       () => ({ __esModule: true, default: ({ children }: any) => <h2>{children}</h2> }));
jest.mock('@mui/material/DialogContent',     () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock('@mui/material/DialogContentText', () => ({ __esModule: true, default: ({ children }: any) => <p>{children}</p> }));
jest.mock('@mui/material/DialogActions',     () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));

// ── MUI icon stubs ────────────────────────────────────────────────────────────

jest.mock('@mui/icons-material/AddPhotoAlternate', () => ({ __esModule: true, default: () => <span>+</span> }));
jest.mock('@mui/icons-material/Edit',              () => ({ __esModule: true, default: () => <span>edit</span> }));
jest.mock('@mui/icons-material/Delete',            () => ({ __esModule: true, default: () => <span>delete</span> }));

// ── Dependency mocks ──────────────────────────────────────────────────────────

jest.mock('../../../config', () => ({ BACKEND_URL: 'http://test-backend' }));

jest.mock('../../utils/api', () => ({
  apiRequest: jest.fn(),
}));

jest.mock('../../utils/cropImage', () => ({
  __esModule: true,
  default: jest.fn(() => Promise.resolve('data:image/jpeg;base64,/9j/testdata')),
}));

// Cropper fires onCropComplete once on mount so the Save button becomes enabled
jest.mock('react-easy-crop', () => {
  const { useEffect } = require('react');
  return {
    __esModule: true,
    default: ({ onCropComplete }: any) => {
      useEffect(() => {
        onCropComplete?.({}, { x: 0, y: 0, width: 800, height: 250 });
      }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return <div data-testid="cropper" />;
    },
  };
});

// BaseModal renders children + actions when open
jest.mock('../../modals/BaseModal', () => ({
  __esModule: true,
  default: ({ open, children, actions, onClose }: any) =>
    open ? (
      <div data-testid="crop-modal" role="dialog" aria-label="Banner zuschneiden">
        <button onClick={onClose}>Schließen</button>
        {children}
        {actions}
      </div>
    ) : null,
}));

// ── Browser API stubs ─────────────────────────────────────────────────────────

// Image automatically fires onload when src is set
class AutoFireImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 1200;
  naturalHeight = 375;
  private _src = '';

  get src() { return this._src; }
  set src(value: string) {
    this._src = value;
    if (value && this.onload) setTimeout(() => this.onload!(), 0);
  }
}

// Save originals so we can restore them after this suite
let _origImage: any;
let _origCreateObjectURL: any;
let _origRevokeObjectURL: any;
let _origMatchMedia: any;

beforeAll(() => {
  _origImage = (global as any).Image;
  _origCreateObjectURL = URL.createObjectURL;
  _origRevokeObjectURL = URL.revokeObjectURL;
  _origMatchMedia = window.matchMedia;

  (global as any).Image = AutoFireImage;

  Object.defineProperty(URL, 'createObjectURL', { writable: true, value: jest.fn(() => 'blob:mock-url') });
  Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: jest.fn() });

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

afterAll(() => {
  (global as any).Image = _origImage;
  Object.defineProperty(URL, 'createObjectURL', { writable: true, value: _origCreateObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: _origRevokeObjectURL });
  Object.defineProperty(window, 'matchMedia', { writable: true, value: _origMatchMedia });
});

// ── Import after mocks ────────────────────────────────────────────────────────

import { TeamBannerSection } from '../TeamBannerSection';
import { apiRequest } from '../../utils/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

function makeResponse(body: object, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as unknown as Response;
}

const baseProps = {
  teamId: 1,
  bannerImage: null as string | null | undefined,
  canEditBanner: false,
  onBannerChange: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('TeamBannerSection', () => {

  // ── Visibility ──────────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('renders nothing when no banner and canEditBanner is false', () => {
      const { container } = render(<TeamBannerSection {...baseProps} />);
      expect(container).toBeEmptyDOMElement();
    });

    it('renders placeholder text when canEditBanner is true and no banner', () => {
      render(<TeamBannerSection {...baseProps} canEditBanner />);
      expect(screen.getByText(/Bild hierher ziehen/i)).toBeInTheDocument();
    });

    it('renders only the edit button when canEditBanner is true and no banner exists', () => {
      render(<TeamBannerSection {...baseProps} canEditBanner />);
      // Tooltip wraps the edit IconButton → span[title]
      expect(screen.getByTitle('Banner hochladen / ändern')).toBeInTheDocument();
      expect(screen.queryByTitle('Banner löschen')).not.toBeInTheDocument();
    });

    it('renders banner image with correct src', () => {
      render(<TeamBannerSection {...baseProps} bannerImage="team_1_banner.jpg" />);
      const img = screen.getByRole('img', { name: /team banner/i });
      expect(img).toHaveAttribute('src', 'http://test-backend/uploads/team-banners/team_1_banner.jpg');
    });

    it('does not render edit or delete controls when canEditBanner is false', () => {
      render(<TeamBannerSection {...baseProps} bannerImage="team_1_banner.jpg" />);
      expect(screen.queryByTitle('Banner hochladen / ändern')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Banner löschen')).not.toBeInTheDocument();
    });

    it('renders both edit and delete buttons when banner is present and canEditBanner is true', () => {
      render(<TeamBannerSection {...baseProps} bannerImage="team_1_banner.jpg" canEditBanner />);
      expect(screen.getByTitle('Banner hochladen / ändern')).toBeInTheDocument();
      expect(screen.getByTitle('Banner löschen')).toBeInTheDocument();
    });
  });

  // ── File validation ──────────────────────────────────────────────────────────

  describe('File type validation', () => {
    it('shows error for an unsupported MIME type selected via input', () => {
      render(<TeamBannerSection {...baseProps} canEditBanner />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['gif data'], 'anim.gif', { type: 'image/gif' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      fireEvent.change(input);
      expect(screen.getByRole('alert')).toHaveTextContent(/ungültiger dateityp/i);
    });

    it('accepts image/jpeg and starts a direct upload', async () => {
      const onBannerChange = jest.fn();
      mockApiRequest.mockResolvedValue(makeResponse({ success: true, bannerImage: 'photo.jpg' }));
      render(<TeamBannerSection {...baseProps} canEditBanner onBannerChange={onBannerChange} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['jpeg data'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      fireEvent.change(input);
      await waitFor(() =>
        expect(mockApiRequest).toHaveBeenCalledWith(
          '/api/teams/1/banner',
          expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
        ),
      );
      await waitFor(() => expect(onBannerChange).toHaveBeenCalledWith('photo.jpg'));
    });

    it('accepts image/png and starts a direct upload', async () => {
      const onBannerChange = jest.fn();
      mockApiRequest.mockResolvedValue(makeResponse({ success: true, bannerImage: 'photo.png' }));
      render(<TeamBannerSection {...baseProps} canEditBanner onBannerChange={onBannerChange} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['png data'], 'photo.png', { type: 'image/png' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      fireEvent.change(input);
      await waitFor(() =>
        expect(mockApiRequest).toHaveBeenCalledWith(
          '/api/teams/1/banner',
          expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
        ),
      );
      await waitFor(() => expect(onBannerChange).toHaveBeenCalledWith('photo.png'));
    });

    it('accepts image/webp and starts a direct upload', async () => {
      const onBannerChange = jest.fn();
      mockApiRequest.mockResolvedValue(makeResponse({ success: true, bannerImage: 'photo.webp' }));
      render(<TeamBannerSection {...baseProps} canEditBanner onBannerChange={onBannerChange} />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['webp data'], 'photo.webp', { type: 'image/webp' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      fireEvent.change(input);
      await waitFor(() =>
        expect(mockApiRequest).toHaveBeenCalledWith(
          '/api/teams/1/banner',
          expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
        ),
      );
      await waitFor(() => expect(onBannerChange).toHaveBeenCalledWith('photo.webp'));
    });
  });

  // ── Drag & Drop ──────────────────────────────────────────────────────────────

  describe('Drag and Drop', () => {
    it('does not process drops when canEditBanner is false', () => {
      render(<TeamBannerSection {...baseProps} bannerImage="team_1.jpg" />);
      const img = screen.getByRole('img');
      const file = new File(['jpeg'], 'photo.jpg', { type: 'image/jpeg' });
      fireEvent.drop(img, { dataTransfer: { files: [file] } });
      expect(screen.queryByTestId('crop-modal')).not.toBeInTheDocument();
    });

    it('shows error when invalid file type is dropped onto the upload area', () => {
      const { container } = render(<TeamBannerSection {...baseProps} canEditBanner />);
      // The outer Box (with drag handlers) is the root div of the rendered component
      const dropTarget = container.firstChild as HTMLElement;
      const file = new File(['gif data'], 'anim.gif', { type: 'image/gif' });
      fireEvent.dragOver(dropTarget, { dataTransfer: { files: [file], dropEffect: '' } });
      fireEvent.drop(dropTarget, { dataTransfer: { files: [file] } });
      expect(screen.getByRole('alert')).toHaveTextContent(/ungültiger dateityp/i);
    });
  });

  // ── Delete flow ──────────────────────────────────────────────────────────────

  describe('Delete flow', () => {
    const withBanner = { ...baseProps, bannerImage: 'team_1_banner.jpg', canEditBanner: true };

    const openDeleteDialog = () => {
      render(<TeamBannerSection {...withBanner} />);
      fireEvent.click(screen.getByTitle('Banner löschen').querySelector('button')!);
    };

    it('opens the delete confirmation dialog', () => {
      openDeleteDialog();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/Banner wirklich löschen/i)).toBeInTheDocument();
    });

    it('closes dialog without calling apiRequest when Abbrechen is clicked', async () => {
      openDeleteDialog();
      fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(mockApiRequest).not.toHaveBeenCalled();
    });

    it('calls DELETE endpoint and onBannerChange(null) when Löschen is confirmed', async () => {
      const onBannerChange = jest.fn();
      mockApiRequest.mockResolvedValue(makeResponse({ success: true }));
      render(<TeamBannerSection {...withBanner} onBannerChange={onBannerChange} />);
      fireEvent.click(screen.getByTitle('Banner löschen').querySelector('button')!);
      fireEvent.click(screen.getByRole('button', { name: /^löschen$/i }));
      await waitFor(() =>
        expect(mockApiRequest).toHaveBeenCalledWith(
          '/api/teams/1/banner',
          expect.objectContaining({ method: 'DELETE' }),
        ),
      );
      expect(onBannerChange).toHaveBeenCalledWith(null);
    });

    it('shows error alert when DELETE returns an error response', async () => {
      mockApiRequest.mockResolvedValue(makeResponse({ error: 'Serverfehler' }, false, 500));
      render(<TeamBannerSection {...withBanner} />);
      fireEvent.click(screen.getByTitle('Banner löschen').querySelector('button')!);
      fireEvent.click(screen.getByRole('button', { name: /^löschen$/i }));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Serverfehler'));
    });

    it('shows fallback error alert when DELETE throws a network error', async () => {
      mockApiRequest.mockRejectedValue(new Error('Keine Verbindung'));
      render(<TeamBannerSection {...withBanner} />);
      fireEvent.click(screen.getByTitle('Banner löschen').querySelector('button')!);
      fireEvent.click(screen.getByRole('button', { name: /^löschen$/i }));
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Keine Verbindung'));
    });
  });

  // ── Upload / Save flow ────────────────────────────────────────────────────────

  describe('Upload / Save flow', () => {
    async function selectJpegFile() {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(['jpeg data'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      fireEvent.change(input);
    }

    it('calls POST endpoint with FormData and invokes onBannerChange on success', async () => {
      const onBannerChange = jest.fn();
      mockApiRequest.mockResolvedValue(makeResponse({ success: true, bannerImage: 'team_1_new.jpg' }));
      render(<TeamBannerSection {...baseProps} canEditBanner onBannerChange={onBannerChange} />);
      await selectJpegFile();
      await waitFor(() =>
        expect(mockApiRequest).toHaveBeenCalledWith(
          '/api/teams/1/banner',
          expect.objectContaining({ method: 'POST', body: expect.any(FormData) }),
        ),
      );
      expect(onBannerChange).toHaveBeenCalledWith('team_1_new.jpg');
    });

    it('does not open a crop modal during successful upload', async () => {
      const onBannerChange = jest.fn();
      mockApiRequest.mockResolvedValue(makeResponse({ success: true, bannerImage: 'team_1_new.jpg' }));
      render(<TeamBannerSection {...baseProps} canEditBanner onBannerChange={onBannerChange} />);
      await selectJpegFile();
      await waitFor(() => expect(onBannerChange).toHaveBeenCalledWith('team_1_new.jpg'));
      expect(screen.queryByTestId('crop-modal')).not.toBeInTheDocument();
    });

    it('shows error alert when POST endpoint returns an error response', async () => {
      mockApiRequest.mockResolvedValue(makeResponse({ error: 'Datei zu groß' }, false, 422));
      render(<TeamBannerSection {...baseProps} canEditBanner />);
      await selectJpegFile();
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Datei zu groß'));
    });

    it('shows error alert when POST throws a network error', async () => {
      mockApiRequest.mockRejectedValue(new Error('Timeout'));
      render(<TeamBannerSection {...baseProps} canEditBanner />);
      await selectJpegFile();
      await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Timeout'));
    });

    it('does not call the API when no file is selected', () => {
      render(<TeamBannerSection {...baseProps} canEditBanner />);
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [], configurable: true });

      fireEvent.change(input);

      expect(mockApiRequest).not.toHaveBeenCalled();
    });
  });

});
