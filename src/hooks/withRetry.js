/**
 * Retry wrapper for Monday API calls with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry configuration
 * @returns {Promise} - Result from fn or throws final error
 */
export const withRetry = async (fn, { maxAttempts = 3, baseDelayMs = 1000, operationName = 'API call' } = {}) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLastAttempt = attempt === maxAttempts;
      const isRetryable = isTimeoutError(err) || isTransientError(err);

      console.log(`[withRetry] ${operationName} attempt ${attempt} failed:`, err.message || err);

      if (isLastAttempt || !isRetryable) {
        console.error(`[withRetry] giving up after ${attempt} attempts`);
        throw err;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`[withRetry] attempt ${attempt} failed (${isRetryable ? 'retryable' : 'non-retryable'}), retrying in ${delay}ms`);
      await sleep(delay);
    }
  }
};

const isTimeoutError = (err) => {
  const msg = err?.message?.toLowerCase() || '';
  return msg.includes('timeout') || msg.includes('timed out') || msg.includes('network');
};

const isTransientError = (err) => {
  const status = err?.response?.status || err?.status;
  return status >= 500 && status < 600; // 5xx server errors
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
