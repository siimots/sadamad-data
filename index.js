const fs = require("fs");
const fetch = require("node-fetch");
const reproject = require("reproject");

const DEBUG = false;

const EPSG = {
  "EPSG:3301":
    "+proj=lcc +lat_1=59.33333333333334 +lat_2=58 +lat_0=57.51755393055556 +lon_0=24 +x_0=500000 +y_0=6375000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs",
  "EPSG:3857":
    "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs",
};

const options = {
  headers: {
    accept: "application/json, text/plain, */*",
    "accept-language": "en-GB,en;q=0.9",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "user-agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
  },
  referrer: "https://www.sadamaregister.ee/",
  referrerPolicy: "strict-origin-when-cross-origin",
  body: null,
  method: "GET",
  mode: "cors",
};

const formatNumbers = (val) => {
  if (isNaN(val)) return "-";

  return Number(val).toFixed(1);
};

const fetchPorts = async () => {
  const url = "https://sadamaregister.ee/api/ports/public-active";
  const geojson = {
    type: "FeatureCollection",
    features: [],
  };

  const response = await fetch(url, options);
  const json = await response.json();

  let ports = json.map(({ publicId, name }) => [
    publicId,
    name.replace(/\s+/g, " ").trim(),
  ]);
  if (DEBUG) ports = ports.slice(0, 5);

  console.log("Total ports:", ports.length);

  ports.forEach((port, i) => {
    setTimeout(async () => {
      const feature = await fetchPort(port, options);
      if (feature) geojson.features.push(feature);

      if (i == ports.length - 1) {
        geojson.features.sort(function (a, b) {
          return (
            parseFloat(a.properties.sadamaregister) -
            parseFloat(b.properties.sadamaregister)
          );
        });

        fs.writeFile(
          "public/raw.json",
          JSON.stringify(geojson, null, 2),
          (err) => {
            if (err) throw err;
          },
        );

        fs.writeFile("public/data.json", JSON.stringify(geojson), (err) => {
          if (err) throw err;
        });

        fs.writeFile(
          "public/data.js",
          `var sadamadgeoJson = ${JSON.stringify(geojson)};`,
          (err) => {
            if (err) throw err;
          },
        );
      }
    }, i * 200); // 0.2s delay for scraping
  });
};

const fetchPort = async (port) => {
  const [id, name] = port;

  const url = `https://sadamaregister.ee/api/ports/${id}/public-details`;

  const response = await fetch(url, options);
  const json = await response.json();

  const {
    portManagerContacts,
    portMainData,
    portTechnicalData,
    harbourMasterData,
  } = json;

  if (!portMainData) {
    throw `Missing json ${id} ${name}`;
  }

  let { muutmineKp } = portMainData;

  let {
    sadamaPidajaEesnimi,
    sadamaPidajaArinimiPerenimi,
    sadamaPidajaTelefon,
    sadamaPidajaEpost,
    sadamaPidajaKoduleht,
  } = portManagerContacts;

  let { veesoidukiMaxPikkus, veesoidukiMaxLaius, veesoidukiMaxSyvis } =
    portTechnicalData;

  let {
    sadamaKaptenEesnimi,
    sadamaKaptenPerenimi,
    sadamaKaptenTelefon,
    sadamaKaptenEpost,
  } = harbourMasterData;

  let omanik = "-";
  if (sadamaPidajaEesnimi && sadamaPidajaArinimiPerenimi) {
    omanik = sadamaPidajaEesnimi + " " + sadamaPidajaArinimiPerenimi;
  } else if (sadamaPidajaArinimiPerenimi) {
    omanik = sadamaPidajaArinimiPerenimi;
  }

  let omanik_telefon = "-";
  if (sadamaPidajaTelefon && sadamaPidajaTelefon.length !== 0) {
    omanik_telefon = sadamaPidajaTelefon.join(" ").split(" +").join(";+");
  }

  let omanik_epost = "-";
  if (sadamaPidajaEpost) {
    omanik_epost = sadamaPidajaEpost;
  }

  let koduleht = "-";
  if (sadamaPidajaKoduleht) {
    koduleht = sadamaPidajaKoduleht;
  }

  let sadamakapteni_nimi = "-";
  if (sadamaKaptenEesnimi && sadamaKaptenPerenimi) {
    sadamakapteni_nimi = sadamaKaptenEesnimi + " " + sadamaKaptenPerenimi;
  }

  let sadamakapteni_telefon = "-";
  if (sadamaKaptenTelefon && sadamaKaptenTelefon.length !== 0) {
    sadamakapteni_telefon = sadamaKaptenTelefon
      .join(" ")
      .split(" +")
      .join(";+");
  }

  let sadamakapteni_epost = "-";
  if (sadamaKaptenEpost) {
    sadamakapteni_epost = sadamaKaptenEpost;
  }

  let max_pikkus = "-";
  if (veesoidukiMaxPikkus) {
    max_pikkus = formatNumbers(veesoidukiMaxPikkus);
  }

  let max_laius = "-";
  if (veesoidukiMaxLaius) {
    max_laius = formatNumbers(veesoidukiMaxLaius);
  }

  let max_sygavus = "-";
  if (veesoidukiMaxSyvis) {
    max_sygavus = formatNumbers(veesoidukiMaxSyvis);
  }

  let coords = portTechnicalData.sadamaAsukoht;
  const input = {
    type: "Point",
    coordinates: [coords.x, coords.y],
  };

  const output = reproject.reproject(input, "EPSG:3301", "EPSG:4326", EPSG);
  const [lon, lat] = output.coordinates;

  let feature = {
    type: "Feature",
    properties: {
      sadamaregister: id,
      sadama_nimi: name,
      omanik: omanik,
      omanik_telefon: omanik_telefon,
      omanik_epost: omanik_epost,
      koduleht: koduleht,
      sadamakapteni_nimi: sadamakapteni_nimi,
      sadamakapteni_telefon: sadamakapteni_telefon,
      sadamakapteni_epost: sadamakapteni_epost,
      max_pikkus: max_pikkus,
      max_laius: max_laius,
      max_sygavus: max_sygavus,
      modified_date: muutmineKp,
    },
    geometry: {
      type: "Point",
      coordinates: [+lon.toFixed(5), +lat.toFixed(5)],
    },
  };

  return feature;
};

fetchPorts();
