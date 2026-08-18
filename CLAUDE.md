# CLAUDE.md — Mandatory Development Protocol

## READ THIS FILE FIRST — EVERY TIME

This file is mandatory project policy.

Before doing ANY work in this repository, you MUST:

1. Read this entire `CLAUDE.md`.
2. Inspect the current Git status.
3. Inspect the current branch.
4. Inspect recent commits.
5. Understand any uncommitted changes before touching code.
6. Follow every rule in this file for the entire task.

**You MUST re-read `CLAUDE.md` at the beginning of every new task/session and before making code changes.**

Do not rely on memory of this file.

---

# 1. ABSOLUTE RULE: COMMIT AS YOU GO

**NEVER wait until the end of the task to commit.**

This is a hard requirement.

The workflow is:

```text
READ CLAUDE.md
        ↓
inspect Git status
        ↓
make ONE intentional change
        ↓
inspect diff
        ↓
test/validate that change
        ↓
COMMIT IMMEDIATELY
        ↓
VERIFY COMMIT
        ↓
continue to next change
```

Repeat this cycle throughout the entire task.

There must NOT be a large collection of uncommitted changes waiting for an end-of-task commit.

---

# 2. EVERY CODE CHANGE MUST BE COMMITTED

A change is considered incomplete until it has been committed.

Examples:

### One-line change

```text
edit one line
→ inspect diff
→ test
→ commit
→ verify commit
```

### Three-word change

```text
edit three words
→ inspect diff
→ commit
→ verify
```

### One function

```text
add function
→ test
→ commit
→ verify
```

### 800-line implementation

```text
implement 800 lines
→ inspect the complete 800-line diff
→ test
→ commit the implementation
→ verify the commit
```

Do NOT wait until the entire project task is finished.

---

# 3. COMMIT BEFORE MOVING TO THE NEXT LOGICAL CHANGE

After completing a logical modification:

**STOP.**

Do not immediately continue editing another file.

First:

```bash
git status
git diff --stat
git diff
```

Then test the change.

Then commit.

Then verify:

```bash
git status
git log -1 --oneline
```

Only after this verification may you start the next logical modification.

---

# 4. NO "I'LL COMMIT AT THE END"

The following behaviour is prohibited:

```text
modify file A
modify file B
modify file C
modify tests
modify documentation
modify configuration
...
commit everything
```

This is NOT acceptable.

Instead:

```text
modify A
→ test
→ commit A

modify B
→ test
→ commit B

modify C
→ test
→ commit C

modify tests
→ test
→ commit tests

modify documentation
→ verify
→ commit documentation
```

---

# 5. DO NOT ARTIFICIALLY SPLIT ONE CHANGE

The purpose is traceability, NOT gaming commit counts.

If one logical implementation requires 800 lines, do not artificially create eight meaningless commits merely to create smaller numbers.

Instead:

```text
complete the logical implementation
→ verify the complete diff
→ test
→ commit the complete implementation
```

The commit should contain the complete intentional change.

However, unrelated changes MUST NOT be bundled together.

---

# 6. UNCOMMITTED CHANGES ARE A STOP CONDITION

Before making another code modification, check:

```bash
git status --short
```

If the previous change is still uncommitted:

**STOP.**

Do not make additional changes.

Commit or otherwise properly handle the existing change first.

Exception:

Changes explicitly identified as pre-existing user changes MUST be preserved and must NOT be accidentally committed.

---

# 7. PRE-EXISTING USER CHANGES

At the beginning of every task:

```bash
git status
git diff
```

If changes existed before your work began:

* identify them
* do not overwrite them
* do not revert them
* do not silently include them in your commits
* keep your changes logically separate

If necessary, explain the boundary before modifying the affected files.

---

# 8. EVERY COMMIT MUST BE VERIFIED

Creating a commit is NOT sufficient.

After every commit:

```bash
git status
git log -1 --oneline
git show --stat --oneline HEAD
```

Confirm:

1. the commit exists
2. the intended files are included
3. the intended changes are included
4. unrelated changes are not included
5. no accidental secrets were committed
6. the working tree is clean, except for explicitly pre-existing/user changes

Then continue.

---

# 9. NEVER ACCUMULATE MULTIPLE COMMITS WORTH OF WORK

If you discover another defect while testing:

