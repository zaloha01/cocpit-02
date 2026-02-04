/**
 * Income Page Component
 * 
 * Page for managing income entries (příjmy).
 * Supports planned and received incomes with person, title, amount, dates.
 * 
 * NOTE: No business logic here. Only UI rendering and action calls.
 */

'use client';

import { useEffect, useState } from 'react';
import { LocalStorageProvider } from '@/src/storage/LocalProvider';
import { createAppStateStore } from '@/src/appstate/AppStateStore';
import { createDefaultState } from '@/src/storage/schema';
import {
  addIncomeEntry,
  updateIncomeEntry,
  deleteIncomeEntry,
  setKarinAverageIncome,
  type IncomeEntryInput,
} from '@/src/appstate/actions';
import { getIncomePlannedTotal, getIncomeReceivedTotal, getKarinIncome } from '@/src/domain';
import type { AppState } from '@/src/storage/schema';
import type { MonthKey, IncomeEntry, Scope } from '@/src/domain/models';
import { getCurrentMonthKey } from '@/src/domain/calc';

// Helper for CZK formatting
function formatCZK(amount: number): string {
  return (amount ?? 0).toLocaleString('cs-CZ');
}

export default function IncomePage() {
  const [store] = useState(() => {
    const storage = new LocalStorageProvider();
    return createAppStateStore(storage);
  });
  const [state, setState] = useState<AppState>(createDefaultState());
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>(getCurrentMonthKey());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'planned' | 'received'>('all');
  const [formData, setFormData] = useState<IncomeEntryInput>({
    person: 'Karin',
    title: '',
    amount: 0,
    status: 'received',
    scope: 'rodina',
  });

  useEffect(() => {
    store.init().then(() => {
      setState(store.getState());
      setIsInitialized(true);
    });

    const unsubscribe = store.subscribe(() => {
      setState(store.getState());
    });

    return unsubscribe;
  }, [store]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate dates based on status
    if (formData.status === 'planned' && !formData.expectedDate) {
      alert('Pro plánovaný příjem je nutné zadat očekávané datum.');
      return;
    }
    if (formData.status === 'received' && !formData.receivedDate) {
      alert('Pro přijatý příjem je nutné zadat datum přijetí.');
      return;
    }

    if (editingId) {
      updateIncomeEntry(store, editingId, formData);
      setEditingId(null);
    } else {
      addIncomeEntry(store, formData);
    }

    setFormData({
      person: 'Karin',
      title: '',
      amount: 0,
      status: 'received',
      scope: 'rodina',
    });
  };

  const handleEdit = (entry: IncomeEntry) => {
    setEditingId(entry.id);
    setFormData({
      person: entry.person,
      title: entry.title,
      amount: entry.amount,
      expectedDate: entry.expectedDate,
      receivedDate: entry.receivedDate,
      status: entry.status,
      confidence: entry.confidence,
      scope: entry.scope,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({
      person: 'Karin',
      title: '',
      amount: 0,
      status: 'received',
      scope: 'rodina',
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Opravdu chcete smazat tento příjem?')) {
      deleteIncomeEntry(store, id);
    }
  };

  // Render with default state if not yet initialized
  if (!isInitialized) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-4">Příjmy</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  // Get incomes for selected month
  const allEntries = state.incomeEntries || [];
  const monthEntries = allEntries.filter((entry) => {
    const date = entry.status === 'received' ? entry.receivedDate : entry.expectedDate;
    if (!date) return false;
    const dateParts = date.split('-');
    if (dateParts.length < 2) return false;
    const entryMonth = `${dateParts[0]}-${dateParts[1]}`;
    return entryMonth === selectedMonth;
  });

  const filteredEntries =
    statusFilter === 'all'
      ? monthEntries
      : monthEntries.filter((entry) => entry.status === statusFilter);

  const incomePlannedTotal = getIncomePlannedTotal(state, selectedMonth);
  const incomeReceivedTotal = getIncomeReceivedTotal(state, selectedMonth);
  const karinIncome = getKarinIncome(state, selectedMonth);

  const scopes: (Scope | 'other')[] = ['rodina', 'ico', 'sro_karin', 'weecon', 'other'];

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold mb-4">Příjmy</h1>

      {/* Settings: Karin average */}
      <section className="p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">Nastavení</h2>
        <div className="flex items-center gap-4">
          <label>
            Karin průměr (CZK):
            <span className="ml-2 text-sm text-gray-600" title="Baseline příjem pro Karin, pokud není zadán konkrétní přijatý příjem">
              ℹ️
            </span>
          </label>
          <input
            type="number"
            value={state.settings?.karinAverageIncome || 53000}
            onChange={(e) => setKarinAverageIncome(store, parseFloat(e.target.value) || 0)}
            className="p-2 border rounded w-32"
            min="0"
            step="0.01"
          />
          <span className="text-sm text-gray-600">
            (Baseline příjem pro Karin, pokud není zadán konkrétní přijatý příjem)
          </span>
        </div>
      </section>

      {/* Month selector and summary */}
      <section className="p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">Příjmy pro měsíc</h2>
        <div className="mb-4">
          <label className="block mb-2">Vyberte měsíc (YYYY-MM):</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value as MonthKey)}
            className="p-2 border rounded"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-green-50 p-3 rounded border">
            <h3 className="font-semibold text-sm text-gray-600 mb-1">PŘÍJEM CELKEM (přišlo)</h3>
            <p className="text-2xl font-bold">{formatCZK(incomeReceivedTotal)} CZK</p>
          </div>
          <div className="bg-blue-50 p-3 rounded border">
            <h3 className="font-semibold text-sm text-gray-600 mb-1">PŘÍJMY (plán)</h3>
            <p className="text-2xl font-bold">{formatCZK(incomePlannedTotal)} CZK</p>
          </div>
          <div className="bg-purple-50 p-3 rounded border">
            <h3 className="font-semibold text-sm text-gray-600 mb-1">Karin příjem</h3>
            <p className="text-2xl font-bold">{formatCZK(karinIncome)} CZK</p>
          </div>
        </div>
      </section>

      {/* Add/Edit form */}
      <section className="p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">
          {editingId ? 'Upravit příjem' : 'Přidat příjem'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-1">Osoba</label>
              <select
                value={formData.person}
                onChange={(e) =>
                  setFormData({ ...formData, person: e.target.value as 'Karin' | 'Karel' | 'Other' })
                }
                className="w-full p-2 border rounded"
                required
              >
                <option value="Karin">Karin</option>
                <option value="Karel">Karel</option>
                <option value="Other">Ostatní</option>
              </select>
            </div>
            <div>
              <label className="block mb-1">Název</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-2 border rounded"
                placeholder="např. Výplata, DPH, Bonus"
                required
              />
            </div>
            <div>
              <label className="block mb-1">Částka (CZK)</label>
              <input
                type="number"
                value={formData.amount || ''}
                onChange={(e) =>
                  setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                }
                className="w-full p-2 border rounded"
                min="0"
                step="0.01"
                required
              />
            </div>
            <div>
              <label className="block mb-1">Status</label>
              <select
                value={formData.status}
                onChange={(e) => {
                  const newStatus = e.target.value as 'planned' | 'received';
                  setFormData({
                    ...formData,
                    status: newStatus,
                    expectedDate: newStatus === 'planned' ? formData.expectedDate : undefined,
                    receivedDate: newStatus === 'received' ? formData.receivedDate : undefined,
                  });
                }}
                className="w-full p-2 border rounded"
                required
              >
                <option value="planned">Plánovaný</option>
                <option value="received">Přijatý</option>
              </select>
            </div>
            {formData.status === 'planned' && (
              <div>
                <label className="block mb-1">Očekávané datum (YYYY-MM-DD) *</label>
                <input
                  type="date"
                  value={formData.expectedDate || ''}
                  onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
            )}
            {formData.status === 'received' && (
              <div>
                <label className="block mb-1">Datum přijetí (YYYY-MM-DD) *</label>
                <input
                  type="date"
                  value={formData.receivedDate || ''}
                  onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
            )}
            <div>
              <label className="block mb-1">Scope</label>
              <select
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value as Scope | 'other' })}
                className="w-full p-2 border rounded"
                required
              >
                {scopes.map((scope) => (
                  <option key={scope} value={scope}>
                    {scope}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {editingId ? 'Uložit' : 'Přidat'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Zrušit
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Income list */}
      <section className="p-4 border rounded">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Seznam příjmů pro {selectedMonth}</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded text-sm ${
                statusFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              Vše
            </button>
            <button
              onClick={() => setStatusFilter('planned')}
              className={`px-3 py-1 rounded text-sm ${
                statusFilter === 'planned' ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              Plánované
            </button>
            <button
              onClick={() => setStatusFilter('received')}
              className={`px-3 py-1 rounded text-sm ${
                statusFilter === 'received' ? 'bg-blue-500 text-white' : 'bg-gray-200'
              }`}
            >
              Přijaté
            </button>
          </div>
        </div>
        {filteredEntries.length === 0 ? (
          <p className="text-gray-600">Žádné příjmy pro tento měsíc</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Osoba</th>
                  <th className="border p-2 text-left">Název</th>
                  <th className="border p-2 text-left">Částka</th>
                  <th className="border p-2 text-left">Status</th>
                  <th className="border p-2 text-left">Datum</th>
                  <th className="border p-2 text-left">Scope</th>
                  <th className="border p-2 text-left">Akce</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="border p-2">{entry.person}</td>
                    <td className="border p-2">{entry.title}</td>
                    <td className="border p-2">{formatCZK(entry.amount)} CZK</td>
                    <td className="border p-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          entry.status === 'received'
                            ? 'bg-green-200 text-green-800'
                            : 'bg-yellow-200 text-yellow-800'
                        }`}
                      >
                        {entry.status === 'received' ? 'Přijatý' : 'Plánovaný'}
                      </span>
                    </td>
                    <td className="border p-2">
                      {entry.status === 'received' ? entry.receivedDate : entry.expectedDate}
                    </td>
                    <td className="border p-2">{entry.scope}</td>
                    <td className="border p-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(entry)}
                          className="px-2 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                        >
                          Upravit
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="px-2 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                        >
                          Smazat
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
