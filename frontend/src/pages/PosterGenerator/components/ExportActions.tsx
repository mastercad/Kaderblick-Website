import React, { useState } from 'react';
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, Snackbar, Alert, Tooltip, Typography,
} from '@mui/material';
import ShareIcon from '@mui/icons-material/Share';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import { FaWhatsapp, FaInstagram, FaFacebook } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { posterToBlob, createXOptimizedBlob } from '../utils/exportPoster';
import { uploadPosterShare } from '../../../services/posterTemplateService';
import type { PosterFormat } from '../types/posterTemplate';

interface Props {
  /** Ref to the HTMLDivElement rendered by DynamicPosterRenderer */
  posterRef: React.RefObject<HTMLDivElement | null>;
  filename?: string;
  /** Aktuell gewähltes Poster-Format – bestimmt ob der X-Preview-Dialog erscheint. */
  format?: PosterFormat;
}

type Platform = {
  id: string;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
  color: string;
  shareText: string;
  /** Baut die Plattform-URL wenn nativer File-Share nicht verfügbar ist. */
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
    buildFallbackUrl: () => null,
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
export function ExportActions({ posterRef, filename = 'poster.png', format = '1:1' }: Props) {
  const [loading, setLoading]       = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Poster wird erstellt…');
  const [notice, setNotice]         = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  // ── X / Twitter preview dialog ─────────────────────────────────────────────
  const [xPreviewOpen, setXPreviewOpen]   = useState(false);
  const [xPreviewUrl, setXPreviewUrl]     = useState<string | null>(null);
  const [xBlobPending, setXBlobPending]   = useState<Blob | null>(null);
  const [xPlatform, setXPlatform]         = useState<Platform | null>(null);

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

  function closeXPreview() {
    setXPreviewOpen(false);
    if (xPreviewUrl) URL.revokeObjectURL(xPreviewUrl);
    setXPreviewUrl(null);
    setXBlobPending(null);
    setXPlatform(null);
  }

  // ── handlers ───────────────────────────────────────────────────────────────

  /**
   * Teilt das Poster als Datei.
   *
   * Pfad 1 – nativer File-Share (Android, iOS, moderne Desktop-Browser):
   *   navigator.share({ files: [file] }) → OS-Share-Sheet → Nutzer wählt App.
   *   Gilt für ALLE Plattform-Buttons (WhatsApp, Instagram, Facebook, X) gleichermaßen.
   *   Haupt-Button: nur wenn canShare({ files }) = true.
   *
   * Pfad 2 – Fallback (wenn navigator.share nicht verfügbar oder fehlschlägt):
   *   Bild hochladen → OG-Landing-Page → Plattform-spezifische URL öffnen.
   *   WhatsApp/Facebook/X: zeigen eine Bildvorschau-Karte über die og:image-Tags.
   *   Instagram: keine URL-basierte Share-API → instagram.com öffnen.
   */
  async function shareAsFile(shareText: string, platform?: Platform) {
    const blob = await renderBlob();
    if (!blob) return;

    const file = new File([blob], filename, { type: 'image/png' });

    // ── Pfad 1: nativer File-Share ─────────────────────────────────────────
    if (typeof navigator.share === 'function') {
      // Plattform-Buttons: immer versuchen (canShare kann falsch-negativ sein).
      // Haupt-Button: nur wenn canShare(files) explizit true zurückgibt.
      const shouldTry = platform
        ? true
        : (navigator.canShare?.({ files: [file] }) ?? false);

      if (shouldTry) {
        try {
          await navigator.share({ files: [file], title: 'Poster teilen', text: shareText });
          return; // Erfolg oder Abbruch durch Nutzer
        } catch (err) {
          if ((err as DOMException).name === 'AbortError') return; // Nutzer hat abgebrochen
          if (!platform) {
            // Haupt-Button: Fehler anzeigen
            setError('Das Teilen ist fehlgeschlagen. Bitte versuche es erneut.');
            return;
          }
          // Plattform-Button: File-Share fehlgeschlagen → weiter zu Pfad 2
        }
      }
    }

    // ── Pfad 2: Fallback für Plattform-Buttons ─────────────────────────────
    // Bild hochladen → OG-Landing-Page-URL öffnen.
    // WhatsApp/Facebook/Twitter holen die og:image-Tags und zeigen eine Bildvorschau-Karte.
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

      // OG-Landing-Page-URL: /uploads/poster-share/share_xxx.png → /poster-share/share_xxx
      const sharePageUrl = shareUrl
        .replace('/uploads/poster-share/', '/poster-share/')
        .replace(/\.png$/i, '');

      const platformUrl = platform.buildFallbackUrl(sharePageUrl);
      if (platformUrl) {
        window.open(platformUrl, '_blank', 'noopener,noreferrer');
      } else {
        // Instagram: keine URL-basierte Share-API
        window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer');
      }
      return;
    }

    // Haupt-Share-Button ohne File-Share-Unterstützung:
    setError('Direktes Teilen von Bildern wird auf diesem System nicht unterstützt. Nutze einen der Plattform-Buttons.');
  }

  async function handleMainShare() {
    await shareAsFile('Schaut mal unser Poster an!');
  }

  async function handlePlatformShare(platform: Platform) {
    if (platform.id === 'twitter' && format !== '16:9') {
      await handleXShare(platform);
      return;
    }
    await shareAsFile(platform.shareText, platform);
  }

  /**
   * X/Twitter-spezifischer Share-Pfad (nur bei nicht-16:9-Formaten).
   * Versucht zunächst nativen File-Share. Schlägt dieser fehl, wird eine
   * 1920×1080-Version (Letterbox) generiert und ein Preview-Dialog gezeigt.
   */
  async function handleXShare(platform: Platform) {
    const blob = await renderBlob();
    if (!blob) return;

    const file = new File([blob], filename, { type: 'image/png' });

    // Nativen File-Share versuchen (kein URL-Preview beteiligt)
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ files: [file], title: 'Poster teilen', text: platform.shareText });
        return;
      } catch (err) {
        if ((err as DOMException).name === 'AbortError') return;
        // Fehlgeschlagen → weiter zum X-Preview-Dialog
      }
    }

    // 2:1-Version für X erzeugen
    setLoading(true);
    setLoadingMsg('X-Vorschau wird erstellt…');
    let xBlob: Blob;
    try {
      xBlob = await createXOptimizedBlob(blob);
    } catch {
      setError('X-Vorschau konnte nicht erstellt werden.');
      return;
    } finally {
      setLoading(false);
      setLoadingMsg('Poster wird erstellt…');
    }

    setXBlobPending(xBlob);
    setXPreviewUrl(URL.createObjectURL(xBlob));
    setXPlatform(platform);
    setXPreviewOpen(true);
  }

  /** Upload und Öffnen der X-Share-URL nach Bestätigung im Preview-Dialog. */
  async function handleXConfirm() {
    if (!xBlobPending || !xPlatform) return;
    closeXPreview();

    setLoading(true);
    setLoadingMsg('Poster wird hochgeladen…');
    let shareUrl: string;
    try {
      shareUrl = await uploadPosterShare(xBlobPending, filename);
    } catch {
      setError('Poster konnte nicht hochgeladen werden.');
      return;
    } finally {
      setLoading(false);
      setLoadingMsg('Poster wird erstellt…');
    }

    const sharePageUrl = shareUrl
      .replace('/uploads/poster-share/', '/poster-share/')
      .replace(/\.png$/i, '');

    const platformUrl = xPlatform.buildFallbackUrl(sharePageUrl);
    if (platformUrl) {
      window.open(platformUrl, '_blank', 'noopener,noreferrer');
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
      setError('Kopieren wird auf diesem Gerät nicht unterstützt. Bitte den Download-Button nutzen.');
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
      {/* X / Twitter Preview Dialog */}
      <Dialog
        open={xPreviewOpen}
        onClose={closeXPreview}
        maxWidth="sm"
        fullWidth
        data-testid="x-preview-dialog"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography component="span" sx={{
            fontWeight: 700
          }}>Vorschau für X</Typography>
          <IconButton size="small" aria-label="schließen" onClick={closeXPreview}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            X zeigt Bilder im 16:9-Format an. Damit dein Poster vollständig sichtbar bleibt,
            wird es mit schwarzen Balken ergänzt.
          </Alert>
          {xPreviewUrl && (
            <Box
              component="img"
              src={xPreviewUrl}
              alt="X-Vorschau"
              sx={{ width: '100%', display: 'block', borderRadius: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeXPreview}>Abbrechen</Button>
          <Button
            variant="contained"
            onClick={() => { void handleXConfirm(); }}
            startIcon={<FaXTwitter size={16} />}
            data-testid="x-preview-confirm"
          >
            Jetzt auf X teilen
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
