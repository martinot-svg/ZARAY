#!/usr/bin/env python3
"""Disposable, password-scrubbed CHR command-line integration smoke.
Never uses production credentials, RouterOS servers, or a public routed network.
"""
import json
import os
import pathlib
import re
import secrets
import select
import socket
import subprocess
import sys
import time

disk=pathlib.Path(sys.argv[1]).resolve()
out=pathlib.Path(sys.argv[2]).resolve()
out.mkdir(exist_ok=True,parents=True)
serial_path="/tmp/zaray-chr-console.sock"
if os.path.exists(serial_path):os.unlink(serial_path)
qemu_cmd=[
 "qemu-system-x86_64","-accel","tcg","-machine","pc","-cpu","qemu64",
 "-smp","1","-m","1024","-snapshot","-no-reboot",
 "-drive",f"file={disk},if=virtio,format=raw",
 "-device","virtio-net-pci,netdev=isolated",
 "-netdev","user,id=isolated,restrict=on",
 "-vga","std","-display","none",
 "-serial",f"unix:{serial_path},server=on,wait=off",
 "-monitor","none"
]
passwd="Lab"+secrets.token_hex(12)+"A7"
start=time.monotonic()
state="login"
recent=""
transcript=""
results={}
actions=[]
phase_start=time.monotonic()
rx=re.compile(r"\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*(?:\x07|\x1b\\))")
def clean(value):
 return rx.sub("",value).replace("\r","").replace("\x00","")
def send(conn,value):
 conn.sendall((value+"\r").encode())
 actions.append("ENTER" if value=="" else "lab-password" if value==passwd else value)
def change(value):
 global state,recent,phase_start
 state=value;recent="";phase_start=time.monotonic()
def prompt(value):
 return bool(re.search(r"\[[^\]\n]{1,90}@[A-Za-z0-9_.-]{1,90}\]\s*>\s*$",value))
with (out/"qemu.log").open("wb") as log:
 proc=subprocess.Popen(qemu_cmd,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT)
 try:
  conn=None
  for i in range(100):
   if proc.poll() is not None:raise RuntimeError("CHR QEMU exited before serial socket")
   if os.path.exists(serial_path):
    try:
     conn=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
     conn.connect(serial_path)
     conn.setblocking(False)
     break
    except OSError:
     if conn:conn.close()
   time.sleep(.15)
  if conn is None:raise RuntimeError("CHR serial console socket unavailable")
  with conn:
   while time.monotonic()-start<190 and state!="done":
    if proc.poll() is not None:break
    readable,_,_=select.select([conn],[],[],0.8)
    if readable:
     try:chunk=conn.recv(8192)
     except BlockingIOError:chunk=b""
     if chunk:
      decoded=clean(chunk.decode("utf-8",errors="replace"))
      transcript+=decoded
      recent+=decoded
      transcript=transcript[-32000:]
      recent=recent[-16000:]
    low=recent.lower()
    if state=="login" and "login:" in low:
     send(conn,"admin");change("password")
    elif state=="password" and "password:" in low:
     send(conn,"");change("initial")
    elif state in ("initial","new-password"):
     if re.search(r"(new password|password change[:?]|set new password)",low):
      send(conn,passwd);change("confirm-password")
     elif re.search(r"(license|terms).{0,80}\[y/n\]",low):
      send(conn,"n");change("initial")
     elif prompt(recent):
      send(conn,"/system/resource/print without-paging");change("resource")
     elif state=="initial" and time.monotonic()-phase_start>15:
      send(conn,"");phase_start=time.monotonic()
    elif state=="confirm-password":
     if re.search(r"(confirm|repeat|again|retype).{0,20}password",low):
      send(conn,passwd);change("authenticated")
     elif prompt(recent):
      send(conn,"/system/resource/print without-paging");change("resource")
    elif state=="authenticated" and prompt(recent):
     send(conn,"/system/resource/print without-paging");change("resource")
    elif state=="resource" and prompt(recent) and re.search(r"(?i)version:\s*7\.24\.6",recent):
     results["resource"]=recent
     send(conn,"/interface/print without-paging");change("interfaces")
    elif state=="interfaces" and prompt(recent) and "ether1" in recent:
     results["interfaces"]=recent
     send(conn,"/ping 127.0.0.1 count=3");change("ping")
    elif state=="ping" and prompt(recent) and re.search(r"(?i)(sent=3|packet-loss|seq=)",recent):
     results["ping"]=recent
     change("done")
    if time.monotonic()-phase_start>80 and state!="done":
     break
 finally:
  if proc.poll() is None:
   proc.terminate()
   try:proc.wait(timeout=6)
   except subprocess.TimeoutExpired:proc.kill();proc.wait(timeout=5)
def redact(value):
 return clean(value).replace(passwd,"[REDACTED LAB CREDENTIAL]")
clean_results={k:redact(v)[-5000:] for k,v in results.items()}
(out/"chr-console-redacted.log").write_text(redact(transcript),encoding="utf-8")
checks={
 "login_and_password_initialization":bool(results),
 "resource_version_confirmed":bool(re.search(r"7\.24\.6",clean_results.get("resource",""))),
 "interface_table_read":bool(re.search(r"(?i)ether1|interface",clean_results.get("interfaces",""))),
 "three_packet_ping_attempt":bool(re.search(r"(?i)sent|received|seq|127\.0\.0\.1",clean_results.get("ping","")))
}
evidence={
 "lab":"official RouterOS CHR 7.24.6, QEMU TCG, private NAT restrict=on",
 "ephemeral_admin_password_redacted":True,
 "duration_s":round(time.monotonic()-start,1),
 "last_state":state,"commands_sent":["/system/resource/print without-paging","/interface/print without-paging","/ping 127.0.0.1 count=3"],
 "checks":checks,"authenticated_test":all(checks.values()),
 "samples":clean_results
}
(out/"chr-console-evidence.json").write_text(json.dumps(evidence,indent=2)+"\n",encoding="utf-8")
print(json.dumps({k:v for k,v in evidence.items() if k!="samples"},indent=2))
print("Sanitized console tail:",redact(transcript)[-850:])
if not all(checks.values()):
 raise SystemExit("CHR CLI comparison environment needs repair: not all real RouterOS commands were confirmed")
