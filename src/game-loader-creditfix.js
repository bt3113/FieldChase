(async () => {
  const response = await fetch('src/game-loader.js?v=33', { cache: 'no-store' });
  let loader = await response.text();

  loader = loader.replace(
    "ctx.fillText('Copyright: Paramount Pictures, Warner Bros. Entertainment, and Legendary Pictures', W / 2, H - 42);\\n    ctx.fillText('Maker: QuantumPikachu (Reddit)', W / 2, H - 27);",
    "ctx.font = '700 9px Montserrat, Arial, sans-serif';\\n    ctx.fillText('Maker: QuantumPikachu (Reddit)', W / 2, H - 42);\\n    ctx.font = '500 9px Montserrat, Arial, sans-serif';\\n    ctx.fillText('Copyright: Paramount Pictures, Warner Bros. Entertainment, and Legendary Pictures', W / 2, H - 27);"
  );

  (0, eval)(loader + '\n//# sourceURL=fieldchase-loader-creditfix-runtime.js');
})();