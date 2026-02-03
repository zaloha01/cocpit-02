/**
 * App State Store
 * 
 * Central state management for the application.
 * This is the single source of truth for all application data.
 */

import type { AppState } from '../storage/schema';
import type { IStorageProvider } from '../storage/StorageProvider';

type StateUpdater = (prevState: AppState) => AppState;
type Listener = () => void;

/**
 * AppState store interface
 */
export interface AppStateStore {
  getState(): AppState;
  setState(updater: StateUpdater | AppState): void;
  subscribe(listener: Listener): () => void;
  init(): Promise<void>;
}

/**
 * Creates an AppState store instance
 */
export function createAppStateStore(storage: IStorageProvider): AppStateStore {
  let state: AppState;
  const listeners = new Set<Listener>();
  let saveTimeout: NodeJS.Timeout | null = null;
  const DEBOUNCE_MS = 300;

  // Autosave function with debounce
  const autosave = () => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(async () => {
      try {
        // Update meta.updatedAt before saving
        state = {
          ...state,
          meta: {
            ...state.meta,
            updatedAt: new Date().toISOString(),
          },
        };
        await storage.save(state);
      } catch (error) {
        console.error('Autosave failed:', error);
      }
    }, DEBOUNCE_MS);
  };

  return {
    getState: () => state,

    setState: (updater) => {
      const prevState = state;
      state = typeof updater === 'function' ? updater(prevState) : updater;
      
      // Notify listeners
      listeners.forEach((listener) => listener());
      
      // Autosave
      autosave();
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    init: async () => {
      state = await storage.load();
      // Notify listeners after initial load
      listeners.forEach((listener) => listener());
    },
  };
}
