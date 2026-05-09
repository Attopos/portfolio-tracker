import { createContext, useContext, useEffect, useState } from "react";
import {
  fetchCurrentUser,
  signInWithGoogleCredential,
  signOutFromSession,
} from "./authApi.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const nextUser = await fetchCurrentUser();
        if (!isMounted) {
          return;
        }
        setUser(nextUser);
        setAuthError("");
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setUser(null);
        setAuthError(error instanceof Error ? error.message : "Failed to restore session.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function refreshSession() {
    setIsLoading(true);
    try {
      const nextUser = await fetchCurrentUser();
      setUser(nextUser);
      setAuthError("");
      return nextUser;
    } catch (error) {
      setUser(null);
      setAuthError(error instanceof Error ? error.message : "Failed to restore session.");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function signIn(credential) {
    const nextUser = await signInWithGoogleCredential(credential);
    setUser(nextUser);
    setAuthError("");
    return nextUser;
  }

  async function signOut() {
    await signOutFromSession();
    setUser(null);
    setAuthError("");
    if (window.google && window.google.accounts && window.google.accounts.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  }

  return (
    <AuthContext.Provider
      value={{
        authError,
        isAuthenticated: Boolean(user && user.id),
        isLoading,
        refreshSession,
        signIn,
        signOut,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
