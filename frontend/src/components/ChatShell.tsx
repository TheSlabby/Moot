import { useChat } from "../store/chat";
import GuildRail from "./GuildRail";
import ChannelSidebar from "./ChannelSidebar";
import ChatArea from "./ChatArea";
import MemberList from "./MemberList";
import HomeView from "./HomeView";
import FrameInspector from "../debug/FrameInspector";

export default function ChatShell() {
  const home = useChat((s) => s.home);
  return (
    <div className="flex h-full w-full overflow-hidden">
      <GuildRail />
      {home ? (
        <HomeView />
      ) : (
        <>
          <ChannelSidebar />
          <ChatArea />
          <MemberList />
        </>
      )}
      <FrameInspector />
    </div>
  );
}
