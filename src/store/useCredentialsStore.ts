import type { SharedCredentials } from "@/types/SharedCredentials";
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface State {
  credentials_id: string | null;
  credentials: SharedCredentials | null;
  credentials_name: string | null;
  cap_id: string | null;
}

interface Action {
  setCredentials: (credentials: SharedCredentials) => void;
  setCredentialsId: (id: string) => void;
  setCredentialsName: (name: string) => void;
  setCapId: (id: string) => void;
}

export const useCredentialsStore = create(
  devtools(
    persist<State & Action>(
      (set) => ({
        credentials_id: null,
        credentials: null,
        credentials_name: null,
        cap_id: null,
        setCredentials: (credentials: SharedCredentials) => {
          set((state) => ({ ...state, credentials: credentials }));
        },
        setCredentialsId: (id: string) => {
          set((state) => ({ ...state, credentials_id: id }));
        },
        setCredentialsName: (name: string) => {
          set((state) => ({ ...state, credentials_name: name }));
        },
        setCapId: (id: string) => {
          set((state) => ({ ...state, cap_id: id }));
        },
      }),
      {
        name: "credentials-storage",
      },
    ),
  ),
);
