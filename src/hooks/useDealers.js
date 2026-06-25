import { useState, useEffect } from 'react';
import { AccountsBoard } from '@api/BoardSDK.js';

const accountsBoard = new AccountsBoard();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const simpleFetch = async (operation, operationName) => {
  try {
    return await operation();
  } catch (err) {
    console.log(`[${operationName}] attempt 1 failed, retrying in 1.5s...`, err.message);
    await sleep(1500);
    return await operation();
  }
};

export const useDealers = () => {
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDealers = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await simpleFetch(
          async () => {
            return await accountsBoard.items()
              .where({ accountStatus: 'Active' })
              .orderBy({ column: 'name', direction: 'asc' })
              .withPagination({ limit: 100 })
              .execute();
          },
          'useDealers fetch'
        );

        console.log(`[useDealers] loaded ${result.items?.length || 0} dealers`);
        setDealers(result.items || []);
      } catch (err) {
        console.error('[useDealers] Failed to fetch dealers after retry:', err);
        setError('Failed to load dealers.');
      } finally {
        setLoading(false);
      }
    };

    fetchDealers();
  }, []);

  const retry = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await simpleFetch(
        async () => {
          return await accountsBoard.items()
            .where({ accountStatus: 'Active' })
            .orderBy({ column: 'name', direction: 'asc' })
            .withPagination({ limit: 100 })
            .execute();
        },
        'useDealers retry'
      );

      setDealers(result.items || []);
      setError(null);
    } catch (err) {
      console.error('[useDealers] Retry failed:', err);
      setError('Failed to load dealers.');
    } finally {
      setLoading(false);
    }
  };

  return { dealers, loading, error, retry };
};
