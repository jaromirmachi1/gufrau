(() => {
  const root = document.querySelector('[data-gufrau-discography]');
  if (!root) return;

  const artistId = root.dataset.artistId || '192826687';
  const spotifyId = root.dataset.spotifyId || '0WpBMqO4ai8W3rh3ffW14Q';
  const list = root.querySelector('[data-releases]');
  const status = root.querySelector('[data-status]');
  const audio = root.querySelector('[data-audio]');
  const spotifyArtist = `https://open.spotify.com/artist/${spotifyId}`;

  let playingButton = null;

  const spotifySearch = (title) =>
    `https://open.spotify.com/search/${encodeURIComponent(`${title} GUFRAU`)}`;

  const esc = (value) =>
    String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');

  const clock = (seconds) => {
    const total = Number(seconds) || 0;
    const minutes = Math.floor(total / 60);
    const remain = total % 60;
    return `${minutes}:${String(remain).padStart(2, '0')}`;
  };

  const setStatus = (message) => {
    if (!status) return;
    status.hidden = !message;
    status.textContent = message || '';
  };

  const stop = () => {
    if (!audio) return;
    audio.pause();
    audio.removeAttribute('src');
    if (playingButton) {
      playingButton.dataset.state = 'paused';
      playingButton.setAttribute('aria-label', playingButton.dataset.playLabel || 'Play preview');
      playingButton = null;
    }
  };

  const play = (button, src) => {
    if (!audio || !src) {
      window.open(button.dataset.spotify, '_blank', 'noopener');
      return;
    }
    if (playingButton === button) {
      stop();
      return;
    }
    stop();
    audio.src = src;
    audio.play().then(() => {
      playingButton = button;
      button.dataset.state = 'playing';
      button.setAttribute('aria-label', 'Pause preview');
    }).catch(() => {
      window.open(button.dataset.spotify, '_blank', 'noopener');
    });
  };

  if (audio) {
    audio.addEventListener('ended', stop);
  }

  const releaseMarkup = (release) => {
    const tracks = release.tracks
      .map((track, index) => {
        const spotify = spotifySearch(track.title);
        return `
          <li class="gufrau-discography__track">
            <span class="gufrau-discography__index">${String(index + 1).padStart(2, '0')}</span>
            <span class="gufrau-discography__name">${esc(track.title)}</span>
            <span class="gufrau-discography__time">${clock(track.duration)}</span>
            <button
              class="gufrau-discography__play"
              type="button"
              data-state="paused"
              data-src="${track.preview || ''}"
              data-spotify="${spotify}"
              data-play-label="Play ${esc(track.title)}"
              aria-label="Play ${esc(track.title)}"
            >
              <span class="gufrau-discography__glyph" aria-hidden="true"></span>
            </button>
            <a class="gufrau-discography__open" href="${spotify}" target="_blank" rel="noopener noreferrer">Spotify</a>
          </li>
        `;
      })
      .join('');

    return `
      <article class="gufrau-discography__release">
        <a class="gufrau-discography__cover" href="${spotifySearch(release.title)}" target="_blank" rel="noopener noreferrer">
          <img src="${release.cover}" alt="" width="240" height="240">
        </a>
        <div class="gufrau-discography__body">
          <header class="gufrau-discography__release-head">
            <h2>${esc(release.title)}</h2>
            <p>${release.year} · ${release.kind}</p>
          </header>
          <ol class="gufrau-discography__tracks">${tracks}</ol>
        </div>
      </article>
    `;
  };

  root.addEventListener('click', (event) => {
    const button = event.target.closest('.gufrau-discography__play');
    if (!button || !root.contains(button)) return;
    play(button, button.dataset.src);
  });

  const jsonp = (url) =>
    new Promise((resolve, reject) => {
      const cb = `gufrauCb${Math.random().toString(36).slice(2)}`;
      const script = document.createElement('script');
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error('catalog'));
      }, 12000);
      const cleanup = () => {
        window.clearTimeout(timer);
        delete window[cb];
        script.remove();
      };
      window[cb] = (data) => {
        cleanup();
        resolve(data);
      };
      script.onerror = () => {
        cleanup();
        reject(new Error('catalog'));
      };
      const join = url.includes('?') ? '&' : '?';
      script.src = `${url}${join}output=jsonp&callback=${cb}`;
      document.head.appendChild(script);
    });

  const load = async () => {
    setStatus('Loading catalog…');
    const indexJson = await jsonp(`https://api.deezer.com/artist/${artistId}/albums?limit=100`);
    const albums = indexJson.data || [];

    const detailed = await Promise.all(
      albums.map(async (album) => {
        const json = await jsonp(`https://api.deezer.com/album/${album.id}`);
        if (!json || json.error) return null;
        const tracks = (json.tracks && json.tracks.data) || [];
        return {
          id: album.id,
          title: json.title || album.title,
          cover: json.cover_medium || album.cover_medium,
          date: json.release_date || album.release_date || '',
          year: (json.release_date || album.release_date || '').slice(0, 4),
          kind: json.record_type || album.record_type || 'release',
          tracks: tracks.map((track) => ({
            title: track.title,
            duration: track.duration,
            preview: track.preview,
          })),
        };
      })
    );

    const releases = detailed
      .filter((release) => release && release.tracks.length)
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    if (!releases.length) {
      setStatus('No releases yet.');
      return;
    }

    list.innerHTML = releases.map(releaseMarkup).join('');
    setStatus('');
  };

  const spotifyLink = root.querySelector('[data-spotify-artist]');
  if (spotifyLink) spotifyLink.href = spotifyArtist;

  load().catch(() => {
    setStatus('The catalog didn’t load.');
    if (list) {
      list.innerHTML = `<p class="gufrau-discography__fallback"><a href="${spotifyArtist}">Open GUFRAU on Spotify</a></p>`;
    }
  });
})();
