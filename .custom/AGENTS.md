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

Never open PRs against pingdotgg/t3code unless the user asks for one.
