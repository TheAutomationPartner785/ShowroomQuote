import { Box, Flex, Text, VStack } from '@chakra-ui/react';
import { Check } from 'lucide-react';

const StepIndicator = ({ steps, currentStep }) => {
  return (
    <Flex justify="center" align="center" py="32px" gap="48px">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isPast = stepNumber < currentStep;

        // Step 3 and Step 4 use blue when active (per mockup)
        const activeBg = (stepNumber === 3 || stepNumber === 4) && isActive ? 'var(--color-accent-blue)' : 'var(--color-primary)';

        return (
          <Flex key={index} align="center" gap="48px">
            <VStack gap="12px">
              <Box
                w="48px"
                h="48px"
                borderRadius="50%"
                bg={isActive || isPast ? activeBg : 'transparent'}
                border={isActive || isPast ? 'none' : '2px solid var(--color-border)'}
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                {isPast ? <Check size={24} color="white" /> : <Text fontSize="18px" fontWeight="700" color={isActive ? 'white' : 'var(--color-text-secondary)'}>{stepNumber}</Text>}
              </Box>
              <Text fontSize="14px" fontWeight={isActive ? '700' : '400'} color={isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'} textAlign="center" maxW="120px">{step}</Text>
            </VStack>

            {index < steps.length - 1 && <Box w="80px" h="2px" bg={isPast ? 'var(--color-primary)' : 'var(--color-border)'} />}
          </Flex>
        );
      })}
    </Flex>
  );
};

export default StepIndicator;
