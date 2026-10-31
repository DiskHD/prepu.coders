import { useEffect, useState } from 'react';
import { checkBackendStatus } from '../services/identificationService';
import type { BackendStatus } from '../types/identification';

/** Estado del servidor de reconocimiento, comprobado al montar. */
export function useBackendStatus() {
  const [status, setStatus] = useState<BackendStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();
    checkBackendStatus(controller.signal).then((s) => {
      if (!controller.signal.aborted) setStatus(s);
    });
    return () => controller.abort();
  }, []);

  return status;
}
