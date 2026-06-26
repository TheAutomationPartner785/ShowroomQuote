import { useState, useEffect, useMemo } from 'react';
import { LeadsEndCustomersBoard } from '@api/BoardSDK.js';
import { storage } from '@api/monday-storage';

const leadsBoard = new LeadsEndCustomersBoard();
const CACHE_KEY = 'leads_cache_v1';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const simpleFetch = async (operation, operationName) => {
  try {
    return await operation();
  } catch (err) {
    console.log(`[${operationName}] attempt 1 failed, retrying in 1.5s...`, err.message);
    await sleep(1500);
    return await operation();
  }
};

export const useLeads = (searchQuery = '', dateFilter = '') => {
  const [allLeads, setAllLeads] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const pageSize = 50;

  // Client-side filters (Search: Name, Email, Zip Code; Date: Showroom Visit Date)
  const filteredLeads = useMemo(() => {
    let results = allLeads;

    // Apply search filter
    if (searchQuery && searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      results = results.filter(lead => {
        const nameMatch = lead.name?.toLowerCase().includes(q);
        const emailMatch = lead.email?.email?.toLowerCase().includes(q);
        const zipMatch = lead.zipCode?.toLowerCase().includes(q);
        return nameMatch || emailMatch || zipMatch;
      });
    }

    // Apply date filter
    if (dateFilter) {
      results = results.filter(lead => {
        if (!lead.showroomVisitDate) return false;
        const leadDate = new Date(lead.showroomVisitDate).toISOString().split('T')[0];
        return leadDate === dateFilter;
      });
    }

    return results;
  }, [allLeads, searchQuery, dateFilter]);

  // Paginated view of filtered results
  const leads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredLeads.length / pageSize);

  // Auto-reset page when search shrinks results
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // Helper: Read cache
  const getCache = async () => {
    try {
      const { value } = await storage().key(CACHE_KEY).get();
      return value;
    } catch (err) {
      console.error('[useLeads] Cache read failed:', err);
      return null;
    }
  };

  // Helper: Write cache
  const saveCache = async (data) => {
    try {
      const { version } = await storage().key(CACHE_KEY).get();
      await storage().key(CACHE_KEY).version(version).set({
        data,
        timestamp: Date.now()
      });
      console.log(`[useLeads] Cached ${data.length} items`);
    } catch (err) {
      console.error('[useLeads] Cache write failed:', err);
    }
  };

  // Helper: Deduplicate and sort
  const dedupeAndSort = (items) => {
    const uniqueMap = new Map(items.map(item => [item.id, item]));
    const unique = Array.from(uniqueMap.values());

    return unique.sort((a, b) => {
      if (!a.quotedDate) return 1;
      if (!b.quotedDate) return -1;
      return new Date(a.quotedDate) - new Date(b.quotedDate);
    });
  };

  useEffect(() => {
    let isFirstFetchPage = true;

    const init = async () => {
      try {
        setError(null);

        // --- CACHÉ DE 1 HORA DESACTIVADA (comentada) por pedido ---
        // Para reactivarla, descomentar:
        // const cached = await getCache();
        // const isCacheValid = cached?.data && (Date.now() - cached.timestamp < CACHE_TTL_MS);
        // if (isCacheValid) {
        //   setAllLeads(cached.data);
        //   setCurrentPage(1);
        //   setLoading(false);
        //   return;
        // }

        // Traemos fresco SIEMPRE, pintando progresivamente página por página.
        setIsLoadingMore(true);
        const columns = ['email', 'zipCode', 'referOutDealer', 'comments', 'quotedDate', 'showroomVisitDate'];

        let accumulated = [];
        let cursor = null;
        const maxItems = 500;

        console.log('[useLeads] Fetching fresh data with leadStatus filter');

        do {
          const result = await simpleFetch(
            async () => {
              return await leadsBoard.items()
                .withColumns(columns)
                .where({ leadStatus: ["New Lead / Needs review", "Appointment Booked"] })
                .withPagination(cursor ? { cursor } : { limit: 50 })
                .execute();
            },
            'useLeads background fetch'
          );

          const pageItems = result.items || [];
          accumulated = accumulated.concat(pageItems);

          // PROGRESSIVE PAINT: Update UI after each page
          const sorted = dedupeAndSort(accumulated);
          setAllLeads(sorted);

          // Turn off loading spinner after first page arrives
          if (isFirstFetchPage) {
            console.log(`[useLeads] First page arrived: ${sorted.length} items`);
            setLoading(false);
            isFirstFetchPage = false;
          }

          cursor = result.cursor;
          console.log(`[useLeads] Page fetched: ${pageItems.length} items, total: ${sorted.length}, cursor: ${cursor ? 'has next' : 'null'}`);

          // Safety cap
          if (accumulated.length >= maxItems) {
            console.log(`[useLeads] Reached max items cap (${maxItems}), stopping`);
            break;
          }
        } while (cursor);

        // Save final result to cache
        const final = dedupeAndSort(accumulated);
        // await saveCache(final); // caché desactivada (comentada)
        setIsLoadingMore(false);
        console.log(`[useLeads] Background load complete: ${final.length} items`);
      } catch (err) {
        console.error('[useLeads] Load failed:', err);
        setError('Failed to load leads. Please try again.');
        setLoading(false);
        setIsLoadingMore(false);
      }
    };

    init();
  }, []);

  const retry = async () => {
    setLoading(true);
    setError(null);
    let isFirstPage = true;

    try {
      setIsLoadingMore(true);
      const columns = ['email', 'zipCode', 'referOutDealer', 'comments', 'quotedDate', 'showroomVisitDate'];

      let accumulated = [];
      let cursor = null;
      const maxItems = 500;

      do {
        const result = await simpleFetch(
          async () => {
            return await leadsBoard.items()
              .withColumns(columns)
              .where({ leadStatus: ["New Lead / Needs review", "Appointment Booked"] })
              .withPagination(cursor ? { cursor } : { limit: 50 })
              .execute();
          },
          'useLeads retry'
        );

        const pageItems = result.items || [];
        accumulated = accumulated.concat(pageItems);

        const sorted = dedupeAndSort(accumulated);
        setAllLeads(sorted);

        if (isFirstPage) {
          setLoading(false);
          isFirstPage = false;
        }

        cursor = result.cursor;

        if (accumulated.length >= maxItems) break;
      } while (cursor);

      const final = dedupeAndSort(accumulated);
      await saveCache(final);
      setCurrentPage(1);
      setError(null);
      setIsLoadingMore(false);
    } catch (err) {
      console.error('[useLeads] Retry failed:', err);
      setError('Failed to load leads. Please try again.');
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const nextPage = () => goToPage(currentPage + 1);
  const prevPage = () => goToPage(currentPage - 1);

  return {
    leads,
    allLeadsCount: filteredLeads.length,
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    loading,
    isLoadingMore,
    error,
    retry
  };
};
