/* eslint-disable no-undefined, @typescript-eslint/no-floating-promises, @typescript-eslint/require-await */
import { common, logger, webpack } from "replugged";
import { SpotifyPlayerStateData } from "./types";

import * as controls from "./controls";
import {
  _dockIconsElement,
  _metadataElement,
  _playbackTimeDisplayElement,
  _timebarElement,
  artistsElement,
  coverArtElement,
  dockAnimations,
  dockElement,
  modalAnimations,
  modalElement,
  parseArtists,
  playbackTimeCurrentElement,
  playbackTimeDurationElement,
  timebarInnerElement,
  titleElement,
} from "./modal";
import {
  desktopIcon,
  desktopIconTitle,
  repeatIcon,
  repeatIconTitle,
  smartphoneIcon,
  smartphoneIconTitle,
} from "./icons";

const timebarUpdateRate = 500;

/**
 * Parse time in miliseconds to minutes:seconds format or hours:minutes:seconds format
 * @param {number} ms - Time in miliseconds
 * @returns {string} - Parsed time
 */
function parseTime(ms: number): string {
  if (typeof ms !== "number") return "";
  const dateObject = new Date(ms);
  const raw = {
    month: dateObject.getUTCMonth(),
    day: dateObject.getUTCDate(),
    hours: dateObject.getUTCHours(),
    minutes: dateObject.getUTCMinutes(),
    seconds: dateObject.getUTCSeconds(),
  };
  const parsedHours = raw.hours + (raw.day - 1) * 24 + raw.month * 30 * 24;

  return `${parsedHours > 0 ? `${parsedHours}:` : ""}${
    raw.minutes < 10 && parsedHours > 0 ? `0${raw.minutes}` : raw.minutes
  }:${raw.seconds < 10 ? `0${raw.seconds}` : raw.seconds}`;
}

class ModalManager {
  public timebarSetIntervalId: undefined | number;
  public timebarUpdateHandler: () => Promise<void>;
  public fluxSubscriptionFunction: undefined | (() => Promise<void>);
  public modalInjected: boolean;
  public panel: Element;
  public classes: Record<string, string>;
  public playerState: {
    isPlaying: boolean;
    accountId: string;
    trackState: {
      passed: number;
      duration: number;
      albumUrl: string;
    };
  };

  public constructor() {
    this.timebarSetIntervalId = undefined;
    this.fluxSubscriptionFunction = undefined;
    this.modalInjected = false;
    // @ts-expect-error - When panel is falsy it gets catched so it doesn't matter
    this.panel = undefined;
    this.classes = {};
    this.playerState = {
      isPlaying: false,
      accountId: "",
      trackState: {
        passed: 0,
        duration: 0,
        albumUrl: "",
      },
    };

    this.timebarUpdateHandler = async (): Promise<void> => {
      if (!this.playerState.isPlaying) {
        clearInterval(this.timebarSetIntervalId);
        this.timebarSetIntervalId = undefined;
        playbackTimeCurrentElement.innerText = playbackTimeCurrentElement.innerText || "0:00";
        return;
      }
      this.playerState.trackState.passed += timebarUpdateRate;
      if (parseTime(this.playerState.trackState.passed) !== playbackTimeCurrentElement.innerText)
        playbackTimeCurrentElement.innerText = parseTime(this.playerState.trackState.passed);
      timebarInnerElement.style.width = `${(
        (this.playerState.trackState.passed / this.playerState.trackState.duration) *
        100
      ).toFixed(4)}%`;
    };
  }

  public async getClasses(): Promise<void> {
    const activityClasses = await webpack.waitForModule<{
      activityName: string;
      bodyLink: string;
      ellipsis: string;
      nameNormal: string;
    }>(webpack.filters.byProps("activityName"));
    const anchorClasses = await webpack.waitForModule<{
      anchor: string;
      anchorUnderlineOnHover: string;
    }>(webpack.filters.byProps("anchorUnderlineOnHover"));
    const colorClasses = await webpack.waitForModule<{
      defaultColor: string;
      "text-sm/semibold": string;
    }>(webpack.filters.byProps("defaultColor"));
    const containerClasses = await webpack.waitForModule<{
      container: string;
    }>(webpack.filters.byProps("avatar", "customStatus"));
    const panelClasses = await webpack.waitForModule<{
      panels: string;
    }>(webpack.filters.byProps("panels"));

    this.classes = {
      activityName: this.classes.activityName || activityClasses.activityName,
      anchor: this.classes.anchor || anchorClasses.anchor,
      anchorUnderlineOnHover:
        this.classes.anchorUnderlineOnHover || anchorClasses.anchorUnderlineOnHover,
      bodyLink: this.classes.bodyLink || activityClasses.bodyLink,
      container: this.classes.container || containerClasses.container,
      defaultColor: this.classes.defaultColor || colorClasses.defaultColor,
      ellipsis: this.classes.ellipsis || activityClasses.ellipsis,
      nameNormal: this.classes.nameNormal || activityClasses.nameNormal,
      panels: this.classes.panels || panelClasses.panels,
      "text-sm/semibold": this.classes["text-sm/semibold"] || colorClasses["text-sm/semibold"],
    };
  }

