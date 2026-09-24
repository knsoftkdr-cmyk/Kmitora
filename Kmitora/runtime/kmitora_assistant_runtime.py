from __future__ import annotations
import json, os, re, subprocess, sys, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(os.environ.get("KMITORA_ROOT", r"C:\KMITORA\Kmitora-main\Kmitora-main")).resolve()
PORT = int(os.environ.get("KMITORA_ASSISTANT_PORT", "8083"))
STATE = ROOT / "runtime" / "assistant_state"
STATE.mkdir(parents=True, exist_ok=True)
MODEL_ENDPOINT = os.environ.get("KMITORA_MODEL_ENDPOINT", "").strip()
MAX_FILES = 2500
MAX_REPAIR_LOOPS = 5

TEXT_EXT = {".ts",".tsx",".js",".jsx",".py",".ps1",".json",".md",".txt",".sql",".yaml",".yml",".xml",".csv",".html",".css",".scss",".java",".cs",".go",".rs"}
IGNORE = {"node_modules","dist","build",".git","__pycache__",".venv","venv"}

def safe_path(raw: str) -> Path:
    p=(ROOT / raw).resolve() if not Path(raw).is_absolute() else Path(raw).resolve()
    if ROOT != p and ROOT not in p.parents: raise ValueError("Path outside authorized KMITORA workspace")
    return p

def workspace_context():
    counts={"files":0,"code_files":0,"directories":0}
    languages={}
    samples=[]
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in IGNORE and not d.startswith("backup_")]
        counts["directories"] += len(dirs)
        for name in files:
            counts["files"] += 1
            ext=Path(name).suffix.lower()
            if ext in TEXT_EXT:
                counts["code_files"] += 1; languages[ext]=languages.get(ext,0)+1
                if len(samples)<80: samples.append(str(Path(base,name).relative_to(ROOT)))
            if counts["files"] >= MAX_FILES: break
        if counts["files"] >= MAX_FILES: break
    return {"root":str(ROOT),"counts":counts,"languages":languages,"sample_files":samples,"model_runtime":"CONFIGURED" if MODEL_ENDPOINT else "NOT_CONFIGURED","production_mutation":False}

def classify(prompt: str):
    p=prompt.lower()
    if any(x in p for x in ["schedule","daily","weekly","monthly","cron"]): return "SCHEDULE"
    if any(x in p for x in ["migrate","migration"]): return "MIGRATE"
    if any(x in p for x in ["fix","error","defect","broken","failed"]): return "FIX"
    if any(x in p for x in ["build","create","implement","add","develop","code"]): return "BUILD"
    if any(x in p for x in ["test","validate"]): return "TEST"
    if any(x in p for x in ["analyze","understand","inspect","explain"]): return "ANALYZE"
    return "ASK"

def make_plan(prompt: str, mode: str):
    mode=mode or classify(prompt)
    risky=bool(re.search(r"\b(prod|production|drop|delete|truncate|cutover)\b",prompt,re.I))
    build=mode in {"BUILD","FIX","MIGRATE","AUTOMATE"}
    steps=[
      ("Understand intent and acceptance criteria","L1"),
      ("Assemble domain, repository, database, workflow and evidence context","L1"),
      ("Inspect existing implementation and reusable capabilities","L1"),
      ("Run duplicate and impact analysis","L2"),
      ("Create dependency-aware A000 execution DAG","L2"),
    ]
    if build: steps += [("Generate minimal patch through KMITORA model runtime","L3"),("Run deterministic build and impacted tests","L5"),("Run bounded repair loop when safe","L5"),("Simulate and validate candidate state","L4")]
    if mode=="SCHEDULE" or re.search(r"schedule|daily|weekly|monthly|job",prompt,re.I): steps += [("Create or reuse workflow and schedule","L3")]
    steps += [("Reconcile expected vs actual outcome","L4"),("Capture evidence and verified reusable knowledge","L1")]
    out=[]
    for i,(label,auth) in enumerate(steps,1): out.append({"id":f"s{i}","label":label,"status":"READY" if i==1 else "PENDING","authority":auth,"dependsOn":[] if i==1 else [f"s{i-1}"]})
    return {"taskId":f"KAT-{uuid.uuid4().hex[:10].upper()}","mode":mode,"objective":prompt,"risk":"HIGH" if risky else ("MEDIUM" if build else "LOW"),"authorityRequired":"L6" if risky else ("L5" if build else "L2"),"duplicateCheck":"REQUIRED","productionMutation":False,"steps":out}

