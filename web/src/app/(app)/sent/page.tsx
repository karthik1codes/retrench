import { SentDraftsStudio } from "@/components/SentDraftsStudio";

export const metadata = {
  title: "Sent",
};

export default function SentPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <SentDraftsStudio initialTab="sent" />
    </div>
  );
}
