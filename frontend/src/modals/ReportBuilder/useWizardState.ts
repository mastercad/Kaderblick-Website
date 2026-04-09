import { useState, useRef, useEffect, useCallback, useMemo, Dispatch, SetStateAction } from 'react';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { Report, ReportConfig, ReportBuilderState } from './types';
import type { PlayerOption, Subject, Topic, TimeRange, WizardOption } from './wizardTypes';
import { STEP_LABELS, TOPIC_OPTIONS, AUTO_ADVANCE_DELAY } from './wizardTypes';
import { buildConfig, buildName, reverseMapWizardConfig } from './wizardLogic';
import { fetchPlayerById, searchReportPlayers } from '../../services/reports';

interface UseWizardStateInput {
  state: ReportBuilderState;
  initialConfig?: ReportConfig;
  onSave: (report: Report) => Promise<void>;
  onClose: () => void;
  onOpenBuilder: () => void;
  onBack: () => void;
}

export interface WizardStateReturn {
  // Navigation
  step: number;
  setStep: Dispatch<SetStateAction<number>>;
  isInitializing: boolean;
  totalSteps: number;
  visibleStep: number;
  progress: number;
  stepLabels: string[];
  contextStepLabel: string;
  // Selections
  subject: Subject | null;
  topic: Topic | null;
  timeRange: TimeRange | null;
  // Context selections
  selectedTeam: { id: number; name: string } | null;
  setSelectedTeam: (t: { id: number; name: string } | null) => void;
  selectedPlayer: PlayerOption | null;
  setSelectedPlayer: (p: PlayerOption | null) => void;
  selectedComparisonTeams: number[];
  setSelectedComparisonTeams: Dispatch<SetStateAction<number[]>>;
  selectedComparisonPlayers: PlayerOption[];
  setSelectedComparisonPlayers: Dispatch<SetStateAction<PlayerOption[]>>;
  // Player search
  playerSearchInput: string;
  setPlayerSearchInput: (v: string) => void;
  playerSearchOptions: PlayerOption[];
  playerSearchLoading: boolean;
  // Confirm step
  reportName: string;
  setReportName: (name: string) => void;
  saving: boolean;
  nameRef: React.RefObject<HTMLInputElement | null>;
  isMobile: boolean;
  // Derived
  teams: { id: number; name: string }[];
  topicOptions: WizardOption<Topic>[];
  contextStepCanContinue: boolean;
  // Handlers
  hasContextStep: (sub: Subject) => boolean;
  goToConfirm: (sub: Subject, top: Topic, tr: TimeRange) => void;
  handleSelectSubject: (val: Subject) => void;
  handleSelectTopic: (val: Topic) => void;
  handleSelectTimeRange: (val: TimeRange) => void;
  handleBack: () => void;
  handleSave: () => Promise<void>;
}

