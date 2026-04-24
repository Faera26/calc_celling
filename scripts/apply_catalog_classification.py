from __future__ import annotations

import base64
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CATALOG_JSON = ROOT / "app" / "src" / "data" / "normalized_catalog.json"
MIGRATION_SQL = ROOT / "infra" / "supabase" / "migrations" / "20260424183000_catalog_logical_categories.sql"
HTML_PRODUCTS_FILE = "tolko tovari.html"
HTML_NODES_SERVICES_FILE = "uzli_tovari_uslugi.html"
CLASSIFICATION_FILE = "catalog-logical-classification.md"

TYPE_TO_ENTITY = {
    "Товар": "tovar",
    "Услуга": "usluga",
    "Узел": "uzel",
}

ENTITY_TO_LABEL = {
    "tovar": "Товар",
    "usluga": "Услуга",
    "uzel": "Узел",
}

ENTITY_TO_TABLE = {
    "tovar": "tovary",
    "usluga": "uslugi",
    "uzel": "uzly",
}

SOURCE_BY_ENTITY = {
    "tovar": "html_1.products",
    "usluga": "html_2.services",
}


def html_dir() -> Path:
    for child in ROOT.iterdir():
        if child.is_dir() and child.name.startswith("html"):
            return child
    raise FileNotFoundError("HTML data directory was not found")


def extract_catalog_data(path: Path) -> dict[str, list[dict[str, Any]]]:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"const CATALOG_DATA = (\{.*?\});\s*const STORAGE_KEY", text, re.S)
    if not match:
        raise ValueError(f"Cannot find CATALOG_DATA in {path}")
    return json.loads(match.group(1))


def parse_classification(path: Path) -> dict[tuple[str, str], tuple[str, str]]:
    pattern = re.compile(r"^- (.*?) -> (.*?) -> (.*?) \(([^()]*)\)$")
    mapping: dict[tuple[str, str], tuple[str, str]] = {}

    for line in path.read_text(encoding="utf-8").splitlines():
        match = pattern.match(line.strip())
        if not match:
            continue

        category, subcategory, name, label = match.groups()
        entity = TYPE_TO_ENTITY.get(label)
        if entity:
            mapping[(entity, name)] = (category, subcategory)

    return mapping


