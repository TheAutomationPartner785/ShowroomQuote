import { useState, useCallback } from 'react';
import { Box, Grid, VStack, HStack, Heading, Text, Alert, Dialog, Portal, Button, Progress, Spinner } from '@chakra-ui/react';
import ProductCatalogTable from './ProductCatalogTable';
import SubitemsTable from './SubitemsTable';
import QuoteSummaryCard from './QuoteSummaryCard';
import { useProducts } from '../hooks/useProducts';
import { LeadsEndCustomersBoard } from '@api/BoardSDK.js';

const leadsBoard = new LeadsEndCustomersBoard();

const Step2 = ({ selectedLeadId, cart, setCart, onPrevious, onNext }) => {
  const {
    products,
    allProducts,
    filterMetadata,
    activeFilters,
    setFilter,
    clearAllFilters,
    activeFilterCount,
    isLoadingInitial,
    isLoadingAll,
    isRevalidating,
    error: productsError,
    refresh: retryProducts
  } = useProducts();
  const [nextConfirmOpen, setNextConfirmOpen] = useState(false);

  const addToCart = useCallback((product) => {
    setCart(prev => [...prev, {
      productId: product.id,
      productName: product.name,
      msrp: product.msrp || 0,
      qty: product.qty || 1,
      include: true
    }]);
  }, []);

  const updateQty = useCallback((productId, newQty) => {
    setCart(prev => prev.map(item => item.productId === productId ? { ...item, qty: newQty } : item));
  }, []);

  const toggleInclude = useCallback((productId, isIncluding) => {
    setCart(prev => prev.map(item => item.productId === productId ? { ...item, include: isIncluding } : item));
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  }, []);

  const handleContinueToReview = () => {
    setNextConfirmOpen(false);
    onNext(cart);
  };

  const { subtotal, dealValue } = cart.reduce((acc, item) => {
    const itemTotal = item.qty * item.msrp;
    acc.subtotal += itemTotal;
    if (item.include) acc.dealValue += itemTotal;
    return acc;
  }, { subtotal: 0, dealValue: 0 });

  return (
    <Box px={{ base: '16px', md: '24px' }} pb="24px">
      <VStack align="start" gap="8px" mb="24px">
        <Heading fontSize={{ base: '24px', md: '32px' }} fontWeight="700" color="var(--color-text-primary)">Step 2: Build Your Quote</Heading>
        <Text fontSize={{ base: '14px', md: '16px' }} color="var(--color-text-secondary)">Browse the catalog and add items to the customer's selection.</Text>
      </VStack>

      {productsError && <Alert.Root colorPalette="red" mb="16px"><Alert.Title>Error</Alert.Title><Alert.Description>{productsError}</Alert.Description></Alert.Root>}

      <Grid templateColumns={{ base: "1fr", lg: "60% 40%" }} gap={{ base: "16px", md: "24px" }}>
        <VStack align="stretch" gap="24px">
          <ProductCatalogTable
            products={products}
            allProducts={allProducts}
            filterMetadata={filterMetadata}
            activeFilters={activeFilters}
            setFilter={setFilter}
            clearAllFilters={clearAllFilters}
            activeFilterCount={activeFilterCount}
            cart={cart}
            onAddProduct={addToCart}
            isLoadingInitial={isLoadingInitial}
            isLoadingAll={isLoadingAll}
            isRevalidating={isRevalidating}
            error={productsError}
            onRetry={retryProducts}
          />
          <SubitemsTable cart={cart} onUpdateQty={updateQty} onToggleInclude={toggleInclude} onRemove={removeFromCart} />
        </VStack>

        <QuoteSummaryCard itemCount={cart.length} subtotal={subtotal} dealValue={dealValue} />
      </Grid>

      <Dialog.Root open={nextConfirmOpen} onOpenChange={(e) => setNextConfirmOpen(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header><Dialog.Title>Ready to review this quote?</Dialog.Title></Dialog.Header>
              <Dialog.Body>
                <Text mb="16px">We'll save these items to Monday and take you to the review step.</Text>
                <VStack align="stretch" gap="8px" p="12px" bg="var(--color-bg-subtle)" borderRadius="var(--radius-md)">
                  <HStack justify="space-between"><Text fontSize="13px" color="var(--color-text-secondary)">Items:</Text><Text fontSize="13px" fontWeight="600">{cart.length}</Text></HStack>
                  <HStack justify="space-between"><Text fontSize="13px" color="var(--color-text-secondary)">Total Deal Value:</Text><Text fontSize="13px" fontWeight="600">${dealValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text></HStack>
                </VStack>
              </Dialog.Body>
              <Dialog.Footer gap="2">
                <Button variant="outline" onClick={() => setNextConfirmOpen(false)}>Keep Editing</Button>
                <Button colorPalette="blue" onClick={handleContinueToReview}>Continue to Review</Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger />
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
};

export default Step2;
