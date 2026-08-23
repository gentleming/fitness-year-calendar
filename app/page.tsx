import { requireChatGPTUser } from "./chatgpt-auth";
import FitnessCalendar from "./fitness-calendar";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireChatGPTUser("/");

  return <FitnessCalendar />;
}
