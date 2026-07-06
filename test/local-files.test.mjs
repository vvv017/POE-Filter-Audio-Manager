import assert from "node:assert/strict";

import {
  cleanTargetBase,
  compareAudioFiles,
  fileExtension,
  localDefaultFolders,
  parseRuleName
} from "../public/js/local-files.js";

assert.equal(fileExtension("Alert.MP3"), ".mp3");
assert.equal(cleanTargetBase(" bad:name.mp3 "), "badname");
assert.deepEqual(localDefaultFolders().map(folder => folder.name), ["Path of Exile", "Path of Exile 2"]);
assert.deepEqual(parseRuleName("10scarab.mp3"), {
  isRule: true,
  slot: "10",
  key: "scarab",
  base: "10scarab"
});
assert.deepEqual(parseRuleName("custom_2.wav"), {
  isRule: false,
  slot: "",
  key: "",
  base: "custom_2"
});

const files = [
  { name: "z.mp3", rule: parseRuleName("z.mp3") },
  { name: "2beta.mp3", rule: parseRuleName("2beta.mp3") },
  { name: "10alpha.mp3", rule: parseRuleName("10alpha.mp3") },
  { name: "2alpha.mp3", rule: parseRuleName("2alpha.mp3") }
];

assert.deepEqual(files.sort(compareAudioFiles).map(file => file.name), [
  "2alpha.mp3",
  "2beta.mp3",
  "10alpha.mp3",
  "z.mp3"
]);
