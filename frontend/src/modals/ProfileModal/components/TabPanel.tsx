import React from 'react';
import Box from '@mui/material/Box';

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

export function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2.5, pb: 1 }}>
      {value === index && children}
    </Box>
  );
}
