import { useEffect } from 'react';
import { useAppStore } from '../store/app-store';

export function useBridgeLifecycle(): void {
  const initialize = useAppStore((state) => state.initialize);
  const handleConnection = useAppStore((state) => state.handleConnection);
  const setResetBanner = useAppStore((state) => state.setResetBanner);

  useEffect(() => {
    if (!window.lpm) {
      void initialize();
      return;
    }
    const stopConnection = window.lpm.onConnectionState((state) => {
      void handleConnection(state);
    });
    const stopReset = window.lpm.onProfileMayHaveReset(() => setResetBanner(true));
    void initialize();
    return () => {
      stopConnection();
      stopReset();
    };
  }, [handleConnection, initialize, setResetBanner]);
}
