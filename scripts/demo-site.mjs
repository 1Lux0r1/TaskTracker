/**
 * Сборка витрины: снимок живых экранов демо в статические страницы.
 *
 * Витрина нужна для постоянного адреса на GitHub Pages: страницы там
 * статические, сервера нет, поэтому настоящая система на Pages не живёт.
 * Снимок даёт походить по реальным экранам с демонстрационными данными —
 * без входа, без сохранения, без фильтров.
 *
 * Запуск:
 *   npm run demo            # в соседнем окне: витрина снимается с живой системы
 *   npx playwright install chromium   # один раз, если браузера ещё нет
 *   npm run demo:site
 *
 * Playwright намеренно не в зависимостях проекта: он нужен только здесь и
 * тянет за собой браузер, а приложению для работы не нужен вовсе.
 */
import { chromium } from "playwright";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BASE = process.env.DEMO_URL ?? "http://localhost:3000";
const OUT = process.argv[2] ?? "demo-site";
const ADMIN = { email: "admin@demo.local", password: "demo-2026" };

/** Сколько всего страниц снимаем. */
const LIMIT = 220;
/**
 * Сколько адресов с параметрами берём на один раздел: без ограничения
 * календарь утаскивает всю витрину на перелистывание месяцев.
 */
const QUERY_PER_SECTION = 3;

