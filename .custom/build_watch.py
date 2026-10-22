"""Starts the "Custom build fix" T3 task when the fork's release build fails.

Run by the Windows scheduled task "T3 custom build watch" every 20 minutes. Free while builds
are green: it only calls `gh`. On a new failed run it POSTs the run to the task's local webhook
(T3 serves /api/hooks/<task>/<token> on its own port, no T3 Connect needed).

Config and state live in ~/.t3-custom/, never in the repo, because the hook URL holds a token:
  build_watch.json   {"hook_url": "http://127.0.0.1:3773/api/hooks/<task>/<token>"}
  build_watch_state.json, build_watch.log
"""
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

REPO = "pyrgasm/t3code"
WORKFLOW = "custom-release.yml"
GH = r"C:\Program Files\GitHub CLI\gh.exe"
HOME = Path.home() / ".t3-custom"
CONFIG = HOME / "build_watch.json"
STATE = HOME / "build_watch_state.json"
LOG = HOME / "build_watch.log"
MAX_FIRES_PER_STREAK = 2  # .custom/AGENTS.md "Unattended build fix": two attempts, then the user
COOLDOWN_SEC = 90 * 60  # one fix plus its ~15 min build; a cron failure meanwhile is the same break


def log(msg):
    HOME.mkdir(exist_ok=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}\n")


def load(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def latest_completed():
    out = subprocess.run(
        [GH, "run", "list", "--repo", REPO, "--workflow", WORKFLOW, "--branch", "custom", "--limit", "10",
         "--json", "databaseId,status,conclusion,url,event,createdAt"],
        capture_output=True, text=True, timeout=60, creationflags=subprocess.CREATE_NO_WINDOW,
    )
    if out.returncode:
        raise RuntimeError(out.stderr.strip()[:300])
    runs = [r for r in json.loads(out.stdout) if r["status"] == "completed"]
    return runs[0] if runs else None


def fire(url, run):
    body = json.dumps({"run_id": str(run["databaseId"]), "run_url": run["url"], "event": run["event"]}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status


def main():
    url = load(CONFIG, {}).get("hook_url")
    if not url:
        log(f"no hook_url in {CONFIG}")
        return 1
    state = load(STATE, {"fired": [], "streak": 0, "last_fire": 0, "gave_up": None})
    run = latest_completed()
    if run is None:
        return 0
    rid = str(run["databaseId"])
    if run["conclusion"] == "success":
        if state["streak"] or state["gave_up"]:
            log(f"build green again (run {rid}); streak reset")
        state.update(streak=0, gave_up=None)
    elif run["conclusion"] == "failure" and rid not in state["fired"]:
        if state["streak"] >= MAX_FIRES_PER_STREAK:
            if state["gave_up"] is None:
                log(f"run {rid} failed; {state['streak']} fixes already tried, leaving it to the user")
                state["gave_up"] = rid
        elif time.time() - state["last_fire"] < COOLDOWN_SEC:
            return 0
        else:
            try:
                status = fire(url, run)
            except (urllib.error.URLError, OSError) as e:
                log(f"run {rid} failed but T3 is not reachable ({e}); retry next tick")
                return 0
            log(f"run {rid} failed ({run['event']}); started the fix task, HTTP {status}")
            state["fired"] = (state["fired"] + [rid])[-50:]
            state.update(streak=state["streak"] + 1, last_fire=time.time())
    STATE.write_text(json.dumps(state), encoding="utf-8")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # noqa: BLE001 - a scheduled task has nowhere else to report
        log(f"error: {e}")
        sys.exit(1)
