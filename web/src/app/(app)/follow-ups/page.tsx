import { SentDraftsStudio } from "@/components/SentDraftsStudio";

export const metadata = {
  title: "Follow-ups",
};

export default function FollowUpsPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <SentDraftsStudio initialTab="follow-ups" />
    </div>
  );
}
