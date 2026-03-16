import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { apiJson, apiRequest } from '../utils/api';

interface User {
  id: number;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  height?: number;
  weight?: number;
  shoeSize?: number;
  shirtSize?: string;
  pantsSize?: string;
  socksSize?: string;
  jacketSize?: string;
  isCoach?: boolean;
  isPlayer?: boolean;
  needsRegistrationContext?: boolean;
  roles: { [key: string]: string };
  avatarFile?: string;
  googleAvatarUrl?: string;
  useGoogleAvatar?: boolean;
  title?: {
    hasTitle: boolean;
    displayTitle: string;
    avatarFrame: string;
    allTitles: { [key: number]: string };
  }
  level?: {
    level: number;
    xpTotal: number;
  };
}

interface AuthData {
  success?: boolean;
  token?: string;
  refreshToken?: string;
  user?: User;
  error?: string;
  message?: string;
}

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  loginWithGoogle: (data: AuthData) => void;
  logout: () => void;
  checkAuthStatus: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = Boolean(user);
  const isSuperAdmin = Boolean(user?.roles && Object.values(user.roles).includes('ROLE_SUPERADMIN'));
  const isAdmin = Boolean(user?.roles && (Object.values(user.roles).includes('ROLE_ADMIN') || Object.values(user.roles).includes('ROLE_SUPERADMIN')));

  const checkAuthStatus = async () => {
    setIsLoading(true);
    try {
      const userData = await apiJson<User>('/api/about-me');
      if (userData && typeof userData === 'object' && 'error' in userData) {
        setUser(null);
      } else {
        setUser(userData as User);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: { email: string; password: string }) => {
    try {
      const result = await apiJson('/api/login', {
        method: 'POST',
        body: credentials
      });
      if (result && typeof result === 'object' && 'error' in result) {
        // Fehler vom Backend, z.B. Invalid credentials
        setUser(null);
        throw result;
      }
      // Nach erfolgreichem Login User-Daten laden
      await checkAuthStatus();
    } catch (error) {
      setUser(null);
      throw error; // Fehler weiterwerfen für UI-Handling
    }
  };

  const loginWithGoogle = (authData: AuthData) => {
    if (authData.success && authData.user) {
      setUser(authData.user);
    } else {
      throw new Error(authData.message || authData.error || 'Google-Login fehlgeschlagen');
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/api/logout', { method: 'POST' });
    } catch (error) {
    } finally {
      // Immer User-State zurücksetzen
      setUser(null);
    }
  };

  // Auth-Status beim App-Start prüfen
  useEffect(() => {
    checkAuthStatus();
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoading,
      isSuperAdmin,
      isAdmin,
      login, 
      logout, 
      loginWithGoogle,
      checkAuthStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
