"""Genera docs/flujo-synthex-kitchen.excalidraw (flujo del aplicativo Synthex Kitchen).

Uso: python3 docs/generar_flujo.py
Abre el resultado en https://excalidraw.com (menú -> Abrir).
"""
import json, random

FS = 20
# Paleta por tipo de nodo: (relleno, borde)
C = {
    "nav": ("#a5d8ff", "#1971c2"),
    "inv": ("#b2f2bb", "#2f9e44"),
    "prod": ("#d0bfff", "#7048e8"),
    "sale": ("#ffd8a8", "#e8590c"),
    "dec": ("#fff3bf", "#f08c00"),
    "err": ("#ffc9c9", "#e03131"),
    "mov": ("#c3fae8", "#0c8599"),
    "tech": ("#e9ecef", "#495057"),
    "ai": ("#fcc2d7", "#c2255c"),
}

shapes = []  # dicts: id,type,x,y,w,h,text,kind
arrows = []  # dicts: id,from,to,fp_from,fp_to,label,dashed,color,points(optional abs)
texts = []
zones = []


def box(id, x, y, text, kind, w=None, h=None, t="rectangle", fs=FS):
    lines = text.split("\n")
    mw = max(len(l) for l in lines)
    w = w or int(mw * fs * 0.55 + 40)
    h = h or int(len(lines) * fs * 1.25 + 34)
    shapes.append(dict(id=id, type=t, x=x, y=y, w=w, h=h, text=text, kind=kind, fs=fs))
    return shapes[-1]


def arrow(id, a, b, fa, fb, label=None, dashed=False, color="#1e1e1e", via=None):
    arrows.append(dict(id=id, a=a, b=b, fa=fa, fb=fb, label=label, dashed=dashed, color=color, via=via or []))


def text(id, x, y, s, fs=FS, color="#1e1e1e"):
    texts.append(dict(id=id, x=x, y=y, text=s, fs=fs, color=color))


def zone(id, x, y, w, h, label, color, stroke):
    zones.append(dict(id=id, x=x, y=y, w=w, h=h, label=label, color=color, stroke=stroke))


# ---------------- layout ----------------
text("title", 0, -110, "Synthex Kitchen - Flujo del aplicativo (Forno Pizza)", 34)
text("subtitle", 0, -62, "Del costal de harina a la pizza vendida: cómo se conectan recetas, producción y ventas con el inventario", 20, "#495057")

# Zone 1: navigation / setup
zone("z1", -30, -10, 1700, 200, "1. Ingreso y datos maestros", "#dbe4ff", "#4263eb")
box("login", 0, 40, "Login demo\n(sin validar credenciales)", "nav", w=290, h=110)
box("dash", 370, 40, "Dashboard\nKPIs calculados desde stock\ny movimientos reales", "nav", w=320, h=110)
box("inv", 770, 40, "Inventario\nMateria prima / Preparación /\nProducto de venta", "inv", w=340, h=110)
box("rec", 1190, 40, "Recetas (lista de materiales)\nIngredientes + rendimiento\n+ costo calculado", "inv", w=440, h=110)
arrow("a_login", "login", "dash", [1, .5], [0, .5], "Ingresar")
arrow("a_dash", "dash", "inv", [1, .5], [0, .5])
arrow("a_inv", "inv", "rec", [1, .5], [0, .5], "define")

# Zone 2: production
zone("z2", -30, 230, 820, 640, "2. Producción: materia prima -> preparación", "#e5dbff", "#7048e8")
box("op", 180, 290, "Nueva orden de producción\nBorrador / Pendiente\n(no mueve stock)", "prod", w=380, h=110)
box("d_op", 220, 440, "Insumos\nsuficientes?", "dec", w=300, h=150, t="diamond")
box("e_op", 0, 650, "Bloquea y muestra\nqué falta y cuánto", "err", w=270, h=100)
box("comp", 330, 640, "En producción -> Completada\n- materias primas (salida)\n+ preparación (entrada)", "prod", w=420, h=120)
arrow("a_rec_op", "rec", "op", [.25, 1], [.5, 0], "receta de masa / salsa", via=[[1300, 210], [370, 210]])
arrow("a_op_d", "op", "d_op", [.5, 1], [.5, 0])
box("ai", -15, 280, "Asistente IA\nsugiere qué\npreparar hoy", "ai", w=170, h=130)
arrow("a_ai_op", "ai", "op", [1, .5], [0, .5], dashed=True, color="#c2255c")
arrow("a_d_no", "d_op", "e_op", [0, .5], [.5, 0], "No", color="#e03131", via=[[135, 515]])
arrow("a_d_si", "d_op", "comp", [.5, 1], [.5, 0], "Sí", color="#2f9e44")

