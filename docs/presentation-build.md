# Editable presentation build

Current supporting materials: `output/pptx/Nile_Submission_Presentation_Updated_v3.pptx` and matching `output/pdf/Nile_Submission_Presentation_Updated_v3.pdf`. They cover all three priorities, interview evidence, a fair Reground comparison, labelled scenario metrics and a proposed pilot.

`scripts/generate-submission-deck.mjs` uses the Codex bundled `@oai/artifact-tool` runtime. It is document tooling, not an application dependency. Use `load_workspace_dependencies` for the current bundled Node/Python paths. Copy the module into `output/build/submission-update/` and link that directory's `node_modules` to the returned bundled modules directory. Set `NILE_ROOT`, `PRESENTATIONS_SKILL_DIR`, `RUNTIME_NODE_MODULES` and `RUNTIME_PYTHON`, then execute the copy with the bundled Node binary.

The builder exports a draft and validates native tables, layout, fonts and importability before finalizing to a **new** PPTX path. When rebuilding a delivered file, set `NILE_PRESENTATION_OUTPUT` to a new absolute filename: the finalizer refuses to overwrite it.

Convert the final PPTX with bundled LibreOffice and render/inspect every final PDF page. Package checks do not establish correct PowerPoint rendering. Slide text and tables are editable; source URLs and evidence boundaries are in speaker notes.

`scripts/generate-submission-pdf.py` is retained for the **original six-page PDF only**; it does not regenerate the updated deck.