  public async injectModal(): Promise<void> {
    if (this.modalInjected) {
      logger.warn("ModalManager#injectModal", "SpotifyModal", undefined, "Already injected");
      return;
    }

    if (Object.keys(this.classes).length === 0) await this.getClasses();

    if (!this.classes.panels) {
      logger.error("ModalManager#injectModal", "SpotifyModal", undefined, "Panel class not found");
      this.getClasses();
      return;
    }

    this.panel = document.getElementsByClassName(this.classes.panels)[0];
    if (!this.panel) {
      logger.error("ModalManager#injectModal", "SpotifyModal", undefined, "Panel not found");
      return;
    }

    if (!this.classes.container) {
      logger.error(
        "ModalManager#injectModal",
        "SpotifyModal",
        undefined,
        "Container class not found",
      );
      this.getClasses();
      return;
    }

    if (!modalElement.className.includes(this.classes.container))
      modalElement.classList.add(this.classes.container);
    if (!titleElement.className.includes(this.classes.anchor))
      titleElement.classList.add(
        this.classes.anchor,
        this.classes.anchorUnderlineOnHover,
        this.classes.defaultColor,
        this.classes["text-sm/semibold"],
        ...this.classes.nameNormal.split(" "),
      );
    if (!artistsElement.className.includes(this.classes.ellipsis))
      artistsElement.classList.add(this.classes.ellipsis);
    // @ts-expect-error - "afterBegin" is a valid argument for InsertPosition
    this.panel.insertAdjacentElement("afterBegin", modalElement);
    // @ts-expect-error - "afterEnd" is a valid argument for InsertPosition
    modalElement.insertAdjacentElement("afterEnd", dockElement);
    this.modalInjected = true;
    logger.log("ModalManager#injectModal", "SpotifyModal", undefined, "Modal injected");
  }

  public uninjectModal(): void {
    if (!this.modalInjected) {
      logger.warn("ModalManager#uninjectModal", "SpotifyModal", undefined, "Already uninjected");
      return;
    }
    this.panel.removeChild(modalElement);
    this.panel.removeChild(dockElement);
    this.modalInjected = false;
    logger.log("ModalManager#uninjectModal", "SpotifyModal", undefined, "Modal uninjected");
  }

  public async updateModal(data: SpotifyPlayerStateData): Promise<void> {
    if (data.isPlaying || data.track) {
      if (typeof this.timebarSetIntervalId !== "number")
        // @ts-expect-error - This is not Node.js, setInterval returns a Number.
        this.timebarSetIntervalId = setInterval(this.timebarUpdateHandler, timebarUpdateRate);

      if (modalElement.style.display === "none") modalAnimations.fadein();
      if (dockElement.style.display === "none") dockAnimations.fadein();

      const trackArtists = parseArtists(
        data.track,
        `${this.classes.anchor} ` +
          `${this.classes.anchorUnderlineOnHover} ` +
          `${this.classes.bodyLink} ` +
          `${this.classes.ellipsis}`,
      );
      const trackName = typeof data?.track?.name === "string" ? data.track.name : "Unknown";

      if (data.track.isLocal) {
        titleElement.href = "";
        titleElement.style.textDecoration = "none";
        titleElement.style.cursor = "default";
        coverArtElement.src = "";
        coverArtElement.title = "";
        coverArtElement.style.cursor = "";
      } else {
        titleElement.href = `https://open.spotify.com/track/${data.track.id}`;
        titleElement.style.textDecoration = "";
        titleElement.style.cursor = "";
        coverArtElement.src = data.track.album.image.url;
        coverArtElement.title = data.track.album.name;
        coverArtElement.style.cursor = "pointer";
      }

      if (parseTime(this.playerState.trackState.duration) !== playbackTimeDurationElement.innerText)
        playbackTimeDurationElement.innerText = parseTime(this.playerState.trackState.duration);

      desktopIcon.style.display = data?.device?.type === "Computer" ? "" : "none";
      desktopIconTitle.replaceChildren(
        document.createTextNode(
          data?.device?.type === "Computer" ? `Listening on: ${data.device.name}` : "",
        ),
      );

      smartphoneIcon.style.display = data?.device?.type === "Smartphone" ? "" : "none";
      smartphoneIconTitle.replaceChildren(
        document.createTextNode(
          data?.device?.type === "Smartphone" ? `Listening on: ${data.device.name}` : "",
        ),
      );

      repeatIcon.style.color = data.repeat ? "var(--brand-experiment-500)" : "var(--text-normal)";
      repeatIconTitle.replaceChildren(
        document.createTextNode(data.repeat ? "Repeat on" : "Repeat off"),
      );

      titleElement.replaceChildren(document.createTextNode(trackName));
      titleElement.title = trackName;
      artistsElement.replaceChildren(...trackArtists);
    } else {
      if (modalElement.style.display !== "none") modalAnimations.fadeout();
      if (dockElement.style.display !== "none") dockAnimations.fadeout();
    }
  }

