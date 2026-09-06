const { PDFDocument, degrees, rgb, StandardFonts } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const grid = document.getElementById("toolGrid");
const workspace = document.getElementById("workspace");
const wsTitle = document.getElementById("wsTitle");
const wsBody = document.getElementById("wsBody");
const wsStatus = document.getElementById("wsStatus");

document.getElementById("catRow").addEventListener("click", (e) => {
  if (!e.target.matches(".cat-btn")) return;
  document
    .querySelectorAll(".cat-btn")
    .forEach((b) => b.classList.remove("active"));
  e.target.classList.add("active");
  const cat = e.target.dataset.cat;
  document.querySelectorAll(".tool-card").forEach((c) => {
    c.style.display = cat === "all" || c.dataset.cat === cat ? "" : "none";
  });
});

const TOOL_TITLES = {
  merge: "Merge PDF",
  split: "Split PDF",
  remove: "Remove pages",
  extract: "Extract pages",
  compress: "Compress PDF",
  repair: "Repair PDF",
  ocr: "OCR PDF",
  img2pdf: "JPG to PDF",
  word2pdf: "WORD to PDF",
  ppt2pdf: "POWERPOINT to PDF",
  excel2pdf: "EXCEL to PDF",
  html2pdf: "HTML to PDF",
  pdf2img: "PDF to JPG",
  pdf2word: "PDF to WORD",
  pdf2ppt: "PDF to POWERPOINT",
  pdf2excel: "PDF to EXCEL",
  pdf2pdfa: "PDF to PDF/A",
  rotate: "Rotate PDF",
  pagenum: "Add page numbers",
  watermark: "Add watermark",
  crop: "Crop PDF",
  editpdf: "Edit PDF",
  forms: "PDF Forms",
  unlock: "Unlock PDF",
  protect: "Protect PDF",
  esign: "Sign PDF",
  redact: "Redact PDF",
  compare: "Compare PDF",
};

grid.addEventListener("click", (e) => {
  const card = e.target.closest(".tool-card");
  if (!card) return;
  openTool(card.dataset.tool);
});

document.getElementById("wsClose").addEventListener("click", () => {
  workspace.classList.remove("open");
});

function setStatus(msg, isError = false) {
  wsStatus.textContent = msg;
  wsStatus.className = "status" + (isError ? " error" : "");
}

function openTool(tool) {
  wsTitle.textContent = TOOL_TITLES[tool];
  wsBody.innerHTML = "";
  setStatus("");
  workspace.classList.add("open");
  if (BUILDERS[tool]) BUILDERS[tool](wsBody);
  else BUILDERS.placeholder(wsBody, tool);
  workspace.scrollIntoView({ behavior: "smooth", block: "start" });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function makeDrop({ multiple, accept, onFiles }) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `<div class="drop"><strong>Click to choose ${multiple ? "files" : "a file"}</strong> or drag ${multiple ? "them" : "it"} here<input type="file" ${multiple ? "multiple" : ""} accept="${accept}"></div>`;
  const drop = wrap.querySelector(".drop");
  const input = wrap.querySelector("input");
  drop.addEventListener("click", () => input.click());
  input.addEventListener("change", () => onFiles([...input.files]));
  ["dragover", "dragleave", "drop"].forEach((evt) => {
    drop.addEventListener(evt, (e) => {
      e.preventDefault();
      drop.classList.toggle("drag", evt === "dragover");
      if (evt === "drop") onFiles([...e.dataTransfer.files]);
    });
  });
  return wrap;
}

function fileListUI(container, files, { reorder = false } = {}) {
  container.innerHTML = "";
  const list = document.createElement("div");
  list.className = "file-list";
  files.forEach((f, i) => {
    const row = document.createElement("div");
    row.className = "file-row";
    row.innerHTML = `${reorder ? '<span class="order-btns"><button data-dir="up">▲</button><button data-dir="down">▼</button></span>' : ""}<span class="fname">${f.name}</span><button data-remove="1">✕</button>`;
    row.querySelector("[data-remove]").addEventListener("click", () => {
      files.splice(i, 1);
      fileListUI(container, files, { reorder });
    });
    if (reorder) {
      row.querySelector('[data-dir="up"]').addEventListener("click", () => {
        if (i === 0) return;
        [files[i - 1], files[i]] = [files[i], files[i - 1]];
        fileListUI(container, files, { reorder });
      });
      row.querySelector('[data-dir="down"]').addEventListener("click", () => {
        if (i === files.length - 1) return;
        [files[i + 1], files[i]] = [files[i], files[i + 1]];
        fileListUI(container, files, { reorder });
      });
    }
    list.appendChild(row);
  });
  container.appendChild(list);
}

