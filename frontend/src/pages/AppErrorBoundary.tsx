import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const AppErrorBoundary: React.FC<{ error: Error }> = ({ error }) => (
  <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
    <Typography variant="h2" color="error" gutterBottom>
      Unerwarteter Fehler
    </Typography>
    <Typography variant="body1" sx={{ mb: 2 }}>
      Es ist ein Fehler aufgetreten: {error.message}
    </Typography>
    <Box sx={{ fontSize: 48, mb: 2 }}>💥</Box>
    <Typography variant="body2" sx={{
      color: "text.secondary"
    }}>
      Bitte versuche es später erneut oder kontaktiere den Support.
    </Typography>
  </Container>
);

export default AppErrorBoundary;
