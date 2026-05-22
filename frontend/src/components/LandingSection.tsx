import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Box, Typography, IconButton, Modal, Button, useMediaQuery, useTheme } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { Link as RouterLink } from 'react-router-dom';
import '../styles/landing-section.css';

interface LandingSectionProps {
  name: string;
  image: string;
  additionalImages?: string[];
  text: string;
  reverse?: boolean;
  onAuthClick?: () => void;
  ctaText?: string;
  learnMoreHref?: string;
}

export default function LandingSection({ name, image, additionalImages = [], text, reverse = false, onAuthClick, ctaText = 'Jetzt starten', learnMoreHref }: LandingSectionProps) {
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [thumbStart, setThumbStart] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const thumbsPerPage = 3;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  const handleThumbPrev = () => setThumbStart((s) => Math.max(0, s - thumbsPerPage));
  const handleThumbNext = () => setThumbStart((s) => Math.min(additionalImages.length - thumbsPerPage, s + thumbsPerPage));

  const imageSection = (
    <Box className="landing-section-image-wrapper">
      <Box className="landing-section-main-image">
        <img
          src={image}
          alt={name}
          onClick={() => setModalImage(image)}
        />
      </Box>

      {additionalImages.length > 0 && (
        <Box className="landing-section-thumbnails">
          <IconButton
            onClick={handleThumbPrev}
            disabled={thumbStart === 0}
            size="small"
            sx={{
              bgcolor: 'transparent',
              color: '#fff',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              },
              '&:disabled': {
                color: 'rgba(255, 255, 255, 0.3)',
              },
            }}
          >
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>
          {additionalImages.slice(thumbStart, thumbStart + thumbsPerPage).map((img: string, idx: number) => (
            <Box key={idx} className="landing-section-thumbnail">
              <img
                src={img}
                alt={`${name} Zusatzbild ${idx + 1}`}
                onClick={() => setModalImage(img)}
              />
            </Box>
          ))}
          <IconButton
            onClick={handleThumbNext}
            disabled={thumbStart + thumbsPerPage >= additionalImages.length}
            size="small"
            sx={{
              bgcolor: 'transparent',
              color: '#fff',
              transition: 'all 0.2s',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              },
              '&:disabled': {
                color: 'rgba(255, 255, 255, 0.3)',
              },
            }}
          >
            <ArrowForwardIosIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
    </Box>
  );

  const textSection = (
    <Box className="landing-section-text-wrapper">
      <Box component="h2" className="landing-section-title">
        <Box component="span" className="landing-section-title-highlight">
          {name.charAt(0).toUpperCase()}
        </Box>
        {name.slice(1).toUpperCase()}
      </Box>
      <Typography
        variant="body1"
        className="landing-section-text"
      >
        {text}
      </Typography>
      {learnMoreHref && (
        <Button
          component={RouterLink}
          to={learnMoreHref}
          variant="text"
          color="inherit"
          sx={{ alignSelf: reverse ? 'flex-end' : 'flex-start', px: 0, fontWeight: 700 }}
        >
          Mehr zum Thema
        </Button>
      )}
      
      {/* CTA Button in Desktop im Text-Bereich */}
      {onAuthClick && (
        <Button
          variant="contained"
          color="primary"
          className="landing-section-cta-button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAuthClick();
          }}
          sx={{
            width: 'auto',
            alignSelf: reverse ? 'flex-end' : 'flex-start',
            mt: 3,
            py: 1.5,
            px: 2,
            fontSize: '1.1rem',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: 2,
            boxShadow: 3,
            border: '3px solid white',
            outline: `6px solid ${theme.palette.primary.main}`,
            transition: 'all 0.3s',
            '&:hover': {
              boxShadow: 6,
              border: '1px solid white'
            },
          }}
        >
          {ctaText}
        </Button>
      )}
    </Box>
  );

  // Separater CTA Button nur für Mobile (wird nach Bildern angezeigt)
  const ctaButtonMobile = onAuthClick ? (
    <Box className="landing-section-cta-wrapper-mobile">
      <Button
        variant="contained"
        color="primary"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onAuthClick();
        }}
        sx={{
          py: 1.5,
          px: 4,
          fontSize: '1.1rem',
          fontWeight: 600,
          textTransform: 'none',
          borderRadius: 2,
          boxShadow: 3,
          border: '3px solid white',
          outline: `6px solid ${theme.palette.primary.main}`,
          transition: 'all 0.3s',
          '&:hover': {
            transform: 'translateY(0px)',
            boxShadow: 6,
          },
        }}
      >
        {ctaText}
      </Button>
    </Box>
  ) : null;

  return (
    <>
      <Box component="section" ref={sectionRef} className={`landing-section ${isVisible ? 'visible' : ''}`}>
        <Box className="landing-section-content">
          {reverse ? (
            <>
              {textSection}
              {imageSection}
              {ctaButtonMobile}
            </>
          ) : (
            <>
              {imageSection}
              {textSection}
              {ctaButtonMobile}
            </>
          )}
        </Box>
        
        {/* Branding Section at bottom left */}
        <Box className="landing-section-branding">
          <Box className="landing-section-branding-content">
            <Box component="span" className="landing-section-branding-title">
              <Box component="span" className="landing-section-branding-title-highlight">
                K
              </Box>
              ADERBLICK
            </Box>
            <Box component="span" className="landing-section-branding-subtitle">
              DEINEN VEREIN IM BLICK
            </Box>
          </Box>
        </Box>
      </Box>
      {/* Modal for full-screen image view with gallery navigation if additionalImages exist */}
      <Modal open={!!modalImage} onClose={() => setModalImage(null)}>
        <Box
          onClick={() => setModalImage(null)}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            position: "relative",
            cursor: 'pointer',
            background: 'rgba(0,0,0,0.15)'
          }}>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              setModalImage(null);
            }}
            sx={{
              position: 'absolute',
              top: 24,
              right: 24,
              zIndex: 2,
              bgcolor: 'rgba(255,255,255,0.7)',
              boxShadow: 2,
              transition: 'background 0.2s',
              '&:hover': {
                bgcolor: '#222',
                '& svg': { color: '#fff' },
              },
            }}
            size="large"
            aria-label="Schließen"
          >
            <CloseIcon fontSize="large" sx={{ color: '#222', transition: 'color 0.2s' }} />
          </IconButton>
          {/* Gallery navigation only if additionalImages exist */}
          {additionalImages.length > 0 ? (() => {
            // Build unique image list: main image + additionalImages (no duplicates)
            const galleryImages = [image, ...additionalImages.filter(img => img !== image)];
            const currentIdx = galleryImages.indexOf(modalImage || '');
            return (
              <Box
                onClick={(e) => e.stopPropagation()}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "100%"
                }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%"
                  }}>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentIdx > 0) setModalImage(galleryImages[currentIdx - 1]);
                    }}
                    disabled={currentIdx === 0}
                    sx={{ mx: 2, bgcolor: 'rgba(255,255,255,0.7)', '&:disabled': { opacity: 0.3 } }}
                    size="large"
                    aria-label="Vorheriges Bild"
                  >
                    <ArrowBackIosNewIcon fontSize="large" />
                  </IconButton>
                  <img
                    src={modalImage || ''}
                    alt="Großansicht"
                    style={{
                      maxHeight: '80vh',
                      maxWidth: '80vw',
                      borderRadius: 12,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                      cursor: 'auto',
                    }}
                  />
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      if (currentIdx < galleryImages.length - 1) setModalImage(galleryImages[currentIdx + 1]);
                    }}
                    disabled={currentIdx === galleryImages.length - 1}
                    sx={{ mx: 2, bgcolor: 'rgba(255,255,255,0.7)', '&:disabled': { opacity: 0.3 } }}
                    size="large"
                    aria-label="Nächstes Bild"
                  >
                    <ArrowForwardIosIcon fontSize="large" />
                  </IconButton>
                </Box>
                {/* Thumbnails below main image */}
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    mt: 2
                  }}>
                  {galleryImages.map((img, idx) => (
                    <Box
                      key={`${img}-${idx}`}
                      sx={{
                        border: img === modalImage ? '2px solid ' + theme.palette.primary.main : '2px solid transparent',
                        borderRadius: 2,
                        mx: 0.5,
                        boxShadow: img === modalImage ? 4 : 1,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'border 0.2s, box-shadow 0.2s',
                      }}
                      onClick={() => setModalImage(img)}
                    >
                      <img
                        src={img}
                        alt={`Thumbnail ${idx + 1}`}
                        style={{ width: 60, height: 60, objectFit: 'cover', display: 'block' }}
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            );
          })() : (
            <img
              src={modalImage || ''}
              alt="Großansicht"
              style={{
                maxHeight: '90vh',
                maxWidth: '90vw',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                cursor: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </Box>
      </Modal>
    </>
  );
}

