(async () => {
  const response = await fetch('src/game-loader.js?v=33', { cache: 'no-store' });
  let loader = await response.text();

  loader = loader.replace(
    "ctx.font = '500 9px Montserrat, Arial, sans-serif';\n    ctx.fillText('Copyright: Paramount Pictures, Warner Bros. Entertainment, and Legendary Pictures', W / 2, H - 42);\n    ctx.fillText('Maker: QuantumPikachu (Reddit)', W / 2, H - 27);",
    "ctx.font = '700 9px Montserrat, Arial, sans-serif';\n    ctx.fillText('Maker: QuantumPikachu (Reddit)', W / 2, H - 42);\n    ctx.font = '500 9px Montserrat, Arial, sans-serif';\n    ctx.fillText('Copyright: Paramount Pictures, Warner Bros. Entertainment, and Legendary Pictures', W / 2, H - 27);"
  );

  loader = loader.replace(
    "ctx.fillText('Copyright: Paramount Pictures, Warner Bros. Entertainment, and Legendary Pictures', W / 2, H - 42);\n    ctx.fillText('Maker: QuantumPikachu (Reddit)', W / 2, H - 27);",
    "ctx.font = '700 9px Montserrat, Arial, sans-serif';\n    ctx.fillText('Maker: QuantumPikachu (Reddit)', W / 2, H - 42);\n    ctx.font = '500 9px Montserrat, Arial, sans-serif';\n    ctx.fillText('Copyright: Paramount Pictures, Warner Bros. Entertainment, and Legendary Pictures', W / 2, H - 27);"
  );

  loader = loader.replace(
    "ctx.fillText('BRAKE', W / 2, 164);",
    "ctx.fillText('TOM', W / 2, 164);"
  );

  loader = loader.replace(
    "ctx.fillText('HOLD BEFORE THE SHORELINE', W / 2, 178);",
    "ctx.fillText('Hit the brake!', W / 2, 178);"
  );

  loader = loader.replace(
    "ctx.fillText('HOLD BEFORE THE CLIFF', W / 2, 178);",
    "ctx.fillText('Hit the brake!', W / 2, 178);"
  );

  (0, eval)(loader + '\n//# sourceURL=fieldchase-loader-creditfix-runtime.js');
})();