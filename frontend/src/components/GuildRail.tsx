import { useChat } from "../store/chat";

export default function GuildRail() {
  const guilds = useChat((s) => s.guilds);
  const selected = useChat((s) => s.selectedGuildId);
  const selectGuild = useChat((s) => s.selectGuild);
  const createGuild = useChat((s) => s.createGuild);
  const joinGuild = useChat((s) => s.joinGuild);

  function onCreate() {
    const name = window.prompt("New guild name:");
    if (name && name.trim()) createGuild(name.trim());
  }
  function onJoin() {
    const id = window.prompt("Join guild by id:");
    if (id && id.trim()) joinGuild(id.trim());
  }

  return (
    <div className="flex w-[72px] flex-col items-center gap-2 bg-rail py-3">
      {/* home / logo */}
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blurple text-lg font-bold text-white">
        M
      </div>
      <div className="my-1 h-0.5 w-8 rounded bg-divider" />

      {guilds.map((g) => {
        const active = g.id === selected;
        return (
          <button
            key={g.id}
            onClick={() => selectGuild(g.id)}
            className="group relative flex h-12 w-12 items-center justify-center"
            title={g.name}
          >
            {/* active pill */}
            <span
              className={
                "absolute -left-3 w-1 rounded-r bg-white transition-all " +
                (active ? "h-10" : "h-0 group-hover:h-5")
              }
            />
            <span
              className={
                "grid h-12 w-12 place-items-center text-sm font-semibold text-white transition-all " +
                (active ? "rounded-2xl" : "rounded-3xl group-hover:rounded-2xl")
              }
              style={{ backgroundColor: g.color }}
            >
              {g.icon}
            </span>
          </button>
        );
      })}

      <button
        onClick={onCreate}
        className="grid h-12 w-12 place-items-center rounded-3xl bg-sidebar text-2xl text-online transition-all hover:rounded-2xl hover:bg-online hover:text-white"
        title="Create a guild (GUILD_CREATE)"
      >
        +
      </button>
      <button
        onClick={onJoin}
        className="grid h-12 w-12 place-items-center rounded-3xl bg-sidebar text-xl text-online transition-all hover:rounded-2xl hover:bg-online hover:text-white"
        title="Join a guild by id (GUILD_JOIN)"
      >
        ⤵
      </button>
    </div>
  );
}
