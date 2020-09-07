var fs = require("fs");
const fetch = require("node-fetch");
const dmsConversion = require("dms-conversion");
const DEBUG = true;

const fetchPorts = async () => {
  const url = "https://www.sadamaregister.ee/ports";
  const geojson = {
    type: "FeatureCollection",
    features: [],
  };

  try {
    const response = await fetch(url);
    const json = await response.json();

    let ports = json.map(({ id, name }) => [
      id,
      name.replace(/\s+/g, " ").trim(),
    ]);
    if (DEBUG) ports = ports.slice(10, 12);

    ports.forEach((port, i) => {
      setTimeout(async () => {
        const feature = await fetchPort(port);
        geojson.features.push(feature);

        if (i == ports.length - 1) {
          let data;
          if (DEBUG) data = JSON.stringify(geojson, null, 2);
          else data = JSON.stringify(geojson);
          fs.writeFile("data.json", data, (err) => {
            if (err) throw err;
          });
        }
      }, i * 250); // 0.25s delay for scraping
    });
  } catch (error) {
    console.log(error);
  }
};

const fetchPort = async (port) => {
  const [id, name] = port;

  const url = `https://www.sadamaregister.ee/ports/${id}/json`;

  try {
    const response = await fetch(url);
    const json = await response.json();

    const { portMainData } = json;

    //console.log(json);

    let {
      sadamaPidajaEesnimi,
      sadamaPidajaArinimiPerenimi,
      sadamaPidajaTelefon,
      sadamaPidajaEpost,
      sadamaPidajaKoduleht,

      sadamaKaptenEesnimi,
      sadamaKaptenPerenimi,
      sadamaKaptenTelefon,
      sadamaKaptenEpost,

      veesoidukiMaxPikkus,
      veesoidukiMaxLaius,
      veesoidukiMaxSyvis,
    } = portMainData;

    let omanik = "-";
    if (sadamaPidajaEesnimi && sadamaPidajaArinimiPerenimi) {
      omanik = sadamaPidajaEesnimi + " " + sadamaPidajaArinimiPerenimi;
    } else if (sadamaPidajaArinimiPerenimi) {
      omanik = sadamaPidajaArinimiPerenimi;
    }

    let omanik_telefon = "-";
    if (sadamaPidajaTelefon && sadamaPidajaTelefon.length !== 0) {
      omanik_telefon = sadamaPidajaTelefon.join(";");
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
      sadamakapteni_telefon = sadamaKaptenTelefon.join(";");
    }

    let sadamakapteni_epost = "-";
    if (sadamaKaptenEpost) {
      sadamakapteni_epost = sadamaKaptenEpost;
    }

    let max_pikkus = "-";
    if (veesoidukiMaxPikkus) {
      max_pikkus = veesoidukiMaxPikkus;
    }

    let max_laius = "-";
    if (veesoidukiMaxLaius) {
      max_laius = veesoidukiMaxLaius;
    }

    let max_sygavus = "-";
    if (veesoidukiMaxSyvis) {
      max_sygavus = veesoidukiMaxSyvis;
    }

    let coords = portMainData.sadamaAsukoht.split(";");
    coords = coords.map((str) => str.trim());
    const [lat, lon] = coords.map(dmsConversion.parseDms);

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
      },
      geometry: {
        type: "Point",
        coordinates: [+lon.toFixed(5), +lat.toFixed(5)],
      },
    };

    return feature;
  } catch (error) {
    console.log(id, name, error);
  }
};

fetchPorts();
