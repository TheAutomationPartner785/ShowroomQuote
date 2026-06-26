import { useState, useEffect, useRef, useMemo } from 'react';
import { ProductCatalogBoard } from '@api/BoardSDK.js';
import { storage } from '@api/monday-storage';

const productsBoard = new ProductCatalogBoard();
const CACHE_KEY = 'products_cache_v2';  // Bumped to invalidate old cache with discontinued items
const CACHE_TTL_MS = 60 * 60 * 1000;    // 1 hour

/**
 * Enhanced useProducts with:
 * - 1-hour cache (stale-while-revalidate). Dentro de la hora sirve del caché sin
 *   refetchear (ahorra requests); pasada la hora, sirve stale y revalida.
 * - Dynamic filter metadata from column settings
 * - Client-side filtering by brand/type/family/category
 */
export const useProducts = () => {
  const [allProducts, setAllProducts] = useState([]);
  const [filterMetadata, setFilterMetadata] = useState({
    brand: [],
    productType: [],
    productFamily: [],
    productCategory: []
  });
  const [activeFilters, setActiveFilters] = useState({
    brand: [],
    productType: [],
    productFamily: [],
    productCategory: []
  });

  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingAll, setIsLoadingAll] = useState(true);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState(null);

  const abortRef = useRef(false);

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
      // Para reactivarla, descomentar este bloque:
      // const cached = await getCache();
      // if (cached?.products && cached.products.length > 0) {
      //   const age = cached.lastSync ? Date.now() - cached.lastSync : Infinity;
      //   setAllProducts(cached.products);
      //   setFilterMetadata(cached.filterMetadata || {});
      //   setIsLoadingInitial(false);
      //   setIsLoadingAll(false);
      //   if (age < CACHE_TTL_MS) { return; }            // fresco < 1h: no refetch
      //   setIsRevalidating(true);
      //   fetchFreshData({ silentRefresh: true });
      //   return;
      // }

      // Siempre traemos fresco, pintando progresivamente.
      await fetchFreshData({ silentRefresh: false });
    } catch (err) {
      console.error('[useProducts] Load failed:', err);
      setError('Failed to load products');
      setIsLoadingInitial(false);
      setIsLoadingAll(false);
    }
  };

  const fetchFreshData = async ({ silentRefresh = false }) => {
    try {
      if (!silentRefresh) {
        setIsLoadingInitial(true);
        setIsLoadingAll(true);
      }

      // Fetch all products with filter columns - INCLUDE 'status' to filter discontinued items
      const columns = ['status', 'msrpCa', 'brand', 'productType', 'productFamily', 'productCategory', 'friendlyDescription', 'productDescription'];
      let allItems = [];
      let cursor = null;
      let firstPage = true;
      const maxItems = 2000;

      console.log('[useProducts] Fetching products (progressive paint)...');

      do {
        const result = await productsBoard.items()
          .withColumns(columns)
          .withPagination(cursor ? { cursor } : { limit: 100 })
          .execute();

        const pageItems = (result.items || []).map(item => ({
          id: item.id,
          name: item.name || 'Unnamed Product',
          msrp: typeof item.msrpCa === 'number' ? item.msrpCa : null,
          brand: item.brand || null,
          productType: item.productType || null,
          productFamily: item.productFamily || null,
          productCategory: item.productCategory || null,
          friendlyDescription: item.friendlyDescription || null,
          productDescription: item.productDescription || null,
          status: item.status || null
        }));

        // CRITICAL: Exclude discontinued products at fetch level
        const activeProducts = pageItems.filter(p => p.status !== 'Discontinued');
        allItems = allItems.concat(activeProducts);
        cursor = result.cursor;

        // PROGRESSIVE PAINT: mostramos lo que va llegando en cada página
        const products = Array.from(new Map(allItems.map(p => [p.id, p])).values());
        setAllProducts(products);
        setFilterMetadata(extractFilterMetadata(products));

        if (firstPage) {
          // Apenas llega la 1ª página: catálogo + filtros + búsqueda usables.
          // Seguimos cargando el resto por detrás (indicador "Syncing...").
          setIsLoadingInitial(false);
          setIsLoadingAll(false);
          setIsRevalidating(true);
          firstPage = false;
          console.log(`[useProducts] First page painted: ${products.length} products (loading more in background)`);
        }

        if (allItems.length >= maxItems) {
          console.warn('[useProducts] Reached max items cap (2000)');
          break;
        }
      } while (cursor && !abortRef.current);

      if (abortRef.current) return;

      const finalCount = new Map(allItems.map(p => [p.id, p])).size;
      console.log(`[useProducts] Full load complete: ${finalCount} products`);
      setIsLoadingInitial(false);
      setIsLoadingAll(false);
      setIsRevalidating(false);

      // --- CACHÉ DESACTIVADA (comentada) por pedido ---
      // const finalProducts = Array.from(new Map(allItems.map(p => [p.id, p])).values());
      // await setCache({ products: finalProducts, filterMetadata: extractFilterMetadata(finalProducts), lastSync: Date.now() });
    } catch (err) {
      console.error('[useProducts] Fetch failed:', err);
      setError('Failed to load products');
      setIsLoadingInitial(false);
      setIsLoadingAll(false);
      setIsRevalidating(false);
    }
  };

  const extractFilterMetadata = (products) => {
    // Build filter options from Monday column schema (not product values)
    // This ensures all possible labels appear even if no products use them yet

    // Brand filter
    const brandOptions = [
      { label: 'SUB-ZERO', index: 0, color: '#579bfc' },
      { label: 'COVE', index: 1, color: '#9cd326' },
      { label: 'WOLF', index: 2, color: '#df2f4a' },
      { label: 'BEST', index: 3, color: '#757575' },
      { label: 'Sub-Zero', index: 4, color: '#9d50dd' }
    ];

    // Product Type filter
    const typeOptions = [
      { label: 'ACCESSORIES', index: 0, color: '#ffcb00' },
      { label: 'PARTS', index: 1, color: '#7e3b8a' },
      { label: 'SERVICES', index: 2, color: '#74afcc' },
      { label: 'FINISHED GOODS', index: 3, color: '#9d50dd' }
    ];

    // Product Family filter
    const familyOptions = [
      { label: 'CLASSIC SERIES', index: 0, color: '#fdab3d' },
      { label: 'CLASSIC WINE', index: 1, color: '#00c875' },
      { label: 'DESIGNER SERIES', index: 2, color: '#df2f4a' },
      { label: 'SUB-ZERO ACCESSORIES', index: 3, color: '#007eb5' },
      { label: 'UNDERCOUNTER UNITS', index: 4, color: '#9d50dd' },
      { label: 'DESIGNER DRAWERS', index: 5, color: '#037f4c' },
      { label: 'DESIGNER WINE', index: 6, color: '#579bfc' },
      { label: 'PRO REFRIGERATION', index: 7, color: '#cab641' },
      { label: 'MICROWAVE OVENS', index: 8, color: '#ffcb00' },
      { label: 'BEST HOODS', index: 9, color: '#333333' },
      { label: 'BEST ACCESSORIES', index: 10, color: '#bb3354' },
      { label: 'DISHWASHER', index: 11, color: '#ff007f' },
      { label: 'RANGE - DUAL FUEL', index: 12, color: '#ff5ac4' },
      { label: 'CONVENTIONAL STEAM OVEN', index: 13, color: '#784bd1' },
      { label: 'COOKTOPS', index: 14, color: '#9cd326' },
      { label: 'COVE ACCESSORIES', index: 15, color: '#66ccff' },
      { label: 'WOLF ACCESSORIES', index: 16, color: '#757575' },
      { label: 'HOOD AND DOWNDRAFTS', index: 17, color: '#7f5347' },
      { label: 'WALL OVENS', index: 18, color: '#ff6d3b' },
      { label: 'RANGE - GAS', index: 19, color: '#ff7575' },
      { label: 'SEALED RANGETOPS', index: 20, color: '#faa1f1' },
      { label: 'WARMING/VACUUM SEAL DRAWER', index: 21, color: '#ffadad' },
      { label: 'RANGE - INDUCTION', index: 22, color: '#7e3b8a' },
      { label: 'OUTDOOR GRILLS', index: 23, color: '#9aadbd' },
      { label: 'COFFEE SYSTEM', index: 24, color: '#74afcc' }
    ];

    // Product Category (text column) - extract from actual product values
    const categorySet = new Set();
    products.forEach(p => {
      if (p.productCategory) categorySet.add(p.productCategory);
    });

    return {
      brand: brandOptions,
      productType: typeOptions,
      productFamily: familyOptions,
      productCategory: Array.from(categorySet).sort()
    };
  };

  const getCache = async () => {
    try {
      const { value } = await storage().key(CACHE_KEY).get();
      return value;
    } catch (err) {
      console.error('[useProducts] Cache read failed:', err);
      return null;
    }
  };

  const setCache = async (data) => {
    try {
      const { version } = await storage().key(CACHE_KEY).get();
      await storage().key(CACHE_KEY).version(version).set(data);
      console.log(`[useProducts] Cached ${data.products.length} products`);
    } catch (err) {
      console.error('[useProducts] Cache write failed:', err);
    }
  };

  const refresh = async () => {
    console.log('[useProducts] Manual refresh triggered');
    await storage().key(CACHE_KEY).del();
    setIsRevalidating(true);
    await fetchFreshData({ silentRefresh: false });
  };

  const setFilter = (group, values) => {
    setActiveFilters(prev => ({
      ...prev,
      [group]: values
    }));
  };

  const clearAllFilters = () => {
    setActiveFilters({
      brand: [],
      productType: [],
      productFamily: [],
      productCategory: []
    });
  };

  // Client-side filtering
  const filteredProducts = useMemo(() => {
    let result = allProducts;

    // Filter by Brand (OR within group)
    if (activeFilters.brand.length > 0) {
      result = result.filter(p => activeFilters.brand.includes(p.brand));
    }

    // Filter by Product Type (OR within group)
    if (activeFilters.productType.length > 0) {
      result = result.filter(p => activeFilters.productType.includes(p.productType));
    }

    // Filter by Product Family (OR within group)
    if (activeFilters.productFamily.length > 0) {
      result = result.filter(p => activeFilters.productFamily.includes(p.productFamily));
    }

    // Filter by Product Category (OR within group)
    if (activeFilters.productCategory.length > 0) {
      result = result.filter(p => activeFilters.productCategory.includes(p.productCategory));
    }

    return result;
  }, [allProducts, activeFilters]);

  const activeFilterCount = useMemo(() => {
    return Object.values(activeFilters).reduce((sum, arr) => sum + arr.length, 0);
  }, [activeFilters]);

  return {
    products: filteredProducts,
    allProducts,
    filterMetadata,
    activeFilters,
    setFilter,
    clearAllFilters,
    activeFilterCount,
    isLoadingInitial,
    isLoadingAll,
    isRevalidating,
    error,
    refresh
  };
};