def run_command(args, cwd, timeout=120):
    cp=subprocess.run(args,cwd=str(cwd),capture_output=True,text=True,timeout=timeout,shell=False)
    return {"command":" ".join(args),"returncode":cp.returncode,"stdout":cp.stdout[-12000:],"stderr":cp.stderr[-12000:]}

def model_generate(instruction: str, context: dict):
    if not MODEL_ENDPOINT: return {"status":"MODEL_RUNTIME_REQUIRED","message":"Set KMITORA_MODEL_ENDPOINT to the KMITORA-controlled model service before autonomous code generation."}
    payload=json.dumps({"instruction":instruction,"context":context,"constraints":{"workspace":str(ROOT),"production_mutation":False,"minimal_diff":True,"no_delete":True,"response_contract":{"status":"READY","files":[{"path":"relative/path","content":"complete file content"}],"summary":"..."}}}).encode()
    req=Request(MODEL_ENDPOINT,data=payload,headers={"Content-Type":"application/json"},method="POST")
    with urlopen(req,timeout=120) as r: return json.loads(r.read().decode("utf-8"))

def apply_generated_files(task_id: str, generated: dict):
    files=generated.get("files") or []
    if not isinstance(files,list): raise ValueError("Model response files must be an array")
    backup_dir=STATE/"backups"/task_id; backup_dir.mkdir(parents=True,exist_ok=True)
    applied=[]
    for item in files:
        if not isinstance(item,dict) or not item.get("path") or "content" not in item: continue
        target=safe_path(str(item["path"]))
        if target.exists() and target.is_dir(): raise ValueError(f"Refusing to overwrite directory: {target}")
        target.parent.mkdir(parents=True,exist_ok=True)
        if target.exists():
            rel=target.relative_to(ROOT); b=backup_dir/rel; b.parent.mkdir(parents=True,exist_ok=True); b.write_bytes(target.read_bytes())
        target.write_text(str(item["content"]),encoding="utf-8")
        applied.append(str(target.relative_to(ROOT)))
    manifest={"task_id":task_id,"applied":applied,"backup_dir":str(backup_dir),"production_mutation":False}
    (STATE/f"{task_id}_patch.json").write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    return manifest

def execute(plan: dict):
    results=[]; prompt=str(plan.get("objective", "")); mode=str(plan.get("mode", "ASK")); task_id=str(plan.get("taskId") or f"KAT-{uuid.uuid4().hex[:8].upper()}")
    results.append({"step":"context","status":"PASS","data":workspace_context()})
    if (ROOT/".git").exists():
        try: results.append({"step":"git_status","status":"PASS","data":run_command(["git","status","--short"],ROOT,30)})
        except Exception as e: results.append({"step":"git_status","status":"REVIEW","error":str(e)})
    if mode in {"BUILD","FIX","MIGRATE","AUTOMATE"}:
        generated=model_generate(prompt,workspace_context()); results.append({"step":"generation","status":generated.get("status","READY"),"data":{"status":generated.get("status"),"summary":generated.get("summary"),"file_count":len(generated.get("files") or [])}})
        if generated.get("status")=="MODEL_RUNTIME_REQUIRED":
            return {"status":"REVIEW","task_id":task_id,"results":results,"production_mutation":False}
        try:
            manifest=apply_generated_files(task_id,generated); results.append({"step":"apply_patch","status":"PASS","data":manifest})
        except Exception as e:
            results.append({"step":"apply_patch","status":"BLOCKED","error":str(e)}); return {"status":"REVIEW","task_id":task_id,"results":results,"production_mutation":False}
    # Deterministic build + bounded repair loop.
    if mode in {"BUILD","FIX","TEST","MIGRATE","AUTOMATE"} and (ROOT/"frontend"/"package.json").exists():
        try:
            cmd=["cmd.exe","/c","npm","run","build"] if os.name=="nt" else ["npm","run","build"]
            build=run_command(cmd,ROOT/"frontend",180); results.append({"step":"frontend_build","status":"PASS" if build["returncode"]==0 else "BLOCKED","data":build})
            loops=0
            while build["returncode"]!=0 and MODEL_ENDPOINT and loops<MAX_REPAIR_LOOPS and mode in {"BUILD","FIX","MIGRATE","AUTOMATE"}:
                loops+=1
                repair_instruction=f"Repair the previous KMITORA DEV change with the smallest safe diff. Build failed. STDOUT:\n{build['stdout']}\nSTDERR:\n{build['stderr']}"
                repair=model_generate(repair_instruction,workspace_context())
                if repair.get("status")=="MODEL_RUNTIME_REQUIRED" or not repair.get("files"): break
                manifest=apply_generated_files(f"{task_id}-R{loops}",repair); results.append({"step":f"repair_{loops}","status":"PASS","data":manifest})
                build=run_command(cmd,ROOT/"frontend",180); results.append({"step":f"frontend_build_retry_{loops}","status":"PASS" if build["returncode"]==0 else "BLOCKED","data":build})
        except Exception as e: results.append({"step":"frontend_build","status":"BLOCKED","error":str(e)})
    (STATE/f"{task_id}.json").write_text(json.dumps({"plan":plan,"results":results,"ts":time.time()},indent=2),encoding="utf-8")
    status="PASS" if all(r.get("status") not in {"BLOCKED","REVIEW"} for r in results) else "REVIEW"
    return {"status":status,"task_id":task_id,"results":results,"production_mutation":False}

