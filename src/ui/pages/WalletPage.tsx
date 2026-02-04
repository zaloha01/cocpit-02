/**
 * Wallet Page Component
 * 
 * Full history view for wallet checkpoints (weekly reconciliation).
 */

'use client';

import { useEffect, useState } from 'react';
import { LocalStorageProvider } from '@/src/storage/LocalProvider';
import { createAppStateStore } from '@/src/appstate/AppStateStore';
import { deleteWalletCheckpoint, addWalletCheckpoint } from '@/src/appstate/actions';
import { computeImpliedVariableSpendBetween } from '@/src/domain';
import type { AppState } from '@/src/storage/schema';
import type { WalletCheckpoint } from '@/src/domain';

// Helper for CZK formatting
function formatCZK(amount: number): string {
  return (amount ?? 0).toLocaleString('cs-CZ');
}

export default function WalletPage() {
  const [store] = useState(() => {
    const storage = new LocalStorageProvider();
    return createAppStateStore(storage);
  });
  const [state, setState] = useState<AppState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [walletCheckpointForm, setWalletCheckpointForm] = useState({
    amountActual: '',
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD, default today
    note: '',
  });

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

    return () => {
      unsubscribe();
    };
  }, [store]);

  if (!isInitialized || !state) {
    return <div className="p-4">Načítání...</div>;
  }

  const checkpoints = (state.walletCheckpoints || []).sort((a, b) => b.date.localeCompare(a.date)); // Newest first

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Stav peněženky – plná historie</h1>

      {/* Form to add checkpoint */}
      <section className="mb-6 p-4 border rounded bg-blue-50">
        <h2 className="text-xl font-semibold mb-4">Přidat nový checkpoint</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="block mb-1 text-sm font-medium">Datum</label>
            <input
              type="date"
              value={walletCheckpointForm.date}
              onChange={(e) => setWalletCheckpointForm({ ...walletCheckpointForm, date: e.target.value })}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Skutečný stav (CZK)</label>
            <input
              type="number"
              value={walletCheckpointForm.amountActual}
              onChange={(e) => setWalletCheckpointForm({ ...walletCheckpointForm, amountActual: e.target.value })}
              className="w-full p-2 border rounded"
              placeholder="0"
              step="0.01"
              required
            />
          </div>
          <div>
            <label className="block mb-1 text-sm font-medium">Poznámka (volitelné)</label>
            <input
              type="text"
              value={walletCheckpointForm.note}
              onChange={(e) => setWalletCheckpointForm({ ...walletCheckpointForm, note: e.target.value })}
              className="w-full p-2 border rounded"
              placeholder="Např. 'Po výplatě'"
            />
          </div>
        </div>
        <button
          onClick={() => {
            const amount = Number(walletCheckpointForm.amountActual);
            if (!walletCheckpointForm.date || !Number.isFinite(amount)) {
              alert('Vyplňte prosím datum a částku');
              return;
            }
            addWalletCheckpoint(store, {
              date: walletCheckpointForm.date,
              amountActual: amount,
              note: walletCheckpointForm.note || undefined,
            });
            setWalletCheckpointForm({
              amountActual: '',
              date: new Date().toISOString().split('T')[0],
              note: '',
            });
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Uložit stav
        </button>
      </section>

      {/* Full history */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Historie checkpointů</h2>
        {checkpoints.length === 0 ? (
          <div className="p-4 border rounded bg-gray-50 text-center text-gray-600">
            Zatím nejsou žádné checkpointy. Přidejte první pomocí formuláře výše.
          </div>
        ) : (
          <div className="space-y-3">
            {checkpoints.map((checkpoint) => {
              // Find previous checkpoint (older one)
              const sortedCheckpoints = [...state.walletCheckpoints].sort((a, b) => a.date.localeCompare(b.date));
              const currentIndex = sortedCheckpoints.findIndex((cp) => cp.id === checkpoint.id);
              const previousCheckpoint = currentIndex > 0 ? sortedCheckpoints[currentIndex - 1] : null;

              let impliedSpend: number | null = null;
              if (previousCheckpoint) {
                impliedSpend = computeImpliedVariableSpendBetween(state, previousCheckpoint, checkpoint);
              }

              return (
                <div key={checkpoint.id} className="p-4 bg-white rounded border">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-semibold text-lg">
                        {new Date(checkpoint.date).toLocaleDateString('cs-CZ', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                        {checkpoint.note && <span className="text-gray-600 ml-2">({checkpoint.note})</span>}
                      </div>
                      <div className="text-2xl font-bold text-blue-600 mt-2">
                        {formatCZK(checkpoint.amountActual)} CZK
                      </div>
                      {previousCheckpoint && impliedSpend !== null && (
                        <div className="mt-3 p-3 bg-gray-50 rounded">
                          <div className="text-sm text-gray-600 mb-1">
                            Období: {new Date(previousCheckpoint.date).toLocaleDateString('cs-CZ')} →{' '}
                            {new Date(checkpoint.date).toLocaleDateString('cs-CZ')}
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-semibold ${
                                impliedSpend >= 0 ? 'text-red-600' : 'text-orange-600'
                              }`}
                            >
                              {impliedSpend >= 0
                                ? `-${formatCZK(impliedSpend)} CZK (odvozené pohyblivé výdaje)`
                                : `+${formatCZK(Math.abs(impliedSpend))} CZK (nesedí / přibylo jinak)`}
                            </span>
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                impliedSpend >= 0 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {impliedSpend >= 0 ? 'OK' : 'Warning'}
                            </span>
                          </div>
                        </div>
                      )}
                      {!previousCheckpoint && (
                        <div className="mt-2 text-sm text-gray-500">První checkpoint (žádné srovnání)</div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('Opravdu chcete smazat tento checkpoint?')) {
                          deleteWalletCheckpoint(store, checkpoint.id);
                        }
                      }}
                      className="ml-4 px-3 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Smazat
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
