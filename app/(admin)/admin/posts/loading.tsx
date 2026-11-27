import { FeedSkeleton } from "@/components/linc/skeletons";

export default function Loading() {
  return <FeedSkeleton count={5} header={false} />;
}
