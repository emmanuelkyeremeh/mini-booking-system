import { useMemo, useState } from "react";
import { apiFetch, clearToken, setToken } from "../api/apiClient.js";
import { decodeJwt } from "./decodeJwt.js";
import { AuthContext } from "./authContext.js";

const TOKEN_KEY = "mini_booking_token";

function readUserFromToken(token) {
  const payload = decodeJwt(token);
  if (!payload) return null;
  if (!payload.userId || !payload.role) return null;
  return { id: payload.userId, email: payload.email, role: payload.role };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? readUserFromToken(token) : null;
  });

  const isAuthenticated = Boolean(user);

  async function login({ email, password }) {
    clearToken();
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register({ email, password, role }) {
    clearToken();
    const data = await apiFetch("/api/auth/register", {
      method: "POST",
      body: { email, password, role },
    });
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      role: user?.role,
      isAuthenticated,
      login,
      register,
      logout,
    }),
    [user, isAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