async function readAsArrayBuffer(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsArrayBuffer(file);
  });
}

function parsePageSpec(spec, pageCount) {
  const out = new Set();
  spec.split(",").forEach((part) => {
    part = part.trim();
    if (!part) return;
    if (part.includes("-")) {
      const [a, b] = part.split("-").map((n) => parseInt(n.trim(), 10));
      for (let p = a; p <= b; p++) if (p >= 1 && p <= pageCount) out.add(p - 1);
    } else {
      const p = parseInt(part, 10);
      if (p >= 1 && p <= pageCount) out.add(p - 1);
    }
  });
  return [...out].sort((a, b) => a - b);
}

// --- Dynamic Progress Bar Helpers ---
function setProgress(percent, msg) {
  const wrap = document.getElementById("wsProgressWrap") || createProgressUI();
  const fill = wrap.querySelector(".progress-fill");
  const text = wrap.querySelector(".progress-text");
  wrap.classList.add("active");
  fill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  if (msg) text.textContent = msg;
  if (percent >= 100) setTimeout(() => wrap.classList.remove("active"), 2000);
}

function createProgressUI() {
  const wrap = document.createElement("div");
  wrap.id = "wsProgressWrap";
  wrap.className = "progress-wrap";
  wrap.innerHTML = `<div class="progress-text status" style="margin-top:0;"></div><div class="progress-track"><div class="progress-fill"></div></div>`;
  wsStatus.parentNode.insertBefore(wrap, wsStatus);
  return wrap;
}

// --- Visual Page Renderer ---
async function renderVisualGrid(container, fileBytes) {
  container.innerHTML = '<div class="status">Rendering previews...</div>';
  const pdf = await pdfjsLib.getDocument({ data: fileBytes }).promise;
  const grid = document.createElement("div");
  grid.className = "thumb-grid";

  for (let i = 1; i <= pdf.numPages; i++) {
    setProgress(
      (i / pdf.numPages) * 100,
      `Loading page ${i} of ${pdf.numPages}...`,
    );
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 0.5 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext("2d"), viewport })
      .promise;

    const wrapper = document.createElement("div");
    wrapper.className = "thumb-item";
    wrapper.dataset.page = i - 1;
    wrapper.appendChild(canvas);
    wrapper.addEventListener("click", () =>
      wrapper.classList.toggle("selected"),
    );
    grid.appendChild(wrapper);
  }
  container.innerHTML = "";
  container.appendChild(grid);
  return grid;
}

const BUILDERS = {};

BUILDERS.placeholder = (root, tool) => {
  root.innerHTML = `
    <div class="api-placeholder" style="text-align: center; padding: 64px 32px; background: linear-gradient(145deg, rgba(217,56,56,0.08) 0%, rgba(9,9,11,0) 100%); border: 1px dashed var(--copper); border-radius: var(--radius);">
      <span style="font-size: 42px; display: block; margin-bottom: 20px; filter: drop-shadow(0 0 16px rgba(217,56,56,0.6));">⚡</span>
      <h3 style="margin-top:0; font-size: 28px; color:var(--ink); font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.02em;">Incoming Upgrade</h3>
      <p style="margin-bottom:0; font-size: 15px; color: var(--ink-soft); max-width: 480px; margin: 16px auto 0; line-height: 1.6;">
        <strong>${TOOL_TITLES[tool]}</strong> requires heavy-duty server processing. Zafeer is currently forging the backend infrastructure to bring this feature online.
        <br><br>
        <span style="color: var(--copper); font-family: 'IBM Plex Mono', monospace; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 500;">Status: Deploying Soon</span>
      </p>
    </div>
  `;
};

