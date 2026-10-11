"""Blender MCP eklentisine (127.0.0.1:9876, null-byte ayrımlı JSON) Python kodu gönderir.

    python blender_istemci.py betik.py   |   echo "..." | python blender_istemci.py
"""
import socket, json, sys
def send(code):
    s=socket.create_connection(("127.0.0.1",9876),timeout=300)
    s.sendall((json.dumps({"type":"execute","code":code,"strict_json":False})+"\0").encode())
    buf=b""
    while not buf.endswith(b"\0"):
        c=s.recv(65536)
        if not c: break
        buf+=c
    s.close(); return json.loads(buf.rstrip(b"\0").decode())
if __name__=="__main__":
    code=open(sys.argv[1],encoding="utf-8").read() if len(sys.argv)>1 else sys.stdin.read()
    r=send(code)
    print(json.dumps(r,ensure_ascii=False,indent=1))
