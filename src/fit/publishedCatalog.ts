export type PublishedStudyStatus =
  "Reproduced" | "Close" | "Comparison" | "Not reproduced" | "Unsupported";

export type PublishedStudy = {
  label: string;
  fileName: string;
  status: PublishedStudyStatus;
};

// "Reproduced" means agreement with the publication at its reported
// precision. Every configured calculation is separately checked against an
// independent solver; the other labels describe comparison with the paper.
export const publishedStudyCatalog = [
  {
    label: "Eöt-Wash gravity · model comparison",
    fileName: "eotwash-model-comparison.trksess",
    status: "Comparison",
  },
  {
    label: "BESIII continuum",
    fileName: "besiii-ppbarpi0-continuum.trksess",
    status: "Reproduced",
  },
  {
    label: "ASASSN-14li radio",
    fileName: "asassn14li-radio.trksess",
    status: "Close",
  },
  {
    label: "Chromium Rydberg series",
    fileName: "cri-rydberg.trksess",
    status: "Close",
  },
  {
    label: "Ion chamber, thin walls",
    fileName: "ion-chamber-wall-thin.trksess",
    status: "Close",
  },
  {
    label: "Ion chamber, thick walls",
    fileName: "ion-chamber-wall-thick.trksess",
    status: "Close",
  },
  {
    label: "Pulsar-wind nebula / spin-down power",
    fileName: "pwn-luminosity-vs-edot.trksess",
    status: "Close",
  },
  {
    label: "Pulsar-wind nebula / light-cylinder field",
    fileName: "pwn-luminosity-vs-blc.trksess",
    status: "Close",
  },
  {
    label: "YMnO₃ damped spin precession",
    fileName: "ymno3-spin-precession.trksess",
    status: "Comparison",
  },
  {
    label: "DyFeO₃ damped coherent spin wave",
    fileName: "dyfeo3-spin-wave.trksess",
    status: "Comparison",
  },
  {
    label: "Ba-137m decay (single trace)",
    fileName: "ba137m-decay.trksess",
    status: "Comparison",
  },
  {
    label: "Supercooled-water viscosity (smoothed)",
    fileName: "supercooled-water-viscosity.trksess",
    status: "Comparison",
  },
  {
    label: "ASASSN-14li X-ray (95-row table)",
    fileName: "asassn14li-xray.trksess",
    status: "Not reproduced",
  },
  {
    label: "Pulsar luminosity / spin-down power",
    fileName: "pulsar-luminosity-vs-edot.trksess",
    status: "Not reproduced",
  },
  {
    label: "Pulsar luminosity / light-cylinder field",
    fileName: "pulsar-luminosity-vs-blc.trksess",
    status: "Not reproduced",
  },
  {
    label: "Photon index / temperature (ODR data)",
    fileName: "pulsar-photon-index-vs-temperature.csv",
    status: "Unsupported",
  },
] as const satisfies readonly PublishedStudy[];
