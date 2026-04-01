import React, { useRef, useState, useEffect } from 'react';
import { Box, Tooltip, IconButton } from '@mui/material';
import { SkipPrevious as SkipPreviousIcon, ContentCut as ContentCutIcon } from '@mui/icons-material';
import { keyframes } from '@mui/system';
import { getGameEventIconByCode } from '../constants/gameEventIcons';

interface TimelineEvent {
  id: number;
  offsetSeconds?: number;
  timestamp: number;
  label: string;
  icon: string;
  color: string;
  description?: string;
}

interface CutMarker {
  id: string;
  startSeconds: number;
  endSeconds: number;
  title?: string;
}

interface VideoTimelineProps {
  duration: number;
  events: TimelineEvent[];
  onSeek: (seconds: number) => void;
  onEventMove?: (eventId: number, newSeconds: number) => void;
  onSeekToGameStart?: () => void;
  gameStart?: number;
  cumulativeOffset?: number;
  cutMarkers?: CutMarker[];
  onCutMarkerAdd?: (startSeconds: number, endSeconds: number) => void;
  onCutMarkerMove?: (id: string, startSeconds: number, endSeconds: number) => void;
  cutModeActive?: boolean;
  onToggleCutMode?: () => void;
  showCutMarkers?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

/**
 * Formatiert Sekunden zu MM:SS Format (mit optionalem Vorzeichen)
 */
function formatSeconds(seconds: number): string {
  const isNegative = seconds < 0;
  const absSecs = Math.abs(seconds);
  const mins = Math.floor(absSecs / 60);
  const secs = Math.round(absSecs % 60);
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : formatted;
}

const VideoTimeline: React.FC<VideoTimelineProps> = ({ 
  duration, 
  events, 
  onSeek, 
  onEventMove, 
  onSeekToGameStart, 
  gameStart = 0,
  cumulativeOffset = 0,
  cutMarkers = [],
  onCutMarkerAdd,
  onCutMarkerMove,
  cutModeActive = false,
  onToggleCutMode,
  showCutMarkers = false,
  onDragStart,
  onDragEnd
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [dragState, setDragState] = useState<null | {
    eventId: number;
    origSeconds: number;
    row: number;
    offsetX: number;
    mouseX: number;
  }>(null);
  
  // State für Schnittmarken-Modus
  const [cutDragState, setCutDragState] = useState<null | {
    type: 'start' | 'end' | 'range';
    markerId: string;
    origSeconds: number;
    origEndSeconds?: number; // für Range-Drag
    offsetX: number;
    currentMouseX: number;
    initialMouseX?: number; // für Range-Drag: Start-Position der Maus
  }>(null);
  const [pendingCut, setPendingCut] = useState<null | { startSeconds: number }>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  // State für Fine-Tuning Modus (Long-Press)
  const [fineTuningState, setFineTuningState] = useState<null | {
    type: 'event' | 'cutMarker';
    eventId?: number;
    markerId?: string;
    markerType?: 'start' | 'end';
    centerSeconds: number;
    currentSeconds: number;
    row?: number;
  }>(null);
  
  // State für Long-Press Progress Indikator
  const [longPressProgress, setLongPressProgress] = useState<null | {
    type: 'event' | 'cutMarker';
    eventId?: number;
    markerId?: string;
    markerType?: 'start' | 'end';
    left: string;
    top: number;
    row?: number;
    startTime: number;
  }>(null);

  // Mobile Detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ESC-Taste zum Abbrechen von pendingCut
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pendingCut) {
        setPendingCut(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [pendingCut]);

  // Klick außerhalb der Timeline bricht pendingCut ab
  useEffect(() => {
    if (!pendingCut) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPendingCut(null);
      }
    };
    
    // Delay hinzufügen, damit der initiale Klick nicht sofort abbricht
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [pendingCut]);

  // Dynamische Timeline-Breite basierend auf Container
  const getTimelineWidth = () => {
    return containerRef.current?.getBoundingClientRect().width || 800;
  };

  // Globales Mousemove/Up-Handling für Event-Dragging
  useEffect(() => {
    if (!dragState) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      setDragState(ds => {
        if (!ds) return null;
        const mouseX = clientX;
        // Video-Position während Dragging setzen
        const box = containerRef.current?.getBoundingClientRect();
        if (box && typeof onSeek === 'function') {
        const x = mouseX - ds.offsetX - box.left;
        let newSeconds = (x / getTimelineWidth()) * duration;
          newSeconds = Math.max(0, Math.min(duration, newSeconds));
          onSeek(newSeconds);
        }
        return { ...ds, mouseX };
      });
    };
    const handleUp = (e: MouseEvent | TouchEvent) => {
      if (!dragState) return;
      const box = containerRef.current?.getBoundingClientRect();
      if (!box) {
        setDragState(null);
        return;
      }
      const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
      // Offset berücksichtigen
      const x = clientX - dragState.offsetX - box.left;
      let videoPosition = (x / getTimelineWidth()) * duration;
      videoPosition = Math.max(0, Math.min(duration, videoPosition));
      // Video-Position zurück in Event-Zeit konvertieren (minus gameStart)
      const eventTime = videoPosition - gameStart;
      onEventMove?.(dragState.eventId, eventTime);
      setDragState(null);
      onDragEnd?.();
    };
    
    const handleMoveWithPrevent = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      handleMove(e);
    };
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMoveWithPrevent as any, { passive: false });
    window.addEventListener('touchend', handleUp as any);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMoveWithPrevent as any);
      window.removeEventListener('touchend', handleUp as any);
    };
  }, [dragState, duration, onEventMove, onSeek, gameStart]);

  // Globales Mousemove/Up-Handling für Cut-Marker-Dragging
  useEffect(() => {
    if (!cutDragState) return;
    
    const getTimelineWidth = () => containerRef.current?.getBoundingClientRect().width || 800;
    
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const box = containerRef.current?.getBoundingClientRect();
      if (!box) return;
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      
      if (cutDragState.type === 'range') {
        // Bei Range-Drag: Delta berechnen und Video entsprechend bewegen
        const currentX = clientX - box.left;
        const currentSeconds = (currentX / getTimelineWidth()) * duration;
        onSeek(Math.max(0, Math.min(duration, currentSeconds)));
      } else {
        // Bei Start/End-Marker: normale Berechnung mit Offset
        const x = clientX - cutDragState.offsetX - box.left;
        let newSeconds = (x / getTimelineWidth()) * duration;
        newSeconds = Math.max(0, Math.min(duration, newSeconds));
        onSeek(newSeconds);
      }
      
      // Update mouse position for overlay
      setCutDragState(prev => prev ? { ...prev, currentMouseX: clientX } : null);
    };
    
    const handleUp = (e: MouseEvent | TouchEvent) => {
      const clientX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX;
      if (!cutDragState) return;
      const box = containerRef.current?.getBoundingClientRect();
      if (!box) {
        setCutDragState(null);
        return;
      }
      
      const marker = cutMarkers.find(m => m.id === cutDragState.markerId);
      if (!marker || !onCutMarkerMove) {
        setCutDragState(null);
        onDragEnd?.();
        return;
      }
      
      if (cutDragState.type === 'start' || cutDragState.type === 'end') {
        const x = clientX - cutDragState.offsetX - box.left;
        let newSeconds = (x / getTimelineWidth()) * duration;
        newSeconds = Math.max(0, Math.min(duration, newSeconds));
        
        if (cutDragState.type === 'start') {
          onCutMarkerMove(marker.id, newSeconds, marker.endSeconds);
        } else {
          onCutMarkerMove(marker.id, marker.startSeconds, newSeconds);
        }
      } else if (cutDragState.type === 'range' && cutDragState.origEndSeconds !== undefined && cutDragState.initialMouseX !== undefined) {
        // Bei Range-Drag: Delta zwischen ursprünglicher und aktueller Mausposition
        const deltaX = clientX - cutDragState.initialMouseX;
        const deltaSeconds = (deltaX / getTimelineWidth()) * duration;
        
        const rangeDuration = cutDragState.origEndSeconds - cutDragState.origSeconds;
        let newStart = cutDragState.origSeconds + deltaSeconds;
        let newEnd = cutDragState.origEndSeconds + deltaSeconds;
        
        // Grenzen prüfen und anpassen
        if (newStart < 0) {
          newStart = 0;
          newEnd = rangeDuration;
        } else if (newEnd > duration) {
          newEnd = duration;
          newStart = duration - rangeDuration;
        }
        
        onCutMarkerMove(marker.id, newStart, newEnd);
      }
      
      setCutDragState(null);
      onDragEnd?.();
    };
    
    const handleMoveWithPrevent = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      handleMove(e);
    };
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMoveWithPrevent as any, { passive: false });
    window.addEventListener('touchend', handleUp as any);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMoveWithPrevent as any);
      window.removeEventListener('touchend', handleUp as any);
    };
  }, [cutDragState, duration, onSeek, cutMarkers, onCutMarkerMove]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
      }
      setLongPressProgress(null);
    };
  }, []);
  
  // Animation für Long-Press Progress
  useEffect(() => {
    if (!longPressProgress) return;
    
    const animationFrame = requestAnimationFrame(() => {
      const elapsed = Date.now() - longPressProgress.startTime;
      if (elapsed >= 500) {
        setLongPressProgress(null);
      }
    });
    
    return () => cancelAnimationFrame(animationFrame);
  }, [longPressProgress]);
  
  // Handler für Fine-Tuning Overlay
  const handleFineTuningMove = (clientX: number, overlayElement: HTMLElement) => {
    if (!fineTuningState) return;
    
    const overlayBox = overlayElement.getBoundingClientRect();
    const timelineElement = overlayElement.querySelector('[data-fine-tuning-timeline]') as HTMLElement;
    if (!timelineElement) return;
    
    const timelineBox = timelineElement.getBoundingClientRect();
    const x = clientX - timelineBox.left;
    
    // Fine-Tuning Bereich: ±10 Sekunden um centerSeconds
    const timeRange = 20; // 20 Sekunden Gesamtbereich
    const relativePosition = Math.max(0, Math.min(1, x / timelineBox.width));
    const newSeconds = fineTuningState.centerSeconds - (timeRange / 2) + (relativePosition * timeRange);
    const clampedSeconds = Math.max(0, Math.min(duration, newSeconds));
    
    setFineTuningState(prev => prev ? { ...prev, currentSeconds: clampedSeconds } : null);
    onSeek(clampedSeconds);
  };
  
  const handleFineTuningEnd = () => {
    if (!fineTuningState) return;
    
    if (fineTuningState.type === 'event' && fineTuningState.eventId !== undefined) {
      const eventTime = fineTuningState.currentSeconds - gameStart;
      onEventMove?.(fineTuningState.eventId, eventTime);
    } else if (fineTuningState.type === 'cutMarker' && fineTuningState.markerId && fineTuningState.markerType) {
      const marker = cutMarkers.find(m => m.id === fineTuningState.markerId);
      if (marker && onCutMarkerMove) {
        if (fineTuningState.markerType === 'start') {
          onCutMarkerMove(marker.id, fineTuningState.currentSeconds, marker.endSeconds);
        } else {
          onCutMarkerMove(marker.id, marker.startSeconds, fineTuningState.currentSeconds);
        }
      }
    }
    
    setFineTuningState(null);
  };
  const markerRows: { event: TimelineEvent; left: string; px: number; row: number }[] = [];
  const rowHeight = 28; // px, Abstand zwischen Reihen
  const markerWidth = 24; // px, angenommene Markerbreite inkl. Padding
  const timelineWidth = getTimelineWidth(); // dynamische Breite
  events.forEach(event => {
    // Event-Zeit + gameStart = Video-Position
    const videoPosition = event.timestamp + gameStart;
    // Berechne Pixelposition relativ zur Timeline
    const px = Math.round((videoPosition / duration) * timelineWidth);
    let row = 0;
    while (markerRows.some(m => Math.abs(m.px - px) < markerWidth && m.row === row)) {
      row++;
    }
    const left = `${(videoPosition / duration) * 100}%`;
    markerRows.push({ event, left, px, row });
  });

  const maxRow = markerRows.reduce((max, m) => Math.max(max, m.row), 0);

  // Handler für Timeline-Klick im Cut-Modus
  const handleTimelineClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (!cutModeActive || !containerRef.current) return;
    
    // Bei Touch: prüfe ob es auf einem Marker war (dann ignorieren)
    if ('touches' in e || 'changedTouches' in e) {
      const target = e.target as HTMLElement;
      if (target.closest('[data-marker-button]') || target.closest('[data-marker-range]')) {
        return; // Ignoriere Klicks auf Marker-Elementen
      }
    }
    
    const box = containerRef.current.getBoundingClientRect();
    let clientX: number | undefined;
    if ('touches' in e && e.touches[0]) {
      clientX = e.touches[0].clientX;
    } else if ('changedTouches' in e && (e as any).changedTouches?.[0]) {
      clientX = (e as any).changedTouches[0].clientX;
    } else {
      clientX = (e as React.MouseEvent).clientX;
    }
    if (!clientX) return;
    
    const x = clientX - box.left;
    const clickedSeconds = (x / getTimelineWidth()) * duration;
    
    if (pendingCut) {
      // Zweiter Klick: Cut abschließen
      const startSeconds = Math.min(pendingCut.startSeconds, clickedSeconds);
      const endSeconds = Math.max(pendingCut.startSeconds, clickedSeconds);
      onCutMarkerAdd?.(startSeconds, endSeconds);
      setPendingCut(null);
    } else {
      // Erster Klick: Start setzen
      setPendingCut({ startSeconds: clickedSeconds });
      onSeek(clickedSeconds);
    }
  };

  // Handler für Cut-Marker Drag
  const handleCutMarkerMouseDown = (
    e: React.MouseEvent | React.TouchEvent,
    markerId: string,
    type: 'start' | 'end',
    seconds: number
  ) => {
    // Prevent context menu IMMEDIATELY for touch events
    if ('touches' in e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Clear any existing long-press timeout
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }
    
    let isFineTuning = false;
    let hasMoved = false;
    
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    // Berechne die Position des Markers auf der Timeline
    const markerX = box.left + (seconds / duration) * getTimelineWidth();
    const offsetX = clientX - markerX;
    
    // Handler für Bewegung während mousedown
    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (isFineTuning) return;
      
      // Prevent default behavior to avoid scrolling during drag
      if ('touches' in moveEvent) {
        moveEvent.preventDefault();
      }
      
      hasMoved = true;
      
      onDragStart?.();
      
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
      setLongPressProgress(null);
      
      // Drag starten
      setCutDragState({
        type,
        markerId,
        origSeconds: seconds,
        offsetX: offsetX,
        currentMouseX: clientX,
      });
      
      // Event-Listener entfernen
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleCutMoveWithPrevent as any);
    };
    
    // Long-Press für Fine-Tuning (nur wenn keine Bewegung)
    const left = `${(seconds / duration) * 100}%`;
    setLongPressProgress({
      type: 'cutMarker',
      markerId,
      markerType: type,
      left,
      top: 50,
      startTime: Date.now(),
    });
    
    longPressTimeoutRef.current = setTimeout(() => {
      if (hasMoved) return; // Nicht aktivieren wenn bereits bewegt
      
      isFineTuning = true;
      setLongPressProgress(null);
      setFineTuningState({
        type: 'cutMarker',
        markerId,
        markerType: type,
        centerSeconds: seconds,
        currentSeconds: seconds,
      });
      // Event-Listener entfernen
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleCutMoveWithPrevent as any);
      window.removeEventListener('mouseup', handleUpOrCancel);
      window.removeEventListener('touchend', handleUpOrCancel);
    }, 500);
    
    // Cleanup handler
    const handleUpOrCancel = () => {
      // Prüfe ob Fine-Tuning bereits aktiviert wurde
      if (isFineTuning) {
        return; // Nichts tun, Fine-Tuning läuft bereits
      }
      
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
      
      // Progress-Indikator abbrechen
      setLongPressProgress(null);
      
      // Wenn nicht bewegt wurde, ist es ein Click (kein Drag)
      if (!hasMoved && !isFineTuning) {
        // Nur zum Marker springen
        onSeek(seconds);
      }
      
      window.removeEventListener('mouseup', handleUpOrCancel);
      window.removeEventListener('touchend', handleUpOrCancel);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleCutMoveWithPrevent as any);
    };
    
    // Wrapper for touch events with preventDefault
    const handleCutMoveWithPrevent = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e);
    };
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleCutMoveWithPrevent, { passive: false });
    window.addEventListener('mouseup', handleUpOrCancel, { once: true });
    window.addEventListener('touchend', handleUpOrCancel, { once: true });
  };

  // Handler für Range-Drag (gesamte Schnittmarke verschieben)
  const handleRangeMouseDown = (
    e: React.MouseEvent | React.TouchEvent,
    markerId: string,
    startSeconds: number,
    endSeconds: number
  ) => {
    e.stopPropagation();
    e.preventDefault();
    
    onDragStart?.();
    
    const box = containerRef.current?.getBoundingClientRect();
    if (!box) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    // Speichere initiale Mausposition für Delta-Berechnung
    setCutDragState({
      type: 'range',
      markerId,
      origSeconds: startSeconds,
      origEndSeconds: endSeconds,
      offsetX: 0,
      currentMouseX: clientX,
      initialMouseX: clientX,
    });
  };

  // Mouse-Event-Handler für Click oder Drag
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent, eventId: number, origSeconds: number, row: number) => {
    // Capture clientX IMMEDIATELY before React recycles the event
    const initialClientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    
    // Prevent context menu IMMEDIATELY for touch events
    if ('touches' in e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Clear any existing timeout
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }

    // Bei kurzer Zeit (Click) -> Video springen
    // Bei Bewegung -> Dragging starten
    // Bei langem Halten ohne Bewegung (500ms) -> Fine-Tuning Modus
    const startTime = Date.now();
    let isDragging = false;
    let isFineTuning = false;
    let hasMoved = false;

    const startDrag = () => {
      if (isDragging || isFineTuning) return;
      isDragging = true;
      
      onDragStart?.();
      
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
      setLongPressProgress(null);
      
      if (!onEventMove) {
        return;
      }
      const box = containerRef.current?.getBoundingClientRect();
      if (!box) {
        return;
      }
      // origSeconds ist bereits die Video-Position (timestamp + gameStart)
      const markerX = box.left + (origSeconds / duration) * getTimelineWidth();
      setDragState({
        eventId,
        origSeconds,
        row,
        offsetX: initialClientX - markerX,
        mouseX: initialClientX,
      });
    };
    
    // Handler für Mausbewegung während mousedown
    const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
      if (isFineTuning) return;
      if (!onEventMove) return;
      
      // Prevent default behavior to avoid scrolling during drag
      if ('touches' in moveEvent) {
        moveEvent.preventDefault();
      }
      
      hasMoved = true;
      // Bei erster Bewegung: Drag starten
      startDrag();
      // Event-Listener entfernen, da wir jetzt im Drag-Modus sind
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMoveWithPrevent as any);
    };

    if (onEventMove) {
      // Long-Press: nach 500ms Fine-Tuning aktivieren (nur wenn keine Bewegung)
      const videoPosition = origSeconds;
      const left = `${(videoPosition / duration) * 100}%`;
      setLongPressProgress({
        type: 'event',
        eventId,
        left,
        top: 16 + row * rowHeight,
        row,
        startTime: Date.now(),
      });
      
      longPressTimeoutRef.current = setTimeout(() => {
        if (hasMoved || isDragging) return; // Nicht aktivieren wenn bereits bewegt/dragging
        
        isFineTuning = true;
        setLongPressProgress(null);
        // Drag-State abbrechen falls irgendwie gestartet
        setDragState(null);
        
        // Fine-Tuning Modus aktivieren
        setFineTuningState({
          type: 'event',
          eventId,
          centerSeconds: origSeconds,
          currentSeconds: origSeconds,
          row,
        });
        // Event-Listener entfernen
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('touchmove', handleMoveWithPrevent as any);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchend', handleMouseUp);
      }, 500);
    }

    // Handle mouseup to check if it was a click or drag
    const handleMouseUp = () => {
      // Prüfe ob Fine-Tuning bereits aktiviert wurde
      if (isFineTuning) {
        return; // Nichts tun, Fine-Tuning läuft bereits
      }
      
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
      if (longPressTimeoutRef.current) {
        clearTimeout(longPressTimeoutRef.current);
        longPressTimeoutRef.current = null;
      }
      
      // Progress-Indikator abbrechen
      setLongPressProgress(null);

      // Wenn noch nicht dragging und nicht fine-tuning, war es ein Click -> seek
      if (!isDragging && !isFineTuning) {
        if (typeof window !== 'undefined') {
        }
        // origSeconds ist bereits die Video-Position (timestamp + gameStart)
        onSeek(origSeconds);
      }

      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMoveWithPrevent as any);
    };

    // Wrapper for touch events with preventDefault
    const handleMoveWithPrevent = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e);
    };
    
    // Event-Listener für Bewegung und mouseup registrieren
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMoveWithPrevent, { passive: false });
    window.addEventListener('mouseup', handleMouseUp, { once: true });
    window.addEventListener('touchend', handleMouseUp, { once: true });
    
    // Only preventDefault for mouse events (touch already handled at start)
    if (!('touches' in e)) {
      e.preventDefault();
    }
    e.stopPropagation();
  };

  return (
    <Box
      ref={containerRef}
      sx={{ 
        position: 'relative', 
        width: '100%', 
        mt: 1, 
        mb: 2,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Time labels and info - Events Timeline */}
      {!showCutMarkers && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, px: 1, fontSize: '0.875rem', color: '#666' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <strong>Start:</strong> {formatSeconds(gameStart)}
                {gameStart > 0 && (
                    <Tooltip title="Zum Spielbeginn springen">
                        <IconButton 
                            size="small" 
                            onClick={() => onSeekToGameStart ? onSeekToGameStart() : onSeek(gameStart)}
                            sx={{ p: 0.5, color: '#1976d2', '&:hover': { bgcolor: '#f5f5f5' } }}
                        >
                            <SkipPreviousIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
            </Box>
        <Box>
            <strong>Länge:</strong> {formatSeconds(duration - gameStart)} (exkl. Offset)
        </Box>
      </Box>
      )}
      
      {/* Time labels and info - Schnittmarken Timeline */}
      {showCutMarkers && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, px: 1, fontSize: '0.875rem', color: '#666' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ContentCutIcon sx={{ fontSize: 16, color: '#ff9800', mr: 0.5 }} />
                <strong>Schnittmarken-Timeline</strong>
                {pendingCut && (
                  <Box component="span" sx={{ ml: 1, color: '#ff9800', fontSize: '0.75rem', fontStyle: 'italic' }}>
                    (ESC oder außerhalb klicken zum Abbrechen)
                  </Box>
                )}
            </Box>
            <Box>
                <strong>Länge:</strong> {formatSeconds(duration)}
            </Box>
        </Box>
      )}

    {/* Events Timeline */}
    {!showCutMarkers && (
    <Box
        sx={{ position: 'relative', width: '100%', height: 32 + maxRow * rowHeight }}
    >
    {/* Timeline Bar */}
    <Box sx={{ 
      position: 'absolute', 
      top: 16 + maxRow * rowHeight / 2, 
      left: 0, 
      right: 0, 
      height: 4, 
      bgcolor: '#e0e0e0', 
      borderRadius: 2, 
      transform: 'translateY(-50%)'
    }} />
      
      {/* Event Markers gestaffelt */}
      {markerRows.map(({ event, left, row }) => {
        // Wenn Marker gerade gezogen wird, live-Position berechnen
        if (dragState && dragState.eventId === event.id) return null; // Overlay-Icon wird separat gerendert
        return (
          <Tooltip key={event.id} title={event.label + (event.description ? `: ${event.description}` : '')} arrow>
            <Box
              sx={{
                position: 'absolute',
                top: 16 + row * rowHeight,
                left,
                transform: 'translate(-50%, -50%)',
                cursor: onEventMove ? 'grab' : 'pointer',
                zIndex: 2,
                color: event.color,
                bgcolor: 'white',
                borderRadius: '50%',
                boxShadow: 1,
                p: { xs: 0.5, sm: 0.2 },
                fontSize: { xs: 24, sm: 18 },
                minWidth: { xs: 44, sm: 'auto' },
                minHeight: { xs: 44, sm: 'auto' },
                transition: 'box-shadow 0.2s',
                '&:hover': { boxShadow: 4, bgcolor: '#f5f5f5' },
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
                touchAction: 'none',
                '& img': {
                  pointerEvents: 'none',
                  userSelect: 'none',
                  WebkitUserDrag: 'none',
                },
              }}
              onMouseDown={(e) => handleMouseDown(e, event.id, event.timestamp + gameStart, row)}
              onTouchStart={(e) => handleMouseDown(e as unknown as React.MouseEvent, event.id, event.timestamp + gameStart, row)}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDragStart={(e) => e.preventDefault()}
            >
              {getGameEventIconByCode(event.icon) || '•'}
            </Box>
          </Tooltip>
        );
      })}
      {/* Drag-Overlay-Icon */}
      {dragState && containerRef.current && (() => {
        const box = containerRef.current!.getBoundingClientRect();
        const currentX = dragState.mouseX - dragState.offsetX - box.left;
        const videoSeconds = Math.max(0, Math.min(duration, (currentX / getTimelineWidth()) * duration));
        const eventSeconds = videoSeconds - gameStart;
        const absoluteGameSeconds = eventSeconds + cumulativeOffset;
        
        return (
        <Tooltip 
          title={
            <Box sx={{ textAlign: 'center' }}>
              <Box><strong>Video:</strong> {formatSeconds(videoSeconds)}</Box>
              <Box><strong>Spiel:</strong> {formatSeconds(absoluteGameSeconds)}</Box>
            </Box>
          }
          open={true}
          placement="top"
          arrow
        >
        <Box
          sx={{
            position: 'absolute',
            top: 16 + dragState.row * rowHeight,
            left: `${(currentX / getTimelineWidth()) * 100}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 10,
            color: events.find(ev => ev.id === dragState.eventId)?.color || 'primary.main',
            bgcolor: 'white',
            border: '2px solid #1976d2',
            borderRadius: '50%',
            boxShadow: 4,
            p: 0.2,
            fontSize: 18,
            userSelect: 'none',
            opacity: 1,
          }}
        >
          {getGameEventIconByCode(
            events.find(ev => ev.id === dragState.eventId)?.icon || ''
          ) || '•'}
        </Box>
        </Tooltip>
        );
      })()}
      
      {/* Long-Press Progress Indikator */}
      {longPressProgress && longPressProgress.type === 'event' && (() => {
        const progressAnimation = keyframes`
          from { stroke-dashoffset: 176; }
          to { stroke-dashoffset: 0; }
        `;
        
        return (
          <Box
            sx={{
              position: 'absolute',
              top: longPressProgress.top,
              left: longPressProgress.left,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              zIndex: 20,
              width: 64,
              height: 64,
            }}
          >
            <svg width="64" height="64" viewBox="0 0 64 64">
              {/* Hintergrund-Kreis */}
              <circle
                cx="32"
                cy="32"
                r="28"
                fill="rgba(255, 255, 255, 0.9)"
                stroke="rgba(25, 118, 210, 0.2)"
                strokeWidth="2"
              />
              {/* Progress-Kreis */}
              <Box
                component="circle"
                cx="32"
                cy="32"
                r="28"
                fill="none"
                stroke="#1976d2"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="176"
                strokeDashoffset="176"
                transform="rotate(-90 32 32)"
                sx={{
                  animation: `${progressAnimation} 500ms linear forwards`,
                }}
              />
              {/* Icon in der Mitte */}
              <text
                x="32"
                y="32"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="24"
                fill="#1976d2"
              >
                {longPressProgress.eventId && getGameEventIconByCode(
                  events.find(ev => ev.id === longPressProgress.eventId)?.icon || ''
                ) || '•'}
              </text>
            </svg>
          </Box>
        );
      })()}
      </Box>
    )}
    
    {/* Schnittmarken Timeline - separate Timeline */}
    {showCutMarkers && (
      <Box
        sx={{ 
          position: 'relative', 
          width: '100%', 
          height: { xs: 100, sm: 60 },
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
        }}
        onClick={handleTimelineClick}
      >
        {/* Timeline Bar */}
        <Box sx={{ 
          position: 'absolute', 
          top: { xs: 50, sm: 30 }, 
          left: 0, 
          right: 0, 
          height: { xs: 10, sm: 6 }, 
          bgcolor: '#e0e0e0', 
          borderRadius: 2, 
          transform: 'translateY(-50%)',
          cursor: cutModeActive ? 'crosshair' : 'default',
          touchAction: 'none',
        }} />
        
        {/* Cut Markers - Bereiche */}
        {cutMarkers.map((marker) => {
          const startPx = (marker.startSeconds / duration) * 100;
          const widthPx = ((marker.endSeconds - marker.startSeconds) / duration) * 100;
          
          // Skip rendering if currently being dragged as range
          const isDraggingRange = cutDragState && cutDragState.markerId === marker.id && cutDragState.type === 'range';
          
          if (isDraggingRange) return null;
          
          return (
            <Box
              key={marker.id}
              data-marker-range="true"
              sx={{
                position: 'absolute',
                top: { xs: 50, sm: 30 },
                left: `${startPx}%`,
                width: `${widthPx}%`,
                height: { xs: 40, sm: 14 },
                bgcolor: 'rgba(255, 152, 0, 0.3)',
                border: '2px solid #ff9800',
                borderRadius: 1,
                transform: 'translateY(-50%)',
                zIndex: 1,
                cursor: 'grab',
                touchAction: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                WebkitTouchCallout: 'none',
                '&:hover': {
                  bgcolor: 'rgba(255, 152, 0, 0.5)',
                  boxShadow: 2,
                },
                '&:active': {
                  cursor: 'grabbing',
                  bgcolor: 'rgba(255, 152, 0, 0.6)',
                },
              }}
              onMouseDown={(e) => {
                // Nur Range-Drag wenn nicht auf Start/End-Button geklickt wurde
                const box = containerRef.current?.getBoundingClientRect();
                if (!box) return;
                const clickX = e.clientX - box.left;
                const startX = (marker.startSeconds / duration) * getTimelineWidth();
                const endX = (marker.endSeconds / duration) * getTimelineWidth();
                // Größerer Puffer für mobile (36px statt 24px) um Start/End-Buttons besser erreichbar zu machen
                const buttonRadius = isMobile ? 36 : 11;
                if (Math.abs(clickX - startX) < buttonRadius || Math.abs(clickX - endX) < buttonRadius) {
                  return; // Nicht Range-Drag starten wenn zu nah an Button
                }
                handleRangeMouseDown(e, marker.id, marker.startSeconds, marker.endSeconds);
              }}
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const touch = e.touches[0];
                const box = containerRef.current?.getBoundingClientRect();
                if (!box) return;
                const clickX = touch.clientX - box.left;
                const startX = (marker.startSeconds / duration) * getTimelineWidth();
                const endX = (marker.endSeconds / duration) * getTimelineWidth();
                // Noch größerer Puffer für Touch (48px) - volle Button-Breite
                const buttonRadius = 48;
                if (Math.abs(clickX - startX) < buttonRadius || Math.abs(clickX - endX) < buttonRadius) {
                  return; // Bei Touch: Start/End-Buttons haben absolute Priorität
                }
                // Range-Drag nur wenn wirklich mittig geklickt (mindestens 48px von beiden Buttons entfernt)
                handleRangeMouseDown(e as unknown as React.MouseEvent, marker.id, marker.startSeconds, marker.endSeconds);
              }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDragStart={(e) => e.preventDefault()}
            >
              <Tooltip title={`${formatSeconds(marker.startSeconds)} - ${formatSeconds(marker.endSeconds)} (${formatSeconds(marker.endSeconds - marker.startSeconds)})`}>
                <Box sx={{ width: '100%', height: '100%' }} />
              </Tooltip>
            </Box>
          );
        })}
        
        {/* Cut Markers - Start/End Griffe */}
        {cutMarkers.map((marker) => {
          const startPx = (marker.startSeconds / duration) * 100;
          const endPx = (marker.endSeconds / duration) * 100;
          
          // Skip rendering if currently being dragged (will show overlay instead)
          const isDraggingStart = cutDragState && cutDragState.markerId === marker.id && cutDragState.type === 'start';
          const isDraggingEnd = cutDragState && cutDragState.markerId === marker.id && cutDragState.type === 'end';
          
          return (
            <React.Fragment key={`handles-${marker.id}`}>
              {/* Start Marker */}
              {!isDraggingStart && (
              <Tooltip title={`Start: ${formatSeconds(marker.startSeconds)}`}>
                <Box
                  data-marker-button="start"
                  sx={{
                    position: 'absolute',
                    top: { xs: 50, sm: 30 },
                    left: `${startPx}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'ew-resize',
                    zIndex: 3,
                    bgcolor: '#ff9800',
                    color: 'white',
                    borderRadius: '50%',
                    width: { xs: 48, sm: 22 },
                    height: { xs: 48, sm: 22 },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: { xs: 24, sm: 14 },
                    boxShadow: 2,
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    '&:hover': { boxShadow: 4, bgcolor: '#f57c00' },
                    '&:active': { bgcolor: '#e65100', boxShadow: 6 },
                  }}
                  onMouseDown={(e) => handleCutMarkerMouseDown(e, marker.id, 'start', marker.startSeconds)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCutMarkerMouseDown(e as unknown as React.MouseEvent, marker.id, 'start', marker.startSeconds);
                  }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDragStart={(e) => e.preventDefault()}
                >
                  ◀
                </Box>
              </Tooltip>
              )}
              
              {/* End Marker */}
              {!isDraggingEnd && (
              <Tooltip title={`Ende: ${formatSeconds(marker.endSeconds)}`}>
                <Box
                  data-marker-button="end"
                  sx={{
                    position: 'absolute',
                    top: { xs: 50, sm: 30 },
                    left: `${endPx}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: 'ew-resize',
                    zIndex: 3,
                    bgcolor: '#ff9800',
                    color: 'white',
                    borderRadius: '50%',
                    width: { xs: 48, sm: 22 },
                    height: { xs: 48, sm: 22 },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: { xs: 24, sm: 14 },
                    boxShadow: 2,
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                    '&:hover': { boxShadow: 4, bgcolor: '#f57c00' },
                    '&:active': { bgcolor: '#e65100', boxShadow: 6 },
                  }}
                  onMouseDown={(e) => handleCutMarkerMouseDown(e, marker.id, 'end', marker.endSeconds)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCutMarkerMouseDown(e as unknown as React.MouseEvent, marker.id, 'end', marker.endSeconds);
                  }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDragStart={(e) => e.preventDefault()}
                >
                  ▶
                </Box>
              </Tooltip>
              )}
            </React.Fragment>
          );
        })}
        
        {/* Pending Cut - erster Klick gesetzt */}
        {pendingCut && (
          <Tooltip title={`Startpunkt: ${formatSeconds(pendingCut.startSeconds)}`}>
            <Box
              sx={{
                position: 'absolute',
                top: { xs: 50, sm: 30 },
                left: `${(pendingCut.startSeconds / duration) * 100}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: 3,
                bgcolor: '#ff9800',
                color: 'white',
                borderRadius: '50%',
                width: { xs: 48, sm: 22 },
                height: { xs: 48, sm: 22 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: { xs: 22, sm: 16 },
                boxShadow: 2,
                touchAction: 'none',
                userSelect: 'none',
                animation: 'pulse 1s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.6 },
                },
              }}
            >
              <ContentCutIcon sx={{ fontSize: { xs: 20, sm: 14 } }} />
            </Box>
          </Tooltip>
        )}
        
        {/* Drag-Overlay für Cut Marker */}
        {cutDragState && containerRef.current && (() => {
          const box = containerRef.current.getBoundingClientRect();
          let leftPercent;
          
          if (cutDragState.type === 'range' && cutDragState.initialMouseX !== undefined) {
            // Range: Berechne neue Position basierend auf Delta
            const deltaX = cutDragState.currentMouseX - cutDragState.initialMouseX;
            const deltaSeconds = (deltaX / getTimelineWidth()) * duration;
            let newStart = cutDragState.origSeconds + deltaSeconds;
            const rangeDuration = cutDragState.origEndSeconds! - cutDragState.origSeconds;
            
            // Grenzen
            if (newStart < 0) newStart = 0;
            if (newStart + rangeDuration > duration) newStart = duration - rangeDuration;
            
            leftPercent = (newStart / duration) * 100;
          } else {
            // Start/End Marker
            leftPercent = ((cutDragState.currentMouseX - cutDragState.offsetX - box.left) / getTimelineWidth()) * 100;
          }
          
          return (
            <Box
              sx={{
                position: 'absolute',
                top: { xs: 50, sm: 30 },
                left: `${leftPercent}%`,
                transform: cutDragState.type === 'range' ? 'translateY(-50%)' : 'translate(-50%, -50%)',
                pointerEvents: 'none',
                zIndex: 10,
                bgcolor: '#ff9800',
                color: 'white',
                border: { xs: '3px solid #f57c00', sm: '2px solid #f57c00' },
                borderRadius: cutDragState.type === 'range' ? 1 : '50%',
                width: cutDragState.type === 'range' 
                  ? `${((cutDragState.origEndSeconds! - cutDragState.origSeconds) / duration) * 100}%`
                  : { xs: 48, sm: 22 },
                height: cutDragState.type === 'range' ? { xs: 40, sm: 14 } : { xs: 48, sm: 22 },
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: { xs: 24, sm: 14 },
                boxShadow: { xs: 6, sm: 4 },
                opacity: 0.95,
              }}
            >
              {cutDragState.type === 'start' && '◀'}
              {cutDragState.type === 'end' && '▶'}
              {cutDragState.type === 'range' && '⇔'}
            </Box>
          );
        })()}
        
        {/* Long-Press Progress Indikator für Cut-Marker */}
        {longPressProgress && longPressProgress.type === 'cutMarker' && (() => {
          const progressAnimation = keyframes`
            from { stroke-dashoffset: 176; }
            to { stroke-dashoffset: 0; }
          `;
          
          return (
            <Box
              sx={{
                position: 'absolute',
                top: { xs: 50, sm: 30 },
                left: longPressProgress.left,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                zIndex: 20,
                width: { xs: 72, sm: 64 },
                height: { xs: 72, sm: 64 },
              }}
            >
              <svg width="100%" height="100%" viewBox="0 0 64 64">
                {/* Hintergrund-Kreis */}
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="rgba(255, 255, 255, 0.9)"
                  stroke="rgba(255, 152, 0, 0.2)"
                  strokeWidth="2"
                />
                {/* Progress-Kreis */}
                <Box
                  component="circle"
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke="#ff9800"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="176"
                  strokeDashoffset="176"
                  transform="rotate(-90 32 32)"
                  sx={{
                    animation: `${progressAnimation} 500ms linear forwards`,
                  }}
                />
                {/* Icon in der Mitte */}
                <text
                  x="32"
                  y="32"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="24"
                  fill="#ff9800"
                >
                  {longPressProgress.markerType === 'start' ? '◀' : '▶'}
                </text>
              </svg>
            </Box>
          );
        })()}
      </Box>
    )}
    
    {/* Fine-Tuning Overlay - Kompakt über dem Icon */}
    {fineTuningState && containerRef.current && (() => {
      const box = containerRef.current.getBoundingClientRect();
      const timeRange = 20; // ±10 Sekunden
      const startTime = Math.max(0, fineTuningState.centerSeconds - timeRange / 2);
      const endTime = Math.min(duration, fineTuningState.centerSeconds + timeRange / 2);
      const actualRange = endTime - startTime;
      const currentPosition = ((fineTuningState.currentSeconds - startTime) / actualRange) * 100;
      
      // Berechne Position über dem Icon
      let iconLeft, iconTop;
      if (fineTuningState.type === 'event' && fineTuningState.row !== undefined) {
        const videoPosition = fineTuningState.centerSeconds;
        iconLeft = `${(videoPosition / duration) * 100}%`;
        iconTop = 16 + fineTuningState.row * rowHeight;
      } else {
        iconLeft = `${(fineTuningState.centerSeconds / duration) * 100}%`;
        iconTop = 50; // Cut-Marker Position
      }
      
      // Berechne absolute Position und prüfe Bildschirmgrenzen
      const containerBox = containerRef.current.getBoundingClientRect();
      const iconPercent = (fineTuningState.centerSeconds / duration) * 100;
      const iconAbsoluteX = containerBox.left + (containerBox.width * iconPercent / 100);
      const dialogWidth = isMobile ? window.innerWidth * 0.9 : 400;
      
      // Prüfe ob Dialog links oder rechts aus dem Bildschirm ragt
      let leftAdjustment = 0;
      if (iconAbsoluteX - dialogWidth / 2 < 10) {
        // Zu weit links
        leftAdjustment = (10 - (iconAbsoluteX - dialogWidth / 2));
      } else if (iconAbsoluteX + dialogWidth / 2 > window.innerWidth - 10) {
        // Zu weit rechts
        leftAdjustment = (window.innerWidth - 10 - (iconAbsoluteX + dialogWidth / 2));
      }
      
      return (
        <>
          {/* Dezenter Backdrop */}
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(0, 0, 0, 0.3)',
              zIndex: 9998,
            }}
            onClick={handleFineTuningEnd}
          />
          
          {/* Kompakte Leiste über dem Icon */}
          <Box
            sx={{
              position: 'absolute',
              left: iconLeft,
              top: iconTop,
              transform: `translate(calc(-50% + ${leftAdjustment}px), calc(-100% - 12px))`,
              width: { xs: '90vw', sm: 400 },
              maxWidth: 500,
              bgcolor: 'rgba(0, 0, 0, 0.95)',
              borderRadius: 2,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
              zIndex: 9999,
              px: 2,
              py: 1.5,
              border: `2px solid ${fineTuningState.type === 'cutMarker' ? '#ff9800' : '#1976d2'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
            onMouseMove={(e) => {
              e.preventDefault();
              handleFineTuningMove(e.clientX, e.currentTarget);
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              handleFineTuningMove(e.touches[0].clientX, e.currentTarget);
            }}
            onMouseUp={handleFineTuningEnd}
            onTouchEnd={handleFineTuningEnd}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              userSelect: 'none',
              WebkitUserSelect: 'none',
              WebkitTouchCallout: 'none',
            }}
          >
            {/* Zeit-Anzeige links */}
            <Box sx={{ 
              color: 'white',
              minWidth: { xs: 70, sm: 80 },
              flexShrink: 0,
            }}>
              <Box sx={{ 
                fontSize: { xs: 16, sm: 20 }, 
                fontWeight: 'bold', 
                fontFamily: 'monospace',
                lineHeight: 1.2,
                color: '#fff',
              }}>
                {formatSeconds(fineTuningState.currentSeconds)}
              </Box>
              {fineTuningState.type === 'event' && (
                <Box sx={{ 
                  fontSize: { xs: 11, sm: 12 }, 
                  color: '#bbb',
                  fontFamily: 'monospace',
                }}>
                  {formatSeconds(fineTuningState.currentSeconds - gameStart + cumulativeOffset)}
                </Box>
              )}
            </Box>
            
            {/* Timeline in der Mitte - flexibel */}
            <Box 
              data-fine-tuning-timeline
              sx={{ 
                position: 'relative', 
                flex: 1, 
                height: 40,
                minWidth: 0,
              }}
            >
              {/* Timeline Bar */}
              <Box sx={{ 
                position: 'absolute', 
                top: '50%', 
                left: 0, 
                right: 0, 
                height: 4, 
                bgcolor: 'rgba(255, 255, 255, 0.2)', 
                borderRadius: 1,
                transform: 'translateY(-50%)',
              }} />
              
              {/* Center Marker (Original Position) */}
              <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 2,
                height: 28,
                bgcolor: 'rgba(255, 255, 255, 0.5)',
                zIndex: 1,
              }} />
              
              {/* Current Position Marker */}
              <Box sx={{
                position: 'absolute',
                top: '50%',
                left: `${currentPosition}%`,
                transform: 'translate(-50%, -50%)',
                width: 32,
                height: 32,
                bgcolor: fineTuningState.type === 'cutMarker' ? '#ff9800' : '#1976d2',
                borderRadius: '50%',
                boxShadow: `0 0 12px ${fineTuningState.type === 'cutMarker' ? 'rgba(255, 152, 0, 0.6)' : 'rgba(25, 118, 210, 0.6)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 16,
                zIndex: 2,
                border: '2px solid white',
              }}>
                {fineTuningState.type === 'event' 
                  ? (getGameEventIconByCode(
                      events.find(ev => ev.id === fineTuningState.eventId)?.icon || ''
                    ) || '•')
                  : fineTuningState.markerType === 'start' ? '◀' : '▶'
                }
              </Box>
            </Box>
            
            {/* Zeit-Labels rechts */}
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              fontSize: { xs: 10, sm: 11 },
              color: '#bbb',
              fontFamily: 'monospace',
              minWidth: { xs: 42, sm: 45 },
              flexShrink: 0,
              textAlign: 'right',
              gap: 0.5,
            }}>
              <span>{formatSeconds(startTime)}</span>
              <span>{formatSeconds(endTime)}</span>
            </Box>
          </Box>
        </>
      );
    })()}
    </Box>
  );
};

export default VideoTimeline;