  public async handleSpotifyStateChange(data: SpotifyPlayerStateData): Promise<void> {
    if (!this.modalInjected) this.injectModal();
    this.playerState.isPlaying = data.isPlaying;

    if (!this.playerState.accountId) {
      this.playerState.accountId = data.accountId;
      logger.log(
        "ModalManager#handleSpotifyStateChange",
        "SpotifyModal",
        undefined,
        "Registered new account ID:",
        this.playerState.accountId,
      );
    }

    if (this.playerState.accountId !== data.accountId) {
      logger.warn(
        "ModalManager#handleSpotifyStateChange",
        "SpotifyModal",
        undefined,
        "New state's account ID differs from current account ID. State change will be ignored.",
      );
      return;
    }

    if (data.isPlaying) {
      logger.log(
        "ModalManager#handleSpotifyStateChange",
        "SpotifyModal",
        undefined,
        "State updated: Playing",
        data,
      );

      this.playerState.trackState.duration = data.track.duration;
      this.playerState.trackState.passed = data.position;
      this.playerState.trackState.albumUrl = data.track.isLocal
        ? ""
        : `https://open.spotify.com/album/${data.track.album.id}`;

      this.updateModal(data);
    } else {
      logger.log(
        "ModalManager#handleSpotifyStateChange",
        "SpotifyModal",
        undefined,
        `State updated: Not playing, ${data.track ? "paused" : "closed"}`,
        data,
      );

      if (!data.track) this.playerState.accountId = "";

      this.updateModal(data);
    }
  }

  public registerFluxSubscription(): void {
    if (this.fluxSubscriptionFunction !== undefined) {
      logger.warn(
        "ModalManager#registerFluxSubscription",
        "SpotifyModal",
        undefined,
        "Already registered",
      );
    } else {
      // @ts-expect-error - fluxDispatcher is not a string
      common.fluxDispatcher.subscribe(
        "SPOTIFY_PLAYER_STATE",
        this.handleSpotifyStateChange.bind(this),
      );
      this.fluxSubscriptionFunction = [
        // @ts-expect-error - fluxDispatcher is not a string
        ...common.fluxDispatcher._subscriptions.SPOTIFY_PLAYER_STATE.values(),
        // @ts-expect-error - fluxDispatcher is not a string
      ][common.fluxDispatcher._subscriptions.SPOTIFY_PLAYER_STATE.size - 1];
      logger.log(
        "ModalManager#registerFluxSubscription",
        "SpotifyModal",
        undefined,
        "Registered FluxDispatcher subscription",
      );
    }
  }

  public unregisterFluxSubscription(): void {
    if (this.fluxSubscriptionFunction === undefined) {
      logger.warn(
        "ModalManager#unregisterFluxSubscription",
        "SpotifyModal",
        undefined,
        "Already unregistered",
      );
    } else {
      // @ts-expect-error - fluxDispatcher is not a string
      common.fluxDispatcher.unsubscribe("SPOTIFY_PLAYER_STATE", this.fluxSubscriptionFunction);
      logger.log(
        "ModalManager#unregisterFluxSubscription",
        "SpotifyModal",
        undefined,
        "Unregistered FluxDispatcher subscription",
      );
    }
  }
}

const modalManager = new ModalManager();

// Register anchorlike href for cover art image
coverArtElement.onclick = () => {
  if (!modalManager.playerState.trackState.albumUrl) return;
  window.open(modalManager.playerState.trackState.albumUrl, "_blank");
};

// @ts-expect-error - We are doing mutations
window.SpotifyModal = {
  components: {
    _dockIconsElement,
    _metadataElement,
    _playbackTimeDisplayElement,
    _timebarElement,
    artistsElement,
    coverArtElement,
    dockAnimations,
    dockElement,
    modalAnimations,
    modalElement,
    parseArtists,
    playbackTimeCurrentElement,
    playbackTimeDurationElement,
    timebarInnerElement,
    titleElement,
  },
  controls,
  modalManager,
};

export async function start(): Promise<void> {
  await modalManager.getClasses();
  modalManager.registerFluxSubscription();
}

export function stop(): void {
  modalManager.uninjectModal();
  if (typeof modalManager.timebarSetIntervalId === "number")
    clearInterval(modalManager.timebarSetIntervalId);
  modalManager.unregisterFluxSubscription();
}
