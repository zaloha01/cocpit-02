/**
 * Dashboard Page Component
 * 
 * Main overview page showing monthly financial status.
 * Displays: MÁM ZAPLATIT, ZAPLACENO, ZBÝVÁ ZAPLATIT, etc.
 * 
 * NOTE: No business logic is computed here; only domain selector is called.
 */

'use client';

import { useEffect, useState } from 'react';
import { LocalStorageProvider } from '@/src/storage/LocalProvider';
import { createAppStateStore } from '@/src/appstate/AppStateStore';
import {
  markMonthlyLedgerEntryPaid,
  markMonthlyLedgerEntryPartial,
  markMonthlyLedgerEntryUnpaid,
  updateMonthlyLedgerEntry,
  updateMonthlyLedgerSavedAmount,
} from '@/src/appstate/actions';
import { getMonthlyContext, getCurrentMonthKey } from '@/src/domain';
import { formatMonthKey, parseMonthKey } from '@/src/domain/calc';
import type { AppState } from '@/src/storage/schema';
import type { MonthlyContext, MonthKey, MonthlyLedgerEntry } from '@/src/domain';

// Helper for CZK formatting
function formatCZK(amount: number): string {
  return (amount ?? 0).toLocaleString('cs-CZ');
}

// Helper to get obligation name from source
function getObligationName(entry: MonthlyLedgerEntry, state: AppState): string {
  if (entry.sourceType === 'recurring') {
    const rule = state.recurringRules?.find((r) => r.id === entry.sourceId);
    return rule?.name || `${entry.sourceType}:${entry.sourceId}`;
  }
  return `${entry.sourceType}:${entry.sourceId}`;
}

// Helper to check if entry is catchup mode
function isCatchupEntry(entry: MonthlyLedgerEntry, state: AppState): boolean {
  if (entry.sourceType !== 'recurring') return false;
  const rule = state.recurringRules?.find((r) => r.id === entry.sourceId);
  return (rule?.spreadEnabled && rule?.spreadMode === 'catchup') || false;
}

// Helper to get payment status
function getPaymentStatus(entry: MonthlyLedgerEntry): 'unpaid' | 'partial' | 'paid' {
  const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  const due = safeNumber(entry.dueAmount);
  const paid = safeNumber(entry.paidAmount);
  if (paid === 0) return 'unpaid';
  if (paid >= due) return 'paid';
  return 'partial';
}

