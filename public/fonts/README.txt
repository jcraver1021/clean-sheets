bravura.ttf — how it got here and how to regenerate it
========================================================

Source: the @vexflow-fonts/bravura npm package (OFL-1.1 license, see
BRAVURA-LICENSE.txt) — the same Bravura build VexFlow itself uses for
on-screen rendering. It ships bravura.otf, which is CFF-flavored OpenType
(a "CFF " table, no "glyf" table).

Why converted: jsPDF's bundled font embedder (io/pdf-export.ts) only
understands TrueType glyf-outline fonts. Feeding it the stock CFF-flavored
OTF directly fails silently — glyphs render as blank/zero-size text. This
file is a TrueType-outline conversion of the same font, made with
fontTools' cu2qu (cubic-to-quadratic curve fitting), via the otf2ttf CLI.

To regenerate:

    pip install fonttools cu2qu otf2ttf
    npm install -D @vexflow-fonts/bravura   # temporary, just to get the .otf
    otf2ttf node_modules/@vexflow-fonts/bravura/bravura.otf -o public/fonts/bravura.ttf
    npm uninstall @vexflow-fonts/bravura    # not needed at runtime; the .ttf is checked in

Verify the result actually has TrueType outlines (not still CFF) before
trusting it — a quick check in Node:

    const fs = require("fs");
    const buf = fs.readFileSync("public/fonts/bravura.ttf");
    const numTables = buf.readUInt16BE(4);
    const tags = Array.from({ length: numTables }, (_, i) =>
      buf.toString("ascii", 12 + i * 16, 16 + i * 16),
    );
    console.log(tags.includes("glyf"), tags.includes("CFF "));
    // should print: true false
