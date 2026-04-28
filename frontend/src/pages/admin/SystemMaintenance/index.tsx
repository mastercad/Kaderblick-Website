import React, { useState } from 'react';
import { Badge, Box, Divider, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import SaveIcon from '@mui/icons-material/Save';
import SecurityIcon from '@mui/icons-material/Security';
import SportsIcon from '@mui/icons-material/Sports';
import { useSearchParams } from 'react-router-dom';
import CronJobsTab from './CronJobsTab';
import DatabaseTab from './DatabaseTab';
import GameStatsTab from './GameStatsTab';
import AlertsTab from './AlertsTab';

const TAB_KEYS = ['stats', 'cron', 'database', 'alerts'] as const;
type TabKey = typeof TAB_KEYS[number];

const TABS: { label: string; icon: React.ReactElement; key: TabKey }[] = [
  { label: 'Spielstatistiken', icon: <SportsIcon  fontSize="small" />, key: 'stats'    },
  { label: 'Cron-Jobs',        icon: <BuildIcon   fontSize="small" />, key: 'cron'     },
  { label: 'Datenbank',        icon: <SaveIcon    fontSize="small" />, key: 'database' },
  { label: 'System-Alerts',    icon: <SecurityIcon fontSize="small" />, key: 'alerts'  },
];

export default function SystemMaintenance() {
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') ?? '';
  const initialTab = TAB_KEYS.includes(tabFromUrl as TabKey)
    ? TAB_KEYS.indexOf(tabFromUrl as TabKey)
    : 0;

  const [tab, setTab]               = useState(initialTab);
  const [openAlertCount, setOpenAlertCount] = useState(0);

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 3, px: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
        <BuildIcon color="primary" sx={{ fontSize: 28 }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>System-Wartung</Typography>
          <Typography variant="body2" color="text.secondary">
            Inkonsistenzen prüfen, Stats neu berechnen, Cron-Jobs überwachen, Datenbank sichern
          </Typography>
        </Box>
      </Stack>

      <Divider sx={{ mb: 3 }} />

      <Paper variant="outlined" sx={{ mb: 3 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v as number)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ borderBottom: 1, borderColor: 'divider', px: { xs: 1, sm: 2 } }}
        >
          {TABS.map((t, i) => {
            const hasAlertBadge = t.key === 'alerts' && openAlertCount > 0;
            return (
              <Tab
                key={i}
                icon={hasAlertBadge
                  ? <Badge badgeContent={openAlertCount} color="error">{t.icon}</Badge>
                  : t.icon}
                iconPosition="start"
                sx={{ minHeight: 48 }}
                label={<Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{t.label}</Box>}
              />
            );
          })}
        </Tabs>
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {tab === 0 && <GameStatsTab />}
          {tab === 1 && <CronJobsTab />}
          {tab === 2 && <DatabaseTab />}
          {tab === 3 && <AlertsTab onCountChange={setOpenAlertCount} />}
        </Box>
      </Paper>
    </Box>
  );
}
