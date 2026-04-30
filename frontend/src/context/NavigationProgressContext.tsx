import React, { createContext, useCallback, useContext, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import LinearProgress from '@mui/material/LinearProgress';

interface NavigationProgressContextType {
  navigateWithProgress: (to: string) => void;
  isPending: boolean;
}

const NavigationProgressContext = createContext<NavigationProgressContextType>({
  navigateWithProgress: () => {},
  isPending: false,
});

export function NavigationProgressProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();

  const navigateWithProgress = useCallback(
    (to: string) => {
      startTransition(() => {
        navigate(to);
      });
    },
    [navigate, startTransition],
  );

  return (
    <NavigationProgressContext.Provider value={{ navigateWithProgress, isPending }}>
      {isPending && (
        <LinearProgress
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            height: 3,
          }}
        />
      )}
      {children}
    </NavigationProgressContext.Provider>
  );
}

export function useNavigationProgress() {
  return useContext(NavigationProgressContext);
}
