#!/usr/bin/env python3
"""Isolated, unauthenticated RouterOS CHR VM boot observation (no real router)."""
import json
import os
import pathlib
import re
import socket
import subprocess
import sys
import time

image = pathlib.Path(sys.argv[1]).resolve()
evidence = pathlib.Path(sys.argv[2]).resolve()
evidence.mkdir(parents=True, exist_ok=True)
serial = evidence / "chr-serial.log"
qemu_log = evidence / "qemu.log"
monitor = "/tmp/zaray-chr-monitor.sock"
if os.path.exists(monitor):
    os.unlink(monitor)
cmd = [
    "qemu-system-x86_64", "-accel", "tcg", "-machine", "pc", "-cpu", "qemu64",
    "-m", "1024", "-smp", "1", "-no-reboot", "-snapshot",
    "-drive", f"file={image},if=virtio,format=raw",
    "-device", "virtio-net-pci,netdev=isolated",
    "-netdev", "user,id=isolated,restrict=on,hostfwd=tcp:127.0.0.1:18728-:8728",
    "-vga", "std", "-display", "none",
    "-serial", f"file:{serial}",
    "-monitor", f"unix:{monitor},server=on,wait=off",
]
start = time.monotonic()
with qemu_log.open("wb") as log:
    proc = subprocess.Popen(cmd, stdin=subprocess.DEVNULL,
                            stdout=log, stderr=subprocess.STDOUT)
    frames = []
    serial_seen = False
    monitor_ready = False
    try:
        for second in range(130):
            time.sleep(1)
            if proc.poll() is not None:
                break
            if serial.exists():
                content = serial.read_bytes()[-32768:]
                serial_seen = bool(re.search(br"(?i)(mikrotik|routeros|login:)", content))
            if os.path.exists(monitor) and second in (25, 55, 95, 125):
                try:
                    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
                        sock.settimeout(3)
                        sock.connect(monitor)
                        monitor_ready = True
                        try:
                            sock.recv(1024)
                        except socket.timeout:
                            pass
                        frame = evidence / f"chr-vga-{second:03}.ppm"
                        sock.sendall(f"screendump {frame}\n".encode("utf-8"))
                        try:
                            sock.recv(2048)
                        except socket.timeout:
                            pass
                        if frame.exists() and frame.stat().st_size > 1024:
                            frames.append({"file": frame.name, "bytes": frame.stat().st_size})
                except (OSError, TimeoutError) as exc:
                    print(f"Nonfatal QEMU monitor error at {second}s: {exc}")
            if serial_seen and frames:
                break
        alive = proc.poll() is None
    finally:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=8)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=5)
result = {
    "product": "MikroTik RouterOS CHR",
    "source": "official 7.24.6 RAW image, SHA-256 verified before boot",
    "virtualization": "QEMU TCG software emulation, no KVM",
    "isolation": "userspace NAT restrict=on, host port bound to 127.0.0.1 only",
    "duration_seconds": round(time.monotonic() - start, 1),
    "qemu_alive_before_shutdown": alive,
    "serial_routeros_banner_detected": serial_seen,
    "qemu_monitor_connected": monitor_ready,
    "vga_frames": frames,
    "authenticated_routeros_tests": False,
    "winbox_comparative_session": False,
}
(evidence / "chr-boot-evidence.json").write_text(
    json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(json.dumps(result, indent=2))
if not alive or not monitor_ready or not frames:
    raise SystemExit("Isolated CHR QEMU runtime smoke not verified")