export function useWizardState({
  state,
  initialConfig,
  onSave,
  onClose,
  onOpenBuilder,
  onBack,
}: UseWizardStateInput): WizardStateReturn {
  const [step, setStep] = useState(0);
  const [isInitializing, setIsInitializing] = useState(!!initialConfig);
  const initializedRef = useRef(false);

  const [subject, setSubject] = useState<Subject | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange | null>(null);

  const [reportName, setReportName] = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [selectedTeam, setSelectedTeam] = useState<{ id: number; name: string } | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerOption | null>(null);
  const [selectedComparisonTeams, setSelectedComparisonTeams] = useState<number[]>([]);
  const [selectedComparisonPlayers, setSelectedComparisonPlayers] = useState<PlayerOption[]>([]);

  const [playerSearchInput, setPlayerSearchInput] = useState('');
  const [playerSearchOptions, setPlayerSearchOptions] = useState<PlayerOption[]>([]);
  const [playerSearchLoading, setPlayerSearchLoading] = useState(false);

  const { builderData, setCurrentReport } = state;
  const availableDates = builderData?.availableDates ?? [];
  const teams = useMemo(() => builderData?.teams ?? [], [builderData]);
  const topicOptions: WizardOption<Topic>[] = subject ? TOPIC_OPTIONS[subject] : [];

  // Whether the context step is relevant (skip if no meaningful choices available)
  const hasContextStep = useCallback((sub: Subject): boolean => {
    if (sub === 'player') return true;
    if (sub === 'player_comparison') return true;
    if (sub === 'team') return teams.length > 1;
    if (sub === 'team_comparison') return teams.length > 1;
    return false;
  }, [teams.length]);

  const totalSteps = subject && hasContextStep(subject) ? 4 : 3;
  const visibleStep = step === 0 ? 0 : step === 1 ? 1 : step - (subject && hasContextStep(subject) ? 0 : 1);
  const progress = (visibleStep / totalSteps) * 100;

  const contextStepLabel =
    subject === 'player' ? 'Welcher Spieler?' :
    subject === 'player_comparison' ? 'Welche Spieler vergleichen?' :
    'Welche Mannschaft(en)?';
  const stepLabels = [STEP_LABELS[0], contextStepLabel, STEP_LABELS[2], STEP_LABELS[3]];

  const contextStepCanContinue = !subject ? false :
    subject === 'player' ? selectedPlayer !== null :
    true; // player_comparison, team, team_comparison: selection is optional

  // ── Auto-focus name field on confirm step ──────────────────────────────────
  useEffect(() => {
    if (step === 4) {
      const timer = setTimeout(() => nameRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [step]);

  // ── Pre-fill wizard from initialConfig (re-editing a wizard-created report) ─
  useEffect(() => {
    if (!initialConfig || initializedRef.current || !builderData) return;
    initializedRef.current = true;

    const mapped = reverseMapWizardConfig(initialConfig, availableDates);
    if (!mapped) {
      setIsInitializing(false);
      onOpenBuilder();
      return;
    }

    setSubject(mapped.subject);
    setTopic(mapped.topic);
    setTimeRange(mapped.timeRange);
    setReportName(state.currentReport.name);

    if (mapped.teamId !== undefined) {
      const team = teams.find(t => t.id === mapped.teamId);
      if (team) setSelectedTeam(team);
    }
    if (mapped.comparisonTeamIds.length) {
      setSelectedComparisonTeams(mapped.comparisonTeamIds);
    }
    // Collect all async player-resolution promises and wait for them to settle
    // BEFORE advancing to the confirm step (step 4).  This closes a timing
    // window where goToConfirm could fire with selectedPlayer /
    // selectedComparisonPlayers still null – because the fetch had not yet
    // resolved – causing those filter values to be lost when the user later
    // clicks "Anpassen" to open the full builder.
    const fetchPromises: Promise<void>[] = [];

    if (mapped.playerId !== undefined) {
      fetchPromises.push(
        fetchPlayerById(mapped.playerId)
          .then(p => { if (p) setSelectedPlayer(p); })
          .catch(() => { /* ignore */ }),
      );
    }

    if (mapped.comparisonPlayerIds.length) {
      fetchPromises.push(
        Promise.all(mapped.comparisonPlayerIds.map(id => fetchPlayerById(id)))
          .then(players => {
            setSelectedComparisonPlayers(
              players.filter((p): p is PlayerOption => p !== null),
            );
          })
          .catch(() => { /* ignore — players stay empty */ }),
      );
    }

    const finalize = () => { setStep(4); setIsInitializing(false); };
    if (fetchPromises.length === 0) {
      finalize();
    } else {
      Promise.all(fetchPromises).finally(finalize);
    }
  }, [initialConfig, builderData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced player search ────────────────────────────────────────────────
  useEffect(() => {
    if (playerSearchInput.length < 2) {
      setPlayerSearchOptions([]);
      return;
    }
    setPlayerSearchLoading(true);
    const timer = setTimeout(() => {
      searchReportPlayers(playerSearchInput)
        .then(results => setPlayerSearchOptions(results))
        .catch(() => setPlayerSearchOptions([]))
        .finally(() => setPlayerSearchLoading(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      setPlayerSearchLoading(false);
    };
  }, [playerSearchInput]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const goToConfirm = useCallback((sub: Subject, top: Topic, tr: TimeRange) => {
    const contextLabel =
      sub === 'player' && selectedPlayer ? selectedPlayer.fullName :
      sub === 'team' && selectedTeam ? selectedTeam.name :
      undefined;
    const config = buildConfig(
      sub, top, tr, availableDates,
      sub === 'team' ? selectedTeam?.id : null,
      sub === 'player' ? selectedPlayer?.id : null,
      sub === 'team_comparison' ? selectedComparisonTeams : [],
      sub === 'player_comparison' ? selectedComparisonPlayers.map(p => p.id) : [],
    );
    const name = buildName(sub, top, tr, contextLabel);
    setReportName(name);
    setCurrentReport(prev => ({ ...prev, name, config }));
    setStep(4);
  }, [availableDates, selectedTeam, selectedPlayer, selectedComparisonTeams, selectedComparisonPlayers, setCurrentReport]);

  const autoAdvance = useCallback((
    newSubject: Subject | null,
    newTopic: Topic | null,
    newTimeRange: TimeRange | null,
    currentStep: number,
  ) => {
    const timer = setTimeout(() => {
      if (currentStep === 0 && newSubject) {
        setStep(hasContextStep(newSubject) ? 1 : 2);
      } else if (currentStep === 2 && newTopic) {
        setStep(3);
      } else if (currentStep === 3 && newSubject && newTopic && newTimeRange) {
        goToConfirm(newSubject, newTopic, newTimeRange);
      }
    }, AUTO_ADVANCE_DELAY);
    return timer;
  }, [goToConfirm, hasContextStep]);

  const handleSelectSubject = useCallback((val: Subject) => {
    setSubject(val);
    setTopic(null);
    setSelectedTeam(null);
    setSelectedPlayer(null);
    setSelectedComparisonTeams([]);
    setSelectedComparisonPlayers([]);
    setPlayerSearchInput('');
    setPlayerSearchOptions([]);
    const t = autoAdvance(val, null, null, 0);
    return () => clearTimeout(t);
  }, [autoAdvance]);

  const handleSelectTopic = useCallback((val: Topic) => {
    setTopic(val);
    const t = autoAdvance(subject, val, null, 2);
    return () => clearTimeout(t);
  }, [autoAdvance, subject]);

  const handleSelectTimeRange = useCallback((val: TimeRange) => {
    setTimeRange(val);
    if (subject && topic) {
      const t = autoAdvance(subject, topic, val, 3);
      return () => clearTimeout(t);
    }
  }, [autoAdvance, subject, topic]);

  const handleBack = useCallback(() => {
    if (step === 0) onBack();
    else if (step === 2 && subject && !hasContextStep(subject)) setStep(0);
    else setStep(s => s - 1);
  }, [step, subject, hasContextStep, onBack]);

  const handleSave = useCallback(async () => {
    if (!subject || !topic || !timeRange || !reportName.trim()) return;
    setSaving(true);
    try {
      const config = buildConfig(
        subject, topic, timeRange, availableDates,
        subject === 'team' ? selectedTeam?.id : null,
        subject === 'player' ? selectedPlayer?.id : null,
        subject === 'team_comparison' ? selectedComparisonTeams : [],
        subject === 'player_comparison' ? selectedComparisonPlayers.map(p => p.id) : [],
      );
      await onSave({ name: reportName.trim(), description: '', config });
      onClose();
    } finally {
      setSaving(false);
    }
  }, [subject, topic, timeRange, reportName, availableDates, selectedTeam, selectedPlayer, selectedComparisonTeams, selectedComparisonPlayers, onSave, onClose]);

  return {
    step, setStep,
    isInitializing,
    totalSteps, visibleStep, progress,
    stepLabels, contextStepLabel,
    subject, topic, timeRange,
    selectedTeam, setSelectedTeam,
    selectedPlayer, setSelectedPlayer,
    selectedComparisonTeams, setSelectedComparisonTeams,
    selectedComparisonPlayers, setSelectedComparisonPlayers,
    playerSearchInput, setPlayerSearchInput,
    playerSearchOptions, playerSearchLoading,
    reportName, setReportName,
    saving,
    nameRef,
    isMobile,
    teams,
    topicOptions,
    contextStepCanContinue,
    hasContextStep,
    goToConfirm,
    handleSelectSubject,
    handleSelectTopic,
    handleSelectTimeRange,
    handleBack,
    handleSave,
  };
}
