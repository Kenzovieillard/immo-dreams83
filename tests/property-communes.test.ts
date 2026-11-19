import assert from "node:assert/strict";
import test from "node:test";
import { readCommuneReference } from "../src/lib/property-commune-reference";
import {
  findPropertyCommune,
  groupPropertiesByCommune,
} from "../src/lib/property-communes";

const toulon = {
  code: "83137",
  name: "Toulon",
  latitude: 43.1364,
  longitude: 5.9334,
};
const marseille = {
  code: "13055",
  name: "Marseille",
  latitude: 43.2803,
  longitude: 5.3806,
};
const solliesPont = {
  code: "83130",
  name: "Solliès-Pont",
  latitude: 43.1895,
  longitude: 6.0625,
};
const solliesToucas = {
  code: "83131",
  name: "Solliès-Toucas",
  latitude: 43.2097,
  longitude: 5.9836,
};
const index = {
  "83000": [toulon],
  "83200": [toulon],
  "13005": [marseille],
  "83210": [solliesPont, solliesToucas],
};

test("regroupe les codes postaux et arrondissements sous la commune officielle", () => {
  const result = groupPropertiesByCommune(
    [
      { city: "Toulon", postalCode: "83000" },
      { city: "TOULON ", postalCode: "83200" },
      { city: "Marseille 05", postalCode: "13005" },
      { city: "Non renseignée", postalCode: "00000" },
    ],
    index,
  );
  assert.deepEqual(
    result.groups.map((group) => [group.centre.name, group.properties.length]),
    [
      ["Marseille", 1],
      ["Toulon", 2],
    ],
  );
  assert.equal(result.unlocated.length, 1);
});

test("distingue les communes partageant un code postal sans dépendre des accents ou tirets", () => {
  assert.equal(
    findPropertyCommune("Sollies Pont", "83210", index)?.code,
    "83130",
  );
  assert.equal(
    findPropertyCommune("SOLLIÈS TOUCAS", "83210", index)?.code,
    "83131",
  );
});

test("laisse un code absent ou ambigu dans les biens sans repère", () => {
  assert.equal(findPropertyCommune("Solliès", "83210", index), undefined);
  assert.equal(
    findPropertyCommune("Commune inconnue", "99999", index),
    undefined,
  );
  assert.equal(
    findPropertyCommune("Toulon", "00000", { "00000": [toulon] }),
    undefined,
  );
});

test("le référentiel livré couvre les principaux codes du portefeuille", () => {
  const reference = readCommuneReference([
    "83000",
    "83200",
    "13005",
    "13012",
    "83210",
  ]);
  for (const code of ["83000", "83200"]) {
    assert.equal(findPropertyCommune("Toulon", code, reference)?.code, "83137");
  }
  for (const code of ["13005", "13012"]) {
    assert.equal(
      findPropertyCommune(`Marseille ${code.slice(-2)}`, code, reference)?.code,
      "13055",
    );
  }
  assert.equal(
    findPropertyCommune("Solliès-Pont", "83210", reference)?.code,
    "83130",
  );
  assert.equal(
    findPropertyCommune("Solliès-Toucas", "83210", reference)?.code,
    "83131",
  );
});