# Zone 3: sales
zone("z3", 850, 230, 820, 640, "3. Venta: preparación -> pizza vendida", "#fff4e6", "#e8590c")
box("sale", 1060, 290, "Nueva venta\ncarrito + método de pago\n(borrador no mueve stock)", "sale", w=380, h=110)
box("d_sale", 1100, 440, "Componentes\nsuficientes?", "dec", w=300, h=150, t="diamond")
box("e_sale", 1460, 455, "Rechaza la venta\ncompleta (sin\nventas parciales)", "err", w=195, h=120)
box("conf", 900, 640, "Venta confirmada\n- masa, - salsa preparada\n- queso, - toppings", "sale", w=380, h=120)
box("void", 1330, 650, "Anular venta\nrevierte una sola vez", "sale", w=300, h=100)
arrow("a_rec_sale", "rec", "sale", [.6, 1], [.5, 0], "receta de cada pizza")
arrow("a_s_d", "sale", "d_sale", [.5, 1], [.5, 0])
arrow("a_ds_no", "d_sale", "e_sale", [1, .5], [0, .5], "No", color="#e03131")
arrow("a_ds_si", "d_sale", "conf", [.5, 1], [.5, 0], "Sí", color="#2f9e44", via=[[1250, 615], [1090, 615]])
arrow("a_conf_void", "conf", "void", [1, .5], [0, .5], dashed=True)

# Movements
box("mov", 330, 930, "Movimientos (kardex)\nentrada / salida / ajuste, stock antes y después,\nreferencia OP-xxxx / V-xxxxx / AJ-xxxx", "mov", w=760, h=130)
box("adj", 0, 945, "Ajuste manual\n(con motivo)", "mov", w=240, h=100)
arrow("a_comp_mov", "comp", "mov", [.5, 1], [.35, 0])
arrow("a_conf_mov", "conf", "mov", [.5, 1], [.85, 0])
arrow("a_void_mov", "void", "mov", [.5, 1], [1, .5], dashed=True, via=[[1480, 995]])
arrow("a_adj_mov", "adj", "mov", [1, .5], [0, .5])

# Zone 4: tech
zone("z4", -30, 1110, 1700, 250, "4. Cómo se garantiza la consistencia (arquitectura)", "#f1f3f5", "#495057")
box("t_ui", 0, 1180, "UI React\n(TanStack Start)", "tech", w=250, h=110)
box("t_store", 330, 1180, "store.ts\nvalida y actualiza\nen pantalla (optimista)", "tech", w=300, h=110)
box("t_rpc", 710, 1170, "Funciones sk_* en Postgres (Supabase)\n1 transacción: valida stock, bloquea filas,\nnunca deja stock negativo", "tech", w=520, h=130)
box("t_state", 1310, 1180, "sk_get_state\nrecarga el estado real", "tech", w=320, h=110)
arrow("t1", "t_ui", "t_store", [1, .5], [0, .5])
arrow("t2", "t_store", "t_rpc", [1, .5], [0, .5], "RPC")
arrow("t3", "t_rpc", "t_state", [1, .5], [0, .5])
arrow("t4", "t_state", "t_ui", [.5, 1], [.5, 1], "fuente de verdad", dashed=True, via=[[1470, 1335], [125, 1335]])

text("note", 0, 1380, "Regla clave: un índice único (tipo de referencia, documento, producto) impide que una orden o venta descuente inventario dos veces.", 18, "#495057")


# ---------------- helpers ----------------
def find(i):
    return next(s for s in shapes if s["id"] == i)


def pt(s, fp):
    return [s["x"] + s["w"] * fp[0], s["y"] + s["h"] * fp[1]]


def arrow_points(a):
    sa, sb = find(a["a"]), find(a["b"])
    p0 = pt(sa, a["fa"]); p1 = pt(sb, a["fb"])
    pts = [p0] + a["via"] + [p1]
    return pts


