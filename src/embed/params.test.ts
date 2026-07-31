import { describe, expect, it } from "vitest";
import { parseFollowCardLoopConfig, parseRiffleLoopConfig } from "./params";

describe("parseRiffleLoopConfig", () => {
  it("falls back to defaults when no params are given", () => {
    const cfg = parseRiffleLoopConfig(new URLSearchParams(""));
    expect(cfg).toEqual({
      deckSize: 52,
      colorSchemeId: "sunset",
      holdMs: 1000,
      resetHoldMs: 1000,
      showText: false,
    });
  });

  it("reads valid params", () => {
    const cfg = parseRiffleLoopConfig(
      new URLSearchParams("deckSize=20&colorScheme=viridis&holdMs=500&resetHoldMs=300&showText=0"),
    );
    expect(cfg).toEqual({
      deckSize: 20,
      colorSchemeId: "viridis",
      holdMs: 500,
      resetHoldMs: 300,
      showText: false,
    });
  });

  it("parses showText booleans and falls back on garbage", () => {
    expect(parseRiffleLoopConfig(new URLSearchParams("showText=1")).showText).toBe(true);
    expect(parseRiffleLoopConfig(new URLSearchParams("showText=true")).showText).toBe(true);
    expect(parseRiffleLoopConfig(new URLSearchParams("showText=false")).showText).toBe(false);
    expect(parseRiffleLoopConfig(new URLSearchParams("showText=nonsense")).showText).toBe(false);
  });

  it("falls back to defaults on garbage numeric input", () => {
    const cfg = parseRiffleLoopConfig(new URLSearchParams("deckSize=abc&holdMs=notanumber"));
    expect(cfg.deckSize).toBe(52);
    expect(cfg.holdMs).toBe(1000);
  });

  it("clamps out-of-range numeric input", () => {
    const cfg = parseRiffleLoopConfig(new URLSearchParams("deckSize=1&holdMs=-5"));
    expect(cfg.deckSize).toBe(2);
    expect(cfg.holdMs).toBe(0);

    const clampedHigh = parseRiffleLoopConfig(new URLSearchParams("deckSize=9999&holdMs=999999"));
    expect(clampedHigh.deckSize).toBe(200);
    expect(clampedHigh.holdMs).toBe(10000);
  });
});

describe("parseFollowCardLoopConfig", () => {
  it("falls back to defaults when no params are given", () => {
    const cfg = parseFollowCardLoopConfig(new URLSearchParams(""));
    expect(cfg).toEqual({
      deckSize: 52,
      colorSchemeId: "sunset",
      numTrials: 2000,
      shuffleCount: 4,
      sweepIntervalMs: 100,
      showText: false,
    });
  });

  it("reads valid params", () => {
    const cfg = parseFollowCardLoopConfig(
      new URLSearchParams(
        "deckSize=20&colorScheme=grayscale&numTrials=500&shuffleCount=6&sweepIntervalMs=200&showText=false",
      ),
    );
    expect(cfg).toEqual({
      deckSize: 20,
      colorSchemeId: "grayscale",
      numTrials: 500,
      shuffleCount: 6,
      sweepIntervalMs: 200,
      showText: false,
    });
  });

  it("clamps numTrials and sweepIntervalMs to their bounds", () => {
    const clampedHigh = parseFollowCardLoopConfig(new URLSearchParams("numTrials=99999&sweepIntervalMs=1"));
    expect(clampedHigh.numTrials).toBe(5000);
    expect(clampedHigh.sweepIntervalMs).toBe(16);

    const clampedLow = parseFollowCardLoopConfig(new URLSearchParams("numTrials=0&sweepIntervalMs=99999"));
    expect(clampedLow.numTrials).toBe(1);
    expect(clampedLow.sweepIntervalMs).toBe(2000);
  });

  it("falls back to defaults on garbage input", () => {
    const cfg = parseFollowCardLoopConfig(new URLSearchParams("numTrials=nope&shuffleCount=??"));
    expect(cfg.numTrials).toBe(2000);
    expect(cfg.shuffleCount).toBe(4);
  });
});
