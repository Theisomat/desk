/* Hand-drawn canvas charts. No library. devicePixelRatio aware. */
(function () {
  const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function setup(cv) {
    const dpr = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const x = cv.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); return [x, r.width, r.height];
  }
  const state = new WeakMap();
  // Home line: points [[ts,val]], start value, marks [{ts,kind,text}]
  function line(cv, pts, start, marks) {
    const prev = state.get(cv) || { n: 0 }; const grew = pts.length > prev.n && prev.n > 0;
    state.set(cv, { n: pts.length });
    const t0 = performance.now(), dur = grew && !RM ? 250 : 0, mt0 = t0;
    function frame(now) {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1, mk = RM ? 1 : Math.min(1, (now - mt0) / 200);
      draw(k, mk); if (k < 1 || mk < 1) requestAnimationFrame(frame);
    }
    function draw(k, mk) {
      const [x, W, H] = setup(cv); x.clearRect(0, 0, W, H);
      const top = 54, bot = H - 10;
      const vals = pts.map(p => p[1]).concat([start]);
      let lo = Math.min(...vals), hi = Math.max(...vals); if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
      const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
      const Y = v => bot - (v - lo) / (hi - lo) * (bot - top);
      const ta = pts.length ? pts[0][0] : 0, tb = pts.length ? pts[pts.length - 1][0] : 1;
      const X = t => tb > ta ? 12 + (t - ta) / (tb - ta) * (W - 24) : W / 2;
      // dashed start line
      x.setLineDash([3, 5]); x.strokeStyle = "rgba(235,235,245,0.3)"; x.lineWidth = 1;
      x.beginPath(); x.moveTo(0, Y(start)); x.lineTo(W, Y(start)); x.stroke(); x.setLineDash([]);
      if (pts.length < 2) return;
      const n = pts.length, lastX = X(pts[n - 2][0]) + (X(pts[n - 1][0]) - X(pts[n - 2][0])) * k;
      const lastY = Y(pts[n - 2][1]) + (Y(pts[n - 1][1]) - Y(pts[n - 2][1])) * k;
      x.beginPath(); pts.slice(0, n - 1).forEach((p, i) => i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1]))); x.lineTo(lastX, lastY);
      const g = x.createLinearGradient(0, top, 0, bot); g.addColorStop(0, "rgba(0,211,90,0.28)"); g.addColorStop(1, "rgba(0,211,90,0)");
      x.save(); x.lineTo(lastX, bot); x.lineTo(X(pts[0][0]), bot); x.closePath(); x.fillStyle = g; x.fill(); x.restore();
      x.beginPath(); pts.slice(0, n - 1).forEach((p, i) => i ? x.lineTo(X(p[0]), Y(p[1])) : x.moveTo(X(p[0]), Y(p[1]))); x.lineTo(lastX, lastY);
      x.strokeStyle = "#00d35a"; x.lineWidth = 2; x.lineJoin = "round"; x.stroke();
      x.fillStyle = "#00d35a"; x.beginPath(); x.arc(lastX, lastY, 4, 0, 7); x.fill();
      // marks above the line, never overlap: a later mark moves up a row
      x.font = "600 12px -apple-system, sans-serif"; x.globalAlpha = mk;
      const placed = [];
      (marks || []).filter(m => m.ts >= ta && m.ts <= tb).sort((a, b) => a.ts - b.ts).forEach(m => {
        const w = x.measureText(m.text).width + 14, cx = Math.max(w / 2, Math.min(W - w / 2, X(m.ts)));
        let row = 0; while (placed.some(p => p.row === row && Math.abs(p.cx - cx) < (p.w + w) / 2 + 4)) row++;
        placed.push({ cx, w, row });
        const y = 6 + row * 24; if (y > top - 6 && row > 0) return;
        const col = m.kind === "buy" ? "#0a84ff" : m.kind === "win" ? "#00d35a" : "#ff453a";
        x.fillStyle = col; rr(x, cx - w / 2, y, w, 20, 10); x.fill();
        x.fillStyle = m.kind === "buy" ? "#fff" : "#000"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(m.text, cx, y + 10);
      });
      x.globalAlpha = 1;
    }
    requestAnimationFrame(frame);
  }
  function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  // Coin candles: [[ts,o,h,l,c,vol]], exit line price or null
  function candles(cv, cs, exitLine) {
    const [x, W, H] = setup(cv); x.clearRect(0, 0, W, H);
    if (!cs.length) { x.fillStyle = "rgba(235,235,245,0.6)"; x.font = "15px -apple-system"; x.textAlign = "center"; x.fillText("No candles yet", W / 2, H / 2); return; }
    const vh = 40, top = 10, bot = H - vh - 8;
    let lo = Math.min(...cs.map(c => c[3])), hi = Math.max(...cs.map(c => c[2]));
    if (exitLine) { lo = Math.min(lo, exitLine); hi = Math.max(hi, exitLine); }
    if (hi - lo < 1e-15) { hi *= 1.01; lo *= 0.99; }
    const Y = v => bot - (v - lo) / (hi - lo) * (bot - top), bw = Math.max(2, Math.min(10, (W - 20) / cs.length - 2));
    const vmax = Math.max(1, ...cs.map(c => c[5]));
    cs.forEach((c, i) => {
      const cx = 10 + (i + 0.5) * (W - 20) / cs.length, up = c[4] >= c[1], col = up ? "#00d35a" : "#ff453a";
      x.strokeStyle = col; x.fillStyle = col; x.beginPath(); x.moveTo(cx, Y(c[2])); x.lineTo(cx, Y(c[3])); x.stroke();
      const a = Y(Math.max(c[1], c[4])), b = Y(Math.min(c[1], c[4])); x.fillRect(cx - bw / 2, a, bw, Math.max(1, b - a));
      x.globalAlpha = 0.45; const vhh = c[5] / vmax * vh; x.fillRect(cx - bw / 2, H - vhh, bw, vhh); x.globalAlpha = 1;
    });
    if (exitLine) {
      x.setLineDash([5, 4]); x.strokeStyle = "#ff9f0a"; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, Y(exitLine)); x.lineTo(W, Y(exitLine)); x.stroke(); x.setLineDash([]);
      x.fillStyle = "#ff9f0a"; x.font = "600 11px -apple-system"; x.textAlign = "left"; x.fillText("Risk trailing stop", 8, Y(exitLine) - 5);
    }
  }
  function ring(cv, score) {
    const [x, W, H] = setup(cv), r = Math.min(W, H) / 2 - 8, cx = W / 2, cy = H / 2;
    x.clearRect(0, 0, W, H); x.lineWidth = 10; x.lineCap = "round";
    x.strokeStyle = "#2c2c2e"; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
    if (score != null) { x.strokeStyle = score >= 70 ? "#00d35a" : "#ffd60a"; x.beginPath(); x.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * score / 100); x.stroke(); }
    x.fillStyle = "#fff"; x.font = "700 32px -apple-system"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(score == null ? "–" : score, cx, cy);
  }
  window.Charts = { line, candles, ring };
})();
