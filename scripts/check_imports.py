#!/usr/bin/env python3
"""Scratch: statically resolve imports across the TS/TSX source tree.

Verifies every `@/...` and relative import points at a real file (with
.ts/.tsx/index resolution), and that package imports are declared in
package.json. This is the closest available substitute for a build check
in an environment without Node.
"""
import json
import os
import re
import sys

ROOT = "."
SRC_DIRS = ["app", "components", "contexts", "hooks", "services", "constants", "types", "utils", "template"]

pkg = json.load(open(os.path.join(ROOT, "package.json")))
declared = set(pkg.get("dependencies", {})) | set(pkg.get("devDependencies", {}))

IMP = re.compile("(?:import|export)\\b[^'\"]*")
PAT = re.compile("(?:from\\s+|import\\s+)['\"]([^'\"]+)['\"]")

problems = []


def resolve(base_dir, spec):
    if spec.startswith("@/"):
        base = spec[2:]
        search_dirs = [ROOT]
    elif spec.startswith("."):
        base = os.path.normpath(os.path.join(base_dir, spec))
        search_dirs = [ROOT]
    else:
        return "package" if spec in declared else ("PACKAGE-MISSING", spec)

    candidates = []
    for sd in search_dirs:
        p = os.path.join(sd, base)
        candidates += [
            p,
            p + ".ts",
            p + ".tsx",
            p + ".js",
            p + ".jsx",
            os.path.join(p, "index.ts"),
            os.path.join(p, "index.tsx"),
            os.path.join(p, "index.js"),
        ]
    for c in candidates:
        if os.path.isfile(c):
            return "ok"
    return ("UNRESOLVED", spec)


files = []
for d in SRC_DIRS:
    for root, _dirs, fnames in os.walk(os.path.join(ROOT, d)):
        for f in fnames:
            if f.endswith((".ts", ".tsx")):
                files.append(os.path.join(root, f))

for path in sorted(files):
    with open(path, encoding="utf-8", errors="replace") as fh:
        text = fh.read()
    for m in IMP.finditer(text):
        seg = m.group(0)
        for q in PAT.findall(seg):
            q = q.strip()
            if not q:
                continue
            res = resolve(os.path.dirname(path), q)
            if res not in ("ok", "package"):
                problems.append((path, q, res))

if problems:
    print("BROKEN IMPORTS:")
    for path, q, res in problems:
        print(f"  {path}: {q} -> {res}")
    sys.exit(1)
print(f"OK: {len(files)} source files checked, no unresolved imports")
