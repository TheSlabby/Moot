import { useChat } from "../store/chat";
import { useSession } from "../store/session";

export default function HomeView() {
  const guilds = useChat((s) => s.guilds);
  const guildMembers = useChat((s) => s.guildMembers);
  const onlineIds = useChat((s) => s.onlineIds);
  const selectGuild = useChat((s) => s.selectGuild);
  const user = useSession((s) => s.user);

  const totalOnline = onlineIds.size;

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-chat">
      <div className="flex h-12 items-center gap-2 border-b border-black/20 px-4 shadow-sm">
        <span className="text-lg">🏠</span>
        <span className="font-semibold text-textNormal">Home</span>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold text-textNormal">
            Welcome back, {user?.username} 👋
          </h1>
          <p className="mt-1 text-textMuted">
            You're in {guilds.length} guild{guilds.length === 1 ? "" : "s"} · {totalOnline} online right now.
          </p>

          <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wide text-textFaint">Your Guilds</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {guilds.map((g) => {
              const members = guildMembers[g.id] ?? [];
              const online = members.filter((m) => onlineIds.has(m.id)).length;
              return (
                <button
                  key={g.id}
                  onClick={() => selectGuild(g.id)}
                  className="flex items-center gap-3 rounded-lg border border-divider bg-sidebar p-4 text-left transition hover:border-blurple hover:bg-hover"
                >
                  {g.iconUrl ? (
                    <img src={g.iconUrl} alt="" className="h-12 w-12 rounded-2xl object-cover" />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-2xl text-base font-bold text-white" style={{ backgroundColor: g.color }}>
                      {g.icon}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-textNormal">{g.name}</div>
                    <div className="text-xs text-textMuted">
                      {members.length} member{members.length === 1 ? "" : "s"}
                      <span className="mx-1">·</span>
                      <span className="text-online">● {online} online</span>
                    </div>
                  </div>
                  <span className="text-textFaint">→</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
