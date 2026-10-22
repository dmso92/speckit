import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type DevelopmentActorKind = "buyer" | "approver" | "fulfiller" | "supplier";
interface ActorContextValue {
  enabled: boolean;
  kind: DevelopmentActorKind;
  token: string | null;
  selectKind: (kind: DevelopmentActorKind) => void;
}

const developmentFixturesEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_FIXTURES === "true";
const ActorContext = createContext<ActorContextValue>({
  enabled: developmentFixturesEnabled,
  kind: "buyer",
  token: null,
  selectKind: () => undefined
});

export function ActorProvider({ children }: { children: ReactNode }) {
  const [kind, selectKind] = useState<DevelopmentActorKind>("buyer");
  const value = useMemo<ActorContextValue>(() => ({
    enabled: developmentFixturesEnabled,
    kind,
    token: developmentFixturesEnabled ? `dev-${kind}` : null,
    selectKind
  }), [kind]);
  return <ActorContext.Provider value={value}>{children}</ActorContext.Provider>;
}

export function useActor(): ActorContextValue {
  return useContext(ActorContext);
}
