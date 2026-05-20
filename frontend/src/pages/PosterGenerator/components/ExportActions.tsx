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
import { uploadPosterShare } from '../../../services/posterTemplateService';

interface Props {
  /** Ref to the HTMLDivElement rendered by DynamicPosterRenderer */
  posterRef: React.RefObject<HTMLDivElement | null>;
  filename?: string;
}

type Platform = {
  id: string;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  color: string;
  shareText: string;
  /** URL zum Öffnen der Plattform, wenn nativer File-Share nicht verfügbar ist (z. B. Linux). */
  buildFallbackUrl: (posterUrl: string) => string | null;
};

const PLATFORMS: Platform[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    Icon: FaWhatsapp,
    color: '#25D366',
    shareText: 'Schaut mal unser Poster an!',
    buildFallbackUrl: (url) => `https://wa.me/?text=${encodeURIComponent(url)}`,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    Icon: FaInstagram,
    color: '#E4405F',
    shareText: 'Schaut mal unser Poster an!',
    buildFallbackUrl: () => null, // Instagram hat keine URL-basierte Share-API
  },
  {
    id: 'facebook',
    label: 'Facebook',
    Icon: FaFacebook,
    color: '#1877F2',
    shareText: 'Schaut mal unser Poster an!',
    buildFallbackUrl: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    Icon: FaXTwitter,
    color: '#000000',
    shareText: 'Schaut mal unser Poster an!',
    buildFallbackUrl: (url) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent('Schaut mal unser Poster an!')}`,
  },
];

/**
 * Social-sharing action bar for a generated poster.
 *
 * On mobile: Web Share API → native share sheet → user picks Instagram / WhatsApp / etc.
 * On desktop: poster is uploaded to the server, the public URL is used for platform share links.
 */
export function ExportActions({ posterRef, filename = 'poster.png' }: Props) {
  const [loading, setLoading]       = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Poster wird erstellt…');
  const [notice, setNotice]         = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  // ── helpers ────────────────────────────────────────────────────────────────

  /**
   * Rendert das Poster als Blob (für mobilen File-Share oder Download).
   * Setzt loading während der Renderzeit.
   */
  async function renderBlob(): Promise<Blob | null> {
    if (!posterRef.current) return null;
    setLoading(true);
    setLoadingMsg('Poster wird erstellt…');
    try {
      return await posterToBlob(posterRef.current);
    } catch {
      setError('Poster konnte nicht erstellt werden.');
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

  /**
   * Teilt das Poster als Datei.
   *
   * Pfad 1 – nativer File-Share (Mobil, Windows, macOS):
   *   navigator.canShare({ files }) → true → navigator.share({ files, text })
   *
   * Pfad 2 – Fallback für Plattform-Buttons ohne File-Share (z. B. Linux):
   *   Bild auf Server hochladen → plattformspezifische URL in neuem Tab öffnen.
   *   Haupt-Button: Fehlermeldung (URL-Share ist kein Bild-Share).
   */
  async function shareAsFile(shareText: string, platform?: Platform) {
    const blob = await renderBlob();
    if (!blob) return;

    const file = new File([blob], filename, { type: 'image/png' });

    // ── Pfad 1: nativer File-Share ─────────────────────────────────────────
    if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Poster teilen', text: shareText });
      } catch (err) {
        if ((err as DOMException).name !== 'AbortError') {
          setError('Das Teilen ist fehlgeschlagen. Bitte versuche es erneut.');
        }
      }
      return;
    }

    // ── Pfad 2: Fallback für Plattform-Buttons ────────────────────────────
    // Bild auf den Server laden und plattformspezifische URL öffnen.
    // Nur für Plattform-Buttons sinnvoll – ein Link ist kein Bild-Share.
    if (platform) {
      setLoading(true);
      setLoadingMsg('Poster wird hochgeladen…');
      let shareUrl: string;
      try {
        shareUrl = await uploadPosterShare(blob, filename);
      } catch {
        setError('Poster konnte nicht hochgeladen werden.');
        return;
      } finally {
        setLoading(false);
        setLoadingMsg('Poster wird erstellt…');
      }

      const platformUrl = platform.buildFallbackUrl(shareUrl);
      if (platformUrl) {
        window.open(platformUrl, '_blank', 'noopener,noreferrer');
      } else {
        // Instagram: keine URL-basierte Share-API
        window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
      }
      return;
    }

    // Haupt-Share-Button: Datei-Share wird auf diesem System nicht unterstützt.
    // Eine URL zu teilen ist kein Ersatz – der Empfänger sieht ein Link, kein Bild.
    setError('Direktes Teilen von Bildern wird auf diesem System nicht unterstützt. Nutze einen der Plattform-Buttons.');
  }

  async function handleMainShare() {
    await shareAsFile('Schaut mal unser Poster an!');
  }

  async function handlePlatformShare(platform: Platform) {
    await shareAsFile(platform.shareText, platform);
  }

  /** Copy image to clipboard (where supported). */
  async function handleCopy() {
    const blob = await renderBlob();
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
    const blob = await renderBlob();
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
        {loading ? loadingMsg : 'Auf Sozialen Medien teilen'}
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
      <Snackbar open={!!notice} autoHideDuration={8000} onClose={() => setNotice(null)}>
        <Alert severity="info" onClose={() => setNotice(null)} data-testid="export-notice">
          {notice}
        </Alert>
      </Snackbar>
    </Box>
  );
}