/** Адрес страницы → плоское имя файла: страницы лежат рядом, ссылки простые. */
function fileFor(url) {
  const address = new URL(url, BASE);
  if (address.pathname === "/" && !address.search) return "index.html";
  let name = address.pathname.replace(/^\/|\/$/g, "").replace(/\//g, "__");
  if (address.search) {
    const query = [...new URLSearchParams(address.search).entries()]
      .map(([key, value]) => `${key}-${value}`)
      .join("_")
      .replace(/[^a-zA-Z0-9_-]/g, "");
    name += `__q__${query}`;
  }
  return `${name || "index"}.html`;
}

/** Ссылка ведёт на страницу самой системы, которую имеет смысл снимать. */
function sameSite(href) {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return null;
  }
  let address;
  try {
    address = new URL(href, BASE);
  } catch {
    return null;
  }
  if (address.origin !== new URL(BASE).origin) return null;
  if (/^\/(login|api|_next)\b/.test(address.pathname)) return null;
  address.hash = "";
  return address.toString();
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/login`);
  await page.fill("input[type=email]", ADMIN.email);
  await page.fill("input[type=password]", ADMIN.password);
  await page.click("button[type=submit]");
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(path.join(OUT, "assets"), { recursive: true });
  mkdirSync(path.join(OUT, "media"), { recursive: true });

  const queue = [`${BASE}/`];
  const seen = new Set(queue);
  const pages = new Map();
  const styles = new Map();
  const withQuery = new Map();

  while (queue.length > 0 && pages.size < LIMIT) {
    const url = queue.shift();
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    if (!response || response.status() >= 400) continue;
    await page.waitForTimeout(250);

    for (const href of await page.$$eval("link[rel=stylesheet]", (nodes) =>
      nodes.map((node) => node.href),
    )) {
      if (styles.has(href)) continue;
      styles.set(href, await page.evaluate(async (item) => (await fetch(item)).text(), href));
    }

    pages.set(page.url(), await page.content());

    for (const href of await page.$$eval("a[href]", (nodes) =>
      nodes.map((node) => node.getAttribute("href")),
    )) {
      const target = sameSite(href);
      if (!target || seen.has(target)) continue;
      const address = new URL(target);
      if (address.search) {
        const section = address.pathname.split("/")[1] || "index";
        const taken = withQuery.get(section) ?? 0;
        if (taken >= QUERY_PER_SECTION) continue;
        withQuery.set(section, taken + 1);
      }
      seen.add(target);
      queue.push(target);
    }
  }

  const css = [...styles.values()].join("\n");
  writeFileSync(path.join(OUT, "assets/styles.css"), css);

  // Шрифты лежат по пути ../media от таблицы стилей — забираем их с сервера,
  // иначе витрина съедет на системный шрифт.
  const fonts = new Set([...css.matchAll(/url\(\.\.\/media\/([^)]+)\)/g)].map((m) => m[1]));
  for (const font of fonts) {
    const data = await page.evaluate(async (name) => {
      const answer = await fetch(`/_next/static/media/${name}`);
      return [...new Uint8Array(await answer.arrayBuffer())];
    }, font);
    writeFileSync(path.join(OUT, "media", font), Buffer.from(data));
  }

  // Значок вкладки и метка «не собирать Jekyll» — иначе на Pages витрина
  // остаётся без значка, а папки со служебными именами могут не попасть в выкладку.
  const icon = await page.evaluate(async () => {
    const answer = await fetch("/favicon.ico");
    return answer.ok ? [...new Uint8Array(await answer.arrayBuffer())] : null;
  });
  if (icon) writeFileSync(path.join(OUT, "assets/favicon.ico"), Buffer.from(icon));
  writeFileSync(path.join(OUT, ".nojekyll"), "");

  const known = new Map([...pages.keys()].map((url) => [url, fileFor(url)]));
  const scratch = mkdtempSync(path.join(tmpdir(), "demo-site-"));

  for (const [url, html] of pages) {
    const file = known.get(url);
    const source = path.join(scratch, file);
    writeFileSync(source, html);
    await page.goto(`file://${source}`, { waitUntil: "domcontentloaded" });
    await page.evaluate(([pageUrl, pairs]) => {
      const map = new Map(pairs);
      const origin = new URL(pageUrl).origin;

      for (const node of document.querySelectorAll(
        "script, link[rel=preload], link[rel=modulepreload], link[rel=stylesheet], style[data-precedence]",
      )) {
        node.remove();
      }
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "assets/styles.css";
      document.head.append(link);
      document.querySelector("link[rel=icon]")?.setAttribute("href", "assets/favicon.ico");

      for (const anchor of document.querySelectorAll("a[href]")) {
        let target;
        try {
          target = new URL(anchor.getAttribute("href"), pageUrl);
        } catch {
          continue;
        }
        if (target.origin !== origin) continue;
        target.hash = "";
        const file = map.get(target.toString());
        if (file) {
          anchor.setAttribute("href", file);
        } else {
          // Страницы нет в снимке: гасим ссылку, чтобы не вести в пустоту.
          anchor.setAttribute("href", "#");
          anchor.setAttribute("title", "На витрине эта страница не снята");
          anchor.style.opacity = "0.55";
          anchor.style.cursor = "default";
        }
      }

      // Отправлять формы некуда: сервера за витриной нет.
      for (const form of document.querySelectorAll("form")) {
        form.setAttribute("action", "#");
        form.setAttribute("onsubmit", "return false");
      }
      for (const field of document.querySelectorAll("input, select, textarea, button")) {
        if (field.getAttribute("type") !== "hidden") field.setAttribute("disabled", "");
      }

      const banner = document.createElement("div");
      banner.setAttribute(
        "style",
        [
          "background:#1f2937",
          "color:#f9fafb",
          "padding:10px 16px",
          "font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
          "display:flex",
          "gap:12px",
          "flex-wrap:wrap",
          "align-items:baseline",
        ].join(";"),
      );
      banner.innerHTML =
        "<strong>Витрина TaskTracker</strong>" +
        '<span style="opacity:.85">Снимок живой системы на выдуманных данных: по экранам можно ходить, ' +
        "но поля, кнопки и фильтры не работают — страницы статические.</span>" +
        '<a href="https://github.com/1Lux0r1/TaskTracker" style="color:#93c5fd">Как поднять рабочее демо</a>';
      document.body.prepend(banner);
    }, [url, [...known]]);

    const content = await page.content();
    writeFileSync(path.join(OUT, file), `<!doctype html>\n${content.replace(/^<!DOCTYPE html>/i, "")}`);
  }

  rmSync(scratch, { recursive: true, force: true });
  await browser.close();
  console.log(`витрина собрана: ${pages.size} страниц, ${fonts.size} шрифтов, папка ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