def text(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    return str(value).strip() or fallback


def lower_text(*values: Any) -> str:
    return " ".join(text(value).lower() for value in values if text(value))


def has_any(source: str, needles: tuple[str, ...]) -> bool:
    return any(needle in source for needle in needles)


def number(value: Any) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return 0.0
    return parsed if parsed == parsed else 0.0


def component_entity(kind: Any) -> str:
    value = text(kind).lower()
    if "товар" in value or "product" in value:
        return "tovar"
    return "usluga"


def classify_work_or_node(item: dict[str, Any], entity: str) -> tuple[str, str] | None:
    if entity not in {"usluga", "uzel"}:
        return None

    name = lower_text(item.get("name"))
    source = lower_text(item.get("name"), item.get("category"), item.get("subcategory"))

    if has_any(source, ("пожар", "сигнализац")):
        return ("Пожарная безопасность", "Сигнализация и датчики")

    if has_any(source, ("вент", "вытяж", "диффуз", "решет", "решёт")):
        return ("Вентиляция", "Вытяжки, решетки и диффузоры")

    if has_any(source, ("керамогран", "плитк", "сверлен", "затир", "приклейка профиля")):
        return ("Работы по плитке", "Плитка и керамогранит")

    if "демонтаж" in source:
        return ("Демонтаж", "Демонтаж полотна и профиля")

    if (
        has_any(source, ("провод", "подключ", "пульт ду"))
        and "шинопровод" not in source
        and not has_any(source, ("светильник", "светильн", "свет-ка", "люстр"))
    ):
        return ("Электрика", "Подключение и проводка")

    if has_any(source, ("мебел", "слив воды", "высота", "лесов", "чистый монтаж", "пылесос", "усиление стен", "сложность доступа", "доп работа", "доб работа", "ремонт полотна", "переделка углов", "доп. крепеж")):
        return ("Дополнительные работы", "Организационные и нестандартные работы")

    if has_any(source, ("трек", "шинопровод", "luminotti", "technolight", "arte lamp")):
        if has_any(name, ("натяж", "заправ")):
            return ("Натяжка полотна", "Трековые системы")
        if has_any(source, ("заглуш", "рассеивател", "экран")):
            return ("Трековые системы", "Комплектующие треков")
        return ("Трековые системы", "Монтаж трековых систем")

    if has_any(source, ("карниз", "гардин", "ниша", "ниш", "штор", "пк-5", "пк-14", "shtorka", "ам01", "am01", "бленд")):
        if has_any(source, ("заклад", "брус")):
            return ("Карнизы и ниши", "Закладные под карнизы")
        if has_any(name, ("натяж", "заправ")):
            return ("Натяжка полотна", "Карнизы и ниши")
        if has_any(source, ("заглуш", "рассеивател", "вставк", "доборн", "закругл", "угол", "запил")):
            return ("Карнизы и ниши", "Фурнитура и доборные элементы")
        if has_any(source, ("открыт", "закрыт", "ниша", "ниш")):
            return ("Карнизы и ниши", "Открытые и закрытые ниши")
        return ("Карнизы и ниши", "Карнизы и гардины")

    if ("светов" in source and "лини" in source) or has_any(source, ("led line", "световая линия", "световые линии")):
        if has_any(name, ("натяж", "заправ", "гарпун")):
            return ("Натяжка полотна", "Световые линии")
        if "профил" in source:
            return ("Световые линии", "Профиль световых линий")
        if has_any(source, ("экран", "рассеив", "угол", "запил")):
            return ("Световые линии", "Комплектующие и обработка")
        return ("Световые линии", "Монтаж световых линий")

    if has_any(source, ("светодиод", "лента", "блок питания", "диммер", "шим")):
        return ("LED-оборудование", "Лента, блоки и управление")

    if has_any(source, ("вставк", "заглуш")):
        return ("Вставки и декоративные элементы", "Монтаж вставок и заглушек")

    if has_any(name, ("разделител", "отбойник", "двухуров", "вн10", "переход")):
        if has_any(name, ("натяж", "втяж", "заправ")):
            return ("Натяжка полотна", "Двухуровневые переходы")
        return ("Двухуровневые переходы", "Профили и разделители")

    if has_any(name, ("натяж", "заправ", "гарпун")):
        if has_any(source, ("светильник", "светильн", "свет-ка", "bh10", "bh53")):
            return ("Натяжка полотна", "Светильники и люстры")
        if has_any(source, ("тенев", "euro kraab", "clamp", "umbra")):
            return ("Натяжка полотна", "Теневой профиль")
        if has_any(source, ("бесщел", "kraab 4", "шток")):
            return ("Натяжка полотна", "Бесщелевой профиль")
        if "парящ" in source:
            return ("Натяжка полотна", "Парящий профиль")
        if has_any(source, ("slott", "слот", "euroslott")):
            return ("Натяжка полотна", "SLOTT-профили")
        if has_any(source, ("стенов", "алюминиев", "пвх")):
            return ("Натяжка полотна", "Классическая натяжка")
        if "люстр" in source:
            return ("Натяжка полотна", "Светильники и люстры")
        return ("Натяжка полотна", "Общая натяжка")

    if has_any(source, ("светильник", "светильн", "свет-ка", "люстр", "bh10", "bh53")):
        if has_any(source, ("заклад", "платформ", "кольц")):
            return ("Освещение", "Закладные и кольца под свет")
        if has_any(source, ("подключ", "провод", "пульт")):
            return ("Электрика", "Подключение и проводка")
        if has_any(name, ("натяж", "заправ")):
            return ("Натяжка полотна", "Светильники и люстры")
        return ("Освещение", "Монтаж светильников и люстр")

    if has_any(name, ("разделител", "отбойник", "двухуров", "вн10", "переход")):
        if has_any(name, ("натяж", "втяж", "заправ")):
            return ("Натяжка полотна", "Двухуровневые переходы")
        return ("Двухуровневые переходы", "Профили и разделители")

    if has_any(source, ("обвод", "труб")):
        return ("Закладные и обводы", "Обводы труб")

    if has_any(source, ("заклад", "брус")):
        return ("Закладные и обводы", "Закладные и брус")

    if has_any(source, ("вырез", "криволин")):
        return ("Натяжка полотна", "Вырезы и криволинейные участки")

    if "профил" in source:
        if has_any(source, ("тенев", "euro kraab", "clamp", "umbra")):
            return ("Монтаж профилей", "Теневой профиль")
        if has_any(source, ("бесщел", "kraab 4", "шток")):
            return ("Монтаж профилей", "Бесщелевой профиль")
        if "парящ" in source:
            return ("Монтаж профилей", "Парящий профиль")
        if has_any(source, ("ткан", "descor", "euroslott")):
            return ("Монтаж профилей", "Тканевый профиль")
        if "контур" in source:
            return ("Монтаж профилей", "Контурный профиль")
        if has_any(source, ("slott", "slot", "слот")):
            return ("Монтаж профилей", "SLOTT-профиль")
        if "йошка" in source:
            return ("Монтаж профилей", "Йошка и специальные профили")
        if has_any(source, ("угол", "стыков", "состыков")):
            return ("Монтаж профилей", "Углы и стыковка профиля")
        return ("Монтаж профилей", "Стеновой и потолочный профиль")

    if has_any(source, ("угол", "стыков", "состыков")):
        return ("Монтаж профилей", "Углы и стыковка профиля")

    return ("Дополнительные работы", "Нестандартные монтажные услуги")


def classify_product_like(item: dict[str, Any]) -> tuple[str, str]:
    source = lower_text(item.get("name"), item.get("category"), item.get("subcategory"))

    if has_any(source, ("полотно", "гарпун")):
        return ("Комплектующие полотна", "Полотно, гарпун и расходники")

    if has_any(source, ("саморез", "дюбел", "крепеж", "крепёж", "скотч", "клей", "герметик")):
        return ("Расходные материалы", "Крепеж и расходники")

    if has_any(source, ("инструмент", "шпател", "нож", "ножницы", "ролик", "паяльник", "кондуктор")):
        return ("Инструмент", "Монтажный инструмент")

    if has_any(source, ("трек", "шинопровод", "luminotti", "technolight", "arte lamp")):
        return ("Трековые системы", "Профили и комплектующие треков")

    if has_any(source, ("карниз", "гардин", "ниша", "ниш", "штор", "пк-5", "пк-14", "shtorka", "ам01", "am01")):
        return ("Карнизы и гардины", "Карнизы, ниши и фурнитура")

    if has_any(source, ("светодиод", "led", "лента", "блок питания", "диммер", "контроллер")):
        return ("LED-оборудование", "Лента, питание и управление")

    if has_any(source, ("светильник", "светильн", "люстр", "лампа", "bh10", "bh53")):
        return ("Освещение", "Светильники и комплектующие")

    if has_any(source, ("вент", "вытяж", "диффуз", "решет", "решёт")):
        return ("Вентиляция", "Решетки, вытяжки и диффузоры")

    if has_any(source, ("заклад", "платформ", "кольц", "брус", "обвод", "труб")):
        return ("Закладные и монтажные элементы", "Закладные, платформы и обводы")

    if has_any(source, ("вставк", "заглуш", "маскиров")):
        return ("Вставки и декоративные элементы", "Вставки и заглушки")

    if has_any(source, ("профил", "багет", "kraab", "slott", "euroslott", "lumfer", "парящ", "тенев", "бесщел", "штапик", "йошка")):
        if has_any(source, ("тенев", "euro kraab", "clamp", "umbra")):
            return ("Профили", "Теневые профили")
        if has_any(source, ("бесщел", "kraab 4", "шток")):
            return ("Профили", "Бесщелевые профили")
        if "парящ" in source:
            return ("Профили", "Парящие профили")
        if has_any(source, ("slott", "slot", "euroslott")):
            return ("Профили", "SLOTT и специальные профили")
        return ("Профили", "Стеновые и потолочные профили")

    return ("Расходные материалы", "Монтажные комплектующие")


def category_for_item(
    item: dict[str, Any],
    entity: str,
    mapping: dict[tuple[str, str], tuple[str, str]],
) -> tuple[str, str]:
    if entity == "tovar":
        mapped = mapping.get((entity, text(item.get("name"))))
        if mapped:
            return mapped
        return classify_product_like(item)

    classified = classify_work_or_node(item, entity)
    if classified:
        return classified

    mapped = mapping.get((entity, text(item.get("name"))))
    if mapped:
        return mapped

    return (text(item.get("category"), "Без категории"), text(item.get("subcategory"), "Без подкатегории"))


def with_classification(
    item: dict[str, Any],
    entity: str,
    mapping: dict[tuple[str, str], tuple[str, str]],
) -> dict[str, Any]:
    category, subcategory = category_for_item(item, entity, mapping)

    next_item = dict(item)
    next_item["category"] = category
    next_item["subcategory"] = subcategory
    return next_item


def stats_for_node(node: dict[str, Any]) -> dict[str, Any]:
    components = node.get("components") if isinstance(node.get("components"), list) else []
    products = sum(1 for part in components if component_entity(part.get("kind")) == "tovar")
    services = len(components) - products

    return {
        "positions": len(components),
        "products": products,
        "services": services,
        "source": "html_2.nodes",
    }


def catalog_record(item: dict[str, Any], entity: str) -> dict[str, Any]:
    record = {
        "id": text(item.get("id")),
        "name": text(item.get("name")),
        "category": text(item.get("category"), "Без категории"),
        "subcategory": text(item.get("subcategory"), "Без подкатегории"),
        "price": number(item.get("price")),
        "unit": text(item.get("unit")),
        "image": text(item.get("image")) or None,
        "description": text(item.get("description")) or None,
    }

    if entity in SOURCE_BY_ENTITY:
        record["source"] = SOURCE_BY_ENTITY[entity]

    if entity == "uzel":
        record["stats"] = stats_for_node(item)

    record["raw"] = item
    return record


def normalize_component(
    node: dict[str, Any],
    component: dict[str, Any],
    position_index: int,
    mapping: dict[tuple[str, str], tuple[str, str]],
) -> dict[str, Any]:
    item_type = component_entity(component.get("kind"))
    component_with_category = with_classification(component, item_type, mapping)
    qty = number(component_with_category.get("qty"))
    price = number(component_with_category.get("price"))
    total = number(component_with_category.get("total")) or qty * price

    return {
        "id": f"{text(node.get('id'))}:{position_index}",
        "uzel_id": text(node.get("id")),
        "position_index": position_index,
        "item_type": item_type,
        "item_id": text(component_with_category.get("id")),
        "item_name": text(component_with_category.get("name")),
        "qty": qty,
        "unit": text(component_with_category.get("unit")),
        "price": price,
        "total": total,
        "category": text(component_with_category.get("category"), "Без категории"),
        "subcategory": text(component_with_category.get("subcategory"), "Без подкатегории"),
        "image": text(component_with_category.get("image")) or None,
        "comment": text(component_with_category.get("comment")) or None,
        "raw": component_with_category,
    }


def category_id(entity: str, category: str, subcategory: str) -> str:
    payload = f"{category}|{subcategory}".encode("utf-8")
    encoded = base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")
    return f"{entity}:{encoded[:80]}"


def build_categories(data: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []

    for entity, key in [("tovar", "tovary"), ("usluga", "uslugi"), ("uzel", "uzly")]:
        grouped: Counter[tuple[str, str]] = Counter()
        for item in data[key]:
            grouped[(text(item.get("category"), "Без категории"), text(item.get("subcategory"), "Без подкатегории"))] += 1

        for (category, subcategory), count in sorted(grouped.items()):
            rows.append(
                {
                    "id": category_id(entity, category, subcategory),
                    "entity_type": entity,
                    "category": category,
                    "subcategory": subcategory,
                    "items_count": count,
                }
            )

    return rows


def sql(value: Any) -> str:
    if value is None:
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def values_update(table: str, rows: list[dict[str, Any]], include_updated_at: bool = True) -> str:
    if not rows:
        return ""

    values = ",\n    ".join(
        f"({sql(row['id'])}, {sql(row['category'])}, {sql(row['subcategory'])})"
        for row in rows
    )
    updated_at = ",\n    updated_at = timezone('utc'::text, now())" if include_updated_at else ""

    return f"""WITH data(id, category, subcategory) AS (
  VALUES
    {values}
)
UPDATE public.{table} AS target
SET
  category = data.category,
  subcategory = data.subcategory{updated_at}
FROM data
WHERE target.id = data.id;
"""


def build_migration(data: dict[str, list[dict[str, Any]]]) -> str:
    parts = [
        "-- SmartCeiling: logical catalog categories generated from html (данные).\n",
        "-- Products come only from tolko tovari.html; nodes and services come from uzli_tovari_uslugi.html.\n",
        "BEGIN;\n",
        "DELETE FROM public.tovary WHERE source IN ('html_2.products', 'node_component.product');\n",
        "DELETE FROM public.uslugi WHERE source IN ('node_component.service');\n",
    ]

    parts.append(values_update("tovary", data["tovary"]))
    parts.append(values_update("uslugi", data["uslugi"]))
    parts.append(values_update("uzly", data["uzly"]))
    parts.append(values_update("komplektaciya_uzlov", data["komplektaciya_uzlov"], include_updated_at=False))

    parts.append(
        """
DELETE FROM public.kategorii WHERE entity_type IN ('tovar', 'usluga', 'uzel');

WITH grouped AS (
  SELECT 'tovar'::text AS entity_type, category, subcategory, count(*)::integer AS items_count
  FROM public.tovary
  GROUP BY category, subcategory
  UNION ALL
  SELECT 'usluga'::text AS entity_type, category, subcategory, count(*)::integer AS items_count
  FROM public.uslugi
  GROUP BY category, subcategory
  UNION ALL
  SELECT 'uzel'::text AS entity_type, category, subcategory, count(*)::integer AS items_count
  FROM public.uzly
  GROUP BY category, subcategory
)
INSERT INTO public.kategorii (id, entity_type, category, subcategory, items_count, updated_at)
SELECT
  entity_type || ':' || substring(
    replace(
      replace(
        rtrim(encode(convert_to(category || '|' || subcategory, 'UTF8'), 'base64'), '='),
        '+',
        '-'
      ),
      '/',
      '_'
    )
    for 80
  ) AS id,
  entity_type,
  category,
  subcategory,
  items_count,
  timezone('utc'::text, now())
FROM grouped
ON CONFLICT (id) DO UPDATE
SET
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  items_count = EXCLUDED.items_count,
  updated_at = EXCLUDED.updated_at;

COMMIT;
"""
    )

    return "\n".join(part for part in parts if part)


def markdown_line(item: dict[str, Any], entity: str) -> str:
    return (
        f"- {text(item.get('category'), 'Без категории')} -> "
        f"{text(item.get('subcategory'), 'Без подкатегории')} -> "
        f"{text(item.get('name'))} ({ENTITY_TO_LABEL[entity]})"
    )


def write_classification(
    path: Path,
    products: list[dict[str, Any]],
    nodes: list[dict[str, Any]],
    services: list[dict[str, Any]],
) -> None:
    lines = [
        *(markdown_line(item, "tovar") for item in products),
        *(markdown_line(item, "uzel") for item in nodes),
        *(markdown_line(item, "usluga") for item in services),
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    html = html_dir()
    classification_path = html / CLASSIFICATION_FILE
    classification = parse_classification(classification_path)
    products_html = extract_catalog_data(html / HTML_PRODUCTS_FILE)
    nodes_services_html = extract_catalog_data(html / HTML_NODES_SERVICES_FILE)

    products = [
        catalog_record(with_classification(item, "tovar", classification), "tovar")
        for item in products_html["products"]
    ]
    services = [
        catalog_record(with_classification(item, "usluga", classification), "usluga")
        for item in nodes_services_html["services"]
    ]

    nodes: list[dict[str, Any]] = []
    components: list[dict[str, Any]] = []
    for node in nodes_services_html["nodes"]:
        node_with_category = with_classification(node, "uzel", classification)
        next_components = []
        for index, component in enumerate(node.get("components") or [], start=1):
            normalized = normalize_component(node_with_category, component, index, classification)
            components.append(normalized)
            next_components.append(normalized["raw"])

        raw_node = dict(node_with_category)
        raw_node["components"] = next_components
        nodes.append(catalog_record(raw_node, "uzel"))

    normalized = {
        "tovary": products,
        "uslugi": services,
        "uzly": nodes,
        "komplektaciya_uzlov": components,
        "kategorii": build_categories(
            {
                "tovary": products,
                "uslugi": services,
                "uzly": nodes,
                "komplektaciya_uzlov": components,
            }
        ),
    }

    write_classification(classification_path, products, nodes, services)
    CATALOG_JSON.write_text(json.dumps(normalized, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    MIGRATION_SQL.write_text(build_migration(normalized), encoding="utf-8")

    counts = {key: len(value) for key, value in normalized.items()}
    print(json.dumps(counts, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
