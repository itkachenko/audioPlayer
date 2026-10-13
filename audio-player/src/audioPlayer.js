import { throttle } from './utils/throttle.js';

const formatTime = (seconds) => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
};

const fullDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const monthYearFormatter = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
});

const formatDate = (date, type = 'full') => {
  const [year, month, day] = date.split('-');
  const dateObj = new Date(year, month - 1, day);

  return type === 'm-y'
    ? monthYearFormatter.format(dateObj)
    : fullDateFormatter.format(dateObj);
};

const normalizePath = (path) => {
  if (!path) return '';
  return path.trim().replace(/^\/+/, '');
};

const getUrlDate = () => {
  const path = window.location.pathname;
  const match = path.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
};

export class ArticlesAudioPlayer {
  static EDITIONS_API = '/mock-dates.json';
  static STORAGE_KEY = 'agefi_listened_articles';
  static MINIFIED_KEY = 'agefi_player_minified';

  currentApiUrl = '';
  playlist = [];
  currentTrackIndex = -1;
  audio = null;
  elements = {};

  constructor(selectorMap) {
    // 1. Initialize DOM element references using the provided map
    for (const [key, id] of Object.entries(selectorMap)) {
      this.elements[key] =
        document.getElementById(id) || document.querySelector(id);

      if (!this.elements[key]) {
        console.warn(`Audio player element not found: ${id}`);
        return;
      }
    }

    //const urlDate = getUrlDate();

    //this.currentApiUrl = `${ArticlesAudioPlayer.EDITIONS_API}${urlDate}`;

    this.currentApiUrl = '/mock-edition-2026-10-12.json';

    // 2. Reference the core audio element
    this.audio = this.elements.audio;

    // 3. Bind event listeners to the player controls
    this.bindEvents();

    // 4. Load initial data
    this.initResizeListeners();
    this.initCalendar();
    this.fetchAndInitPlaylist();

    // 5. Set initial visual state (Mini vs Open)
    this.minifiedState();

    this.elements.mainContainer.classList.add(
      'ArticlesAudioPlayer-initialized',
    );

    this.buttonPlayClass = 'ArticlesAudioPlayer-playBtn';

    // 6. Audio tutorial message listener
    this.bannerIframe = null;
    this.bannerIsReady = false;
    this.tutorialIsReady = false;
    this.tutorialIframe = null;
    this.bannerContainer = document.querySelector('#AudioTutorial');
    this.tutorialContainer = document.querySelector('#AudioTutorialOverlay');
    this.tutorialOverlay = document.querySelector('.TutorialOverlay');

    window.addEventListener('message', (event) => {
      const { type } = event.data;

      switch (type) {
        case 'ASK_PLAYER_READY_BANNER':
          this.bannerIsReady = true;
          this.bannerIframe = document.querySelector(
            '#AudioTutorial iframe',
          )?.contentWindow;
          break;

        case 'ASK_PLAYER_READY_TUTORIAL':
          if (this.tutorialContainer) {
            this.tutorialIsReady = true;
            this.tutorialIframe =
              this.tutorialContainer.querySelector('iframe')?.contentWindow;

            if (this.bannerIsReady && this.tutorialIsReady) {
              this.bannerIframe.postMessage({ type: 'PLAYER_IS_READY' }, '*');
              this.tutorialIframe.postMessage({ type: 'PLAYER_IS_READY' }, '*');

              if (document.body.classList.contains('isReactNativeApp')) {
                this.tutorialIframe.postMessage({ type: 'IS_REACT_APP' }, '*');
              }
            }
          }
          break;

        case 'START_TUTORIAL':
          if (this.tutorialIframe && this.tutorialOverlay) {
            this.tutorialIframe.postMessage({ type: 'START_TUTORIAL' }, '*');
            this.tutorialContainer.classList.add('is-active');
            this.tutorialOverlay.classList.add('is-active');
            this.setPassedCookie();
          }
          break;

        case 'TUTORIAL_SKIPPED':
          if (this.tutorialOverlay) this.setPassedCookie();
          break;

        case 'STOP_TUTORIAL':
          if (this.tutorialOverlay) {
            this.tutorialOverlay.classList.remove('is-active');
            this.tutorialContainer.classList.remove('is-active');
            this.applyMiniState(true);
          }
          break;

        case 'MINIFY_PLAYER':
          this.applyMiniState(true);
          break;

        case 'SET_FULL':
          this.applyMiniState(false);
          break;

        case 'OPEN_PLAYLIST':
          this.openPlaylist();
          break;

        case 'SET_MOBILE_STEP_3':
          if (this.tutorialContainer) {
            setTimeout(
              () => this.tutorialContainer.classList.add('tutorial-step-3'),
              150,
            );
          }
          break;
      }
    });
  }

