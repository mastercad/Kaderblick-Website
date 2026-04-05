import { useState, useEffect, useCallback, useMemo } from 'react';
import { EventData, SelectOption } from '../types/event';
import { useEventTypeFlags } from './useEventTypeFlags';
import {
  STEP_BASE,
  STEP_DETAILS,
  STEP_TIMING,
  STEP_MATCHES,
  STEP_PERMISSIONS,
  STEP_DESCRIPTION,
  STEP_TRAINING_SCOPE,
  WizardStep,
  WizardStepKey,
} from '../components/EventModal/eventWizardConstants';
import { getTaskConfigFromEvent, validateTaskConfiguration } from '../utils/taskConfig';

export interface UseEventWizardParams {
  open: boolean;
  event: EventData;
  eventTypes: SelectOption[];
  gameTypes: SelectOption[];
  onChange: (field: string, value: any) => void;
  onSave: (formData: EventData) => void;
  onClose: () => void;
}

export interface UseEventWizardResult {
  currentStep: number;
  steps: WizardStep[];
  isLastStep: boolean;
  currentStepKey: WizardStepKey;
  stepError: string | null;
  setStepError: (error: string | null) => void;
  flags: ReturnType<typeof useEventTypeFlags>;
  handleNext: () => void;
  handleBack: () => void;
  handleSave: () => void;
  handleClose: () => void;
  validateCurrentStep: () => boolean;
}

/**
 * Manages all wizard navigation state: current step, step list, validation,
 * navigation handlers, and auto-fill side-effects.
 */
export function useEventWizard({
  open,
  event,
  eventTypes,
  gameTypes,
  onChange,
  onSave,
  onClose,
}: UseEventWizardParams): UseEventWizardResult {
  const [currentStep, setCurrentStep] = useState(0);
  const [stepError, setStepError]     = useState<string | null>(null);

  const flags = useEventTypeFlags(event.eventType, event.gameType, eventTypes, gameTypes);
  const { isMatchEvent, isTournament, isTask, isTraining, isGenericEvent } = flags;

  // ── Reset wizard on open ──────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      setStepError(null);
    }
  }, [open]);

  // ── Auto-fill gameType for tournament events ───────────────────────────────
  useEffect(() => {
    if (open && isTournament && !event.gameType && gameTypes.length > 0) {
      const gt = gameTypes.find(g => g.label.toLowerCase().includes('turnier'));
      if (gt) onChange('gameType', gt.value);
    }
  }, [open, isTournament, event.gameType, gameTypes, onChange]);

  // ── Step list (reactive to event type) ────────────────────────────────────
  const steps: WizardStep[] = useMemo(() => {
    const s: WizardStep[] = [{ key: STEP_BASE, label: 'Basisdaten' }];

    if (isMatchEvent || isTournament) {
      s.push({ key: STEP_DETAILS, label: 'Spieldetails' });
      if (isTournament) s.push({ key: STEP_MATCHES, label: 'Begegnungen' });
      if (!isTournament) s.push({ key: STEP_TIMING, label: 'Spielzeiten' });
    } else if (isTask) {
      s.push({ key: STEP_DETAILS, label: 'Aufgabe' });
    } else if (isTraining) {
      s.push({ key: STEP_DETAILS, label: 'Training' });
      // When editing an existing training series, add a scope-selection step
      if (event.trainingSeriesId) {
        s.push({ key: STEP_TRAINING_SCOPE, label: 'Gültigkeit' });
      }
    } else if (isGenericEvent) {
      s.push({ key: STEP_PERMISSIONS, label: 'Berechtigungen' });
    } else {
      s.push({ key: STEP_DETAILS, label: 'Details' });
    }

    s.push({ key: STEP_DESCRIPTION, label: 'Beschreibung' });
    return s;
  }, [isMatchEvent, isTournament, isTask, isTraining, isGenericEvent]);

  // Clamp currentStep when step list shrinks (event type changed mid-wizard)
  useEffect(() => {
    setCurrentStep(prev => Math.min(prev, steps.length - 1));
  }, [steps.length]);

  const isLastStep     = currentStep === steps.length - 1;
  const currentStepKey = (steps[currentStep]?.key ?? STEP_BASE) as WizardStepKey;

  // ── Per-step validation ───────────────────────────────────────────────────
  const validateCurrentStep = useCallback((): boolean => {
    setStepError(null);

    if (currentStepKey === STEP_BASE) {
      if (!event.title || !event.eventType || !event.date) {
        setStepError('Bitte Titel, Event-Typ und Start-Datum angeben!');
        return false;
      }
    }

    if (currentStepKey === STEP_DETAILS) {
      if (isMatchEvent && !isTournament) {
        if (!event.homeTeam || !event.awayTeam) {
          setStepError('Bitte Heim- und Auswärts-Team angeben!');
          return false;
        }
        if (!event.locationId) {
          setStepError('Bitte Austragungsort auswählen!');
          return false;
        }
      }
      if (isTask) {
        const validation = validateTaskConfiguration(getTaskConfigFromEvent(event));
        const firstTaskError = Object.values(validation.errors)[0];
        if (firstTaskError) {
          setStepError(firstTaskError);
          return false;
        }
      }
    }

    if (currentStepKey === STEP_PERMISSIONS) {
      if (!event.permissionType) {
        setStepError('Bitte eine Sichtbarkeit wählen!');
        return false;
      }
    }

    return true;
  }, [currentStepKey, event, isMatchEvent, isTournament, isTask]);

  // ── Navigation handlers ───────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) return;
    setCurrentStep(prev => prev + 1);
  }, [validateCurrentStep]);

  const handleBack = useCallback(() => {
    setStepError(null);
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  const handleSave = useCallback(() => {
    if (!validateCurrentStep()) return;
    onSave(event);
  }, [event, onSave, validateCurrentStep]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  return {
    currentStep,
    steps,
    isLastStep,
    currentStepKey,
    stepError,
    setStepError,
    flags,
    handleNext,
    handleBack,
    handleSave,
    handleClose,
    validateCurrentStep,
  };
}
