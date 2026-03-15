import React, { useState, useEffect } from 'react';
import {
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Alert, TextField, Box, Typography,
} from '@mui/material';
import { apiJson } from '../utils/api';
import RichTextEditor from '../components/RichTextEditor';

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
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500 }}>
              Inhalt
            </Typography>
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
    </Dialog>
  );
};

export default NewsEditModal;
