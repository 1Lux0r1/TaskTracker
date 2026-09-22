import { changeOwnPassword } from "@/app/actions/auth";
import { PasswordForm } from "@/components/password-form";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/domain";

export const dynamic = "force-dynamic";

export const metadata = { title: "Мой профиль — TaskTracker" };

export default async function ProfilePage() {
  const user = await requireUser();
  const sessions = await prisma.session.count({ where: { memberId: user.id } });

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">Мой профиль</h1>

      <div className="card space-y-1 p-6 text-sm">
        <p className="text-lg font-medium text-gray-900">{user.fullName}</p>
        <p className="text-gray-500">{user.position ?? "Должность не указана"}</p>
        <p className="text-gray-500">{user.email}</p>
        <p className="text-gray-500">
          Роль: {user.role === "ADMIN" ? "администратор" : "участник"}
        </p>
        <p className="text-gray-500">
          Активных входов: {sessions} · сегодня {formatDate(new Date())}
        </p>
      </div>

      <div className="card space-y-3 p-6">
        <h2 className="text-lg font-medium text-gray-900">Смена пароля</h2>
        <p className="text-sm text-gray-500">
          После смены остальные устройства придётся авторизовать заново.
        </p>
        <PasswordForm action={changeOwnPassword} />
      </div>
    </div>
  );
}
