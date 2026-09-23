import type { NextConfig } from "next";
import { REQUEST_BODY_LIMIT } from "./src/lib/limits";

const nextConfig: NextConfig = {
  experimental: {
    // Вложения уходят на сервер тем же действием, что и форма, поэтому предел
    // тела запроса поднят до размера файла с запасом на служебные поля.
    serverActions: { bodySizeLimit: REQUEST_BODY_LIMIT },
    // При наличии src/proxy.ts Next буферизует тело каждого запроса, чтобы
    // его можно было прочитать дважды, и по умолчанию обрезает буфер на
    // 10 МБ. Обрезанное тело доходит до разбора формы неполным, и загрузка
    // файла больше 10 МБ падала с «Unexpected end of form». Предел должен
    // быть не меньше предела действия.
    proxyClientMaxBodySize: REQUEST_BODY_LIMIT,
  },
};

export default nextConfig;
