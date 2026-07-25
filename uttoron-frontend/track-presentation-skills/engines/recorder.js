/* In-browser audio recorder (spec §5, Lessons 12-13) — thin wrapper around
   MediaRecorder. No speech-to-text, no automatic pace/filler detection —
   the spec is explicit that Lesson 12's self-review is manual ("no
   automatic detection"), so this engine's only job is capture + playback,
   nothing analytical.

   Includes a file-upload fallback for devices where microphone access is
   denied/unavailable/unreliable (shared low-RAM Android phones are exactly
   this platform's target hardware) — a student can instead record with
   their phone's camera/voice app and upload the file. */
(function (global) {
    "use strict";

    function isSupported() {
        return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    }

    class InBrowserRecorder {
        constructor(opts) {
            this.maxMs = (opts && opts.maxSeconds ? opts.maxSeconds : 90) * 1000;
            this.stream = null;
            this.mediaRecorder = null;
            this.chunks = [];
            this.startedAt = 0;
            this.onStop = null; // (blob) => void
            this._stopTimer = null;
        }

        async start() {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(this.stream);
            this.chunks = [];
            this.mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.chunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
                this.stream.getTracks().forEach(t => t.stop());
                this.stream = null;
                if (this.onStop) this.onStop(blob);
            };
            this.mediaRecorder.start();
            this.startedAt = Date.now();
            this._stopTimer = setTimeout(() => this.stop(), this.maxMs);
        }

        elapsedMs() { return this.mediaRecorder && this.mediaRecorder.state === 'recording' ? Date.now() - this.startedAt : 0; }

        stop() {
            clearTimeout(this._stopTimer);
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') this.mediaRecorder.stop();
        }
    }

    global.PS = global.PS || {};
    global.PS.recorder = { InBrowserRecorder, isSupported };
})(window);
