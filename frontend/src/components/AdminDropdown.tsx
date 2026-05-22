import React, { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import MenuIcon from '@mui/icons-material/Menu';

// This is a stub for the admin navigation dropdown, based on the Symfony _menu.html.twig
// Replace the hrefs with the actual backend URLs as in the original template

const adminMenu = [
  {
    section: 'Stammdaten',
    items: [
      { label: 'Altersgruppen', href: '/admin/age-groups' },
      { label: 'Positionen', href: '/admin/positions' },
      { label: 'Füße', href: '/admin/strong-feet' },
      { label: 'Beläge', href: '/admin/surface-types' },
      { label: 'Ereignistypen', href: '/admin/game-event-types' },
    ],
  },
  {
    section: 'Verwaltung',
    items: [
      { label: 'Vereine', href: 'admin/clubs' },
      { label: 'Trainer', href: 'admin/coaches' },
      { label: 'Spieler', href: 'admin/players' },
      { label: 'Spielstätten', href: 'admin/locations' },
      { label: 'Teams', href: 'admin/teams' },
      { label: 'Feedback', page: 'admin/feedback' },
      { label: 'Neuigkeiten Management', href: 'admin/news' },
      { label: 'Datenkonsistenz', href: 'admin/consistency' },
      { label: 'Aufstellungen', href: 'admin/formations' },
    ],
  },
  {
    section: 'Zuweisungen',
    items: [
      { label: 'Benutzer', href: '/admin/users' },
      { label: 'Spieler zu Team', href: '/admin/player-team-assignments' },
      { label: 'Spieler zu Verein', href: '/admin/player-club-assignments' },
      { label: 'Coach zu Team', href: '/admin/coach-team-assignments' },
      { label: 'Coach zu Verein', href: '/admin/coach-club-assignments' },
      { label: 'Videos', href: '/admin/videos' },
    ],
  },
];

export default function AdminDropdown() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
    setOpenSection(null);
  };

  return (
    <>
      <Button
        color="inherit"
        onClick={handleOpen}
        endIcon={<MenuIcon />}
        sx={{ minWidth: 'auto', px: 2 }}
      >
        Administration
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        slotProps={{
          list: { sx: { minWidth: 250 } }
        }}
      >
        {adminMenu.map((section) => (
          <Box key={section.section}>
            <MenuItem disabled>
              <Typography variant="subtitle2" color="primary">
                {section.section}
              </Typography>
            </MenuItem>
            {section.items.map((item) => (
              <MenuItem
                key={item.label}
                sx={{ pl: 3 }}
                onClick={() => {
                  handleClose();
                  if (item.page) {
                    if (typeof (window as any).setAppPage === 'function') (window as any).setAppPage(item.page);
                  }
                }}
              >
                {item.label}
              </MenuItem>
            ))}
            <Divider />
          </Box>
        ))}
      </Menu>
    </>
  );
}
