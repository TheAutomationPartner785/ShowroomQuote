import { useState } from 'react';
import { Box, Grid, VStack, HStack, Text, IconButton, Dialog, Portal, Button } from '@chakra-ui/react';
import { Minus, Plus, Trash2 } from 'lucide-react';

const SubitemsTable = ({ cart, onUpdateQty, onToggleInclude, onRemove }) => {
  const [deleteTarget, setDeleteTarget] = useState(null);

  const formatPrice = (price) => {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  if (cart.length === 0) {
    return (
      <Box>
        <Text fontSize="14px" fontWeight="600" color="var(--color-text-secondary)" mb="12px">CURRENT SELECTION (QUOTE ITEMS)</Text>
        <Text color="var(--color-text-secondary)" textAlign="center" py="32px" border="1px solid var(--color-border)" borderRadius="var(--radius-lg)" bg="white">No products added yet. Tap + ADD on any product above to start building the quote.</Text>
      </Box>
    );
  }

  return (
    <VStack align="stretch" gap="12px">
      <Text fontSize="14px" fontWeight="600" color="var(--color-text-secondary)">CURRENT SELECTION (QUOTE ITEMS)</Text>

      <VStack align="stretch" gap="0" border="1px solid var(--color-border)" borderRadius="var(--radius-lg)" overflow="hidden" bg="white">
        <Grid templateColumns="25% 12% 18% 18% 18% 9%" h="48px" bg="var(--color-bg-surface)" borderBottom="1px solid var(--color-border)" px="16px" alignItems="center">
          {['Product', 'Qty', 'Unit Price', 'Total', 'Include?', ''].map(h => <Text key={h} fontSize="14px" fontWeight="600" color="var(--color-text-secondary)">{h}</Text>)}
        </Grid>

        {cart.map((item, i) => {
          const total = item.qty * item.msrp;

          return (
            <Grid key={item.productId} templateColumns="25% 12% 18% 18% 18% 9%" minH="56px" px="16px" alignItems="center" borderBottom={i < cart.length - 1 ? '1px solid var(--color-border)' : 'none'} _hover={{ bg: 'var(--color-bg-subtle)' }} transition="all 0.15s">
              <Text fontSize="15px" color="var(--color-text-primary)" fontWeight="500">{item.productName}</Text>

              <HStack gap="2">
                <IconButton h="32px" w="32px" minW="32px" variant="outline" borderColor="var(--color-border)" fontSize="12px" disabled={item.qty <= 1} onClick={() => onUpdateQty(item.productId, item.qty - 1)}><Minus size={14} /></IconButton>
                <Text fontSize="14px" fontWeight="600" w="20px" textAlign="center">{item.qty}</Text>
                <IconButton h="32px" w="32px" minW="32px" variant="outline" borderColor="var(--color-border)" fontSize="12px" disabled={item.qty >= 99} onClick={() => onUpdateQty(item.productId, item.qty + 1)}><Plus size={14} /></IconButton>
              </HStack>

              <Text fontSize="15px" color="var(--color-text-primary)" fontFamily="monospace">{formatPrice(item.msrp)}</Text>
              <Text fontSize="15px" color="var(--color-text-primary)" fontWeight="600" fontFamily="monospace">{formatPrice(total)}</Text>

              <Box display="flex" alignItems="center" justifyContent="center" h="24px" w="24px" bg={item.include ? 'var(--color-primary)' : 'white'} border={item.include ? 'none' : '2px solid var(--color-border)'} borderRadius="4px" cursor="pointer" onClick={() => onToggleInclude(item.productId, !item.include)}>{item.include && <Text color="white" fontSize="12px" fontWeight="700">✓</Text>}</Box>

              <IconButton h="32px" w="32px" minW="32px" color="red.500" variant="ghost" onClick={() => setDeleteTarget(item.productId)}><Trash2 size={16} /></IconButton>
            </Grid>
          );
        })}
      </VStack>

      <Dialog.Root open={!!deleteTarget} onOpenChange={(e) => !e.open && setDeleteTarget(null)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header><Dialog.Title>Remove this product?</Dialog.Title></Dialog.Header>
              <Dialog.Body>This item will be removed from your cart.</Dialog.Body>
              <Dialog.Footer gap="2">
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
                <Button colorPalette="red" onClick={() => { onRemove(deleteTarget); setDeleteTarget(null); }}>Remove</Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger />
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </VStack>
  );
};

export default SubitemsTable;
