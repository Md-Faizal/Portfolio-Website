#!/usr/bin/env bash

set -u

IPC_DIR="${IPC_DIR:-/home/ubuntu/stack/ops/ipc}"
mkdir -p "$IPC_DIR"

while true; do
  for req in "$IPC_DIR"/*.req; do
    [[ -f "$req" ]] || continue

    read -r control_type action service < "$req"
    response="${req%.req}.res"
    output=''
    exit_code=1

    if [[ "$control_type" == remote-docker && "$action" =~ ^(status|start|stop|restart)$ ]]; then
      ssh_options=(-F /home/ubuntu/.ssh/config
        -o BatchMode=yes \
        -o ConnectTimeout=5 \
        -o StrictHostKeyChecking=yes \
        -o UserKnownHostsFile=/home/ubuntu/.ssh/known_hosts \
        -o IdentitiesOnly=yes)
      if [[ "$service" == "bloomberg-terminal" ]]; then
        if [[ "$action" == status ]]; then
          output=$(ssh "${ssh_options[@]}" container-of-souls \
            bash /home/ubuntu/stack/apps/bloomberg-terminal/deploy/cos-blue-green.sh \
            status 2>&1)
          exit_code=$?
          if [[ "$exit_code" -eq 0 ]]; then
            output="$(tail -n 1 <<< "$output")"
          fi
        else
          output=$(ssh "${ssh_options[@]}" container-of-souls \
            bash /home/ubuntu/stack/apps/bloomberg-terminal/deploy/cos-blue-green.sh \
            "$action" 2>&1)
          exit_code=$?
        fi
      elif [[ "$service" =~ ^(bedrock-server|minecraft|mc-manager|stalwart-mail|stalwart-mail-standby|macos-server-green|personal-site-rust)$ ]]; then
        target_container="$service"
        if [[ "$service" == "mc-manager" ]]; then
          target_container="minecraft"
        fi
        output=$(ssh "${ssh_options[@]}" container-of-souls "docker $action $target_container 2>&1 || docker $action $service 2>&1 || docker $action bedrock-server 2>&1")
        exit_code=$?
      else
        output="Unsupported remote-docker service '$service'"
      fi
    elif [[ "$action" =~ ^(start|stop|restart)$ ]]; then
      if [[ "$control_type" == systemctl && "$service" =~ ^(cs-panel|nginx|nexus-backend)$ ]]; then
        output=$(systemctl "$action" "${service}.service" 2>&1)
        exit_code=$?
      elif [[ "$control_type" == docker && "$service" =~ ^(stalwart-mail|macos-server-blue|personal-site-rust)$ ]]; then
        output=$(docker "$action" "$service" 2>&1)
        exit_code=$?
      else
        output="Invalid control type '$control_type' or service '$service'"
      fi
    else
      output="Invalid action '$action'"
    fi

    temp_response="${response}.tmp.$$"
    printf 'EXIT:%s\nOUTPUT:%s\n' "$exit_code" "$output" > "$temp_response"
    mv "$temp_response" "$response"
    rm -f "$req"
  done
  sleep 0.5
done
