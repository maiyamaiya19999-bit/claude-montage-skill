(() => {
  const button = document.querySelector('#get-pack');
  const status = document.querySelector('#pack-status');
  const progress = document.querySelector('#pack-progress');
  const save = document.querySelector('#save-pack');
  const token = new URLSearchParams(location.hash.slice(1)).get('pack');
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  if (!window.crypto?.subtle) {
    status.textContent = 'Открой эту ссылку в Safari, Chrome или Edge по HTTPS.';
    return;
  }
  button.disabled = false;
  status.textContent = 'В архиве — скилл для Codex, проект Remotion, шрифты, музыка и вставки. Удобнее скачать на компьютер.';
  const fromBase64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
  button.addEventListener('click', async () => {
    if (save.href && !save.hidden) { save.click(); return; }
    button.disabled = true;
    progress.hidden = false;
    progress.value = 0;
    status.textContent = 'Подготавливаем архив…';
    try {
      const key = await crypto.subtle.importKey('raw', fromBase64(token.replace(/-/g,'+').replace(/_/g,'/')+'='), 'AES-GCM', false, ['decrypt']);
      const response = await fetch('./pack-120/manifest.json');
      if (!response.ok) throw new Error('network');
      const manifest = await response.json();
      const pieces = [];
      let loaded = 0;
      for (const part of manifest.chunks) {
        const response = await fetch('./pack-120/' + part.file);
        if (!response.ok) throw new Error('network');
        const bytes = await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(part.iv)}, key, await response.arrayBuffer());
        if (bytes.byteLength !== part.size) throw new Error('size');
        pieces.push(new Blob([bytes]));
        loaded += bytes.byteLength;
        progress.value = Math.floor(100 * loaded / manifest.bytes);
        status.textContent = 'Скачивание · '+progress.value+'%';
      }
      if (loaded !== manifest.bytes) throw new Error('size');
      save.href = URL.createObjectURL(new Blob(pieces,{type:'application/zip'}));
      save.hidden = false;
      save.click();
      button.textContent = 'Сохранить архив';
      status.textContent = 'Архив готов. Если сохранение не началось, нажми «Сохранить архив». Затем распакуй ZIP и открой «Начать здесь.html».';
    } catch (error) {
      progress.hidden = true;
      status.textContent = error.name === 'OperationError'
        ? 'Проверь, что ссылка от Майи скопирована целиком, и открой её ещё раз.'
        : 'Скачивание прервалось. Проверь соединение и нажми кнопку ещё раз.';
    } finally { button.disabled = false; }
  });
})();
