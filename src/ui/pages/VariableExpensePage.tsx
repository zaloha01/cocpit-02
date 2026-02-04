/**
 * Variable Expense Page Component
 * 
 * Page for managing variable expenses (pohyblivé výdaje).
 * 
 * NOTE: No business logic here. Only UI rendering and action calls.
 */

'use client';

import { useEffect, useState } from 'react';
import { LocalStorageProvider } from '@/src/storage/LocalProvider';
import { createAppStateStore } from '@/src/appstate/AppStateStore';
import { createDefaultState } from '@/src/storage/schema';
import {
  addVariableExpenseEntry,
  updateVariableExpenseEntry,
  deleteVariableExpenseEntry,
  type VariableExpenseEntryInput,
} from '@/src/appstate/actions';
import { getVariableExpenseTotal } from '@/src/domain';
import type { AppState } from '@/src/storage/schema';
import type { MonthKey, Scope, VariableExpenseEntry } from '@/src/domain/models';
import { getCurrentMonthKey } from '@/src/domain/calc';

// Helper for CZK formatting
function formatCZK(amount: number): string {
  return (amount ?? 0).toLocaleString('cs-CZ');
}

export default function VariableExpensePage() {
  const [store] = useState(() => {
    const storage = new LocalStorageProvider();
    return createAppStateStore(storage);
  });
  const [state, setState] = useState<AppState>(createDefaultState());
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>(getCurrentMonthKey());
  const [selectedScope, setSelectedScope] = useState<Scope>('rodina');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<VariableExpenseEntryInput>({
    month: getCurrentMonthKey(),
    scope: 'rodina',
    direction: 'expense',
    amount: 0,
    categoryMain: '',
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

    if (!formData.categoryMain) {
      alert('Vyberte kategorii.');
      return;
    }

    if (editingId) {
      updateVariableExpenseEntry(store, editingId, formData);
      setEditingId(null);
    } else {
      addVariableExpenseEntry(store, formData);
    }

    setFormData({
      month: selectedMonth,
      scope: selectedScope,
      direction: 'expense',
      amount: 0,
      categoryMain: '',
    });
  };

  const handleEdit = (entry: VariableExpenseEntry) => {
    setEditingId(entry.id);
    setFormData({
      month: entry.month,
      scope: entry.scope,
      direction: entry.direction,
      amount: entry.amount,
      categoryMain: entry.categoryMain,
      categorySub: entry.categorySub,
      note: entry.note,
      date: entry.date,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({
      month: selectedMonth,
      scope: selectedScope,
      direction: 'expense',
      amount: 0,
      categoryMain: '',
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Opravdu chcete smazat tento výdaj?')) {
      deleteVariableExpenseEntry(store, id);
    }
  };

  // Render with default state if not yet initialized
  if (!isInitialized) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-4">Pohyblivé výdaje</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  // Get entries for selected month and scope
  const allEntries = state.variableExpenseLedger || [];
  const filteredEntries = allEntries.filter(
    (entry) => entry.month === selectedMonth && entry.scope === selectedScope
  );

  const total = getVariableExpenseTotal(state, selectedMonth, selectedScope);

  const categories = state.categories?.main || [];
  const scopes: Scope[] = ['rodina', 'ico', 'sro_karin', 'weecon'];

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold mb-4">Pohyblivé výdaje</h1>

      {/* Month and scope selector */}
      <section className="p-4 border rounded">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block mb-2 font-semibold">Vyberte měsíc (YYYY-MM):</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                const newMonth = e.target.value as MonthKey;
                setSelectedMonth(newMonth);
                setFormData({ ...formData, month: newMonth });
              }}
              className="p-2 border rounded w-full"
            />
          </div>
          <div>
            <label className="block mb-2 font-semibold">Scope:</label>
            <select
              value={selectedScope}
              onChange={(e) => {
                const newScope = e.target.value as Scope;
                setSelectedScope(newScope);
                setFormData({ ...formData, scope: newScope });
              }}
              className="p-2 border rounded w-full"
            >
              {scopes.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="bg-blue-50 p-3 rounded border">
          <p className="font-semibold">
            Celkem pro {selectedMonth} ({selectedScope}): {formatCZK(total)} CZK
          </p>
        </div>
      </section>

      {/* Add/Edit form */}
      <section className="p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">
          {editingId ? 'Upravit výdaj' : 'Přidat výdaj'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <label className="block mb-1">Kategorie *</label>
              <select
                value={formData.categoryMain}
                onChange={(e) => setFormData({ ...formData, categoryMain: e.target.value })}
                className="w-full p-2 border rounded"
                required
              >
                <option value="">Vyberte kategorii</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1">Podkategorie (volitelné)</label>
              <input
                type="text"
                value={formData.categorySub || ''}
                onChange={(e) => setFormData({ ...formData, categorySub: e.target.value || undefined })}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block mb-1">Datum (volitelné)</label>
              <input
                type="date"
                value={formData.date || ''}
                onChange={(e) => setFormData({ ...formData, date: e.target.value || undefined })}
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block mb-1">Poznámka (volitelné)</label>
              <input
                type="text"
                value={formData.note || ''}
                onChange={(e) => setFormData({ ...formData, note: e.target.value || undefined })}
                className="w-full p-2 border rounded"
              />
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

      {/* Entries list */}
      <section className="p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">
          Seznam výdajů pro {selectedMonth} ({selectedScope})
        </h2>
        {filteredEntries.length === 0 ? (
          <p className="text-gray-600">Žádné výdaje pro tento měsíc a scope</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Datum</th>
                  <th className="border p-2 text-left">Kategorie</th>
                  <th className="border p-2 text-left">Podkategorie</th>
                  <th className="border p-2 text-left">Částka</th>
                  <th className="border p-2 text-left">Poznámka</th>
                  <th className="border p-2 text-left">Akce</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="border p-2">{entry.date || '-'}</td>
                    <td className="border p-2">{entry.categoryMain}</td>
                    <td className="border p-2">{entry.categorySub || '-'}</td>
                    <td className="border p-2">{formatCZK(entry.amount)} CZK</td>
                    <td className="border p-2">{entry.note || '-'}</td>
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
