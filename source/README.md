CURRENT BUILD: 164. Build number increased after Apple rejected reuse of 163. App resources are unchanged. Historical notes below refer to the preceding build.

BUILD PACKAGING REPAIR: See START-HERE.txt. Historical app changes and browser test results below are retained from the supplied folder; they were not rerun for this packaging repair. Native build and signing remain to be verified on the Mac.

# Composer’s Toolbox — Build 163 review

Latest requested changes:
- Removed the lower notation screen and Score below button in Threes.
- Larger Threes chords (five or more chord tones: ninths, elevenths, thirteenths) start one octave lower in Explore, Generate and Composition. An explicitly selected low bass is respected.
- Generate and Composition choose the starting register once. Higher inversions rise instead of being moved back down by automatic register normalization.
- Generated chords retain that register when saved to and auditioned from the Pool.
- The written notes, bass and adjacent-step readouts follow the same MIDI pitches used by playback.

Infinity already lowers its playback reference for chords containing five or more tones; its tuning and playback are unchanged in this revision.

The previous requested changes remain: scale inversion pickers and print/import/export removed; chord display and spelling corrections retained. Toolbox opening resources, Circle of Time and sound assets are unchanged.

31 browser checks passed on this revision, including ascending inversion basses, lowered thirteenths in Generate and Composition, large chords in Explore, Pool audition, notation removal, displayed intervals and Infinity non-octave tuning.

This is an editable project, not a precompiled Mac app. Follow START-HERE.txt to build on your Mac. Native Mac compilation, speaker playback, physical sleep/wake and distribution signing remain pending. Nothing has been submitted to Apple.
