/**
 * useFormationSave
 *
 * Verantwortlich für:
 * - Formation speichern (POST auf /formation/new bzw. /formation/{id}/edit)
 * - Fehler- und Ladezustand setzen
 * - Erfolgsmeldung anzeigen und Modal schließen
 */
import { apiJson, getApiErrorMessage } from '../../utils/api';
import type { Formation, FormationData, FormationEditorDraft, PlayerData } from './types';

interface UseFormationSaveParams {
  formation: Formation | null;
  currentTemplateCode: string | null;
  players: PlayerData[];
  benchPlayers: PlayerData[];
  notes: string;
  name: string;
  selectedTeam: number | '';
  formationId: number | null;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  showToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  onClose: () => void;
  onSaved?: (formation: Formation) => void;
  onSaveDraft?: (draft: FormationEditorDraft) => Promise<void> | void;
  saveSuccessMessage?: string;
}

export function useFormationSave({
  formation,
  currentTemplateCode,
  players,
  benchPlayers,
  notes,
  name,
  selectedTeam,
  formationId,
  setLoading,
  setError,
  showToast,
  onClose,
  onSaved,
  onSaveDraft,
  saveSuccessMessage,
}: UseFormationSaveParams) {
  const handleSave = async () => {
    // Eingabevalidierung – bevor wir irgendwas ans Backend schicken
    if (!name.trim()) {
      setError('Bitte gib der Aufstellung einen Namen.');
      return;
    }
    if (selectedTeam === '') {
      setError('Bitte wähle ein Team aus.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const formationData: FormationData = {
        ...(formation?.formationData ?? {}),
        code: currentTemplateCode ?? undefined,
        players,
        bench: benchPlayers,
        notes,
      };

      const draftPayload: FormationEditorDraft = {
        name,
        selectedTeam,
        formationData,
      };

      if (onSaveDraft) {
        await onSaveDraft(draftPayload);
        showToast(saveSuccessMessage ?? 'Aufstellung übernommen.', 'success');
        onClose();
        return;
      }

      const url = formationId ? `/formation/${formationId}/edit` : '/formation/new';
      const response = await apiJson(url, {
        method: 'POST',
        body: { name, team: selectedTeam, formationData },
      });
      if (response?.error) {
        setError(response.error);
        return;
      }      showToast(saveSuccessMessage ?? 'Formation erfolgreich gespeichert!', 'success');
      const saved: Formation = response?.formation ?? {
        id: response?.id ?? Date.now(),
        name,
        formationType: {
          name: formation?.formationType?.name ?? 'fußball',
          cssClass: formation?.formationType?.cssClass ?? '',
          backgroundPath: formation?.formationType?.backgroundPath ?? 'fussballfeld_haelfte.jpg',
        },
        formationData,
      };
      onSaved?.(saved);
      onClose();
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Die Aufstellung konnte nicht gespeichert werden. Bitte versuche es erneut.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return { handleSave };
}
