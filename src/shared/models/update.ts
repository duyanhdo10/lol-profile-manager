export type UpdateStatus =
  'disabled' | 'idle' | 'checking' | 'downloading' | 'downloaded' | 'upToDate' | 'error';

export type UpdateErrorCode = 'UPDATE_CHECK_FAILED' | 'UPDATE_DOWNLOAD_FAILED' | 'UPDATE_NOT_READY';

export interface UpdateState {
  status: UpdateStatus;
  availableVersion?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  checkedAt?: string;
  errorCode?: UpdateErrorCode;
}
