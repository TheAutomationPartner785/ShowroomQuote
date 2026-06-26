import { useState, useMemo } from 'react';
import { Box, Grid, VStack, HStack, Text, Button, Input, IconButton, Spinner, Center, Badge, Tooltip, Portal, Menu, createListCollection, Select } from '@chakra-ui/react';
import { Search, ChevronLeft, ChevronRight, X, Filter, RotateCcw, Minus, Plus } from 'lucide-react';

// Color mapping from schema for filter chips
const BRAND_COLORS = {
  'SUB-ZERO': '#579bfc',
  'COVE': '#9cd326',
  'WOLF': '#df2f4a',
  'BEST': '#757575',
  'Sub-Zero': '#9d50dd'
};

const TYPE_COLORS = {
  'ACCESSORIES': '#ffcb00',
  'PARTS': '#7e3b8a',
  'SERVICES': '#74afcc',
  'FINISHED GOODS': '#9d50dd'
};

const ProductCatalogTable = ({
  products,
  allProducts,
  filterMetadata,
  activeFilters,
  setFilter,
  clearAllFilters,
  activeFilterCount,
  cart,
  onAddProduct,
  isLoadingInitial,
  isLoadingAll,
  isRevalidating,
  error,
  onRetry
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [quantities, setQuantities] = useState({});
  const pageSize = 5;

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(p => {
      const nameMatch = p.name?.toLowerCase().includes(q);
      const friendlyDescMatch = p.friendlyDescription?.toLowerCase().includes(q);
      const prodDescMatch = p.productDescription?.toLowerCase().includes(q);
      const brandMatch = p.brand?.toLowerCase().includes(q);
      return nameMatch || friendlyDescMatch || prodDescMatch || brandMatch;
    });
  }, [products, searchQuery]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const currentProducts = filteredProducts.slice(startIdx, startIdx + pageSize);

  const isInCart = (productId) => cart.some(item => item.productId === productId);

  const formatPrice = (price) => {
    if (price === null || price === undefined) return '—';
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const handleSearch = (value) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const getQty = (productId) => quantities[productId] || 1;

  const updateQty = (productId, newQty) => {
    if (newQty >= 1 && newQty <= 99) {
      setQuantities(prev => ({ ...prev, [productId]: newQty }));
    }
  };

  const handleAddProduct = (product) => {
    const qty = getQty(product.id);
    onAddProduct({ ...product, qty });
    // Reset qty to 1 after adding
    setQuantities(prev => ({ ...prev, [product.id]: 1 }));
  };

  const toggleFilter = (group, value) => {
    const current = activeFilters[group] || [];
    const newValues = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    setFilter(group, newValues);
    setCurrentPage(1);
  };

  const handleCategorySelect = (value) => {
    const current = activeFilters.productCategory || [];
    if (!current.includes(value)) {
      setFilter('productCategory', [...current, value]);
      setCurrentPage(1);
    }
  };

  const removeCategoryFilter = (value) => {
    const current = activeFilters.productCategory || [];
    setFilter('productCategory', current.filter(v => v !== value));
    setCurrentPage(1);
  };

  const filtersDisabled = isLoadingAll;

  if (isLoadingInitial && allProducts.length === 0) {
    return <Center py="64px"><VStack gap="16px"><Spinner size="lg" color="var(--color-primary)" /><Text color="var(--color-text-secondary)">Loading catalog...</Text></VStack></Center>;
  }

  const hasSearchQuery = searchQuery.trim() !== '';
  const showEmptyState = hasSearchQuery && filteredProducts.length === 0;

  // Product Family dropdown if >10 options
  const showFamilyDropdown = filterMetadata.productFamily.length > 10;
  const familyCollection = createListCollection({
    items: filterMetadata.productFamily.map(f => ({ label: f.label, value: f.label })),
    itemToString: (i) => i.label,
    itemToValue: (i) => i.value
  });

  const categoryCollection = createListCollection({
    items: filterMetadata.productCategory.map(c => ({ label: c, value: c })),
    itemToString: (i) => i.label,
    itemToValue: (i) => i.value
  });

  return (
    <VStack align="stretch" gap="16px">
      {/* Filter Bar */}
      <Box p="16px" bg="white" border="1px solid var(--color-border)" borderRadius="var(--radius-lg)">
        <VStack align="stretch" gap="12px">
          <HStack justify="space-between">
            <HStack gap="2">
              <Filter size={16} color="var(--color-text-secondary)" />
              <Text fontSize="14px" fontWeight="600" color="var(--color-text-primary)">Filters</Text>
              {activeFilterCount > 0 && (
                <Badge bg="var(--color-primary)" color="white" px="2" py="0.5" rounded="full" fontSize="xs" fontWeight="700">
                  {activeFilterCount}
                </Badge>
              )}
              {isRevalidating && (
                <HStack gap="2">
                  <Spinner size="xs" color="var(--color-primary)" />
                  <Text fontSize="xs" color="var(--color-text-muted)">Syncing...</Text>
                </HStack>
              )}
            </HStack>
            {activeFilterCount > 0 && (
              <Button size="sm" variant="ghost" onClick={clearAllFilters} color="var(--color-text-secondary)">
                <RotateCcw size={14} />
                Clear all
              </Button>
            )}
          </HStack>

          {/* Brand Chips */}
          <VStack align="start" gap="8px">
            <Text fontSize="12px" fontWeight="600" color="var(--color-text-secondary)" textTransform="uppercase">Brand</Text>
            <Tooltip.Root disabled={!filtersDisabled}>
              <Tooltip.Trigger asChild>
                <HStack gap="2" flexWrap="wrap" opacity={filtersDisabled ? 0.5 : 1} cursor={filtersDisabled ? 'not-allowed' : 'default'}>
                  {filterMetadata.brand.map(({ label }) => {
                    const isActive = activeFilters.brand.includes(label);
                    const color = BRAND_COLORS[label] || '#999';
                    return (
                      <Button
                        key={label}
                        size="sm"
                        rounded="full"
                        fontSize="13px"
                        fontWeight="600"
                        disabled={filtersDisabled}
                        onClick={() => toggleFilter('brand', label)}
                        bg={isActive ? color : 'white'}
                        color={isActive ? 'white' : color}
                        border={`2px solid ${color}`}
                        _hover={!filtersDisabled && !isActive ? { bg: `${color}20` } : {}}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </HStack>
              </Tooltip.Trigger>
              <Portal>
                <Tooltip.Positioner>
                  <Tooltip.Content bg="gray.900" color="white" fontSize="xs" px="3" py="1.5" rounded="md">
                    Loading catalog... filters will unlock when ready ({allProducts.length} products loaded)
                  </Tooltip.Content>
                </Tooltip.Positioner>
              </Portal>
            </Tooltip.Root>
          </VStack>

          {/* Product Type Chips */}
          <VStack align="start" gap="8px">
            <Text fontSize="12px" fontWeight="600" color="var(--color-text-secondary)" textTransform="uppercase">Product Type</Text>
            <Tooltip.Root disabled={!filtersDisabled}>
              <Tooltip.Trigger asChild>
                <HStack gap="2" flexWrap="wrap" opacity={filtersDisabled ? 0.5 : 1} cursor={filtersDisabled ? 'not-allowed' : 'default'}>
                  {filterMetadata.productType.map(({ label }) => {
                    const isActive = activeFilters.productType.includes(label);
                    const color = TYPE_COLORS[label] || '#999';
                    return (
                      <Button
                        key={label}
                        size="sm"
                        rounded="full"
                        fontSize="13px"
                        fontWeight="600"
                        disabled={filtersDisabled}
                        onClick={() => toggleFilter('productType', label)}
                        bg={isActive ? color : 'white'}
                        color={isActive ? 'white' : color}
                        border={`2px solid ${color}`}
                        _hover={!filtersDisabled && !isActive ? { bg: `${color}20` } : {}}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </HStack>
              </Tooltip.Trigger>
              <Portal>
                <Tooltip.Positioner>
                  <Tooltip.Content bg="gray.900" color="white" fontSize="xs" px="3" py="1.5" rounded="md">
                    Loading catalog... filters will unlock when ready ({allProducts.length} products loaded)
                  </Tooltip.Content>
                </Tooltip.Positioner>
              </Portal>
            </Tooltip.Root>
          </VStack>

          {/* Product Family - Chips or Dropdown */}
          <VStack align="start" gap="8px">
            <Text fontSize="12px" fontWeight="600" color="var(--color-text-secondary)" textTransform="uppercase">Product Family</Text>
            {showFamilyDropdown ? (
              <Select.Root
                collection={familyCollection}
                size="sm"
                multiple
                value={activeFilters.productFamily || []}
                onValueChange={(d) => setFilter('productFamily', d.value)}
                disabled={filtersDisabled}
              >
                <Select.HiddenSelect />
                <Select.Control>
                  <Select.Trigger bg="white" border="1px solid" borderColor="gray.200" rounded="xl" h="10" opacity={filtersDisabled ? 0.5 : 1}>
                    <Text fontSize="sm">
                      {activeFilters.productFamily.length > 0
                        ? `Product Family (${activeFilters.productFamily.length} selected)`
                        : 'Select Product Family...'}
                    </Text>
                  </Select.Trigger>
                  <Select.IndicatorGroup><Select.Indicator /></Select.IndicatorGroup>
                </Select.Control>
                <Portal>
                  <Select.Positioner>
                    <Select.Content bg="white" border="1px solid" borderColor="gray.200" rounded="xl" boxShadow="lg" maxH="300px" overflowY="auto">
                      {familyCollection.items.map((f) => (
                        <Select.Item item={f} key={f.value} rounded="lg">
                          {f.label}
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Portal>
              </Select.Root>
            ) : (
              <Tooltip.Root disabled={!filtersDisabled}>
                <Tooltip.Trigger asChild>
                  <HStack gap="2" flexWrap="wrap" opacity={filtersDisabled ? 0.5 : 1} cursor={filtersDisabled ? 'not-allowed' : 'default'}>
                    {filterMetadata.productFamily.map(({ label }) => {
                      const isActive = activeFilters.productFamily.includes(label);
                      return (
                        <Button
                          key={label}
                          size="sm"
                          rounded="full"
                          fontSize="13px"
                          fontWeight="600"
                          disabled={filtersDisabled}
                          onClick={() => toggleFilter('productFamily', label)}
                          variant={isActive ? 'solid' : 'outline'}
                          colorPalette={isActive ? 'blue' : 'gray'}
                          borderColor={isActive ? undefined : 'var(--color-border)'}
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </HStack>
                </Tooltip.Trigger>
                <Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Content bg="gray.900" color="white" fontSize="xs" px="3" py="1.5" rounded="md">
                      Loading catalog... filters will unlock when ready ({allProducts.length} products loaded)
                    </Tooltip.Content>
                  </Tooltip.Positioner>
                </Portal>
              </Tooltip.Root>
            )}
          </VStack>

          {/* Product Category - Autocomplete */}
          <VStack align="start" gap="8px">
            <Text fontSize="12px" fontWeight="600" color="var(--color-text-secondary)" textTransform="uppercase">Product Category</Text>
            {activeFilters.productCategory.length > 0 && (
              <HStack gap="2" flexWrap="wrap">
                {activeFilters.productCategory.map(cat => (
                  <Badge
                    key={cat}
                    bg="var(--color-primary)"
                    color="white"
                    px="3"
                    py="1"
                    rounded="full"
                    fontSize="xs"
                    fontWeight="600"
                    cursor="pointer"
                    onClick={() => removeCategoryFilter(cat)}
                  >
                    {cat}
                    <X size={12} style={{ marginLeft: '4px', display: 'inline' }} />
                  </Badge>
                ))}
              </HStack>
            )}
            <Select.Root
              collection={categoryCollection}
              size="sm"
              value={activeFilters.productCategory || []}
              onValueChange={(d) => {
                if (d.value.length > 0) {
                  const newValue = d.value[d.value.length - 1];
                  handleCategorySelect(newValue);
                }
              }}
              disabled={filtersDisabled}
            >
              <Select.HiddenSelect />
              <Select.Control>
                <Select.Trigger bg="white" border="1px solid" borderColor="gray.200" rounded="xl" h="10" opacity={filtersDisabled ? 0.5 : 1}>
                  <Text fontSize="sm" color="gray.500">Select category...</Text>
                </Select.Trigger>
                <Select.IndicatorGroup><Select.Indicator /></Select.IndicatorGroup>
              </Select.Control>
              <Portal>
                <Select.Positioner>
                  <Select.Content bg="white" border="1px solid" borderColor="gray.200" rounded="xl" boxShadow="lg" maxH="300px" overflowY="auto">
                    {categoryCollection.items.map((c) => (
                      <Select.Item item={c} key={c.value} rounded="lg">
                        {c.label}
                        <Select.ItemIndicator />
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Portal>
            </Select.Root>
          </VStack>
        </VStack>
      </Box>

      {/* Search Bar */}
      <Box position="relative">
        <Box position="absolute" left="12px" top="50%" transform="translateY(-50%)" color="var(--color-text-secondary)" pointerEvents="none"><Search size={18} /></Box>
        <Input
          placeholder="Search by Model, SKU, Description, or Brand..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          pl="40px"
          pr={searchQuery ? "40px" : "12px"}
          h="44px"
          bg="white"
          border="1px solid var(--color-border)"
          borderRadius="var(--radius-md)"
          _focus={{ borderColor: 'var(--color-primary)' }}
        />
        {searchQuery && (
          <IconButton
            position="absolute"
            right="8px"
            top="50%"
            transform="translateY(-50%)"
            variant="ghost"
            size="sm"
            onClick={() => handleSearch('')}
            aria-label="Clear search"
          >
            <X size={16} />
          </IconButton>
        )}
      </Box>

      {showEmptyState ? (
        <Center py="64px" px="24px" border="1px solid var(--color-border)" borderRadius="var(--radius-lg)" bg="white">
          <VStack gap="8px">
            <Text fontSize="16px" fontWeight="600" color="var(--color-text-secondary)">No products match your search.</Text>
            <Text fontSize="14px" color="var(--color-text-muted)">Try a different name or clear the search.</Text>
          </VStack>
        </Center>
      ) : (
        <>
          <Box overflowX="auto">
          <VStack align="stretch" gap="0" minW={{ base: '600px', lg: '0' }} border="1px solid var(--color-border)" borderRadius="var(--radius-lg)" overflow="hidden" bg="white">
            <Grid templateColumns="25% 20% 12% 15% 15% 13%" h="48px" bg="var(--color-bg-surface)" borderBottom="1px solid var(--color-border)" px="16px" alignItems="center">
              <Text fontSize="14px" fontWeight="600" color="var(--color-text-secondary)">MODEL</Text>
              <Text fontSize="14px" fontWeight="600" color="var(--color-text-secondary)">DESCRIPTION</Text>
              <Text fontSize="14px" fontWeight="600" color="var(--color-text-secondary)">BRAND</Text>
              <Text fontSize="14px" fontWeight="600" color="var(--color-text-secondary)" textAlign="right" pr="16px">MSRP (CA)</Text>
              <Text fontSize="14px" fontWeight="600" color="var(--color-text-secondary)" textAlign="center">QTY</Text>
              <Text fontSize="14px" fontWeight="600" color="var(--color-text-secondary)" textAlign="center">ACTION</Text>
            </Grid>

            {currentProducts.map((product, i) => {
              const inCart = isInCart(product.id);
              const qty = getQty(product.id);
              const brandColor = BRAND_COLORS[product.brand] || '#999';

              return (
                <Grid key={product.id} templateColumns="25% 20% 12% 15% 15% 13%" minH="64px" px="16px" alignItems="center" borderBottom={i < currentProducts.length - 1 ? '1px solid var(--color-border)' : 'none'} _hover={{ bg: 'var(--color-bg-subtle)' }} transition="all 0.15s">
                  <VStack align="start" gap="2px">
                    <Text fontSize="15px" color="var(--color-text-primary)" fontWeight="600">{product.name}</Text>
                  </VStack>

                  <Text fontSize="13px" color="var(--color-text-secondary)" noOfLines={2} lineHeight="1.4">
                    {product.friendlyDescription || product.productDescription || '—'}
                  </Text>

                  <Box>
                    {product.brand && (
                      <Badge
                        bg={brandColor}
                        color="white"
                        px="8px"
                        py="4px"
                        rounded="full"
                        fontSize="11px"
                        fontWeight="700"
                      >
                        {product.brand}
                      </Badge>
                    )}
                  </Box>

                  <Text fontSize="15px" color="var(--color-text-primary)" fontWeight="600" fontFamily="monospace" textAlign="right" pr="16px">
                    {formatPrice(product.msrp)}
                  </Text>

                  <HStack justify="center" gap="6px">
                    <IconButton
                      h="40px"
                      w="40px"
                      minW="40px"
                      variant="outline"
                      borderColor="var(--color-border)"
                      disabled={qty <= 1 || inCart}
                      onClick={() => updateQty(product.id, qty - 1)}
                    >
                      <Minus size={16} />
                    </IconButton>
                    <Text fontSize="16px" fontWeight="700" w="32px" textAlign="center">{qty}</Text>
                    <IconButton
                      h="40px"
                      w="40px"
                      minW="40px"
                      variant="outline"
                      borderColor="var(--color-border)"
                      disabled={qty >= 99 || inCart}
                      onClick={() => updateQty(product.id, qty + 1)}
                    >
                      <Plus size={16} />
                    </IconButton>
                  </HStack>

                  <HStack justify="center">
                    {inCart ? (
                      <Button h="40px" w="80px" bg="var(--color-primary)" color="white" fontSize="13px" fontWeight="700" borderRadius="var(--radius-md)" disabled cursor="not-allowed" opacity="1">✓ ADDED</Button>
                    ) : (
                      <Button h="40px" w="80px" variant="outline" border="2px solid var(--color-text-primary)" color="var(--color-text-primary)" fontSize="13px" fontWeight="700" borderRadius="var(--radius-md)" _hover={{ bg: 'var(--color-bg-subtle)' }} onClick={() => handleAddProduct(product)}>+ ADD</Button>
                    )}
                  </HStack>
                </Grid>
              );
            })}
          </VStack>
          </Box>

          {totalPages > 1 && (
            <HStack justify="space-between" px="16px">
              <IconButton h="44px" w="44px" variant="outline" borderColor="var(--color-border)" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}><ChevronLeft size={20} /></IconButton>
              <Text fontSize="14px" color="var(--color-text-secondary)">
                Page {currentPage} of {totalPages}
              </Text>
              <IconButton h="44px" w="44px" variant="outline" borderColor="var(--color-border)" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}><ChevronRight size={20} /></IconButton>
            </HStack>
          )}
        </>
      )}

      {error && (
        <HStack justify="center" py="12px" px="16px" bg="#fef3c7" borderRadius="var(--radius-md)" gap="12px">
          <Text fontSize="13px" color="#92400e">{error}</Text>
          <Button size="sm" h="32px" variant="outline" borderColor="#92400e" color="#92400e" onClick={onRetry}>Retry</Button>
        </HStack>
      )}
    </VStack>
  );
};

export default ProductCatalogTable;
