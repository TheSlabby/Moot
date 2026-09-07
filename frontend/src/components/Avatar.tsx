import { colorFor, initials } from "./ui";

// Renders an uploaded avatar image, or colored initials as a fallback.
export default function Avatar({
  url,
  name,
  id,
  size = 40,
  color,
}: {
  url?: string;
  name: string;
  id: string;
  size?: number;
  color?: string;
}) {
  const style = { width: size, height: size };
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className="shrink-0 rounded-full object-cover"
        style={style}
      />
    );
  }
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ ...style, backgroundColor: color ?? colorFor(id), fontSize: size * 0.34 }}
    >
      {initials(name)}
    </span>
  );
}