BUILDERS.merge = (root) => {
  let files = [];
  root.appendChild(
    makeDrop({
      multiple: true,
      accept: ".pdf",
      onFiles: (f) => {
        files.push(...f.filter((x) => x.type === "application/pdf"));
        render();
      },
    }),
  );
  const listWrap = document.createElement("div");
  root.appendChild(listWrap);
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Merge PDFs";
  btn.disabled = true;
  root.appendChild(btn);
  function render() {
    fileListUI(listWrap, files, { reorder: true });
    btn.disabled = files.length < 2;
  }
  btn.addEventListener("click", async () => {
    setStatus("Merging…");
    try {
      const merged = await PDFDocument.create();
      for (const f of files) {
        const src = await PDFDocument.load(await readAsArrayBuffer(f));
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      }
      downloadBlob(
        new Blob([await merged.save()], { type: "application/pdf" }),
        "merged.pdf",
      );
      setStatus("Done.");
    } catch (e) {
      setStatus("Error: " + e.message, true);
    }
  });
};

BUILDERS.split = (root) => {
  let file = null,
    pageCount = 0;
  root.appendChild(
    makeDrop({
      multiple: false,
      accept: ".pdf",
      onFiles: async (f) => {
        file = f[0];
        pageCount = (
          await PDFDocument.load(await readAsArrayBuffer(file))
        ).getPageCount();
        info.textContent = `${file.name} — ${pageCount} pages`;
      },
    }),
  );
  const info = document.createElement("div");
  info.className = "status";
  info.style.color = "var(--ink-soft)";
  root.appendChild(info);
  const row = document.createElement("div");
  row.className = "field-row";
  row.innerHTML = `<div class="field"><label>Mode</label><select id="splitMode"><option value="every">Every N pages (ZIP)</option><option value="range">Specific page ranges</option></select></div><div class="field" id="everyField"><label>N pages per file</label><input type="number" id="everyN" value="1" min="1"></div><div class="field" id="rangeField" style="display:none"><label>Pages (e.g. 1-3,5)</label><input type="text" id="rangeSpec" placeholder="1-3,5"></div>`;
  root.appendChild(row);
  row.querySelector("#splitMode").addEventListener("change", (e) => {
    row.querySelector("#everyField").style.display =
      e.target.value === "every" ? "" : "none";
    row.querySelector("#rangeField").style.display =
      e.target.value === "range" ? "" : "none";
  });
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Split PDF";
  root.appendChild(btn);
  btn.addEventListener("click", async () => {
    if (!file) return setStatus("Choose a PDF.", true);
    setStatus("Splitting…");
    try {
      const src = await PDFDocument.load(await readAsArrayBuffer(file));
      if (row.querySelector("#splitMode").value === "range") {
        const idxs = parsePageSpec(
          row.querySelector("#rangeSpec").value,
          pageCount,
        );
        if (!idxs.length) return setStatus("Invalid range.", true);
        const out = await PDFDocument.create();
        (await out.copyPages(src, idxs)).forEach((p) => out.addPage(p));
        downloadBlob(
          new Blob([await out.save()], { type: "application/pdf" }),
          "extracted.pdf",
        );
      } else {
        const n = parseInt(row.querySelector("#everyN").value, 10) || 1;
        const zip = new JSZip();
        for (let start = 0; start < pageCount; start += n) {
          const idxs = Array.from(
            { length: Math.min(n, pageCount - start) },
            (_, i) => start + i,
          );
          const out = await PDFDocument.create();
          (await out.copyPages(src, idxs)).forEach((p) => out.addPage(p));
          zip.file(
            `pages_${start + 1}-${idxs[idxs.length - 1] + 1}.pdf`,
            await out.save(),
          );
        }
        downloadBlob(await zip.generateAsync({ type: "blob" }), "split.zip");
      }
      setStatus("Done.");
    } catch (e) {
      setStatus("Error: " + e.message, true);
    }
  });
};

BUILDERS.rotate = (root) => {
  let file = null;
  root.appendChild(
    makeDrop({
      multiple: false,
      accept: ".pdf",
      onFiles: (f) => {
        file = f[0];
        label.textContent = file.name;
      },
    }),
  );
  const label = document.createElement("div");
  label.className = "status";
  label.style.color = "var(--ink-soft)";
  root.appendChild(label);
  const row = document.createElement("div");
  row.className = "field-row";
  row.innerHTML = `<div class="field"><label>Rotate by</label><select id="rotAngle"><option value="90">90° clockwise</option><option value="180">180°</option><option value="270">90° counter</option></select></div>`;
  root.appendChild(row);
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Rotate PDF";
  root.appendChild(btn);
  btn.addEventListener("click", async () => {
    if (!file) return;
    setStatus("Rotating…");
    try {
      const doc = await PDFDocument.load(await readAsArrayBuffer(file));
      const angle = parseInt(row.querySelector("#rotAngle").value, 10);
      doc
        .getPages()
        .forEach((p) =>
          p.setRotation(degrees((p.getRotation().angle + angle) % 360)),
        );
      downloadBlob(
        new Blob([await doc.save()], { type: "application/pdf" }),
        "rotated.pdf",
      );
      setStatus("Done.");
    } catch (e) {
      setStatus("Error: " + e.message, true);
    }
  });
};