export default function DashboardPage() {
  const [store] = useState(() => {
    const storage = new LocalStorageProvider();
    return createAppStateStore(storage);
  });
  const [state, setState] = useState<AppState | null>(null);
  const [context, setContext] = useState<MonthlyContext | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<MonthKey>(getCurrentMonthKey());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSavedId, setEditingSavedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    paidAmount: 0,
    paidByName: '',
    paidAt: '',
  });
  const [editSavedForm, setEditSavedForm] = useState({
    savedAmount: 0,
  });
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    // Initialize store on mount
    store.init().then(() => {
      setState(store.getState());
      setIsInitialized(true);
    });

    // Subscribe to state changes
    const unsubscribe = store.subscribe(() => {
      const newState = store.getState();
      setState(newState);
    });

    return unsubscribe;
  }, [store]);

  useEffect(() => {
    if (state) {
      // Call domain selector to get monthly context for selected month
      const monthlyContext = getMonthlyContext(state, selectedMonth);
      setContext(monthlyContext);
    }
  }, [state, selectedMonth]);

  const handleEdit = (entry: MonthlyLedgerEntry) => {
    setEditingId(entry.id);
    setEditForm({
      paidAmount: entry.paidAmount || entry.dueAmount || 0,
      paidByName: entry.paidByName || '',
      paidAt: '',
    });
  };

  const handleSave = () => {
    if (!editingId) return;

    const entry = context?.obligations.find((e) => e.id === editingId);
    if (!entry) {
      console.error('[handleSave] Entry not found:', editingId);
      return;
    }

    // Ensure numeric conversion with safety
    const safeNumber = (v: unknown): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const dueAmount = safeNumber(entry.dueAmount);
    const paidAmount = safeNumber(editForm.paidAmount);

    // Prepare entry data for creation if needed
    const entryData = {
      sourceId: entry.sourceId,
      sourceType: entry.sourceType,
      month: entry.month,
      dueAmount: dueAmount,
    };

    console.log('[handleSave] Saving payment:', { id: editingId, paidAmount, entryData });

    if (paidAmount === 0) {
      markMonthlyLedgerEntryUnpaid(store, editingId);
    } else if (paidAmount >= dueAmount) {
      markMonthlyLedgerEntryPaid(store, editingId, dueAmount, 'self', editForm.paidByName || undefined, entryData);
    } else {
      markMonthlyLedgerEntryPartial(store, editingId, paidAmount, 'self', editForm.paidByName || undefined, entryData);
    }

    setEditingId(null);
    setEditForm({ paidAmount: 0, paidByName: '', paidAt: '' });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({ paidAmount: 0, paidByName: '', paidAt: '' });
  };

  const handleUnpaid = (id: string) => {
    markMonthlyLedgerEntryUnpaid(store, id);
    setEditingId(null);
  };

  const handleEditSaved = (entry: MonthlyLedgerEntry) => {
    setEditingSavedId(entry.id);
    setEditSavedForm({
      savedAmount: entry.savedAmount || 0,
    });
  };

  const handleSaveSaved = () => {
    if (!editingSavedId) return;

    const entry = context?.obligations.find((e) => e.id === editingSavedId);
    if (!entry) {
      console.error('[handleSaveSaved] Entry not found:', editingSavedId);
      return;
    }

    const safeNumber = (v: unknown): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const savedAmount = safeNumber(editSavedForm.savedAmount);
    const entryData = {
      sourceId: entry.sourceId,
      sourceType: entry.sourceType,
      month: entry.month,
      dueAmount: entry.dueAmount || 0,
    };

    updateMonthlyLedgerSavedAmount(store, editingSavedId, savedAmount, entryData);
    setEditingSavedId(null);
    setEditSavedForm({ savedAmount: 0 });
  };

  const handleCancelSaved = () => {
    setEditingSavedId(null);
    setEditSavedForm({ savedAmount: 0 });
  };

  // Calculate reserve totals for catchup entries
  const catchupEntries = context?.obligations.filter((e) => isCatchupEntry(e, state || {} as AppState)) || [];
  const reserveTargetTotal = catchupEntries.reduce((sum, e) => sum + (e.dueAmount || 0), 0);
  const reserveSavedTotal = catchupEntries.reduce((sum, e) => sum + (e.savedAmount || 0), 0);

  if (!isInitialized || !context || !state) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>

      {/* Month selector */}
      <section className="p-4 border rounded">
        <label className="block mb-2 font-semibold">Vyberte měsíc (YYYY-MM):</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value as MonthKey)}
          className="p-2 border rounded"
        />
      </section>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded border">
          <h3 className="font-semibold text-sm text-gray-600 mb-1">MÁM ZAPLATIT</h3>
          <p className="text-2xl font-bold">{formatCZK(context.totals.mustPayTotal)} CZK</p>
        </div>
        <div className="bg-green-50 p-4 rounded border">
          <h3 className="font-semibold text-sm text-gray-600 mb-1">ZAPLACENO</h3>
          <p className="text-2xl font-bold">{formatCZK(context.totals.paidTotal)} CZK</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded border">
          <h3 className="font-semibold text-sm text-gray-600 mb-1">ZBÝVÁ ZAPLATIT</h3>
          <p className="text-2xl font-bold">{formatCZK(context.totals.remainingTotal)} CZK</p>
        </div>
        <div className="bg-purple-50 p-4 rounded border">
          <h3 className="font-semibold text-sm text-gray-600 mb-1">POHYBLIVÉ VÝDAJE</h3>
          <p className="text-2xl font-bold">{formatCZK(context.totals.variableSpend)} CZK</p>
        </div>
        <div className="bg-indigo-50 p-4 rounded border">
          <h3 className="font-semibold text-sm text-gray-600 mb-1">PŘÍJEM CELKEM (přišlo)</h3>
          <p className="text-2xl font-bold">{formatCZK(context.totals.incomeReceivedTotal)} CZK</p>
        </div>
        <div className="bg-cyan-50 p-4 rounded border">
          <h3 className="font-semibold text-sm text-gray-600 mb-1">PŘÍJMY (plán)</h3>
          <p className="text-2xl font-bold">{formatCZK(context.totals.incomePlannedTotal)} CZK</p>
        </div>
        <div className="bg-orange-50 p-4 rounded border">
          <h3 className="font-semibold text-sm text-gray-600 mb-1">KAREL ZBÝVÁ VYDĚLAT</h3>
          <p className="text-2xl font-bold">{formatCZK(context.totals.karelRemainingToEarn)} CZK</p>
        </div>
        <div className="bg-red-50 p-4 rounded border">
          <h3 className="font-semibold text-sm text-gray-600 mb-1">Karel deficit</h3>
          <p className="text-2xl font-bold">{formatCZK(context.totals.karelDeficit)} CZK</p>
        </div>
      </div>

      {/* Reserve (catchup) entries */}
      {catchupEntries.length > 0 && (
        <section className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-4">Rezervy (rozpočítání) pro {selectedMonth}</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Název</th>
                  <th className="border p-2 text-left">Target tento měsíc</th>
                  <th className="border p-2 text-left">Odloženo tento měsíc</th>
                  <th className="border p-2 text-left">Zbývá do splatnosti</th>
                  <th className="border p-2 text-left">Akce</th>
                </tr>
              </thead>
              <tbody>
                {catchupEntries.map((entry) => {
                  const isEditingSaved = editingSavedId === entry.id;
                  const safeNumber = (v: unknown): number => {
                    const n = Number(v);
                    return Number.isFinite(n) ? n : 0;
                  };
                  
                  // Get rule to find totalAmount
                  const rule = state.recurringRules?.find((r) => r.id === entry.sourceId);
                  const totalAmount = rule ? Math.abs(rule.amount) : 0;
                  
                  // Calculate savedSoFar (from startMonth to previous month)
                  let savedSoFar = 0;
                  if (rule?.dueDate && rule?.spreadMonths) {
                    const dueDateParts = rule.dueDate.split('-');
                    if (dueDateParts.length >= 2) {
                      const dueYear = parseInt(dueDateParts[0], 10);
                      const dueMonthNum = parseInt(dueDateParts[1], 10);
                      const dueMonth = formatMonthKey(dueYear, dueMonthNum);
                      const spreadMonths = Math.max(1, Math.min(24, rule.spreadMonths));
                      const dueParsed = parseMonthKey(dueMonth);
                      let startYear = dueParsed.year;
                      let startMonthNum = dueParsed.month - (spreadMonths - 1);
                      while (startMonthNum < 1) {
                        startMonthNum += 12;
                        startYear -= 1;
                      }
                      const startMonth = formatMonthKey(startYear, startMonthNum);
                      
                      const startParsed = parseMonthKey(startMonth);
                      const currentParsed = parseMonthKey(selectedMonth);
                      let checkYear = startParsed.year;
                      let checkMonth = startParsed.month;
                      
                      while (checkYear < currentParsed.year || (checkYear === currentParsed.year && checkMonth < currentParsed.month)) {
                        const checkMonthKey = formatMonthKey(checkYear, checkMonth);
                        const checkEntry = (state.monthlyLedger || []).find(
                          (e) => e.sourceId === rule.id && e.month === checkMonthKey && e.sourceType === 'recurring'
                        );
                        savedSoFar += safeNumber(checkEntry?.savedAmount);
                        
                        checkMonth += 1;
                        if (checkMonth > 12) {
                          checkMonth = 1;
                          checkYear += 1;
                        }
                      }
                    }
                  }
                  
                  const targetThisMonth = safeNumber(entry.dueAmount);
                  const savedThisMonth = safeNumber(entry.savedAmount);
                  const remainingToDue = Math.max(0, totalAmount - (savedSoFar + savedThisMonth));
                  
                  // Check if this is the due month
                  const isDueMonth = rule?.dueDate ? (() => {
                    const dueDateParts = rule.dueDate.split('-');
                    if (dueDateParts.length >= 2) {
                      const dueYear = parseInt(dueDateParts[0], 10);
                      const dueMonthNum = parseInt(dueDateParts[1], 10);
                      return formatMonthKey(dueYear, dueMonthNum) === selectedMonth;
                    }
                    return false;
                  })() : false;

                  return (
                    <tr key={entry.id} className={isEditingSaved ? 'bg-yellow-50' : ''}>
                      {isEditingSaved ? (
                        <td className="border p-2" colSpan={5}>
                          <div className="space-y-3 p-3 bg-white rounded border">
                            <h4 className="font-semibold">
                              Odložil jsem: {getObligationName(entry, state)}
                            </h4>
                            <div>
                              <label className="block mb-1 text-sm">Odložená částka (CZK)</label>
                              <input
                                type="number"
                                value={editSavedForm.savedAmount || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const num = val === '' ? 0 : Number(val);
                                  const safe = Number.isFinite(num) ? num : 0;
                                  setEditSavedForm({
                                    savedAmount: safe,
                                  });
                                }}
                                className="w-full p-2 border rounded"
                                min="0"
                                step="0.01"
                              />
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveSaved}
                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                              >
                                Uložit
                              </button>
                              <button
                                onClick={() => {
                                  updateMonthlyLedgerSavedAmount(
                                    store,
                                    entry.id,
                                    0,
                                    {
                                      sourceId: entry.sourceId,
                                      sourceType: entry.sourceType,
                                      month: entry.month,
                                      dueAmount: entry.dueAmount || 0,
                                    }
                                  );
                                  setEditingSavedId(null);
                                }}
                                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                              >
                                Resetovat na 0
                              </button>
                              <button
                                onClick={handleCancelSaved}
                                className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                              >
                                Zrušit
                              </button>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td className="border p-2">{getObligationName(entry, state)}</td>
                          <td className="border p-2">{formatCZK(targetThisMonth)} CZK</td>
                          <td className="border p-2">{formatCZK(savedThisMonth)} CZK</td>
                          <td className="border p-2">
                            {formatCZK(remainingToDue)} CZK
                            {isDueMonth && remainingToDue > 0 && (
                              <span className="ml-2 text-sm text-red-600 font-semibold">
                                (Chybí {formatCZK(remainingToDue)} do splatnosti)
                              </span>
                            )}
                          </td>
                          <td className="border p-2">
                            <button
                              onClick={() => handleEditSaved(entry)}
                              className="px-3 py-1 bg-cyan-500 text-white rounded text-sm hover:bg-cyan-600"
                            >
                              Odložil jsem...
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Regular obligations table */}
      <section className="p-4 border rounded">
        <h2 className="text-xl font-semibold mb-4">Závazky pro {selectedMonth}</h2>
        {context.obligations.filter((e) => !isCatchupEntry(e, state)).length === 0 ? (
          <p className="text-gray-600">Žádné závazky pro tento měsíc</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-2 text-left">Název</th>
                  <th className="border p-2 text-left">Částka</th>
                  <th className="border p-2 text-left">Zaplaceno</th>
                  <th className="border p-2 text-left">Zbývá</th>
                  <th className="border p-2 text-left">Stav</th>
                  <th className="border p-2 text-left">Akce</th>
                </tr>
              </thead>
              <tbody>
                {context.obligations.filter((e) => !isCatchupEntry(e, state)).map((entry) => {
                  const isEditing = editingId === entry.id;
                  const status = getPaymentStatus(entry);
                  const safeNumber = (v: unknown): number => {
                    const n = Number(v);
                    return Number.isFinite(n) ? n : 0;
                  };
                  const due = safeNumber(entry.dueAmount);
                  const paid = safeNumber(entry.paidAmount);
                  const remaining = Math.max(0, due - paid);

                  return (
                    <tr key={entry.id} className={isEditing ? 'bg-yellow-50' : ''}>
                      {isEditing ? (
                        <>
                          <td className="border p-2" colSpan={6}>
                            <div className="space-y-3 p-3 bg-white rounded border">
                              <h4 className="font-semibold">
                                Nastavit platbu: {getObligationName(entry, state)}
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <label className="block mb-1 text-sm">Zaplacená částka (CZK)</label>
                                  <input
                                    type="number"
                                    value={editForm.paidAmount || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      const num = val === '' ? 0 : Number(val);
                                      const safe = Number.isFinite(num) ? num : 0;
                                      setEditForm({
                                        ...editForm,
                                        paidAmount: safe,
                                      });
                                    }}
                                    className="w-full p-2 border rounded"
                                    min="0"
                                    max={due}
                                    step="0.01"
                                    placeholder={String(due)}
                                  />
                                </div>
                                <div>
                                  <label className="block mb-1 text-sm">Kdo zaplatil (volitelné)</label>
                                  <input
                                    type="text"
                                    value={editForm.paidByName}
                                    onChange={(e) =>
                                      setEditForm({ ...editForm, paidByName: e.target.value })
                                    }
                                    className="w-full p-2 border rounded"
                                    placeholder="Volitelné"
                                  />
                                </div>
                                <div>
                                  <label className="block mb-1 text-sm">Datum zaplacení (volitelné)</label>
                                  <input
                                    type="date"
                                    value={editForm.paidAt}
                                    onChange={(e) => setEditForm({ ...editForm, paidAt: e.target.value })}
                                    className="w-full p-2 border rounded"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleSave}
                                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                >
                                  Uložit
                                </button>
                                <button
                                  onClick={() => handleUnpaid(entry.id)}
                                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                                >
                                  Označit jako nezaplaceno
                                </button>
                                <button
                                  onClick={handleCancel}
                                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                                >
                                  Zrušit
                                </button>
                              </div>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="border p-2">{getObligationName(entry, state)}</td>
                          <td className="border p-2">{formatCZK(due)} CZK</td>
                          <td className="border p-2">{formatCZK(paid)} CZK</td>
                          <td className="border p-2">{formatCZK(remaining)} CZK</td>
                          <td className="border p-2">
                            <span
                              className={`px-2 py-1 rounded text-xs font-semibold ${
                                status === 'paid'
                                  ? 'bg-green-200 text-green-800'
                                  : status === 'partial'
                                    ? 'bg-yellow-200 text-yellow-800'
                                    : 'bg-gray-200 text-gray-800'
                              }`}
                            >
                              {status === 'paid' ? 'Zaplaceno' : status === 'partial' ? 'Částečně' : 'Nezaplaceno'}
                            </span>
                          </td>
                          <td className="border p-2">
                            <button
                              onClick={() => handleEdit(entry)}
                              className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                            >
                              Nastavit platbu
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Debug section (collapsible) */}
      <section className="p-4 border rounded">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <span className="font-semibold">Debug</span>
          <span>{showDebug ? '▼' : '▶'}</span>
        </button>
        {showDebug && (
          <div className="mt-4 bg-gray-100 p-4 rounded">
            <h2 className="text-xl font-semibold mb-2">Monthly Context (Debug)</h2>
            <pre className="text-xs overflow-auto bg-white p-4 rounded border">
              {JSON.stringify(context, null, 2)}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
}
