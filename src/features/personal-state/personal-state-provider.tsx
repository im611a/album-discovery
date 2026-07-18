"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { catalogAlbums } from "@/catalog/published-catalog";
import { createInitialUserState, parseLocalUserState, type LocalUserStateV1, type TasteProfile } from "./schema";

const STORAGE_KEY = "album-discovery:user-state:v1";
const ids = new Set(catalogAlbums.map((album) => album.id));
type AlbumListKey = "favoriteAlbumIds" | "savedAlbumIds" | "listenedAlbumIds" | "dismissedAlbumIds";

interface PersonalStateContextValue {
  state: LocalUserStateV1;
  hydrated: boolean;
  toggleAlbum: (key: AlbumListKey, albumId: string) => void;
  setFeedback: (albumId: string, value: "like" | "not_for_me" | null) => void;
  saveTaste: (taste: TasteProfile, completed?: boolean) => void;
  recordRecent: (albumId: string) => void;
  reset: () => void;
  exportJson: () => string;
  importJson: (value: string) => { ok: true } | { ok: false; message: string };
}

const PersonalStateContext = createContext<PersonalStateContextValue | null>(null);

export function PersonalStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(createInitialUserState);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? parseLocalUserState(JSON.parse(raw), ids) : null;
        if (parsed) setState(parsed);
        else if (raw) localStorage.removeItem(STORAGE_KEY);
      } catch { try { localStorage.removeItem(STORAGE_KEY); } catch {} }
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [hydrated, state]);

  const update = useCallback((recipe: (current: LocalUserStateV1) => LocalUserStateV1) => setState((current) => ({ ...recipe(current), updatedAt: new Date().toISOString() })), []);
  const toggleAlbum = useCallback((key: AlbumListKey, albumId: string) => update((current) => ({ ...current, [key]: current[key].includes(albumId) ? current[key].filter((id) => id !== albumId) : [...current[key], albumId] })), [update]);
  const setFeedback = useCallback((albumId: string, value: "like" | "not_for_me" | null) => update((current) => {
    const feedback = { ...current.recommendationFeedback };
    if (value) feedback[albumId] = value; else delete feedback[albumId];
    return {
      ...current,
      favoriteAlbumIds: value === "not_for_me" ? current.favoriteAlbumIds.filter((id) => id !== albumId) : current.favoriteAlbumIds,
      savedAlbumIds: value === "not_for_me" ? current.savedAlbumIds.filter((id) => id !== albumId) : current.savedAlbumIds,
      recommendationFeedback: feedback,
      dismissedAlbumIds: value === "not_for_me" ? [...new Set([...current.dismissedAlbumIds, albumId])] : current.dismissedAlbumIds.filter((id) => id !== albumId),
    };
  }), [update]);
  const saveTaste = useCallback((taste: TasteProfile, completed = true) => update((current) => ({ ...current, taste, onboardingCompleted: completed })), [update]);
  const recordRecent = useCallback((albumId: string) => update((current) => ({ ...current, recentAlbumIds: [albumId, ...current.recentAlbumIds.filter((id) => id !== albumId)].slice(0, 20) })), [update]);
  const reset = useCallback(() => setState({ ...createInitialUserState(), updatedAt: new Date().toISOString() }), []);
  const exportJson = useCallback(() => JSON.stringify(state, null, 2), [state]);
  const importJson = useCallback((value: string) => {
    if (new Blob([value]).size > 100_000) return { ok: false as const, message: "导入文件过大。" };
    try {
      const parsed = parseLocalUserState(JSON.parse(value), ids);
      if (!parsed) return { ok: false as const, message: "文件格式或版本不受支持。" };
      setState({ ...parsed, updatedAt: new Date().toISOString() });
      return { ok: true as const };
    } catch { return { ok: false as const, message: "无法解析 JSON 文件。" }; }
  }, []);
  const value = useMemo(() => ({ state, hydrated, toggleAlbum, setFeedback, saveTaste, recordRecent, reset, exportJson, importJson }), [state, hydrated, toggleAlbum, setFeedback, saveTaste, recordRecent, reset, exportJson, importJson]);
  return <PersonalStateContext.Provider value={value}>{children}</PersonalStateContext.Provider>;
}

export function usePersonalState() {
  const value = useContext(PersonalStateContext);
  if (!value) throw new Error("usePersonalState must be used inside PersonalStateProvider");
  return value;
}
