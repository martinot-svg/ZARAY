#!/usr/bin/env python3
"""Run the *shipping* native RouterOS observation and ping snippets against CHR.
Disposable QEMU user-mode NAT loopback HTTP ONLY: never invoke on live routers.
A separate CHR script configured an ephemeral admin password and bound port
18080 to 127.0.0.1. No secrets or full configs are written to evidence.
"""
import base64
import json
import os
from pathlib import Path
import urllib.request

password=os.environ.get("CHR_LAB_PASSWORD")
evidence=Path(os.environ.get("CHR_NATIVE_EVIDENCE_PATH",""))
if not password or not os.environ.get("CHR_NATIVE_EVIDENCE_PATH"):
 raise SystemExit("Disposable CHR lab credentials/evidence path absent")
source=Path("public/network/zaray-routeros-agent.rsc").read_text(encoding="utf-8")
start="# BEGIN ZARAY NATIVE READ-ONLY NETWORK DISCOVERY"
stop="# END ZARAY NATIVE READ-ONLY NETWORK DISCOVERY"
assert source.count(start)==1 and source.count(stop)==1
inventory=source.split(start,1)[1].split(stop,1)[0]
assert len(inventory)<40000
assert "/system script" not in inventory and "password" not in inventory.lower()

prefix=':local obs [:toarray ""]; :local kinds [:toarray ""]; :local sourceStats [:toarray ""]; :local count 0;\n'
suffix='\n:put ("ZARAY_NATIVE_INVENTORY=" . [:serialize to=json value=({"observations"=$obs;"kinds"=$kinds;"sources"=$sourceStats}) options=json.no-string-conversion]);'
ping_begin='     :local packets [/ping address=$target count=3 as-value];'
ping_stop='    } on-error={ :set success false;'
assert source.count(ping_begin)==1 and source.count(ping_stop)==1
ping_section=source.split(ping_begin,1)[1].split(ping_stop,1)[0]
ping=':local target "127.0.0.1"; :local samples [:toarray ""]; :local success false; :local failure ""; :do {\n'+ping_begin+ping_section+\
 '\n} on-error={ :set success false; :set samples [:toarray ""]; };\n:put ("ZARAY_NATIVE_PING=" . [:serialize to=json value=({"samples"=$samples;"success"=$success}) options=json.no-string-conversion]);'

opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
authorization="Basic "+base64.b64encode(("admin:"+password).encode()).decode()
def run_execute(script,marker):
 payload=json.dumps({"script":script,"as-string":""}).encode()
 req=urllib.request.Request("http://127.0.0.1:18080/rest/execute",data=payload,
  method="POST",headers={"Authorization":authorization,"Content-Type":"application/json"})
 with opener.open(req,timeout=24) as reply:
  raw=reply.read(1024*1024+1)
 if len(raw)>1024*1024:raise RuntimeError("RouterOS execution output too large")
 data=json.loads(raw)
 output=data.get("ret","") if isinstance(data,dict) else str(data)
 index=output.find(marker)
 if index<0:raise RuntimeError("RouterOS did not print "+marker+"; output="+output[:240])
 serialized=output[index+len(marker):].splitlines()[0].strip()
 return json.loads(serialized)

inv=run_execute(prefix+inventory+suffix,"ZARAY_NATIVE_INVENTORY=")
expected=["ip-address","vlan","bridge","dhcp","dhcp-server","dhcp-client","arp",
          "route","firewall-filter","firewall-nat","queue","dns-static"]
kinds=inv.get("kinds",[])
observations=inv.get("observations",[])
sources=inv.get("sources",[])
if not isinstance(kinds,list) or not isinstance(observations,list) or not isinstance(sources,list):
 # Print only shapes and known module names. Never print raw inventory secrets.
 details={
  "kinds_type":type(kinds).__name__,
  "kinds_preview":str(kinds)[:150],
  "observations_type":type(observations).__name__,
  "observations_count":len(observations) if isinstance(observations,(list,dict,str)) else None,
  "sources_type":type(sources).__name__,
  "sources_count":len(sources) if isinstance(sources,(list,dict,str)) else None,
  "returned_keys":list(inv.keys())[:8]
 }
 raise RuntimeError("RouterOS native inventory shape mismatch: "+json.dumps(details))
if any(k not in kinds for k in expected):
 raise RuntimeError("Native inventory missing sources: "+repr(set(expected)-set(kinds)))
if not any(o.get("kind")=="ip-address" and "10.0.2.15" in o.get("label","") for o in observations):
 raise RuntimeError("CHR's configured IPv4 address was not collected by native agent")
if any(any(secret in str(o).lower() for secret in ["password","private-key","preshared-key"])
       for o in observations):
 raise RuntimeError("Secrets unexpectedly present in native inventory")
for row in observations:
 if row.get("kind") not in expected or not row.get("key"):raise RuntimeError("Invalid RouterOS kind/key")
 if len(row.get("props",{}))>12:raise RuntimeError("Native property cap exceeded")
for row in sources:
 if row.get("collectedCount",0)>6:raise RuntimeError("Native source over 6 records")
 if row.get("complete") and row.get("reportedCount")!=row.get("collectedCount"):
  raise RuntimeError("Native source completeness falsely claimed")

ping_output=run_execute(ping,"ZARAY_NATIVE_PING=")
samples=ping_output.get("samples",[])
if ping_output.get("success") is not True or len(samples)!=3:
 raise RuntimeError("Native RouterOS 3-packet Ping did not complete")
if [s.get("seq") for s in samples]!=["0","1","2"]:
 raise RuntimeError("Native ping sequence mismatch")
if not all(s.get("status")=="received" and s.get("time") for s in samples):
 raise RuntimeError("Native RouterOS localhost ping did not receive three replies")
safe={
 "routeros":"CHR 7.24.6",
 "network":"QEMU NAT restrict=on, HTTP port bound to localhost",
 "native_source_count":len(kinds),
 "native_observation_count":len(observations),
 "native_ip_address_seen":True,
 "ping_count":len(samples),
 "ping_received":sum(1 for s in samples if s["status"]=="received"),
 "native_script_executed":True,
}
evidence.write_text(json.dumps(safe,indent=2)+"\n",encoding="utf-8")
print(json.dumps(safe))
