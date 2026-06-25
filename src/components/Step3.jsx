import { useState, useEffect } from 'react';
import { Box, Grid, VStack, HStack, Text, Heading, Button, Input, Stack, Spinner, Dialog, Portal, Progress } from '@chakra-ui/react';
import { Edit } from 'lucide-react';
import EditLeadModal from './EditLeadModal';
import { LeadsEndCustomersBoard } from '@api/BoardSDK.js';

const leadsBoard = new LeadsEndCustomersBoard();

const Step3 = ({ selectedLeadId, cart, onPrevious, onNext }) => {
  const [leadData, setLeadData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [backConfirmOpen, setBackConfirmOpen] = useState(false);
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);

  useEffect(() => {
    const fetchLead = async () => {
      try {
        setLoading(true);
        const lead = await leadsBoard.item(selectedLeadId)
          .withColumns(['email', 'zipCode', 'referOutDealer', 'comments'])
          .execute();
        setLeadData(lead);
      } catch (err) {
        console.error('Failed to fetch lead:', err);
      } finally {
        setLoading(false);
      }
    };
    if (selectedLeadId) fetchLead();
  }, [selectedLeadId]);

  const handleRefreshLead = () => {
    const fetchLead = async () => {
      const lead = await leadsBoard.item(selectedLeadId)
        .withColumns(['email', 'zipCode', 'referOutDealer', 'comments'])
        .execute();
      setLeadData(lead);
    };
    fetchLead();
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.qty * item.msrp), 0);
  const grandTotal = subtotal;
  const dealValue = cart.filter(i => i.include).reduce((sum, item) => sum + (item.qty * item.msrp), 0);

  const formatPrice = (price) => `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleBackToProducts = () => {
    setBackConfirmOpen(false);
    onPrevious();
  };

  const handleGenerate = () => {
    setGenerateConfirmOpen(false);
    onNext();
  };

  const dealerName = leadData?.referOutDealer?.linkedItems?.[0]?.name || '—';

  return (
    <Box px="24px" pb="24px">
      <VStack align="start" gap="8px" mb="24px">
        <Heading fontSize="32px" fontWeight="700" color="var(--color-text-primary)">Step 3: Final Review</Heading>
        <Text fontSize="16px" color="var(--color-text-secondary)">Verify the lead information and product list with the customer.</Text>
      </VStack>

      <Grid templateColumns="40% 60%" gap="24px">
        <VStack align="stretch" gap="16px">
          <HStack justify="space-between">
            <Text fontSize="16px" fontWeight="700" color="var(--color-text-primary)">1. Customer &amp; Lead Details</Text>
            <Button variant="outline" h="44px" px="16px" borderRadius="var(--radius-md)" onClick={() => setEditModalOpen(true)}><Edit size={16} /> EDIT</Button>
          </HStack>
          <Box bg="var(--color-bg-subtle)" border="1px solid var(--color-border)" borderRadius="var(--radius-lg)" p="20px">
            {loading ? <Spinner size="sm" /> : (
              <Stack gap="12px">
                <HStack justify="space-between"><Text fontSize="14px" color="var(--color-text-secondary)">Full Name:</Text><Text fontSize="14px" fontWeight="600">{leadData?.name || '—'}</Text></HStack>
                <HStack justify="space-between"><Text fontSize="14px" color="var(--color-text-secondary)">Email:</Text><Text fontSize="14px" fontWeight="600">{leadData?.email?.email || '—'}</Text></HStack>
                <HStack justify="space-between"><Text fontSize="14px" color="var(--color-text-secondary)">Zip Code:</Text><Text fontSize="14px" fontWeight="600">{leadData?.zipCode || '—'}</Text></HStack>
                <HStack justify="space-between"><Text fontSize="14px" color="var(--color-text-secondary)">Referring Dealer:</Text><Text fontSize="14px" fontWeight="600">{dealerName}</Text></HStack>
                <HStack justify="space-between" align="start"><Text fontSize="14px" color="var(--color-text-secondary)">Comments:</Text><Text fontSize="14px" fontWeight="600" textAlign="right">{leadData?.comments || '—'}</Text></HStack>
              </Stack>
            )}
          </Box>
        </VStack>

        <VStack align="stretch" gap="16px">
          <Text fontSize="16px" fontWeight="700" color="var(--color-text-primary)">2. Product Selection Summary</Text>
          <Box bg="white" border="1px solid var(--color-border)" borderRadius="var(--radius-lg)" overflow="hidden">
            <Grid templateColumns="35% 12% 18% 18% 17%" h="48px" bg="var(--color-bg-surface)" borderBottom="1px solid var(--color-border)" px="16px" alignItems="center">
              {['Product', 'Qty', 'Unit Price', 'Total', 'Deal Value'].map(h => <Text key={h} fontSize="14px" fontWeight="600" color="var(--color-text-secondary)">{h}</Text>)}
            </Grid>
            {cart.map((item, i) => (
              <Grid key={item.productId} templateColumns="35% 12% 18% 18% 17%" minH="56px" px="16px" alignItems="center" borderBottom={i < cart.length - 1 ? '1px solid var(--color-border)' : 'none'}>
                <Text fontSize="15px" color="var(--color-text-primary)" fontWeight="500">{item.productName}</Text>
                <Text fontSize="15px" color="var(--color-text-primary)">{item.qty}</Text>
                <Text fontSize="15px" color="var(--color-text-primary)" fontFamily="monospace">{formatPrice(item.msrp)}</Text>
                <Text fontSize="15px" color="var(--color-text-primary)" fontWeight="600" fontFamily="monospace">{formatPrice(item.qty * item.msrp)}</Text>
                <Text fontSize="14px" fontWeight="600" color={item.include ? '#166534' : '#6B7280'}>{item.include ? 'Included' : 'Excluded'}</Text>
              </Grid>
            ))}
          </Box>

          <Box bg="var(--color-bg-subtle)" border="1px solid var(--color-border)" borderRadius="var(--radius-lg)" p="20px">
            <Stack gap="12px">
              <HStack justify="space-between"><Text fontSize="14px" color="var(--color-text-secondary)">Subtotal:</Text><Text fontSize="14px" fontWeight="600" fontFamily="monospace">{formatPrice(subtotal)}</Text></HStack>
              <HStack justify="space-between" pt="8px" borderTop="2px solid var(--color-border)"><Text fontSize="18px" fontWeight="700" color="var(--color-text-primary)">Grand Total:</Text><Text fontSize="22px" fontWeight="700" color="var(--color-text-primary)" fontFamily="monospace">{formatPrice(grandTotal)}</Text></HStack>
              <HStack justify="space-between" pt="8px"><Text fontSize="13px" color="var(--color-text-secondary)">Impact on CRM Deal Value:</Text><Text fontSize="14px" fontWeight="600" fontFamily="monospace">{formatPrice(dealValue)}</Text></HStack>
            </Stack>
          </Box>
        </VStack>
      </Grid>

      <EditLeadModal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} leadId={selectedLeadId} onSaved={handleRefreshLead} />

      <Dialog.Root open={backConfirmOpen} onOpenChange={(e) => setBackConfirmOpen(e.open)}>
        <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
          <Dialog.Header><Dialog.Title>Go back to Add Products?</Dialog.Title></Dialog.Header>
          <Dialog.Body>Your product selection will be kept.</Dialog.Body>
          <Dialog.Footer gap="2"><Button variant="outline" onClick={() => setBackConfirmOpen(false)}>Cancel</Button><Button onClick={handleBackToProducts}>Go Back</Button></Dialog.Footer>
          <Dialog.CloseTrigger />
        </Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>

      <Dialog.Root open={generateConfirmOpen} onOpenChange={(e) => setGenerateConfirmOpen(e.open)}>
        <Portal><Dialog.Backdrop /><Dialog.Positioner><Dialog.Content>
          <Dialog.Header><Dialog.Title>Generate and send this quote?</Dialog.Title></Dialog.Header>
          <Dialog.Body>
            <Text mb="16px">We'll save all products to this lead and prepare the quote. This action cannot be undone.</Text>
            <VStack align="stretch" gap="8px" p="12px" bg="var(--color-bg-subtle)" borderRadius="var(--radius-md)">
              <HStack justify="space-between"><Text fontSize="13px" color="var(--color-text-secondary)">Customer:</Text><Text fontSize="13px" fontWeight="600">{leadData?.name}</Text></HStack>
              <HStack justify="space-between"><Text fontSize="13px" color="var(--color-text-secondary)">Items:</Text><Text fontSize="13px" fontWeight="600">{cart.length}</Text></HStack>
              <HStack justify="space-between"><Text fontSize="13px" color="var(--color-text-secondary)">Grand Total:</Text><Text fontSize="13px" fontWeight="600">{formatPrice(grandTotal)}</Text></HStack>
            </VStack>
          </Dialog.Body>
          <Dialog.Footer gap="2"><Button variant="outline" onClick={() => setGenerateConfirmOpen(false)}>Cancel</Button><Button colorPalette="blue" onClick={handleGenerate}>Yes, Generate</Button></Dialog.Footer>
          <Dialog.CloseTrigger />
        </Dialog.Content></Dialog.Positioner></Portal>
      </Dialog.Root>
    </Box>
  );
};

export default Step3;
