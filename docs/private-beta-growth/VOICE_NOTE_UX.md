# Voice Note / Video Story UX

## Before

`StoryPlayer` advanced on a fixed 6s (image) / 12s (video) timer regardless of voice or video length. Hold-to-pause only froze the progress bar — audio/video kept playing. Voice notes up to 120s were cut off.

## After (`components/stories/StoryPlayer.tsx`)

| Behaviour | Implementation |
|-----------|----------------|
| Video / voice present | Progress follows `currentTime / duration` |
| Auto-advance | Waits for media `ended` (with safety timeout) |
| Hold / pause | Pauses `<video>` and `<audio>` as well as the bar |
| Tab hide / background | `visibilitychange` pauses playback |
| Silent image | Unchanged 6s segment timer |
| Mute toggle | Preserved; voice-on-image starts unmuted |

## Manual checks

- [ ] Image + voice note plays fully before advance  
- [ ] Long video does not cut at 12s  
- [ ] Hold pauses both bar and audio  
- [ ] Switch apps → playback pauses  
