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
- **Interact** enables the original lesson buttons, scrolling, and deck zoom controls.
- **Pen / Highlight** enable temporary annotations. Apple Pencil input works through Pointer Events. Touch drawing is optional; enable **Draw with finger** if needed. Use Interact to scroll.
- Eraser removes whole strokes; Undo reverses drawing, erasing, and clearing. Clear page affects the current PDF page or HTML slide.
- PDF navigation, zoom, and fit-to-width are provided by the site. HTML slides retain their original controls.
- Notes are retained per page or slide while that material is open. Closing the viewer, reloading the page, or leaving the site discards them. No annotation cloud storage or browser persistent storage is used.
- This implements standard web Pencil input, not Pencil Pro squeeze, barrel-roll, or native Apple Markup.

## Hosting

Enable **Settings → Pages → Source → GitHub Actions**. The included workflow publishes `dist/` on pushes to `main`. Relative asset URLs support a project URL such as `/teachingnotes/`.

PDF.js 4.10.38 and its worker, character maps, and fonts are vendored locally; no CDN is needed. Use a current Safari/iPadOS version. The viewer renders one PDF page at a time, limits canvas pixels, and releases PDF data on close.

## Updating lessons

Copy original materials into `dist/assets/materials/`, then edit `dist/materials.js` with a unique ID, level, subject, month number (1–12), title, filename, and type (`pdf` or `html`). Commit and push to publish.

`npm run check` validates JavaScript syntax without installing dependencies. Run `npm ci && npm test` for the DOM, annotation, and PDF parsing checks. The tests use jsdom 26 and the vendored PDF.js build.

## Verification limits

The initial build was checked for source integrity, material routing, password handling, annotation behavior, and PDF readability. Browser preview was unavailable in the build environment. Real iPad Safari and Apple Pencil testing is still required; it is not implied by automated checks.
