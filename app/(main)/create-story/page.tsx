import { requireUser } from "@/lib/auth";
import { IntroductionCreator } from "@/components/create/IntroductionCreator";
import { COPY } from "@/lib/copy";

export default async function CreateIntroductionPage() {
  const user = await requireUser();
  return (
    <div>
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">{COPY.createIntroduction}</h1>
        <p className="text-sm text-muted-foreground mt-1">{COPY.createHelper}</p>
      </div>
      <IntroductionCreator currentUserId={user.id} />
    </div>
  );
}
