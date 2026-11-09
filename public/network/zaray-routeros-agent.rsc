# ZARAY Native RouterOS Engine. Import via /import after generating a per-router file in ZARAY.
# Do not run concurrently with a Node connector paired to the same router.
# Credentials and all RouterOS actions stay on the router. HTTPS certificates MUST be verified.
:local routerId "__ZARAY_ROUTER_ID__";
:local pairCode "__ZARAY_PAIRING_TOKEN__";
:local endpoint "__ZARAY_AGENT_ENDPOINT__";
:if ([:len $routerId] != 36 || [:len $pairCode] != 64) do={ :error "ZARAY: incomplete installation file"; };
:if ([:len [/system script find where name="zaray-native-cycle"]] > 0) do={ :error "ZARAY: native agent already installed"; };
:local body [:serialize to=json value=({"routerId"=$routerId;"action"="claim"}) options=json.no-string-conversion];
:local reply [/tool fetch url=$endpoint http-method=post http-data=$body http-header-field=("Authorization: Bearer " . $pairCode . ",Content-Type: application/json") check-certificate=yes as-value output=user];
:local response [:deserialize from=json value=($reply->"data") options=json.no-string-conversion];
:local token ($response->"connectorSecret");
:if ([:typeof $token] != "str" || !($token ~ "^[a-f0-9]{64}$")) do={ :error "ZARAY: pairing not confirmed"; };
# The credential is persisted in RouterOS configuration, readable by authorized RouterOS admins.
# Keep restricted administrator access and do not export scripts with sensitive values.
/system script add name="zaray-native-credentials" policy=read,write,test,sensitive source=(":global zarayNativeRouterId \"" . $routerId . "\"; :global zarayNativeToken \"" . $token . "\";");
/system script add name="zaray-native-cycle" policy=ftp,read,write,test,sensitive source={
 :if ([/system script job print count-only where script="zaray-native-cycle"] > 1) do={ :error "ZARAY: already running"; };
 :global zarayNativeRouterId;
 :global zarayNativeToken;
 /system script run zaray-native-credentials;
 :local rid $zarayNativeRouterId;
 :local token $zarayNativeToken;
 :if ([:typeof $token] != "str" || !($token ~ "^[a-f0-9]{64}$")) do={ :error "ZARAY: connector key missing"; };
 :local endpoint "__ZARAY_AGENT_ENDPOINT__";
 :local headers ("Authorization: Bearer " . $token . ",Content-Type: application/json");
 # Offline guard runs BEFORE all cloud requests, including when HTTPS is unreachable.
 # A missing/invalid router clock cannot be trusted for a calendar expiration.
 :local nowNs [:tonsec value=[:timestamp]];
 :if ($nowNs < 1704067200000000000) do={
  :log warning "ZARAY: RouterOS clock invalid, offline calendar enforcement paused";
 } else={
  :foreach user in=[/ip hotspot user find where comment~"^zaray:access:"] do={
   :local note [/ip hotspot user get $user comment];
   :if ($note ~ "^zaray:access:[0-9a-f-]{36}:[0-9]{19}$") do={
    :local due [:tonum [:pick $note 50 [:len $note]]];
    :if ($due > 0 && $nowNs >= $due) do={
     :local name [/ip hotspot user get $user name];
     :if ([/ip hotspot user get $user disabled] = false) do={ /ip hotspot user disable $user; };
     :foreach sess in=[/ip hotspot active find where user=$name] do={ /ip hotspot active remove $sess; };
    };
   };
  };
  :foreach user in=[/ppp secret find where comment~"^zaray:access:"] do={
   :local note [/ppp secret get $user comment];
   :if ($note ~ "^zaray:access:[0-9a-f-]{36}:[0-9]{19}$") do={
    :local due [:tonum [:pick $note 50 [:len $note]]];
    :if ($due > 0 && $nowNs >= $due) do={
     :local name [/ppp secret get $user name];
     :if ([/ppp secret get $user disabled] = false) do={ /ppp secret disable $user; };
     :foreach sess in=[/ppp active find where name=$name] do={ /ppp active remove $sess; };
    };
   };
  };
 };
 :local obs [:toarray ""];
 :local kinds [:toarray ""];
 :local sourceStats [:toarray ""];
 :local count 0;
 :do {
  :set kinds ($kinds,"interface");
  :foreach item in=[/interface find] do={
   :if ($count < 12) do={
    :local n [/interface get $item name]; :local typ [/interface get $item type];
    :local run [/interface get $item running]; :local mac "";
    :do { :set mac [/interface get $item mac-address]; } on-error={};
    :set obs ($obs,({"kind"="interface";"key"=$n;"label"=($n . " (" . $typ . ")");"ip"="";"mac"=$mac;"active"=$run}));
    :set count ($count + 1);
   };
  };
  :local reported [:len [/interface find]];
  :set sourceStats ($sourceStats,({"kind"="interface";"reportedCount"=$reported;"collectedCount"=$count;"complete"=($count = $reported)}));
 } on-error={ :log warning "ZARAY: RouterOS interfaces unavailable"; };
 :set count 0;
 :do {
  :set kinds ($kinds,"hotspot");
  :foreach item in=[/ip hotspot active find] do={
   :if ($count < 10) do={
    :set obs ($obs,({"kind"="hotspot";"key"=[:tostr $item];"label"=[/ip hotspot active get $item user];"ip"=[/ip hotspot active get $item address];"mac"=[/ip hotspot active get $item mac-address];"active"=true}));
    :set count ($count + 1);
   };
  };
  :local reported [:len [/ip hotspot active find]];
  :set sourceStats ($sourceStats,({"kind"="hotspot";"reportedCount"=$reported;"collectedCount"=$count;"complete"=($count = $reported)}));
 } on-error={ :log warning "ZARAY: Hotspot discovery unavailable"; };
 :set count 0;
 :do {
  :set kinds ($kinds,"pppoe");
  :foreach item in=[/ppp active find] do={
   :if ($count < 10) do={
    :set obs ($obs,({"kind"="pppoe";"key"=[:tostr $item];"label"=[/ppp active get $item name];"ip"=[/ppp active get $item address];"mac"="";"active"=true}));
    :set count ($count + 1);
   };
  };
  :local reported [:len [/ppp active find]];
  :set sourceStats ($sourceStats,({"kind"="pppoe";"reportedCount"=$reported;"collectedCount"=$count;"complete"=($count = $reported)}));
 } on-error={ :log warning "ZARAY: PPP discovery unavailable"; };
 :if ([:len $kinds] = 0) do={ :error "ZARAY: no RouterOS inventory available"; };
 :local metrics ({"cpuLoad"=[/system resource get cpu-load];"totalMemory"=[/system resource get total-memory];"freeMemory"=[/system resource get free-memory];"uptime"=[:tostr [/system resource get uptime]]});
 :local syncBody [:serialize to=json value=({"routerId"=$rid;"action"="sync";"agentKind"="routeros-native";"model"=[/system resource get board-name];"version"=[/system resource get version];"kinds"=$kinds;"observations"=$obs;"sourceStats"=$sourceStats;"resources"=$metrics}) options=json.no-string-conversion];
 :do {
  /tool fetch url=$endpoint http-method=post http-data=$syncBody http-header-field=$headers check-certificate=yes output=none;
 } on-error={ :log warning "ZARAY: sync failed"; :error "ZARAY: sync failed"; };
 # The owner must explicitly enable RouterOS control in ZARAY after pairing.
 # A native script only claims the actions it implements.
 :local supported {"disconnect_hotspot";"disconnect_ppp";"suspend_account";"resume_account";"provision_voucher";"expire_voucher"};
 :local pollBody [:serialize to=json value=({"routerId"=$rid;"action"="poll";"supportedActions"=$supported}) options=json.no-string-conversion];
 :local fetched;
 :do {
  :set fetched [/tool fetch url=$endpoint http-method=post http-data=$pollBody http-header-field=$headers check-certificate=yes as-value output=user];
 } on-error={ :log warning "ZARAY: poll failed"; :error "ZARAY: poll failed"; };
 :local state [:deserialize from=json value=($fetched->"data") options=json.no-string-conversion];
 :if (($state->"controlEnabled") != true) do={ :return; };
 :foreach cmd in=($state->"commands") do={
  :local id ($cmd->"id"); :local action ($cmd->"action");
  :local protocol ($cmd->"protocol"); :local username ($cmd->"username");
  :local sessionId ($cmd->"sessionId"); :local success false; :local outcome "Unsupported action";
  :do {
   :if ([:typeof $username] != "str" || [:len $username] = 0 || [:len $username] > 128) do={ :error "Invalid username"; };
   :if ($action = "provision_voucher" || $action = "expire_voucher") do={
    :if ($protocol != "hotspot") do={ :error "Voucher protocol mismatch"; };
    :local vid ($cmd->"voucherId");
    :if ([:typeof $vid] != "str" || !($vid ~ "^[0-9a-f-]{36}$")) do={ :error "Invalid voucher"; };
    :local tag ("zaray:voucher:" . $vid);
    :local users [/ip hotspot user find where name=$username];
    :if ([:len $users] > 1) do={ :error "Ambiguous hotspot user"; };
    :if ([:len $users] = 1) do={
     :if ([/ip hotspot user get $users comment] != $tag) do={ :error "Unmanaged hotspot user"; };
    };
    :if ($action = "provision_voucher") do={
     :local password ($cmd->"password"); :local scheme ($cmd->"credentialScheme");
     :local duration [:tonum ($cmd->"durationMinutes")]; :local maxDevices [:tonum ($cmd->"maxDevices")];
     :if ([:typeof $password] != "str" || [:typeof $duration] != "num" || $duration < 1 || $duration > 525600 || [:typeof $maxDevices] != "num" || $maxDevices < 1 || $maxDevices > 100) do={ :error "Invalid voucher limits"; };
     :if ($scheme = "hmac-v1") do={
      :if (!($password ~ "^[A-Z0-9]{3,32}$")) do={ :error "Invalid voucher password"; };
     } else={
      :if ($scheme != "hmac-numeric-v2" || !($password ~ "^[0-9]{3,5}$")) do={ :error "Invalid voucher password"; };
     };
     :local profile ("zaray-vouchers-" . $maxDevices);
     :local profiles [/ip hotspot user profile find where name=$profile];
     :if ([:len $profiles] > 1) do={ :error "Ambiguous voucher profile"; };
     :if ([:len $profiles] = 0) do={
      /ip hotspot user profile add name=$profile shared-users=$maxDevices add-mac-cookie=no comment="zaray:managed-hotspot-profile";
     } else={
      :if ([/ip hotspot user profile get $profiles comment] != "zaray:managed-hotspot-profile") do={ :error "Unmanaged profile"; };
      :if ([:tonum [/ip hotspot user profile get $profiles shared-users]] != $maxDevices) do={ :error "Conflicting profile device limit"; };
     };
     :local limit ($duration . "m");
     :if ([:len $users] = 0) do={
      /ip hotspot user add name=$username password=$password disabled=no profile=$profile limit-uptime=$limit comment=$tag;
     } else={
      /ip hotspot user set $users password=$password profile=$profile limit-uptime=$limit disabled=no;
     };
     :local current [/ip hotspot user find where name=$username];
     :if ([:len $current] != 1 || [/ip hotspot user get $current disabled] != false || [/ip hotspot user get $current comment] != $tag || [/ip hotspot user get $current profile] != $profile) do={ :error "Voucher not confirmed"; };
     :set success true; :set outcome "ZARAY voucher provisioned";
    };
    :if ($action = "expire_voucher") do={
     :if ([:len $users] = 1) do={
      /ip hotspot user disable $users;
      :if ([/ip hotspot user get $users disabled] != true) do={ :error "Voucher expiry not confirmed"; };
      :foreach item in=[/ip hotspot active find where user=$username] do={ /ip hotspot active remove $item; };
     };
     :set success true; :set outcome "ZARAY voucher expired";
    };
   };
   # Paid entitlement timestamp is a signed, tenant-checked instruction from ZARAY.
   # Only blank or already-owned comments can be claimed; never overwrite a third-party marker.
   :if ($action = "resume_account") do={
    :local accountId ($cmd->"accountId");
    :local expiresNs ($cmd->"deadlineEpochNs");
    :if ([:typeof $accountId] != "str" || !($accountId ~ "^[0-9a-f-]{36}$") ||
       [:typeof $expiresNs] != "str" || !($expiresNs ~ "^[0-9]{19}$")) do={ :error "Missing validated offline entitlement"; };
    :local epochDeadline [:tonum $expiresNs];
    :local current [:tonsec value=[:timestamp]];
    :if ($current < 1704067200000000000 || $epochDeadline <= $current) do={ :error "Clock invalid or entitlement expired"; };
    :local expectedPrefix ("zaray:access:" . $accountId . ":");
    :local note "";
    :if ($protocol = "hotspot") do={
     :local users [/ip hotspot user find where name=$username];
     :if ([:len $users] != 1) do={ :error "Missing or ambiguous Hotspot account"; };
     :set note [/ip hotspot user get $users comment];
     :if ([:len $note] > 0 && [:pick $note 0 [:len $expectedPrefix]] != $expectedPrefix) do={ :error "Unmanaged Hotspot comment"; };
     /ip hotspot user set $users comment=($expectedPrefix . $expiresNs);
    } else={
     :if ($protocol != "pppoe") do={ :error "Unsupported entitlement protocol"; };
     :local users [/ppp secret find where name=$username];
     :if ([:len $users] != 1) do={ :error "Missing or ambiguous PPP account"; };
     :set note [/ppp secret get $users comment];
     :if ([:len $note] > 0 && [:pick $note 0 [:len $expectedPrefix]] != $expectedPrefix) do={ :error "Unmanaged PPP comment"; };
     /ppp secret set $users comment=($expectedPrefix . $expiresNs);
    };
   };
   # Bandwidth is applied ONLY to profiles ZARAY already owns.
   # Never replace a custom MikroTik profile, which could contain unrelated policies.
   :if ($action = "resume_account") do={
    :local up ($cmd->"uploadKbps"); :local down ($cmd->"downloadKbps");
    :if ([:typeof $up] != "nil" || [:typeof $down] != "nil") do={
     :set up [:tonum $up]; :set down [:tonum $down];
     :if ([:typeof $up] != "num" || [:typeof $down] != "num" ||
          $up < 64 || $down < 64 || $up > 10000000 || $down > 10000000) do={ :error "Invalid speed limit"; };
     :local newName ("zaray-speed-" . $up . "k-" . $down . "k");
     :local limit ($up . "k/" . $down . "k");
     :if ($protocol = "hotspot") do={
      :local user [/ip hotspot user find where name=$username];
      :local current [/ip hotspot user get $user profile];
      :local currentProfile [/ip hotspot user profile find where name=$current];
      :if ([:len $currentProfile] != 1 || !([/ip hotspot user profile get $currentProfile comment] = "zaray:managed-bandwidth")) do={
       :error "Hotspot profile not managed by ZARAY; speed unchanged";
      };
      :local target [/ip hotspot user profile find where name=$newName];
      :if ([:len $target] > 1) do={ :error "Ambiguous bandwidth profile"; };
      :if ([:len $target] = 0) do={
       /ip hotspot user profile add name=$newName rate-limit=$limit comment="zaray:managed-bandwidth";
      } else={
       :if ([/ip hotspot user profile get $target comment] != "zaray:managed-bandwidth" ||
            [/ip hotspot user profile get $target rate-limit] != $limit) do={ :error "Conflicting Hotspot speed profile"; };
      };
      /ip hotspot user set $user profile=$newName;
     };
     :if ($protocol = "pppoe") do={
      :local user [/ppp secret find where name=$username];
      :local current [/ppp secret get $user profile];
      :local currentProfile [/ppp profile find where name=$current];
      :if ([:len $currentProfile] != 1 || [/ppp profile get $currentProfile comment] != "zaray:managed-bandwidth") do={
       :error "PPP profile not managed by ZARAY; speed unchanged";
      };
      :local target [/ppp profile find where name=$newName];
      :if ([:len $target] > 1) do={ :error "Ambiguous PPP bandwidth profile"; };
      :if ([:len $target] = 0) do={
       /ppp profile add name=$newName rate-limit=$limit comment="zaray:managed-bandwidth";
      } else={
       :if ([/ppp profile get $target comment] != "zaray:managed-bandwidth" ||
            [/ppp profile get $target rate-limit] != $limit) do={ :error "Conflicting PPP speed profile"; };
      };
      /ppp secret set $user profile=$newName;
     };
    };
   };
   :if ($protocol = "hotspot" && ($action = "suspend_account" || $action = "resume_account")) do={
    :local users [/ip hotspot user find where name=$username];
    :if ([:len $users] != 1) do={ :error "Missing or ambiguous hotspot account"; };
    :if ($action = "suspend_account") do={ /ip hotspot user disable $users; } else={ /ip hotspot user enable $users; };
    :if ([/ip hotspot user get $users disabled] != ($action = "suspend_account")) do={ :error "Hotspot state not confirmed"; };
    :set success true; :set outcome "Hotspot account state confirmed";
   };
   :if ($protocol = "pppoe" && ($action = "suspend_account" || $action = "resume_account")) do={
    :local users [/ppp secret find where name=$username];
    :if ([:len $users] != 1) do={ :error "Missing or ambiguous PPP account"; };
    :if ($action = "suspend_account") do={ /ppp secret disable $users; } else={ /ppp secret enable $users; };
    :if ([/ppp secret get $users disabled] != ($action = "suspend_account")) do={ :error "PPP state not confirmed"; };
    :set success true; :set outcome "PPP account state confirmed";
   };
   :if ($protocol = "hotspot" && ($action = "suspend_account" || $action = "disconnect_hotspot")) do={
    :foreach item in=[/ip hotspot active find where user=$username] do={
     :if ([:typeof $sessionId] = "nil" || $sessionId = "" || [:tostr $item] = $sessionId) do={ /ip hotspot active remove $item; };
    };
    :foreach remaining in=[/ip hotspot active find where user=$username] do={
     :if ([:typeof $sessionId] = "nil" || $sessionId = "" || [:tostr $remaining] = $sessionId) do={ :error "Hotspot session still active"; };
    };
    :set success true; :set outcome "Hotspot session removal confirmed";
   };
   :if ($protocol = "pppoe" && ($action = "suspend_account" || $action = "disconnect_ppp")) do={
    :foreach item in=[/ppp active find where name=$username] do={
     :if ([:typeof $sessionId] = "nil" || $sessionId = "" || [:tostr $item] = $sessionId) do={ /ppp active remove $item; };
    };
    :foreach remaining in=[/ppp active find where name=$username] do={
     :if ([:typeof $sessionId] = "nil" || $sessionId = "" || [:tostr $remaining] = $sessionId) do={ :error "PPP session still active"; };
    };
    :set success true; :set outcome "PPP session removal confirmed";
   };
  } on-error={ :set success false; :set outcome "RouterOS execution not confirmed"; };
  :local resultBody [:serialize to=json value=({"routerId"=$rid;"action"="result";"commandId"=$id;"ok"=$success;"outcome"=$outcome}) options=json.no-string-conversion];
  :do {
   /tool fetch url=$endpoint http-method=post http-data=$resultBody http-header-field=$headers check-certificate=yes output=none;
  } on-error={ :log warning "ZARAY: network command result not acknowledged"; };
 };
};
/system scheduler add name="zaray-native-minute" interval=1m start-time=startup on-event="zaray-native-cycle" policy=ftp,read,write,test,sensitive disabled=no;
:log info "ZARAY: RouterOS native agent installed (network control remains disabled in ZARAY)";
