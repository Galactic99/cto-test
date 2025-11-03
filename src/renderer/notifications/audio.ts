/**
 * Audio utility for playing notification sounds
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Play a simple beep sound for blink notifications
 */
export function playBlinkSound(): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Soft, pleasant beep at 800Hz
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    // Fade in and out
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.15);

    oscillator.start(now);
    oscillator.stop(now + 0.15);
  } catch (error) {
    console.error('[Audio] Failed to play blink sound:', error);
  }
}

/**
 * Play a simple tone for posture notifications (lower pitch)
 */
export function playPostureSound(): void {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Lower tone at 500Hz
    oscillator.frequency.value = 500;
    oscillator.type = 'sine';

    // Fade in and out
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.03);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.2);

    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } catch (error) {
    console.error('[Audio] Failed to play posture sound:', error);
  }
}

/**
 * Play notification sound based on type
 */
export function playNotificationSound(type: 'blink' | 'posture'): void {
  if (type === 'blink') {
    playBlinkSound();
  } else {
    playPostureSound();
  }
}
