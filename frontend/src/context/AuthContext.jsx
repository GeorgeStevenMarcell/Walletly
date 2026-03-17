import { createContext, useContext, useState, useCallback } from "react";
import { api, storage } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(() => {
    const t = storage.getToken();
    return t ? JSON.parse(localStorage.getItem("walletly_user") || "null") : null;
  });

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password);
    storage.setToken(res.token);
    localStorage.setItem("walletly_user", JSON.stringify(res.user));
    setAuthUser(res.user);
  }, []);

  const register = useCallback(async (username, password, displayName) => {
    const res = await api.register(username, password, displayName);
    storage.setToken(res.token);
    localStorage.setItem("walletly_user", JSON.stringify(res.user));
    setAuthUser(res.user);
  }, []);

  const signOut = useCallback(() => {
    storage.clearToken();
    localStorage.removeItem("walletly_user");
    setAuthUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ authUser, login, register, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
