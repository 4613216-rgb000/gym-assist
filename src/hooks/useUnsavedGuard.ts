import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export function useUnsavedGuard(hasUnsaved: boolean) {
  const location = useLocation();
  const lastLocation = useRef(location);

  useEffect(() => {
    if (!hasUnsaved) return;

    void lastLocation;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [hasUnsaved, location]);
}
