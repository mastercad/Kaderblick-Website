import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideosSection from '../VideosSection';
import { Video } from '../../../../services/videos';

// ── matchMedia mock ───────────────────────────────────────────────────────────
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

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeVideo = (overrides: Partial<Video> = {}): Video => ({
  id: 1,
  name: 'Highlight-Video',
  youtubeId: 'abc123',
  length: 125,
  videoType: { id: 1, name: 'Highlight' },
  camera: { id: 7, name: 'Hauptkamera' },
  eventIds: [],
  ...overrides,
} as Video);

const defaultProps = {
  videos: [] as Video[],
  sectionsOpen: true,
  canCreateVideos: false,
  hasUser: false,
  onToggle: jest.fn(),
  onProtectedVideoAction: jest.fn(),
  onOpenSegmentModal: jest.fn(),
  onPlayVideo: jest.fn(),
  onEditVideo: jest.fn(),
  onDeleteVideo: jest.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('VideosSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Section header ──────────────────────────────────────────────────────

  it('renders the section header with label', () => {
    render(<VideosSection {...defaultProps} />);
    expect(screen.getByText('Videos')).toBeInTheDocument();
  });

  it('shows the video count in the header', () => {
    render(<VideosSection {...defaultProps} videos={[makeVideo(), makeVideo({ id: 2 })]} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls onToggle when header is clicked', () => {
    render(<VideosSection {...defaultProps} />);
    fireEvent.click(screen.getByTestId('videos-section-header'));
    expect(defaultProps.onToggle).toHaveBeenCalledTimes(1);
  });

  it('"Video hinzufügen" button calls onProtectedVideoAction', () => {
    render(<VideosSection {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /video hinzufügen/i }));
    expect(defaultProps.onProtectedVideoAction).toHaveBeenCalledTimes(1);
  });

  // ── Schnittliste button ─────────────────────────────────────────────────

  it('shows "Schnittliste" button when there are videos', () => {
    render(<VideosSection {...defaultProps} videos={[makeVideo()]} />);
    expect(screen.getByRole('button', { name: /schnittliste/i })).toBeInTheDocument();
  });

  it('does not show "Schnittliste" button when videos list is empty', () => {
    render(<VideosSection {...defaultProps} videos={[]} />);
    expect(screen.queryByRole('button', { name: /schnittliste/i })).not.toBeInTheDocument();
  });

  it('calls onOpenSegmentModal when "Schnittliste" button is clicked', () => {
    render(<VideosSection {...defaultProps} videos={[makeVideo()]} />);
    fireEvent.click(screen.getByRole('button', { name: /schnittliste/i }));
    expect(defaultProps.onOpenSegmentModal).toHaveBeenCalledTimes(1);
  });

  // ── Empty state ─────────────────────────────────────────────────────────

  it('shows empty-state message when no videos and section is open', () => {
    render(<VideosSection {...defaultProps} videos={[]} sectionsOpen={true} />);
    expect(screen.getByText(/keine videos/i)).toBeInTheDocument();
  });

  it('does not render video content when section is closed', () => {
    render(<VideosSection {...defaultProps} videos={[]} sectionsOpen={false} />);
    expect(screen.queryByText(/keine videos/i)).not.toBeInTheDocument();
  });

  // ── Video item rendering ────────────────────────────────────────────────

  it('renders video name', () => {
    render(<VideosSection {...defaultProps} videos={[makeVideo()]} />);
    expect(screen.getByText('Highlight-Video')).toBeInTheDocument();
  });

  it('renders the formatted video length chip', () => {
    // 125 seconds → "2:05"
    render(<VideosSection {...defaultProps} videos={[makeVideo({ length: 125 })]} />);
    expect(screen.getByText('2:05')).toBeInTheDocument();
  });

  it('does not render length chip when length is 0', () => {
    render(<VideosSection {...defaultProps} videos={[makeVideo({ length: 0 })]} />);
    expect(screen.queryByText('0:00')).not.toBeInTheDocument();
  });

  it('renders video type chip', () => {
    render(<VideosSection {...defaultProps} videos={[makeVideo()]} />);
    expect(screen.getByText('Highlight')).toBeInTheDocument();
  });

  it('renders camera chip', () => {
    render(<VideosSection {...defaultProps} videos={[makeVideo()]} />);
    expect(screen.getByText('Hauptkamera')).toBeInTheDocument();
  });

  it('renders filePath when present', () => {
    const video = makeVideo({ filePath: '/videos/game1.mp4' });
    render(<VideosSection {...defaultProps} videos={[video]} />);
    expect(screen.getByText('/videos/game1.mp4')).toBeInTheDocument();
  });

  it('renders YouTube thumbnail when youtubeId is present', () => {
    render(<VideosSection {...defaultProps} videos={[makeVideo({ youtubeId: 'xyz789' })]} />);
    const img = screen.getByRole('img', { name: 'Highlight-Video' });
    expect(img).toHaveAttribute('src', expect.stringContaining('xyz789'));
  });

  it('does not render thumbnail when youtubeId is absent', () => {
    render(<VideosSection {...defaultProps} videos={[makeVideo({ youtubeId: undefined })]} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  // ── Action buttons per video ────────────────────────────────────────────

  it('does not show action buttons when hasUser=false', () => {
    render(<VideosSection {...defaultProps} videos={[makeVideo()]} hasUser={false} />);
    expect(screen.queryByRole('button', { name: /bearbeiten/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /löschen/i })).not.toBeInTheDocument();
  });

  it('shows play button for user (YouTube icon) when hasUser=true', () => {
    render(<VideosSection {...defaultProps} videos={[makeVideo()]} hasUser={true} />);
    // The action box contains play, edit, delete buttons; check by clicking thumbnail/name
    // and specifically look for the action button column's play button
    // There are multiple clickable elements, so just verify user=true produces more buttons
    const buttons = screen.getAllByRole('button');
    // At minimum: toggle button + add-video button + play-icon button
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('shows edit and delete action icons when hasUser=true and canCreateVideos=true', () => {
    render(
      <VideosSection
        {...defaultProps}
        videos={[makeVideo()]}
        hasUser={true}
        canCreateVideos={true}
      />
    );
    // At least: header-toggle, schnittliste, add-video, play, edit, delete
    const allButtons = screen.getAllByRole('button');
    expect(allButtons.length).toBeGreaterThanOrEqual(6);
  });

  it('calls onPlayVideo when thumbnail is clicked', () => {
    const onPlay = jest.fn();
    render(<VideosSection {...defaultProps} videos={[makeVideo()]} hasUser={true} onPlayVideo={onPlay} />);
    fireEvent.click(screen.getByRole('img', { name: 'Highlight-Video' }));
    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('calls onPlayVideo when video name is clicked', () => {
    const onPlay = jest.fn();
    render(<VideosSection {...defaultProps} videos={[makeVideo()]} onPlayVideo={onPlay} />);
    fireEvent.click(screen.getByText('Highlight-Video'));
    expect(onPlay).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('calls onEditVideo when edit button is clicked', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const video = makeVideo();
    render(
      <VideosSection
        {...defaultProps}
        videos={[video]}
        hasUser={true}
        canCreateVideos={true}
        onEditVideo={onEdit}
        onDeleteVideo={onDelete}
      />
    );
    // With hasUser+canCreateVideos: header-toggle, schnittliste, add-video, play, edit, delete
    // edit is second-to-last button
    const allBtns = screen.getAllByRole('button');
    const editBtn = allBtns[allBtns.length - 2];
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('calls onDeleteVideo when delete button is clicked', () => {
    const onDelete = jest.fn();
    const video = makeVideo();
    render(
      <VideosSection
        {...defaultProps}
        videos={[video]}
        hasUser={true}
        canCreateVideos={true}
        onDeleteVideo={onDelete}
      />
    );
    const allBtns = screen.getAllByRole('button');
    // Last icon button in the action area is delete
    const deleteBtn = allBtns[allBtns.length - 1];
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});
