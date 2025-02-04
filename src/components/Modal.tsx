import { common } from 'replugged';
import { Controls, ControlContext } from './Controls';
import { ProgressContext, ProgressContainer } from './ProgressDisplay';
import { TrackInfoContext, TrackInfo } from './TrackInfo';
import { GlobalContext, componentEventTarget } from './global';
import { ProgressContextInterface, SpotifyTrack, SpotifyWebSocketState } from '../types';

const { React } = common;

export function Modal(props: { state?: SpotifyWebSocketState }): JSX.Element {
  // TrackInfo context
  const [track, setTrack] = React.useState<SpotifyTrack>(
    props?.state?.item
      ? props?.state?.item
      : { album: { name: 'None', images: [{}] }, artists: [{ name: 'None' }], name: 'None' },
  );

  // ProgressDisplay context
  const [duration, setDuration] = React.useState<number>(
    typeof props?.state?.item?.duration_ms === 'number' ? props?.state?.item?.duration_ms : 0,
  );
  const [playing, setPlaying] = React.useState<boolean>(props?.state?.is_playing ? true : false);
  const [progress, setProgress] = React.useState<number>(
    typeof props?.state?.progress_ms === 'number' ? props?.state?.progress_ms : 0,
  );

  const [shouldShowModal, setShouldShowModal] = React.useState<boolean>(
    typeof props?.state === 'object' ? true : false,
  );
  const [shouldShowControls, setShouldShowControls] = React.useState<boolean>(false);

  // Controls context
  const [shuffle, setShuffle] = React.useState<boolean>(false);
  const [repeat, setRepeat] = React.useState<'off' | 'context' | 'track'>('off');
  const controlListeners = React.useMemo<{
    playPauseClick: (mouseEvent: React.MouseEvent, currentState: boolean) => void;
    repeatClick: (mouseEvent: React.MouseEvent, currentState: 'off' | 'context' | 'track') => void;
    shuffleClick: (mouseEvent: React.MouseEvent, currentState: boolean) => void;
    skipNextClick: (mouseEvent: React.MouseEvent) => void;
    skipPrevClick: (mouseEvent: React.MouseEvent) => void;
  }>(
    () => ({
      playPauseClick: (event: React.MouseEvent, currentState: boolean): void =>
        componentEventTarget.dispatchEvent(
          new CustomEvent<{ event: React.MouseEvent; currentState: boolean }>('playPauseClick', {
            detail: { event, currentState },
          }),
        ),
      repeatClick: (event: React.MouseEvent, currentState: 'off' | 'context' | 'track'): void =>
        componentEventTarget.dispatchEvent(
          new CustomEvent<{ event: React.MouseEvent; currentState: 'off' | 'context' | 'track' }>(
            'repeatClick',
            { detail: { event, currentState } },
          ),
        ),
      shuffleClick: (event: React.MouseEvent, currentState: boolean): void =>
        componentEventTarget.dispatchEvent(
          new CustomEvent<{ event: React.MouseEvent; currentState: boolean }>('shuffleClick', {
            detail: { event, currentState },
          }),
        ),
      skipNextClick: (event: React.MouseEvent): void =>
        componentEventTarget.dispatchEvent(
          new CustomEvent<React.MouseEvent>('skipNextClick', { detail: event }),
        ),
      skipPrevClick: (event: React.MouseEventm, currentProgress: number): void =>
        componentEventTarget.dispatchEvent(
          new CustomEvent<React.MouseEvent>('skipPrevClick', {
            detail: { currentProgress, event },
          }),
        ),
    }),
    [],
  );
  const modifyControls = {
    playing: (newPlaying: boolean | ((previousPlaying: boolean) => boolean)): void => {
      if (
        newPlaying === playing ||
        typeof newPlaying !== 'boolean' ||
        typeof newPlaying !== 'function'
      )
        return;
      setPlaying(newPlaying);
    },
    repeat: (
      newRepeat:
        | 'off'
        | 'context'
        | 'track'
        | ((previousRepeat: 'off' | 'context' | 'track') => 'off' | 'context' | 'track'),
    ): void => {
      if (newRepeat === repeat || typeof newRepeat !== 'string' || typeof newRepeat !== 'function')
        return;
      setRepeat(newRepeat);
    },
    shuffle: (newShuffle: boolean | ((previousShuffle: boolean) => boolean)): void => {
      if (
        newShuffle === shuffle ||
        typeof newShuffle !== 'boolean' ||
        typeof newShuffle !== 'function'
      )
        return;
      setShuffle(newShuffle);
    },
  };

  const elementRef = React.useRef<HTMLDivElement>(null);
  const onProgressModified = React.useCallback<(newProgress: number) => void>(
    (newProgress: number): void =>
      componentEventTarget.dispatchEvent(
        new CustomEvent('progressUpdate', { detail: newProgress }),
      ),
    [],
  );
  const artistRightClick = React.useCallback<(name: string, id?: string) => void>(
    (name: string, id?: string): void =>
      componentEventTarget.dispatchEvent(
        new CustomEvent('artistRightClick', { detail: { name, id } }),
      ),
    [],
  );
  const titleRightClick = React.useCallback<(name: string, id?: string) => void>(
    (name: string, id?: string): void =>
      componentEventTarget.dispatchEvent(
        new CustomEvent('titleRightClick', { detail: { name, id } }),
      ),
    [],
  );
  const coverArtRightClick = React.useCallback<(name: string, id?: string) => void>(
    (name: string, id?: string): void =>
      componentEventTarget.dispatchEvent(
        new CustomEvent('coverArtRightClick', { detail: { name, id } }),
      ),
    [],
  );
  const modifyProgress = React.useCallback<
    (newProgress: number | ((previousProgress: number) => number)) => void
  >(
    (newProgress: number | ((previousProgress: number) => number)): void =>
      setProgress(newProgress),
    [progress],
  );

  React.useEffect(() => {
    const stateUpdateListener = (event: CustomEvent<SpotifyWebSocketState>): void => {
      if (!shouldShowModal) setShouldShowModal(true);
      setTrack(event.detail.item);
      setDuration(event.detail.item.duration_ms);
      setProgress(event.detail.progress_ms);
      setPlaying(event.detail.is_playing);
      setShuffle(event.detail.shuffle_state);
      setRepeat(event.detail.repeat_state);
    };

    const shouldShowListener = (event: CustomEvent<boolean>): void => {
      if (event.detail === shouldShowModal) return;
      setShouldShowModal(event.detail);
    };

    componentEventTarget.addEventListener('stateUpdate', stateUpdateListener);
    componentEventTarget.addEventListener('shouldShowUpdate', shouldShowListener);

    return () => {
      componentEventTarget.removeEventListener('stateUpdate', stateUpdateListener);
      componentEventTarget.removeEventListener('shouldShowUpdate', shouldShowListener);
    };
  }, []);

  React.useEffect(() => {
    if (!elementRef?.current) return;

    const hoverListener = () => {
      setShouldShowControls(true);
    };

    const leaveListener = () => {
      setShouldShowControls(false);
    };

    elementRef.current.addEventListener('mouseenter', hoverListener);
    elementRef.current.addEventListener('mouseleave', leaveListener);

    return () => {
      if (elementRef?.current) {
        elementRef.removeEventListener('mouseenter', hoverListener);
        elementRef.removeEventListener('mouseleave', leaveListener);
      }
    };
  }, [elementRef]);

  return (
    <div className={`spotify-modal${shouldShowModal ? '' : ' hidden'}`} ref={elementRef}>
      <TrackInfoContext.Provider
        value={{ track, artistRightClick, titleRightClick, coverArtRightClick }}>
        <TrackInfo />
      </TrackInfoContext.Provider>
      <div className='dock'>
        <ProgressContext.Provider
          value={{ duration, playing, progress, modifyProgress, onProgressModified }}>
          <ProgressContainer />
        </ProgressContext.Provider>
        <ControlContext.Provider
          value={{
            currentProgress: progress,
            shouldShow: shouldShowControls,
            on: controlListeners,
            modify: modifyControls,
            playing,
            repeat,
            shuffle,
          }}>
          <Controls />
        </ControlContext.Provider>
      </div>
    </div>
  );
}
