import { create } from 'zustand';

// ✅ SEEDED NON-ZERO DATA for immediate rendering
const initialBuckets = {
  income: [
    { id: 'inc-1', category: 'Salary', estBudget: 2000, actualCost: 2000, dueDate: '2025-09-01', status: 'paid' },
    { id: 'inc-2', category: 'Freelance', estBudget: 200, actualCost: 200, dueDate: '2025-09-15', status: 'paid' }
  ],
  housing: [
    { id: 'hou-1', category: 'Rent/Mortgage', estBudget: 1200, actualCost: 1200, dueDate: '2025-09-01', status: 'paid' },
    { id: 'hou-2', category: 'Utilities', estBudget: 150, actualCost: 148.50, dueDate: '2025-09-05', status: 'paid' }
  ],
  transportation: [
    { id: 'tra-1', category: 'Gas', estBudget: 120, actualCost: 115.75, dueDate: '2025-09-10', status: 'paid' },
    { id: 'tra-2', category: 'Insurance', estBudget: 100, actualCost: 100, dueDate: '2025-09-01', status: 'paid' }
  ],
  food: [
    { id: 'foo-1', category: 'Groceries', estBudget: 400, actualCost: 387.23, dueDate: '2025-09-15', status: 'paid' },
    { id: 'foo-2', category: 'Dining Out', estBudget: 150, actualCost: 162.18, dueDate: '2025-09-20', status: 'paid' }
  ],
  personal: [
    { id: 'per-1', category: 'Healthcare', estBudget: 200, actualCost: 185.50, dueDate: '2025-09-08', status: 'paid' },
    { id: 'per-2', category: 'Entertainment', estBudget: 100, actualCost: 95.30, dueDate: '2025-09-12', status: 'paid' }
  ],
  homeOffice: [
    { id: 'hom-1', category: 'Internet', estBudget: 80, actualCost: 79.99, dueDate: '2025-09-01', status: 'paid' },
    { id: 'hom-2', category: 'Supplies', estBudget: 50, actualCost: 43.20, dueDate: '2025-09-15', status: 'paid' }
  ],
  banking: [
    { id: 'ban-1', category: 'Bank Fees', estBudget: 25, actualCost: 25, dueDate: '2025-09-01', status: 'paid' },
    { id: 'ban-2', category: 'Credit Card Payment', estBudget: 300, actualCost: 300, dueDate: '2025-09-05', status: 'paid' }
  ],
  misc: [
    { id: 'mis-1', category: 'Subscriptions', estBudget: 45, actualCost: 44.29, dueDate: '2025-09-01', status: 'paid' },
    { id: 'mis-2', category: 'Other', estBudget: 30, actualCost: 0, dueDate: '2025-09-30', status: 'pending' }
  ]
};

