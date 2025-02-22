import { useEffect, useState, useRef, useCallback, useContext } from "react";
import { AppSettingsProviderContext } from "@renderer/context";
import { PitchContour } from "@renderer/components";
import WaveSurfer from "wavesurfer.js";
import { Button, Skeleton } from "@renderer/components/ui";
import { PlayIcon, PauseIcon } from "lucide-react";
import { useIntersectionObserver } from "@uidotdev/usehooks";
import { secondsToTimestamp } from "@renderer/lib/utils";
import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
  DefaultAudioLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
export const STORAGE_WORKER_ENDPOINT = "https://enjoy-storage.baizhiheizi.com";

export const PostAudio = (props: {
  audio: Partial<MediumType>;
  height?: number;
}) => {
  const { audio, height = 80 } = props;
  const [currentTime, setCurrentTime] = useState<number>(0);
  const { webApi } = useContext(AppSettingsProviderContext);
  const [transcription, setTranscription] = useState<TranscriptionType>();

  const currentTranscription = (transcription?.result || []).find(
    (s) =>
      currentTime >= s.offsets.from / 1000.0 &&
      currentTime <= s.offsets.to / 1000.0
  );

  useEffect(() => {
    webApi
      .transcriptions({
        targetMd5: audio.md5,
      })
      .then((response) => {
        setTranscription(response?.transcriptions?.[0]);
      });
  }, [audio.md5]);

  return (
    <div className="w-full">
      {audio.sourceUrl.startsWith(STORAGE_WORKER_ENDPOINT) ? (
        <WavesurferPlayer
          currentTime={currentTime}
          setCurrentTime={setCurrentTime}
          audio={audio}
          height={height}
        />
      ) : (
        <MediaPlayer
          onTimeUpdate={({ currentTime: _currentTime }) => {
            setCurrentTime(_currentTime);
          }}
          src={audio.sourceUrl}
        >
          <MediaProvider />
          <DefaultAudioLayout icons={defaultLayoutIcons} />
        </MediaPlayer>
      )}

      {currentTranscription && (
        <div className="mt-2 bg-muted px-4 py-2 rounded">
          <div className="text-muted-foreground text-center font-serif">
            {currentTranscription.text}
          </div>
        </div>
      )}

      {audio.coverUrl && (
        <div className="mt-2">
          <img src={audio.coverUrl} className="w-full rounded" />
        </div>
      )}
    </div>
  );
};

const WavesurferPlayer = (props: {
  audio: Partial<MediumType>;
  height?: number;
  currentTime: number;
  setCurrentTime: (currentTime: number) => void;
}) => {
  const { audio, height = 80, currentTime, setCurrentTime } = props;
  const [initialized, setInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wavesurfer, setWavesurfer] = useState(null);
  const containerRef = useRef();
  const [ref, entry] = useIntersectionObserver({
    threshold: 1,
  });
  const [duration, setDuration] = useState<number>(0);

  const onPlayClick = useCallback(() => {
    wavesurfer.isPlaying() ? wavesurfer.pause() : wavesurfer.play();
  }, [wavesurfer]);

  useEffect(() => {
    // use the intersection observer to only create the wavesurfer instance
    // when the player is visible
    if (!entry?.isIntersecting) return;
    if (!audio.sourceUrl) return;
    if (wavesurfer) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      url: audio.sourceUrl,
      height,
      barWidth: 1,
      cursorWidth: 0,
      autoCenter: true,
      autoScroll: true,
      dragToSeek: true,
      hideScrollbar: true,
      minPxPerSec: 100,
      waveColor: "#ddd",
      progressColor: "rgba(0, 0, 0, 0.25)",
    });

    setWavesurfer(ws);
  }, [audio.sourceUrl, entry]);

  useEffect(() => {
    if (!wavesurfer) return;

    const subscriptions = [
      wavesurfer.on("play", () => {
        setIsPlaying(true);
      }),
      wavesurfer.on("pause", () => {
        setIsPlaying(false);
      }),
      wavesurfer.on("timeupdate", (time: number) => {
        setCurrentTime(time);
      }),
      wavesurfer.on("decode", () => {
        setDuration(wavesurfer.getDuration());
        const peaks = wavesurfer.getDecodedData().getChannelData(0);
        const sampleRate = wavesurfer.options.sampleRate;
        wavesurfer.renderer.getWrapper().appendChild(
          PitchContour({
            peaks,
            sampleRate,
            height,
          })
        );
        setInitialized(true);
      }),
    ];

    return () => {
      subscriptions.forEach((unsub) => unsub());
      wavesurfer?.destroy();
    };
  }, [wavesurfer]);

  return (
    <>
      <div className="flex justify-end">
        <span className="text-xs text-muted-foreground">
          {secondsToTimestamp(duration)}
        </span>
      </div>

      <div
        ref={ref}
        className="bg-background rounded-lg grid grid-cols-9 items-center relative h-[80px]"
      >
        {!initialized && (
          <div className="col-span-9 flex flex-col justify-around h-[80px]">
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-3 w-full rounded-full" />
            <Skeleton className="h-3 w-full rounded-full" />
          </div>
        )}

        <div className={`flex justify-center ${initialized ? "" : "hidden"}`}>
          <Button
            onClick={onPlayClick}
            className="aspect-square rounded-full p-2 w-12 h-12 bg-blue-600 hover:bg-blue-500"
          >
            {isPlaying ? (
              <PauseIcon className="w-6 h-6 text-white" />
            ) : (
              <PlayIcon className="w-6 h-6 text-white" />
            )}
          </Button>
        </div>

        <div
          className={`col-span-8 ${initialized ? "" : "hidden"}`}
          ref={containerRef}
        ></div>
      </div>
    </>
  );
};
