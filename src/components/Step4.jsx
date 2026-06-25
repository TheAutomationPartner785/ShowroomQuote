import { useState, useEffect, useRef } from 'react';
import { Box, VStack, HStack, Text, Heading, Card, Spinner, Button, SimpleGrid } from '@chakra-ui/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { LeadsEndCustomersBoard, ProductCatalogBoard } from '@api/BoardSDK.js';

const leadsBoard = new LeadsEndCustomersBoard();
const productCatalogBoard = new ProductCatalogBoard();

// ===========================================================================
// CONFIG - Monday column IDs for the Leads board subitems
// ===========================================================================
const COL_PRODUCT     = 'column20ProductCatalog';  // Board-relation to Product Catalog
const COL_QTY         = 'qty';                      // SDK alias, do NOT use raw ID
const COL_INCLUDE     = 'includeexclude';           // Status
const COL_UNIT_PRICE  = 'msrpCa1';                  // Unit price on subitem (writeable)
const COL_TOTAL_PRICE = 'totalPrice';               // qty x unit price on subitem (writeable)

// Lead-level column to update on success (triggers automation)
const COL_QUOTE_STATUS        = 'quoteStatus';
const QUOTE_STATUS_ON_SUCCESS = 'Prepare Quote';

// ===========================================================================
// HELPERS
// ===========================================================================

/**
 * Consolidates cart entries that share the same productId.
 * If the cart somehow has "Model X" twice with qty=1 each, this becomes
 * ONE line with qty=2. Prevents duplicate subitem creation downstream.
 */
const consolidateCart = (cart) => {
  const map = new Map();
  cart.forEach(item => {
    const key = item.productId;
    if (map.has(key)) {
      const existing = map.get(key);
      existing.qty += Number(item.qty) || 0;
      existing.include = item.include; // latest include flag wins
    } else {
      map.set(key, {
        productId:   item.productId,
        productName: item.productName,
        msrp:        item.msrp || 0,
        qty:         Number(item.qty) || 0,
        include:     !!item.include
      });
    }
  });
  return Array.from(map.values());
};

const includeLabelFor = (include) => (include ? 'Include' : 'Exclude/Option');

// ===========================================================================
// COMPONENT
// ===========================================================================

