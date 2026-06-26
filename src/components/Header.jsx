import { useState, useEffect } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { User } from 'lucide-react';
import { LeadsEndCustomersBoard } from '@api/BoardSDK.js';

const leadsBoard = new LeadsEndCustomersBoard();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const simpleFetch = async (operation) => {
  try {
    return await operation();
  } catch (err) {
    console.log('[Header] user fetch attempt 1 failed, retrying in 1.5s...');
    await sleep(1500);
    return await operation();
  }
};

const Header = () => {
  const [userName, setUserName] = useState('—');

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await simpleFetch(
          async () => await leadsBoard.users.me().execute()
        );
        setUserName(user.name || '—');
      } catch (err) {
        console.error('[Header] Failed to fetch user after retry:', err);
        // Fallback to placeholder - non-critical
        setUserName('—');
      }
    };
    fetchUser();
  }, []);

  return (
    <Box
      h={{ base: '56px', md: '64px' }}
      bg="white"
      borderBottom="1px solid"
      borderColor="var(--color-border)"
      px={{ base: '16px', md: '24px' }}
      position="sticky"
      top="0"
      zIndex="20"
    >
      <Flex h="full" align="center" justify="space-between" gap="12px">
        {/* Left: Title */}
        <Text
          fontSize={{ base: '18px', md: '24px' }}
          fontWeight="700"
          color="var(--color-text-primary)"
          letterSpacing="-0.02em"
          whiteSpace="nowrap"
        >
          Showroom Quote Pro
        </Text>

        {/* Right: Salesperson identity */}
        <Flex align="center" gap="10px" minW="0">
          <Flex
            w={{ base: '32px', md: '38px' }}
            h={{ base: '32px', md: '38px' }}
            borderRadius="full"
            bg="var(--color-primary-muted)"
            color="var(--color-primary)"
            align="center"
            justify="center"
            flexShrink="0"
          >
            <User size={18} />
          </Flex>
          <Box minW="0" lineHeight="1.2">
            <Text
              fontSize="11px"
              color="var(--color-text-secondary)"
              textTransform="uppercase"
              letterSpacing="0.04em"
              display={{ base: 'none', sm: 'block' }}
            >
              Salesperson
            </Text>
            <Text
              fontSize={{ base: '13px', md: '15px' }}
              fontWeight="600"
              color="var(--color-text-primary)"
              whiteSpace="nowrap"
              overflow="hidden"
              textOverflow="ellipsis"
            >
              {userName}
            </Text>
          </Box>
        </Flex>
      </Flex>
    </Box>
  );
};

export default Header;
