import { Box, VStack, Text } from '@chakra-ui/react';

const QuoteSummaryCard = ({ itemCount, subtotal, dealValue }) => {
  const formatPrice = (price) => {
    return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <VStack align="stretch" gap="12px">
      <Text fontSize="14px" fontWeight="600" color="var(--color-text-secondary)">SUMMARY</Text>

      <Box bg="var(--color-bg-subtle)" border="1px solid var(--color-border)" borderRadius="var(--radius-lg)" p="20px">
        <VStack align="stretch" gap="16px">
          <Text fontSize="16px" fontWeight="600" color="var(--color-text-primary)">Quote Summary</Text>

          <VStack align="stretch" gap="8px" borderBottom="1px solid var(--color-border)" pb="16px">
            <Text fontSize="13px" color="var(--color-text-secondary)">Items: <Text as="span" fontWeight="600" color="var(--color-text-primary)">{itemCount}</Text></Text>
            <Text fontSize="13px" color="var(--color-text-secondary)">Subtotal: <Text as="span" fontWeight="600" color="var(--color-text-primary)" fontFamily="monospace">{formatPrice(subtotal)}</Text></Text>
          </VStack>

          <VStack align="stretch" gap="4px">
            <Text fontSize="12px" color="var(--color-text-secondary)">Total Deal Value</Text>
            <Text fontSize="28px" fontWeight="700" color="var(--color-primary)" fontFamily="monospace" letterSpacing="-0.02em">{formatPrice(dealValue)}</Text>
            <Text fontSize="11px" color="var(--color-text-secondary)">Only 'Included' items sum to Deal Value</Text>
          </VStack>
        </VStack>
      </Box>
    </VStack>
  );
};

export default QuoteSummaryCard;
