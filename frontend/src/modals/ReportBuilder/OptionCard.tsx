import React from 'react';
import { Box, ButtonBase, Card, CardContent, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { WizardOption } from './wizardTypes';

interface OptionCardProps<T extends string> {
  option: WizardOption<T>;
  selected: boolean;
  onSelect: (val: T) => void;
}

export function OptionCard<T extends string>({ option, selected, onSelect }: OptionCardProps<T>) {
  const theme = useTheme();
  return (
    <ButtonBase
      onClick={() => onSelect(option.value)}
      focusRipple
      sx={{
        display: 'block',
        textAlign: 'left',
        width: '100%',
        borderRadius: 2,
      }}
    >
      <Card
        variant={selected ? 'elevation' : 'outlined'}
        elevation={selected ? 3 : 0}
        sx={{
          border: 2,
          borderColor: selected ? 'primary.main' : 'divider',
          bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : 'background.paper',
          transition: 'all 0.15s ease',
          position: 'relative',
          width: '100%',
          minHeight: { xs: 72, sm: 'auto' },
        }}
      >
        {selected && (
          <CheckCircleIcon
            color="primary"
            sx={{ position: 'absolute', top: 8, right: 8, fontSize: '1.1rem' }}
          />
        )}
        <CardContent
          sx={{
            p: { xs: '12px !important', sm: '16px !important' },
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            // Mobile: horizontal (emoji + text); desktop: vertical (emoji above text)
            flexDirection: { xs: 'row', sm: 'column' },
          }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: { xs: '1.6rem', sm: '2rem' },
              lineHeight: 1,
              flexShrink: 0,
              display: 'block',
              textAlign: { xs: 'left', sm: 'center' },
              mb: { xs: 0, sm: 0.5 },
              width: { xs: 'auto', sm: '100%' },
            }}
          >
            {option.emoji}
          </Typography>
          <Box>
            <Typography
              variant="subtitle2"
              fontWeight={600}
              sx={{ fontSize: { xs: '0.9rem', sm: '0.95rem' }, lineHeight: 1.3 }}
            >
              {option.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.3 }}>
              {option.desc}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </ButtonBase>
  );
}
