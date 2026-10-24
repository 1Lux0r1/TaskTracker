import { redirect } from "next/navigation";
import { login, setupFirstAdmin } from "@/app/actions/auth";
import { FirstAdminForm } from "@/components/first-admin-form";
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

  // Пока в системе нет ни одного пароля, входить некому: вместо формы входа
  // предлагаем завести первого администратора.
  const withPassword = await prisma.member.count({ where: { passwordHash: { not: null } } });

  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="text-2xl font-semibold text-gray-900">Вход в TaskTracker</h1>
      <p className="mt-1 text-sm text-gray-500">Проекты, задачи, письма и документы команды.</p>

      <div className="card mt-6 p-6">
        {withPassword === 0 ? (
          <FirstAdminForm action={setupFirstAdmin} />
        ) : (
          <LoginForm action={login} next={next} />
        )}
      </div>
    </div>
  );
}
