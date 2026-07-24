/**
 * Builds small Wayanad-only GeoJSON assets from Open Data Kerala sources.
 * Inputs (place under public/ before running):
 *   - kerala_districts_temp.json — TopoJSON from kl_district, e.g.
 *     https://raw.githubusercontent.com/opendatakerala/kl_district/main/Kerala_districts.json
 *   - kerala_lsg_temp.geojson — from lsg-kerala-data, e.g.
 *     https://raw.githubusercontent.com/opendatakerala/lsg-kerala-data/main/data/kerala_lsg_data.geojson
 * Output: public/geo/wayanad-*.geojson and src/lib/wayanadLsgCatalog.json
 */
import * as topojson from "topojson-client";
import centroid from "@turf/centroid";
import union from "@turf/union";
import { featureCollection } from "@turf/helpers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Police-style sub divisions (Mananthavady / Kalpetta / Sulthan Bathery) as a
 * dissolve of Open Data Kerala LSG units. Kept for optional reference layers.
 */
const GP_SUBDIVISION = {
  Thondernad: "mananthavady",
  Thavinhal: "mananthavady",
  Thirunelly: "mananthavady",
  Edavaka: "mananthavady",
  Vellamunda: "mananthavady",
  Panamaram: "mananthavady",
  Padinharathara: "kalpetta",
  Thariode: "kalpetta",
  Pozhuthana: "kalpetta",
  Kottathara: "kalpetta",
  Vengappally: "kalpetta",
  Kaniyambetta: "kalpetta",
  /** Kenichira (Kenichira PS) lies in Poothadi GP — Sulthan Bathery sub division. */
  Poothadi: "bathery",
  Pulpally: "bathery",
  Mullankolly: "bathery",
  Meenangadi: "bathery",
  Ambalavayal: "bathery",
  Nenmeni: "bathery",
  Noolpuzha: "bathery",
  Vythiri: "kalpetta",
  Meppadi: "kalpetta",
  Muttil: "kalpetta",
  Mupainad: "kalpetta",
};

const SUBDIVISION_META = {
  mananthavady: { label: "Mananthavady" },
  kalpetta: { label: "Kalpetta" },
  bathery: { label: "Sulthan Bathery" },
};

function subdivisionKeyForFeature(f) {
  const { name, local_auth } = f.properties ?? {};
  if (local_auth === "municipality") {
    if (name === "Mananthavady") return "mananthavady";
    if (name === "Sulthan Bathery") return "bathery";
    if (name === "Kalpetta") return "kalpetta";
  }
  return GP_SUBDIVISION[name];
}

function dissolveSubdivisions(wayanadFeatures) {
  const buckets = { mananthavady: [], kalpetta: [], bathery: [] };
  for (const f of wayanadFeatures) {
    const key = subdivisionKeyForFeature(f);
    if (!key || !buckets[key]) {
      throw new Error(
        `Unmapped Wayanad LSG feature for subdivisions: ${JSON.stringify(f.properties?.name)}`,
      );
    }
    buckets[key].push(f);
  }
  const out = [];
  const labelPoints = [];
  for (const key of ["mananthavady", "kalpetta", "bathery"]) {
    const feats = buckets[key];
    let merged;
    if (feats.length === 1) {
      merged = {
        type: "Feature",
        geometry: feats[0].geometry,
        properties: {},
      };
    } else {
      merged = union(featureCollection(feats));
    }
    if (!merged?.geometry) continue;
    merged.properties = {
      subdivision_key: key,
      subdivision_label: SUBDIVISION_META[key].label,
      source: "LSG dissolve (approx. police sub division grouping)",
    };
    out.push(merged);
    const c = centroid(merged);
    c.properties = {
      subdivision_key: key,
      subdivision_label: SUBDIVISION_META[key].label,
    };
    labelPoints.push(c);
  }
  return { polygons: out, labelPoints };
}

