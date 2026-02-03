/**
 * Home Page
 * 
 * Root page of the application.
 * Includes minimal storage test functionality.
 */

'use client';

import { useEffect, useState } from 'react';
import { LocalStorageProvider } from '@/src/storage/LocalProvider';
import { createAppStateStore } from '@/src/appstate/AppStateStore';
import { setCurrentBalance } from '@/src/appstate/actions';
import type { AppState } from '@/src/storage/schema';

export default function HomePage() {
  const [store] = useState(() => {
    const storage = new LocalStorageProvider();
    return createAppStateStore(storage);
  });
  const [state, setState] = useState<AppState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize store on mount
    store.init().then(() => {
      setState(store.getState());
      setIsInitialized(true);
    });

    // Subscribe to state changes
    const unsubscribe = store.subscribe(() => {
      setState(store.getState());
    });

    return unsubscribe;
  }, [store]);

  const handleSetBalanceTest = () => {
    setCurrentBalance(store, 12345);
  };

  if (!isInitialized) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-4">FinanceOS v2</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">FinanceOS v2</h1>
      <div className="space-y-4">
        <div>
          <p className="text-gray-600 mb-2">
            Current Balance (read-only): <span className="font-bold">{state?.wallet.currentBalance ?? 0} CZK</span>
          </p>
        </div>
        <div>
          <button
            onClick={handleSetBalanceTest}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Set balance test (12345)
          </button>
        </div>
        <div className="mt-4 text-sm text-gray-500">
          <p>Test: Click button, refresh page, balance should persist.</p>
        </div>
      </div>
    </div>
  );
}
