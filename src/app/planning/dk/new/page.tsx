import { NewDkScreen } from "./screen";

export const dynamic = "force-dynamic";

export default async function NewDkPage(props: PageProps<"/planning/dk/new">) {
  return <NewDkScreen searchParams={props.searchParams} />;
}