Do NOT continue making five additional fixes and commit them together.

Instead:

```text
fix defect #1
→ test
→ commit
→ verify

fix defect #2
→ test
→ commit
→ verify

fix defect #3
→ test
→ commit
→ verify
```

Each intentional correction must have its own traceable point in Git history.

---

# 10. TEST AFTER EACH CHANGE

Do not postpone all testing until the end.

After each meaningful code change:

1. run the smallest relevant test
2. inspect the result
3. fix if necessary
4. commit the completed change
5. verify the commit

After groups of changes, run the broader test suite as well.

---

# 11. NEVER USE A FINAL BULK COMMIT

A final commit containing dozens of previously uncommitted changes is prohibited.

At the end of the task, there should normally be:

```text
working tree clean
```

because changes were committed throughout the process.

The final task should be a **verification stage**, not a massive commit stage.

---

# 12. COMMIT MESSAGE REQUIREMENTS

Commit messages must describe the actual change.

Good:

```text
fix(rag): preserve telemetry timestamp metadata
test(rag): add retrieval recall regression tests
fix(api): handle missing Granite credentials
test(rag): add no-evidence evaluation cases
docs(rag): document Granite-free evaluation mode
```

Bad:

```text
update
changes
fix
stuff
final
done
```

---

# 13. CODE CHANGES MUST ALWAYS FOLLOW THIS LOOP

For EVERY code modification:

```text
READ CLAUDE.md
↓
CHECK GIT STATUS
↓
UNDERSTAND CURRENT STATE
↓
MAKE ONE LOGICAL CHANGE
↓
INSPECT DIFF
↓
RUN RELEVANT TEST
↓
SECURITY CHECK
↓
COMMIT IMMEDIATELY
↓
VERIFY COMMIT
↓
CHECK GIT STATUS AGAIN
↓
ONLY THEN CONTINUE
```

This loop is mandatory.

---

# 14. DO NOT TRUST YOUR OWN MEMORY

Even if you have already read this file earlier in the conversation/session:

**READ IT AGAIN before starting a new task.**

Do not say:

> "I already know the instructions."

You must actually read `CLAUDE.md`.

---

# 15. NEW SESSION / NEW TASK REQUIREMENT

At the beginning of EVERY new task:

```bash
cat CLAUDE.md
git status
git branch --show-current
git log -5 --oneline
```

Then inspect the relevant project files.

Do not modify code before completing this initial check.

---

# 16. BEFORE EVERY CODE EDIT

Before editing a file:

1. know what the current file contains
2. know whether it has uncommitted changes
3. understand why the change is required
4. make the smallest correct change
5. validate it
6. commit it immediately

---

# 17. RAG / ENGINEERING PROJECT REQUIREMENT

For RAG, telemetry, physics, ML, aerospace, or safety-relevant code, apply the same commit discipline.

For example:

```text
fix telemetry timestamp handling
→ test telemetry
→ commit

fix RAG metadata propagation
→ test RAG
→ commit

add retrieval evaluation
→ run evaluation
→ commit

fix retrieval ranking
→ run evaluation
→ commit

add no-answer test
→ run test
→ commit

```

Do not make all RAG changes first and commit them later.

---

# 18. IF YOU REALISE YOU FORGOT TO COMMIT

Stop immediately.

Do NOT continue making changes.

Inspect:

```bash
git status
git diff
```

Identify exactly what was changed.

Test the accumulated logical change.

Commit it.

Verify it.

Then resume the task.

Do not rationalise the missed commit and continue accumulating more work.

---

# 19. FINAL CHECK

At the end of the task:

```bash
git status
git log --oneline -20
```

Confirm:

* no unintended uncommitted changes
* every intentional modification has a commit
* commits are logically separated
* tests pass
* no secrets were introduced
* no user changes were overwritten
* commit history accurately represents development

The final state must be reproducible from Git history.

---

# 20. HIGHEST-PRIORITY RULE

If any other instruction conflicts with this development protocol, the required behaviour for this repository is:

**MAKE THE CHANGE → TEST IT → COMMIT IT → VERIFY IT → THEN MAKE THE NEXT CHANGE.**

Never:

**MAKE ALL CHANGES → TEST EVERYTHING → COMMIT AT THE END.**

The second workflow is prohibited.
