import { ref, onMounted } from 'vue';

export function usePortfolio() {
  const loading = ref(false);
  const hasLoaded = ref(false);
  const error = ref('');
  const portfolio = ref({
    holdings: [],
    profitHistory: [],
    dividendHistory: [],
    summary: {},
  });
  const transactions = ref([]);
  async function loadAllData() {
    loading.value = true;
    error.value = '';
    try {
      const [portfolioResponse, transactionResponse] = await Promise.all([
        fetch('/api/portfolio'),
        fetch('/api/transactions'),
      ]);
      if (!portfolioResponse.ok || !transactionResponse.ok)
        throw new Error('Unable to load portfolio data. Please retry.');
      const [nextPortfolio, nextTransactions] = await Promise.all([
        portfolioResponse.json(),
        transactionResponse.json(),
      ]);
      portfolio.value = nextPortfolio;
      transactions.value = nextTransactions;
      hasLoaded.value = true;
    } catch (err) {
      error.value = err.message || 'Network error. Please retry.';
    } finally {
      loading.value = false;
    }
  }
  async function handleAddTransaction(txData, callback) {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txData),
      });
      const data = await response.json();
      if (!response.ok)
        return callback(false, data.error || 'Unable to record transaction.');
      await loadAllData();
      callback(true);
    } catch {
      callback(false, 'Network error. Please retry.');
    }
  }
  async function handleResetPortfolio() {
    if (
      !confirm(
        'This permanently replaces ALL your transactions with demo data. Continue?',
      )
    )
      return;
    try {
      const response = await fetch('/api/transactions?reset=true', {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Unable to reset data.');
      await loadAllData();
    } catch (err) {
      error.value = err.message;
    }
  }
  onMounted(loadAllData);
  return {
    loading,
    hasLoaded,
    error,
    portfolio,
    transactions,
    loadAllData,
    handleAddTransaction,
    handleResetPortfolio,
  };
}
