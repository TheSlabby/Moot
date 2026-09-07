import GuildRail from "./GuildRail";
import ChannelSidebar from "./ChannelSidebar";
import ChatArea from "./ChatArea";
import MemberList from "./MemberList";
import FrameInspector from "../debug/FrameInspector";

export default function ChatShell() {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <GuildRail />
      <ChannelSidebar />
      <ChatArea />
      <MemberList />
      <FrameInspector />
    </div>
  );
}
