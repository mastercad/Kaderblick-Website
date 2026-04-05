/**
 * Step key constants for the EventModal wizard.
 * These are used both by the useEventWizard hook (step computation)
 * and by EventStepContent (switch-based rendering).
 */
export const STEP_BASE             = 'base';
export const STEP_DETAILS          = 'details';
export const STEP_TIMING           = 'timing';
export const STEP_MATCHES          = 'matches';
export const STEP_PERMISSIONS      = 'permissions';
export const STEP_DESCRIPTION      = 'description';
export const STEP_TRAINING_SCOPE   = 'training_scope';

export type WizardStepKey =
  | typeof STEP_BASE
  | typeof STEP_DETAILS
  | typeof STEP_TIMING
  | typeof STEP_MATCHES
  | typeof STEP_PERMISSIONS
  | typeof STEP_DESCRIPTION
  | typeof STEP_TRAINING_SCOPE;

export interface WizardStep {
  key: WizardStepKey;
  label: string;
}
