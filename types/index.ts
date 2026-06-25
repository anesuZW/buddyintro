import type {
  User,
  Story,
  StoryTag,
  Message,
  Invitation,
  Post,
  AdminSettings,
  DiscoveriesPost,
  DiscoveriesComment,
  StoryStatus,
  MediaType,
  InviteMethod,
  DiscoveriesVisibility,
} from "@prisma/client";

export type {
  User,
  Story,
  StoryTag,
  Message,
  Invitation,
  Post,
  AdminSettings,
  DiscoveriesPost,
  DiscoveriesComment,
  StoryStatus,
  MediaType,
  InviteMethod,
  DiscoveriesVisibility,
};

export type StoryWithRelations = Story & {
  user: Pick<User, "id" | "name" | "profilePicture">;
  category?: { id: string; name: string } | null;
  tags: (StoryTag & {
    taggedUser: Pick<User, "id" | "name" | "profilePicture"> | null;
  })[];
};

export type ConversationSummary = {
  otherUser: Pick<User, "id" | "name" | "profilePicture">;
  lastMessage: Message;
  unreadCount: number;
  trustProfile?: TrustProfilePayload;
};

export type FeedItem =
  | { kind: "story"; story: StoryWithRelations }
  | { kind: "post"; post: Post & { user: Pick<User, "id" | "name" | "profilePicture"> } };

export type TagInput =
  | { kind: "user"; userId: string }
  | { kind: "external"; email: string }
  | { kind: "phone"; phone: string };

export type PhoneInviteShare = {
  inviteToken: string;
  phoneNumber: string;
  inviteLink: string;
  previewLink: string;
  whatsapp: string | null;
  sms: string | null;
  imessage: string | null;
  message: string;
};

export type DiscoveriesPostWithMeta = DiscoveriesPost & {
  user: Pick<User, "id" | "name" | "profilePicture">;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  connectionReason?: ConnectionReasonPayload;
  trustProfile?: TrustProfilePayload;
  comments?: (DiscoveriesComment & {
    user: Pick<User, "id" | "name" | "profilePicture">;
  })[];
};

export type IntroductionEvidencePayload = {
  storyId: string;
  introducer: Pick<User, "id" | "name" | "profilePicture">;
  introducedUsers: Pick<User, "id" | "name" | "profilePicture">[];
  date: string;
  caption: string;
  thumbnail: string;
  storyHref: string;
};

export type ConnectionReasonPayload = {
  reason: string;
  label: string;
  detail: string;
  kind: string;
  mutualCount: number;
  introducerUser: Pick<User, "id" | "name" | "profilePicture"> | null;
  introducerName: string | null;
  introductionStoryId: string | null;
  introductionStoryIds: string[];
  introductionDate: string | null;
  introducers: Pick<User, "id" | "name" | "profilePicture">[];
  storyHref: string | null;
  networkHref: string | null;
  connectionDepth: number | null;
  evidence?: IntroductionEvidencePayload[];
  trustProfile?: TrustProfilePayload;
};

export type TrustProfilePayload = {
  sharedIntroducerCount: number;
  sharedIntroducers: Array<{
    id: string;
    name: string;
    profilePicture: string | null;
    storyHref: string;
    category: { id: string; name: string; icon: string | null; color: string | null } | null;
  }>;
  trustScore: number;
  trustRank?: number;
  trustRankTier?: string;
  trustLevel: string;
  trustLevelLabel: string;
  connectionDegree: number | null;
  verification: {
    emailVerified: boolean;
    phoneVerified: boolean;
    identityVerified: boolean;
    trustedUser?: boolean;
  };
};

export type IntroductionSuggestionPayload = {
  id: string;
  message: string;
  personA: Pick<User, "id" | "name" | "profilePicture">;
  personB: Pick<User, "id" | "name" | "profilePicture">;
  reason: string;
};

export type ChatContextPayload = {
  origin: "story" | "discoveries" | "direct";
  showConnectionPaths?: boolean;
  showConnectionReasons?: boolean;
  story: {
    id: string;
    mediaUrl: string;
    mediaType: string;
    text: string | null;
    caption: string;
    author: Pick<User, "id" | "name" | "profilePicture">;
  } | null;
  discoveriesPost: {
    id: string;
    content: string | null;
    mediaUrl: string | null;
    author: Pick<User, "id" | "name" | "profilePicture">;
  } | null;
  graph: {
    mutualIntroducers: Array<
      Pick<User, "id" | "name" | "profilePicture"> & {
        introducedViewerAt: string;
        introducedOtherAt: string;
        viewerStoryId: string;
        otherStoryId: string;
      }
    >;
    mutualCount: number;
    firstConnectionAt: string | null;
    paths: Array<{
      introducer: Pick<User, "id" | "name" | "profilePicture">;
      toViewer: { storyId: string; at: string };
      toOther: { storyId: string; at: string };
    }>;
    pathChain: Array<
      Pick<User, "id" | "name" | "profilePicture"> & { storyId: string | null }
    >;
    connectionReason: ConnectionReasonPayload;
    trustProfile?: TrustProfilePayload;
    relatedByIntroducer: Array<{
      introducer: Pick<User, "id" | "name" | "profilePicture">;
      people: Array<
        Pick<User, "id" | "name" | "profilePicture"> & {
          storyId: string;
          introducedAt: string;
        }
      >;
    }>;
  } | null;
};

export type IntroductionGroup = "recent" | "past" | "pending";

export type IntroductionItem = StoryWithRelations & {
  group: IntroductionGroup;
  isUnread: boolean;
};

export type NotificationPayload = {
  id: string;
  userId: string;
  actorId: string | null;
  type: string;
  title: string;
  message: string;
  entityType: string | null;
  entityId: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  href: string;
  priority?: number;
  actor?: {
    id: string;
    name: string;
    profilePicture: string | null;
  } | null;
};