export const useBudgetState = create((set, get) => ({
  // ✅ CANONICAL STATE: Bucket-based structure
  buckets: initialBuckets,

  // ✅ SAFE META with defaults
  meta: {
    hydrated: true,
    loading: false,
    error: null,
    asOfDate: '2025-09-01'
  },

  // ✅ DERIVED FLAT ARRAY for compatibility
  get rows() {
    const state = get();
    // 🛡️ GUARD: Handle undefined/null buckets
    if (!state.buckets || typeof state.buckets !== 'object') {
      return [];
    }
    return Object.entries(state.buckets).flatMap(([bucket, items]) =>
      (items || []).map(item => ({ ...item, bucket }))
    );
  },

  // ✅ Helper: Add Row
  addRow: (bucket, rowData) => {
    set((state) => {
      const newRow = {
        id: `${bucket.slice(0, 3)}-${Date.now()}`,
        category: '',
        estBudget: 0,
        actualCost: 0,
        dueDate: '',
        status: 'pending',
        ...rowData
      };
      return {
        buckets: {
          ...state.buckets,
          [bucket]: [...state.buckets[bucket], newRow]
        }
      };
    });
  },

  // ✅ Helper: Update Row
  updateRow: (bucket, id, updates) => {
    set((state) => ({
      buckets: {
        ...state.buckets,
        [bucket]: state.buckets[bucket].map(row =>
          row.id === id ? { ...row, ...updates } : row
        )
      }
    }));
  },

  // ✅ Helper: Remove Row
  removeRow: (bucket, id) => {
    set((state) => ({
      buckets: {
        ...state.buckets,
        [bucket]: state.buckets[bucket].filter(row => row.id !== id)
      }
    }));
  },

  // ✅ Helper: Move Row
  moveRow: (bucket, fromIndex, toIndex) => {
    set((state) => {
      const items = [...state.buckets[bucket]];
      const [removed] = items.splice(fromIndex, 1);
      items.splice(toIndex, 0, removed);
      return {
        buckets: {
          ...state.buckets,
          [bucket]: items
        }
      };
    });
  },

  // ✅ Helper: Archive Current
  archiveCurrent: (label = 'Manual Archive') => {
    const state = get();
    const archive = {
      timestamp: new Date().toISOString(),
      label,
      data: { buckets: state.buckets, meta: state.meta }
    };
    localStorage.setItem('budget_archive', JSON.stringify(archive));
    console.log('✅ Archive saved:', label);
  },

  // ✅ Helper: Restore Archive
  restoreArchive: () => {
    const archived = localStorage.getItem('budget_archive');
    if (archived) {
      const { data } = JSON.parse(archived);
      set({ buckets: data.buckets, meta: data.meta });
      console.log('✅ Archive restored');
    }
  },

  // ✅ Helper: Import from JSON
  importFromJson: (jsonData) => {
    set({
      buckets: jsonData.buckets,
      meta: { ...get().meta, ...jsonData.meta }
    });
  },

  // ✅ Helper: Export to JSON
  exportToJson: () => {
    const state = get();
    return {
      buckets: state.buckets,
      meta: state.meta
    };
  },

  // ✅ Helper: Compute Totals
  computeTotals: () => {
    const state = get();
    
    // 🛡️ GUARD: Handle undefined/null buckets
    if (!state.buckets || typeof state.buckets !== 'object') {
      return {
        totalIncome: 0,
        totalExpenses: 0,
        netIncome: 0,
        totalBudgeted: 0,
        variance: 0
      };
    }

    const allRows = Object.values(state.buckets).flat();
    
    const income = state.buckets.income || [];
    const expenses = allRows.filter(row => !income.includes(row));

    const totalIncome = income.reduce((sum, row) => sum + (row.actualCost || 0), 0);
    const totalExpenses = expenses.reduce((sum, row) => sum + (row.actualCost || 0), 0);
    const netIncome = totalIncome - totalExpenses;

    const totalBudgeted = expenses.reduce((sum, row) => sum + (row.estBudget || 0), 0);
    const variance = totalBudgeted - totalExpenses;

    return {
      totalIncome,
      totalExpenses,
      netIncome,
      totalBudgeted,
      variance
    };
  },

  // ✅ Helper: Reload Data (WITH GUARD)
  reloadData: async () => {
    try {
      set((state) => ({
        meta: { ...state.meta, loading: true, error: null }
      }));

      const response = await fetch('/budget-dashboard-fs/restore/budget-data.json');
      if (!response.ok) throw new Error('Failed to fetch restore data');
      
      const data = await response.json();

      // 🛡️ GUARD: Only apply if data has non-zero values
      const hasNonZeroData = Object.values(data.buckets || {}).some(bucket =>
        Array.isArray(bucket) && bucket.some(row => 
          (row.estBudget > 0 || row.actualCost > 0)
        )
      );

      if (hasNonZeroData) {
        set({
          buckets: data.buckets,
          meta: { ...get().meta, ...data.meta, loading: false }
        });
        console.log('✅ Data reloaded from restore file');
      } else {
        set((state) => ({
          meta: { ...state.meta, loading: false }
        }));
        console.warn('⚠️ Restore file contains only zeros - keeping current store data');
      }
    } catch (error) {
      set((state) => ({
        meta: { ...state.meta, loading: false, error: error.message }
      }));
      console.error('❌ Reload failed:', error);
    }
  },

  // ✅ Helper: Hydrate from DB (placeholder for future backend)
  hydrateFromDB: async () => {
    console.log('Hydrate from DB - not yet implemented');
  }
}));