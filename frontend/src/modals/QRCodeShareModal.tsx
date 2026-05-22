import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { QRCodeCanvas } from 'qrcode.react';
import BaseModal from './BaseModal';

interface QRCodeShareModalProps {
  open: boolean;
  onClose: () => void;
}

export default function QRCodeShareModal({ open, onClose }: QRCodeShareModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  const registerUrl = `${window.location.origin}/?modal=register`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(registerUrl);
      setCopied(true);
    } catch {
      // Fallback für ältere Browser
      const input = document.createElement('input');
      input.value = registerUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kaderblick-registrierung-qr.png';
    link.click();
  };

  return (
    <>
      <BaseModal
        open={open}
        onClose={onClose}
        maxWidth="xs"
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <QrCode2Icon />
            <Typography variant="h6" component="span">
              Registrierungs-QR-Code
            </Typography>
          </Box>
        }
        showCloseButton
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              textAlign: "center"
            }}>
            Teile diesen QR-Code — wer ihn scannt, landet direkt auf dem Registrierungs-Formular.
          </Typography>

          {/* QR Code */}
          <Box
            sx={{
              p: 2,
              bgcolor: '#fff',
              borderRadius: 2,
              boxShadow: 2,
              display: 'inline-flex',
            }}
          >
            <QRCodeCanvas
              ref={canvasRef}
              value={registerUrl}
              size={220}
              level="M"
              marginSize={1}
            />
          </Box>

          {/* URL anzeigen */}
          <Box
            sx={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'action.hover',
              borderRadius: 1,
              px: 1.5,
              py: 1,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
              }}
            >
              {registerUrl}
            </Typography>
            <Tooltip title="Link kopieren">
              <IconButton size="small" onClick={handleCopy}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {/* Aktions-Buttons */}
          <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
            <Button
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopy}
              fullWidth
            >
              Link kopieren
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              fullWidth
            >
              QR herunterladen
            </Button>
          </Box>
        </Box>
      </BaseModal>
      <Snackbar
        open={copied}
        autoHideDuration={2500}
        onClose={() => setCopied(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setCopied(false)} sx={{ width: '100%' }}>
          Link in die Zwischenablage kopiert!
        </Alert>
      </Snackbar>
    </>
  );
}
