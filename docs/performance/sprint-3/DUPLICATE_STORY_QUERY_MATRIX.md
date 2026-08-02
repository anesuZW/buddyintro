# Duplicate Story Query Matrix

**Generated:** 2026-07-26T16:19:37.723Z

| Query | Before executions | After | Mechanism |
| --- | --- | --- | --- |
| StoryTag scan (authored) | 1 (ctx) + 0 | 1 | Consolidated query A |
| StoryTag scan (viewer tagged) | 1 (ctx) + 2 (visibility) + 1 (stats) | 1 | Query B + prefetch sets |
| StoryTag.count introducedByMe | 1 | 0 | Derived in context |
| StoryTag.count introducedToMe | 1 | 0 | Derived in context |
| StoryTag distinct introducers | 1 | 0 | Derived unique author set |
| StoryTag distinct targets | 1 | 0 | Derived introducedTargetIds |
| Visibility co-tag prefetch | 1 per story bar | 0 | coTagAuthorIds set |
| Visibility ever-introduced | 1 per story bar | 0 | everIntroducedAuthorIds set |
