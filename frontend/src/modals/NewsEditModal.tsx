import React, { useState, useEffect } from 'react';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, TextField, Box, Typography, Stack,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { apiJson } from '../utils/api';
import RichTextEditor from '../components/RichTextEditor';
import NewsTemplatePicker from '../components/NewsTemplatePicker';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  news: { id: number; title: string; content: string; };
}

const NewsEditModal: React.FC<Props> = ({ open, onClose, onSuccess, news }) => {
  const [title, setTitle] = useState(news.title);
  const [content, setContent] = useState(news.content);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    setTitle(news.title);
    setContent(news.content);
    setError(null);
  }, [news, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content || content === '<p></p>') {
      setError('Bitte füge einen Inhalt hinzu.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = { title, content };
      const res = await apiJson(`/news/${news.id}/edit`, { method: 'POST', body: payload });
      const data = res as { success?: boolean; error?: string };
      if (data.success) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || 'Fehler beim Speichern');
      }
    } catch (e) {
      setError('Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>Neuigkeit bearbeiten</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 1 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <TextField
            label="Titel"
            value={title}
            onChange={e => setTitle(e.target.value)}
            fullWidth
            required
            sx={{ mb: 2 }}
            disabled={loading}
            inputProps={{ maxLength: 200 }}
          />

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                Inhalt
              </Typography>
              <Button
                size="small"
                variant="outlined"
                color="secondary"
                startIcon={<AutoAwesomeIcon sx={{ fontSize: '0.95rem !important' }} />}
                onClick={() => setPickerOpen(true)}
                disabled={loading}
                sx={{ fontSize: '0.72rem', py: 0.25, px: 1 }}
              >
                Vorlage
              </Button>
            </Stack>
            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Schreibe hier deine Neuigkeit…"
              minHeight={320}
              disabled={loading}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="secondary" disabled={loading}>Abbrechen</Button>
          <Button type="submit" color="primary" variant="contained" disabled={loading} sx={{ minWidth: 120 }}>
            {loading ? 'Wird gespeichert…' : 'Speichern'}
          </Button>
        </DialogActions>
      </form>

      <NewsTemplatePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onApply={html => setContent(html)}
        hasContent={!!content && content !== '<p></p>'}
      />
    </Dialog>
  );
};

export default NewsEditModal;
