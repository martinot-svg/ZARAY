#!/usr/bin/env python3
"""Disposable, password-scrubbed CHR command-line integration smoke.
Never uses production credentials, RouterOS servers, or a public routed network.
"""
import json
import base64
import urllib.request
import urllib.parse
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
 "-netdev","user,id=isolated,restrict=on,hostfwd=tcp:127.0.0.1:18080-:80",
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
     send(conn,"/ip/address/add address=10.0.2.15/24 interface=ether1");change("ip-set")
    elif state=="ip-set" and prompt(recent):
     send(conn,"/ip/service/set www disabled=no");change("www-set")
    elif state=="www-set" and prompt(recent):
     change("probe")
    elif state=="probe":
     if time.monotonic()-phase_start>=2:
      try:
       opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
       auth=base64.b64encode(("admin:"+passwd).encode()).decode("ascii")
       def request_rest(route,body=None):
        url="http://127.0.0.1:18080/rest/"+route
        req=urllib.request.Request(url,
          data=json.dumps(body).encode() if body is not None else None,
          headers={"Authorization":"Basic "+auth,"Content-Type":"application/json"},
          method="POST" if body is not None else "GET")
        with opener.open(req,timeout=3) as reply:
         raw=reply.read(1024*1024+1)
         if len(raw)>1024*1024:raise RuntimeError("REST response exceeds 1MiB")
         return json.loads(raw)
       resource=request_rest("system/resource")
       projections=request_rest("interface?"+urllib.parse.urlencode({".proplist":".id,name,type,running,disabled"}))
       ipaddresses=request_rest("ip/address?"+urllib.parse.urlencode({".proplist":".id,address,interface,disabled"}))
       ping=request_rest("ping",{"address":"127.0.0.1","count":"3"})
       results["resource-rest"]=resource
       results["interfaces-rest"]=projections
       results["address-rest"]=ipaddresses
       results["ping-rest"]=ping
       change("done")
      except Exception as error:
       results["last_rest_error"]=str(error)[:160]
       phase_start=time.monotonic()

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
# A production connector still requires HTTPS and a trusted RouterOS certificate.
# This HTTP smoke is bound to QEMU localhost and inaccessible from the network.
resource=results.get("resource-rest")
interfaces=results.get("interfaces-rest")
addresses=results.get("address-rest")
ping=results.get("ping-rest")
checks={
 "authenticated_console": bool(resource),
 "routeros_resource_rest": isinstance(resource,dict) and "7.24.6" in resource.get("version",""),
 "projected_interface_rest": isinstance(interfaces,list) and any(x.get("name")=="ether1" for x in interfaces),
 "projected_ip_rest": isinstance(addresses,list) and any("10.0.2.15" in x.get("address","") for x in addresses),
 "bounded_ping_rest": isinstance(ping,list) and 1<=len(ping)<=3 and any(
   x.get("host")=="127.0.0.1" or x.get("seq") is not None for x in ping if isinstance(x,dict))
}
# Strip potentially sensitive RouterOS metadata; retain only approved fields.
sanitized={
 "resource":{k:resource.get(k) for k in ("version","board-name","cpu-load","uptime") if k in resource} if isinstance(resource,dict) else {},
 "interface_count":len(interfaces) if isinstance(interfaces,list) else None,
 "interfaces":[{k:v for k,v in x.items() if k in (".id","name","type","running","disabled")}
   for x in interfaces[:4]] if isinstance(interfaces,list) else [],
 "addresses":[{k:v for k,v in x.items() if k in (".id","address","interface","disabled")}
   for x in addresses[:4]] if isinstance(addresses,list) else [],
 "ping":[{k:v for k,v in x.items() if k in ("seq","host","time","ttl","status")}
   for x in ping[:3]] if isinstance(ping,list) else [],
 "last_rest_error":results.get("last_rest_error")
}
evidence={"lab":"RouterOS 7.24.6 CHR with QEMU restrict=on NAT and 127.0.0.1 only HTTP port forward",
 "authentication":"ephemeral admin password; never persisted",
 "transport":"HTTP Basic used ONLY in isolated loopback lab. ZARAY production requires verified HTTPS.",
 "duration_seconds":round(time.monotonic()-start,1),
 "checks":checks,
 "real_rest_confirmed":all(checks.values()),"results":sanitized}
(out/"chr-rest-redacted-console.log").write_text(redact(transcript)[-4500:],encoding="utf-8")
(out/"chr-rest-evidence.json").write_text(json.dumps(evidence,indent=2)+"\n",encoding="utf-8")
print(json.dumps(evidence,indent=2))
if not all(checks.values()):
 raise SystemExit("RouterOS real REST integration checks failed (no parity claimed)")
