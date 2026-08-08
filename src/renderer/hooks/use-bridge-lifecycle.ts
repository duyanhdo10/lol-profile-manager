import { useEffect } from 'react';
import { useAppStore } from '../store/app-store';

export function useBridgeLifecycle(): void {
  const initialize = useAppStore((state) => state.initialize);
  const handleConnection = useAppStore((state) => state.handleConnection);
  const setResetBanner = useAppStore((state) => state.setResetBanner);
  const setUpdateState = useAppStore((state) => state.setUpdateState);

  useEffect(() => {
    if (!window.lpm) {
      void initialize();
      return;
    }
    const stopConnection = window.lpm.onConnectionState((state) => {
      void handleConnection(state);
    });
    const stopReset = window.lpm.onProfileMayHaveReset(() => setResetBanner(true));
    const stopUpdates = window.lpm.onUpdateState(setUpdateState);
    void initialize();
    return () => {
      stopConnection();
      stopReset();
      stopUpdates();
    };
  }, [handleConnection, initialize, setResetBanner, setUpdateState]);
}
