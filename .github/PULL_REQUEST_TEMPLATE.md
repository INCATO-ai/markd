<!--
Thanks for sending a PR. A few things to set expectations:

1. If this is a large feature, there should be an open issue first. Large PRs that come out of nowhere are likely to sit unreviewed for a while or be closed.
2. I maintain this on weekends. Reviews can take a week or more. Please don't rebase aggressively or spam updates — I'll find it when I get to it.
3. The bar for merge is: works on Windows with WebView2, passes `pnpm exec tsc --noEmit` and `pnpm test:run`, and matches the existing code style.
-->

## Summary

<!-- 1–3 sentences on what this PR changes and why. Link to the issue it closes. -->

Closes #

## Changes

<!-- Bulleted list of the concrete changes in this PR. -->

-

## How I tested

<!--
At minimum: did you build `pnpm tauri build`, run the exe, and confirm the change works end-to-end? Screenshots or screen recordings for visual changes.
-->

## Checklist

- [ ] `pnpm exec tsc --noEmit` passes
- [ ] `pnpm test:run` passes
- [ ] I built the Tauri release and tested the change in the actual desktop app, not just the browser dev server
- [ ] If this changes behavior, I updated the README
- [ ] If this fixes a bug, there's a regression test or a documented reproduction in the PR description
