import React from 'react';
import { Box, useTheme, alpha } from '@mui/material';
import { BACKEND_URL } from '../../config';

interface RichTextContentProps {
  html: string;
  /** compact=true verringert Abstände für Karten-Vorschau */
  compact?: boolean;
}

/**
 * Rendert Tiptap-HTML-Inhalt mit schöner Typografie und Theme-Anpassung.
 * Löst relative /uploads/... Bild-Pfade in absolute API-URLs auf.
 */
const RichTextContent: React.FC<RichTextContentProps> = ({ html, compact = false }) => {
  const theme = useTheme();

  // Relative Bild-URLs auf den Backend-Host umschreiben
  const resolvedHtml = html.replace(
    /src="(\/uploads\/[^"]+)"/g,
    (_, path) => `src="${BACKEND_URL}${path}"`
  );

  return (
    <Box
      className="rich-text-content"
      dangerouslySetInnerHTML={{ __html: resolvedHtml }}
      sx={{
        // ── Base typography ─────────────────────────────────────────────────
        fontFamily: theme.typography.fontFamily,
        fontSize: compact ? '0.875rem' : '1.05rem',
        lineHeight: compact ? 1.5 : 1.85,
        color: 'text.primary',
        wordBreak: 'break-word',

        // ── Headings ────────────────────────────────────────────────────────
        '& h1': {
          fontSize: compact ? '1.2rem' : '1.9rem',
          fontWeight: 800,
          mt: compact ? 0 : 3,
          mb: compact ? 0.5 : 1.5,
          lineHeight: 1.25,
          letterSpacing: '-0.02em',
          color: 'text.primary',
        },
        '& h2': {
          fontSize: compact ? '1.05rem' : '1.45rem',
          fontWeight: 700,
          mt: compact ? 0 : 2.5,
          mb: compact ? 0.25 : 1,
          lineHeight: 1.3,
          letterSpacing: '-0.01em',
          color: 'text.primary',
          borderBottom: compact ? 'none' : `1px solid ${theme.palette.divider}`,
          pb: compact ? 0 : 0.75,
        },
        '& h3': {
          fontSize: compact ? '0.95rem' : '1.15rem',
          fontWeight: 700,
          mt: compact ? 0 : 2,
          mb: compact ? 0.25 : 0.75,
          lineHeight: 1.35,
          color: 'text.primary',
        },

        // ── Paragraphs ───────────────────────────────────────────────────────
        '& p': {
          mt: 0,
          mb: compact ? 0 : '0.75em',
        },
        '& p:last-child': { mb: 0 },

        // ── Links ────────────────────────────────────────────────────────────
        '& a': {
          color: theme.palette.primary.main,
          textDecoration: 'underline',
          fontWeight: 500,
          '&:hover': { color: theme.palette.primary.dark },
        },

        // ── Lists ────────────────────────────────────────────────────────────
        '& ul': {
          pl: '1.5em',
          mb: compact ? 0 : '0.75em',
          mt: 0,
          '& li': {
            mb: compact ? 0 : '0.25em',
            '&::marker': { color: theme.palette.primary.main },
          },
        },
        '& ol': {
          pl: '1.5em',
          mb: compact ? 0 : '0.75em',
          mt: 0,
          '& li': {
            mb: compact ? 0 : '0.25em',
            '&::marker': {
              color: theme.palette.primary.main,
              fontWeight: 700,
            },
          },
        },

        // ── Blockquote ───────────────────────────────────────────────────────
        '& blockquote': {
          borderLeft: `4px solid ${theme.palette.primary.main}`,
          background: alpha(theme.palette.primary.main, 0.05),
          pl: '1.25em',
          pr: '1em',
          py: compact ? '0.25em' : '0.75em',
          ml: 0,
          mr: 0,
          my: compact ? '0.25em' : '1em',
          borderRadius: '0 6px 6px 0',
          color: 'text.secondary',
          fontStyle: 'italic',
          '& p': { mb: 0 },
        },

        // ── Inline code ──────────────────────────────────────────────────────
        '& code': {
          background: theme.palette.mode === 'dark'
            ? alpha(theme.palette.common.white, 0.1)
            : alpha(theme.palette.common.black, 0.06),
          color: theme.palette.mode === 'dark'
            ? theme.palette.warning.light
            : theme.palette.warning.dark,
          px: '5px',
          py: '1px',
          borderRadius: '4px',
          fontFamily: '"Fira Code", "Cascadia Code", monospace',
          fontSize: '0.875em',
        },

        // ── Code block ───────────────────────────────────────────────────────
        '& pre': {
          background: theme.palette.mode === 'dark'
            ? alpha(theme.palette.common.white, 0.06)
            : '#f6f8fa',
          border: `1px solid ${theme.palette.divider}`,
          p: compact ? '0.5em' : '1em 1.25em',
          borderRadius: '8px',
          my: compact ? '0.25em' : '1em',
          overflowX: 'auto',
          '& code': {
            background: 'transparent',
            color: 'inherit',
            px: 0,
            py: 0,
            fontSize: '0.875rem',
          },
        },

        // ── Horizontal Rule ──────────────────────────────────────────────────
        '& hr': {
          my: compact ? '0.5em' : '1.75em',
          border: 'none',
          borderTop: `2px solid ${theme.palette.divider}`,
        },

        // ── Images ───────────────────────────────────────────────────────────
        '& img': {
          maxWidth: '100%',
          height: 'auto',
          borderRadius: '8px',
          display: 'block',
          my: compact ? '0.5em' : '1.25em',
          boxShadow: compact ? 'none' : theme.shadows[2],
          mx: 'auto',
        },

        // ── Highlight ────────────────────────────────────────────────────────
        '& mark': {
          background: '#ffe066',
          color: '#333',
          borderRadius: '3px',
          px: '3px',
        },

        // ── Strong / Em ──────────────────────────────────────────────────────
        '& strong': { fontWeight: 700 },
        '& em': { fontStyle: 'italic' },
        '& s': { textDecoration: 'line-through', color: 'text.secondary' },
        '& u': { textDecoration: 'underline' },

        // ── Table (falls später erweitert) ───────────────────────────────────
        '& table': {
          borderCollapse: 'collapse',
          width: '100%',
          my: compact ? '0.25em' : '1em',
          fontSize: '0.95em',
        },
        '& th, & td': {
          border: `1px solid ${theme.palette.divider}`,
          px: '0.75em',
          py: '0.5em',
          textAlign: 'left',
        },
        '& th': {
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          fontWeight: 700,
        },
        '& tr:nth-of-type(even) td': {
          bgcolor: alpha(theme.palette.action.hover, 0.5),
        },
      }}
    />
  );
};

export default RichTextContent;
