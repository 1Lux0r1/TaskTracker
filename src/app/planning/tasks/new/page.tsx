import { NewPlanTaskScreen } from "./screen";

export const dynamic = "force-dynamic";

export default async function NewPlanTaskPage(props: PageProps<"/planning/tasks/new">) {
  return <NewPlanTaskScreen searchParams={props.searchParams} />;
}
