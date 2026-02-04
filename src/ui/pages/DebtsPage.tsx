/**
 * Debts Page Component
 * 
 * Page for managing debts (komu dlužím / kdo dluží mně).
 */

'use client';

import { useEffect, useState } from 'react';
import { LocalStorageProvider } from '@/src/storage/LocalProvider';
import { createAppStateStore } from '@/src/appstate/AppStateStore';
import {
  addDebtItem,
  updateDebtItem,
  deleteDebtItem,
  addDebtPayment,
  deleteDebtPayment,
} from '@/src/appstate/actions';
import { calculateDebtStatus } from '@/src/domain/selectors';
import type { AppState } from '@/src/storage/schema';
import type { DebtItem, DebtPayment, Scope } from '@/src/domain/models';

// Helper for CZK formatting
function formatCZK(amount: number): string {
  return (amount ?? 0).toLocaleString('cs-CZ');
}

export default function DebtsPage() {
  const [store] = useState(() => {
    const storage = new LocalStorageProvider();
    return createAppStateStore(storage);
  });
  const [state, setState] = useState<AppState | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState<'i_owe' | 'owed_to_me'>('i_owe');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    direction: 'i_owe' as 'i_owe' | 'owed_to_me',
    counterpartyName: '',
    title: '',
    principal: '',
    scope: 'rodina' as Scope,
    confidence: 100 as 100 | 50,
    startDate: '',
    dueDate: '',
    note: '',
  });
  const [paymentForm, setPaymentForm] = useState({
    debtId: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    note: '',
  });

  useEffect(() => {
    store.init().then(() => {
      const initialState = store.getState();
      setState(initialState);
      setIsInitialized(true);
      
      // Debug: verify debts and payments structure
      console.log('[DebtsPage] Initial state loaded');
      console.log('[DebtsPage] debts', initialState.debts, Array.isArray(initialState.debts));
      console.log('[DebtsPage] debtPayments', initialState.debtPayments, Array.isArray(initialState.debtPayments));
      if (Array.isArray(initialState.debts) && initialState.debts.length > 0) {
        console.log('[DebtsPage] First debt:', initialState.debts[0]);
        if (Array.isArray(initialState.debtPayments) && initialState.debtPayments.length > 0) {
          console.log('[DebtsPage] Link test - debt[0].id:', initialState.debts[0]?.id);
          console.log('[DebtsPage] Link test - payment[0].debtId:', initialState.debtPayments[0]?.debtId);
          console.log('[DebtsPage] Link test - payments with matching debtId:', 
            initialState.debtPayments.filter(p => p.debtId === initialState.debts[0]?.id));
        }
      }
    });

    const unsubscribe = store.subscribe(() => {
      const newState = store.getState();
      setState(newState);
      
      // Debug: verify state updates after payment
      console.log('[DebtsPage] State updated via subscribe');
      console.log('[DebtsPage] debts', newState.debts, Array.isArray(newState.debts));
      console.log('[DebtsPage] debtPayments', newState.debtPayments, Array.isArray(newState.debtPayments));
      if (Array.isArray(newState.debts) && newState.debts.length > 0) {
        const firstDebt = newState.debts[0];
        const matchingPayments = Array.isArray(newState.debtPayments) 
          ? newState.debtPayments.filter(p => p.debtId === firstDebt.id)
          : [];
        console.log('[DebtsPage] First debt outstanding:', firstDebt.outstanding);
        console.log('[DebtsPage] Matching payments count:', matchingPayments.length);
        console.log('[DebtsPage] Payments total:', matchingPayments.reduce((sum, p) => sum + (p.amount || 0), 0));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [store]);

  if (!isInitialized || !state) {
    return <div className="p-4">Načítání...</div>;
  }

  // Ensure debts is always an array (defensive check)
  const debtsArray = Array.isArray(state.debts) ? state.debts : [];
  const debts = debtsArray.filter((d) => d.direction === activeTab);
  // Ensure debtPayments is always an array (defensive check)
  const payments = Array.isArray(state.debtPayments) ? state.debtPayments : [];

  const handleAddDebt = () => {
    const principal = Number(formData.principal);
    if (!formData.counterpartyName || !formData.title || !Number.isFinite(principal) || principal <= 0) {
      alert('Vyplňte prosím všechny povinné údaje');
      return;
    }

    addDebtItem(store, {
      direction: formData.direction,
      counterpartyName: formData.counterpartyName,
      title: formData.title,
      principal,
      scope: formData.scope,
      // For outgoing debts (i_owe), confidence is always 100 (not applicable)
      // For incoming debts (owed_to_me), use the selected confidence
      confidence: formData.direction === 'i_owe' ? 100 : formData.confidence,
      startDate: formData.startDate || undefined,
      dueDate: formData.dueDate || undefined,
      note: formData.note || undefined,
    });

    setFormData({
      direction: activeTab,
      counterpartyName: '',
      title: '',
      principal: '',
      scope: 'rodina',
      confidence: 100,
      startDate: '',
      dueDate: '',
      note: '',
    });
    setShowAddForm(false);
  };

  const handleAddPayment = (debtId: string) => {
    const amount = Number(paymentForm.amount);
    if (!paymentForm.date || !Number.isFinite(amount) || amount <= 0) {
      alert('Vyplňte prosím datum a částku');
      return;
    }

    addDebtPayment(store, {
      debtId,
      date: paymentForm.date,
      amount,
      note: paymentForm.note || undefined,
    });

    setPaymentForm({
      debtId: '',
      date: new Date().toISOString().split('T')[0],
      amount: '',
      note: '',
    });
    setEditingPaymentId(null);
  };

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Dluhy</h1>

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b">
        <button
          onClick={() => {
            setActiveTab('i_owe');
            setFormData({ ...formData, direction: 'i_owe' });
            setShowAddForm(false);
          }}
          className={`px-4 py-2 font-semibold ${
            activeTab === 'i_owe'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Komu dlužím
        </button>
        <button
          onClick={() => {
            setActiveTab('owed_to_me');
            setFormData({ ...formData, direction: 'owed_to_me' });
            setShowAddForm(false);
          }}
          className={`px-4 py-2 font-semibold ${
            activeTab === 'owed_to_me'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          Kdo dluží mně
        </button>
      </div>

      {/* Add debt form */}
      {showAddForm && (
        <section className="mb-6 p-4 border rounded bg-blue-50">
          <h2 className="text-xl font-semibold mb-4">Přidat nový dluh</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block mb-1 text-sm font-medium">Protistrana *</label>
              <input
                type="text"
                value={formData.counterpartyName}
                onChange={(e) => setFormData({ ...formData, counterpartyName: e.target.value })}
                className="w-full p-2 border rounded"
                placeholder="Jméno osoby/firmy"
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Název *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full p-2 border rounded"
                placeholder="Např. 'Půjčka na auto'"
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Částka (CZK) *</label>
              <input
                type="number"
                value={formData.principal}
                onChange={(e) => setFormData({ ...formData, principal: e.target.value })}
                className="w-full p-2 border rounded"
                placeholder="0"
                step="0.01"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Scope</label>
              <select
                value={formData.scope}
                onChange={(e) => setFormData({ ...formData, scope: e.target.value as Scope })}
                className="w-full p-2 border rounded"
              >
                <option value="rodina">Rodina</option>
                <option value="ico">IČO</option>
                <option value="sro_karin">SRO Karin</option>
                <option value="weecon">Weecon</option>
              </select>
            </div>
            {formData.direction === 'owed_to_me' && (
              <div>
                <label className="block mb-1 text-sm font-medium">Pravděpodobnost inkasa</label>
                <select
                  value={formData.confidence}
                  onChange={(e) => setFormData({ ...formData, confidence: Number(e.target.value) as 100 | 50 })}
                  className="w-full p-2 border rounded"
                >
                  <option value="100">100% (jisté)</option>
                  <option value="50">50% (nejisté)</option>
                </select>
              </div>
            )}
            <div>
              <label className="block mb-1 text-sm font-medium">Datum začátku</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-medium">Datum splatnosti</label>
              <input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full p-2 border rounded"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block mb-1 text-sm font-medium">Poznámka</label>
              <textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                className="w-full p-2 border rounded"
                rows={2}
                placeholder="Volitelné poznámky"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAddDebt}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Přidat
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setFormData({
                  direction: activeTab,
                  counterpartyName: '',
                  title: '',
                  principal: '',
                  scope: 'rodina',
                  confidence: 100,
                  startDate: '',
                  dueDate: '',
                  note: '',
                });
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Zrušit
            </button>
          </div>
        </section>
      )}

      {!showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          + Přidat nový dluh
        </button>
      )}

      {/* Debts list */}
      <section>
        {debts.length === 0 ? (
          <div className="p-4 border rounded bg-gray-50 text-center text-gray-600">
            Zatím nejsou žádné dluhy. Přidejte první pomocí tlačítka výše.
          </div>
        ) : (
          <div className="space-y-4">
            {debts.map((debt) => {
              const debtStatus = calculateDebtStatus(debt, payments);
              const debtPayments = payments.filter((p) => p.debtId === debt.id);

              return (
                <div key={debt.id} className="p-4 border rounded bg-white">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{debt.title}</h3>
                        {debt.direction === 'owed_to_me' && debt.confidence < 100 && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-semibold">
                            Nejisté ({debt.confidence}%)
                          </span>
                        )}
                        {debtStatus.status === 'paid' && (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
                            Zaplaceno
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        Protistrana: <span className="font-medium">{debt.counterpartyName}</span>
                      </div>
                      <div className="text-sm text-gray-600 mb-1">
                        Scope: <span className="font-medium">{debt.scope}</span>
                      </div>
                      {debt.dueDate && (
                        <div className="text-sm text-gray-600 mb-1">
                          Splatnost: <span className="font-medium">{new Date(debt.dueDate).toLocaleDateString('cs-CZ')}</span>
                        </div>
                      )}
                      {debt.note && (
                        <div className="text-sm text-gray-600 mb-2 italic">{debt.note}</div>
                      )}
                      <div className="mt-2">
                        <div className="text-sm text-gray-600">
                          Původní částka: <span className="font-medium">{formatCZK(debt.principal)} CZK</span>
                        </div>
                        {debtStatus.paidTotal > 0 && (
                          <div className="text-sm text-gray-600">
                            Zaplaceno: <span className="font-medium">{formatCZK(debtStatus.paidTotal)} CZK</span>
                          </div>
                        )}
                        <div className={`text-lg font-bold ${debt.direction === 'i_owe' ? 'text-red-600' : 'text-green-600'}`}>
                          Zbývá: {formatCZK(debtStatus.remaining)} CZK
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (confirm('Opravdu chcete smazat tento dluh a všechny jeho splátky?')) {
                          deleteDebtItem(store, debt.id);
                        }
                      }}
                      className="ml-4 px-3 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Smazat
                    </button>
                  </div>

                  {/* Payments */}
                  <div className="mt-4 border-t pt-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold">Splátky</h4>
                      {editingPaymentId !== debt.id && (
                        <button
                          onClick={() => {
                            setEditingPaymentId(debt.id);
                            setPaymentForm({
                              debtId: debt.id,
                              date: new Date().toISOString().split('T')[0],
                              amount: '',
                              note: '',
                            });
                          }}
                          className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                        >
                          + Přidat splátku
                        </button>
                      )}
                    </div>

                    {editingPaymentId === debt.id && (
                      <div className="mb-3 p-3 bg-gray-50 rounded">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                          <div>
                            <label className="block mb-1 text-xs font-medium">Datum</label>
                            <input
                              type="date"
                              value={paymentForm.date}
                              onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                              className="w-full p-2 border rounded text-sm"
                              required
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-xs font-medium">Částka (CZK)</label>
                            <input
                              type="number"
                              value={paymentForm.amount}
                              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                              className="w-full p-2 border rounded text-sm"
                              placeholder="0"
                              step="0.01"
                              min="0"
                              required
                            />
                          </div>
                          <div>
                            <label className="block mb-1 text-xs font-medium">Poznámka</label>
                            <input
                              type="text"
                              value={paymentForm.note}
                              onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                              className="w-full p-2 border rounded text-sm"
                              placeholder="Volitelné"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddPayment(debt.id)}
                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            Uložit
                          </button>
                          <button
                            onClick={() => {
                              setEditingPaymentId(null);
                              setPaymentForm({
                                debtId: '',
                                date: new Date().toISOString().split('T')[0],
                                amount: '',
                                note: '',
                              });
                            }}
                            className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                          >
                            Zrušit
                          </button>
                        </div>
                      </div>
                    )}

                    {debtPayments.length === 0 ? (
                      <div className="text-sm text-gray-500 italic">Žádné splátky</div>
                    ) : (
                      <div className="space-y-2">
                        {debtPayments
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((payment) => (
                            <div key={payment.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                              <div>
                                <span className="font-medium">{formatCZK(payment.amount)} CZK</span>
                                <span className="text-sm text-gray-600 ml-2">
                                  {new Date(payment.date).toLocaleDateString('cs-CZ')}
                                </span>
                                {payment.note && (
                                  <span className="text-sm text-gray-500 ml-2 italic">({payment.note})</span>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  if (confirm('Opravdu chcete smazat tuto splátku?')) {
                                    deleteDebtPayment(store, payment.id);
                                  }
                                }}
                                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                              >
                                Smazat
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
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
