import React from 'react';
import { Box, Button, Container, Typography } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';

interface HeroSectionProps {
  onLoginClick?: () => void;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  heroRef?: React.RefObject<HTMLDivElement | null>;
  highlights?: Array<{ title: string; text: string }>;
}

export default function HeroSection({
  onLoginClick,
  onPrimaryAction,
  onSecondaryAction,
  heroRef,
  highlights = [],
}: HeroSectionProps) {
  return (
    <Box
      ref={heroRef}
      component="section"
      id="hero"
      sx={{
        position: 'relative',
        minHeight: '100dvh',
        backgroundImage:
          'linear-gradient(90deg, rgba(9, 12, 10, 0.86) 0%, rgba(9, 12, 10, 0.72) 34%, rgba(9, 12, 10, 0.18) 64%, rgba(9, 12, 10, 0.1) 100%), url(/images/landing_page/background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: { xs: '62% center', md: 'center center' },
        backgroundRepeat: 'no-repeat',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 82% 18%, rgba(232, 184, 80, 0.26), transparent 18%), linear-gradient(180deg, rgba(21, 29, 24, 0.16) 0%, rgba(21, 29, 24, 0.38) 100%)',
          pointerEvents: 'none',
        }}
      />

      <Container
        maxWidth="xl"
        sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          minHeight: '100dvh',
          alignItems: 'center',
          px: { xs: 2.25, sm: 3, md: 4 },
          pt: { xs: '6.5rem', md: '7.25rem' },
          pb: { xs: 5, md: 6 },
        }}
      >
        <Box sx={{ maxWidth: { xs: '100%', md: '39.5rem' } }}>
          <Typography
            component="h1"
            sx={{
              m: 0,
              fontFamily: 'Space Grotesk, Inter, sans-serif',
              fontSize: { xs: 'clamp(2.7rem, 10vw, 3.9rem)', md: 'clamp(4rem, 6.2vw, 5.6rem)' },
              fontWeight: 700,
              lineHeight: 0.98,
              letterSpacing: '-0.055em',
              color: '#ffffff',
            }}
          >
            Die Software für
            <Box component="span" sx={{ display: 'block', color: '#35b24c' }}>
              Fußballvereine
            </Box>
          </Typography>

          <Typography
            component="p"
            sx={{
              mt: 2.1,
              mb: 0,
              maxWidth: '34rem',
              fontFamily: 'Manrope, Segoe UI, sans-serif',
              fontSize: { xs: '1rem', md: '1.14rem' },
              lineHeight: 1.7,
              color: 'rgba(255,255,255,0.88)',
            }}
          >
            Kaderblick hilft Vereinen, Trainern, Eltern und Jugendleitungen,
            das Vereinsleben effizient zu organisieren - alles an einem Ort.
          </Typography>

          <Box
            sx={{
              mt: 3.2,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1.25,
            }}
          >
            <Button
              variant="contained"
              onClick={onPrimaryAction}
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                minWidth: { xs: '100%', sm: 'auto' },
                borderRadius: '0.8rem',
                px: 2.2,
                py: 1.15,
                fontFamily: 'Space Grotesk, Inter, sans-serif',
                fontWeight: 700,
                textTransform: 'none',
                background: 'linear-gradient(180deg, #35b24c 0%, #1f9739 100%)',
                boxShadow: 'none',
              }}
            >
              Demo anfragen
            </Button>

            <Button
              variant="outlined"
              onClick={onSecondaryAction}
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                minWidth: { xs: '100%', sm: 'auto' },
                borderRadius: '0.8rem',
                px: 2.2,
                py: 1.15,
                fontFamily: 'Space Grotesk, Inter, sans-serif',
                fontWeight: 700,
                textTransform: 'none',
                borderColor: 'rgba(255,255,255,0.7)',
                color: '#ffffff',
              }}
            >
              Mehr erfahren
            </Button>
          </Box>

          <Box
            sx={{
              mt: 4,
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(3, minmax(0, 1fr))' },
              gap: { xs: 1.25, sm: 1.6 },
              maxWidth: '46rem',
            }}
          >
            {highlights.map((highlight) => (
              <Box
                key={highlight.title}
                sx={{
                  display: 'flex',
                  gap: 0.85,
                  alignItems: 'flex-start',
                  pr: { sm: 1 },
                }}
              >
                <Box
                  sx={{
                    mt: 0.1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '1.9rem',
                    height: '1.9rem',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(53, 178, 76, 0.12)',
                    border: '1px solid rgba(53, 178, 76, 0.32)',
                  }}
                >
                  <CheckCircleOutlineRoundedIcon sx={{ fontSize: '1.15rem', color: '#4ed167' }} />
                </Box>

                <Box>
                  <Typography
                    sx={{
                      fontFamily: 'Space Grotesk, Inter, sans-serif',
                      fontSize: '0.96rem',
                      fontWeight: 700,
                      color: '#ffffff',
                    }}
                  >
                    {highlight.title}
                  </Typography>
                  <Typography
                    sx={{
                      fontFamily: 'Manrope, Segoe UI, sans-serif',
                      fontSize: '0.88rem',
                      color: 'rgba(255,255,255,0.76)',
                    }}
                  >
                    {highlight.text}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          <Box sx={{ display: 'none' }}>
            <Button onClick={onLoginClick}>Login</Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
