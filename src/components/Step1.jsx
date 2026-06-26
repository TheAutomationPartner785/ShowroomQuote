import { useState, useEffect, useMemo } from 'react';
import { Box, Grid, VStack, HStack, Text, Button, Input, IconButton, Spinner, Center, Badge, Tooltip, Portal, Menu, createListCollection, Select, Heading, Stack, Skeleton, Alert } from '@chakra-ui/react';
import { Search, Plus, Check, RotateCcw, X } from 'lucide-react';
import CreateLeadModal from './CreateLeadModal';
import DealerCombobox from './DealerCombobox';
import { useLeads } from '../hooks/useLeads';
import { useDealers } from '../hooks/useDealers';
import { LeadsEndCustomersBoard } from '@api/BoardSDK.js';

const leadsBoard = new LeadsEndCustomersBoard();

const Step1 = ({ selectedLead, setSelectedLead, onNext }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [editForm, setEditForm] = useState({ fullName: '', email: '', zipCode: '', dealer: '', comments: '' });
  const [savingField, setSavingField] = useState(null);
  const [savedField, setSavedField] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { leads, allLeadsCount, currentPage, totalPages, goToPage, nextPage, prevPage, loading, isLoadingMore, error, retry } = useLeads(searchQuery, dateFilter);
  const { dealers, loading: dealersLoading, error: dealersError, retry: retryDealers } = useDealers();

  useEffect(() => {
    if (selectedLead) {
      const dealerId = selectedLead.referOutDealer?.linkedItems?.[0]?.id || '';
      setEditForm({
        fullName: selectedLead.name || '',
        email: selectedLead.email?.email || '',
        zipCode: selectedLead.zipCode || '',
        dealer: dealerId,
        comments: selectedLead.comments || ''
      });
    }
  }, [selectedLead]);

  const handleSelectLead = (lead) => {
    if (selectedLead?.id === lead.id) {
      setSelectedLead(null);
      setEditForm({ fullName: '', email: '', zipCode: '', dealer: '', comments: '' });
    } else {
      setSelectedLead(lead);
    }
  };

  const handleFieldBlur = async (field, value) => {
    if (!selectedLead) return;
    setSavingField(field);
    try {
      const updateData = {};
      if (field === 'fullName') updateData.name = value;
      if (field === 'email') updateData.email = { email: value, label: value };
      if (field === 'zipCode') updateData.zipCode = value;
      if (field === 'dealer') updateData.referOutDealer = { linkedItems: [{ id: value }] };
      if (field === 'comments') updateData.comments = value;

      await leadsBoard.item(selectedLead.id).update(updateData).execute();
      setSavedField(field);
      setTimeout(() => setSavedField(null), 2000);
      setSelectedLead(prev => ({ ...prev, ...updateData, name: updateData.name || prev.name }));
    } catch (err) {
      console.error('Failed to save field:', err);
      alert('Save failed - please retry');
    } finally {
      setSavingField(null);
    }
  };

  const formatDate = (date) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Box px={{ base: '16px', md: '24px' }} pb="24px">
      <VStack align="start" gap="8px" mb="24px">
        <Heading fontSize={{ base: '24px', md: '32px' }} fontWeight="700" color="var(--color-text-primary)">Step 1: Customer Identification</Heading>
        <Text fontSize={{ base: '14px', md: '16px' }} color="var(--color-text-secondary)">Please select an existing lead or create a new one to begin.</Text>
      </VStack>

      <Grid templateColumns={{ base: '1fr', md: '60% 40%' }} gap={{ base: '16px', md: '24px' }}>
        <VStack align="stretch" gap="16px">
          <Box position="relative">
            <Search size={20} color="var(--color-text-secondary)" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)' }} />
            <Input pl="48px" pr={searchQuery.length > 0 ? "48px" : "16px"} h="48px" fontSize="16px" placeholder="Search by Name, Email, or Zip Code..." border="1px solid var(--color-border)" borderRadius="var(--radius-md)" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} _focus={{ borderColor: 'var(--color-primary)', outline: 'none' }} />
            {searchQuery.length > 0 && (
              <Button position="absolute" right="8px" top="50%" transform="translateY(-50%)" variant="ghost" size="xs" p="0" minW="32px" h="32px" onClick={() => { setSearchQuery(''); document.querySelector('input[placeholder*="Search"]')?.focus(); }} color="var(--color-text-secondary)" _hover={{ bg: 'var(--color-bg-subtle)' }}>
                <Box as={X} size={16} />
              </Button>
            )}
          </Box>
          <Box position="relative">
            <Input type="date" h="48px" fontSize="16px" pl="16px" pr={dateFilter ? "48px" : "16px"} border="1px solid var(--color-border)" borderRadius="var(--radius-md)" value={dateFilter} onChange={e => setDateFilter(e.target.value)} _focus={{ borderColor: 'var(--color-primary)', outline: 'none' }} />
            {dateFilter && (
              <Button position="absolute" right="8px" top="50%" transform="translateY(-50%)" variant="ghost" size="xs" p="0" minW="32px" h="32px" onClick={() => setDateFilter('')} color="var(--color-text-secondary)" _hover={{ bg: 'var(--color-bg-subtle)' }}>
                <Box as={X} size={16} />
              </Button>
            )}
          </Box>
          {error && (
            <Alert.Root colorPalette="red">
              <Alert.Title>Couldn't reach Monday</Alert.Title>
              <Alert.Description>{error}</Alert.Description>
              <Button size="sm" mt="2" onClick={retry}>Retry</Button>
            </Alert.Root>
          )}
          <Box overflowX="auto">
          <Box minW={{ base: '520px', md: '0' }} border="1px solid var(--color-border)" borderRadius="var(--radius-lg)" overflow="hidden">
            <Grid templateColumns="30% 25% 20% 25%" h="48px" bg="var(--color-bg-surface)" borderBottom="1px solid var(--color-border)" px="16px" alignItems="center">
              {['Name', 'Showroom Visit Date', 'Status', 'Action'].map(h => <Text key={h} fontSize="14px" fontWeight="600" color="var(--color-text-secondary)">{h}</Text>)}
            </Grid>
            {loading ? (
              <Box p="32px" textAlign="center">
                <Spinner size="lg" color="var(--color-primary)" />
                <Text mt="2" color="var(--color-text-secondary)">Loading leads...</Text>
              </Box>
            ) : leads.length === 0 ? (
              <Box p="32px" textAlign="center">
                <Text color="var(--color-text-secondary)">
                  {searchQuery ? 'No leads match your search.' : 'No leads with status "New Lead / Needs review" or "Appointment Booked".'}
                </Text>
              </Box>
            ) : (
              <>
                {leads.map((lead, i) => (
              <Grid key={lead.id} templateColumns="30% 25% 20% 25%" minH="56px" borderBottom={i < leads.length - 1 ? '1px solid var(--color-border)' : 'none'} px="16px" alignItems="center" bg={selectedLead?.id === lead.id ? 'var(--color-primary-muted)' : 'white'} borderLeft={selectedLead?.id === lead.id ? '4px solid var(--color-primary)' : 'none'} _hover={{ bg: selectedLead?.id === lead.id ? 'var(--color-primary-muted)' : 'var(--color-bg-subtle)' }} transition="all 0.15s" cursor="pointer" onClick={() => handleSelectLead(lead)}>
                <Text fontSize="15px" color="var(--color-text-primary)">{lead.name}</Text>
                <Text fontSize="15px" color="var(--color-text-secondary)">{formatDate(lead.showroomVisitDate)}</Text>
                <Text fontSize="15px" color="var(--color-text-secondary)">—</Text>
                <Button h="36px" px="16px" bg={selectedLead?.id === lead.id ? 'var(--color-primary)' : 'white'} border={selectedLead?.id === lead.id ? 'none' : '1px solid var(--color-text-primary)'} color={selectedLead?.id === lead.id ? 'white' : 'var(--color-text-primary)'} fontSize="13px" fontWeight="600" borderRadius="var(--radius-md)" onClick={(e) => { e.stopPropagation(); handleSelectLead(lead); }}>{selectedLead?.id === lead.id ? 'SELECTED' : 'SELECT'}</Button>
              </Grid>
                ))}
              </>
            )}
          </Box>
          </Box>
          {!loading && leads.length > 0 && (
            <Box display="flex" justifyContent="space-between" alignItems="center" mt="4" px="2">
              <Text fontSize="13px" color="var(--color-text-secondary)">
                Showing {(currentPage - 1) * 50 + 1}-{Math.min(currentPage * 50, allLeadsCount)} of {allLeadsCount} leads
              </Text>
              <Box display="flex" gap="2" alignItems="center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevPage}
                  disabled={currentPage === 1}
                  border="1px solid var(--color-border)"
                  color="var(--color-text-primary)"
                  _hover={{ bg: 'var(--color-bg-subtle)' }}
                  _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
                >
                  ← Previous
                </Button>
                <Text fontSize="13px" color="var(--color-text-secondary)" mx="2">
                  Page {currentPage} of {totalPages}
                </Text>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={currentPage === totalPages}
                  border="1px solid var(--color-border)"
                  color="var(--color-text-primary)"
                  _hover={{ bg: 'var(--color-bg-subtle)' }}
                  _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
                >
                  Next →
                </Button>
              </Box>
            </Box>
          )}
          {isLoadingMore && (
            <Text fontSize="13px" color="var(--color-text-secondary)" textAlign="center" mt="2">
              Loading more...
            </Text>
          )}
        </VStack>
        <VStack align="stretch" gap="16px">
          <Button h="56px" bg="white" border="2px solid var(--color-text-primary)" color="var(--color-text-primary)" fontSize="16px" fontWeight="700" borderRadius="var(--radius-md)" display="flex" gap="8px" onClick={() => setModalOpen(true)}><Plus size={20} />CREATE NEW WALK-IN LEAD</Button>
          <Box border="1px solid var(--color-border)" borderRadius="var(--radius-lg)" p="20px" bg="var(--color-bg-subtle)">
            <Text fontSize="16px" fontWeight="600" color="var(--color-text-primary)" mb="16px">Quick Lead Details (Editable)</Text>
            <Stack gap="12px">
              {[
                { field: 'fullName', label: 'Full Name', type: 'input' },
                { field: 'email', label: 'Email', type: 'input' },
                { field: 'zipCode', label: 'Zip Code', type: 'input' },
                { field: 'dealer', label: 'Refer Out (Dealer) *', type: 'dealer', loading: dealersLoading, error: dealersError },
                { field: 'comments', label: 'Comments', type: 'textarea' }
              ].map(({ field, label, type, loading: fieldLoading, error: fieldError }) => (
                <Box key={field}>
                  <Text fontSize="13px" fontWeight="500" color="var(--color-text-secondary)" mb="4px">{label} {savedField === field && <Text as="span" color="var(--color-primary)" fontSize="12px"><Check size={12} style={{ display: 'inline' }} /> Saved</Text>}</Text>
                  {type === 'dealer' ? <DealerCombobox dealers={dealers} value={editForm.dealer} onChange={id => setEditForm({ ...editForm, dealer: id })} onBlur={id => handleFieldBlur('dealer', id)} placeholder="Type to search dealer or account..." disabled={!selectedLead} loading={fieldLoading} error={fieldError} onRetry={retryDealers} /> : type === 'textarea' ? <Box as="textarea" h="80px" p="12px" bg="white" border="1px solid var(--color-border)" borderRadius="var(--radius-md)" resize="none" value={editForm[field]} onChange={e => setEditForm({ ...editForm, [field]: e.target.value })} onBlur={e => handleFieldBlur(field, e.target.value)} disabled={!selectedLead} opacity={!selectedLead ? '0.5' : '1'} /> : <Input h="44px" bg="white" border="1px solid var(--color-border)" borderRadius="var(--radius-md)" value={editForm[field]} onChange={e => setEditForm({ ...editForm, [field]: e.target.value })} onBlur={e => handleFieldBlur(field, e.target.value)} disabled={!selectedLead} opacity={!selectedLead ? '0.5' : '1'} />}
                  {savingField === field && <Spinner size="xs" mt="1" />}
                </Box>
              ))}
            </Stack>
          </Box>
        </VStack>
      </Grid>
      <CreateLeadModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onLeadCreated={(lead) => { retry(); setSelectedLead(lead); }} dealers={dealers} dealersLoading={dealersLoading} dealersError={dealersError} onRetryDealers={retryDealers} />
    </Box>
  );
};

export default Step1;
