// Notification Sound Utility using Web Audio API
class NotificationSounds {
  constructor() {
    this.audioContext = null;
    this.contextInitialized = false;
    // Don't initialize AudioContext here - wait for user gesture
  }

  initAudioContext() {
    if (this.contextInitialized) return; // Already initialized

    try {
      // Create AudioContext only after a user gesture to avoid autoplay restrictions
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.contextInitialized = true;
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
    }
  }

  // Ensure AudioContext is running (handle autoplay restrictions)
  async ensureAudioContext() {
    if (!this.audioContext) {
      this.initAudioContext();
    }
    
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.warn('Could not resume audio context:', error);
      }
    }
  }

  // Generate success sound (positive, upward tone)
  async playSuccess() {
    await this.ensureAudioContext();
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Pleasant success chord progression
      oscillator.frequency.setValueAtTime(523.25, this.audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, this.audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, this.audioContext.currentTime + 0.2); // G5
      
      oscillator.type = 'sine';
      
      // Smooth envelope
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.15, this.audioContext.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.3);
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.5);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn('Could not play success sound:', error);
    }
  }

  // Generate error sound (lower, attention-grabbing)
  async playError() {
    await this.ensureAudioContext();
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Alert but not harsh error sound
      oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime); // A3
      oscillator.frequency.setValueAtTime(196, this.audioContext.currentTime + 0.15); // G3
      
      oscillator.type = 'triangle';
      
      // Quick attention-getting envelope
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.12, this.audioContext.currentTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(0.08, this.audioContext.currentTime + 0.15);
      gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.17);
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.4);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.4);
    } catch (error) {
      console.warn('Could not play error sound:', error);
    }
  }

  // Generate info/neutral sound (gentle notification)
  async playInfo() {
    await this.ensureAudioContext();
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Gentle notification sound
      oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4
      oscillator.frequency.setValueAtTime(523.25, this.audioContext.currentTime + 0.1); // C5
      
      oscillator.type = 'sine';
      
      // Soft envelope
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.08, this.audioContext.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0.05, this.audioContext.currentTime + 0.15);
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.3);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.3);
    } catch (error) {
      console.warn('Could not play info sound:', error);
    }
  }

  // Generate warning sound (moderate alert)
  async playWarning() {
    await this.ensureAudioContext();
    if (!this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      // Warning beep pattern
      oscillator.frequency.setValueAtTime(330, this.audioContext.currentTime); // E4
      oscillator.frequency.setValueAtTime(349.23, this.audioContext.currentTime + 0.1); // F4
      oscillator.frequency.setValueAtTime(330, this.audioContext.currentTime + 0.2); // E4
      
      oscillator.type = 'square';
      
      // Attention-getting envelope
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.02);
      gainNode.gain.linearRampToValueAtTime(0.06, this.audioContext.currentTime + 0.1);
      gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.12);
      gainNode.gain.linearRampToValueAtTime(0.06, this.audioContext.currentTime + 0.2);
      gainNode.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.22);
      gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.35);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.35);
    } catch (error) {
      console.warn('Could not play warning sound:', error);
    }
  }
}

// Export singleton instance
export const notificationSounds = new NotificationSounds();