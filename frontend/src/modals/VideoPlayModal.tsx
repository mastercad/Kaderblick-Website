import React, { useRef, useImperativeHandle, forwardRef, useState, useEffect, useCallback } from 'react';
import { GameEvent } from '../types/games';
import YouTube, { YouTubePlayer, YouTubeEvent } from 'react-youtube';
import BaseModal from './BaseModal';
import { Box, Button, IconButton, Tooltip, List, ListItem, ListItemText, Typography } from '@mui/material';
import { ContentCut as ContentCutIcon, Delete as DeleteIcon } from '@mui/icons-material';
import VideoTimeline from '../components/VideoTimeline';
import MobileVideoControls from '../components/MobileVideoControls';
import { mapGameEventsToTimelineEvents, calculateCumulativeOffset } from '../utils/videoTimeline';
import { updateGameEvent } from '../services/games';
import { fetchVideoSegments, saveVideoSegment, updateVideoSegment, deleteVideoSegment, VideoSegment } from '../services/videoSegments';

interface VideoPlayModalProps {
  open: boolean;
  onClose: () => void;
  videoId?: string;
  videoName?: string;
  videoObj: {
    id: number;
    youtubeId?: string;
    gameStart: number | null;
    length: number;
    camera?: { id: number; name: string } | null;
  };
  gameEvents: GameEvent[];
  gameStartDate: string;
  gameId?: number;
  onEventUpdated?: () => void | Promise<void>;
  allVideos?: Array<any>; // Videos array with id, gameStart, length, sort
  youtubeLinks?: any; // { [eventId]: { [cameraId]: [urls] } } - flexible type from backend
  /** Callback: Ereignis an einer bestimmten Video-Position anlegen (für Mobile-Steuerung) */
  onCreateEventAtPosition?: (videoPositionSeconds: number) => void;
  /** Ob der Benutzer Events anlegen darf (steuert Mobile-Button-Sichtbarkeit) */
  canCreateEvents?: boolean;
  /** Öffnet den Supporter-Bewerbungsdialog */
  onRequestSupporterAccess?: () => void;
  children?: React.ReactNode;
}

/**
 * Konvertiert Sekunden in das MM:SS Format für den Backend-API
 */
