import tokens from "../styles/tokens";

export default function FAB({ onClick }) {
  return (
    <button style={tokens.fab} onClick={onClick}>+</button>
  );
}
