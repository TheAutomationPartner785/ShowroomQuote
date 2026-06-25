import { useState, useEffect, useRef } from 'react';
import { Box, Input, Stack, Text, VStack } from '@chakra-ui/react';

const DealerCombobox = ({
  dealers = [],
  value,
  onChange,
  onBlur,
  disabled = false,
  loading = false,
  error = null,
  onRetry,
  placeholder = "Type to search dealer or account..."
}) => {
  const [inputValue, setInputValue] = useState('');
  const [selectedId, setSelectedId] = useState(value || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [validationError, setValidationError] = useState('');
  const inputRef = useRef(null);

  // Initialize input value when value prop changes (e.g., lead selected)
  useEffect(() => {
    if (value) {
      const dealer = dealers.find(d => d.id === value);
      if (dealer) {
        setInputValue(dealer.name);
        setSelectedId(dealer.id);
        setValidationError('');
      }
    } else {
      setInputValue('');
      setSelectedId('');
    }
  }, [value, dealers]);

  const filteredDealers = inputValue.trim() && showSuggestions
    ? dealers.filter(d => d.name.toLowerCase().includes(inputValue.toLowerCase())).slice(0, 20)
    : [];

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setShowSuggestions(true);
    setValidationError('');

    // Clear selected ID when user types (free text)
    if (newValue !== inputValue) {
      setSelectedId('');
    }
  };

  const handleSelect = (dealer) => {
    setInputValue(dealer.name);
    setSelectedId(dealer.id);
    setShowSuggestions(false);
    setValidationError('');
    onChange?.(dealer.id);
  };

  const handleFocus = () => {
    if (inputValue.trim()) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = () => {
    // Delay to allow click on suggestion to register
    setTimeout(() => {
      setShowSuggestions(false);

      // Validate: only accept if a dealer was actually selected
      if (inputValue.trim() && !selectedId) {
        setValidationError('Please select a dealer from the suggestions.');
      } else if (selectedId) {
        onBlur?.(selectedId);
      }
    }, 200);
  };

  const highlightMatch = (text, query) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <Text as="span" key={i} fontWeight="700">{part}</Text>
        : part
    );
  };

  return (
    <Box position="relative" w="full">
      <Input
        ref={inputRef}
        h="44px"
        bg="white"
        border="1px solid var(--color-border)"
        borderRadius="var(--radius-md)"
        value={loading ? 'Loading dealers...' : inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled || loading}
        placeholder={placeholder}
        opacity={disabled || loading ? '0.5' : '1'}
        _focus={{ borderColor: 'var(--color-primary)', outline: 'none' }}
      />

      {error && onRetry && (
        <Box mt="1">
          <Text fontSize="12px" color="red.500">Could not load dealers.</Text>
          <Text as="button" fontSize="12px" color="var(--color-primary)" fontWeight="600" onClick={onRetry} cursor="pointer">
            Retry
          </Text>
        </Box>
      )}

      {showSuggestions && filteredDealers.length > 0 && (
        <Box
          position="absolute"
          top="calc(100% + 4px)"
          left="0"
          right="0"
          bg="white"
          border="1px solid var(--color-border)"
          borderRadius="var(--radius-lg)"
          boxShadow="0 8px 24px rgba(0,0,0,0.12)"
          maxH="280px"
          overflowY="auto"
          zIndex="10"
        >
          <Stack gap="0">
            {filteredDealers.map((dealer) => (
              <Box
                key={dealer.id}
                as="button"
                type="button"
                minH="44px"
                px="12px"
                py="10px"
                display="flex"
                alignItems="center"
                bg={selectedId === dealer.id ? 'var(--color-primary-muted)' : 'white'}
                borderLeft={selectedId === dealer.id ? '3px solid var(--color-primary)' : 'none'}
                _hover={{ bg: 'var(--color-bg-subtle)' }}
                cursor="pointer"
                transition="all 0.15s"
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur before click registers
                  handleSelect(dealer);
                }}
                textAlign="left"
                w="full"
              >
                <Text
                  fontSize="14px"
                  color="var(--color-text-primary)"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                  title={dealer.name}
                >
                  {highlightMatch(dealer.name, inputValue)}
                </Text>
              </Box>
            ))}
          </Stack>
        </Box>
      )}

      {showSuggestions && inputValue.trim() && filteredDealers.length === 0 && (
        <Box
          position="absolute"
          top="calc(100% + 4px)"
          left="0"
          right="0"
          bg="white"
          border="1px solid var(--color-border)"
          borderRadius="var(--radius-lg)"
          boxShadow="0 8px 24px rgba(0,0,0,0.12)"
          p="24px"
          textAlign="center"
          zIndex="10"
        >
          <Text fontSize="14px" color="var(--color-text-secondary)">
            No matching accounts.
          </Text>
        </Box>
      )}

      {validationError && (
        <Text fontSize="12px" color="red.500" mt="4px">
          {validationError}
        </Text>
      )}
    </Box>
  );
};

export default DealerCombobox;
