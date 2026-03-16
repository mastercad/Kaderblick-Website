import React, { useCallback, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import ImageExtension from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { BACKEND_URL } from '../../config';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import {
  Box, IconButton, Tooltip, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, TextField, Stack,
  Paper, CircularProgress, useTheme, alpha, Typography,
} from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import CodeIcon from '@mui/icons-material/Code';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import ImageIcon from '@mui/icons-material/Image';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatClearIcon from '@mui/icons-material/FormatClear';
import { apiRequest } from '../utils/api';

// ── Custom Image extension – preserves the class attribute ───────────────────
const CustomImage = ImageExtension.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      class: {
        default: null,
        parseHTML: (element) => element.getAttribute('class'),
        renderHTML: (attributes) => {
          if (!attributes.class) return {};
          return { class: attributes.class };
        },
      },
    };
  },
});

// ── Image size options ────────────────────────────────────────────────────────
const IMAGE_SIZE_OPTIONS: Array<{ id: string; label: string; desc: string; maxWidth: string }> = [
  { id: 'img-banner', label: 'Banner',  desc: 'Vollbild – für Fotos & Gruppenbilder',              maxWidth: '100%' },
  { id: 'img-large',  label: 'Groß',    desc: '80 % Breite – für Screenshots & Infografiken',       maxWidth: '80%'  },
  { id: 'img-medium', label: 'Mittel',  desc: '55 % Breite – Feature-Vorschau (empfohlen)',          maxWidth: '55%'  },
  { id: 'img-small',  label: 'Klein',   desc: '30 % Breite – Logos, Icons & kleine Highlights',     maxWidth: '30%'  },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number | string;
  disabled?: boolean;
}

// ── Toolbar Button ─────────────────────────────────────────────────────────────
const ToolBtn: React.FC<{
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}> = ({ onClick, active, disabled, title, children }) => {
  const theme = useTheme();
  return (
    <Tooltip title={title} placement="top">
      <span>
        <IconButton
          size="small"
          onMouseDown={e => { e.preventDefault(); onClick(); }}
          disabled={disabled}
          sx={{
            borderRadius: 1,
            p: '4px',
            color: active ? theme.palette.primary.main : 'text.secondary',
            bgcolor: active ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
            '&:hover': {
              bgcolor: active
                ? alpha(theme.palette.primary.main, 0.2)
                : alpha(theme.palette.text.primary, 0.06),
            },
          }}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
};

// ── Heading Button ─────────────────────────────────────────────────────────────
const HeadingBtn: React.FC<{
  level: 1 | 2 | 3;
  active: boolean;
  onClick: () => void;
}> = ({ level, active, onClick }) => {
  const theme = useTheme();
  const labels: Record<number, string> = { 1: 'H1', 2: 'H2', 3: 'H3' };
  return (
    <Tooltip title={`Überschrift ${level}`} placement="top">
      <Box
        component="span"
        onMouseDown={e => { e.preventDefault(); onClick(); }}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 28,
          height: 28,
          borderRadius: 1,
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: level === 1 ? 13 : level === 2 ? 12 : 11,
          color: active ? theme.palette.primary.main : 'text.secondary',
          bgcolor: active ? alpha(theme.palette.primary.main, 0.12) : 'transparent',
          '&:hover': {
            bgcolor: active
              ? alpha(theme.palette.primary.main, 0.2)
              : alpha(theme.palette.text.primary, 0.06),
          },
          userSelect: 'none',
        }}
      >
        {labels[level]}
      </Box>
    </Tooltip>
  );
};

// ── Toolbar Divider ────────────────────────────────────────────────────────────
const ToolDivider: React.FC = () => (
  <Divider orientation="vertical" flexItem sx={{ mx: 0.5, my: 0.5 }} />
);

