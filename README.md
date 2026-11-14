# Lesson Room — Teaching Notes

A static GitHub Pages teaching library for iPad Safari. Browse level → subject → month, open original HTML decks or PDFs, and annotate without saving files manually.

## Current materials

All materials are under **November**. F4–5 materials are deliberately filed under **Form 4** only.

| Level | Subject | Material |
| --- | --- | --- |
| Form 1 | BI | 11 BI F1.pdf |
| Form 1 | Science | 11 SC F1.html |
| Form 4 | BI | F45 NEXT YEAR.pdf |
| Form 4 | BI | SS4 English Form 4–5 November Set 02 PDF |
| Form 4 | BI | SS4 English Form 4–5 November Set 02 Reading HTML |

The duplicate Reading HTML upload is included once. Original lesson files are copied unchanged. Year 4–6 and Form 1–5 navigation is present; primary subjects have not yet been specified.

## Using the viewer

- Enter the password chosen by the owner. The client-side entry screen is a convenience gate, not authentication; the repository and hosted assets are public.
- The site’s annotation toolbar stays compact. **Tools** opens color, pen size, finger drawing, page jump, and other settings. Each HTML deck keeps its own original navigation, zoom, answer, section, and fullscreen bars visible. The site does not replace or restyle those bars.
- **Move** (Interact) enables lesson interaction and ordinary reading. Use the original HTML buttons for navigation and answers.
- **Download PDF** is available beside each PDF in the library, before opening its viewer. It downloads the original document with its original filename, without temporary website annotations. Open the downloaded PDF in Files to use Apple’s native Markup.
- **Pen / Mark** enable temporary annotations. In PDFs, one finger scrolls and two fingers pinch to zoom even while Pencil tools are selected. Touch drawing is optional; enable **Draw with finger** if needed, then use Move to scroll. A second finger cancels a partial finger stroke and starts a pinch.
- Native selection, dragging, and callouts are disabled on the PDF reading surface and on HTML content while annotation tools are selected; editable fields remain usable. Pencil strokes have persistent hit targets, incremental path rendering, empty coalesced-event fallback, and recovery on lift, capture loss, blur, and fresh contact. Resting-hand touches cannot pan a PDF during an active Pencil stroke.
- Eraser removes whole strokes; Undo reverses drawing, erasing, and clearing. Clear page affects the current PDF page or HTML slide.
- PDFs use continuous vertical pages with anchored two-finger zoom, momentum panning, and an optional page-number jump. **Fit width** is in Tools. Nearby pages render on demand with at most five cached canvases, while per-page ink remains in memory.
- **Full screen / Exit full screen** toggles an in-page reading mode. Both HTML decks route their own fullscreen controls to the host. Native Safari fullscreen is deliberately not requested, so its swipe-to-exit gesture is not attached to the reader. Safari browser chrome and system gestures are outside the site’s control.
- Password entry keeps native password semantics/autofill but paints only a separate bullet overlay. Actual input glyphs remain transparent, including Safari’s last-character reveal. There is no Show password button.
- Notes are retained per page or slide while that material is open. Closing the viewer, reloading the page, or leaving the site discards them. No annotation cloud storage or browser persistent storage is used.
- This implements standard web Pencil input, not Pencil Pro squeeze, barrel-roll, or native Apple Markup.

## Hosting

Enable **Settings → Pages → Source → GitHub Actions**. The included workflow publishes `dist/` on pushes to `main`. Relative asset URLs support a project URL such as `/teachingnotes/`.

PDF.js 4.10.38 and its worker, character maps, and fonts are vendored locally; no CDN is needed. Use a current Safari/iPadOS version. The viewer limits each raster canvas to three million pixels and releases PDF data on close.

## Updating lessons

Copy original materials into `dist/assets/materials/`, then edit `dist/materials.js` with a unique ID, level, subject, month number (1–12), title, filename, and type (`pdf` or `html`). Commit and push to publish.

`npm run check` validates JavaScript syntax without installing dependencies. Run `npm ci && npm test` for the DOM, annotation, and PDF parsing checks. The tests use jsdom 26 and the vendored PDF.js build.

## Verification limits

Automated checks cover source integrity, material routing, password masking, annotation behavior, continuous page layout, pinch anchors, gesture direction, canvas eviction with note retention, cancellation, restored original controls against both HTML decks, PDF download links, selection suppression, stroke-lifecycle regressions, resting-hand contacts, and all 89 PDF pages. The simulated DOM/gesture checks do not replace real iPad Safari and Apple Pencil testing. Browser preview was unavailable in the build environment.
