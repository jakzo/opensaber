import JSZip, { JSZipObject } from "jszip";
import * as t from "runtypes";

import {
  Level,
  LevelDifficulty,
  LevelObjectBlock,
  LevelObjectType,
} from "./level";
import { asyncMap } from "./utils";

const BeatSaberInfoDat = t.Record({
  _version: t.String.withConstraint((v) => v.startsWith("2.")),
  _songName: t.String,
  _songSubName: t.String,
  _songAuthorName: t.String,
  _levelAuthorName: t.String,
  _beatsPerMinute: t.Number,
  _songFilename: t.String,
  _difficultyBeatmapSets: t.Array(
    t.Record({
      _beatmapCharacteristicName: t.String,
      _difficultyBeatmaps: t.Array(
        t.Record({
          _difficulty: t.String,
          _beatmapFilename: t.String,
          _noteJumpMovementSpeed: t.Number,
          _customData: t.Optional(t.Partial({ _difficultyLabel: t.String })),
        })
      ),
    })
  ),
});
const BeatSaberBeatmap = t.Record({
  _version: t.String.withConstraint((v) => v.startsWith("2.")),
  _notes: t.Array(
    t.Record({
      _time: t.Number,
      _lineIndex: t.Number,
      _lineLayer: t.Number,
      _type: t.Number,
      _cutDirection: t.Number,
    })
  ),
});

const beatsaberCharacteristicMappings: Record<string, string> = {
  Standard: "standard",
};

export const readBeatsaberMap = async (
  zipContents: ArrayBuffer
): Promise<Level> => {
  const zip = new JSZip();
  await zip.loadAsync(zipContents);
  const getFileFromZip = (fileType: string, path: string): JSZipObject => {
    const file = zip.file(path);
    if (!file)
      throw new Error(`${fileType} file does not exist in Beat Saber map`);
    return file;
  };
  const getJsonFileFromZip = async <T extends t.Runtype>(
    fileType: string,
    path: string,
    schema: T
  ): Promise<t.Static<T>> => {
    const contents = await getFileFromZip(fileType, path).async("string");
    let data: unknown;
    try {
      data = JSON.parse(contents);
    } catch {
      throw new Error(`${fileType} file is not valid JSON`);
    }
    return schema.check(data);
  };

  const info = await getJsonFileFromZip(
    "Info.dat",
    "Info.dat",
    BeatSaberInfoDat
  );
  const beatDuration = 60 / info._beatsPerMinute;
  return {
    title: info._songName,
    subtitle: info._songSubName || undefined,
    artist: info._songAuthorName,
    mapper: info._levelAuthorName,
    audio: new Audio(
      URL.createObjectURL(
        await getFileFromZip("Song audio", info._songFilename).async("blob")
      )
    ),
    maps: Object.fromEntries(
      await asyncMap(
        info._difficultyBeatmapSets,
        async (set): Promise<[string, LevelDifficulty[]]> => [
          beatsaberCharacteristicMappings[set._beatmapCharacteristicName] ||
            set._beatmapCharacteristicName,
          await asyncMap(
            set._difficultyBeatmaps,
            async (map): Promise<LevelDifficulty> => ({
              name: map._customData?._difficultyLabel || map._difficulty,
              speed: map._noteJumpMovementSpeed,
              objects: (
                await getJsonFileFromZip(
                  "Difficulty beatmap",
                  map._beatmapFilename,
                  BeatSaberBeatmap
                )
              )._notes.flatMap((note): LevelObjectBlock[] => {
                const type = ([
                  LevelObjectType.BLOCK_LEFT,
                  LevelObjectType.BLOCK_RIGHT,
                ] as const)[note._type];
                return type
                  ? [
                      {
                        type,
                        time: note._time * beatDuration * 1000,
                        x: (note._lineIndex - 1.5) * 0.6,
                        y: (note._lineLayer - 1.5) * 0.6,
                        rot:
                          [180, 0, 270, 90, 225, 135, 315, 45][
                            note._cutDirection
                          ] || 0,
                        anyDir: note._cutDirection === 8,
                      },
                    ]
                  : [];
              }),
            })
          ),
        ]
      )
    ),
  };
};
