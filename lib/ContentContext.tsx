import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import {
  getWeekFromPathway,
  listAvailablePathways,
  loadPathwayByVersionId,
  type LoadedPathway,
  type PathwayOption,
} from '@/lib/content';
import type { PathwayWeek } from '@/lib/types';

type ContentState = {
  loading: boolean;
  pathway: LoadedPathway | null;
  options: PathwayOption[];
  getWeek: (weekNumber: number) => PathwayWeek;
  refreshOptions: () => Promise<void>;
  reloadForHuddle: () => Promise<void>;
};

const ContentContext = createContext<ContentState | null>(null);

export function ContentProvider({ children }: { children: React.ReactNode }) {
  const { huddle } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pathway, setPathway] = useState<LoadedPathway | null>(null);
  const [options, setOptions] = useState<PathwayOption[]>([]);

  const refreshOptions = useCallback(async () => {
    const list = await listAvailablePathways();
    setOptions(list);
  }, []);

  const reloadForHuddle = useCallback(async () => {
    setLoading(true);
    try {
      const versionId = huddle?.pathway_version_id ?? null;
      const loaded = await loadPathwayByVersionId(versionId);
      setPathway(loaded);
    } finally {
      setLoading(false);
    }
  }, [huddle?.pathway_version_id]);

  useEffect(() => {
    refreshOptions();
  }, [refreshOptions]);

  useEffect(() => {
    reloadForHuddle();
  }, [reloadForHuddle]);

  const value = useMemo<ContentState>(
    () => ({
      loading,
      pathway,
      options,
      getWeek: (weekNumber: number) => {
        if (!pathway) throw new Error('Pathway not loaded');
        return getWeekFromPathway(pathway, weekNumber);
      },
      refreshOptions,
      reloadForHuddle,
    }),
    [loading, pathway, options, refreshOptions, reloadForHuddle]
  );

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContent() {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error('useContent must be used within ContentProvider');
  return ctx;
}
