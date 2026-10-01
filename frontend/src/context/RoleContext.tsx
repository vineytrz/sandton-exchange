import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type ActorRole = "trader" | "ops";

interface RoleContextValue {
  role: ActorRole;
  setRole: (role: ActorRole) => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<ActorRole>("trader");

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used within RoleProvider");
  }
  return ctx;
}
