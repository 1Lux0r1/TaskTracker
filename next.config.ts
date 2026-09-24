import type { NextConfig } from "next";
import { REQUEST_BODY_LIMIT } from "./src/lib/limits";

/**
 * Адреса, за которыми приложение может стоять, кроме собственного. Проверка
 * от подделки запросов сверяет заголовок Origin с адресом приложения, а за
 * прокси GitHub Codespaces браузер видит адрес вида
 * `имя-3000.app.github.dev`, тогда как сервер у себя знает только
 * `localhost:3000`. Без этого списка любое сохранение формы в Codespaces
 * отклоняется, и демо выглядит сломанным.
 */
const PROXY_HOSTS = ["**.github.dev"];

const nextConfig: NextConfig = {
  // Тот же список для режима разработки: иначе сервер не отдаёт свои файлы.
  allowedDevOrigins: PROXY_HOSTS,
  experimental: {
    // Вложения уходят на сервер тем же действием, что и форма, поэтому предел
    // тела запроса поднят до размера файла с запасом на служебные поля.
    serverActions: { bodySizeLimit: REQUEST_BODY_LIMIT, allowedOrigins: PROXY_HOSTS },
    // При наличии src/proxy.ts Next буферизует тело каждого запроса, чтобы
    // его можно было прочитать дважды, и по умолчанию обрезает буфер на
    // 10 МБ. Обрезанное тело доходит до разбора формы неполным, и загрузка
    // файла больше 10 МБ падала с «Unexpected end of form». Предел должен
    // быть не меньше предела действия.
    proxyClientMaxBodySize: REQUEST_BODY_LIMIT,
  },
};

export default nextConfig;
