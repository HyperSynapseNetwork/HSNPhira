#!/usr/bin/env python3
import subprocess
import shlex
from flask import Flask, request, jsonify

# ================== 全局配置区 ================== (根据需要修改以下配置)
# 三重密码设置
PASSWORDS = ["nb3502022", "2022350", "nb3502022outlookcom"]

# 命令白名单 (格式: {'命令别名': '实际命令', ...})
COMMAND_WHITELIST = {
    "start": "bash /root/start.sh",              # 示例命令1: 删除当前目录所有文件
    "restart": "bash /root/restart.sh",             # 示例命令2: 查看磁盘空间
    "stop": "bash /root/stop.sh",        # 示例命令3: 列出home目录
    "serverinfo": "uname -a",         # 示例命令4: 查看系统信息
    # 在此添加新命令...
}

# 允许执行任意命令的开关 (True/False)
ALLOW_CUSTOM_COMMANDS = True

# 自定义命令别名 (用于触发自定义命令执行)
CUSTOM_COMMAND_ALIAS = "custom"

# 危险命令黑名单 (不允许执行这些命令)
DANGEROUS_COMMAND_BLACKLIST = [
    "rm -rf /", "rm -rf /*", "dd if=/dev/", 
    "mkfs", "mkfss", "fdisk", "shutdown", "halt", "poweroff", 
    "reboot", "init 0", "mv / /dev/null", "chmod -R 000 /"
]

# Flask配置
LISTEN_IP = '0.0.0.0'  # 监听地址 (0.0.0.0表示监听所有接口)
LISTEN_PORT = 7878      # 监听端口
# ================================================

app = Flask(__name__)

def verify_passwords(passwords):
    """验证密码正确性"""
    return bool(passwords) and passwords == PASSWORDS

def is_dangerous_command(command):
    """检查是否危险命令"""
    return any(black_cmd in command for black_cmd in DANGEROUS_COMMAND_BLACKLIST)

def execute_command(command):
    """执行命令并返回结果"""
    try:
        # 使用shlex.split确保安全处理命令参数
        process = subprocess.Popen(
            shlex.split(command),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        stdout, stderr = process.communicate()
        returncode = process.returncode
        
        if returncode != 0:
            return False, f"Command failed (exit {returncode}): {stderr.strip()}"
        
        return True, stdout.strip()
    
    except Exception as e:
        return False, str(e)

def execute_safe_command(cmd_alias, custom_cmd=None):
    """执行命令（根据别名或自定义命令）"""
    if custom_cmd:
        # 自定义命令处理
        if not ALLOW_CUSTOM_COMMANDS:
            return False, "Custom commands are disabled"
            
        if is_dangerous_command(custom_cmd):
            return False, "Dangerous command blocked"
            
        return execute_command(custom_cmd)
    else:
        # 白名单命令处理
        if cmd_alias not in COMMAND_WHITELIST:
            return False, "Invalid command alias"
        
        return execute_command(COMMAND_WHITELIST[cmd_alias])

@app.route('/execute', methods=['POST'])
def command_execution():
    """命令执行接口"""
    # 获取密码和命令信息
    pwd1 = request.form.get('pwd1')
    pwd2 = request.form.get('pwd2')
    pwd3 = request.form.get('pwd3')
    cmd_alias = request.form.get('cmd')
    custom_cmd = request.form.get('custom_cmd')
    
    # 验证所有密码
    if not verify_passwords([pwd1, pwd2, pwd3]):
        return jsonify({
            "status": "error",
            "message": "Authentication failed"
        }), 403
    
    # 自定义命令处理
    if cmd_alias == CUSTOM_COMMAND_ALIAS:
        if not custom_cmd:
            return jsonify({
                "status": "error",
                "message": "Custom command required"
            }), 400
            
        # 执行自定义命令
        success, result = execute_safe_command(None, custom_cmd)
    else:
        # 执行白名单命令
        success, result = execute_safe_command(cmd_alias, None)
    
    # 返回结果
    if success:
        return jsonify({
            "status": "success",
            "command": custom_cmd if cmd_alias == CUSTOM_COMMAND_ALIAS else COMMAND_WHITELIST.get(cmd_alias),
            "result": result
        })
    else:
        return jsonify({
            "status": "error",
            "message": result
        }), 400

if __name__ == '__main__':
    # 显示配置信息
    print(f"Loaded {len(COMMAND_WHITELIST)} whitelisted commands:")
    for alias, cmd in COMMAND_WHITELIST.items():
        print(f"  {alias}: {cmd}")
    
    # 显示自定义命令设置
    if ALLOW_CUSTOM_COMMANDS:
        print(f"\nCustom commands are ENABLED (use alias '{CUSTOM_COMMAND_ALIAS}' and 'custom_cmd' parameter)")
    else:
        print("\nCustom commands are DISABLED")
    
    print(f"\nBlacklisted dangerous commands: {DANGEROUS_COMMAND_BLACKLIST}")
    
    # 启动服务器
    print(f"\nStarting server at http://{LISTEN_IP}:{LISTEN_PORT}")
    app.run(host=LISTEN_IP, port=LISTEN_PORT)
