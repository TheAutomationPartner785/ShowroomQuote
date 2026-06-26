import { Box, Flex, Button, Dialog, Portal, Text, VStack } from '@chakra-ui/react';
import { useState } from 'react';
import { X, ArrowLeft, ArrowRight, Home } from 'lucide-react';

const BottomActionBar = ({ onCancel, onPrevious, onNext, nextDisabled, currentStep }) => {
  const [showPrevConfirm, setShowPrevConfirm] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);

  const handlePrevClick = () => {
    if (currentStep === 1) {
      onCancel();
    } else if (currentStep === 4) {
      onCancel();
    } else {
      setShowPrevConfirm(true);
    }
  };

  const confirmPrevious = () => {
    setShowPrevConfirm(false);
    onPrevious();
  };

  const handleNextClick = () => {
    if (currentStep === 4) {
      setShowFinishConfirm(true);
    } else {
      onNext();
    }
  };

  const confirmFinish = () => {
    setShowFinishConfirm(false);
    onNext();
  };

  const getLeftButtonLabel = () => {
    if (currentStep === 1) return 'CANCEL';
    if (currentStep === 4) return '← INTERNAL GO BACK (Edit Mode)';
    return '← PREVIOUS STEP';
  };

  const getRightButtonLabel = () => {
    if (currentStep === 1) return 'NEXT STEP: ADD PRODUCTS';
    if (currentStep === 3) return 'GENERATE & SEND QUOTE';
    if (currentStep === 4) return '🏠 FINISH & CLEAR FOR NEXT LEAD';
    return 'NEXT: REVIEW QUOTE';
  };

  return (
    <Box position="fixed" bottom="0" left="0" right="0" h={{ base: '64px', md: '72px' }} bg="white" borderTop="1px solid var(--color-border)" boxShadow="0 -2px 8px rgba(0, 0, 0, 0.05)" zIndex="10">
      <Flex h="full" px={{ base: '12px', md: '24px' }} gap={{ base: '8px', md: '16px' }}>
        <Button flex="1" h={{ base: '48px', md: '56px' }} px="8px" bg="white" border="2px solid var(--color-text-primary)" color="var(--color-text-primary)" fontSize={{ base: '12px', md: '16px' }} fontWeight="700" borderRadius="var(--radius-md)" _hover={{ bg: 'var(--color-bg-subtle)' }} display="flex" gap="6px" lineHeight="1.1" onClick={handlePrevClick}>{currentStep === 1 ? <X size={18} /> : <ArrowLeft size={18} />}{getLeftButtonLabel()}</Button>

        <Button flex="1" h={{ base: '48px', md: '56px' }} px="8px" bg={nextDisabled ? 'var(--color-primary-disabled)' : 'var(--color-primary)'} color="white" fontSize={{ base: '12px', md: '16px' }} fontWeight="700" borderRadius="var(--radius-md)" _hover={nextDisabled ? {} : { bg: 'var(--color-primary-hover)' }} disabled={nextDisabled} cursor={nextDisabled ? 'not-allowed' : 'pointer'} display="flex" gap="6px" lineHeight="1.1" onClick={handleNextClick}>{getRightButtonLabel()} {currentStep === 4 ? <Home size={18} /> : <ArrowRight size={18} />}</Button>
      </Flex>

      <Dialog.Root open={showPrevConfirm} onOpenChange={(e) => setShowPrevConfirm(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header><Dialog.Title>Go back to Lead Selection?</Dialog.Title></Dialog.Header>
              <Dialog.Body>Your current product selection will be lost if you go back. Are you sure?</Dialog.Body>
              <Dialog.Footer gap="2">
                <Button variant="outline" onClick={() => setShowPrevConfirm(false)}>Cancel</Button>
                <Button onClick={confirmPrevious}>Go Back</Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger />
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>

      <Dialog.Root open={showFinishConfirm} onOpenChange={(e) => setShowFinishConfirm(e.open)}>
        <Portal>
          <Dialog.Backdrop />
          <Dialog.Positioner>
            <Dialog.Content>
              <Dialog.Header><Dialog.Title>Finish this quote?</Dialog.Title></Dialog.Header>
              <Dialog.Body>You'll return to the start of the app for a new customer. The saved quote items will remain on this lead in Monday.</Dialog.Body>
              <Dialog.Footer gap="2">
                <Button variant="outline" onClick={() => setShowFinishConfirm(false)}>Cancel</Button>
                <Button colorPalette="green" onClick={confirmFinish}>Finish</Button>
              </Dialog.Footer>
              <Dialog.CloseTrigger />
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </Box>
  );
};

export default BottomActionBar;