BUILDERS.remove = (root) => {
  let fileBytes = null,
    doc = null,
    fileName = "";
  root.appendChild(
    makeDrop({
      multiple: false,
      accept: ".pdf",
      onFiles: async (f) => {
        fileName = f[0].name;
        fileBytes = await readAsArrayBuffer(f[0]);
        doc = await PDFDocument.load(fileBytes);
        await renderVisualGrid(gridContainer, fileBytes.slice(0));
        btn.disabled = false;
      },
    }),
  );

  const gridContainer = document.createElement("div");
  root.appendChild(gridContainer);

  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Delete Selected Pages";
  btn.disabled = true;
  root.appendChild(btn);

  btn.addEventListener("click", async () => {
    const selectedNodes = gridContainer.querySelectorAll(
      ".thumb-item.selected",
    );
    if (!selectedNodes.length)
      return setStatus("Select pages to delete.", true);

    setStatus("Removing pages...");
    try {
      const removeIdxs = new Set(
        Array.from(selectedNodes).map((n) => parseInt(n.dataset.page, 10)),
      );
      const keepIdxs = [...Array(doc.getPageCount()).keys()].filter(
        (i) => !removeIdxs.has(i),
      );

      if (!keepIdxs.length)
        return setStatus("You cannot delete every page.", true);

      const out = await PDFDocument.create();
      const copiedPages = await out.copyPages(doc, keepIdxs);
      copiedPages.forEach((p) => out.addPage(p));

      downloadBlob(
        new Blob([await out.save()], { type: "application/pdf" }),
        `cleaned_${fileName}`,
      );
      setStatus("Done.");
    } catch (e) {
      setStatus("Error: " + e.message, true);
    }
  });
};

BUILDERS.extract = (root) => {
  let fileBytes = null,
    doc = null,
    fileName = "";
  root.appendChild(
    makeDrop({
      multiple: false,
      accept: ".pdf",
      onFiles: async (f) => {
        fileName = f[0].name;
        fileBytes = await readAsArrayBuffer(f[0]);
        doc = await PDFDocument.load(fileBytes);
        await renderVisualGrid(gridContainer, fileBytes.slice(0));
        btn.disabled = false;
      },
    }),
  );

  const gridContainer = document.createElement("div");
  root.appendChild(gridContainer);

  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Extract Selected Pages";
  btn.disabled = true;
  root.appendChild(btn);

  btn.addEventListener("click", async () => {
    const selectedNodes = gridContainer.querySelectorAll(
      ".thumb-item.selected",
    );
    if (!selectedNodes.length)
      return setStatus("Click to select at least one page.", true);

    setStatus("Extracting pages...");
    try {
      const idxs = Array.from(selectedNodes)
        .map((n) => parseInt(n.dataset.page, 10))
        .sort((a, b) => a - b);
      const out = await PDFDocument.create();
      const copiedPages = await out.copyPages(doc, idxs);
      copiedPages.forEach((p) => out.addPage(p));

      downloadBlob(
        new Blob([await out.save()], { type: "application/pdf" }),
        `extracted_${fileName}`,
      );
      setStatus("Done.");
    } catch (e) {
      setStatus("Error: " + e.message, true);
    }
  });
};

