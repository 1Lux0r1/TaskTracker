import { NewMeetingScreen } from "./screen";

export const dynamic = "force-dynamic";

export default async function NewMeetingPage(props: PageProps<"/meetings/new">) {
  return <NewMeetingScreen searchParams={props.searchParams} />;
}
