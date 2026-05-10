import React, { useState } from 'react';
import {
  Box, Button, CircularProgress, IconButton,
  Snackbar, Alert, Tooltip,
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import { FaWhatsapp, FaInstagram, FaFacebook } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { posterToBlob } from '../utils/exportPoster';

interface Props {
  /** Ref to the SVGSVGElement rendered by DynamicPosterRenderer */
  posterRef: React.RefObject<SVGSVGElement>;
  filename?: string;
}

const PLATFORMS = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    Icon: FaWhatsapp,
    color: '#25D366',
    shareText: 'Schaut mal unser Poster an!',
    buildUrl: (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    Icon: FaInstagram,
    color: '#E4405F',
    shareText: null,
    buildUrl: (_text: string) => 'https://www.instagram.com/',
  },
  {
    id: 'facebook',
    label: 'Facebook',
    Icon: FaFacebook,
    color: '#1877F2',
    shareText: 'Schaut mal unser Poster an!',
    buildUrl: (_text: string) => 'https://www.facebook.com/',
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    Icon: FaXTwitter,
    color: '#000000',
    shareText: 'Schaut mal unser Poster an!',
    buildUrl: (text: string) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
  },
];

/**
 * Social-sharing action bar for a generated poster.
 *
 * On mobile: Web Share API → native share sheet → user picks Instagram / WhatsApp / etc.
 * On desktop: downloads image + opens platform so user can upload manually.
 */
export function ExportActions({ posterRef, filename = 'poster.png' }: Props) {
  const [loading, setLoading] = useState(false);
  const [notice, setNotice]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);

  const canNativeShare = typeof navigator?.share === 'function';

  // ── helpers ────────────────────────────────────────────────────────────────

  async function generateBlob(): Promise<Blob | null> {
    if (!posterRef.current) return null;
    setLoading(true);
    try {
      return await posterToBlob(posterRef.current);
    } catch {
      setError('Poster konnte nicht generiert werden.');
      return null;
    } finally {
      setLoading(false);
    }
  }

  function triggerDownload(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── handlers ───────────────────────────────────────────────────────────────

  /** Primary button: Web Share API (mobile) or download (desktop). */
  async function handleMainShare() {
    const blob = await generateBlob();
    if (!blob) return;

    if (canNativeShare) {
      const file         = new File([blob], filename, { type: 'image/png' });
      const canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
      try {
        if (canShareFile) {
          await navigator.share({ files: [file], title: 'Poster teilen' });
        } else {
          await navigator.share({ title: 'Poster teilen', text: 'Schau dir unser Poster an!' });
        }
        return;
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return;
        // fall through to download
      }
    }

    triggerDownload(blob);
    setNotice('Poster gespeichert – jetzt in deiner App hochladen!');
  }

  /** Per-platform icon button: Bild kopieren/laden, dann Platform öffnen. */
  async function handlePlatformShare(platform: typeof PLATFORMS[number]) {
    const blob = await generateBlob();
    if (!blob) return;

    // Mobil: native Web Share API
    if (canNativeShare) {
      const file = new File([blob], filename, { type: 'image/png' });
      const canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
      try {
        if (canShareFile) {
          await navigator.share({ files: [file], title: 'Poster teilen', text: platform.shareText ?? undefined });
        } else {
          await navigator.share({ title: 'Poster teilen', text: platform.shareText ?? undefined });
        }
        return;
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return;
      }
    }

    // Desktop: Bild in Zwischenablage kopieren, dann Platform öffnen
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setNotice(`Bild kopiert – füge es jetzt in ${platform.label} ein.`);
    } catch {
      triggerDownload(blob);
      setNotice(`Bild gespeichert – lade es in ${platform.label} hoch.`);
    }
    window.open(platform.buildUrl(platform.shareText ?? ''), '_blank', 'noopener,noreferrer');
  }

  /** Copy image to clipboard (where supported). */
  async function handleCopy() {
    const blob = await generateBlob();
    if (!blob) return;

    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setNotice('Bild in Zwischenablage kopiert!');
    } catch {
      triggerDownload(blob);
      setNotice('Kopieren nicht unterstützt – Poster wurde heruntergeladen.');
    }
  }

  async function handleDownload() {
    const blob = await generateBlob();
    if (!blob) return;
    triggerDownload(blob);
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <Box sx={{ width: '100%' }}>

      {/* Primary: Teilen – mobil native, desktop lädt herunter */}
      <Button
        variant="contained"
        fullWidth
        size="large"
        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <ShareIcon />}
        onClick={handleMainShare}
        disabled={loading}
        sx={{ mb: 1.5, fontWeight: 700, borderRadius: 2, py: 1.2 }}
        data-testid="export-share-btn"
      >
        {loading ? 'Poster wird erstellt…' : 'Auf Sozialen Medien teilen'}
      </Button>

      {/* Platform icon buttons */}
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', mb: 1.5 }}>
        {PLATFORMS.map((platform) => (
          <Tooltip key={platform.id} title={platform.label}>
            <span>
              <IconButton
                onClick={() => handlePlatformShare(platform)}
                disabled={loading}
                sx={{
                  width:  44,
                  height: 44,
                  background: platform.color,
                  color: '#fff',
                  borderRadius: '50%',
                  '&:hover':    { background: platform.color, opacity: 0.85 },
                  '&:disabled': { opacity: 0.4 },
                }}
                aria-label={platform.label}
                data-testid={`platform-btn-${platform.id}`}
              >
                <platform.Icon size={20} />
              </IconButton>
            </span>
          </Tooltip>
        ))}
      </Box>

      {/* Secondary: copy + download */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          fullWidth
          startIcon={<ContentCopyIcon fontSize="small" />}
          onClick={handleCopy}
          disabled={loading}
          data-testid="export-copy-btn"
        >
          Bild kopieren
        </Button>
        <Button
          variant="outlined"
          size="small"
          fullWidth
          startIcon={<DownloadIcon fontSize="small" />}
          onClick={handleDownload}
          disabled={loading}
          data-testid="export-download-btn"
        >
          Herunterladen
        </Button>
      </Box>

      {/* Feedback snackbars */}
      <Snackbar open={!!error} autoHideDuration={4000} onClose={() => setError(null)}>
        <Alert severity="error" onClose={() => setError(null)} data-testid="export-error">
          {error}
        </Alert>
      </Snackbar>
      <Snackbar open={!!notice} autoHideDuration={4000} onClose={() => setNotice(null)}>
        <Alert severity="info" onClose={() => setNotice(null)} data-testid="export-notice">
          {notice}
        </Alert>
      </Snackbar>
    </Box>
  );
}
