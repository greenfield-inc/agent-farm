// Embedded by the renderer so the exported page has no runtime dependencies.
export function enhancePlayers(root = document) {
  for (const player of root.querySelectorAll('.demo-player')) {
    if (player.dataset.enhanced) continue;
    const video = player.querySelector('video');
    const button = player.querySelector('.play-preview');
    const status = player.querySelector('.player-status');
    if (!video || !button || !status) continue;
    player.dataset.enhanced = 'true';

    // Before activation there are no native controls underneath the overlay.
    // Without JavaScript the hidden button leaves the native player intact.
    video.controls = false;
    button.hidden = false;
    const revealControls = () => {
      button.hidden = true;
      video.controls = true;
    };
    video.addEventListener('playing', () => {
      revealControls();
      status.hidden = true;
    });
    button.addEventListener('click', async event => {
      // Remove the button before play: this click cannot also toggle the video.
      revealControls();
      status.hidden = true;
      if (event.detail === 0) video.focus({preventScroll: true});
      try {
        await video.play();
      } catch {
        // Leave native controls and the separate download link usable on failure.
        status.hidden = false;
      }
    });
  }
}