function secondsToMinuteFormat(seconds: number): string {
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const VideoPlayModal = forwardRef<any, VideoPlayModalProps>(({ open, onClose, videoId, videoName, videoObj, gameEvents, gameStartDate, gameId, onEventUpdated, allVideos, youtubeLinks, onCreateEventAtPosition, canCreateEvents, onRequestSupporterAccess, children }, ref) => {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const playerReadyRef = useRef<boolean>(false);
  const lastSeekTimeRef = useRef<number>(0);
  const safeVideoObj = videoObj || { id: 0, gameStart: null, length: 0, camera: undefined };
  const [videoDuration, setVideoDuration] = useState<number>(safeVideoObj.length || 0);
  const [movedEvents, setMovedEvents] = useState<ReturnType<typeof mapGameEventsToTimelineEvents> | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Pending cut marker start für Mobile-Steuerung (zwei-Schritt-Flow)
  const [pendingCutStart, setPendingCutStart] = useState<number | null>(null);
  
  // Schnittmarken State
  const [cutModeActive, setCutModeActive] = useState(false);
  const [cutMarkers, setCutMarkers] = useState<Array<{
    id: string;
    startSeconds: number;
    endSeconds: number;
    title?: string;
  }>>([]);
  
  // Lade Schnittmarken beim Öffnen oder Videowechsel
  useEffect(() => {
    // Reset markers when closing or video changes
    if (!open) {
      setCutMarkers([]);
      setMovedEvents(null); // Reset moved events when modal closes
      playerReadyRef.current = false; // Reset player ready state
      lastSeekTimeRef.current = 0; // Reset seek throttle
      setPendingCutStart(null); // Reset pending cut marker
      return;
    }
    
    if (safeVideoObj.id && gameId) {
      fetchVideoSegments(gameId)
        .then(segments => {
          // Filter segments for this video only
          const videoSegments = segments.filter(s => s.videoId === safeVideoObj.id);
          
          setCutMarkers(videoSegments.map(s => {
            // s.startMinute enthält Video-Zeit in Sekunden
            const startSeconds = s.startMinute;
            const endSeconds = startSeconds + s.lengthSeconds;
            
            return {
              id: s.id.toString(),
              startSeconds,
              endSeconds,
              title: s.title || undefined,
            };
          }));
        })
        .catch(err => console.error('Fehler beim Laden der Schnittmarken:', err));
    }
  }, [open, safeVideoObj.id, gameId]);
  
  // Berechne den kumulativen Offset für Videos mit gameStart=null
  const cumulativeOffset = allVideos ? calculateCumulativeOffset(
    { ...safeVideoObj, length: videoDuration, camera: safeVideoObj.camera ? { id: safeVideoObj.camera.id } : undefined } as any,
    allVideos
  ) : (typeof safeVideoObj.gameStart === 'number' ? -safeVideoObj.gameStart : 0);
  
  // Timeline-Events berechnen (nutze aktuelle Videolänge, falls YouTube-API sie liefert)
  const timelineEvents = movedEvents || mapGameEventsToTimelineEvents({
    gameEvents: gameEvents,
    video: { ...safeVideoObj, length: videoDuration, camera: safeVideoObj.camera ? { id: safeVideoObj.camera.id } : undefined } as any,
    gameStartDate,
    cumulativeOffset,
    youtubeLinks,
    cameraId: safeVideoObj.camera?.id,
  });

  // Wenn sich die gameEvents-Prop ändert (z.B. nach Event-Anlage), neue Events ergänzen
  React.useEffect(() => {
    setMovedEvents(prev => {
      const mapped = mapGameEventsToTimelineEvents({
        gameEvents: gameEvents,
        video: { ...safeVideoObj, length: videoDuration, camera: safeVideoObj.camera ? { id: safeVideoObj.camera.id } : undefined } as any,
        gameStartDate,
        cumulativeOffset,
        youtubeLinks,
        cameraId: safeVideoObj.camera?.id,
      });
      if (!prev) return mapped;
      // Sync: Für jedes Event aus mapped:
      // - Wenn es in prev existiert, behalte die lokale Zeit (z.B. nach Drag & Drop)
      // - Sonst nimm das neue Event
      // - Entferne Events, die nicht mehr im Backend sind
      const prevMap = new Map(prev.map(ev => [ev.id, ev]));
      const result = mapped.map(ev => {
        const local = prevMap.get(ev.id);
        // Nur timestamp (Drag & Drop) lokal behalten, aber NUR wenn es eine Zahl ist (Timeline-Format)
        if (local && typeof local.timestamp === 'number') {
          return { ...ev, timestamp: local.timestamp };
        }
        return ev;
      });
      return result;
    });
  }, [gameEvents, gameStartDate, videoDuration, cumulativeOffset, youtubeLinks, safeVideoObj.camera?.id]);

  // Handler für Drag & Drop
  const handleEventMove = (eventId: number, newSeconds: number) => {
    if (!canCreateEvents) {
      onRequestSupporterAccess?.();
      return;
    }

    // Lokalen State aktualisieren
    setMovedEvents(prev => {
      const base = prev || mapGameEventsToTimelineEvents({
        gameEvents: gameEvents,
        video: { ...safeVideoObj, length: videoDuration, camera: safeVideoObj.camera ? { id: safeVideoObj.camera.id } : undefined } as any,
        gameStartDate,
        cumulativeOffset,
        youtubeLinks,
        cameraId: safeVideoObj.camera?.id,
      });
      return base.map(ev =>
        ev.id === eventId ? { ...ev, timestamp: Math.max(0, Math.min(videoDuration, newSeconds)) } : ev
      );
    });

    if (gameId) {
      // newSeconds ist relative Zeit im Video (videoPosition - gameStart)
      // Spielzeit = relative Zeit im Video + kumulativer Offset
      const gameTimeSeconds = newSeconds + cumulativeOffset;
      const minuteFormat = secondsToMinuteFormat(gameTimeSeconds);
      updateGameEvent(gameId, eventId, { minute: minuteFormat })
        .then(async () => {
          setUpdateError(null);
          if (onEventUpdated) {
            await onEventUpdated();
          }
        })
        .catch(err => {
          setUpdateError('Fehler beim Speichern des Events');
        });
    }
  };

  const handleSeekToGameStart = () => {
    if (playerRef.current && playerReadyRef.current && typeof safeVideoObj.gameStart === 'number') {
      safeSeekTo(safeVideoObj.gameStart);
    }
  };

  const handleSeek = (seconds: number) => {
    if (playerRef.current && playerReadyRef.current) {
      safeSeekTo(seconds);
    }
  };

  // Sichere seekTo Funktion mit Error Handling, State-Check und Throttling
  const safeSeekTo = (seconds: number) => {
    const player = playerRef.current;
    if (!player || !playerReadyRef.current) {
      console.warn('Player not ready for seek');
      return;
    }

    // Throttle: Erlaube seekTo nur alle 150ms (außer wenn es ein expliziter Klick ist)
    const now = Date.now();
    const timeSinceLastSeek = now - lastSeekTimeRef.current;
    if (timeSinceLastSeek < 150) {
      // Zu schnell - ignoriere diesen Aufruf
      return;
    }
    lastSeekTimeRef.current = now;

    try {
      // Check player state - nur seekTo wenn Player in einem stabilen State ist
      const playerState = player.getPlayerState?.();
      
      // YouTube Player States:
      // -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (video cued)
      // Wir erlauben seekTo in allen States außer wenn Player nicht initialisiert ist
      if (playerState === undefined) {
        console.warn('Player state undefined, delaying seek');
        // Versuche es nach kurzer Verzögerung nochmal
        setTimeout(() => {
          if (playerRef.current && playerReadyRef.current) {
            lastSeekTimeRef.current = Date.now();
            playerRef.current.seekTo(seconds, true);
          }
        }, 300);
        return;
      }

      // Führe seekTo aus
      player.seekTo(seconds, true);
      
      // Wenn Video pausiert war, starte es nach dem Seek
      if (playerState === 2) { // paused
        setTimeout(() => {
          player.playVideo?.();
        }, 100);
      }
    } catch (error) {
      console.error('Error during seekTo:', error);
      playerReadyRef.current = false; // Mark as not ready after error
    }
  };

  const handleCutMarkerAdd = (startSeconds: number, endSeconds: number) => {
    if (!gameId || !safeVideoObj.id) return;
    
    // startSeconds und endSeconds sind absolute Video-Positionen
    const startSecondsRounded = Math.round(startSeconds);
    const lengthSeconds = Math.round(endSeconds - startSeconds);
    
    saveVideoSegment({
      videoId: safeVideoObj.id,
      startMinute: startSecondsRounded,
      lengthSeconds,
      includeAudio: true,
      sortOrder: cutMarkers.length,
    })
      .then((segment) => {
        // Add to local state
        setCutMarkers(prev => [...prev, {
          id: segment.id.toString(),
          startSeconds,
          endSeconds,
          title: segment.title || undefined,
        }]);
      })
      .catch(err => console.error('Fehler beim Speichern der Schnittmarke:', err));
  };

  const handleCutMarkerMove = (id: string, startSeconds: number, endSeconds: number) => {
    if (!gameId) return;
    
    const numId = parseInt(id);
    if (isNaN(numId)) return;
    
    const startSecondsRounded = Math.round(startSeconds);
    const lengthSeconds = Math.round(endSeconds - startSeconds);
    
    updateVideoSegment(numId, {
      startMinute: startSecondsRounded,
      lengthSeconds,
    })
      .then(() => {
        // Update local state
        setCutMarkers(prev => prev.map(m => 
          m.id === id ? { ...m, startSeconds, endSeconds } : m
        ));
      })
      .catch(err => console.error('Fehler beim Verschieben der Schnittmarke:', err));
  };

  const handleDeleteCutMarker = (id: string) => {
    const numId = parseInt(id);
    if (isNaN(numId)) return;
    
    deleteVideoSegment(numId)
      .then(() => {
        setCutMarkers(prev => prev.filter(m => m.id !== id));
      })
      .catch(err => console.error('Fehler beim Löschen der Schnittmarke:', err));
  };

  // Mobile: Ereignis an aktueller Position anlegen
  const handleMobileCreateEvent = useCallback((videoPositionSeconds: number) => {
    if (!canCreateEvents) {
      onRequestSupporterAccess?.();
      return;
    }

    // Video pausieren
    try {
      playerRef.current?.pauseVideo?.();
    } catch { /* ignore */ }
    onCreateEventAtPosition?.(videoPositionSeconds);
  }, [canCreateEvents, onCreateEventAtPosition, onRequestSupporterAccess]);

  // Mobile: Schnittmarke setzen (zwei-Schritt-Flow: Start → Ende)
  const handleMobileSetCutMarker = useCallback((videoPositionSeconds: number) => {
    if (pendingCutStart === null) {
      // Erster Tap: Start-Position merken
      setPendingCutStart(videoPositionSeconds);
    } else {
      // Zweiter Tap: Ende-Position → Schnittmarke erstellen
      const start = Math.min(pendingCutStart, videoPositionSeconds);
      const end = Math.max(pendingCutStart, videoPositionSeconds);
      if (end - start >= 1) {
        handleCutMarkerAdd(start, end);
      }
      setPendingCutStart(null);
    }
  }, [pendingCutStart, handleCutMarkerAdd]);


  useImperativeHandle(ref, () => ({
    getCurrentTime: () => playerRef.current?.getCurrentTime() ?? 0,
    pauseVideo: () => playerRef.current?.pauseVideo(),
  }));

  return (
    <BaseModal
      open={open}
      onClose={onClose}
      title={videoName || 'Video ansehen'}
      maxWidth="md"
      fullWidth
      showCloseButton
    >
      <Box sx={{ position: 'relative', width: '100%', mb: 2 }}>
        {videoId ? (
          <Box sx={{ position: 'relative', paddingTop: '56.25%' }}>
            <YouTube
              videoId={videoId}
              opts={{
                width: '100%',
                height: '100%',
                playerVars: {
                  autoplay: 1,
                  modestbranding: 1,
                  rel: 0,
                },
              }}
              onReady={(e: YouTubeEvent) => {
                playerRef.current = e.target;
                const checkReady = () => {
                  try {
                    const duration = e.target.getDuration?.();
                    if (duration && duration > 0) {
                      setVideoDuration(duration);
                      playerReadyRef.current = true;
                    } else {
                      setTimeout(checkReady, 100);
                    }
                  } catch (err) {
                    console.warn('Error checking player ready:', err);
                    setTimeout(checkReady, 100);
                  }
                };
                checkReady();
              }}
              onStateChange={(e: YouTubeEvent) => {
                if (!videoDuration && e.target.getDuration) {
                  const dur = e.target.getDuration();
                  if (dur > 0) {
                    setVideoDuration(dur);
                    playerReadyRef.current = true;
                  }
                }
              }}
              onError={(e: { target: YouTubePlayer; data: number }) => {
                console.error('YouTube Player Error:', e.data);
                // YouTube Error Codes:
                // 2 – Invalid parameter
                // 5 – HTML5 player error
                // 100 – Video not found
                // 101/150 – Video not available (embedding disabled)
                playerReadyRef.current = false;
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 0,
                borderRadius: 8,
              }}
            />
          </Box>
        ) : (
          <Box>Kein Video gefunden.</Box>
        )}
      </Box>
      
      {/* Mobile-Steuerung: Jog-Buttons, Positionsanzeige, Aktionsbuttons */}
      {videoDuration > 0 && (
        <MobileVideoControls
          playerRef={playerRef}
          playerReady={playerReadyRef.current}
          duration={videoDuration}
          onSeek={handleSeek}
          onCreateEvent={handleMobileCreateEvent}
          onSetCutMarker={handleMobileSetCutMarker}
          cutModeActive={cutModeActive}
          pendingCutStart={pendingCutStart}
          canCreateEvents={canCreateEvents}
          gameStart={safeVideoObj.gameStart || 0}
          cumulativeOffset={cumulativeOffset}
        />
      )}

      {!canCreateEvents && (
        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'warning.main',
            bgcolor: 'warning.50',
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
            Zeitstempel bearbeiten und Ereignisse anlegen ist Supportern vorbehalten
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Bewirb dich als Supporter, um Spielereignisse direkt im Video anzulegen und bestehende Zeitstempel per Timeline zu korrigieren.
          </Typography>
          <Button variant="contained" onClick={onRequestSupporterAccess}>
            Als Supporter bewerben
          </Button>
        </Box>
      )}

      {/* Schnittmarken Toggle Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Tooltip title={cutModeActive ? "Schnittmarken-Modus deaktivieren" : "Schnittmarken-Modus aktivieren"}>
          <IconButton
            onClick={() => setCutModeActive(!cutModeActive)}
            color={cutModeActive ? "primary" : "default"}
            sx={{
              border: cutModeActive ? '2px solid' : '1px solid #ccc',
              bgcolor: cutModeActive ? 'rgba(25, 118, 210, 0.1)' : 'transparent',
            }}
          >
            <ContentCutIcon />
          </IconButton>
        </Tooltip>
      </Box>
      
      {/* Timeline unter dem Video */}
      {videoDuration > 0 && (
        <VideoTimeline
          duration={videoDuration}
          events={timelineEvents}
          onSeek={handleSeek}
          onSeekToGameStart={handleSeekToGameStart}
          onEventMove={canCreateEvents ? handleEventMove : undefined}
          gameStart={safeVideoObj.gameStart || 0}
          cumulativeOffset={cumulativeOffset}
          cutMarkers={cutMarkers}
          onCutMarkerAdd={handleCutMarkerAdd}
          onCutMarkerMove={handleCutMarkerMove}
          cutModeActive={cutModeActive}
          onToggleCutMode={() => setCutModeActive(!cutModeActive)}
          showCutMarkers={cutModeActive}
        />
      )}
      
      {/* Schnittmarken Liste - nur im Cut-Modus */}
      {cutModeActive && cutMarkers.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>
            Schnittmarken ({cutMarkers.length}) - Gesamt: {secondsToMinuteFormat(
              Math.round(cutMarkers.reduce((sum, m) => sum + (m.endSeconds - m.startSeconds), 0))
            )}
          </Typography>
          <List dense>
            {cutMarkers.map((marker, index) => {
              // Zeige direkte Video-Positionen
              const startSeconds = marker.startSeconds;
              const endSeconds = marker.endSeconds;
              const length = endSeconds - startSeconds;
              
              return (
                <ListItem
                  key={marker.id}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={() => handleDeleteCutMarker(marker.id)}
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={marker.title || `Schnittmarke ${index + 1}`}
                    secondary={`${secondsToMinuteFormat(Math.round(startSeconds))} - ${secondsToMinuteFormat(Math.round(endSeconds))} (Länge: ${secondsToMinuteFormat(Math.round(length))})`}
                  />
                </ListItem>
              );
            })}
          </List>
        </Box>
      )}
      
      {children}
    </BaseModal>
  );
});

export default VideoPlayModal;
