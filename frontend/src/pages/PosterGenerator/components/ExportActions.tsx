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
  shareText: string | null;
  /** Gibt die fertige Web-Share-URL zurück, oder null wenn die Plattform keinen URL-Share unterstützt (z. B. Instagram). */
  buildUrl: (posterUrl: string) => string | null;
};

const PLATFORMS: Platform[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    Icon: FaWhatsapp,
    color: '#25D366',
    shareText: 'Schaut mal unser Poster an!',
    buildUrl: (posterUrl) => `https://wa.me/?text=${encodeURIComponent(posterUrl)}`,
  },
  {
    id: 'instagram',
    label: 'Instagram',
    Icon: FaInstagram,
    color: '#E4405F',
    shareText: null,
    // Instagram unterstützt keinen URL-basierten Web-Share → Bild herunterladen
    buildUrl: (_posterUrl) => null,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    Icon: FaFacebook,
    color: '#1877F2',
    shareText: null,
    buildUrl: (posterUrl) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(posterUrl)}`,
  },
  {
    id: 'twitter',
    label: 'X / Twitter',
    Icon: FaXTwitter,
    color: '#000000',
    shareText: 'Schaut mal unser Poster an!',
    buildUrl: (posterUrl) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(posterUrl)}&text=${encodeURIComponent('Schaut mal unser Poster an!')}`,
  },
];

/**
 * Social-sharing action bar for a generated poster.
 *
 * On mobile: Web Share API → native share sheet → user picks Instagram / WhatsApp / etc.
 * On desktop: poster is uploaded to the server, the public URL is used for platform share links.
 */
export function ExportActions({ posterRef, filename = 'poster.png' }: Props) {
  /** true auf iOS/Android, false auf Desktop-Browsern. Innerhalb der Funktion damit Tests navigator mocken können. */
  const isMobileDevice = navigator.maxTouchPoints > 1 || /Mobi|Android/i.test(navigator.userAgent);

  const [loading, setLoading]       = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Poster wird erstellt…');
  const [notice, setNotice]         = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const canNativeShare = typeof navigator?.share === 'function';

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

  /**
   * Rendert das Poster und lädt es auf den Server.
   * Gibt den Blob und die absolute öffentliche URL zurück.
   * Wird nur auf Desktop verwendet.
   */
  async function renderAndUpload(): Promise<{ blob: Blob; shareUrl: string } | null> {
    if (!posterRef.current) return null;
    setLoading(true);
    setLoadingMsg('Poster wird erstellt…');
    try {
      const blob = await posterToBlob(posterRef.current);
      setLoadingMsg('Poster wird hochgeladen…');
      const shareUrl = await uploadPosterShare(blob, filename);
      return { blob, shareUrl };
    } catch {
      setError('Poster konnte nicht hochgeladen werden.');
      return null;
    } finally {
      setLoading(false);
      setLoadingMsg('Poster wird erstellt…');
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

  /** Primär-Button: Mobil → nativer File-Share. Desktop → Poster hochladen → URL teilen. */
  async function handleMainShare() {
    // ── Mobil: nativer Datei-Share ──────────────────────────────────────────
    if (isMobileDevice && canNativeShare) {
      const blob = await renderBlob();
      if (!blob) return;
      const file = new File([blob], filename, { type: 'image/png' });
      try {
        await navigator.share({ files: [file], title: 'Poster teilen' });
        return;
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return;
        triggerDownload(blob);
        return;
      }
    }

    // ── Desktop: Poster hochladen → öffentliche URL → Browser-Share oder URL kopieren ─
    const result = await renderAndUpload();
    if (!result) return;
    const { blob, shareUrl } = result;

    if (canNativeShare) {
      try {
        await navigator.share({ url: shareUrl, title: 'Poster teilen' });
        return;
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return;
      }
    }

    // Fallback: Link in Zwischenablage
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice('Poster-Link kopiert – einfach in WhatsApp, Messenger oder E-Mail einfügen!');
    } catch {
      triggerDownload(blob);
    }
  }

  /** Platform-Button: Mobil → nativer File-Share. Desktop → Poster hochladen → Plattform mit URL öffnen. */
  async function handlePlatformShare(platform: Platform) {
    // ── Mobil: nativer Datei-Share ──────────────────────────────────────────
    if (isMobileDevice && canNativeShare) {
      const blob = await renderBlob();
      if (!blob) return;
      const file = new File([blob], filename, { type: 'image/png' });
      try {
        await navigator.share({ files: [file], title: 'Poster teilen', text: platform.shareText ?? undefined });
        return;
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return;
        triggerDownload(blob);
        return;
      }
    }

    // ── Desktop: Poster hochladen → Plattform-URL mit Poster-URL öffnen ────
    const result = await renderAndUpload();
    if (!result) return;
    const { blob, shareUrl } = result;

    const platformUrl = platform.buildUrl(shareUrl);
    if (platformUrl) {
      window.open(platformUrl, '_blank', 'noopener,noreferrer');
      setNotice(`${platform.label} geöffnet – das Poster ist bereits als Link eingebettet!`);
    } else {
      // Instagram: kein URL-Share-API → herunterladen + Instagram öffnen
      triggerDownload(blob);
      window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
      setNotice('Poster heruntergeladen – jetzt auf Instagram hochladen.');
    }
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
