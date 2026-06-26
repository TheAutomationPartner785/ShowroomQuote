import { useState, useEffect, useRef } from 'react';
import { LeadsEndCustomersBoard } from '@api/BoardSDK.js';
import { storage } from '@api/monday-storage';

const leadsBoard = new LeadsEndCustomersBoard();
const CACHE_KEY = 'leads_cache_v2';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// Group IDs verificados contra el board en producción:
// 'topics' (New Leads) y 'group_mm1msegm' (New Group)
const TARGET_GROUPS = ['topics', 'group_mm1msegm'];

/**
 * 3-Layer Loading Strategy for Leads:
 * 1. Fast Initial Load: Show cached data OR first 10 items (<1s)
 * 2. Background Lazy Load: Stream remaining items with pagination
 * 3. Cache: Store with 1-hour TTL, stale-while-revalidate pattern
 *
 * Filters by group instead of date, search happens client-side
 */
export const useLeadsWithCache = (searchQuery = '') => {
  const [leads, setLeads] = useState([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [totalLoaded, setTotalLoaded] = useState(0);

  const abortRef = useRef(false);
  const cursorRef = useRef(null);
  const allLoadedLeadsRef = useRef([]);

  useEffect(() => {
    loadWithCache();
    return () => {
      abortRef.current = true;
    };
  }, []);

  const loadWithCache = async () => {
    try {
      setIsLoadingInitial(true);
      setError(null);
      abortRef.current = false;

      // --- CACHÉ DE 1 HORA DESACTIVADA (comentada) por pedido ---
      // const cached = await getCache();
      // const isCacheValid = cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS;
      // if (isCacheValid) {
      //   allLoadedLeadsRef.current = cached.data;
      //   setLeads(filterLeads(cached.data, searchQuery));
      //   setTotalLoaded(cached.data.length);
      //   setIsLoadingInitial(false);
      //   return;
      // }
      await fetchFreshData({ silentRefresh: false });
    } catch (err) {
      console.error('[useLeadsWithCache] Load failed:', err);
      setError('Failed to load leads');
      setIsLoadingInitial(false);
    }
  };

  const fetchFreshData = async ({ silentRefresh = false }) => {
    try {
      if (!silentRefresh) setIsLoadingInitial(true);

      // Layer 1: Fast Initial Load (first 10 items total: 5 from each group)
      const priorityBatch = await fetchPriorityBatch();

      if (abortRef.current) return;

      // Deduplicate and set initial results
      const uniqueLeads = deduplicateLeads(priorityBatch);
      allLoadedLeadsRef.current = uniqueLeads;
      setLeads(filterLeads(uniqueLeads, searchQuery));
      setTotalLoaded(uniqueLeads.length);

      console.log(`[useLeadsWithCache] Priority batch: ${uniqueLeads.length} items`);

      setIsLoadingInitial(false);

      // Layer 2: Background Lazy Load
      setIsLoadingMore(true);
      await loadRemainingInBackground();

      // Update cache with full dataset
      await setCache(allLoadedLeadsRef.current);
    } catch (err) {
      console.error('[useLeadsWithCache] Fetch failed:', err);
      setError('Failed to load leads');
      setIsLoadingInitial(false);
      setIsLoadingMore(false);
    }
  };

  const fetchPriorityBatch = async () => {
    const columns = ['email', 'zipCode', 'referOutDealer', 'comments', 'quotedDate'];

    // Fetch 5 items from each target group
    const batches = await Promise.all(
      TARGET_GROUPS.map(async (groupId) => {
        try {
          const result = await leadsBoard.items()
            .withColumns(columns)
            .where({ group: [groupId] })
            .withPagination({ limit: 5 })
            .execute();
          return result.items || [];
        } catch (err) {
          console.error(`[useLeadsWithCache] Failed to fetch from group ${groupId}:`, err);
          return [];
        }
      })
    );

    return batches.flat();
  };

  const loadRemainingInBackground = async () => {
    let hasMore = true;
    let currentCursor = null;
    const maxItems = 500; // Safety cap

    // Fetch from all target groups with pagination
    for (const groupId of TARGET_GROUPS) {
      currentCursor = null;
      hasMore = true;

      while (hasMore && allLoadedLeadsRef.current.length < maxItems && !abortRef.current) {
        try {
          const columns = ['email', 'zipCode', 'referOutDealer', 'comments', 'quotedDate'];

          const result = await leadsBoard.items()
            .withColumns(columns)
            .where({ group: [groupId] })
            .withPagination(currentCursor ? { cursor: currentCursor } : { limit: 20 })
            .execute();

          const newItems = result.items || [];

          if (newItems.length === 0 || !result.cursor) {
            hasMore = false;
            break;
          }

          currentCursor = result.cursor;

          // Skip items we already have from priority batch
          const filtered = newItems.filter(item =>
            !allLoadedLeadsRef.current.some(existing => existing.id === item.id)
          );

          if (filtered.length > 0) {
            // Append and deduplicate
            const combined = [...allLoadedLeadsRef.current, ...filtered];
            const unique = deduplicateLeads(combined);
            allLoadedLeadsRef.current = unique;
            setLeads(filterLeads(unique, searchQuery));
            setTotalLoaded(unique.length);
            console.log(`[useLeadsWithCache] Background batch from ${groupId}: ${unique.length} total`);
          }

          // Small delay to avoid overwhelming the UI
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error(`[useLeadsWithCache] Background fetch error for group ${groupId}:`, err);
          hasMore = false;
        }
      }
    }

    setIsLoadingMore(false);
    console.log(`[useLeadsWithCache] Background load complete: ${allLoadedLeadsRef.current.length} items`);
  };

  const deduplicateLeads = (items) => {
    const map = new Map();
    items.forEach(item => {
      if (item?.id) map.set(item.id, item);
    });
    return Array.from(map.values());
  };

  const filterLeads = (items, query) => {
    if (!query || query.trim() === '') return items;

    const q = query.toLowerCase();
    return items.filter(lead =>
      lead.name?.toLowerCase().includes(q) ||
      lead.email?.email?.toLowerCase().includes(q) ||
      lead.zipCode?.toLowerCase().includes(q)
    );
  };

  const getCache = async () => {
    try {
      const { value } = await storage().key(CACHE_KEY).get();
      return value;
    } catch (err) {
      console.error('[useLeadsWithCache] Cache read failed:', err);
      return null;
    }
  };

  const setCache = async (data) => {
    try {
      const { version } = await storage().key(CACHE_KEY).get();
      await storage().key(CACHE_KEY).version(version).set({
        data,
        timestamp: Date.now(),
        ttl: CACHE_TTL_MS
      });
      console.log(`[useLeadsWithCache] Cached ${data.length} items`);
    } catch (err) {
      console.error('[useLeadsWithCache] Cache write failed:', err);
    }
  };

  const refresh = async () => {
    console.log('[useLeadsWithCache] Manual refresh triggered');
    allLoadedLeadsRef.current = [];
    await invalidateCache();
    await loadWithCache();
  };

  const invalidateCache = async () => {
    try {
      await storage().key(CACHE_KEY).del();
      console.log('[useLeadsWithCache] Cache invalidated');
    } catch (err) {
      console.error('[useLeadsWithCache] Cache invalidation failed:', err);
    }
  };

  // Optimistic update helper for create operations
  const optimisticAdd = (newLead) => {
    allLoadedLeadsRef.current = [newLead, ...allLoadedLeadsRef.current];
    setLeads(filterLeads(allLoadedLeadsRef.current, searchQuery));
    setTotalLoaded(allLoadedLeadsRef.current.length);
    // Invalidate cache to trigger fresh fetch on next mount
    invalidateCache();
  };

  // Update filtered leads when search query changes
  useEffect(() => {
    if (allLoadedLeadsRef.current.length > 0) {
      setLeads(filterLeads(allLoadedLeadsRef.current, searchQuery));
    }
  }, [searchQuery]);

  return {
    leads,
    isLoadingInitial,
    isLoadingMore,
    error,
    refresh,
    optimisticAdd,
    totalLoaded
  };
};
