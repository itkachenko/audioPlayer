import './audioPlayer.less';
import { ArticlesAudioPlayer } from './audioPlayer';

function registerCustomElements() {
  const AudioPlayerSelectorMap = {
    mainContainer: '.ArticlesAudioPlayer',
    audio: '.ArticlesAudioPlayer-audio',
    playPauseBtn: '.ArticlesAudioPlayer-playPauseBtn',
    progressBarContainer: '.ArticlesAudioPlayer-progressBarContainer',
    progressBar: '.ArticlesAudioPlayer-progressBar',
    bufferedBar: '.ArticlesAudioPlayer-bufferedBar',
    currentTime: '.ArticlesAudioPlayer-currentTime',
    duration: '.ArticlesAudioPlayer-duration',
    back10Btn: '.ArticlesAudioPlayer-back10Btn',
    forward10Btn: '.ArticlesAudioPlayer-forward10Btn',
    prevBtn: '.ArticlesAudioPlayer-prevBtn',
    nextBtn: '.ArticlesAudioPlayer-nextBtn',
    date: '.ArticlesAudioPlayer-date',
    currentTitle: '.ArticlesAudioPlayer-title',
    currentImages: '.ArticlesAudioPlayer-images',
    currentAuthors: '.ArticlesAudioPlayer-authors',
    playlistContainer: '.ArticlesAudioPlayer-playlistContainer',
    playlistBtn: '.ArticlesAudioPlayer-playlistBtn',
    playlistUl: '.ArticlesAudioPlayer-playlist',
    playlistDate: '.ArticlesAudioPlayer-playlistDate',
    playlistCloseBtn: '.ArticlesAudioPlayer-playlistArrowClose',
    volumeSliderRoot: '.ArticlesAudioPlayer-volumeSliderRoot',
    volumeFill: '.ArticlesAudioPlayer-volumeFill',
    volumeThumb: '.ArticlesAudioPlayer-volumeThumb',
    volumeSlider: '.ArticlesAudioPlayer-volumeSlider',
    volumeBtn: '.ArticlesAudioPlayer-volumeBtn',
    volumeModal: '.ArticlesAudioPlayer-volumeModal',
    volumeControl: '.ArticlesAudioPlayer-volumeControl',
    infoBtn: '.ArticlesAudioPlayer-infoBtn',
    infoModal: '.ArticlesAudioPlayer-infoModal',
    infoClose: '.ArticlesAudioPlayer-infoClose',
    miniBtn: '.ArticlesAudioPlayer-miniBtn',
    overlay: '.ArticlesAudioPlayer-overlay',
    mImages: '.ArticlesAudioPlayer-mImages',
    mTotalArticles: '.ArticlesAudioPlayer-mTotalArticles',
    mTitle: '.ArticlesAudioPlayer-mTitle',
    mAuthors: '.ArticlesAudioPlayer-mAuthors',
    mTime: '.ArticlesAudioPlayer-mTime',
    mDuration: '.ArticlesAudioPlayer-mDuration',
    calendar: '.ArticlesAudioPlayer-calendar',
    calendarForward: '.ArticlesAudioPlayer-calendarForward',
    calendarBack: '.ArticlesAudioPlayer-calendarBack',
  };
  new ArticlesAudioPlayer(AudioPlayerSelectorMap);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', registerCustomElements)
} else {
  registerCustomElements()
}