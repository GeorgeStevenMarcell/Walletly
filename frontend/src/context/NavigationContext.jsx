import { createContext, useContext, useState } from "react";

const NavigationContext = createContext(null);

export function NavigationProvider({ children }) {
  const [page, setPage] = useState("dashboard");
  return (
    <NavigationContext.Provider value={{ page, setPage }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useNavigation must be used within NavigationProvider");
  return ctx;
}
