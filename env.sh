# configurations, you can change them

# port to run HSN backend
export HSN_BACKEND_PORT=5000
# port to run phira-mp-server
export HSN_PHIRA_MP_PORT=8080
# directory to store log files
export HSN_LOGDIR="$PWD/logs"
# directory to store temporary files
export HSN_WORKDIR="$PWD/work"
# secret key used in backend
export HSN_SECRET_KEY="super-secret-key"
# password of root user
export HSN_ROOT_PASSWORD="super-secret-password"
# pipe to communicate with log processor
export HSN_LOG_PROCESSOR_PIPE="$HSN_WORKDIR/logprocessor.pipe"
# enable strict registration
export HSN_STRICT_REGISTRATION=1
