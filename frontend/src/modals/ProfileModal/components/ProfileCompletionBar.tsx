import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import type { CompletionItem } from '../hooks/useProfileCompletion';

interface ProfileCompletionBarProps {
  percent: number;
  color: 'success' | 'warning' | 'error';
  missing: CompletionItem[];
  onNavigateToTab: (tab: number) => void;
}

export function ProfileCompletionBar({ percent, color, missing, onNavigateToTab }: ProfileCompletionBarProps) {
  const tooltipTitle = missing.length === 0
    ? 'Profil vollständig!'
    : `Fehlt noch: ${missing.map(i => i.label).join(', ')}`;

  return (
    <Box sx={{ mt: 1.25, width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Tooltip title={tooltipTitle}>
          <LinearProgress
            variant="determinate"
            value={percent}
            color={color}
            sx={{ flex: 1, height: 6, borderRadius: 3 }}
          />
        </Tooltip>
        <Typography
          variant="caption"
          color={`${color}.main`}
          sx={{
            fontWeight: 700,
            minWidth: 34,
            textAlign: 'right',
            fontSize: '0.68rem'
          }}>
          {percent}%
        </Typography>
      </Box>
      {missing.length > 0 ? (
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            display: 'block',
            lineHeight: 1.7
          }}>
          {'Fehlt: '}
          {missing.slice(0, 3).map((item, idx) => (
            <React.Fragment key={item.key}>
              {idx > 0 && ' · '}
              <Box
                component="span"
                onClick={() => onNavigateToTab(item.tab)}
                sx={{ cursor: 'pointer', textDecoration: 'underline dotted', '&:hover': { color: 'primary.main' } }}
              >
                {item.label}
              </Box>
            </React.Fragment>
          ))}
          {missing.length > 3 && ` · +${missing.length - 3} weitere`}
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 13, color: 'success.main' }} />
          <Typography
            variant="caption"
            sx={{
              color: "success.main",
              fontWeight: 600,
              fontSize: '0.68rem'
            }}>
            Profil vollständig
          </Typography>
        </Box>
      )}
    </Box>
  );
}