// ── Main Component ─────────────────────────────────────────────────────────────
const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Schreibe hier deine Neuigkeit…',
  minHeight = 280,
  disabled = false,
}) => {
  const theme = useTheme();
  // Relative Bild-Pfade aus DB zu absoluten URLs umschreiben, damit sie im Editor laden
  const normalizeContent = useCallback((html: string): string => {
    if (!html) return html;
    return html.replace(
      /src="(\/uploads\/[^"]+)"/g,
      (_, path) => `src="${BACKEND_URL}${path}"`,
    );
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [imageSizeOpen, setImageSizeOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState('');
  const [imageSize, setImageSize] = useState<string>('img-medium');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { languageClassPrefix: 'language-' },
      }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      LinkExtension.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      CustomImage.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: normalizeContent(value || ''),
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  // Sync external value changes (e.g., when modal opens with existing content)
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = normalizeContent(value || '');
    if (current !== incoming) {
      editor.commands.setContent(incoming);
    }
  }, [value, editor]);

  // ── Link dialog ─────────────────────────────────────────────────────────────
  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const selection = editor.state.selection;
    const existingHref = editor.getAttributes('link').href || '';
    const selectedText = editor.state.doc.textBetween(
      selection.from, selection.to, ''
    );
    setLinkUrl(existingHref);
    setLinkText(selectedText);
    setLinkDialogOpen(true);
  }, [editor]);

  const applyLink = useCallback(() => {
    if (!editor) return;
    const href = linkUrl.trim();
    if (!href) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const url = href.startsWith('http') ? href : `https://${href}`;
      if (linkText && editor.state.selection.empty) {
        editor.chain().focus()
          .insertContent(`<a href="${url}">${linkText}</a>`)
          .run();
      } else {
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
      }
    }
    setLinkDialogOpen(false);
    setLinkUrl('');
    setLinkText('');
  }, [editor, linkUrl, linkText]);

  // ── Image URL dialog ────────────────────────────────────────────────────────
  const applyImageUrl = useCallback(() => {
    if (!editor || !imageUrl.trim()) return;
    const src = imageUrl.trim();
    setImageDialogOpen(false);
    setImageUrl('');
    setPendingImageSrc(src);
    setImageSizeOpen(true);
  }, [editor, imageUrl]);

  // ── Confirm image insertion with chosen size ──────────────────────────────
  const confirmInsertImage = useCallback(() => {
    if (!editor || !pendingImageSrc) return;
    // Use insertContent so we can attach the class attribute freely
    const cls = imageSize && imageSize !== 'img-banner' ? ` class="${imageSize}"` : '';
    editor.chain().focus().insertContent(`<img src="${pendingImageSrc}"${cls}>`).run();
    setImageSizeOpen(false);
    setPendingImageSrc('');
  }, [editor, pendingImageSrc, imageSize]);

  // ── Image file upload ───────────────────────────────────────────────────────
  const handleImageFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    e.target.value = '';
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await apiRequest('/news/image/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.url) {
        // Absolute URL verwenden, damit das Bild im Editor (anderer Host als Frontend) korrekt angezeigt wird
        const absoluteUrl = data.url.startsWith('http') ? data.url : `${BACKEND_URL}${data.url}`;
        setPendingImageSrc(absoluteUrl);
        setImageSizeOpen(true);
      }
    } catch {
      // silently fail – user can retry
    } finally {
      setUploading(false);
    }
  }, [editor]);

  if (!editor) return null;

  // ── Toolbar State ───────────────────────────────────────────────────────────
  const is = (mark: string, attrs?: Record<string, any>) =>
    attrs ? editor.isActive(mark, attrs) : editor.isActive(mark);

  return (
    <Box>
      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <Paper
        variant="outlined"
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 0.25,
          p: '4px 6px',
          borderBottom: 'none',
          borderRadius: '8px 8px 0 0',
          bgcolor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.background.paper, 0.6)
            : alpha(theme.palette.grey[50], 1),
        }}
      >
        {/* History */}
        <ToolBtn title="Rückgängig (Strg+Z)" onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}><UndoIcon fontSize="small" /></ToolBtn>
        <ToolBtn title="Wiederholen (Strg+Y)" onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}><RedoIcon fontSize="small" /></ToolBtn>

        <ToolDivider />

        {/* Headings */}
        <HeadingBtn level={1} active={is('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} />
        <HeadingBtn level={2} active={is('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
        <HeadingBtn level={3} active={is('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />

        <ToolDivider />

        {/* Inline formatting */}
        <ToolBtn title="Fett (Strg+B)" active={is('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}>
          <FormatBoldIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn title="Kursiv (Strg+I)" active={is('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}>
          <FormatItalicIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn title="Unterstrichen (Strg+U)" active={is('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <FormatUnderlinedIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn title="Durchgestrichen" active={is('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}>
          <StrikethroughSIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn title="Hervorheben" active={is('highlight')}
          onClick={() => editor.chain().focus().toggleHighlight().run()}>
          <Box sx={{ width: 16, height: 16, bgcolor: '#ffe066', borderRadius: 0.5, border: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>A</Box>
        </ToolBtn>
        <ToolBtn title="Code" active={is('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}>
          <CodeIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn title="Formatierung entfernen"
          onClick={() => editor.chain().focus().unsetAllMarks().run()}>
          <FormatClearIcon fontSize="small" />
        </ToolBtn>

        <ToolDivider />

        {/* Alignment */}
        <ToolBtn title="Linksbündig" active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}>
          <FormatAlignLeftIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn title="Zentriert" active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}>
          <FormatAlignCenterIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn title="Rechtsbündig" active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}>
          <FormatAlignRightIcon fontSize="small" />
        </ToolBtn>

        <ToolDivider />

        {/* Lists */}
        <ToolBtn title="Aufzählung" active={is('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <FormatListBulletedIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn title="Nummerierte Liste" active={is('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <FormatListNumberedIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn title="Zitat" active={is('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <FormatQuoteIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn title="Trennlinie"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <HorizontalRuleIcon fontSize="small" />
        </ToolBtn>

        <ToolDivider />

        {/* Media & Links */}
        <ToolBtn title="Link einfügen" active={is('link')}
          onClick={openLinkDialog}>
          <LinkIcon fontSize="small" />
        </ToolBtn>
        <ToolBtn title="Link entfernen" disabled={!is('link')}
          onClick={() => editor.chain().focus().unsetLink().run()}>
          <LinkOffIcon fontSize="small" />
        </ToolBtn>

        <Tooltip title="Bild einfügen">
          <span>
            <IconButton
              size="small"
              onMouseDown={e => {
                e.preventDefault();
                setImageDialogOpen(true);
              }}
              disabled={uploading}
              sx={{ borderRadius: 1, p: '4px' }}
            >
              {uploading
                ? <CircularProgress size={16} />
                : <ImageIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          style={{ display: 'none' }}
          onChange={handleImageFileChange}
        />
      </Paper>

      {/* ── Editor Area ───────────────────────────────────────────────────── */}
      <Paper
        variant="outlined"
        sx={{
          borderRadius: '0 0 8px 8px',
          cursor: 'text',
          bgcolor: 'background.paper',
          '& .ProseMirror': {
            minHeight,
            p: '12px 16px',
            outline: 'none',
            lineHeight: 1.75,
            fontSize: '1rem',
            color: 'text.primary',
            // Placeholder
            '& p.is-editor-empty:first-of-type::before': {
              content: 'attr(data-placeholder)',
              color: theme.palette.text.disabled,
              float: 'left',
              height: 0,
              pointerEvents: 'none',
            },
            // Headings
            '& h1': { fontSize: '1.75rem', fontWeight: 700, mt: 2, mb: 1, lineHeight: 1.3 },
            '& h2': { fontSize: '1.35rem', fontWeight: 700, mt: 2, mb: 1, lineHeight: 1.3 },
            '& h3': { fontSize: '1.1rem', fontWeight: 700, mt: 1.5, mb: 0.75, lineHeight: 1.3 },
            // Paragraphs
            '& p': { margin: '0 0 0.5em' },
            '& p:last-child': { marginBottom: 0 },
            // Links  
            '& a': {
              color: theme.palette.primary.main,
              textDecoration: 'underline',
              cursor: 'pointer',
            },
            // Lists
            '& ul, & ol': { pl: '1.5em', mb: '0.5em' },
            '& li': { mb: '0.1em' },
            // Blockquote
            '& blockquote': {
              borderLeft: `4px solid ${theme.palette.primary.main}`,
              pl: '1em',
              ml: 0,
              mr: 0,
              my: '0.75em',
              color: 'text.secondary',
              fontStyle: 'italic',
            },
            // Code
            '& code': {
              bgcolor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.common.white, 0.08)
                : alpha(theme.palette.common.black, 0.06),
              px: '4px',
              py: '2px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '0.875em',
            },
            '& pre': {
              bgcolor: theme.palette.mode === 'dark'
                ? alpha(theme.palette.common.white, 0.08)
                : alpha(theme.palette.common.black, 0.06),
              p: '1em',
              borderRadius: '6px',
              my: '0.75em',
              overflowX: 'auto',
              '& code': { bgcolor: 'transparent', p: 0 },
            },
            // HR
            '& hr': {
              my: '1.5em',
              border: 'none',
              borderTop: `1px solid ${theme.palette.divider}`,
            },
            // Images
            '& img': {
              maxWidth: '100%',
              height: 'auto',
              borderRadius: '6px',
              display: 'block',
              my: '0.75em',
              mx: 'auto',
            },
            '& img.img-large':  { maxWidth: '80%' },
            '& img.img-medium': { maxWidth: '55%' },
            '& img.img-small':  { maxWidth: '30%' },
            // Highlight
            '& mark': {
              bgcolor: '#ffe066',
              borderRadius: '3px',
              px: '2px',
            },
          },
        }}
        onClick={() => editor.commands.focus()}
      >
        <EditorContent editor={editor} />
      </Paper>

      {/* ── Link Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={linkDialogOpen} onClose={() => setLinkDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Link einfügen</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {editor.state.selection.empty && (
              <TextField
                label="Link-Text"
                value={linkText}
                onChange={e => setLinkText(e.target.value)}
                fullWidth
                size="small"
                placeholder="z.B. Mehr erfahren"
              />
            )}
            <TextField
              label="URL"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              fullWidth
              size="small"
              placeholder="https://beispiel.de"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink(); } }}
              autoFocus
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialogOpen(false)}>Abbrechen</Button>
          <Button variant="contained" onClick={applyLink}>Einfügen</Button>
        </DialogActions>
      </Dialog>

      {/* ── Image Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={imageDialogOpen} onClose={() => setImageDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Bild einfügen</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Button
              variant="outlined"
              startIcon={<ImageIcon />}
              onClick={() => {
                setImageDialogOpen(false);
                fileInputRef.current?.click();
              }}
              fullWidth
            >
              Bild vom Computer hochladen
            </Button>
            <Divider>oder</Divider>
            <TextField
              label="Bild-URL"
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              fullWidth
              size="small"
              placeholder="https://beispiel.de/bild.jpg"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyImageUrl(); } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setImageDialogOpen(false); setImageUrl(''); }}>Abbrechen</Button>
          <Button variant="contained" onClick={applyImageUrl} disabled={!imageUrl.trim()}>Weiter →</Button>
        </DialogActions>
      </Dialog>

      {/* ── Image Size Picker ─────────────────────────────────────────── */}
      <Dialog
        open={imageSizeOpen}
        onClose={() => { setImageSizeOpen(false); setPendingImageSrc(''); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 0.5 }}>Bildgröße wählen</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Wie soll das Bild im Artikel erscheinen?
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            {IMAGE_SIZE_OPTIONS.map(opt => {
              const selected = imageSize === opt.id;
              return (
                <Box
                  key={opt.id}
                  onClick={() => setImageSize(opt.id)}
                  sx={{
                    border: `2px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
                    borderRadius: 2,
                    p: 1.5,
                    cursor: 'pointer',
                    bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
                    transition: 'all 0.15s',
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      bgcolor: alpha(theme.palette.primary.main, 0.04),
                    },
                  }}
                >
                  {/* Proportional image block preview */}
                  <Box sx={{
                    width: '100%',
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(theme.palette.action.hover, 0.7),
                    borderRadius: 1,
                    mb: 1,
                    overflow: 'hidden',
                  }}>
                    <Box sx={{
                      width: opt.maxWidth,
                      height: 28,
                      bgcolor: selected
                        ? alpha(theme.palette.primary.main, 0.35)
                        : alpha(theme.palette.text.disabled, 0.25),
                      borderRadius: '3px',
                      border: `2px solid ${selected ? theme.palette.primary.main : theme.palette.divider}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          color: selected ? theme.palette.primary.main : theme.palette.text.disabled,
                          userSelect: 'none',
                        }}
                      >
                        {opt.maxWidth}
                      </Typography>
                    </Box>
                  </Box>
                  <Typography
                    variant="body2"
                    fontWeight={700}
                    textAlign="center"
                    color={selected ? 'primary' : 'text.primary'}
                  >
                    {opt.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    textAlign="center"
                    display="block"
                    sx={{ mt: 0.25, lineHeight: 1.3 }}
                  >
                    {opt.desc}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setImageSizeOpen(false); setPendingImageSrc(''); }}>Abbrechen</Button>
          <Button variant="contained" onClick={confirmInsertImage}>Einfügen</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RichTextEditor;
