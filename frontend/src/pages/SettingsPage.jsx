import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useWallet } from "../context/WalletContext";
import { useToast } from "../hooks/useToast";
import { api } from "../api";
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, EMOJI_PALETTE, COLOR_PALETTE } from "../constants";
import { getCurrentPeriodKey, getPeriodKey, todayStr } from "../utils/period";
import { fmt } from "../utils/format";
import { D } from "../styles/tokens";
import ConfirmDialog from "../components/ConfirmDialog";

export default function SettingsPage() {
  const { signOut } = useAuth();
  const { wallet, wallets, session, switchWallet, apiHelpers } = useWallet();
  const { showToast } = useToast();

  const cats = wallet.expenseCategories || DEFAULT_EXPENSE_CATEGORIES;
  const incomeCats = wallet.incomeCategories || DEFAULT_INCOME_CATEGORIES;
  const settings = wallet.settings || { monthStartDay: 1, dayStartHour: 0 };

  const [tab, setTab] = useState("account");
  const [ls, setLs] = useState({ ...settings });
  const [nec, setNec] = useState({ label: "", icon: "\uD83D\uDED2", color: "#6366f1" });
  const [nic, setNic] = useState({ label: "", icon: "\uD83D\uDCB0" });
  const [eoOpen, setEoOpen] = useState(false);
  const [ioOpen, setIoOpen] = useState(false);
  const [coOpen, setCoOpen] = useState(false);
  const [invU, setInvU] = useState("");
  const [nwn, setNwn] = useState("");
  const [confirmCat, setConfirmCat] = useState(null);
  const [confirmMember, setConfirmMember] = useState(null);
  const [editWalletId, setEditWalletId] = useState(null);
  const [editWalletName, setEditWalletName] = useState("");
  const [confirmDeleteWallet, setConfirmDeleteWallet] = useState(null);
  const [adjBalance, setAdjBalance] = useState("");
  const [adjNote, setAdjNote] = useState("Balance adjustment");
  const [adjBusy, setAdjBusy] = useState(false);
  // editCat: { id, icon, color, label, pickerOpen: "icon"|"color"|null }
  const [editCat, setEditCat] = useState(null);

  // Custom emoji/color palettes persisted in localStorage
  const CUSTOM_EMOJI_KEY = "walletly_custom_emojis";
  const CUSTOM_COLOR_KEY = "walletly_custom_colors";
  const [customEmojis, setCustomEmojis] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_EMOJI_KEY)) || []; } catch { return []; }
  });
  const [customColors, setCustomColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CUSTOM_COLOR_KEY)) || []; } catch { return []; }
  });
  const [customEmojiInput, setCustomEmojiInput] = useState("");
  const [customColorInput, setCustomColorInput] = useState("#");

  const allEmojis = [...EMOJI_PALETTE, ...customEmojis];
  const allColors = [...COLOR_PALETTE, ...customColors];

  function addCustomEmoji(emoji) {
    const trimmed = emoji.trim();
    if (!trimmed || allEmojis.includes(trimmed)) return;
    const updated = [...customEmojis, trimmed];
    setCustomEmojis(updated);
    localStorage.setItem(CUSTOM_EMOJI_KEY, JSON.stringify(updated));
    setCustomEmojiInput("");
  }
  function removeCustomEmoji(emoji) {
    const updated = customEmojis.filter((e) => e !== emoji);
    setCustomEmojis(updated);
    localStorage.setItem(CUSTOM_EMOJI_KEY, JSON.stringify(updated));
  }
  function addCustomColor(hex) {
    const trimmed = hex.trim().toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(trimmed) || allColors.includes(trimmed)) return;
    const updated = [...customColors, trimmed];
    setCustomColors(updated);
    localStorage.setItem(CUSTOM_COLOR_KEY, JSON.stringify(updated));
    setCustomColorInput("#");
  }
  function removeCustomColor(hex) {
    const updated = customColors.filter((c) => c !== hex);
    setCustomColors(updated);
    localStorage.setItem(CUSTOM_COLOR_KEY, JSON.stringify(updated));
  }

  // Render helpers for emoji/color pickers with "add custom" row
  function renderEmojiPicker(onSelect) {
    return (
      <>
        {allEmojis.map((e) => (
          <button key={e} onClick={() => onSelect(e)}
            style={{ fontSize: 17, background: "none", border: "none", cursor: "pointer", padding: 3, borderRadius: 5, position: "relative" }}>
            {e}
            {customEmojis.includes(e) && (
              <span onClick={(ev) => { ev.stopPropagation(); removeCustomEmoji(e); }}
                style={{ position: "absolute", top: -2, right: -2, fontSize: 8, color: "#f87171", cursor: "pointer", lineHeight: 1 }}>{"\u2715"}</span>
            )}
          </button>
        ))}
        <div style={{ width: "100%", display: "flex", gap: 4, marginTop: 4, borderTop: "1px solid #1e293b", paddingTop: 6 }}>
          <input style={{ background: "#0a0f1e", border: "1px solid #1e293b", borderRadius: 6, color: "#fff", fontSize: 14, width: 40, textAlign: "center", padding: "3px 2px" }}
            placeholder="\u{1F60A}" value={customEmojiInput} onChange={(e) => setCustomEmojiInput(e.target.value)} />
          <button onClick={() => addCustomEmoji(customEmojiInput)}
            style={{ background: "#22d3ee22", border: "none", borderRadius: 6, color: "#22d3ee", fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "3px 8px" }}>+ Add</button>
        </div>
      </>
    );
  }

  function renderColorPicker(onSelect, currentColor) {
    return (
      <>
        {allColors.map((col) => (
          <div key={col} style={{ position: "relative", display: "inline-block" }}>
            <button onClick={() => onSelect(col)}
              style={{ width: 26, height: 26, borderRadius: 6, background: col, border: col === currentColor ? "3px solid #fff" : "2px solid transparent", cursor: "pointer" }} />
            {customColors.includes(col) && (
              <span onClick={(ev) => { ev.stopPropagation(); removeCustomColor(col); }}
                style={{ position: "absolute", top: -3, right: -3, fontSize: 8, color: "#fff", background: "#ef4444", borderRadius: "50%", width: 12, height: 12, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", lineHeight: 1 }}>{"\u2715"}</span>
            )}
          </div>
        ))}
        <div style={{ width: "100%", display: "flex", gap: 4, marginTop: 4, borderTop: "1px solid #1e293b", paddingTop: 6, alignItems: "center" }}>
          <input type="color" value={customColorInput.length === 7 ? customColorInput : "#000000"}
            onChange={(e) => setCustomColorInput(e.target.value)}
            style={{ width: 28, height: 28, border: "none", borderRadius: 6, cursor: "pointer", padding: 0, background: "none" }} />
          <input style={{ background: "#0a0f1e", border: "1px solid #1e293b", borderRadius: 6, color: "#fff", fontSize: 10, flex: 1, padding: "4px 6px", fontFamily: "monospace" }}
            placeholder="#ff5500" value={customColorInput} onChange={(e) => setCustomColorInput(e.target.value)} />
          <button onClick={() => addCustomColor(customColorInput)}
            style={{ background: "#22d3ee22", border: "none", borderRadius: 6, color: "#22d3ee", fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "3px 8px", whiteSpace: "nowrap" }}>+ Add</button>
        </div>
      </>
    );
  }

  const msd = settings.monthStartDay || 1;
  const pk = getCurrentPeriodKey(msd);
  const periodTxns = wallet.transactions.filter((t) => getPeriodKey(t.date, msd) === pk);
  const currentBalance = periodTxns.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);

  const userWallets = wallets || [];
  const members = (wallet._memberObjects || wallet.members || []).map((m) => {
    if (typeof m === "object")
      return { uid: m.id || m.uid, name: m.displayName || m.display_name || m.username || "", username: m.username || "" };
    return { uid: m, name: m, username: m };
  });

  async function saveSettings() {
    try {
      await apiHelpers.updateSettings(ls);
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function addEC() {
    if (!nec.label.trim()) return showToast("Enter a name", "error");
    try {
      await apiHelpers.addCategory("expense", nec.label.trim(), nec.icon, nec.color);
      setNec({ label: "", icon: "\uD83D\uDED2", color: "#6366f1" });
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function addIC() {
    if (!nic.label.trim()) return showToast("Enter a name", "error");
    try {
      await apiHelpers.addCategory("income", nic.label.trim(), nic.icon, "#10b981");
      setNic({ label: "", icon: "\uD83D\uDCB0" });
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function delCat(id) {
    try {
      await apiHelpers.deleteCategory(id);
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function invite() {
    const uname = invU.toLowerCase().trim();
    if (!uname) return showToast("Enter a username", "error");
    try {
      await apiHelpers.inviteMember(uname);
      setInvU("");
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function createWallet() {
    if (!nwn.trim()) return showToast("Enter name", "error");
    try {
      await apiHelpers.createWallet(nwn.trim());
      setNwn("");
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function renameWallet(wId) {
    if (!editWalletName.trim()) return showToast("Enter a name", "error");
    try {
      await apiHelpers.renameWallet(wId, editWalletName.trim());
      setEditWalletId(null);
      setEditWalletName("");
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function deleteWallet(wId) {
    try {
      await apiHelpers.deleteWallet(wId);
      setConfirmDeleteWallet(null);
      showToast("Wallet deleted");
    } catch (e) {
      showToast(e.message, "error");
    }
  }

  async function adjustBalance() {
    const target = Math.round(+adjBalance);
    if (!adjBalance || isNaN(target)) return showToast("Enter a valid amount", "error");
    const diff = target - currentBalance;
    if (diff === 0) return showToast("Balance is already at that amount", "info");
    const type = diff > 0 ? "income" : "expense";
    const amount = Math.abs(diff);
    setAdjBusy(true);
    try {
      await apiHelpers.addTransaction({
        type,
        amount,
        category: null,
        note: adjNote.trim() || "Balance adjustment",
        date: todayStr(),
      });
      setAdjBalance("");
      showToast("Balance adjusted");
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      setAdjBusy(false);
    }
  }

  const TABS = [
    { id: "account", l: "Account" },
    { id: "wallet", l: "Wallet" },
    { id: "cats", l: "Categories" },
    { id: "cycle", l: "Cycle" },
  ];

  return (
    <div style={{ background: "#0a0f1e", minHeight: "100%", padding: "16px 16px 120px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff" }}>Account</div>
        {wallets.length > 1 && (
          <select style={{ background: "#131c2e", border: "1px solid #1e293b", color: "#94a3b8", borderRadius: 8, padding: "5px 8px", fontSize: 11, cursor: "pointer" }}
            value={session?.walletId} onChange={(e) => switchWallet(e.target.value)}>
            {wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        )}
      </div>

      <div
        style={{
          background: "#131c2e",
          borderRadius: 14,
          padding: 14,
          marginBottom: 14,
          border: "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 900,
            fontSize: 20,
            flexShrink: 0,
          }}
        >
          {(session?.username || "?")[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{session?.username || ""}</div>
          <div style={{ color: "#475569", fontSize: 12 }}>@{session?.username || ""}</div>
        </div>
        <button
          style={{
            background: "#ef444420",
            border: "none",
            borderRadius: 9,
            padding: "7px 12px",
            cursor: "pointer",
            color: "#f87171",
            fontWeight: 700,
            fontSize: 12,
          }}
          onClick={signOut}
        >
          Sign out
        </button>
      </div>

      <div style={{ display: "flex", gap: 5, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "6px 14px",
              border: "none",
              background: tab === t.id ? "#22d3ee" : "#131c2e",
              color: tab === t.id ? "#0a0f1e" : "#94a3b8",
              borderRadius: 99,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {tab === "account" && (
        <>
          <div style={{ background: "#131c2e", borderRadius: 14, padding: 14, marginBottom: 10, border: "1px solid #1e293b" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>My Wallets</div>
            {userWallets.map((w, i) => {
              const isEditing = editWalletId === w.id;
              const isOwner = w.owner_id === session?.id;
              return (
                <div
                  key={w.id}
                  onClick={() => !isEditing && switchWallet(w.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 0",
                    borderBottom: i < userWallets.length - 1 ? "1px solid #1e293b" : "none",
                    cursor: isEditing ? "default" : "pointer",
                    background: w.id === wallet.id ? "#ffffff08" : "transparent",
                    borderRadius: 8,
                    paddingLeft: 6,
                    paddingRight: 6,
                  }}
                >
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 9,
                      background: ["#f59e0b22", "#10b98122", "#3b82f622", "#8b5cf622"][i % 4],
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                      flexShrink: 0,
                    }}
                  >
                    {"\uD83D\uDCB3"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 5 }}>
                        <input
                          autoFocus
                          style={{ ...D.inp, margin: 0, flex: 1, fontSize: 12, padding: "6px 8px" }}
                          value={editWalletName}
                          onChange={(e) => setEditWalletName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameWallet(w.id);
                            if (e.key === "Escape") setEditWalletId(null);
                          }}
                        />
                        <button
                          style={{ ...D.btn, padding: "5px 10px", fontSize: 11 }}
                          onClick={() => renameWallet(w.id)}
                        >
                          Save
                        </button>
                        <button
                          style={{ background: "#1e293b", border: "none", borderRadius: 7, padding: "5px 8px", cursor: "pointer", color: "#94a3b8", fontSize: 11 }}
                          onClick={() => setEditWalletId(null)}
                        >
                          {"\u2715"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ color: "#fff", fontWeight: 600, fontSize: 12 }}>{w.name}</div>
                        <div style={{ color: "#475569", fontSize: 10 }}>
                          {(w.members || []).length} member{(w.members || []).length !== 1 ? "s" : ""} ·{" "}
                          {isOwner ? "Owner" : "Member"}
                        </div>
                      </>
                    )}
                  </div>
                  {!isEditing && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      {w.id === wallet.id && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22d3ee" }} />}
                      {isOwner && (
                        <>
                          <button
                            onClick={() => {
                              setEditWalletId(w.id);
                              setEditWalletName(w.name);
                            }}
                            style={{ background: "#1e293b", border: "none", borderRadius: 7, padding: "3px 7px", cursor: "pointer", fontSize: 11, color: "#94a3b8" }}
                          >
                            {"\u270F\uFE0F"}
                          </button>
                          {userWallets.length > 1 && (
                            <button
                              onClick={() => setConfirmDeleteWallet(w.id)}
                              style={{ background: "#ef444420", border: "none", borderRadius: 7, padding: "3px 7px", cursor: "pointer", fontSize: 11, color: "#f87171" }}
                            >
                              {"\uD83D\uDDD1\uFE0F"}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ background: "#131c2e", borderRadius: 14, padding: 14, border: "1px solid #1e293b", marginBottom: 10 }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Create New Wallet</div>
            <input style={D.inp} placeholder="Wallet name" value={nwn} onChange={(e) => setNwn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createWallet()} />
            <button style={{ ...D.btn, width: "100%", padding: 11 }} onClick={createWallet}>
              Create Wallet
            </button>
          </div>
          {userWallets.length > 1 && (
            <div style={{ background: "#131c2e", borderRadius: 14, padding: 14, border: "1px solid #1e293b" }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>Combined View</div>
              <div style={{ color: "#475569", fontSize: 11, marginBottom: 10 }}>
                Choose which wallets are included in the combined dashboard view.
              </div>
              {userWallets.map((w, i) => {
                const excluded = w.exclude_combined;
                return (
                  <div
                    key={w.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 6px",
                      borderBottom: i < userWallets.length - 1 ? "1px solid #1e293b" : "none",
                      opacity: excluded ? 0.45 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 9,
                        background: ["#f59e0b22", "#10b98122", "#3b82f622", "#8b5cf622"][i % 4],
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      {"\uD83D\uDCB3"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#fff", fontWeight: 600, fontSize: 12 }}>{w.name}</div>
                      <div style={{ color: "#475569", fontSize: 10 }}>
                        {excluded ? "Hidden from combined view" : "Included in combined view"}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          await api.toggleExcludeCombined(w.id, !excluded);
                          await apiHelpers.refreshWallets();
                        } catch (e) {
                          showToast(e.message, "error");
                        }
                      }}
                      style={{
                        background: excluded ? "#1e293b" : "#22d3ee22",
                        border: "none",
                        borderRadius: 8,
                        padding: "5px 10px",
                        cursor: "pointer",
                        fontSize: 11,
                        fontWeight: 700,
                        color: excluded ? "#94a3b8" : "#22d3ee",
                        flexShrink: 0,
                      }}
                    >
                      {excluded ? "Show" : "Hide"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "wallet" && (
        <>
          <div style={{ background: "#131c2e", borderRadius: 14, padding: 14, marginBottom: 10, border: "1px solid #1e293b" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{wallet.name}</div>
            <div style={{ color: "#475569", fontSize: 11, marginBottom: 10 }}>
              Owner: @{wallet.owner} · {members.length} members
            </div>
            {members.map((m, i) => (
              <div
                key={m.uid}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "9px 0",
                  borderBottom: i < members.length - 1 ? "1px solid #1e293b" : "none",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                >
                  {(m.name || m.uid || "?")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 12 }}>{m.name || m.uid}</div>
                  <div style={{ color: "#475569", fontSize: 10 }}>
                    @{m.username || m.uid}
                    {m.uid === wallet.owner ? " · Owner" : ""}
                  </div>
                </div>
                {m.uid !== wallet.owner && (
                  <button
                    style={{
                      background: "#ef444420",
                      border: "none",
                      borderRadius: 7,
                      padding: "3px 8px",
                      cursor: "pointer",
                      fontSize: 11,
                      color: "#f87171",
                      fontWeight: 700,
                    }}
                    onClick={() => setConfirmMember(m.uid)}
                  >
                    {"\u2715"}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div style={{ background: "#131c2e", borderRadius: 14, padding: 14, marginBottom: 10, border: "1px solid #1e293b" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>Adjust Balance</div>
            <div style={{ color: "#475569", fontSize: 11, marginBottom: 12 }}>
              Current period balance: <span style={{ color: "#22d3ee", fontWeight: 700 }}>{fmt(currentBalance)}</span>
            </div>
            <label style={{ color: "#94a3b8", fontSize: 11, display: "block", marginBottom: 4 }}>Set balance to (IDR)</label>
            <input
              style={D.inp}
              type="number"
              placeholder="Target balance"
              value={adjBalance}
              onChange={(e) => setAdjBalance(e.target.value)}
            />
            <label style={{ color: "#94a3b8", fontSize: 11, display: "block", marginBottom: 4 }}>Note</label>
            <input
              style={D.inp}
              placeholder="Reason (optional)"
              value={adjNote}
              onChange={(e) => setAdjNote(e.target.value)}
            />
            {adjBalance && !isNaN(+adjBalance) && Math.round(+adjBalance) !== currentBalance && (
              <div style={{ background: "#0a0f1e", borderRadius: 9, padding: "8px 11px", marginBottom: 9, fontSize: 12, color: Math.round(+adjBalance) > currentBalance ? "#10b981" : "#f87171" }}>
                {Math.round(+adjBalance) > currentBalance
                  ? `\u2191 Will add ${fmt(Math.round(+adjBalance) - currentBalance)} income`
                  : `\u2193 Will add ${fmt(currentBalance - Math.round(+adjBalance))} expense`}
              </div>
            )}
            <button
              style={{ ...D.btn, width: "100%", padding: 11, opacity: adjBusy ? 0.6 : 1 }}
              onClick={adjustBalance}
              disabled={adjBusy}
            >
              {adjBusy ? "Adjusting\u2026" : "Apply Adjustment"}
            </button>
          </div>

          <div style={{ background: "#131c2e", borderRadius: 14, padding: 14, border: "1px solid #1e293b" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Invite Member</div>
            <div style={{ display: "flex", gap: 7 }}>
              <input
                style={{ ...D.inp, margin: 0, flex: 1 }}
                placeholder="Username"
                value={invU}
                onChange={(e) => setInvU(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && invite()}
              />
              <button style={{ ...D.btn, padding: "9px 14px" }} onClick={invite}>
                Invite
              </button>
            </div>
            <div style={{ color: "#334155", fontSize: 11, marginTop: 7 }}>
              {"\uD83D\uDCA1"} Invite another registered user by their username
            </div>
          </div>
        </>
      )}

      {tab === "cats" && (
        <>
          <div style={{ background: "#131c2e", borderRadius: 14, padding: 14, marginBottom: 10, border: "1px solid #1e293b" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{"\uD83C\uDFF7\uFE0F"} Expense Categories</div>
            <div style={{ background: "#0a0f1e", borderRadius: 11, padding: 11, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 7, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => {
                      setEoOpen(!eoOpen);
                      setCoOpen(false);
                      setIoOpen(false);
                    }}
                    style={{ fontSize: 20, background: "#131c2e", border: "1px solid #1e293b", borderRadius: 9, padding: "7px 9px", cursor: "pointer" }}
                  >
                    {nec.icon}
                  </button>
                  {eoOpen && (
                    <div style={{ position: "absolute", top: 44, left: 0, background: "#131c2e", border: "1px solid #1e293b", borderRadius: 11, padding: 7, zIndex: 200, display: "flex", flexWrap: "wrap", gap: 2, width: 210, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                      {renderEmojiPicker((e) => { setNec({ ...nec, icon: e }); setEoOpen(false); })}
                    </div>
                  )}
                </div>
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => {
                      setCoOpen(!coOpen);
                      setEoOpen(false);
                      setIoOpen(false);
                    }}
                    style={{ width: 38, height: 38, borderRadius: 9, background: nec.color, border: "2px solid #1e293b", cursor: "pointer", display: "block" }}
                  />
                  {coOpen && (
                    <div style={{ position: "absolute", top: 44, left: 0, background: "#131c2e", border: "1px solid #1e293b", borderRadius: 11, padding: 7, zIndex: 200, display: "flex", flexWrap: "wrap", gap: 3, width: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                      {renderColorPicker((col) => { setNec({ ...nec, color: col }); setCoOpen(false); }, nec.color)}
                    </div>
                  )}
                </div>
                <input
                  style={{ ...D.inp, margin: 0, flex: 1, minWidth: 90 }}
                  placeholder="Name..."
                  value={nec.label}
                  onChange={(e) => setNec({ ...nec, label: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addEC()}
                />
                <button style={{ ...D.btn, padding: "9px 12px" }} onClick={addEC}>
                  Add
                </button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {cats.map((c) => {
                const isEditing = editCat?.id === c.id;
                return (
                  <div key={c.id} style={{ position: "relative" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "8px 9px",
                        background: isEditing ? "#131c2e" : "#0a0f1e",
                        borderRadius: 9,
                        border: `1px solid ${isEditing ? "#22d3ee" : c.color + "33"}`,
                      }}
                    >
                      <span
                        style={{ fontSize: 16, cursor: "pointer" }}
                        onClick={() => setEditCat(isEditing && editCat.pickerOpen === "icon" ? null : { id: c.id, icon: c.icon, color: c.color, label: c.label, pickerOpen: "icon" })}
                      >{isEditing ? editCat.icon : c.icon}</span>
                      <span
                        style={{ flex: 1, color: "#fff", fontWeight: 600, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {c.label}
                      </span>
                      <button
                        onClick={() => setEditCat(isEditing && editCat.pickerOpen === "color" ? null : { id: c.id, icon: c.icon, color: c.color, label: c.label, pickerOpen: "color" })}
                        style={{ width: 16, height: 16, borderRadius: 4, background: isEditing ? editCat.color : c.color, border: "1px solid #1e293b", cursor: "pointer", flexShrink: 0, padding: 0 }}
                      />
                      <button
                        onClick={() => setConfirmCat({ id: c.id, type: "e", label: c.label })}
                        style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 13, padding: 1, flexShrink: 0 }}
                      >
                        {"\u2715"}
                      </button>
                    </div>
                    {isEditing && editCat.pickerOpen === "icon" && (
                      <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#131c2e", border: "1px solid #1e293b", borderRadius: 11, padding: 7, zIndex: 200, display: "flex", flexWrap: "wrap", gap: 2, width: 210, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                        {renderEmojiPicker(async (e) => {
                          try { await apiHelpers.updateCategory(c.id, { icon: e }); setEditCat(null); } catch (err) { showToast(err.message, "error"); }
                        })}
                      </div>
                    )}
                    {isEditing && editCat.pickerOpen === "color" && (
                      <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#131c2e", border: "1px solid #1e293b", borderRadius: 11, padding: 7, zIndex: 200, display: "flex", flexWrap: "wrap", gap: 3, width: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                        {renderColorPicker(async (col) => {
                          try { await apiHelpers.updateCategory(c.id, { color: col }); setEditCat(null); } catch (err) { showToast(err.message, "error"); }
                        }, c.color)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ background: "#131c2e", borderRadius: 14, padding: 14, border: "1px solid #1e293b" }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 12 }}>{"\uD83D\uDCB0"} Income Categories</div>
            <div style={{ background: "#0a0f1e", borderRadius: 11, padding: 11, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 7, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => {
                      setIoOpen(!ioOpen);
                      setEoOpen(false);
                      setCoOpen(false);
                    }}
                    style={{ fontSize: 20, background: "#131c2e", border: "1px solid #1e293b", borderRadius: 9, padding: "7px 9px", cursor: "pointer" }}
                  >
                    {nic.icon}
                  </button>
                  {ioOpen && (
                    <div style={{ position: "absolute", top: 44, left: 0, background: "#131c2e", border: "1px solid #1e293b", borderRadius: 11, padding: 7, zIndex: 200, display: "flex", flexWrap: "wrap", gap: 2, width: 210, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                      {renderEmojiPicker((e) => { setNic({ ...nic, icon: e }); setIoOpen(false); })}
                    </div>
                  )}
                </div>
                <input
                  style={{ ...D.inp, margin: 0, flex: 1, minWidth: 90 }}
                  placeholder="Name..."
                  value={nic.label}
                  onChange={(e) => setNic({ ...nic, label: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && addIC()}
                />
                <button style={{ ...D.btn, padding: "9px 12px" }} onClick={addIC}>
                  Add
                </button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {incomeCats.map((c) => {
                const isEditing = editCat?.id === c.id;
                return (
                  <div key={c.id} style={{ position: "relative" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 7,
                        padding: "8px 9px",
                        background: isEditing ? "#131c2e" : "#0a0f1e",
                        borderRadius: 9,
                        border: `1px solid ${isEditing ? "#22d3ee" : (c.color || "#10b981") + "33"}`,
                      }}
                    >
                      <span
                        style={{ fontSize: 16, cursor: "pointer" }}
                        onClick={() => setEditCat(isEditing && editCat.pickerOpen === "icon" ? null : { id: c.id, icon: c.icon, color: c.color || "#10b981", label: c.label, pickerOpen: "icon" })}
                      >{isEditing ? editCat.icon : c.icon}</span>
                      <span
                        style={{ flex: 1, color: "#fff", fontWeight: 600, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {c.label}
                      </span>
                      <button
                        onClick={() => setEditCat(isEditing && editCat.pickerOpen === "color" ? null : { id: c.id, icon: c.icon, color: c.color || "#10b981", label: c.label, pickerOpen: "color" })}
                        style={{ width: 16, height: 16, borderRadius: 4, background: c.color || "#10b981", border: "1px solid #1e293b", cursor: "pointer", flexShrink: 0, padding: 0 }}
                      />
                      <button
                        onClick={() => setConfirmCat({ id: c.id, type: "i", label: c.label })}
                        style={{ background: "none", border: "none", color: "#334155", cursor: "pointer", fontSize: 13, padding: 1, flexShrink: 0 }}
                      >
                        {"\u2715"}
                      </button>
                    </div>
                    {isEditing && editCat.pickerOpen === "icon" && (
                      <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#131c2e", border: "1px solid #1e293b", borderRadius: 11, padding: 7, zIndex: 200, display: "flex", flexWrap: "wrap", gap: 2, width: 210, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                        {renderEmojiPicker(async (e) => {
                          try { await apiHelpers.updateCategory(c.id, { icon: e }); setEditCat(null); } catch (err) { showToast(err.message, "error"); }
                        })}
                      </div>
                    )}
                    {isEditing && editCat.pickerOpen === "color" && (
                      <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: "#131c2e", border: "1px solid #1e293b", borderRadius: 11, padding: 7, zIndex: 200, display: "flex", flexWrap: "wrap", gap: 3, width: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
                        {renderColorPicker(async (col) => {
                          try { await apiHelpers.updateCategory(c.id, { color: col }); setEditCat(null); } catch (err) { showToast(err.message, "error"); }
                        }, c.color || "#10b981")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {tab === "cycle" && (
        <div style={{ background: "#131c2e", borderRadius: 14, padding: 14, border: "1px solid #1e293b" }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{"\uD83D\uDCC5"} Budget Cycle</div>
          <div style={{ color: "#475569", fontSize: 12, marginBottom: 14 }}>Set when your monthly budget cycle resets.</div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: "#94a3b8", fontSize: 11, display: "block", marginBottom: 5 }}>Cycle starts on day</label>
            <select style={D.inp} value={ls.monthStartDay} onChange={(e) => setLs({ ...ls, monthStartDay: +e.target.value })}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                  {d === 1 ? " (standard)" : d === 25 ? " (salary day)" : ""}
                </option>
              ))}
            </select>
            <div style={{ background: "#0a0f1e", borderRadius: 9, padding: "8px 10px", marginTop: 6, fontSize: 11, color: "#22d3ee" }}>
              {ls.monthStartDay === 1
                ? "\uD83D\uDCC5 Jan 1 \u2192 Jan 31, Feb 1 \u2192 Feb 28\u2026"
                : `\uD83D\uDD04 ${ls.monthStartDay}th each month \u2192 ${ls.monthStartDay - 1}th next month`}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ color: "#94a3b8", fontSize: 11, display: "block", marginBottom: 5 }}>Day starts at hour</label>
            <select style={D.inp} value={ls.dayStartHour} onChange={(e) => setLs({ ...ls, dayStartHour: +e.target.value })}>
              {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}:00{h === 0 ? " (midnight)" : h === 4 ? " (4 AM)" : ""}
                </option>
              ))}
            </select>
          </div>
          <button style={{ ...D.btn, width: "100%", padding: 12 }} onClick={saveSettings}>
            Save Settings
          </button>
        </div>
      )}

      {confirmCat && (
        <ConfirmDialog
          title="Delete Category"
          message={`Delete "${confirmCat.label}"? Existing transactions won't be deleted but will lose their category.`}
          onConfirm={() => {
            delCat(confirmCat.id);
            setConfirmCat(null);
          }}
          onCancel={() => setConfirmCat(null)}
        />
      )}
      {confirmMember && (
        <ConfirmDialog
          title="Remove Member"
          message={`Remove @${confirmMember} from this wallet?`}
          confirmLabel="Remove"
          onConfirm={async () => {
            try {
              await apiHelpers.removeMember(confirmMember);
              setConfirmMember(null);
            } catch (e) {
              showToast(e.message, "error");
            }
          }}
          onCancel={() => setConfirmMember(null)}
        />
      )}
      {confirmDeleteWallet && (
        <ConfirmDialog
          title="Delete Wallet"
          message={`Delete "${userWallets.find((w) => w.id === confirmDeleteWallet)?.name}"? All transactions, categories, and budgets in this wallet will be permanently removed.`}
          confirmLabel="Delete"
          onConfirm={() => deleteWallet(confirmDeleteWallet)}
          onCancel={() => setConfirmDeleteWallet(null)}
        />
      )}
    </div>
  );
}
