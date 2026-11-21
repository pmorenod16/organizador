import asyncio, sys, pathlib
from playwright.async_api import async_playwright
RAIZ = pathlib.Path(sys.argv[1])
FAKE = (pathlib.Path(__file__).parent / "fake-firebase.js").read_text()
CSV = str(pathlib.Path(__file__).parent / "muestra.csv")
OUT = pathlib.Path(sys.argv[2])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errores = []
        for nombre, vp in [("movil", {"width": 390, "height": 844}), ("pc", {"width": 1280, "height": 820})]:
            ctx = await b.new_context(viewport=vp, device_scale_factor=2 if nombre == "movil" else 1, timezone_id="Europe/Madrid", locale="es-ES")
            await ctx.route("https://www.gstatic.com/**", lambda r: r.fulfill(body=FAKE, content_type="text/javascript"))
            async def servir(route):
                path = route.request.url.split("localhost:9")[1].split("?")[0].split("#")[0]
                f = RAIZ / path.lstrip("/")
                if path.endswith("/"): f = f / "index.html"
                if not f.exists(): return await route.fulfill(status=404, body="no")
                ct = {"js": "text/javascript", "css": "text/css", "html": "text/html", "svg": "image/svg+xml", "png": "image/png", "webmanifest": "application/json"}.get(f.suffix[1:], "application/octet-stream")
                await route.fulfill(body=f.read_bytes(), content_type=ct)
            await ctx.route("http://localhost:9/**", servir)
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e: errores.append(f"{nombre}: {e}"))
            pg.on("console", lambda m: m.type == "error" and errores.append(f"{nombre} console: {m.text}"))
            await pg.goto("http://localhost:9/tareas/#/hoy")
            await pg.wait_for_selector("#app:not([hidden])", timeout=8000)
            if nombre == "movil":
                # importar CSV
                await pg.goto("http://localhost:9/tareas/#/ajustes"); await pg.wait_for_timeout(300)
                await pg.set_input_files("[data-importar]", CSV); await pg.wait_for_timeout(400)
                await pg.screenshot(path=OUT / f"{nombre}-importar.png")
                await pg.click("[data-ok]"); await pg.wait_for_timeout(600)
                await pg.screenshot(path=OUT / f"{nombre}-proyecto.png")
                # abrir pasos de la sesión 1
                await pg.click(".tarea .plegar"); await pg.wait_for_timeout(200)
                await pg.screenshot(path=OUT / f"{nombre}-proyecto-pasos.png")
                # añadido rápido
                await pg.goto("http://localhost:9/tareas/#/hoy"); await pg.wait_for_timeout(300)
                await pg.click("#btnAnadir"); await pg.wait_for_timeout(250)
                await pg.fill(".rapido textarea", "Repasar errores mañana 18:00 #TC !2")
                await pg.dispatch_event(".rapido textarea", "input"); await pg.wait_for_timeout(150)
                await pg.screenshot(path=OUT / f"{nombre}-rapido.png")
                await pg.keyboard.press("Enter"); await pg.wait_for_timeout(200)
                await pg.fill(".rapido textarea", "Llamar al dentista hoy 12:00"); await pg.keyboard.press("Enter"); await pg.wait_for_timeout(200)
                await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
                await pg.screenshot(path=OUT / f"{nombre}-hoy.png")
                # ficha
                await pg.click(".tarea .cuerpo"); await pg.wait_for_timeout(300)
                await pg.screenshot(path=OUT / f"{nombre}-ficha.png", full_page=False)
                await pg.keyboard.press("Escape"); await pg.wait_for_timeout(300)
                # marcar una
                await pg.click(".tarea:last-child .check"); await pg.wait_for_timeout(400)
                for v in ["proximos", "calendario", "estadisticas"]:
                    await pg.goto(f"http://localhost:9/tareas/#/{v}"); await pg.wait_for_timeout(350)
                    await pg.screenshot(path=OUT / f"{nombre}-{v}.png")
                # pomodoro
                await pg.goto("http://localhost:9/tareas/#/hoy"); await pg.wait_for_timeout(300)
                await pg.click("[data-foco]"); await pg.wait_for_timeout(1300)
                await pg.screenshot(path=OUT / f"{nombre}-enfoque.png", full_page=True)
                await pg.click("[data-sub-check]"); await pg.wait_for_timeout(300)
                await pg.click("[data-p=pausar]"); await pg.wait_for_timeout(200)
                await pg.goto("http://localhost:9/tareas/#/proximos"); await pg.wait_for_timeout(300)
                await pg.screenshot(path=OUT / f"{nombre}-minifoco.png")
                await pg.click("#btnMenu"); await pg.wait_for_timeout(300)
                await pg.screenshot(path=OUT / f"{nombre}-menu.png")
                st = await pg.evaluate("localStorage.getItem('__fake')")
                (OUT / "store.json").write_text(st)
            else:
                await ctx.add_init_script("")
                await pg.evaluate("st => { localStorage.setItem('__fake', st); }", (OUT / "store.json").read_text())
                for v in ["hoy", "calendario", "enfoque", "ajustes"]:
                    await pg.goto(f"http://localhost:9/tareas/#/{v}"); await pg.reload(); await pg.wait_for_selector("#app:not([hidden])"); await pg.wait_for_timeout(400)
                    await pg.screenshot(path=OUT / f"{nombre}-{v}.png")
                await pg.goto("http://localhost:9/tareas/#/hoy"); await pg.wait_for_timeout(300)
                await pg.click(".tarea .cuerpo"); await pg.wait_for_timeout(300)
                await pg.screenshot(path=OUT / f"{nombre}-ficha.png")
            await ctx.close()
        await b.close()
        print("\n".join(errores) or "sin errores")
asyncio.run(main())
