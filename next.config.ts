import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Вложения уходят на сервер тем же действием, что и форма, поэтому предел
    // тела запроса поднят до размера файла с запасом на служебные поля.
    serverActions: { bodySizeLimit: "21mb" },
  },
};

export default nextConfig;
