import { redirect } from "next/navigation";
import { login } from "@/app/actions/auth";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = { title: "Вход — TaskTracker" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const params = await searchParams;
  const rawNext = params.next;
  const next = typeof rawNext === "string" && rawNext.startsWith("/") ? rawNext : undefined;

  // Пока в системе нет ни одного пароля, входить некому: показываем,
  // как завести первого администратора, вместо пустой формы без объяснений.
  const withPassword = await prisma.member.count({ where: { passwordHash: { not: null } } });

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-2xl font-semibold text-gray-900">Вход в TaskTracker</h1>
      <p className="mt-1 text-sm text-gray-500">Проекты, задачи, письма и документы команды.</p>

      <div className="card mt-6 p-6">
        {withPassword === 0 ? (
          <div className="space-y-2 text-sm text-gray-600">
            <p className="font-medium text-gray-900">Пользователи ещё не заведены.</p>
            <p>
              Создайте первого администратора командой{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-xs">
                npm run auth:admin
              </code>{" "}
              — она спросит почту, ФИО и пароль. Дальше администратор заводит остальных на
              странице «Сотрудники».
            </p>
          </div>
        ) : (
          <LoginForm action={login} next={next} />
        )}
      </div>
    </div>
  );
}
