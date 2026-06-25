/** Pure mutual-introducer helpers — safe to import from tests (no server-only). */

export type IntroUserLite = {
  id: string;
  name: string;
  profilePicture: string | null;
};

export type IntroductionEdgeLite = {
  introducerId: string;
  introducedId: string;
  storyId: string;
  introducedAt: Date;
  introducer: IntroUserLite;
};

export type MutualIntroducerLite = IntroUserLite & {
  introducedViewerAt: Date;
  introducedOtherAt: Date;
  viewerStoryId: string;
  otherStoryId: string;
};

export type IntroductionPathLite = {
  introducer: IntroUserLite;
  toViewer: { storyId: string; at: Date };
  toOther: { storyId: string; at: Date };
};

export function computeMutualIntroducersFromIndex(
  userAId: string,
  userBId: string,
  introducersOf: Map<string, IntroductionEdgeLite[]>
): MutualIntroducerLite[] {
  const edgesA = introducersOf.get(userAId) ?? [];
  const edgesB = introducersOf.get(userBId) ?? [];
  const byIntroducerB = new Map(edgesB.map((e) => [e.introducerId, e]));

  const mutual: MutualIntroducerLite[] = [];
  for (const edgeA of edgesA) {
    const edgeB = byIntroducerB.get(edgeA.introducerId);
    if (!edgeB) continue;
    mutual.push({
      ...edgeA.introducer,
      introducedViewerAt: edgeA.introducedAt,
      introducedOtherAt: edgeB.introducedAt,
      viewerStoryId: edgeA.storyId,
      otherStoryId: edgeB.storyId,
    });
  }

  return mutual.sort(
    (a, b) => a.introducedViewerAt.getTime() - b.introducedViewerAt.getTime()
  );
}

export function mutualIntroducersToPaths(
  mutual: MutualIntroducerLite[]
): IntroductionPathLite[] {
  return mutual.map((m) => ({
    introducer: m,
    toViewer: { storyId: m.viewerStoryId, at: m.introducedViewerAt },
    toOther: { storyId: m.otherStoryId, at: m.introducedOtherAt },
  }));
}