  bindEvents() {
    this.elements.playPauseBtn.addEventListener('click', this.togglePlayPause);
    this.elements.prevBtn.addEventListener('click', () => this.playPrevious());
    this.elements.nextBtn.addEventListener('click', () => this.playNext());
    this.elements.back10Btn.addEventListener('click', () => this.seekBy(-10));
    this.elements.forward10Btn.addEventListener('click', () => this.seekBy(10));
    this.elements.volumeSlider.addEventListener(
      'input',
      this.handleVolumeChange,
    );
    this.elements.volumeSliderRoot.addEventListener('mousedown', (e) =>
      this.startVolumeDrag(e),
    );
    this.elements.miniBtn.addEventListener('click', this.toggleMini);
    this.elements.playlistBtn.addEventListener('click', this.togglePlaylist);
    this.elements.playlistCloseBtn.addEventListener(
      'click',
      this.togglePlaylist,
    );
    this.elements.volumeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.elements.volumeModal.classList.toggle('is-open');
      this.elements.infoModal.classList.remove('is-open');
      this.closePlaylist();
    });
    this.elements.infoBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.elements.infoModal.classList.toggle('is-open');
      this.elements.volumeModal.classList.remove('is-open');
      this.closePlaylist();
    });
    this.elements.infoClose.addEventListener('click', () => {
      this.elements.infoModal.classList.remove('is-open');
    });

    document.addEventListener('click', (e) => {
      if (!this.elements.volumeControl.contains(e.target)) {
        this.elements.volumeModal.classList.remove('is-open');
      }
      if (!this.elements.infoModal.contains(e.target)) {
        this.elements.infoModal.classList.remove('is-open');
      }
      if (
        !this.elements.playlistContainer.contains(e.target) &&
        !this.elements.playlistBtn.contains(e.target) &&
        !this.elements.playPauseBtn.contains(e.target) &&
        !this.elements.prevBtn.contains(e.target) &&
        !this.elements.nextBtn.contains(e.target) &&
        !this.elements.back10Btn.contains(e.target) &&
        !this.elements.forward10Btn.contains(e.target) &&
        !this.elements.progressBarContainer.contains(e.target)
      ) {
        this.closePlaylist();
      }
      if (
        this.tutorialOverlay &&
        this.tutorialOverlay.classList.contains('is-active') &&
        e.target.closest('.TutorialOverlay')
      ) {
        this.tutorialIframe.postMessage(
          {
            type: 'STOP_TUTORIAL',
          },
          '*',
        );

        this.tutorialContainer.classList.remove('is-active');
        this.tutorialOverlay.classList.remove('is-active');
      }
    });

    this.elements.progressBarContainer.addEventListener(
      'click',
      this.handleProgressSeek,
    );

    this.audio.addEventListener('loadedmetadata', this.handleMetadataLoad);
    this.audio.addEventListener('timeupdate', this.handleTimeUpdate);
    this.audio.addEventListener('ended', this.handleTrackEnded);
    this.audio.addEventListener('progress', this.handleProgress);
  }

  // init resize and button state
  toogleScrollButtonState() {
    if (!this.elements.calendar) return;
    const container = this.elements.calendar;
    const isAtStart = container.scrollLeft <= 0;
    const isAtEnd =
      container.scrollLeft + container.offsetWidth >= container.scrollWidth - 1;
    this.elements.calendarBack.style.opacity = isAtStart ? '0.3' : '1';
    this.elements.calendarBack.style.pointerEvents = isAtStart
      ? 'none'
      : 'auto';

    this.elements.calendarForward.style.opacity = isAtEnd ? '0.3' : '1';
    this.elements.calendarForward.style.pointerEvents = isAtEnd
      ? 'none'
      : 'auto';
  };

  initResizeListeners() {
    const handler = throttle(100, () => {
      const scrollStep = window.innerWidth < 1024 ? 140 : 250;
      this.toogleScrollButtonState(scrollStep);
    });

    window.addEventListener('resize', handler);
  }

  // set cookie for audio tutorial
  setPassedCookie() {
    const date = new Date();
    date.setTime(date.getTime() + 365 * 24 * 60 * 60 * 1000);
    const expires = 'expires=' + date.toUTCString();
    document.cookie = `_pc_audioTutorialPassed=true; ${expires}; path=/; SameSite=Lax`;
  }

  // storage and state
  minifiedState() {
    const storedState = localStorage.getItem(ArticlesAudioPlayer.MINIFIED_KEY);
    let shouldMinify;

    if (storedState !== null) {
      shouldMinify = storedState === 'true';
    } else {
      shouldMinify = window.innerWidth >= 1024;
    }

    this.applyMiniState(shouldMinify);
  }

  getListenedTracks() {
    try {
      return (
        JSON.parse(localStorage.getItem(ArticlesAudioPlayer.STORAGE_KEY)) || []
      );
    } catch (e) {
      console.warn('Error reading from localStorage', e);
      return [];
    }
  }

  saveListenedTrack(track) {
    if (!track) return;

    const id = track.id || track.audio;
    const listened = this.getListenedTracks();

    if (!listened.includes(id)) {
      listened.push(id);
      localStorage.setItem(
        ArticlesAudioPlayer.STORAGE_KEY,
        JSON.stringify(listened),
      );
    }
  }

  // volume control
  startVolumeDrag = (e) => {
    const handleMove = (moveEvent) => {
      const rect = this.elements.volumeSliderRoot.getBoundingClientRect();
      let offsetY = rect.bottom - moveEvent.clientY;
      let percentage = offsetY / rect.height;

      percentage = Math.max(0, Math.min(1, percentage));

      this.updateVolume(percentage);
    };

    const stopMove = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', stopMove);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', stopMove);
    handleMove(e);
  };

  updateVolume = (percentage) => {
    this.audio.volume = percentage;

    const heightPercent = percentage * 100;
    this.elements.volumeFill.style.height = `${heightPercent}%`;
    this.elements.volumeThumb.style.bottom = `${heightPercent}%`;

    const iconUse = this.elements.volumeBtn.querySelector('use');
    if (percentage <= 0) {
      iconUse.setAttribute('xlink:href', '#icon-mute');
    } else {
      iconUse.setAttribute('xlink:href', '#icon-volume');
    }

    if (this.elements.volumeSlider) {
      this.elements.volumeSlider.value = percentage;
    }
  };

  // player control
  togglePlayPause = () => {
    const playingClass = 'is-playing';

    if (!this.audio.src) {
      this.loadTrack(0, true);
      return;
    }

    if (this.audio.paused) {
      this.audio.play();
      this.elements.mainContainer.classList.add(playingClass);
      this.elements.playPauseBtn.classList.remove(this.buttonPlayClass);
      this.elements.playPauseBtn
        .querySelector('use')
        .setAttribute('xlink:href', '#icon-audio-pause');
      this.elements.playPauseBtn.title = 'Pause';
    } else {
      this.audio.pause();
      this.elements.mainContainer.classList.remove(playingClass);
      this.elements.playPauseBtn.classList.add(this.buttonPlayClass);
      this.elements.playPauseBtn
        .querySelector('use')
        .setAttribute('xlink:href', '#icon-audio-play');
      this.elements.playPauseBtn.title = 'Play';
    }
  };

  seekBy(seconds) {
    if (this.audio.duration > 0) {
      this.audio.currentTime = Math.min(
        this.audio.duration,
        Math.max(0, this.audio.currentTime + seconds),
      );
    }
  }

  // state and ui update
  loadTrack(index, autoPlay = false) {
    if (index >= 0 && index < this.playlist.length) {
      this.currentTrackIndex = index;
      const track = this.playlist[this.currentTrackIndex];
      const playingClass = 'is-playing';

      this.audio.src = track.audio;
      this.elements.currentTitle.textContent = track.title;
      this.elements.currentImages.src = track.images;
      this.elements.currentAuthors.textContent = track.authors
        ? track.authors
        : '';
      this.elements.mTitle.textContent = track.title;
      this.elements.mAuthors.textContent = track.authors;
      this.elements.mImages.src = track.images;
      this.elements.mTime.textContent = formatTime(track.duration);

      this.audio.load();
      this.updatePlaylistUI();

      this.elements.prevBtn.disabled = this.currentTrackIndex <= 0;
      this.elements.nextBtn.disabled =
        this.currentTrackIndex >= this.playlist.length - 1;

      if (autoPlay) {
        this.setMobileHeaderMode('playing');
        this.audio.play().catch((error) => {
          console.warn('Autoplay prevented. User must interact first.', error);
        });
        this.elements.mainContainer.classList.add(playingClass);
        this.elements.playPauseBtn.classList.remove(this.buttonPlayClass);
        this.elements.playPauseBtn
          .querySelector('use')
          .setAttribute('xlink:href', '#icon-audio-pause');
        this.elements.playPauseBtn.title = 'Pause';
      } else {
        this.elements.playPauseBtn.classList.add(this.buttonPlayClass);
        this.elements.playPauseBtn
          .querySelector('use')
          .setAttribute('xlink:href', '#icon-audio-play');
        this.elements.playPauseBtn.title = 'Play';
        this.elements.progressBar.style.width = '0%';
        this.elements.currentTime.textContent = formatTime(0);
        this.elements.duration.textContent = formatTime(0);
      }
    }
  }

  playPrevious() {
    if (this.currentTrackIndex > 0) {
      this.loadTrack(this.currentTrackIndex - 1, true);
    }
  }

  playNext = () => {
    if (this.currentTrackIndex < this.playlist.length - 1) {
      this.loadTrack(this.currentTrackIndex + 1, true);
    } else {
      this.audio.currentTime = 0;
      this.audio.pause();
      this.elements.playPauseBtn.classList.add(this.buttonPlayClass);
      this.elements.playPauseBtn
        .querySelector('use')
        .setAttribute('xlink:href', '#icon-audio-play');
      this.elements.playPauseBtn.title = 'Play';
    }
  };

  updatePlaylistUI() {
    const listItems = this.elements.playlistUl.querySelectorAll('li');

    listItems.forEach((li, index) => {
      const track = this.playlist[index];
      const isActuallyPlaying = track && this.audio.src === track.audio;

      console.log(normalizePath(this.audio.src))
      console.log(normalizePath(track.audio))

      li.classList.toggle('is-active', isActuallyPlaying);

      if (isActuallyPlaying) {
        this.currentTrackIndex = index;
      }
    });
  }

  markItemAsListened(index) {
    const listItems = this.elements.playlistUl.querySelectorAll('li');
    const item = listItems[index];

    if (item) {
      item.classList.add('is-listened');
      item.classList.remove('is-active');
      const timeEl = item.querySelector('.ArticlesAudioPlayer-playlistTime');
      if (timeEl) {
        timeEl.textContent = 'Déjà lu';
      }
    }
  }

  // event handlers
  handleTrackEnded = () => {
    if (this.playlist[this.currentTrackIndex]) {
      this.saveListenedTrack(this.playlist[this.currentTrackIndex]);
      this.markItemAsListened(this.currentTrackIndex);
    }

    this.playNext();
  };

  handleVolumeChange = () => {
    this.audio.volume = this.elements.volumeSlider.value;
  };

  handleMetadataLoad = () => {
    this.elements.duration.textContent = formatTime(this.audio.duration);
    this.elements.mDuration.textContent = formatTime(this.audio.duration);
  };

  handleTimeUpdate = () => {
    const { currentTime, duration } = this.audio;
    this.elements.currentTime.textContent = formatTime(currentTime);
    this.elements.mTime.textContent = formatTime(currentTime);

    const progressPercent = (currentTime / duration) * 100;
    this.elements.progressBar.style.width = `${progressPercent}%`;
  };

  handleProgressSeek = (e) => {
    if (this.audio.duration > 0) {
      const width = this.elements.progressBarContainer.clientWidth;
      const clickX = e.offsetX;
      const timeToSeek = (clickX / width) * this.audio.duration;
      this.audio.currentTime = timeToSeek;
    }
  };

  handleProgress = () => {
    if (this.audio.duration > 0 && this.audio.buffered.length > 0) {
      const bufferedEnd = this.audio.buffered.end(
        this.audio.buffered.length - 1,
      );
      const bufferedPercent = (bufferedEnd / this.audio.duration) * 100;
      this.elements.bufferedBar.style.width = `${bufferedPercent}%`;
    }
  };

  // handle mini mode
  toggleMini = () => {
    const isCurrentlyMinified = this.elements.mainContainer.classList.contains(
      'ArticlesAudioPlayer-minified',
    );
    const newState = !isCurrentlyMinified;

    this.applyMiniState(newState);

    localStorage.setItem(ArticlesAudioPlayer.MINIFIED_KEY, newState);

    if (
      this.tutorialOverlay &&
      this.tutorialOverlay.classList.contains('is-active')
    ) {
      if (isCurrentlyMinified) {
        this.tutorialIframe.postMessage(
          {
            type: 'GO_TO_STEP_2',
          },
          '*',
        );
      } else {
        this.tutorialIframe.postMessage(
          {
            type: 'STOP_TUTORIAL',
          },
          '*',
        );
      }
    }
  };

  applyMiniState(shouldMinify) {
    const minifiedClass = 'ArticlesAudioPlayer-minified';
    const miniBtnUse = this.elements.miniBtn.querySelector('use');

    if (shouldMinify) {
      this.elements.mainContainer.classList.add(minifiedClass);
      if (miniBtnUse) {
        miniBtnUse.setAttribute('xlink:href', '#icon-minimaze-up');
      }

      this.elements.volumeModal.classList.remove('is-open');
      this.elements.infoModal.classList.remove('is-open');
      this.closePlaylist();
    } else {
      this.elements.mainContainer.classList.remove(minifiedClass);
      if (miniBtnUse) {
        miniBtnUse.setAttribute('xlink:href', '#icon-minimaze-down');
      }
    }
  }

  // handle playlist
  openPlaylist = () => {
    const playlistBtnUse = this.elements.playlistBtn.querySelector('use');
    this.elements.volumeModal.classList.remove('is-open');
    this.elements.infoModal.classList.remove('is-open');
    this.elements.playlistContainer.classList.add('is-open');
    this.elements.overlay.classList.add('is-open');

    if (
      this.tutorialOverlay &&
      this.tutorialOverlay.classList.contains('is-active')
    ) {
      this.tutorialIframe.postMessage(
        {
          type: 'GO_TO_STEP_4',
        },
        '*',
      );
    }

    if (
      window.innerWidth < 1024 &&
      this.tutorialOverlay &&
      this.tutorialOverlay.classList.contains('is-active')
    ) {
      this.tutorialIframe.postMessage(
        {
          type: 'PLAYLIST_STOP_TUTORIAL',
        },
        '*',
      );
    }

    if (!playlistBtnUse) {
      return;
    }

    playlistBtnUse.setAttribute('xlink:href', '#icon-playlist-down');
  };

  closePlaylist = () => {
    const playlistBtnUse = this.elements.playlistBtn.querySelector('use');
    this.elements.playlistContainer.classList.remove('is-open');
    this.elements.overlay.classList.remove('is-open');

    if (
      this.tutorialOverlay &&
      this.tutorialOverlay.classList.contains('is-active')
    ) {
      this.tutorialIframe.postMessage(
        {
          type: 'PLAYLIST_STOP_TUTORIAL',
        },
        '*',
      );
    }

    if (!playlistBtnUse) {
      return;
    }

    playlistBtnUse.setAttribute('xlink:href', '#icon-playlist');
  };

  togglePlaylist = () => {
    if (this.elements.playlistContainer.classList.contains('is-open')) {
      this.closePlaylist();
    } else {
      this.openPlaylist();
    }
  };

  setMobileHeaderMode(mode) {
    const isPlaying = mode === 'playing';
    if (isPlaying) {
      this.elements.mainContainer.classList.add('is-mobile-header-playing');
    }
  }

  renderCalendar(editions) {
    const container = this.elements.calendar;
    let scrollStep = 250;

    this.elements.calendarBack.addEventListener('click', () => {
      container.scrollBy({ left: -scrollStep, behavior: 'smooth' });
    });
    this.elements.calendarForward.addEventListener('click', () => {
      container.scrollBy({ left: scrollStep, behavior: 'smooth' });
    });

    container.addEventListener('scroll', () => {
      this.toogleScrollButtonState();
    });

    container.innerHTML = '';

    editions.reverse().forEach((edition) => {
      const dateObj = new Date(edition.date);
      const dayName = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' })
        .format(dateObj)
        .toUpperCase()
        .replace('.', '');
      const dayNum = new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
      }).format(dateObj);
      const isActive = 'is-active';

      const btn = document.createElement('div');
      btn.className = 'ArticlesAudioPlayer-calendarItem';
      if (edition.url === this.currentApiUrl) btn.classList.add(isActive);

      btn.innerHTML = `
      <span class="ArticlesAudioPlayer-dayName">${dayName}</span>
      <span class="ArticlesAudioPlayer-dayNum">${dayNum}</span>
      `;

      btn.addEventListener('click', () => {
        container
          .querySelectorAll('.ArticlesAudioPlayer-calendarItem')
          .forEach((i) => i.classList.remove(isActive));
        btn.classList.add(isActive);
        btn.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
        this.currentApiUrl = edition.url;
        this.fetchAndInitPlaylist();
      });

      container.appendChild(btn);
    });
    this.toogleScrollButtonState();
    const activeBtn = document.querySelector(
      '.ArticlesAudioPlayer-calendarItem.is-active',
    );
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }

  // API and init
  async initCalendar() {
    try {
      const response = await fetch(ArticlesAudioPlayer.EDITIONS_API);
      if (!response.ok) throw new Error('Failed to fetch editions');
      const editions = await response.json();

      this.renderCalendar(editions);
    } catch (error) {
      console.error('Calendar init error:', error);
    }
  }

  async fetchAndInitPlaylist() {
    const playlistDisabledClass = 'ArticlesAudioPlayer-playlist_disabled';
    Object.values(this.elements).forEach((el) => {
      if (el && el.tagName === 'BUTTON') el.disabled = true;
    });
    this.elements.playlistUl.classList.add(playlistDisabledClass);

    try {
      const response = await fetch(this.currentApiUrl);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      let playlistDate = '';
      let titleDate = '';
      this.playlist = data.articles;

      const listenedTracks = this.getListenedTracks();
      const totalSeconds = this.playlist.reduce(
        (acc, track) => acc + (track.duration || 0),
        0,
      );
      const articleCount = this.playlist.length;
      this.elements.mTotalArticles.textContent = `${articleCount} article${articleCount > 1 ? 's' : ''}`;

      this.setMobileHeaderMode('edition');
      if (data.date) {
        playlistDate = formatDate(data.date, 'm-y');
        titleDate = formatDate(data.date);
      }

      this.elements.playlistUl.innerHTML = '';
      this.playlist.forEach((track, index) => {
        const li = document.createElement('li');
        const trackId = track.id || track.audio;
        const isListened = listenedTracks.includes(trackId);
        li.className = `ArticlesAudioPlayer-playlistItem ${isListened ? 'is-listened' : ''}`;

        li.innerHTML = `
          <div class="ArticlesAudioPlayer-playlistImage">
            <img src="${track.images}" alt="${track.title}">
          </div>
          <div class="ArticlesAudioPlayer-playlistInfo">
            <div class="ArticlesAudioPlayer-playlistTitle">${track.title}</div>
            <div class="ArticlesAudioPlayer-playlistAuthor">${track.authors}</div>
          </div>
          <div class="ArticlesAudioPlayer-playlistPlayIcon">
            <svg class="ArticlesAudioPlayer-playlistPlayIcon-play">
              <use xlink:href="#icon-audio-play"></use>
            </svg>
            <svg class="ArticlesAudioPlayer-playlistPlayIcon-check">
              <use xlink:href="#icon-check-bold"></use>
            </svg>
          </div>
          <div class="ArticlesAudioPlayer-playlistTime">
            ${isListened ? 'Déjà lu' : formatTime(track.duration) + ' min'}
          </div>
        `;

        li.addEventListener('click', () => {
          const isSameTrack = this.audio.src === track.audio;

          if (!isSameTrack) {
            this.loadTrack(index, true);
          } else {
            this.togglePlayPause();
          }
        });
        this.elements.playlistUl.appendChild(li);
      });
      this.updatePlaylistUI();
      this.elements.playlistDate.textContent = `${playlistDate}`;
      this.elements.date.textContent = `Le 7h du ${titleDate}`;

      if (!this.audio.src) {
        this.elements.mTitle.textContent = `Édition du ${formatDate(data.date)}`;
        const titleDate = formatDate(data.date);
        this.elements.currentTitle.textContent = formatTime(totalSeconds);
        this.elements.mTime.textContent = formatTime(totalSeconds);
        this.elements.currentAuthors.textContent = `${articleCount} article${articleCount > 1 ? 's' : ''}`;
        this.elements.date.textContent = `Le 7h du ${titleDate}`;

        this.setMobileHeaderMode('edition');
      }

      if (this.playlist.length > 0) {
        Object.values(this.elements).forEach((el) => {
          if (el && el.tagName === 'BUTTON' && el.id !== 'prev-btn')
            el.disabled = false;
        });
      } else {
        this.elements.currentTitle.textContent = 'No articles found.';
      }

      this.elements.playlistUl.classList.remove(playlistDisabledClass);
    } catch (error) {
      console.error('Error loading API playlist:', error);
      this.elements.currentTitle.textContent = 'Error loading playlist data.';
    }
  }
}