function slugifyName(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildLsgZones(wayanadFeatures) {
  const features = wayanadFeatures
    .filter(
      (f) =>
        f.properties?.local_auth === "gram_panchayat" ||
        f.properties?.local_auth === "municipality",
    )
    .map((f) => {
      const name = f.properties.name;
      return {
        type: "Feature",
        properties: {
          lsgi_code: f.properties.LSGI_Code,
          lsg_key: slugifyName(name),
          lsg_label: name,
          local_auth: f.properties.local_auth,
          district: "Wayanad",
          source: "Open Data Kerala LSG (ODbL)",
        },
        geometry: f.geometry,
      };
    })
    .sort((a, b) =>
      a.properties.lsg_label.localeCompare(b.properties.lsg_label),
    );

  const labelPoints = features.map((f) => {
    const c = centroid(f);
    c.properties = {
      lsgi_code: f.properties.lsgi_code,
      lsg_key: f.properties.lsg_key,
      lsg_label: f.properties.lsg_label,
      local_auth: f.properties.local_auth,
    };
    return c;
  });

  const catalog = features.map((f) => ({
    key: f.properties.lsg_key,
    name: f.properties.lsg_label,
    lsgiCode: f.properties.lsgi_code,
    localAuth: f.properties.local_auth,
  }));

  return { features, labelPoints, catalog };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pub = path.join(root, "public");
const geoDir = path.join(pub, "geo");
const topoPath = path.join(pub, "kerala_districts_temp.json");
const lsgPath = path.join(pub, "kerala_lsg_temp.geojson");

function main() {
  if (!fs.existsSync(topoPath)) {
    console.error("Missing:", topoPath);
    process.exit(1);
  }
  if (!fs.existsSync(lsgPath)) {
    console.error("Missing:", lsgPath);
    process.exit(1);
  }

  fs.mkdirSync(geoDir, { recursive: true });

  const topology = JSON.parse(fs.readFileSync(topoPath, "utf8"));
  const fc1 = topojson.feature(topology, topology.objects.Kerala_districts1);
  const wayanadDistrict = fc1.features.find(
    (f) => f.properties?.name === "Wayanad",
  );
  if (!wayanadDistrict) {
    console.error("Wayanad district feature not found in TopoJSON.");
    process.exit(1);
  }

  fs.writeFileSync(
    path.join(geoDir, "wayanad-district.geojson"),
    JSON.stringify({
      type: "FeatureCollection",
      features: [wayanadDistrict],
    }),
  );

  const lsg = JSON.parse(fs.readFileSync(lsgPath, "utf8"));
  const inWayanad = (f) => f.properties?.District === "Wayanad";
  const municipalities = lsg.features.filter(
    (f) => inWayanad(f) && f.properties.local_auth === "municipality",
  );
  const corporations = lsg.features.filter(
    (f) => inWayanad(f) && f.properties.local_auth === "municipal_corporation",
  );

  fs.writeFileSync(
    path.join(geoDir, "wayanad-municipalities.geojson"),
    JSON.stringify({ type: "FeatureCollection", features: municipalities }),
  );
  fs.writeFileSync(
    path.join(geoDir, "wayanad-corporations.geojson"),
    JSON.stringify({ type: "FeatureCollection", features: corporations }),
  );

  const wayanadAll = lsg.features.filter(inWayanad);
  const { polygons: subdivisionFeatures, labelPoints: subdivisionLabels } =
    dissolveSubdivisions(wayanadAll);
  fs.writeFileSync(
    path.join(geoDir, "wayanad-police-subdivisions.geojson"),
    JSON.stringify({
      type: "FeatureCollection",
      features: subdivisionFeatures,
    }),
  );
  fs.writeFileSync(
    path.join(geoDir, "wayanad-police-subdivision-labels.geojson"),
    JSON.stringify({
      type: "FeatureCollection",
      features: subdivisionLabels,
    }),
  );

  const {
    features: lsgFeatures,
    labelPoints: lsgLabels,
    catalog,
  } = buildLsgZones(wayanadAll);
  fs.writeFileSync(
    path.join(geoDir, "wayanad-lsg.geojson"),
    JSON.stringify({ type: "FeatureCollection", features: lsgFeatures }),
  );
  fs.writeFileSync(
    path.join(geoDir, "wayanad-lsg-labels.geojson"),
    JSON.stringify({ type: "FeatureCollection", features: lsgLabels }),
  );
  fs.writeFileSync(
    path.join(root, "src", "lib", "wayanadLsgCatalog.json"),
    JSON.stringify(catalog, null, 2),
  );

  console.log(
    "Wrote public/geo: district (1), municipalities (" +
      municipalities.length +
      "), corporations (" +
      corporations.length +
      "), police subdivisions (" +
      subdivisionFeatures.length +
      "), LSG local bodies (" +
      lsgFeatures.length +
      ") + catalog.",
  );
}

main();
