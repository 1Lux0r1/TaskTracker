import { NewDirectionScreen } from "./screen";

export const dynamic = "force-dynamic";

export default async function NewDirectionPage(props: PageProps<"/planning/directions/new">) {
  return <NewDirectionScreen searchParams={props.searchParams} />;
}
