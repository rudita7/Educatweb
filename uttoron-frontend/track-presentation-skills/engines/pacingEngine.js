/* On-device Pacing & Pause Engine (spec §2.8) — the flagship innovation.
   No speech-to-text, no ML model: captures a short clip, classifies fixed-
   size frames as speech/silence by amplitude threshold, and derives pace
   (WPM against the learner's own typed script) and pause locations from
   that frame sequence.

   PRIVACY (spec §0.4, non-negotiable): audio is analyzed entirely in this
   browser tab. The raw Float32 buffer is discarded the moment step 3/4
   finish — see AudioPacingSession.stop() below, which nulls every buffer
   reference before it returns. Nothing is written to IndexedDB, nothing is
   uploaded; the MediaStream's tracks are stopped as soon as recording ends
   so the mic indicator turns off immediately.

   Includes the manual-timer fallback path (TimerPacingSession) for devices
   where microphone access is denied/unavailable/unreliable — built and
   shipped unconditionally, not gated behind whether the live-audio path
   works, per spec §2.8/§11 accessibility requirement.

   HONESTY NOTE for whoever reads this next: the live-audio path below is
   implemented against the real Web Audio / MediaRecorder APIs and is
   structurally correct, but this sandboxed build environment has no actual
   microphone hardware to record from, so the RMS/frame-classification logic
   could only be exercised with synthetic buffers here, not a real recorded
   voice on real low-end Android hardware. Spec §2.8 explicitly calls for
   on-device testing before shipping — that hardware pass still needs to
   happen; treat this as implemented-but-not-hardware-verified. */
(function (global) {
    "use strict";

    const FRAME_MS = 50;
    const PAUSE_THRESHOLD_S = 1.5;
    const HEALTHY_WPM_MIN = 110;
    const HEALTHY_WPM_MAX = 160;
    const MAX_RECORD_MS = 90000;

    function computeResult(frames, frameMs, wordCount) {
        const speakingFrames = frames.filter(f => f).length;
        const totalSpeakingSeconds = (speakingFrames * frameMs) / 1000;

        const pauses = [];
        let silenceRun = 0;
        frames.forEach((isSpeech, i) => {
            if (!isSpeech) {
                silenceRun++;
            } else {
                if (silenceRun > 0) {
                    const durationS = (silenceRun * frameMs) / 1000;
                    if (durationS >= PAUSE_THRESHOLD_S) pauses.push({ frameIndex: i - silenceRun, durationS: Math.round(durationS * 10) / 10 });
                }
                silenceRun = 0;
            }
        });
        if (silenceRun > 0) {
            const durationS = (silenceRun * frameMs) / 1000;
            if (durationS >= PAUSE_THRESHOLD_S) pauses.push({ frameIndex: frames.length - silenceRun, durationS: Math.round(durationS * 10) / 10 });
        }

        const minutes = Math.max(totalSpeakingSeconds / 60, 1 / 60);
        const wpm = Math.round(wordCount / minutes);
        const pace = wpm < HEALTHY_WPM_MIN ? 'slow' : (wpm > HEALTHY_WPM_MAX ? 'fast' : 'good');

        return {
            totalSpeakingSeconds: Math.round(totalSpeakingSeconds * 10) / 10,
            frameCount: frames.length,
            speakingFrameCount: speakingFrames,
            pauseCount: pauses.length,
            pauses,
            wpm,
            pace,
            healthyRange: [HEALTHY_WPM_MIN, HEALTHY_WPM_MAX]
        };
    }

    /* ---------------- Live audio path ---------------- */
    class AudioPacingSession {
        constructor() {
            this.audioContext = null;
            this.stream = null;
            this.processor = null;
            this.source = null;
            this.frames = [];
            this.recording = false;
            this.startedAt = 0;
            this._stopTimer = null;
        }

        static isSupported() {
            return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));
        }

        async start(onTick) {
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.audioContext = new AudioContextCtor();
            this.source = this.audioContext.createMediaStreamSource(this.stream);

            const frameSamples = Math.round(this.audioContext.sampleRate * (FRAME_MS / 1000));
            const bufferSize = 2048;
            this.processor = this.audioContext.createScriptProcessor
                ? this.audioContext.createScriptProcessor(bufferSize, 1, 1)
                : null;
            if (!this.processor) throw new Error('ScriptProcessorNode unavailable on this browser.');

            let carry = [];
            this.processor.onaudioprocess = (e) => {
                if (!this.recording) return;
                const input = e.inputBuffer.getChannelData(0);
                carry = carry.concat(Array.from(input));
                while (carry.length >= frameSamples) {
                    const frame = carry.splice(0, frameSamples);
                    const rms = Math.sqrt(frame.reduce((sum, v) => sum + v * v, 0) / frame.length);
                    const isSpeech = rms > 0.02; // amplitude threshold — step 3 of §2.8
                    this.frames.push(isSpeech);
                    // The frame array itself is discarded here (not retained) — only the
                    // boolean speech/silence classification survives per frame.
                }
                if (onTick) onTick(this.frames.length * FRAME_MS);
            };

            this.source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            this.recording = true;
            this.startedAt = Date.now();
            this._stopTimer = setTimeout(() => { if (this.recording) this._autoStopAt = true; }, MAX_RECORD_MS);
        }

        elapsedMs() { return this.recording ? Date.now() - this.startedAt : 0; }

        // Stops capture, tears down every audio node/stream reference, and
        // returns the derived result. No raw audio sample survives this call.
        stop(wordCount) {
            this.recording = false;
            clearTimeout(this._stopTimer);
            if (this.processor) { this.processor.disconnect(); this.processor.onaudioprocess = null; this.processor = null; }
            if (this.source) { this.source.disconnect(); this.source = null; }
            if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
            if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }

            const frames = this.frames;
            this.frames = null; // discard immediately after deriving the result — spec §0.4/§2.8 step 6
            const result = computeResult(frames, FRAME_MS, wordCount);
            result.source = 'live-audio';
            return result;
        }
    }

    /* ---------------- Manual timer fallback (spec §2.8, ship unconditionally) ---------------- */
    class TimerPacingSession {
        constructor() { this.startedAt = 0; this.running = false; }
        start() { this.startedAt = Date.now(); this.running = true; }
        elapsedMs() { return this.running ? Date.now() - this.startedAt : 0; }
        stop(wordCount) {
            this.running = false;
            const elapsedS = Math.max((Date.now() - this.startedAt) / 1000, 1);
            const minutes = elapsedS / 60;
            const wpm = Math.round(wordCount / minutes);
            const pace = wpm < HEALTHY_WPM_MIN ? 'slow' : (wpm > HEALTHY_WPM_MAX ? 'fast' : 'good');
            return {
                totalSpeakingSeconds: Math.round(elapsedS * 10) / 10,
                frameCount: null,
                speakingFrameCount: null,
                pauseCount: null,
                pauses: [],
                wpm,
                pace,
                healthyRange: [HEALTHY_WPM_MIN, HEALTHY_WPM_MAX],
                source: 'manual-timer'
            };
        }
    }

    global.PS = global.PS || {};
    global.PS.pacingEngine = {
        AudioPacingSession, TimerPacingSession, computeResult,
        FRAME_MS, PAUSE_THRESHOLD_S, HEALTHY_WPM_MIN, HEALTHY_WPM_MAX, MAX_RECORD_MS
    };
})(window);
