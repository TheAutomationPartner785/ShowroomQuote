import { useState } from 'react';
import { Box, Button, Dialog, Field, Input, Portal, Stack, Textarea, CloseButton, Alert, Spinner } from '@chakra-ui/react';
import { Plus } from 'lucide-react';
import { LeadsEndCustomersBoard } from '@api/BoardSDK.js';
import DealerCombobox from './DealerCombobox';

const leadsBoard = new LeadsEndCustomersBoard();

const CreateLeadModal = ({ isOpen, onClose, onLeadCreated, dealers = [], dealersLoading = false, dealersError = null, onRetryDealers }) => {
  const [form, setForm] = useState({ fullName: '', email: '', zipCode: '', dealer: '', comments: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const validate = () => {
    const newErrors = {};
    if (!form.fullName.trim()) newErrors.fullName = 'Full Name is required';
    if (!form.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = 'Email format is invalid';
    if (!form.zipCode.trim()) newErrors.zipCode = 'Zip Code is required';
    if (!form.dealer) newErrors.dealer = 'Referring Dealer is required';
    // Comments is now optional - no validation required
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validate()) return;

    setLoading(true);
    setError(null);
    try {
      const newLead = await leadsBoard.item().create({
        name: form.fullName,
        email: { email: form.email, label: form.email },
        zipCode: form.zipCode,
        referOutDealer: { linkedItems: [{ id: form.dealer }] },
        comments: form.comments || '',
        quotedDate: new Date() // Auto-set appointment time to now
      }).execute();

      onLeadCreated?.(newLead);
      setForm({ fullName: '', email: '', zipCode: '', dealer: '', comments: '' });
      onClose?.();
    } catch (err) {
      console.error('Failed to create lead:', err);
      setError('Could not create lead. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={({ open }) => !open && onClose?.()}>
      <Portal>
        <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content maxW="600px" rounded="2xl" border="1px solid" borderColor="var(--color-border)" boxShadow="0 24px 48px -12px rgba(0,0,0,0.25)">
            <Dialog.Header borderBottomWidth="1px" borderColor="var(--color-border)" pb="4">
              <Dialog.Title fontSize="xl" fontWeight="700" color="var(--color-text-primary)">New Walk-In Lead</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body py="6">
              {error && <Alert.Root colorPalette="red" mb="4"><Alert.Title>Error</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Root>}
              <Stack gap="4">
                <Field.Root invalid={!!errors.fullName}>
                  <Field.Label fontSize="sm" fontWeight="600" color="var(--color-text-primary)">Full Name *</Field.Label>
                  <Input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} h="44px" />
                  {errors.fullName && <Field.ErrorText>{errors.fullName}</Field.ErrorText>}
                </Field.Root>
                <Field.Root invalid={!!errors.email}>
                  <Field.Label fontSize="sm" fontWeight="600" color="var(--color-text-primary)">Email *</Field.Label>
                  <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} h="44px" />
                  {errors.email && <Field.ErrorText>{errors.email}</Field.ErrorText>}
                </Field.Root>
                <Field.Root invalid={!!errors.zipCode}>
                  <Field.Label fontSize="sm" fontWeight="600" color="var(--color-text-primary)">Zip Code *</Field.Label>
                  <Input value={form.zipCode} onChange={e => setForm({ ...form, zipCode: e.target.value })} h="44px" />
                  {errors.zipCode && <Field.ErrorText>{errors.zipCode}</Field.ErrorText>}
                </Field.Root>
                <Field.Root invalid={!!errors.dealer}>
                  <Field.Label fontSize="sm" fontWeight="600" color="var(--color-text-primary)">Referring Dealer *</Field.Label>
                  <DealerCombobox
                    dealers={dealers}
                    value={form.dealer}
                    onChange={id => setForm({ ...form, dealer: id })}
                    placeholder="Type to search dealer or account..."
                    loading={dealersLoading}
                    error={dealersError}
                    onRetry={onRetryDealers}
                  />
                  {errors.dealer && <Field.ErrorText>{errors.dealer}</Field.ErrorText>}
                </Field.Root>
                <Field.Root>
                  <Field.Label fontSize="sm" fontWeight="600" color="var(--color-text-primary)">Comments</Field.Label>
                  <Textarea value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} rows={3} />
                </Field.Root>
              </Stack>
            </Dialog.Body>
            <Dialog.Footer borderTopWidth="1px" borderColor="var(--color-border)" pt="4" gap="3">
              <Button variant="outline" rounded="xl" onClick={onClose}>Cancel</Button>
              <Button rounded="xl" fontWeight="600" onClick={handleCreate} disabled={loading} bg="var(--color-primary)" _hover={{ bg: 'var(--color-primary-hover)' }}>
                {loading ? <Spinner size="sm" /> : <><Plus size={18} /> Create Lead</>}
              </Button>
            </Dialog.Footer>
            <Dialog.CloseTrigger asChild><CloseButton size="sm" rounded="full" /></Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};

export default CreateLeadModal;
