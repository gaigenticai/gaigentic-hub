import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { AuthState, User, SignupPayload, LoginPayload } from "../types";
import {
  signup as apiSignup,
  login as apiLogin,
  refreshSession,
  getSessionToken,
  setSessionToken,
  clearSessionToken,
} from "../services/api";

interface AuthContextType {
  auth: AuthState;
  signup: (payload: SignupPayload) => Promise<{ user: User; chaosbird_username: string }>;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

const USER_KEY = "gaigentic-user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        return { status: "authenticated", user: JSON.parse(stored) };
      } catch {
        return { status: "unauthenticated", user: null };
      }
    }
    return { status: "unauthenticated", user: null };
  });

  // Refresh session on mount if we have a token
  useEffect(() => {
    if (auth.status === "authenticated" && getSessionToken()) {
      refreshSession().catch(() => {
        // Token expired beyond refresh window
        setAuth({ status: "unauthenticated", user: null });
        localStorage.removeItem(USER_KEY);
        clearSessionToken();
      });
    }
  }, []);

  const signup = useCallback(async (payload: SignupPayload) => {
    const result = await apiSignup(payload);
    setSessionToken(result.session_token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setAuth({ status: "authenticated", user: result.user });
    return { user: result.user, chaosbird_username: result.chaosbird_username };
  }, []);

  const login = useCallback(async (payload: LoginPayload) => {
    const result = await apiLogin(payload);
    setSessionToken(result.session_token);
    if (result.admin_token) {
      localStorage.setItem("gaigentic-admin-token", result.admin_token);
    }
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setAuth({ status: "authenticated", user: result.user });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem("gaigentic-admin-token");
    clearSessionToken();
    setAuth({ status: "unauthenticated", user: null });
  }, []);

  return (
    <AuthContext.Provider value={{ auth, signup, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
