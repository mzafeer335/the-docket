# The Docket ⚡

**[Live Portal: Launch The Docket](https://mzafeer335.github.io/the-docket)**

**Studio-Grade PDF Tools. Zero Server Uploads.**

The Docket is an installable, privacy-first document processing suite running entirely inside your browser. Engineered for community leaders, organizers, visual creatives, and independent professionals, it delivers heavy-duty document handling with zero cloud uploads.

What happens on your screen, stays on your screen.

---

## 🚀 Key Advantages

- **100% Air-Gapped Privacy:** All document operations run locally using client-side JavaScript. No documents or data are ever transmitted to an external server.
- **Progressive Web App (PWA):** Fully installable as a standalone desktop or mobile application directly from your browser.
- **Offline-Ready Engine:** Custom Service Worker architecture caches core scripts, UI assets, and PDF processing libraries for full offline availability.
- **Real-Time Visual Grid:** Visual canvas rendering for page extraction and removal—click thumbnail previews directly instead of guessing page numbers.
- **Live Processing Diagnostics:** Integrated progress bars and stage trackers for heavy renders, OCR analysis, and ZIP packaging.

---

## 🧰 Available Tools

### Organize & Edit

- **Merge PDF:** Combine multiple PDF documents with drag-to-reorder file management.
- **Split PDF:** Burst files into recurring _N_-page chunks or extract specific ranges into standalone files.
- **Remove Pages:** Visual preview grid to select and delete unwanted pages.
- **Extract Pages:** Interactive thumbnail selector to isolate and export targeted pages.
- **Rotate PDF:** Adjust document orientations clockwise, counter-clockwise, or 180°.
- **Page Numbers:** Dynamic automated pagination positioned at headers or footers.
- **Watermark:** Burn custom angled watermark stamps with customizable opacity and scaling.

### Convert & Extract

- **Images to PDF:** Merge collections of PNG and JPG files into a single unified document.
- **PDF to Images:** Batch render PDF pages to crisp PNG assets packaged inside a ZIP archive.
- **HTML to PDF:** Compile raw HTML markup directly into a structured document.
- **OCR PDF:** Extract text from scanned documents locally using optical character recognition.

### Security & Forms

- **Sign PDF:** Digital signature canvas with placement coordinates and drag-to-position preview.
- **Enterprise Features (Coming Soon):** Password encryption, DOCX/XLSX/PPTX format conversion, and vector stream redaction.

---

## 🛠️ Tech Stack

- **Core Runtime:** Vanilla ECMAScript (ES6+), HTML5, CSS3
- **Offline & PWA:** Service Worker API, Cache Storage API, Web App Manifest
- **PDF Manipulation:** `pdf-lib`, `pdf.js`
- **Text Extraction & OCR:** `Tesseract.js`
- **Packaging & Export:** `JSZip`, `html2pdf.js`
- **Typography:** Space Grotesk, IBM Plex Sans, IBM Plex Mono

---

## 💻 Local Setup & Installation

Clone the repository and launch directly in any modern browser:

```bash
git clone [https://github.com/mzafeer335/the-docket.git](https://github.com/mzafeer335/the-docket.git)
cd the-docket
```
