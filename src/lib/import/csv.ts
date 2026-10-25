/** Parser CSV kecil: kutip ganda, koma/titik koma (Excel Indonesia memakai ';'), BOM, CRLF. */
export function detectDelimiter(headerLine: string): "," | ";" | "\t" {
  let inQ = false, c = 0, s = 0, t = 0;
  for (const ch of headerLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ) { if (ch === ",") c++; else if (ch === ";") s++; else if (ch === "\t") t++; }
  }
  if (t > c && t > s) return "\t";
  return s > c ? ";" : ",";
}

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const delim = detectDelimiter(src.split(/\r?\n/, 1)[0] ?? "");
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQ = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
