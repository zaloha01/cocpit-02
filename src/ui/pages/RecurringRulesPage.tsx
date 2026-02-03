/**
 * Recurring Rules Page Component
 * 
 * Page for managing recurring payment rules (trvalé platby).
 * Allows adding, editing, and managing payment rules.
 * 
 * NOTE: No business logic here. Only UI rendering and action calls.
 */

'use client';

import { useEffect, useState } from 'react';
import { LocalStorageProvider } from '@/src/storage/LocalProvider';
import { createAppStateStore } from '@/src/appstate/AppStateStore';
import {
  addRecurringRule,
  updateRecurringRule,
  deleteRecurringRule,
  toggleRecurringRuleActive,
  type RecurringRuleInput,
} from '@/src/appstate/actions';
import type { AppState } from '@/src/storage/schema';
import type { RecurringRule, Scope } from '@/src/domain/models';

export default function RecurringRulesPage() {
  const [store] = useState(() => {
    const storage = new LocalStorageProvider();
    return createAppStateStore(storage);
  });
  const [state, setState] = useState<AppState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<RecurringRuleInput>({
    name: '',
    amount: 0,
    frequency: 'monthly',
    scope: 'rodina',
    categoryMain: '',
    isSplitEnabled: false,
    spreadEnabled: false,
    spreadMonths: 1,
    spreadMode: 'catchup',
    active: true,
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
    
    // Validate: if spreadEnabled, dueDate must be present
    if (formData.spreadEnabled && !formData.dueDate) {
      alert('Při zapnutém rozpočítání je nutné zadat datum splatnosti.');
      return;
    }
    
    if (editingId) {
      updateRecurringRule(store, editingId, formData);
      setEditingId(null);
    } else {
      addRecurringRule(store, formData);
    }
    setFormData({
      name: '',
      amount: 0,
      frequency: 'monthly',
      scope: 'rodina',
      categoryMain: '',
      isSplitEnabled: false,
      spreadEnabled: false,
      spreadMonths: 1,
      spreadMode: 'catchup',
      active: true,
    });
  };

  const handleEdit = (rule: RecurringRule) => {
    setEditingId(rule.id);
    setFormData({
      name: rule.name,
      amount: Math.abs(rule.amount), // Convert to positive for display
      frequency: rule.frequency,
      scope: rule.scope,
      categoryMain: rule.categoryMain,
      categorySub: rule.categorySub,
      isSplitEnabled: rule.isSplitEnabled ?? false,
      splitMonths: rule.splitMonths,
      spreadEnabled: rule.spreadEnabled ?? false,
      spreadMonths: rule.spreadMonths ?? 1,
      spreadStartMonth: rule.spreadStartMonth,
      spreadMode: rule.spreadMode ?? 'catchup',
      dueDate: rule.dueDate,
      active: rule.active,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({
      name: '',
      amount: 0,
      frequency: 'monthly',
      scope: 'rodina',
      categoryMain: '',
      isSplitEnabled: false,
      spreadEnabled: false,
      spreadMonths: 1,
      spreadMode: 'catchup',
      active: true,
    });
  };

  if (!isInitialized || !state) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-4">Trvalé platby</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  const rules = state.recurringRules || [];
  const categories = state.settings.categoryMain || [];
  const scopes: Scope[] = ['rodina', 'ico', 'sro_karin', 'weecon'];

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Trvalé platby</h1>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mb-8 p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">
          {editingId ? 'Upravit pravidlo' : 'Přidat pravidlo'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">Název</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-2 border rounded"
              required
            />
          </div>
          <div>
            <label className="block mb-1">Částka (CZK)</label>
            <input
              type="number"
              value={formData.amount || ''}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              className="w-full p-2 border rounded"
              min="0"
              step="0.01"
              required
            />
          </div>
          <div>
            <label className="block mb-1">Frekvence</label>
            <select
              value={formData.frequency}
              onChange={(e) =>
                setFormData({ ...formData, frequency: e.target.value as RecurringRule['frequency'] })
              }
              className="w-full p-2 border rounded"
            >
              <option value="monthly">Měsíčně</option>
              <option value="weekly">Týdně</option>
              <option value="quarterly">Čtvrtletně</option>
              <option value="yearly">Ročně</option>
            </select>
          </div>
          <div>
            <label className="block mb-1">Scope</label>
            <select
              value={formData.scope}
              onChange={(e) => setFormData({ ...formData, scope: e.target.value as Scope })}
              className="w-full p-2 border rounded"
            >
              {scopes.map((scope) => (
                <option key={scope} value={scope}>
                  {scope}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1">Hlavní kategorie</label>
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
            <label className="block mb-1">Rozpočítat</label>
            <input
              type="checkbox"
              checked={formData.spreadEnabled || false}
              onChange={(e) => setFormData({ ...formData, spreadEnabled: e.target.checked })}
              className="mr-2"
            />
            <span>Rozpočítat měsíčně</span>
          </div>
          {formData.spreadEnabled && (
            <>
              <div>
                <label className="block mb-1">Typ rozpočítání</label>
                <select
                  value={formData.spreadMode || 'catchup'}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      spreadMode: e.target.value as 'fixed' | 'catchup',
                    })
                  }
                  className="w-full p-2 border rounded"
                >
                  <option value="catchup">Dynamické (dohánění)</option>
                  <option value="fixed">Pevné (statické)</option>
                </select>
              </div>
              <div>
                <label className="block mb-1">Počet měsíců (1-24)</label>
                <input
                  type="number"
                  value={formData.spreadMonths || 1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 1;
                    const clamped = Math.max(1, Math.min(24, val));
                    setFormData({
                      ...formData,
                      spreadMonths: clamped,
                    });
                  }}
                  className="w-full p-2 border rounded"
                  min="1"
                  max="24"
                  required
                />
              </div>
              <div>
                <label className="block mb-1">
                  Datum splatnosti
                  {formData.spreadEnabled && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="date"
                  value={formData.dueDate || ''}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value || undefined })}
                  className="w-full p-2 border rounded"
                  required={formData.spreadEnabled}
                />
                {formData.spreadEnabled && !formData.dueDate && (
                  <p className="text-sm text-red-500 mt-1">Datum splatnosti je povinné při zapnutém rozpočítání</p>
                )}
              </div>
            </>
          )}
          <div>
            <label className="block mb-1">Aktivní</label>
            <input
              type="checkbox"
              checked={formData.active ?? true}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="mr-2"
            />
            <span>Aktivní pravidlo</span>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
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

      {/* List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Seznam pravidel</h2>
        {rules.length === 0 ? (
          <p className="text-gray-600">Žádná pravidla</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Název</th>
                  <th className="border p-2 text-left">Částka</th>
                  <th className="border p-2 text-left">Frekvence</th>
                  <th className="border p-2 text-left">Scope</th>
                  <th className="border p-2 text-left">Kategorie</th>
                  <th className="border p-2 text-left">Rozpočítat</th>
                  <th className="border p-2 text-left">Aktivní</th>
                  <th className="border p-2 text-left">Akce</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className={rule.active ? '' : 'opacity-50'}>
                    <td className="border p-2">{rule.name}</td>
                    <td className="border p-2">{Math.abs(rule.amount).toLocaleString('cs-CZ')} CZK</td>
                    <td className="border p-2">
                      {rule.frequency === 'monthly'
                        ? 'Měsíčně'
                        : rule.frequency === 'weekly'
                          ? 'Týdně'
                          : rule.frequency === 'quarterly'
                            ? 'Čtvrtletně'
                            : 'Ročně'}
                    </td>
                    <td className="border p-2">{rule.scope}</td>
                    <td className="border p-2">
                      {rule.categoryMain}
                      {rule.categorySub && ` / ${rule.categorySub}`}
                    </td>
                    <td className="border p-2">{rule.isSplitEnabled ? 'Ano' : 'Ne'}</td>
                    <td className="border p-2">{rule.active ? 'Ano' : 'Ne'}</td>
                    <td className="border p-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(rule)}
                          className="px-2 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
                        >
                          Upravit
                        </button>
                        <button
                          onClick={() => toggleRecurringRuleActive(store, rule.id)}
                          className="px-2 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                        >
                          {rule.active ? 'Deaktivovat' : 'Aktivovat'}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Opravdu chcete smazat toto pravidlo?')) {
                              deleteRecurringRule(store, rule.id);
                            }
                          }}
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
      </div>
    </div>
  );
}
