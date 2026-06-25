import { useState, useEffect } from 'react';
import { Dialog, Portal, Button, VStack, Text, Input, Textarea, HStack, Spinner } from '@chakra-ui/react';
import DealerCombobox from './DealerCombobox';
import { useDealers } from '../hooks/useDealers';
import { LeadsEndCustomersBoard } from '@api/BoardSDK.js';

const leadsBoard = new LeadsEndCustomersBoard();

const EditLeadModal = ({ isOpen, onClose, leadId, onSaved }) => {
  const { dealers } = useDealers();
  const [formData, setFormData] = useState({ fullName: '', email: '', zipCode: '', dealer: '', comments: '' });
  const [saving, setSaving] = useState({});
  const [saved, setSaved] = useState({});

  useEffect(() => {
    if (isOpen && leadId) {
      const fetchLead = async () => {
        try {
          const lead = await leadsBoard.item(leadId).withColumns(['email', 'zipCode', 'referOutDealer', 'comments']).execute();
          setFormData({
            fullName: lead.name || '',
            email: lead.email?.email || '',
            zipCode: lead.zipCode || '',
            dealer: lead.referOutDealer?.linkedItems?.[0]?.id || '',
            comments: lead.comments || ''
          });
        } catch (err) {
          console.error('Failed to fetch lead for editing:', err);
        }
      };
      fetchLead();
    }
  }, [isOpen, leadId]);

  const handleSave = async (field, value) => {
    setSaving(prev => ({ ...prev, [field]: true }));
    try {
      const payload = {};
      if (field === 'fullName') payload.name = value;
      if (field === 'email') payload.email = { email: value };
      if (field === 'zipCode') payload.zipCode = value;
      if (field === 'dealer') payload.referOutDealer = { linkedItems: [{ id: value }] };
      if (field === 'comments') payload.comments = value;

      await leadsBoard.item(leadId).update(payload).execute();
      setSaved(prev => ({ ...prev, [field]: true }));
      setTimeout(() => setSaved(prev => ({ ...prev, [field]: false })), 2000);
      onSaved?.();
    } catch (err) {
      console.error(`Failed to save ${field}:`, err);
    } finally {
      setSaving(prev => ({ ...prev, [field]: false }));
    }
  };

  const handleBlur = (field) => {
    if (formData[field] !== undefined && formData[field] !== null) {
      handleSave(field, formData[field]);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => { if (!e.open) onClose(); }}>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="500px">
            <Dialog.Header><Dialog.Title>Edit Customer &amp; Lead Details</Dialog.Title></Dialog.Header>
            <Dialog.Body>
              <VStack gap="16px" align="stretch">
                {['fullName', 'email', 'zipCode'].map(field => (
                  <VStack key={field} align="stretch" gap="4px">
                    <Text fontSize="14px" fontWeight="600">{field === 'fullName' ? 'Full Name' : field === 'email' ? 'Email' : 'Zip Code'}</Text>
                    <HStack>
                      <Input h="44px" value={formData[field]} onChange={(e) => setFormData({ ...formData, [field]: e.target.value })} onBlur={() => handleBlur(field)} />
                      {saving[field] && <Spinner size="sm" />}
                      {saved[field] && <Text fontSize="12px" color="var(--color-primary)">✓ Saved</Text>}
                    </HStack>
                  </VStack>
                ))}

                <VStack align="stretch" gap="4px">
                  <Text fontSize="14px" fontWeight="600">Referring Dealer</Text>
                  <HStack>
                    <DealerCombobox dealers={dealers} value={formData.dealer} onChange={(id) => { setFormData({ ...formData, dealer: id }); handleSave('dealer', id); }} />
                    {saving.dealer && <Spinner size="sm" />}
                    {saved.dealer && <Text fontSize="12px" color="var(--color-primary)">✓ Saved</Text>}
                  </HStack>
                </VStack>

                <VStack align="stretch" gap="4px">
                  <Text fontSize="14px" fontWeight="600">Comments</Text>
                  <HStack align="start">
                    <Textarea value={formData.comments} onChange={(e) => setFormData({ ...formData, comments: e.target.value })} onBlur={() => handleBlur('comments')} minH="80px" />
                    {saving.comments && <Spinner size="sm" />}
                    {saved.comments && <Text fontSize="12px" color="var(--color-primary)">✓ Saved</Text>}
                  </HStack>
                </VStack>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button onClick={onClose}>Close</Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger />
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export default EditLeadModal;
