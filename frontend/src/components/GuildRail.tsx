import { useState } from "react";
import { useChat } from "../store/chat";
import CreateGuildModal from "./CreateGuildModal";

export default function GuildRail() {
  const guilds = useChat((s) => s.guilds);
  const selected = useChat((s) => s.selectedGuildId);
  const home = useChat((s) => s.home);
  const selectGuild = useChat((s) => s.selectGuild);
  const goHome = useChat((s) => s.goHome);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex w-[72px] flex-col items-center gap-2 bg-rail py-3">
      {/* home / logo */}
      <button onClick={goHome} className="group relative flex h-12 w-12 items-center justify-center" title="Home">
        <span
          className={
            "absolute -left-3 w-1 rounded-r bg-white transition-all " +
            (home ? "h-10" : "h-0 group-hover:h-5")
          }
        />
        <span
          className={
            "grid h-12 w-12 place-items-center text-lg font-bold text-white transition-all " +
            (home ? "rounded-2xl bg-blurple" : "rounded-3xl bg-blurple group-hover:rounded-2xl")
          }
        >
          M
        </span>
      </button>
      <div className="my-1 h-0.5 w-8 rounded bg-divider" />

      {guilds.map((g) => {
        const active = !home && g.id === selected;
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
            {g.iconUrl ? (
              <img
                src={g.iconUrl}
                alt={g.name}
                className={"h-12 w-12 object-cover transition-all " + (active ? "rounded-2xl" : "rounded-3xl group-hover:rounded-2xl")}
              />
            ) : (
              <span
                className={
                  "grid h-12 w-12 place-items-center text-sm font-semibold text-white transition-all " +
                  (active ? "rounded-2xl" : "rounded-3xl group-hover:rounded-2xl")
                }
                style={{ backgroundColor: g.color }}
              >
                {g.icon}
              </span>
            )}
          </button>
        );
      })}

      <button
        onClick={() => setShowCreate(true)}
        className="grid h-12 w-12 place-items-center rounded-3xl bg-sidebar text-2xl text-online transition-all hover:rounded-2xl hover:bg-online hover:text-white"
        title="Add or join a guild"
      >
        +
      </button>

      {showCreate && <CreateGuildModal onClose={() => setShowCreate(false)} />}
    </div>
  );
}
