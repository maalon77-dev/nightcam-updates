/**
 * Download de MP4 hospedados fora (catbox etc.) — celular + computador.
 * Ordem: XHR blob → fetch opaque → iOS share URL → abrir arquivo no navegador.
 */
(function (global) {
  function isIOS() {
    return (
      /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }
  function isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }
  function isMobile() {
    return isIOS() || isAndroid();
  }

  function saveBlob(blob, fname) {
    var obj = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.style.display = 'none';
    a.href = obj;
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      a.remove();
      URL.revokeObjectURL(obj);
    }, 3000);
  }

  function xhrBlob(url, onProgress) {
    return new Promise(function (resolve, reject) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'blob';
      xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300 && xhr.response && xhr.response.size > 0) {
          resolve(xhr.response);
        } else {
          reject(new Error('xhr ' + xhr.status));
        }
      };
      xhr.onerror = function () {
        reject(new Error('xhr network'));
      };
      xhr.onprogress = function (e) {
        if (onProgress && e.lengthComputable && e.total > 0) {
          onProgress(Math.min(99, Math.round((100 * e.loaded) / e.total)));
        }
      };
      xhr.send();
    });
  }

  function fetchNoCorsBlob(url) {
    return fetch(url, { mode: 'no-cors', credentials: 'omit', cache: 'no-store' }).then(
      function (res) {
        return res.blob();
      }
    ).then(function (blob) {
      if (blob && blob.size > 10000) return blob;
      throw new Error('blob small');
    });
  }

  async function shareUrl(url, fname) {
    if (!navigator.share) return false;
    try {
      var payload = { title: 'NightCam – ' + fname, text: fname };
      if (navigator.canShare && navigator.canShare({ url: url })) {
        payload.url = url;
      } else {
        payload.text = fname + '\n' + url;
      }
      await navigator.share(payload);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function shareFile(blob, fname) {
    if (!navigator.share) return false;
    try {
      var file = new File([blob], fname, { type: blob.type || 'video/mp4' });
      if (navigator.canShare && !navigator.canShare({ files: [file] })) return false;
      await navigator.share({ files: [file], title: 'NightCam' });
      return true;
    } catch (e) {
      return false;
    }
  }

  function openFileUrl(url) {
    var a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (!isMobile()) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  /**
   * @param {string} url MP4 público
   * @param {string} fname nome do arquivo
   * @param {{ onStatus?: function(string), onProgress?: function(number), onDone?: function() }} cb
   */
  async function downloadVideo(url, fname, cb) {
    cb = cb || {};
    var onStatus = cb.onStatus || function () {};
    var onProgress = cb.onProgress || function () {};
    var onDone = cb.onDone || function () {};
    fname = fname || 'nightcam_video.mp4';

    onStatus('Baixando…');
    onProgress(0);

    try {
      var blob = await xhrBlob(url, onProgress);
      saveBlob(blob, fname);
      onProgress(100);
      if (isIOS()) {
        await shareFile(blob, fname);
        onStatus('Pronto. Veja Arquivos ou Downloads.');
      } else if (isAndroid()) {
        onStatus('Download iniciado — pasta Downloads ou notificação do Chrome.');
      } else {
        onStatus('Download iniciado — pasta Downloads do navegador.');
      }
      onDone();
      return;
    } catch (e1) {}

    try {
      onProgress(40);
      var blob2 = await fetchNoCorsBlob(url);
      saveBlob(blob2, fname);
      onProgress(100);
      onStatus('Arquivo salvo.');
      onDone();
      return;
    } catch (e2) {}

    if (isIOS()) {
      if (await shareUrl(url, fname)) {
        onStatus('Escolha “Salvar em Arquivos” na lista.');
        onDone();
        return;
      }
      onStatus('Segure o player → “Salvar vídeo” (ou ícone compartilhar).');
      onDone();
      return;
    }

    openFileUrl(url);
    onProgress(100);
    if (isAndroid()) {
      onStatus('Arquivo aberto — menu ⋮ → Baixar ou Compartilhar → Salvar.');
    } else {
      onStatus('Arquivo aberto — use Ctrl+S, botão ⬇ do player ou “Salvar como…”.');
    }
    onDone();
  }

  global.NightCamDownload = {
    downloadVideo: downloadVideo,
    isIOS: isIOS,
    isAndroid: isAndroid,
    isMobile: isMobile
  };
})(typeof window !== 'undefined' ? window : this);
