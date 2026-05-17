import { els, state } from "./context.js";
import { saveVolume } from "./storage.js";

export function setPreviewVolume(value) {
  state.volume = Math.min(1, Math.max(0, Number(value)));
  saveVolume(state.volume);
  els.volumeSlider.value = String(state.volume);
  els.volumeValue.textContent = `${Math.round(state.volume * 100)}%`;
  els.audioPlayer.volume = state.volume;
}
