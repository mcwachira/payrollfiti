# Build Guide Source

Markdown source for `docs/PayrollFiti-Complete-Build-Guide.pdf`. Each file in `parts/` is one numbered part; `00-cover.md` carries the title-page YAML metadata (title/author/date) that pandoc reads from the concatenated input.

To add a new part, drop a `parts/NN-name.md` file (heading `# Part NN — ...`, subsections `## NN.1 ...`), update Part 12's closing paragraph if it still claims to be the last part, then regenerate:

```bash
cd docs/build-guide
pandoc parts/00-cover.md parts/01-intro.md parts/02-scaffolding-db.md parts/03-engine.md \
  parts/04-backend-foundations.md parts/05-payroll-api.md parts/06-compliance.md \
  parts/07-billing.md parts/08-notifications.md parts/09-hr-features.md \
  parts/10-frontend-foundations.md parts/11-frontend-app.md parts/12-testing-devops.md \
  parts/13-auth-lifecycle.md parts/14-pwa.md \
  --toc --toc-depth=2 -s --css style.css -o guide.html

chromium --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
  --print-to-pdf=../PayrollFiti-Complete-Build-Guide.pdf \
  --print-to-pdf-no-header "file://$(pwd)/guide.html"

rm guide.html  # generated artifact, not checked in
```

Requires `pandoc` and a `chromium`/`google-chrome` binary on PATH. `style.css` sets the A4 page geometry and print typography — page breaks before every `# Part N` heading, syntax-highlighted code blocks via pandoc's built-in highlighter.
