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
      const pieces = new Array(manifest.chunks.length);
      let loaded = 0;
      let next = 0;
      const controller = new AbortController();
      async function readPart(part) {
        for (let attempt = 0; ; attempt++) {
          try {
            const response = await fetch('./pack-120/' + part.file, {signal:controller.signal});
            if (!response.ok) throw new Error('network');
            return await response.arrayBuffer();
          } catch (error) {
            if (attempt >= 2 || controller.signal.aborted) throw error;
            await new Promise(resolve => setTimeout(resolve, 700 * (attempt + 1)));
          }
        }
      }
      async function downloadParts() {
        while (next < pieces.length && !controller.signal.aborted) {
          const index = next++;
          const part = manifest.chunks[index];
          const ciphertext = await readPart(part);
          const bytes = await crypto.subtle.decrypt({name:'AES-GCM',iv:fromBase64(part.iv)}, key, ciphertext);
          if (bytes.byteLength !== part.size) throw new Error('size');
          pieces[index] = new Blob([bytes]);
          loaded += bytes.byteLength;
          progress.value = Math.floor(100 * loaded / manifest.bytes);
          status.textContent = 'Скачано '+Math.round(loaded/1e6)+' из '+Math.round(manifest.bytes/1e6)+' МБ · '+progress.value+'%';
        }
      }
      try {
        await Promise.all(Array.from({length:Math.min(4,pieces.length)}, downloadParts));
      } finally { controller.abort(); }
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
