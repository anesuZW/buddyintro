import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { IntroductionNetworkView } from "@/components/connections/IntroductionNetworkView";

export default async function IntroductionNetworkPage({
  searchParams,
}: {
  searchParams: { users?: string };
}) {
  const me = await requireUser();
  if (!searchParams.users) redirect("/introductions");

  const ids = searchParams.users.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length < 2) {
    redirect("/introductions");
  }

  const userA = ids.includes(me.id) ? me.id : ids[0];
  const userB = ids.find((id) => id !== userA) ?? ids[1];

  return <IntroductionNetworkView userAId={userA} userBId={userB} />;
}
