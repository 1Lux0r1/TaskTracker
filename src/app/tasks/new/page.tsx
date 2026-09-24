import { NewTaskScreen } from "./screen";

export const dynamic = "force-dynamic";

export default async function NewTaskPage(props: PageProps<"/tasks/new">) {
  return <NewTaskScreen searchParams={props.searchParams} />;
}
