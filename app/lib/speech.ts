/**
 * Web Speech API wrapper for the audio coach.
 */

let isSpeaking = false;

/**
 * Speak a coaching line aloud using the browser's speech synthesis.
 * Non-blocking; will not queue if already speaking.
 */
export function speak(text: string): void {
  if (typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;
  if (isSpeaking) return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.1;
  utterance.pitch = 1.0;
  utterance.volume = 0.9;

  utterance.onstart = () => {
    isSpeaking = true;
  };
  utterance.onend = () => {
    isSpeaking = false;
  };
  utterance.onerror = () => {
    isSpeaking = false;
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Cancel any ongoing speech.
 */
export function cancelSpeech(): void {
  if (typeof window === "undefined") return;
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    isSpeaking = false;
  }
}
