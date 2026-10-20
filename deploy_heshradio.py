#!/usr/bin/env python3
"""
Deploy HeshRadio to trevorheshka.com/heshradio via SFTP.
Deploys built assets from dist/ to /home/cklag780/public_html/heshradio.
Also copies files to local D:\\projects\\TrevorHeshka\\heshradio for local parity.
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path
import paramiko

HOST = os.environ.get("SFTP_HOST") or "135.84.181.85"
PORT = int(os.environ.get("SFTP_PORT") or "27")
USER = os.environ.get("SFTP_USER") or "cklag780"

REMOTE_WEB_ROOT = "/home/cklag780/public_html/heshradio"
LOCAL_DIST = Path(r"d:\projects\wifi\HeshRadio\dist")
LOCAL_TREVOR_HESHKA_DIR = Path(r"d:\projects\TrevorHeshka\heshradio")

def get_password() -> str:
    pw = os.environ.get("SFTP_PASS")
    if pw:
        return pw.strip()
    pass_file = Path.home() / ".sftp_pass"
    if pass_file.exists():
        with open(pass_file, "r", encoding="utf-8") as f:
            return f.read().strip()
    return ""

def ensure_remote_dir(sftp, remote_dir: str):
    parts = remote_dir.strip("/").split("/")
    cur = ""
    for part in parts:
        cur += "/" + part
        try:
            sftp.stat(cur)
        except IOError:
            print(f"  [+] Creating remote directory: {cur}")
            sftp.mkdir(cur)

def upload_directory(sftp, local_dir: Path, remote_dir: str):
    ensure_remote_dir(sftp, remote_dir)
    # If uploading assets directory, clean up old hashed chunks first
    if local_dir.name == "assets":
        try:
            remote_files = sftp.listdir(remote_dir)
            current_local_files = {entry.name for entry in local_dir.iterdir()}
            for rf in remote_files:
                if rf not in current_local_files:
                    try:
                        sftp.remove(f"{remote_dir}/{rf}")
                        print(f"  [-] Removed stale asset: {rf}")
                    except Exception:
                        pass
        except Exception:
            pass

    for entry in local_dir.iterdir():
        remote_path = f"{remote_dir}/{entry.name}"
        if entry.is_dir():
            upload_directory(sftp, entry, remote_path)
        else:
            print(f"  [->] Uploading {entry.name} to {remote_path}")
            sftp.put(str(entry), remote_path)

def copy_to_local_trevorheshka():
    print(f"Syncing local files to {LOCAL_TREVOR_HESHKA_DIR}...")
    LOCAL_TREVOR_HESHKA_DIR.mkdir(parents=True, exist_ok=True)
    for item in LOCAL_DIST.iterdir():
        target = LOCAL_TREVOR_HESHKA_DIR / item.name
        if item.is_dir():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(item, target)
        else:
            shutil.copy2(item, target)
    print("Local sync complete.")

def main():
    if not LOCAL_DIST.exists():
        print(f"Error: Dist directory {LOCAL_DIST} not found. Run 'npm run build' first.")
        sys.exit(1)

    # 1. Update local D:\projects\TrevorHeshka\heshradio
    copy_to_local_trevorheshka()

    # 2. SFTP Deployment
    password = get_password()
    if not password:
        print("Error: SFTP password not found in SFTP_PASS or ~/.sftp_pass")
        sys.exit(1)

    print(f"Connecting to {USER}@{HOST}:{PORT} via SFTP...")
    transport = paramiko.Transport((HOST, PORT))
    transport.connect(username=USER, password=password)
    sftp = paramiko.SFTPClient.from_transport(transport)

    print(f"Deploying HeshRadio web app to {REMOTE_WEB_ROOT}...")
    upload_directory(sftp, LOCAL_DIST, REMOTE_WEB_ROOT)

    # Also update root .htaccess to ensure /heshradio and /HeshRadio are properly routed
    local_root_ht = Path(r"d:\projects\TrevorHeshka\.htaccess")
    if local_root_ht.exists():
        print("Updating root public_html/.htaccess...")
        sftp.put(str(local_root_ht), "/home/cklag780/public_html/.htaccess")

    sftp.close()
    transport.close()

    # Post-deploy: verify the live security headers via HCloud's checker so a
    # header regression fails this deploy loudly instead of shipping silently.
    verifier = Path(r"d:\projects\HCloud\scripts\verify-live-headers.py")
    if not verifier.exists():
        print(f"Deploy uploaded, but the header verifier is MISSING at {verifier} - failing loudly.")
        sys.exit(1)
    print(f"Verifying live security headers ({verifier.name})...")
    code = subprocess.run([sys.executable, str(verifier)]).returncode
    if code != 0:
        print("Deploy uploaded, but live header verification FAILED (see checks above).")
        sys.exit(code)
    print("\nSuccessfully deployed HeshRadio to https://trevorheshka.com/heshradio/")

if __name__ == "__main__":
    main()
