"use client";

import { createContext, useContext, type ReactNode } from "react";

const MapboxTokenContext = createContext("");

export function MapboxTokenProvider({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  return (
    <MapboxTokenContext.Provider value={token}>{children}</MapboxTokenContext.Provider>
  );
}

export function useMapboxAccessToken(): string {
  const fromServer = useContext(MapboxTokenContext).trim();
  if (fromServer) return fromServer;
  return process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || "";
}
