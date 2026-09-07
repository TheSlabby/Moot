import { useSession } from "../store/session";

// Upload a file to the backend (via the Vite proxy -> C++ HTTP route).
// Returns the served URL (e.g. "/files/abc.png") or null on failure.
export async function uploadFile(file: File): Promise<string | null> {
  const token = useSession.getState().token;
  if (!token) return null;
  try {
    const res = await fetch(`/upload?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!res.ok) return null;
    const d = (await res.json()) as { url: string };
    return d.url;
  } catch {
    return null;
  }
}
