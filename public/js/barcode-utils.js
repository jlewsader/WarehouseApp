// Shared GS1 barcode parser
function parseGS1(raw) {
  if (!raw) return { raw: raw || "", gtin: null, lot: null };

  // normalize: remove parentheses and spaces, keep ASCII GS (\x1D) if present
  let s = String(raw).replace(/[\(\)\s]/g, "");

  // If there are GS separators, split into tokens for easier parsing
  const GS = "\x1D";
  const tokens = s.includes(GS) ? s.split(GS).filter(Boolean) : null;

  let gtin = null;
  let lot = null;

  // helper: try to extract lot from a tail string (stop at next AI or end)
  const extractLotFromTail = (tail) => {
    if (!tail) return null;
    // stop at next known AI start: 01(14), 17(6), 21(variable), 00(18)
    const aiPattern = /(01\d{14}|17\d{6}|00\d{18}|21\d{1,20})/;
    const m = tail.match(aiPattern);
    if (m) {
      return tail.substring(0, m.index);
    }
    return tail;
  };

  // If tokens exist (scanner emitted GS separators), parse tokens individually
  if (tokens) {
    for (const t of tokens) {
      // AI may be two digits or three — handle common ones
      if (/^01\d{14}/.test(t)) {
        gtin = t.match(/^01(\d{14})/)[1];
      } else if (/^10/.test(t)) {
        const val = t.replace(/^10/, "");
        lot = (val === "" ? null : val);
      } else {
        // other tokens ignored for now
      }
    }
    if (!lot && tokens.length > 0) {
      // fallback: if last token doesn't start with known AI, consider it lot
      const last = tokens[tokens.length - 1];
      if (!/^0\d/.test(last)) lot = last;
    }
    // final trim
    if (typeof lot === "string") lot = lot.trim();
    return { raw, gtin, lot };
  }

  // No GS tokens: attempt to find AI(01) explicitly
  const m01 = s.match(/01(\d{14})/);
  if (m01) {
    gtin = m01[1];
    const afterGtinIndex = m01.index + 2 + 14;
    // look for '10' after the GTIN
    const pos10 = s.indexOf("10", afterGtinIndex);
    if (pos10 >= 0) {
      // candidate lot text after '10'
      let candidate = s.substring(pos10 + 2);
      // if candidate contains '01' + 14 digits etc, trim before that
      candidate = extractLotFromTail(candidate);
      lot = candidate.replace(/\x1D/g, "").trim();
      return { raw, gtin, lot };
    } else {
      // no explicit '10' found; maybe lot immediately follows GTIN w/o AI tag
      let tail = s.substring(afterGtinIndex);
      tail = extractLotFromTail(tail);
      if (tail && tail.length > 0) {
        lot = tail.replace(/\x1D/g, "").trim();
      }
      return { raw, gtin, lot };
    }
  }

  // No explicit AI(01) — fallback: if string starts with 14 digits, treat as GTIN
  const start14 = s.match(/^(\d{14})(.*)$/);
  if (start14) {
    gtin = start14[1];
    const tail = start14[2] || "";
    // look for '10' at start of tail
    if (tail.startsWith("10")) {
      let candidate = tail.substring(2);
      candidate = extractLotFromTail(candidate);
      lot = candidate.replace(/\x1D/g, "").trim();
    } else {
      // otherwise treat tail as lot
      const candidate = extractLotFromTail(tail);
      if (candidate && candidate.length > 0) lot = candidate.replace(/\x1D/g, "").trim();
    }
    return { raw, gtin, lot };
  }

  // Last-resort: find '10' anywhere and take remainder as lot
  const pos10any = s.indexOf("10");
  if (pos10any >= 0) {
    let candidate = s.substring(pos10any + 2);
    candidate = extractLotFromTail(candidate);
    lot = candidate.replace(/\x1D/g, "").trim();
  }

  return { raw, gtin, lot };
}

// Expose globally for legacy scripts
if (typeof window !== "undefined") {
  window.parseGS1 = parseGS1;
}
