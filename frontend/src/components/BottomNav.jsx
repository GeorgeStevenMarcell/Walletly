import { NAV_ITEMS } from "../constants";
import { useNavigation } from "../context/NavigationContext";
import tokens from "../styles/tokens";

export default function BottomNav() {
  const { page, setPage } = useNavigation();
  return (
    <nav style={tokens.bottomNav}>
      {NAV_ITEMS.map((n) => (
        <button
          key={n.id}
          onClick={() => setPage(n.id)}
          style={{ ...tokens.navItem, ...(page === n.id ? tokens.navActive : {}) }}
        >
          <span style={{ fontSize: 20 }}>{n.icon}</span>
          <span style={{ fontSize: 10, marginTop: 2, fontWeight: page === n.id ? 700 : 400 }}>{n.label}</span>
        </button>
      ))}
    </nav>
  );
}