# ---------------- full .excalidraw format ----------------
def base(id, typ, x, y, w, h, **kw):
    e = {"id": id, "type": typ, "x": x, "y": y, "width": w, "height": h, "angle": 0,
         "strokeColor": "#1e1e1e", "backgroundColor": "transparent", "fillStyle": "solid", "strokeWidth": 2,
         "strokeStyle": "solid", "roughness": 1, "opacity": 100, "groupIds": [], "frameId": None,
         "roundness": None, "seed": random.randint(1, 2**31), "version": 1, "versionNonce": random.randint(1, 2**31),
         "isDeleted": False, "boundElements": [], "updated": 1, "link": None, "locked": False}
    e.update(kw)
    return e


def ftext(id, x, y, s, fs, color="#1e1e1e", container=None, align="left"):
    lines = s.split("\n")
    w = max(len(l) for l in lines) * fs * 0.55
    h = len(lines) * fs * 1.25
    return base(id, "text", x, y, w, h, strokeColor=color, text=s, originalText=s, fontSize=fs, fontFamily=5,
                textAlign=align, verticalAlign="middle" if container else "top", containerId=container,
                lineHeight=1.25, autoResize=True)


def full():
    random.seed(7)
    out = []
    for zz in zones:
        out.append(base(zz["id"], "rectangle", zz["x"], zz["y"], zz["w"], zz["h"], backgroundColor=zz["color"],
                        strokeColor=zz["stroke"], strokeWidth=1, opacity=45, roundness={"type": 3}))
        out.append(ftext(zz["id"] + "_t", zz["x"] + 16, zz["y"] + 8, zz["label"], 18, zz["stroke"]))
    bound = {s["id"]: [] for s in shapes}
    for a in arrows:
        bound[a["a"]].append({"type": "arrow", "id": a["id"]}); bound[a["b"]].append({"type": "arrow", "id": a["id"]})
    for s in shapes:
        bg, st = C[s["kind"]]
        tid = s["id"] + "_label"
        e = base(s["id"], s["type"], s["x"], s["y"], s["w"], s["h"], backgroundColor=bg, strokeColor=st,
                 roundness={"type": 3} if s["type"] == "rectangle" else {"type": 2},
                 boundElements=[{"type": "text", "id": tid}] + bound[s["id"]])
        out.append(e)
        lines = s["text"].split("\n"); fs = 18
        tw = max(len(l) for l in lines) * fs * 0.55; th = len(lines) * fs * 1.25
        out.append(ftext(tid, s["x"] + (s["w"] - tw) / 2, s["y"] + (s["h"] - th) / 2, s["text"], fs, "#1e1e1e", s["id"], "center"))
    for a in arrows:
        pts = arrow_points(a)
        x0, y0 = pts[0]
        rel = [[p[0] - x0, p[1] - y0] for p in pts]
        xs = [p[0] for p in rel]; ys = [p[1] for p in rel]
        e = base(a["id"], "arrow", x0, y0, max(xs) - min(xs), max(ys) - min(ys), strokeColor=a["color"],
                 strokeStyle="dashed" if a["dashed"] else "solid", roundness={"type": 2} if len(pts) == 2 else None, strokeSharpness="round" if len(pts) == 2 else "sharp",
                 points=rel, lastCommittedPoint=None, startArrowhead=None, endArrowhead="arrow",
                 startBinding={"elementId": a["a"], "focus": 0, "gap": 4, "fixedPoint": a["fa"]},
                 endBinding={"elementId": a["b"], "focus": 0, "gap": 4, "fixedPoint": a["fb"]}, elbowed=False)
        if a["label"]:
            lid = a["id"] + "_label"
            e["boundElements"] = [{"type": "text", "id": lid}]
            mid = pts[len(pts) // 2 - (1 if len(pts) % 2 == 0 else 0)]
            nxt = pts[min(len(pts) - 1, pts.index(mid) + 1)]
            cx, cy = (mid[0] + nxt[0]) / 2, (mid[1] + nxt[1]) / 2
            out.append(e)
            tw = len(a["label"]) * 16 * 0.55
            out.append(ftext(lid, cx - tw / 2, cy - 10, a["label"], 16, a["color"], a["id"], "center"))
        else:
            out.append(e)
    for t in texts:
        out.append(ftext(t["id"], t["x"], t["y"], t["text"], t["fs"], t["color"]))
    return {"type": "excalidraw", "version": 2, "source": "https://excalidraw.com", "elements": out,
            "appState": {"gridSize": 20, "viewBackgroundColor": "#ffffff"}, "files": {}}


if __name__ == "__main__":
    import os
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "flujo-synthex-kitchen.excalidraw")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(full(), f, ensure_ascii=False, indent=1)
    print("Generado:", out)
