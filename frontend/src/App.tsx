import { useSession } from "./store/session";
import Login from "./components/Login";
import ChatShell from "./components/ChatShell";

export default function App() {
  const user = useSession((s) => s.user);
  return user ? <ChatShell /> : <Login />;
}
