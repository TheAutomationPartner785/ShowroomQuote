import { Box, Flex, Text, VStack } from '@chakra-ui/react';
import { Check } from 'lucide-react';

const StepIndicator = ({ steps, currentStep }) => {
  return (
    <Flex
      justify="center"
      align="flex-start"
      py={{ base: '20px', md: '32px' }}
      px="12px"
      gap={{ base: '4px', sm: '16px', md: '48px' }}
    >
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isPast = stepNumber < currentStep;

        // Step 3 and Step 4 use blue when active (per mockup)
        const activeBg = (stepNumber === 3 || stepNumber === 4) && isActive ? 'var(--color-accent-blue)' : 'var(--color-primary)';

        return (
          <Flex key={index} align="flex-start" gap={{ base: '4px', sm: '16px', md: '48px' }}>
            <VStack gap={{ base: '6px', md: '12px' }}>
              <Box
                w={{ base: '36px', md: '48px' }}
                h={{ base: '36px', md: '48px' }}
                borderRadius="50%"
                bg={isActive || isPast ? activeBg : 'transparent'}
                border={isActive || isPast ? 'none' : '2px solid var(--color-border)'}
                display="flex"
                alignItems="center"
                justifyContent="center"
                flexShrink="0"
              >
                {isPast ? <Check size={20} color="white" /> : <Text fontSize={{ base: '15px', md: '18px' }} fontWeight="700" color={isActive ? 'white' : 'var(--color-text-secondary)'}>{stepNumber}</Text>}
              </Box>
              <Text fontSize={{ base: '11px', md: '14px' }} fontWeight={isActive ? '700' : '400'} color={isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'} textAlign="center" maxW={{ base: '64px', md: '120px' }} lineHeight="1.2">{step}</Text>
            </VStack>

            {index < steps.length - 1 && <Box w={{ base: '12px', sm: '32px', md: '80px' }} h="2px" bg={isPast ? 'var(--color-primary)' : 'var(--color-border)'} mt={{ base: '17px', md: '23px' }} />}
          </Flex>
        );
      })}
    </Flex>
  );
};

export default StepIndicator;
