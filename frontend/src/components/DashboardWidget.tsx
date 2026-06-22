import React from 'react';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import IconButton from '@mui/material/IconButton';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import SettingsIcon from '@mui/icons-material/Settings';
import EditIcon from '@mui/icons-material/Edit';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

export type DashboardWidgetProps = {
  id: string;
  type: string;
  title: string;
  loading?: boolean;
  onRefresh?: () => void;
  onDelete?: () => void;
  onSettings?: () => void;
  onEditReport?: () => void;
  dragHandle?: React.ReactNode;
  children?: React.ReactNode;
};

const DashboardWidgetInner = (
  {
    id,
    type,
    title,
    loading = false,
    onRefresh,
    onDelete,
    onSettings,
    onEditReport,
    dragHandle,
    children,
    ...rest
  }: DashboardWidgetProps,
  ref: React.Ref<any>
) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  return (
    <Card
      ref={ref}
      sx={{ 
        width: { xs: '100%', sm: '100%' },
        minWidth: { xs: '100%', sm: 180 },
        maxWidth: '100%',
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        boxSizing: 'border-box',
        p: 0,
        overflow: 'hidden',
        '& .MuiCardHeader-action': {
          alignSelf: 'flex-start',
          marginTop: 0
        }
      }}
      {...rest}
    >
      <CardHeader
        title={
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center',
            gap: 1
          }}>
            {dragHandle}
            <Box sx={{ 
              fontSize: { xs: '0.95rem', sm: '1.05rem' },
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {title}
            </Box>
          </Box>
        }
        action={
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            <IconButton 
              size={isMobile ? "small" : "medium"} 
              onClick={onRefresh} 
              title="Aktualisieren"
              sx={{ 
                minWidth: { xs: 32, sm: 40 },
                height: { xs: 32, sm: 40 }
              }}
            >
              <RefreshIcon fontSize={isMobile ? "small" : "medium"} />
            </IconButton>
            {onEditReport && (
              <IconButton
                size={isMobile ? "small" : "medium"}
                onClick={onEditReport}
                title="Report bearbeiten"
                sx={{
                  minWidth: { xs: 32, sm: 40 },
                  height: { xs: 32, sm: 40 }
                }}
              >
                <EditIcon fontSize={isMobile ? "small" : "medium"} />
              </IconButton>
            )}
            <IconButton 
              size={isMobile ? "small" : "medium"} 
              onClick={onSettings} 
              title="Einstellungen"
              sx={{ 
                minWidth: { xs: 32, sm: 40 },
                height: { xs: 32, sm: 40 }
              }}
            >
              <SettingsIcon fontSize={isMobile ? "small" : "medium"} />
            </IconButton>
            <IconButton 
              size={isMobile ? "small" : "medium"} 
              onClick={onDelete} 
              title="Entfernen" 
              color="error"
              sx={{ 
                minWidth: { xs: 32, sm: 40 },
                height: { xs: 32, sm: 40 }
              }}
            >
              <DeleteIcon fontSize={isMobile ? "small" : "medium"} />
            </IconButton>
          </Box>
        }
        sx={{ 
        px: { xs: 1.5, sm: 2 },
        py: { xs: 1.25, sm: 1.5 },
        minHeight: { xs: 52, sm: 60 },
        borderBottom: '1px solid',
        borderColor: 'divider',
          '& .MuiCardHeader-content': {
            overflow: 'hidden'
          }
        }}
      />
      <CardContent sx={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'flex-start', 
        justifyContent: 'flex-start', 
        minHeight: { xs: 120, sm: 160 },
        p: { xs: 1.5, sm: 2 },
        '&:last-child': {
          paddingBottom: { xs: 1, sm: 2 }
        }
      }}>
        {loading ? (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            width: '100%', 
            height: '100%' 
          }}>
            <CircularProgress size={isMobile ? 20 : 24} />
          </Box>
        ) : children}
      </CardContent>
    </Card>
  );
};

export const DashboardWidget = React.forwardRef(DashboardWidgetInner);
