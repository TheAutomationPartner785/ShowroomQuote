import { useState, useEffect } from 'react';
import { Box, Flex, Text } from '@chakra-ui/react';
import { Menu } from 'lucide-react';
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
      h="64px"
      bg="white"
      borderBottom="1px solid"
      borderColor="var(--color-border)"
      px="24px"
    >
      <Flex h="full" align="center" justify="space-between">
        {/* Left: Hamburger + Title */}
        <Flex align="center" gap="16px">
          <Menu size={24} color="var(--color-text-primary)" />
          <Text
            fontSize="24px"
            fontWeight="700"
            color="var(--color-text-primary)"
            letterSpacing="-0.02em"
          >
            Showroom Quote Pro
          </Text>
        </Flex>

        {/* Right: Salesperson */}
        <Text fontSize="16px" color="var(--color-text-secondary)">
          Salesperson: <Text as="span" fontWeight="600" color="var(--color-text-primary)">{userName}</Text>
        </Text>
      </Flex>
    </Box>
  );
};

export default Header;
