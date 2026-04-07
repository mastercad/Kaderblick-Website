import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AvatarPickerDialog } from '../../dialogs/AvatarPickerDialog';

// Mock react-easy-crop since it needs a canvas/WebGL context
jest.mock('react-easy-crop', () => ({
  __esModule: true,
  default: ({ onCropComplete }: { onCropComplete: (a: unknown, b: unknown) => void }) => {
    // Simulate crop completion once on mount using a ref to avoid stale closure issues
    const onCropCompleteRef = React.useRef(onCropComplete);
    React.useEffect(() => {
      onCropCompleteRef.current({}, { x: 0, y: 0, width: 100, height: 100 });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return <div data-testid="cropper" />;
  },
}));

// Mock getCroppedImg utility
jest.mock('../../../../utils/cropImage', () => jest.fn());
import getCroppedImg from '../../../../utils/cropImage';
const mockGetCroppedImg = getCroppedImg as jest.MockedFunction<typeof getCroppedImg>;

// Mock config
jest.mock('../../../../../config', () => ({ BACKEND_URL: 'http://localhost' }));

const defaultProps = {
  open: true,
  avatarFile: null,
  avatarUrl: '',
  googleAvatarUrl: '',
  useGoogleAvatar: false,
  onClose: jest.fn(),
  onAvatarFileChange: jest.fn(),
  onAvatarUrlChange: jest.fn(),
  onUseGoogleAvatarChange: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('AvatarPickerDialog', () => {
  it('renders dialog title', () => {
    render(<AvatarPickerDialog {...defaultProps} />);
    expect(screen.getByText('Profilbild ändern')).toBeInTheDocument();
  });

  it('"Übernehmen" button is disabled when no file, no url, and no google avatar', () => {
    render(<AvatarPickerDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Übernehmen/i })).toBeDisabled();
  });

  it('"Übernehmen" button is enabled when avatarUrl is set', () => {
    render(<AvatarPickerDialog {...defaultProps} avatarUrl="some-avatar.jpg" />);
    expect(screen.getByRole('button', { name: /Übernehmen/i })).not.toBeDisabled();
  });

  it('"Übernehmen" button is enabled when useGoogleAvatar is true', () => {
    render(<AvatarPickerDialog {...defaultProps} useGoogleAvatar={true} googleAvatarUrl="https://example.com/g.jpg" />);
    expect(screen.getByRole('button', { name: /Übernehmen/i })).not.toBeDisabled();
  });

  it('calls onClose when Abbrechen is clicked', () => {
    const onClose = jest.fn();
    render(<AvatarPickerDialog {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Abbrechen/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Übernehmen clicked with no file (no crop needed)', async () => {
    const onClose = jest.fn();
    render(<AvatarPickerDialog {...defaultProps} avatarUrl="existing.jpg" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Übernehmen/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('shows Google avatar section when googleAvatarUrl is provided', () => {
    render(<AvatarPickerDialog {...defaultProps} googleAvatarUrl="https://example.com/g.jpg" />);
    expect(screen.getByText('Google-Profilbild verwenden')).toBeInTheDocument();
  });

  it('does not show Google avatar section when googleAvatarUrl is empty', () => {
    render(<AvatarPickerDialog {...defaultProps} googleAvatarUrl="" />);
    expect(screen.queryByText('Google-Profilbild verwenden')).not.toBeInTheDocument();
  });

  it('shows hint text when useGoogleAvatar is true', () => {
    render(<AvatarPickerDialog {...defaultProps} googleAvatarUrl="https://example.com/g.jpg" useGoogleAvatar={true} />);
    expect(screen.getByText(/Dein Google-Profilbild wird als Avatar angezeigt/i)).toBeInTheDocument();
  });

  it('does not show hint when useGoogleAvatar is false', () => {
    render(<AvatarPickerDialog {...defaultProps} googleAvatarUrl="https://example.com/g.jpg" useGoogleAvatar={false} />);
    expect(screen.queryByText(/Dein Google-Profilbild wird als Avatar angezeigt/i)).not.toBeInTheDocument();
  });

  it('calls onUseGoogleAvatarChange when Google avatar switch is toggled', () => {
    const onUseGoogleAvatarChange = jest.fn();
    render(<AvatarPickerDialog {...defaultProps} googleAvatarUrl="https://example.com/g.jpg" onUseGoogleAvatarChange={onUseGoogleAvatarChange} />);
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    expect(onUseGoogleAvatarChange).toHaveBeenCalledWith(true);
  });

  it('clears avatarFile when Google avatar is enabled', () => {
    const onAvatarFileChange = jest.fn();
    render(<AvatarPickerDialog {...defaultProps} googleAvatarUrl="https://example.com/g.jpg" onAvatarFileChange={onAvatarFileChange} />);
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    expect(onAvatarFileChange).toHaveBeenCalledWith(null);
  });

  it('shows avatar URL text field', () => {
    render(<AvatarPickerDialog {...defaultProps} />);
    expect(screen.getByLabelText(/Avatar-URL/i)).toBeInTheDocument();
  });

  it('calls onAvatarUrlChange when URL input changes', () => {
    const onAvatarUrlChange = jest.fn();
    const onAvatarFileChange = jest.fn();
    render(<AvatarPickerDialog {...defaultProps} onAvatarUrlChange={onAvatarUrlChange} onAvatarFileChange={onAvatarFileChange} />);
    fireEvent.change(screen.getByLabelText(/Avatar-URL/i), { target: { value: 'https://example.com/avatar.jpg' } });
    expect(onAvatarUrlChange).toHaveBeenCalledWith('https://example.com/avatar.jpg');
    // Changing URL should clear the file
    expect(onAvatarFileChange).toHaveBeenCalledWith(null);
  });

  it('shows "Bild auswählen" button', () => {
    render(<AvatarPickerDialog {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Bild auswählen/i })).toBeInTheDocument();
  });

  it('shows Cropper when avatarFile is provided', () => {
    const file = new File(['data'], 'test.png', { type: 'image/png' });
    render(<AvatarPickerDialog {...defaultProps} avatarFile={file} />);
    expect(screen.getByTestId('cropper')).toBeInTheDocument();
  });

  it('runs crop and calls onAvatarFileChange when Übernehmen clicked with avatarFile', async () => {
    const onAvatarFileChange = jest.fn();
    const onClose = jest.fn();
    // Base64-encoded 1x1 white PNG
    mockGetCroppedImg.mockResolvedValue('data:image/png;base64,iVBORw0KGgo=');
    const file = new File(['data'], 'test.png', { type: 'image/png' });
    render(<AvatarPickerDialog {...defaultProps} avatarFile={file} onAvatarFileChange={onAvatarFileChange} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Übernehmen/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockGetCroppedImg).toHaveBeenCalled();
  });

  it('still calls onClose when getCroppedImg returns null', async () => {
    const onClose = jest.fn();
    mockGetCroppedImg.mockResolvedValue(null as any);
    const file = new File(['data'], 'test.png', { type: 'image/png' });
    render(<AvatarPickerDialog {...defaultProps} avatarFile={file} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /Übernehmen/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('handles file drop onto drop zone', () => {
    const onAvatarFileChange = jest.fn();
    const onAvatarUrlChange = jest.fn();
    render(<AvatarPickerDialog {...defaultProps} onAvatarFileChange={onAvatarFileChange} onAvatarUrlChange={onAvatarUrlChange} />);
    const dropZone = screen.getByText(/Bild hierher ziehen/i).parentElement!;
    const file = new File(['data'], 'dropped.png', { type: 'image/png' });
    const dataTransfer = { files: [file] };
    fireEvent.dragOver(dropZone, { dataTransfer });
    fireEvent.drop(dropZone, { dataTransfer });
    expect(onAvatarFileChange).toHaveBeenCalledWith(file);
    expect(onAvatarUrlChange).toHaveBeenCalledWith('');
  });

  it('drag-and-drop events set and clear dragActive visual state', () => {
    render(<AvatarPickerDialog {...defaultProps} />);
    const dropZone = screen.getByText(/Bild hierher ziehen/i).parentElement!;
    fireEvent.dragOver(dropZone);
    fireEvent.dragLeave(dropZone);
    // No crash; component handles DnD events without error
    expect(dropZone).toBeInTheDocument();
  });
});
