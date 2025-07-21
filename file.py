import os
from flask import Flask, Response

app = Flask(__name__)

# 从环境变量获取文件路径，默认为当前目录的'data.txt'
FILE_PATH = os.environ.get('FILE_PATH', '/root/user_info.json')

@app.route('/api')
def serve_file():
    """读取指定文件内容并返回API响应"""
    try:
        # 检查文件是否存在
        if not os.path.exists(FILE_PATH):
            return Response(
                response=f"File not found: {FILE_PATH}",
                status=404,
                mimetype='text/plain'
            )
        
        # 读取文件内容
        with open(FILE_PATH, 'r') as file:
            content = file.read()
            
        # 返回文件内容和正确的MIME类型
        return Response(
            response=content,
            status=200,
            mimetype='text/plain'
        )
            
    except Exception as e:
        # 处理其他意外错误
        return Response(
            response=f"Error reading file: {str(e)}",
            status=500,
            mimetype='text/plain'
        )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=7880)