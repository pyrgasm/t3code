# pyrgasm's custom build

This checkout is pyrgasm/t3code, a fork that ships upstream T3 Code's nightly plus our own
commits on the `custom` branch. The user installs it as "T3 Code (Nightly)" and it updates
itself from this fork's releases. `.github/workflows/custom-release.yml` builds and publishes
every push to `custom`, and rebuilds hourly when upstream ships a new nightly.

When the user asks for a feature or fix, they want it in their app. They do not want a PR.

1. Sync first, before reading or changing code:
   ```bash
   git switch custom
   git pull --rebase          # another PC may have pushed; handles its force-push
   git fetch upstream --tags
   # Ask upstream: our own release tags (…347301) are fetched too and sort above its nightlies.
   tag="$(git ls-remote --tags --refs upstream 'v*-nightly.*' | sed 's#.*refs/tags/##' | sort -V | tail -1)"
   git rebase "$tag"          # our commits onto the newest nightly
   ```
   Resolve conflicts by keeping upstream's direction and re-applying our intent. When
   upstream already does what one of our commits did, drop that commit
   (`git rebase --skip`).
2. Build the change as one focused commit on `custom`, with a conventional title. Run the
   targeted tests, lint and typecheck for what you touched. The build's own gate is
   `vp run --filter @t3tools/web typecheck`.
3. Push with `git push --force-with-lease origin custom`. The rebase rewrites history,
   so a plain push fails.
4. Tell the user the build takes about 15 minutes and the app then offers the update. Watch it
   with `gh run list --repo pyrgasm/t3code --workflow custom-release.yml --limit 1`.

When a build fails, the workflow opens a "Custom build failing" issue and the sidebar badge
turns red. The fix is the same sync: rebase onto the newest nightly, resolve, push. A
successful build closes the issue.

Every custom feature has a `*.custom.test.ts(x)` next to its code, and the build runs them
("Test custom features"). A new feature ships with one, so a rebase that loses it fails.

Never open PRs against pingdotgg/t3code unless the user asks for one.

## Unattended build fix

`.custom/build_watch.py` (Windows task "T3 custom build watch", every 20 min on the main PC)
starts the T3 scheduled task "Custom build fix" when a release run fails. That run is you,
alone: nobody reads this thread until it is done. Two fixes per failure streak, then the
watcher leaves it to the user.

1. Skip checks. If any holds, reply in one line why, settle this thread (step 6) and stop:
   - The newest completed run of the workflow is already green.
   - Another thread in this project is running or waiting (`t3_thread_list`, statuses
     running/waiting/starting, other than this one).
   - The user's checkout `C:/Users/user/Documents/Development/t3code` has uncommitted
     changes, or commits on `custom` not on `origin/custom` (`git -C <it> status
     --porcelain`, `git -C <it> log origin/custom..custom`): the user is mid-edit there.
2. Read why it failed: `gh run view <run id> --repo pyrgasm/t3code --log-failed`.
3. T3 runs this thread in its own worktree, where `custom` can't be checked out (the
   user's checkout holds it). Work on this worktree's branch from `origin/custom`:
   ```bash
   git fetch origin && git reset --hard origin/custom
   git tag -f custom-backup/$(date +%Y%m%d-%H%M) origin/custom
   ```
   Then fetch upstream and rebase onto the newest nightly as in step 1 above. Resolve
   conflicts by keeping upstream's direction and re-applying our intent. Drop a commit only
   when upstream already does the same thing. Never drop one because it is hard.
4. Run the build's gates locally: `vp run --filter @t3tools/web typecheck` and the "Test
   custom features" command from the workflow. Both must pass before you push.
5. `git push --force-with-lease=custom:<origin/custom sha from step 3> origin HEAD:custom`,
   then wait for the push's run with
   `gh run watch <id> --repo pyrgasm/t3code --exit-status` in the background.
6. Report in at most 5 lines: the cause, what you changed, which custom commits you
   dropped and why, and the build result. Then decide:
   - **Settle** (`t3_thread_organize` action `settle` on this thread) when the build is
     green, the gates passed, and every custom commit survived or was dropped only because
     upstream does the same.
   - **Leave it for the user** (`t3_thread_organize` action `mark_unread`, no settle) when
     the build is still red, a custom commit was dropped for any other reason, or a
     conflict resolution changed what a custom feature does. Name what to check.
     To undo a bad push: `git push --force origin custom-backup/<stamp>:custom`.
