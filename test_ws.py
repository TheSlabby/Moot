#!/usr/bin/env python3
"""
Dead-simple WebSocket test client for Moot. No dependencies (stdlib only).

Connects to the gateway, sends one text frame, so the server prints "got msg: ...".
Usage:  python3 test_ws.py  [message]  [host] [port]
"""
import socket
import sys
import os
import base64
import struct

msg  = sys.argv[1] if len(sys.argv) > 1 else '{"op":"IDENTIFY","d":{"token":"dev-token-walker"}}'
host = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"
port = int(sys.argv[3]) if len(sys.argv) > 3 else 8080

# --- open TCP ---
sock = socket.create_connection((host, port))

# --- WebSocket handshake (client sends an HTTP upgrade request) ---
key = base64.b64encode(os.urandom(16)).decode()
handshake = (
    f"GET / HTTP/1.1\r\n"
    f"Host: {host}:{port}\r\n"
    f"Upgrade: websocket\r\n"
    f"Connection: Upgrade\r\n"
    f"Sec-WebSocket-Key: {key}\r\n"
    f"Sec-WebSocket-Version: 13\r\n"
    f"\r\n"
)
sock.sendall(handshake.encode())

# read the server's 101 Switching Protocols response
resp = sock.recv(4096).decode(errors="replace")
print("--- handshake response ---")
print(resp.strip())
if "101" not in resp.split("\r\n")[0]:
    print("!! server did not accept the upgrade")
    sys.exit(1)
print("--- handshake OK, sending frame ---")

# --- send one masked text frame (clients MUST mask, per RFC 6455) ---
payload = msg.encode()
frame  = bytearray()
frame.append(0x81)                       # FIN + opcode 0x1 (text)
mask_bit = 0x80
n = len(payload)
if n < 126:
    frame.append(mask_bit | n)
elif n < 65536:
    frame.append(mask_bit | 126)
    frame += struct.pack(">H", n)
else:
    frame.append(mask_bit | 127)
    frame += struct.pack(">Q", n)

mask = os.urandom(4)
frame += mask
frame += bytes(b ^ mask[i % 4] for i, b in enumerate(payload))

sock.sendall(frame)
print(f"sent: {msg}")

# --- read one reply frame (server->client frames are NOT masked) ---
def recv_exact(n):
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf

hdr = recv_exact(2)
if hdr:
    length = hdr[1] & 0x7F
    if length == 126:
        length = struct.unpack(">H", recv_exact(2))[0]
    elif length == 127:
        length = struct.unpack(">Q", recv_exact(8))[0]
    body = recv_exact(length) or b""
    print(f"reply: {body.decode(errors='replace')}")
else:
    print("(no reply)")

sock.close()
