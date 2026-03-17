import { AuthProvider, useAuth } from "./context/AuthContext";
import { WalletProvider, useWallet } from "./context/WalletContext";
import { NavigationProvider, useNavigation } from "./context/NavigationContext";
import { ToastProvider, useToast } from "./hooks/useToast";
import ErrorBoundary from "./components/ErrorBoundary";
import Toast from "./components/Toast";
import LoadingScreen from "./components/LoadingScreen";
import BottomNav from "./components/BottomNav";
import FAB from "./components/FAB";
import AddTxnSheet from "./components/AddTxnSheet";
import AuthScreen from "./pages/AuthScreen";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import BudgetPage from "./pages/BudgetPage";
import MonthlyRecap from "./pages/MonthlyRecap";
import SettingsPage from "./pages/SettingsPage";
import tokens from "./styles/tokens";
import { useState } from "react";

const PAGES = {
  dashboard: Dashboard,
  transactions: Transactions,
  budget: BudgetPage,
  recap: MonthlyRecap,
  settings: SettingsPage,
};

function AppShell() {
  const { authUser, login, register } = useAuth();
  const { toast, showToast } = useToast();

  if (!authUser) {
    return <AuthScreen onLogin={login} onRegister={register} showToast={showToast} toast={toast} />;
  }

  return (
    <WalletProvider>
      <NavigationProvider>
        <WalletShell />
      </NavigationProvider>
    </WalletProvider>
  );
}

function WalletShell() {
  const { wallet, loading, loadError, retryLoad } = useWallet();
  const { signOut } = useAuth();
  const { toast } = useToast();
  const { page } = useNavigation();
  const [showTxn, setShowTxn] = useState(false);

  if (loading || loadError || !wallet) {
    return <LoadingScreen loading={loading} error={loadError} onRetry={retryLoad} onSignOut={signOut} />;
  }

  const Page = PAGES[page] || Dashboard;

  return (
    <div style={tokens.shell}>
      <div style={tokens.statusBar} />
      {toast && <Toast msg={toast.msg} type={toast.type} />}
      <div style={tokens.content}>
        <Page />
      </div>
      <FAB onClick={() => setShowTxn(true)} />
      <BottomNav />
      {showTxn && <AddTxnSheet onClose={() => setShowTxn(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
