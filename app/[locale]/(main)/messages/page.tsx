import { MessagesInboxClient } from "@/components/messages/MessagesInboxClient";

export default function MessagesPage() {
  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold mb-3">Messages</h1>
      <MessagesInboxClient />
    </div>
  );
}
