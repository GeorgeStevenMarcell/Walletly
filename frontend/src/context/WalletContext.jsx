import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../api";
import { useAuth } from "./AuthContext";
import { todayStr } from "../utils/period";

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const { authUser } = useAuth();

  const [wallets, setWallets] = useState([]);
  const [activeWalletId, setActiveWalletId] = useState(
    () => localStorage.getItem("walletly_active_wallet") || null
  );
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  // Load wallets after login
  useEffect(() => {
    if (!authUser) {
      setWallets([]);
      setActiveWalletId(null);
      setTransactions([]);
      setCategories([]);
      setBudgets([]);
      return;
    }
    setLoadError(null);
    setLoading(true);
    api.getWallets()
      .then((ws) => {
        if (!Array.isArray(ws) || !ws.length) {
          setLoadError("No wallets found. Try logging out and registering again.");
          setLoading(false);
          return;
        }
        setWallets(ws);
        setActiveWalletId((prev) => {
          const valid = ws.find((w) => w.id === prev);
          const id = valid ? prev : ws[0].id;
          localStorage.setItem("walletly_active_wallet", id);
          return id;
        });
      })
      .catch((err) => {
        console.error("[walletly] getWallets error:", err);
        setLoadError(err.message || "Failed to load wallets");
        setLoading(false);
      });
  }, [authUser]);

  // Load wallet data when active wallet changes
  useEffect(() => {
    if (!activeWalletId) return;
    setLoading(true);
    setLoadError(null);
    setTransactions([]);
    setCategories([]);
    setBudgets([]);
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    Promise.all([
      api.getTransactions(activeWalletId, { from, to }),
      api.getCategories(activeWalletId),
      api.getBudgets(activeWalletId, todayStr().slice(0, 7)),
    ])
      .then(([txnRes, cats, bdgs]) => {
        const txnData = txnRes?.data ?? txnRes;
        setTransactions(Array.isArray(txnData) ? txnData : []);
        setCategories(Array.isArray(cats) ? cats : []);
        setBudgets(Array.isArray(bdgs) ? bdgs : []);
      })
      .catch((err) => {
        console.error("[walletly] wallet data error:", err);
        setLoadError(err.message || "Failed to load wallet data");
      })
      .finally(() => setLoading(false));
  }, [activeWalletId]);

  // Refresh helpers
  const refreshTransactions = useCallback(async () => {
    if (!activeWalletId) return;
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    const txnRes = await api.getTransactions(activeWalletId, { from, to });
    const txnData = txnRes?.data ?? txnRes;
    setTransactions(Array.isArray(txnData) ? txnData : []);
  }, [activeWalletId]);

  const refreshBudgets = useCallback(async () => {
    if (!activeWalletId) return;
    const bdgs = await api.getBudgets(activeWalletId, todayStr().slice(0, 7));
    setBudgets(Array.isArray(bdgs) ? bdgs : []);
  }, [activeWalletId]);

  const refreshCategories = useCallback(async () => {
    if (!activeWalletId) return;
    const cats = await api.getCategories(activeWalletId);
    setCategories(Array.isArray(cats) ? cats : []);
  }, [activeWalletId]);

  const refreshWallets = useCallback(async () => {
    const ws = await api.getWallets();
    setWallets(Array.isArray(ws) ? ws : []);
  }, []);

  const retryLoad = useCallback(() => {
    setLoadError(null);
    setLoading(true);
    api.getWallets()
      .then((ws) => {
        const walletArr = Array.isArray(ws) ? ws : [];
        setWallets(walletArr);
        if (walletArr.length) setActiveWalletId(walletArr[0].id);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Build wallet object the UI components expect
  const activeWalletRaw = wallets.find((w) => w.id === activeWalletId);
  const expenseCats = categories.filter((c) => c.type === "expense");
  const incomeCats = categories.filter((c) => c.type === "income");
  const budgetMap = Object.fromEntries(budgets.map((b) => [b.category_id, Number(b.amount)]));

  const wallet = activeWalletRaw
    ? {
        ...activeWalletRaw,
        id: activeWalletRaw.id,
        name: activeWalletRaw.name,
        owner: activeWalletRaw.owner_id,
        members: (activeWalletRaw.members || []).map((m) => m.id || m),
        _memberObjects: activeWalletRaw.members || [],
        _budgetRows: budgets,
        settings: {
          monthStartDay: activeWalletRaw.month_start_day || 1,
          dayStartHour: activeWalletRaw.day_start_hour || 0,
        },
        expenseCategories: expenseCats.map((c) => ({ id: c.id, label: c.label, icon: c.icon, color: c.color })),
        incomeCategories: incomeCats.map((c) => ({ id: c.id, label: c.label, icon: c.icon, color: c.color })),
        budgets: budgetMap,
        transactions: transactions.map((t) => ({
          ...t,
          date: String(t.txn_date || t.date || "").slice(0, 10),
          category: t.category_id || t.category,
          addedBy: t.added_by || t.addedBy,
          amount: Number(t.amount),
        })),
      }
    : null;

  // Derive user ID from wallet members (reliable even if localStorage is stale)
  const resolvedUserId = authUser?.id
    || wallets.flatMap((w) => w.members || []).find((m) => m.username === authUser?.username)?.id
    || null;

  const user = authUser ? { name: authUser.displayName, wallets: wallets.map((w) => w.id) } : null;
  const session = authUser ? { id: resolvedUserId, username: authUser.username, walletId: activeWalletId } : null;

  // API helpers
  const showToastRef = { current: null }; // will be set by App
  const apiHelpers = {
    addTransaction: async (data) => {
      await api.createTransaction(activeWalletId, { type: data.type, amount: data.amount, categoryId: data.category, note: data.note, txnDate: data.date });
      await refreshTransactions();
    },
    deleteTransaction: async (id) => {
      await api.deleteTransaction(activeWalletId, id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    },
    updateTransaction: async (id, data) => {
      await api.updateTransaction(activeWalletId, id, data);
      await refreshTransactions();
    },
    upsertBudget: async (categoryId, amount) => {
      const period = todayStr().slice(0, 7);
      await api.upsertBudget(activeWalletId, { categoryId, amount, period });
      await refreshBudgets();
    },
    deleteBudget: async (id) => {
      await api.deleteBudget(activeWalletId, id);
      await refreshBudgets();
    },
    addCategory: async (type, label, icon, color) => {
      await api.createCategory(activeWalletId, { type, label, icon, color });
      await refreshCategories();
    },
    deleteCategory: async (id) => {
      await api.deleteCategory(activeWalletId, id);
      await refreshCategories();
    },
    updateSettings: async (settings) => {
      await api.updateSettings(activeWalletId, { monthStartDay: settings.monthStartDay, dayStartHour: settings.dayStartHour });
      await refreshWallets();
    },
    inviteMember: async (username) => {
      await api.inviteMember(activeWalletId, username);
      await refreshWallets();
    },
    removeMember: async (userId) => {
      await api.removeMember(activeWalletId, userId);
      await refreshWallets();
    },
    createWallet: async (name) => {
      await api.createWallet(name);
      await refreshWallets();
    },
    renameWallet: async (walletId, name) => {
      await api.renameWallet(walletId, name);
      await refreshWallets();
    },
    deleteWallet: async (walletId) => {
      await api.deleteWallet(walletId);
      const ws = await api.getWallets();
      const walletArr = Array.isArray(ws) ? ws : [];
      setWallets(walletArr);
      if (walletId === activeWalletId && walletArr.length) {
        setActiveWalletId(walletArr[0].id);
      }
    },
    switchWallet: (id) => {
      if (id === activeWalletId) return;
      localStorage.setItem("walletly_active_wallet", id);
      setTransactions([]);
      setCategories([]);
      setBudgets([]);
      setActiveWalletId(id);
    },
  };

  return (
    <WalletContext.Provider value={{ wallet, wallets, user, session, loading, loadError, apiHelpers, retryLoad, switchWallet: apiHelpers.switchWallet }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
