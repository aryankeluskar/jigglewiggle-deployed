"use client";

type Props = {
  videoId: string | null;
};

export default function YoutubePanel({ videoId }: Props) {
  if (!videoId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/40 rounded-2xl border border-white/10">
        <p className="text-white/40 text-sm">Paste a YouTube URL above to get started</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden border border-white/10">
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
        title="YouTube video"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="w-full h-full"
      />
    </div>
  );
}
