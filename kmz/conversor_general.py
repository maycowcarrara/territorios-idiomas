import argparse
import json
import re
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from shapely import concave_hull
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union


NS = {"kml": "http://www.opengis.net/kml/2.2"}
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = PROJECT_ROOT / "public" / "mapa.general.json"
DEFAULT_BUFFER_DEGREES = 0.0006
DEFAULT_MAX_BUFFER_DEGREES = 0.006
CLIP_MARGIN_DEGREES = 0.000005

# Ajustes manuais conhecidos do mapa de General Carneiro.
# O primeiro territorio de cada par e recortado pelo segundo para preservar
# a divisa visual revisada no app. O territorio usado como limite permanece intacto.
TERRITORY_CLIP_RULES = ((26, 25), (18, 19), (1, 3), (1, 4))

# Posicoes de rotulo usadas quando o centroide geometrico cai fora do local
# visualmente adequado para territorios muito compridos.
LABEL_POSITION_OVERRIDES = {
    7: {"lat": -26.4158, "lng": -51.31855},
}


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Converte KMZs do General Carneiro para o GeoJSON usado pelo app. "
            "Cada KMZ vira um territorio; cada poligono dentro dele vira uma quadra."
        )
    )
    parser.add_argument(
        "inputs",
        nargs="+",
        help="Arquivos .kmz ou pastas com .kmz.",
    )
    parser.add_argument(
        "-o",
        "--output",
        default=str(DEFAULT_OUTPUT),
        help="Arquivo JSON de saida. Padrao: public/mapa.general.json",
    )
    parser.add_argument(
        "--buffer",
        type=float,
        default=DEFAULT_BUFFER_DEGREES,
        help="Distancia em graus para fechar ruas/gaps entre quadras. Padrao: 0.0006.",
    )
    parser.add_argument(
        "--max-buffer",
        type=float,
        default=DEFAULT_MAX_BUFFER_DEGREES,
        help="Buffer maximo para unir blocos isolados do mesmo KMZ. Padrao: 0.006.",
    )
    return parser.parse_args()


def expand_inputs(inputs):
    kmz_paths = []

    for input_path in inputs:
        path = Path(input_path)
        if path.is_dir():
            kmz_paths.extend(sorted(path.glob("*.kmz")))
        elif path.suffix.lower() == ".kmz":
            kmz_paths.append(path)

    return sorted(kmz_paths, key=lambda item: natural_key(item.stem))


def natural_key(value):
    parts = re.split(r"(\d+)", str(value).lower())
    return [int(part) if part.isdigit() else part for part in parts]


def read_kml_root(kmz_path):
    with zipfile.ZipFile(kmz_path, "r") as archive:
        kml_names = [name for name in archive.namelist() if name.lower().endswith(".kml")]
        if not kml_names:
            raise ValueError(f"{kmz_path} nao contem arquivo .kml")

        with archive.open(kml_names[0]) as kml_file:
            return ET.fromstring(kml_file.read())


def parse_coordinate_list(coordinates_text):
    coords = []

    for token in (coordinates_text or "").split():
        parts = token.split(",")
        if len(parts) < 2:
            continue

        coords.append([round(float(parts[0]), 7), round(float(parts[1]), 7)])

    if len(coords) > 1 and coords[0] == coords[-1]:
        coords.pop()

    return coords


def extract_polygons(root):
    polygons = []

    for placemark in root.findall(".//kml:Placemark", NS):
        name = (placemark.findtext("kml:name", default="", namespaces=NS) or "").strip()

        for polygon in placemark.findall(".//kml:Polygon", NS):
            coordinates_text = polygon.findtext(
                ".//kml:outerBoundaryIs/kml:LinearRing/kml:coordinates",
                default="",
                namespaces=NS,
            )
            coords = parse_coordinate_list(coordinates_text)

            if len(coords) >= 3:
                polygons.append({"name": name, "coords": coords})

    return polygons


def quadra_label(name, fallback):
    match = re.search(r"(?:quadra|q)\s*0*([0-9]+[a-zA-Z]?)\b", name, flags=re.IGNORECASE)
    if not match:
        match = re.search(r"\b0*([0-9]+[a-zA-Z]?)\b", name)

    return match.group(1) if match else str(fallback)


def territory_id_from_name(name, fallback):
    match = re.search(r"\b0*([0-9]+)\b", name)
    return int(match.group(1)) if match else fallback


def normalize_territory_name(name):
    normalized = re.sub(r"\s+", " ", str(name or "")).strip()
    match = re.match(r"^([A-Za-z]+\d+[A-Za-z]?)\s*-\s*(.+)$", normalized)
    if not match:
        match = re.match(r"^([A-Za-z]+\d+[A-Za-z]?)\s+(.+)$", normalized)

    if not match:
        return normalized

    code, description = match.groups()
    return f"{code.strip()} - {description.strip()}"


def point_sort_key(point):
    value = str(point["nome"])
    match = re.fullmatch(r"(\d+)([a-zA-Z]?)", value)
    if match:
        return (0, int(match.group(1)), match.group(2).lower())

    return (1, value.lower())


def normalize_polygon(coords):
    polygon = Polygon(coords)

    if not polygon.is_valid:
        polygon = polygon.buffer(0)

    if polygon.is_empty:
        return None

    return polygon


def buffer_candidates(buffer_degrees, max_buffer_degrees):
    current = buffer_degrees

    while current <= max_buffer_degrees + 1e-12:
        yield round(current, 10)
        current += buffer_degrees


def all_points_covered(geometry, points):
    return all(geometry.covers(Point(point)) for point in points)


