/**
 * Web Speech API wrapper for the audio coach.
 * SHARED MODULE — used by both the YouTube app and the Zoom app.
 */

let isSpeaking = false;

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

export function cancelSpeech(): void {
  if (typeof window === "undefined") return;
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    isSpeaking = false;
  }
}
