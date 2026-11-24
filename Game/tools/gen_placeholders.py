"""Writes the placeholder assets: a ring texture and synthesized sound effects.

Run from the project root: python tools/gen_placeholders.py
Everything here is swappable art; replace the files and keep their names (or their .gmeta GUIDs).
"""
import math
import os
import random
import struct
import wave
import zlib

ROOT = os.path.join(os.path.dirname(__file__), "..")


def png(path, w, h, pixel):
    rows = []
    for y in range(h):
        row = bytearray([0])
        for x in range(w):
            row += bytes(pixel(x, y))
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(data)


def ring_pixel(x, y, size=128, outer=60.0, inner=50.0):
    c = (size - 1) / 2
    d = math.hypot(x - c, y - c)
    a = max(0.0, min(1.0, outer - d + 0.5)) * max(0.0, min(1.0, d - inner + 0.5))
    return (255, 255, 255, int(a * 255))


SR = 22050


def write_wav(name, samples):
    path = os.path.join(ROOT, "assets", "audio", name + ".wav")
    peak = max(1e-6, max(abs(s) for s in samples))
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b"".join(struct.pack("<h", int(max(-1, min(1, s / peak * 0.9)) * 32767)) for s in samples))


def env(t, attack, decay):
    return min(1.0, t / attack) * math.exp(-t / decay) if attack > 0 else math.exp(-t / decay)


def tone(dur, f0, f1=None, attack=0.003, decay=0.1, wave_fn=math.sin, noise=0.0, seed=1):
    rnd = random.Random(seed)
    f1 = f0 if f1 is None else f1
    out, ph = [], 0.0
    n = int(dur * SR)
    for i in range(n):
        t = i / SR
        f = f0 + (f1 - f0) * (i / n)
        ph += 2 * math.pi * f / SR
        s = wave_fn(ph) * (1 - noise) + (rnd.uniform(-1, 1) * noise)
        out.append(s * env(t, attack, decay))
    return out


def mix(*parts):
    n = max(len(p) for p in parts)
    return [sum(p[i] if i < len(p) else 0 for p in parts) for i in range(n)]


def seq(*parts, gap=0.0):
    out = []
    for p in parts:
        out += p + [0.0] * int(gap * SR)
    return out


def square(ph):
    return 1.0 if math.sin(ph) >= 0 else -1.0


def main():
    os.makedirs(os.path.join(ROOT, "assets", "textures"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "assets", "audio"), exist_ok=True)
    png(os.path.join(ROOT, "assets", "textures", "ring.png"), 128, 128, ring_pixel)

    write_wav("place", mix(tone(0.16, 140, 70, decay=0.05), tone(0.08, 900, 300, decay=0.015, noise=0.6, seed=2)))
    write_wav("pickup", tone(0.09, 520, 820, decay=0.04))
    write_wav("deny", seq(tone(0.07, 180, 160, decay=0.05, wave_fn=square), tone(0.09, 150, 120, decay=0.06, wave_fn=square), gap=0.02))
    write_wav("shot", tone(0.05, 1600, 700, decay=0.012, noise=0.3, seed=3))
    write_wav("boom", mix(tone(0.45, 90, 40, decay=0.15), tone(0.4, 300, 100, decay=0.08, noise=0.9, seed=4)))
    write_wav("pop", tone(0.08, 700, 1300, decay=0.03))
    write_wav("basehit", mix(tone(0.35, 110, 55, decay=0.12, wave_fn=square), tone(0.25, 200, 80, decay=0.07, noise=0.8, seed=5)))
    write_wav("wave", seq(tone(0.14, 392, decay=0.12), tone(0.28, 523, decay=0.2), gap=0.0))
    write_wav("boss", mix(tone(1.1, 65, 55, attack=0.05, decay=0.6, wave_fn=square), tone(1.1, 98, 82, attack=0.05, decay=0.5)))
    write_wav("coin", seq(tone(0.06, 1320, decay=0.04), tone(0.12, 1760, decay=0.07)))
    write_wav("win", seq(tone(0.12, 523, decay=0.1), tone(0.12, 659, decay=0.1), tone(0.12, 784, decay=0.1), tone(0.4, 1047, decay=0.3)))
    write_wav("lose", seq(tone(0.2, 392, decay=0.15), tone(0.2, 330, decay=0.15), tone(0.5, 262, 220, decay=0.35)))


if __name__ == "__main__":
    main()
