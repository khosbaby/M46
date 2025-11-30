'use client';

import Hls from 'hls.js';
import { ComponentPropsWithoutRef, ForwardedRef, MutableRefObject, forwardRef, useEffect, useRef } from 'react';

type AdaptiveVideoProps = Omit<ComponentPropsWithoutRef<'video'>, 'src'> & {
  src?: string;
};

const isHlsSource = (src?: string) => Boolean(src && /\.m3u8($|\?)/i.test(src));

function assignRef<T>(target: ForwardedRef<T>, value: T) {
  if (typeof target === 'function') {
    target(value);
  } else if (target) {
    (target as MutableRefObject<T>).current = value;
  }
}

export const AdaptiveVideo = forwardRef<HTMLVideoElement, AdaptiveVideoProps>(function AdaptiveVideo({ src, ...rest }, ref) {
  const localRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = localRef.current;
    if (!video) return;
    if (!src) {
      video.removeAttribute('src');
      video.load();
      return;
    }

    let hlsInstance: Hls | null = null;
    const cleanup = () => {
      if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
      }
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
    };

    if (isHlsSource(src)) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
        return cleanup;
      }
      if (Hls.isSupported()) {
        hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: true });
        hlsInstance.loadSource(src);
        hlsInstance.attachMedia(video);
        return cleanup;
      }
    }

    video.src = src;
    return cleanup;
  }, [src]);

  return (
    <video
      {...rest}
      ref={node => {
        localRef.current = node;
        assignRef(ref, node);
      }}
    />
  );
});
