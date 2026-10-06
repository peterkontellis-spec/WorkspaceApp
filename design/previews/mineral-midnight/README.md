# Mineral and Midnight — design preview

Saved at the user's request as a design checkpoint. This preview is not connected to the running Workspace app, its accounts or its database. Committing it does not implement or deploy these themes.

## Open and edit

Open `index.html` in a browser for the standalone preview. `preview.fragment.html` is the editable source used for the conversation preview; the standalone file wraps that exact fragment in a sandboxed frame. Its standard icon/tooltip libraries load from pinned unpkg URLs, so icons require a network connection. The preview makes no workspace API requests.

The standalone copy was exported with the installed Visualize skill's `scripts/render.py` using the title “Workspace — Mineral and Midnight design preview”. Re-export the fragment after future edits. The optional host-provided tint-strength control is available only where the Tweak helper exists; the visible Light/Dark, star phase and tint on/off controls work independently of it.

## Direction captured

- Light: warm ivory and limestone surfaces, sage actions and darker clay document accents.
- Dark: crisp ink/slate surfaces, restrained lilac actions, steel-blue In progress and green Done.
- Refinements: active Table underline, green completion checkboxes, softer internal row dividers, larger 13px status/date text and stronger light-mode secondary text.
- Document affordance: a labelled icon and underlined disclosure opens a short sample brief.
- Optional experiment: a faint star-colour gradient limited to sidebar/header. Task surfaces and semantic status colours stay stable. Red, orange, mixed, green and neutral phases are illustrative, not calculated from tasks.

Light/Dark changes, sample task additions, completion changes and star appearance exist only in this preview and reset on reload. Navigation and board-view labels are presentation samples, not implemented app routes. The orb is a static colour approximation, not the app's actual solar-flare renderer.

## Verification and limits

The saved source matches the reviewed temporary fragment exactly, the export contains that source unchanged, and its JavaScript passes syntax checking. Previously calculated contrast: light sidebar text 5.47:1, light document link 5.71:1 and dark progress label 7.26:1. These calculations do not constitute a full rendered accessibility audit or validation of every tint combination.

The source detector's sole warning concerned the intentional orb glow. Supported browser inspection remains blocked by administrator-policy verification; rendered desktop/mobile appearance, focus, standalone runtime and actual device behaviour remain pending. No full app build or database regression was rerun for this isolated export. No application source, saved records, server process, dependencies or deployment configuration changed.

Future adoption requires integrating theme tokens throughout the real app and completing its existing design, browser, mobile and self-check gates. Keep the source's broader M3 acceptance checks separate from this design proposal.
