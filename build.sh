#!/usr/bin/env bash

# in strict mode
set -euo pipefail
trap 'error "error at line $LINENO, exit code $?" >&2' ERR

PROJECT_ROOT=$(pwd)

message() {
	printf "\e[32m[message]\e[39m %s\n" "$1"
}
warning() {
	printf "\e[33m[warning]\e[39m %s\n" "$1"
}
error() {
	printf "\e[31m[error]\e[39m %s\n" "$1"
}

check() {
	# check for uv
	if ! command -v uv &> /dev/null; then
		warning "uv is not installed"
		message "trying to install uv..."
		curl -LsSf https://astral.sh/uv/install.sh | sh
		export UV_DEFAULT_INDEX="https://pypi.tuna.tsinghua.edu.cn/simple"
	fi
	uv --version
	message "uv is installed"

	# check for cargo
	if ! command -v cargo &> /dev/null; then
		warning "rust is not installed"
		message "trying to install rust..."
		curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
		. "$HOME/.cargo/env"
	fi
	cargo --version
	message "rust is installed"

	# check for nodejs
	if ! command -v node &> /dev/null; then
		warning "nodejs is not installed"
		message "trying to install nodejs..."
		curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
		\. "$HOME/.nvm/nvm.sh"
		nvm install 22
	fi
	node -v
	message "node is installed"

	# check for yarn
	if ! command -v yarn &> /dev/null; then
		warning "yarn is not installed"
		message "trying to install yarn..."
		npm install -g corepack
	fi
	yarn -v
	message "yarn is installed"
}

build_backend() {
	cd "$PROJECT_ROOT/backend"
	message "preparing for backend..."
	uv sync
	read -p "Do you want to initialize the database? This would drop all existing data. (y/N) " res
	if [ "$res" == "y" ]; then
		message "initializing the database..."
		uv run flask init-db
	fi
	message "backend is ready"
}

build_phira_mp() {
	cd "$PROJECT_ROOT/phira-mp"
	message "preparing for phira-mp..."
	cargo build --release -p phira-mp-server
	message "phira-mp is ready"
}

build_log_processor() {
	cd "$PROJECT_ROOT/phira-mp-logprocessor"
	message "preparing for phira-mp-logprocessor..."
	yarn install
	message "phira-mp-logprocessor is ready"
}

check
build_backend
build_phira_mp
build_log_processor