BUILDERS.watermark = (root) => {
  let file = null;
  root.appendChild(
    makeDrop({
      multiple: false,
      accept: ".pdf",
      onFiles: (f) => {
        file = f[0];
        label.textContent = file.name;
      },
    }),
  );
  const label = document.createElement("div");
  label.className = "status";
  label.style.color = "var(--ink-soft)";
  root.appendChild(label);
  const row = document.createElement("div");
  row.className = "field-row";
  row.innerHTML = `<div class="field"><label>Watermark text</label><input type="text" id="wmText" value="CONFIDENTIAL"></div><div class="field"><label>Opacity</label><input type="range" id="wmOpacity" min="0.05" max="0.6" step="0.05" value="0.2"></div><div class="field"><label>Font size</label><input type="number" id="wmSize" value="48" min="8" max="200"></div>`;
  root.appendChild(row);
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Add watermark";
  root.appendChild(btn);
  btn.addEventListener("click", async () => {
    if (!file) return;
    setStatus("Stamping…");
    try {
      const doc = await PDFDocument.load(await readAsArrayBuffer(file));
      const font = await doc.embedFont(StandardFonts.HelveticaBold);
      const text = root.querySelector("#wmText").value || "CONFIDENTIAL";
      const opacity = parseFloat(root.querySelector("#wmOpacity").value);
      const size = parseInt(root.querySelector("#wmSize").value, 10);
      doc.getPages().forEach((p) => {
        const { width, height } = p.getSize();
        p.drawText(text, {
          x: width / 2 - font.widthOfTextAtSize(text, size) / 2,
          y: height / 2,
          size,
          font,
          color: rgb(0.1, 0.1, 0.1),
          opacity,
          rotate: degrees(45),
        });
      });
      downloadBlob(
        new Blob([await doc.save()], { type: "application/pdf" }),
        "watermarked.pdf",
      );
      setStatus("Done.");
    } catch (e) {
      setStatus("Error: " + e.message, true);
    }
  });
};

BUILDERS.pagenum = (root) => {
  let file = null;
  root.appendChild(
    makeDrop({
      multiple: false,
      accept: ".pdf",
      onFiles: (f) => {
        file = f[0];
        label.textContent = file.name;
      },
    }),
  );
  const label = document.createElement("div");
  label.className = "status";
  label.style.color = "var(--ink-soft)";
  root.appendChild(label);
  const row = document.createElement("div");
  row.className = "field-row";
  row.innerHTML = `<div class="field"><label>Position</label><select id="pnPos"><option value="bc">Bottom center</option><option value="br">Bottom right</option><option value="tc">Top center</option></select></div>`;
  root.appendChild(row);
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Add numbers";
  root.appendChild(btn);
  btn.addEventListener("click", async () => {
    if (!file) return;
    setStatus("Numbering…");
    try {
      const doc = await PDFDocument.load(await readAsArrayBuffer(file));
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pos = root.querySelector("#pnPos").value;
      const pages = doc.getPages();
      pages.forEach((p, i) => {
        const label = `${i + 1} / ${pages.length}`;
        const tw = font.widthOfTextAtSize(label, 11);
        let x, y;
        if (pos === "bc") {
          x = p.getSize().width / 2 - tw / 2;
          y = 24;
        } else if (pos === "br") {
          x = p.getSize().width - tw - 32;
          y = 24;
        } else {
          x = p.getSize().width / 2 - tw / 2;
          y = p.getSize().height - 32;
        }
        p.drawText(label, {
          x,
          y,
          size: 11,
          font,
          color: rgb(0.15, 0.15, 0.15),
        });
      });
      downloadBlob(
        new Blob([await doc.save()], { type: "application/pdf" }),
        "numbered.pdf",
      );
      setStatus("Done.");
    } catch (e) {
      setStatus("Error: " + e.message, true);
    }
  });
};

BUILDERS.img2pdf = (root) => {
  let files = [];
  root.appendChild(
    makeDrop({
      multiple: true,
      accept: "image/png,image/jpeg",
      onFiles: (f) => {
        files.push(...f.filter((x) => x.type.includes("image")));
        render();
      },
    }),
  );
  const listWrap = document.createElement("div");
  root.appendChild(listWrap);
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Create PDF";
  btn.disabled = true;
  root.appendChild(btn);
  function render() {
    fileListUI(listWrap, files, { reorder: true });
    btn.disabled = files.length === 0;
  }
  btn.addEventListener("click", async () => {
    if (!files.length) return;
    setStatus("Building PDF…");
    try {
      const doc = await PDFDocument.create();
      for (const f of files) {
        const img =
          f.type === "image/png"
            ? await doc.embedPng(await readAsArrayBuffer(f))
            : await doc.embedJpg(await readAsArrayBuffer(f));
        doc
          .addPage([img.width, img.height])
          .drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }
      downloadBlob(
        new Blob([await doc.save()], { type: "application/pdf" }),
        "images.pdf",
      );
      setStatus("Done.");
    } catch (e) {
      setStatus("Error: " + e.message, true);
    }
  });
};

