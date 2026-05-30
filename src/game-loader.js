(async () => {
  const baseUrl = 'src/game.js?base=15';
  const response = await fetch(baseUrl, { cache: 'no-store' });
  let code = await response.text();

  code = code.replace(
    /fetch\('assets\/menu-bg\.txt\?v=15', \{ cache: 'no-store' \}\)[\s\S]*?\.catch\(\(\) => \{ menuBgReady = false; \}\);/,
    "menuBg.onload = () => { menuBgReady = true; };\n  menuBg.src = 'assets/70282CA7-7E9E-472D-A931-2D9E3FAF72AF.jpg?v=18';"
  );

  code = code.replace(
    "    stroke(16, 36, W - 32, H - 82, 'rgba(246,237,214,0.58)', 2);\n    stroke(24, 44, W - 48, H - 98, 'rgba(246,237,214,0.20)', 1);",
    "    ctx.shadowColor = 'rgba(0,0,0,0.85)';\n    ctx.shadowBlur = 8;\n    stroke(0, 0, W, H, '#f6edd6', 10);\n    ctx.shadowBlur = 0;\n    stroke(12, 12, W - 24, H - 24, 'rgba(246,237,214,0.86)', 2);"
  );

  code = code.replace(
    "    const fill = primary ? 'rgba(2,11,23,0.95)' : 'rgba(0,0,0,0.66)';\n    rect(b.x, b.y, b.w, b.h, fill);\n    stroke(b.x, b.y, b.w, b.h, primary ? '#0a2542' : 'rgba(246,237,214,0.42)', 2);\n    if (primary) stroke(b.x + 5, b.y + 5, b.w - 10, b.h - 10, 'rgba(246,237,214,0.13)', 1);",
    "    const fill = primary ? '#000000' : 'rgba(0,0,0,0.66)';\n    rect(b.x, b.y, b.w, b.h, fill);\n    stroke(b.x, b.y, b.w, b.h, primary ? '#061b36' : 'rgba(246,237,214,0.42)', primary ? 4 : 2);\n    if (primary) stroke(b.x + 7, b.y + 7, b.w - 14, b.h - 14, '#0d2d55', 1.5);"
  );

  code = code.replace(
    "      ctx.imageSmoothingEnabled = false;\n      ctx.drawImage(menuBg, (W - dw) / 2, (H - dh) / 2, dw, dh);\n      ctx.imageSmoothingEnabled = false;",
    "      ctx.imageSmoothingEnabled = true;\n      ctx.drawImage(menuBg, (W - dw) / 2, (H - dh) / 2, dw, dh);\n      ctx.imageSmoothingEnabled = false;"
  );

  (0, eval)(code + '\n//# sourceURL=fieldchase-runtime.js');
})();