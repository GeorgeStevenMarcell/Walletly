import { useState, useCallback, useRef, useEffect, Component } from "react";
import { api, storage } from "./api.js";

// ─── Error Boundary ──────────────────────────────────────────────────────────
export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("[ErrorBoundary]", error, info); }
  render() {
    if (this.state.error) return (
      <div style={{minHeight:"100vh",background:"#0a0f1e",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{background:"#1e1e2e",borderRadius:16,padding:24,maxWidth:400,width:"100%",border:"1px solid #f8717155"}}>
          <div style={{color:"#f87171",fontSize:18,fontWeight:700,marginBottom:8}}>Something went wrong</div>
          <div style={{color:"#94a3b8",fontSize:13,marginBottom:16,wordBreak:"break-word"}}>{this.state.error?.message || "Unknown error"}</div>
          <button onClick={()=>{this.setState({error:null});window.location.reload();}}
            style={{background:"#22d3ee",color:"#0a0f1e",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>
            Reload App
          </button>
        </div>
      </div>
    );
    return this.props.children;
  }
}

// PWA meta is set in index.html

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_EXPENSE_CATEGORIES = [
  { id:"food",          label:"Food & Dining",  icon:"🍽️", color:"#f59e0b" },
  { id:"transport",     label:"Transport",       icon:"🚗", color:"#3b82f6" },
  { id:"shopping",      label:"Shopping",        icon:"🛍️", color:"#ec4899" },
  { id:"health",        label:"Health",          icon:"💊", color:"#10b981" },
  { id:"entertainment", label:"Entertainment",   icon:"🎬", color:"#8b5cf6" },
  { id:"utilities",     label:"Utilities",       icon:"⚡", color:"#ef4444" },
  { id:"education",     label:"Education",       icon:"📚", color:"#06b6d4" },
  { id:"other",         label:"Other",           icon:"📦", color:"#6b7280" },
];
const DEFAULT_INCOME_CATEGORIES = [
  { id:"salary",       label:"Salary",     icon:"💼", color:"#10b981" },
  { id:"freelance",    label:"Freelance",  icon:"💻", color:"#3b82f6" },
  { id:"investment",   label:"Investment", icon:"📈", color:"#8b5cf6" },
  { id:"gift",         label:"Gift",       icon:"🎁", color:"#f59e0b" },
  { id:"other_income", label:"Other",      icon:"💰", color:"#6b7280" },
];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const EMOJI_PALETTE = ["🍽️","🚗","🛍️","💊","🎬","⚡","📚","📦","🏠","✈️","🐾","🎮","🧴","☕","🍺","💇","🎓","💳","🏋️","🎁","🌿","🧾","🏥","🎵","💼","💻","📈","🛒","🧹","🔧","🎨","🎯","🍕","🧃","🎪","🎻","🏖️","🌮","🎂","🚿"];
const COLOR_PALETTE = ["#f59e0b","#3b82f6","#ec4899","#10b981","#8b5cf6","#ef4444","#06b6d4","#6b7280","#f97316","#14b8a6","#a855f7","#84cc16","#0ea5e9","#d946ef","#fb923c","#e11d48","#0891b2","#7c3aed"];

// ─── Utility ──────────────────────────────────────────────────────────────────
function fmt(n) { return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n); }
function fmtShort(n) {
  if(n>=1000000000) return "Rp "+(n/1000000000).toFixed(1)+"B";
  if(n>=1000000) return "Rp "+(n/1000000).toFixed(1)+"M";
  if(n>=1000) return "Rp "+(n/1000).toFixed(0)+"K";
  return fmt(n);
}
function todayStr() { return new Date().toISOString().slice(0,10); }
function getPeriodKey(dateStr,msd) {
  if(msd===1) return dateStr.slice(0,7);
  const d=new Date(dateStr); const day=d.getDate();
  let year=d.getFullYear(), month=d.getMonth();
  if(day<msd){month--;if(month<0){month=11;year--;}}
  return `${year}-${String(month+1).padStart(2,"0")}`;
}
function getCurrentPeriodKey(msd){return getPeriodKey(todayStr(),msd);}
function periodLabel(key,msd){
  if(!key) return "—";
  const [y,m]=key.split("-");
  const mn=MONTHS[parseInt(m)-1];
  if(msd===1) return `${mn} ${y}`;
  const em=parseInt(m)===12?1:parseInt(m)+1;
  const ey=parseInt(m)===12?parseInt(y)+1:parseInt(y);
  return `${mn} ${y} – ${MONTHS[em-1]} ${ey}`;
}
function mkWallet(id,name,owner){
  return{id,name,owner,members:[owner],transactions:[],
    budgets:{food:1000000,transport:400000,shopping:500000,entertainment:200000,health:300000,utilities:250000,education:0,other:100000},
    expenseCategories:JSON.parse(JSON.stringify(DEFAULT_EXPENSE_CATEGORIES)),
    incomeCategories:JSON.parse(JSON.stringify(DEFAULT_INCOME_CATEGORIES)),
    settings:{monthStartDay:1,dayStartHour:0}};
}
function getPeriodDates(pk,msd){
  const [y,m]=pk.split("-").map(Number);
  const start=new Date(y,m-1,msd);
  const em=m===12?1:m+1,ey=m===12?y+1:y;
  const end=new Date(ey,em-1,msd-1);
  return{start,end};
}

// ─── App Root (API-wired) ─────────────────────────────────────────────────────
export default function App(){
  // ── Auth state ────────────────────────────────────────────────────────────
  const [authUser, setAuthUser]       = useState(() => {
    const t = storage.getToken();
    return t ? JSON.parse(localStorage.getItem("walletly_user") || "null") : null;
  });

  // ── Remote data ───────────────────────────────────────────────────────────
  const [wallets,      setWallets]      = useState([]);
  const [activeWalletId, setActiveWalletId] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [categories,   setCategories]   = useState([]);
  const [budgets,      setBudgets]      = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [loadError,    setLoadError]    = useState(null);

  const [page,    setPage]    = useState("dashboard");
  const [toast,   setToast]   = useState(null);
  const [addOpen, setAddOpen] = useState(false);

  const showToast = (msg, type="success") => {
    setToast({msg, type});
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load wallets after login ───────────────────────────────────────────────
  useEffect(() => {
    if (!authUser) return;
    setLoadError(null);
    setLoading(true);
    api.getWallets().then(ws => {
      console.log("[walletly] getWallets response:", ws);
      if (!Array.isArray(ws) || !ws.length) {
        setLoadError("No wallets found. Try logging out and registering again.");
        setLoading(false);
        return;
      }
      setWallets(ws);
      if (!activeWalletId) setActiveWalletId(ws[0].id);
    }).catch(err => {
      console.error("[walletly] getWallets error:", err);
      setLoadError(err.message || "Failed to load wallets");
      setLoading(false);
    });
  }, [authUser]);

  // ── Load wallet data when active wallet changes ───────────────────────────
  useEffect(() => {
    if (!activeWalletId) return;
    setLoading(true);
    setLoadError(null);
    const w = wallets.find(wl => wl.id === activeWalletId);
    const msd = w?.month_start_day || 1;
    // Load last 3 months of transactions + current categories + current budgets
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0,10);
    const to   = now.toISOString().slice(0,10);
    Promise.all([
      api.getTransactions(activeWalletId, { from, to }),
      api.getCategories(activeWalletId),
      api.getBudgets(activeWalletId, todayStr().slice(0,7)),
    ]).then(([txns, cats, bdgs]) => {
      console.log("[walletly] wallet data loaded:", { txns: txns?.length, cats: cats?.length, bdgs: bdgs?.length });
      setTransactions(txns || []);
      setCategories(cats || []);
      setBudgets(bdgs || []);
    }).catch(err => {
      console.error("[walletly] wallet data error:", err);
      setLoadError(err.message || "Failed to load wallet data");
    }).finally(() => setLoading(false));
  }, [activeWalletId]);

  // ── Convenience helpers that keep local state in sync with API ────────────
  const refreshTransactions = useCallback(async () => {
    if (!activeWalletId) return;
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0,10);
    const to   = now.toISOString().slice(0,10);
    const txns = await api.getTransactions(activeWalletId, { from, to });
    setTransactions(txns || []);
  }, [activeWalletId]);

  const refreshBudgets = useCallback(async () => {
    if (!activeWalletId) return;
    const bdgs = await api.getBudgets(activeWalletId, todayStr().slice(0,7));
    setBudgets(bdgs || []);
  }, [activeWalletId]);

  const refreshCategories = useCallback(async () => {
    if (!activeWalletId) return;
    const cats = await api.getCategories(activeWalletId);
    setCategories(cats || []);
  }, [activeWalletId]);

  const refreshWallets = useCallback(async () => {
    const ws = await api.getWallets();
    setWallets(ws || []);
  }, []);

  // ── Build a wallet-shaped object the existing UI components expect ─────────
  const activeWalletRaw = wallets.find(w => w.id === activeWalletId);
  const expenseCats = categories.filter(c => c.type === "expense");
  const incomeCats  = categories.filter(c => c.type === "income");
  // Convert budget rows [{category_id, amount}] to the map format {catId: amount}
  const budgetMap = Object.fromEntries(budgets.map(b => [b.category_id, Number(b.amount)]));

  const wallet = activeWalletRaw ? {
    ...activeWalletRaw,
    id:                 activeWalletRaw.id,
    name:               activeWalletRaw.name,
    owner:              activeWalletRaw.owner_id,
    members:            (activeWalletRaw.members || []).map(m => m.id || m),
    _memberObjects:     activeWalletRaw.members || [],
    _budgetRows:        budgets,
    settings: {
      monthStartDay: activeWalletRaw.month_start_day || 1,
      dayStartHour:  activeWalletRaw.day_start_hour  || 0,
    },
    expenseCategories:  expenseCats.map(c => ({ id:c.id, label:c.label, icon:c.icon, color:c.color })),
    incomeCategories:   incomeCats.map( c => ({ id:c.id, label:c.label, icon:c.icon, color:c.color })),
    budgets:            budgetMap,
    transactions: transactions.map(t => ({
      ...t,
      date:       t.txn_date || t.date,
      category:   t.category_id || t.category,
      addedBy:    t.added_by   || t.addedBy,
      amount:     Number(t.amount),
    })),
  } : null;

  const user = authUser ? { name: authUser.displayName, wallets: wallets.map(w => w.id) } : null;
  const session = authUser ? { username: authUser.username, walletId: activeWalletId } : null;

  // ── updateDb shim — translates local state mutations into API calls ────────
  // This lets the existing UI components call updateDb() as before, and we
  // intercept and make the real API call, then refresh.
  const updateDb = useCallback((fn) => {
    // The fn receives a fake db object with a proxy on wallets[id]
    // We use a sentinel approach: fn receives an object, we inspect what changed.
    // For simplicity we expose direct API helpers via context instead.
    // Components that need API calls use the helpers below directly.
    console.warn("[updateDb] called — components should use apiHelpers instead");
  }, []);

  // ── API helpers passed to child components ────────────────────────────────
  const apiHelpers = {
    addTransaction: async (data) => {
      await api.createTransaction(activeWalletId, {
        type: data.type, amount: data.amount,
        categoryId: data.category, note: data.note,
        txnDate: data.date,
      });
      await refreshTransactions();
      showToast("Transaction added ✓");
    },
    deleteTransaction: async (id) => {
      await api.deleteTransaction(activeWalletId, id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      showToast("Deleted");
    },
    upsertBudget: async (categoryId, amount) => {
      const period = todayStr().slice(0,7);
      await api.upsertBudget(activeWalletId, { categoryId, amount, period });
      await refreshBudgets();
      showToast("Budget saved ✓");
    },
    deleteBudget: async (id) => {
      await api.deleteBudget(activeWalletId, id);
      await refreshBudgets();
      showToast("Budget removed");
    },
    addCategory: async (type, label, icon, color) => {
      await api.createCategory(activeWalletId, { type, label, icon, color });
      await refreshCategories();
      showToast("Category added ✓");
    },
    deleteCategory: async (id) => {
      await api.deleteCategory(activeWalletId, id);
      await refreshCategories();
      showToast("Category deleted");
    },
    updateSettings: async (settings) => {
      await api.updateSettings(activeWalletId, {
        monthStartDay: settings.monthStartDay,
        dayStartHour:  settings.dayStartHour,
      });
      await refreshWallets();
      showToast("Settings saved ✓");
    },
    inviteMember: async (username) => {
      await api.inviteMember(activeWalletId, username);
      await refreshWallets();
      showToast(`${username} added 🎉`);
    },
    removeMember: async (userId) => {
      await api.removeMember(activeWalletId, userId);
      await refreshWallets();
      showToast("Member removed");
    },
    createWallet: async (name) => {
      await api.createWallet(name);
      await refreshWallets();
      showToast("Wallet created!");
    },
    switchWallet: (id) => setActiveWalletId(id),
  };

  if (!authUser) return (
    <AuthScreen
      onLogin={async (username, password) => {
        const res = await api.login(username, password);
        storage.setToken(res.token);
        localStorage.setItem("walletly_user", JSON.stringify(res.user));
        setAuthUser(res.user);
      }}
      onRegister={async (username, password, displayName) => {
        const res = await api.register(username, password, displayName);
        storage.setToken(res.token);
        localStorage.setItem("walletly_user", JSON.stringify(res.user));
        setAuthUser(res.user);
      }}
      showToast={showToast}
      toast={toast}
    />
  );

  if (loading || !wallet) return (
    <div style={{minHeight:"100vh",background:"#0a0f1e",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,padding:20}}>
      {loadError ? (
        <div style={{background:"#1e1e2e",borderRadius:16,padding:24,maxWidth:400,width:"100%",border:"1px solid #f8717155",textAlign:"center"}}>
          <div style={{color:"#f87171",fontSize:16,fontWeight:700,marginBottom:8}}>Failed to load</div>
          <div style={{color:"#94a3b8",fontSize:13,marginBottom:16}}>{loadError}</div>
          <div style={{display:"flex",gap:8,justifyContent:"center"}}>
            <button onClick={()=>{setLoadError(null);setLoading(true);api.getWallets().then(ws=>{setWallets(ws||[]);if(ws?.length)setActiveWalletId(ws[0].id);}).catch(e=>setLoadError(e.message)).finally(()=>setLoading(false));}}
              style={{background:"#22d3ee",color:"#0a0f1e",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>
              Retry
            </button>
            <button onClick={()=>{storage.clearToken();localStorage.removeItem("walletly_user");setAuthUser(null);setWallets([]);setActiveWalletId(null);}}
              style={{background:"#1e293b",color:"#94a3b8",border:"none",borderRadius:8,padding:"8px 16px",fontWeight:700,cursor:"pointer",fontSize:13}}>
              Sign Out
            </button>
          </div>
        </div>
      ) : (
        <div style={{color:"#22d3ee",fontSize:16,fontWeight:600}}>Loading…</div>
      )}
    </div>
  );

  const NAV=[
    {id:"dashboard",   label:"Home",        icon:"🏠"},
    {id:"transactions",label:"Transactions",icon:"↕️"},
    {id:"budget",      label:"Budgets",     icon:"🎯"},
    {id:"recap",       label:"Reports",     icon:"📊"},
    {id:"settings",    label:"Account",     icon:"👤"},
  ];

  return(
    <div style={D.shell}>
      <div style={D.statusBar}/>
      <div style={D.content}>
        {toast&&<Toast msg={toast.msg} type={toast.type}/>}
        {page==="dashboard"    &&<Dashboard    wallet={wallet} session={session} setPage={setPage} wallets={wallets} setActiveWalletId={setActiveWalletId} user={user}/>}
        {page==="transactions" &&<Transactions wallet={wallet} session={session} apiHelpers={apiHelpers} showToast={showToast}/>}
        {page==="budget"       &&<BudgetPage   wallet={wallet} apiHelpers={apiHelpers} showToast={showToast}/>}
        {page==="recap"        &&<MonthlyRecap wallet={wallet}/>}
        {page==="settings"     &&<SettingsPage wallet={wallet} session={session} wallets={wallets} apiHelpers={apiHelpers} showToast={showToast} onSignOut={()=>{storage.clearToken();localStorage.removeItem("walletly_user");setAuthUser(null);setWallets([]);setActiveWalletId(null);}}/>}
      </div>
      <button style={D.fab} onClick={()=>setAddOpen(true)}>+</button>
      <nav style={D.bottomNav}>
        {NAV.map(n=>(
          <button key={n.id} onClick={()=>setPage(n.id)} style={{...D.navItem,...(page===n.id?D.navActive:{})}}>
            <span style={{fontSize:20}}>{n.icon}</span>
            <span style={{fontSize:10,marginTop:2,fontWeight:page===n.id?700:400}}>{n.label}</span>
          </button>
        ))}
      </nav>
      {addOpen&&<AddTxnSheet wallet={wallet} session={session} apiHelpers={apiHelpers} showToast={showToast} onClose={()=>setAddOpen(false)}/>}
    </div>
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
function AuthScreen({onLogin,onRegister,showToast,toast}){
  const [mode,setMode]=useState("login");
  const [form,setForm]=useState({username:"",password:"",name:""});
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);
  async function handle(){
    setErr(""); setBusy(true);
    try{
      if(mode==="login"){
        if(!form.username||!form.password) return setErr("All fields required.");
        await onLogin(form.username, form.password);
      }else{
        if(!form.username||!form.password||!form.name) return setErr("All fields required.");
        await onRegister(form.username, form.password, form.name);
        showToast("Welcome! 🎉");
      }
    }catch(e){ setErr(e.message||"Something went wrong"); }
    finally{ setBusy(false); }
  }
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#0a0f1e,#111827 60%,#0a0f1e)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:"#161d2e",borderRadius:24,padding:"36px 28px",width:"100%",maxWidth:380,boxShadow:"0 32px 64px rgba(0,0,0,0.5)",border:"1px solid #1e293b"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:48,marginBottom:8}}>💳</div>
          <h1 style={{fontSize:28,fontWeight:900,color:"#fff",margin:0,letterSpacing:"-1px"}}>Walletly</h1>
          <p style={{color:"#64748b",fontSize:13,marginTop:6}}>Smart budget tracking</p>
        </div>
        <div style={{display:"flex",background:"#0f172a",borderRadius:12,padding:3,marginBottom:20}}>
          {["login","register"].map(m=>(
            <button key={m} onClick={()=>setMode(m)} style={{flex:1,padding:"10px 0",border:"none",background:mode===m?"#1e293b":"transparent",cursor:"pointer",borderRadius:10,fontWeight:600,color:mode===m?"#fff":"#64748b",fontSize:13}}>
              {m==="login"?"Sign In":"Register"}
            </button>
          ))}
        </div>
        {mode==="register"&&<input style={D.inp} placeholder="Full Name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>}
        <input style={D.inp} placeholder="Username" value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/>
        <input style={D.inp} type="password" placeholder="Password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} onKeyDown={e=>e.key==="Enter"&&handle()}/>
        {err&&<p style={{color:"#f87171",fontSize:13,marginBottom:10}}>{err}</p>}
        <button style={{...D.btn,width:"100%",padding:14,fontSize:15,marginTop:4}} onClick={handle}>{mode==="login"?"Sign In →":"Create Account →"}</button>
        {mode==="login"&&<p style={{textAlign:"center",color:"#475569",fontSize:12,marginTop:14}}>Demo: <b style={{color:"#94a3b8"}}>george</b> / <b style={{color:"#94a3b8"}}>1234</b></p>}
        {toast&&<Toast msg={toast.msg} type={toast.type}/>}
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({wallet,session,setPage,wallets,setActiveWalletId,user}){
  const msd=wallet.settings?.monthStartDay||1;
  const pk=getCurrentPeriodKey(msd);
  const cats=wallet.expenseCategories||DEFAULT_EXPENSE_CATEGORIES;
  const allC=[...cats,...(wallet.incomeCategories||DEFAULT_INCOME_CATEGORIES)];
  const txns=wallet.transactions.filter(t=>getPeriodKey(t.date,msd)===pk);
  const inc=txns.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const exp=txns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const bal=inc-exp;
  const [balVis,setBalVis]=useState(true);
  const [reportTab,setReportTab]=useState("month");
  const [topTab,setTopTab]=useState("month");

  const now=new Date();
  const weekStart=new Date(now);weekStart.setDate(now.getDate()-now.getDay());weekStart.setHours(0,0,0,0);
  const prevWeekStart=new Date(weekStart);prevWeekStart.setDate(weekStart.getDate()-7);
  const prevWeekEnd=new Date(weekStart);prevWeekEnd.setDate(weekStart.getDate()-1);prevWeekEnd.setHours(23,59,59,999);
  function inR(d,s,e){const dt=new Date(d);return dt>=s&&dt<=e;}

  const weekExp=wallet.transactions.filter(t=>t.type==="expense"&&inR(t.date,weekStart,now)).reduce((s,t)=>s+t.amount,0);
  const prevWeekExp=wallet.transactions.filter(t=>t.type==="expense"&&inR(t.date,prevWeekStart,prevWeekEnd)).reduce((s,t)=>s+t.amount,0);

  const topSrcTxns=topTab==="week"
    ?wallet.transactions.filter(t=>t.type==="expense"&&inR(t.date,weekStart,now))
    :txns.filter(t=>t.type==="expense");
  const topSrcTotal=topSrcTxns.reduce((s,t)=>s+t.amount,0)||1;
  const catTotals=cats.map(c=>({...c,total:topSrcTxns.filter(t=>t.category===c.id).reduce((s,t)=>s+t.amount,0)}))
    .filter(c=>c.total>0).sort((a,b)=>b.total-a.total);

  // 3-month average (last 3 complete periods before current)
  const avg3Months=(()=>{
    const totals=[];
    for(let i=1;i<=3;i++){
      const pastPk=shiftPeriodKey(pk,i);
      totals.push(getPeriodSpend(wallet.transactions,pastPk,msd));
    }
    const nonZero=totals.filter(v=>v>0);
    return nonZero.length>0?nonZero.reduce((a,b)=>a+b,0)/nonZero.length:0;
  })();

  // 3-month avg for week mode: avg weekly spend over last 12 weeks
  const avg3Weeks=(()=>{
    const weekTotals=[];
    for(let i=1;i<=12;i++){
      const ws=new Date(weekStart);ws.setDate(ws.getDate()-7*i);
      const we=new Date(ws);we.setDate(ws.getDate()+6);we.setHours(23,59,59,999);
      const t=wallet.transactions.filter(x=>x.type==="expense"&&inR(x.date,ws,we)).reduce((s,x)=>s+x.amount,0);
      if(t>0)weekTotals.push(t);
    }
    return weekTotals.length>0?weekTotals.reduce((a,b)=>a+b,0)/weekTotals.length:0;
  })();

  const userWallets=wallets||[];
  const recentTxns=[...wallet.transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);

  return(
    <div style={{background:"#0a0f1e",minHeight:"100%"}}>
      {/* Header */}
      <div style={{padding:"16px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{color:"#475569",fontSize:12}}>Good day,</div>
          <div style={{color:"#fff",fontWeight:800,fontSize:17}}>{user.name} 👋</div>
        </div>
        {userWallets.length>1&&(
          <select style={{background:"#131c2e",border:"1px solid #1e293b",color:"#94a3b8",borderRadius:8,padding:"5px 8px",fontSize:11,cursor:"pointer"}}
            value={session.walletId} onChange={e=>setActiveWalletId(e.target.value)}>
            {userWallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
      </div>

      {/* Balance Hero */}
      <div style={{padding:"14px 16px 0"}}>
        <div style={{background:"linear-gradient(135deg,#131c2e,#1a2540)",borderRadius:20,padding:"20px",border:"1px solid #1e2d45",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,borderRadius:"50%",background:"#22d3ee0a"}}/>
          <div style={{position:"absolute",bottom:-20,right:30,width:70,height:70,borderRadius:"50%",background:"#6366f10a"}}/>
          <div style={{color:"#475569",fontSize:11,marginBottom:2}}>Total balance ⓘ</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            <div style={{fontSize:26,fontWeight:900,color:"#fff",fontFamily:"monospace",letterSpacing:"-1px"}}>
              {balVis?fmt(bal):"Rp ••••••"}
            </div>
            <button onClick={()=>setBalVis(!balVis)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#475569"}}>
              {balVis?"👁️":"🙈"}
            </button>
          </div>
          <div style={{display:"flex",gap:10}}>
            <div style={{flex:1,background:"#ffffff07",borderRadius:10,padding:"8px 10px"}}>
              <div style={{color:"#10b981",fontSize:10,marginBottom:1}}>↑ Income</div>
              <div style={{color:"#fff",fontWeight:700,fontSize:13}}>{balVis?fmtShort(inc):"••••"}</div>
            </div>
            <div style={{flex:1,background:"#ffffff07",borderRadius:10,padding:"8px 10px"}}>
              <div style={{color:"#f87171",fontSize:10,marginBottom:1}}>↓ Expenses</div>
              <div style={{color:"#fff",fontWeight:700,fontSize:13}}>{balVis?fmtShort(exp):"••••"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* My Wallets */}
      <div style={{padding:"16px 16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{color:"#fff",fontWeight:700,fontSize:14}}>My Wallets</div>
          <button onClick={()=>setPage("settings")} style={{background:"none",border:"none",color:"#22d3ee",fontSize:12,cursor:"pointer",fontWeight:600}}>See all</button>
        </div>
        <div style={{background:"#131c2e",borderRadius:14,overflow:"hidden",border:"1px solid #1e293b"}}>
          {userWallets.map((w,i)=>{
            const wm=w.settings?.monthStartDay||1;
            const wPk=getCurrentPeriodKey(wm);
            const wTxns=w.id===session.walletId?(wallet?.transactions||[]):[];
            const wInc=wTxns.filter(t=>getPeriodKey(t.date,wm)===wPk&&t.type==="income").reduce((s,t)=>s+t.amount,0);
            const wExp=wTxns.filter(t=>getPeriodKey(t.date,wm)===wPk&&t.type==="expense").reduce((s,t)=>s+t.amount,0);
            const GRAD=[["#f59e0b","#f97316"],["#10b981","#06b6d4"],["#3b82f6","#6366f1"],["#8b5cf6","#ec4899"]];
            return(
              <div key={w.id} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderBottom:i<userWallets.length-1?"1px solid #1e293b":"none",cursor:"pointer"}} onClick={()=>setActiveWalletId(w.id)}>
                <div style={{width:38,height:38,borderRadius:11,background:`linear-gradient(135deg,${GRAD[i%4][0]},${GRAD[i%4][1]})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>💳</div>
                <div style={{flex:1}}>
                  <div style={{color:"#fff",fontWeight:600,fontSize:13}}>{w.name}</div>
                  <div style={{color:"#475569",fontSize:11}}>{w.members.length} member{w.members.length!==1?"s":""}</div>
                </div>
                <div style={{color:"#fff",fontWeight:700,fontSize:13}}>{balVis?fmtShort(wInc-wExp):"••••"}</div>
                {w.id===session.walletId&&<div style={{width:7,height:7,borderRadius:"50%",background:"#22d3ee",flexShrink:0}}/>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Spending Report */}
      <div style={{padding:"16px 16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{color:"#94a3b8",fontSize:12}}>Report this month</div>
          <button onClick={()=>setPage("recap")} style={{background:"none",border:"none",color:"#22d3ee",fontSize:12,cursor:"pointer",fontWeight:600}}>See reports</button>
        </div>
        <div style={{background:"#131c2e",borderRadius:14,padding:"14px",border:"1px solid #1e293b"}}>
          <div style={{display:"flex",background:"#0a0f1e",borderRadius:9,padding:3,marginBottom:12}}>
            {["week","month"].map(t=>(
              <button key={t} onClick={()=>setReportTab(t)} style={{flex:1,padding:"7px 0",border:"none",background:reportTab===t?"#1e293b":"transparent",cursor:"pointer",borderRadius:7,fontWeight:600,color:reportTab===t?"#fff":"#475569",fontSize:12}}>
                {t==="week"?"Week":"Month"}
              </button>
            ))}
          </div>
          {reportTab==="week"?(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div>
                  <div style={{color:"#fff",fontSize:20,fontWeight:800}}>{fmtShort(weekExp)}</div>
                  <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,marginTop:2}}>
                    <span style={{color:weekExp<=prevWeekExp?"#10b981":"#f87171"}}>{weekExp<=prevWeekExp?"↓":"↑"} {prevWeekExp>0?Math.abs(Math.round((weekExp-prevWeekExp)/prevWeekExp*100))+"% vs last week":"First week"}</span>
                  </div>
                </div>
                {avg3Weeks>0&&(
                  <div style={{textAlign:"right"}}>
                    <div style={{color:"#f59e0b",fontSize:11,fontWeight:700}}>3-mo avg</div>
                    <div style={{color:"#94a3b8",fontSize:12,fontWeight:600}}>{fmtShort(avg3Weeks)}/wk</div>
                    <div style={{color:weekExp<=avg3Weeks?"#10b981":"#f87171",fontSize:10,marginTop:1}}>
                      {weekExp<=avg3Weeks?"↓ below avg":"↑ above avg"}
                    </div>
                  </div>
                )}
              </div>
              <SpendChart wallet={wallet} mode="week" weekStart={weekStart} prevWeekStart={prevWeekStart} prevWeekEnd={prevWeekEnd} now={now} avg3={avg3Weeks}/>
              {avg3Weeks>0&&(
                <div style={{display:"flex",gap:14,marginTop:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#64748b"}}>
                    <div style={{width:10,height:10,borderRadius:2,background:"#f87171"}}/>This week
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#64748b"}}>
                    <div style={{width:10,height:10,borderRadius:2,background:"#f8717133"}}/>Last week
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#64748b"}}>
                    <div style={{width:14,height:2,background:"#f59e0b",borderRadius:1,marginRight:1}}/>3-mo avg
                  </div>
                </div>
              )}
            </>
          ):(
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div>
                  <div style={{color:"#fff",fontSize:20,fontWeight:800}}>{fmtShort(exp)}</div>
                  <div style={{color:"#94a3b8",fontSize:11,marginTop:2}}>Total spent · {periodLabel(pk,msd)}</div>
                </div>
                {avg3Months>0&&(
                  <div style={{textAlign:"right"}}>
                    <div style={{color:"#f59e0b",fontSize:11,fontWeight:700}}>3-mo avg</div>
                    <div style={{color:"#94a3b8",fontSize:12,fontWeight:600}}>{fmtShort(avg3Months)}/mo</div>
                    <div style={{color:exp<=avg3Months?"#10b981":"#f87171",fontSize:10,marginTop:1}}>
                      {exp<=avg3Months?"↓ below avg":"↑ above avg"}
                    </div>
                  </div>
                )}
              </div>
              <SpendChart wallet={wallet} mode="month" pk={pk} msd={msd} avg3={avg3Months}/>
              {avg3Months>0&&(
                <div style={{display:"flex",gap:14,marginTop:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#64748b"}}>
                    <div style={{width:10,height:10,borderRadius:2,background:"#22d3ee"}}/>This month
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:"#64748b"}}>
                    <div style={{width:14,height:2,background:"#f59e0b",borderRadius:1,marginRight:1}}/>3-mo avg
                  </div>
                  {avg3Months>0&&exp>0&&(
                    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,color:exp<=avg3Months?"#10b981":"#f87171",marginLeft:"auto"}}>
                      {exp<=avg3Months?"↓":"↑"} {Math.abs(Math.round((exp-avg3Months)/avg3Months*100))}% vs avg
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          <button style={{background:"none",border:"none",color:"#22d3ee",fontSize:12,cursor:"pointer",fontWeight:600,marginTop:10,padding:0}} onClick={()=>setPage("recap")}>Spending report →</button>
        </div>
      </div>

      {/* Top Spending */}
      <div style={{padding:"16px 16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{color:"#fff",fontWeight:700,fontSize:14}}>Top spending</div>
          <button onClick={()=>setPage("budget")} style={{background:"none",border:"none",color:"#22d3ee",fontSize:12,cursor:"pointer",fontWeight:600}}>See details</button>
        </div>
        <div style={{display:"flex",background:"#131c2e",borderRadius:10,padding:3,marginBottom:10,border:"1px solid #1e293b"}}>
          {["week","month"].map(t=>(
            <button key={t} onClick={()=>setTopTab(t)} style={{flex:1,padding:"7px 0",border:"none",background:topTab===t?"#1e293b":"transparent",cursor:"pointer",borderRadius:8,fontWeight:600,color:topTab===t?"#fff":"#475569",fontSize:12}}>
              {t==="week"?"Week":"Month"}
            </button>
          ))}
        </div>
        <div style={{background:"#131c2e",borderRadius:14,overflow:"hidden",border:"1px solid #1e293b"}}>
          {catTotals.length===0?(
            <div style={{padding:20,color:"#475569",textAlign:"center",fontSize:13}}>No expenses yet</div>
          ):catTotals.slice(0,4).map((c,i)=>{
            const pct=Math.round(c.total/topSrcTotal*100);
            return(
              <div key={c.id} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderBottom:i<Math.min(catTotals.length,4)-1?"1px solid #1e293b":"none"}}>
                <div style={{width:40,height:40,borderRadius:11,background:c.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{c.icon}</div>
                <div style={{flex:1}}>
                  <div style={{color:"#fff",fontWeight:600,fontSize:13}}>{c.label}</div>
                  <div style={{color:"#475569",fontSize:11,marginTop:1}}>{fmt(c.total)}</div>
                </div>
                <div style={{color:pct>50?"#f87171":pct>25?"#f59e0b":"#94a3b8",fontWeight:700,fontSize:13}}>{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Transactions */}
      <div style={{padding:"16px 16px 0"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{color:"#fff",fontWeight:700,fontSize:14}}>Recent transactions</div>
          <button onClick={()=>setPage("transactions")} style={{background:"none",border:"none",color:"#22d3ee",fontSize:12,cursor:"pointer",fontWeight:600}}>See all</button>
        </div>
        <div style={{background:"#131c2e",borderRadius:14,overflow:"hidden",border:"1px solid #1e293b",marginBottom:110}}>
          {recentTxns.length===0?(
            <div style={{padding:20,color:"#475569",textAlign:"center",fontSize:13}}>No transactions yet</div>
          ):recentTxns.map((t,i)=>{
            const cat=allC.find(c=>c.id===t.category);
            return(
              <div key={t.id} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderBottom:i<recentTxns.length-1?"1px solid #1e293b":"none"}}>
                <div style={{width:40,height:40,borderRadius:11,background:(cat?.color||"#6b7280")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{cat?.icon||"💱"}</div>
                <div style={{flex:1}}>
                  <div style={{color:"#fff",fontWeight:600,fontSize:13}}>{cat?.label||"Transaction"}</div>
                  <div style={{color:"#475569",fontSize:11,marginTop:1}}>{t.date.slice(5).replace("-"," ")} {MONTHS[parseInt(t.date.slice(5,7))-1]} {t.note?"· "+t.note:""}</div>
                </div>
                <div style={{color:t.type==="income"?"#10b981":"#f87171",fontWeight:700,fontSize:13}}>
                  {t.type==="income"?"+":"-"}{fmtShort(t.amount)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Spend Chart ──────────────────────────────────────────────────────────────
// Computes spending totals for a given period key
function getPeriodSpend(transactions, pk, msd){
  return transactions.filter(t=>t.type==="expense"&&getPeriodKey(t.date,msd)===pk).reduce((s,t)=>s+t.amount,0);
}
// Gets the period key N months before the given key
function shiftPeriodKey(pk, monthsBack){
  let [y,m]=pk.split("-").map(Number);
  m-=monthsBack; while(m<1){m+=12;y--;}
  return `${y}-${String(m).padStart(2,"0")}`;
}

function SpendChart({wallet,mode,weekStart,prevWeekStart,prevWeekEnd,now,pk,msd,avg3}){
  const ref=useRef(null);
  useEffect(()=>{
    const c=ref.current;if(!c)return;
    const ctx=c.getContext("2d");
    const W=c.offsetWidth||280,H=110;
    c.width=W;c.height=H;ctx.clearRect(0,0,W,H);
    const pad={t:8,r:8,b:20,l:8};
    const gW=W-pad.l-pad.r, gH=H-pad.t-pad.b;

    if(mode==="week"){
      function inR(d,s,e){const dt=new Date(d);return dt>=s&&dt<=e;}
      const tw=wallet.transactions.filter(t=>t.type==="expense"&&inR(t.date,weekStart,now)).reduce((s,t)=>s+t.amount,0);
      const pw=wallet.transactions.filter(t=>t.type==="expense"&&inR(t.date,prevWeekStart,prevWeekEnd)).reduce((s,t)=>s+t.amount,0);
      const mx=Math.max(tw,pw,avg3||0,1)*1.15;
      const bw=gW*0.25, gap=gW*0.08;
      const x0=pad.l+(gW-(bw*2+gap))/2;

      // prev bar
      const ph=(pw/mx)*gH;
      ctx.fillStyle="#f8717133";
      ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x0,pad.t+gH-ph,bw,ph,4);else ctx.rect(x0,pad.t+gH-ph,bw,ph);ctx.fill();
      // this bar
      const th=(tw/mx)*gH;
      ctx.fillStyle="#f87171cc";
      ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x0+bw+gap,pad.t+gH-th,bw,th,4);else ctx.rect(x0+bw+gap,pad.t+gH-th,bw,th);ctx.fill();

      // 3-month avg line
      if(avg3>0){
        const ay=pad.t+gH*(1-avg3/mx);
        ctx.save();
        ctx.strokeStyle="#f59e0b";ctx.lineWidth=1.5;ctx.setLineDash([4,3]);
        ctx.beginPath();ctx.moveTo(pad.l,ay);ctx.lineTo(pad.l+gW,ay);ctx.stroke();
        ctx.setLineDash([]);ctx.restore();
      }

      // x labels
      ctx.fillStyle="#334155";ctx.font="9px sans-serif";ctx.textAlign="center";
      ctx.fillText("Last week",x0+bw/2,H-3);
      ctx.fillText("This week",x0+bw+gap+bw/2,H-3);

    }else{
      const{start,end}=getPeriodDates(pk,msd);
      const days=[];for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1))days.push(new Date(d).toISOString().slice(0,10));
      const vals=days.map(date=>wallet.transactions.filter(t=>t.type==="expense"&&t.date===date).reduce((s,t)=>s+t.amount,0));
      const maxDayAvg=avg3>0?avg3/days.length:0;
      const mx=Math.max(...vals,maxDayAvg,1)*1.15;
      const bw=Math.max(2,(gW-days.length)/(days.length));

      vals.forEach((v,i)=>{
        const bh=Math.max(2,(v/mx)*gH);
        const x=pad.l+i*(bw+1);
        const isToday=days[i]===todayStr();
        ctx.fillStyle=isToday?"#22d3ee":v>0?"#22d3ee33":"#1e293b44";
        ctx.beginPath();if(ctx.roundRect)ctx.roundRect(x,pad.t+gH-bh,bw,bh,2);else ctx.rect(x,pad.t+gH-bh,bw,bh);ctx.fill();
      });

      // 3-month avg daily line — draw as smooth area overlay
      if(avg3>0){
        const avgDay=avg3/days.length;
        const avgY=pad.t+gH*(1-avgDay/mx);
        ctx.save();
        ctx.strokeStyle="#f59e0b";ctx.lineWidth=1.5;ctx.setLineDash([4,3]);
        ctx.beginPath();ctx.moveTo(pad.l,avgY);ctx.lineTo(pad.l+gW,avgY);ctx.stroke();
        ctx.setLineDash([]);ctx.restore();
      }

      // x-axis month labels
      ctx.fillStyle="#334155";ctx.font="9px sans-serif";ctx.textAlign="left";
      ctx.fillText(days[0]?.slice(5).replace("-","/"),pad.l,H-3);
      ctx.textAlign="right";
      ctx.fillText(days[days.length-1]?.slice(5).replace("-","/"),pad.l+gW,H-3);
    }

    // baseline
    ctx.strokeStyle="#1e293b";ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(pad.l,pad.t+gH);ctx.lineTo(pad.l+gW,pad.t+gH);ctx.stroke();
  });
  return <canvas ref={ref} style={{width:"100%",height:110,display:"block"}}/>;
}

// ─── Add Transaction Sheet ────────────────────────────────────────────────────
function AddTxnSheet({wallet,session,apiHelpers,showToast,onClose}){
  const cats=wallet.expenseCategories||DEFAULT_EXPENSE_CATEGORIES;
  const incomeCats=wallet.incomeCategories||DEFAULT_INCOME_CATEGORIES;
  const [form,setForm]=useState({type:"expense",amount:"",category:cats[0]?.id||"other",note:"",date:todayStr()});
  const [busy,setBusy]=useState(false);
  const curCats=form.type==="expense"?cats:incomeCats;
  async function save(){
    if(!form.amount||isNaN(+form.amount)||+form.amount<=0) return showToast("Enter a valid amount","error");
    setBusy(true);
    try{ await apiHelpers.addTransaction({type:form.type,amount:+form.amount,category:form.category,note:form.note,date:form.date}); onClose(); }
    catch(e){ showToast(e.message,"error"); }
    finally{ setBusy(false); }
  }
  return(
    <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"flex-end"}} onClick={onClose}>
      <div style={{background:"#131c2e",borderRadius:"20px 20px 0 0",padding:"16px 18px 40px",width:"100%",border:"1px solid #1e293b",boxSizing:"border-box"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,background:"#1e293b",borderRadius:99,margin:"0 auto 16px"}}/>
        <div style={{fontSize:15,fontWeight:800,color:"#fff",marginBottom:14}}>Add Transaction</div>
        <div style={{display:"flex",background:"#0a0f1e",borderRadius:10,padding:3,marginBottom:12}}>
          {["expense","income"].map(t=>(
            <button key={t} onClick={()=>setForm({...form,type:t,category:(t==="expense"?cats[0]?.id:incomeCats[0]?.id)||"other"})}
              style={{flex:1,padding:"9px 0",border:"none",background:form.type===t?(t==="income"?"#10b981":"#ef4444"):"transparent",cursor:"pointer",borderRadius:8,fontWeight:700,color:"#fff",fontSize:13}}>
              {t==="income"?"↑ Income":"↓ Expense"}
            </button>
          ))}
        </div>
        <input style={D.inp} type="number" placeholder="Amount (IDR)" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/>
        <select style={D.inp} value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
          {curCats.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
        </select>
        <input style={D.inp} placeholder="Note (optional)" value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/>
        <input style={D.inp} type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>
        <button style={{...D.btn,width:"100%",padding:13,fontSize:14,marginTop:2,opacity:busy?0.6:1}} onClick={save} disabled={busy}>{busy?"Saving…":"Save Transaction"}</button>
      </div>
    </div>
  );
}

// ─── Transactions ─────────────────────────────────────────────────────────────
function Transactions({wallet,session,apiHelpers,showToast}){
  const msd=wallet.settings?.monthStartDay||1;
  const cats=wallet.expenseCategories||DEFAULT_EXPENSE_CATEGORIES;
  const incomeCats=wallet.incomeCategories||DEFAULT_INCOME_CATEGORIES;
  const allCats=[...cats,...incomeCats];
  const [tab,setTab]=useState("all");
  const [filter,setFilter]=useState(getCurrentPeriodKey(msd));
  const [confirmId,setConfirmId]=useState(null);
  const periods=[...new Set(wallet.transactions.map(t=>getPeriodKey(t.date,msd)))].sort().reverse();
  if(!periods.includes(getCurrentPeriodKey(msd)))periods.unshift(getCurrentPeriodKey(msd));
  const txns=wallet.transactions.filter(t=>getPeriodKey(t.date,msd)===filter).filter(t=>tab==="all"||t.type===tab).sort((a,b)=>b.date.localeCompare(a.date));
  async function del(id){
    try{ await apiHelpers.deleteTransaction(id); setConfirmId(null); }
    catch(e){ showToast(e.message,"error"); }
  }
  return(
    <div style={{background:"#0a0f1e",minHeight:"100%",padding:"16px 16px 120px"}}>
      <div style={{fontSize:20,fontWeight:900,color:"#fff",marginBottom:4}}>Transactions</div>
      <div style={{color:"#475569",fontSize:12,marginBottom:14}}>{wallet.name}</div>
      <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto",paddingBottom:2}}>
        {["all","expense","income"].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:"6px 14px",border:"none",background:tab===t?"#22d3ee":"#131c2e",color:tab===t?"#0a0f1e":"#94a3b8",borderRadius:99,cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
        <select style={{background:"#131c2e",border:"1px solid #1e293b",color:"#94a3b8",borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer",marginLeft:"auto",flexShrink:0}} value={filter} onChange={e=>setFilter(e.target.value)}>
          {periods.map(p=><option key={p} value={p}>{periodLabel(p,msd)}</option>)}
        </select>
      </div>
      {txns.length===0?<div style={{color:"#475569",textAlign:"center",padding:40,fontSize:13}}>No transactions found</div>:
        txns.map((t,i)=>{
          const cat=allCats.find(c=>c.id===t.category);
          return(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:"#131c2e",borderRadius:12,marginBottom:6,border:"1px solid #1e293b"}}>
              <div style={{width:40,height:40,borderRadius:11,background:(cat?.color||"#6b7280")+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:19,flexShrink:0}}>{cat?.icon||"💱"}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{color:"#fff",fontWeight:600,fontSize:13,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{cat?.label||"Transaction"}</div>
                <div style={{color:"#475569",fontSize:11,marginTop:1}}>{t.date} · {t.note||"—"}</div>
              </div>
              <div style={{color:t.type==="income"?"#10b981":"#f87171",fontWeight:700,fontSize:13,flexShrink:0,marginRight:6}}>
                {t.type==="income"?"+":"-"}{fmtShort(t.amount)}
              </div>
              <button onClick={()=>setConfirmId(t.id)} style={{background:"#ef444420",border:"none",color:"#f87171",borderRadius:7,padding:"3px 7px",cursor:"pointer",fontWeight:700,fontSize:11,flexShrink:0}}>✕</button>
            </div>
          );
        })
      }
      {confirmId&&<ConfirmDialog title="Delete Transaction" message="This transaction will be permanently removed." onConfirm={()=>del(confirmId)} onCancel={()=>setConfirmId(null)}/>}
    </div>
  );
}

// ─── Budget Page ──────────────────────────────────────────────────────────────
function BudgetPage({wallet,apiHelpers,showToast}){
  const msd=wallet.settings?.monthStartDay||1;
  const pk=getCurrentPeriodKey(msd);
  const cats=wallet.expenseCategories||DEFAULT_EXPENSE_CATEGORIES;
  const txns=wallet.transactions.filter(t=>getPeriodKey(t.date,msd)===pk&&t.type==="expense");
  const [detail,setDetail]=useState(null);
  const [adding,setAdding]=useState(false);
  const [nb,setNb]=useState({catId:cats[0]?.id||"",amount:""});
  const [editId,setEditId]=useState(null);
  const [editAmt,setEditAmt]=useState("");
  const [confirmBudget,setConfirmBudget]=useState(null);

  const today=new Date();
  const{start:pStart,end:pEnd}=getPeriodDates(pk,msd);
  const totalDays=Math.round((pEnd-pStart)/864e5)+1;
  const daysPassed=Math.max(1,Math.min(totalDays,Math.round((today-pStart)/864e5)+1));
  const daysLeft=Math.max(0,totalDays-daysPassed);
  const startStr=pStart.toLocaleDateString("id-ID",{day:"2-digit",month:"2-digit"});
  const endStr=pEnd.toLocaleDateString("id-ID",{day:"2-digit",month:"2-digit"});

  async function saveBudget(catId,amt){
    try{ await apiHelpers.upsertBudget(catId,+amt); setEditId(null); }
    catch(e){ showToast(e.message,"error"); }
  }
  async function delBudget(catId){
    // find budget id from wallet.budgets — we store as map so look up by catId
    const budgetId = wallet._budgetRows?.find(b=>b.category_id===catId)?.id;
    try{ await apiHelpers.deleteBudget(budgetId||catId); }
    catch(e){ showToast(e.message,"error"); }
  }
  async function addBudget(){
    if(!nb.catId||!nb.amount||+nb.amount<=0) return showToast("Pick category & amount","error");
    try{
      await apiHelpers.upsertBudget(nb.catId,+nb.amount);
      setNb({catId:cats[0]?.id||"",amount:""});setAdding(false);
    }catch(e){ showToast(e.message,"error"); }
  }

  const detailCat=detail?cats.find(c=>c.id===detail):null;
  if(detailCat) return <BudgetDetail cat={detailCat} wallet={wallet} txns={txns} pStart={pStart} pEnd={pEnd} totalDays={totalDays} daysPassed={daysPassed} daysLeft={daysLeft} startStr={startStr} endStr={endStr} onBack={()=>setDetail(null)} apiHelpers={apiHelpers} showToast={showToast}/>;

  const budgeted=cats.filter(c=>(wallet.budgets||{})[c.id]>0);
  const unbudgeted=cats.filter(c=>!((wallet.budgets||{})[c.id]>0));
  const totSpent=txns.reduce((s,t)=>s+t.amount,0);
  const totBudget=Object.values(wallet.budgets||{}).reduce((s,v)=>s+(v||0),0);
  const totPct=totBudget>0?Math.min((totSpent/totBudget)*100,100):0;
  const totOver=totBudget>0&&totSpent>totBudget;
  const actDaily=daysPassed>0?totSpent/daysPassed:0;
  const recDaily=daysLeft>0?(totBudget-totSpent)/daysLeft:0;
  const projected=actDaily*totalDays;

  return(
    <div style={{background:"#0a0f1e",minHeight:"100%",padding:"16px 16px 120px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
        <div>
          <div style={{fontSize:20,fontWeight:900,color:"#fff"}}>Budgets</div>
          <div style={{color:"#475569",fontSize:12,marginTop:2}}>{startStr} – {endStr} · {daysLeft} days left</div>
        </div>
        <button style={{...D.btn,padding:"7px 12px",fontSize:12}} onClick={()=>setAdding(!adding)}>{adding?"✕":"+ Add"}</button>
      </div>

      {adding&&(
        <div style={{background:"#131c2e",borderRadius:14,padding:14,marginBottom:12,border:"1px solid #1e293b"}}>
          <div style={{color:"#fff",fontWeight:700,fontSize:13,marginBottom:10}}>Set Budget</div>
          <select style={D.inp} value={nb.catId} onChange={e=>setNb({...nb,catId:e.target.value})}>
            {cats.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
          <input style={D.inp} type="number" placeholder="Amount (IDR)" value={nb.amount} onChange={e=>setNb({...nb,amount:e.target.value})} onKeyDown={e=>e.key==="Enter"&&addBudget()}/>
          <button style={{...D.btn,width:"100%",padding:11}} onClick={addBudget}>Save Budget</button>
        </div>
      )}

      {totBudget>0&&(
        <div style={{background:"#131c2e",borderRadius:14,padding:14,marginBottom:12,border:"1px solid #1e293b"}}>
          <div style={{color:"#94a3b8",fontSize:11,marginBottom:2}}>🌐 All Categories</div>
          <div style={{fontSize:22,fontWeight:900,color:"#fff",fontFamily:"monospace",marginBottom:8}}>{fmt(totBudget)}</div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:6}}>
            <span style={{color:"#94a3b8"}}>Spent <span style={{color:"#fff",fontWeight:600}}>{fmt(totSpent)}</span></span>
            <span style={{color:totOver?"#f87171":"#10b981",fontWeight:600}}>{totOver?`Over ${fmt(totSpent-totBudget)}`:`${fmt(totBudget-totSpent)} left`}</span>
          </div>
          <div style={{position:"relative",marginBottom:10}}>
            <div style={{background:"#1e293b",borderRadius:99,height:7}}>
              <div style={{width:`${totPct}%`,height:"100%",borderRadius:99,background:totOver?"#ef4444":totPct>75?"#f59e0b":"#22d3ee"}}/>
            </div>
            <div style={{position:"absolute",top:-1,left:`${Math.min((daysPassed/totalDays)*100,97)}%`,transform:"translateX(-50%)"}}>
              <div style={{width:2,height:9,background:"#fff",borderRadius:2}}/>
              <div style={{fontSize:8,color:"#94a3b8",whiteSpace:"nowrap",marginTop:1}}>Today</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[["💡 Rec. daily",fmt(Math.max(0,recDaily))],["📊 Projected",fmt(projected)],["⚡ Actual/day",fmt(actDaily)],[`📅 ${daysLeft} days left`,"of "+totalDays]].map(([l,v])=>(
              <div key={l} style={{background:"#0a0f1e",borderRadius:9,padding:"7px 9px"}}>
                <div style={{color:"#475569",fontSize:9,marginBottom:1}}>{l}</div>
                <div style={{color:"#fff",fontWeight:700,fontSize:11}}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {budgeted.length>0&&(
        <>
          <div style={{color:"#334155",fontSize:10,textTransform:"uppercase",letterSpacing:1,marginBottom:7}}>Active Budgets</div>
          {budgeted.map(c=>{
            const spent=txns.filter(t=>t.category===c.id).reduce((s,t)=>s+t.amount,0);
            const budget=(wallet.budgets||{})[c.id]||0;
            const pct=budget>0?Math.min((spent/budget)*100,100):0;
            const over=budget>0&&spent>budget;
            const isEdit=editId===c.id;
            return(
              <div key={c.id} style={{background:"#131c2e",borderRadius:13,padding:13,marginBottom:8,border:`1px solid ${c.color}33`,cursor:"pointer"}} onClick={()=>!isEdit&&setDetail(c.id)}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:9}}>
                    <div style={{width:36,height:36,borderRadius:9,background:c.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{c.icon}</div>
                    <div>
                      <div style={{color:"#fff",fontWeight:600,fontSize:13}}>{c.label}</div>
                      {over&&<div style={{color:"#f87171",fontSize:10,fontWeight:700}}>⚠ Over budget</div>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:5}} onClick={e=>e.stopPropagation()}>
                    <button onClick={()=>{setEditId(c.id);setEditAmt(String(budget));}} style={{background:"#1e293b",border:"none",borderRadius:7,padding:"3px 9px",cursor:"pointer",fontSize:11,color:"#94a3b8"}}>✏️</button>
                    <button onClick={()=>setConfirmBudget(c.id)} style={{background:"#ef444420",border:"none",borderRadius:7,padding:"3px 9px",cursor:"pointer",fontSize:11,color:"#f87171"}}>🗑️</button>
                  </div>
                </div>
                {isEdit?(
                  <div style={{display:"flex",gap:7}} onClick={e=>e.stopPropagation()}>
                    <input autoFocus style={{...D.inp,margin:0,flex:1}} type="number" value={editAmt} onChange={e=>setEditAmt(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")saveBudget(c.id,editAmt);if(e.key==="Escape")setEditId(null);}}/>
                    <button style={{...D.btn,padding:"8px 12px",fontSize:12}} onClick={()=>saveBudget(c.id,editAmt)}>Save</button>
                    <button style={{background:"#1e293b",border:"none",borderRadius:9,padding:"8px 10px",cursor:"pointer",color:"#94a3b8",fontSize:12}} onClick={()=>setEditId(null)}>✕</button>
                  </div>
                ):(
                  <>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#94a3b8",marginBottom:5}}>
                      <span>Spent <span style={{color:"#fff",fontWeight:600}}>{fmt(spent)}</span></span>
                      <span>of <span style={{color:"#fff",fontWeight:600}}>{fmt(budget)}</span></span>
                    </div>
                    <div style={{background:"#1e293b",borderRadius:99,height:5}}>
                      <div style={{width:`${pct}%`,height:"100%",borderRadius:99,background:over?"#ef4444":pct>75?"#f59e0b":c.color}}/>
                    </div>
                    <div style={{fontSize:10,color:"#1e293b",marginTop:5}}>Tap for details →</div>
                  </>
                )}
              </div>
            );
          })}
        </>
      )}

      {unbudgeted.length>0&&(
        <>
          <div style={{color:"#334155",fontSize:10,textTransform:"uppercase",letterSpacing:1,marginBottom:7,marginTop:10}}>No Budget Set</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
            {unbudgeted.map(c=>{
              const spent=txns.filter(t=>t.category===c.id).reduce((s,t)=>s+t.amount,0);
              return(
                <div key={c.id} style={{background:"#131c2e",borderRadius:11,padding:"11px",border:"1px solid #1e293b"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={{fontSize:19}}>{c.icon}</div>
                    <button onClick={()=>{setNb({catId:c.id,amount:""});setAdding(true);}} style={{background:"#10b98120",border:"none",borderRadius:7,padding:"2px 7px",cursor:"pointer",fontSize:10,fontWeight:600,color:"#10b981"}}>+ Set</button>
                  </div>
                  <div style={{color:"#fff",fontWeight:600,fontSize:12,marginTop:5}}>{c.label}</div>
                  {spent>0&&<div style={{color:"#475569",fontSize:10,marginTop:1}}>{fmtShort(spent)}</div>}
                </div>
              );
            })}
          </div>
        </>
      )}
      {confirmBudget&&<ConfirmDialog title="Remove Budget" message="The budget limit for this category will be cleared." confirmLabel="Remove" onConfirm={()=>{delBudget(confirmBudget);setConfirmBudget(null);}} onCancel={()=>setConfirmBudget(null)}/>}
    </div>
  );
}

// ─── Budget Detail ────────────────────────────────────────────────────────────
function BudgetDetail({cat,wallet,txns,pStart,pEnd,totalDays,daysPassed,daysLeft,startStr,endStr,onBack,apiHelpers,showToast}){
  const ref=useRef(null);
  const catTxns=txns.filter(t=>t.category===cat.id).sort((a,b)=>a.date.localeCompare(b.date));
  const budget=(wallet.budgets||{})[cat.id]||0;
  const spent=catTxns.reduce((s,t)=>s+t.amount,0);
  const over=budget>0&&spent>budget;
  const pct=budget>0?Math.min((spent/budget)*100,100):0;
  const recDaily=daysLeft>0?(budget-spent)/daysLeft:0;
  const actDaily=daysPassed>0?spent/daysPassed:0;
  const projected=actDaily*totalDays;
  const [edit,setEdit]=useState(false);
  const [editAmt,setEditAmt]=useState(String(budget));
  const [confirmDel,setConfirmDel]=useState(false);

  async function save(){
    try{ await apiHelpers.upsertBudget(cat.id,+editAmt); setEdit(false); }
    catch(e){ showToast(e.message,"error"); }
  }
  async function del(){
    const budgetId = wallet._budgetRows?.find(b=>b.category_id===cat.id)?.id;
    try{ await apiHelpers.deleteBudget(budgetId||cat.id); showToast("Removed"); onBack(); }
    catch(e){ showToast(e.message,"error"); }
  }

  useEffect(()=>{
    const c=ref.current;if(!c)return;
    const ctx=c.getContext("2d");
    const W=c.offsetWidth||280,H=150;
    c.width=W;c.height=H;ctx.clearRect(0,0,W,H);
    const days=Array.from({length:totalDays},(_,i)=>{const d=new Date(pStart);d.setDate(d.getDate()+i);return d.toISOString().slice(0,10);});
    let cum=0;
    const data=days.map(date=>{cum+=catTxns.filter(t=>t.date===date).reduce((s,t)=>s+t.amount,0);return cum;});
    const maxVal=Math.max(budget>0?budget*1.1:0,Math.max(...data)*1.05,1);
    const pad={t:16,r:8,b:24,l:44};
    const gW=W-pad.l-pad.r,gH=H-pad.t-pad.b;
    [0,0.5,1].forEach(f=>{
      const y=pad.t+gH*(1-f);
      ctx.strokeStyle="#1e293b";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+gW,y);ctx.stroke();
      ctx.fillStyle="#334155";ctx.font="8px sans-serif";ctx.textAlign="right";
      ctx.fillText(fmtShort(maxVal*f),pad.l-3,y+3);
    });
    if(budget>0){
      const by=pad.t+gH*(1-budget/maxVal);
      ctx.strokeStyle="#f8717155";ctx.lineWidth=1.5;ctx.setLineDash([4,3]);
      ctx.beginPath();ctx.moveTo(pad.l,by);ctx.lineTo(pad.l+gW,by);ctx.stroke();ctx.setLineDash([]);
    }
    if(data.length<2)return;
    const lIdx=Math.min(daysPassed-1,data.length-1);
    const lVal=data[lIdx]||0;
    if(lIdx<data.length-1){
      const x1=pad.l+(lIdx/(data.length-1))*gW,y1=pad.t+gH*(1-lVal/maxVal);
      const x2=pad.l+gW,y2=pad.t+gH*(1-projected/maxVal);
      ctx.strokeStyle=cat.color+"55";ctx.lineWidth=1.5;ctx.setLineDash([3,3]);
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);
    }
    ctx.beginPath();
    data.slice(0,daysPassed).forEach((v,i)=>{const x=pad.l+(i/(data.length-1))*gW,y=pad.t+gH*(1-v/maxVal);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    const lx=pad.l+((Math.min(daysPassed-1,data.length-1))/(data.length-1))*gW;
    ctx.lineTo(lx,pad.t+gH);ctx.lineTo(pad.l,pad.t+gH);ctx.closePath();
    const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+gH);
    grad.addColorStop(0,cat.color+"88");grad.addColorStop(1,cat.color+"11");
    ctx.fillStyle=grad;ctx.fill();
    ctx.strokeStyle=cat.color;ctx.lineWidth=2;ctx.setLineDash([]);
    ctx.beginPath();
    data.slice(0,daysPassed).forEach((v,i)=>{const x=pad.l+(i/(data.length-1))*gW,y=pad.t+gH*(1-v/maxVal);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
    ctx.stroke();
    ctx.fillStyle="#334155";ctx.font="8px sans-serif";ctx.textAlign="center";
    ctx.fillText(startStr,pad.l,H-2);ctx.fillText(endStr,pad.l+gW,H-2);
  });

  return(
    <div style={{background:"#0a0f1e",minHeight:"100%",padding:"16px 16px 120px"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button onClick={onBack} style={{background:"#131c2e",border:"1px solid #1e293b",borderRadius:9,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:13,color:"#94a3b8"}}>←</button>
        <div style={{flex:1}}>
          <div style={{fontSize:18,fontWeight:900,color:"#fff"}}>{cat.icon} {cat.label}</div>
          <div style={{color:"#475569",fontSize:11}}>{startStr} – {endStr} · {daysLeft} days left</div>
        </div>
        <button onClick={()=>setEdit(!edit)} style={{background:"#1e293b",border:"none",borderRadius:9,padding:"7px 11px",cursor:"pointer",color:"#94a3b8",fontSize:12}}>✏️</button>
        <button onClick={()=>setConfirmDel(true)} style={{background:"#ef444420",border:"none",borderRadius:9,padding:"7px 11px",cursor:"pointer",color:"#f87171",fontSize:12}}>🗑️</button>
      </div>

      <div style={{background:"#131c2e",borderRadius:14,padding:14,marginBottom:10,border:`1px solid ${cat.color}33`}}>
        <div style={{color:"#94a3b8",fontSize:11,marginBottom:3}}>Monthly Budget</div>
        {edit?(
          <div style={{display:"flex",gap:7,marginBottom:10}}>
            <input autoFocus style={{...D.inp,margin:0,flex:1,fontSize:16,fontWeight:800}} type="number" value={editAmt} onChange={e=>setEditAmt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&save()}/>
            <button style={{...D.btn,padding:"9px 14px"}} onClick={save}>Save</button>
          </div>
        ):(
          <div style={{fontSize:24,fontWeight:900,color:"#fff",fontFamily:"monospace",marginBottom:10}}>{budget>0?fmt(budget):<span style={{color:"#475569"}}>No limit</span>}</div>
        )}
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:7}}>
          <span style={{color:"#94a3b8"}}>Spent <span style={{color:"#fff",fontWeight:700}}>{fmt(spent)}</span></span>
          {budget>0&&<span style={{color:over?"#f87171":"#10b981",fontWeight:700}}>{over?`Over ${fmt(spent-budget)}`:`${fmt(budget-spent)} left`}</span>}
        </div>
        {budget>0&&(
          <div style={{position:"relative"}}>
            <div style={{background:"#1e293b",borderRadius:99,height:7}}>
              <div style={{width:`${pct}%`,height:"100%",borderRadius:99,background:over?"#ef4444":pct>75?"#f59e0b":cat.color}}/>
            </div>
            <div style={{position:"absolute",top:-1,left:`${Math.min((daysPassed/totalDays)*100,97)}%`,transform:"translateX(-50%)"}}>
              <div style={{width:2,height:9,background:"#fff",borderRadius:2}}/>
              <div style={{fontSize:8,color:"#94a3b8",marginTop:1,whiteSpace:"nowrap"}}>Today</div>
            </div>
          </div>
        )}
      </div>

      <div style={{background:"#131c2e",borderRadius:14,padding:14,marginBottom:10,border:"1px solid #1e293b"}}>
        <div style={{color:"#fff",fontWeight:700,fontSize:12,marginBottom:10}}>📈 Spending Over Time</div>
        <canvas ref={ref} style={{width:"100%",height:150,display:"block"}}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:10}}>
        {[["💡",fmt(Math.max(0,recDaily)),"Rec. daily","#3b82f6"],["📊",fmt(projected),"Projected",projected>budget&&budget>0?"#f87171":"#8b5cf6"],["⚡",fmt(actDaily),"Daily avg","#10b981"]].map(([ico,val,lbl,col])=>(
          <div key={lbl} style={{background:"#131c2e",borderRadius:11,padding:"9px",border:"1px solid #1e293b"}}>
            <div style={{fontSize:14,marginBottom:3}}>{ico}</div>
            <div style={{color:col,fontWeight:800,fontSize:12}}>{val}</div>
            <div style={{color:"#475569",fontSize:9,marginTop:2}}>{lbl}</div>
          </div>
        ))}
      </div>

      <div style={{background:"#131c2e",borderRadius:14,overflow:"hidden",border:"1px solid #1e293b"}}>
        <div style={{padding:"11px 14px",borderBottom:"1px solid #1e293b",color:"#fff",fontWeight:700,fontSize:12}}>Transactions</div>
        {catTxns.length===0?<div style={{padding:18,color:"#475569",textAlign:"center",fontSize:12}}>No transactions</div>:
          [...catTxns].reverse().map((t,i)=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderBottom:i<catTxns.length-1?"1px solid #1e293b":"none"}}>
              <div style={{width:34,height:34,borderRadius:9,background:cat.color+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{cat.icon}</div>
              <div style={{flex:1}}>
                <div style={{color:"#fff",fontWeight:600,fontSize:12}}>{t.note||cat.label}</div>
                <div style={{color:"#475569",fontSize:10,marginTop:1}}>{t.date}</div>
              </div>
              <div style={{color:"#f87171",fontWeight:700,fontSize:12}}>-{fmtShort(t.amount)}</div>
            </div>
          ))
        }
      </div>
      {confirmDel&&<ConfirmDialog title="Remove Budget" message={`Remove the budget limit for ${cat.label}?`} confirmLabel="Remove" onConfirm={del} onCancel={()=>setConfirmDel(false)}/>}
    </div>
  );
}

// ─── Monthly Recap ────────────────────────────────────────────────────────────
function MonthlyRecap({wallet}){
  const msd=wallet.settings?.monthStartDay||1;
  const cats=wallet.expenseCategories||DEFAULT_EXPENSE_CATEGORIES;
  const periods=[...new Set(wallet.transactions.map(t=>getPeriodKey(t.date,msd)))].sort().reverse();
  const [sel,setSel]=useState(periods[0]||getCurrentPeriodKey(msd));
  const txns=wallet.transactions.filter(t=>getPeriodKey(t.date,msd)===sel);
  const income=txns.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
  const expense=txns.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const balance=income-expense;
  const catBreak=cats.map(c=>({...c,total:txns.filter(t=>t.type==="expense"&&t.category===c.id).reduce((s,t)=>s+t.amount,0),budget:(wallet.budgets||{})[c.id]||0})).filter(c=>c.total>0).sort((a,b)=>b.total-a.total);
  const catBreakFull=catBreak.map(c=>({...c,over:c.budget>0&&c.total>c.budget}));
  const topCat=catBreakFull[0];
  const overCats=catBreakFull.filter(c=>c.over);
  const savRate=income>0?((income-expense)/income*100).toFixed(1):0;

  return(
    <div style={{background:"#0a0f1e",minHeight:"100%",padding:"16px 16px 120px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div style={{fontSize:20,fontWeight:900,color:"#fff"}}>Monthly Recap</div>
        <select style={{background:"#131c2e",border:"1px solid #1e293b",color:"#94a3b8",borderRadius:9,padding:"6px 10px",fontSize:11,cursor:"pointer"}} value={sel} onChange={e=>setSel(e.target.value)}>
          {periods.map(p=><option key={p} value={p}>{periodLabel(p,msd)}</option>)}
        </select>
      </div>
      {txns.length===0?<div style={{color:"#475569",textAlign:"center",padding:40,fontSize:13}}>No data for this period</div>:(
        <>
          <div style={{background:"linear-gradient(135deg,#131c2e,#1a2540)",borderRadius:14,padding:14,marginBottom:12,border:"1px solid #1e293b"}}>
            <div style={{color:"#94a3b8",fontSize:11,marginBottom:10}}>{periodLabel(sel,msd)}</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[["↑ Income",fmt(income),"#10b981"],["↓ Expenses",fmt(expense),"#f87171"],["💰 Balance",fmt(balance),balance>=0?"#22d3ee":"#f59e0b"],["📈 Saved",savRate+"%","#8b5cf6"]].map(([l,v,c])=>(
                <div key={l} style={{background:"#ffffff07",borderRadius:10,padding:"9px 10px"}}>
                  <div style={{color:"#475569",fontSize:10,marginBottom:3}}>{l}</div>
                  <div style={{color:c,fontWeight:800,fontSize:15}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:12}}>
            {[
              topCat?[topCat.icon,"Top Category",topCat.label,topCat.color]:["📊","Top Category","None","#475569"],
              [overCats.length>0?"⚠️":"✅","Budget",overCats.length>0?`${overCats.length} over`:"On track",overCats.length>0?"#f87171":"#10b981"],
              ["📋","Transactions",String(txns.length),"#8b5cf6"],
            ].map(([ico,lbl,val,col])=>(
              <div key={lbl} style={{background:"#131c2e",borderRadius:12,padding:"11px 10px",border:"1px solid #1e293b"}}>
                <div style={{fontSize:20,marginBottom:5}}>{ico}</div>
                <div style={{color:"#475569",fontSize:9,marginBottom:2}}>{lbl}</div>
                <div style={{color:col,fontWeight:800,fontSize:12}}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{background:"#131c2e",borderRadius:14,padding:14,border:"1px solid #1e293b"}}>
            <div style={{color:"#fff",fontWeight:700,fontSize:12,marginBottom:12}}>Spending by Category</div>
            {catBreakFull.length===0?<div style={{color:"#475569",textAlign:"center",padding:16,fontSize:12}}>No expenses</div>:
              catBreakFull.map((c,i)=>{
                const maxS=catBreakFull[0]?.total||1;
                return(
                  <div key={c.id} style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                      <div style={{display:"flex",alignItems:"center",gap:7}}>
                        <span style={{fontSize:16}}>{c.icon}</span>
                        <span style={{color:"#fff",fontSize:12,fontWeight:600}}>{c.label}</span>
                        {c.over&&<span style={{background:"#f8717120",color:"#f87171",fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:99}}>OVER</span>}
                        {i===0&&<span style={{background:"#f59e0b20",color:"#f59e0b",fontSize:9,fontWeight:700,padding:"1px 5px",borderRadius:99}}>TOP</span>}
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{color:"#fff",fontWeight:700,fontSize:12}}>{fmtShort(c.total)}</div>
                        {c.budget>0&&<div style={{color:"#475569",fontSize:10}}>/ {fmtShort(c.budget)}</div>}
                      </div>
                    </div>
                    <div style={{background:"#1e293b",borderRadius:99,height:4}}>
                      <div style={{width:`${(c.total/maxS)*100}%`,height:"100%",borderRadius:99,background:c.over?"#ef4444":c.color}}/>
                    </div>
                  </div>
                );
              })
            }
          </div>
        </>
      )}
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function SettingsPage({wallet,session,wallets,apiHelpers,showToast,onSignOut}){
  const cats=wallet.expenseCategories||DEFAULT_EXPENSE_CATEGORIES;
  const incomeCats=wallet.incomeCategories||DEFAULT_INCOME_CATEGORIES;
  const settings=wallet.settings||{monthStartDay:1,dayStartHour:0};
  const [tab,setTab]=useState("account");
  const [ls,setLs]=useState({...settings});
  const [nec,setNec]=useState({label:"",icon:"🛒",color:"#6366f1"});
  const [nic,setNic]=useState({label:"",icon:"💰"});
  const [eoOpen,setEoOpen]=useState(false);
  const [coOpen,setCoOpen]=useState(false);
  const [invU,setInvU]=useState("");
  const [nwn,setNwn]=useState("");
  const [confirmCat,setConfirmCat]=useState(null);
  const [confirmMember,setConfirmMember]=useState(null);
  const userWallets=wallets||[];
  const members=(wallet._memberObjects||wallet.members||[]).map(m=>{
    if(typeof m==="object") return {uid:m.id||m.uid,name:m.displayName||m.display_name||m.username||"",username:m.username||""};
    return {uid:m,name:m,username:m};
  });
  const user={name:session?.username||"",wallets:userWallets.map(w=>w.id)};

  async function saveSettings(){try{await apiHelpers.updateSettings(ls);}catch(e){showToast(e.message,"error");}}
  async function addEC(){
    if(!nec.label.trim())return showToast("Enter a name","error");
    try{await apiHelpers.addCategory("expense",nec.label.trim(),nec.icon,nec.color);setNec({label:"",icon:"🛒",color:"#6366f1"});}
    catch(e){showToast(e.message,"error");}
  }
  async function addIC(){
    if(!nic.label.trim())return showToast("Enter a name","error");
    try{await apiHelpers.addCategory("income",nic.label.trim(),nic.icon,"#10b981");setNic({label:"",icon:"💰"});}
    catch(e){showToast(e.message,"error");}
  }
  async function delCat(id){try{await apiHelpers.deleteCategory(id);}catch(e){showToast(e.message,"error");}}
  async function invite(){
    const uname=invU.toLowerCase().trim();
    if(!uname)return showToast("Enter a username","error");
    try{await apiHelpers.inviteMember(uname);setInvU("");}
    catch(e){showToast(e.message,"error");}
  }
  async function createWallet(){
    if(!nwn.trim())return showToast("Enter name","error");
    try{await apiHelpers.createWallet(nwn.trim());setNwn("");}
    catch(e){showToast(e.message,"error");}
  }

  const TABS=[{id:"account",l:"Account"},{id:"wallet",l:"Wallet"},{id:"cats",l:"Categories"},{id:"cycle",l:"Cycle"}];

  return(
    <div style={{background:"#0a0f1e",minHeight:"100%",padding:"16px 16px 120px"}}>
      <div style={{fontSize:20,fontWeight:900,color:"#fff",marginBottom:14}}>Account</div>
      <div style={{background:"#131c2e",borderRadius:14,padding:14,marginBottom:14,border:"1px solid #1e293b",display:"flex",alignItems:"center",gap:12}}>
        <div style={{width:48,height:48,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:900,fontSize:20,flexShrink:0}}>{(session?.username||"?")[0].toUpperCase()}</div>
        <div style={{flex:1}}>
          <div style={{color:"#fff",fontWeight:700,fontSize:15}}>{session?.username||""}</div>
          <div style={{color:"#475569",fontSize:12}}>@{session?.username||""}</div>
        </div>
        <button style={{background:"#ef444420",border:"none",borderRadius:9,padding:"7px 12px",cursor:"pointer",color:"#f87171",fontWeight:700,fontSize:12}} onClick={onSignOut}>Sign out</button>
      </div>

      <div style={{display:"flex",gap:5,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"6px 14px",border:"none",background:tab===t.id?"#22d3ee":"#131c2e",color:tab===t.id?"#0a0f1e":"#94a3b8",borderRadius:99,cursor:"pointer",fontSize:12,fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>
            {t.l}
          </button>
        ))}
      </div>

      {tab==="account"&&(
        <>
          <div style={{background:"#131c2e",borderRadius:14,padding:14,marginBottom:10,border:"1px solid #1e293b"}}>
            <div style={{color:"#fff",fontWeight:700,fontSize:13,marginBottom:10}}>My Wallets</div>
            {userWallets.map((w,i)=>(
              <div key={w.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:i<userWallets.length-1?"1px solid #1e293b":"none"}}>
                <div style={{width:34,height:34,borderRadius:9,background:["#f59e0b22","#10b98122","#3b82f622","#8b5cf622"][i%4],display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>💳</div>
                <div style={{flex:1}}>
                  <div style={{color:"#fff",fontWeight:600,fontSize:12}}>{w.name}</div>
                  <div style={{color:"#475569",fontSize:10}}>{(w.members||[]).length} member{(w.members||[]).length!==1?"s":""} · {w.owner_id===session?.username?"Owner":"Member"}</div>
                </div>
                {w.id===wallet.id&&<div style={{width:7,height:7,borderRadius:"50%",background:"#22d3ee"}}/>}
              </div>
            ))}
          </div>
          <div style={{background:"#131c2e",borderRadius:14,padding:14,border:"1px solid #1e293b"}}>
            <div style={{color:"#fff",fontWeight:700,fontSize:13,marginBottom:10}}>Create New Wallet</div>
            <input style={D.inp} placeholder="Wallet name" value={nwn} onChange={e=>setNwn(e.target.value)}/>
            <button style={{...D.btn,width:"100%",padding:11}} onClick={createWallet}>Create Wallet</button>
          </div>
        </>
      )}

      {tab==="wallet"&&(
        <>
          <div style={{background:"#131c2e",borderRadius:14,padding:14,marginBottom:10,border:"1px solid #1e293b"}}>
            <div style={{color:"#fff",fontWeight:700,fontSize:13,marginBottom:3}}>{wallet.name}</div>
            <div style={{color:"#475569",fontSize:11,marginBottom:10}}>Owner: @{wallet.owner} · {members.length} members</div>
            {members.map((m,i)=>(
              <div key={m.uid} style={{display:"flex",alignItems:"center",gap:9,padding:"9px 0",borderBottom:i<members.length-1?"1px solid #1e293b":"none"}}>
                <div style={{width:34,height:34,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:700,fontSize:14,flexShrink:0}}>{(m.name||m.uid||"?")[0].toUpperCase()}</div>
                <div style={{flex:1}}>
                  <div style={{color:"#fff",fontWeight:600,fontSize:12}}>{m.name||m.uid}</div>
                  <div style={{color:"#475569",fontSize:10}}>@{m.username||m.uid}{m.uid===wallet.owner?" · Owner":""}</div>
                </div>
                {m.uid!==wallet.owner&&(
                  <button style={{background:"#ef444420",border:"none",borderRadius:7,padding:"3px 8px",cursor:"pointer",fontSize:11,color:"#f87171",fontWeight:700}} onClick={()=>setConfirmMember(m.uid)}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div style={{background:"#131c2e",borderRadius:14,padding:14,border:"1px solid #1e293b"}}>
            <div style={{color:"#fff",fontWeight:700,fontSize:13,marginBottom:8}}>Invite Member</div>
            <div style={{display:"flex",gap:7}}>
              <input style={{...D.inp,margin:0,flex:1}} placeholder="Username" value={invU} onChange={e=>setInvU(e.target.value)} onKeyDown={e=>e.key==="Enter"&&invite()}/>
              <button style={{...D.btn,padding:"9px 14px"}} onClick={invite}>Invite</button>
            </div>
            <div style={{color:"#334155",fontSize:11,marginTop:7}}>💡 Invite another registered user by their username</div>
          </div>
        </>
      )}

      {tab==="cats"&&(
        <>
          <div style={{background:"#131c2e",borderRadius:14,padding:14,marginBottom:10,border:"1px solid #1e293b"}}>
            <div style={{color:"#fff",fontWeight:700,fontSize:13,marginBottom:12}}>🏷️ Expense Categories</div>
            <div style={{background:"#0a0f1e",borderRadius:11,padding:11,marginBottom:12}}>
              <div style={{display:"flex",gap:7,alignItems:"flex-start",flexWrap:"wrap"}}>
                <div style={{position:"relative"}}>
                  <button onClick={()=>{setEoOpen(!eoOpen);setCoOpen(false);}} style={{fontSize:20,background:"#131c2e",border:"1px solid #1e293b",borderRadius:9,padding:"7px 9px",cursor:"pointer"}}>{nec.icon}</button>
                  {eoOpen&&(
                    <div style={{position:"absolute",top:44,left:0,background:"#131c2e",border:"1px solid #1e293b",borderRadius:11,padding:7,zIndex:200,display:"flex",flexWrap:"wrap",gap:2,width:190,boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}}>
                      {EMOJI_PALETTE.map(e=><button key={e} onClick={()=>{setNec({...nec,icon:e});setEoOpen(false);}} style={{fontSize:17,background:"none",border:"none",cursor:"pointer",padding:3,borderRadius:5}}>{e}</button>)}
                    </div>
                  )}
                </div>
                <div style={{position:"relative"}}>
                  <button onClick={()=>{setCoOpen(!coOpen);setEoOpen(false);}} style={{width:38,height:38,borderRadius:9,background:nec.color,border:"2px solid #1e293b",cursor:"pointer",display:"block"}}/>
                  {coOpen&&(
                    <div style={{position:"absolute",top:44,left:0,background:"#131c2e",border:"1px solid #1e293b",borderRadius:11,padding:7,zIndex:200,display:"flex",flexWrap:"wrap",gap:3,width:170,boxShadow:"0 8px 24px rgba(0,0,0,0.5)"}}>
                      {COLOR_PALETTE.map(col=><button key={col} onClick={()=>{setNec({...nec,color:col});setCoOpen(false);}} style={{width:26,height:26,borderRadius:6,background:col,border:col===nec.color?"3px solid #fff":"2px solid transparent",cursor:"pointer"}}/>)}
                    </div>
                  )}
                </div>
                <input style={{...D.inp,margin:0,flex:1,minWidth:90}} placeholder="Name..." value={nec.label} onChange={e=>setNec({...nec,label:e.target.value})} onKeyDown={e=>e.key==="Enter"&&addEC()}/>
                <button style={{...D.btn,padding:"9px 12px"}} onClick={addEC}>Add</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {cats.map(c=>(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 9px",background:"#0a0f1e",borderRadius:9,border:`1px solid ${c.color}33`}}>
                  <span style={{fontSize:16}}>{c.icon}</span>
                  <span style={{flex:1,color:"#fff",fontWeight:600,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.label}</span>
                  <button onClick={()=>setConfirmCat({id:c.id,type:"e",label:c.label})} style={{background:"none",border:"none",color:"#334155",cursor:"pointer",fontSize:13,padding:1,flexShrink:0}}>✕</button>
                </div>
              ))}
            </div>
          </div>
          <div style={{background:"#131c2e",borderRadius:14,padding:14,border:"1px solid #1e293b"}}>
            <div style={{color:"#fff",fontWeight:700,fontSize:13,marginBottom:12}}>💰 Income Categories</div>
            <div style={{background:"#0a0f1e",borderRadius:11,padding:11,marginBottom:12}}>
              <div style={{display:"flex",gap:7,alignItems:"center"}}>
                <select style={{background:"#131c2e",border:"1px solid #1e293b",borderRadius:9,padding:"7px",fontSize:18,color:"#fff",cursor:"pointer"}} value={nic.icon} onChange={e=>setNic({...nic,icon:e.target.value})}>
                  {EMOJI_PALETTE.slice(0,20).map(e=><option key={e} value={e}>{e}</option>)}
                </select>
                <input style={{...D.inp,margin:0,flex:1}} placeholder="Name..." value={nic.label} onChange={e=>setNic({...nic,label:e.target.value})} onKeyDown={e=>e.key==="Enter"&&addIC()}/>
                <button style={{...D.btn,padding:"9px 12px"}} onClick={addIC}>Add</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {incomeCats.map(c=>(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:7,padding:"8px 9px",background:"#0a0f1e",borderRadius:9,border:"1px solid #10b98133"}}>
                  <span style={{fontSize:16}}>{c.icon}</span>
                  <span style={{flex:1,color:"#fff",fontWeight:600,fontSize:11,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.label}</span>
                  <button onClick={()=>setConfirmCat({id:c.id,type:"i",label:c.label})} style={{background:"none",border:"none",color:"#334155",cursor:"pointer",fontSize:13,padding:1,flexShrink:0}}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {tab==="cycle"&&(
        <div style={{background:"#131c2e",borderRadius:14,padding:14,border:"1px solid #1e293b"}}>
          <div style={{color:"#fff",fontWeight:700,fontSize:13,marginBottom:4}}>📅 Budget Cycle</div>
          <div style={{color:"#475569",fontSize:12,marginBottom:14}}>Set when your monthly budget cycle resets.</div>
          <div style={{marginBottom:14}}>
            <label style={{color:"#94a3b8",fontSize:11,display:"block",marginBottom:5}}>Cycle starts on day</label>
            <select style={D.inp} value={ls.monthStartDay} onChange={e=>setLs({...ls,monthStartDay:+e.target.value})}>
              {Array.from({length:28},(_,i)=>i+1).map(d=><option key={d} value={d}>{d}{d===1?" (standard)":d===25?" (salary day)":""}</option>)}
            </select>
            <div style={{background:"#0a0f1e",borderRadius:9,padding:"8px 10px",marginTop:6,fontSize:11,color:"#22d3ee"}}>
              {ls.monthStartDay===1?"📅 Jan 1 → Jan 31, Feb 1 → Feb 28…":`🔄 ${ls.monthStartDay}th each month → ${ls.monthStartDay-1}th next month`}
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{color:"#94a3b8",fontSize:11,display:"block",marginBottom:5}}>Day starts at hour</label>
            <select style={D.inp} value={ls.dayStartHour} onChange={e=>setLs({...ls,dayStartHour:+e.target.value})}>
              {Array.from({length:24},(_,i)=>i).map(h=><option key={h} value={h}>{String(h).padStart(2,"0")}:00{h===0?" (midnight)":h===4?" (4 AM)":""}</option>)}
            </select>
          </div>
          <button style={{...D.btn,width:"100%",padding:12}} onClick={saveSettings}>Save Settings</button>
        </div>
      )}

      {confirmCat&&<ConfirmDialog title="Delete Category" message={`Delete "${confirmCat.label}"? Existing transactions won't be deleted but will lose their category.`} onConfirm={()=>{delCat(confirmCat.id);setConfirmCat(null);}} onCancel={()=>setConfirmCat(null)}/>}
      {confirmMember&&<ConfirmDialog title="Remove Member" message={`Remove @${confirmMember} from this wallet?`} confirmLabel="Remove" onConfirm={async()=>{try{await apiHelpers.removeMember(confirmMember);setConfirmMember(null);}catch(e){showToast(e.message,"error");}}} onCancel={()=>setConfirmMember(null)}/>}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({msg,type}){
  return(
    <div style={{position:"fixed",top:14,left:"50%",transform:"translateX(-50%)",padding:"10px 16px",borderRadius:11,fontWeight:600,fontSize:12,boxShadow:"0 8px 24px rgba(0,0,0,0.4)",zIndex:9999,background:type==="error"?"#7f1d1d":"#14532d",color:type==="error"?"#fca5a5":"#86efac",border:`1px solid ${type==="error"?"#ef4444":"#22c55e"}`,whiteSpace:"nowrap"}}>
      {type==="error"?"❌":"✅"} {msg}
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({title,message,confirmLabel="Delete",onConfirm,onCancel}){
  return(
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={onCancel}>
      <div style={{background:"#131c2e",borderRadius:20,padding:"26px 22px",width:"100%",maxWidth:310,border:"1px solid #1e293b",boxShadow:"0 24px 64px rgba(0,0,0,0.6)"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:48,height:48,borderRadius:"50%",background:"#ef444420",border:"1.5px solid #ef444440",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,margin:"0 auto 14px"}}>🗑️</div>
        <div style={{color:"#fff",fontWeight:800,fontSize:16,textAlign:"center",marginBottom:8}}>{title}</div>
        <div style={{color:"#64748b",fontSize:13,textAlign:"center",marginBottom:24,lineHeight:1.6}}>{message}</div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onCancel} style={{flex:1,padding:"13px 0",border:"1px solid #1e293b",background:"#0a0f1e",color:"#94a3b8",borderRadius:12,cursor:"pointer",fontWeight:700,fontSize:13}}>
            Cancel
          </button>
          <button onClick={()=>{onConfirm();}} style={{flex:1,padding:"13px 0",border:"none",background:"#ef4444",color:"#fff",borderRadius:12,cursor:"pointer",fontWeight:700,fontSize:13}}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const D={
  shell:    {display:"flex",flexDirection:"column",height:"100vh",background:"#0a0f1e",overflow:"hidden",fontFamily:"'Sora','Segoe UI',sans-serif",color:"#fff",maxWidth:500,margin:"0 auto",position:"relative"},
  statusBar:{height:"env(safe-area-inset-top,0px)",background:"#0a0f1e",flexShrink:0},
  content:  {flex:1,overflowY:"auto",overflowX:"hidden"},
  bottomNav:{display:"flex",background:"#0d1526",borderTop:"1px solid #1e293b",paddingBottom:"env(safe-area-inset-bottom,0px)",flexShrink:0,zIndex:100},
  navItem:  {flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"9px 4px",border:"none",background:"transparent",color:"#334155",cursor:"pointer",gap:2},
  navActive:{color:"#22d3ee"},
  fab:      {position:"fixed",bottom:"calc(env(safe-area-inset-bottom,0px) + 68px)",left:"50%",transform:"translateX(-50%)",width:52,height:52,borderRadius:"50%",background:"#22d3ee",border:"3px solid #0a0f1e",color:"#0a0f1e",fontSize:26,fontWeight:900,cursor:"pointer",boxShadow:"0 8px 24px rgba(34,211,238,0.35)",zIndex:150,display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1},
  inp:      {width:"100%",background:"#0a0f1e",border:"1px solid #1e293b",borderRadius:9,padding:"11px 12px",fontSize:13,color:"#fff",marginBottom:9,boxSizing:"border-box",outline:"none"},
  btn:      {background:"#22d3ee",color:"#0a0f1e",border:"none",borderRadius:9,padding:"10px 16px",fontWeight:800,cursor:"pointer",fontSize:13},
};