class Handler(BaseHTTPRequestHandler):
    def _send(self,code,obj):
        data=json.dumps(obj).encode(); self.send_response(code); self.send_header("Content-Type","application/json"); self.send_header("Access-Control-Allow-Origin","*"); self.send_header("Access-Control-Allow-Headers","Content-Type"); self.send_header("Access-Control-Allow-Methods","GET,POST,OPTIONS"); self.end_headers(); self.wfile.write(data)
    def do_OPTIONS(self): self._send(200,{"ok":True})
    def _body(self):
        n=int(self.headers.get("Content-Length","0")); return json.loads(self.rfile.read(n) or b"{}")
    def do_GET(self):
        if self.path=="/health": return self._send(200,{"status":"HEALTHY","mode":"KMITORA_AUTONOMOUS_DEV","workspace":str(ROOT),"production_mutation":False,"model_runtime":"CONFIGURED" if MODEL_ENDPOINT else "NOT_CONFIGURED"})
        if self.path=="/v1/assistant/context": return self._send(200,workspace_context())
        return self._send(404,{"error":"not found"})
    def do_POST(self):
        try: body=self._body()
        except Exception as e: return self._send(400,{"error":str(e)})
        if self.path=="/v1/assistant/plan": return self._send(200,make_plan(str(body.get("prompt","")),str(body.get("mode",""))))
        if self.path=="/v1/assistant/execute": return self._send(200,execute(body.get("plan") or {}))
        if self.path=="/v1/assistant/schedule":
            sid=f"SCH-{uuid.uuid4().hex[:10].upper()}"; rec={"schedule_id":sid,"schedule":body.get("schedule"),"plan":body.get("plan"),"enabled":True,"created_at":time.time(),"production_mutation":False}; (STATE/f"{sid}.json").write_text(json.dumps(rec,indent=2),encoding="utf-8"); return self._send(200,{"status":"SCHEDULED","schedule_id":sid})
        return self._send(404,{"error":"not found"})
    def log_message(self,fmt,*args): print("[KMITORA Assistant]",fmt%args)

if __name__=="__main__":
    print(f"KMITORA Assistant Runtime DEV listening on http://127.0.0.1:{PORT}")
    print(f"Workspace: {ROOT}")
    print("Production mutation: DISABLED")
    print("KMITORA model runtime:", "CONFIGURED" if MODEL_ENDPOINT else "NOT CONFIGURED")
    import sys as _port_sys
    from pathlib import Path as _PortPath
    _project_root = _PortPath(__file__).resolve().parents[1]
    _port_sys.path.insert(0, str(_project_root / "backend"))
    from port_utils import find_free_port, write_active_port
    resolved_port = find_free_port(PORT)
    write_active_port("assistant", resolved_port, _project_root)
    print(f"KMITORA Assistant Runtime actually listening on http://127.0.0.1:{resolved_port}")
    try:
        ThreadingHTTPServer(("127.0.0.1",resolved_port),Handler).serve_forever()
    except KeyboardInterrupt:
        pass

