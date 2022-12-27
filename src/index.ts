import { Logger, common } from "replugged";
import { modal } from "./modal";

/*
  Very WIP Spotify modal implementation
  FYI: This is my first time using JavaScript's Web APIs so if I do
       things differently than normal people does then please let me know
 */

// asportnoy please export Logger as a global Replugged module
const logger = new Logger("SpotifyModal", "SpotifyModal");

let panel;
let modalInjected = false;
let containerClassName = "";
let panelClassName = "";
let fluxDispatcherSubscriptionId = 0;

const handleSpotifyPlayerStateChange = (data): void => {
  if (!modalInjected)
    if (!injectModal()) {
      logger.warn("handleSpotifyPlayerStateChange() failed: Modal injection failed");
      return;
    }
  if (data.isPlaying) {
    modal.style.display = "flex";
    modal.children[0].src =
      typeof data?.track?.album?.image?.url === "string" ? data.track.album.image.url : "";
    let artists = "";
    data.track.artists.forEach(({ name }, i) => {
      if (data.track.artists.length - 1 === i) artists += `${name}`;
      else artists += `${name}, `;
    });
    if (!artists.length) artists = "Unknown";
    modal.children[1].children[0].replaceChildren(
      document.createTextNode(typeof data?.track?.name === "string" ? data.track.name : "Unknown"),
    );
    modal.children[1].children[1].replaceChildren(document.createTextNode(`by ${artists}`));
    logger.log("Spotify state changed; player is playing", data);
  } else {
    logger.log("Spotify state changed; player is not playing", data);
    modal.style.display = "none";
  }
};

// fluxDispatcher: SPOTIFY_PLAYER_STATE
export async function start(): Promise<void> {
  const panelClasses = await replugged.webpack.waitForModule<{
    panels: string;
  }>(replugged.webpack.filters.byProps("panels"));
  if (panelClasses) {
    panelClassName = panelClasses.panels;
    common.fluxDispatcher.subscribe("SPOTIFY_PLAYER_STATE", handleSpotifyPlayerStateChange);
    fluxDispatcherSubscriptionId =
      common.fluxDispatcher._subscriptions.SPOTIFY_PLAYER_STATE.size - 1;
  }
}

export function injectModal(): boolean {
  if (!document.body.getElementsByClassName(panelClassName)[0]) {
    logger.warn("injectModal() failed: Cannot get user panel");
    return false;
  }
  if (!panel) panel = document.body.getElementsByClassName(panelClassName)[0];
  if (!containerClassName)
    for (const element of panel.children) {
      if (/^container-[a-zA-Z0-9]{6}$/.test(element.className))
        containerClassName = element.className;
    }
  if (!containerClassName) {
    logger.warn("injectModal() failed: Container class name was still not found");
    return false;
  }
  if (modalInjected) {
    logger.warn("injectModal() failed: Modal was already injected");
    return false;
  }
  if (!modal.className.includes("container")) modal.classList.add(containerClassName);
  panel.insertAdjacentElement("afterBegin", modal);
  logger.log("Modal injected");
  return (modalInjected = true);
}

export function uninjectModal(): boolean {
  if (!modalInjected) {
    logger.warn("uninjectModal() failed: Modal is not injected");
    return false;
  }
  if (!document.body.getElementsByClassName(panelClassName)[0]) {
    logger.warn("uninjectModal() failed: Cannot get user panel");
    return false;
  }
  if (!panel) panel = document.body.getElementsByClassName(panelClassName)[0];
  panel.removeChild(modal);
  logger.warn("Modal uninjected");
  return true;
}

export function stop(): void {
  uninjectModal();
  if (common.fluxDispatcher._subscriptions.SPOTIFY_PLAYER_STATE)
    common.fluxDispatcher.unsubscribe(
      "SPOTIFY_PLAYER_STATE",
      [...common.fluxDispatcher._subscriptions.SPOTIFY_PLAYER_STATE][fluxDispatcherSubscriptionId],
    );
}
