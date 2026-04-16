import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { useNavigate, useLocation } from 'react-router-dom';
import { findNavGroupForPathname, isNavItemActive } from './navigationConfig';

export function PageTabBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const group = findNavGroupForPathname(pathname);
  if (!group) return null;

  const activeIndex = group.children.findIndex(c => isNavItemActive(pathname, c.key));

  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        position: 'sticky',
        top: { xs: 56, md: 64 },
        zIndex: 10,
      }}
    >
      <Tabs
        value={activeIndex === -1 ? 0 : activeIndex}
        onChange={(_, v) => navigate(group.children[v].route)}
        sx={{
          minHeight: 44,
          '& .MuiTab-root': { fontSize: '0.85rem', minHeight: 44, py: 0 },
          '& .MuiTabs-indicator': { backgroundColor: group.color },
          '& .Mui-selected': { color: `${group.color} !important` },
        }}
      >
        {group.children.map(child => (
          <Tab key={child.key} label={child.label} />
        ))}
      </Tabs>
    </Box>
  );
}
