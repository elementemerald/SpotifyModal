import { common, components } from 'replugged';
import { ControlContextInterface } from './types';
import { componentEventTarget, paths } from './global';
const { React } = common;

export const ControlContext = React.createContext<ControlContextInterface>({
  modify: {
    playing: (): void => {},
    repeat: (): void => {},
    shuffle: (): void => {},
  },
  on: {
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
    skipPrevClick: (event: React.MouseEvent, currentProgress: number): void =>
      componentEventTarget.dispatchEvent(
        new CustomEvent<React.MouseEvent>('skipPrevClick', { detail: { event, currentProgress } }),
      ),
  },
  playing: false,
  repeat: 'off',
  shuffle: false,
});

function Icon(props: {
  className?: string;
  fill?: string;
  onClick?: (mouseEvent: React.MouseEvent) => void;
  title?: string;
  path: string;
}): JSX.Element {
  return (
    <svg
      className={typeof props.className === 'string' ? props.className : ''}
      onClick={typeof props.onClick === 'function' ? props.onClick : null}
      viewBox='0 0 24 24'>
      <title>{typeof props.title === 'string' ? props.title : ''}</title>
      <path fill={typeof props.fill === 'string' ? props.fill : 'currentColor'} d={props.path} />
    </svg>
  );
}

export function Controls(): JSX.Element {
  const context = React.useContext<ControlContextInterface>(ControlContext);

  return (
    <div className={`controls${context.shouldShow ? '' : ' hidden'}`}>
      <Icon
        className={`shuffle${context.shuffle ? ' active' : ''}`}
        onClick={(e: React.MouseEvent): void => context.on.shuffleClick(e, context.shuffle)}
        path={paths.shuffle}
        title={`Shuffle ${context.shuffle ? 'on' : 'off'}`}
      />
      <Icon
        className='skip-prev'
        onClick={(e: React.MouseEvent) => context.on.skipPrevClick(e, context.currentProgress)}
        path={paths.skipPrevious}
        title='Skip to previous track'
      />
      <Icon
        className='play-pause'
        onClick={(e: React.MouseEvent): void => context.on.playPauseClick(e, context.playing)}
        path={context.playing ? paths.pause : paths.play}
        title={`${context.playing ? 'Pause' : 'Resume'} track`}
      />
      <Icon
        className='skip-next'
        onClick={context.on.skipNextClick}
        path={paths.skipNext}
        title='Skip to next track'
      />
      <Icon
        className={`repeat${context.repeat !== 'off' ? ' active' : ''}`}
        onClick={(e: React.MouseEvent): void => context.on.repeatClick(e, context.repeat)}
        path={context.repeat !== 'track' ? paths.repeatAll : paths.repeatOne}
        title={`Repeat ${context.repeat !== 'context' ? context.repeat : 'all'}`}
      />
    </div>
  );
}