const Step4 = ({ selectedLeadId, cart, onBack, onFinish, handleFinishRef }) => {
  const [syncState, setSyncState] = useState('idle');
  const [progress, setProgress] = useState({ creating: 0, updating: 0, deleting: 0 });
  const [diffResults, setDiffResults] = useState({ toCreate: [], toUpdate: [], toDelete: [], unchanged: 0 });
  const [error, setError] = useState(null);
  const hasRunRef = useRef(false); // prevent double-sync on StrictMode / remount

  useEffect(() => {
    if (!selectedLeadId || cart.length === 0) return;
    if (hasRunRef.current) return;
    hasRunRef.current = true;
    performSync();
  }, [selectedLeadId]);

  const handleFinish = async () => {
    try {
      console.log(`[Step4] Finalizing: set lead ${selectedLeadId} ${COL_QUOTE_STATUS} = "${QUOTE_STATUS_ON_SUCCESS}"`);
      await leadsBoard.item(selectedLeadId).update({
        [COL_QUOTE_STATUS]: QUOTE_STATUS_ON_SUCCESS
      }).execute();
      console.log('[Step4] Quote status updated');
      onFinish?.();
    } catch (err) {
      console.error('[Step4] Failed to update quoteStatus:', err);
      alert('Could not update the Quote Status. The subitems were saved, but the automation will not fire until the status is set manually in Monday.');
      onFinish?.();
    }
  };

  useEffect(() => {
    if (handleFinishRef) handleFinishRef.current = handleFinish;
    return () => {
      if (handleFinishRef) handleFinishRef.current = null;
    };
  });

  const performSync = async () => {
    setSyncState('syncing');
    setError(null);
    setProgress({ creating: 0, updating: 0, deleting: 0 });

    try {
      // STEP 0 - Consolidate the cart (safety net)
      const consolidatedCart = consolidateCart(cart);
      console.log('[Step4] Original cart length:', cart.length, '-> consolidated:', consolidatedCart.length);
      consolidatedCart.forEach(item => {
        console.log(`[Step4] Consolidated: productId=${item.productId} productName="${item.productName}" qty=${item.qty} msrp=${item.msrp} include=${item.include} -> Monday label: "${includeLabelFor(item.include)}"`);
      });

      // STEP 0.5 - Batch-fetch current MSRPs from the Product Catalog (one batch, all IDs)
      const productIds = [...new Set(consolidatedCart.map(item => item.productId).filter(Boolean))];
      const msrpMap = new Map();

      if (productIds.length > 0) {
        console.log(`[Step4] Batch fetching MSRP for ${productIds.length} unique product(s):`, productIds);
        try {
          // ONE batch with all productIds at once using Promise.all
          const productResults = await Promise.all(
            productIds.map(id =>
              productCatalogBoard.item(id).withColumns(['msrpCa']).execute()
            )
          );

          productResults.forEach(prod => {
            const msrp = Number(prod.msrpCa) || 0;
            msrpMap.set(String(prod.id), msrp);
            console.log(`[Step4] MSRP fetched: productId=${prod.id} -> $${msrp}`);
          });
        } catch (err) {
          console.error('[Step4] Batch MSRP fetch failed, falling back to cart msrp values:', err);
          // Continue with cart's local msrp values as fallback
        }
      }

      // Merge MSRP back into each cart item (fresh value overrides stale cart value if available)
      consolidatedCart.forEach(item => {
        const freshMsrp = msrpMap.get(String(item.productId));
        if (typeof freshMsrp === 'number' && freshMsrp > 0) {
          item.msrp = freshMsrp;
        } else {
          console.warn(`[Step4] No MSRP found for productId=${item.productId}, keeping cart msrp=${item.msrp}`);
        }
      });

      // STEP A - Fetch existing subitems for this lead
      const lead = await leadsBoard.item(selectedLeadId)
        .withSubItems([COL_PRODUCT, COL_QTY, COL_INCLUDE])
        .execute();

      const existingSubitems = lead.subitems || [];
      console.log('[Step4] Existing subitems:', existingSubitems.length);

      // Group existing subitems by productId (handles prior duplicates)
      const existingMap = new Map();
      existingSubitems.forEach(sub => {
        const productId = sub[COL_PRODUCT]?.linkedItems?.[0]?.id;
        if (!productId) return;
        if (!existingMap.has(productId)) existingMap.set(productId, []);
        existingMap.get(productId).push(sub);
      });

      // STEP B - Compute diff
      const toCreate = [];
      const toUpdate = [];
      const toDelete = [];
      let unchanged = 0;

      consolidatedCart.forEach(cartItem => {
        const existingList = existingMap.get(cartItem.productId) || [];

        if (existingList.length === 0) {
          toCreate.push(cartItem);
        } else {
          const [firstExisting, ...duplicates] = existingList;

          const currentQty     = Number(firstExisting[COL_QTY]) || 0;
          const currentInclude = firstExisting[COL_INCLUDE];
          const targetInclude  = includeLabelFor(cartItem.include);

          const qtyChanged     = currentQty !== cartItem.qty;
          const includeChanged = currentInclude !== targetInclude;

          if (qtyChanged || includeChanged) {
            toUpdate.push({
              subitemId: firstExisting.id,
              cartItem,
              qtyChanged,
              includeChanged,
              targetQty: cartItem.qty,
              targetInclude
            });
          } else {
            unchanged++;
          }

          duplicates.forEach(dup => toDelete.push(dup.id));
          existingMap.delete(cartItem.productId);
        }
      });

      // Products no longer in cart -> delete
      existingMap.forEach(list => list.forEach(sub => toDelete.push(sub.id)));

      console.log('[Step4] Diff:', {
        toCreate: toCreate.length,
        toUpdate: toUpdate.length,
        toDelete: toDelete.length,
        unchanged
      });

      setDiffResults({ toCreate, toUpdate, toDelete, unchanged });

      // STEP C - CREATE (one call per cart entry, bundle-position naming)
      let bundlePosition = (existingSubitems.length - toDelete.length) + 1;

      for (let i = 0; i < toCreate.length; i++) {
        const item = toCreate[i];
        const unitPrice = Number(item.msrp || 0);
        const qty = Number(item.qty);
        const totalPrice = unitPrice * qty;

        const includeLabel = includeLabelFor(item.include);
        const payload = {
          name: String(bundlePosition),
          [COL_PRODUCT]: { linkedItems: [{ id: item.productId }] },
          [COL_QTY]: qty,
          [COL_INCLUDE]: includeLabel,
          [COL_UNIT_PRICE]: unitPrice,
          [COL_TOTAL_PRICE]: totalPrice
        };
        console.log(`[Step4] CREATE #${i + 1} payload (qty=${qty}, unitPrice=${unitPrice}, totalPrice=${totalPrice}, include=${item.include} -> "${includeLabel}"):`, payload);

        // IMPORTANT: ONE create call, qty is a VALUE not a loop count
        await leadsBoard.item(selectedLeadId).subitem().create(payload).execute();
        await new Promise(r => setTimeout(r, 150)); // small pause between creates

        bundlePosition++;
        setProgress(prev => ({ ...prev, creating: i + 1 }));
      }

      // STEP D - UPDATE
      for (let i = 0; i < toUpdate.length; i++) {
        const { subitemId, cartItem, qtyChanged, includeChanged, targetQty, targetInclude } = toUpdate[i];
        const updates = {};

        if (qtyChanged) {
          const unitPrice = Number(cartItem.msrp || 0);
          const newQty = Number(targetQty);
          updates[COL_QTY] = newQty;
          updates[COL_UNIT_PRICE] = unitPrice;
          updates[COL_TOTAL_PRICE] = unitPrice * newQty;
        }
        if (includeChanged) {
          updates[COL_INCLUDE] = targetInclude;
          console.log(`[Step4] Include changed: cart has include=${cartItem.include} -> Monday label "${targetInclude}"`);
        }

        console.log(`[Step4] UPDATE subitem ${subitemId} ->`, updates);
        await leadsBoard.item(selectedLeadId).subitem(subitemId).update(updates).execute();
        setProgress(prev => ({ ...prev, updating: i + 1 }));
      }

      // STEP E - DELETE (archive)
      for (let i = 0; i < toDelete.length; i++) {
        console.log(`[Step4] ARCHIVE ${toDelete[i]}`);
        await leadsBoard.item(toDelete[i]).archive().execute();
        setProgress(prev => ({ ...prev, deleting: i + 1 }));
      }

      // STEP F - RENUMBER subitems to match cart order
      console.log('[Step4] STEP F: Renumbering subitems to match cart order');

      // Refetch all surviving subitems
      const refreshedLead = await leadsBoard.item(selectedLeadId)
        .withSubItems([COL_PRODUCT])
        .execute();

      const survivingSubitems = refreshedLead.subitems || [];
      console.log(`[Step4] Found ${survivingSubitems.length} surviving subitems for renumbering`);

      // Build map: productId -> subitemId
      const productToSubitemMap = new Map();
      survivingSubitems.forEach(sub => {
        const productId = sub[COL_PRODUCT]?.linkedItems?.[0]?.id;
        if (productId) {
          productToSubitemMap.set(String(productId), sub.id);
        }
      });

      // Rename each subitem to match cart order
      for (let i = 0; i < consolidatedCart.length; i++) {
        const cartItem = consolidatedCart[i];
        const subitemId = productToSubitemMap.get(String(cartItem.productId));

        if (!subitemId) {
          console.warn(`[Step4] RENUMBER: No subitem found for productId=${cartItem.productId}, skipping`);
          continue;
        }

        const newName = String(i + 1);
        console.log(`[Step4] RENUMBER: subitem ${subitemId} (product ${cartItem.productId}) -> name="${newName}"`);

        await leadsBoard.item(selectedLeadId).subitem(subitemId).update({
          name: newName
        }).execute();
      }

      console.log('[Step4] Sync complete');
      setSyncState('success');
    } catch (err) {
      console.error('[Step4] Sync failed:', err);
      setError(err?.message || 'Failed to sync items to Monday. Please retry.');
      setSyncState('error');
      hasRunRef.current = false;
    }
  };

  const subtotal   = cart.reduce((sum, item) => sum + (item.qty * item.msrp), 0);
  const grandTotal = subtotal;
  const dealValue  = cart.filter(i => i.include).reduce((sum, item) => sum + (item.qty * item.msrp), 0);
  const formatPrice = (price) => `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (syncState === 'syncing') {
    return (
      <Box px="24px" pb="24px" display="flex" alignItems="center" justifyContent="center" minH="400px">
        <VStack gap="24px">
          <Spinner size="xl" color="var(--color-accent-blue)" thickness="4px" />
          <Heading fontSize="24px" fontWeight="700" color="var(--color-text-primary)">Saving your quote...</Heading>
          <VStack gap="8px" align="stretch" w="300px">
            {diffResults.toCreate.length > 0 && (
              <HStack justify="space-between">
                <Text fontSize="14px" color="var(--color-text-secondary)">Creating products:</Text>
                <Text fontSize="14px" fontWeight="600">({progress.creating} / {diffResults.toCreate.length})</Text>
              </HStack>
            )}
          </VStack>
        </VStack>
      </Box>
    );
  }

  if (syncState === 'error') {
    return (
      <Box px="24px" pb="24px" display="flex" alignItems="center" justifyContent="center" minH="400px">
        <VStack gap="24px" maxW="500px">
          <Box p="4" bg="red.50" rounded="full"><XCircle size={48} color="var(--chakra-colors-red-500)" /></Box>
          <Heading fontSize="24px" fontWeight="700" color="var(--color-text-primary)">We couldn't finish saving your quote.</Heading>
          <Text fontSize="14px" color="var(--color-text-secondary)" textAlign="center">{error}</Text>
          <HStack gap="12px">
            <Button variant="outline" onClick={onBack}>Go Back</Button>
            <Button colorPalette="blue" onClick={() => { hasRunRef.current = false; performSync(); }}>Retry</Button>
          </HStack>
        </VStack>
      </Box>
    );
  }

  if (syncState === 'success') {
    return (
      <Box px="24px" pb="24px">
        <VStack align="start" gap="8px" mb="24px">
          <Heading fontSize="32px" fontWeight="700" color="var(--color-text-primary)">Step 4: Quote Confirmed & Saved</Heading>
          <Text fontSize="16px" color="var(--color-text-secondary)">The quote items have been saved successfully.</Text>
        </VStack>

        <Box p="24px" bg="green.50" border="1px solid var(--chakra-colors-green-200)" borderRadius="var(--radius-lg)" mb="24px">
          <HStack gap="16px">
            <Box p="3" bg="green.100" rounded="full"><CheckCircle size={32} color="var(--chakra-colors-green-600)" /></Box>
            <VStack align="start" gap="0">
              <Text fontSize="20px" fontWeight="700" color="green.700">Success!</Text>
              <Text fontSize="14px" color="green.600">{consolidateCart(cart).length} product(s) saved successfully.</Text>
            </VStack>
          </HStack>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap="24px">
          <Card.Root bg="white" borderWidth="1px" borderColor="gray.200">
            <Card.Header><Card.Title>Summary</Card.Title></Card.Header>
            <Card.Body>
              <VStack align="stretch" gap="8px">
                <HStack justify="space-between">
                  <Text fontSize="14px" color="var(--color-text-secondary)">Products saved to quote:</Text>
                  <Text fontSize="14px" fontWeight="600">{consolidateCart(cart).length}</Text>
                </HStack>
              </VStack>
            </Card.Body>
          </Card.Root>

          <Card.Root bg="white" borderWidth="1px" borderColor="gray.200">
            <Card.Header><Card.Title>Final Financial Totals</Card.Title></Card.Header>
            <Card.Body>
              <VStack align="stretch" gap="8px">
                <HStack justify="space-between">
                  <Text fontSize="14px" color="var(--color-text-secondary)">Subtotal:</Text>
                  <Text fontSize="14px" fontWeight="600" fontFamily="monospace">{formatPrice(subtotal)}</Text>
                </HStack>
                <HStack justify="space-between" pt="8px" borderTop="2px solid var(--color-border)">
                  <Text fontSize="16px" fontWeight="700" color="var(--color-text-primary)">Grand Total:</Text>
                  <Text fontSize="18px" fontWeight="700" color="var(--color-text-primary)" fontFamily="monospace">{formatPrice(grandTotal)}</Text>
                </HStack>
                <HStack justify="space-between" pt="8px">
                  <Text fontSize="13px" color="var(--color-text-secondary)">Impact on CRM Deal Value:</Text>
                  <Text fontSize="14px" fontWeight="600" fontFamily="monospace">{formatPrice(dealValue)}</Text>
                </HStack>
              </VStack>
            </Card.Body>
          </Card.Root>
        </SimpleGrid>

        <Box mt="16px" p="12px" bg="gray.50" borderRadius="var(--radius-md)">
          <Text fontSize="12px" color="gray.500" textAlign="center">
            When you click "Finish", the quote will be sent for final preparation.
          </Text>
        </Box>
      </Box>
    );
  }

  return null;
};

export default Step4;