BUILDERS.pdf2img = (root) => {
  let file = null;
  root.appendChild(
    makeDrop({
      multiple: false,
      accept: ".pdf",
      onFiles: (f) => {
        file = f[0];
        label.textContent = file.name;
      },
    }),
  );
  const label = document.createElement("div");
  label.className = "status";
  label.style.color = "var(--ink-soft)";
  root.appendChild(label);
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Export to ZIP";
  root.appendChild(btn);
  btn.addEventListener("click", async () => {
    if (!file) return;
    setStatus("Rendering pages…");
    try {
      const pdf = await pdfjsLib.getDocument({
        data: await readAsArrayBuffer(file),
      }).promise;
      const zip = new JSZip();
      for (let i = 1; i <= pdf.numPages; i++) {
        setProgress(
          (i / pdf.numPages) * 100,
          `Rendering page ${i} of ${pdf.numPages}...`,
        );
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport })
          .promise;
        const blob = await new Promise((res) =>
          canvas.toBlob(res, "image/png"),
        );
        zip.file(`page_${String(i).padStart(2, "0")}.png`, blob);
      }
      downloadBlob(await zip.generateAsync({ type: "blob" }), "pages.zip");
      setStatus("Done.");
    } catch (e) {
      setStatus("Error: " + e.message, true);
    }
  });
};

BUILDERS.html2pdf = (root) => {
  root.innerHTML = `<div class="field" style="width:100%; margin-bottom:16px;"><label>Paste HTML</label><textarea id="htmlInput" rows="10" style="width:100%; background:var(--paper-raised); color:var(--ink); border:1px solid var(--line); border-radius:var(--radius); padding:16px; font-family: monospace;"></textarea></div><button class="btn" id="h2pBtn">Convert to PDF</button>`;
  root.querySelector("#h2pBtn").addEventListener("click", () => {
    const htmlContent = root.querySelector("#htmlInput").value;
    if (!htmlContent.trim()) return setStatus("Paste HTML first.", true);
    setStatus("Rendering...");
    html2pdf()
      .set({
        margin: 10,
        filename: "html.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
      })
      .from(htmlContent)
      .save()
      .then(() => setStatus("Done."))
      .catch((e) => setStatus("Error: " + e.message, true));
  });
};

BUILDERS.ocr = (root) => {
  let file = null;
  root.appendChild(
    makeDrop({
      multiple: false,
      accept: "image/*",
      onFiles: (f) => {
        file = f[0];
        label.textContent = file.name;
        btn.disabled = false;
      },
    }),
  );
  const label = document.createElement("div");
  label.className = "status";
  label.style.color = "var(--ink-soft)";
  root.appendChild(label);
  const btn = document.createElement("button");
  btn.className = "btn";
  btn.textContent = "Extract Text";
  btn.disabled = true;
  root.appendChild(btn);
  btn.addEventListener("click", async () => {
    if (!file) return;
    setStatus("Analyzing text...");
    try {
      const {
        data: { text },
      } = await Tesseract.recognize(URL.createObjectURL(file), "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(
              m.progress * 100,
              `Reading: ${Math.round(m.progress * 100)}%`,
            );
          }
        },
      });
      const doc = await PDFDocument.create();
      const page = doc.addPage();
      page.drawText(text || "No text found.", {
        x: 40,
        y: page.getSize().height - 40,
        size: 12,
        font: await doc.embedFont(StandardFonts.Helvetica),
        color: rgb(0, 0, 0),
        maxWidth: page.getSize().width - 80,
        lineHeight: 16,
      });
      downloadBlob(
        new Blob([await doc.save()], { type: "application/pdf" }),
        "ocr.pdf",
      );
      setStatus("Done.");
    } catch (e) {
      setStatus("Error: " + e.message, true);
    }
  });
};

