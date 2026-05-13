import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import {
  fetchPosterTemplate,
  createPosterTemplate,
  updatePosterTemplate,
} from '../../../services/posterTemplateService';
import type { PosterElement, PosterFormat } from '../../PosterGenerator/types/posterTemplate';
import { createDefaultElement } from '../../PosterGenerator/types/posterTemplate';
import { usePosterFonts } from '../../PosterGenerator/hooks/usePosterFonts';
import { canvasHeight, emptyTemplate } from './helpers';
import type { EditorTemplate } from './types';

/** Wandelt beliebige CSS-Farbe in #rrggbb um; fällt auf Weiß zurück wenn ungültig. */
function normalizeColor(c: string | undefined | null, fallback = '#ffffff'): string {
  if (c && /^#[0-9a-fA-F]{6}$/.test(c)) return c;
  if (c) {
    const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) {
      return '#' + [m[1], m[2], m[3]]
        .map(n => parseInt(n, 10).toString(16).padStart(2, '0'))
        .join('');
    }
  }
  return fallback;
}
import EditorTopBar from './EditorTopBar';
import Toolbox from './Toolbox';
import PropertiesPanel from './PropertiesPanel';
import EditorCanvas from './EditorCanvas';
import PreviewDialog from './PreviewDialog';

export default function PosterTemplateEditor() {
  usePosterFonts();
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'neu';
  const navigate = useNavigate();

  const [template, setTemplate]     = useState<EditorTemplate>(emptyTemplate());
  const [loading, setLoading]       = useState(!isNew);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFormat, setActiveFormat] = useState<PosterFormat>('1:1');
  const [isDirty, setIsDirty]       = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    setLoading(true);
    fetchPosterTemplate(Number(id))
      .then(t => {
        if (cancelled) return;
        setTemplate({
          name: t.name,
          description: t.description ?? '',
          posterType: t.posterType,
          supportedFormats: t.supportedFormats,
          background: (() => {
            const bg = t.background;
            // Migriere altes type='image'-Format → neues Ebenen-Modell
            if (bg.type === 'image') {
              const color = normalizeColor(bg.overlayColor ?? bg.color, '#111111');
              const colorOpacity = bg.overlayOpacity ?? (bg.overlayColor ? 0.5 : 0);
              return { type: 'solid' as const, color, colorOpacity, imageUrl: bg.imageUrl };
            }
            return {
              ...bg,
              color: normalizeColor(bg.color, '#1a1a2e'),
              gradientColors: bg.gradientColors?.map(c => normalizeColor(c, '#1a1a2e')),
              overlayColor: undefined,
              overlayOpacity: undefined,
            };
          })(),
          elements: t.elements.map(el => ({
            ...el,
            color: normalizeColor(el.color, '#ffffff'),
            textGradient: el.textGradient ? {
              ...el.textGradient,
              stops: el.textGradient.stops.map(s => ({ ...s, color: normalizeColor(s.color, '#ffffff') })),
            } : undefined,
          })),
        });
        if (t.supportedFormats[0]) setActiveFormat(t.supportedFormats[0]);
      })
      .catch(() => setError('Vorlage konnte nicht geladen werden.'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, isNew]);

  const update = useCallback((partial: Partial<EditorTemplate>) => {
    setTemplate(prev => ({ ...prev, ...partial }));
    setIsDirty(true);
  }, []);

  const updateElement = useCallback((el: PosterElement) => {
    setTemplate(prev => ({
      ...prev,
      elements: prev.elements.map(e => e.id === el.id ? el : e),
    }));
    setIsDirty(true);
  }, []);

  const addElement = (el: PosterElement) => {
    update({ elements: [...template.elements, el] });
    setSelectedId(el.id);
  };

  const deleteElement = (elId: string) => {
    update({ elements: template.elements.filter(e => e.id !== elId) });
    setSelectedId(null);
  };

  const handleSave = async () => {
    if (!template.name.trim()) {
      setError('Bitte gib einen Namen für die Vorlage ein.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const created = await createPosterTemplate(template);
        setIsDirty(false);
        navigate(`/admin/poster-vorlagen/${created.id}`, { replace: true });
      } else {
        await updatePosterTemplate(Number(id), template);
        setIsDirty(false);
      }
    } catch {
      setError('Vorlage konnte nicht gespeichert werden.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (isDirty) { setConfirmLeave(true); return; }
    navigate('/admin/poster-vorlagen');
  };

  const selectedEl = template.elements.find(e => e.id === selectedId) ?? null;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <EditorTopBar
        name={template.name}
        posterType={template.posterType}
        supportedFormats={template.supportedFormats}
        activeFormat={activeFormat}
        isDirty={isDirty}
        saving={saving}
        onNameChange={name => update({ name })}
        onTypeChange={posterType => update({ posterType })}
        onFormatToggle={fmt => {
          const next = template.supportedFormats.includes(fmt)
            ? template.supportedFormats.filter(f => f !== fmt)
            : [...template.supportedFormats, fmt];
          if (next.length > 0) update({ supportedFormats: next });
        }}
        onFormatPreview={setActiveFormat}
        onPreviewOpen={() => setShowPreview(true)}
        onSave={handleSave}
        onBack={handleBack}
      />

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ borderRadius: 0 }}>
          {error}
        </Alert>
      )}

      {confirmLeave && (
        <Dialog open>
          <DialogTitle>Ungespeicherte Änderungen</DialogTitle>
          <DialogContent>
            <Typography sx={{ mt: 1 }}>Es gibt ungespeicherte Änderungen. Wirklich verlassen?</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmLeave(false)}>Bleiben</Button>
            <Button color="error" variant="contained" onClick={() => navigate('/admin/poster-vorlagen')}>
              Verlassen
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Box sx={{ width: 240, flexShrink: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden' }}>
          <Toolbox
            onAddPlaceholder={key => {
              const el = createDefaultElement('placeholder');
              el.placeholder = key;
              el.y = Math.min(95, template.elements.length * 12);
              addElement(el);
            }}
            onAddCustomText={() => {
              const el = createDefaultElement('custom_text');
              el.y = Math.min(95, template.elements.length * 12);
              addElement(el);
            }}
            background={template.background}
            onBgChange={bg => update({ background: bg })}
            posterType={template.posterType}
          />
        </Box>

        <EditorCanvas
          template={template}
          canvasH={canvasHeight(activeFormat)}
          selectedId={selectedId}
          onClickBackground={() => setSelectedId(null)}
          onElementClick={setSelectedId}
          onElementChange={updateElement}
          canvasRef={canvasRef}
        />

        <Box sx={{ width: 256, flexShrink: 0, borderLeft: 1, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden' }}>
          {selectedEl ? (
            <PropertiesPanel
              element={selectedEl}
              onChange={updateElement}
              onDelete={() => deleteElement(selectedEl.id)}
            />
          ) : (
            <Box sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Element auf dem Canvas anklicken zum Bearbeiten.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>

      <PreviewDialog
        open={showPreview}
        onClose={() => setShowPreview(false)}
        template={template}
        activeFormat={activeFormat}
      />
    </Box>
  );
}
