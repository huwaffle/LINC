import Link from "next/link";
import type { MentionTarget } from "@/lib/db/queries";
import { splitMentions } from "@/lib/mentions";

/** Comment text with @nickname mentions linked to the mentioned profile. */
export function CommentBody({
  body,
  mentions,
}: {
  body: string;
  mentions: ReadonlyMap<string, MentionTarget>;
}) {
  return (
    <>
      {splitMentions(body, mentions).map((part, i) =>
        part.type === "mention" ? (
          <Link
            key={i}
            href={`/u/${part.username}`}
            className="font-semibold text-linc-700 hover:underline"
          >
            {part.text}
          </Link>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