BUILDERS.esign = (root) => {
  let pdfBytes = null,
    pageNum = 1,
    sigDataUrl = null;
  root.appendChild(
    makeDrop({
      multiple: false,
      accept: ".pdf",
      onFiles: async (f) => {
        pdfBytes = await readAsArrayBuffer(f[0]);
        label.textContent = f[0].name;
        step2.style.display = "";
        await renderPage();
      },
    }),
  );
  const label = document.createElement("div");
  label.className = "status";
  label.style.color = "var(--ink-soft)";
  root.appendChild(label);
  const step2 = document.createElement("div");
  step2.style.display = "none";
  step2.innerHTML = `<h3 style="margin:20px 0 10px;font-size:15px;color:var(--ink);">1. Draw signature</h3><canvas id="sigCanvas" width="360" height="140"></canvas><br><button class="btn secondary" id="clearSig" style="margin-right:10px;">Clear</button><button class="btn secondary" id="useSig">Use</button><h3 style="margin:24px 0 10px;font-size:15px;color:var(--ink);">2. Place</h3><div class="field-row"><div class="field"><label>Page</label><input type="number" id="sigPage" value="1" min="1"></div></div><div id="sigPreviewWrap"><canvas id="sigPageCanvas"></canvas><div id="sigDraggable" style="display:none;width:140px;height:60px;"><img id="sigDragImg"></div></div><br><button class="btn" id="applySig" disabled>Sign & download</button>`;
  root.appendChild(step2);

  const c = step2.querySelector("#sigCanvas");
  const ctx = c.getContext("2d");
  ctx.lineWidth = 2.8;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#F2F2F2";
  let drawing = false;
  const pos = (e) => [
    (e.touches ? e.touches[0] : e).clientX - c.getBoundingClientRect().left,
    (e.touches ? e.touches[0] : e).clientY - c.getBoundingClientRect().top,
  ];
  c.addEventListener("mousedown", (e) => {
    drawing = true;
    ctx.beginPath();
    ctx.moveTo(...pos(e));
  });
  c.addEventListener("mousemove", (e) => {
    if (drawing) {
      ctx.lineTo(...pos(e));
      ctx.stroke();
    }
  });
  window.addEventListener("mouseup", () => (drawing = false));

  step2
    .querySelector("#clearSig")
    .addEventListener("click", () => ctx.clearRect(0, 0, c.width, c.height));
  step2.querySelector("#useSig").addEventListener("click", () => {
    sigDataUrl = c.toDataURL("image/png");
    const drag = step2.querySelector("#sigDraggable");
    step2.querySelector("#sigDragImg").src = sigDataUrl;
    drag.style.display = "flex";
    drag.style.left = "20px";
    drag.style.top = "20px";
    step2.querySelector("#applySig").disabled = false;
    setStatus("Drag onto page, then download.");
  });

  async function renderPage() {
    pageNum = parseInt(step2.querySelector("#sigPage").value, 10) || 1;
    const pdf = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
    const page = await pdf.getPage(
      Math.min(Math.max(1, pageNum), pdf.numPages),
    );
    const viewport = page.getViewport({ scale: 1.2 });
    const cPage = step2.querySelector("#sigPageCanvas");
    cPage.width = viewport.width;
    cPage.height = viewport.height;
    await page.render({ canvasContext: cPage.getContext("2d"), viewport })
      .promise;
  }
  step2.querySelector("#sigPage").addEventListener("change", renderPage);

  const dragEl = step2.querySelector("#sigDraggable");
  let dragOffset = null;
  dragEl.addEventListener("mousedown", (e) => {
    dragOffset = [
      e.clientX - dragEl.getBoundingClientRect().left,
      e.clientY - dragEl.getBoundingClientRect().top,
    ];
    e.preventDefault();
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragOffset) return;
    const wrap = step2.querySelector("#sigPreviewWrap").getBoundingClientRect();
    dragEl.style.left = e.clientX - wrap.left - dragOffset[0] + "px";
    dragEl.style.top = e.clientY - wrap.top - dragOffset[1] + "px";
  });
  window.addEventListener("mouseup", () => (dragOffset = null));

  step2.querySelector("#applySig").addEventListener("click", async () => {
    setStatus("Applying…");
    try {
      const doc = await PDFDocument.load(pdfBytes);
      const page = doc.getPages()[pageNum - 1];
      const canvasEl = step2.querySelector("#sigPageCanvas");
      const scaleX = page.getSize().width / canvasEl.width;
      const scaleY = page.getSize().height / canvasEl.height;
      const x = parseFloat(dragEl.style.left) * scaleX;
      const y =
        page.getSize().height -
        parseFloat(dragEl.style.top) * scaleY -
        dragEl.offsetHeight * scaleY;
      page.drawImage(await doc.embedPng(sigDataUrl), {
        x,
        y,
        width: dragEl.offsetWidth * scaleX,
        height: dragEl.offsetHeight * scaleY,
      });
      downloadBlob(
        new Blob([await doc.save()], { type: "application/pdf" }),
        "signed.pdf",
      );
      setStatus("Done.");
    } catch (e) {
      setStatus("Error: " + e.message, true);
    }
  });
};
