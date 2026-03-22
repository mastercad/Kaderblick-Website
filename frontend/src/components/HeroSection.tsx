import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '@mui/material/styles';
import '../styles/hero-section.css';
import Footer from './Footer';

interface HeroSectionProps {
  onStartClick?: () => void;
  heroRef?: React.RefObject<HTMLDivElement | null>;
  onScrollDown?: () => void;
}

export default function HeroSection({ onStartClick, heroRef, onScrollDown }: HeroSectionProps) {
  const { user } = useAuth();
  const theme = useTheme();
  
  return (
    <Box
      ref={heroRef}
      className="hero-section"
      sx={{
        backgroundImage: 'url(/images/landing_page/background.jpg)',
        minHeight: '100dvh',
        position: 'relative',
      }}
    >
      <Box className="hero-outer">
        <Box className="hero-content">
          <Box component="span" className="hero-title">
            <Box component="span" className="hero-title-highlight">
                K</Box>
            ADERBLICK
          </Box>
          <Box component="span" className="hero-subtitle">
            DEINEN VEREIN IM BLICK
          </Box>
          {!user ? (
            <Box className="hero-btn-wrapper">
              <Button
                variant="contained"
                color="primary"
                sx={{ 
                  p: 3, 
                  fontSize: '2rem',
                  border: '3px solid #FFF',
                  boxShadow: 3,
                  outline: `6px solid ${theme.palette.primary.main}`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: 6,
                    border: '3px solid #FFF',
                  },
                  '@media (max-width: 600px)': {
                    p: 2,
                    fontSize: '1.25rem',
                  }
                }}
                onClick={onStartClick}
              >
                Jetzt starten
              </Button>
            </Box>
          ) : (
            <Box className="hero-btn-wrapper" sx={{ visibility: 'hidden' }}>
              <Box sx={{ p: 3, fontSize: '2rem' }}>Platzhalter</Box>
            </Box>
          )}
        </Box>
      </Box>
      
      {/* Scroll Indikator */}
      <Box 
        className="hero-scroll-indicator"
        onClick={onScrollDown}
        sx={{ cursor: onScrollDown ? 'pointer' : 'default', bottom: { xs: user ? 'calc(3rem + 56px + env(safe-area-inset-bottom, 0px))' : '3rem', md: '3rem' } }}
      >
        <Typography variant="body2" className="hero-scroll-text">
          Mehr erfahren
        </Typography>
        <KeyboardArrowDownIcon className="hero-scroll-arrow" />
      </Box>
      <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, pb: { xs: user ? 'calc(56px + env(safe-area-inset-bottom, 0px))' : 0, md: 0 } }}>
        <Footer />
      </Box>
    </Box>
  );
}
