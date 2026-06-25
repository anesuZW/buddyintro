import "server-only";

import { searchUsers } from "@/services/tags";
import { getTrustProfilesBulk } from "@/services/trust-profile";
import type { TrustProfilePayload } from "@/types";

export type SearchUserResult = Awaited<ReturnType<typeof searchUsers>>[number] & {
  trustProfile?: TrustProfilePayload;
};

export async function searchUsersWithTrust(
  query: string,
  viewerId: string,
  limit = 8
): Promise<SearchUserResult[]> {
  const users = await searchUsers(query, viewerId, limit);
  if (!users.length) return [];

  const trustMap = await getTrustProfilesBulk(
    viewerId,
    users.map((u) => u.id)
  );

  return users.map((u) => ({
    ...u,
    trustProfile: trustMap.get(u.id),
  }));
}