def build_territory_polygon(shapely_polys, validation_points, buffer_degrees, max_buffer_degrees):
    merged = unary_union(shapely_polys)

    for candidate_buffer in buffer_candidates(buffer_degrees, max_buffer_degrees):
        bridged = merged.buffer(candidate_buffer, join_style=2).buffer(-candidate_buffer, join_style=2)
        territory_poly = unary_union([merged, bridged])

        if not territory_poly.is_valid:
            territory_poly = territory_poly.buffer(0)

        if territory_poly.geom_type == "Polygon" and all_points_covered(territory_poly, validation_points):
            return territory_poly

    territory_poly = unary_union(
        [merged, merged.buffer(max_buffer_degrees, join_style=2).buffer(-max_buffer_degrees, join_style=2)]
    )

    if not territory_poly.is_valid:
        territory_poly = territory_poly.buffer(0)

    if territory_poly.geom_type == "MultiPolygon":
        for ratio in (0.2, 0.35, 0.5, 0.75, 1.0):
            candidate = concave_hull(territory_poly, ratio=ratio, allow_holes=False)
            if candidate.geom_type == "Polygon" and all_points_covered(candidate, validation_points):
                return candidate

        territory_poly = territory_poly.convex_hull

    return territory_poly


def build_feature(kmz_path, fallback_id, buffer_degrees, max_buffer_degrees):
    root = read_kml_root(kmz_path)
    polygons_data = extract_polygons(root)

    if not polygons_data:
        raise ValueError(f"{kmz_path} nao contem poligonos de quadras")

    territory_name = normalize_territory_name(kmz_path.stem.strip())
    pontos = []
    shapely_polys = []
    validation_points = []

    for index, polygon_data in enumerate(polygons_data, start=1):
        shapely_poly = normalize_polygon(polygon_data["coords"])
        if shapely_poly is None:
            continue

        shapely_polys.append(shapely_poly)
        label_point = shapely_poly.representative_point()
        validation_points.append((label_point.x, label_point.y))

        pontos.append(
            {
                "nome": quadra_label(polygon_data["name"], index),
                "lat": round(label_point.y, 7),
                "lng": round(label_point.x, 7),
                "tipo": "quadra",
            }
        )

    if not shapely_polys:
        raise ValueError(f"{kmz_path} nao contem poligonos validos")

    pontos.sort(key=point_sort_key)
    territory_poly = build_territory_polygon(
        shapely_polys,
        validation_points,
        buffer_degrees,
        max_buffer_degrees,
    )
    exterior_coords = [[round(x, 7), round(y, 7)] for x, y in territory_poly.exterior.coords]

    return {
        "type": "Feature",
        "properties": {
            "id": territory_id_from_name(territory_name, fallback_id),
            "nome": territory_name,
            "pontos": pontos,
        },
        "geometry": {
            "type": "Polygon",
            "coordinates": [exterior_coords],
        },
    }


def feature_polygon(feature):
    return Polygon(feature["geometry"]["coordinates"][0])


def feature_points(feature):
    return [
        Point(point["lng"], point["lat"])
        for point in feature["properties"].get("pontos", [])
    ]


def polygon_to_coordinates(polygon):
    return [[round(x, 7), round(y, 7)] for x, y in polygon.exterior.coords]


def best_polygon_part(geometry, points):
    if geometry.geom_type == "Polygon":
        return geometry

    if geometry.geom_type != "MultiPolygon":
        return geometry.convex_hull

    return max(
        geometry.geoms,
        key=lambda polygon: (
            sum(1 for point in points if polygon.covers(point)),
            polygon.area,
        ),
    )


def apply_clip_rules(features):
    features_by_id = {feature["properties"]["id"]: feature for feature in features}

    for target_id, blocker_id in TERRITORY_CLIP_RULES:
        target = features_by_id.get(target_id)
        blocker = features_by_id.get(blocker_id)

        if not target or not blocker:
            continue

        target_polygon = feature_polygon(target)
        blocker_polygon = feature_polygon(blocker)

        if not target_polygon.intersects(blocker_polygon):
            continue

        clipped = target_polygon.difference(blocker_polygon.buffer(CLIP_MARGIN_DEGREES, join_style=2))
        if clipped.is_empty:
            continue

        clipped = best_polygon_part(clipped, feature_points(target))
        if not clipped.is_valid:
            clipped = clipped.buffer(0)

        target["geometry"]["coordinates"] = [polygon_to_coordinates(clipped)]


def apply_label_position_overrides(features):
    for feature in features:
        label_position = LABEL_POSITION_OVERRIDES.get(feature["properties"]["id"])
        if label_position:
            feature["properties"]["labelPosition"] = label_position


def main():
    args = parse_args()
    kmz_paths = expand_inputs(args.inputs)

    if not kmz_paths:
        raise SystemExit("Nenhum arquivo .kmz encontrado.")

    features = []
    used_ids = set()

    for index, kmz_path in enumerate(kmz_paths, start=1):
        feature = build_feature(kmz_path, index, args.buffer, args.max_buffer)
        feature_id = feature["properties"]["id"]

        if feature_id in used_ids:
            feature["properties"]["id"] = index

        used_ids.add(feature["properties"]["id"])
        features.append(feature)

        print(
            f"{kmz_path.name}: territorio {feature['properties']['id']} "
            f"com {len(feature['properties']['pontos'])} quadras"
        )

    apply_clip_rules(features)
    apply_label_position_overrides(features)

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8") as output_file:
        json.dump(
            {"type": "FeatureCollection", "features": features},
            output_file,
            indent=2,
            ensure_ascii=False,
        )
        output_file.write("\n")

    print(f"JSON gerado em {output_path}")


if __name__ == "__main__":
    main()
