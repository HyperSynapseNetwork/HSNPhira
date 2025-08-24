#!/usr/bin/env bash

# configurations, you can change them
export HSN_BACKEND_PORT=5000
export HSN_PHIRA_MP_PORT=8080
export HSN_LOGDIR="$PWD/logs"
export HSN_WORKDIR="$PWD/work"
export HSN_SECRET_KEY="super-secret-key"
export HSN_ROOT_PASSWORD="super-secret-password"
export HSN_LOG_PROCESSOR_PIPE="$HSN_WORKDIR/logprocessor.pipe"

# in strict mode
set -euo pipefail
trap 'error "at line $LINENO, exit code $?" >&2' ERR

# logging functions
message() {
	printf "\e[32m[message]\e[39m %s\n" "$1"
}
warning() {
	printf "\e[33m[warning]\e[39m %s\n" "$1"
}
error() {
	printf "\e[31m[error]\e[39m %s\n" "$1"
}

# monitor child process
monitor() {
	local name="$1"; shift
	local func="$*"
	local child

	set -euo pipefail
	trap 'kill "$child" || true; wait; message "$name: terminated"; exit 0' SIGINT SIGTERM
	trap 'kill "$child" || true; wait; error "$name: error at line $LINENO, exit code $?" >&2' ERR
	export -f "$func"

	while true; do
		setsid bash -c "$func" &
		child=$!
		message "$name: started, pid=$child"

		if wait $child; then rc=0; else rc=$?; fi
		child=""

		if [ "$rc" -eq 0 ]; then
			message "$name: exited normally"
			break
		fi
		message "$name: exited with code $rc"
		message "$name: trying to restart in 5 seconds..."
		sleep 5	
	done
}

# setup directories
rm -f -R "$HSN_LOGDIR" "$HSN_WORKDIR"
mkdir -p "$HSN_LOGDIR" "$HSN_WORKDIR"

# run
start_phira_mp() {
	export RUST_LOG=debug
	exec phira-mp/target/release/phira-mp-server --port="$HSN_PHIRA_MP_PORT"
}
start_backend() {
	cd ./backend
	exec uv run main.py --port="$HSN_BACKEND_PORT"
}
start_log_processor() {
	cd ./phira-mp-logprocessor
	mkfifo "$HSN_LOG_PROCESSOR_PIPE"
	exec yarn start --logdir="$HSN_LOGDIR" > "$HSN_LOG_PROCESSOR_PIPE"
}
add_monitor() {
	local name="$1"
	local func="$2"
	monitor "$name" "$func" &
	pid=$!
	message "started monitor for $name (monitor pid: $pid)"
}

trap 'message "waiting for children..."; wait; message "exited."; exit 0' SIGINT SIGTERM

add_monitor phira-mp start_phira_mp
add_monitor backend start_backend
add_monitor log-processor start_log_processor
wait
message "exited"
