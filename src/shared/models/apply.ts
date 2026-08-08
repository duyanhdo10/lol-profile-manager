import type { ProfileDraft, ProfileField, ProfileState } from './profile';

export interface ApplyStepResult {
  field: ProfileField;
  attempted: boolean;
  succeeded: boolean;
  rollbackAttempted: boolean;
  rollbackSucceeded: boolean | null;
  error?: string;
}

export interface ApplyProfileResult {
  succeeded: boolean;
  before: ProfileState;
  steps: ApplyStepResult[];
  rollbackAttempted: boolean;
  rollbackSucceeded: boolean;
  finalState: ProfileState;
}

export interface ApplyWarning {
  field: ProfileField;
  message: string;
  code?: string;
  params?: Record<string, string | number>;
  level: 'info' | 'warning';
}

export interface ApplyPreview {
  before: ProfileState;
  draft: ProfileDraft;
  warnings: ApplyWarning[];
}
