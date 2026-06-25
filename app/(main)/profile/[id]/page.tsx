import Link from "next/link";

import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";

import { prisma } from "@/lib/prisma";

import { getConnectionReason } from "@/lib/introduction-graph";

import { serializeConnectionReason } from "@/lib/connection-reason";

import { getTrustProfile } from "@/services/trust-profile";
import { getProfileTrustNetwork } from "@/services/trust-network";
import { SharedIntroducersPanel } from "@/components/trust/SharedIntroducersPanel";
import { VerificationBadges } from "@/components/trust/VerificationBadges";
import { TrustedUserBadge } from "@/components/trust/TrustedUserBadge";
import { TrustRankBadge } from "@/components/trust/TrustRankBadge";
import { TrustRecommendationsPanel } from "@/components/trust/TrustRecommendationsPanel";

import { Avatar } from "@/components/ui/Avatar";

import { ConnectionReasonLink } from "@/components/connections/ConnectionReasonLink";

import { IntroductionTimeline } from "@/components/connections/IntroductionTimeline";

import { ProfileEditor } from "@/components/profile/ProfileEditor";

import { TrustNetworkSection } from "@/components/profile/TrustNetworkSection";
import { BlockUserButton } from "@/components/moderation/BlockUserButton";
import { ReportContentButton } from "@/components/moderation/ReportContentButton";
import { getBlockStatus } from "@/services/moderation";

import { COPY } from "@/lib/copy";



export default async function UserProfilePage({

  params,

}: {

  params: { id: string };

}) {

  const me = await requireUser();

  const user = await prisma.user.findUnique({

    where: { id: params.id },

    select: {

      id: true,

      name: true,

      email: true,

      profilePicture: true,

      invitesSent: true,

      invitesRegistered: true,

      emailVerified: true,

      phoneVerified: true,

      identityVerified: true,

      trustedUser: true,

      verificationLevel: true,

    },

  });



  if (!user) notFound();



  const isSelf = me.id === user.id;
  const blockStatus = isSelf ? null : await getBlockStatus(me.id, user.id);

  const [connectionReason, trustNetwork, trustProfile] = await Promise.all([

    isSelf

      ? null

      : serializeConnectionReason(await getConnectionReason(me.id, user.id), me.id, user.id),

    getProfileTrustNetwork(me.id, user.id),

    isSelf ? null : getTrustProfile(me.id, user.id),

  ]);



  return (

    <div className="px-4 py-6 max-w-lg mx-auto">

      <div className="card p-6 flex flex-col items-center text-center bg-fi-card border-primary/10">

        <Avatar src={user.profilePicture} name={user.name} size="xl" ring />

        <h1 className="mt-4 text-xl font-bold">{user.name}</h1>

        <div className="mt-2 flex flex-wrap justify-center gap-1">
          <TrustedUserBadge
            trustedUser={user.trustedUser}
            verificationLevel={user.verificationLevel}
          />
          {!isSelf && trustProfile && (
            <TrustRankBadge tier={trustProfile.trustRankTier} />
          )}
        </div>

        {isSelf && (

          <p className="text-sm text-muted-foreground">{user.email}</p>

        )}



        <div className="mt-6 grid grid-cols-2 gap-3 w-full">

          <div className="rounded-2xl bg-muted p-4 text-center">

            <div className="text-2xl font-bold">{trustNetwork.stats.peopleYouIntroduced}</div>

            <div className="text-xs text-muted-foreground">{COPY.peopleIntroduced}</div>

          </div>

          <div className="rounded-2xl bg-muted p-4 text-center">

            <div className="text-2xl font-bold">{trustNetwork.stats.peopleIntroducedToYou}</div>

            <div className="text-xs text-muted-foreground">{COPY.introducedBy}</div>

          </div>

        </div>

      </div>



      {!isSelf && trustProfile && (

        <div className="mt-6">

          <SharedIntroducersPanel trustProfile={trustProfile} />

        </div>

      )}



      {(isSelf || user.emailVerified || user.phoneVerified || user.identityVerified) && (

        <div className="mt-4 card p-4 space-y-2">

          <h2 className="text-sm font-semibold">{COPY.trustAndVerification}</h2>

          <VerificationBadges

            verification={{

              emailVerified: user.emailVerified,

              phoneVerified: user.phoneVerified,

              identityVerified: user.identityVerified,

            }}

          />

        </div>

      )}



      <TrustNetworkSection data={trustNetwork} viewerId={me.id} profileUserId={user.id} />

      {isSelf && (
        <div className="mt-6">
          <TrustRecommendationsPanel title="Grow your trust network" />
        </div>
      )}

      {!isSelf && connectionReason && (

        <div className="mt-4">

          <h2 className="text-sm font-semibold mb-2 px-1">{COPY.howYouAreConnected}</h2>

          <ConnectionReasonLink connectionReason={connectionReason} />

          {connectionReason.evidence && connectionReason.evidence.length > 0 && (

            <div className="mt-4">

              <IntroductionTimeline items={connectionReason.evidence} />

            </div>

          )}

        </div>

      )}



      {!isSelf && (
        <div className="mt-4 space-y-3">
          <Link href={`/messages/${user.id}`} className="btn-primary w-full block text-center">
            Message {user.name.split(" ")[0]}
          </Link>
          <div className="flex flex-wrap gap-2 justify-center">
            <BlockUserButton userId={user.id} initialBlocked={blockStatus?.blockedByMe} />
            <ReportContentButton targetType="user" targetId={user.id} />
          </div>
        </div>
      )}



      {isSelf && (

        <ProfileEditor

          userId={user.id}

          initial={{ name: user.name, profilePicture: user.profilePicture }}

        />

      )}

    </div>

  );

}

