import { useState, useRef, useEffect } from 'react';
import { Box, Input, Popover, Portal, Stack, Text, VStack, Spinner } from '@chakra-ui/react';
import { Search, ChevronDown } from 'lucide-react';

const SearchableSelect = ({
  options = [],
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  const triggerRef = useRef(null);

  const selectedOption = options.find(o => o.value === value);

  const filteredOptions = searchQuery.trim()
    ? options.filter(o => o.label.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 100)
    : options.slice(0, 100);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSelect = (option) => {
    onChange?.(option.value);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleOpen = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  return (
    <Popover.Root open={isOpen} onOpenChange={({ open }) => setIsOpen(open)} positioning={{ placement: 'bottom-start' }}>
      <Popover.Trigger asChild>
        <Box
          ref={triggerRef}
          as="button"
          h="44px"
          w="full"
          px="12px"
          bg="white"
          border="1px solid var(--color-border)"
          borderRadius="var(--radius-md)"
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          cursor={disabled ? 'not-allowed' : 'pointer'}
          opacity={disabled ? '0.5' : '1'}
          _hover={disabled ? {} : { borderColor: 'var(--color-primary)' }}
          onClick={handleOpen}
          type="button"
        >
          <Text fontSize="14px" color={selectedOption ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}>
            {selectedOption?.label || placeholder}
          </Text>
          <ChevronDown size={16} color="var(--color-text-secondary)" />
        </Box>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            bg="white"
            border="1px solid var(--color-border)"
            borderRadius="var(--radius-lg)"
            boxShadow="0 8px 24px rgba(0,0,0,0.12)"
            w="400px"
            maxH="400px"
            p="0"
          >
            <VStack gap="0" align="stretch">
              <Box p="12px" borderBottom="1px solid var(--color-border)">
                <Box position="relative">
                  <Search
                    size={16}
                    color="var(--color-text-secondary)"
                    style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <Input
                    ref={searchInputRef}
                    pl="36px"
                    h="40px"
                    fontSize="14px"
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    border="1px solid var(--color-border)"
                    borderRadius="var(--radius-md)"
                    _focus={{ borderColor: 'var(--color-primary)', outline: 'none' }}
                    autoFocus
                  />
                </Box>
              </Box>

              <Box maxH="320px" overflowY="auto">
                {filteredOptions.length === 0 ? (
                  <Box p="24px" textAlign="center">
                    <Text fontSize="14px" color="var(--color-text-secondary)">
                      No matching accounts.
                    </Text>
                  </Box>
                ) : (
                  <Stack gap="0">
                    {filteredOptions.map((option) => (
                      <Box
                        key={option.value}
                        as="button"
                        minH="44px"
                        px="12px"
                        py="10px"
                        display="flex"
                        alignItems="center"
                        bg={value === option.value ? 'var(--color-primary-muted)' : 'white'}
                        borderLeft={value === option.value ? '3px solid var(--color-primary)' : 'none'}
                        _hover={{ bg: 'var(--color-bg-subtle)' }}
                        cursor="pointer"
                        transition="all 0.15s"
                        onClick={() => handleSelect(option)}
                        textAlign="left"
                        w="full"
                        type="button"
                      >
                        <Text
                          fontSize="14px"
                          color="var(--color-text-primary)"
                          fontWeight={value === option.value ? '600' : '400'}
                          overflow="hidden"
                          textOverflow="ellipsis"
                          whiteSpace="nowrap"
                          title={option.label}
                        >
                          {option.label}
                        </Text>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>

              {searchQuery && filteredOptions.length === 100 && (
                <Box p="8px" borderTop="1px solid var(--color-border)" bg="var(--color-bg-subtle)">
                  <Text fontSize="12px" color="var(--color-text-secondary)" textAlign="center">
                    Showing first 100 matches. Continue typing to narrow results.
                  </Text>
                </Box>
              )}
            </VStack>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};

export default SearchableSelect;
